/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { INativeHostService } from '../../../../platform/native/common/native.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import {
	CloudApiError,
	CloudAuthChangeEvent,
	CloudAuthState,
	CloudAuthStatus,
	CloudBalanceChangeEvent,
	CloudSession,
	CloudUser,
	CreditBalance,
	CreditPack,
} from '../common/voidCloudTypes.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { IMetricsService } from '../common/metricsService.js';

// Storage keys
const CLOUD_SESSION_KEY = 'void.cloud.session';
const CLOUD_BALANCE_KEY = 'void.cloud.balance';

// Production constants
const SESSION_REFRESH_BUFFER_SECONDS = 5 * 60; // Refresh 5 minutes before expiry
const MAX_API_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1000;
const LOW_CREDITS_WARNING_THRESHOLD = 1000; // Warn when below 1000 credits
const DEFAULT_REQUEST_TIMEOUT_MS = 60000; // 60 second timeout for API requests
const LLM_REQUEST_TIMEOUT_MS = 120000; // 2 minute timeout for LLM requests (can take longer)
const HEALTH_CHECK_TIMEOUT_MS = 10000; // 10 second timeout for health checks
const CLIENT_VERSION = '2.0.0'; // Client version for API compatibility

// ============================================
// SERVICE INTERFACE
// ============================================

// Network status change event
export interface CloudNetworkChangeEvent {
	isOnline: boolean;
}

export interface IVoidCloudService {
	readonly _serviceBrand: undefined;

	// Auth state
	readonly authState: CloudAuthState;
	readonly onAuthStateChange: Event<CloudAuthChangeEvent>;

	// Credits
	readonly creditBalance: number;
	readonly onBalanceChange: Event<CloudBalanceChangeEvent>;

	// Network status
	readonly onNetworkChange: Event<CloudNetworkChangeEvent>;

	// Auth methods
	signInWithGoogle(): Promise<void>;
	signOut(): Promise<void>;
	refreshSession(): Promise<boolean>;
	exchangeCodeForSession(code: string): Promise<void>;
	handleImplicitFlowTokens(accessToken: string, refreshToken: string): Promise<void>;
	handleAuthError(error: string): void;

	// Credit methods
	fetchBalance(): Promise<CreditBalance>;
	getCreditPacks(): Promise<CreditPack[]>;
	createCheckoutSession(packId: 'starter' | 'pro'): Promise<string>;

	// LLM methods
	sendCloudRequest(params: CloudRequestParams, abortSignal?: AbortSignal): Promise<CloudRequestResponse>;

	// Health & Utility
	checkHealth(): Promise<boolean>;
	isSignedIn(): boolean;
	hasCredits(amount: number): boolean;
	isOnline(): boolean;
	isLowCredits(): boolean;
}

export const IVoidCloudService = createDecorator<IVoidCloudService>('voidCloudService');

// ============================================
// REQUEST/RESPONSE TYPES
// ============================================

export interface CloudRequestParams {
	model: string;
	messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
	maxTokens?: number;
	temperature?: number;
	stream?: boolean;
	onText?: (text: string) => void;
}

export interface CloudRequestResponse {
	content: string;
	usage: {
		inputTokens: number;
		outputTokens: number;
		totalTokens: number;
	};
	creditsUsed: number;
	creditsRemaining: number;
}

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

class VoidCloudService extends Disposable implements IVoidCloudService {
	readonly _serviceBrand: undefined;

	private _authState: CloudAuthState = {
		status: 'signed_out',
		session: null,
		error: null,
	};

	private _creditBalance: number = 0;
	private _sessionRefreshTimer: ReturnType<typeof setTimeout> | null = null;
	private _isOnline: boolean = true;
	private _lowCreditsWarningShown: boolean = false;

	// Events
	private readonly _onAuthStateChange = this._register(new Emitter<CloudAuthChangeEvent>());
	readonly onAuthStateChange = this._onAuthStateChange.event;

	private readonly _onBalanceChange = this._register(new Emitter<CloudBalanceChangeEvent>());
	readonly onBalanceChange = this._onBalanceChange.event;

	private readonly _onNetworkChange = this._register(new Emitter<CloudNetworkChangeEvent>());
	readonly onNetworkChange = this._onNetworkChange.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@INativeHostService private readonly nativeHostService: INativeHostService,
		@IMetricsService private readonly metricsService: IMetricsService,
	) {
		super();
		this._loadStoredSession();
		this._setupNetworkMonitoring();
	}

	// ============================================
	// NETWORK MONITORING
	// ============================================

	private _setupNetworkMonitoring(): void {
		// Monitor online/offline status
		if (typeof window !== 'undefined') {
			window.addEventListener('online', () => {
				const wasOffline = !this._isOnline;
				this._isOnline = true;
				console.log('[VoidCloudService] Network online');
				this._onNetworkChange.fire({ isOnline: true });

				// Refresh session when coming back online
				if (wasOffline && this._authState.session) {
					this.refreshSession().catch(console.error);
					this.fetchBalance().catch(console.error);
				}
			});
			window.addEventListener('offline', () => {
				this._isOnline = false;
				console.log('[VoidCloudService] Network offline');
				this._onNetworkChange.fire({ isOnline: false });
			});
			this._isOnline = navigator.onLine;
		}
	}

	private _scheduleSessionRefresh(session: CloudSession): void {
		// Clear any existing timer
		if (this._sessionRefreshTimer) {
			clearTimeout(this._sessionRefreshTimer);
			this._sessionRefreshTimer = null;
		}

		// Calculate when to refresh (5 minutes before expiry)
		const now = Date.now() / 1000;
		const refreshAt = session.expiresAt - SESSION_REFRESH_BUFFER_SECONDS;
		const delayMs = Math.max(0, (refreshAt - now) * 1000);

		if (delayMs > 0) {
			console.log(`[VoidCloudService] Scheduling session refresh in ${Math.round(delayMs / 1000)}s`);
			this._sessionRefreshTimer = setTimeout(() => {
				console.log('[VoidCloudService] Proactive session refresh triggered');
				this.refreshSession().catch(error => {
					console.error('[VoidCloudService] Proactive session refresh failed:', error);
				});
			}, delayMs);
		} else {
			// Token is expired or about to expire, refresh immediately
			this.refreshSession().catch(console.error);
		}
	}

	// ============================================
	// GETTERS
	// ============================================

	get authState(): CloudAuthState {
		return this._authState;
	}

	get creditBalance(): number {
		return this._creditBalance;
	}

	// ============================================
	// PRIVATE HELPERS
	// ============================================

	private get apiUrl(): string {
		return this.settingsService.state.globalSettings.voidCloudApiUrl;
	}

	private async _loadStoredSession(): Promise<void> {
		try {
			const storedSession = this.storageService.get(CLOUD_SESSION_KEY, StorageScope.APPLICATION);
			const storedBalance = this.storageService.get(CLOUD_BALANCE_KEY, StorageScope.APPLICATION);

			if (storedSession) {
				const session: CloudSession = JSON.parse(storedSession);

				// Validate session structure
				if (!this._isValidSession(session)) {
					console.warn('[VoidCloudService] Invalid stored session structure, clearing');
					this._clearStoredSession();
					return;
				}

				// Check if session is expired
				if (session.expiresAt > Date.now() / 1000) {
					this._setAuthState('signed_in', session);

					// Try to refresh balance from storage first (for fast UI)
					if (storedBalance) {
						this._creditBalance = parseInt(storedBalance, 10);
					}

					// Validate session with server and refresh in background
					this._validateAndRefreshSession(session).catch(console.error);
				} else {
					// Session expired, try to refresh
					console.log('[VoidCloudService] Stored session expired, attempting refresh');
					const refreshed = await this.refreshSession();
					if (!refreshed) {
						console.log('[VoidCloudService] Session refresh failed, clearing stored session');
						this._clearStoredSession();
					}
				}
			}
		} catch (error) {
			console.error('[VoidCloudService] Failed to load stored cloud session:', error);
			this._clearStoredSession();
			this.metricsService.capture('Cloud Session Load Error', {
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	// Validate session structure
	private _isValidSession(session: CloudSession): boolean {
		return !!(
			session &&
			typeof session.accessToken === 'string' &&
			typeof session.refreshToken === 'string' &&
			typeof session.expiresAt === 'number' &&
			session.user &&
			typeof session.user.id === 'string' &&
			typeof session.user.email === 'string'
		);
	}

	// Validate session with server and refresh data
	private async _validateAndRefreshSession(session: CloudSession): Promise<void> {
		try {
			// Quick health check first
			const isHealthy = await this.checkHealth();
			if (!isHealthy) {
				console.warn('[VoidCloudService] API health check failed, using cached session');
				return;
			}

			// Refresh session to validate it's still good
			const refreshed = await this.refreshSession();
			if (refreshed) {
				// Session is valid, fetch fresh balance
				await this.fetchBalance();
			}
		} catch (error) {
			console.warn('[VoidCloudService] Session validation failed:', error);
			// Don't sign out - keep using cached data if available
		}
	}

	private _setAuthState(status: CloudAuthStatus, session: CloudSession | null, error: string | null = null): void {
		const previousStatus = this._authState.status;
		this._authState = { status, session, error };

		// Store session
		if (session) {
			this.storageService.store(CLOUD_SESSION_KEY, JSON.stringify(session), StorageScope.APPLICATION, StorageTarget.MACHINE);
			// Schedule proactive session refresh
			this._scheduleSessionRefresh(session);
		} else {
			// Clear refresh timer when signing out
			if (this._sessionRefreshTimer) {
				clearTimeout(this._sessionRefreshTimer);
				this._sessionRefreshTimer = null;
			}
		}

		// Fire event if status changed
		if (previousStatus !== status) {
			this._onAuthStateChange.fire({
				status,
				user: session?.user ?? null,
			});

			// Track auth state changes for telemetry
			this.metricsService.capture('Cloud Auth State Change', {
				previousStatus,
				newStatus: status,
				hasError: !!error,
			});
		}
	}

	private _setBalance(balance: number): void {
		const previousBalance = this._creditBalance;
		this._creditBalance = balance;

		// Store balance
		this.storageService.store(CLOUD_BALANCE_KEY, balance.toString(), StorageScope.APPLICATION, StorageTarget.MACHINE);

		// Fire event if balance changed
		if (previousBalance !== balance) {
			this._onBalanceChange.fire({ balance, previousBalance });
		}

		// Check for low credits warning (only show once per session)
		if (balance < LOW_CREDITS_WARNING_THRESHOLD && !this._lowCreditsWarningShown && balance > 0) {
			this._lowCreditsWarningShown = true;
			console.warn(`[VoidCloudService] Low credits warning: ${balance} credits remaining`);
			// The UI should listen to onBalanceChange and show a warning banner
		}

		// Reset warning flag when credits are replenished
		if (balance >= LOW_CREDITS_WARNING_THRESHOLD) {
			this._lowCreditsWarningShown = false;
		}
	}

	private _clearStoredSession(): void {
		this.storageService.remove(CLOUD_SESSION_KEY, StorageScope.APPLICATION);
		this.storageService.remove(CLOUD_BALANCE_KEY, StorageScope.APPLICATION);
	}

	private async _apiRequest<T>(
		endpoint: string,
		options: RequestInit = {},
		retryCount: number = 0,
		timeoutMs: number = DEFAULT_REQUEST_TIMEOUT_MS,
		externalSignal?: AbortSignal
	): Promise<T> {
		// Check if online
		if (!this._isOnline) {
			throw new Error('No network connection. Please check your internet and try again.');
		}

		// Check if already aborted
		if (externalSignal?.aborted) {
			throw new Error('Request was cancelled');
		}

		const url = `${this.apiUrl}${endpoint}`;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-Client-Version': CLIENT_VERSION,
			...(options.headers as Record<string, string> || {}),
		};

		// Add auth header if signed in
		if (this._authState.session?.accessToken) {
			headers['Authorization'] = `Bearer ${this._authState.session.accessToken}`;
		}

		// Create abort controller for timeout
		const timeoutController = new AbortController();
		const timeoutId = setTimeout(() => {
			timeoutController.abort();
		}, timeoutMs);

		// Combine signals if external signal provided
		const combinedSignal = externalSignal
			? this._combineAbortSignals(timeoutController.signal, externalSignal)
			: timeoutController.signal;

		try {
			const response = await fetch(url, {
				...options,
				headers,
				signal: combinedSignal,
			});

			clearTimeout(timeoutId);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({})) as { error?: CloudApiError };

				// Handle specific error codes
				if (response.status === 401) {
					// Try to refresh session (only on first attempt)
					if (retryCount === 0) {
						const refreshed = await this.refreshSession();
						if (refreshed) {
							// Retry the request with new token
							return this._apiRequest(endpoint, options, retryCount + 1, timeoutMs, externalSignal);
						}
					}
					// Sign out if refresh failed
					await this.signOut();
					this._trackApiError(endpoint, 'auth', 'Session expired');
					throw new Error('Session expired. Please sign in again.');
				}

				// Retry on server errors (5xx) with exponential backoff
				if (response.status >= 500 && retryCount < MAX_API_RETRIES) {
					const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
					console.log(`[VoidCloudService] Server error ${response.status}, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_API_RETRIES})`);
					await new Promise(resolve => setTimeout(resolve, delay));
					return this._apiRequest(endpoint, options, retryCount + 1, timeoutMs, externalSignal);
				}

				// Rate limit handling (429)
				if (response.status === 429 && retryCount < MAX_API_RETRIES) {
					const retryAfter = response.headers.get('Retry-After');
					const delay = retryAfter ? parseInt(retryAfter, 10) * 1000 : INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
					console.log(`[VoidCloudService] Rate limited, retrying in ${delay}ms`);
					await new Promise(resolve => setTimeout(resolve, delay));
					return this._apiRequest(endpoint, options, retryCount + 1, timeoutMs, externalSignal);
				}

				// Track final HTTP error
				const errorMessage = errorData.error?.message || `API request failed: ${response.status}`;
				this._trackApiError(endpoint, `http_${response.status}`, errorMessage);
				throw new Error(errorMessage);
			}

			return response.json() as Promise<T>;
		} catch (error) {
			clearTimeout(timeoutId);

			// Handle abort errors
			if (error instanceof Error && error.name === 'AbortError') {
				if (externalSignal?.aborted) {
					throw new Error('Request was cancelled');
				}
				// Track timeout errors
				this._trackApiError(endpoint, 'timeout', `Request timed out after ${timeoutMs / 1000}s`);
				throw new Error(`Request timed out after ${timeoutMs / 1000}s. Please try again.`);
			}

			// Handle network errors with retry
			if (error instanceof TypeError && error.message === 'Failed to fetch' && retryCount < MAX_API_RETRIES) {
				const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
				console.log(`[VoidCloudService] Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${MAX_API_RETRIES})`);
				await new Promise(resolve => setTimeout(resolve, delay));
				return this._apiRequest(endpoint, options, retryCount + 1, timeoutMs, externalSignal);
			}

			// Track final error if all retries exhausted
			if (error instanceof Error) {
				this._trackApiError(endpoint, 'network', error.message);
			}
			throw error;
		}
	}

	// Error telemetry tracking
	private _trackApiError(endpoint: string, errorType: string, message: string): void {
		this.metricsService.capture('Cloud API Error', {
			endpoint,
			errorType,
			message,
			isOnline: this._isOnline,
		});
	}

	// Helper to combine multiple abort signals
	private _combineAbortSignals(...signals: AbortSignal[]): AbortSignal {
		const controller = new AbortController();
		for (const signal of signals) {
			if (signal.aborted) {
				controller.abort();
				return controller.signal;
			}
			signal.addEventListener('abort', () => controller.abort(), { once: true });
		}
		return controller.signal;
	}

	// ============================================
	// AUTH METHODS
	// ============================================

	async signInWithGoogle(): Promise<void> {
		this._setAuthState('signing_in', null);

		try {
			// Build the OAuth URL
			// The API server handles the OAuth flow and redirects to safe-appeals-navigator://auth/callback
			const apiUrl = this.apiUrl;

			// Use 'safe-appeals-navigator' protocol for SafeAppeals app (matches product.json)
			const urlProtocol = 'safe-appeals-navigator';
			const redirectUri = encodeURIComponent(`${urlProtocol}://auth/callback`);

			// Build auth URL - this goes through our API which handles Supabase OAuth
			const authUrl = `${apiUrl}/auth/google?redirect_uri=${redirectUri}`;

			// Open in default browser using native host service
			await this.nativeHostService.openExternal(authUrl);

			// The flow continues when the URL handler receives the callback
			// See voidCloudUrlHandler.ts

		} catch (error) {
			this._setAuthState('error', null, error instanceof Error ? error.message : 'Sign in failed');
			throw error;
		}
	}

	async exchangeCodeForSession(code: string): Promise<void> {
		try {
			// Exchange the authorization code for a session
			const response = await this._apiRequest<{
				accessToken: string;
				refreshToken: string;
				expiresAt: number;
				user: CloudUser;
			}>('/auth/callback', {
				method: 'POST',
				body: JSON.stringify({ code }),
			});

			// Create session from response
			const session: CloudSession = {
				accessToken: response.accessToken,
				refreshToken: response.refreshToken,
				expiresAt: response.expiresAt,
				user: response.user,
			};

			this._setAuthState('signed_in', session);

			// Fetch initial balance
			this.fetchBalance().catch(console.error);

		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to exchange code';
			this._setAuthState('error', null, message);
			throw error;
		}
	}

	handleAuthError(error: string): void {
		this._setAuthState('error', null, error);
	}

	async handleImplicitFlowTokens(accessToken: string, refreshToken: string): Promise<void> {
		try {
			// For implicit flow, we have the tokens directly
			// We need to get user info from the API
			const response = await fetch(`${this.apiUrl}/auth/me`, {
				headers: {
					'Authorization': `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
			});

			if (!response.ok) {
				throw new Error('Failed to get user info');
			}

			const user = await response.json() as {
				id: string;
				email: string;
				displayName: string | null;
				avatarUrl: string | null;
				createdAt: string;
			};

			// Create session from tokens
			const session: CloudSession = {
				accessToken,
				refreshToken,
				expiresAt: Math.floor(Date.now() / 1000) + 3600, // Assume 1 hour expiry
				user: {
					id: user.id,
					email: user.email,
					displayName: user.displayName,
					avatarUrl: user.avatarUrl,
					createdAt: user.createdAt,
				},
			};

			this._setAuthState('signed_in', session);

			// Fetch initial balance
			this.fetchBalance().catch(console.error);

		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to handle tokens';
			this._setAuthState('error', null, message);
			throw error;
		}
	}

	async signOut(): Promise<void> {
		this._clearStoredSession();
		this._setAuthState('signed_out', null);
		this._creditBalance = 0;
	}

	async refreshSession(): Promise<boolean> {
		const refreshToken = this._authState.session?.refreshToken;
		if (!refreshToken) {
			return false;
		}

		try {
			const response = await this._apiRequest<{
				accessToken: string;
				refreshToken: string;
				expiresAt: number;
			}>('/auth/refresh', {
				method: 'POST',
				body: JSON.stringify({ refreshToken }),
			});

			// Update session with new tokens
			const newSession: CloudSession = {
				...this._authState.session!,
				accessToken: response.accessToken,
				refreshToken: response.refreshToken,
				expiresAt: response.expiresAt,
			};

			this._setAuthState('signed_in', newSession);
			return true;
		} catch (error) {
			console.error('Failed to refresh session:', error);
			this._setAuthState('signed_out', null);
			this._clearStoredSession();
			return false;
		}
	}

	// ============================================
	// CREDIT METHODS
	// ============================================

	async fetchBalance(): Promise<CreditBalance> {
		if (!this.isSignedIn()) {
			throw new Error('Must be signed in to fetch balance');
		}

		const response = await this._apiRequest<CreditBalance>('/credits/balance');
		this._setBalance(response.balance);
		return response;
	}

	async getCreditPacks(): Promise<CreditPack[]> {
		const response = await this._apiRequest<{ packs: CreditPack[] }>('/credits/packs');
		return response.packs;
	}

	async createCheckoutSession(packId: 'starter' | 'pro'): Promise<string> {
		if (!this.isSignedIn()) {
			throw new Error('Must be signed in to purchase credits');
		}

		const response = await this._apiRequest<{ checkoutUrl: string }>('/credits/checkout', {
			method: 'POST',
			body: JSON.stringify({ pack: packId }),
		});

		return response.checkoutUrl;
	}

	// ============================================
	// LLM METHODS
	// ============================================

	async sendCloudRequest(params: CloudRequestParams, abortSignal?: AbortSignal): Promise<CloudRequestResponse> {
		if (!this.isSignedIn()) {
			throw new Error('Must be signed in to use SafeAppeals Cloud');
		}

		// Check credits first (rough estimate)
		const estimatedTokens = Math.ceil(JSON.stringify(params.messages).length / 4) + (params.maxTokens || 4096);
		if (!this.hasCredits(estimatedTokens)) {
			throw new Error(`Insufficient credits. Need ~${estimatedTokens}, have ${this._creditBalance}`);
		}

		const response = await this._apiRequest<{
			choices: { message: { content: string } }[];
			usage: {
				prompt_tokens: number;
				completion_tokens: number;
				total_tokens: number;
			};
			void_usage?: {
				credits_used: number;
				credits_remaining: number;
			};
		}>('/llm/chat', {
			method: 'POST',
			body: JSON.stringify({
				model: params.model,
				messages: params.messages,
				max_tokens: params.maxTokens,
				temperature: params.temperature,
				stream: false, // TODO: Implement streaming
			}),
		}, 0, LLM_REQUEST_TIMEOUT_MS, abortSignal);

		// Update balance if provided
		if (response.void_usage) {
			this._setBalance(response.void_usage.credits_remaining);
		}

		return {
			content: response.choices[0]?.message?.content || '',
			usage: {
				inputTokens: response.usage.prompt_tokens,
				outputTokens: response.usage.completion_tokens,
				totalTokens: response.usage.total_tokens,
			},
			creditsUsed: response.void_usage?.credits_used || response.usage.total_tokens,
			creditsRemaining: response.void_usage?.credits_remaining || this._creditBalance,
		};
	}

	// ============================================
	// UTILITY METHODS
	// ============================================

	isSignedIn(): boolean {
		return this._authState.status === 'signed_in' && this._authState.session !== null;
	}

	hasCredits(amount: number): boolean {
		return this._creditBalance >= amount;
	}

	isOnline(): boolean {
		return this._isOnline;
	}

	isLowCredits(): boolean {
		return this._creditBalance < LOW_CREDITS_WARNING_THRESHOLD && this._creditBalance > 0;
	}

	// Health check - verifies API connectivity
	async checkHealth(): Promise<boolean> {
		if (!this._isOnline) {
			return false;
		}

		try {
			// Use a lightweight endpoint with short timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

			const response = await fetch(`${this.apiUrl}/health`, {
				method: 'GET',
				headers: {
					'X-Client-Version': CLIENT_VERSION,
				},
				signal: controller.signal,
			});

			clearTimeout(timeoutId);
			return response.ok;
		} catch (error) {
			console.warn('[VoidCloudService] Health check failed:', error);
			return false;
		}
	}

	override dispose(): void {
		// Clean up the refresh timer
		if (this._sessionRefreshTimer) {
			clearTimeout(this._sessionRefreshTimer);
			this._sessionRefreshTimer = null;
		}
		super.dispose();
	}
}

// Register the service
registerSingleton(IVoidCloudService, VoidCloudService, InstantiationType.Delayed);


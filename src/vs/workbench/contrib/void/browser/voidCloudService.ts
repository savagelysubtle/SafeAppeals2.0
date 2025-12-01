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

// Storage keys
const CLOUD_SESSION_KEY = 'void.cloud.session';
const CLOUD_BALANCE_KEY = 'void.cloud.balance';

// ============================================
// SERVICE INTERFACE
// ============================================

export interface IVoidCloudService {
	readonly _serviceBrand: undefined;

	// Auth state
	readonly authState: CloudAuthState;
	readonly onAuthStateChange: Event<CloudAuthChangeEvent>;

	// Credits
	readonly creditBalance: number;
	readonly onBalanceChange: Event<CloudBalanceChangeEvent>;

	// Auth methods
	signInWithGoogle(): Promise<void>;
	signOut(): Promise<void>;
	refreshSession(): Promise<boolean>;
	exchangeCodeForSession(code: string): Promise<void>;
	handleAuthError(error: string): void;

	// Credit methods
	fetchBalance(): Promise<CreditBalance>;
	getCreditPacks(): Promise<CreditPack[]>;
	createCheckoutSession(packId: 'starter' | 'pro'): Promise<string>;

	// LLM methods
	sendCloudRequest(params: CloudRequestParams): Promise<CloudRequestResponse>;

	// Utility
	isSignedIn(): boolean;
	hasCredits(amount: number): boolean;
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

	// Events
	private readonly _onAuthStateChange = this._register(new Emitter<CloudAuthChangeEvent>());
	readonly onAuthStateChange = this._onAuthStateChange.event;

	private readonly _onBalanceChange = this._register(new Emitter<CloudBalanceChangeEvent>());
	readonly onBalanceChange = this._onBalanceChange.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@INativeHostService private readonly nativeHostService: INativeHostService,
	) {
		super();
		this._loadStoredSession();
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

				// Check if session is expired
				if (session.expiresAt > Date.now() / 1000) {
					this._setAuthState('signed_in', session);

					// Try to refresh balance
					if (storedBalance) {
						this._creditBalance = parseInt(storedBalance, 10);
					}

					// Refresh session and balance in background
					this.refreshSession().catch(console.error);
					this.fetchBalance().catch(console.error);
				} else {
					// Try to refresh expired session
					await this.refreshSession();
				}
			}
		} catch (error) {
			console.error('Failed to load stored cloud session:', error);
			this._clearStoredSession();
		}
	}

	private _setAuthState(status: CloudAuthStatus, session: CloudSession | null, error: string | null = null): void {
		const previousStatus = this._authState.status;
		this._authState = { status, session, error };

		// Store session
		if (session) {
			this.storageService.store(CLOUD_SESSION_KEY, JSON.stringify(session), StorageScope.APPLICATION, StorageTarget.MACHINE);
		}

		// Fire event if status changed
		if (previousStatus !== status) {
			this._onAuthStateChange.fire({
				status,
				user: session?.user ?? null,
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
	}

	private _clearStoredSession(): void {
		this.storageService.remove(CLOUD_SESSION_KEY, StorageScope.APPLICATION);
		this.storageService.remove(CLOUD_BALANCE_KEY, StorageScope.APPLICATION);
	}

	private async _apiRequest<T>(
		endpoint: string,
		options: RequestInit = {}
	): Promise<T> {
		const url = `${this.apiUrl}${endpoint}`;

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			...(options.headers as Record<string, string> || {}),
		};

		// Add auth header if signed in
		if (this._authState.session?.accessToken) {
			headers['Authorization'] = `Bearer ${this._authState.session.accessToken}`;
		}

		const response = await fetch(url, {
			...options,
			headers,
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({})) as { error?: CloudApiError };

			// Handle specific error codes
			if (response.status === 401) {
				// Try to refresh session
				const refreshed = await this.refreshSession();
				if (refreshed) {
					// Retry the request
					return this._apiRequest(endpoint, options);
				}
				// Sign out if refresh failed
				await this.signOut();
			}

			throw new Error(errorData.error?.message || `API request failed: ${response.status}`);
		}

		return response.json() as Promise<T>;
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

	async sendCloudRequest(params: CloudRequestParams): Promise<CloudRequestResponse> {
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
		});

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
}

// Register the service
registerSingleton(IVoidCloudService, VoidCloudService, InstantiationType.Delayed);


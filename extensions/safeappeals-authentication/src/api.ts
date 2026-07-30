/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/** Default production SafeAppeals Cloud API origin. */
export const DEFAULT_API_URL = 'https://api.safeappeals.com';

/** Desktop private-use redirect URI (exact allow-list match on the API). */
export const DESKTOP_AUTH_CALLBACK = 'safe-appeals-navigator://auth/callback';

const CLIENT_VERSION = '2.0.0';
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
const MAX_API_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;

/**
 * Cloud user profile returned by /auth/callback and /auth/me.
 */
export interface CloudUser {
	readonly id: string;
	readonly email: string;
	readonly displayName: string | null;
	readonly avatarUrl: string | null;
	readonly createdAt?: string;
}

/**
 * Full session envelope persisted in SecretStorage (never globalState/settings).
 */
export interface CloudSessionEnvelope {
	readonly accessToken: string;
	readonly refreshToken: string;
	readonly expiresAt: number;
	readonly user: CloudUser;
	readonly googleProviderToken?: string | null;
	readonly googleProviderRefreshToken?: string | null;
}

/**
 * Credit balance payload from /credits/balance (kept in memory only).
 */
export interface CreditBalance {
	readonly balance: number;
	readonly unit: 'tokens';
}

/**
 * Credit pack from /credits/packs.
 */
export interface CreditPack {
	readonly id: 'starter' | 'pro' | 'power';
	readonly name: string;
	readonly credits: number;
	readonly price: number;
	readonly currency: string;
	readonly description: string;
	readonly popular?: boolean;
}

/**
 * Resolves the configured API base URL (machine-scoped setting).
 */
export function getApiUrl(): string {
	const configured = vscode.workspace.getConfiguration('safeappeals.cloud').get<string>('apiUrl');
	const trimmed = configured?.trim();
	if (trimmed) {
		return trimmed.replace(/\/+$/, '');
	}
	return DEFAULT_API_URL;
}

/**
 * Builds the Google authorize URL with required PKCE + state query params.
 * Does not request calendar scopes for plain sign-in.
 */
export function buildGoogleAuthorizeUrl(params: {
	readonly codeChallenge: string;
	readonly state: string;
	readonly redirectUri?: string;
}): string {
	const apiUrl = getApiUrl();
	const redirectUri = params.redirectUri ?? DESKTOP_AUTH_CALLBACK;
	const query = new URLSearchParams({
		redirect_uri: redirectUri,
		code_challenge: params.codeChallenge,
		code_challenge_method: 'S256',
		state: params.state,
	});
	return `${apiUrl}/auth/google?${query.toString()}`;
}

/**
 * HTTP client for SafeAppeals Cloud auth and credits endpoints.
 */
export class CloudApiClient {
	constructor(
		private readonly output: vscode.OutputChannel,
		private readonly getAccessToken: () => string | undefined,
		private readonly onUnauthorized: () => Promise<boolean>,
	) { }

	/**
	 * Exchanges an authorization code + PKCE verifier for a session.
	 */
	async exchangeCode(code: string, codeVerifier: string): Promise<CloudSessionEnvelope> {
		const response = await this.request<{
			accessToken: string;
			refreshToken: string;
			expiresAt?: number;
			user: CloudUser;
			googleProviderToken?: string | null;
			googleProviderRefreshToken?: string | null;
		}>('/auth/callback', {
			method: 'POST',
			body: JSON.stringify({ code, code_verifier: codeVerifier }),
			skipAuth: true,
			skipRefreshRetry: true,
		});

		return {
			accessToken: response.accessToken,
			refreshToken: response.refreshToken,
			expiresAt: response.expiresAt ?? Math.floor(Date.now() / 1000) + 3600,
			user: response.user,
			googleProviderToken: response.googleProviderToken,
			googleProviderRefreshToken: response.googleProviderRefreshToken,
		};
	}

	/**
	 * Refreshes the session using the refresh token.
	 */
	async refreshSession(refreshToken: string): Promise<Pick<CloudSessionEnvelope, 'accessToken' | 'refreshToken' | 'expiresAt' | 'googleProviderToken' | 'googleProviderRefreshToken'>> {
		const response = await this.request<{
			accessToken: string;
			refreshToken: string;
			expiresAt?: number;
			googleProviderToken?: string | null;
			googleProviderRefreshToken?: string | null;
		}>('/auth/refresh', {
			method: 'POST',
			body: JSON.stringify({ refreshToken }),
			skipAuth: true,
			skipRefreshRetry: true,
		});

		return {
			accessToken: response.accessToken,
			refreshToken: response.refreshToken,
			expiresAt: response.expiresAt ?? Math.floor(Date.now() / 1000) + 3600,
			googleProviderToken: response.googleProviderToken,
			googleProviderRefreshToken: response.googleProviderRefreshToken,
		};
	}

	/**
	 * Fetches the signed-in user's credit balance.
	 */
	async fetchBalance(): Promise<CreditBalance> {
		return this.request<CreditBalance>('/credits/balance');
	}

	/**
	 * Lists purchasable credit packs.
	 */
	async getCreditPacks(): Promise<CreditPack[]> {
		const response = await this.request<{ packs: CreditPack[] }>('/credits/packs', {
			skipAuth: true,
		});
		return response.packs;
	}

	/**
	 * Creates a Stripe checkout session and returns the checkout URL.
	 */
	async createCheckoutSession(packId: 'starter' | 'pro' | 'power'): Promise<string> {
		const response = await this.request<{ checkoutUrl: string }>('/credits/checkout', {
			method: 'POST',
			body: JSON.stringify({ pack: packId }),
		});
		if (!response.checkoutUrl) {
			throw new Error(vscode.l10n.t('Checkout URL was missing from the server response.'));
		}
		return response.checkoutUrl;
	}

	/**
	 * Performs an authenticated (or anonymous) JSON API request with retries.
	 */
	private async request<T>(
		endpoint: string,
		options: {
			method?: string;
			body?: string;
			skipAuth?: boolean;
			skipRefreshRetry?: boolean;
			retryCount?: number;
			timeoutMs?: number;
		} = {},
	): Promise<T> {
		const retryCount = options.retryCount ?? 0;
		const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
		const url = `${getApiUrl()}${endpoint}`;
		this.output.appendLine(`[api] ${options.method ?? 'GET'} ${endpoint}`);

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'X-Client-Version': CLIENT_VERSION,
		};

		if (!options.skipAuth) {
			const token = this.getAccessToken();
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}
		}

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const response = await fetch(url, {
				method: options.method ?? 'GET',
				headers,
				body: options.body,
				signal: controller.signal,
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({})) as {
					error?: { message?: string };
				};

				if (response.status === 401 && !options.skipRefreshRetry && retryCount === 0) {
					const refreshed = await this.onUnauthorized();
					if (refreshed) {
						return this.request(endpoint, { ...options, retryCount: retryCount + 1 });
					}
					throw new Error(vscode.l10n.t('Session expired. Please sign in again.'));
				}

				if ((response.status >= 500 || response.status === 429) && retryCount < MAX_API_RETRIES) {
					const retryAfter = response.headers.get('Retry-After');
					const delay = response.status === 429 && retryAfter
						? parseInt(retryAfter, 10) * 1000
						: INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
					await sleep(delay);
					return this.request(endpoint, { ...options, retryCount: retryCount + 1 });
				}

				const message = errorData.error?.message || vscode.l10n.t('API request failed ({0}).', String(response.status));
				this.output.appendLine(`[api] error ${response.status} on ${endpoint}: ${message}`);
				throw new Error(message);
			}

			return await response.json() as T;
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(vscode.l10n.t('Request timed out after {0}s. Please try again.', String(timeoutMs / 1000)));
			}
			if (error instanceof TypeError && retryCount < MAX_API_RETRIES) {
				await sleep(INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount));
				return this.request(endpoint, { ...options, retryCount: retryCount + 1 });
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
		}
	}
}

/**
 * Resolves after `ms` milliseconds.
 */
function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

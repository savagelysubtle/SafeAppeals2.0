/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { resolveApiUrl } from './apiUrl';
import {
	InsufficientCreditsError,
	isInsufficientCreditsPayload,
	parseInsufficientCreditsError,
} from './llm/insufficientCredits';
import { extractJsonChatResult, OpenAiSseParser, type SseParseStep } from './llm/sse';
import type { CloudChatMessage, CloudChatTool } from './llm/messageMapping';

export { DEFAULT_API_URL } from './apiUrl';

/** Default production dashboard origin (finish page + paste fallback). */
export const DEFAULT_DASHBOARD_URL = 'https://safeappeals.com';

/** RFC 8252 loopback redirect URI — single source in oauthLoopback.ts. */
export { LOOPBACK_REDIRECT_URI } from './oauthLoopback';

export { InsufficientCreditsError } from './llm/insufficientCredits';

/**
 * Thrown when the cloud API rejects the request as unauthenticated (HTTP 401)
 * after refresh failed or was skipped. Prefer {@code instanceof} over message matching.
 */
export class CloudAuthError extends Error {
	constructor(message?: string) {
		super(message ?? 'Session expired. Please sign in again.');
		this.name = 'CloudAuthError';
	}
}

/** Default allow-list for automatic web OAuth callbacks via asExternalUri. */
export const DEFAULT_WEB_CALLBACK_ORIGINS = ['http://localhost:8080'];

const CLIENT_VERSION = '2.0.0';
const DEFAULT_REQUEST_TIMEOUT_MS = 60_000;
/** Web search may wait on Brave; keep at least 30s (void-cloud default). */
const WEB_SEARCH_TIMEOUT_MS = 60_000;
/** Multi-search runs queries sequentially server-side; allow a longer client wait. */
const MULTI_WEB_SEARCH_TIMEOUT_MS = 180_000;
/** Longer idle window for streaming chat completions (server LiteLLM timeout is 120s). */
const STREAM_IDLE_TIMEOUT_MS = 180_000;
const MAX_API_RETRIES = 3;
const INITIAL_RETRY_DELAY_MS = 1_000;

/**
 * Model descriptor from GET /llm/models.
 */
export interface LlmModelInfo {
	readonly id: string;
	readonly name: string;
	readonly provider: string;
	readonly contextWindow: number;
	readonly tier: string;
	readonly inputCost: number;
	readonly outputCost: number;
}

/**
 * Request body for POST /llm/chat.
 */
export interface LlmChatRequestBody {
	readonly model: string;
	readonly messages: readonly CloudChatMessage[];
	readonly max_tokens?: number;
	readonly temperature?: number;
	readonly tools?: readonly CloudChatTool[];
	readonly tool_choice?: 'none' | 'auto' | 'required' | { readonly type: 'function'; readonly function: { readonly name: string } };
}

/**
 * Incremental stream part from POST /llm/chat (text or completed tool call).
 */
export type LlmChatStreamPart =
	| { readonly kind: 'text'; readonly text: string }
	| { readonly kind: 'tool_call'; readonly callId: string; readonly name: string; readonly input: object };

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
 * Single Brave web search hit from POST /web-search.
 */
export interface WebSearchResultItem {
	readonly title: string;
	readonly url: string;
	readonly description: string;
	readonly age?: string;
}

/**
 * Response from POST /web-search.
 */
export interface WebSearchResponse {
	readonly results: WebSearchResultItem[];
	readonly totalResults: number;
	readonly creditsUsed: number;
	readonly creditsRemaining: number;
}

/**
 * Per-query block from POST /web-search/multi.
 */
export interface MultiWebSearchQueryResult {
	readonly query: string;
	readonly results: WebSearchResultItem[];
	readonly error?: string;
}

/**
 * Response from POST /web-search/multi.
 */
export interface MultiWebSearchResponse {
	readonly searchResults: MultiWebSearchQueryResult[];
	readonly totalCreditsUsed: number;
	readonly creditsRemaining: number;
}


/**
 * Whether this process is a development (from-source) build.
 * Uses `VSCODE_DEV` (set by `scripts/code*.sh`). Guarded for browser where `process` is absent.
 */
function isDevBuild(): boolean {
	return typeof process !== 'undefined' && !!process.env?.['VSCODE_DEV'];
}

/**
 * Resolves the Cloud API base URL.
 *
 * Production always uses {@link DEFAULT_API_URL}. Dev builds may override via
 * `SAFEAPPEALS_CLOUD_API_URL` or machine-scoped `safeappeals.cloud.debug.apiUrl`.
 * The former user setting `safeappeals.cloud.apiUrl` is intentionally ignored.
 */
export function getApiUrl(): string {
	const isDev = isDevBuild();
	const envUrl = isDev && typeof process !== 'undefined'
		? process.env?.['SAFEAPPEALS_CLOUD_API_URL']
		: undefined;
	const debugSettingUrl = isDev
		? vscode.workspace.getConfiguration('safeappeals.cloud.debug').get<string>('apiUrl')
		: undefined;
	return resolveApiUrl({ isDev, envUrl, debugSettingUrl });
}

/**
 * Resolves the branded finish-page URI used after loopback success and as the
 * copy/paste fallback redirect target.
 *
 * Optional machine setting `safeappeals.cloud.dashboardUrl` overrides the
 * production dashboard origin for local dashboard development.
 */
export function getFinishPageUri(): string {
	const configured = vscode.workspace.getConfiguration('safeappeals.cloud').get<string>('dashboardUrl');
	const trimmed = configured?.trim();
	const origin = (trimmed || DEFAULT_DASHBOARD_URL).replace(/\/+$/, '');
	return `${origin}/auth/finish`;
}

/**
 * Origins permitted for automatic web OAuth via `vscode.env.asExternalUri`.
 * Origins outside this machine-scoped allow-list use the finish-page paste flow.
 */
export function getWebCallbackOrigins(): readonly string[] {
	const configured = vscode.workspace.getConfiguration('safeappeals.cloud').get<string[]>('webCallbackOrigins');
	const origins = configured?.length ? configured : DEFAULT_WEB_CALLBACK_ORIGINS;
	return origins
		.map(origin => origin.trim().replace(/\/+$/, ''))
		.filter(origin => origin.length > 0);
}

/**
 * Builds the Google authorize URL with required PKCE + state query params.
 * Does not request calendar scopes for plain sign-in.
 */
export function buildGoogleAuthorizeUrl(params: {
	readonly codeChallenge: string;
	readonly state: string;
	readonly redirectUri: string;
}): string {
	const apiUrl = getApiUrl();
	const query = new URLSearchParams({
		redirect_uri: params.redirectUri,
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
	 * Lists models available for cloud chat (GET /llm/models).
	 */
	async listModels(): Promise<LlmModelInfo[]> {
		const response = await this.request<{ models: LlmModelInfo[] }>('/llm/models');
		return Array.isArray(response.models) ? response.models : [];
	}

	/**
	 * Runs a single Brave web search via SafeAppeals Cloud (POST /web-search).
	 * Credits are deducted server-side; the Brave API key never leaves the server.
	 */
	async webSearch(body: { query: string; count?: number; offset?: number }): Promise<WebSearchResponse> {
		return this.request<WebSearchResponse>('/web-search', {
			method: 'POST',
			body: JSON.stringify(body),
			timeoutMs: WEB_SEARCH_TIMEOUT_MS,
			// Credits are deducted before the upstream search — never auto-retry.
			skipTransientRetry: true,
		});
	}

	/**
	 * Runs multiple Brave web searches via SafeAppeals Cloud (POST /web-search/multi).
	 * Credits are deducted server-side; the Brave API key never leaves the server.
	 */
	async multiWebSearch(body: { queries: string[]; count?: number }): Promise<MultiWebSearchResponse> {
		return this.request<MultiWebSearchResponse>('/web-search/multi', {
			method: 'POST',
			body: JSON.stringify(body),
			timeoutMs: MULTI_WEB_SEARCH_TIMEOUT_MS,
			// Credits are deducted per query before upstream search — never auto-retry.
			skipTransientRetry: true,
		});
	}

	/**
	 * Streams a chat completion (POST /llm/chat with stream:true).
	 *
	 * 402 / insufficient credits is always thrown as {@link InsufficientCreditsError}
	 * before any 401 refresh retry — including mid-stream SSE error events.
	 * A partial stream is never retried after failure.
	 */
	async streamChat(
		body: LlmChatRequestBody,
		onPart: (part: LlmChatStreamPart) => void,
		abortSignal?: AbortSignal,
	): Promise<void> {
		return this.streamChatOnce(body, onPart, abortSignal, 0);
	}

	private async streamChatOnce(
		body: LlmChatRequestBody,
		onPart: (part: LlmChatStreamPart) => void,
		abortSignal: AbortSignal | undefined,
		retryCount: number,
	): Promise<void> {
		if (abortSignal?.aborted) {
			const aborted = new Error('Aborted');
			aborted.name = 'AbortError';
			throw aborted;
		}

		const url = `${getApiUrl()}/llm/chat`;
		this.output.appendLine(`[api] POST /llm/chat (stream) retry=${retryCount}`);

		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
			'Accept': 'text/event-stream, application/json',
			'X-Client-Version': CLIENT_VERSION,
		};
		const token = this.getAccessToken();
		if (token) {
			headers['Authorization'] = `Bearer ${token}`;
		}

		const controller = new AbortController();
		const onAbort = () => controller.abort();
		abortSignal?.addEventListener('abort', onAbort, { once: true });
		let idleTimer: ReturnType<typeof setTimeout> | undefined;
		const armIdleTimeout = () => {
			if (idleTimer) {
				clearTimeout(idleTimer);
			}
			idleTimer = setTimeout(() => controller.abort(), STREAM_IDLE_TIMEOUT_MS);
		};
		armIdleTimeout();

		let streamStarted = false;
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers,
				body: JSON.stringify({ ...body, stream: true }),
				signal: controller.signal,
			});
			armIdleTimeout();

			// 402 MUST be branched before any 401 refresh / retry.
			if (response.status === 402) {
				const errorBody = await response.json().catch(() => ({}));
				throw parseInsufficientCreditsError(errorBody);
			}

			if (response.status === 401 && retryCount === 0) {
				const refreshed = await this.onUnauthorized();
				if (refreshed) {
					return this.streamChatOnce(body, onPart, abortSignal, retryCount + 1);
				}
				throw new Error(vscode.l10n.t('Session expired. Please sign in again.'));
			}

			if (!response.ok) {
				const errorBody = await response.json().catch(() => ({}));
				if (isInsufficientCreditsPayload(errorBody)) {
					throw parseInsufficientCreditsError(errorBody);
				}
				const record = errorBody && typeof errorBody === 'object'
					? (errorBody as { error?: { message?: string } })
					: undefined;
				const message = record?.error?.message
					|| vscode.l10n.t('API request failed ({0}).', String(response.status));
				this.output.appendLine(`[api] error ${response.status} on /llm/chat: ${message}`);
				throw new Error(message);
			}

			const contentType = (response.headers.get('content-type') || '').toLowerCase();
			if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
				const jsonBody = await response.json();
				if (isInsufficientCreditsPayload(jsonBody)) {
					throw parseInsufficientCreditsError(jsonBody);
				}
				emitJsonChatParts(jsonBody, onPart);
				return;
			}

			if (!response.body) {
				throw new Error(vscode.l10n.t('Chat stream had no body.'));
			}

			streamStarted = true;
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			const parser = new OpenAiSseParser();

			while (true) {
				const { done, value } = await reader.read();
				armIdleTimeout();
				if (done) {
					const flushed = parser.flush();
					emitSseStep(flushed, onPart);
					if (flushed.error) {
						throw flushed.error;
					}
					break;
				}
				const step = parser.push(decoder.decode(value, { stream: true }));
				emitSseStep(step, onPart);
				if (step.error) {
					// Never retry a partial stream — including mid-stream 401-shaped errors.
					throw step.error;
				}
				if (step.done) {
					break;
				}
			}
		} catch (error) {
			if (error instanceof InsufficientCreditsError) {
				throw error;
			}
			if (error instanceof Error && error.name === 'AbortError') {
				if (abortSignal?.aborted) {
					throw error;
				}
				throw new Error(vscode.l10n.t('Chat request timed out. Please try again.'));
			}
			// Do not refresh/retry after any bytes of the stream have been consumed.
			if (!streamStarted && error instanceof TypeError && retryCount === 0) {
				await sleep(INITIAL_RETRY_DELAY_MS);
				return this.streamChatOnce(body, onPart, abortSignal, retryCount + 1);
			}
			throw error;
		} finally {
			if (idleTimer) {
				clearTimeout(idleTimer);
			}
			abortSignal?.removeEventListener('abort', onAbort);
		}
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
			/** When true, do not retry on 5xx/429/network errors (use for credit-charging POSTs). */
			skipTransientRetry?: boolean;
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
				const errorData = await response.json().catch(() => ({}));

				// 402 before any 401 refresh / retry.
				if (response.status === 402 || isInsufficientCreditsPayload(errorData)) {
					throw parseInsufficientCreditsError(errorData);
				}

				if (response.status === 401) {
					if (!options.skipRefreshRetry && retryCount === 0) {
						const refreshed = await this.onUnauthorized();
						if (refreshed) {
							return this.request(endpoint, { ...options, retryCount: retryCount + 1 });
						}
					}
					throw new CloudAuthError(vscode.l10n.t('Session expired. Please sign in again.'));
				}

				if (
					!options.skipTransientRetry
					&& (response.status >= 500 || response.status === 429)
					&& retryCount < MAX_API_RETRIES
				) {
					const retryAfter = response.headers.get('Retry-After');
					const delay = response.status === 429 && retryAfter
						? parseInt(retryAfter, 10) * 1000
						: INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount);
					await sleep(delay);
					return this.request(endpoint, { ...options, retryCount: retryCount + 1 });
				}

				const record = errorData && typeof errorData === 'object'
					? (errorData as { error?: { message?: string } })
					: undefined;
				const message = record?.error?.message || vscode.l10n.t('API request failed ({0}).', String(response.status));
				this.output.appendLine(`[api] error ${response.status} on ${endpoint}: ${message}`);
				throw new Error(message);
			}

			return await response.json() as T;
		} catch (error) {
			if (error instanceof InsufficientCreditsError) {
				throw error;
			}
			if (error instanceof Error && error.name === 'AbortError') {
				throw new Error(vscode.l10n.t('Request timed out after {0}s. Please try again.', String(timeoutMs / 1000)));
			}
			if (!options.skipTransientRetry && error instanceof TypeError && retryCount < MAX_API_RETRIES) {
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

function emitSseStep(
	step: Pick<SseParseStep, 'deltas' | 'toolCalls'>,
	onPart: (part: LlmChatStreamPart) => void,
): void {
	for (const text of step.deltas) {
		onPart({ kind: 'text', text });
	}
	for (const call of step.toolCalls) {
		onPart({ kind: 'tool_call', callId: call.id, name: call.name, input: call.input });
	}
}

function emitJsonChatParts(body: unknown, onPart: (part: LlmChatStreamPart) => void): void {
	const result = extractJsonChatResult(body);
	if (result.content) {
		onPart({ kind: 'text', text: result.content });
	}
	for (const call of result.toolCalls) {
		onPart({ kind: 'tool_call', callId: call.id, name: call.name, input: call.input });
	}
}

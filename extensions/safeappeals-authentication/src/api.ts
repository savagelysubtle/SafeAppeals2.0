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
import {
	buildConnectionListQuery,
	CONNECTION_NOT_READY_CODE,
	parseConnectionInfo,
	parseConnectionList,
	type ConnectionCapability,
	type ConnectionFilter,
	type ConnectionInfo,
	type ConnectionsApi,
	type ConnectionTokenResult,
	type StartConnectionRequest,
	type StartConnectionResult,
} from './connectionsApi';

export { DEFAULT_API_URL } from './apiUrl';

export type {
	ConnectionCapability,
	ConnectionFilter,
	ConnectionInfo,
	ConnectionsApi,
	ConnectionStatus,
	ConnectionTokenResult,
	ProviderKind,
	StartConnectionRequest,
	StartConnectionResult,
} from './connectionsApi';

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

/**
 * Non-2xx JSON response from the cloud API that carries the server's error code.
 *
 * Extends {@link Error} so existing message-based handling keeps working, while
 * callers that need to branch (e.g. `CONNECTION_NOT_READY` while polling a
 * claim) can read {@link status} / {@link code} instead of matching text.
 */
export class CloudApiRequestError extends Error {
	constructor(
		readonly status: number,
		readonly code: string | undefined,
		message: string,
	) {
		super(message);
		this.name = 'CloudApiRequestError';
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

export type LlmRunState = 'reserved' | 'provider_started' | 'result_ready' | 'settled' | 'failed' | 'cancelled' | 'expired';

export interface LlmRunStatus {
	readonly run_id: string;
	readonly state: LlmRunState;
	readonly hold_expires_at?: string | null;
}

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
 *
 * `googleProviderToken` / `googleProviderRefreshToken` are legacy optional fields.
 * Provider tokens are minted per connection via
 * {@link CloudApiClient.mintConnectionToken} and must not be persisted in the
 * desktop envelope (always null / omitted when writing).
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
	readonly id: 'starter' | 'pro' | 'power' | 'firm';
	readonly name: string;
	readonly credits: number;
	readonly price: number;
	readonly currency: string;
	readonly description: string;
	readonly popular?: boolean;
}

/**
 * Optional Brave filters for POST /web-search (no AI summarizer).
 */
export interface WebSearchRequestFilters {
	readonly safesearch?: 'off' | 'moderate' | 'strict';
	readonly freshness?: string;
	readonly country?: string;
	readonly search_lang?: string;
	readonly ui_lang?: string;
	readonly site?: string;
}

/**
 * Single Brave web search hit from POST /web-search.
 * No AI summary — agent reads snippets / fetched page text.
 */
export interface WebSearchResultItem {
	readonly title: string;
	readonly url: string;
	readonly description: string;
	readonly age?: string;
	readonly thumbnail?: string;
	readonly domain?: string;
	readonly extra_snippets?: readonly string[];
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
 * Request body for POST /web-search.
 */
export interface WebSearchRequestBody extends WebSearchRequestFilters {
	readonly query: string;
	readonly count?: number;
	readonly offset?: number;
}

/**
 * Request body for POST /web-search/multi.
 */
export interface MultiWebSearchRequestBody extends WebSearchRequestFilters {
	readonly queries: string[];
	readonly count?: number;
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

/** Cloud identity social provider (maps to `/auth/google`, `/auth/microsoft`, or `/auth/slack`). */
export type CloudIdentityProvider = 'google' | 'microsoft' | 'slack';

/**
 * Builds the Cloud identity authorize URL with required PKCE + state query params.
 *
 * Identity only: Cloud sign-in never requests mail/calendar scopes. Capability
 * grants go through service connections (`/connections/*`), which keep the
 * provider grant separate from the Cloud identity.
 */
export function buildCloudIdentityAuthorizeUrl(params: {
	readonly provider: CloudIdentityProvider;
	readonly codeChallenge: string;
	readonly state: string;
	readonly redirectUri: string;
}): string {
	const apiUrl = getApiUrl();
	const path =
		params.provider === 'microsoft'
			? '/auth/microsoft'
			: params.provider === 'slack'
				? '/auth/slack'
				: '/auth/google';
	const query = new URLSearchParams({
		redirect_uri: params.redirectUri,
		code_challenge: params.codeChallenge,
		code_challenge_method: 'S256',
		state: params.state,
	});
	return `${apiUrl}${path}?${query.toString()}`;
}

/**
 * Builds the Google authorize URL with required PKCE + state query params.
 * @deprecated Prefer {@link buildCloudIdentityAuthorizeUrl} with `provider: 'google'`.
 */
export function buildGoogleAuthorizeUrl(params: {
	readonly codeChallenge: string;
	readonly state: string;
	readonly redirectUri: string;
}): string {
	return buildCloudIdentityAuthorizeUrl({ ...params, provider: 'google' });
}

/**
 * Builds the Microsoft authorize URL with required PKCE + state query params.
 */
export function buildMicrosoftAuthorizeUrl(params: {
	readonly codeChallenge: string;
	readonly state: string;
	readonly redirectUri: string;
}): string {
	return buildCloudIdentityAuthorizeUrl({ ...params, provider: 'microsoft' });
}

/**
 * Builds the Slack authorize URL with required PKCE + state query params.
 */
export function buildSlackAuthorizeUrl(params: {
	readonly codeChallenge: string;
	readonly state: string;
	readonly redirectUri: string;
}): string {
	return buildCloudIdentityAuthorizeUrl({ ...params, provider: 'slack' });
}

/**
 * HTTP client for SafeAppeals Cloud auth, credits, and service-connection endpoints.
 */
export class CloudApiClient implements ConnectionsApi {
	constructor(
		private readonly output: vscode.OutputChannel,
		private readonly getAccessToken: () => string | undefined,
		private readonly onUnauthorized: () => Promise<boolean>,
		private readonly streamIdleTimeoutMs = STREAM_IDLE_TIMEOUT_MS,
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
		}>('/auth/callback', {
			method: 'POST',
			body: JSON.stringify({ code, code_verifier: codeVerifier }),
			skipAuth: true,
			skipRefreshRetry: true,
		});

		// Provider tokens stay server-side; never persist them in the desktop envelope.
		return {
			accessToken: response.accessToken,
			refreshToken: response.refreshToken,
			expiresAt: response.expiresAt ?? Math.floor(Date.now() / 1000) + 3600,
			user: response.user,
			googleProviderToken: null,
			googleProviderRefreshToken: null,
		};
	}

	/**
	 * Refreshes the session using the refresh token.
	 */
	async refreshSession(refreshToken: string): Promise<Pick<CloudSessionEnvelope, 'accessToken' | 'refreshToken' | 'expiresAt'>> {
		const response = await this.request<{
			accessToken: string;
			refreshToken: string;
			expiresAt?: number;
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
		};
	}

	/**
	 * Revokes the current cloud session using its last known access token.
	 */
	async signOut(accessToken: string): Promise<void> {
		await this.request<{ success?: boolean }>('/auth/sign-out', {
			method: 'POST',
			authToken: accessToken,
			skipRefreshRetry: true,
			skipTransientRetry: true,
		});
	}

	/**
	 * Starts a mail/calendar connection (POST /connections/start).
	 * The returned `authorizeUrl` must be opened in the system browser; the code
	 * exchange happens on the server callback, never here.
	 */
	async startConnection(request: StartConnectionRequest): Promise<StartConnectionResult> {
		const response = await this.request<{ requestId?: string; authorizeUrl?: string }>('/connections/start', {
			method: 'POST',
			body: JSON.stringify({
				provider: request.provider,
				capabilities: [...request.capabilities],
				...(request.loginHint ? { login_hint: request.loginHint } : {}),
			}),
			skipTransientRetry: true,
		});
		if (!response.requestId || !response.authorizeUrl) {
			throw new Error(vscode.l10n.t('The server did not return a connection authorization URL.'));
		}
		return { requestId: response.requestId, authorizeUrl: response.authorizeUrl };
	}

	/**
	 * Claims a finished connection (POST /connections/claim).
	 * Throws while the browser leg is still open — see {@link tryClaimConnection}.
	 */
	async claimConnection(requestId: string): Promise<ConnectionInfo> {
		const response = await this.request<{ connection?: unknown }>('/connections/claim', {
			method: 'POST',
			body: JSON.stringify({ requestId }),
			skipTransientRetry: true,
		});
		const connection = parseConnectionInfo(response.connection);
		if (!connection) {
			throw new Error(vscode.l10n.t('The server returned an unreadable connection.'));
		}
		return connection;
	}

	/**
	 * Poll-friendly claim: resolves to undefined while the connection is not
	 * ready yet, and throws for every other failure.
	 */
	async tryClaimConnection(requestId: string): Promise<ConnectionInfo | undefined> {
		try {
			return await this.claimConnection(requestId);
		} catch (error) {
			if (error instanceof CloudApiRequestError && error.code === CONNECTION_NOT_READY_CODE) {
				return undefined;
			}
			throw error;
		}
	}

	/**
	 * Lists the signed-in user's connections (GET /connections).
	 */
	async listConnections(filter?: ConnectionFilter): Promise<ConnectionInfo[]> {
		const response = await this.request<{ connections?: unknown }>(
			`/connections${buildConnectionListQuery(filter)}`,
		);
		return parseConnectionList(response);
	}

	/**
	 * Mints a short-lived provider access token for one capability
	 * (POST /connections/:id/token). Refresh tokens stay on the server.
	 */
	async mintConnectionToken(
		connectionId: string,
		capability: ConnectionCapability,
	): Promise<ConnectionTokenResult> {
		const response = await this.request<{
			connectionId?: string;
			capability?: ConnectionCapability;
			accessToken: string;
			expiresAt: number;
			scope?: string | null;
			accountEmail?: string | null;
		}>(`/connections/${encodeURIComponent(connectionId)}/token`, {
			method: 'POST',
			body: JSON.stringify({ capability }),
			skipTransientRetry: true,
		});
		return {
			connectionId: response.connectionId ?? connectionId,
			capability: response.capability ?? capability,
			accessToken: response.accessToken,
			expiresAt: response.expiresAt,
			scope: response.scope ?? undefined,
			accountEmail: response.accountEmail ?? undefined,
		};
	}

	/**
	 * Revokes and deletes a connection (DELETE /connections/:id).
	 */
	async deleteConnection(connectionId: string): Promise<void> {
		await this.request<{ deleted?: boolean }>(`/connections/${encodeURIComponent(connectionId)}`, {
			method: 'DELETE',
			skipTransientRetry: true,
		});
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
	async createCheckoutSession(packId: 'starter' | 'pro' | 'power' | 'firm'): Promise<string> {
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
	 * Results are raw metadata/snippets for the agent to read — no AI summary.
	 */
	async webSearch(body: WebSearchRequestBody): Promise<WebSearchResponse> {
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
	 * Results are raw metadata/snippets for the agent to read — no AI summary.
	 */
	async multiWebSearch(body: MultiWebSearchRequestBody): Promise<MultiWebSearchResponse> {
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
		const idempotencyKey = globalThis.crypto.randomUUID();
		return this.streamChatOnce(body, onPart, abortSignal, idempotencyKey, 0);
	}

	private async streamChatOnce(
		body: LlmChatRequestBody,
		onPart: (part: LlmChatStreamPart) => void,
		abortSignal: AbortSignal | undefined,
		idempotencyKey: string,
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
			'Idempotency-Key': idempotencyKey,
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
			idleTimer = setTimeout(() => controller.abort(), this.streamIdleTimeoutMs);
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
					return this.streamChatOnce(body, onPart, abortSignal, idempotencyKey, retryCount + 1);
				}
				throw new Error(vscode.l10n.t('Session expired. Please sign in again.'));
			}

			if (!response.ok) {
				const errorBody = await response.json().catch(() => ({}));
				if (isInsufficientCreditsPayload(errorBody)) {
					throw parseInsufficientCreditsError(errorBody);
				}
				const replay = parseLlmReplay(errorBody);
				if (response.status === 409 && replay) {
					requireMatchingRunId(response, replay.runId);
					const status = await this.getLlmRunStatus(replay.runId);
					throw createReplayRecoveryError(status);
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
			const responseRunId = requireResponseRunId(response);
			if (contentType.includes('application/json') && !contentType.includes('text/event-stream')) {
				const jsonBody = await response.json();
				if (isInsufficientCreditsPayload(jsonBody)) {
					throw parseInsufficientCreditsError(jsonBody);
				}
				const replay = parseLlmReplay(jsonBody);
				if (replay) {
					requireMatchingRunId(response, replay.runId);
					const status = await this.getLlmRunStatus(replay.runId);
					throw createReplayRecoveryError(status);
				}
				emitJsonChatParts(jsonBody, onPart);
				const resultReadyRunId = parseJsonResultReadyRunId(jsonBody);
				if (!resultReadyRunId || resultReadyRunId !== responseRunId) {
					throw new Error(vscode.l10n.t('The server returned an inconsistent model run identity.'));
				}
				if (!abortSignal?.aborted) {
					await this.acknowledgeLlmRun(resultReadyRunId, abortSignal);
				}
				return;
			}

			if (!response.body) {
				throw new Error(vscode.l10n.t('Chat stream had no body.'));
			}

			streamStarted = true;
			const reader = response.body.getReader();
			const decoder = new TextDecoder();
			const parser = new OpenAiSseParser();
			let resultReadyRunId: string | undefined;
			let sawDoneMarker = false;

			while (true) {
				const { done, value } = await reader.read();
				armIdleTimeout();
				if (done) {
					const flushed = parser.flush();
					emitSseStep(flushed, onPart);
					resultReadyRunId = flushed.resultReadyRunId ?? resultReadyRunId;
					sawDoneMarker = flushed.sawDoneMarker ?? sawDoneMarker;
					if (flushed.error) {
						throw flushed.error;
					}
					break;
				}
				const step = parser.push(decoder.decode(value, { stream: true }));
				emitSseStep(step, onPart);
				resultReadyRunId = step.resultReadyRunId ?? resultReadyRunId;
				sawDoneMarker = step.sawDoneMarker ?? sawDoneMarker;
				if (step.error) {
					// Never retry a partial stream — including mid-stream 401-shaped errors.
					throw step.error;
				}
				if (step.done) {
					break;
				}
			}
			if (!resultReadyRunId || resultReadyRunId !== responseRunId) {
				throw new Error(vscode.l10n.t('The server returned an inconsistent model run identity.'));
			}
			if (!sawDoneMarker) {
				throw new Error(vscode.l10n.t('The model response stream ended before completion.'));
			}
			if (!abortSignal?.aborted) {
				await this.acknowledgeLlmRun(resultReadyRunId, abortSignal);
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
				return this.streamChatOnce(body, onPart, abortSignal, idempotencyKey, retryCount + 1);
			}
			throw error;
		} finally {
			if (idleTimer) {
				clearTimeout(idleTimer);
			}
			abortSignal?.removeEventListener('abort', onAbort);
		}
	}

	/** Fetches the authenticated billing state for one cloud chat run. */
	async getLlmRunStatus(runId: string): Promise<LlmRunStatus> {
		if (!isUuid(runId)) {
			throw new Error(vscode.l10n.t('The server returned an invalid model run identity.'));
		}
		const response = await this.request<{ run_id?: unknown; state?: unknown; hold_expires_at?: unknown }>(`/llm/runs/${encodeURIComponent(runId)}`, {
			skipTransientRetry: true,
		});
		if (response.run_id !== runId || !isLlmRunState(response.state)) {
			throw new Error(vscode.l10n.t('The server returned an invalid model run status.'));
		}
		return {
			run_id: response.run_id,
			state: response.state,
			hold_expires_at: typeof response.hold_expires_at === 'string' || response.hold_expires_at === null
				? response.hold_expires_at
				: undefined,
		};
	}

	/**
	 * Acknowledges a fully consumed result. A lost ACK response is resolved through
	 * status before the same run is acknowledged again; the provider is never repeated.
	 */
	async acknowledgeLlmRun(runId: string, abortSignal?: AbortSignal): Promise<void> {
		if (!isUuid(runId)) {
			throw new Error(vscode.l10n.t('The server returned an invalid model run identity.'));
		}
		throwIfAborted(abortSignal);
		try {
			await this.acknowledgeLlmRunOnce(runId, abortSignal);
			return;
		} catch (error) {
			if (error instanceof CloudAuthError || abortSignal?.aborted) {
				throw error;
			}
			const status = await this.getLlmRunStatus(runId);
			throwIfAborted(abortSignal);
			if (status.state === 'settled') {
				return;
			}
			if (status.state === 'result_ready') {
				await this.acknowledgeLlmRunOnce(runId, abortSignal);
				return;
			}
			throw createRunStateError(status);
		}
	}

	private async acknowledgeLlmRunOnce(runId: string, abortSignal?: AbortSignal): Promise<void> {
		throwIfAborted(abortSignal);
		const response = await this.request<{ run_id?: unknown; status?: unknown }>(`/llm/runs/${encodeURIComponent(runId)}/ack`, {
			method: 'POST',
			skipTransientRetry: true,
			abortSignal,
		});
		if (response.run_id !== runId || (response.status !== 'settled' && response.status !== 'existing')) {
			throw new Error(vscode.l10n.t('The server returned an invalid model run acknowledgement.'));
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
			authToken?: string;
			abortSignal?: AbortSignal;
		} = {},
	): Promise<T> {
		const retryCount = options.retryCount ?? 0;
		const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
		const url = `${getApiUrl()}${endpoint}`;
		this.output.appendLine(`[api] ${options.method ?? 'GET'} ${endpoint}`);

		const headers: Record<string, string> = {
			'X-Client-Version': CLIENT_VERSION,
		};
		if (options.body !== undefined) {
			headers['Content-Type'] = 'application/json';
		}

		if (!options.skipAuth) {
			const token = options.authToken ?? this.getAccessToken();
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}
		}

		const controller = new AbortController();
		const onAbort = () => controller.abort();
		options.abortSignal?.addEventListener('abort', onAbort, { once: true });
		if (options.abortSignal?.aborted) {
			controller.abort();
		}
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
					? (errorData as { error?: { message?: string; code?: string } })
					: undefined;
				const message = record?.error?.message || vscode.l10n.t('API request failed ({0}).', String(response.status));
				this.output.appendLine(`[api] error ${response.status} on ${endpoint}: ${message}`);
				throw new CloudApiRequestError(response.status, record?.error?.code, message);
			}

			return await response.json() as T;
		} catch (error) {
			if (error instanceof InsufficientCreditsError) {
				throw error;
			}
			if (error instanceof Error && error.name === 'AbortError') {
				if (options.abortSignal?.aborted) {
					throw error;
				}
				throw new Error(vscode.l10n.t('Request timed out after {0}s. Please try again.', String(timeoutMs / 1000)));
			}
			if (!options.skipTransientRetry && error instanceof TypeError && retryCount < MAX_API_RETRIES) {
				await sleep(INITIAL_RETRY_DELAY_MS * Math.pow(2, retryCount));
				return this.request(endpoint, { ...options, retryCount: retryCount + 1 });
			}
			throw error;
		} finally {
			clearTimeout(timeoutId);
			options.abortSignal?.removeEventListener('abort', onAbort);
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

function parseJsonResultReadyRunId(body: unknown): string | undefined {
	if (!body || typeof body !== 'object') {
		return undefined;
	}
	const usage = (body as { void_usage?: unknown }).void_usage;
	if (!usage || typeof usage !== 'object') {
		return undefined;
	}
	const record = usage as { run_id?: unknown; state?: unknown; requires_ack?: unknown };
	return record.state === 'result_ready' && record.requires_ack === true
		&& typeof record.run_id === 'string' && isUuid(record.run_id)
		? record.run_id
		: undefined;
}

function parseLlmReplay(body: unknown): { runId: string; state: string } | undefined {
	if (!body || typeof body !== 'object') {
		return undefined;
	}
	const record = body as { run_id?: unknown; state?: unknown; replay?: unknown };
	return record.replay === true && typeof record.run_id === 'string' && isUuid(record.run_id) && typeof record.state === 'string'
		? { runId: record.run_id, state: record.state }
		: undefined;
}

function requireResponseRunId(response: Response): string {
	const runId = response.headers.get('x-safeappeals-run-id');
	if (!runId || !isUuid(runId)) {
		throw new Error(vscode.l10n.t('The server returned an invalid model run identity.'));
	}
	return runId;
}

function requireMatchingRunId(response: Response, bodyRunId: string): void {
	if (requireResponseRunId(response) !== bodyRunId) {
		throw new Error(vscode.l10n.t('The server returned an inconsistent model run identity.'));
	}
}

function isUuid(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isLlmRunState(value: unknown): value is LlmRunState {
	return value === 'reserved'
		|| value === 'provider_started'
		|| value === 'result_ready'
		|| value === 'settled'
		|| value === 'failed'
		|| value === 'cancelled'
		|| value === 'expired';
}

function throwIfAborted(signal: AbortSignal | undefined): void {
	if (signal?.aborted) {
		const error = new Error('Aborted');
		error.name = 'AbortError';
		throw error;
	}
}

function createReplayRecoveryError(status: LlmRunStatus): Error {
	if (status.state === 'result_ready' || status.state === 'settled') {
		return new Error(vscode.l10n.t(
			'The model completed, but its response could not be recovered. The request was not repeated.',
		));
	}
	return createRunStateError(status);
}

function createRunStateError(status: LlmRunStatus): Error {
	if (status.state === 'reserved' || status.state === 'provider_started') {
		return new Error(vscode.l10n.t(
			'This model request is still in progress. Wait for it to finish before trying again.',
		));
	}
	return new Error(vscode.l10n.t(
		'This model request ended without a billable result ({0}). You can safely try a new request.',
		status.state,
	));
}

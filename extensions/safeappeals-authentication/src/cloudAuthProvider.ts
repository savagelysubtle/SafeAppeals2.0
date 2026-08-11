/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	buildCloudIdentityAuthorizeUrl,
	type CloudIdentityProvider,
	CloudApiClient,
	CloudSessionEnvelope,
	CreditBalance,
	CreditPack,
	getFinishPageUri,
	getWebCallbackOrigins,
} from './api';
import { generatePkceChallenge } from './pkce';
import { OAuthLoopbackServer, startOAuthLoopback } from './oauthLoopback';
import {
	isPkceFlowStateReplayError,
	parseRestoredPendingSignIn,
	PendingSignIn,
} from './pendingSignIn';
import { AuthCallbackResult, CloudUriHandler, ConnectCallbackResult } from './uriHandler';

/** Authentication provider id contributed in package.json. */
export const AUTH_PROVIDER_ID = 'safeappeals-cloud';

/** Accounts-menu label. */
export const AUTH_PROVIDER_LABEL = 'SafeAppeals Cloud';

type AuthExtensionContext = Pick<vscode.ExtensionContext, 'globalState' | 'secrets'> & {
	readonly extension: Pick<vscode.Extension<never>, 'id'>;
};

/** Single SecretStorage key for the whole session envelope. */
const SESSION_SECRET_KEY = 'safeappeals-cloud.session';

/**
 * SecretStorage key for in-flight PKCE. The live attempt also keeps this in memory.
 */
const PENDING_SIGN_IN_KEY = 'safeappeals-cloud.pendingSignIn';

/** Legacy plaintext authorization code key, purged during migration and cleanup. */
const ORPHANED_AUTH_CODE_KEY = 'safeappeals-cloud.orphanedAuthCode';

const SESSION_REFRESH_BUFFER_SECONDS = 5 * 60;
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

/** Canonical deep-link / asExternalUri callback path owned by this extension. */
const AUTH_CALLBACK_PATH = '/auth/callback';

/**
 * Whether identity createSession should return the existing session without a new
 * PKCE flow. Scopes are intentionally ignored — mail and calendar access comes
 * from service connections (`ConnectionManager.connect`), never from this session.
 */
export function shouldReturnExistingCloudSession(
	session: CloudSessionEnvelope | undefined,
	_scopes?: readonly string[],
): boolean {
	return !!session;
}

/**
 * Drops legacy Google provider tokens from a session envelope.
 * Provider access is minted per connection and must not live in SecretStorage.
 */
export function withoutPersistedProviderTokens(session: CloudSessionEnvelope): CloudSessionEnvelope {
	return {
		...session,
		googleProviderToken: null,
		googleProviderRefreshToken: null,
	};
}

/**
 * True when a loaded envelope still carries legacy provider token fields to strip.
 */
export function sessionHasPersistedProviderTokens(session: CloudSessionEnvelope): boolean {
	return !!(session.googleProviderToken || session.googleProviderRefreshToken);
}

/**
 * SafeAppeals Cloud authentication provider.
 * Persists the full session envelope in SecretStorage; credit balance stays in memory.
 */
export class CloudAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
	private readonly _sessionChangeEmitter = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	/**
	 * Stable relay for `/connect` deep links. The URI handler itself is created
	 * in the constructor, so consumers subscribe here instead.
	 */
	private readonly _connectCallbackEmitter = new vscode.EventEmitter<ConnectCallbackResult>();
	private readonly _disposables: vscode.Disposable[] = [];
	private readonly _api: CloudApiClient;

	private _session: CloudSessionEnvelope | undefined;
	/** True when SecretStorage failed and the session lives in memory only. */
	private _sessionMemoryOnly = false;
	private _secretStorageWarned = false;
	private _creditBalance: number | undefined;
	private _pending: PendingSignIn | undefined;
	private _loopback: OAuthLoopbackServer | undefined;
	private _refreshTimer: ReturnType<typeof setTimeout> | undefined;
	/** Serializes pending writes so a late delete cannot erase a newer persist. */
	private _pendingWriteChain: Promise<void> = Promise.resolve();
	/** In-flight code exchange keyed by pending state (dedupes double callback delivery). */
	private _exchangeInFlight: Promise<vscode.AuthenticationSession> | undefined;
	private _exchangeInFlightState: string | undefined;
	private _signInWaiters: Array<{
		resolve: (session: vscode.AuthenticationSession) => void;
		reject: (error: Error) => void;
	}> = [];

	readonly onDidChangeSessions = this._sessionChangeEmitter.event;

	/** Fires when a service connection finished in the browser (`/connect` deep link). */
	readonly onDidReceiveConnectCallback = this._connectCallbackEmitter.event;

	constructor(
		private readonly context: AuthExtensionContext,
		private readonly output: vscode.OutputChannel,
		dependencies: {
			readonly api?: CloudApiClient;
			/** Prefer a string URL — see createSession openExternal note. */
			readonly openExternal?: (uri: vscode.Uri | string) => Thenable<boolean>;
			readonly startLoopback?: typeof startOAuthLoopback;
			readonly registerUriHandler?: boolean;
			readonly showWarning?: (message: string) => Thenable<string | undefined>;
		} = {},
	) {
		this._api = dependencies.api ?? new CloudApiClient(
			output,
			() => this._session?.accessToken,
			async () => this.refreshSession(),
		);
		this.openExternal = dependencies.openExternal
			?? ((target: vscode.Uri | string) => vscode.env.openExternal(target as vscode.Uri));
		this.startLoopback = dependencies.startLoopback ?? startOAuthLoopback;
		this.showWarning = dependencies.showWarning ?? vscode.window.showWarningMessage;
		this._disposables.push(
			vscode.authentication.registerAuthenticationProvider(
				AUTH_PROVIDER_ID,
				AUTH_PROVIDER_LABEL,
				this,
				{ supportsMultipleAccounts: false },
			),
			this._sessionChangeEmitter,
			this._connectCallbackEmitter,
		);

		// Register URI handler synchronously so it's ready when auth provider is registered.
		// handleCallback() lazily restores pending if needed.
		const uriHandler = new CloudUriHandler(this.output, dependencies.registerUriHandler ?? true);
		this._disposables.push(
			uriHandler,
			uriHandler.onCallback(result => {
				void this.handleCallback(result);
			}),
			uriHandler.onError(result => {
				void this.handleCallbackError(result);
			}),
			uriHandler.onConnectCallback(result => {
				this._connectCallbackEmitter.fire(result);
			}),
		);
	}

	private readonly openExternal: (uri: vscode.Uri | string) => Thenable<boolean>;
	private readonly startLoopback: typeof startOAuthLoopback;
	private readonly showWarning: (message: string) => Thenable<string | undefined>;

	/**
	 * Loads any persisted session from SecretStorage and schedules refresh.
	 * Also restores an in-flight PKCE pending so a web reload can finish OAuth.
	 */
	async initialize(): Promise<void> {
		await this.purgeLegacyPlaintextOAuthState();
		await this.restorePending();

		const stored = await this.readSessionFromSecrets();
		if (!stored) {
			return;
		}
		if (!isValidSession(stored)) {
			this.output.appendLine('[auth] invalid stored session, purging');
			await this.purgeSession();
			return;
		}
		this._session = stored;
		if (stored.expiresAt <= Date.now() / 1000) {
			const refreshed = await this.refreshSession();
			if (!refreshed) {
				await this.purgeSession();
				return;
			}
			// refreshSession already fired `changed`; also announce as added so late
			// onDidChangeSessions listeners (e.g. onboarding hydrate) wake up after a race.
			this._sessionChangeEmitter.fire({ added: [this.toAuthSession(this._session)], removed: [], changed: [] });
			return;
		}
		this.scheduleRefresh(stored);
		this.output.appendLine('[auth] restored session from SecretStorage');
		this._sessionChangeEmitter.fire({ added: [this.toAuthSession(this._session)], removed: [], changed: [] });
	}

	getSessions(_scopes?: readonly string[]): Thenable<vscode.AuthenticationSession[]> {
		return Promise.resolve(this._session ? [this.toAuthSession(this._session)] : []);
	}

	/**
	 * Starts the Google PKCE sign-in flow in the system browser.
	 *
	 * Flow is chosen from `uiKind` before opening the browser:
	 * - Desktop → RFC 8252 loopback (uriHandler as secondary); bind failure → paste
	 * - Web → asExternalUri when origin is allow-listed; otherwise paste immediately
	 */
	async createSession(_scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
		// Identity reuse: ignore scopes. Mail/calendar access is granted by a
		// service connection — never overload createSession for that.
		if (shouldReturnExistingCloudSession(this._session, _scopes)) {
			return this.toAuthSession(this._session!);
		}

		// Abandon any in-flight attempt so its promise settles and cannot toast later.
		// Await clear so a late pending delete cannot race a newly persisted pending.
		if (this._pending || this._signInWaiters.length) {
			await this.failPendingSignIn(new vscode.CancellationError());
		}
		await this.purgeLegacyPlaintextOAuthState();

		const identityProvider = identityProviderFromScopes(_scopes) ?? await this.pickIdentityProvider();
		if (!identityProvider) {
			throw new vscode.CancellationError();
		}

		const pkce = generatePkceChallenge();
		await this.persistPending({
			codeVerifier: pkce.codeVerifier,
			state: pkce.state,
			startedAt: Date.now(),
		});
		const flow = await this.resolveSignInFlow(pkce.state);
		const authUrl = buildCloudIdentityAuthorizeUrl({
			provider: identityProvider,
			codeChallenge: pkce.codeChallenge,
			state: pkce.state,
			redirectUri: flow.redirectUri,
		});

		this.output.appendLine(`[auth] opening SafeAppeals Cloud sign-in via ${identityProvider} (flow ${flow.kind})`);
		// Do NOT Uri.parse the authorize URL: parse percent-decodes the query and
		// openExternal re-encodes poorly, which splits redirect_uri on `&` (web
		// asExternalUri callbacks carry vscode-* query keys). Same fix as
		// connectionManager.openExternal — pass the string through.
		const opened = await this.openExternal(authUrl);
		if (!opened) {
			this.disposeLoopback();
			await this.clearPending();
			throw new Error(vscode.l10n.t('Could not open the system browser for sign-in.'));
		}

		if (flow.kind === 'paste') {
			return this.waitForPastedCode();
		}

		if (flow.kind === 'loopback') {
			this.wireLoopback(flow.loopback);
		}

		return this.waitForSignIn();
	}

	/**
	 * Signs out and purges the SecretStorage envelope (and memory fallback).
	 */
	async removeSession(_sessionId: string): Promise<void> {
		const removed = this._session ? [this.toAuthSession(this._session)] : [];
		const accessToken = this._session?.accessToken;
		let revokeError: Error | undefined;
		if (accessToken) {
			try {
				await this._api.signOut(accessToken);
			} catch {
				revokeError = new Error(vscode.l10n.t('The server could not revoke this session. Local sign-out completed.'));
			}
		}
		await this.purgeSession();
		if (removed.length) {
			this._sessionChangeEmitter.fire({ added: [], removed, changed: [] });
		}
		this.output.appendLine('[auth] signed out; session purged');
		if (revokeError) {
			void this.showWarning(revokeError.message);
			throw revokeError;
		}
	}

	/**
	 * Completes a pending sign-in from a full callback URL with exact state binding.
	 */
	async completeWithPastedCode(raw: string): Promise<vscode.AuthenticationSession> {
		if (!this._pending) {
			await this.restorePending();
		}
		const pending = this._pending;
		if (!pending) {
			throw new Error(vscode.l10n.t('No sign-in is in progress. Start sign-in first, then paste the code.'));
		}

		const parsed = validatePastedAuthInput(raw, pending.state);

		try {
			return await this.exchangeAndStore(parsed.code, pending.codeVerifier, pending.state);
		} catch (error) {
			const adopted = await this.tryAdoptSessionAfterExchangeFailure(error);
			if (adopted) {
				return adopted;
			}
			const exchangeError = error instanceof Error ? error : new Error(String(error));
			await this.failPendingSignIn(exchangeError);
			throw exchangeError;
		}
	}

	/**
	 * Returns the in-memory credit balance, fetching from the API when signed in.
	 */
	async getBalance(): Promise<CreditBalance> {
		if (!this._session) {
			throw new Error(vscode.l10n.t('Sign in to SafeAppeals Cloud to view your credit balance.'));
		}
		const balance = await this._api.fetchBalance();
		this._creditBalance = balance.balance;
		return balance;
	}

	/**
	 * Cached balance if previously fetched; undefined when unknown.
	 */
	get cachedBalance(): number | undefined {
		return this._creditBalance;
	}

	/**
	 * Lists credit packs (no auth required).
	 */
	async getCreditPacks(): Promise<CreditPack[]> {
		return this._api.getCreditPacks();
	}

	/**
	 * Creates a checkout session for the given pack.
	 */
	async createCheckoutSession(packId: 'starter' | 'pro' | 'power' | 'firm'): Promise<string> {
		if (!this._session) {
			throw new Error(vscode.l10n.t('Sign in to SafeAppeals Cloud to purchase credits.'));
		}
		return this._api.createCheckoutSession(packId);
	}

	/**
	 * Whether a session is currently available.
	 */
	isSignedIn(): boolean {
		return !!this._session;
	}

	/**
	 * Narrow API client access for the language-model provider.
	 * Callers must not log tokens or persist request bodies to disk.
	 */
	getApiClient(): CloudApiClient {
		return this._api;
	}

	/**
	 * True when the OS keyring is unavailable and the session is memory-only.
	 */
	isSessionMemoryOnly(): boolean {
		return this._sessionMemoryOnly;
	}

	/**
	 * Tears down in-process resources only.
	 * Preserves SecretStorage pending PKCE so a reload can resume securely.
	 */
	dispose(): void {
		this.clearRefreshTimer();
		this.disposeLoopback();
		// Reject in-memory waiters only; do not clearPending / failPendingSignIn.
		const waiters = this._signInWaiters.splice(0);
		for (const waiter of waiters) {
			waiter.reject(new vscode.CancellationError());
		}
		for (const d of this._disposables) {
			d.dispose();
		}
		this.output.appendLine('[auth] dispose: preserving pending sign-in in SecretStorage for reload recovery');
	}

	/**
	 * Lets the user choose Google or Microsoft for Cloud identity sign-in.
	 * Returns undefined when the quick pick is dismissed.
	 */
	private async pickIdentityProvider(): Promise<CloudIdentityProvider | undefined> {
		const picked = await vscode.window.showQuickPick(
			[
				{
					label: vscode.l10n.t('Continue with Google'),
					description: vscode.l10n.t('Gmail and Google accounts'),
					provider: 'google' as const,
				},
				{
					label: vscode.l10n.t('Continue with Outlook'),
					description: vscode.l10n.t('Outlook, Hotmail, and Microsoft work or school accounts'),
					provider: 'microsoft' as const,
				},
			],
			{
				title: vscode.l10n.t('Sign in to SafeAppeals Cloud'),
				placeHolder: vscode.l10n.t('Choose an account provider'),
				ignoreFocusOut: true,
			},
		);
		return picked?.provider;
	}

	/**
	 * Picks loopback / asExternalUri / finish-page paste from uiKind (never from bind success alone).
	 */
	private async resolveSignInFlow(expectedState: string): Promise<SignInFlow> {
		const finishUri = getFinishPageUri();

		if (vscode.env.uiKind === vscode.UIKind.Desktop) {
			try {
				const loopback = await this.startLoopback({
					expectedState,
					finishUrl: finishUri,
					log: message => this.output.appendLine(message),
				});
				this._loopback = loopback;
				return { kind: 'loopback', redirectUri: loopback.redirectUri, loopback };
			} catch (error) {
				this.output.appendLine(`[auth] loopback bind failed; using finish-page paste: ${error instanceof Error ? error.message : String(error)}`);
				return { kind: 'paste', redirectUri: finishUri };
			}
		}

		const callbackUri = vscode.Uri.from({
			scheme: vscode.env.uriScheme,
			authority: this.context.extension.id,
			path: AUTH_CALLBACK_PATH,
		});
		const external = await vscode.env.asExternalUri(callbackUri);
		const origin = `${external.scheme}://${external.authority}`;
		const allowed = getWebCallbackOrigins();
		if (allowed.includes(origin)) {
			this.output.appendLine(`[auth] web asExternalUri origin allow-listed: ${origin}`);
			return { kind: 'uriHandler', redirectUri: external.toString(true) };
		}

		this.output.appendLine(`[auth] web asExternalUri origin not allow-listed (${origin}); using finish-page paste`);
		return { kind: 'paste', redirectUri: finishUri };
	}

	/**
	 * Forwards loopback success/failure into the same completion path as the URI handler.
	 * First completion wins; loopback is disposed when the pending sign-in settles.
	 */
	private wireLoopback(loopback: OAuthLoopbackServer): void {
		void loopback.code.then(
			result => {
				void this.handleCallback(result);
			},
			(error: unknown) => {
				if (!this._pending) {
					return;
				}
				if (error instanceof vscode.CancellationError) {
					void this.failPendingSignIn(error);
					return;
				}
				const message = error instanceof Error ? error.message : String(error);
				void this.failPendingSignIn(error instanceof Error ? error : new Error(message));
				void vscode.window.showErrorMessage(vscode.l10n.t('Sign in failed: {0}', message));
			},
		);
	}

	/**
	 * Handles a URI-handler or loopback callback only when state exactly matches.
	 */
	private async handleCallback(result: AuthCallbackResult): Promise<void> {
		// Already signed in — ignore late identity callbacks.
		if (this._session) {
			return;
		}
		if (this._exchangeInFlight) {
			try {
				await this._exchangeInFlight;
			} catch {
				// First delivery already surfaced the error.
			}
			return;
		}

		if (!this._pending) {
			await this.restorePending();
		}
		const pending = this._pending;
		if (!pending) {
			this.output.appendLine('[auth] ignored callback with no pending sign-in');
			return;
		}
		if (result.state !== pending.state) {
			this.output.appendLine('[auth] rejected callback: state mismatch');
			return;
		}

		try {
			const session = await this.exchangeAndStore(result.code, pending.codeVerifier, pending.state);
			void vscode.window.showInformationMessage(
				vscode.l10n.t('Signed in to SafeAppeals Cloud as {0}.', session.account.label),
			);
		} catch (error) {
			const adopted = await this.tryAdoptSessionAfterExchangeFailure(error);
			if (adopted) {
				void vscode.window.showInformationMessage(
					vscode.l10n.t('Signed in to SafeAppeals Cloud as {0}.', adopted.account.label),
				);
				return;
			}
			const message = error instanceof Error ? error.message : String(error);
			await this.failPendingSignIn(error instanceof Error ? error : new Error(message));
			void vscode.window.showErrorMessage(vscode.l10n.t('Sign in failed: {0}', message));
		}
	}

	/**
	 * Handles an OAuth error callback, restoring pending after reload when needed.
	 */
	private async handleCallbackError(result: {
		readonly cancelled: boolean;
		readonly state: string;
		readonly message?: string;
	}): Promise<void> {
		if (!this._pending) {
			await this.restorePending();
		}
		const pending = this._pending;
		if (!pending || result.state !== pending.state) {
			this.output.appendLine('[auth] oauth error ignored — no pending sign-in or state mismatch');
			return;
		}
		if (result.cancelled) {
			void this.failPendingSignIn(new vscode.CancellationError());
			return;
		}
		const message = sanitizeOAuthErrorMessage(result.message);
		void this.failPendingSignIn(new Error(message));
		void vscode.window.showErrorMessage(vscode.l10n.t('Sign in failed: {0}', message));
	}

	/**
	 * Exchanges the code, persists the envelope, resolves waiters.
	 * Concurrent deliveries for the same pending state share one in-flight promise
	 * so a single-use auth code is not exchanged twice.
	 */
	private exchangeAndStore(
		code: string,
		codeVerifier: string,
		pendingState?: string,
	): Promise<vscode.AuthenticationSession> {
		const state = pendingState ?? this._pending?.state;
		if (this._exchangeInFlight && state !== undefined && this._exchangeInFlightState === state) {
			return this._exchangeInFlight;
		}

		const promise = this.doExchangeAndStore(code, codeVerifier);
		this._exchangeInFlight = promise;
		this._exchangeInFlightState = state;
		void promise.finally(() => {
			if (this._exchangeInFlight === promise) {
				this._exchangeInFlight = undefined;
				this._exchangeInFlightState = undefined;
			}
		});
		return promise;
	}

	private async doExchangeAndStore(code: string, codeVerifier: string): Promise<vscode.AuthenticationSession> {
		const envelope = await this._api.exchangeCode(code, codeVerifier);
		await this.persistSession(envelope);
		await this.clearPending();
		this.disposeLoopback();
		const authSession = this.toAuthSession(envelope);
		this._sessionChangeEmitter.fire({ added: [authSession], removed: [], changed: [] });
		this.resolvePendingSignIn(authSession);
		void this.getBalance().catch(() => { /* balance is best-effort after sign-in */ });
		return authSession;
	}

	/**
	 * Waits for URI-handler or loopback completion (5 min hard timeout).
	 */
	private waitForSignIn(): Promise<vscode.AuthenticationSession> {
		return new Promise<vscode.AuthenticationSession>((resolve, reject) => {
			const waiter = { resolve, reject };
			this._signInWaiters.push(waiter);

			const timeout = setTimeout(() => {
				void this.failPendingSignIn(new Error(vscode.l10n.t('Sign in timed out. Please try again.')));
			}, SIGN_IN_TIMEOUT_MS);

			const cleanup = () => {
				clearTimeout(timeout);
			};

			const originalResolve = waiter.resolve;
			const originalReject = waiter.reject;
			waiter.resolve = session => {
				cleanup();
				originalResolve(session);
			};
			waiter.reject = error => {
				cleanup();
				originalReject(error);
			};
		});
	}

	/**
	 * Waits for the user to paste the code shown on the finish page.
	 * Shown immediately when automatic callback delivery is unavailable.
	 * Raced against the same hard timeout as the automatic flows.
	 */
	private async waitForPastedCode(): Promise<vscode.AuthenticationSession> {
		let timeoutId: ReturnType<typeof setTimeout> | undefined;
		const timeoutPromise = new Promise<vscode.AuthenticationSession>((_resolve, reject) => {
			timeoutId = setTimeout(() => {
				const error = new Error(vscode.l10n.t('Sign in timed out. Please try again.'));
				void this.failPendingSignIn(error);
				reject(error);
			}, SIGN_IN_TIMEOUT_MS);
		});

		try {
			return await Promise.race([this.promptAndCompletePastedCode(), timeoutPromise]);
		} finally {
			if (timeoutId !== undefined) {
				clearTimeout(timeoutId);
			}
		}
	}

	/**
	 * Prompts for a pasted auth code and completes the pending exchange.
	 */
	private async promptAndCompletePastedCode(): Promise<vscode.AuthenticationSession> {
		const raw = await vscode.window.showInputBox({
			title: vscode.l10n.t('Paste Auth Code'),
			prompt: vscode.l10n.t('Finish signing in, then paste the code your browser shows here.'),
			ignoreFocusOut: true,
		});
		if (!raw) {
			await this.failPendingSignIn(new vscode.CancellationError());
			throw new vscode.CancellationError();
		}
		// Leaves the pending sign-in intact on failure so the "Paste Auth Code"
		// command can retry without restarting the browser flow.
		return this.completeWithPastedCode(raw);
	}

	/**
	 * Refreshes tokens via /auth/refresh. Returns false when refresh fails.
	 */
	private async refreshSession(): Promise<boolean> {
		const refreshToken = this._session?.refreshToken;
		if (!refreshToken) {
			return false;
		}
		try {
			const refreshed = await this._api.refreshSession(refreshToken);
			// Clear any legacy provider tokens still present in the stored envelope.
			const next = withoutPersistedProviderTokens({
				...this._session!,
				accessToken: refreshed.accessToken,
				refreshToken: refreshed.refreshToken,
				expiresAt: refreshed.expiresAt,
			});
			await this.persistSession(next);
			const authSession = this.toAuthSession(next);
			this._sessionChangeEmitter.fire({ added: [], removed: [], changed: [authSession] });
			this.output.appendLine('[auth] session refreshed');
			return true;
		} catch (error) {
			this.output.appendLine(`[auth] refresh failed: ${error instanceof Error ? error.message : String(error)}`);
			return false;
		}
	}

	/**
	 * Writes the session envelope to SecretStorage, or memory-only if the keyring fails.
	 * Always strips legacy Google provider tokens before persist.
	 */
	private async persistSession(session: CloudSessionEnvelope): Promise<void> {
		const sanitized = withoutPersistedProviderTokens(session);
		this._session = sanitized;
		this.scheduleRefresh(sanitized);
		try {
			await this.context.secrets.store(SESSION_SECRET_KEY, JSON.stringify(sanitized));
			this._sessionMemoryOnly = false;
		} catch (error) {
			this._sessionMemoryOnly = true;
			this.output.appendLine(`[auth] SecretStorage unavailable; keeping session in memory only: ${error instanceof Error ? error.message : String(error)}`);
			if (!this._secretStorageWarned) {
				this._secretStorageWarned = true;
				void this.showWarning(
					vscode.l10n.t('Secure storage is unavailable. Your SafeAppeals Cloud session will not persist after restart.'),
				);
			}
		}
	}

	/**
	 * Reads the session envelope from SecretStorage (never globalState).
	 * Drops legacy `googleProviderToken` / `googleProviderRefreshToken` on load.
	 */
	private async readSessionFromSecrets(): Promise<CloudSessionEnvelope | undefined> {
		try {
			const raw = await this.context.secrets.get(SESSION_SECRET_KEY);
			if (!raw) {
				return undefined;
			}
			const parsed = JSON.parse(raw) as CloudSessionEnvelope;
			const cleaned = withoutPersistedProviderTokens(parsed);
			// Rewrite SecretStorage when migrating away from persisted provider tokens.
			if (sessionHasPersistedProviderTokens(parsed)) {
				try {
					await this.context.secrets.store(SESSION_SECRET_KEY, JSON.stringify(cleaned));
					this.output.appendLine('[auth] cleared legacy Google provider tokens from SecretStorage envelope');
				} catch {
					this.output.appendLine('[auth] failed to sanitize legacy session; deleting unsafe SecretStorage envelope');
					try {
						await this.context.secrets.delete(SESSION_SECRET_KEY);
						this._sessionMemoryOnly = true;
						void this.showWarning(
							vscode.l10n.t('The stored session could not be migrated securely and was removed. It will remain in memory for this window only.'),
						);
						return cleaned;
					} catch {
						void this.showWarning(
							vscode.l10n.t('An unsafe legacy session could not be removed from secure storage. Sign in again after secure storage is repaired.'),
						);
						return undefined;
					}
				}
			}
			return cleaned;
		} catch (error) {
			this.output.appendLine(`[auth] SecretStorage read failed: ${error instanceof Error ? error.message : String(error)}`);
			if (!this._secretStorageWarned) {
				this._secretStorageWarned = true;
				void this.showWarning(
					vscode.l10n.t('Secure storage is unavailable. Sign-in will not persist after restart.'),
				);
			}
			return undefined;
		}
	}

	/**
	 * After a failed exchange (e.g. code already used), adopt a session written by
	 * another window that won the race — clear pending, notify listeners, resolve waiters.
	 */
	private async tryAdoptSessionFromSecrets(): Promise<vscode.AuthenticationSession | undefined> {
		if (this._session) {
			return this.toAuthSession(this._session);
		}
		const stored = await this.readSessionFromSecrets();
		if (!stored || !isValidSession(stored)) {
			return undefined;
		}
		this._session = stored;
		this._sessionMemoryOnly = false;
		this.scheduleRefresh(stored);
		await this.clearPending();
		this.disposeLoopback();
		const authSession = this.toAuthSession(stored);
		this._sessionChangeEmitter.fire({ added: [authSession], removed: [], changed: [] });
		this.resolvePendingSignIn(authSession);
		this.output.appendLine('[auth] adopted session from SecretStorage after exchange failure (another window likely won)');
		void this.getBalance().catch(() => { /* balance is best-effort after sign-in */ });
		return authSession;
	}

	/**
	 * Soft-recover after exchange failure: adopt a session from SecretStorage when
	 * present. For burned-code / flow_state replay errors, briefly re-read once in
	 * case persistence was still in flight. Callers must suppress the error toast
	 * when this returns a session.
	 */
	private async tryAdoptSessionAfterExchangeFailure(
		error: unknown,
	): Promise<vscode.AuthenticationSession | undefined> {
		const adopted = await this.tryAdoptSessionFromSecrets();
		if (adopted) {
			return adopted;
		}
		const message = error instanceof Error ? error.message : String(error);
		if (!isPkceFlowStateReplayError(message)) {
			return undefined;
		}
		await new Promise<void>(resolve => setTimeout(resolve, 150));
		return this.tryAdoptSessionFromSecrets();
	}

	/**
	 * Purges SecretStorage and in-memory session/balance state.
	 */
	private async purgeSession(): Promise<void> {
		this.clearRefreshTimer();
		this._session = undefined;
		this._sessionMemoryOnly = false;
		this._creditBalance = undefined;
		await this.clearPending();
		try {
			await this.context.secrets.delete(SESSION_SECRET_KEY);
		} catch (error) {
			this.output.appendLine(`[auth] SecretStorage delete failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Chains pending mutations so a late delete cannot erase a newer persist.
	 */
	private runPendingWrite(op: () => Promise<void>): Promise<void> {
		const next = this._pendingWriteChain.then(op, op);
		this._pendingWriteChain = next.then(() => { /* keep chain alive */ }, () => { /* swallow */ });
		return next;
	}

	/**
	 * Persists in-flight PKCE to memory and SecretStorage only.
	 */
	private async persistPending(pending: PendingSignIn): Promise<void> {
		this._pending = pending;
		await this.runPendingWrite(async () => {
			if (
				this._pending?.state !== pending.state
				|| this._pending?.codeVerifier !== pending.codeVerifier
			) {
				return;
			}
			const payload = JSON.stringify(pending);
			try {
				await this.context.secrets.store(PENDING_SIGN_IN_KEY, payload);
				this.output.appendLine('[auth] persisted pending sign-in in SecretStorage');
			} catch (error) {
				this.output.appendLine(`[auth] SecretStorage unavailable; keeping pending sign-in in memory only: ${error instanceof Error ? error.message : String(error)}`);
				if (!this._secretStorageWarned) {
					this._secretStorageWarned = true;
					void this.showWarning(
						vscode.l10n.t('Secure storage is unavailable. This sign-in cannot resume after restart.'),
					);
				}
			}
		});
	}

	/**
	 * Clears in-memory and SecretStorage pending PKCE and purges legacy plaintext keys.
	 */
	private async clearPending(): Promise<void> {
		this._pending = undefined;
		await this.runPendingWrite(async () => {
			try {
				await this.context.secrets.delete(PENDING_SIGN_IN_KEY);
			} catch (error) {
				this.output.appendLine(`[auth] secrets clear pending failed: ${error instanceof Error ? error.message : String(error)}`);
			}
			await this.purgeLegacyPlaintextOAuthState();
		});
	}

	/**
	 * Purges plaintext PKCE/auth-code keys from legacy globalState/localStorage paths.
	 */
	private async purgeLegacyPlaintextOAuthState(): Promise<void> {
		for (const key of [PENDING_SIGN_IN_KEY, ORPHANED_AUTH_CODE_KEY]) {
			try {
				await this.context.globalState.update(key, undefined);
			} catch (error) {
				this.output.appendLine(`[auth] legacy OAuth globalState purge failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
		if (vscode.env.uiKind === vscode.UIKind.Web) {
			try {
				await vscode.commands.executeCommand('_safeappeals.cloud.clearPendingPkce');
			} catch {
				// Legacy bridge may not be registered in this workbench.
			}
		}
	}

	/**
	 * Restores a non-expired pending PKCE from SecretStorage only.
	 */
	private async restorePending(): Promise<void> {
		if (this._pending) {
			return;
		}

		let secretsRaw: string | undefined;
		try {
			secretsRaw = await this.context.secrets.get(PENDING_SIGN_IN_KEY);
		} catch (error) {
			this.output.appendLine(`[auth] secrets get pending failed: ${error instanceof Error ? error.message : String(error)}`);
		}

		const fromSecrets = parseRestoredPendingSignIn(secretsRaw);

		if (secretsRaw && !fromSecrets) {
			this.output.appendLine('[auth] secrets pending expired or invalid; clearing');
			try {
				await this.context.secrets.delete(PENDING_SIGN_IN_KEY);
			} catch {
				// Best-effort cleanup.
			}
		}
		if (!fromSecrets) {
			return;
		}
		this._pending = fromSecrets;
		this.output.appendLine('[auth] restored pending sign-in from SecretStorage');
	}

	private scheduleRefresh(session: CloudSessionEnvelope): void {
		this.clearRefreshTimer();
		const now = Date.now() / 1000;
		const refreshAt = session.expiresAt - SESSION_REFRESH_BUFFER_SECONDS;
		const delayMs = Math.max(0, (refreshAt - now) * 1000);
		this._refreshTimer = setTimeout(() => {
			void this.refreshSession().then(ok => {
				if (!ok) {
					void this.purgeSession().then(() => {
						this._sessionChangeEmitter.fire({
							added: [],
							removed: [this.toAuthSession(session)],
							changed: [],
						});
					});
				}
			});
		}, delayMs);
	}

	private clearRefreshTimer(): void {
		if (this._refreshTimer) {
			clearTimeout(this._refreshTimer);
			this._refreshTimer = undefined;
		}
	}

	private toAuthSession(envelope: CloudSessionEnvelope): vscode.AuthenticationSession {
		return {
			id: envelope.user.id,
			accessToken: envelope.accessToken,
			account: {
				id: envelope.user.id,
				label: envelope.user.displayName || envelope.user.email,
			},
			scopes: [],
		};
	}

	private resolvePendingSignIn(session: vscode.AuthenticationSession): void {
		const waiters = this._signInWaiters.splice(0);
		for (const waiter of waiters) {
			waiter.resolve(session);
		}
	}

	private async failPendingSignIn(error: Error): Promise<void> {
		await this.clearPending();
		this.disposeLoopback();
		const waiters = this._signInWaiters.splice(0);
		for (const waiter of waiters) {
			waiter.reject(error);
		}
	}

	private disposeLoopback(): void {
		const loopback = this._loopback;
		this._loopback = undefined;
		loopback?.dispose();
	}
}

/**
 * Chosen redirect / completion strategy for one createSession attempt.
 */
type SignInFlow =
	| { readonly kind: 'loopback'; readonly redirectUri: string; readonly loopback: OAuthLoopbackServer }
	| { readonly kind: 'uriHandler'; readonly redirectUri: string }
	| { readonly kind: 'paste'; readonly redirectUri: string };

/**
 * Validates the minimum shape of a persisted session envelope.
 */
function isValidSession(session: CloudSessionEnvelope): boolean {
	return !!(
		session
		&& typeof session.accessToken === 'string'
		&& typeof session.refreshToken === 'string'
		&& typeof session.expiresAt === 'number'
		&& session.user
		&& typeof session.user.id === 'string'
		&& typeof session.user.email === 'string'
	);
}

/**
 * Extracts code (and optional state) from a raw paste of either a bare code or a callback URL.
 * URL pastes set `fromUrl`; callers may log state mismatches but still exchange via PKCE.
 */
export function parsePastedAuthInput(raw: string): {
	code: string | undefined;
	state: string | undefined;
	fromUrl: boolean;
} {
	const trimmed = raw.trim();
	if (!trimmed) {
		return { code: undefined, state: undefined, fromUrl: false };
	}

	if (trimmed.includes('://') || trimmed.includes('?') || trimmed.includes('#')) {
		try {
			const url = new URL(trimmed);
			if (url.hash && fragmentLooksLikeTokens(url.hash.slice(1))) {
				throw new Error(vscode.l10n.t('Sign-in rejected: tokens in the URL fragment are not allowed.'));
			}
			return {
				code: url.searchParams.get('code') ?? undefined,
				state: url.searchParams.get('state') ?? undefined,
				fromUrl: true,
			};
		} catch (error) {
			if (error instanceof Error && error.message.includes('fragment')) {
				throw error;
			}
		}

		const codeMatch = /[?&#]code=([^&#]+)/.exec(trimmed);
		const stateMatch = /[?&#]state=([^&#]+)/.exec(trimmed);
		return {
			code: codeMatch?.[1] ? decodeURIComponent(codeMatch[1]) : undefined,
			state: stateMatch?.[1] ? decodeURIComponent(stateMatch[1]) : undefined,
			fromUrl: true,
		};
	}

	return { code: trimmed, state: undefined, fromUrl: false };
}

/**
 * Optional identity provider from createSession scopes so UI can offer dedicated
 * Google / Outlook buttons without a second picker.
 *
 * Recognized: `provider:google`, `provider:microsoft`, `provider:outlook`, `provider:azure`.
 */
export function identityProviderFromScopes(
	scopes: readonly string[] | undefined,
): CloudIdentityProvider | undefined {
	if (!scopes?.length) {
		return undefined;
	}
	for (const scope of scopes) {
		const normalized = scope.trim().toLowerCase();
		if (
			normalized === 'provider:google'
			|| normalized === 'identity:google'
		) {
			return 'google';
		}
		if (
			normalized === 'provider:microsoft'
			|| normalized === 'provider:outlook'
			|| normalized === 'provider:azure'
			|| normalized === 'identity:microsoft'
			|| normalized === 'identity:outlook'
			|| normalized === 'identity:azure'
		) {
			return 'microsoft';
		}
	}
	return undefined;
}

/**
 * Requires a full pasted callback URL whose state exactly matches the live attempt.
 */
export function validatePastedAuthInput(raw: string, expectedState: string): {
	readonly code: string;
	readonly state: string;
} {
	const parsed = parsePastedAuthInput(raw);
	if (!parsed.fromUrl || !parsed.code || !parsed.state) {
		throw new Error(vscode.l10n.t('Paste the full callback URL, including its code and state.'));
	}
	if (parsed.state !== expectedState) {
		throw new Error(vscode.l10n.t('Sign-in callback state did not match the active sign-in.'));
	}
	return { code: parsed.code, state: parsed.state };
}

/**
 * Heuristic for implicit-flow fragments in pasted URLs.
 */
function fragmentLooksLikeTokens(fragment: string): boolean {
	const params = new URLSearchParams(fragment);
	return !!(params.get('access_token') || params.get('refresh_token'));
}

/** Bounds OAuth error text before it reaches user-visible surfaces. */
function sanitizeOAuthErrorMessage(message: string | undefined): string {
	if (!message) {
		return vscode.l10n.t('The authorization server rejected sign-in.');
	}
	const sanitized = message.replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, 200);
	return sanitized || vscode.l10n.t('The authorization server rejected sign-in.');
}

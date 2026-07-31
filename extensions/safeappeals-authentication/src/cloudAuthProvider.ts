/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	buildGoogleAuthorizeUrl,
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
	ORPHANED_AUTH_CODE_KEY,
	OrphanedAuthCode,
	parseOrphanedAuthCode,
} from './orphanedAuthCode';
import {
	parseRestoredPendingSignIn,
	PendingSignIn,
	PendingSignInWithSource,
	pickNewestPending,
	shouldSettlePendingOnExchangeFailure,
} from './pendingSignIn';
import { AuthCallbackResult, CloudUriHandler } from './uriHandler';

/** Authentication provider id contributed in package.json. */
export const AUTH_PROVIDER_ID = 'safeappeals-cloud';

/** Accounts-menu label. */
export const AUTH_PROVIDER_LABEL = 'SafeAppeals Cloud';

/** Single SecretStorage key for the whole session envelope. */
const SESSION_SECRET_KEY = 'safeappeals-cloud.session';

/**
 * Key for in-flight PKCE so web reload can finish the exchange.
 * Written to SecretStorage and APPLICATION `globalState`; on Web also mirrored to
 * origin-shared localStorage via `_safeappeals.cloud.*PendingPkce` workbench commands
 * (profile/workspace scope cannot see the OAuth callback's localStorage alone).
 */
const PENDING_SIGN_IN_KEY = 'safeappeals-cloud.pendingSignIn';

const SESSION_REFRESH_BUFFER_SECONDS = 5 * 60;
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;

/** Canonical deep-link / asExternalUri callback path owned by this extension. */
const AUTH_CALLBACK_PATH = '/auth/callback';

/**
 * SafeAppeals Cloud authentication provider.
 * Persists the full session envelope in SecretStorage; credit balance stays in memory.
 */
export class CloudAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
	private readonly _sessionChangeEmitter = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	private readonly _disposables: vscode.Disposable[] = [];
	private readonly _api: CloudApiClient;
	/** Registered in `initialize()` after pending restore so early callbacks see pending. */
	private _uriHandler: CloudUriHandler | undefined;

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

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly output: vscode.OutputChannel,
	) {
		this._api = new CloudApiClient(
			output,
			() => this._session?.accessToken,
			async () => this.refreshSession(),
		);
		this._disposables.push(
			vscode.authentication.registerAuthenticationProvider(
				AUTH_PROVIDER_ID,
				AUTH_PROVIDER_LABEL,
				this,
				{ supportsMultipleAccounts: false },
			),
			this._sessionChangeEmitter,
		);
	}

	/**
	 * Loads any persisted session from SecretStorage and schedules refresh.
	 * Also restores an in-flight PKCE pending so a web reload can finish OAuth.
	 */
	async initialize(): Promise<void> {
		await this.restorePending();
		try {
			await this.tryCompleteOrphanedAuthCode();
		} catch {
			// Exchange failure already toasted and cleared pending; continue without a session.
		}
		// Register after pending/orphan restore so recovered OAuth URIs see pending.
		this.registerUriHandler();
		// Web safety net: peek durable (do not burn) → exchange → clear only on success.
		// If durable is already gone but an ephemeral url-callbacks[*] remains, take that.
		if (vscode.env.uiKind === vscode.UIKind.Web) {
			try {
				const durable = await vscode.commands.executeCommand<{ code: string; state: string } | undefined>(
					'_safeappeals.cloud.peekDurableOAuthCallback',
				);
				if (durable?.code && durable.state) {
					await this.handleCallback(durable);
				} else if (this._pending) {
					const orphaned = await vscode.commands.executeCommand<{ code: string; state: string } | undefined>(
						'_safeappeals.cloud.takeOrphanedUrlCallback',
					);
					if (orphaned?.code && orphaned.state) {
						this.output.appendLine('[auth] completing orphaned ephemeral url-callback');
						await this.handleCallback(orphaned);
					}
				}
			} catch {
				// Command unavailable outside the web workbench bridge — ignore.
			}
		}
		if (this._session) {
			// Orphan / durable completion already persisted the session and fired session events.
			return;
		}

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
		if (this._session) {
			return this.toAuthSession(this._session);
		}

		// Abandon any in-flight attempt so its promise settles and cannot toast later.
		// Await clear so a late pending delete cannot race a newly persisted pending.
		if (this._pending || this._signInWaiters.length) {
			await this.failPendingSignIn(new vscode.CancellationError());
		}
		// Drop any prior orphaned code — a new createSession starts a fresh PKCE state.
		await this.clearOrphanedAuthCode();

		const pkce = generatePkceChallenge();
		await this.persistPending({
			codeVerifier: pkce.codeVerifier,
			state: pkce.state,
			startedAt: Date.now(),
		});
		// Callback may have arrived (and been stashed) before pending was writable.
		await this.tryCompleteOrphanedAuthCode();
		if (this._session) {
			return this.toAuthSession(this._session);
		}

		const flow = await this.resolveSignInFlow(pkce.state);
		const authUrl = buildGoogleAuthorizeUrl({
			codeChallenge: pkce.codeChallenge,
			state: pkce.state,
			redirectUri: flow.redirectUri,
		});

		this.output.appendLine(`[auth] opening browser for Google sign-in (redirect ${flow.redirectUri}, flow ${flow.kind})`);
		// Pass the authorize URL as a string. Uri.parse percent-decodes the query and
		// openExternal re-encodes poorly (%253F / truncates redirect_uri at `&`). ExtHost
		// and MainThread accept string | URI and preserve the original string end-to-end
		// (same pattern as issueFormService openExternal).
		const opened = await vscode.env.openExternal(authUrl as unknown as vscode.Uri);
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
		await this.purgeSession();
		if (removed.length) {
			this._sessionChangeEmitter.fire({ added: [], removed, changed: [] });
		}
		this.output.appendLine('[auth] signed out; session purged');
	}

	/**
	 * Completes a pending sign-in when the user pastes an auth code (or callback URL).
	 * State mismatch is logged and exchange proceeds with the pending PKCE verifier
	 * (same policy as the automatic callback path).
	 */
	async completeWithPastedCode(raw: string): Promise<vscode.AuthenticationSession> {
		if (!this._pending) {
			await this.restorePending();
		}
		const pending = this._pending;
		if (!pending) {
			throw new Error(vscode.l10n.t('No sign-in is in progress. Start sign-in first, then paste the code.'));
		}

		const parsed = parsePastedAuthInput(raw);
		if (!parsed.code) {
			throw new Error(vscode.l10n.t('Could not find an authorization code in the pasted text.'));
		}
		const stateMatched = !parsed.state || parsed.state === pending.state;
		if (parsed.state && parsed.state !== pending.state) {
			this.output.appendLine(
				`[auth] pasted code state mismatch — proceeding with pending PKCE (paste=${parsed.state.slice(0, 6)}, pending=${pending.state.slice(0, 6)})`,
			);
		}

		try {
			return await this.exchangeAndStore(parsed.code, pending.codeVerifier, pending.state);
		} catch (error) {
			const adopted = await this.tryAdoptSessionFromSecrets();
			if (adopted) {
				return adopted;
			}
			if (!shouldSettlePendingOnExchangeFailure(stateMatched)) {
				const message = error instanceof Error ? error.message : String(error);
				this.output.appendLine(`[auth] mismatched-state paste exchange failed — keeping pending: ${message}`);
			}
			// Matching-state paste failures leave pending for retry (caller may re-prompt).
			throw error instanceof Error ? error : new Error(String(error));
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
	async createCheckoutSession(packId: 'starter' | 'pro' | 'power'): Promise<string> {
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
	 * True when the OS keyring is unavailable and the session is memory-only.
	 */
	isSessionMemoryOnly(): boolean {
		return this._sessionMemoryOnly;
	}

	/**
	 * Tears down in-process resources only.
	 * Does **not** clear persisted pending PKCE (SecretStorage + globalState) — a web
	 * reload mid-OAuth must leave `safeappeals-cloud.pendingSignIn` so the next
	 * activate can restore it and finish the durable callback exchange.
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
		this._uriHandler = undefined;
		this.output.appendLine('[auth] dispose: preserving pending sign-in (secrets + globalState) for reload recovery');
	}

	/**
	 * Registers the VS Code URI handler after pending restore.
	 * Idempotent — safe if `initialize` is called more than once.
	 */
	private registerUriHandler(): void {
		if (this._uriHandler) {
			return;
		}
		const uriHandler = new CloudUriHandler(this.output);
		this._uriHandler = uriHandler;
		this._disposables.push(
			uriHandler,
			uriHandler.onCallback(result => {
				void this.handleCallback(result);
			}),
			uriHandler.onError(result => {
				void this.handleCallbackError(result);
			}),
		);
	}

	/**
	 * Picks loopback / asExternalUri / finish-page paste from uiKind (never from bind success alone).
	 */
	private async resolveSignInFlow(expectedState: string): Promise<SignInFlow> {
		const finishUri = getFinishPageUri();

		if (vscode.env.uiKind === vscode.UIKind.Desktop) {
			try {
				const loopback = await startOAuthLoopback({
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
	 * Handles a URI-handler or loopback callback: exchange code, store session.
	 * Live success callbacks may proceed when state mismatches if a single pending
	 * exists (GoTrue may rewrite state; the PKCE verifier binds the code). On
	 * exchange failure for a mismatched-state callback, pending is kept so the
	 * real callback can still land. Matching-state failures and timeouts settle.
	 * Restores persisted pending when the workbench reloaded mid-flow.
	 */
	private async handleCallback(result: AuthCallbackResult): Promise<void> {
		// Already signed in or another delivery is exchanging — do not start a second exchange.
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
			// Do not drop the single-use code — stash for when pending appears (reload / late activate).
			this.output.appendLine(
				'[auth] callback arrived with no pending — stashing orphaned auth code',
			);
			await this.stashOrphanedAuthCode(result.code, result.state);
			await this.restorePending();
			try {
				await this.tryCompleteOrphanedAuthCode();
			} catch {
				// Exchange failure already toasted and cleared pending (unless another window won).
			}
			return;
		}
		const stateMatched = result.state === pending.state;
		if (!stateMatched) {
			// GoTrue may rewrite the state query; PKCE verifier is the real binding.
			this.output.appendLine(
				`[auth] callback state mismatch — proceeding with single pending PKCE (callback=${result.state.slice(0, 6)}, pending=${pending.state.slice(0, 6)})`,
			);
		}

		try {
			const session = await this.exchangeAndStore(result.code, pending.codeVerifier, pending.state);
			void vscode.window.showInformationMessage(
				vscode.l10n.t('Signed in to SafeAppeals Cloud as {0}.', session.account.label),
			);
		} catch (error) {
			const adopted = await this.tryAdoptSessionFromSecrets();
			if (adopted) {
				await this.clearDurableOAuthCallback();
				void vscode.window.showInformationMessage(
					vscode.l10n.t('Signed in to SafeAppeals Cloud as {0}.', adopted.account.label),
				);
				return;
			}
			const message = error instanceof Error ? error.message : String(error);
			if (!shouldSettlePendingOnExchangeFailure(stateMatched)) {
				this.output.appendLine(`[auth] mismatched-state callback ignored after exchange failure — keeping pending: ${message}`);
				return;
			}
			void this.failPendingSignIn(error instanceof Error ? error : new Error(message));
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
		const message = result.message || 'oauth_error';
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
		// Burn durable only after a successful exchange — peek/recover must leave it on failure.
		await this.clearDurableOAuthCallback();
		await this.clearPending();
		this.disposeLoopback();
		const authSession = this.toAuthSession(envelope);
		this._sessionChangeEmitter.fire({ added: [authSession], removed: [], changed: [] });
		this.resolvePendingSignIn(authSession);
		void this.getBalance().catch(() => { /* balance is best-effort after sign-in */ });
		return authSession;
	}

	/**
	 * Clears the web durable OAuth callback key after exchange success or when
	 * pending sign-in settles unsuccessfully (fail/cancel/timeout).
	 * No-op outside Web or when the workbench bridge command is unavailable.
	 */
	private async clearDurableOAuthCallback(): Promise<void> {
		if (vscode.env.uiKind !== vscode.UIKind.Web) {
			return;
		}
		try {
			await vscode.commands.executeCommand('_safeappeals.cloud.clearDurableOAuthCallback');
		} catch {
			// Command unavailable outside the web workbench bridge — ignore.
		}
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
			prompt: vscode.l10n.t('Finish signing in with Google, then paste the code your browser shows here.'),
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
			const next: CloudSessionEnvelope = {
				...this._session!,
				accessToken: refreshed.accessToken,
				refreshToken: refreshed.refreshToken,
				expiresAt: refreshed.expiresAt,
				googleProviderToken: refreshed.googleProviderToken ?? this._session!.googleProviderToken,
				googleProviderRefreshToken: refreshed.googleProviderRefreshToken ?? this._session!.googleProviderRefreshToken,
			};
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
	 */
	private async persistSession(session: CloudSessionEnvelope): Promise<void> {
		this._session = session;
		this.scheduleRefresh(session);
		try {
			await this.context.secrets.store(SESSION_SECRET_KEY, JSON.stringify(session));
			this._sessionMemoryOnly = false;
		} catch (error) {
			this._sessionMemoryOnly = true;
			this.output.appendLine(`[auth] SecretStorage unavailable; keeping session in memory only: ${error instanceof Error ? error.message : String(error)}`);
			if (!this._secretStorageWarned) {
				this._secretStorageWarned = true;
				void vscode.window.showWarningMessage(
					vscode.l10n.t('Secure storage is unavailable. Your SafeAppeals Cloud session will not persist after restart.'),
				);
			}
		}
	}

	/**
	 * Reads the session envelope from SecretStorage (never globalState).
	 */
	private async readSessionFromSecrets(): Promise<CloudSessionEnvelope | undefined> {
		try {
			const raw = await this.context.secrets.get(SESSION_SECRET_KEY);
			if (!raw) {
				return undefined;
			}
			return JSON.parse(raw) as CloudSessionEnvelope;
		} catch (error) {
			this.output.appendLine(`[auth] SecretStorage read failed: ${error instanceof Error ? error.message : String(error)}`);
			if (!this._secretStorageWarned) {
				this._secretStorageWarned = true;
				void vscode.window.showWarningMessage(
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
	 * Persists in-flight PKCE to memory, SecretStorage, and APPLICATION globalState.
	 * globalState is the web reload fallback when SecretStorage does not survive.
	 * On Web, also mirrors to origin-shared localStorage via workbench bridge commands.
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
			let secretsStatus: 'ok' | 'fail' = 'fail';
			let globalStateStatus: 'ok' | 'fail' = 'fail';
			let localStorageStatus: 'ok' | 'fail' | undefined;

			try {
				await this.context.secrets.store(PENDING_SIGN_IN_KEY, payload);
				secretsStatus = 'ok';
			} catch (error) {
				this.output.appendLine(`[auth] secrets store pending failed: ${error instanceof Error ? error.message : String(error)}`);
			}

			try {
				await this.context.globalState.update(PENDING_SIGN_IN_KEY, payload);
				globalStateStatus = 'ok';
			} catch (error) {
				this.output.appendLine(`[auth] globalState store pending failed: ${error instanceof Error ? error.message : String(error)}`);
			}

			if (vscode.env.uiKind === vscode.UIKind.Web) {
				try {
					await vscode.commands.executeCommand('_safeappeals.cloud.storePendingPkce', pending);
					localStorageStatus = 'ok';
				} catch (error) {
					localStorageStatus = 'fail';
					this.output.appendLine(`[auth] localStorage store pending failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			}

			const lsPart = localStorageStatus ? `, localStorage=${localStorageStatus}` : '';
			this.output.appendLine(`[auth] persisted pending sign-in (secrets=${secretsStatus}, globalState=${globalStateStatus}${lsPart})`);
		});
	}

	/**
	 * Clears in-memory, SecretStorage, and globalState pending PKCE.
	 * Also drops any stashed orphaned auth code (successful exchange, cancel, or new flow).
	 * On Web, clears the origin-shared localStorage bridge as well.
	 */
	private async clearPending(): Promise<void> {
		this._pending = undefined;
		await this.runPendingWrite(async () => {
			try {
				await this.context.secrets.delete(PENDING_SIGN_IN_KEY);
			} catch (error) {
				this.output.appendLine(`[auth] secrets clear pending failed: ${error instanceof Error ? error.message : String(error)}`);
			}
			try {
				await this.context.globalState.update(PENDING_SIGN_IN_KEY, undefined);
			} catch (error) {
				this.output.appendLine(`[auth] globalState clear pending failed: ${error instanceof Error ? error.message : String(error)}`);
			}
			if (vscode.env.uiKind === vscode.UIKind.Web) {
				try {
					await vscode.commands.executeCommand('_safeappeals.cloud.clearPendingPkce');
				} catch (error) {
					this.output.appendLine(`[auth] localStorage clear pending failed: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
			await this.clearOrphanedAuthCode();
		});
	}

	/**
	 * Persists an auth code that arrived before pending PKCE was available (5 min TTL).
	 * Stays in globalState on purpose — localStorage would not help when restorePending
	 * already failed across secrets, globalState, and the web bridge.
	 */
	private async stashOrphanedAuthCode(code: string, state: string): Promise<void> {
		const orphan: OrphanedAuthCode = { code, state, ts: Date.now() };
		try {
			await this.context.globalState.update(ORPHANED_AUTH_CODE_KEY, orphan);
			this.output.appendLine('[auth] stashed orphaned auth code');
		} catch (error) {
			this.output.appendLine(`[auth] failed to stash orphaned auth code: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Removes any stashed orphaned auth code from globalState.
	 */
	private async clearOrphanedAuthCode(): Promise<void> {
		try {
			await this.context.globalState.update(ORPHANED_AUTH_CODE_KEY, undefined);
		} catch (error) {
			this.output.appendLine(`[auth] clear orphaned auth code failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * If a stashed orphaned auth code matches the current pending PKCE, exchange it.
	 * Covers the race where the callback URI was delivered/consumed before pending existed.
	 */
	private async tryCompleteOrphanedAuthCode(): Promise<void> {
		if (this._session || this._exchangeInFlight) {
			return;
		}

		let raw: unknown;
		try {
			raw = this.context.globalState.get(ORPHANED_AUTH_CODE_KEY);
		} catch (error) {
			this.output.appendLine(`[auth] read orphaned auth code failed: ${error instanceof Error ? error.message : String(error)}`);
			return;
		}
		if (raw === undefined || raw === null) {
			return;
		}

		const orphan = parseOrphanedAuthCode(raw);
		if (!orphan) {
			this.output.appendLine('[auth] cleared expired or invalid orphaned auth code');
			await this.clearOrphanedAuthCode();
			return;
		}

		if (!this._pending) {
			await this.restorePending();
		}
		const pending = this._pending;
		if (!pending) {
			return;
		}
		if (orphan.state !== pending.state) {
			this.output.appendLine('[auth] cleared orphaned auth code — state mismatch with pending');
			await this.clearOrphanedAuthCode();
			return;
		}

		try {
			this.output.appendLine('[auth] completed orphaned auth code');
			const session = await this.exchangeAndStore(orphan.code, pending.codeVerifier, pending.state);
			void vscode.window.showInformationMessage(
				vscode.l10n.t('Signed in to SafeAppeals Cloud as {0}.', session.account.label),
			);
		} catch (error) {
			const adopted = await this.tryAdoptSessionFromSecrets();
			if (adopted) {
				await this.clearDurableOAuthCallback();
				void vscode.window.showInformationMessage(
					vscode.l10n.t('Signed in to SafeAppeals Cloud as {0}.', adopted.account.label),
				);
				return;
			}
			const message = error instanceof Error ? error.message : String(error);
			this.output.appendLine(`[auth] orphaned auth code exchange failed: ${message}`);
			const err = error instanceof Error ? error : new Error(message);
			await this.failPendingSignIn(err);
			void vscode.window.showErrorMessage(vscode.l10n.t('Sign in failed: {0}', message));
			throw err;
		}
	}

	/**
	 * Restores a non-expired pending PKCE by loading all available sources
	 * (SecretStorage, globalState, and on Web localStorage) and picking the
	 * newest by `startedAt` (ties prefer localStorage on Web).
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

		let globalRaw: string | undefined;
		try {
			const stored = this.context.globalState.get<string>(PENDING_SIGN_IN_KEY);
			globalRaw = typeof stored === 'string' ? stored : undefined;
		} catch (error) {
			this.output.appendLine(`[auth] globalState get pending failed: ${error instanceof Error ? error.message : String(error)}`);
		}

		let fromLocalStorage: PendingSignIn | undefined;
		if (vscode.env.uiKind === vscode.UIKind.Web) {
			try {
				const fromLs = await vscode.commands.executeCommand<PendingSignIn | undefined>(
					'_safeappeals.cloud.readPendingPkce',
				);
				fromLocalStorage = fromLs
					? parseRestoredPendingSignIn(JSON.stringify(fromLs))
					: undefined;
			} catch (error) {
				this.output.appendLine(`[auth] localStorage get pending failed: ${error instanceof Error ? error.message : String(error)}`);
			}
		}

		const fromSecrets = parseRestoredPendingSignIn(secretsRaw);
		const fromGlobal = parseRestoredPendingSignIn(globalRaw);

		if (secretsRaw && !fromSecrets) {
			this.output.appendLine('[auth] secrets pending expired or invalid; clearing');
			try {
				await this.context.secrets.delete(PENDING_SIGN_IN_KEY);
			} catch {
				// Best-effort cleanup.
			}
		}
		if (globalRaw && !fromGlobal) {
			this.output.appendLine('[auth] globalState pending expired or invalid; clearing');
			try {
				await this.context.globalState.update(PENDING_SIGN_IN_KEY, undefined);
			} catch {
				// Best-effort cleanup.
			}
		}

		const candidates: Array<PendingSignInWithSource | undefined> = [
			fromSecrets ? { pending: fromSecrets, source: 'secrets' } : undefined,
			fromGlobal ? { pending: fromGlobal, source: 'globalState' } : undefined,
			fromLocalStorage ? { pending: fromLocalStorage, source: 'localStorage' } : undefined,
		];
		const winner = pickNewestPending(candidates);
		if (!winner) {
			return;
		}

		this.output.appendLine(`[auth] restored pending from ${winner.source} (startedAt=${winner.pending.startedAt})`);
		// Sync winner to all stores so a stale secrets copy cannot win next restore.
		await this.persistPending(winner.pending);
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
		// Drop durable with pending so recover/peek cannot re-fire a doomed callback.
		await this.clearDurableOAuthCallback();
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
			const uri = vscode.Uri.parse(trimmed);
			if (uri.fragment && fragmentLooksLikeTokens(uri.fragment)) {
				throw new Error(vscode.l10n.t('Sign-in rejected: tokens in the URL fragment are not allowed.'));
			}
			const params = new URLSearchParams(uri.query);
			return {
				code: params.get('code') ?? undefined,
				state: params.get('state') ?? undefined,
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
 * Heuristic for implicit-flow fragments in pasted URLs.
 */
function fragmentLooksLikeTokens(fragment: string): boolean {
	const params = new URLSearchParams(fragment);
	return !!(params.get('access_token') || params.get('refresh_token'));
}

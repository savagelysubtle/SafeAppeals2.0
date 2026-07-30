/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { buildGoogleAuthorizeUrl, CloudApiClient, CloudSessionEnvelope, CreditBalance, CreditPack } from './api';
import { generatePkceChallenge } from './pkce';
import { AuthCallbackResult, CloudUriHandler } from './uriHandler';

/** Authentication provider id contributed in package.json. */
export const AUTH_PROVIDER_ID = 'safeappeals-cloud';

/** Accounts-menu label. */
export const AUTH_PROVIDER_LABEL = 'SafeAppeals Cloud';

/** Single SecretStorage key for the whole session envelope. */
const SESSION_SECRET_KEY = 'safeappeals-cloud.session';

const SESSION_REFRESH_BUFFER_SECONDS = 5 * 60;
const SIGN_IN_TIMEOUT_MS = 5 * 60 * 1000;
const PASTE_FALLBACK_MS = 2 * 60 * 1000;

/**
 * Pending PKCE sign-in (verifier + state stay in memory only).
 */
interface PendingSignIn {
	readonly codeVerifier: string;
	readonly state: string;
	readonly startedAt: number;
}

/**
 * SafeAppeals Cloud authentication provider.
 * Persists the full session envelope in SecretStorage; credit balance stays in memory.
 */
export class CloudAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
	private readonly _sessionChangeEmitter = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	private readonly _disposables: vscode.Disposable[] = [];
	private readonly _api: CloudApiClient;
	private readonly _uriHandler: CloudUriHandler;

	private _session: CloudSessionEnvelope | undefined;
	/** True when SecretStorage failed and the session lives in memory only. */
	private _sessionMemoryOnly = false;
	private _secretStorageWarned = false;
	private _creditBalance: number | undefined;
	private _pending: PendingSignIn | undefined;
	private _refreshTimer: ReturnType<typeof setTimeout> | undefined;
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
		this._uriHandler = new CloudUriHandler(output);
		this._disposables.push(
			this._uriHandler,
			this._uriHandler.onCallback(result => {
				void this.handleCallback(result);
			}),
			this._uriHandler.onError(result => {
				if (result.cancelled) {
					this.failPendingSignIn(new vscode.CancellationError());
					return;
				}
				this.failPendingSignIn(new Error(result.message));
			}),
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
	 */
	async initialize(): Promise<void> {
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
			}
			return;
		}
		this.scheduleRefresh(stored);
		this.output.appendLine('[auth] restored session from SecretStorage');
	}

	getSessions(_scopes?: readonly string[]): Thenable<vscode.AuthenticationSession[]> {
		return Promise.resolve(this._session ? [this.toAuthSession(this._session)] : []);
	}

	/**
	 * Starts the Google PKCE sign-in flow in the system browser.
	 */
	async createSession(_scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
		if (this._session) {
			return this.toAuthSession(this._session);
		}

		// Abandon any in-flight attempt so its promise settles and cannot toast later.
		if (this._pending || this._signInWaiters.length) {
			this.failPendingSignIn(new vscode.CancellationError());
		}

		const pkce = generatePkceChallenge();
		this._pending = {
			codeVerifier: pkce.codeVerifier,
			state: pkce.state,
			startedAt: Date.now(),
		};

		const authUrl = buildGoogleAuthorizeUrl({
			codeChallenge: pkce.codeChallenge,
			state: pkce.state,
		});

		this.output.appendLine('[auth] opening system browser for Google sign-in');
		const opened = await vscode.env.openExternal(vscode.Uri.parse(authUrl));
		if (!opened) {
			this._pending = undefined;
			throw new Error(vscode.l10n.t('Could not open the system browser for sign-in.'));
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
	 */
	async completeWithPastedCode(raw: string): Promise<vscode.AuthenticationSession> {
		const pending = this._pending;
		if (!pending) {
			throw new Error(vscode.l10n.t('No sign-in is in progress. Start sign-in first, then paste the code.'));
		}

		const { code, state } = parsePastedAuthInput(raw);
		if (state && state !== pending.state) {
			throw new Error(vscode.l10n.t('Sign in failed: state mismatch. Please try signing in again.'));
		}
		if (!code) {
			throw new Error(vscode.l10n.t('Could not find an authorization code in the pasted text.'));
		}

		return this.exchangeAndStore(code, pending.codeVerifier);
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

	dispose(): void {
		this.clearRefreshTimer();
		for (const d of this._disposables) {
			d.dispose();
		}
		this.failPendingSignIn(new vscode.CancellationError());
	}

	/**
	 * Handles a URI-handler callback: verify state, exchange code, store session.
	 */
	private async handleCallback(result: AuthCallbackResult): Promise<void> {
		const pending = this._pending;
		if (!pending) {
			this.output.appendLine('[auth] callback ignored — no pending sign-in');
			return;
		}
		if (result.state !== pending.state) {
			const message = vscode.l10n.t('Sign in failed: state mismatch. Please try again.');
			this.output.appendLine('[auth] state mismatch on callback');
			this.failPendingSignIn(new Error(message));
			void vscode.window.showErrorMessage(message);
			return;
		}

		try {
			const session = await this.exchangeAndStore(result.code, pending.codeVerifier);
			void vscode.window.showInformationMessage(
				vscode.l10n.t('Signed in to SafeAppeals Cloud as {0}.', session.account.label),
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.failPendingSignIn(error instanceof Error ? error : new Error(message));
			void vscode.window.showErrorMessage(vscode.l10n.t('Sign in failed: {0}', message));
		}
	}

	/**
	 * Exchanges the code, persists the envelope, resolves waiters.
	 */
	private async exchangeAndStore(code: string, codeVerifier: string): Promise<vscode.AuthenticationSession> {
		const envelope = await this._api.exchangeCode(code, codeVerifier);
		await this.persistSession(envelope);
		this._pending = undefined;
		const authSession = this.toAuthSession(envelope);
		this._sessionChangeEmitter.fire({ added: [authSession], removed: [], changed: [] });
		this.resolvePendingSignIn(authSession);
		void this.getBalance().catch(() => { /* balance is best-effort after sign-in */ });
		return authSession;
	}

	/**
	 * Waits for URI callback or paste fallback (~2 min prompt, 5 min hard timeout).
	 */
	private waitForSignIn(): Promise<vscode.AuthenticationSession> {
		return new Promise<vscode.AuthenticationSession>((resolve, reject) => {
			const waiter = { resolve, reject };
			this._signInWaiters.push(waiter);

			const pasteTimer = setTimeout(() => {
				void this.offerPasteFallback();
			}, PASTE_FALLBACK_MS);

			const timeout = setTimeout(() => {
				clearTimeout(pasteTimer);
				this._pending = undefined;
				this.failPendingSignIn(new Error(vscode.l10n.t('Sign in timed out. Please try again.')));
			}, SIGN_IN_TIMEOUT_MS);

			const cleanup = () => {
				clearTimeout(pasteTimer);
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
	 * Surfaces the production paste fallback when the OS URI handler does not fire.
	 */
	private async offerPasteFallback(): Promise<void> {
		if (!this._pending || this._session) {
			return;
		}
		const paste = vscode.l10n.t('Paste Code');
		const choice = await vscode.window.showInformationMessage(
			vscode.l10n.t('Didn\'t get redirected back? Paste the code from your browser.'),
			paste,
		);
		if (choice !== paste || !this._pending) {
			return;
		}
		const raw = await vscode.window.showInputBox({
			title: vscode.l10n.t('Paste Auth Code'),
			prompt: vscode.l10n.t('Paste the authorization code (or full callback URL) from your browser'),
			ignoreFocusOut: true,
		});
		if (!raw || !this._pending) {
			return;
		}
		try {
			const session = await this.completeWithPastedCode(raw);
			void vscode.window.showInformationMessage(
				vscode.l10n.t('Signed in to SafeAppeals Cloud as {0}.', session.account.label),
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(vscode.l10n.t('Sign in failed: {0}', message));
		}
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
	 * Purges SecretStorage and in-memory session/balance state.
	 */
	private async purgeSession(): Promise<void> {
		this.clearRefreshTimer();
		this._session = undefined;
		this._sessionMemoryOnly = false;
		this._creditBalance = undefined;
		this._pending = undefined;
		try {
			await this.context.secrets.delete(SESSION_SECRET_KEY);
		} catch (error) {
			this.output.appendLine(`[auth] SecretStorage delete failed: ${error instanceof Error ? error.message : String(error)}`);
		}
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

	private failPendingSignIn(error: Error): void {
		this._pending = undefined;
		const waiters = this._signInWaiters.splice(0);
		for (const waiter of waiters) {
			waiter.reject(error);
		}
	}
}

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
 */
export function parsePastedAuthInput(raw: string): { code: string | undefined; state: string | undefined } {
	const trimmed = raw.trim();
	if (!trimmed) {
		return { code: undefined, state: undefined };
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
		};
	}

	return { code: trimmed, state: undefined };
}

/**
 * Heuristic for implicit-flow fragments in pasted URLs.
 */
function fragmentLooksLikeTokens(fragment: string): boolean {
	const params = new URLSearchParams(fragment);
	return !!(params.get('access_token') || params.get('refresh_token'));
}

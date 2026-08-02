/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ProviderTokenResponse } from './api';
import type { GoogleProviderScopeOptions } from './cloudAuthProvider';

/**
 * Authentication provider id for Google mailbox/calendar provider tokens.
 * Session `accessToken` is a short-lived Google access token (XOAUTH2), not the Cloud JWT.
 *
 * Scope convention (consumers):
 * - `['mail']` — Gmail / IMAP-SMTP XOAUTH2
 * - `['calendar']` — Google Calendar API
 * - `['mail', 'calendar']` — both capabilities
 * - `[]` (empty) — treated as mail for email-dashboard consumers
 *
 * Full Google OAuth URIs (e.g. `https://mail.google.com/`) are also recognized.
 */
export const GOOGLE_AUTH_PROVIDER_ID = 'safeappeals-google';

/** Accounts-menu label (package.nls contributes the localized package.json label). */
export const GOOGLE_AUTH_PROVIDER_LABEL = 'SafeAppeals Google';

/** Capability flags granted for a provider-token session. */
export type ProviderCapability = 'mail' | 'calendar';

const MAIL_SCOPE_MARKERS = new Set([
	'mail',
	'https://mail.google.com/',
	'https://mail.google.com',
	'https://www.googleapis.com/auth/gmail.modify',
	'https://www.googleapis.com/auth/gmail.readonly',
]);

const CALENDAR_SCOPE_MARKERS = new Set([
	'calendar',
	'https://www.googleapis.com/auth/calendar',
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/calendar.readonly',
]);

/** Refresh buffer before treating a cached provider access token as expired (seconds). */
const PROVIDER_TOKEN_REFRESH_BUFFER_SECONDS = 60;

/**
 * Injectable seams for {@link GoogleAuthProvider} (Cloud session + mint + reconsent).
 */
export interface GoogleAuthProviderDeps {
	readonly ensureCloudSession: () => Promise<{ readonly id: string; readonly label: string }>;
	/**
	 * Silent Cloud account lookup for {@link GoogleAuthProvider.getSessions}.
	 * Must not prompt / create a Cloud session — return undefined when signed out.
	 */
	readonly tryGetCloudAccount: () => Promise<{ readonly id: string; readonly label: string } | undefined>;
	readonly requestGoogleProviderScopes: (options: GoogleProviderScopeOptions) => Promise<void>;
	readonly refreshProviderToken: () => Promise<ProviderTokenResponse>;
	readonly onDidChangeCloudSessions: vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>;
	readonly output: Pick<vscode.OutputChannel, 'appendLine'>;
	/** Optional clock for expiry tests (unix seconds). */
	readonly nowSeconds?: () => number;
	/** When false, skips `registerAuthenticationProvider` (unit tests). Default true. */
	readonly register?: boolean;
}

interface CachedProviderSession {
	readonly accessToken: string;
	readonly expiresAt: number;
	readonly account: { readonly id: string; readonly label: string };
	readonly capabilities: ReadonlySet<ProviderCapability>;
}

/**
 * Infers mail/calendar capabilities from VS Code authentication scopes.
 * Empty scopes default to mail (email consumers).
 */
export function inferProviderCapabilities(scopes: readonly string[] | undefined): ReadonlySet<ProviderCapability> {
	const caps = new Set<ProviderCapability>();
	if (!scopes || scopes.length === 0) {
		caps.add('mail');
		return caps;
	}
	for (const scope of scopes) {
		const normalized = scope.trim().toLowerCase();
		if (MAIL_SCOPE_MARKERS.has(normalized) || normalized.includes('mail.google') || normalized === 'mail') {
			caps.add('mail');
		}
		if (CALENDAR_SCOPE_MARKERS.has(normalized) || normalized.includes('calendar')) {
			caps.add('calendar');
		}
	}
	// Unknown scopes alone: do not invent capabilities (caller should fail createSession).
	return caps;
}

/**
 * Canonical session.scopes strings for the granted/requested capability set.
 */
export function scopesForCapabilities(capabilities: ReadonlySet<ProviderCapability>): string[] {
	const scopes: string[] = [];
	if (capabilities.has('mail')) {
		scopes.push('mail');
	}
	if (capabilities.has('calendar')) {
		scopes.push('calendar');
	}
	return scopes;
}

/**
 * True when every requested capability is present in the granted set.
 */
export function sessionSatisfiesCapabilities(
	granted: ReadonlySet<ProviderCapability>,
	requested: ReadonlySet<ProviderCapability>,
): boolean {
	if (requested.size === 0) {
		return false;
	}
	for (const cap of requested) {
		if (!granted.has(cap)) {
			return false;
		}
	}
	return true;
}

/**
 * Detects mint failures that require incremental Google re-consent / reconnect.
 */
export function isProviderTokenReauthError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	const message = error.message.toLowerCase();
	return (
		message.includes('(404)')
		|| message.includes(' 404')
		|| message.includes('not found')
		|| message.includes('reauth')
		|| message.includes('re-auth')
		|| message.includes('reconnect')
		|| message.includes('no provider')
		|| message.includes('provider token')
	);
}

/**
 * Maps requested capabilities to {@link GoogleProviderScopeOptions} for reconsent.
 */
export function googleScopeOptionsFromCapabilities(
	capabilities: ReadonlySet<ProviderCapability>,
): GoogleProviderScopeOptions {
	return {
		mail: capabilities.has('mail') ? true : undefined,
		calendar: capabilities.has('calendar') ? true : undefined,
	};
}

/**
 * SafeAppeals Google provider-token AuthenticationProvider.
 *
 * Holds short-lived Google access tokens in memory only. Cloud identity and
 * server-side provider refresh stay with `safeappeals-cloud` / void-cloud.
 */
export class GoogleAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
	private readonly _sessionChangeEmitter = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	private readonly _disposables: vscode.Disposable[] = [];
	private _cached: CachedProviderSession | undefined;
	private _mintInFlight: Promise<vscode.AuthenticationSession> | undefined;

	readonly onDidChangeSessions = this._sessionChangeEmitter.event;

	constructor(private readonly deps: GoogleAuthProviderDeps) {
		if (deps.register !== false) {
			this._disposables.push(
				vscode.authentication.registerAuthenticationProvider(
					GOOGLE_AUTH_PROVIDER_ID,
					GOOGLE_AUTH_PROVIDER_LABEL,
					this,
					{ supportsMultipleAccounts: false },
				),
			);
		}
		this._disposables.push(
			this._sessionChangeEmitter,
			deps.onDidChangeCloudSessions(event => this.onCloudSessionsChanged(event)),
		);
	}

	/**
	 * Returns a Google provider session for the requested scopes.
	 *
	 * After reload `_cached` is empty — silently mints via `refreshProviderToken`
	 * (no PKCE / no UI) when Cloud is signed in so email sync with
	 * `createIfNone: false` keeps working (DoD #4). Scope expansion still requires
	 * {@link createSession}. On mint/reauth failure returns `[]` for reconnect.
	 */
	async getSessions(scopes?: readonly string[]): Promise<vscode.AuthenticationSession[]> {
		const requested = inferProviderCapabilities(scopes);
		if (requested.size === 0) {
			return [];
		}

		// Have cache but wrong capabilities (e.g. mail-only vs calendar) — do not
		// silently claim new scopes; createSession handles reconsent expansion.
		if (this._cached && !sessionSatisfiesCapabilities(this._cached.capabilities, requested)) {
			return [];
		}

		const now = this.nowSeconds();
		const needsMint = !this._cached
			|| this._cached.expiresAt <= now + PROVIDER_TOKEN_REFRESH_BUFFER_SECONDS;

		if (needsMint) {
			const account = this._cached?.account ?? await this.deps.tryGetCloudAccount();
			if (!account) {
				return [];
			}
			const capabilities = this._cached?.capabilities ?? requested;
			try {
				await this.mintAccessToken(account, capabilities, /*allowReconsent*/ false);
			} catch (error) {
				this.deps.output.appendLine(
					`[google-auth] getSessions silent mint failed: ${error instanceof Error ? error.message : String(error)}`,
				);
				return [];
			}
		}

		if (!this._cached || !sessionSatisfiesCapabilities(this._cached.capabilities, requested)) {
			return [];
		}
		return [this.toAuthSession(this._cached, requested)];
	}

	/**
	 * Ensures Cloud identity, obtains Google mail/calendar consent when needed,
	 * and returns a session whose `accessToken` is the Google provider access token.
	 */
	async createSession(scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
		const requested = inferProviderCapabilities(scopes);
		if (requested.size === 0) {
			throw new Error(vscode.l10n.t('Request mail and/or calendar scopes for SafeAppeals Google.'));
		}

		if (this._mintInFlight) {
			const session = await this._mintInFlight;
			const inFlightCaps = this._cached?.capabilities ?? inferProviderCapabilities(session.scopes);
			if (sessionSatisfiesCapabilities(inFlightCaps, requested)) {
				return this.toAuthSession(
					{
						accessToken: session.accessToken,
						expiresAt: this._cached?.expiresAt ?? this.nowSeconds() + 3600,
						account: session.account,
						capabilities: inFlightCaps,
					},
					requested,
				);
			}
		}

		const work = this.createSessionInner(requested);
		this._mintInFlight = work;
		try {
			return await work;
		} finally {
			if (this._mintInFlight === work) {
				this._mintInFlight = undefined;
			}
		}
	}

	private async createSessionInner(
		requested: ReadonlySet<ProviderCapability>,
	): Promise<vscode.AuthenticationSession> {
		const account = await this.deps.ensureCloudSession();

		const hadCache = !!this._cached;
		const granted = this._cached?.capabilities ?? new Set<ProviderCapability>();
		const missing = missingCapabilities(granted, requested);

		// Proactive reconsent only when an in-memory session lacks requested caps
		// (e.g. expand mail → calendar). Empty cache after reload: mint first —
		// the server may already hold provider refresh (DoD #4).
		if (hadCache && missing.size > 0) {
			this.deps.output.appendLine(
				`[google-auth] requesting Google provider scopes (mail=${missing.has('mail')}, calendar=${missing.has('calendar')})`,
			);
			await this.deps.requestGoogleProviderScopes(googleScopeOptionsFromCapabilities(missing));
		}

		const unionGranted = unionCapabilities(granted, requested);
		try {
			await this.mintAccessToken(account, unionGranted, /*allowReconsent*/ true);
		} catch (error) {
			if (!isProviderTokenReauthError(error)) {
				throw error;
			}
			this.deps.output.appendLine('[google-auth] provider-token mint needs reconsent; retrying consent flow');
			await this.deps.requestGoogleProviderScopes(googleScopeOptionsFromCapabilities(requested));
			await this.mintAccessToken(account, unionGranted, /*allowReconsent*/ false);
		}
		// Return scopes matching the consumer request (sentinel partitioning).
		return this.toAuthSession(this._cached!, requested);
	}

	/**
	 * Clears in-memory provider session state. Does not sign out of SafeAppeals Cloud.
	 */
	async removeSession(sessionId: string): Promise<void> {
		if (!this._cached) {
			return;
		}
		const cachedId = this.sessionId(this._cached);
		if (sessionId !== cachedId && sessionId !== this._cached.account.id) {
			return;
		}
		const removed = [this.toAuthSession(this._cached, this._cached.capabilities)];
		this._cached = undefined;
		this._sessionChangeEmitter.fire({ added: [], removed, changed: [] });
		this.deps.output.appendLine('[google-auth] cleared in-memory Google provider session');
	}

	/**
	 * Clears all cached provider tokens (Cloud sign-out cascade).
	 */
	clearCachedSessions(): void {
		const removed = this._cached ? [this.toAuthSession(this._cached, this._cached.capabilities)] : [];
		this._cached = undefined;
		if (removed.length) {
			this._sessionChangeEmitter.fire({ added: [], removed, changed: [] });
		}
	}

	dispose(): void {
		for (const d of this._disposables) {
			d.dispose();
		}
		this._disposables.length = 0;
		this._cached = undefined;
	}

	private onCloudSessionsChanged(
		event: vscode.AuthenticationProviderAuthenticationSessionsChangeEvent,
	): void {
		const removed = event.removed ?? [];
		if (removed.length === 0) {
			return;
		}
		// Cloud sign-out: stop serving Google provider tokens.
		if (this._cached) {
			this.deps.output.appendLine('[google-auth] clearing provider sessions after Cloud sign-out');
			this.clearCachedSessions();
		}
	}

	private async mintAccessToken(
		account: { readonly id: string; readonly label: string },
		capabilities: ReadonlySet<ProviderCapability>,
		allowReconsent: boolean,
	): Promise<vscode.AuthenticationSession> {
		try {
			const token = await this.deps.refreshProviderToken();
			const previous = this._cached ? [this.toAuthSession(this._cached, this._cached.capabilities)] : [];
			this._cached = {
				accessToken: token.accessToken,
				expiresAt: token.expiresAt,
				account,
				capabilities,
			};
			const session = this.toAuthSession(this._cached, capabilities);
			if (previous.length) {
				this._sessionChangeEmitter.fire({ added: [], removed: [], changed: [session] });
			} else {
				this._sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });
			}
			return session;
		} catch (error) {
			if (allowReconsent && isProviderTokenReauthError(error)) {
				throw error;
			}
			const message = error instanceof Error ? error.message : String(error);
			throw new Error(
				vscode.l10n.t('Could not get a Google access token. Reconnect your mailbox. ({0})', message),
			);
		}
	}

	private toAuthSession(
		cached: CachedProviderSession,
		requestedOrGranted: ReadonlySet<ProviderCapability>,
	): vscode.AuthenticationSession {
		return {
			id: this.sessionId(cached),
			accessToken: cached.accessToken,
			account: {
				id: cached.account.id,
				label: cached.account.label,
			},
			scopes: scopesForCapabilities(requestedOrGranted),
		};
	}

	private sessionId(cached: CachedProviderSession): string {
		return `safeappeals-google:${cached.account.id}`;
	}

	private nowSeconds(): number {
		return this.deps.nowSeconds?.() ?? Math.floor(Date.now() / 1000);
	}
}

function missingCapabilities(
	granted: ReadonlySet<ProviderCapability>,
	requested: ReadonlySet<ProviderCapability>,
): ReadonlySet<ProviderCapability> {
	const missing = new Set<ProviderCapability>();
	for (const cap of requested) {
		if (!granted.has(cap)) {
			missing.add(cap);
		}
	}
	return missing;
}

function unionCapabilities(
	a: ReadonlySet<ProviderCapability>,
	b: ReadonlySet<ProviderCapability>,
): ReadonlySet<ProviderCapability> {
	const out = new Set<ProviderCapability>(a);
	for (const cap of b) {
		out.add(cap);
	}
	return out;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Authentication provider id for Microsoft mailbox/calendar provider tokens (WP8).
 * Session `accessToken` will be a Microsoft Graph / IMAP XOAUTH2 token, not the Cloud JWT.
 *
 * Scope convention (same as Google; wired in WP8):
 * - `['mail']` / `['calendar']` / both / empty → mail default
 */
export const MICROSOFT_AUTH_PROVIDER_ID = 'safeappeals-microsoft';

/** Accounts-menu label (package.nls contributes the localized package.json label). */
export const MICROSOFT_AUTH_PROVIDER_LABEL = 'SafeAppeals Microsoft';

/**
 * Injectable seams for cloud sign-out cascade (tokens cleared when Cloud signs out).
 */
export interface MicrosoftAuthProviderDeps {
	readonly onDidChangeCloudSessions: vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>;
	readonly output: Pick<vscode.OutputChannel, 'appendLine'>;
	/** When false, skips `registerAuthenticationProvider` (unit tests). Default true. */
	readonly register?: boolean;
}

/**
 * Stub Microsoft provider-token AuthenticationProvider until WP8 server symmetry lands.
 * `createSession` fails clearly so email/calendar can surface a reconnect / unavailable path.
 */
export class MicrosoftAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
	private readonly _sessionChangeEmitter = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	private readonly _disposables: vscode.Disposable[] = [];

	readonly onDidChangeSessions = this._sessionChangeEmitter.event;

	constructor(private readonly deps: MicrosoftAuthProviderDeps) {
		if (deps.register !== false) {
			this._disposables.push(
				vscode.authentication.registerAuthenticationProvider(
					MICROSOFT_AUTH_PROVIDER_ID,
					MICROSOFT_AUTH_PROVIDER_LABEL,
					this,
					{ supportsMultipleAccounts: false },
				),
			);
		}
		this._disposables.push(
			this._sessionChangeEmitter,
			deps.onDidChangeCloudSessions(event => {
				if ((event.removed ?? []).length > 0) {
					this.deps.output.appendLine('[microsoft-auth] Cloud sign-out observed (no Microsoft provider sessions yet)');
				}
			}),
		);
	}

	getSessions(_scopes?: readonly string[]): Thenable<vscode.AuthenticationSession[]> {
		return Promise.resolve([]);
	}

	async createSession(_scopes: readonly string[]): Promise<vscode.AuthenticationSession> {
		const message = vscode.l10n.t('Microsoft mailbox sign-in is not yet available. Use Google or an app password for now.');
		this.deps.output.appendLine(`[microsoft-auth] createSession blocked: ${message}`);
		throw new Error(message);
	}

	async removeSession(_sessionId: string): Promise<void> {
		// No in-memory sessions until WP8.
	}

	dispose(): void {
		for (const d of this._disposables) {
			d.dispose();
		}
		this._disposables.length = 0;
	}
}

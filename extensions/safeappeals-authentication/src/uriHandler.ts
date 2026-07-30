/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Successful authorization-code callback after state verification.
 */
export interface AuthCallbackResult {
	readonly code: string;
	readonly state: string;
}

/**
 * Failed or cancelled authorization-code callback.
 * `access_denied` is user cancellation; every other OAuth/security reject is a real error.
 */
export type AuthCallbackError =
	| { readonly cancelled: true }
	| { readonly cancelled: false; readonly message: string };

/**
 * Parses SafeAppeals Cloud OAuth callbacks delivered via the private-use URI scheme.
 * Rejects fragment tokens outright (defense in depth against implicit-flow regressions).
 */
export class CloudUriHandler implements vscode.UriHandler, vscode.Disposable {
	private readonly _emitter = new vscode.EventEmitter<AuthCallbackResult>();
	private readonly _errorEmitter = new vscode.EventEmitter<AuthCallbackError>();
	private readonly _disposable: vscode.Disposable;

	/** Fires when a verified authorization code arrives. */
	readonly onCallback = this._emitter.event;

	/** Fires when the callback carries an OAuth error or is rejected. */
	readonly onError = this._errorEmitter.event;

	constructor(private readonly output: vscode.OutputChannel) {
		this._disposable = vscode.window.registerUriHandler(this);
	}

	/**
	 * Handles `safe-appeals-navigator://auth/callback?...` URIs.
	 */
	handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
		this.output.appendLine(`[uri] received ${uri.scheme}://${uri.authority}${uri.path}`);

		if (uri.authority !== 'auth' || !uri.path.startsWith('/callback')) {
			return;
		}

		const queryParams = new URLSearchParams(uri.query);
		const fragment = uri.fragment ?? '';

		// Defense in depth: never accept bearer tokens from the fragment.
		if (fragmentContainsTokens(fragment)) {
			const message = vscode.l10n.t('Sign-in rejected: tokens in the URL fragment are not allowed. Please try again.');
			this.output.appendLine('[uri] rejected fragment tokens');
			this._errorEmitter.fire({ cancelled: false, message });
			void vscode.window.showErrorMessage(message);
			return;
		}

		const error = queryParams.get('error');
		if (error) {
			// Distinguish strictly on the OAuth error code, never error_description.
			if (error === 'access_denied') {
				this.output.appendLine('[uri] oauth cancelled: access_denied');
				this._errorEmitter.fire({ cancelled: true });
				return;
			}
			const description = queryParams.get('error_description') || error;
			this.output.appendLine(`[uri] oauth error: ${description}`);
			this._errorEmitter.fire({ cancelled: false, message: description });
			void vscode.window.showErrorMessage(vscode.l10n.t('Sign in failed: {0}', description));
			return;
		}

		const code = queryParams.get('code');
		const state = queryParams.get('state');
		if (!code || !state) {
			const message = vscode.l10n.t('Sign in failed: No authorization code received.');
			this.output.appendLine('[uri] missing code or state in query');
			this._errorEmitter.fire({ cancelled: false, message });
			void vscode.window.showErrorMessage(message);
			return;
		}

		this._emitter.fire({ code, state });
	}

	dispose(): void {
		this._disposable.dispose();
		this._emitter.dispose();
		this._errorEmitter.dispose();
	}
}

/**
 * Returns true when the fragment looks like an implicit-flow token delivery.
 */
function fragmentContainsTokens(fragment: string): boolean {
	if (!fragment) {
		return false;
	}
	let decoded = fragment;
	try {
		decoded = decodeURIComponent(fragment);
	} catch {
		// Keep raw fragment if it is not URI-encoded.
	}
	const params = new URLSearchParams(decoded.startsWith('#') ? decoded.slice(1) : decoded);
	return !!(params.get('access_token') || params.get('refresh_token') || params.get('provider_token'));
}

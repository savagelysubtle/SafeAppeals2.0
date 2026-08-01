/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Successful authorization-code callback.
 *
 * `state` is required — VS Code delivers these URIs only when the authority is
 * the extension id (`safeappeals.safeappeals-authentication`), and the OAuth
 * round-trip always echoes state.
 */
export interface AuthCallbackResult {
	readonly code: string;
	readonly state: string;
}

/**
 * Failed or cancelled authorization-code callback.
 * Only fired for real OAuth `error=` responses that include a state value.
 * `access_denied` is user cancellation; every other OAuth reject is a real error.
 */
export type AuthCallbackError =
	| { readonly cancelled: true; readonly state: string }
	| { readonly cancelled: false; readonly message: string; readonly state: string };

/**
 * Parses SafeAppeals Cloud OAuth callbacks delivered via the private-use URI scheme
 * or the web `asExternalUri` reconstruction path.
 *
 * Path must be `/auth/callback`. Authority is the extension id (enforced by
 * ExtensionUrlHandler before this runs). Garbage (fragment tokens, missing state,
 * missing code) is logged and ignored — never settles a pending sign-in.
 */
export class CloudUriHandler implements vscode.UriHandler, vscode.Disposable {
	private readonly _emitter = new vscode.EventEmitter<AuthCallbackResult>();
	private readonly _errorEmitter = new vscode.EventEmitter<AuthCallbackError>();
	private readonly _disposable: vscode.Disposable;

	/** Fires when a verified authorization code arrives. */
	readonly onCallback = this._emitter.event;

	/** Fires when the callback carries an OAuth error that includes state. */
	readonly onError = this._errorEmitter.event;

	constructor(private readonly output: vscode.OutputChannel) {
		this._disposable = vscode.window.registerUriHandler(this);
	}

	/**
	 * Handles `safe-appeals-navigator://safeappeals.safeappeals-authentication/auth/callback?...` URIs.
	 */
	handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
		this.output.appendLine(`[uri] received ${uri.scheme}://${uri.authority}${uri.path}`);

		if (uri.path !== '/auth/callback') {
			this.output.appendLine(`[uri] ignored unexpected path ${uri.path}`);
			return;
		}

		const queryParams = new URLSearchParams(uri.query);
		const fragment = uri.fragment ?? '';

		// Defense in depth: never accept bearer tokens from the fragment.
		// Log and ignore — do not settle a pending (e.g. loopback) sign-in.
		if (fragmentContainsTokens(fragment)) {
			this.output.appendLine('[uri] ignored fragment tokens');
			return;
		}

		const state = queryParams.get('state');
		const error = queryParams.get('error');
		const code = queryParams.get('code');

		if (error) {
			if (!state) {
				this.output.appendLine(`[uri] ignored oauth error without state: ${error}`);
				return;
			}
			// Distinguish strictly on the OAuth error code, never error_description.
			if (error === 'access_denied') {
				this.output.appendLine('[uri] oauth cancelled: access_denied');
				this._errorEmitter.fire({ cancelled: true, state });
				return;
			}
			const description = queryParams.get('error_description') || error;
			this.output.appendLine(`[uri] oauth error: ${description}`);
			this._errorEmitter.fire({ cancelled: false, message: description, state });
			return;
		}

		if (!state) {
			this.output.appendLine('[uri] ignored callback: missing state');
			return;
		}

		if (!code) {
			this.output.appendLine('[uri] ignored callback: missing code');
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

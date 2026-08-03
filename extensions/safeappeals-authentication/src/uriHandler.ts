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
 * Service-connection deep link from the void-cloud `/connections/callback` page.
 *
 * The code exchange already happened server-side, so this carries no secret —
 * only which pending request finished and whether it succeeded.
 */
export interface ConnectCallbackResult {
	readonly requestId: string;
	readonly ok: boolean;
	readonly message?: string;
}

/** Deep-link path for a finished service connection. */
const CONNECT_PATH = '/connect';

/** Deep-link path for the identity authorization-code callback. */
const AUTH_CALLBACK_PATH = '/auth/callback';

/**
 * Parses SafeAppeals Cloud OAuth callbacks delivered via the private-use URI scheme
 * or the web `asExternalUri` reconstruction path.
 *
 * Path must be `/auth/callback` (identity) or `/connect` (service connection).
 * Authority is the extension id (enforced by ExtensionUrlHandler before this
 * runs). Garbage (fragment tokens, missing state, missing code) is logged and
 * ignored — never settles a pending sign-in.
 */
export class CloudUriHandler implements vscode.UriHandler, vscode.Disposable {
	private readonly _emitter = new vscode.EventEmitter<AuthCallbackResult>();
	private readonly _errorEmitter = new vscode.EventEmitter<AuthCallbackError>();
	private readonly _connectEmitter = new vscode.EventEmitter<ConnectCallbackResult>();
	private readonly _disposable: vscode.Disposable | undefined;

	/** Fires when a verified authorization code arrives. */
	readonly onCallback = this._emitter.event;

	/** Fires when the callback carries an OAuth error that includes state. */
	readonly onError = this._errorEmitter.event;

	/** Fires when a service connection finished in the browser. */
	readonly onConnectCallback = this._connectEmitter.event;

	/**
	 * @param register When false, skips `registerUriHandler` (unit tests — VS Code
	 * allows one handler per extension).
	 */
	constructor(private readonly output: vscode.OutputChannel, register = true) {
		this._disposable = register ? vscode.window.registerUriHandler(this) : undefined;
	}

	/**
	 * Handles `safe-appeals-navigator://safeappeals.safeappeals-authentication/...` URIs.
	 */
	handleUri(uri: vscode.Uri): vscode.ProviderResult<void> {
		this.output.appendLine(`[uri] received ${uri.scheme}://${uri.authority}${uri.path}`);

		if (uri.path === CONNECT_PATH) {
			this.handleConnectUri(uri);
			return;
		}

		if (uri.path !== AUTH_CALLBACK_PATH) {
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

	/**
	 * Handles `/connect?requestId=…&status=ok|error`.
	 * A connect deep link never carries a code or token; anything that looks like
	 * one is dropped rather than forwarded.
	 */
	private handleConnectUri(uri: vscode.Uri): void {
		const params = new URLSearchParams(uri.query);
		const requestId = params.get('requestId') ?? params.get('request_id');
		if (!requestId) {
			this.output.appendLine('[uri] ignored connect callback: missing requestId');
			return;
		}

		const error = params.get('error');
		const status = params.get('status');
		if (error || (status && status !== 'ok')) {
			const message = params.get('error_description') || error || status || 'connect_failed';
			this.output.appendLine(`[uri] connect callback failed: ${message}`);
			this._connectEmitter.fire({ requestId, ok: false, message });
			return;
		}

		this.output.appendLine('[uri] connect callback ok');
		this._connectEmitter.fire({ requestId, ok: true });
	}

	dispose(): void {
		this._disposable?.dispose();
		this._emitter.dispose();
		this._errorEmitter.dispose();
		this._connectEmitter.dispose();
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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as http from 'http';
import { URL } from 'url';
import * as vscode from 'vscode';

/** Fixed RFC 8252 loopback host (exact allow-list match on Supabase / API). */
export const LOOPBACK_HOST = '127.0.0.1';

/** Fixed RFC 8252 loopback port shared with the historical auth callback. */
export const LOOPBACK_PORT = 47294;

/** Callback path on the loopback listener. */
export const LOOPBACK_PATH = '/auth/callback';

/** Production loopback redirect URI (exact allow-list match). */
export const LOOPBACK_REDIRECT_URI = `http://${LOOPBACK_HOST}:${LOOPBACK_PORT}${LOOPBACK_PATH}`;

/**
 * Successful loopback authorization-code delivery.
 */
export interface LoopbackAuthCode {
	readonly code: string;
	readonly state: string;
}

/**
 * One-shot loopback server handle. Dispose closes the socket and cancels waiters.
 */
export interface OAuthLoopbackServer extends vscode.Disposable {
	readonly redirectUri: string;
	/** Settles only on matching code, matching OAuth error, timeout, or dispose. */
	readonly code: Promise<LoopbackAuthCode>;
}

/**
 * Starts a one-shot HTTP server that resolves when a verified OAuth redirect hits the callback path.
 *
 * Hardening:
 * - `state` is required and must match `expectedState`; absent/mismatch → 400, log, ignore (no settle)
 * - Success → 302 to `${finishUrl}?status=success`
 * - OAuth `error` with matching state → 302 to finish with `error`; `access_denied` rejects as CancellationError
 *
 * Pass `port: 0` for an ephemeral test port; `redirectUri` reflects the bound port.
 */
export async function startOAuthLoopback(options: {
	readonly expectedState: string;
	readonly finishUrl: string;
	readonly timeoutMs?: number;
	readonly port?: number;
	readonly path?: string;
	readonly log?: (message: string) => void;
}): Promise<OAuthLoopbackServer> {
	const requestedPort = options.port ?? LOOPBACK_PORT;
	const callbackPath = options.path ?? LOOPBACK_PATH;
	const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
	const finishUrl = options.finishUrl.replace(/\/+$/, '');
	const log = options.log ?? (() => { /* no-op */ });

	let settled = false;
	let resolveCode!: (value: LoopbackAuthCode) => void;
	let rejectCode!: (error: Error) => void;
	const codePromise = new Promise<LoopbackAuthCode>((resolve, reject) => {
		resolveCode = resolve;
		rejectCode = reject;
	});

	let boundPort = requestedPort;

	const server = http.createServer((req, res) => {
		try {
			const url = new URL(req.url || '/', `http://${LOOPBACK_HOST}:${boundPort}`);
			if (url.pathname !== callbackPath) {
				res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
				res.end('Not found');
				return;
			}

			const code = url.searchParams.get('code') || undefined;
			const error = url.searchParams.get('error') || undefined;
			const state = url.searchParams.get('state') || undefined;

			if (!state || state !== options.expectedState) {
				log(`[loopback] rejected callback: state ${state ? 'mismatch' : 'missing'}`);
				res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
				res.end('Invalid state');
				return;
			}

			if (error) {
				const location = `${finishUrl}?error=${encodeURIComponent(error)}`;
				res.writeHead(302, { Location: location });
				res.end();
				if (error === 'access_denied') {
					log('[loopback] oauth cancelled: access_denied');
					settleReject(new vscode.CancellationError());
				} else {
					log(`[loopback] oauth error: ${error}`);
					settleReject(new Error(error));
				}
				return;
			}

			if (!code) {
				log('[loopback] rejected callback: missing code');
				res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
				res.end('Missing code');
				return;
			}

			const location = `${finishUrl}?status=success`;
			res.writeHead(302, { Location: location });
			res.end();
			settleResolve({ code, state });
		} catch (err) {
			log(`[loopback] request handler error: ${err instanceof Error ? err.message : String(err)}`);
			res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
			res.end('Internal error');
			// Do not settle — transient handler failures must not jam sign-in.
		}
	});

	const timer = setTimeout(() => {
		settleReject(new Error(vscode.l10n.t('Sign in timed out. Please try again.')));
	}, timeoutMs);

	const closeServer = () => {
		clearTimeout(timer);
		if (typeof server.closeAllConnections === 'function') {
			server.closeAllConnections();
		}
		server.close();
	};

	const settleResolve = (result: LoopbackAuthCode) => {
		if (settled) {
			return;
		}
		settled = true;
		closeServer();
		resolveCode(result);
	};

	const settleReject = (error: Error) => {
		if (settled) {
			return;
		}
		settled = true;
		closeServer();
		rejectCode(error);
	};

	await new Promise<void>((resolve, reject) => {
		const onError = (err: Error) => {
			server.off('listening', onListening);
			reject(err);
		};
		const onListening = () => {
			server.off('error', onError);
			resolve();
		};
		server.once('error', onError);
		server.once('listening', onListening);
		server.listen(requestedPort, LOOPBACK_HOST);
	});

	const address = server.address();
	if (!address || typeof address === 'string') {
		closeServer();
		throw new Error('OAuth loopback failed to bind a TCP port');
	}
	boundPort = address.port;
	const redirectUri = `http://${LOOPBACK_HOST}:${boundPort}${callbackPath}`;

	log(`[loopback] listening on ${redirectUri}`);

	return {
		redirectUri,
		code: codePromise,
		dispose: () => {
			if (settled) {
				closeServer();
				return;
			}
			log('[loopback] disposed before callback');
			settleReject(new vscode.CancellationError());
		},
	};
}

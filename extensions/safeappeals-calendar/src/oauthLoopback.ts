/*--------------------------------------------------------------------------------------
 *  Localhost OAuth loopback — ephemeral port (avoids colliding with cloud auth on 47294)
 *--------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { URL } from 'url';

/** Path segment for the OAuth loopback redirect (port is ephemeral). */
const AUTH_CALLBACK_PATH = '/auth/callback';

export type OAuthLoopbackHostname = '127.0.0.1' | 'localhost';

export interface AuthCallbackResult {
	code?: string;
	error?: string;
	state?: string;
}

export interface StartOAuthLoopbackOptions {
	expectedState?: string;
	timeoutMs?: number;
	/**
	 * Hostname used in redirect_uri (and as the listen host).
	 * Default `127.0.0.1` for Google Desktop loopback.
	 * Use `localhost` for Microsoft — Azure ignores port only for that host.
	 */
	hostname?: OAuthLoopbackHostname;
}

/**
 * One-shot loopback listener. Start before building the authorize URL so
 * `redirect_uri` matches the OS-assigned port.
 */
export interface OAuthLoopback {
	readonly redirectUri: string;
	readonly waitForCode: Promise<AuthCallbackResult>;
	/** Close the server and cancel waitForCode if still pending. Idempotent. */
	close(): void;
}

/**
 * Bind an ephemeral port and return the concrete redirect URI plus a promise
 * that resolves when `/auth/callback` receives the OAuth redirect.
 *
 * Bind host matches redirect host so the browser callback reaches this process
 * whether the OS resolves `localhost` to 127.0.0.1 or ::1.
 */
export async function startOAuthLoopback(options: StartOAuthLoopbackOptions = {}): Promise<OAuthLoopback> {
	const {
		expectedState,
		timeoutMs = 5 * 60 * 1000,
		hostname = '127.0.0.1',
	} = options;
	const callbackPath = AUTH_CALLBACK_PATH;

	return new Promise<OAuthLoopback>((resolveStart, rejectStart) => {
		let settled = false;
		let started = false;
		let redirectUri = '';

		let resolveCode!: (result: AuthCallbackResult) => void;
		let rejectCode!: (err: Error) => void;
		const waitForCode = new Promise<AuthCallbackResult>((resolve, reject) => {
			resolveCode = resolve;
			rejectCode = reject;
		});
		// If connect() fails before awaiting waitForCode, close() still rejects it —
		// attach a no-op so that path does not surface as an unhandled rejection.
		waitForCode.catch(() => { /* consumed by close()/caller */ });

		const settle = (result: AuthCallbackResult) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			server.close();
			if (result.error && !result.code) {
				rejectCode(new Error(result.error));
			} else {
				resolveCode(result);
			}
		};

		const close = () => {
			settle({ error: 'OAuth loopback closed' });
		};

		const server = http.createServer((req, res) => {
			try {
				const url = new URL(req.url || '/', redirectUri || `http://${hostname}`);
				if (url.pathname !== callbackPath) {
					res.writeHead(404, { 'Content-Type': 'text/plain' });
					res.end('Not found');
					return;
				}

				const code = url.searchParams.get('code') || undefined;
				const error = url.searchParams.get('error') || undefined;
				const state = url.searchParams.get('state') || undefined;

				if (expectedState !== undefined && state !== expectedState) {
					res.writeHead(400, { 'Content-Type': 'text/html' });
					res.end(htmlPage('OAuth Error', 'Invalid state parameter. You can close this window.'));
					settle({ error: 'invalid_state' });
					return;
				}

				if (error) {
					res.writeHead(400, { 'Content-Type': 'text/html' });
					res.end(htmlPage('Connection Failed', `Authorization failed: ${error}. You can close this window.`));
					settle({ error, state });
					return;
				}

				res.writeHead(200, { 'Content-Type': 'text/html' });
				res.end(htmlPage(
					'Safe Appeals — Connected',
					'Successfully connected. You can close this window and return to Safe Appeals.'
				));
				settle({ code, state });
			} catch (err) {
				res.writeHead(500, { 'Content-Type': 'text/plain' });
				res.end('Internal error');
				settle({ error: err instanceof Error ? err.message : String(err) });
			}
		});

		const timer = setTimeout(() => {
			settle({ error: 'OAuth timeout — no callback received within 5 minutes' });
		}, timeoutMs);

		server.on('error', (err) => {
			clearTimeout(timer);
			if (!started) {
				rejectStart(err);
				return;
			}
			if (!settled) {
				settled = true;
				rejectCode(err instanceof Error ? err : new Error(String(err)));
			}
		});

		// Listen on the same hostname as redirect_uri (see StartOAuthLoopbackOptions.hostname).
		server.listen(0, hostname, () => {
			const address = server.address() as AddressInfo | null;
			if (!address || typeof address.port !== 'number') {
				server.close();
				rejectStart(new Error('Unable to determine ephemeral OAuth loopback port'));
				return;
			}
			redirectUri = `http://${hostname}:${address.port}${callbackPath}`;
			started = true;
			resolveStart({ redirectUri, waitForCode, close });
		});
	});
}

export function createPkcePair(): { verifier: string; challenge: string } {
	const verifier = base64Url(crypto.randomBytes(32));
	const challenge = base64Url(crypto.createHash('sha256').update(verifier).digest());
	return { verifier, challenge };
}

export function createOAuthState(): string {
	return base64Url(crypto.randomBytes(16));
}

function base64Url(buf: Buffer): string {
	return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function htmlPage(title: string, body: string): string {
	return `<!DOCTYPE html><html><head><title>${title}</title></head>
<body style="font-family:system-ui;text-align:center;padding:50px;">
<h1>${title}</h1><p>${body}</p></body></html>`;
}

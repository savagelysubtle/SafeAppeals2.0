/*--------------------------------------------------------------------------------------
 *  Localhost OAuth loopback — mirrors old DevAuthServer (127.0.0.1:47294)
 *--------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import * as http from 'http';
import { URL } from 'url';
import { getAuthCallbackPath, getAuthCallbackPort, getLoopbackRedirectUri } from './config';

export interface AuthCallbackResult {
	code?: string;
	error?: string;
	state?: string;
}

/**
 * Start a one-shot HTTP server that resolves when the OAuth redirect hits /auth/callback.
 */
export async function waitForAuthCode(expectedState?: string, timeoutMs = 5 * 60 * 1000): Promise<AuthCallbackResult> {
	const port = getAuthCallbackPort();
	const callbackPath = getAuthCallbackPath();

	return new Promise((resolve, reject) => {
		let settled = false;

		const server = http.createServer((req, res) => {
			try {
				const url = new URL(req.url || '/', `http://127.0.0.1:${port}`);
				if (url.pathname !== callbackPath) {
					res.writeHead(404, { 'Content-Type': 'text/plain' });
					res.end('Not found');
					return;
				}

				const code = url.searchParams.get('code') || undefined;
				const error = url.searchParams.get('error') || undefined;
				const state = url.searchParams.get('state') || undefined;

				if (expectedState && state && state !== expectedState) {
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

		const settle = (result: AuthCallbackResult) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timer);
			server.close();
			if (result.error && !result.code) {
				reject(new Error(result.error));
			} else {
				resolve(result);
			}
		};

		server.on('error', (err) => {
			if (!settled) {
				settled = true;
				clearTimeout(timer);
				reject(err);
			}
		});

		server.listen(port, '127.0.0.1');
	});
}

export function getRedirectUri(): string {
	return getLoopbackRedirectUri();
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

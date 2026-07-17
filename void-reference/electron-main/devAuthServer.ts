/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

/**
 * Development OAuth Callback Server
 *
 * This runs a tiny HTTP server in the Electron main process to receive OAuth callbacks
 * during development. This solves the issue where custom protocol handlers don't work
 * properly in dev mode (they launch new instances instead of routing to the running one).
 *
 * Flow:
 * 1. User clicks Sign In
 * 2. We start this server on a random port
 * 3. OAuth redirects to http://localhost:PORT/auth/callback?code=xxx
 * 4. This server receives the callback
 * 5. We emit an event with the code
 * 6. voidCloudService exchanges the code for tokens
 * 7. Server shuts down
 *
 * Reference: https://auth0.com/blog/securing-electron-applications-with-openid-connect-and-oauth-2/
 */

import * as http from 'http';
import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';

export interface DevAuthCallbackEvent {
	code?: string;
	accessToken?: string;
	refreshToken?: string;
	error?: string;
}

export interface IDevAuthServerService {
	readonly _serviceBrand: undefined;

	/**
	 * Starts the dev auth server and returns the callback URL to use
	 */
	startServer(): Promise<string>;

	/**
	 * Stops the dev auth server
	 */
	stopServer(): void;

	/**
	 * Event fired when an auth callback is received
	 */
	readonly onCallback: Event<DevAuthCallbackEvent>;

	/**
	 * Whether the server is currently running
	 */
	readonly isRunning: boolean;
}

export const IDevAuthServerService = createDecorator<IDevAuthServerService>('devAuthServerService');

const DEV_AUTH_SERVER_PORT = 47294; // Random port unlikely to conflict
const CALLBACK_PATH = '/auth/callback';

export class DevAuthServerService extends Disposable implements IDevAuthServerService {
	readonly _serviceBrand: undefined;

	private _server: http.Server | null = null;
	private _isRunning = false;

	private readonly _onCallback = this._register(new Emitter<DevAuthCallbackEvent>());
	readonly onCallback = this._onCallback.event;

	constructor(
		@ILogService private readonly logService: ILogService,
	) {
		super();
	}

	get isRunning(): boolean {
		return this._isRunning;
	}

	async startServer(): Promise<string> {
		if (this._isRunning) {
			this.logService.info('[DevAuthServer] Server already running');
			return this._getCallbackUrl();
		}

		return new Promise((resolve, reject) => {
			this._server = http.createServer((req, res) => {
				this._handleRequest(req, res);
			});

			this._server.on('error', (error) => {
				this.logService.error('[DevAuthServer] Server error:', error);
				reject(error);
			});

			this._server.listen(DEV_AUTH_SERVER_PORT, '127.0.0.1', () => {
				this._isRunning = true;
				const callbackUrl = this._getCallbackUrl();
				this.logService.info(`[DevAuthServer] Started on ${callbackUrl}`);
				resolve(callbackUrl);
			});

			// Auto-shutdown after 5 minutes if no callback received
			setTimeout(() => {
				if (this._isRunning) {
					this.logService.warn('[DevAuthServer] Timeout - shutting down');
					this.stopServer();
				}
			}, 5 * 60 * 1000);
		});
	}

	stopServer(): void {
		if (this._server) {
			this._server.close();
			this._server = null;
			this._isRunning = false;
			this.logService.info('[DevAuthServer] Stopped');
		}
	}

	private _getCallbackUrl(): string {
		return `http://127.0.0.1:${DEV_AUTH_SERVER_PORT}${CALLBACK_PATH}`;
	}

	private _handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
		const url = new URL(req.url || '/', `http://127.0.0.1:${DEV_AUTH_SERVER_PORT}`);

		this.logService.info(`[DevAuthServer] Received request: ${url.pathname}`);

		if (url.pathname !== CALLBACK_PATH) {
			res.writeHead(404);
			res.end('Not Found');
			return;
		}

		// Parse query parameters
		const code = url.searchParams.get('code');
		const error = url.searchParams.get('error');
		const errorDescription = url.searchParams.get('error_description');

		// Also check for tokens in fragment (implicit flow - though usually won't come via HTTP)
		const accessToken = url.searchParams.get('access_token');
		const refreshToken = url.searchParams.get('refresh_token');

		if (error) {
			this.logService.error(`[DevAuthServer] OAuth error: ${error} - ${errorDescription}`);
			this._onCallback.fire({ error: errorDescription || error });
			this._sendSuccessPage(res, false, errorDescription || error);
			this.stopServer();
			return;
		}

		if (code) {
			this.logService.info('[DevAuthServer] Received authorization code');
			this._onCallback.fire({ code });
			this._sendSuccessPage(res, true);
			this.stopServer();
			return;
		}

		if (accessToken && refreshToken) {
			this.logService.info('[DevAuthServer] Received tokens via implicit flow');
			this._onCallback.fire({ accessToken, refreshToken });
			this._sendSuccessPage(res, true);
			this.stopServer();
			return;
		}

		this.logService.warn('[DevAuthServer] No code or tokens in callback');
		this._onCallback.fire({ error: 'No authorization code received' });
		this._sendSuccessPage(res, false, 'No authorization code received');
		this.stopServer();
	}

	private _sendSuccessPage(res: http.ServerResponse, success: boolean, error?: string): void {
		const html = `
<!DOCTYPE html>
<html>
<head>
	<title>SafeAppeals Authentication</title>
	<style>
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			display: flex;
			justify-content: center;
			align-items: center;
			height: 100vh;
			margin: 0;
			background: ${success ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)' : 'linear-gradient(135deg, #2e1a1a 0%, #3e1616 100%)'};
			color: white;
		}
		.container {
			text-align: center;
			padding: 40px;
			background: rgba(255,255,255,0.1);
			border-radius: 16px;
			backdrop-filter: blur(10px);
		}
		.icon {
			font-size: 64px;
			margin-bottom: 20px;
		}
		h1 {
			margin: 0 0 10px 0;
			font-size: 24px;
		}
		p {
			margin: 0;
			opacity: 0.8;
		}
		.error {
			color: #ff6b6b;
			margin-top: 10px;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="icon">${success ? '✅' : '❌'}</div>
		<h1>${success ? 'Authentication Successful!' : 'Authentication Failed'}</h1>
		<p>${success ? 'You can close this window and return to SafeAppeals.' : 'Please try again.'}</p>
		${error ? `<p class="error">${error}</p>` : ''}
	</div>
	<script>
		// Auto-close after 3 seconds
		setTimeout(() => window.close(), 3000);
	</script>
</body>
</html>`;

		res.writeHead(200, { 'Content-Type': 'text/html' });
		res.end(html);
	}

	override dispose(): void {
		this.stopServer();
		super.dispose();
	}
}

registerSingleton(IDevAuthServerService, DevAuthServerService, InstantiationType.Delayed);

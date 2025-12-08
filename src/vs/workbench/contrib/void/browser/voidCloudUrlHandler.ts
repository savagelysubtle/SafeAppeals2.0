/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenURLOptions, IURLHandler, IURLService } from '../../../../platform/url/common/url.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IVoidCloudService } from './voidCloudService.js';

/**
 * Handles safe-appeals-navigator://auth/callback URLs from OAuth flow
 *
 * Flow:
 * 1. User clicks "Sign in with Google" in SafeAppeals
 * 2. Browser opens Supabase OAuth URL
 * 3. User authenticates with Google
 * 4. Supabase redirects to safe-appeals-navigator://auth/callback?code=xxx
 * 5. This handler catches that URL and exchanges the code for tokens
 */
export class VoidCloudUrlHandler extends Disposable implements IWorkbenchContribution, IURLHandler {
	static readonly ID = 'workbench.contrib.voidCloudUrlHandler';

	constructor(
		@IURLService urlService: IURLService,
		@IVoidCloudService private readonly cloudService: IVoidCloudService,
		@ILogService private readonly logService: ILogService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
		this._register(urlService.registerHandler(this));
		this.logService.info('VoidCloudUrlHandler: Registered for safe-appeals-navigator://auth/* URLs');
	}

	async handleURL(uri: URI, options?: IOpenURLOptions): Promise<boolean> {
		// Log full URI details for debugging
		this.logService.info('VoidCloudUrlHandler: Received URL', uri.toString());
		this.logService.info('VoidCloudUrlHandler: URI parts', JSON.stringify({
			scheme: uri.scheme,
			authority: uri.authority,
			path: uri.path,
			query: uri.query,
			fragment: uri.fragment,
		}));

		// Only handle safe-appeals-navigator://auth/callback
		if (uri.authority !== 'auth' || !uri.path.startsWith('/callback')) {
			return false;
		}

		this.logService.info('VoidCloudUrlHandler: Handling auth callback');

		try {
			// Parse query parameters - check both query string AND fragment
			// Supabase may return data in fragment (#) for implicit flow
			const queryParams = new URLSearchParams(uri.query);

			// Fragment may be URL-encoded (e.g., access_token%3Dxxx instead of access_token=xxx)
			// Decode it before parsing
			const decodedFragment = uri.fragment ? decodeURIComponent(uri.fragment) : '';
			const fragmentParams = new URLSearchParams(decodedFragment);

			// Log what we received
			this.logService.info('VoidCloudUrlHandler: Query params', uri.query || '(empty)');
			this.logService.info('VoidCloudUrlHandler: Fragment (raw)', uri.fragment || '(empty)');
			this.logService.info('VoidCloudUrlHandler: Fragment (decoded)', decodedFragment || '(empty)');

			// Check for errors in both query and fragment
			const error = queryParams.get('error') || fragmentParams.get('error');
			const errorDescription = queryParams.get('error_description') || fragmentParams.get('error_description');
			if (error) {
				const message = errorDescription || error;
				this.logService.error('VoidCloudUrlHandler: OAuth error', message);
				this.notificationService.notify({
					severity: Severity.Error,
					message: `Sign in failed: ${message}`,
				});
				this.cloudService.handleAuthError(message);
				return true;
			}

			// Try to get authorization code from query params (PKCE flow)
			let code = queryParams.get('code');

			// If no code, check fragment for access_token (implicit flow)
			// This happens when Supabase uses implicit grant
			const accessToken = fragmentParams.get('access_token');
			const refreshToken = fragmentParams.get('refresh_token');

			if (accessToken && refreshToken) {
				// Handle implicit flow - tokens are already in the URL
				this.logService.info('VoidCloudUrlHandler: Received tokens via implicit flow');
				await this.cloudService.handleImplicitFlowTokens(accessToken, refreshToken);

				this.notificationService.notify({
					severity: Severity.Info,
					message: 'Successfully signed in to SafeAppeals Cloud!',
				});
				return true;
			}

			if (!code) {
				// Also check if code is in fragment (some OAuth providers do this)
				code = fragmentParams.get('code');
			}

			if (!code) {
				const debugInfo = `Query: ${uri.query || '(empty)'}, Fragment: ${uri.fragment || '(empty)'}`;
				this.logService.error('VoidCloudUrlHandler: No code or tokens in callback.', debugInfo);
				this.notificationService.notify({
					severity: Severity.Error,
					message: 'Sign in failed: No authorization code received. Check Developer Tools > Output for details.',
				});
				this.cloudService.handleAuthError('No authorization code received');
				return true;
			}

			// Exchange the code for tokens
			this.logService.info('VoidCloudUrlHandler: Exchanging code for tokens');
			await this.cloudService.exchangeCodeForSession(code);

			this.notificationService.notify({
				severity: Severity.Info,
				message: 'Successfully signed in to SafeAppeals Cloud!',
			});

			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.logService.error('VoidCloudUrlHandler: Failed to handle callback', error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: `Sign in failed: ${message}`,
			});
			this.cloudService.handleAuthError(message);
			return true;
		}
	}
}


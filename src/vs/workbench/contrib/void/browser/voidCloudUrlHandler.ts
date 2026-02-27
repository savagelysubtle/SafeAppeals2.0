/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IOpenURLOptions, IURLHandler, IURLService } from '../../../../platform/url/common/url.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IDocuSignService } from './docuSign/docuSignService.js';
import { IVoidCloudService } from './voidCloudService.js';

/**
 * Handles safe-appeals-navigator:// OAuth callback URLs
 *
 * Supported callbacks:
 * - safe-appeals-navigator://auth/callback - SafeAppeals Cloud (Google OAuth via Supabase)
 * - safe-appeals-navigator://docusign/callback - DocuSign OAuth (legacy) or JWT consent confirmation
 * - safe-appeals-navigator://docusign/consent - DocuSign JWT consent granted confirmation
 * - safe-appeals-navigator://twitter/callback - Twitter/X OAuth PKCE callback (production only)
 *
 * Flow for OAuth:
 * 1. User clicks sign-in button
 * 2. Browser opens OAuth provider URL
 * 3. User authenticates
 * 4. Provider redirects to safe-appeals-navigator://[service]/callback?code=xxx
 * 5. This handler catches that URL and exchanges the code for tokens
 *
 * Flow for JWT consent:
 * 1. User clicks "Grant Consent" button
 * 2. Browser opens DocuSign consent URL
 * 3. User authenticates and grants consent
 * 4. DocuSign redirects to safe-appeals-navigator://docusign/consent
 * 5. This handler confirms consent was granted (JWT auth can now work)
 */
export class VoidCloudUrlHandler extends Disposable implements IWorkbenchContribution, IURLHandler {
	static readonly ID = 'workbench.contrib.voidCloudUrlHandler';

	constructor(
		@IURLService urlService: IURLService,
		@IVoidCloudService private readonly cloudService: IVoidCloudService,
		@IDocuSignService private readonly docuSignService: IDocuSignService,
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@ILogService private readonly logService: ILogService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
		this._register(urlService.registerHandler(this));
		this.logService.info('VoidCloudUrlHandler: Registered for safe-appeals-navigator://auth/*, docusign/*, twitter/* URLs');
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

		// Route to appropriate handler based on authority
		if (uri.authority === 'docusign') {
			if (uri.path.startsWith('/callback')) {
				return this._handleDocuSignCallback(uri);
			}
		}

		if (uri.authority === 'twitter') {
			if (uri.path.startsWith('/callback')) {
				return this._handleTwitterCallback(uri);
			}
		}

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

			// Google provider tokens for Calendar API access
			const googleProviderToken = fragmentParams.get('provider_token') || fragmentParams.get('google_provider_token');
			const googleProviderRefreshToken = fragmentParams.get('provider_refresh_token') || fragmentParams.get('google_provider_refresh_token');

			if (accessToken && refreshToken) {
				// Handle implicit flow - tokens are already in the URL
				this.logService.info('VoidCloudUrlHandler: Received tokens via implicit flow');
				if (googleProviderToken) {
					this.logService.info('VoidCloudUrlHandler: Google Calendar tokens also received');
				}
				await this.cloudService.handleImplicitFlowTokens(
					accessToken,
					refreshToken,
					googleProviderToken || undefined,
					googleProviderRefreshToken || undefined
				);

				this.notificationService.notify({
					severity: Severity.Info,
					message: googleProviderToken
						? 'Successfully signed in to SafeAppeals Cloud with Google Calendar!'
						: 'Successfully signed in to SafeAppeals Cloud!',
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

	/**
	 * Handle Twitter/X OAuth PKCE callback (production only).
	 * URL format: safe-appeals-navigator://twitter/callback?code=xxx&state=yyy
	 *
	 * In dev mode (code.bat), the custom URI scheme is not registered,
	 * so users must copy-paste the auth code from the redirect page instead.
	 */
	private async _handleTwitterCallback(uri: URI): Promise<boolean> {
		this.logService.info('VoidCloudUrlHandler: Handling Twitter callback');

		try {
			const queryParams = new URLSearchParams(uri.query);

			const error = queryParams.get('error');
			const errorDescription = queryParams.get('error_description');
			if (error) {
				const message = errorDescription || error;
				this.logService.error('VoidCloudUrlHandler: Twitter OAuth error', message);
				this.notificationService.notify({
					severity: Severity.Error,
					message: `Twitter sign in failed: ${message}`,
				});
				return true;
			}

			const code = queryParams.get('code');
			const state = queryParams.get('state');
			if (!code || !state) {
				this.logService.error('VoidCloudUrlHandler: Missing code or state in Twitter callback');
				this.notificationService.notify({
					severity: Severity.Error,
					message: 'Twitter sign in failed: Missing authorization code or state.',
				});
				return true;
			}

			const channel = this.mainProcessService.getChannel('void-channel-growth-writer');
			await channel.call('exchangeTwitterCode', { code, state });

			this.notificationService.notify({
				severity: Severity.Info,
				message: 'Successfully connected to Twitter/X!',
			});

			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.logService.error('VoidCloudUrlHandler: Failed to handle Twitter callback', error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: `Twitter sign in failed: ${message}`,
			});
			return true;
		}
	}

	/**
	 * Handle DocuSign OAuth callback (legacy flow)
	 * URL format: safe-appeals-navigator://docusign/callback?code=xxx
	 */
	private async _handleDocuSignCallback(uri: URI): Promise<boolean> {
		this.logService.info('VoidCloudUrlHandler: Handling DocuSign callback');

		try {
			const queryParams = new URLSearchParams(uri.query);

			// Check for errors
			const error = queryParams.get('error');
			const errorDescription = queryParams.get('error_description');
			if (error) {
				const message = errorDescription || error;
				this.logService.error('VoidCloudUrlHandler: DocuSign OAuth error', message);
				this.notificationService.notify({
					severity: Severity.Error,
					message: `DocuSign sign in failed: ${message}`,
				});
				this.docuSignService.handleAuthError(message);
				return true;
			}

			// Get authorization code
			const code = queryParams.get('code');
			if (!code) {
				const debugInfo = `Query: ${uri.query || '(empty)'}`;
				this.logService.error('VoidCloudUrlHandler: No code in DocuSign callback.', debugInfo);
				this.notificationService.notify({
					severity: Severity.Error,
					message: 'DocuSign sign in failed: No authorization code received.',
				});
				this.docuSignService.handleAuthError('No authorization code received');
				return true;
			}

			// Exchange code for session
			this.logService.info('VoidCloudUrlHandler: Exchanging DocuSign code for tokens');
			await this.docuSignService.exchangeCodeForSession(code);

			return true;
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			this.logService.error('VoidCloudUrlHandler: Failed to handle DocuSign callback', error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: `DocuSign sign in failed: ${message}`,
			});
			this.docuSignService.handleAuthError(message);
			return true;
		}
	}

}


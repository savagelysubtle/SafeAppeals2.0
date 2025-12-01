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
		this.logService.info('VoidCloudUrlHandler: Received URL', uri.toString());

		// Only handle safe-appeals-navigator://auth/callback
		if (uri.authority !== 'auth' || !uri.path.startsWith('/callback')) {
			return false;
		}

		this.logService.info('VoidCloudUrlHandler: Handling auth callback');

		try {
			// Parse query parameters
			const params = new URLSearchParams(uri.query);

			// Check for errors from OAuth provider
			const error = params.get('error');
			const errorDescription = params.get('error_description');
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

			// Get the authorization code
			const code = params.get('code');
			if (!code) {
				this.logService.error('VoidCloudUrlHandler: No code in callback');
				this.notificationService.notify({
					severity: Severity.Error,
					message: 'Sign in failed: No authorization code received',
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


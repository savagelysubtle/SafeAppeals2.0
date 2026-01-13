/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ServicesAccessor } from '../../../../editor/browser/editorExtensions.js';
import { localize2 } from '../../../../nls.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IVoidCloudService } from './voidCloudService.js';

// Dev: Paste OAuth Callback URL
// This allows developers to manually paste the callback URL when protocol handler doesn't work
registerAction2(class DevPasteAuthCallbackAction extends Action2 {
	constructor() {
		super({
			id: 'void.cloud.devPasteAuthCallback',
			title: localize2('devPasteAuthCallback', 'SafeAppeals Cloud: Paste Auth Callback URL (Dev)'),
			f1: true, // Show in Command Palette
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quickInputService = accessor.get(IQuickInputService);
		const notificationService = accessor.get(INotificationService);
		const cloudService = accessor.get(IVoidCloudService);
		const environmentService = accessor.get(IEnvironmentService);

		// Only show in dev mode
		if (environmentService.isBuilt) {
			notificationService.notify({
				severity: Severity.Warning,
				message: 'This command is only available in development mode.',
			});
			return;
		}

		const result = await quickInputService.input({
			prompt: 'Paste the callback URL or just the parameters (access_token=... or code=...)',
			placeHolder: 'access_token=... or code=... or full URL',
			validateInput: (value) => {
				if (!value) {
					return Promise.resolve('Please enter the callback URL or parameters');
				}
				if (!value.includes('code=') && !value.includes('access_token=')) {
					return Promise.resolve('Must contain "code=" or "access_token="');
				}
				return Promise.resolve(null);
			}
		});

		if (!result) {
			return; // User cancelled
		}

		try {
			// Helper to extract params from any format
			const extractParams = (input: string): URLSearchParams => {
				// If it starts with access_token= or code=, it's raw params
				if (input.startsWith('access_token=') || input.startsWith('code=')) {
					return new URLSearchParams(input);
				}

				// Check for fragment (after #)
				const hashIndex = input.indexOf('#');
				if (hashIndex !== -1) {
					const fragment = input.substring(hashIndex + 1);
					return new URLSearchParams(fragment);
				}

				// Check for query string (after ?)
				const queryIndex = input.indexOf('?');
				if (queryIndex !== -1) {
					const query = input.substring(queryIndex + 1);
					return new URLSearchParams(query);
				}

				// Try parsing as URL
				try {
					const uri = URI.parse(input);
					if (uri.query) {
						return new URLSearchParams(uri.query);
					}
					if (uri.fragment) {
						return new URLSearchParams(uri.fragment);
					}
				} catch {
					// Ignore parse errors
				}

				// Last resort: treat whole thing as params
				return new URLSearchParams(input);
			};

			const params = extractParams(result.trim());

			const accessToken = params.get('access_token');
			const refreshToken = params.get('refresh_token');
			const code = params.get('code');

			console.log('[DevPasteAuthCallback] Parsed - accessToken:', !!accessToken, 'refreshToken:', !!refreshToken, 'code:', !!code);

			if (accessToken && refreshToken) {
				// Handle implicit flow tokens
				console.log('[DevPasteAuthCallback] Using implicit flow tokens');
				await cloudService.handleImplicitFlowTokens(accessToken, refreshToken);
				notificationService.notify({
					severity: Severity.Info,
					message: 'Successfully signed in to SafeAppeals Cloud!',
				});
				return;
			}

			if (code) {
				// Exchange code for session
				console.log('[DevPasteAuthCallback] Exchanging code for session');
				await cloudService.exchangeCodeForSession(code);
				notificationService.notify({
					severity: Severity.Info,
					message: 'Successfully signed in to SafeAppeals Cloud!',
				});
				return;
			}

			notificationService.notify({
				severity: Severity.Error,
				message: 'No authorization code or tokens found. Make sure you copied the full URL or parameters.',
			});

		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown error';
			console.error('[DevPasteAuthCallback] Error:', error);
			notificationService.notify({
				severity: Severity.Error,
				message: `Sign in failed: ${message}`,
			});
		}
	}
});

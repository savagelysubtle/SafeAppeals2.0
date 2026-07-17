/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import {
	AuthenticationSession,
	AuthenticationSessionsChangeEvent,
	IAuthenticationProvider,
	IAuthenticationProviderSessionOptions,
	IAuthenticationService,
} from '../../../services/authentication/common/authentication.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IVoidCloudService } from './voidCloudService.js';

export const SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID = 'safeappeals-cloud';
export const SAFEAPPEALS_CLOUD_AUTH_PROVIDER_LABEL = 'SafeAppeals Cloud';

/**
 * Authentication provider for SafeAppeals Cloud.
 * This integrates with VSCode's account system to show the SafeAppeals Cloud account
 * in the Accounts panel.
 */
export class SafeAppealsCloudAuthProvider extends Disposable implements IAuthenticationProvider, IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.safeAppealsCloudAuthProvider';

	readonly id = SAFEAPPEALS_CLOUD_AUTH_PROVIDER_ID;
	readonly label = SAFEAPPEALS_CLOUD_AUTH_PROVIDER_LABEL;
	readonly supportsMultipleAccounts = false;

	private readonly _onDidChangeSessions = this._register(new Emitter<AuthenticationSessionsChangeEvent>());
	readonly onDidChangeSessions: Event<AuthenticationSessionsChangeEvent> = this._onDidChangeSessions.event;

	private _sessions: AuthenticationSession[] = [];

	constructor(
		@IAuthenticationService private readonly authenticationService: IAuthenticationService,
		@IVoidCloudService private readonly cloudService: IVoidCloudService,
	) {
		super();

		// Register this provider with the authentication service
		this.authenticationService.registerAuthenticationProvider(this.id, this);

		// Listen for cloud auth state changes
		this._register(this.cloudService.onAuthStateChange((event) => {
			this._updateSessions();
		}));

		// Initialize sessions from current state
		this._updateSessions();
	}

	private _updateSessions(): void {
		const authState = this.cloudService.authState;
		const oldSessions = [...this._sessions];

		if (authState.status === 'signed_in' && authState.session) {
			const user = authState.session.user;
			const newSession: AuthenticationSession = {
				id: user.id,
				accessToken: authState.session.accessToken,
				account: {
					id: user.id,
					label: user.displayName || user.email,
				},
				scopes: ['cloud'],
			};

			// Check if session changed
			const existingSession = this._sessions.find(s => s.id === newSession.id);
			if (!existingSession) {
				this._sessions = [newSession];
				this._onDidChangeSessions.fire({
					added: [newSession],
					removed: oldSessions,
					changed: undefined,
				});
			}
		} else {
			// Signed out
			if (this._sessions.length > 0) {
				const removed = [...this._sessions];
				this._sessions = [];
				this._onDidChangeSessions.fire({
					added: undefined,
					removed: removed,
					changed: undefined,
				});
			}
		}
	}

	async getSessions(scopes?: string[], options?: IAuthenticationProviderSessionOptions): Promise<readonly AuthenticationSession[]> {
		return this._sessions;
	}

	async createSession(scopes: string[], options: IAuthenticationProviderSessionOptions): Promise<AuthenticationSession> {
		// Trigger sign-in flow
		await this.cloudService.signInWithGoogle();

		// Wait for the session to be created (this happens async via URL handler)
		// Return a promise that resolves when auth state changes to signed_in
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				disposable.dispose();
				reject(new Error('Sign in timed out'));
			}, 120000); // 2 minute timeout

			const disposable = this.cloudService.onAuthStateChange((event) => {
				if (event.status === 'signed_in' && this._sessions.length > 0) {
					clearTimeout(timeout);
					disposable.dispose();
					resolve(this._sessions[0]);
				} else if (event.status === 'error') {
					clearTimeout(timeout);
					disposable.dispose();
					reject(new Error('Sign in failed'));
				}
			});
		});
	}

	async removeSession(sessionId: string): Promise<void> {
		await this.cloudService.signOut();
	}

	override dispose(): void {
		this.authenticationService.unregisterAuthenticationProvider(this.id);
		super.dispose();
	}
}


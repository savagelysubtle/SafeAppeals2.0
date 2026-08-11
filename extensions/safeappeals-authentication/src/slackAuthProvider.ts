/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { ConnectionAuthProvider, type ConnectionAuthProviderDeps } from './connectionAuthProvider';
import { inferProviderCapabilities } from './providerCapabilities';

/**
 * Authentication provider id for Slack workspace tokens.
 * Session `accessToken` is a short-lived Slack access token (Bearer), not the Cloud JWT.
 *
 * Scope convention:
 * - `['messaging']` — chat:write, channels, groups, im, mpim, reactions, search:read, etc.
 * - `['messaging', 'files']` — messaging + files:read/write, remote_files
 */
export const SLACK_AUTH_PROVIDER_ID = 'safeappeals-slack';

/** Accounts-menu label (package.nls contributes the localized package.json label). */
export const SLACK_AUTH_PROVIDER_LABEL = 'Slack Workspace';

/** Deps for {@link SlackAuthProvider} — provider identity is fixed by the class. */
export type SlackAuthProviderDeps = Omit<
	ConnectionAuthProviderDeps,
	'provider' | 'providerId' | 'label'
>;

/**
 * Slack connection-minted AuthenticationProvider backed by service connections.
 *
 * One Slack connection is one workspace, so several accounts can be signed in at once.
 * Access tokens stay in memory; the provider refresh token lives encrypted on void-cloud.
 *
 * Slack connections support only messaging and/or files (no mail/calendar).
 */
export class SlackAuthProvider extends ConnectionAuthProvider {
	constructor(deps: SlackAuthProviderDeps) {
		super({
			...deps,
			provider: 'slack',
			providerId: SLACK_AUTH_PROVIDER_ID,
			label: SLACK_AUTH_PROVIDER_LABEL,
		});
	}

	/**
	 * Slack defaults to messaging (+ files if the bundle is requested/allowed).
	 * The base class errors on empty scopes with mail/calendar-centric text.
	 */
	override async getSessions(
		scopes?: readonly string[],
		options?: vscode.AuthenticationProviderSessionOptions,
	): Promise<vscode.AuthenticationSession[]> {
		const requested = inferProviderCapabilities(scopes);
		if (requested.size === 0) {
			// Default to the supported Slack bundle for silent get.
			return super.getSessions(['messaging', 'files'], options);
		}
		return super.getSessions(scopes, options);
	}

	override async createSession(
		scopes: readonly string[],
		options?: vscode.AuthenticationProviderSessionOptions,
	): Promise<vscode.AuthenticationSession> {
		const requested = inferProviderCapabilities(scopes);
		if (requested.size === 0) {
			// Default connect capabilities per spec: messaging+files when supported.
			return super.createSession(['messaging', 'files'], options);
		}
		return super.createSession(scopes, options);
	}
}

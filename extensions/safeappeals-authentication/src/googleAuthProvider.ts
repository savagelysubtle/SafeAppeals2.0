/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionAuthProvider, type ConnectionAuthProviderDeps } from './connectionAuthProvider';

/**
 * Authentication provider id for Google mailbox/calendar provider tokens.
 * Session `accessToken` is a short-lived Google access token (XOAUTH2), not the Cloud JWT.
 *
 * Scope convention is shared with the Microsoft provider — see
 * {@link import('./providerCapabilities').ProviderCapability}.
 */
export const GOOGLE_AUTH_PROVIDER_ID = 'safeappeals-google';

/** Accounts-menu label (package.nls contributes the localized package.json label). */
export const GOOGLE_AUTH_PROVIDER_LABEL = 'SafeAppeals Google';

/** Deps for {@link GoogleAuthProvider} — provider identity is fixed by the class. */
export type GoogleAuthProviderDeps = Omit<
	ConnectionAuthProviderDeps,
	'provider' | 'providerId' | 'label'
>;

/**
 * Google connection-minted AuthenticationProvider backed by service connections.
 *
 * One Google connection is one mailbox/calendar account, so several accounts can
 * be signed in at once. Access tokens stay in memory; the provider refresh token
 * lives encrypted on void-cloud.
 */
export class GoogleAuthProvider extends ConnectionAuthProvider {
	constructor(deps: GoogleAuthProviderDeps) {
		super({
			...deps,
			provider: 'google',
			providerId: GOOGLE_AUTH_PROVIDER_ID,
			label: GOOGLE_AUTH_PROVIDER_LABEL,
		});
	}
}

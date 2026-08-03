/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConnectionAuthProvider, type ConnectionAuthProviderDeps } from './connectionAuthProvider';

/**
 * Authentication provider id for Microsoft mailbox/calendar provider tokens.
 * Session `accessToken` is an Exchange Online (IMAP/SMTP XOAUTH2) or Graph
 * access token, not the Cloud JWT.
 */
export const MICROSOFT_AUTH_PROVIDER_ID = 'safeappeals-microsoft';

/** Accounts-menu label (package.nls contributes the localized package.json label). */
export const MICROSOFT_AUTH_PROVIDER_LABEL = 'SafeAppeals Microsoft';

/** Deps for {@link MicrosoftAuthProvider} — provider identity is fixed by the class. */
export type MicrosoftAuthProviderDeps = Omit<
	ConnectionAuthProviderDeps,
	'provider' | 'providerId' | 'label'
>;

/**
 * Microsoft connection-minted AuthenticationProvider backed by service connections.
 *
 * Entra issues tokens for a single resource audience, so mail (Exchange Online)
 * and calendar (Graph) are separate connections: asking for both capabilities at
 * once has no matching connection and starting one is rejected up front.
 */
export class MicrosoftAuthProvider extends ConnectionAuthProvider {
	constructor(deps: MicrosoftAuthProviderDeps) {
		super({
			...deps,
			provider: 'microsoft',
			providerId: MICROSOFT_AUTH_PROVIDER_ID,
			label: MICROSOFT_AUTH_PROVIDER_LABEL,
		});
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { type CloudSessionEnvelope } from '../api';
import {
	sessionHasPersistedProviderTokens,
	shouldReturnExistingCloudSession,
	withoutPersistedProviderTokens,
} from '../cloudAuthProvider';

function makeEnvelope(overrides: Partial<CloudSessionEnvelope> & { userId?: string } = {}): CloudSessionEnvelope {
	const userId = overrides.userId ?? overrides.user?.id ?? 'user-1';
	const { userId: _omitUserId, user: userOverride, ...rest } = overrides;
	return {
		accessToken: 'access',
		refreshToken: 'refresh',
		expiresAt: 1_700_000_3600,
		...rest,
		user: userOverride ?? {
			id: userId,
			email: 'lawyer@example.com',
			displayName: 'Lawyer',
			avatarUrl: null,
		},
	};
}

suite('shouldReturnExistingCloudSession', () => {
	test('createSession reuses existing session and ignores scopes', () => {
		const session = makeEnvelope();
		assert.deepStrictEqual(
			{
				withSession: shouldReturnExistingCloudSession(session, ['openid', 'https://mail.google.com/']),
				withoutSession: shouldReturnExistingCloudSession(undefined, ['openid']),
			},
			{ withSession: true, withoutSession: false },
		);
	});
});

suite('withoutPersistedProviderTokens', () => {
	test('nulls both legacy provider token fields', () => {
		const envelope = makeEnvelope({
			googleProviderToken: 'provider-access',
			googleProviderRefreshToken: 'provider-refresh',
		});
		assert.deepStrictEqual(withoutPersistedProviderTokens(envelope), {
			...envelope,
			googleProviderToken: null,
			googleProviderRefreshToken: null,
		});
		assert.strictEqual(sessionHasPersistedProviderTokens(envelope), true);
		assert.strictEqual(sessionHasPersistedProviderTokens(withoutPersistedProviderTokens(envelope)), false);
	});
});

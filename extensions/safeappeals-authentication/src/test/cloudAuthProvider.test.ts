/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { buildGoogleAuthorizeUrl, type CloudSessionEnvelope } from '../api';
import {
	googleProviderScopeAuthorizeFlags,
	loginHintForCloudSession,
	mergeGoogleProviderScopeEnvelope,
	ProviderScopeUserMismatchError,
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

suite('googleProviderScopeAuthorizeFlags', () => {
	test('maps mail/calendar options to authorize URL flags', () => {
		assert.deepStrictEqual(
			{
				both: googleProviderScopeAuthorizeFlags({ mail: true, calendar: true }),
				mailOnly: googleProviderScopeAuthorizeFlags({ mail: true }),
				calendarOnly: googleProviderScopeAuthorizeFlags({ calendar: true }),
				none: googleProviderScopeAuthorizeFlags({}),
				falsey: googleProviderScopeAuthorizeFlags({ mail: false, calendar: false }),
			},
			{
				both: { includeMailScopes: true, includeCalendarScopes: true },
				mailOnly: { includeMailScopes: true, includeCalendarScopes: false },
				calendarOnly: { includeMailScopes: false, includeCalendarScopes: true },
				none: { includeMailScopes: false, includeCalendarScopes: false },
				falsey: { includeMailScopes: false, includeCalendarScopes: false },
			},
		);
	});

	test('flags are passed through to buildGoogleAuthorizeUrl', () => {
		const flags = googleProviderScopeAuthorizeFlags({ mail: true, calendar: true });
		const url = new URL(buildGoogleAuthorizeUrl({
			codeChallenge: 'challenge',
			state: 'state-1',
			redirectUri: 'http://127.0.0.1:0/callback',
			includeMailScopes: flags.includeMailScopes,
			includeCalendarScopes: flags.includeCalendarScopes,
		}));
		assert.deepStrictEqual(
			{
				mail: url.searchParams.get('include_mail_scopes'),
				calendar: url.searchParams.get('include_calendar_scopes'),
			},
			{ mail: 'true', calendar: 'true' },
		);
	});
});

suite('loginHintForCloudSession', () => {
	test('binds consent to the signed-in email and drops blank or missing ones', () => {
		assert.deepStrictEqual(
			{
				email: loginHintForCloudSession(makeEnvelope()),
				padded: loginHintForCloudSession(makeEnvelope({
					user: { id: 'user-a', email: '  lawyer@example.com  ', displayName: null, avatarUrl: null },
				})),
				whitespaceOnly: loginHintForCloudSession(makeEnvelope({
					user: { id: 'user-a', email: '   ', displayName: null, avatarUrl: null },
				})),
				emptyEmail: loginHintForCloudSession(makeEnvelope({
					user: { id: 'user-a', email: '', displayName: null, avatarUrl: null },
				})),
				missingEmail: loginHintForCloudSession({ user: {} }),
				noSession: loginHintForCloudSession(undefined),
			},
			{
				email: 'lawyer@example.com',
				padded: 'lawyer@example.com',
				whitespaceOnly: undefined,
				emptyEmail: undefined,
				missingEmail: undefined,
				noSession: undefined,
			},
		);
	});

	test('hint reaches the authorize URL as login_hint', () => {
		const url = new URL(buildGoogleAuthorizeUrl({
			codeChallenge: 'challenge',
			state: 'state-1',
			redirectUri: 'http://127.0.0.1:0/callback',
			includeMailScopes: true,
			loginHint: loginHintForCloudSession(makeEnvelope()),
		}));
		assert.strictEqual(url.searchParams.get('login_hint'), 'lawyer@example.com');
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

suite('mergeGoogleProviderScopeEnvelope', () => {
	test('rejects wrong user id without producing a merged envelope', () => {
		const current = makeEnvelope({
			userId: 'user-a',
			googleProviderToken: 'old-provider',
		});
		const returned = makeEnvelope({
			userId: 'user-b',
			accessToken: 'new-access',
			googleProviderToken: 'new-provider',
		});
		assert.throws(
			() => mergeGoogleProviderScopeEnvelope(current, returned),
			(error: unknown) => error instanceof ProviderScopeUserMismatchError
				&& error.currentUserId === 'user-a'
				&& error.returnedUserId === 'user-b',
		);
	});

	test('mismatch error carries both emails and names them in the message', () => {
		const current = makeEnvelope({
			user: { id: 'user-a', email: 'cloud@example.com', displayName: null, avatarUrl: null },
		});
		const returned = makeEnvelope({
			user: { id: 'user-b', email: 'other@gmail.com', displayName: null, avatarUrl: null },
		});
		let thrown: ProviderScopeUserMismatchError | undefined;
		try {
			mergeGoogleProviderScopeEnvelope(current, returned);
		} catch (error) {
			thrown = error as ProviderScopeUserMismatchError;
		}
		assert.deepStrictEqual(
			{
				isMismatch: thrown instanceof ProviderScopeUserMismatchError,
				currentUserId: thrown?.currentUserId,
				returnedUserId: thrown?.returnedUserId,
				currentUserEmail: thrown?.currentUserEmail,
				returnedUserEmail: thrown?.returnedUserEmail,
				message: thrown?.message,
			},
			{
				isMismatch: true,
				currentUserId: 'user-a',
				returnedUserId: 'user-b',
				currentUserEmail: 'cloud@example.com',
				returnedUserEmail: 'other@gmail.com',
				message: 'The Google account (other@gmail.com) did not match your SafeAppeals Cloud account (cloud@example.com).',
			},
		);
	});

	test('merges cloud tokens and clears provider tokens when user ids match', () => {
		const current = makeEnvelope({
			userId: 'user-a',
			accessToken: 'old-access',
			refreshToken: 'old-refresh',
			expiresAt: 100,
			googleProviderToken: 'old-provider',
			googleProviderRefreshToken: 'old-provider-refresh',
		});
		const returned = makeEnvelope({
			userId: 'user-a',
			accessToken: 'new-access',
			refreshToken: 'new-refresh',
			expiresAt: 200,
			googleProviderToken: 'new-provider',
			googleProviderRefreshToken: 'new-provider-refresh',
			user: {
				id: 'user-a',
				email: 'lawyer@example.com',
				displayName: 'Updated',
				avatarUrl: null,
			},
		});
		assert.deepStrictEqual(mergeGoogleProviderScopeEnvelope(current, returned), {
			accessToken: 'new-access',
			refreshToken: 'new-refresh',
			expiresAt: 200,
			user: {
				id: 'user-a',
				email: 'lawyer@example.com',
				displayName: 'Updated',
				avatarUrl: null,
			},
			googleProviderToken: null,
			googleProviderRefreshToken: null,
		});
	});

	test('never keeps prior provider tokens even when returned envelope omits them', () => {
		const current = makeEnvelope({
			userId: 'user-a',
			googleProviderToken: 'kept-provider',
			googleProviderRefreshToken: 'kept-refresh',
		});
		const returned = makeEnvelope({
			userId: 'user-a',
			accessToken: 'new-access',
			googleProviderToken: null,
			googleProviderRefreshToken: undefined,
		});
		assert.deepStrictEqual(
			{
				accessToken: mergeGoogleProviderScopeEnvelope(current, returned).accessToken,
				googleProviderToken: mergeGoogleProviderScopeEnvelope(current, returned).googleProviderToken,
				googleProviderRefreshToken: mergeGoogleProviderScopeEnvelope(current, returned).googleProviderRefreshToken,
			},
			{
				accessToken: 'new-access',
				googleProviderToken: null,
				googleProviderRefreshToken: null,
			},
		);
	});
});

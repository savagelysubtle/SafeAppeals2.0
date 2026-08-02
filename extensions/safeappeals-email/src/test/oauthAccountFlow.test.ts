/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { SecretStorage, SecretStorageChangeEvent, Event } from 'vscode';
import { AccountStore, type AccountConfigPersistence } from '../accountStore';
import {
	emailFromAuthAccountLabel,
	gmailOAuthAccountDefaults,
	isProviderScopeUserMismatch,
	providerAuthIdForOAuth,
	shouldPersistOAuthAccount,
} from '../oauthAccountFlow';
import { handleCloudSignOutCascade } from '../syncEngine';
import type { EmailAccountConfig } from '../types';

class FakeSecretStorage implements SecretStorage {
	private readonly map = new Map<string, string>();

	async keys(): Promise<string[]> {
		return [...this.map.keys()];
	}

	async get(key: string): Promise<string | undefined> {
		return this.map.get(key);
	}

	async store(key: string, value: string): Promise<void> {
		this.map.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.map.delete(key);
	}

	readonly onDidChange: Event<SecretStorageChangeEvent> = () => ({ dispose() { } });
}

function memoryPersistence(seed: EmailAccountConfig[] = []): AccountConfigPersistence {
	let accounts = [...seed];
	return {
		list: () => [...accounts],
		save: async (next) => {
			accounts = [...next];
		},
	};
}

suite('email oauthAccountFlow', () => {
	test('label parse, gmail defaults, provider ids, cloud sign-out cascade', async () => {
		const store = new AccountStore(new FakeSecretStorage(), undefined, memoryPersistence(), () => { /* no-op */ });
		const base: Omit<EmailAccountConfig, 'id'> = {
			label: 'user',
			email: 'user@gmail.com',
			imapHost: 'imap.gmail.com',
			imapPort: 993,
			imapSecure: true,
			smtpHost: 'smtp.gmail.com',
			smtpPort: 465,
			smtpSecure: true,
			username: 'user@gmail.com',
		};
		await store.addAccount({ ...base, id: 'oauth-1', email: 'a@gmail.com', username: 'a@gmail.com' }, {
			type: 'oauth',
			provider: 'google',
		});
		await store.addAccount({ ...base, id: 'pwd-1', email: 'b@example.com', username: 'b@example.com' }, {
			type: 'password',
			password: 'app-pass',
		});
		await store.addAccount({ ...base, id: 'oauth-ms', email: 'c@outlook.com', username: 'c@outlook.com' }, {
			type: 'oauth',
			provider: 'microsoft',
		});

		const markedCount = await handleCloudSignOutCascade(store);
		assert.deepStrictEqual(
			{
				bare: emailFromAuthAccountLabel('jane@gmail.com'),
				wrapped: emailFromAuthAccountLabel('Jane Doe (jane@gmail.com)'),
				empty: emailFromAuthAccountLabel('  '),
				defaults: gmailOAuthAccountDefaults('me@gmail.com'),
				googleId: providerAuthIdForOAuth('google'),
				msId: providerAuthIdForOAuth('microsoft'),
				persistWithToken: shouldPersistOAuthAccount({ accessToken: 'ya29.x' }),
				persistEmpty: shouldPersistOAuthAccount({ accessToken: '' }),
				persistMissing: shouldPersistOAuthAccount({}),
				markedCount,
				oauth1: store.getAccount('oauth-1')?.authStatus,
				pwd1: store.getAccount('pwd-1')?.authStatus,
				oauthMs: store.getAccount('oauth-ms')?.authStatus,
			},
			{
				bare: 'jane@gmail.com',
				wrapped: 'jane@gmail.com',
				empty: undefined,
				defaults: {
					label: 'me@gmail.com',
					email: 'me@gmail.com',
					imapHost: 'imap.gmail.com',
					imapPort: 993,
					imapSecure: true,
					smtpHost: 'smtp.gmail.com',
					smtpPort: 465,
					smtpSecure: true,
					username: 'me@gmail.com',
				},
				googleId: 'safeappeals-google',
				msId: 'safeappeals-microsoft',
				persistWithToken: true,
				persistEmpty: false,
				persistMissing: false,
				markedCount: 2,
				oauth1: 'needsReconnect',
				pwd1: undefined,
				oauthMs: 'needsReconnect',
			},
		);
	});

	test('mismatch detection suppresses the duplicate toast only for wrong-account errors', () => {
		assert.deepStrictEqual(
			{
				generic: isProviderScopeUserMismatch(
					new Error('The Google account did not match your SafeAppeals Cloud account.'),
				),
				withEmails: isProviderScopeUserMismatch(
					new Error('The Google account (other@gmail.com) did not match your SafeAppeals Cloud account (cloud@example.com).'),
				),
				serializedAcrossExtHost: isProviderScopeUserMismatch(
					'The Google account did not match your SafeAppeals Cloud account.',
				),
				unrelated: isProviderScopeUserMismatch(new Error('Sign in timed out. Please try again.')),
				missing: isProviderScopeUserMismatch(undefined),
			},
			{
				generic: true,
				withEmails: true,
				serializedAcrossExtHost: true,
				unrelated: false,
				missing: false,
			},
		);
	});
});

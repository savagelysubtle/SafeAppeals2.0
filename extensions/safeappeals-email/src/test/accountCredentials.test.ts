/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { SecretStorage, SecretStorageChangeEvent, Event } from 'vscode';
import { AccountStore, type AccountConfigPersistence } from '../accountStore';
import {
	credentialsForStorage,
	isLegacyOAuthCredentials,
	isOAuthCredentials,
	isPasswordCredentials,
	normalizeCredentials,
	type EmailAccountConfig,
} from '../types';

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

	snapshot(): ReadonlyMap<string, string> {
		return new Map(this.map);
	}
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

const baseConfig = {
	label: 'Work',
	email: 'lawyer@example.com',
	imapHost: 'imap.example.com',
	imapPort: 993,
	imapSecure: true,
	smtpHost: 'smtp.example.com',
	smtpPort: 465,
	smtpSecure: true,
	username: 'lawyer@example.com',
};

suite('normalizeCredentials / credentialsForStorage', () => {
	test('legacy, password, oauth, and invalid shapes', () => {
		assert.deepStrictEqual(
			{
				legacy: normalizeCredentials({ password: 'secret' }),
				typedPassword: normalizeCredentials({ type: 'password', password: 'secret' }),
				oauthGoogle: normalizeCredentials({
					type: 'oauth',
					provider: 'google',
					connectionId: ' conn-1 ',
					accessToken: 'leak',
					refreshToken: 'leak2',
				}),
				oauthLegacy: normalizeCredentials({ type: 'oauth', provider: 'google' }),
				oauthBlankConnection: normalizeCredentials({
					type: 'oauth',
					provider: 'google',
					connectionId: '   ',
				}),
				oauthMicrosoft: normalizeCredentials({
					type: 'oauth',
					provider: 'microsoft',
					connectionId: 'conn-ms',
				}),
				badProvider: normalizeCredentials({ type: 'oauth', provider: 'yahoo' }),
				empty: normalizeCredentials(null),
				storedPassword: credentialsForStorage({ type: 'password', password: 'secret' }),
				storedOauth: credentialsForStorage({
					type: 'oauth',
					provider: 'google',
					connectionId: 'conn-1',
				}),
				storedLegacyOauth: credentialsForStorage({ type: 'oauth', provider: 'google' }),
				isOauth: isOAuthCredentials({ type: 'oauth', provider: 'google', connectionId: 'conn-1' }),
				isPassword: isPasswordCredentials({ type: 'password', password: 'x' }),
				isLegacy: isLegacyOAuthCredentials({ type: 'oauth', provider: 'google' }),
				isNotLegacy: isLegacyOAuthCredentials({
					type: 'oauth',
					provider: 'google',
					connectionId: 'conn-1',
				}),
			},
			{
				legacy: { type: 'password', password: 'secret' },
				typedPassword: { type: 'password', password: 'secret' },
				oauthGoogle: { type: 'oauth', provider: 'google', connectionId: 'conn-1' },
				oauthLegacy: { type: 'oauth', provider: 'google' },
				oauthBlankConnection: { type: 'oauth', provider: 'google' },
				oauthMicrosoft: { type: 'oauth', provider: 'microsoft', connectionId: 'conn-ms' },
				badProvider: undefined,
				empty: undefined,
				storedPassword: { type: 'password', password: 'secret' },
				storedOauth: { type: 'oauth', provider: 'google', connectionId: 'conn-1' },
				storedLegacyOauth: { type: 'oauth', provider: 'google' },
				isOauth: true,
				isPassword: true,
				isLegacy: true,
				isNotLegacy: false,
			},
		);
	});
});

suite('AccountStore credentials + reconnect', () => {
	test('legacy secret parse, oauth persist shape, reconnect, listOAuthAccounts', async () => {
		const secrets = new FakeSecretStorage();
		const persistence = memoryPersistence();
		const store = new AccountStore(secrets, undefined, persistence, () => { /* no-op */ });

		await secrets.store(
			'safeappeals-email.account.legacy-1',
			JSON.stringify({ password: 'app-password' }),
		);
		await persistence.save([
			{ ...baseConfig, id: 'legacy-1' },
		]);

		const passwordAccount = await store.addAccount(
			{ ...baseConfig, id: 'pwd-1', email: 'pwd@example.com', username: 'pwd@example.com' },
			{ password: 'legacy-input' },
		);
		const oauthAccount = await store.addAccount(
			{ ...baseConfig, id: 'oauth-1', email: 'oauth@example.com', username: 'oauth@example.com' },
			{ type: 'oauth', provider: 'google', connectionId: 'conn-1' },
		);
		await store.addAccount(
			{ ...baseConfig, id: 'oauth-ms', email: 'ms@example.com', username: 'ms@example.com' },
			{ type: 'oauth', provider: 'microsoft', connectionId: 'conn-ms' },
		);

		await store.markAccountNeedsReconnect('oauth-1');
		await store.clearNeedsReconnect('oauth-1');
		await store.markAccountNeedsReconnect('oauth-1');

		const oauthListed = await store.listOAuthAccounts();
		const googleOnly = await store.listOAuthAccounts('google');

		assert.deepStrictEqual(
			{
				legacyCreds: await store.getCredentials('legacy-1'),
				passwordCreds: await store.getCredentials(passwordAccount.id),
				oauthCreds: await store.getCredentials(oauthAccount.id),
				rawSecrets: {
					pwd: secrets.snapshot().get('safeappeals-email.account.pwd-1'),
					oauth: secrets.snapshot().get('safeappeals-email.account.oauth-1'),
				},
				oauthAuthStatus: store.getAccount('oauth-1')?.authStatus,
				oauthIds: oauthListed.map((a) => a.id).sort(),
				googleIds: googleOnly.map((a) => a.id),
			},
			{
				legacyCreds: { type: 'password', password: 'app-password' },
				passwordCreds: { type: 'password', password: 'legacy-input' },
				oauthCreds: { type: 'oauth', provider: 'google', connectionId: 'conn-1' },
				rawSecrets: {
					pwd: JSON.stringify({ type: 'password', password: 'legacy-input' }),
					oauth: JSON.stringify({ type: 'oauth', provider: 'google', connectionId: 'conn-1' }),
				},
				oauthAuthStatus: 'needsReconnect',
				oauthIds: ['oauth-1', 'oauth-ms'],
				googleIds: ['oauth-1'],
			},
		);
	});
});

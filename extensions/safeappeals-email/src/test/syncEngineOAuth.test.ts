/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { SecretStorage, SecretStorageChangeEvent, Event } from 'vscode';
import { AccountStore, type AccountConfigPersistence } from '../accountStore';
import {
	authProviderIdFor,
	GOOGLE_MAIL_AUTH_PROVIDER_ID,
	handleCloudSignOutCascade,
	MAIL_AUTH_SCOPES,
	MICROSOFT_MAIL_AUTH_PROVIDER_ID,
	resolveTransportCredentials,
	type MailAuthSessionGetter,
	type ResolveTransportCredentialsDeps,
} from '../syncEngine';
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
	label: 'Gmail',
	email: 'lawyer@gmail.com',
	imapHost: 'imap.gmail.com',
	imapPort: 993,
	imapSecure: true,
	smtpHost: 'smtp.gmail.com',
	smtpPort: 465,
	smtpSecure: true,
	username: 'lawyer@gmail.com',
};

function makeDeps(overrides: Partial<ResolveTransportCredentialsDeps> & {
	getSession: MailAuthSessionGetter;
}): ResolveTransportCredentialsDeps & { warnings: string[]; marks: string[]; clears: string[] } {
	const warnings: string[] = [];
	const marks: string[] = [];
	const clears: string[] = [];
	return {
		getSession: overrides.getSession,
		markNeedsReconnect: overrides.markNeedsReconnect ?? (async (id) => { marks.push(id); }),
		clearNeedsReconnect: overrides.clearNeedsReconnect ?? (async (id) => { clears.push(id); }),
		showReconnectWarning: overrides.showReconnectWarning ?? ((msg) => { warnings.push(msg); }),
		log: overrides.log,
		warnings,
		marks,
		clears,
	};
}

suite('authProviderIdFor / MAIL_AUTH_SCOPES', () => {
	test('maps google/microsoft provider ids and mail scopes', () => {
		assert.deepStrictEqual(
			{
				google: authProviderIdFor('google'),
				microsoft: authProviderIdFor('microsoft'),
				scopes: [...MAIL_AUTH_SCOPES],
				googleId: GOOGLE_MAIL_AUTH_PROVIDER_ID,
				msId: MICROSOFT_MAIL_AUTH_PROVIDER_ID,
			},
			{
				google: 'safeappeals-google',
				microsoft: 'safeappeals-microsoft',
				scopes: ['mail'],
				googleId: 'safeappeals-google',
				msId: 'safeappeals-microsoft',
			},
		);
	});
});

suite('resolveTransportCredentials', () => {
	test('password passthrough; oauth mint targets the connection, clears reconnect, never touches secrets', async () => {
		const secrets = new FakeSecretStorage();
		const persistence = memoryPersistence();
		const store = new AccountStore(secrets, undefined, persistence, () => { /* no-op */ });

		const pwd = await store.addAccount(
			{ ...baseConfig, id: 'pwd-1', email: 'pwd@example.com', username: 'pwd@example.com' },
			{ type: 'password', password: 'app-password' },
		);
		await store.addAccount(
			{ ...baseConfig, id: 'oauth-1', authStatus: 'needsReconnect' },
			{ type: 'oauth', provider: 'google', connectionId: 'conn-1' },
		);
		await store.markAccountNeedsReconnect('oauth-1');

		const sessionCalls: Array<{
			providerId: string;
			scopes: readonly string[];
			createIfNone: boolean;
			account?: { id: string; label: string };
		}> = [];
		const deps = makeDeps({
			getSession: async (providerId, scopes, options) => {
				sessionCalls.push({
					providerId,
					scopes,
					createIfNone: options.createIfNone,
					account: options.account,
				});
				return { id: 'conn-1', accessToken: 'ya29.minted-token' };
			},
			markNeedsReconnect: async (id) => { await store.markAccountNeedsReconnect(id); },
			clearNeedsReconnect: async (id) => { await store.clearNeedsReconnect(id); },
		});

		const passwordResolved = await resolveTransportCredentials(
			pwd,
			{ type: 'password', password: 'app-password' },
			deps,
		);
		const oauthResolved = await resolveTransportCredentials(
			store.getAccount('oauth-1')!,
			{ type: 'oauth', provider: 'google', connectionId: 'conn-1' },
			deps,
		);

		assert.deepStrictEqual(
			{
				passwordResolved,
				oauthResolved,
				sessionCalls,
				oauthAuthStatus: store.getAccount('oauth-1')?.authStatus,
				secretOauth: secrets.snapshot().get('safeappeals-email.account.oauth-1'),
				warnings: deps.warnings,
			},
			{
				passwordResolved: { type: 'password', password: 'app-password' },
				oauthResolved: {
					type: 'oauth',
					accessToken: 'ya29.minted-token',
				},
				sessionCalls: [
					{
						providerId: 'safeappeals-google',
						scopes: ['mail'],
						createIfNone: false,
						account: { id: 'conn-1', label: 'lawyer@gmail.com' },
					},
				],
				oauthAuthStatus: 'ok',
				secretOauth: JSON.stringify({
					type: 'oauth',
					provider: 'google',
					connectionId: 'conn-1',
				}),
				warnings: [],
			},
		);
	});

	test('oauth getSession miss and throw mark needsReconnect + toast (no spam when already flagged)', async () => {
		const accountOk: EmailAccountConfig = { ...baseConfig, id: 'o1' };
		const accountFlagged: EmailAccountConfig = {
			...baseConfig,
			id: 'o2',
			authStatus: 'needsReconnect',
		};

		const missDeps = makeDeps({
			getSession: async () => undefined,
		});
		const throwDeps = makeDeps({
			getSession: async () => {
				throw new Error('microsoft stub unavailable');
			},
		});
		const alreadyDeps = makeDeps({
			getSession: async () => undefined,
		});

		const miss = await resolveTransportCredentials(
			accountOk,
			{ type: 'oauth', provider: 'google', connectionId: 'conn-1' },
			missDeps,
		);
		const thrown = await resolveTransportCredentials(
			{ ...accountOk, id: 'ms-1' },
			{ type: 'oauth', provider: 'microsoft', connectionId: 'conn-ms' },
			throwDeps,
		);
		const already = await resolveTransportCredentials(
			accountFlagged,
			{ type: 'oauth', provider: 'google', connectionId: 'conn-1' },
			alreadyDeps,
		);

		assert.deepStrictEqual(
			{
				miss,
				thrown,
				already,
				missMarks: missDeps.marks,
				throwMarks: throwDeps.marks,
				alreadyMarks: alreadyDeps.marks,
				missWarnings: missDeps.warnings.length,
				throwWarnings: throwDeps.warnings.length,
				alreadyWarnings: alreadyDeps.warnings.length,
				missHasReconnectCopy: missDeps.warnings.some((w) => w.includes('Reconnect mailbox')),
				throwHasReconnectCopy: throwDeps.warnings.some((w) => w.includes('Reconnect mailbox')),
			},
			{
				miss: undefined,
				thrown: undefined,
				already: undefined,
				missMarks: ['o1'],
				throwMarks: ['ms-1'],
				alreadyMarks: ['o2'],
				missWarnings: 1,
				throwWarnings: 1,
				alreadyWarnings: 0,
				missHasReconnectCopy: true,
				throwHasReconnectCopy: true,
			},
		);
	});

	test('a legacy row and a token from another connection both need reconnect', async () => {
		const account: EmailAccountConfig = { ...baseConfig, id: 'o1' };

		const legacyDeps = makeDeps({
			getSession: async () => ({ id: 'conn-1', accessToken: 'ya29.token' }),
		});
		const wrongConnectionDeps = makeDeps({
			getSession: async () => ({ id: 'conn-other', accessToken: 'ya29.token' }),
		});

		const legacy = await resolveTransportCredentials(
			account,
			{ type: 'oauth', provider: 'google' },
			legacyDeps,
		);
		const wrongConnection = await resolveTransportCredentials(
			account,
			{ type: 'oauth', provider: 'google', connectionId: 'conn-1' },
			wrongConnectionDeps,
		);

		assert.deepStrictEqual(
			{
				legacy,
				wrongConnection,
				legacyMarks: legacyDeps.marks,
				wrongConnectionMarks: wrongConnectionDeps.marks,
				legacyClears: legacyDeps.clears,
				wrongConnectionClears: wrongConnectionDeps.clears,
				legacyWarning: legacyDeps.warnings.some((w) => w.includes('not linked to a Safe Appeals connection')),
				wrongConnectionWarning: wrongConnectionDeps.warnings.some((w) =>
					w.includes('different connected account'),
				),
			},
			{
				legacy: undefined,
				wrongConnection: undefined,
				legacyMarks: ['o1'],
				wrongConnectionMarks: ['o1'],
				legacyClears: [],
				wrongConnectionClears: [],
				legacyWarning: true,
				wrongConnectionWarning: true,
			},
		);
	});
});

suite('handleCloudSignOutCascade', () => {
	test('marks all oauth accounts needsReconnect; leaves password accounts alone', async () => {
		const secrets = new FakeSecretStorage();
		const persistence = memoryPersistence();
		const store = new AccountStore(secrets, undefined, persistence, () => { /* no-op */ });

		await store.addAccount(
			{ ...baseConfig, id: 'pwd-1', email: 'pwd@example.com', username: 'pwd@example.com' },
			{ type: 'password', password: 'x' },
		);
		await store.addAccount(
			{ ...baseConfig, id: 'oauth-g', email: 'g@example.com', username: 'g@example.com' },
			{ type: 'oauth', provider: 'google', connectionId: 'conn-g' },
		);
		await store.addAccount(
			{ ...baseConfig, id: 'oauth-ms', email: 'ms@example.com', username: 'ms@example.com' },
			{ type: 'oauth', provider: 'microsoft', connectionId: 'conn-ms' },
		);

		const count = await handleCloudSignOutCascade(store);

		assert.deepStrictEqual(
			{
				count,
				pwd: store.getAccount('pwd-1')?.authStatus,
				google: store.getAccount('oauth-g')?.authStatus,
				microsoft: store.getAccount('oauth-ms')?.authStatus,
				secretOauth: secrets.snapshot().get('safeappeals-email.account.oauth-g'),
			},
			{
				count: 2,
				pwd: undefined,
				google: 'needsReconnect',
				microsoft: 'needsReconnect',
				secretOauth: JSON.stringify({
					type: 'oauth',
					provider: 'google',
					connectionId: 'conn-g',
				}),
			},
		);
	});
});

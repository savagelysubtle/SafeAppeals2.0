/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { SecretStorage, SecretStorageChangeEvent, Event } from 'vscode';
import { AccountStore, type AccountConfigPersistence } from '../accountStore';
import {
	adoptConnectionIdsForLegacyAccounts,
	connectionIdFromSession,
	connectionMailboxEmail,
	emailFromAuthAccountLabel,
	gmailOAuthAccountDefaults,
	matchConnectionForLegacyAccount,
	oauthAccountDefaults,
	providerAuthIdForOAuth,
	sessionGrantsMailScope,
	shouldPersistOAuthAccount,
	toMailConnectionInfo,
	type MailConnectionInfo,
} from '../oauthAccountFlow';
import { handleCloudSignOutCascade } from '../syncEngine';
import type { EmailAccountConfig, EmailOAuthProvider } from '../types';

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

function connection(id: string, accountEmail: string): MailConnectionInfo {
	return {
		id,
		provider: 'google',
		accountEmail,
		accountLabel: accountEmail,
		providerAccountId: `${id}-account`,
		capabilities: ['mail'],
		status: 'active',
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
			connectionId: 'conn-a',
		});
		await store.addAccount({ ...base, id: 'pwd-1', email: 'b@example.com', username: 'b@example.com' }, {
			type: 'password',
			password: 'app-pass',
		});
		await store.addAccount({ ...base, id: 'oauth-ms', email: 'c@outlook.com', username: 'c@outlook.com' }, {
			type: 'oauth',
			provider: 'microsoft',
			connectionId: 'conn-c',
		});

		const markedCount = await handleCloudSignOutCascade(store);
		assert.deepStrictEqual(
			{
				bare: emailFromAuthAccountLabel('jane@gmail.com'),
				wrapped: emailFromAuthAccountLabel('Jane Doe (jane@gmail.com)'),
				empty: emailFromAuthAccountLabel('  '),
				defaults: gmailOAuthAccountDefaults('me@gmail.com'),
				outlookDefaults: oauthAccountDefaults('microsoft', 'me@outlook.com'),
				googleId: providerAuthIdForOAuth('google'),
				msId: providerAuthIdForOAuth('microsoft'),
				persistWithToken: shouldPersistOAuthAccount({
					accessToken: 'ya29.x',
					scopes: ['mail'],
					connectionId: 'conn-1',
				}),
				persistEmpty: shouldPersistOAuthAccount({
					accessToken: '',
					scopes: ['mail'],
					connectionId: 'conn-1',
				}),
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
				outlookDefaults: {
					label: 'me@outlook.com',
					email: 'me@outlook.com',
					imapHost: 'outlook.office365.com',
					imapPort: 993,
					imapSecure: true,
					smtpHost: 'smtp.office365.com',
					smtpPort: 587,
					smtpSecure: false,
					username: 'me@outlook.com',
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

	test('persisting an OAuth mailbox requires a mail-scoped token and a connection', () => {
		const connectionId = 'conn-1';
		assert.deepStrictEqual(
			{
				mailSentinel: shouldPersistOAuthAccount({
					accessToken: 'ya29.x',
					scopes: ['mail'],
					connectionId,
				}),
				gmailUri: shouldPersistOAuthAccount({
					accessToken: 'ya29.x',
					scopes: ['https://mail.google.com/'],
					connectionId,
				}),
				calendarOnly: shouldPersistOAuthAccount({
					accessToken: 'ya29.x',
					scopes: ['calendar'],
					connectionId,
				}),
				noScopes: shouldPersistOAuthAccount({ accessToken: 'ya29.x', scopes: [], connectionId }),
				scopesUndefined: shouldPersistOAuthAccount({ accessToken: 'ya29.x', connectionId }),
				noConnection: shouldPersistOAuthAccount({ accessToken: 'ya29.x', scopes: ['mail'] }),
				blankConnection: shouldPersistOAuthAccount({
					accessToken: 'ya29.x',
					scopes: ['mail'],
					connectionId: '  ',
				}),
				grantsMail: sessionGrantsMailScope(['calendar', 'mail']),
				grantsGmailModify: sessionGrantsMailScope([
					'https://www.googleapis.com/auth/gmail.modify',
				]),
				grantsNothing: sessionGrantsMailScope(undefined),
			},
			{
				mailSentinel: true,
				gmailUri: true,
				calendarOnly: false,
				noScopes: false,
				scopesUndefined: false,
				noConnection: false,
				blankConnection: false,
				grantsMail: true,
				grantsGmailModify: true,
				grantsNothing: false,
			},
		);
	});

	test('connection metadata parses and yields the session connection id', () => {
		assert.deepStrictEqual(
			{
				parsed: toMailConnectionInfo({
					id: ' conn-1 ',
					provider: 'google',
					accountEmail: 'Jane@Gmail.com',
					accountLabel: 'Jane Doe (jane@gmail.com)',
					providerAccountId: 'google-123',
					capabilities: ['mail', 'calendar', 42],
					status: 'active',
				}),
				badProvider: toMailConnectionInfo({ id: 'conn-2', provider: 'yahoo' }),
				missingId: toMailConnectionInfo({ provider: 'google' }),
				notAnObject: toMailConnectionInfo('conn-3'),
				mailboxFromEmail: connectionMailboxEmail(connection('conn-1', 'jane@gmail.com')),
				mailboxFromLabel: connectionMailboxEmail({
					id: 'conn-4',
					provider: 'google',
					accountLabel: 'Jane Doe (jane@gmail.com)',
					capabilities: ['mail'],
				}),
				sessionId: connectionIdFromSession({ id: 'conn-5' }),
				blankSessionId: connectionIdFromSession({ id: '  ' }),
				noSession: connectionIdFromSession(undefined),
			},
			{
				parsed: {
					id: 'conn-1',
					provider: 'google',
					accountEmail: 'Jane@Gmail.com',
					accountLabel: 'Jane Doe (jane@gmail.com)',
					providerAccountId: 'google-123',
					capabilities: ['mail', 'calendar'],
					status: 'active',
				},
				badProvider: undefined,
				missingId: undefined,
				notAnObject: undefined,
				mailboxFromEmail: 'jane@gmail.com',
				mailboxFromLabel: 'jane@gmail.com',
				sessionId: 'conn-5',
				blankSessionId: undefined,
				noSession: undefined,
			},
		);
	});

	test('a legacy mailbox adopts only an unambiguous connection', () => {
		const jane = connection('conn-jane', 'jane@gmail.com');
		const work = connection('conn-work', 'work@gmail.com');
		const revoked = { ...connection('conn-old', 'jane@gmail.com'), status: 'revoked' };
		const calendarOnly = {
			...connection('conn-cal', 'jane@gmail.com'),
			capabilities: ['calendar'],
		};
		const unnamed: MailConnectionInfo = { id: 'conn-x', provider: 'google', capabilities: ['mail'] };
		assert.deepStrictEqual(
			{
				byEmail: matchConnectionForLegacyAccount('JANE@gmail.com ', [work, jane])?.id,
				ignoresRevoked: matchConnectionForLegacyAccount('jane@gmail.com', [jane, revoked])?.id,
				ignoresCalendarOnly: matchConnectionForLegacyAccount('jane@gmail.com', [
					jane,
					calendarOnly,
				])?.id,
				soleUnnamed: matchConnectionForLegacyAccount('jane@gmail.com', [unnamed])?.id,
				ambiguousUnnamed: matchConnectionForLegacyAccount('jane@gmail.com', [unnamed, work]),
				noMatch: matchConnectionForLegacyAccount('other@gmail.com', [jane, work]),
				empty: matchConnectionForLegacyAccount('jane@gmail.com', []),
			},
			{
				byEmail: 'conn-jane',
				ignoresRevoked: 'conn-jane',
				ignoresCalendarOnly: 'conn-jane',
				soleUnnamed: 'conn-x',
				ambiguousUnnamed: undefined,
				noMatch: undefined,
				empty: undefined,
			},
		);
	});

	test('V1 consumer: persist connectionId B, mint ok, disconnect marks needsReconnect, sign-out keeps creds', async () => {
		/**
		 * Manual smoke (email half of Service Connections V1):
		 * Cloud A ≠ Gmail B; connect mail; sync; disconnect → needs reconnect;
		 * Cloud sign-out must not wipe the oauth connectionId secret.
		 */
		const secrets = new FakeSecretStorage();
		const store = new AccountStore(secrets, undefined, memoryPersistence(), () => { /* no-op */ });
		const connectionB = connection('conn-mail-b', 'gmail-b@gmail.com');

		assert.strictEqual(
			shouldPersistOAuthAccount({
				accessToken: 'ya29.mail',
				scopes: ['mail'],
				connectionId: connectionB.id,
			}),
			true,
		);

		await store.addAccount(
			{
				label: 'gmail-b@gmail.com',
				email: 'gmail-b@gmail.com',
				imapHost: 'imap.gmail.com',
				imapPort: 993,
				imapSecure: true,
				smtpHost: 'smtp.gmail.com',
				smtpPort: 465,
				smtpSecure: true,
				username: 'gmail-b@gmail.com',
				id: 'mailbox-1',
			},
			{ type: 'oauth', provider: 'google', connectionId: connectionB.id },
		);

		const listed = [connectionB];
		const stillLinked = matchConnectionForLegacyAccount('gmail-b@gmail.com', listed);
		assert.strictEqual(stillLinked?.id, 'conn-mail-b');

		// Disconnect: connection disappears from the auth list → mint path marks needsReconnect.
		const afterDisconnect = matchConnectionForLegacyAccount('gmail-b@gmail.com', []);
		await store.markAccountNeedsReconnect('mailbox-1');
		const cascadeCount = await handleCloudSignOutCascade(store);

		assert.deepStrictEqual(
			{
				persisted: await store.getCredentials('mailbox-1'),
				afterDisconnect,
				authStatus: store.getAccount('mailbox-1')?.authStatus,
				cascadeCount,
				// Sign-out cascade must not delete the connectionId credential row.
				credsAfterCascade: await store.getCredentials('mailbox-1'),
			},
			{
				persisted: { type: 'oauth', provider: 'google', connectionId: 'conn-mail-b' },
				afterDisconnect: undefined,
				authStatus: 'needsReconnect',
				cascadeCount: 1,
				credsAfterCascade: { type: 'oauth', provider: 'google', connectionId: 'conn-mail-b' },
			},
		);
	});

	test('migration adopts matching connections and flags ambiguous mailboxes', async () => {
		const persistence = memoryPersistence();
		const store = new AccountStore(new FakeSecretStorage(), undefined, persistence, () => { /* no-op */ });
		const base: Omit<EmailAccountConfig, 'id'> = {
			label: 'mailbox',
			email: 'jane@gmail.com',
			imapHost: 'imap.gmail.com',
			imapPort: 993,
			imapSecure: true,
			smtpHost: 'smtp.gmail.com',
			smtpPort: 465,
			smtpSecure: true,
			username: 'jane@gmail.com',
		};
		await store.addAccount({ ...base, id: 'legacy-match' }, { type: 'oauth', provider: 'google' });
		await store.addAccount(
			{ ...base, id: 'legacy-unknown', email: 'nobody@gmail.com', username: 'nobody@gmail.com' },
			{ type: 'oauth', provider: 'google' },
		);
		await store.addAccount(
			{ ...base, id: 'already-linked', email: 'work@gmail.com', username: 'work@gmail.com' },
			{ type: 'oauth', provider: 'google', connectionId: 'conn-work' },
		);
		await store.addAccount(
			{ ...base, id: 'pwd', email: 'pwd@example.com', username: 'pwd@example.com' },
			{ type: 'password', password: 'app-pass' },
		);

		const listedProviders: EmailOAuthProvider[] = [];
		const result = await adoptConnectionIdsForLegacyAccounts(
			store,
			{
				list: async (provider) => {
					listedProviders.push(provider);
					return [connection('conn-jane', 'jane@gmail.com'), connection('conn-work', 'work@gmail.com')];
				},
			},
			() => { /* no-op */ },
		);

		assert.deepStrictEqual(
			{
				result,
				listedProviders,
				matched: await store.getCredentials('legacy-match'),
				unknown: await store.getCredentials('legacy-unknown'),
				unknownStatus: store.getAccount('legacy-unknown')?.authStatus,
				matchedStatus: store.getAccount('legacy-match')?.authStatus,
				alreadyLinked: await store.getCredentials('already-linked'),
				password: await store.getCredentials('pwd'),
			},
			{
				result: { adopted: 1, needsReconnect: 1 },
				listedProviders: ['google'],
				matched: { type: 'oauth', provider: 'google', connectionId: 'conn-jane' },
				unknown: { type: 'oauth', provider: 'google' },
				unknownStatus: 'needsReconnect',
				matchedStatus: undefined,
				alreadyLinked: { type: 'oauth', provider: 'google', connectionId: 'conn-work' },
				password: { type: 'password', password: 'app-pass' },
			},
		);
	});
});

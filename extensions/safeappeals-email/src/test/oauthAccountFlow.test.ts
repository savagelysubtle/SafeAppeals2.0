/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { SecretStorage, SecretStorageChangeEvent, Event } from 'vscode';
import { AccountStore, type AccountConfigPersistence } from '../accountStore';
import {
	boundMailboxEmail,
	emailFromAuthAccountLabel,
	gmailOAuthAccountDefaults,
	isMailboxEmailBound,
	isProviderScopeUserMismatch,
	providerAuthIdForOAuth,
	sessionGrantsMailScope,
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
				persistWithToken: shouldPersistOAuthAccount({ accessToken: 'ya29.x', scopes: ['mail'] }),
				persistEmpty: shouldPersistOAuthAccount({ accessToken: '', scopes: ['mail'] }),
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

	test('persisting an OAuth mailbox requires a token whose grant includes Gmail', () => {
		assert.deepStrictEqual(
			{
				mailSentinel: shouldPersistOAuthAccount({ accessToken: 'ya29.x', scopes: ['mail'] }),
				gmailUri: shouldPersistOAuthAccount({
					accessToken: 'ya29.x',
					scopes: ['https://mail.google.com/'],
				}),
				calendarOnly: shouldPersistOAuthAccount({ accessToken: 'ya29.x', scopes: ['calendar'] }),
				noScopes: shouldPersistOAuthAccount({ accessToken: 'ya29.x', scopes: [] }),
				scopesUndefined: shouldPersistOAuthAccount({ accessToken: 'ya29.x' }),
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
				grantsMail: true,
				grantsGmailModify: true,
				grantsNothing: false,
			},
		);
	});

	test('mailbox address is bound to the SafeAppeals Cloud Google account', () => {
		const bound = boundMailboxEmail('Jane Doe (jane@gmail.com)', 'other@gmail.com');
		assert.deepStrictEqual(
			{
				bound,
				googleFallback: boundMailboxEmail(undefined, 'Jane Doe (jane@gmail.com)'),
				unknown: boundMailboxEmail(undefined, undefined),
				same: isMailboxEmailBound('jane@gmail.com', bound),
				caseAndSpace: isMailboxEmailBound('  JANE@Gmail.com ', bound),
				different: isMailboxEmailBound('work@gmail.com', bound),
				unenforceable: isMailboxEmailBound('anything@gmail.com', undefined),
			},
			{
				bound: 'jane@gmail.com',
				googleFallback: 'jane@gmail.com',
				unknown: undefined,
				same: true,
				caseAndSpace: true,
				different: false,
				unenforceable: true,
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

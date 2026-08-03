/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { syncDraftToImap } from '../draftImapSync';
import { resolveDraftsFolderPath, type FolderInfo } from '../imapClient';
import type { EmailAccountConfig, EmailDraft } from '../types';

const account: EmailAccountConfig = {
	id: 'acc-1',
	label: 'Test',
	email: 'lawyer@example.com',
	imapHost: 'imap.example.com',
	imapPort: 993,
	imapSecure: true,
	smtpHost: 'smtp.example.com',
	smtpPort: 465,
	smtpSecure: true,
	username: 'lawyer@example.com',
};

function sampleDraft(overrides: Partial<EmailDraft> = {}): EmailDraft {
	return {
		id: 'draft-1',
		accountId: account.id,
		emailId: '__compose__',
		to: 'client@example.com',
		subject: 'Hearing follow-up',
		content: 'Body text',
		version: 1,
		status: 'draft',
		createdAt: '2026-01-01T00:00:00.000Z',
		updatedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	};
}

suite('resolveDraftsFolderPath', () => {
	test('prefers SPECIAL-USE Drafts, then Gmail/common paths', () => {
		const special: FolderInfo[] = [
			{ path: 'INBOX', name: 'INBOX' },
			{ path: 'Elsewhere', name: 'Drafts', specialUse: undefined },
			{ path: 'RealDrafts', name: 'Drafts', specialUse: '\\Drafts' },
		];
		const gmail: FolderInfo[] = [
			{ path: 'INBOX', name: 'INBOX' },
			{ path: '[Gmail]/Drafts', name: 'Drafts' },
		];
		const plain: FolderInfo[] = [
			{ path: 'INBOX', name: 'INBOX' },
			{ path: 'Drafts', name: 'Drafts' },
		];
		const nested: FolderInfo[] = [
			{ path: 'INBOX', name: 'INBOX' },
			{ path: 'INBOX.Drafts', name: 'Drafts' },
		];
		assert.deepStrictEqual(
			{
				special: resolveDraftsFolderPath(special),
				gmail: resolveDraftsFolderPath(gmail),
				plain: resolveDraftsFolderPath(plain),
				nested: resolveDraftsFolderPath(nested),
				none: resolveDraftsFolderPath([{ path: 'INBOX', name: 'INBOX' }]),
			},
			{
				special: 'RealDrafts',
				gmail: '[Gmail]/Drafts',
				plain: 'Drafts',
				nested: 'INBOX.Drafts',
				none: undefined,
			},
		);
	});
});

suite('syncDraftToImap fail-soft', () => {
	test('keeps local draft when APPEND fails; persists remote on success', async () => {
		const draft = sampleDraft({ remoteFolder: 'Drafts', remoteUid: 10 });
		let remoteUpdates: Array<{ remoteFolder: string; remoteUid?: number }> = [];

		const failed = await syncDraftToImap(draft, account, { type: 'password', password: 'x' }, {
			buildMime: async () => Buffer.from('From: a\r\n\r\nbody'),
			appendDraft: async () => {
				throw new Error('connection reset');
			},
			updateDraftRemote: async (_id, remote) => {
				remoteUpdates.push(remote);
				return { ...draft, ...remote };
			},
		});

		const ok = await syncDraftToImap(draft, account, { type: 'password', password: 'x' }, {
			buildMime: async () => Buffer.from('From: a\r\n\r\nbody'),
			appendDraft: async (_a, _auth, _raw, options) => {
				assert.deepStrictEqual(
					{ replaceUid: options?.replaceUid, replaceFolder: options?.replaceFolder },
					{ replaceUid: 10, replaceFolder: 'Drafts' },
				);
				return { folder: 'Drafts', uid: 42 };
			},
			updateDraftRemote: async (_id, remote) => {
				remoteUpdates.push(remote);
				return { ...draft, ...remote };
			},
		});

		const skipped = await syncDraftToImap(draft, account, undefined, {
			skipRemote: true,
			updateDraftRemote: async () => draft,
		});

		assert.deepStrictEqual(
			{
				failedId: failed.draft.id,
				failedHasRemote: !!failed.remote,
				failedError: !!failed.remoteError,
				okFolder: ok.remote?.folder,
				okUid: ok.remote?.uid,
				okDraftUid: ok.draft.remoteUid,
				skippedRemote: skipped.remote,
				skippedError: skipped.remoteError,
				remoteUpdateCount: remoteUpdates.length,
			},
			{
				failedId: 'draft-1',
				failedHasRemote: false,
				failedError: true,
				okFolder: 'Drafts',
				okUid: 42,
				okDraftUid: 42,
				skippedRemote: undefined,
				skippedError: undefined,
				remoteUpdateCount: 1,
			},
		);
	});
});

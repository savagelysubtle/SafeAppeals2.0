/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as vscode from 'vscode';
import {
	afterDraftSaved,
	formatMessageForModel,
	SAFEAPPEALS_EMAIL_CREATE_DRAFT_TOOL,
	SAFEAPPEALS_EMAIL_DELETE_TAG_TOOL,
	SAFEAPPEALS_EMAIL_GET_MESSAGE_TOOL,
	SAFEAPPEALS_EMAIL_HIDE_THREAD_TOOL,
	SAFEAPPEALS_EMAIL_LINK_THREAD_TO_CASE_TOOL,
	SAFEAPPEALS_EMAIL_LIST_ACCOUNTS_TOOL,
	SAFEAPPEALS_EMAIL_LIST_FOLDERS_TOOL,
	SAFEAPPEALS_EMAIL_LIST_TAGS_TOOL,
	SAFEAPPEALS_EMAIL_LIST_THREADS_TOOL,
	SAFEAPPEALS_EMAIL_SEARCH_TOOL,
	SAFEAPPEALS_EMAIL_TAG_THREAD_TOOL,
	SAFEAPPEALS_EMAIL_TOOL_NAMES,
	SAFEAPPEALS_EMAIL_UNHIDE_THREAD_TOOL,
	SAFEAPPEALS_EMAIL_UNLINK_THREAD_FROM_CASE_TOOL,
	SAFEAPPEALS_EMAIL_UNTAG_THREAD_TOOL,
	truncateBody,
} from '../agentTools';
import { resolveDraftAccountId } from '../draftAccount';
import { EmailIndex } from '../emailIndex';
import { loadJson, writeEncryptedJson } from '../shared/encryptedStore';
import type { EmailDraft, EmailMessage } from '../types';

class FakeSecretStorage implements vscode.SecretStorage {
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

	readonly onDidChange: vscode.Event<vscode.SecretStorageChangeEvent> = () => ({ dispose() { } });
}

class FakeMemento implements vscode.Memento {
	private readonly map = new Map<string, unknown>();

	keys(): readonly string[] {
		return [...this.map.keys()];
	}

	get<T>(key: string, defaultValue?: T): T {
		if (this.map.has(key)) {
			return this.map.get(key) as T;
		}
		return defaultValue as T;
	}

	async update(key: string, value: unknown): Promise<void> {
		if (value === undefined) {
			this.map.delete(key);
		} else {
			this.map.set(key, value);
		}
	}
}

function sampleMessage(overrides: Partial<EmailMessage> = {}): EmailMessage {
	const id = overrides.id || 'msg-1';
	return {
		id,
		accountId: 'acct-1',
		folder: 'INBOX',
		from: 'client@example.com',
		to: 'lawyer@example.com',
		subject: 'Appeal deadline reminder',
		date: '2026-08-01T12:00:00.000Z',
		snippet: 'Please review the appeal packet',
		threadId: overrides.threadId || 'thread-1',
		bodyLoaded: true,
		bodyText: 'Please review the appeal packet before Friday.',
		attachments: [],
		...overrides,
	};
}

suite('email agentTools', () => {
	test('resolveDraftAccountId picks sole account or requires id', () => {
		assert.deepStrictEqual(
			{
				none: resolveDraftAccountId(undefined, []),
				one: resolveDraftAccountId(undefined, [{ id: 'a1', email: 'a@example.com' }]),
				many: resolveDraftAccountId(undefined, [
					{ id: 'a1', email: 'a@example.com' },
					{ id: 'a2', label: 'Other' },
				]),
				explicit: resolveDraftAccountId('a2', [
					{ id: 'a1', email: 'a@example.com' },
					{ id: 'a2', label: 'Other' },
				]),
				unknown: resolveDraftAccountId('missing', [{ id: 'a1', email: 'a@example.com' }]),
			},
			{
				none: {
					error: 'Error: no email accounts configured. Add an account before creating drafts.',
				},
				one: { accountId: 'a1' },
				many: {
					error: 'Error: accountId is required when multiple accounts exist. Available: a1 (a@example.com), a2 (Other)',
				},
				explicit: { accountId: 'a2' },
				unknown: { error: 'Error: unknown accountId "missing".' },
			},
		);
	});

	test('SAFEAPPEALS_EMAIL_TOOL_NAMES has all 14 tools and no send', () => {
		assert.deepStrictEqual(
			{
				length: SAFEAPPEALS_EMAIL_TOOL_NAMES.length,
				unique: new Set(SAFEAPPEALS_EMAIL_TOOL_NAMES).size,
				hasSend: SAFEAPPEALS_EMAIL_TOOL_NAMES.some(n => /send/i.test(n)),
				membership: {
					search: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_SEARCH_TOOL),
					listThreads: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_LIST_THREADS_TOOL),
					getMessage: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_GET_MESSAGE_TOOL),
					listAccounts: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_LIST_ACCOUNTS_TOOL),
					listFolders: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_LIST_FOLDERS_TOOL),
					listTags: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_LIST_TAGS_TOOL),
					tagThread: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_TAG_THREAD_TOOL),
					untagThread: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_UNTAG_THREAD_TOOL),
					deleteTag: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_DELETE_TAG_TOOL),
					hideThread: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_HIDE_THREAD_TOOL),
					unhideThread: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_UNHIDE_THREAD_TOOL),
					linkThread: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_LINK_THREAD_TO_CASE_TOOL),
					unlinkThread: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_UNLINK_THREAD_FROM_CASE_TOOL),
					createDraft: SAFEAPPEALS_EMAIL_TOOL_NAMES.includes(SAFEAPPEALS_EMAIL_CREATE_DRAFT_TOOL),
				},
			},
			{
				length: 14,
				unique: 14,
				hasSend: false,
				membership: {
					search: true,
					listThreads: true,
					getMessage: true,
					listAccounts: true,
					listFolders: true,
					listTags: true,
					tagThread: true,
					untagThread: true,
					deleteTag: true,
					hideThread: true,
					unhideThread: true,
					linkThread: true,
					unlinkThread: true,
					createDraft: true,
				},
			},
		);
	});

	test('agentTools.ts source never references send paths', async () => {
		// Prefer TypeScript source; fall back to compiled JS when only out/ is present.
		const candidates = [
			path.join(__dirname, '../../src/agentTools.ts'),
			path.join(__dirname, '..', 'agentTools.ts'),
			path.join(__dirname, '..', 'agentTools.js'),
		];
		let source: string | undefined;
		for (const candidate of candidates) {
			try {
				source = await fs.readFile(candidate, 'utf8');
				break;
			} catch {
				// try next
			}
		}
		assert.ok(source, 'agentTools source not found for static no-send assert');
		assert.deepStrictEqual(
			{
				smtpClient: source!.includes('smtpClient'),
				sendMail: source!.includes('sendMail'),
				engineSend: /(?:engine|\.)\.send\b/.test(source!),
				importSend: /from\s+['"].*smtpClient['"]/.test(source!),
			},
			{
				smtpClient: false,
				sendMail: false,
				engineSend: false,
				importSend: false,
			},
		);
	});

	test('truncateBody leaves short text and annotates long text', () => {
		const short = 'hello';
		const long = 'x'.repeat(60_001);
		assert.deepStrictEqual(
			{
				short: truncateBody(short),
				longPrefix: truncateBody(long).startsWith('x'.repeat(60_000)),
				longNotice: truncateBody(long).includes('[truncated:'),
				longLen: truncateBody(long).length > 60_000,
			},
			{
				short: 'hello',
				longPrefix: true,
				longNotice: true,
				longLen: true,
			},
		);
	});

	test('formatMessageForModel truncates bodyText, omits bodyHtml, metadata-only attachments', () => {
		const payloadBytes = Buffer.alloc(2048, 0x41).toString('base64');
		const out = formatMessageForModel(sampleMessage({
			id: 'msg-html',
			bodyText: 'y'.repeat(60_001),
			bodyHtml: `<html><body><p>${'secret-html'.repeat(50)}</p><img src="data:image/png;base64,${payloadBytes}"/></body></html>`,
			attachments: [
				{ filename: 'brief.pdf', contentType: 'application/pdf', size: 12_345 },
				{ filename: 'scan.png', contentType: 'image/png' },
			],
		}));
		assert.deepStrictEqual(
			{
				truncated: out.includes('[truncated:'),
				bodyPrefix: out.includes('bodyText:\n' + 'y'.repeat(60_000)),
				hasBodyHtmlKey: /\bbodyHtml\b/.test(out),
				hasSecretHtml: out.includes('secret-html'),
				hasPayload: out.includes(payloadBytes.slice(0, 32)),
				hasPdfMeta: out.includes('- brief.pdf (application/pdf, 12345 bytes)'),
				hasPngMeta: out.includes('- scan.png (image/png)'),
			},
			{
				truncated: true,
				bodyPrefix: true,
				hasBodyHtmlKey: false,
				hasSecretHtml: false,
				hasPayload: false,
				hasPdfMeta: true,
				hasPngMeta: true,
			},
		);
	});

	test('afterDraftSaved refreshes and optionally opens compose via hooks', async () => {
		const draft: EmailDraft = {
			id: 'd1',
			accountId: 'a1',
			emailId: '',
			to: 'a@example.com',
			subject: 'Hi',
			content: 'Body',
			version: 1,
			status: 'draft',
			createdAt: '2026-08-01T00:00:00.000Z',
			updatedAt: '2026-08-01T00:00:00.000Z',
		};
		const events: string[] = [];
		await afterDraftSaved(draft, { openInCompose: true }, {
			refreshEmailUi: () => { events.push('refresh'); },
			openComposeWithDraft: (d) => { events.push(`open:${d.id}`); },
		});
		await afterDraftSaved(draft, { openInCompose: false }, {
			refreshEmailUi: () => { events.push('refresh2'); },
			openComposeWithDraft: (d) => { events.push(`open2:${d.id}`); },
		});
		assert.deepStrictEqual(events, ['refresh', 'open:d1', 'refresh2']);
	});

	suite('seeded EmailIndex organize/search', () => {
		let tempDir: string;
		let index: EmailIndex;

		suiteSetup(async () => {
			tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-email-agent-'));
		});

		suiteTeardown(async () => {
			await fs.rm(tempDir, { recursive: true, force: true });
		});

		setup(async () => {
			const dir = await fs.mkdtemp(path.join(tempDir, 'idx-'));
			index = new EmailIndex(
				{ fsPath: dir } as vscode.Uri,
				new FakeSecretStorage(),
				new FakeMemento(),
			);
			await index.initialize();
			await index.upsertMessage(sampleMessage({
				id: 'msg-1',
				threadId: 'thread-1',
				subject: 'Appeal deadline reminder',
				from: 'client@example.com',
			}));
			await index.upsertMessage(sampleMessage({
				id: 'msg-2',
				threadId: 'thread-2',
				subject: 'Billing question',
				from: 'billing@example.com',
				date: '2026-08-02T12:00:00.000Z',
				snippet: 'Invoice for March',
				bodyText: 'Please send the invoice for March.',
			}));
		});

		test('search returns matching summaries from seeded index', () => {
			const hits = index.search('deadline');
			assert.deepStrictEqual(
				hits.map(h => ({ id: h.id, subject: h.subject, from: h.from })),
				[{ id: 'msg-1', subject: 'Appeal deadline reminder', from: 'client@example.com' }],
			);
		});

		test('listThreads includes tags/hidden/caseFolderPath after organize ops', async () => {
			await index.tagThread('acct-1', 'thread-1', 'urgent');
			await index.hideThread('acct-1', 'thread-2');
			await index.linkThreadToCase('acct-1', 'thread-1', '/cases/smith');

			const { threads, total } = index.listThreads({ folder: 'INBOX', limit: 20 });
			assert.strictEqual(total, 2);
			const byId = Object.fromEntries(threads.map(t => [t.threadId, t]));
			assert.deepStrictEqual(
				{
					t1: {
						tags: byId['thread-1']?.tags,
						hidden: !!byId['thread-1']?.hidden,
						caseFolderPath: byId['thread-1']?.caseFolderPath,
					},
					t2: {
						tags: byId['thread-2']?.tags,
						hidden: !!byId['thread-2']?.hidden,
						caseFolderPath: byId['thread-2']?.caseFolderPath,
					},
					order: threads.map(t => t.threadId),
					tagFilter: index.listThreads({ folder: 'INBOX', tag: 'urgent' }).threads.map(t => t.threadId),
					caseFilter: index.listThreads({
						folder: 'INBOX',
						caseFolderPath: '/cases/smith',
					}).threads.map(t => t.threadId),
					tags: index.listTags(),
				},
				{
					t1: { tags: ['urgent'], hidden: false, caseFolderPath: '/cases/smith' },
					t2: { tags: undefined, hidden: true, caseFolderPath: undefined },
					// hidden sinks to bottom
					order: ['thread-1', 'thread-2'],
					tagFilter: ['thread-1'],
					caseFilter: ['thread-1'],
					tags: [{ name: 'urgent', count: 1 }],
				},
			);
		});

		test('case-link memory rolls back when encrypted persistence fails', async () => {
			const dir = await fs.mkdtemp(path.join(tempDir, 'atomic-link-'));
			let fail = false;
			const atomicIndex = new EmailIndex(
				{ fsPath: dir } as vscode.Uri, new FakeSecretStorage(), new FakeMemento(), undefined,
				async () => { if (fail) throw new Error('disk failure'); },
			);
			await atomicIndex.initialize();
			await atomicIndex.linkThreadToCase('account', 'thread', '/case');
			fail = true;
			await assert.rejects(atomicIndex.linkThreadToCase('account', 'thread', '/other'), /disk failure/);
			assert.strictEqual(atomicIndex.getThreadCase('account', 'thread'), '/case');
			await assert.rejects(atomicIndex.unlinkThread('account', 'thread'), /disk failure/);
			assert.strictEqual(atomicIndex.getThreadCase('account', 'thread'), '/case');
		});

		test('tag/untag/hide/unhide/link/unlink/deleteTag mutate index without dropping messages', async () => {
			await index.tagThread('acct-1', 'thread-1', 'review');
			await index.tagThread('acct-1', 'thread-2', 'review');
			await index.untagThread('acct-1', 'thread-2', 'review');
			await index.hideThread('acct-1', 'thread-1');
			await index.unhideThread('acct-1', 'thread-1');
			await index.linkThreadToCase('acct-1', 'thread-2', '/cases/jones');
			await index.unlinkThread('acct-1', 'thread-2');
			await index.deleteTag('review');

			assert.deepStrictEqual(
				{
					msgCount: index.getStats().totalEmails,
					tags: index.listTags(),
					t1tags: index.getThreadTags('acct-1', 'thread-1'),
					t2tags: index.getThreadTags('acct-1', 'thread-2'),
					t1hidden: index.isThreadHidden('acct-1', 'thread-1'),
					t2case: index.getThreadCase('acct-1', 'thread-2'),
				},
				{
					msgCount: 2,
					tags: [],
					t1tags: [],
					t2tags: [],
					t1hidden: false,
					t2case: undefined,
				},
			);
		});

		test('same thread ID in two accounts keeps metadata isolated', async () => {
			await index.upsertMessage(sampleMessage({ id: 'other-message', accountId: 'acct-2', threadId: 'thread-1' }));
			await index.tagThread('acct-1', 'thread-1', 'first');
			await index.tagThread('acct-2', 'thread-1', 'second');
			await index.hideThread('acct-1', 'thread-1');
			await index.linkThreadToCase('acct-2', 'thread-1', '/cases/two');

			assert.deepStrictEqual({
				first: index.getThread('acct-1', 'thread-1'),
				second: index.getThread('acct-2', 'thread-1'),
			}, {
				first: { ...index.getThread('acct-1', 'thread-1'), tags: ['first'], hidden: true, caseFolderPath: undefined },
				second: { ...index.getThread('acct-2', 'thread-1'), tags: ['second'], hidden: false, caseFolderPath: '/cases/two' },
			});
			await index.clearAccount('acct-1');
			assert.strictEqual(index.getThread('acct-2', 'thread-1')?.caseFolderPath, '/cases/two');
		});

		test('clearAccount removes stale account metadata without messages', async () => {
			await index.updateThreadStatus('stale-account', 'orphan', 'resolved');
			await index.linkThreadToCase('stale-account', 'orphan', '/stale');
			await index.tagThread('stale-account', 'orphan', 'stale-tag');
			await index.hideThread('stale-account', 'orphan');
			await index.setRagManifestEntry('stale-account', 'orphan', {
				accountId: 'stale-account', caseFolderPath: '/stale', docIds: ['doc'], retryDocIds: [],
			});
			await index.clearAccount('stale-account');
			assert.deepStrictEqual({
				casePath: index.getThreadCase('stale-account', 'orphan'),
				tags: index.getThreadTags('stale-account', 'orphan'),
				hidden: index.isThreadHidden('stale-account', 'orphan'),
				manifest: index.getRagManifestEntry('stale-account', 'orphan'),
				knownTags: index.listTags(),
			}, { casePath: undefined, tags: [], hidden: false, manifest: undefined, knownTags: [] });
		});

		test('legacy migration preserves qualified state and merges RAG purge IDs', async () => {
			const dir = await fs.mkdtemp(path.join(tempDir, 'legacy-collision-'));
			const secrets = new FakeSecretStorage();
			const memento = new FakeMemento();
			const initial = new EmailIndex({ fsPath: dir } as vscode.Uri, secrets, memento);
			await initial.initialize();
			const encodedDek = await secrets.get('safeappeals-email.dek.emailIndex');
			assert.ok(encodedDek);
			const dek = Buffer.from(encodedDek, 'base64');
			await writeEncryptedJson(path.join(dir, 'email-index.json'), {
				version: '1.0', messages: [sampleMessage({ accountId: 'acct-1', threadId: 'shared' })],
				threadStatus: { shared: 'resolved', ['acct-1\0shared']: 'active' },
			}, dek);
			await writeEncryptedJson(path.join(dir, 'email-case-links.json'), {
				version: '1.0', links: { shared: '/legacy', ['acct-1\0shared']: '/qualified' },
			}, dek);
			await writeEncryptedJson(path.join(dir, 'email-rag-manifest.json'), {
				version: '1.0', threads: {
					shared: { accountId: 'acct-1', caseFolderPath: '/legacy', docIds: ['legacy-doc'], retryDocIds: ['legacy-retry'] },
					['acct-1\0shared']: { accountId: 'acct-1', caseFolderPath: '/qualified', docIds: ['qualified-doc'], retryDocIds: [] },
				},
			}, dek);
			const migrated = new EmailIndex({ fsPath: dir } as vscode.Uri, secrets, memento);
			await migrated.initialize();
			const storedIndex = await loadJson<{ threadStatus: Record<string, string> }>(path.join(dir, 'email-index.json'), dek);
			assert.deepStrictEqual({
				casePath: migrated.getThreadCase('acct-1', 'shared'),
				status: storedIndex.value?.threadStatus,
				manifest: migrated.getRagManifestEntry('acct-1', 'shared'),
			}, {
				casePath: '/qualified',
				status: { ['acct-1\0shared']: 'active' },
				manifest: {
					accountId: 'acct-1', caseFolderPath: '/qualified',
					docIds: ['qualified-doc', 'legacy-doc'], retryDocIds: ['legacy-retry'],
				},
			});
		});
	});
});

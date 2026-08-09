/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'node:assert';
import { indexThenCommitLink, purgeManifestEntries, purgeThenCommitUnlink, runRetryableEmailIndexing, runRetryableEmailIndexingTasks, type EmailRagIndexer } from '../emailRagCommands';

interface TestMessage { id: string }

suite('email RAG command transactions', () => {
	test('index failure never commits a visible link', async () => {
		let linked = false;
		const indexer: EmailRagIndexer<TestMessage> = {
			indexThread: async () => { throw new Error('index failed'); },
			unindexThread: async () => undefined,
		};
		await assert.rejects(indexThenCommitLink({
			indexer, accountId: 'account', threadId: 'thread', messages: [{ id: 'message' }], caseFolderPath: '/case',
			commitLink: async () => { linked = true; },
		}), /index failed/);
		assert.strictEqual(linked, false);
	});

	test('link commit failure rolls back indexed documents', async () => {
		const events: string[] = [];
		const indexer: EmailRagIndexer<TestMessage> = {
			indexThread: async () => { events.push('index'); },
			unindexThread: async () => { events.push('purge'); },
		};
		await assert.rejects(indexThenCommitLink({
			indexer, accountId: 'account', threadId: 'thread', messages: [{ id: 'message' }], caseFolderPath: '/case',
			commitLink: async () => { throw new Error('link write failed'); },
		}));
		assert.deepStrictEqual(events, ['index', 'purge']);
	});

	test('unavailable indexer retains the link', async () => {
		let unlinked = false;
		await assert.rejects(purgeThenCommitUnlink<TestMessage>({
			indexer: undefined, unavailableError: new Error('unavailable'), accountId: 'account', threadId: 'thread',
			messages: [{ id: 'message' }], caseFolderPath: '/case',
			commitUnlink: async () => { unlinked = true; },
		}), /unavailable/);
		assert.strictEqual(unlinked, false);
	});

	test('unlink persistence failure restores indexed search state', async () => {
		const events: string[] = [];
		const indexer: EmailRagIndexer<TestMessage> = {
			indexThread: async () => { events.push('restore-index'); },
			unindexThread: async () => { events.push('purge'); },
		};
		await assert.rejects(purgeThenCommitUnlink({
			indexer, unavailableError: new Error('unavailable'), accountId: 'account', threadId: 'thread',
			messages: [{ id: 'message' }], caseFolderPath: '/case',
			commitUnlink: async () => { throw new Error('disk failure'); },
		}), /disk failure/);
		assert.deepStrictEqual(events, ['purge', 'restore-index']);
	});

	test('cache/account purge fails closed when the indexer is unavailable', async () => {
		await assert.rejects(purgeManifestEntries<TestMessage>(
			undefined, [['account', 'thread', { caseFolderPath: '/case' }]], new Error('private search unavailable'),
		), /unavailable/);
	});

	test('indexing failure is isolated after mailbox sync success', async () => {
		const retries: string[] = [];
		await runRetryableEmailIndexing(async () => { throw new Error('rag busy'); }, message => retries.push(message));
		assert.deepStrictEqual(retries, ['rag busy']);
	});

	test('a malformed thread does not starve later sync reindex tasks', async () => {
		const events: string[] = [];
		await runRetryableEmailIndexingTasks([
			['bad', async () => { events.push('bad'); throw new Error('malformed'); }],
			['good', async () => { events.push('good'); }],
		], (threadId, message) => events.push(`${threadId}:${message}`));
		assert.deepStrictEqual(events, ['bad', 'bad:malformed', 'good']);
	});
});

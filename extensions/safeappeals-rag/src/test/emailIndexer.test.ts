/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'node:assert';
import { createHash } from 'node:crypto';
import { EmailIndexer, mapLinkedEmailThreads, type EmailExtensionApi, type EmailMessage, type EmailRagManifestEntry } from '../emailIndexer';

function message(id: string): EmailMessage {
	return {
		id, accountId: 'account', threadId: 'thread', subject: 'Subject', from: 'from@example.com',
		to: 'to@example.com', cc: undefined, date: '2026-01-01T00:00:00Z', bodyText: `Body ${id}`,
		bodyLoaded: true, snippet: undefined, category: undefined, priority: undefined,
	};
}

function harness(options: { durable?: boolean; existing?: EmailRagManifestEntry; failIndexAt?: number; throwIndexAt?: number; postCommitThrowAt?: number; failManifestSetAt?: number; failRemove?: ReadonlySet<string>; failAllRemoves?: boolean } = {}) {
	let manifest = options.existing;
	let indexCalls = 0;
	let manifestSetCalls = 0;
	const removed: string[] = [];
	const committed = new Set<string>();
	const api: EmailExtensionApi = {
		getEmailIndex: () => ({
			getMessage: () => undefined,
			isDurableStorageReady: () => options.durable ?? true,
			getRagManifestEntry: () => manifest,
			setRagManifestEntry: async (_accountId, _threadId, entry) => {
				manifest = entry;
				manifestSetCalls += 1;
				if (manifestSetCalls === options.failManifestSetAt) throw new Error('manifest persistence failed');
			},
		}),
		getEmailMessage: async id => message(id),
	};
	const indexer = new EmailIndexer({
		indexPipeline: {
			indexFile: async request => {
				indexCalls += 1;
				if (indexCalls === options.postCommitThrowAt) {
					committed.add(createHash('sha256').update(request.sourceUri).digest('hex').slice(0, 32));
					throw new Error('index threw after commit');
				}
				if (indexCalls === options.throwIndexAt) {
					throw new Error('index threw');
				}
				if (indexCalls === options.failIndexAt) {
					return { kind: 'hard-disable', code: 'extract-failed', message: 'failed', reasons: ['failed'] };
				}
				return { kind: 'ok', docId: `new-${indexCalls}`, chunkCount: 1, scope: 'case_index' };
			},
		},
		ragCoreHost: {
			getDocument: () => undefined,
			removeDoc: docId => {
				removed.push(docId);
				if (options.failAllRemoves || options.failRemove?.has(docId)) return { ok: false, error: 'busy' };
				committed.delete(docId);
				return { ok: true };
			},
		},
		resolveEmailApi: () => api,
	});
	return { indexer, removed, committed, manifest: () => manifest };
}

suite('EmailIndexer security transactions', () => {
	test('refuses persistent indexing without a durable encrypted manifest', async () => {
		const { indexer, removed } = harness({ durable: false });
		await assert.rejects(indexer.reindexThread('account', 'thread', [message('one')], '/case'), /durable|manifest/i);
		assert.deepStrictEqual(removed, []);
	});

	test('rolls back staged documents when a later replacement fails', async () => {
		const { indexer, removed, manifest } = harness({ failIndexAt: 2 });
		await assert.rejects(indexer.reindexThread('account', 'thread', [message('one'), message('two')], '/case'));
		assert.deepStrictEqual({ removedCount: removed.length, manifest: manifest() }, { removedCount: 2, manifest: undefined });
	});

	test('persists stale removal failures as retry IDs', async () => {
		const existing = { accountId: 'account', caseFolderPath: '/case', docIds: ['old'], retryDocIds: [] };
		const { indexer, manifest } = harness({ existing, failRemove: new Set(['old']) });
		await indexer.reindexThread('account', 'thread', [message('one')], '/case');
		assert.deepStrictEqual(manifest(), {
			accountId: 'account', caseFolderPath: '/case', docIds: ['new-1'], retryDocIds: ['old'],
		});
	});

	test('a restarted indexer purges current and retry manifest IDs', async () => {
		const existing = { accountId: 'account', caseFolderPath: '/case', docIds: ['current'], retryDocIds: ['stale'] };
		const { indexer, removed, manifest } = harness({ existing });
		await indexer.unindexThread('account', 'thread', [], '/case');
		assert.deepStrictEqual({ removed, manifest: manifest() }, {
			removed: ['current', 'stale'], manifest: undefined,
		});
	});

	test('a thrown later index call rolls back every completed staged document', async () => {
		const { indexer, removed } = harness({ throwIndexAt: 2 });
		await assert.rejects(indexer.reindexThread('account', 'thread', [message('one'), message('two')], '/case'), /index threw/);
		assert.strictEqual(removed.length, 2);
	});

	test('post-commit throw durably tracks both staged documents for restart purge', async () => {
		const first = harness({ postCommitThrowAt: 2, failAllRemoves: true });
		await assert.rejects(first.indexer.reindexThread('account', 'thread', [message('one'), message('two')], '/case'), /after commit/);
		assert.strictEqual(first.manifest()?.retryDocIds.length, 2);
		const restarted = harness({ existing: first.manifest() });
		await restarted.indexer.unindexThread('account', 'thread', [], '/case');
		assert.deepStrictEqual(new Set(restarted.removed), new Set(first.manifest()?.retryDocIds));
	});

	test('manifest persistence mutation is explicitly rolled back to no prior entry', async () => {
		const { indexer, manifest } = harness({ failManifestSetAt: 1 });
		await assert.rejects(indexer.reindexThread('account', 'thread', [message('one')], '/case'), /manifest persistence failed/);
		assert.strictEqual(manifest(), undefined);
	});

	test('retroactive thread mapping preserves account collisions independently', () => {
		const threads = [
			{ accountId: 'one', threadId: 'shared', caseFolderPath: '/one', messages: [{ id: '1' }] },
			{ accountId: 'two', threadId: 'shared', caseFolderPath: '/two', messages: [{ id: '2' }] },
		];
		assert.deepStrictEqual([...mapLinkedEmailThreads(threads).keys()], ['one\0shared', 'two\0shared']);
	});

	test('failed rollback is durable and a restarted indexer purges it', async () => {
		const first = harness({ throwIndexAt: 2, failRemove: new Set(['new-1']) });
		await assert.rejects(first.indexer.reindexThread('account', 'thread', [message('one'), message('two')], '/case'));
		assert.deepStrictEqual(first.manifest(), {
			accountId: 'account', caseFolderPath: '/case', docIds: [], retryDocIds: ['new-1'],
		});
		const restarted = harness({ existing: first.manifest() });
		await restarted.indexer.unindexThread('account', 'thread', [], '/case');
		assert.deepStrictEqual(restarted.removed, ['new-1']);
	});

	test('same thread ID in two accounts has isolated document state', async () => {
		const manifests = new Map<string, EmailRagManifestEntry>();
		let sequence = 0;
		const removed: string[] = [];
		const indexer = new EmailIndexer({
			indexPipeline: { indexFile: async () => ({ kind: 'ok', docId: `doc-${++sequence}`, chunkCount: 1, scope: 'case_index' }) },
			ragCoreHost: {
				getDocument: () => undefined,
				removeDoc: docId => { removed.push(docId); return { ok: true }; },
			},
			resolveEmailApi: () => ({
				getEmailMessage: async id => message(id),
				getEmailIndex: () => ({
					getMessage: () => undefined,
					isDurableStorageReady: () => true,
					getRagManifestEntry: (accountId, threadId) => manifests.get(`${accountId}\0${threadId}`),
					setRagManifestEntry: async (accountId, threadId, entry) => {
						const key = `${accountId}\0${threadId}`;
						if (entry) manifests.set(key, entry); else manifests.delete(key);
					},
				}),
			}),
		});
		await indexer.reindexThread('account-a', 'shared', [{ ...message('one'), accountId: 'account-a', threadId: 'shared' }], '/case');
		await indexer.reindexThread('account-b', 'shared', [{ ...message('two'), accountId: 'account-b', threadId: 'shared' }], '/case');
		await indexer.unindexThread('account-a', 'shared', [], '/case');
		assert.deepStrictEqual({
			removed,
			accountA: indexer.getThreadDocIds('account-a', 'shared'),
			accountB: indexer.getThreadDocIds('account-b', 'shared'),
		}, { removed: ['doc-1'], accountA: [], accountB: ['doc-2'] });
	});
});

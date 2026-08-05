/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { IndexPipeline, scopeFromSourcePath } from '../indexPipeline';
import { IngestRouter } from '../ingestRouter';
import { fakeMlBridge } from '../mlBridge';
import type {
	RagChunkDocumentInput,
	RagCoreHost,
	RagIndexChunkInput,
	RagIndexDocumentInput,
	RagOpResult,
} from '../ragCoreHost';

function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

interface FakeHost extends Pick<RagCoreHost, 'assertIndexingAllowed' | 'chunkDocument' | 'indexChunks'> {
	readonly lastDoc: RagIndexDocumentInput | undefined;
	readonly lastChunks: RagIndexChunkInput[] | undefined;
}

function createFakeHost(options: {
	readonly disable?: { code: 'models-missing' | 'native-missing'; message: string };
	readonly indexOk?: boolean;
}): FakeHost {
	const state: {
		lastDoc: RagIndexDocumentInput | undefined;
		lastChunks: RagIndexChunkInput[] | undefined;
	} = { lastDoc: undefined, lastChunks: undefined };

	return {
		get lastDoc() {
			return state.lastDoc;
		},
		get lastChunks() {
			return state.lastChunks;
		},
		assertIndexingAllowed: () => {
			if (options.disable) {
				return { ok: false, code: options.disable.code, message: options.disable.message };
			}
			return { ok: true };
		},
		chunkDocument: (input: RagChunkDocumentInput) => [
			{
				chunkId: `${input.docId}:0`,
				docId: input.docId,
				text: input.text.slice(0, 80),
				chunkIndex: 0,
				tokenCount: 10,
				chunkType: 'parent',
				sourceUri: input.sourceUri,
			},
		],
		indexChunks: (doc, chunks): RagOpResult => {
			state.lastDoc = doc;
			state.lastChunks = chunks;
			if (options.indexOk === false) {
				return { ok: false, error: 'ModelMissing' };
			}
			return { ok: true, count: chunks.length };
		},
	};
}

suite('indexPipeline', () => {
	test('scopeFromSourcePath maps core_references vs rest of workspace', () => {
		assert.strictEqual(
			scopeFromSourcePath('/case/core_references/regs.md', ['/case']),
			'core_reference',
		);
		assert.strictEqual(
			scopeFromSourcePath('/case/pleadings/brief.md', ['/case']),
			'case_index',
		);
		assert.strictEqual(
			scopeFromSourcePath('/case/notes.md', ['/case']),
			'case_index',
		);
	});

	test('PathGuard rejects outside workspace', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({});
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
		});
		const result = await pipeline.indexFile({
			sourceUri: 'file:///etc/passwd',
			bytes: utf8('secret'),
			scope: 'case_index',
		});
		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.strictEqual(result.code, 'path-outside-workspace');
		}
	});

	test('indexes txt/md via ingest → chunk → indexChunks', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({});
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
		});
		const body = '# Notes\nmedical treatment';
		const result = await pipeline.indexFile({
			sourceUri: 'file:///case/notes.md',
			bytes: utf8(body),
			scope: 'case_index',
		});
		assert.strictEqual(result.kind, 'ok');
		if (result.kind === 'ok') {
			assert.deepStrictEqual(
				{ chunkCount: result.chunkCount, scope: result.scope },
				{ chunkCount: 1, scope: 'case_index' },
			);
		}
		assert.strictEqual(host.lastDoc?.scope, 'case_index');
		assert.strictEqual(host.lastDoc?.isCoreReference, false);
		assert.strictEqual(host.lastDoc?.filename, 'notes.md');
	});

	test('core_reference scope sets isCoreReference', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({});
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
		});
		const result = await pipeline.indexFile({
			sourceUri: 'file:///case/core_references/cfr.md',
			bytes: utf8('38 CFR 3.100'),
			scope: 'core_reference',
		});
		assert.strictEqual(result.kind, 'ok');
		assert.strictEqual(host.lastDoc?.isCoreReference, true);
		assert.strictEqual(host.lastDoc?.scope, 'core_reference');
	});

	test('host gate blocks indexing when models-missing', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({
			disable: { code: 'models-missing', message: 'models missing' },
		});
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
		});
		const result = await pipeline.indexFile({
			sourceUri: 'file:///case/a.txt',
			bytes: utf8('hello'),
			scope: 'case_index',
		});
		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.strictEqual(result.code, 'models-missing');
		}
	});
});

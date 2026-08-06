/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { createHash } from 'node:crypto';
import { IndexPipeline, docIdForSourceUri, isIndexableSourcePath, scopeFromSourcePath } from '../indexPipeline';
import { FakeDigitalPdfExtractor } from '../digitalPdfExtract';
import { IngestRouter } from '../ingestRouter';
import { fakeMlBridge } from '../mlBridge';
import type {
	RagChunkDocumentInput,
	RagCoreHost,
	RagIndexChunkInput,
	RagIndexDocumentInput,
	RagOpResult,
} from '../ragCoreHost';
import { SCANNED_CHARS_PER_PAGE_THRESHOLD, type HardDisableCode } from '../types';

function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

function passthroughLease(): <T>(fn: () => Promise<T>) => Promise<T> {
	return async fn => fn();
}

interface FakeHost extends Pick<RagCoreHost, 'assertIndexingAllowed' | 'chunkDocument' | 'indexChunks' | 'getDocument'> {
	readonly lastDoc: RagIndexDocumentInput | undefined;
	readonly lastChunks: RagIndexChunkInput[] | undefined;
	readonly indexChunksCalls: number;
}

function createFakeHost(options: {
	readonly disable?: { code: HardDisableCode; message: string };
	readonly indexOk?: boolean;
	readonly existingDoc?: RagIndexDocumentInput;
}): FakeHost {
	const state: {
		lastDoc: RagIndexDocumentInput | undefined;
		lastChunks: RagIndexChunkInput[] | undefined;
		indexChunksCalls: number;
	} = { lastDoc: undefined, lastChunks: undefined, indexChunksCalls: 0 };

	return {
		get lastDoc() {
			return state.lastDoc;
		},
		get lastChunks() {
			return state.lastChunks;
		},
		get indexChunksCalls() {
			return state.indexChunksCalls;
		},
		assertIndexingAllowed: () => {
			if (options.disable) {
				return { ok: false, code: options.disable.code, message: options.disable.message };
			}
			return { ok: true };
		},
		getDocument: (docId: string) => {
			if (options.existingDoc?.id === docId) {
				return options.existingDoc;
			}
			return undefined;
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
			state.indexChunksCalls += 1;
			state.lastDoc = doc;
			state.lastChunks = chunks;
			if (options.indexOk === false) {
				return { ok: false, error: 'ModelMissing' };
			}
			return { ok: true, count: chunks.length };
		},
	};
}

function checksumOf(bytes: Uint8Array): string {
	return createHash('sha256').update(bytes).digest('hex');
}

suite('indexPipeline', () => {
	test('isIndexableSourcePath accepts txt/md/pdf and rejects other extensions', () => {
		assert.strictEqual(isIndexableSourcePath('/case/notes.md'), true);
		assert.strictEqual(isIndexableSourcePath('/case/brief.pdf'), true);
		assert.strictEqual(isIndexableSourcePath('/case/image.png'), false);
	});

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
			withEmbeddingLease: passthroughLease(),
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

	test('indexes born-digital PDF via ingest → chunk → indexChunks', async () => {
		const pageText = 'w'.repeat(SCANNED_CHARS_PER_PAGE_THRESHOLD + 10);
		const ml = fakeMlBridge({});
		const host = createFakeHost({});
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({
				...ml,
				digitalPdf: new FakeDigitalPdfExtractor({
					kind: 'ok',
					pages: [{ text: pageText }],
				}),
			}),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: passthroughLease(),
		});
		const pdfBytes = utf8('%PDF-fake');
		const result = await pipeline.indexFile({
			sourceUri: 'file:///case/pleadings/brief.pdf',
			bytes: pdfBytes,
			scope: 'case_index',
		});
		assert.strictEqual(result.kind, 'ok');
		if (result.kind === 'ok') {
			assert.deepStrictEqual(
				{ chunkCount: result.chunkCount, scope: result.scope },
				{ chunkCount: 1, scope: 'case_index' },
			);
		}
		assert.strictEqual(host.lastDoc?.filename, 'brief.pdf');
		assert.strictEqual(host.lastDoc?.filetype, 'pdf');
	});

	test('skips unsupported extension on disk path without bytes', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({});
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: passthroughLease(),
		});
		const result = await pipeline.indexPath('/case/scan.docx');
		assert.deepStrictEqual(result, {
			kind: 'skipped',
			reason: 'Extension .docx is not in the indexable source set (txt, md, pdf)',
		});
		assert.strictEqual(host.indexChunksCalls, 0);
	});

	test('skips unchanged PDF when checksum matches', async () => {
		const ml = fakeMlBridge({});
		const pdfBytes = utf8('%PDF-unchanged');
		const sourceUri = 'file:///case/brief.pdf';
		const docId = docIdForSourceUri(sourceUri);
		const host = createFakeHost({
			existingDoc: {
				id: docId,
				path: '/case/brief.pdf',
				filename: 'brief.pdf',
				filetype: 'pdf',
				filesize: pdfBytes.byteLength,
				checksum: checksumOf(pdfBytes),
				scope: 'case_index',
				isCoreReference: false,
				createdAt: '2020-01-01T00:00:00.000Z',
				lastIndexedAt: '2020-01-01T00:00:00.000Z',
			},
		});
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: passthroughLease(),
		});
		const result = await pipeline.indexFile({
			sourceUri,
			bytes: pdfBytes,
			scope: 'case_index',
		});
		assert.deepStrictEqual(result, {
			kind: 'skipped',
			reason: 'Document already indexed (unchanged)',
		});
		assert.strictEqual(host.indexChunksCalls, 0);
	});

	test('indexes txt/md via ingest → chunk → indexChunks', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({});
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: passthroughLease(),
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
			withEmbeddingLease: passthroughLease(),
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
		const transitions: Array<{ indexing: boolean; inFlight: number }> = [];
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: passthroughLease(),
			onIndexingChanged: (indexing, inFlight) => {
				transitions.push({ indexing, inFlight });
			},
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
		assert.strictEqual(transitions.length, 0);
		assert.strictEqual(pipeline.isIndexing(), false);
		assert.strictEqual(pipeline.getInFlightCount(), 0);
	});

	test('read-only-session gate does not notify onIndexingChanged', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({
			disable: { code: 'read-only-session', message: 'read-only session' },
		});
		const transitions: Array<{ indexing: boolean; inFlight: number }> = [];
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: passthroughLease(),
			onIndexingChanged: (indexing, inFlight) => {
				transitions.push({ indexing, inFlight });
			},
		});
		const result = await pipeline.indexFile({
			sourceUri: 'file:///case/a.txt',
			bytes: utf8('hello'),
			scope: 'case_index',
		});
		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.strictEqual(result.code, 'read-only-session');
		}
		assert.strictEqual(transitions.length, 0);
		assert.strictEqual(pipeline.isIndexing(), false);
		assert.strictEqual(pipeline.getInFlightCount(), 0);
	});

	test('indexChunks runs inside withEmbeddingLease wrapper', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({});
		let leaseWrapped = false;
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: async fn => {
				leaseWrapped = true;
				return fn();
			},
		});
		const result = await pipeline.indexFile({
			sourceUri: 'file:///case/notes.md',
			bytes: utf8('# Notes'),
			scope: 'case_index',
		});
		assert.strictEqual(result.kind, 'ok');
		assert.strictEqual(leaseWrapped, true);
	});

	test('index fails closed when embedding lease unavailable', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({});
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
		});
		const result = await pipeline.indexFile({
			sourceUri: 'file:///case/notes.md',
			bytes: utf8('# Notes'),
			scope: 'case_index',
		});
		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.strictEqual(result.code, 'models-missing');
			assert.ok(result.reasons[0]?.includes('lease unavailable'));
		}
	});

	test('in-flight counter notifies onIndexingChanged and returns to idle', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({});
		const transitions: Array<{ indexing: boolean; inFlight: number }> = [];
		const results: string[] = [];
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			onIndexingChanged: (indexing, inFlight) => {
				transitions.push({ indexing, inFlight });
			},
			onIndexResult: result => {
				results.push(result.kind);
			},
			withEmbeddingLease: passthroughLease(),
		});
		assert.strictEqual(pipeline.isIndexing(), false);
		const result = await pipeline.indexFile({
			sourceUri: 'file:///case/notes.md',
			bytes: utf8('# Notes'),
			scope: 'case_index',
		});
		assert.strictEqual(result.kind, 'ok');
		assert.strictEqual(pipeline.isIndexing(), false);
		assert.strictEqual(pipeline.getInFlightCount(), 0);
		assert.deepStrictEqual(results, ['ok']);
		assert.ok(transitions.some(t => t.indexing && t.inFlight === 1));
		assert.deepStrictEqual(transitions[transitions.length - 1], {
			indexing: false,
			inFlight: 0,
		});
	});

	test('skips unchanged document when checksum matches', async () => {
		const ml = fakeMlBridge({});
		const body = '# Notes\nmedical treatment';
		const bytes = utf8(body);
		const sourceUri = 'file:///case/notes.md';
		const docId = docIdForSourceUri(sourceUri);
		const host = createFakeHost({
			existingDoc: {
				id: docId,
				path: '/case/notes.md',
				filename: 'notes.md',
				filetype: 'md',
				filesize: bytes.byteLength,
				checksum: checksumOf(bytes),
				scope: 'case_index',
				isCoreReference: false,
				createdAt: '2020-01-01T00:00:00.000Z',
				lastIndexedAt: '2020-01-01T00:00:00.000Z',
			},
		});
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: passthroughLease(),
		});
		const result = await pipeline.indexFile({
			sourceUri,
			bytes,
			scope: 'case_index',
		});
		assert.deepStrictEqual(result, {
			kind: 'skipped',
			reason: 'Document already indexed (unchanged)',
		});
		assert.strictEqual(host.indexChunksCalls, 0);
	});

	test('re-indexes when bytes change', async () => {
		const ml = fakeMlBridge({});
		const sourceUri = 'file:///case/notes.md';
		const docId = docIdForSourceUri(sourceUri);
		const oldBytes = utf8('# Old');
		const newBytes = utf8('# New content');
		const host = createFakeHost({
			existingDoc: {
				id: docId,
				path: '/case/notes.md',
				filename: 'notes.md',
				filetype: 'md',
				filesize: oldBytes.byteLength,
				checksum: checksumOf(oldBytes),
				scope: 'case_index',
				isCoreReference: false,
				createdAt: '2020-01-01T00:00:00.000Z',
				lastIndexedAt: '2020-01-01T00:00:00.000Z',
			},
		});
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: passthroughLease(),
		});
		const result = await pipeline.indexFile({
			sourceUri,
			bytes: newBytes,
			scope: 'case_index',
		});
		assert.strictEqual(result.kind, 'ok');
		assert.strictEqual(host.indexChunksCalls, 1);
		assert.strictEqual(host.lastDoc?.checksum, checksumOf(newBytes));
	});

	test('checksum skip does not notify onIndexingChanged', async () => {
		const ml = fakeMlBridge({});
		const body = '# Notes\nmedical treatment';
		const bytes = utf8(body);
		const sourceUri = 'file:///case/notes.md';
		const docId = docIdForSourceUri(sourceUri);
		const host = createFakeHost({
			existingDoc: {
				id: docId,
				path: '/case/notes.md',
				filename: 'notes.md',
				filetype: 'md',
				filesize: bytes.byteLength,
				checksum: checksumOf(bytes),
				scope: 'case_index',
				isCoreReference: false,
				createdAt: '2020-01-01T00:00:00.000Z',
				lastIndexedAt: '2020-01-01T00:00:00.000Z',
			},
		});
		const transitions: Array<{ indexing: boolean; inFlight: number }> = [];
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: passthroughLease(),
			onIndexingChanged: (indexing, inFlight) => {
				transitions.push({ indexing, inFlight });
			},
		});
		const result = await pipeline.indexFile({
			sourceUri,
			bytes,
			scope: 'case_index',
		});
		assert.deepStrictEqual(result, {
			kind: 'skipped',
			reason: 'Document already indexed (unchanged)',
		});
		assert.strictEqual(transitions.length, 0);
		assert.strictEqual(pipeline.isIndexing(), false);
		assert.strictEqual(pipeline.getInFlightCount(), 0);
	});

	test('extension skip does not notify onIndexingChanged', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({});
		const transitions: Array<{ indexing: boolean; inFlight: number }> = [];
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: passthroughLease(),
			onIndexingChanged: (indexing, inFlight) => {
				transitions.push({ indexing, inFlight });
			},
		});
		const result = await pipeline.indexPath('/case/scan.docx');
		assert.strictEqual(result.kind, 'skipped');
		assert.strictEqual(transitions.length, 0);
		assert.strictEqual(pipeline.isIndexing(), false);
	});

	test('path guard hard-disable does not notify onIndexingChanged', async () => {
		const ml = fakeMlBridge({});
		const host = createFakeHost({});
		const transitions: Array<{ indexing: boolean; inFlight: number }> = [];
		const pipeline = new IndexPipeline({
			ingest: new IngestRouter({ ...ml }),
			host,
			getWorkspaceRoots: () => ['/case'],
			withEmbeddingLease: passthroughLease(),
			onIndexingChanged: (indexing, inFlight) => {
				transitions.push({ indexing, inFlight });
			},
		});
		const result = await pipeline.indexFile({
			sourceUri: 'file:///etc/passwd',
			bytes: utf8('secret'),
			scope: 'case_index',
		});
		assert.strictEqual(result.kind, 'hard-disable');
		assert.strictEqual(transitions.length, 0);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	formatIngestSummaryDetail,
	formatIngestSummaryLines,
	formatIngestSummaryPrimaryMessage,
} from '../ingestStatusSummary';

suite('ingestStatusSummary', () => {
	test('formatIngestSummaryLines covers ready primary session', () => {
		const lines = formatIngestSummaryLines({
			available: true,
			disableCode: undefined,
			disableMessage: undefined,
			indexWriteRole: 'primary',
			indexWriteCapable: true,
			indexing: false,
			inFlight: 0,
			stats: { documents: 12, chunks: 40, vectors: 40, textDocs: 12 },
			docParseReady: true,
			modelsPresent: true,
		});
		assert.ok(lines.some(l => l.includes('Primary window')));
		assert.ok(lines.some(l => l.includes('index + search')));
		assert.ok(lines.some(l => l.includes('Indexing: idle')));
		assert.ok(lines.some(l => l.includes('12 docs')));
		assert.ok(lines.some(l => l.includes('DocParse (scanned PDF): ready')));
		assert.ok(lines.some(l => l.includes('Status: ready for on-device search')));
	});

	test('formatIngestSummaryLines covers indexing in progress', () => {
		const lines = formatIngestSummaryLines({
			available: true,
			disableCode: undefined,
			disableMessage: undefined,
			indexWriteRole: 'primary',
			indexWriteCapable: true,
			indexing: true,
			inFlight: 3,
			stats: { documents: 1, chunks: 2, vectors: 2, textDocs: 1 },
			docParseReady: false,
			modelsPresent: true,
		});
		assert.ok(lines.some(l => l.includes('Indexing: in progress (3 files)')));
		assert.ok(lines.some(l => l.includes('DocParse (scanned PDF): not ready')));
	});

	test('formatIngestSummaryLines covers secondary read-only session', () => {
		const lines = formatIngestSummaryLines({
			available: true,
			disableCode: undefined,
			disableMessage: undefined,
			indexWriteRole: 'secondary',
			indexWriteCapable: false,
			indexing: false,
			inFlight: 0,
			stats: { documents: 5, chunks: 10, vectors: 10, textDocs: 5 },
			docParseReady: true,
			modelsPresent: true,
		});
		assert.ok(lines.some(l => l.includes('Agents window (read-only search)')));
		assert.ok(lines.some(l => l.includes('search only')));
	});

	test('formatIngestSummaryLines covers models-missing', () => {
		const lines = formatIngestSummaryLines({
			available: false,
			disableCode: 'models-missing',
			disableMessage: 'Search pack not installed',
			indexWriteRole: 'primary',
			indexWriteCapable: false,
			indexing: false,
			inFlight: 0,
			stats: undefined,
			docParseReady: false,
			modelsPresent: false,
		});
		assert.ok(lines.some(l => l.includes('Index: no workspace open')));
		assert.ok(lines.some(l => l.includes('Status: local search models not installed')));
	});

	test('formatIngestSummaryPrimaryMessage includes doc count', () => {
		assert.strictEqual(
			formatIngestSummaryPrimaryMessage({
				available: true,
				disableCode: undefined,
				disableMessage: undefined,
				indexWriteRole: 'primary',
				indexWriteCapable: true,
				indexing: false,
				inFlight: 0,
				stats: { documents: 12, chunks: 40, vectors: 40, textDocs: 12 },
				docParseReady: true,
				modelsPresent: true,
			}),
			'Private Search — 12 docs indexed',
		);
		assert.strictEqual(
			formatIngestSummaryPrimaryMessage({
				available: true,
				disableCode: undefined,
				disableMessage: undefined,
				indexWriteRole: 'primary',
				indexWriteCapable: true,
				indexing: false,
				inFlight: 0,
				stats: { documents: 1, chunks: 2, vectors: 2, textDocs: 1 },
				docParseReady: true,
				modelsPresent: true,
			}),
			'Private Search — 1 doc indexed',
		);
	});

	test('formatIngestSummaryLines includes last scan stats', () => {
		const lines = formatIngestSummaryLines({
			available: true,
			disableCode: undefined,
			disableMessage: undefined,
			indexWriteRole: 'primary',
			indexWriteCapable: true,
			indexing: false,
			inFlight: 0,
			stats: { documents: 12, chunks: 40, vectors: 40, textDocs: 12 },
			docParseReady: true,
			modelsPresent: true,
			lastScan: { skipped: 40, indexed: 0, hardDisable: 0 },
		});
		assert.ok(lines.some(l => l.includes('Last scan: 40 skipped')));
	});

	test('formatIngestSummaryDetail appends rag stats block', () => {
		const detail = formatIngestSummaryDetail({
			available: true,
			disableCode: undefined,
			disableMessage: undefined,
			indexWriteRole: 'primary',
			indexWriteCapable: true,
			indexing: false,
			inFlight: 0,
			stats: { documents: 2, chunks: 4, vectors: 4, textDocs: 2 },
			docParseReady: true,
			modelsPresent: true,
		});
		assert.ok(detail.includes('Private Search index stats:'));
		assert.ok(detail.includes('Documents: 2'));
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	assembleContextPack,
	buildSearchContextPack,
	buildSearchFailureContextPack,
	formatCitationHeader,
	formatEmptySearchContextPack,
	formatSearchHit,
} from '../contextPack';
import { SEARCH_FAILED_PREFIX, citationAnchorFromSearchHit } from '../toolContracts';

suite('contextPack', () => {
	const hitA = {
		text: 'Permanent disability rating uses the AMA Guides.',
		sourceUri: 'file:///case/core_references/manual.md',
		page: 12,
		heading: 'Rating',
		charStart: 100,
		charEnd: 180,
		fusedScore: 0.91,
		scope: 'core_reference',
	};

	const hitB = {
		text: 'IME found work restrictions of lifting under 20 pounds.',
		sourceUri: 'file:///case/ime.pdf',
		page: 4,
		heading: 'Opinion',
		charStart: 20,
		charEnd: 90,
		fusedScore: 0.77,
		scope: 'case_index',
		sectionTitle: 'Work restrictions',
	};

	test('formatCitationHeader includes uri page heading and charRange', () => {
		const anchor = citationAnchorFromSearchHit(hitA)!;
		const header = formatCitationHeader(anchor, 1);
		assert.strictEqual(
			header,
			'[1] file:///case/core_references/manual.md | page 12 | heading "Rating" | chars 100-180',
		);
	});

	test('assembleContextPack joins citation-aware sections without MMR', () => {
		const body = assembleContextPack([hitA, hitB]);
		assert.ok(body.includes('[1] file:///case/core_references/manual.md'));
		assert.ok(body.includes('[2] file:///case/ime.pdf'));
		assert.ok(body.includes('scope=core_reference'));
		assert.ok(body.includes('score=0.9100'));
		assert.ok(body.includes('---'));
		assert.ok(body.includes(hitA.text));
		assert.ok(body.includes(hitB.text));
		assert.ok(!body.toLowerCase().includes('mmr'));
	});

	test('buildSearchContextPack empty guidance and success preamble', () => {
		const empty = buildSearchContextPack({
			query: 'appeal deadline',
			hits: [],
			scope: 'core_reference',
		});
		assert.ok(empty.includes('No relevant documents found'));
		assert.ok(empty.includes('scope: core_reference'));
		assert.ok(empty.includes('safeappeals_rag_get_stats'));
		assert.ok(empty.includes('safeappeals_rag_index_document'));

		const packed = buildSearchContextPack({
			query: 'rating',
			hits: [hitA],
			scope: 'core_reference',
		});
		assert.ok(packed.startsWith('Found 1 relevant chunk(s) [scope=core_reference]'));
		assert.ok(packed.includes('hybrid BM25+vector → RRF → optional cross-encoder; not MMR'));
		assert.ok(packed.includes(hitA.text));
	});

	test('buildSearchFailureContextPack uses Search failed prefix', () => {
		assert.strictEqual(
			buildSearchFailureContextPack('embed model missing'),
			`${SEARCH_FAILED_PREFIX}embed model missing`,
		);
	});

	test('formatSearchHit falls back when sourceUri missing', () => {
		const formatted = formatSearchHit(
			{ text: 'orphan chunk', docId: 'doc-1', chunkId: 'c-1' },
			3,
		);
		assert.ok(formatted.startsWith('[3] doc-1'));
		assert.ok(formatted.includes('orphan chunk'));
	});

	test('assembleContextPack respects maxContextLength', () => {
		const long = {
			text: 'A'.repeat(500),
			sourceUri: 'file:///a.md',
		};
		const short = assembleContextPack([long, long], {
			maxContextLength: 280,
			maxChunkChars: 200,
		});
		assert.ok(short.length <= 280);
		assert.ok(short.includes('[1]'));
	});

	test('formatEmptySearchContextPack is stable', () => {
		const text = formatEmptySearchContextPack('foo');
		assert.ok(text.includes('"foo"'));
		assert.ok(text.includes('safeappeals_rag_get_stats'));
	});
});

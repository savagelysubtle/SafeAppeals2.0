/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	RAG_GET_STATS_TOOL,
	RAG_INDEX_DOCUMENT_TOOL,
	RAG_SEARCH_ALL_TOOL,
	RAG_SEARCH_LIMIT_DEFAULT,
	RAG_SEARCH_REFERENCE_TOOL,
	RAG_SEARCH_WORKSPACE_TOOL,
	RAG_TOOL_NAMES,
	RAG_TOOL_SCOPE_BY_NAME,
	SEARCH_FAILED_PREFIX,
	VOID_SCOPE_ALIASES,
	citationAnchorFromSearchHit,
	formatRagStatsString,
	indexHardDisableResult,
	indexSkippedResult,
	mapAgentLimitToFinalK,
	searchFailedResult,
	statsToolResult,
} from '../toolContracts';
import type { CitationAnchor } from '../types';

suite('toolContracts', () => {
	test('freezes the five shipping tool names', () => {
		assert.deepStrictEqual([...RAG_TOOL_NAMES], [
			'safeappeals_rag_index_document',
			'safeappeals_rag_search_reference',
			'safeappeals_rag_search_workspace',
			'safeappeals_rag_search_all',
			'safeappeals_rag_get_stats',
		]);
		assert.strictEqual(RAG_INDEX_DOCUMENT_TOOL, 'safeappeals_rag_index_document');
		assert.strictEqual(RAG_SEARCH_REFERENCE_TOOL, 'safeappeals_rag_search_reference');
		assert.strictEqual(RAG_SEARCH_WORKSPACE_TOOL, 'safeappeals_rag_search_workspace');
		assert.strictEqual(RAG_SEARCH_ALL_TOOL, 'safeappeals_rag_search_all');
		assert.strictEqual(RAG_GET_STATS_TOOL, 'safeappeals_rag_get_stats');
	});

	test('maps search tools to canonical scopes', () => {
		assert.deepStrictEqual(RAG_TOOL_SCOPE_BY_NAME, {
			[RAG_SEARCH_REFERENCE_TOOL]: 'core_reference',
			[RAG_SEARCH_WORKSPACE_TOOL]: 'case_index',
			[RAG_SEARCH_ALL_TOOL]: 'all',
		});
	});

	test('documents Void scope aliases without changing canonical values', () => {
		assert.strictEqual(VOID_SCOPE_ALIASES['core_references'], 'core_reference');
		assert.strictEqual(VOID_SCOPE_ALIASES['policy_manual'], 'core_reference');
		assert.strictEqual(VOID_SCOPE_ALIASES['workspace_all'], 'all');
		assert.strictEqual(VOID_SCOPE_ALIASES['core_reference'], 'core_reference');
		assert.strictEqual(VOID_SCOPE_ALIASES['case_index'], 'case_index');
		assert.strictEqual(VOID_SCOPE_ALIASES['all'], 'all');
	});

	test('maps agent limit to finalK with default 8', () => {
		assert.strictEqual(RAG_SEARCH_LIMIT_DEFAULT, 8);
		assert.strictEqual(mapAgentLimitToFinalK(undefined), 8);
		assert.strictEqual(mapAgentLimitToFinalK(null), 8);
		assert.strictEqual(mapAgentLimitToFinalK(12), 12);
		assert.strictEqual(mapAgentLimitToFinalK(0), 1);
		assert.strictEqual(mapAgentLimitToFinalK(100), 32);
	});

	test('maps rag-core charStart/charEnd onto CitationAnchor.charRange', () => {
		const anchor = citationAnchorFromSearchHit({
			sourceUri: 'file:///case/core_references/regs.md',
			page: 3,
			heading: 'Appeals',
			charStart: 10,
			charEnd: 40,
		});
		const expected: CitationAnchor = {
			sourceUri: 'file:///case/core_references/regs.md',
			page: 3,
			heading: 'Appeals',
			charRange: { start: 10, end: 40 },
		};
		assert.deepStrictEqual(anchor, expected);
	});

	test('omits citation when sourceUri is missing', () => {
		assert.strictEqual(citationAnchorFromSearchHit({}), undefined);
		assert.strictEqual(citationAnchorFromSearchHit({ sourceUri: '  ' }), undefined);
	});

	test('index skip is success; hard-disable is failure with code', () => {
		assert.deepStrictEqual(indexSkippedResult('already indexed'), {
			success: true,
			message: 'Skipped: already indexed',
		});
		assert.deepStrictEqual(
			indexHardDisableResult('models-missing', 'Search Tools not installed'),
			{
				success: false,
				message: 'Hard-disable [models-missing]: Search Tools not installed',
			},
		);
	});

	test('search failures return Void-compatible contextPack prefix', () => {
		assert.deepStrictEqual(searchFailedResult('native missing'), {
			contextPack: `${SEARCH_FAILED_PREFIX}native missing`,
		});
		assert.deepStrictEqual(searchFailedResult('Search failed: already prefixed'), {
			contextPack: 'Search failed: already prefixed',
		});
	});

	test('stats string includes RagStats fields and rejects MMR claim', () => {
		const stats = statsToolResult({
			documents: 2,
			chunks: 40,
			vectors: 40,
			textDocs: 40,
		});
		assert.ok(stats.stats.includes('Documents: 2'));
		assert.ok(stats.stats.includes('Chunks: 40'));
		assert.ok(stats.stats.includes('Vectors: 40'));
		assert.ok(stats.stats.includes('Text docs (BM25): 40'));
		assert.ok(stats.stats.includes('RRF'));
		assert.ok(stats.stats.includes('not MMR'));
		assert.ok(!stats.stats.includes('after MMR'));
		assert.strictEqual(formatRagStatsString({
			documents: 0,
			chunks: 0,
			vectors: 0,
			textDocs: 0,
		}).includes('Documents: 0'), true);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	createRagAgentTools,
	formatIndexPipelineResult,
	type RagAgentHost,
	type RagAgentPipeline,
} from '../agentTools';
import type { IndexPipelineResult } from '../indexPipeline';
import type { RagCoreHostStatus, RagSearchResult } from '../ragCoreHost';
import {
	RAG_GET_STATS_TOOL,
	RAG_INDEX_DOCUMENT_TOOL,
	RAG_SEARCH_ALL_TOOL,
	RAG_SEARCH_REFERENCE_TOOL,
	RAG_SEARCH_WORKSPACE_TOOL,
	SEARCH_FAILED_PREFIX,
} from '../toolContracts';

function toolText(result: vscode.LanguageModelToolResult): string {
	return result.content
		.map(part => part instanceof vscode.LanguageModelTextPart ? part.value : '')
		.join('');
}

function cancellationToken(): vscode.CancellationToken {
	return new vscode.CancellationTokenSource().token;
}

function baseStatus(overrides?: Partial<RagCoreHostStatus>): RagCoreHostStatus {
	return {
		available: true,
		disableCode: undefined,
		disableMessage: undefined,
		reasons: [],
		nativeVersion: 'test',
		bindingPath: undefined,
		expectedPath: undefined,
		capabilities: undefined,
		stats: {
			documents: 2,
			chunks: 10,
			vectors: 10,
			textDocs: 2,
		},
		workspaceRoot: '/tmp/rag',
		workspaceOpen: true,
		modelEnv: undefined,
		dekReason: undefined,
		electron146Note: 'test',
		...overrides,
	};
}

function mockHost(options?: {
	readonly search?: (query: string, opts: { finalK: number; scope?: string | null }) => RagSearchResult;
	readonly status?: RagCoreHostStatus;
}): RagAgentHost {
	return {
		search: options?.search ?? ((_query, _opts) => ({
			ok: true,
			results: [{
				chunkId: 'c1',
				docId: 'd1',
				text: 'Appeal rights under section 3.',
				fusedScore: 0.91,
				sourceUri: 'file:///workspace/case/core_references/regs.md',
				heading: 'Appeals',
				scope: 'core_reference',
			}],
		})),
		getStatus: () => options?.status ?? baseStatus(),
	};
}

function mockPipeline(result: IndexPipelineResult): RagAgentPipeline {
	return {
		indexFile: async () => result,
	};
}

suite('rag agentTools', () => {
	let tools: ReturnType<typeof createRagAgentTools>;
	const folders = [{ uri: vscode.Uri.file('/workspace/case'), name: 'case', index: 0 }];
	let lastSearch: { query: string; finalK: number; scope?: string | null } | undefined;

	suiteSetup(() => {
		(vscode.workspace as { workspaceFolders?: typeof folders }).workspaceFolders = folders;
	});

	suiteTeardown(() => {
		(vscode.workspace as { workspaceFolders?: undefined }).workspaceFolders = undefined;
	});

	setup(() => {
		lastSearch = undefined;
		tools = createRagAgentTools(
			() => mockHost({
				search: (query, opts) => {
					lastSearch = { query, finalK: opts.finalK, scope: opts.scope };
					return {
						ok: true,
						results: [{
							chunkId: 'c1',
							docId: 'd1',
							text: 'Appeal rights under section 3.',
							fusedScore: 0.91,
							sourceUri: 'file:///workspace/case/core_references/regs.md',
							heading: 'Appeals',
							scope: String(opts.scope ?? 'all'),
						}],
					};
				},
			}),
			() => mockPipeline({
				kind: 'ok',
				docId: 'abc123',
				chunkCount: 4,
				scope: 'case_index',
			}),
		);
	});

	test('exports frozen tool name constants', () => {
		assert.deepStrictEqual(
			[
				RAG_INDEX_DOCUMENT_TOOL,
				RAG_SEARCH_REFERENCE_TOOL,
				RAG_SEARCH_WORKSPACE_TOOL,
				RAG_SEARCH_ALL_TOOL,
				RAG_GET_STATS_TOOL,
			],
			[
				'safeappeals_rag_index_document',
				'safeappeals_rag_search_reference',
				'safeappeals_rag_search_workspace',
				'safeappeals_rag_search_all',
				'safeappeals_rag_get_stats',
			],
		);
	});

	test('formatIndexPipelineResult maps ok / skipped / hard-disable', () => {
		assert.deepStrictEqual(
			{
				ok: formatIndexPipelineResult({
					kind: 'ok',
					docId: 'd1',
					chunkCount: 3,
					scope: 'core_reference',
				}),
				skipped: formatIndexPipelineResult({
					kind: 'skipped',
					reason: 'Extension .pdf is not in the M6 txt/md index set',
				}),
				hard: formatIndexPipelineResult({
					kind: 'hard-disable',
					code: 'models-missing',
					message: 'Embedding model not loaded',
					reasons: ['Embedding model not loaded'],
				}),
			},
			{
				ok: 'Indexed document d1: 3 chunk(s) (scope=core_reference).',
				skipped: 'Skipped: Extension .pdf is not in the M6 txt/md index set',
				hard: 'Hard-disable [models-missing]: Embedding model not loaded',
			},
		);
	});

	test('indexDocument validates uri and maps pipeline results', async () => {
		const token = cancellationToken();

		const missingUri = toolText(await tools.indexDocument.invoke({
			toolInvocationToken: undefined,
			input: { uri: '' },
		}, token));
		const success = toolText(await tools.indexDocument.invoke({
			toolInvocationToken: undefined,
			input: { uri: 'notes.md' },
		}, token));

		const skippedTools = createRagAgentTools(
			() => mockHost(),
			() => mockPipeline({
				kind: 'skipped',
				reason: 'Extension .pdf is not in the M6 txt/md index set',
			}),
		);
		const skipped = toolText(await skippedTools.indexDocument.invoke({
			toolInvocationToken: undefined,
			input: { uri: 'scan.pdf' },
		}, token));

		assert.deepStrictEqual(
			{
				missingUri: missingUri.startsWith('Error: "uri" is required'),
				success: success.includes('Indexed document abc123') && success.includes('case_index'),
				skipped: skipped.startsWith('Skipped:'),
			},
			{ missingUri: true, success: true, skipped: true },
		);
	});

	test('search tools map scopes and limit to finalK and return contextPack', async () => {
		const token = cancellationToken();

		const refText = toolText(await tools.searchReference.invoke({
			toolInvocationToken: undefined,
			input: { query: 'appeal rights', limit: 12 },
		}, token));
		assert.deepStrictEqual(lastSearch, {
			query: 'appeal rights',
			finalK: 12,
			scope: 'core_reference',
		});
		assert.ok(refText.includes('Found 1 relevant chunk'));
		assert.ok(refText.includes('not MMR'));
		assert.ok(!refText.toLowerCase().includes('mmr diversity'));

		await tools.searchWorkspace.invoke({
			toolInvocationToken: undefined,
			input: { query: 'timeline' },
		}, token);
		assert.strictEqual(lastSearch?.scope, 'case_index');
		assert.strictEqual(lastSearch?.finalK, 8);

		await tools.searchAll.invoke({
			toolInvocationToken: undefined,
			input: { query: 'all docs', limit: 0 },
		}, token);
		assert.strictEqual(lastSearch?.scope, 'all');
		assert.strictEqual(lastSearch?.finalK, 1);
	});

	test('search failures and missing query use Search failed prefix', async () => {
		const token = cancellationToken();
		const failing = createRagAgentTools(
			() => mockHost({
				search: () => ({ ok: false, error: 'models-missing', results: [] }),
			}),
			() => undefined,
		);

		const missingQuery = toolText(await tools.searchAll.invoke({
			toolInvocationToken: undefined,
			input: { query: '   ' },
		}, token));
		const failed = toolText(await failing.searchAll.invoke({
			toolInvocationToken: undefined,
			input: { query: 'x' },
		}, token));
		const noHost = toolText(await createRagAgentTools(
			() => undefined,
			() => undefined,
		).searchReference.invoke({
			toolInvocationToken: undefined,
			input: { query: 'x' },
		}, token));

		assert.ok(missingQuery.startsWith(SEARCH_FAILED_PREFIX));
		assert.ok(failed.startsWith(`${SEARCH_FAILED_PREFIX}models-missing`));
		assert.ok(noHost.includes('host is not available'));
	});

	test('getStats formats RagStats and guards missing host/stats', async () => {
		const token = cancellationToken();
		const statsText = toolText(await tools.getStats.invoke({
			toolInvocationToken: undefined,
			input: {},
		}, token));
		assert.ok(statsText.includes('Private Search index stats:'));
		assert.ok(statsText.includes('Documents: 2'));
		assert.ok(statsText.includes('not MMR'));

		const unavailable = toolText(await createRagAgentTools(
			() => ({
				search: () => ({ ok: true, results: [] }),
				getStatus: () => baseStatus({ stats: undefined }),
			}),
			() => undefined,
		).getStats.invoke({ toolInvocationToken: undefined, input: {} }, token));
		assert.ok(unavailable.startsWith('Error: Private Search stats unavailable'));

		const noHost = toolText(await createRagAgentTools(
			() => undefined,
			() => undefined,
		).getStats.invoke({ toolInvocationToken: undefined, input: {} }, token));
		assert.strictEqual(noHost, 'Error: Private Search host is not available.');
	});

	test('index, search, and stats require workspace; pipeline guard is clear', async () => {
		const token = cancellationToken();
		(vscode.workspace as { workspaceFolders?: undefined }).workspaceFolders = undefined;

		const indexNoWs = toolText(await tools.indexDocument.invoke({
			toolInvocationToken: undefined,
			input: { uri: 'a.md' },
		}, token));
		const searchNoWs = toolText(await tools.searchReference.invoke({
			toolInvocationToken: undefined,
			input: { query: 'appeal' },
		}, token));
		const statsNoWs = toolText(await tools.getStats.invoke({
			toolInvocationToken: undefined,
			input: {},
		}, token));

		(vscode.workspace as { workspaceFolders?: typeof folders }).workspaceFolders = folders;

		const noPipeline = toolText(await createRagAgentTools(
			() => mockHost(),
			() => undefined,
		).indexDocument.invoke({
			toolInvocationToken: undefined,
			input: { uri: 'a.md' },
		}, token));

		assert.ok(indexNoWs.includes('open a workspace folder'));
		assert.ok(searchNoWs.startsWith(SEARCH_FAILED_PREFIX));
		assert.ok(searchNoWs.includes('open a workspace folder'));
		assert.ok(statsNoWs.includes('open a workspace folder'));
		assert.ok(noPipeline.includes('index pipeline is not available'));
	});

	test('search and index tools do not expose prepareInvocation', () => {
		assert.strictEqual(
			typeof (tools.searchReference as { prepareInvocation?: unknown }).prepareInvocation,
			'undefined',
		);
		assert.strictEqual(
			typeof (tools.indexDocument as { prepareInvocation?: unknown }).prepareInvocation,
			'undefined',
		);
	});
});

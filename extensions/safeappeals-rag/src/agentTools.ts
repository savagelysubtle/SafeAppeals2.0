/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	buildSearchContextPack,
	buildSearchFailureContextPack,
} from './contextPack';
import {
	scopeFromSourcePath,
	type IndexPipeline,
	type IndexPipelineResult,
} from './indexPipeline';
import { getWorkspaceRootPaths } from './pathGuard';
import type { RagCoreHost, RagStats } from './ragCoreHost';
import {
	RAG_GET_STATS_TOOL,
	RAG_INDEX_DOCUMENT_TOOL,
	RAG_SEARCH_ALL_TOOL,
	RAG_SEARCH_REFERENCE_TOOL,
	RAG_SEARCH_WORKSPACE_TOOL,
	RAG_TOOL_NAMES,
	RAG_TOOL_SCOPE_BY_NAME,
	type RagIndexDocumentToolInput,
	type RagSearchToolInput,
	indexHardDisableResult,
	indexOkResult,
	indexSkippedResult,
	mapAgentLimitToFinalK,
	statsToolResult,
} from './toolContracts';
import type { RagIndexScope } from './types';

export {
	RAG_GET_STATS_TOOL,
	RAG_INDEX_DOCUMENT_TOOL,
	RAG_SEARCH_ALL_TOOL,
	RAG_SEARCH_REFERENCE_TOOL,
	RAG_SEARCH_WORKSPACE_TOOL,
	RAG_TOOL_NAMES,
};

/** Host surface used by RAG LM tools (search + status). */
export type RagAgentHost = Pick<RagCoreHost, 'search' | 'getStatus'>;

/** Pipeline surface used by the index tool. */
export type RagAgentPipeline = Pick<IndexPipeline, 'indexFile'>;

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

function getWorkspaceFolders(): readonly vscode.WorkspaceFolder[] {
	return vscode.workspace.workspaceFolders ?? [];
}

/**
 * Resolve a workspace-relative path, absolute path, or URI string to a `file:` URI.
 */
export function resolveIndexSourceUri(uriOrPath: string): string | undefined {
	const trimmed = uriOrPath?.trim();
	if (!trimmed) {
		return undefined;
	}
	const folders = getWorkspaceFolders();
	try {
		if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
			return vscode.Uri.parse(trimmed).toString();
		}
		if (trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)) {
			return vscode.Uri.file(path.resolve(trimmed)).toString();
		}
		if (folders.length === 0) {
			return undefined;
		}
		return vscode.Uri.joinPath(folders[0]!.uri, trimmed).toString();
	} catch {
		return undefined;
	}
}

function resolveIndexScope(
	sourceUri: string,
	isCoreReference: boolean | undefined,
): RagIndexScope {
	if (isCoreReference === true) {
		return 'core_reference';
	}
	const roots = getWorkspaceRootPaths(getWorkspaceFolders());
	try {
		const fsPath = vscode.Uri.parse(sourceUri).fsPath;
		return scopeFromSourcePath(fsPath, roots);
	} catch {
		return 'case_index';
	}
}

/**
 * Map {@link IndexPipelineResult} onto the frozen index tool message.
 *
 * Gap: IndexPipeline does not yet short-circuit "already indexed" — re-index
 * overwrites chunks for the same docId (ok for v1).
 */
export function formatIndexPipelineResult(result: IndexPipelineResult): string {
	if (result.kind === 'ok') {
		return indexOkResult(
			`Indexed document ${result.docId}: ${result.chunkCount} chunk(s) (scope=${result.scope}).`,
		).message;
	}
	if (result.kind === 'skipped') {
		return indexSkippedResult(result.reason).message;
	}
	return indexHardDisableResult(result.code, result.message).message;
}

class RagIndexDocumentTool implements vscode.LanguageModelTool<RagIndexDocumentToolInput> {
	constructor(private readonly getPipeline: () => RagAgentPipeline | undefined) { }

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<RagIndexDocumentToolInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		if (getWorkspaceFolders().length === 0) {
			return textResult('Error: open a workspace folder to use Private Search index tools.');
		}
		const pipeline = this.getPipeline();
		if (!pipeline) {
			return textResult(
				'Error: Private Search index pipeline is not available (ingest/rag-core not ready).',
			);
		}

		const uriInput = options.input?.uri?.trim() ?? '';
		if (!uriInput) {
			return textResult('Error: "uri" is required (workspace-relative path, absolute path, or file URI).');
		}

		const sourceUri = resolveIndexSourceUri(uriInput);
		if (!sourceUri) {
			return textResult(`Error: could not resolve uri "${uriInput}" inside the workspace.`);
		}

		const scope = resolveIndexScope(sourceUri, options.input?.isCoreReference);
		try {
			const result = await pipeline.indexFile({ sourceUri, scope });
			return textResult(formatIndexPipelineResult(result));
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return textResult(`Error indexing document: ${message}`);
		}
	}
}

class RagSearchTool implements vscode.LanguageModelTool<RagSearchToolInput> {
	constructor(
		private readonly toolName:
			| typeof RAG_SEARCH_REFERENCE_TOOL
			| typeof RAG_SEARCH_WORKSPACE_TOOL
			| typeof RAG_SEARCH_ALL_TOOL,
		private readonly getHost: () => RagAgentHost | undefined,
	) { }

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<RagSearchToolInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		if (getWorkspaceFolders().length === 0) {
			return textResult(
				buildSearchFailureContextPack('open a workspace folder to use Private Search tools.'),
			);
		}
		const host = this.getHost();
		if (!host) {
			return textResult(
				buildSearchFailureContextPack('Private Search host is not available.'),
			);
		}

		const query = options.input?.query?.trim() ?? '';
		if (!query) {
			return textResult(buildSearchFailureContextPack('"query" is required.'));
		}

		const scope = RAG_TOOL_SCOPE_BY_NAME[this.toolName];
		const finalK = mapAgentLimitToFinalK(options.input?.limit);
		try {
			const result = host.search(query, { finalK, scope });
			if (!result.ok) {
				return textResult(
					buildSearchFailureContextPack(result.error ?? 'unknown search error'),
				);
			}
			return textResult(
				buildSearchContextPack({
					query,
					hits: result.results,
					scope,
				}),
			);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			return textResult(buildSearchFailureContextPack(message));
		}
	}
}

class RagGetStatsTool implements vscode.LanguageModelTool<Record<string, never>> {
	constructor(private readonly getHost: () => RagAgentHost | undefined) { }

	async invoke(
		_options: vscode.LanguageModelToolInvocationOptions<Record<string, never>>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		if (getWorkspaceFolders().length === 0) {
			return textResult('Error: open a workspace folder to use Private Search stats.');
		}
		const host = this.getHost();
		if (!host) {
			return textResult('Error: Private Search host is not available.');
		}

		const status = host.getStatus();
		const stats: RagStats | undefined = status.stats;
		if (!stats) {
			const detail = status.disableMessage
				? ` ${status.disableMessage}`
				: ' Workspace index is not open or native stats are unavailable.';
			return textResult(`Error: Private Search stats unavailable.${detail}`);
		}
		return textResult(statsToolResult(stats).stats);
	}
}

/**
 * Build RAG LM tool instances (exported for unit tests).
 */
export function createRagAgentTools(
	getHost: () => RagAgentHost | undefined,
	getPipeline: () => RagAgentPipeline | undefined,
) {
	return {
		indexDocument: new RagIndexDocumentTool(getPipeline),
		searchReference: new RagSearchTool(RAG_SEARCH_REFERENCE_TOOL, getHost),
		searchWorkspace: new RagSearchTool(RAG_SEARCH_WORKSPACE_TOOL, getHost),
		searchAll: new RagSearchTool(RAG_SEARCH_ALL_TOOL, getHost),
		getStats: new RagGetStatsTool(getHost),
	};
}

/**
 * Register the five frozen Safe Appeals Private Search LM tools.
 */
export function registerAgentTools(
	context: vscode.ExtensionContext,
	getHost: () => RagAgentHost | undefined,
	getPipeline: () => RagAgentPipeline | undefined,
): void {
	const tools = createRagAgentTools(getHost, getPipeline);
	context.subscriptions.push(
		vscode.lm.registerTool(RAG_INDEX_DOCUMENT_TOOL, tools.indexDocument),
		vscode.lm.registerTool(RAG_SEARCH_REFERENCE_TOOL, tools.searchReference),
		vscode.lm.registerTool(RAG_SEARCH_WORKSPACE_TOOL, tools.searchWorkspace),
		vscode.lm.registerTool(RAG_SEARCH_ALL_TOOL, tools.searchAll),
		vscode.lm.registerTool(RAG_GET_STATS_TOOL, tools.getStats),
	);
}

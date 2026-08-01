/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	isPathInsideWorkspaceRoot,
	SAFEAPPEALS_FIND_FILES_TOOL,
	SAFEAPPEALS_FIND_TEXT_IN_FILES_TOOL,
	SAFEAPPEALS_GET_CHANGED_FILES_TOOL,
	SAFEAPPEALS_GET_ERRORS_TOOL,
	SAFEAPPEALS_SEARCH_CODEBASE_TOOL,
	SAFEAPPEALS_SEARCH_WORKSPACE_SYMBOLS_TOOL,
} from './toolAllowlist';
import { resolveWorkspaceRelativePath } from './tools';

const DEFAULT_MAX_RESULTS = 50;
const SNIPPET_MAX_CHARS = 200;
const FALLBACK_FILE_SCAN_CAP = 200;
const FALLBACK_FILE_BYTE_CAP = 256_000;

interface FindFilesInput {
	query: string;
	maxResults?: number;
}

interface FindTextInFilesInput {
	query: string;
	isRegexp?: boolean;
	includePattern?: string;
	maxResults?: number;
	includeIgnoredFiles?: boolean;
}

interface SearchWorkspaceSymbolsInput {
	symbolName: string;
}

interface GetErrorsInput {
	filePaths?: string[];
}

interface GetChangedFilesInput {
	repositoryPath?: string;
	sourceControlState?: Array<'staged' | 'unstaged' | 'merge-conflicts'>;
}

interface SearchCodebaseInput {
	query: string;
}

interface TextSearchHit {
	path: string;
	line: number;
	snippet: string;
}

/** Minimal Git extension API surface used by getChangedFiles. */
interface GitChange {
	readonly uri: vscode.Uri;
	readonly status: number;
}

interface GitRepositoryState {
	readonly indexChanges: readonly GitChange[];
	readonly workingTreeChanges: readonly GitChange[];
	readonly untrackedChanges: readonly GitChange[];
	readonly mergeChanges: readonly GitChange[];
}

interface GitRepository {
	readonly rootUri: vscode.Uri;
	readonly state: GitRepositoryState;
}

interface GitApi {
	readonly repositories: readonly GitRepository[];
}

interface GitExtension {
	readonly enabled: boolean;
	getAPI(version: 1): GitApi;
}

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

function isTextSearchMatch(result: vscode.TextSearchResult): result is vscode.TextSearchMatch {
	return (result as vscode.TextSearchMatch).preview !== undefined;
}

function clampMaxResults(value: number | undefined): number {
	if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
		return DEFAULT_MAX_RESULTS;
	}
	return Math.min(Math.floor(value), DEFAULT_MAX_RESULTS);
}

function truncateSnippet(text: string): string {
	const collapsed = text.replace(/\s+/g, ' ').trim();
	if (collapsed.length <= SNIPPET_MAX_CHARS) {
		return collapsed;
	}
	return `${collapsed.slice(0, SNIPPET_MAX_CHARS)}…`;
}

function workspaceRelativePath(uri: vscode.Uri, folders: readonly vscode.WorkspaceFolder[]): string {
	for (const folder of folders) {
		if (uri.scheme !== folder.uri.scheme) {
			continue;
		}
		const relative = vscode.workspace.asRelativePath(uri, false);
		if (relative && relative !== uri.fsPath) {
			return relative;
		}
	}
	return uri.fsPath;
}

function normalizeGlobQuery(query: string): string {
	let pattern = query.trim();
	if (!pattern) {
		return '**/*';
	}
	if (!pattern.startsWith('**/') && !pattern.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(pattern) && !pattern.includes(':')) {
		pattern = `**/${pattern}`;
	}
	if (pattern.endsWith('/')) {
		pattern = `${pattern}**`;
	}
	return pattern;
}

async function findTextHits(
	input: FindTextInFilesInput,
	token: vscode.CancellationToken,
): Promise<TextSearchHit[]> {
	const folders = vscode.workspace.workspaceFolders ?? [];
	if (folders.length === 0) {
		return [];
	}

	const maxResults = clampMaxResults(input.maxResults);
	const pattern = input.query ?? '';
	if (!pattern.trim()) {
		return [];
	}

	if (typeof vscode.workspace.findTextInFiles === 'function') {
		const hits: TextSearchHit[] = [];
		await vscode.workspace.findTextInFiles(
			{
				pattern,
				isRegExp: input.isRegexp ?? false,
				isCaseSensitive: false,
			},
			{
				include: input.includePattern?.trim() || undefined,
				maxResults,
				useIgnoreFiles: !(input.includeIgnoredFiles ?? false),
				useDefaultExcludes: !(input.includeIgnoredFiles ?? false),
				previewOptions: { matchLines: 1, charsPerLine: SNIPPET_MAX_CHARS },
			},
			(result: vscode.TextSearchResult) => {
				if (hits.length >= maxResults || !isTextSearchMatch(result)) {
					return;
				}
				const ranges = result.ranges;
				const firstRange = Array.isArray(ranges) ? ranges[0] : ranges;
				const line = firstRange instanceof vscode.Range ? firstRange.start.line + 1 : 1;
				hits.push({
					path: workspaceRelativePath(result.uri, folders),
					line,
					snippet: truncateSnippet(result.preview.text ?? ''),
				});
			},
			token,
		);
		return hits;
	}

	return findTextHitsFallback(input, folders, maxResults, token);
}

async function findTextHitsFallback(
	input: FindTextInFilesInput,
	folders: readonly vscode.WorkspaceFolder[],
	maxResults: number,
	token: vscode.CancellationToken,
): Promise<TextSearchHit[]> {
	const include = input.includePattern?.trim() ? normalizeGlobQuery(input.includePattern) : '**/*';
	const exclude = input.includeIgnoredFiles ? undefined : '**/{node_modules,out,dist,.git}/**';
	const uris = await vscode.workspace.findFiles(include, exclude, FALLBACK_FILE_SCAN_CAP, token);
	const pattern = input.query;
	const isRegexp = input.isRegexp ?? false;
	let matcher: RegExp;
	try {
		matcher = isRegexp ? new RegExp(pattern, 'i') : new RegExp(escapeRegExp(pattern), 'i');
	} catch {
		matcher = new RegExp(escapeRegExp(pattern), 'i');
	}

	const hits: TextSearchHit[] = [];
	for (const uri of uris) {
		if (token.isCancellationRequested || hits.length >= maxResults) {
			break;
		}
		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			if (bytes.byteLength > FALLBACK_FILE_BYTE_CAP) {
				continue;
			}
			const text = Buffer.from(bytes).toString('utf8');
			const lines = text.split(/\r?\n/);
			for (let i = 0; i < lines.length; i++) {
				if (hits.length >= maxResults) {
					break;
				}
				const lineText = lines[i];
				if (matcher.test(lineText)) {
					hits.push({
						path: workspaceRelativePath(uri, folders),
						line: i + 1,
						snippet: truncateSnippet(lineText),
					});
				}
			}
		} catch {
			// Skip unreadable files in the fallback scan.
		}
	}
	return hits;
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function formatTextHits(hits: TextSearchHit[], truncated: boolean): string {
	if (hits.length === 0) {
		return 'No matches found.';
	}
	const lines = hits.map(hit => `${hit.path}:${hit.line}: ${hit.snippet}`);
	if (truncated) {
		lines.push(`…(truncated to ${hits.length} results)`);
	}
	return lines.join('\n');
}

class FindFilesTool implements vscode.LanguageModelTool<FindFilesInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<FindFilesInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return textResult('Error: open a workspace folder before searching for files.');
		}
		const query = options.input?.query?.trim() ?? '';
		if (!query) {
			return textResult('Error: query is required.');
		}
		const maxResults = clampMaxResults(options.input?.maxResults);
		try {
			const pattern = normalizeGlobQuery(query);
			const uris = await vscode.workspace.findFiles(pattern, '**/{node_modules,out,dist,.git}/**', maxResults, token);
			if (uris.length === 0) {
				return textResult('No files found.');
			}
			const lines = uris.map(uri => workspaceRelativePath(uri, folders));
			const suffix = uris.length >= maxResults ? `\n…(truncated to ${maxResults} results)` : '';
			return textResult(`${lines.join('\n')}${suffix}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error searching files: ${message}`);
		}
	}
}

class FindTextInFilesTool implements vscode.LanguageModelTool<FindTextInFilesInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<FindTextInFilesInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return textResult('Error: open a workspace folder before searching text.');
		}
		const query = options.input?.query ?? '';
		if (!query.trim()) {
			return textResult('Error: query is required.');
		}
		try {
			const maxResults = clampMaxResults(options.input?.maxResults);
			const hits = await findTextHits({ ...options.input, query, maxResults }, token);
			return textResult(formatTextHits(hits, hits.length >= maxResults));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error searching text: ${message}`);
		}
	}
}

class SearchWorkspaceSymbolsTool implements vscode.LanguageModelTool<SearchWorkspaceSymbolsInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<SearchWorkspaceSymbolsInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const symbolName = options.input?.symbolName?.trim() ?? '';
		if (!symbolName) {
			return textResult('Error: symbolName is required.');
		}
		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return textResult('Error: open a workspace folder before searching symbols.');
		}
		try {
			const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[] | undefined>(
				'vscode.executeWorkspaceSymbolProvider',
				symbolName,
			);
			if (token.isCancellationRequested) {
				return textResult('Search cancelled.');
			}
			const list = (symbols ?? []).slice(0, DEFAULT_MAX_RESULTS);
			if (list.length === 0) {
				return textResult('No symbols found.');
			}
			const lines = list.map(symbol => {
				const path = workspaceRelativePath(symbol.location.uri, folders);
				const line = symbol.location.range.start.line + 1;
				const container = symbol.containerName ? ` (${symbol.containerName})` : '';
				return `${symbol.name}${container} — ${path}:${line} [${vscode.SymbolKind[symbol.kind] ?? symbol.kind}]`;
			});
			if ((symbols?.length ?? 0) > list.length) {
				lines.push(`…(truncated to ${list.length} results)`);
			}
			return textResult(lines.join('\n'));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error searching symbols: ${message}`);
		}
	}
}

class GetErrorsTool implements vscode.LanguageModelTool<GetErrorsInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<GetErrorsInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return textResult('Error: open a workspace folder before reading problems.');
		}

		try {
			const filePaths = options.input?.filePaths;
			const diagnosticsByUri: Array<{ uri: vscode.Uri; diagnostics: readonly vscode.Diagnostic[] }> = [];

			if (filePaths === undefined) {
				const roots = folders.map(folder => folder.uri.fsPath);
				const all = vscode.languages.getDiagnostics();
				for (const [uri, diagnostics] of all) {
					if (diagnostics.length === 0) {
						continue;
					}
					const inWorkspace = uri.scheme === 'file'
						? isPathInsideWorkspaceRoot(uri.fsPath, roots)
						: folders.some(folder => uri.scheme === folder.uri.scheme && (uri.path === folder.uri.path || uri.path.startsWith(folder.uri.path.endsWith('/') ? folder.uri.path : `${folder.uri.path}/`)));
					if (!inWorkspace) {
						continue;
					}
					diagnosticsByUri.push({ uri, diagnostics });
				}
			} else if (filePaths.length === 0) {
				return textResult('No errors found.');
			} else {
				for (const filePath of filePaths) {
					const uri = resolveWorkspaceRelativePath(filePath, folders);
					if (!uri) {
						continue;
					}
					diagnosticsByUri.push({ uri, diagnostics: vscode.languages.getDiagnostics(uri) });
				}
			}

			const lines: string[] = [];
			for (const group of diagnosticsByUri) {
				for (const diagnostic of group.diagnostics) {
					if (lines.length >= DEFAULT_MAX_RESULTS) {
						break;
					}
					const severity = vscode.DiagnosticSeverity[diagnostic.severity] ?? String(diagnostic.severity);
					const path = workspaceRelativePath(group.uri, folders);
					const line = diagnostic.range.start.line + 1;
					const col = diagnostic.range.start.character + 1;
					lines.push(`${severity} ${path}:${line}:${col} ${truncateSnippet(diagnostic.message)}`);
				}
				if (lines.length >= DEFAULT_MAX_RESULTS) {
					break;
				}
			}

			if (lines.length === 0) {
				return textResult('No errors found.');
			}
			if (lines.length >= DEFAULT_MAX_RESULTS) {
				lines.push(`…(truncated to ${DEFAULT_MAX_RESULTS} results)`);
			}
			return textResult(lines.join('\n'));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error reading problems: ${message}`);
		}
	}
}

class GetChangedFilesTool implements vscode.LanguageModelTool<GetChangedFilesInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<GetChangedFilesInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return textResult('Error: open a workspace folder before listing changes.');
		}

		try {
			const extension = vscode.extensions.getExtension<GitExtension>('vscode.git');
			if (!extension) {
				return textResult('Git extension (vscode.git) is not available; cannot list changed files.');
			}
			const gitExtension = extension.isActive ? extension.exports : await extension.activate();
			if (!gitExtension?.enabled) {
				return textResult('Git extension is disabled; cannot list changed files.');
			}
			const api = gitExtension.getAPI(1);
			if (!api.repositories.length) {
				return textResult('No git repositories found in the workspace.');
			}

			let repository = api.repositories[0];
			const repositoryPath = options.input?.repositoryPath?.trim();
			if (repositoryPath) {
				const uri = resolveWorkspaceRelativePath(repositoryPath, folders);
				if (!uri) {
					return textResult('Error: repositoryPath must be inside an open workspace folder.');
				}
				const matched = api.repositories.find(repo =>
					uri.fsPath === repo.rootUri.fsPath || uri.fsPath.startsWith(repo.rootUri.fsPath + '/') || uri.fsPath.startsWith(repo.rootUri.fsPath + '\\'),
				);
				if (!matched) {
					return textResult(`No git repository found for path ${uri.fsPath}.`);
				}
				repository = matched;
			}

			const states = new Set(options.input?.sourceControlState ?? ['staged', 'unstaged', 'merge-conflicts']);
			const lines: string[] = [];
			const addChanges = (label: string, changes: readonly GitChange[]): void => {
				for (const change of changes) {
					if (lines.length >= DEFAULT_MAX_RESULTS) {
						return;
					}
					lines.push(`${label}\t${workspaceRelativePath(change.uri, folders)}\tstatus=${change.status}`);
				}
			};

			if (states.has('staged')) {
				addChanges('staged', repository.state.indexChanges);
			}
			if (states.has('unstaged')) {
				addChanges('unstaged', [...repository.state.workingTreeChanges, ...repository.state.untrackedChanges]);
			}
			if (states.has('merge-conflicts')) {
				addChanges('merge-conflicts', repository.state.mergeChanges);
			}

			if (lines.length === 0) {
				return textResult('No changed files.');
			}
			if (lines.length >= DEFAULT_MAX_RESULTS) {
				lines.push(`…(truncated to ${DEFAULT_MAX_RESULTS} results)`);
			}
			return textResult(lines.join('\n'));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error listing changed files: ${message}`);
		}
	}
}

class SearchCodebaseTool implements vscode.LanguageModelTool<SearchCodebaseInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<SearchCodebaseInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return textResult('Error: open a workspace folder before searching the codebase.');
		}
		const query = options.input?.query?.trim() ?? '';
		if (!query) {
			return textResult('Error: query is required.');
		}

		try {
			const tokens = query
				.split(/[\s,;]+/)
				.map(t => t.trim())
				.filter(t => t.length >= 2)
				.slice(0, 6);
			const searchTerms = tokens.length > 0 ? tokens : [query];
			const seen = new Set<string>();
			const hits: TextSearchHit[] = [];

			for (const term of searchTerms) {
				if (token.isCancellationRequested || hits.length >= DEFAULT_MAX_RESULTS) {
					break;
				}
				const remaining = DEFAULT_MAX_RESULTS - hits.length;
				const termHits = await findTextHits(
					{ query: term, isRegexp: false, maxResults: remaining },
					token,
				);
				for (const hit of termHits) {
					const key = `${hit.path}:${hit.line}:${hit.snippet}`;
					if (seen.has(key)) {
						continue;
					}
					seen.add(key);
					hits.push(hit);
					if (hits.length >= DEFAULT_MAX_RESULTS) {
						break;
					}
				}
			}

			if (hits.length === 0) {
				return textResult('No codebase matches found (text search; no Copilot index).');
			}
			const header = 'Codebase search results (enhanced text search; no Copilot index):';
			return textResult(`${header}\n${formatTextHits(hits, hits.length >= DEFAULT_MAX_RESULTS)}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error searching codebase: ${message}`);
		}
	}
}

/**
 * Registers workspace search/read LM tools. Caller owns the returned disposable.
 */
export function registerWorkspaceAgentTools(): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.lm.registerTool<FindFilesInput>(SAFEAPPEALS_FIND_FILES_TOOL, new FindFilesTool()),
		vscode.lm.registerTool<FindTextInFilesInput>(SAFEAPPEALS_FIND_TEXT_IN_FILES_TOOL, new FindTextInFilesTool()),
		vscode.lm.registerTool<SearchWorkspaceSymbolsInput>(SAFEAPPEALS_SEARCH_WORKSPACE_SYMBOLS_TOOL, new SearchWorkspaceSymbolsTool()),
		vscode.lm.registerTool<GetErrorsInput>(SAFEAPPEALS_GET_ERRORS_TOOL, new GetErrorsTool()),
		vscode.lm.registerTool<GetChangedFilesInput>(SAFEAPPEALS_GET_CHANGED_FILES_TOOL, new GetChangedFilesTool()),
		vscode.lm.registerTool<SearchCodebaseInput>(SAFEAPPEALS_SEARCH_CODEBASE_TOOL, new SearchCodebaseTool()),
	);
}

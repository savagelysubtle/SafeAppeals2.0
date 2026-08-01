/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import {
	AgentChatToolDescriptor,
	isPathInsideWorkspaceRoot,
	SAFEAPPEALS_LIST_DIR_TOOL,
	SAFEAPPEALS_READ_FILE_TOOL,
} from './toolAllowlist';

/**
 * Maps tool descriptors to {@link vscode.LanguageModelChatTool} for sendRequest.
 */
export function toLanguageModelChatTools(
	tools: readonly AgentChatToolDescriptor[],
): vscode.LanguageModelChatTool[] {
	return tools.map(tool => ({
		name: tool.name,
		description: tool.description,
		inputSchema: tool.inputSchema,
	}));
}

interface ReadFileInput {
	path: string;
}

interface ListDirInput {
	path?: string;
}

/**
 * Resolves a user/model path against workspace folders.
 * Returns undefined when no folder is open, the path is outside the workspace, or scheme mismatches.
 * Normalizes `..` segments. MVP does not resolve symlinks.
 */
export function resolveWorkspaceRelativePath(
	pathValue: string,
	workspaceFolders: readonly vscode.WorkspaceFolder[],
): vscode.Uri | undefined {
	if (!pathValue || typeof pathValue !== 'string') {
		return undefined;
	}
	const trimmed = pathValue.trim();
	if (!trimmed) {
		return undefined;
	}

	let candidate: vscode.Uri;
	try {
		if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
			candidate = vscode.Uri.parse(trimmed);
		} else if (trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)) {
			candidate = vscode.Uri.file(trimmed);
		} else if (workspaceFolders.length > 0) {
			candidate = vscode.Uri.joinPath(workspaceFolders[0].uri, trimmed);
		} else {
			candidate = vscode.Uri.file(trimmed);
		}
	} catch {
		return undefined;
	}

	const normalized = normalizeWorkspaceUri(candidate);
	if (!normalized) {
		return undefined;
	}

	// Fail closed: no open folder ⇒ no reads (do not allow arbitrary absolute paths).
	if (workspaceFolders.length === 0) {
		return undefined;
	}

	for (const folder of workspaceFolders) {
		if (normalized.scheme !== folder.uri.scheme) {
			continue;
		}
		if (isPathInsideWorkspaceRoot(normalized.fsPath, [folder.uri.fsPath])) {
			return normalized;
		}
	}
	return undefined;
}

/**
 * Collapse `..` / `.` in a file URI via path.resolve; for other schemes, posix-normalize the path.
 */
function normalizeWorkspaceUri(uri: vscode.Uri): vscode.Uri | undefined {
	try {
		if (uri.scheme === 'file') {
			return vscode.Uri.file(path.resolve(uri.fsPath));
		}
		const normalizedPath = path.posix.normalize(uri.path);
		// After posix.normalize, a leading `..` means the path escaped above the URI root.
		if (normalizedPath === '..' || normalizedPath.startsWith('../')) {
			return undefined;
		}
		return uri.with({ path: normalizedPath });
	} catch {
		return undefined;
	}
}

class ReadFileTool implements vscode.LanguageModelTool<ReadFileInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ReadFileInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const uri = resolveWorkspaceRelativePath(options.input?.path ?? '', folders);
		if (!uri) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('Error: path must be inside an open workspace folder.'),
			]);
		}
		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const text = Buffer.from(bytes).toString('utf8');
			const capped = text.length > 200_000 ? `${text.slice(0, 200_000)}\n…(truncated)` : text;
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(capped),
			]);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Error reading file: ${message}`),
			]);
		}
	}
}

class ListDirTool implements vscode.LanguageModelTool<ListDirInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ListDirInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const pathValue = options.input?.path?.trim() || '.';
		const uri = resolveWorkspaceRelativePath(pathValue, folders);
		if (!uri) {
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart('Error: path must be inside an open workspace folder.'),
			]);
		}
		try {
			const entries = await vscode.workspace.fs.readDirectory(uri);
			const lines = entries
				.sort((a, b) => a[0].localeCompare(b[0]))
				.map(([name, type]) => {
					const kind = type === vscode.FileType.Directory ? 'dir' : type === vscode.FileType.File ? 'file' : 'other';
					return `${kind}\t${name}`;
				});
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(lines.length ? lines.join('\n') : '(empty directory)'),
			]);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return new vscode.LanguageModelToolResult([
				new vscode.LanguageModelTextPart(`Error listing directory: ${message}`),
			]);
		}
	}
}

/**
 * Registers SafeAppeals MVP LM tools (read/list). Caller owns the returned disposable.
 */
export function registerSafeAppealsAgentTools(): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.lm.registerTool<ReadFileInput>(SAFEAPPEALS_READ_FILE_TOOL, new ReadFileTool()),
		vscode.lm.registerTool<ListDirInput>(SAFEAPPEALS_LIST_DIR_TOOL, new ListDirTool()),
	);
}

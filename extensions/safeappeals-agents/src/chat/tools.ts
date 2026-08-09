/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import type { ICloudApiClient } from '../cloudApiClient';
import { registerBraveSearchTools } from './braveSearchTools';
import { registerEditAgentTools } from './editTools';
import {
	AgentChatToolDescriptor,
	isPathInsideWorkspaceRoot,
	SAFEAPPEALS_CREATE_DIRECTORY_TOOL,
	SAFEAPPEALS_CREATE_FILE_TOOL,
	SAFEAPPEALS_EDIT_FILE_TOOL,
	SAFEAPPEALS_LIST_DIR_TOOL,
	SAFEAPPEALS_READ_FILE_TOOL,
	VSCODE_EDIT_FILE_TOOL,
} from './toolAllowlist';
import { registerCreatePlanTool } from './createPlanTool';
import { registerSwitchModeTool } from './switchModeTool';
import { registerWebAgentTools } from './webTools';
import { registerWorkspaceAgentTools } from './workspaceTools';

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

interface EditFileInput {
	explanation: string;
	filePath: string;
	code: string;
}

interface CreateFileInput {
	filePath: string;
	content: string;
}

interface CreateDirectoryInput {
	dirPath: string;
}

/**
 * Resolves a user/model path against workspace folders.
 * Returns undefined when no folder is open, the path is outside the workspace, or scheme mismatches.
 * Normalizes `..` segments. Does not resolve symlinks.
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

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

class ReadFileTool implements vscode.LanguageModelTool<ReadFileInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ReadFileInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const pathValue = options.input?.path ?? '';
		const uri = resolveWorkspaceRelativePath(pathValue, folders);
		if (!uri) {
			return textResult('Error: path must be inside an open workspace folder.');
		}
		const lower = uri.fsPath.toLowerCase();
		if (lower.endsWith('.docx') || lower.endsWith('.xlsx')) {
			const toolName = lower.endsWith('.docx') ? 'safeappeals_docx_read' : 'safeappeals_xlsx_read';
			try {
				return await vscode.lm.invokeTool(
					toolName,
					{ input: { path: pathValue }, toolInvocationToken: options.toolInvocationToken },
					token,
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return textResult(
					`Error: use ${toolName} for Office documents (document tools may be unavailable): ${message}`,
				);
			}
		}
		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const text = Buffer.from(bytes).toString('utf8');
			const capped = text.length > 200_000 ? `${text.slice(0, 200_000)}\n…(truncated)` : text;
			return textResult(capped);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error reading file: ${message}`);
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
			return textResult('Error: path must be inside an open workspace folder.');
		}
		try {
			const entries = await vscode.workspace.fs.readDirectory(uri);
			const lines = entries
				.sort((a, b) => a[0].localeCompare(b[0]))
				.map(([name, type]) => {
					const kind = type === vscode.FileType.Directory ? 'dir' : type === vscode.FileType.File ? 'file' : 'other';
					return `${kind}\t${name}`;
				});
			return textResult(lines.length ? lines.join('\n') : '(empty directory)');
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error listing directory: ${message}`);
		}
	}
}

class EditFileTool implements vscode.LanguageModelTool<EditFileInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<EditFileInput>,
		token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		if (folders.length === 0) {
			return textResult('Error: path must be inside an open workspace folder.');
		}
		const filePath = options.input?.filePath ?? '';
		const uri = resolveWorkspaceRelativePath(filePath, folders);
		if (!uri) {
			return textResult('Error: path must be inside an open workspace folder.');
		}
		const lower = uri.fsPath.toLowerCase();
		if (lower.endsWith('.docx') || lower.endsWith('.xlsx')) {
			const toolName = lower.endsWith('.docx') ? 'safeappeals_docx_edit' : 'safeappeals_xlsx_edit';
			return textResult(
				`Error: do not use safeappeals_editFile for Office documents. Use ${toolName} with structured operations (or body/editedText for DOCX).`,
			);
		}
		const explanation = options.input?.explanation ?? '';
		const code = options.input?.code ?? '';
		try {
			const result = await vscode.lm.invokeTool(
				VSCODE_EDIT_FILE_TOOL,
				{
					input: {
						uri,
						explanation,
						code,
					},
					toolInvocationToken: options.toolInvocationToken,
				},
				token,
			);
			return result;
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error editing file: ${message}`);
		}
	}
}

class CreateFileTool implements vscode.LanguageModelTool<CreateFileInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<CreateFileInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const uri = resolveWorkspaceRelativePath(options.input?.filePath ?? '', folders);
		if (!uri) {
			return textResult('Error: path must be inside an open workspace folder.');
		}
		try {
			try {
				const stat = await vscode.workspace.fs.stat(uri);
				if (stat.type & vscode.FileType.File) {
					return textResult(
						`Error: file already exists at ${uri.fsPath}. Use ${SAFEAPPEALS_EDIT_FILE_TOOL} (editFile) to modify existing files.`,
					);
				}
				if (stat.type & vscode.FileType.Directory) {
					return textResult(`Error: a directory already exists at ${uri.fsPath}.`);
				}
			} catch {
				// FileDoesNotExist — proceed to create.
			}

			const parent = vscode.Uri.joinPath(uri, '..');
			await vscode.workspace.fs.createDirectory(parent);
			const content = options.input?.content ?? '';
			await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
			return textResult(`Created file ${uri.fsPath}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error creating file: ${message}`);
		}
	}
}

class CreateDirectoryTool implements vscode.LanguageModelTool<CreateDirectoryInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<CreateDirectoryInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const uri = resolveWorkspaceRelativePath(options.input?.dirPath ?? '', folders);
		if (!uri) {
			return textResult('Error: path must be inside an open workspace folder.');
		}
		try {
			await vscode.workspace.fs.createDirectory(uri);
			return textResult(`Created directory ${uri.fsPath}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error creating directory: ${message}`);
		}
	}
}

/**
 * Registers SafeAppeals agent LM tools (read/list/edit/create, workspace search, replace/patch, web/command, cloud search).
 * Caller owns the returned disposable.
 */
export function registerSafeAppealsAgentTools(apiClient: ICloudApiClient): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.lm.registerTool<ReadFileInput>(SAFEAPPEALS_READ_FILE_TOOL, new ReadFileTool()),
		vscode.lm.registerTool<ListDirInput>(SAFEAPPEALS_LIST_DIR_TOOL, new ListDirTool()),
		vscode.lm.registerTool<EditFileInput>(SAFEAPPEALS_EDIT_FILE_TOOL, new EditFileTool()),
		vscode.lm.registerTool<CreateFileInput>(SAFEAPPEALS_CREATE_FILE_TOOL, new CreateFileTool()),
		vscode.lm.registerTool<CreateDirectoryInput>(SAFEAPPEALS_CREATE_DIRECTORY_TOOL, new CreateDirectoryTool()),
		registerWorkspaceAgentTools(),
		registerEditAgentTools(),
		registerWebAgentTools(),
		registerBraveSearchTools(apiClient),
		registerSwitchModeTool(),
		registerCreatePlanTool(),
	);
}

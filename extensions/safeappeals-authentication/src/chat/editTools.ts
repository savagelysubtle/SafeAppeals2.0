/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	applyHunkToText,
	parseSimplePatch,
	PatchFileOp,
	replaceOnce,
} from './patchHelpers';
import {
	SAFEAPPEALS_APPLY_PATCH_TOOL,
	SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL,
	SAFEAPPEALS_REPLACE_STRING_TOOL,
} from './toolAllowlist';
import { resolveWorkspaceRelativePath } from './tools';

export { applyHunkToText, parseSimplePatch } from './patchHelpers';

interface ReplaceStringInput {
	filePath: string;
	oldString: string;
	newString: string;
	explanation?: string;
}

interface MultiReplaceStringInput {
	explanation: string;
	replacements: ReplaceStringInput[];
}

interface ApplyPatchInput {
	input: string;
	explanation: string;
}

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

async function readWorkspaceText(uri: vscode.Uri): Promise<string> {
	const bytes = await vscode.workspace.fs.readFile(uri);
	return Buffer.from(bytes).toString('utf8');
}

async function writeWorkspaceText(uri: vscode.Uri, text: string): Promise<void> {
	const edit = new vscode.WorkspaceEdit();
	const docs = vscode.workspace.textDocuments.filter(d => d.uri.toString() === uri.toString());
	const openDoc = docs[0];
	if (openDoc) {
		const fullRange = new vscode.Range(openDoc.positionAt(0), openDoc.positionAt(openDoc.getText().length));
		edit.replace(uri, fullRange, text);
		const applied = await vscode.workspace.applyEdit(edit);
		if (!applied) {
			throw new Error('WorkspaceEdit was not applied.');
		}
		return;
	}
	await vscode.workspace.fs.writeFile(uri, Buffer.from(text, 'utf8'));
}

async function applyExactReplace(
	filePath: string,
	oldString: string,
	newString: string,
): Promise<{ ok: true; path: string } | { ok: false; error: string }> {
	const folders = vscode.workspace.workspaceFolders ?? [];
	const uri = resolveWorkspaceRelativePath(filePath, folders);
	if (!uri) {
		return { ok: false, error: 'path must be inside an open workspace folder.' };
	}
	try {
		const current = await readWorkspaceText(uri);
		const replaced = replaceOnce(current, oldString, newString);
		if (!replaced.ok) {
			return { ok: false, error: `${uri.fsPath}: ${replaced.error}` };
		}
		await writeWorkspaceText(uri, replaced.text);
		return { ok: true, path: uri.fsPath };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return { ok: false, error: `${uri.fsPath}: ${message}` };
	}
}

async function applyParsedPatch(ops: readonly PatchFileOp[]): Promise<string> {
	const folders = vscode.workspace.workspaceFolders ?? [];
	if (folders.length === 0) {
		return 'Error: path must be inside an open workspace folder.';
	}
	if (ops.length === 0) {
		return 'Error: no patch file operations found. Expected *** Begin Patch with Add/Update/Delete File sections.';
	}

	const results: string[] = [];
	for (const op of ops) {
		const uri = resolveWorkspaceRelativePath(op.path, folders);
		if (!uri) {
			results.push(`Error: ${op.path} is outside the workspace.`);
			continue;
		}
		try {
			if (op.action === 'delete') {
				await vscode.workspace.fs.delete(uri, { useTrash: false });
				results.push(`Deleted ${uri.fsPath}.`);
				continue;
			}
			if (op.action === 'add') {
				const parent = vscode.Uri.joinPath(uri, '..');
				await vscode.workspace.fs.createDirectory(parent);
				const content = op.addLines.join('\n');
				await vscode.workspace.fs.writeFile(uri, Buffer.from(content.endsWith('\n') ? content : `${content}\n`, 'utf8'));
				results.push(`Added ${uri.fsPath}.`);
				continue;
			}

			let text = await readWorkspaceText(uri);
			let hunkFailed = false;
			for (const hunk of op.hunks) {
				const applied = applyHunkToText(text, hunk.lines);
				if (!applied.ok) {
					results.push(`Error updating ${uri.fsPath}: ${applied.error}`);
					hunkFailed = true;
					break;
				}
				text = applied.text;
			}
			if (hunkFailed) {
				continue;
			}
			let targetUri = uri;
			if (op.moveTo) {
				const moveUri = resolveWorkspaceRelativePath(op.moveTo, folders);
				if (!moveUri) {
					results.push(`Error: move target ${op.moveTo} is outside the workspace.`);
					continue;
				}
				await writeWorkspaceText(moveUri, text);
				await vscode.workspace.fs.delete(uri, { useTrash: false });
				targetUri = moveUri;
			} else {
				await writeWorkspaceText(uri, text);
			}
			results.push(`Updated ${targetUri.fsPath} (${op.hunks.length} hunk(s)).`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			results.push(`Error on ${op.path}: ${message}`);
		}
	}
	return results.join('\n');
}

class ReplaceStringTool implements vscode.LanguageModelTool<ReplaceStringInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ReplaceStringInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const input = options.input;
		if (!input?.filePath || input.oldString === undefined || input.newString === undefined) {
			return textResult('Error: filePath, oldString, and newString are required.');
		}
		const result = await applyExactReplace(input.filePath, input.oldString, input.newString);
		if (!result.ok) {
			return textResult(`Error: ${result.error}`);
		}
		return textResult(`Replaced one occurrence in ${result.path}.`);
	}
}

class MultiReplaceStringTool implements vscode.LanguageModelTool<MultiReplaceStringInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<MultiReplaceStringInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const replacements = options.input?.replacements;
		if (!Array.isArray(replacements) || replacements.length === 0) {
			return textResult('Error: replacements must be a non-empty array.');
		}
		const lines: string[] = [];
		let success = 0;
		let failed = 0;
		for (let i = 0; i < replacements.length; i++) {
			const r = replacements[i];
			if (!r?.filePath || r.oldString === undefined || r.newString === undefined) {
				failed++;
				lines.push(`[${i}] Error: filePath, oldString, and newString are required.`);
				continue;
			}
			const result = await applyExactReplace(r.filePath, r.oldString, r.newString);
			if (!result.ok) {
				failed++;
				lines.push(`[${i}] Error: ${result.error}`);
			} else {
				success++;
				lines.push(`[${i}] OK: ${result.path}`);
			}
		}
		return textResult(`Multi-replace complete: ${success} succeeded, ${failed} failed.\n${lines.join('\n')}`);
	}
}

class ApplyPatchTool implements vscode.LanguageModelTool<ApplyPatchInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<ApplyPatchInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const patch = options.input?.input;
		if (typeof patch !== 'string' || patch.trim().length === 0) {
			return textResult('Error: input patch string is required.');
		}
		try {
			const ops = parseSimplePatch(patch);
			const summary = await applyParsedPatch(ops);
			return textResult(summary);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error applying patch: ${message}`);
		}
	}
}

/**
 * Registers replace / multi-replace / apply-patch agent tools.
 */
export function registerEditAgentTools(): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.lm.registerTool<ReplaceStringInput>(SAFEAPPEALS_REPLACE_STRING_TOOL, new ReplaceStringTool()),
		vscode.lm.registerTool<MultiReplaceStringInput>(SAFEAPPEALS_MULTI_REPLACE_STRING_TOOL, new MultiReplaceStringTool()),
		vscode.lm.registerTool<ApplyPatchInput>(SAFEAPPEALS_APPLY_PATCH_TOOL, new ApplyPatchTool()),
	);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { DocxApplyEditOp, DocxEditorProvider } from './docx/docxEditorProvider';
import {
	applyDocxOpsHeadless,
	containsReplaceSelectionOps,
	REPLACE_SELECTION_REQUIRES_EDITOR,
} from './docx/docxXmlEdit';
import { createDocxBuffer, DocxBlock, DocxCreateContent } from './docx/docxWriter';
import { extractTextFromDocxBytes } from './docx/docxTextExtract';
import { XlsxEditorProvider } from './xlsx/xlsxEditorProvider';
import {
	describeXlsxEditOperations,
	findUnsupportedXlsxEditOpTypes,
	normalizeXlsxEditOperations,
} from './xlsx/xlsxEditOperations';
import { applyXlsxOpsHeadless, readWorkbookHeadless } from './xlsx/xlsxHeadless';
import { configureXlsxHostWasm } from './xlsx/xlsxHostWasm';
import {
	createXlsxBuffer,
	XlsxCellValue,
	XlsxCreateContent,
	XlsxSheetContent,
} from './xlsx/xlsxWriter';
import {
	buildDocumentChatOpenOptions,
	type DocumentChatPayload,
} from './documentChatOpenOptions';
import {
	chooseDocumentEditPath,
	DOCUMENT_NOT_READY_DIRTY_ERROR,
	SELECTION_REQUIRES_OPEN_READY_ERROR,
	type DocumentEditOpKind,
	type DocumentEditPath,
} from './documentEditPath';
import { runDocumentInlineEdit } from './inlineEditRunner';
import { isPathInsideWorkspaceRoot, normalizeUriPath } from './workspacePath';

export {
	buildDocumentChatOpenOptions,
	type DocumentChatAttachPaste,
	type DocumentChatOpenOptions,
	type DocumentChatPayload,
} from './documentChatOpenOptions';
export {
	chooseDocumentEditPath,
	DOCUMENT_NOT_READY_DIRTY_ERROR,
	SELECTION_REQUIRES_OPEN_READY_ERROR,
	type DocumentEditOpKind,
	type DocumentEditPath,
} from './documentEditPath';

const WEBVIEW_READY_TIMEOUT_MS = 8_000;

interface DocumentEditorGate {
	isOpen(uri: vscode.Uri): boolean;
	isReady(uri: vscode.Uri): boolean;
	isDirty(uri: vscode.Uri): boolean;
	awaitReady(uri: vscode.Uri, timeoutMs?: number): Promise<boolean>;
	reloadFromBytes(uri: vscode.Uri, bytes: Uint8Array): boolean;
}

/**
 * Await webview readiness when open-but-not-ready, then choose open/headless/error.
 */
async function resolveDocumentEditPath(
	provider: DocumentEditorGate | undefined,
	uri: vscode.Uri,
	opKind: DocumentEditOpKind,
	readyTimeoutMs = WEBVIEW_READY_TIMEOUT_MS,
): Promise<DocumentEditPath> {
	if (!provider?.isOpen(uri)) {
		return chooseDocumentEditPath({
			isOpen: false,
			isReady: false,
			isDirty: false,
			opKind,
		});
	}
	let isReady = provider.isReady(uri);
	if (!isReady) {
		isReady = await provider.awaitReady(uri, readyTimeoutMs);
	}
	return chooseDocumentEditPath({
		isOpen: true,
		isReady,
		isDirty: provider.isDirty(uri),
		opKind,
	});
}

export const SAFEAPPEALS_DOCX_READ_TOOL = 'safeappeals_docx_read';
export const SAFEAPPEALS_DOCX_CREATE_TOOL = 'safeappeals_docx_create';
export const SAFEAPPEALS_DOCX_EDIT_TOOL = 'safeappeals_docx_edit';
export const SAFEAPPEALS_XLSX_READ_TOOL = 'safeappeals_xlsx_read';
export const SAFEAPPEALS_XLSX_CREATE_TOOL = 'safeappeals_xlsx_create';
export const SAFEAPPEALS_XLSX_EDIT_TOOL = 'safeappeals_xlsx_edit';
export const SAFEAPPEALS_OPEN_DOCUMENT_TOOL = 'safeappeals_openDocument';

interface PathInput {
	path: string;
}

interface DocxCreateInput {
	path: string;
	title?: string;
	body?: string;
	blocks?: DocxBlock[];
}

interface DocxEditInput {
	path: string;
	operations?: DocxApplyEditOp[];
	/** When set with a stored selection, posts applyInlineEdit. */
	editedText?: string;
	/** Headless overwrite body when the file is not open. */
	body?: string;
	title?: string;
	blocks?: DocxBlock[];
	useLastSelection?: boolean;
}

/** DOCX title/blocks overwrite (no ops / selection); body-only uses replaceAll ops instead. */
function isDocxOverwriteInput(input: DocxEditInput): boolean {
	if (input.operations && input.operations.length > 0) {
		return false;
	}
	if (input.editedText) {
		return false;
	}
	return !!(input.title || input.blocks);
}

interface XlsxCreateInput {
	path: string;
	sheetName?: string;
	tsv?: string;
	rows?: Array<Array<XlsxCellValue>>;
	sheets?: XlsxSheetContent[];
}

interface XlsxEditInput {
	path: string;
	operations: unknown[];
}

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

/**
 * Resolves a user/model path against workspace folders.
 * Fail closed: no open folder ⇒ undefined. Paths must stay inside a workspace root.
 */
export function resolveWorkspaceRelativePath(
	pathValue: string,
	workspaceFolders: readonly vscode.WorkspaceFolder[],
): vscode.Uri | undefined {
	if (!pathValue || typeof pathValue !== 'string') {
		return undefined;
	}
	const trimmed = pathValue.trim();
	if (!trimmed || workspaceFolders.length === 0) {
		return undefined;
	}

	let candidate: vscode.Uri;
	try {
		if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
			candidate = vscode.Uri.parse(trimmed);
		} else if (trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)) {
			candidate = vscode.Uri.file(trimmed);
		} else {
			candidate = vscode.Uri.joinPath(workspaceFolders[0].uri, trimmed);
		}
	} catch {
		return undefined;
	}

	const normalized = normalizeResolvedUri(candidate);
	if (!normalized) {
		return undefined;
	}

	for (const folder of workspaceFolders) {
		if (normalized.scheme !== folder.uri.scheme) {
			continue;
		}
		if (normalized.scheme === 'file') {
			if (isPathInsideWorkspaceRoot(normalized.fsPath, [folder.uri.fsPath])) {
				return normalized;
			}
		} else {
			const folderPath = folder.uri.path.endsWith('/')
				? folder.uri.path
				: folder.uri.path + '/';
			if (normalized.path === folder.uri.path || normalized.path.startsWith(folderPath)) {
				return normalized;
			}
		}
	}
	return undefined;
}

function normalizeResolvedUri(uri: vscode.Uri): vscode.Uri | undefined {
	try {
		if (uri.scheme === 'file') {
			return vscode.Uri.file(path.resolve(uri.fsPath));
		}
		const normalizedPath = normalizeUriPath(uri.path);
		if (!normalizedPath) {
			return undefined;
		}
		return uri.with({ path: normalizedPath });
	} catch {
		return undefined;
	}
}

async function ensureParentDir(uri: vscode.Uri): Promise<void> {
	const parent = vscode.Uri.joinPath(uri, '..');
	try {
		await vscode.workspace.fs.createDirectory(parent);
	} catch {
		// Directory may already exist.
	}
}

class DocxReadTool implements vscode.LanguageModelTool<PathInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<PathInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const uri = resolveWorkspaceRelativePath(options.input?.path ?? '', folders);
		if (!uri) {
			return textResult('Error: path must be inside an open workspace folder.');
		}

		const provider = DocxEditorProvider.instance;
		const pathDecision = await resolveDocumentEditPath(provider, uri, 'read');
		if (pathDecision === 'error') {
			return textResult(`Error: ${DOCUMENT_NOT_READY_DIRTY_ERROR}`);
		}
		if (pathDecision === 'open' && provider) {
			const text = await provider.requestTextAndWait(uri);
			if (typeof text === 'string') {
				return textResult(capText(text));
			}
			return textResult('Error: open DOCX editor did not return text.');
		}

		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const text = await extractTextFromDocxBytes(bytes);
			return textResult(capText(text));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error reading DOCX: ${message}`);
		}
	}
}

class DocxCreateTool implements vscode.LanguageModelTool<DocxCreateInput> {
	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<DocxCreateInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const target = options.input?.path ?? '(unknown)';
		return {
			invocationMessage: `Creating DOCX ${target}`,
			confirmationMessages: {
				title: 'Create DOCX',
				message: `Create or overwrite workspace file:\n${target}`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<DocxCreateInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const uri = resolveWorkspaceRelativePath(options.input?.path ?? '', folders);
		if (!uri) {
			return textResult('Error: path must be inside an open workspace folder.');
		}
		if (!uri.path.toLowerCase().endsWith('.docx')) {
			return textResult('Error: path must end with .docx');
		}

		const content: DocxCreateContent = {
			title: options.input.title,
			body: options.input.body,
			blocks: options.input.blocks,
		};

		try {
			const bytes = await createDocxBuffer(content);
			await ensureParentDir(uri);
			await vscode.workspace.fs.writeFile(uri, bytes);

			const provider = DocxEditorProvider.instance;
			if (provider?.isOpen(uri)) {
				provider.reloadFromBytes(uri, bytes);
			}

			return textResult(`Created DOCX at ${vscode.workspace.asRelativePath(uri)}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error creating DOCX: ${message}`);
		}
	}
}

class DocxEditTool implements vscode.LanguageModelTool<DocxEditInput> {
	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<DocxEditInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const target = options.input?.path ?? '(unknown)';
		const opCount = options.input?.operations?.length
			?? (options.input?.editedText || options.input?.body ? 1 : 0);
		return {
			invocationMessage: `Editing DOCX ${target}`,
			confirmationMessages: {
				title: 'Edit DOCX',
				message: `Apply ${opCount} edit(s) to:\n${target}`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<DocxEditInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const uri = resolveWorkspaceRelativePath(options.input?.path ?? '', folders);
		if (!uri) {
			return textResult('Error: path must be inside an open workspace folder.');
		}

		const provider = DocxEditorProvider.instance;
		const input = options.input;
		const wantsSelectionEdit = !!(
			input.editedText
			&& (input.useLastSelection || provider?.lastSelection?.uri === uri.toString())
		);
		const hasReplaceSelection = !!(
			input.operations
			&& input.operations.length > 0
			&& containsReplaceSelectionOps(input.operations)
		);
		const wantsOverwrite = isDocxOverwriteInput(input);

		let opKind: DocumentEditOpKind;
		if (wantsSelectionEdit || hasReplaceSelection) {
			opKind = 'selection';
		} else if (wantsOverwrite) {
			opKind = 'overwrite';
		} else {
			opKind = 'structured';
		}

		const pathDecision = await resolveDocumentEditPath(provider, uri, opKind);
		if (pathDecision === 'error') {
			if (opKind === 'selection') {
				return textResult(`Error: ${SELECTION_REQUIRES_OPEN_READY_ERROR}`);
			}
			return textResult(`Error: ${DOCUMENT_NOT_READY_DIRTY_ERROR}`);
		}

		// Open + ready path: TipTap apply (selection or structured ops).
		if (pathDecision === 'open' && provider) {
			if (wantsSelectionEdit && input.editedText) {
				const applyResult = await provider.postApplyInlineEdit(uri, input.editedText);
				if (!applyResult.ok) {
					return textResult(`Error: ${applyResult.error ?? 'failed to apply inline edit to open DOCX editor.'}`);
				}
				return textResult('Applied inline edit to open DOCX and saved.');
			}

			const ops = normalizeDocxOps(input);
			if (ops.length === 0) {
				return textResult('Error: provide operations[], editedText, or body/blocks to edit.');
			}
			const result = await provider.applyEditsAndWait(uri, ops, { save: true });
			return textResult(result.ok
				? `Applied ${ops.length} edit(s) to open DOCX and saved.`
				: `Error applying DOCX edits: ${result.error ?? 'unknown'}`);
		}

		// Headless path (closed, open-not-ready-clean, or clean title/blocks overwrite).
		if (hasReplaceSelection || (input.editedText && input.useLastSelection)) {
			return textResult(`Error: ${REPLACE_SELECTION_REQUIRES_EDITOR}`);
		}

		if (input.operations && input.operations.length > 0) {
			try {
				const existing = await vscode.workspace.fs.readFile(uri);
				const applied = await applyDocxOpsHeadless(existing, input.operations);
				await vscode.workspace.fs.writeFile(uri, applied.bytes);

				const providerAfter = DocxEditorProvider.instance;
				if (providerAfter?.isOpen(uri)) {
					providerAfter.reloadFromBytes(uri, applied.bytes);
				}

				return textResult(
					`Applied DOCX operation(s) headlessly at ${vscode.workspace.asRelativePath(uri)} and saved.` +
					`\nResults: ${JSON.stringify(applied.results)}`,
				);
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				return textResult(`Error editing DOCX headlessly: ${message}`);
			}
		}

		if (!input.body && !input.blocks && !input.title && !input.editedText) {
			return textResult(
				'Provide operations[] (replaceAll, appendParagraph, appendHeading, insertAtEnd), ' +
				'or title/body/blocks to overwrite. Edits work with the editor open or closed; ' +
				'replaceSelection / useLastSelection require an open editor with a selection.',
			);
		}

		try {
			const bytes = await createDocxBuffer({
				title: input.title,
				body: input.body ?? input.editedText,
				blocks: input.blocks,
			});
			await vscode.workspace.fs.writeFile(uri, bytes);

			const providerAfter = DocxEditorProvider.instance;
			if (providerAfter?.isOpen(uri)) {
				providerAfter.reloadFromBytes(uri, bytes);
			}

			return textResult(
				`Overwrote DOCX headlessly at ${vscode.workspace.asRelativePath(uri)}.`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error editing DOCX headlessly: ${message}`);
		}
	}
}

function normalizeDocxOps(input: DocxEditInput): DocxApplyEditOp[] {
	if (input.operations && input.operations.length > 0) {
		return input.operations;
	}
	if (input.editedText) {
		return [{ type: 'insertAtEnd', text: input.editedText }];
	}
	if (input.body) {
		return [{ type: 'replaceAll', text: input.body }];
	}
	return [];
}

/**
 * Open a workspace document in the Safe Appeals custom viewer when applicable.
 */
class OpenDocumentTool implements vscode.LanguageModelTool<PathInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<PathInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const uri = resolveWorkspaceRelativePath(options.input?.path ?? '', folders);
		if (!uri) {
			return textResult('Error: path must be inside an open workspace folder.');
		}

		const lower = uri.path.toLowerCase();
		try {
			if (lower.endsWith('.docx')) {
				await vscode.commands.executeCommand('vscode.openWith', uri, DocxEditorProvider.viewType);
				return textResult(`Opened ${uri.fsPath} in Safe Appeals DOCX viewer.`);
			}
			if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
				await vscode.commands.executeCommand('vscode.openWith', uri, XlsxEditorProvider.viewType);
				return textResult(`Opened ${uri.fsPath} in Safe Appeals XLSX viewer.`);
			}
			await vscode.commands.executeCommand('vscode.open', uri);
			return textResult(`Opened ${uri.fsPath}.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error opening document: ${message}`);
		}
	}
}

class XlsxReadTool implements vscode.LanguageModelTool<PathInput> {
	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<PathInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const uri = resolveWorkspaceRelativePath(options.input?.path ?? '', folders);
		if (!uri) {
			return textResult('Error: path must be inside an open workspace folder.');
		}

		const provider = XlsxEditorProvider.instance;
		const pathDecision = await resolveDocumentEditPath(provider, uri, 'read');
		if (pathDecision === 'error') {
			return textResult(`Error: ${DOCUMENT_NOT_READY_DIRTY_ERROR}`);
		}
		if (pathDecision === 'open' && provider) {
			const text = await provider.requestTextAndWait(uri);
			if (typeof text === 'string') {
				const selectionNote = provider.lastSelection?.uri === uri.toString() && provider.lastSelection.valuesTsv
					? `\n\n--- Current selection ---\n${provider.lastSelection.valuesTsv}`
					: '';
				return textResult(capText(text + selectionNote));
			}
			return textResult('Error: open XLSX editor did not return text.');
		}

		try {
			const bytes = await vscode.workspace.fs.readFile(uri);
			const text = await readWorkbookHeadless(bytes);
			return textResult(capText(text));
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(
				`Error reading XLSX headlessly: ${message}. ` +
				'If WASM failed to load, open the file in the Safe Appeals XLSX editor and retry.',
			);
		}
	}
}

class XlsxCreateTool implements vscode.LanguageModelTool<XlsxCreateInput> {
	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<XlsxCreateInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const target = options.input?.path ?? '(unknown)';
		return {
			invocationMessage: `Creating XLSX ${target}`,
			confirmationMessages: {
				title: 'Create XLSX',
				message: `Create or overwrite workspace file:\n${target}`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<XlsxCreateInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const uri = resolveWorkspaceRelativePath(options.input?.path ?? '', folders);
		if (!uri) {
			return textResult('Error: path must be inside an open workspace folder.');
		}
		if (!uri.path.toLowerCase().endsWith('.xlsx')) {
			return textResult('Error: path must end with .xlsx');
		}

		const content: XlsxCreateContent = {
			sheetName: options.input.sheetName,
			tsv: options.input.tsv,
			rows: options.input.rows,
			sheets: options.input.sheets,
		};

		try {
			const bytes = await createXlsxBuffer(content);
			await ensureParentDir(uri);
			await vscode.workspace.fs.writeFile(uri, bytes);

			const provider = XlsxEditorProvider.instance;
			if (provider?.isOpen(uri)) {
				provider.reloadFromBytes(uri, bytes);
			}

			return textResult(`Created XLSX at ${vscode.workspace.asRelativePath(uri)}`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error creating XLSX: ${message}`);
		}
	}
}

class XlsxEditTool implements vscode.LanguageModelTool<XlsxEditInput> {
	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<XlsxEditInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const target = options.input?.path ?? '(unknown)';
		const opCount = options.input?.operations?.length ?? 0;
		return {
			invocationMessage: `Editing XLSX ${target}`,
			confirmationMessages: {
				title: 'Edit XLSX',
				message: `Apply ${opCount} spreadsheet operation(s) to:\n${target}`,
			},
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<XlsxEditInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		const folders = vscode.workspace.workspaceFolders ?? [];
		const uri = resolveWorkspaceRelativePath(options.input?.path ?? '', folders);
		if (!uri) {
			return textResult('Error: path must be inside an open workspace folder.');
		}
		const rawOperations = options.input?.operations;
		if (!Array.isArray(rawOperations) || rawOperations.length === 0) {
			return textResult(
				'Error: operations must be a non-empty array. ' +
				`Supported types: ${describeXlsxEditOperations()}.`,
			);
		}

		const operations = normalizeXlsxEditOperations(rawOperations);
		const unsupported = findUnsupportedXlsxEditOpTypes(operations);
		if (unsupported.length > 0) {
			return textResult(
				`Error: unsupported XLSX edit operation type(s): ${unsupported.join(', ')}. ` +
				`Supported types: ${describeXlsxEditOperations()}.`,
			);
		}

		const provider = XlsxEditorProvider.instance;
		const pathDecision = await resolveDocumentEditPath(provider, uri, 'structured');
		if (pathDecision === 'error') {
			return textResult(`Error: ${DOCUMENT_NOT_READY_DIRTY_ERROR}`);
		}

		if (pathDecision === 'open' && provider) {
			const result = await provider.applyEditsAndWait(uri, operations, { save: true });
			if (!result.ok) {
				// Never fall through to headless — that would clobber dirty webview state.
				return textResult(
					`Error applying XLSX edits: ${result.error ?? 'unknown'}. ` +
					`Supported types: ${describeXlsxEditOperations()}.`,
				);
			}
			return textResult(
				`Applied ${operations.length} operation(s) to open XLSX and saved.` +
				(result.results ? `\nResults: ${JSON.stringify(result.results)}` : ''),
			);
		}

		try {
			const existing = await vscode.workspace.fs.readFile(uri);
			const applied = await applyXlsxOpsHeadless(existing, operations);
			const failed = applied.results.filter(r => !r.ok);
			if (failed.length > 0 && failed.length === applied.results.length) {
				return textResult(
					`Error applying XLSX edits headlessly: ${failed[0]?.error ?? 'unknown'}. ` +
					`Supported types: ${describeXlsxEditOperations()}.\nResults: ${JSON.stringify(applied.results)}`,
				);
			}
			await vscode.workspace.fs.writeFile(uri, applied.bytes);

			const providerAfter = XlsxEditorProvider.instance;
			if (providerAfter?.isOpen(uri)) {
				providerAfter.reloadFromBytes(uri, applied.bytes);
			}

			return textResult(
				`Applied ${operations.length} operation(s) headlessly to XLSX and saved.` +
				`\nResults: ${JSON.stringify(applied.results)}`,
			);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(
				`Error editing XLSX headlessly: ${message}. ` +
				'If WASM failed to load, open the file in the Safe Appeals XLSX editor and retry.',
			);
		}
	}
}

function capText(text: string, max = 200_000): string {
	if (text.length <= max) {
		return text;
	}
	return `${text.slice(0, max)}\n…(truncated)`;
}

async function openChatWithDocumentSelection(
	payload: DocumentChatPayload | undefined,
	mode: 'edit' | 'attach',
): Promise<void> {
	const text = payload?.text?.trim() ?? '';
	const instructions = payload?.instructions?.trim() ?? '';
	const uri = payload?.uri ? vscode.Uri.parse(payload.uri) : undefined;
	const uriLabel = uri
		? vscode.workspace.asRelativePath(uri)
		: 'open document';
	const fileName = uri
		? path.basename(uri.fsPath || uri.path)
		: 'document';
	const pathLower = (uri?.fsPath ?? uriLabel).toLowerCase();
	const isXlsx = payload?.kind === 'xlsx'
		|| pathLower.endsWith('.xlsx')
		|| pathLower.endsWith('.xls');

	const built = buildDocumentChatOpenOptions(payload, mode, { uriLabel, fileName });
	const attachFiles = built.attachFiles?.map(u => vscode.Uri.parse(u));
	const attachPaste = built.attachPaste?.map(entry => ({
		...entry,
		copiedFrom: entry.copiedFrom
			? {
				uri: vscode.Uri.parse(entry.copiedFrom.uri),
				range: entry.copiedFrom.range,
			}
			: undefined,
	}));

	try {
		await vscode.commands.executeCommand('workbench.action.chat.open', {
			query: built.query,
			isPartialQuery: built.isPartialQuery,
			attachFiles,
			attachPaste,
		});
		return;
	} catch {
		// Fall through when chat is unavailable.
	}

	const preview = text.length > 240 ? `${text.slice(0, 240)}…` : text;
	if (mode === 'attach') {
		await vscode.window.showInformationMessage(
			text
				? `Selection ready for chat (${text.length} chars):\n"${preview}"`
				: 'No text selection to add to chat.',
		);
		return;
	}

	const toolHint = isXlsx
		? 'Use safeappeals_xlsx_edit to apply a replacement.'
		: 'Use safeappeals_docx_edit with editedText and useLastSelection to apply a replacement.';
	const message = instructions
		? `Inline edit requested for selection (${text.length} chars):\n"${preview}"\n\nInstructions: ${instructions}\n\n${toolHint}`
		: `Selection captured (${text.length} chars):\n"${preview}"\n\n${toolHint}`;
	await vscode.window.showInformationMessage(message);
}

/**
 * Host-side Ctrl+K: show the in-document inline-edit popup on the *active*
 * custom editor only (does not open chat; no cross-type fallback).
 */
async function showInlineEditPopupCommand(): Promise<void> {
	const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
	const input = tab?.input;
	if (!(input instanceof vscode.TabInputCustom)) {
		return;
	}
	if (input.viewType === DocxEditorProvider.viewType) {
		DocxEditorProvider.instance?.showInlineEditPopup();
		return;
	}
	if (input.viewType === XlsxEditorProvider.viewType) {
		XlsxEditorProvider.instance?.showInlineEditPopup();
	}
}

/**
 * Register LM tools and the inline-edit / add-to-chat bridge commands.
 */
export function registerAgentTools(context: vscode.ExtensionContext): void {
	configureXlsxHostWasm(context.extensionUri);
	context.subscriptions.push(
		vscode.lm.registerTool<PathInput>(SAFEAPPEALS_DOCX_READ_TOOL, new DocxReadTool()),
		vscode.lm.registerTool<DocxCreateInput>(SAFEAPPEALS_DOCX_CREATE_TOOL, new DocxCreateTool()),
		vscode.lm.registerTool<DocxEditInput>(SAFEAPPEALS_DOCX_EDIT_TOOL, new DocxEditTool()),
		vscode.lm.registerTool<PathInput>(SAFEAPPEALS_XLSX_READ_TOOL, new XlsxReadTool()),
		vscode.lm.registerTool<XlsxCreateInput>(SAFEAPPEALS_XLSX_CREATE_TOOL, new XlsxCreateTool()),
		vscode.lm.registerTool<XlsxEditInput>(SAFEAPPEALS_XLSX_EDIT_TOOL, new XlsxEditTool()),
		vscode.lm.registerTool<PathInput>(SAFEAPPEALS_OPEN_DOCUMENT_TOOL, new OpenDocumentTool()),
		vscode.commands.registerCommand(
			'safeappeals.documents.showInlineEdit',
			async () => showInlineEditPopupCommand(),
		),
		vscode.commands.registerCommand(
			'safeappeals.documents.inlineEdit',
			async (payload?: DocumentChatPayload) => runDocumentInlineEdit(payload),
		),
		vscode.commands.registerCommand(
			'safeappeals.documents.addToChat',
			async (payload?: DocumentChatPayload) => openChatWithDocumentSelection(payload, 'attach'),
		),
	);
}

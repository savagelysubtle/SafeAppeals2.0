/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { DocumentChatPayload } from './documentChatOpenOptions';
import { DocxEditorProvider } from './docx/docxEditorProvider';
import {
	buildXlsxSetCellOpsFromEditedText,
	normalizeDocxInlineEditHtml,
	pickInlineEditModel,
	stripMarkdownFences,
} from './inlineEditHelpers';
import {
	beginInlineEditSession,
	endInlineEditSession,
} from './inlineEditSession';
import { XlsxEditorProvider } from './xlsx/xlsxEditorProvider';

export {
	buildXlsxSetCellOpsFromEditedText,
	normalizeDocxInlineEditHtml,
	parseA1Range,
	pickInlineEditModel,
	PREFERRED_INLINE_EDIT_MODEL_IDS,
	stripMarkdownFences,
	modelIdMatches,
	type InlineEditModelRef,
	type XlsxSetCellValueOp,
} from './inlineEditHelpers';

export { cancelDocumentInlineEdit } from './inlineEditSession';

const INLINE_EDIT_SYSTEM_XLSX = [
	'You are an inline editing assistant. Rewrite the selection per the user\'s instructions.',
	'Return ONLY the replacement text — no preamble, no markdown code fences unless the original selection used them.',
].join(' ');

const INLINE_EDIT_SYSTEM_DOCX = [
	'You are an inline editing assistant for a TipTap rich-text document editor.',
	'Rewrite the selection per the user\'s instructions.',
	'Return ONLY an HTML fragment that TipTap can insert via insertContent.',
	'Use these tags as needed: <strong>, <em>, <u>, <s>, <br>, <p>.',
	'NEVER use Markdown (no **bold**, *italic*, __bold__, _italic_, or # headings).',
	'No preamble, no markdown code fences, no explanation — only the replacement HTML/text.',
].join(' ');

export async function selectInlineEditModel(): Promise<vscode.LanguageModelChat | undefined> {
	const cloud = await vscode.lm.selectChatModels({ vendor: 'safeappeals-cloud' });
	if (cloud.length > 0) {
		return pickInlineEditModel(cloud) ?? cloud[0];
	}
	const all = await vscode.lm.selectChatModels();
	if (all.length === 0) {
		return undefined;
	}
	return pickInlineEditModel(all) ?? all[0];
}

export async function requestEditedText(
	model: vscode.LanguageModelChat,
	selection: string,
	instructions: string,
	kind: 'docx' | 'xlsx',
	token?: vscode.CancellationToken,
	selectionHtml?: string,
): Promise<string> {
	const kindHint = kind === 'xlsx'
		? 'The selection is spreadsheet cell text (TSV with tabs/newlines for multi-cell ranges). Preserve TSV structure when editing multiple cells.'
		: 'The selection is document text/HTML. Preserve existing formatting when the instructions do not ask to change it.';

	const promptParts = [
		kind === 'docx' ? INLINE_EDIT_SYSTEM_DOCX : INLINE_EDIT_SYSTEM_XLSX,
		kindHint,
		'',
		'INSTRUCTIONS:',
		instructions.trim() || '(no additional instructions — improve clarity while preserving meaning)',
		'',
		'SELECTION:',
		selection,
	];

	if (kind === 'docx' && selectionHtml?.trim()) {
		promptParts.push('', 'SELECTION_HTML:', selectionHtml.trim());
	}

	const userPrompt = promptParts.join('\n');

	const response = await model.sendRequest(
		[vscode.LanguageModelChatMessage.User(userPrompt)],
		{},
		token,
	);

	let text = '';
	for await (const chunk of response.text) {
		if (token?.isCancellationRequested) {
			throw new vscode.CancellationError();
		}
		text += chunk;
	}

	if (kind === 'docx') {
		return normalizeDocxInlineEditHtml(text, selection);
	}
	return stripMarkdownFences(text, selection);
}

/**
 * Ctrl+K path: call a chat model and apply the replacement in-place (never opens chat).
 */
export async function runDocumentInlineEdit(payload: DocumentChatPayload | undefined): Promise<void> {
	const selection = payload?.text ?? '';
	const selectionHtml = payload?.html;
	const instructions = payload?.instructions?.trim() ?? '';
	const uriString = payload?.uri;
	if (!uriString) {
		await vscode.window.showErrorMessage('Inline edit failed: missing document URI.');
		return;
	}
	if (!selection.trim()) {
		await vscode.window.showErrorMessage('Inline edit failed: no text selection.');
		return;
	}
	if (!instructions) {
		await vscode.window.showErrorMessage('Inline edit failed: enter edit instructions.');
		return;
	}

	let uri: vscode.Uri;
	try {
		uri = vscode.Uri.parse(uriString);
	} catch {
		await vscode.window.showErrorMessage('Inline edit failed: invalid document URI.');
		return;
	}

	const pathLower = (uri.fsPath || uri.path || uriString).toLowerCase();
	const kind: 'docx' | 'xlsx' = payload?.kind === 'xlsx'
		|| pathLower.endsWith('.xlsx')
		|| pathLower.endsWith('.xls')
		? 'xlsx'
		: 'docx';

	const cts = beginInlineEditSession(uriString);
	const token = cts.token;

	postToEditor(uri, kind, { type: 'inlineEditStarted' });

	try {
		const model = await selectInlineEditModel();
		if (token.isCancellationRequested) {
			return;
		}
		if (!model) {
			const message = 'No language model available for inline edit. Sign in to SafeAppeals Cloud or enable a chat model.';
			postToEditor(uri, kind, { type: 'inlineEditFailed', message });
			await vscode.window.showErrorMessage(message);
			return;
		}

		let editedText: string;
		try {
			editedText = await requestEditedText(model, selection, instructions, kind, token, selectionHtml);
		} catch (error) {
			if (token.isCancellationRequested || error instanceof vscode.CancellationError) {
				return;
			}
			const message = error instanceof Error ? error.message : String(error);
			postToEditor(uri, kind, { type: 'inlineEditFailed', message });
			await vscode.window.showErrorMessage(`Inline edit failed: ${message}`);
			return;
		}

		if (token.isCancellationRequested) {
			return;
		}

		if (!editedText.trim() && selection.trim()) {
			const message = 'Inline edit returned empty text.';
			postToEditor(uri, kind, { type: 'inlineEditFailed', message });
			await vscode.window.showErrorMessage(message);
			return;
		}

		if (kind === 'docx') {
			const provider = DocxEditorProvider.instance;
			if (!provider?.isOpen(uri)) {
				throw new Error('DOCX editor is not open for this file.');
			}
			const applyResult = await provider.postApplyInlineEdit(uri, editedText);
			if (token.isCancellationRequested) {
				return;
			}
			if (!applyResult.ok) {
				const message = applyResult.error ?? 'Failed to apply inline edit in the DOCX editor.';
				postToEditor(uri, kind, { type: 'inlineEditFailed', message });
				await vscode.window.showErrorMessage(`Inline edit failed: ${message}`);
				return;
			}
			postToEditor(uri, kind, { type: 'inlineEditComplete' });
			return;
		}

		const provider = XlsxEditorProvider.instance;
		if (!provider?.isOpen(uri)) {
			throw new Error('XLSX editor is not open for this file.');
		}
		const ops = buildXlsxSetCellOpsFromEditedText(editedText, {
			sheet: payload?.sheet,
			range: payload?.range,
		});
		const result = await provider.applyEditsAndWait(uri, ops, { save: true });
		if (token.isCancellationRequested) {
			return;
		}
		if (!result.ok) {
			throw new Error(result.error ?? 'Failed to apply XLSX edits.');
		}
		postToEditor(uri, kind, { type: 'inlineEditComplete' });
	} catch (error) {
		if (token.isCancellationRequested || error instanceof vscode.CancellationError) {
			return;
		}
		const message = error instanceof Error ? error.message : String(error);
		postToEditor(uri, kind, { type: 'inlineEditFailed', message });
		await vscode.window.showErrorMessage(`Inline edit failed: ${message}`);
	} finally {
		endInlineEditSession(uriString, cts);
	}
}

function postToEditor(uri: vscode.Uri, kind: 'docx' | 'xlsx', message: Record<string, unknown>): void {
	const panel = kind === 'xlsx'
		? XlsxEditorProvider.instance?.findPanel(uri)
		: DocxEditorProvider.instance?.findPanel(uri);
	panel?.webview.postMessage(message);
}

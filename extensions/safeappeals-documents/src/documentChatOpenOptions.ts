/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

export interface DocumentChatPayload {
	uri?: string;
	text?: string;
	html?: string;
	instructions?: string;
	kind?: 'docx' | 'xlsx';
	sheet?: string;
	range?: string;
}

export interface DocumentChatAttachPaste {
	name: string;
	code: string;
	language: string;
	fileName: string;
	pastedLines: string;
	copiedFrom?: {
		uri: string;
		range: {
			startLineNumber: number;
			startColumn: number;
			endLineNumber: number;
			endColumn: number;
		};
	};
}

export interface DocumentChatOpenOptions {
	query: string;
	isPartialQuery: true;
	attachFiles?: string[];
	attachPaste?: DocumentChatAttachPaste[];
}

/**
 * Build workbench.action.chat.open options for document selection (pure; unit-tested).
 * Attach mode keeps the query light and puts the selection in attachPaste pills.
 */
export function buildDocumentChatOpenOptions(
	payload: DocumentChatPayload | undefined,
	mode: 'edit' | 'attach',
	labels?: { uriLabel?: string; fileName?: string },
): DocumentChatOpenOptions {
	const text = payload?.text?.trim() ?? '';
	const instructions = payload?.instructions?.trim() ?? '';
	const uriLabel = labels?.uriLabel
		?? (payload?.uri ? basenameFromUriString(payload.uri) : 'open document');
	const fileName = labels?.fileName ?? basenameFromUriString(payload?.uri ?? uriLabel);
	const pathLower = (payload?.uri ?? uriLabel).toLowerCase();
	const isXlsx = payload?.kind === 'xlsx'
		|| pathLower.endsWith('.xlsx')
		|| pathLower.endsWith('.xls');
	const selectionCap = text.length > 4000 ? `${text.slice(0, 4000)}\n…(truncated)` : text;
	const lineCount = selectionCap
		? selectionCap.split(/\r?\n/).length
		: 0;
	const pastedLines = lineCount === 1 ? '1 line' : `${Math.max(lineCount, 0)} lines`;

	let query: string;
	if (mode === 'attach') {
		// Pill-only: leave the input empty so the attachment chip is the context.
		query = '';
	} else if (isXlsx) {
		const lines = [
			'@safeappeals Edit the XLSX selection.',
			`File: ${uriLabel}`,
			payload?.sheet ? `Sheet: ${payload.sheet}` : undefined,
			payload?.range ? `Range: ${payload.range}` : undefined,
			'When ready, call safeappeals_xlsx_edit (edits work with the editor open or closed).',
			instructions ? `User instructions: ${instructions}` : undefined,
		].filter((line): line is string => line !== undefined);
		query = lines.join('\n');
	} else {
		const lines = [
			'@safeappeals Edit the DOCX selection.',
			`File: ${uriLabel}`,
			'When ready, call safeappeals_docx_edit with editedText and useLastSelection=true (selection edits need the editor open with a selection; other edits work open or closed).',
			instructions ? `User instructions: ${instructions}` : undefined,
		].filter((line): line is string => line !== undefined);
		query = lines.join('\n');
	}

	const attachFiles = payload?.uri ? [payload.uri] : undefined;
	let attachPaste: DocumentChatAttachPaste[] | undefined;
	if (selectionCap) {
		const rangeLabel = payload?.sheet
			? `${payload.sheet}${payload.range ? `!${payload.range}` : ''}`
			: undefined;
		const pasteName = rangeLabel ? `${fileName} ${rangeLabel}` : `${fileName} ${pastedLines}`;
		attachPaste = [{
			name: pasteName,
			code: selectionCap,
			language: isXlsx ? 'plaintext' : 'markdown',
			fileName: uriLabel,
			pastedLines: rangeLabel ?? pastedLines,
			copiedFrom: payload?.uri
				? {
					uri: payload.uri,
					range: {
						startLineNumber: 1,
						startColumn: 1,
						endLineNumber: Math.max(1, lineCount),
						endColumn: 1,
					},
				}
				: undefined,
		}];
	}

	return {
		query,
		isPartialQuery: true,
		attachFiles,
		attachPaste,
	};
}

function basenameFromUriString(uriOrPath: string): string {
	const trimmed = uriOrPath.trim();
	if (!trimmed) {
		return 'document';
	}
	const withoutQuery = trimmed.split('?')[0].split('#')[0];
	let pathPart = withoutQuery;
	const schemeMatch = withoutQuery.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:(?:\/\/)?(.*)$/);
	if (schemeMatch) {
		pathPart = schemeMatch[1];
		// file:///C:/Users/... → C:/Users/...
		if (/^\/[A-Za-z]:/.test(pathPart)) {
			pathPart = pathPart.slice(1);
		}
	}
	const normalized = pathPart.replace(/\\/g, '/');
	const parts = normalized.split('/').filter(Boolean);
	return parts[parts.length - 1] || 'document';
}

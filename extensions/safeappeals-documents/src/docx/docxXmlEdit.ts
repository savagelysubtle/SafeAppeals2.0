/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Headless DOCX structured edits via JSZip surgery on word/document.xml.
 * Preserves all other zip parts (styles, images, headers, numbering).
 * replaceSelection requires an open TipTap editor and is rejected here.
 */

import JSZip from 'jszip';

export interface DocxXmlEditOp {
	type: 'appendParagraph' | 'appendHeading' | 'replaceSelection' | 'replaceAll' | 'insertAtEnd';
	text: string;
	level?: number;
}

export interface DocxXmlEditResult {
	bytes: Uint8Array;
	results: Array<{ type: string; ok: boolean; error?: string }>;
}

const SECTPR_OPEN = '<w:sectPr';
const SECTPR_CLOSE = '</w:sectPr>';

/**
 * True when `index` points at a real `<w:sectPr` tag (not `<w:sectPrChange`, etc.).
 * Next character after the name must be whitespace, `>`, or `/`.
 */
export function isSectPrTagBoundary(xml: string, index: number): boolean {
	if (!xml.startsWith(SECTPR_OPEN, index)) {
		return false;
	}
	const next = xml.charAt(index + SECTPR_OPEN.length);
	return next === ' ' || next === '\t' || next === '\n' || next === '\r' || next === '>' || next === '/';
}

/**
 * End index (exclusive) of a sectPr element starting at `openIdx`, or -1.
 * Handles `<w:sectPr …/>` and `<w:sectPr…>...</w:sectPr>`.
 */
function sectPrEndExclusive(xml: string, openIdx: number): number {
	if (!isSectPrTagBoundary(xml, openIdx)) {
		return -1;
	}
	const gt = xml.indexOf('>', openIdx);
	if (gt < 0) {
		return -1;
	}
	// Self-closing: …/>
	if (xml.charAt(gt - 1) === '/') {
		return gt + 1;
	}
	const closeIdx = xml.indexOf(SECTPR_CLOSE, gt + 1);
	if (closeIdx < 0) {
		return -1;
	}
	return closeIdx + SECTPR_CLOSE.length;
}

/**
 * Index of the trailing body-level `<w:sectPr` whose close is followed only by
 * whitespace then `</w:body>`. Mid-document sectPr (e.g. inside `<w:pPr>`) is skipped.
 * Returns -1 when none.
 */
export function findTrailingBodySectPrStart(documentXml: string): number {
	const bodyClose = documentXml.lastIndexOf('</w:body>');
	if (bodyClose < 0) {
		return -1;
	}

	let searchFrom = bodyClose;
	while (searchFrom > 0) {
		const idx = documentXml.lastIndexOf(SECTPR_OPEN, searchFrom - 1);
		if (idx < 0) {
			return -1;
		}
		if (!isSectPrTagBoundary(documentXml, idx)) {
			searchFrom = idx;
			continue;
		}
		const end = sectPrEndExclusive(documentXml, idx);
		if (end < 0 || end > bodyClose) {
			searchFrom = idx;
			continue;
		}
		const between = documentXml.slice(end, bodyClose);
		if (/^\s*$/.test(between)) {
			return idx;
		}
		searchFrom = idx;
	}
	return -1;
}

/**
 * Strip XML 1.0 illegal control characters, then escape entities.
 */
export function escapeXml(text: string): string {
	return text
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Build one or more `<w:p>` paragraphs from plain text (one per line).
 */
export function buildParagraphXml(text: string, headingLevel?: number): string {
	const lines = text.length === 0 ? [''] : text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	const style = headingLevel !== undefined
		? `<w:pPr><w:pStyle w:val="Heading${Math.min(4, Math.max(1, headingLevel))}"/></w:pPr>`
		: '';
	return lines.map(line => (
		`<w:p>${style}<w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`
	)).join('');
}

/**
 * Split replaceAll body into paragraphs (blank-line chunks, then lines) — matches docxWriter.
 */
export function paragraphsXmlFromReplaceAllText(text: string): string {
	const trimmed = (text ?? '').trim();
	if (!trimmed) {
		return '<w:p><w:r><w:t xml:space="preserve"></w:t></w:r></w:p>';
	}
	const chunks = trimmed.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean);
	const parts: string[] = [];
	for (const chunk of chunks) {
		for (const line of chunk.split('\n')) {
			parts.push(buildParagraphXml(line));
		}
	}
	return parts.join('');
}

/**
 * Insert XML before trailing body-level `<w:sectPr>` if present, else before `</w:body>`.
 * Does not treat mid-document `<w:pPr><w:sectPr>` as the insert anchor.
 */
export function insertBeforeBodyEnd(documentXml: string, insertXml: string): string {
	const trailingStart = findTrailingBodySectPrStart(documentXml);
	if (trailingStart >= 0) {
		return (
			documentXml.slice(0, trailingStart) +
			insertXml +
			documentXml.slice(trailingStart)
		);
	}
	const bodyClose = documentXml.lastIndexOf('</w:body>');
	if (bodyClose < 0) {
		throw new Error('DOCX document.xml is missing </w:body>');
	}
	return documentXml.slice(0, bodyClose) + insertXml + documentXml.slice(bodyClose);
}

/**
 * Replace all w:body children except the trailing body-level sectPr with new paragraph XML.
 * Mid-document section breaks inside paragraphs are discarded with the old body content.
 */
export function replaceBodyContent(documentXml: string, paragraphsXml: string): string {
	const bodyOpen = documentXml.search(/<w:body[^>]*>/i);
	if (bodyOpen < 0) {
		throw new Error('DOCX document.xml is missing <w:body>');
	}
	const openEnd = documentXml.indexOf('>', bodyOpen) + 1;
	const bodyClose = documentXml.lastIndexOf('</w:body>');
	if (bodyClose < 0 || bodyClose < openEnd) {
		throw new Error('DOCX document.xml is missing </w:body>');
	}

	const trailingAbs = findTrailingBodySectPrStart(documentXml);
	let sectPr = '';
	if (trailingAbs >= openEnd && trailingAbs < bodyClose) {
		const end = sectPrEndExclusive(documentXml, trailingAbs);
		if (end > trailingAbs && end <= bodyClose) {
			sectPr = documentXml.slice(trailingAbs, end);
		}
	}

	return documentXml.slice(0, openEnd) + paragraphsXml + sectPr + documentXml.slice(bodyClose);
}

/**
 * Apply structured DOCX ops via document.xml surgery. Fail closed: throws before
 * mutating the zip when document.xml is missing or malformed for an op.
 */
/** Clear error when replaceSelection is attempted without an open editor selection. */
export const REPLACE_SELECTION_REQUIRES_EDITOR =
	'replaceSelection requires an open editor with a selection';

export interface DocxSelectionRange {
	from: number;
	to: number;
}

/**
 * Resolve a non-collapsed range for replaceSelection.
 * Prefers pending inline-edit capture over the live TipTap selection.
 * Returns null when neither provides a usable range — webview must fail closed
 * (never insertContent/append). Mirrored in docxViewerTiptap.js applyDocxEdits.
 */
export function resolveReplaceSelectionRange(
	pending: DocxSelectionRange | null | undefined,
	editorSelection: DocxSelectionRange | null | undefined,
): DocxSelectionRange | null {
	if (pending && pending.from !== pending.to) {
		return { from: pending.from, to: pending.to };
	}
	if (editorSelection && editorSelection.from !== editorSelection.to) {
		return { from: editorSelection.from, to: editorSelection.to };
	}
	return null;
}

/**
 * True when every op is replaceSelection (cannot succeed headlessly).
 */
export function isOnlyReplaceSelectionOps(operations: readonly { type?: string }[]): boolean {
	return operations.length > 0 && operations.every(op => op.type === 'replaceSelection');
}

/** True when any op is replaceSelection (mixed batches must use the open-editor path). */
export function containsReplaceSelectionOps(operations: readonly { type?: string }[]): boolean {
	return operations.some(op => op.type === 'replaceSelection');
}

export async function applyDocxOpsHeadless(
	bytes: Uint8Array,
	operations: readonly DocxXmlEditOp[],
): Promise<DocxXmlEditResult> {
	if (!operations.length) {
		throw new Error('No DOCX operations to apply.');
	}

	// Fail closed before any zip mutation — do not partially apply other ops.
	if (containsReplaceSelectionOps(operations)) {
		throw new Error(REPLACE_SELECTION_REQUIRES_EDITOR);
	}

	const zip = await JSZip.loadAsync(bytes);
	const entry = zip.file('word/document.xml');
	if (!entry) {
		throw new Error('DOCX is missing word/document.xml');
	}
	let documentXml = await entry.async('string');
	const results: DocxXmlEditResult['results'] = [];

	for (const op of operations) {
		const type = op.type;
		const text = typeof op.text === 'string' ? op.text : '';
		try {
			switch (type) {
				case 'replaceSelection':
					results.push({
						type,
						ok: false,
						error: REPLACE_SELECTION_REQUIRES_EDITOR,
					});
					break;
				case 'replaceAll':
					documentXml = replaceBodyContent(documentXml, paragraphsXmlFromReplaceAllText(text));
					results.push({ type, ok: true });
					break;
				case 'appendHeading': {
					const level = Math.min(4, Math.max(1, Number(op.level) || 1));
					documentXml = insertBeforeBodyEnd(documentXml, buildParagraphXml(text, level));
					results.push({ type, ok: true });
					break;
				}
				case 'appendParagraph':
				case 'insertAtEnd':
					documentXml = insertBeforeBodyEnd(documentXml, buildParagraphXml(text));
					results.push({ type, ok: true });
					break;
				default:
					results.push({
						type: (op as { type: string }).type,
						ok: false,
						error: `Unsupported DOCX operation type: ${(op as { type: string }).type}`,
					});
			}
		} catch (e: unknown) {
			results.push({
				type,
				ok: false,
				error: e instanceof Error ? e.message : String(e),
			});
		}
	}

	const anyOk = results.some(r => r.ok);
	if (!anyOk) {
		const first = results.find(r => !r.ok);
		throw new Error(first?.error ?? 'All DOCX headless operations failed');
	}

	zip.file('word/document.xml', documentXml);
	const out = await zip.generateAsync({
		type: 'uint8array',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 },
	});
	return { bytes: out, results };
}

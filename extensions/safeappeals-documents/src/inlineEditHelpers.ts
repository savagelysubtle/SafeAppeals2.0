/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Mid-tier GPT preferred for simple in-document edits (catalog July 2026). */
export const PREFERRED_INLINE_EDIT_MODEL_IDS = [
	'gpt-5.6-terra',
	'gpt-5.2',
	'gpt-5.4',
	'gpt-4.1',
	'gpt-4o',
	'gpt-4.1-mini',
	'gpt-4o-mini',
] as const;

const GPT4_FAMILY_RE = /gpt-4(?:\.1|o)?/i;
const LITE_MODEL_RE = /(?:nano|mini)/i;

export interface InlineEditModelRef {
	id: string;
	family?: string;
	vendor?: string;
	name?: string;
}

export interface XlsxSetCellValueOp {
	type: 'set_cell_value';
	sheet?: string;
	cell: string;
	value: string;
}

/**
 * Strip a single outer markdown fence when the model wrapped the answer but the
 * original selection was not fenced.
 */
export function stripMarkdownFences(editedText: string, originalSelection: string): string {
	const text = editedText.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
	const trimmed = text.trim();
	if (!trimmed) {
		return '';
	}

	const selectionHadFence = /```/.test(originalSelection);
	if (selectionHadFence) {
		return trimmed;
	}

	const fenceMatch = trimmed.match(/^```(?:[^\n`]*)?\n([\s\S]*?)\n```$/);
	if (fenceMatch) {
		return fenceMatch[1];
	}

	const inlineFence = trimmed.match(/^```(?:\w+)?\s*([\s\S]*?)\s*```$/);
	if (inlineFence) {
		return inlineFence[1];
	}

	return trimmed;
}

const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*>/;
const MD_BOLD_RE = /\*\*[^*]+?\*\*|__[^_]+?__/;
const MD_ITALIC_STAR_RE = /(^|[^*])\*([^*\n]+?)\*([^*]|$)/;
const MD_ITALIC_UNDER_RE = /(^|[^_])_([^_\n]+?)_([^_]|$)/;

/**
 * Normalize DOCX inline-edit model output for TipTap `insertContent`.
 * Strips fences, then converts common Markdown emphasis to HTML when the
 * result is not already HTML-tagged.
 */
export function normalizeDocxInlineEditHtml(edited: string, originalSelection: string): string {
	const stripped = stripMarkdownFences(edited, originalSelection);
	if (!stripped) {
		return '';
	}
	if (HTML_TAG_RE.test(stripped)) {
		return stripped;
	}
	const looksLikeMd =
		MD_BOLD_RE.test(stripped)
		|| MD_ITALIC_STAR_RE.test(stripped)
		|| MD_ITALIC_UNDER_RE.test(stripped);
	if (!looksLikeMd) {
		return stripped;
	}

	let out = stripped;
	out = out.replace(/\*\*([^*]+?)\*\*/g, '<strong>$1</strong>');
	out = out.replace(/__([^_]+?)__/g, '<strong>$1</strong>');
	out = out.replace(/\*([^*]+?)\*/g, '<em>$1</em>');
	out = out.replace(/_([^_]+?)_/g, '<em>$1</em>');
	return out;
}

/**
 * Parse an A1-style range (optionally `Sheet!A1:B2`) into inclusive cell coords.
 */
export function parseA1Range(range: string): {
	sheet?: string;
	startCol: number;
	startRow: number;
	endCol: number;
	endRow: number;
} | undefined {
	const raw = range.trim();
	if (!raw) {
		return undefined;
	}

	let sheet: string | undefined;
	let cellPart = raw;
	const bang = raw.lastIndexOf('!');
	if (bang >= 0) {
		sheet = raw.slice(0, bang).replace(/^'|'$/g, '');
		cellPart = raw.slice(bang + 1);
	}

	const match = cellPart.match(/^([A-Za-z]+)(\d+)(?::([A-Za-z]+)(\d+))?$/);
	if (!match) {
		return undefined;
	}

	const startCol = columnLettersToIndex(match[1]);
	const startRow = Number(match[2]);
	const endCol = match[3] ? columnLettersToIndex(match[3]) : startCol;
	const endRow = match[4] ? Number(match[4]) : startRow;
	if (
		!Number.isFinite(startCol) || startCol < 0
		|| !Number.isFinite(endCol) || endCol < 0
		|| !Number.isFinite(startRow) || startRow < 1
		|| !Number.isFinite(endRow) || endRow < 1
	) {
		return undefined;
	}

	return {
		sheet,
		startCol: Math.min(startCol, endCol),
		startRow: Math.min(startRow, endRow),
		endCol: Math.max(startCol, endCol),
		endRow: Math.max(startRow, endRow),
	};
}

/**
 * Build row-major `set_cell_value` ops from edited TSV/text for a selected range.
 */
export function buildXlsxSetCellOpsFromEditedText(
	editedText: string,
	options: { sheet?: string; range?: string },
): XlsxSetCellValueOp[] {
	const rangeRaw = options.range?.trim() ?? '';
	if (!rangeRaw) {
		throw new Error('XLSX inline edit requires a selection range.');
	}

	const parsed = parseA1Range(rangeRaw);
	if (!parsed) {
		throw new Error(`Invalid XLSX range: ${rangeRaw}`);
	}

	const sheet = options.sheet?.trim() || parsed.sheet;
	const text = editedText.replace(/\r\n/g, '\n');
	const rows = Math.max(1, parsed.endRow - parsed.startRow + 1);
	const cols = Math.max(1, parsed.endCol - parsed.startCol + 1);

	if (rows === 1 && cols === 1) {
		return [{
			type: 'set_cell_value',
			...(sheet ? { sheet } : {}),
			cell: `${indexToColumnLetters(parsed.startCol)}${parsed.startRow}`,
			value: text,
		}];
	}

	const lines = text.split('\n');
	const ops: XlsxSetCellValueOp[] = [];
	for (let r = 0; r < rows; r++) {
		const line = lines[r] ?? '';
		const cells = line.split('\t');
		for (let c = 0; c < cols; c++) {
			ops.push({
				type: 'set_cell_value',
				...(sheet ? { sheet } : {}),
				cell: `${indexToColumnLetters(parsed.startCol + c)}${parsed.startRow + r}`,
				value: cells[c] ?? '',
			});
		}
	}
	return ops;
}

/**
 * Pure model picker used by selectInlineEditModel (unit-tested).
 *
 * Order: preferred mid-tier ids → gpt-4 / gpt-4o / gpt-4.1 family (non-mini first)
 * → first entry in the provided list.
 */
export function pickInlineEditModel<T extends InlineEditModelRef>(models: readonly T[]): T | undefined {
	if (models.length === 0) {
		return undefined;
	}

	for (const preferred of PREFERRED_INLINE_EDIT_MODEL_IDS) {
		const match = models.find(m => modelIdMatches(m.id, preferred) || m.name === preferred);
		if (match) {
			return match;
		}
	}

	const gpt4 = models.filter(m =>
		GPT4_FAMILY_RE.test(m.id) || (m.family ? GPT4_FAMILY_RE.test(m.family) : false));
	if (gpt4.length > 0) {
		const nonLite = gpt4.filter(m => !LITE_MODEL_RE.test(m.id) && !(m.family && LITE_MODEL_RE.test(m.family)));
		return nonLite[0] ?? gpt4[0];
	}

	return models[0];
}

/** Effort/size suffixes allowed after a preferred catalog id (`terra` → `terra-medium`). */
const MODEL_ID_EFFORT_SUFFIX_RE = /^(?:medium|high|low|xhigh|max|small|large)$/i;

/**
 * Match preferred catalog ids to concrete model ids, including effort/size suffixes
 * (`gpt-5.6-terra` → `gpt-5.6-terra-medium`) via hyphen/underscore segment prefix.
 * Does not match unrelated ids (`terra` ↛ `terracotta`) or variant families
 * (`gpt-4o` ↛ `gpt-4o-mini` — those are separate preferred entries).
 */
export function modelIdMatches(modelId: string, preferred: string): boolean {
	if (!modelId || !preferred) {
		return false;
	}
	if (modelId === preferred) {
		return true;
	}
	if (modelId.endsWith(`/${preferred}`) || modelId.endsWith(`:${preferred}`)) {
		return true;
	}

	const normalizedId = stripModelIdVendorPrefix(modelId);
	const normalizedPreferred = stripModelIdVendorPrefix(preferred);
	if (normalizedId === normalizedPreferred) {
		return true;
	}

	const idSegs = normalizedId.split(/[-_]/).filter(Boolean);
	const prefSegs = normalizedPreferred.split(/[-_]/).filter(Boolean);
	if (prefSegs.length === 0 || prefSegs.length >= idSegs.length) {
		return false;
	}
	if (!prefSegs.every((seg, i) => idSegs[i] === seg)) {
		return false;
	}
	const rest = idSegs.slice(prefSegs.length);
	return rest.length > 0 && rest.every(seg => MODEL_ID_EFFORT_SUFFIX_RE.test(seg));
}

function stripModelIdVendorPrefix(modelId: string): string {
	let id = modelId;
	const slash = id.lastIndexOf('/');
	if (slash >= 0) {
		id = id.slice(slash + 1);
	}
	const colon = id.lastIndexOf(':');
	if (colon >= 0) {
		id = id.slice(colon + 1);
	}
	return id;
}

function columnLettersToIndex(letters: string): number {
	let n = 0;
	const upper = letters.toUpperCase();
	for (let i = 0; i < upper.length; i++) {
		const code = upper.charCodeAt(i);
		if (code < 65 || code > 90) {
			return -1;
		}
		n = n * 26 + (code - 64);
	}
	return n - 1;
}

function indexToColumnLetters(index: number): string {
	let n = index + 1;
	let out = '';
	while (n > 0) {
		const rem = (n - 1) % 26;
		out = String.fromCharCode(65 + rem) + out;
		n = Math.floor((n - 1) / 26);
	}
	return out;
}

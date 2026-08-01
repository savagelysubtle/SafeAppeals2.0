/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import JSZip from 'jszip';

export type XlsxCellValue = string | number | boolean | null | undefined;

export interface XlsxSheetContent {
	name?: string;
	/** Row-major values; numbers stay numbers, else strings. */
	rows?: Array<Array<XlsxCellValue>>;
	/** Alternative: TSV (tabs + newlines) → rows. */
	tsv?: string;
}

export interface XlsxCreateContent {
	sheets?: XlsxSheetContent[];
	/** Convenience single-sheet rows when sheets omitted. */
	rows?: Array<Array<XlsxCellValue>>;
	tsv?: string;
	sheetName?: string;
}

export interface NormalizedXlsxSheet {
	name: string;
	rows: Array<Array<XlsxCellValue>>;
}

/**
 * Parse TSV into a row-major string grid.
 */
export function tsvToRows(tsv: string): string[][] {
	if (!tsv) {
		return [];
	}
	const normalized = tsv.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalized.endsWith('\n')
		? normalized.slice(0, -1).split('\n')
		: normalized.split('\n');
	if (lines.length === 1 && lines[0] === '') {
		return [];
	}
	return lines.map(line => line.split('\t'));
}

/**
 * Sanitize an Excel sheet name: strip invalid chars, cap at 31, ensure non-empty.
 */
export function sanitizeSheetName(raw: string | undefined, fallback: string): string {
	const cleaned = (raw ?? '')
		.replace(/[\\/?*[\]]/g, '')
		.trim()
		.slice(0, 31);
	return cleaned || fallback;
}

/**
 * Normalize create content into at least one named sheet with unique names.
 */
export function normalizeSheets(content: XlsxCreateContent): NormalizedXlsxSheet[] {
	const used = new Set<string>();
	const uniqueName = (desired: string): string => {
		let name = desired;
		let n = 2;
		while (used.has(name.toLowerCase())) {
			const suffix = ` (${n})`;
			name = (desired.slice(0, Math.max(0, 31 - suffix.length)) + suffix).slice(0, 31);
			n++;
		}
		used.add(name.toLowerCase());
		return name;
	};

	const fromSheet = (sheet: XlsxSheetContent, index: number): NormalizedXlsxSheet => {
		const fallback = `Sheet${index + 1}`;
		const name = uniqueName(sanitizeSheetName(sheet.name, fallback));
		let rows: Array<Array<XlsxCellValue>>;
		if (sheet.rows && sheet.rows.length > 0) {
			rows = sheet.rows;
		} else if (typeof sheet.tsv === 'string') {
			rows = tsvToRows(sheet.tsv);
		} else {
			rows = sheet.rows ?? [];
		}
		return { name, rows };
	};

	if (content.sheets && content.sheets.length > 0) {
		return content.sheets.map((sheet, i) => fromSheet(sheet, i));
	}

	const hasTopLevel =
		(content.rows && content.rows.length > 0)
		|| typeof content.tsv === 'string'
		|| !!content.sheetName;

	if (hasTopLevel || content.rows) {
		return [fromSheet({
			name: content.sheetName,
			rows: content.rows,
			tsv: content.tsv,
		}, 0)];
	}

	return [{ name: uniqueName('Sheet1'), rows: [] }];
}

function escapeXml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function colLetters(index: number): string {
	let n = index;
	let result = '';
	do {
		result = String.fromCharCode(65 + (n % 26)) + result;
		n = Math.floor(n / 26) - 1;
	} while (n >= 0);
	return result;
}

function cellXml(rowIndex: number, colIndex: number, value: XlsxCellValue): string | undefined {
	if (value === null || value === undefined) {
		return undefined;
	}
	const ref = `${colLetters(colIndex)}${rowIndex}`;
	if (typeof value === 'number' && Number.isFinite(value)) {
		return `<c r="${ref}" t="n"><v>${value}</v></c>`;
	}
	const text = typeof value === 'boolean' ? (value ? 'TRUE' : 'FALSE') : String(value);
	return `<c r="${ref}" t="inlineStr"><is><t>${escapeXml(text)}</t></is></c>`;
}

function worksheetXml(rows: Array<Array<XlsxCellValue>>): string {
	const rowParts: string[] = [];
	for (let r = 0; r < rows.length; r++) {
		const row = rows[r] ?? [];
		const cells: string[] = [];
		for (let c = 0; c < row.length; c++) {
			const xml = cellXml(r + 1, c, row[c]);
			if (xml) {
				cells.push(xml);
			}
		}
		if (cells.length > 0 || row.length > 0) {
			rowParts.push(`<row r="${r + 1}">${cells.join('')}</row>`);
		}
	}
	return (
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
		'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
		`<sheetData>${rowParts.join('')}</sheetData>` +
		'</worksheet>'
	);
}

function contentTypesXml(sheetCount: number): string {
	const overrides = [
		'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>',
		'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>',
	];
	for (let i = 1; i <= sheetCount; i++) {
		overrides.push(
			`<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
		);
	}
	return (
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
		'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
		'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
		'<Default Extension="xml" ContentType="application/xml"/>' +
		overrides.join('') +
		'</Types>'
	);
}

function workbookXml(sheets: NormalizedXlsxSheet[]): string {
	const sheetEls = sheets.map((sheet, i) =>
		`<sheet name="${escapeXml(sheet.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
	).join('');
	return (
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
		'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
		'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
		`<sheets>${sheetEls}</sheets>` +
		'</workbook>'
	);
}

function workbookRelsXml(sheetCount: number): string {
	const rels: string[] = [];
	for (let i = 1; i <= sheetCount; i++) {
		rels.push(
			`<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`,
		);
	}
	rels.push(
		`<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`,
	);
	return (
		'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
		'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
		rels.join('') +
		'</Relationships>'
	);
}

const ROOT_RELS_XML =
	'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
	'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
	'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
	'</Relationships>';

const STYLES_XML =
	'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
	'<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
	'<fonts count="1"><font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font></fonts>' +
	'<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
	'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
	'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
	'<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
	'</styleSheet>';

/**
 * Build a minimal .xlsx buffer (OOXML zip) from sheets/rows/tsv.
 */
export async function createXlsxBuffer(content: XlsxCreateContent): Promise<Uint8Array> {
	const sheets = normalizeSheets(content);
	const zip = new JSZip();
	zip.file('[Content_Types].xml', contentTypesXml(sheets.length));
	zip.file('_rels/.rels', ROOT_RELS_XML);
	zip.file('xl/workbook.xml', workbookXml(sheets));
	zip.file('xl/_rels/workbook.xml.rels', workbookRelsXml(sheets.length));
	zip.file('xl/styles.xml', STYLES_XML);
	for (let i = 0; i < sheets.length; i++) {
		zip.file(`xl/worksheets/sheet${i + 1}.xml`, worksheetXml(sheets[i].rows));
	}
	const buffer = await zip.generateAsync({
		type: 'uint8array',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 },
	});
	return buffer;
}

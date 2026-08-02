/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Restore OOXML `<f>` formula text onto a calamine-parsed workbook model.
 * Shared by headless host tools and the XLSX webview (no vscode / DOM).
 */

import JSZip from 'jszip';
import { parseCellRef, type WorkbookModel } from './xlsxModelOps';

function unescapeXml(text: string): string {
	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, "'")
		.replace(/&amp;/g, '&');
}

/**
 * Calamine's worksheet_range returns cached values only. Overlay `<f>` formula
 * text from sheet XML so open-editor and headless reads keep formula cells.
 * @returns number of formula cells restored
 */
export async function overlayFormulasFromXlsx(
	bytes: Uint8Array,
	model: WorkbookModel,
): Promise<number> {
	if (!model?.sheets?.length) {
		return 0;
	}
	const zip = await JSZip.loadAsync(bytes);
	const sheetFiles = Object.keys(zip.files)
		.filter(n => /xl\/worksheets\/sheet\d+\.xml$/i.test(n))
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

	let overlaid = 0;
	for (let i = 0; i < sheetFiles.length && i < model.sheets.length; i++) {
		const file = zip.file(sheetFiles[i]);
		if (!file) {
			continue;
		}
		const xml = await file.async('string');
		const sheet = model.sheets[i];
		if (!sheet.cells) {
			sheet.cells = {};
		}
		const cellRe = /<c([^>]*)>([\s\S]*?)<\/c>/gi;
		let match: RegExpExecArray | null;
		while ((match = cellRe.exec(xml)) !== null) {
			const attrs = match[1];
			const inner = match[2];
			const fMatch = /<f[^>]*>([\s\S]*?)<\/f>/i.exec(inner);
			if (!fMatch) {
				continue;
			}
			const refMatch = /\br="([^"]+)"/i.exec(attrs);
			if (!refMatch) {
				continue;
			}
			const parsed = parseCellRef(refMatch[1]);
			if (!parsed) {
				continue;
			}
			let formula = unescapeXml(fMatch[1]).trim();
			if (!formula) {
				continue;
			}
			if (!formula.startsWith('=')) {
				formula = `=${formula}`;
			}
			const vMatch = /<v[^>]*>([\s\S]*?)<\/v>/i.exec(inner);
			const cachedRaw = vMatch ? unescapeXml(vMatch[1]).trim() : '';
			const rowKey = String(parsed.row);
			const colKey = String(parsed.col);
			if (!sheet.cells[rowKey]) {
				sheet.cells[rowKey] = {};
			}
			const existing = sheet.cells[rowKey][colKey];
			const cachedDisplay = cachedRaw !== ''
				? cachedRaw
				: (existing && existing.data_type !== 'f' ? String(existing.value ?? '') : '');
			sheet.cells[rowKey][colKey] = {
				...(existing ?? {}),
				value: formula,
				data_type: 'f',
				formula_result: cachedDisplay !== ''
					? cachedDisplay
					: existing?.formula_result,
				style: existing?.style ?? null,
			};
			overlaid++;
			sheet.row_count = Math.max(sheet.row_count ?? 0, parsed.row + 1);
			sheet.col_count = Math.max(sheet.col_count ?? 0, parsed.col + 1);
		}
	}
	return overlaid;
}

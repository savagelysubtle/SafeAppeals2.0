/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Headless XLSX read/edit pipeline for agent tools (file not open in custom editor).
 * Mutation loop mirrors webview handleApplyEdits but writes snake_case styles onto
 * the model directly (renderer overlay + getData() merge).
 */

import JSZip from 'jszip';
import {
	buildChartDefinition,
	cellStyleToModelStyle,
	formatOpToStyle,
	formatWorkbookReadOutput,
	getColName,
	mergeFormulaResultsIntoSheet,
	normalizeFormula,
	parseCellRange,
	parseCellRef,
	resolveSheetIndex,
	type FormulaEvalResult,
	type ModelCellStyle,
	type WorkbookCell,
	type WorkbookModel,
	type WorkbookSheet,
} from './xlsxModelOps';
import { overlayFormulasFromXlsx } from './xlsxFormulaOverlay';
import { ensureXlsxHostWasm, type FormulaEngineLike, type TableOpsLike } from './xlsxHostWasm';

export { overlayFormulasFromXlsx } from './xlsxFormulaOverlay';

export interface ApplyOpResult {
	type?: string;
	ok: boolean;
	error?: string;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureCell(sheet: WorkbookSheet, row: number, col: number): WorkbookCell {
	if (!sheet.cells) {
		sheet.cells = {};
	}
	const rowKey = String(row);
	if (!sheet.cells[rowKey]) {
		sheet.cells[rowKey] = {};
	}
	const colKey = String(col);
	if (!sheet.cells[rowKey][colKey]) {
		sheet.cells[rowKey][colKey] = { value: '', data_type: 'null', style: null };
	}
	return sheet.cells[rowKey][colKey];
}

/**
 * Set value/data_type while preserving existing cell.style (critical headless difference
 * vs webview updateCell, which can drop style because the overlay owns it).
 */
function setCellValuePreservingStyle(
	sheet: WorkbookSheet,
	row: number,
	col: number,
	value: unknown,
	dataType: string,
): void {
	const existing = sheet.cells?.[String(row)]?.[String(col)];
	const style: ModelCellStyle | null | undefined = existing?.style;
	const cell = ensureCell(sheet, row, col);
	cell.value = String(value ?? '');
	cell.data_type = dataType;
	if (style !== undefined) {
		cell.style = style;
	}
	if (row >= (sheet.row_count || 0)) {
		sheet.row_count = row + 1;
	}
	if (col >= (sheet.col_count || 0)) {
		sheet.col_count = col + 1;
	}
}

function applyStyleRange(
	sheet: WorkbookSheet,
	startRow: number,
	startCol: number,
	endRow: number,
	endCol: number,
	format: Record<string, unknown>,
): void {
	const overlay = formatOpToStyle(format);
	const r0 = Math.min(startRow, endRow);
	const r1 = Math.max(startRow, endRow);
	const c0 = Math.min(startCol, endCol);
	const c1 = Math.max(startCol, endCol);
	for (let r = r0; r <= r1; r++) {
		for (let c = c0; c <= c1; c++) {
			const cell = ensureCell(sheet, r, c);
			cell.style = cellStyleToModelStyle(overlay, cell.style);
		}
	}
}

function insertRow(sheet: WorkbookSheet, atRow: number): void {
	const newCells: Record<string, Record<string, WorkbookCell>> = {};
	for (const rowKey of Object.keys(sheet.cells ?? {})) {
		const r = parseInt(rowKey, 10);
		const newRow = r >= atRow ? r + 1 : r;
		newCells[String(newRow)] = sheet.cells[rowKey];
	}
	sheet.cells = newCells;
	sheet.row_count = (sheet.row_count || 0) + 1;
}

function deleteRow(sheet: WorkbookSheet, atRow: number): void {
	const newCells: Record<string, Record<string, WorkbookCell>> = {};
	for (const rowKey of Object.keys(sheet.cells ?? {})) {
		const r = parseInt(rowKey, 10);
		if (r === atRow) {
			continue;
		}
		const newRow = r > atRow ? r - 1 : r;
		newCells[String(newRow)] = sheet.cells[rowKey];
	}
	sheet.cells = newCells;
	sheet.row_count = Math.max(0, (sheet.row_count || 1) - 1);
}

function insertCol(sheet: WorkbookSheet, atCol: number): void {
	for (const rowKey of Object.keys(sheet.cells ?? {})) {
		const row = sheet.cells[rowKey];
		const newRow: Record<string, WorkbookCell> = {};
		for (const colKey of Object.keys(row)) {
			const c = parseInt(colKey, 10);
			const newCol = c >= atCol ? c + 1 : c;
			newRow[String(newCol)] = row[colKey];
		}
		sheet.cells[rowKey] = newRow;
	}
	sheet.col_count = (sheet.col_count || 0) + 1;
}

function deleteCol(sheet: WorkbookSheet, atCol: number): void {
	for (const rowKey of Object.keys(sheet.cells ?? {})) {
		const row = sheet.cells[rowKey];
		const newRow: Record<string, WorkbookCell> = {};
		for (const colKey of Object.keys(row)) {
			const c = parseInt(colKey, 10);
			if (c === atCol) {
				continue;
			}
			const newCol = c > atCol ? c - 1 : c;
			newRow[String(newCol)] = row[colKey];
		}
		sheet.cells[rowKey] = newRow;
	}
	sheet.col_count = Math.max(0, (sheet.col_count || 1) - 1);
}

function replaceModelContents(target: WorkbookModel, source: WorkbookModel): void {
	target.sheets = source.sheets;
	if ('defined_names' in source) {
		target.defined_names = source.defined_names;
	}
	if ('pivot_tables' in source) {
		target.pivot_tables = source.pivot_tables;
	}
}

/**
 * Snapshot cell styles keyed by "row:col" for merge-after-table-ops.
 */
export function snapshotSheetCellStyles(
	sheet: WorkbookSheet | undefined,
): Map<string, ModelCellStyle> {
	const out = new Map<string, ModelCellStyle>();
	if (!sheet?.cells) {
		return out;
	}
	for (const [rowKey, row] of Object.entries(sheet.cells)) {
		for (const [colKey, cell] of Object.entries(row)) {
			if (cell?.style && typeof cell.style === 'object') {
				out.set(`${rowKey}:${colKey}`, { ...cell.style });
			}
		}
	}
	return out;
}

/**
 * Merge pre-table styles onto post-table cells (pre-table wins on conflict).
 */
export function restoreSheetCellStyles(
	sheet: WorkbookSheet | undefined,
	styles: Map<string, ModelCellStyle>,
): void {
	if (!sheet || styles.size === 0) {
		return;
	}
	if (!sheet.cells) {
		sheet.cells = {};
	}
	for (const [key, style] of styles) {
		const sep = key.indexOf(':');
		if (sep < 0) {
			continue;
		}
		const rowKey = key.slice(0, sep);
		const colKey = key.slice(sep + 1);
		const cell = ensureCell(sheet, parseInt(rowKey, 10), parseInt(colKey, 10));
		cell.style = { ...(cell.style ?? {}), ...style };
	}
}

function applyTableOp(
	model: WorkbookModel,
	tableOps: TableOpsLike,
	action: string,
	params: Record<string, unknown>,
	sheetIdx: number,
): ApplyOpResult {
	const styleSnap = action === 'createTable'
		? snapshotSheetCellStyles(model.sheets[sheetIdx])
		: undefined;
	const modelJson = JSON.stringify(model);
	let result: string | undefined;
	try {
		switch (action) {
			case 'createTable': {
				result = tableOps.create_table(
					modelJson,
					sheetIdx,
					params.range as string,
					(params.name as string) || `Table${Date.now()}`,
					(params.style as string) || 'TableStyleMedium2',
				);
				break;
			}
			case 'resizeTable': {
				const tableName = params.tableName as string;
				const rangeJson = params.range as string;
				if (!tableName || !rangeJson) {
					return { ok: false, error: 'resizeTable requires tableName and range' };
				}
				result = tableOps.resize_table(modelJson, tableName, rangeJson);
				break;
			}
			case 'renameTable': {
				const oldName = params.oldName as string;
				const newName = params.newName as string;
				if (!oldName || !newName) {
					return { ok: false, error: 'renameTable requires oldName and newName' };
				}
				result = tableOps.rename_table(modelJson, oldName, newName);
				break;
			}
			case 'setTotalsRow': {
				const tableName = params.tableName as string;
				if (!tableName) {
					return { ok: false, error: 'setTotalsRow requires tableName' };
				}
				result = tableOps.set_totals_row(
					modelJson,
					tableName,
					!!params.enabled,
					(params.functions as string) || '[]',
				);
				break;
			}
			case 'setTableStyle': {
				const tableName = params.tableName as string;
				if (!tableName) {
					return { ok: false, error: 'setTableStyle requires tableName' };
				}
				result = tableOps.set_table_style(modelJson, tableName, (params.style as string) || '');
				break;
			}
			case 'toggleFilter': {
				const tableName = params.tableName as string;
				if (!tableName) {
					return { ok: false, error: 'toggleFilter requires tableName' };
				}
				result = tableOps.toggle_filter(modelJson, tableName);
				break;
			}
			case 'convertToRange': {
				const tableName = params.tableName as string;
				if (!tableName) {
					return { ok: false, error: 'convertToRange requires tableName' };
				}
				result = tableOps.convert_to_range(modelJson, tableName);
				break;
			}
			default:
				return { ok: false, error: `Unknown table action: ${action}` };
		}
	} catch (e: unknown) {
		return { ok: false, error: e instanceof Error ? e.message : String(e) };
	}
	if (!result) {
		return { ok: false, error: `Table action ${action} returned no model` };
	}
	replaceModelContents(model, JSON.parse(result) as WorkbookModel);
	if (styleSnap) {
		restoreSheetCellStyles(model.sheets[sheetIdx], styleSnap);
	}
	return { ok: true };
}

/**
 * Evaluate formulas via WASM FormulaEngine (webview evaluateFormulas parity).
 * Writes `formula_result` on formula cells; keeps `value` as the formula string.
 * Evaluates every sheet (not only the active one).
 */
export function evaluateFormulasOnModel(
	model: WorkbookModel,
	formulaEngine: FormulaEngineLike,
): void {
	if (!model?.sheets?.length) {
		return;
	}
	const allSheets: Record<string, unknown> = {};
	for (const sheet of model.sheets) {
		allSheets[sheet.name] = sheet.cells ?? {};
	}
	const allJson = JSON.stringify(allSheets);
	for (const sheet of model.sheets) {
		try {
			const resultJson = formulaEngine.evaluate_all(allJson, sheet.name);
			const results = JSON.parse(resultJson) as Record<string, FormulaEvalResult>;
			mergeFormulaResultsIntoSheet(sheet, results);
		} catch {
			// Fall through to simple TS evaluators for remaining cells.
		}
		evaluateSimpleFormulasOnSheet(sheet);
	}
}

/**
 * Minimal TS fallback for SUM/AVERAGE/COUNT/MIN/MAX when WASM eval misses a cell.
 */
function evaluateSimpleFormulasOnSheet(sheet: WorkbookSheet): void {
	for (const row of Object.values(sheet.cells ?? {})) {
		for (const cell of Object.values(row)) {
			if (!cell || cell.data_type !== 'f' || cell.formula_result !== undefined) {
				continue;
			}
			const computed = tryEvalSimpleFormula(sheet, String(cell.value ?? ''));
			if (computed !== undefined) {
				cell.formula_result = String(computed);
			}
		}
	}
}

function tryEvalSimpleFormula(sheet: WorkbookSheet, formula: string): number | undefined {
	const body = formula.replace(/^\s*=\s*/, '').trim();
	const match = body.match(/^(SUM|AVERAGE|AVG|COUNT|MIN|MAX)\s*\(\s*([A-Za-z]+\d+)\s*:\s*([A-Za-z]+\d+)\s*\)$/i);
	if (!match) {
		return undefined;
	}
	const fn = match[1].toUpperCase();
	const start = parseCellRef(match[2]);
	const end = parseCellRef(match[3]);
	if (!start || !end) {
		return undefined;
	}
	const r0 = Math.min(start.row, end.row);
	const r1 = Math.max(start.row, end.row);
	const c0 = Math.min(start.col, end.col);
	const c1 = Math.max(start.col, end.col);
	const nums: number[] = [];
	for (let r = r0; r <= r1; r++) {
		for (let c = c0; c <= c1; c++) {
			const cell = sheet.cells?.[String(r)]?.[String(c)];
			if (!cell) {
				continue;
			}
			const raw = cell.data_type === 'f'
				? (cell.formula_result !== undefined ? cell.formula_result : undefined)
				: cell.value;
			if (raw === undefined || raw === null || String(raw).trim() === '') {
				continue;
			}
			if (typeof raw === 'string' && raw.trim().startsWith('=')) {
				continue;
			}
			const n = parseFloat(String(raw));
			if (Number.isFinite(n)) {
				nums.push(n);
			}
		}
	}
	switch (fn) {
		case 'SUM':
			return nums.reduce((a, b) => a + b, 0);
		case 'AVERAGE':
		case 'AVG':
			return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
		case 'COUNT':
			return nums.length;
		case 'MIN':
			return nums.length ? Math.min(...nums) : 0;
		case 'MAX':
			return nums.length ? Math.max(...nums) : 0;
		default:
			return undefined;
	}
}

/**
 * Patch OOXML `<v>0</v>` cached values on formula cells using `formula_result`.
 * Keeps `<f>` formula text intact so Excel/calamine show the computed cache.
 */
export async function patchFormulaCachedValuesInXlsx(
	bytes: Uint8Array,
	model: WorkbookModel,
): Promise<Uint8Array> {
	const patchesBySheet: Array<Array<{ ref: string; value: string }>> = [];
	let any = false;
	for (let si = 0; si < (model.sheets?.length ?? 0); si++) {
		const sheet = model.sheets[si];
		const patches: Array<{ ref: string; value: string }> = [];
		for (const [rowKey, row] of Object.entries(sheet.cells ?? {})) {
			for (const [colKey, cell] of Object.entries(row)) {
				if (cell?.data_type === 'f' && cell.formula_result !== undefined && cell.formula_result !== '') {
					const ref = `${getColName(parseInt(colKey, 10))}${parseInt(rowKey, 10) + 1}`;
					patches.push({ ref, value: cell.formula_result });
					any = true;
				}
			}
		}
		patchesBySheet.push(patches);
	}
	if (!any) {
		return bytes;
	}

	const zip = await JSZip.loadAsync(bytes);
	const sheetFiles = Object.keys(zip.files)
		.filter(n => /xl\/worksheets\/sheet\d+\.xml$/i.test(n))
		.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

	for (let i = 0; i < sheetFiles.length; i++) {
		const patches = patchesBySheet[i];
		if (!patches?.length) {
			continue;
		}
		const file = zip.file(sheetFiles[i]);
		if (!file) {
			continue;
		}
		let xml = await file.async('string');
		for (const { ref, value } of patches) {
			const escapedVal = value
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;');
			// Match <c r="A3" ...>...<f>...</f>...<v>...</v>
			const cellRe = new RegExp(
				`(<c[^>]*\\br="${ref.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*>)([\\s\\S]*?)(</c>)`,
				'i',
			);
			xml = xml.replace(cellRe, (_full, open: string, inner: string, close: string) => {
				if (!/<f[\s>]/i.test(inner)) {
					return `${open}${inner}${close}`;
				}
				let next = inner;
				if (/<v[\s>]/i.test(next)) {
					next = next.replace(/<v[^>]*>[\s\S]*?<\/v>/i, `<v>${escapedVal}</v>`);
				} else {
					next = next.replace(/(<\/f>)/i, `$1<v>${escapedVal}</v>`);
				}
				return `${open}${next}${close}`;
			});
		}
		zip.file(sheetFiles[i], xml);
	}

	return zip.generateAsync({
		type: 'uint8array',
		compression: 'DEFLATE',
		compressionOptions: { level: 6 },
	});
}

/**
 * Apply normalized ops to a workbook model in place (headless mutation loop).
 */
export function applyXlsxOpsToModel(
	model: WorkbookModel,
	operations: readonly unknown[],
	tableOps: TableOpsLike,
): ApplyOpResult[] {
	const results: ApplyOpResult[] = [];
	if (!model?.sheets) {
		return [{ ok: false, error: 'No workbook model' }];
	}

	for (const raw of operations) {
		if (!isPlainObject(raw)) {
			results.push({ ok: false, error: 'Invalid operation (not an object)' });
			continue;
		}
		const op = raw;
		const type = typeof op.type === 'string' ? op.type : undefined;
		const sheetIdx = resolveSheetIndex(model, op.sheet as string | number | undefined | null);
		if (sheetIdx < 0) {
			results.push({ type, ok: false, error: `Sheet not found: ${op.sheet}` });
			continue;
		}
		const sheet = model.sheets[sheetIdx];
		if (!sheet) {
			results.push({ type, ok: false, error: 'Sheet missing' });
			continue;
		}

		try {
			switch (type) {
				case 'set_cell_value': {
					const ref = typeof op.cell === 'string' ? parseCellRef(op.cell) : null;
					if (!ref) {
						results.push({ type, ok: false, error: `Invalid cell: ${op.cell}` });
						break;
					}
					const dataType = typeof op.value === 'number' ? 'n' : 's';
					setCellValuePreservingStyle(sheet, ref.row, ref.col, op.value, dataType);
					results.push({ type, ok: true });
					break;
				}
				case 'set_cell_formula': {
					const ref = typeof op.cell === 'string' ? parseCellRef(op.cell) : null;
					if (!ref) {
						results.push({ type, ok: false, error: `Invalid cell: ${op.cell}` });
						break;
					}
					setCellValuePreservingStyle(
						sheet,
						ref.row,
						ref.col,
						normalizeFormula(String(op.formula ?? '')),
						'f',
					);
					results.push({ type, ok: true });
					break;
				}
				case 'format_cell': {
					const ref = typeof op.cell === 'string' ? parseCellRef(op.cell) : null;
					if (!ref) {
						results.push({ type, ok: false, error: `Invalid cell: ${op.cell}` });
						break;
					}
					if (isPlainObject(op.format)) {
						applyStyleRange(sheet, ref.row, ref.col, ref.row, ref.col, op.format);
					}
					results.push({ type, ok: true });
					break;
				}
				case 'format_range': {
					const range = typeof op.range === 'string' ? parseCellRange(op.range) : null;
					if (!range) {
						results.push({ type, ok: false, error: `Invalid range: ${op.range}` });
						break;
					}
					if (isPlainObject(op.format)) {
						applyStyleRange(
							sheet,
							range.startRow,
							range.startCol,
							range.endRow,
							range.endCol,
							op.format,
						);
					}
					results.push({ type, ok: true });
					break;
				}
				case 'insert_row': {
					insertRow(sheet, typeof op.rowIndex === 'number' ? op.rowIndex : 0);
					results.push({ type, ok: true });
					break;
				}
				case 'insert_column': {
					insertCol(sheet, typeof op.colIndex === 'number' ? op.colIndex : 0);
					results.push({ type, ok: true });
					break;
				}
				case 'delete_row': {
					deleteRow(sheet, typeof op.rowIndex === 'number' ? op.rowIndex : 0);
					results.push({ type, ok: true });
					break;
				}
				case 'delete_column': {
					deleteCol(sheet, typeof op.colIndex === 'number' ? op.colIndex : 0);
					results.push({ type, ok: true });
					break;
				}
				case 'create_table': {
					const range = typeof op.range === 'string' ? parseCellRange(op.range) : null;
					if (!range) {
						results.push({ type, ok: false, error: `Invalid range: ${op.range}` });
						break;
					}
					const rangeJson = JSON.stringify({
						start_row: Math.min(range.startRow, range.endRow),
						start_col: Math.min(range.startCol, range.endCol),
						end_row: Math.max(range.startRow, range.endRow),
						end_col: Math.max(range.startCol, range.endCol),
					});
					const tableResult = applyTableOp(model, tableOps, 'createTable', {
						range: rangeJson,
						name: op.tableName,
						style: op.styleName || 'TableStyleMedium2',
					}, sheetIdx);
					results.push({ type, ok: tableResult.ok, error: tableResult.error });
					break;
				}
				case 'resize_table': {
					const range = typeof op.range === 'string' ? parseCellRange(op.range) : null;
					if (!op.tableName || !range) {
						results.push({
							type,
							ok: false,
							error: `resize_table requires tableName and range; got tableName=${op.tableName}, range=${op.range}`,
						});
						break;
					}
					const rangeJson = JSON.stringify({
						start_row: Math.min(range.startRow, range.endRow),
						start_col: Math.min(range.startCol, range.endCol),
						end_row: Math.max(range.startRow, range.endRow),
						end_col: Math.max(range.startCol, range.endCol),
					});
					const tableResult = applyTableOp(model, tableOps, 'resizeTable', {
						tableName: op.tableName,
						range: rangeJson,
					}, sheetIdx);
					results.push({ type, ok: tableResult.ok, error: tableResult.error });
					break;
				}
				case 'rename_table': {
					const tableResult = applyTableOp(model, tableOps, 'renameTable', {
						oldName: op.oldName,
						newName: op.newName,
					}, sheetIdx);
					results.push({ type, ok: tableResult.ok, error: tableResult.error });
					break;
				}
				case 'set_table_style': {
					const tableResult = applyTableOp(model, tableOps, 'setTableStyle', {
						tableName: op.tableName,
						style: op.styleName,
					}, sheetIdx);
					results.push({ type, ok: tableResult.ok, error: tableResult.error });
					break;
				}
				case 'toggle_table_filter': {
					const tableResult = applyTableOp(model, tableOps, 'toggleFilter', {
						tableName: op.tableName,
					}, sheetIdx);
					results.push({ type, ok: tableResult.ok, error: tableResult.error });
					break;
				}
				case 'set_totals_row': {
					const tableResult = applyTableOp(model, tableOps, 'setTotalsRow', {
						tableName: op.tableName,
						enabled: op.enabled,
					}, sheetIdx);
					results.push({ type, ok: tableResult.ok, error: tableResult.error });
					break;
				}
				case 'convert_table_to_range': {
					const tableResult = applyTableOp(model, tableOps, 'convertToRange', {
						tableName: op.tableName,
					}, sheetIdx);
					results.push({ type, ok: tableResult.ok, error: tableResult.error });
					break;
				}
				case 'create_chart':
				case 'insert_chart': {
					const built = buildChartDefinition(op, sheet);
					if ('error' in built) {
						results.push({ type, ok: false, error: built.error });
						break;
					}
					if (!sheet.charts) {
						sheet.charts = [];
					}
					sheet.charts.push(built);
					results.push({ type, ok: true });
					break;
				}
				case 'delete_chart': {
					const chartIndex = typeof op.chart_index === 'number'
						? op.chart_index
						: (typeof op.chartIndex === 'number' ? op.chartIndex : -1);
					if (!sheet.charts || chartIndex < 0 || chartIndex >= sheet.charts.length) {
						results.push({ type, ok: false, error: 'Invalid chart_index' });
						break;
					}
					sheet.charts.splice(chartIndex, 1);
					results.push({ type, ok: true });
					break;
				}
				default:
					results.push({ type, ok: false, error: `Unknown operation type: ${type}` });
			}
		} catch (e: unknown) {
			results.push({ type, ok: false, error: e instanceof Error ? e.message : String(e) });
		}
	}

	return results;
}

/**
 * Parse XLSX bytes and return workbook structure JSON + TSV values (webview getText parity).
 * Re-evaluates formulas so display values are computed (not stale `<v>0</v>` caches).
 */
export async function readWorkbookHeadless(bytes: Uint8Array): Promise<string> {
	const wasm = await ensureXlsxHostWasm();
	const parser = new wasm.XlsxParser();
	const formulaEngine = new wasm.FormulaEngine();
	try {
		const model = JSON.parse(parser.load(bytes)) as WorkbookModel;
		// Calamine drops `<f>` text; restore formulas from OOXML before eval/read.
		await overlayFormulasFromXlsx(bytes, model);
		evaluateFormulasOnModel(model, formulaEngine);
		return formatWorkbookReadOutput(model);
	} finally {
		parser.free();
		formulaEngine.free();
	}
}

/**
 * Parse → apply ops → evaluate formulas → save (with cached `<v>`). Returns new bytes and per-op results.
 */
export async function applyXlsxOpsHeadless(
	bytes: Uint8Array,
	operations: readonly unknown[],
): Promise<{ bytes: Uint8Array; results: ApplyOpResult[]; model: WorkbookModel }> {
	const wasm = await ensureXlsxHostWasm();
	const parser = new wasm.XlsxParser();
	const writer = new wasm.XlsxWriter();
	const tableOps = new wasm.TableOps();
	const formulaEngine = new wasm.FormulaEngine();
	try {
		const model = JSON.parse(parser.load(bytes)) as WorkbookModel;
		// Calamine drops `<f>` text; restore formulas before mutate/save so later
		// edits do not flatten existing formulas to static cached values.
		await overlayFormulasFromXlsx(bytes, model);
		for (const sheet of model.sheets ?? []) {
			if (!sheet.cells) {
				sheet.cells = {};
			}
			if (!Array.isArray(sheet.charts)) {
				sheet.charts = [];
			}
			if (!Array.isArray(sheet.tables)) {
				sheet.tables = [];
			}
		}
		const results = applyXlsxOpsToModel(model, operations, tableOps);
		evaluateFormulasOnModel(model, formulaEngine);
		const saved = writer.save(JSON.stringify(model));
		const out = await patchFormulaCachedValuesInXlsx(saved, model);
		return { bytes: out, results, model };
	} finally {
		parser.free();
		writer.free();
		tableOps.free();
		formulaEngine.free();
	}
}

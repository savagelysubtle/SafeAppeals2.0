/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Pure helpers shared by the XLSX webview (`handleApplyEdits`) and headless host tools.
 * No vscode, no DOM. Webview imports this via `../../src/xlsx/xlsxModelOps`.
 */

/** CamelCase style used by the webview CanvasRenderer overlay. */
export interface CellStyle {
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	fontFamily?: string;
	fontSize?: number;
	textColor?: string;
	fillColor?: string;
	alignment?: 'left' | 'center' | 'right';
	numberFormat?: string;
	wrapText?: boolean;
}

/** Snake_case style fields persisted on model `cell.style` (writer / headless). */
export interface ModelCellStyle {
	bold?: boolean;
	italic?: boolean;
	underline?: boolean;
	strikethrough?: boolean;
	font_size?: number;
	font_family?: string;
	text_color?: string;
	fill_color?: string;
	alignment?: string;
	number_format?: string;
	wrap_text?: boolean;
}

export interface WorkbookCell {
	value?: string;
	data_type?: string;
	style?: ModelCellStyle | null;
	/**
	 * Cached formula evaluation result for display / OOXML `<v>` (formula text stays in `value`).
	 */
	formula_result?: string;
}

export interface ChartSeriesData {
	name?: string;
	categories_ref?: string;
	values_ref?: string;
	categories_cache: string[];
	values_cache: number[];
	chart_type?: string;
}

export interface ChartDefinition {
	chart_type: string;
	series: ChartSeriesData[];
	title?: string;
	axes: Array<{ axis_type: string; position: string }>;
	anchor: {
		from_col: number;
		from_row: number;
		from_col_off: number;
		from_row_off: number;
		to_col: number;
		to_row: number;
		to_col_off: number;
		to_row_off: number;
	};
}

export interface WorkbookSheet {
	name: string;
	cells: Record<string, Record<string, WorkbookCell>>;
	row_count: number;
	col_count: number;
	tables?: unknown[];
	charts?: ChartDefinition[];
	merged_cells?: unknown[];
	[key: string]: unknown;
}

export interface WorkbookModel {
	sheets: WorkbookSheet[];
	defined_names?: unknown[];
	pivot_tables?: unknown[];
	[key: string]: unknown;
}

export interface CellRef {
	row: number;
	col: number;
}

export interface CellRange {
	startRow: number;
	startCol: number;
	endRow: number;
	endCol: number;
}

/**
 * Normalize a formula string for model storage / writer (`data_type: 'f'`).
 * Trims whitespace and ensures a leading `=`.
 */
export function normalizeFormula(raw: string): string {
	const trimmed = raw.trim();
	if (trimmed.startsWith('=')) {
		return trimmed;
	}
	return `=${trimmed}`;
}

/**
 * Resolve a sheet selector to a 0-based index.
 * Undefined/null → 0. Unmatched string names and out-of-range numbers → -1.
 */
export function resolveSheetIndex(
	model: WorkbookModel,
	sheet: string | number | undefined | null,
): number {
	if (sheet === undefined || sheet === null) {
		return 0;
	}
	const sheetCount = Array.isArray(model.sheets) ? model.sheets.length : 0;
	if (typeof sheet === 'number') {
		if (!Number.isInteger(sheet) || sheet < 0 || sheet >= sheetCount) {
			return -1;
		}
		return sheet;
	}
	if (typeof sheet !== 'string') {
		return -1;
	}
	return model.sheets.findIndex(s => s.name === sheet);
}

/**
 * Parse an A1 cell ref (optional sheet prefix / $) into 0-based row/col.
 */
export function parseCellRef(ref: string): CellRef | null {
	let cell = ref;
	const bangIdx = cell.indexOf('!');
	if (bangIdx >= 0) {
		cell = cell.substring(bangIdx + 1);
	}
	cell = cell.replace(/\$/g, '');
	const match = cell.match(/^([A-Za-z]+)(\d+)$/);
	if (!match) {
		return null;
	}
	return { col: parseColName(match[1].toUpperCase()), row: parseInt(match[2], 10) - 1 };
}

/**
 * Parse an A1:B10 range (requires `:`). Sheet prefix and `$` are stripped.
 */
export function parseCellRange(ref: string): CellRange | null {
	let range = ref;
	const bangIdx = range.indexOf('!');
	if (bangIdx >= 0) {
		range = range.substring(bangIdx + 1);
	}
	range = range.replace(/\$/g, '');
	const parts = range.split(':');
	if (parts.length < 2) {
		return null;
	}
	const start = parseCellRef(parts[0]);
	const end = parseCellRef(parts[1]);
	if (!start || !end) {
		return null;
	}
	return {
		startRow: start.row,
		startCol: start.col,
		endRow: end.row,
		endCol: end.col,
	};
}

/** Convert a 0-based column index to A1 letters. */
export function getColName(n: number): string {
	let s = '';
	let idx = n;
	while (idx >= 0) {
		s = String.fromCharCode((idx % 26) + 65) + s;
		idx = Math.floor(idx / 26) - 1;
	}
	return s;
}

function parseColName(name: string): number {
	let result = 0;
	for (let i = 0; i < name.length; i++) {
		result = result * 26 + (name.charCodeAt(i) - 64);
	}
	return result - 1;
}

/**
 * Map agent/format_cell / format_range payload keys onto camelCase CellStyle
 * (webview renderer overlay). Accepts backgroundColor as an alias for fillColor.
 */
export function formatOpToStyle(format: Record<string, unknown>): CellStyle {
	const style: CellStyle = {};
	if (format.bold !== undefined) {
		style.bold = !!format.bold;
	}
	if (format.italic !== undefined) {
		style.italic = !!format.italic;
	}
	if (format.underline !== undefined) {
		style.underline = !!format.underline;
	}
	if (format.strikethrough !== undefined) {
		style.strikethrough = !!format.strikethrough;
	}
	if (format.wrapText !== undefined) {
		style.wrapText = !!format.wrapText;
	}
	const fill = format.backgroundColor ?? format.fillColor;
	if (fill !== undefined && fill !== null) {
		style.fillColor = String(fill);
	}
	if (format.textColor !== undefined && format.textColor !== null) {
		style.textColor = String(format.textColor);
	}
	if (format.fontSize !== undefined && format.fontSize !== null && format.fontSize !== '') {
		const n = Number(format.fontSize);
		if (!Number.isNaN(n)) {
			style.fontSize = n;
		}
	}
	if (format.fontFamily !== undefined && format.fontFamily !== null) {
		style.fontFamily = String(format.fontFamily);
	}
	if (format.alignment === 'left' || format.alignment === 'center' || format.alignment === 'right') {
		style.alignment = format.alignment;
	}
	if (format.numberFormat !== undefined && format.numberFormat !== null) {
		style.numberFormat = String(format.numberFormat);
	}
	return style;
}

/**
 * Replicate renderer.getData() camelCase overlay → snake_case model style merge (~788-800).
 */
export function cellStyleToModelStyle(overlay: CellStyle, existing?: ModelCellStyle | null): ModelCellStyle {
	const merged: ModelCellStyle = { ...(existing ?? {}) };
	if (overlay.bold !== undefined) {
		merged.bold = overlay.bold || undefined;
	}
	if (overlay.italic !== undefined) {
		merged.italic = overlay.italic || undefined;
	}
	if (overlay.underline !== undefined) {
		merged.underline = overlay.underline || undefined;
	}
	if (overlay.strikethrough !== undefined) {
		merged.strikethrough = overlay.strikethrough || undefined;
	}
	if (overlay.fontSize !== undefined) {
		merged.font_size = overlay.fontSize;
	}
	if (overlay.fontFamily !== undefined) {
		merged.font_family = overlay.fontFamily;
	}
	if (overlay.textColor !== undefined) {
		merged.text_color = overlay.textColor;
	}
	if (overlay.fillColor !== undefined) {
		merged.fill_color = overlay.fillColor;
	}
	if (overlay.alignment !== undefined) {
		merged.alignment = overlay.alignment;
	}
	if (overlay.numberFormat !== undefined) {
		merged.number_format = overlay.numberFormat;
	}
	if (overlay.wrapText !== undefined) {
		merged.wrap_text = overlay.wrapText || undefined;
	}
	return merged;
}

function getCellValue(cell: WorkbookCell | undefined): string | number | null {
	if (!cell) {
		return null;
	}
	if (cell.data_type === 'n') {
		return parseFloat(cell.value ?? '') || 0;
	}
	return cell.value ?? null;
}

/**
 * Populate chart series caches from cell values (port of webview resolveChartData).
 */
export function resolveChartData(chartDef: ChartDefinition, sheet: WorkbookSheet): void {
	const sheetName = sheet.name || 'Sheet1';
	const cells = sheet.cells || {};

	for (const series of chartDef.series) {
		if (!series.values_ref) {
			continue;
		}
		if (!series.values_ref.includes('!')) {
			series.values_ref = `${sheetName}!${series.values_ref}`;
		}
		const parsed = parseCellRange(series.values_ref);
		if (!parsed) {
			continue;
		}
		const { startRow, startCol, endRow, endCol } = parsed;
		const isVertical = startCol === endCol;

		if (isVertical) {
			const cats: string[] = [];
			const vals: number[] = [];
			let dataStartRow = startRow;
			for (let r = startRow; r <= endRow; r++) {
				const cell = cells[String(r)]?.[String(startCol)];
				const val = getCellValue(cell);
				if (r === startRow && typeof val === 'string' && isNaN(Number(val))) {
					series.name = val;
					dataStartRow = startRow + 1;
					continue;
				}
				cats.push(`Row ${r + 1}`);
				vals.push(typeof val === 'number' ? val : (parseFloat(String(val)) || 0));
			}
			series.categories_cache = cats;
			series.values_cache = vals;
			const valCol = getColName(startCol);
			series.values_ref = `${sheetName}!${valCol}${dataStartRow + 1}:${valCol}${endRow + 1}`;
		} else {
			const cats: string[] = [];
			const vals: number[] = [];
			let dataStartRow = startRow;
			const firstCell = cells[String(startRow)]?.[String(startCol)];
			const firstVal = getCellValue(firstCell);
			if (typeof firstVal === 'string' && isNaN(Number(firstVal))) {
				dataStartRow = startRow + 1;
			}
			for (let r = dataStartRow; r <= endRow; r++) {
				const catCell = cells[String(r)]?.[String(startCol)];
				const catVal = getCellValue(catCell);
				cats.push(String(catVal ?? `Row ${r + 1}`));
				let sum = 0;
				for (let c = startCol + 1; c <= endCol; c++) {
					const vCell = cells[String(r)]?.[String(c)];
					const v = getCellValue(vCell);
					sum += typeof v === 'number' ? v : (parseFloat(String(v)) || 0);
				}
				vals.push(sum);
			}
			series.categories_cache = cats;
			series.values_cache = vals;
			const catCol = getColName(startCol);
			const valStartCol = getColName(startCol + 1);
			const valEndCol = getColName(endCol);
			series.categories_ref = `${sheetName}!${catCol}${dataStartRow + 1}:${catCol}${endRow + 1}`;
			series.values_ref = `${sheetName}!${valStartCol}${dataStartRow + 1}:${valEndCol}${endRow + 1}`;
		}
	}
}

/**
 * Build a ChartDefinition from a create_chart / insert_chart op (webview inline construction).
 */
export function buildChartDefinition(
	op: Record<string, unknown>,
	sheet: WorkbookSheet,
): ChartDefinition | { error: string } {
	const chartType = op.chart_type ?? op.chartType;
	const dataRange = op.data_range ?? op.dataRange;
	if (chartType === undefined || chartType === null || chartType === ''
		|| dataRange === undefined || dataRange === null || dataRange === '') {
		return {
			error: 'create_chart/insert_chart requires chart_type (or chartType) and data_range (or dataRange)',
		};
	}
	if (!sheet.charts) {
		sheet.charts = [];
	}
	const position = typeof op.position === 'string' ? op.position : undefined;
	const anchorCol = position ? (parseCellRef(position)?.col ?? 0) : 0;
	const anchorRow = position
		? (parseCellRef(position)?.row ?? (sheet.charts.length > 0 ? 20 : 10))
		: (sheet.charts.length > 0 ? 20 : 10);

	const chartDef: ChartDefinition = {
		chart_type: String(chartType),
		title: typeof op.title === 'string' ? op.title : undefined,
		series: [{
			values_ref: String(dataRange),
			categories_cache: [],
			values_cache: [],
		}],
		axes: [
			{ axis_type: 'category', position: 'bottom' },
			{ axis_type: 'value', position: 'left' },
		],
		anchor: {
			from_col: anchorCol,
			from_row: anchorRow,
			from_col_off: 0,
			from_row_off: 0,
			to_col: anchorCol + 8,
			to_row: anchorRow + 15,
			to_col_off: 0,
			to_row_off: 0,
		},
	};
	resolveChartData(chartDef, sheet);
	return chartDef;
}

/**
 * Convert a workbook model to TSV text (same shape as webview extractWorkbookText).
 * Caps: 200 rows × 50 cols per sheet.
 */
/**
 * Display value for TSV/read: formula cells prefer cached evaluation result.
 */
export function cellDisplayValue(cell: WorkbookCell | undefined): string {
	if (!cell) {
		return '';
	}
	if (cell.data_type === 'f' && cell.formula_result !== undefined && cell.formula_result !== '') {
		return String(cell.formula_result);
	}
	return String(cell.value ?? '');
}

/** One cell result from WASM `FormulaEngine.evaluate_all`. */
export interface FormulaEvalResult {
	display?: string;
	is_error?: boolean;
	numeric?: number | null;
}

/**
 * Merge FormulaEngine results into sheet cells as `formula_result`.
 * Keeps formula text in `value` / `data_type: 'f'` for the writer.
 * @returns number of formula cells updated
 */
export function mergeFormulaResultsIntoSheet(
	sheet: WorkbookSheet,
	results: Record<string, FormulaEvalResult>,
): number {
	let merged = 0;
	for (const [key, result] of Object.entries(results)) {
		const sep = key.indexOf(':');
		if (sep < 0) {
			continue;
		}
		const row = key.slice(0, sep);
		const col = key.slice(sep + 1);
		const cell = sheet.cells?.[row]?.[col];
		if (!cell || cell.data_type !== 'f') {
			continue;
		}
		if (result.is_error) {
			cell.formula_result = result.display ?? '#ERROR!';
			merged++;
		} else if (typeof result.numeric === 'number' && Number.isFinite(result.numeric)) {
			cell.formula_result = String(result.numeric);
			merged++;
		} else if (result.display !== undefined && result.display !== '') {
			cell.formula_result = result.display;
			merged++;
		}
	}
	return merged;
}

export function extractWorkbookText(model: WorkbookModel): string {
	if (!model?.sheets?.length) {
		return '';
	}
	const parts: string[] = [];
	for (const sheet of model.sheets) {
		parts.push(`# Sheet: ${sheet.name ?? '(unnamed)'}`);
		const rowCount = Math.min(sheet.row_count ?? 0, 200);
		const colCount = Math.min(sheet.col_count ?? 0, 50);
		for (let r = 0; r < rowCount; r++) {
			const cells: string[] = [];
			let any = false;
			for (let c = 0; c < colCount; c++) {
				const cell = sheet.cells?.[String(r)]?.[String(c)];
				const value = cellDisplayValue(cell);
				if (value !== '') {
					any = true;
				}
				cells.push(value);
			}
			if (any) {
				parts.push(cells.join('\t'));
			}
		}
		parts.push('');
	}
	return parts.join('\n').trim();
}

/** Cap for sparse styled-cell listing in agent read output. */
export const AGENT_CONTEXT_MAX_STYLED_CELLS = 500;
/** Row scan cap (matches TSV extract). */
export const AGENT_CONTEXT_MAX_ROWS = 200;
/** Column scan cap (matches TSV extract). */
export const AGENT_CONTEXT_MAX_COLS = 50;

/** Compact style fields exposed to the agent (snake_case, sparse). */
export interface AgentCellStyle {
	bold?: boolean;
	italic?: boolean;
	fill_color?: string;
	text_color?: string;
	number_format?: string;
	alignment?: string;
	font_size?: number;
}

export interface AgentTableInfo {
	name: string;
	range: string;
	columns?: string[];
	styleName?: string;
	hasHeaderRow?: boolean;
	hasTotalsRow?: boolean;
	filterEnabled?: boolean;
}

export interface AgentChartInfo {
	index: number;
	chartType: string;
	title?: string;
	dataRange?: string;
	categoriesRef?: string;
	anchor?: string;
}

export interface AgentSheetContext {
	name: string;
	index: number;
	usedRange: string;
	tables: AgentTableInfo[];
	charts: AgentChartInfo[];
	mergedCells?: string[];
	formulas: Array<{ cell: string; formula: string; display: string }>;
	styledCells: Array<{ cell: string; style: AgentCellStyle }>;
}

/** Compact workbook metadata for `safeappeals_xlsx_read` (JSON-serializable). */
export interface WorkbookAgentContext {
	sheetNames: string[];
	sheets: AgentSheetContext[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cellA1(row: number, col: number): string {
	return `${getColName(col)}${row + 1}`;
}

function dimensionsToA1(rowCount: number, colCount: number): string {
	const rows = Math.max(0, rowCount);
	const cols = Math.max(0, colCount);
	if (rows <= 0 || cols <= 0) {
		return 'A1';
	}
	return `A1:${cellA1(rows - 1, cols - 1)}`;
}

function tableRangeToA1(range: unknown): string {
	if (typeof range === 'string' && range.trim()) {
		return range.trim();
	}
	if (!isRecord(range)) {
		return '';
	}
	const startRow = Number(range.start_row ?? range.startRow);
	const startCol = Number(range.start_col ?? range.startCol);
	const endRow = Number(range.end_row ?? range.endRow);
	const endCol = Number(range.end_col ?? range.endCol);
	if (![startRow, startCol, endRow, endCol].every(n => Number.isFinite(n) && n >= 0)) {
		return '';
	}
	const r0 = Math.min(startRow, endRow);
	const c0 = Math.min(startCol, endCol);
	const r1 = Math.max(startRow, endRow);
	const c1 = Math.max(startCol, endCol);
	if (r0 === r1 && c0 === c1) {
		return cellA1(r0, c0);
	}
	return `${cellA1(r0, c0)}:${cellA1(r1, c1)}`;
}

function normalizeAgentStyle(raw: unknown): AgentCellStyle | null {
	if (!isRecord(raw)) {
		return null;
	}
	const out: AgentCellStyle = {};
	if (raw.bold === true) {
		out.bold = true;
	}
	if (raw.italic === true) {
		out.italic = true;
	}
	const fill = raw.fill_color ?? raw.fillColor;
	if (typeof fill === 'string' && fill !== '') {
		out.fill_color = fill;
	}
	const text = raw.text_color ?? raw.textColor;
	if (typeof text === 'string' && text !== '') {
		out.text_color = text;
	}
	const numberFormat = raw.number_format ?? raw.numberFormat;
	if (typeof numberFormat === 'string' && numberFormat !== '') {
		out.number_format = numberFormat;
	}
	if (typeof raw.alignment === 'string' && raw.alignment !== '') {
		out.alignment = raw.alignment;
	}
	const fontSize = raw.font_size ?? raw.fontSize;
	if (typeof fontSize === 'number' && Number.isFinite(fontSize)) {
		out.font_size = fontSize;
	} else if (typeof fontSize === 'string' && fontSize !== '') {
		const n = Number(fontSize);
		if (!Number.isNaN(n)) {
			out.font_size = n;
		}
	}
	return Object.keys(out).length > 0 ? out : null;
}

function normalizeAgentTable(raw: unknown): AgentTableInfo | null {
	if (!isRecord(raw)) {
		return null;
	}
	const name = typeof raw.name === 'string' ? raw.name
		: typeof raw.display_name === 'string' ? raw.display_name
			: typeof raw.displayName === 'string' ? raw.displayName
				: '';
	const range = tableRangeToA1(raw.range);
	if (!name && !range) {
		return null;
	}
	const info: AgentTableInfo = {
		name: name || '(unnamed)',
		range: range || 'A1',
	};
	if (Array.isArray(raw.columns)) {
		const columns = raw.columns
			.map(col => {
				if (typeof col === 'string') {
					return col;
				}
				if (isRecord(col) && typeof col.name === 'string') {
					return col.name;
				}
				return '';
			})
			.filter(c => c !== '');
		if (columns.length > 0) {
			info.columns = columns;
		}
	}
	const styleName = raw.style_name ?? raw.styleName;
	if (typeof styleName === 'string' && styleName !== '') {
		info.styleName = styleName;
	}
	if (typeof raw.has_header_row === 'boolean') {
		info.hasHeaderRow = raw.has_header_row;
	} else if (typeof raw.hasHeaderRow === 'boolean') {
		info.hasHeaderRow = raw.hasHeaderRow;
	}
	if (typeof raw.has_totals_row === 'boolean') {
		info.hasTotalsRow = raw.has_totals_row;
	} else if (typeof raw.hasTotalsRow === 'boolean') {
		info.hasTotalsRow = raw.hasTotalsRow;
	}
	if (typeof raw.filter_enabled === 'boolean') {
		info.filterEnabled = raw.filter_enabled;
	} else if (typeof raw.filterEnabled === 'boolean') {
		info.filterEnabled = raw.filterEnabled;
	}
	return info;
}

function normalizeAgentChart(raw: unknown, index: number): AgentChartInfo | null {
	if (!isRecord(raw)) {
		return null;
	}
	const chartType = typeof raw.chart_type === 'string' ? raw.chart_type
		: typeof raw.chartType === 'string' ? raw.chartType
			: '';
	if (!chartType) {
		return null;
	}
	const info: AgentChartInfo = { index, chartType };
	if (typeof raw.title === 'string' && raw.title !== '') {
		info.title = raw.title;
	}
	const series0 = Array.isArray(raw.series) && isRecord(raw.series[0]) ? raw.series[0] : undefined;
	const dataRange = series0?.values_ref ?? series0?.valuesRef ?? raw.data_range ?? raw.dataRange;
	if (typeof dataRange === 'string' && dataRange !== '') {
		info.dataRange = dataRange;
	}
	const categoriesRef = series0?.categories_ref ?? series0?.categoriesRef;
	if (typeof categoriesRef === 'string' && categoriesRef !== '') {
		info.categoriesRef = categoriesRef;
	}
	if (isRecord(raw.anchor)) {
		const fromCol = Number(raw.anchor.from_col ?? raw.anchor.fromCol);
		const fromRow = Number(raw.anchor.from_row ?? raw.anchor.fromRow);
		if (Number.isFinite(fromCol) && Number.isFinite(fromRow) && fromCol >= 0 && fromRow >= 0) {
			info.anchor = cellA1(fromRow, fromCol);
		}
	} else if (typeof raw.anchor === 'string' && raw.anchor !== '') {
		info.anchor = raw.anchor;
	}
	return info;
}

function extractMergedCellA1(raw: unknown): string | null {
	if (typeof raw === 'string' && raw.trim()) {
		return raw.trim();
	}
	if (!isRecord(raw)) {
		return null;
	}
	const a1 = tableRangeToA1(raw);
	return a1 || null;
}

/**
 * Compact JSON-serializable workbook structure for the agent (tables, charts,
 * formulas, sparse styles). Pure — no vscode/DOM. Caps styled cells and scan
 * window so tool output stays bounded.
 */
export function extractWorkbookAgentContext(model: WorkbookModel): WorkbookAgentContext {
	const sheets = Array.isArray(model?.sheets) ? model.sheets : [];
	const sheetNames = sheets.map((s, i) => (typeof s?.name === 'string' && s.name !== '' ? s.name : `Sheet${i + 1}`));
	const outSheets: AgentSheetContext[] = [];

	for (let sheetIndex = 0; sheetIndex < sheets.length; sheetIndex++) {
		const sheet = sheets[sheetIndex];
		const name = sheetNames[sheetIndex];
		const rowCount = Math.max(0, sheet.row_count ?? 0);
		const colCount = Math.max(0, sheet.col_count ?? 0);
		const scanRows = Math.min(rowCount, AGENT_CONTEXT_MAX_ROWS);
		const scanCols = Math.min(colCount, AGENT_CONTEXT_MAX_COLS);

		const tables: AgentTableInfo[] = [];
		if (Array.isArray(sheet.tables)) {
			for (const t of sheet.tables) {
				const normalized = normalizeAgentTable(t);
				if (normalized) {
					tables.push(normalized);
				}
			}
		}

		const charts: AgentChartInfo[] = [];
		if (Array.isArray(sheet.charts)) {
			sheet.charts.forEach((c, i) => {
				const normalized = normalizeAgentChart(c, i);
				if (normalized) {
					charts.push(normalized);
				}
			});
		}

		const mergedRaw = sheet.merged_cells ?? sheet.mergedCells;
		let mergedCells: string[] | undefined;
		if (Array.isArray(mergedRaw) && mergedRaw.length > 0) {
			mergedCells = [];
			for (const m of mergedRaw) {
				const a1 = extractMergedCellA1(m);
				if (a1) {
					mergedCells.push(a1);
				}
			}
			if (mergedCells.length === 0) {
				mergedCells = undefined;
			}
		}

		const formulas: Array<{ cell: string; formula: string; display: string }> = [];
		const styledCells: Array<{ cell: string; style: AgentCellStyle }> = [];

		for (let r = 0; r < scanRows; r++) {
			const row = sheet.cells?.[String(r)];
			if (!row) {
				continue;
			}
			for (let c = 0; c < scanCols; c++) {
				const cell = row[String(c)];
				if (!cell) {
					continue;
				}
				const a1 = cellA1(r, c);
				const isFormula =
					cell.data_type === 'f' ||
					(typeof cell.value === 'string' && cell.value.trimStart().startsWith('='));
				if (isFormula) {
					formulas.push({
						cell: a1,
						formula: String(cell.value ?? ''),
						display: cellDisplayValue(cell),
					});
				}
				if (styledCells.length < AGENT_CONTEXT_MAX_STYLED_CELLS) {
					const style = normalizeAgentStyle(cell.style);
					if (style) {
						styledCells.push({ cell: a1, style });
					}
				}
			}
		}

		const sheetOut: AgentSheetContext = {
			name,
			index: sheetIndex,
			usedRange: dimensionsToA1(rowCount, colCount),
			tables,
			charts,
			formulas,
			styledCells,
		};
		if (mergedCells) {
			sheetOut.mergedCells = mergedCells;
		}
		outSheets.push(sheetOut);
	}

	return { sheetNames, sheets: outSheets };
}

/**
 * Combined agent read payload: workbook structure JSON + TSV cell values.
 */
export function formatWorkbookReadOutput(model: WorkbookModel): string {
	const structure = JSON.stringify(extractWorkbookAgentContext(model), null, 2);
	const tsv = extractWorkbookText(model);
	return `--- Workbook structure (JSON) ---\n${structure}\n--- Cell values (TSV) ---\n${tsv}`;
}

/*--------------------------------------------------------------------------------------
 *  XLSX Rust Viewer - Webview Entry Point
 *  This runs inside a VSCode webview (Electron iframe), NOT in a regular browser.
 *  - No ES modules (loaded as regular <script> tag)
 *  - WASM loaded via fetch + initSync from wasm-bindgen
 *  - No Web Workers for POC simplicity
 *--------------------------------------------------------------------------------------*/

import init, { XlsxParser, XlsxWriter, TableOps, FormulaEngine, init_panic_hook } from './wasm/xlsx_rust_viewer.js';
import { CanvasRenderer, FormulaRange } from './renderer.js';
import { Ribbon, RibbonEvent } from './ribbon.js';
import { ContextMenu, ContextMenuEvent } from './contextMenu.js';
import { FilterDropdown, FilterDropdownEvent } from './filterDropdown.js';
import { ConditionalFormatDialog, CFDialogEvent } from './conditionalFormatDialog.js';
import { ChartManager, ChartDefinition, RendererCoords } from './chartManager.js';
import { ChartWizardDialog, ChartWizardEvent } from './chartWizardDialog.js';

// VS Code API (available in webview context)
declare function acquireVsCodeApi(): { postMessage(msg: unknown): void; getState(): unknown; setState(state: unknown): void };
const vscode = acquireVsCodeApi();

// Track current file URI for state persistence
let currentFileUri = '';

// Global state
let parser: XlsxParser | null = null;
let writer: XlsxWriter | null = null;
let tableOps: TableOps | null = null;
let formulaEngine: FormulaEngine | null = null;
let renderer: CanvasRenderer | null = null;
let contextMenu: ContextMenu | null = null;
let filterDropdown: FilterDropdown | null = null;
let cfDialog: ConditionalFormatDialog | null = null;
let chartManager: ChartManager | null = null;
let chartWizard: ChartWizardDialog | null = null;
let ribbon: Ribbon | null = null;

async function initialize() {
	console.log('[XLSX Rust Viewer] Initializing...');

	const canvasContainer = document.getElementById('canvas-container');
	const ribbonContainer = document.getElementById('ribbon-container');
	if (!canvasContainer) {
		console.error('[XLSX Rust Viewer] No canvas container found');
		return;
	}

	// Initialize canvas renderer
	renderer = new CanvasRenderer(canvasContainer);
	renderer.setLoading(true);

	// Initialize ribbon (self-manages via DOM events and the action callback)
	if (ribbonContainer) {
		ribbon = new Ribbon(ribbonContainer, handleRibbonAction);
	}

	// Initialize custom context menu
	contextMenu = new ContextMenu(document.body, handleContextMenuAction);

	// Register table detector for context menu (will use renderer once initialized)
	contextMenu.setTableDetector((row, col) => {
		if (!renderer) return null;
		const table = renderer.getTableAtCell(row, col);
		if (!table) return null;
		return {
			name: table.name,
			has_totals_row: table.has_totals_row,
			has_header_row: table.has_header_row,
			filter_enabled: table.filter_enabled,
			column_count: table.columns.length,
		};
	});

	// Initialize filter dropdown for table column headers
	filterDropdown = new FilterDropdown(document.body, handleFilterDropdownAction);

	// Initialize conditional formatting dialog
	cfDialog = new ConditionalFormatDialog(document.body, handleCfDialogAction);

	// Chart manager will be initialized in setupRendererCallbacks after renderer is ready

	// Initialize chart wizard dialog
	chartWizard = new ChartWizardDialog(document.body, handleChartWizardAction);

	// Wire filter arrow clicks from renderer to the filter dropdown
	renderer.onFilterArrowClick = (tableName, colIndex, colName, screenX, screenY) => {
		if (!renderer || !filterDropdown) return;
		const uniqueValues = renderer.getColumnUniqueValues(tableName, colIndex);
		const currentFilter = renderer.getActiveFilter(tableName, colIndex);
		filterDropdown.show(screenX, screenY, tableName, colIndex, colName, uniqueValues, currentFilter);
	};

	// Get WASM URL from data attribute injected by the editor
	const configEl = document.getElementById('config');
	const wasmUrl = configEl?.getAttribute('data-wasm-url');

	if (!wasmUrl) {
		console.error('[XLSX Rust Viewer] No WASM URL provided');
		renderer.setLoading(false);
		return;
	}

	try {
		// Initialize WASM module - fetch binary and init
		await init(wasmUrl);
		init_panic_hook();

		// Create Rust instances
		parser = new XlsxParser();
		writer = new XlsxWriter();
		tableOps = new TableOps();
		formulaEngine = new FormulaEngine();

		console.log('[XLSX Rust Viewer] WASM initialized successfully');
		vscode.postMessage({ type: 'ready' });
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[XLSX Rust Viewer] WASM init failed:', message);
		renderer.setLoading(false);
		vscode.postMessage({ type: 'error', message });
	}
}

// Handle messages from the VSCode extension host
window.addEventListener('message', async (event) => {
	const message = event.data;
	console.log('[XLSX Rust Viewer] Received message:', message.type);

	switch (message.type) {
		case 'loadXLSX':
			currentFileUri = message.xlsxUri || '';
			await handleLoad(message.data);
			break;
		case 'saveXLSX':
			await handleSave(message.targetUri);
			break;
		case 'clearXLSX':
			if (renderer) {
				renderer.setData(null);
			}
			break;
		case 'layout':
			renderer?.resize();
			break;
		case 'applyEdits':
			if (renderer && message.operations) {
				handleApplyEdits(message.operations);
			}
			break;
	}
});

async function handleLoad(base64Data: string) {
	if (!parser || !renderer) {
		console.error('[XLSX Rust Viewer] Not initialized');
		return;
	}

	try {
		// Decode base64 to Uint8Array
		const binaryString = atob(base64Data);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}

		console.log('[XLSX Rust Viewer] Parsing file (' + bytes.length + ' bytes)...');

		// Parse via Rust WASM - returns JSON string
		const modelJsonStr = parser.load(bytes);

		// Parse JSON and pass to renderer
		const model = JSON.parse(modelJsonStr);

		// Debug: log model structure to diagnose data display issues
		const firstSheet = model.sheets?.[0];
		console.log('[XLSX Rust Viewer] Parsed model:', {
			sheetCount: model.sheets?.length ?? 0,
			firstSheetName: firstSheet?.name,
			rowCount: firstSheet?.row_count,
			colCount: firstSheet?.col_count,
			cellRowKeys: firstSheet?.cells ? Object.keys(firstSheet.cells).length : 0,
			sampleCells: firstSheet?.cells ? JSON.stringify(firstSheet.cells).substring(0, 500) : 'none'
		});

		renderer.setData(model);

		// Restore chart state from webview persistence (fallback if ZIP didn't have them)
		restoreChartState();

		evaluateFormulas();
		buildSheetTabs();
		syncChartOverlays();

	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[XLSX Rust Viewer] Load failed:', message);
		if (renderer) renderer.setLoading(false);
		vscode.postMessage({ type: 'error', message });
	}
}

// --- Formula Evaluation ---

function evaluateFormulas() {
	if (!formulaEngine || !renderer) return;
	const data = renderer.getData();
	const sheet = data?.sheets?.[renderer.getActiveSheetIndex()];
	if (!sheet?.cells) return;

	try {
		const cellsJson = JSON.stringify(sheet.cells);
		const resultJson = formulaEngine.evaluate_all(cellsJson);
		const results = JSON.parse(resultJson);
		renderer.setFormulaResults(results);
	} catch (e) {
		console.warn('[XLSX Rust Viewer] Formula evaluation error:', e);
	}
}

// --- Sheet Tabs ---

function buildSheetTabs() {
	if (!renderer) return;
	const container = document.getElementById('sheet-tabs');
	if (!container) return;
	container.innerHTML = '';

	const names = renderer.getSheetNames();
	const activeIdx = renderer.getActiveSheetIndex();

	for (let i = 0; i < names.length; i++) {
		const tab = document.createElement('button');
		tab.className = `sheet-tab${i === activeIdx ? ' active' : ''}`;
		tab.textContent = names[i];
		tab.title = names[i];
		tab.onclick = () => {
			if (!renderer) return;
			renderer.setActiveSheetIndex(i);
			evaluateFormulas();
			buildSheetTabs();
			syncChartOverlays();
		};
		tab.addEventListener('contextmenu', (e) => {
			e.preventDefault();
			showSheetTabMenu(e.clientX, e.clientY, i);
		});
		container.appendChild(tab);
	}

	// Add sheet button
	const addBtn = document.createElement('button');
	addBtn.className = 'sheet-tab sheet-tab-add';
	addBtn.textContent = '+';
	addBtn.title = 'Add Sheet';
	addBtn.onclick = () => addSheet();
	container.appendChild(addBtn);
}

function showSheetTabMenu(x: number, y: number, sheetIdx: number) {
	// Remove any existing menu
	const existing = document.getElementById('sheet-tab-menu');
	if (existing) existing.remove();

	const menu = document.createElement('div');
	menu.id = 'sheet-tab-menu';
	menu.className = 'xlsx-context-menu';
	menu.style.cssText = `position:fixed;left:${x}px;top:${y}px;z-index:10000;`;

	const items = [
		{ label: 'Rename Sheet', action: () => renameSheet(sheetIdx) },
		{ label: 'Delete Sheet', action: () => deleteSheet(sheetIdx) },
		{ label: 'Duplicate Sheet', action: () => duplicateSheet(sheetIdx) },
		{ label: 'Add Sheet', action: () => addSheet() },
	];

	for (const item of items) {
		const el = document.createElement('div');
		el.className = 'ctx-item';
		el.innerHTML = `<span class="ctx-label">${item.label}</span>`;
		el.onclick = () => { menu.remove(); item.action(); };
		menu.appendChild(el);
	}

	document.body.appendChild(menu);
	const close = (e: MouseEvent) => {
		if (!menu.contains(e.target as Node)) {
			menu.remove();
			document.removeEventListener('mousedown', close);
		}
	};
	setTimeout(() => document.addEventListener('mousedown', close), 0);
}

function addSheet() {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets) return;
	const name = `Sheet${data.sheets.length + 1}`;
	data.sheets.push({ name, cells: {}, row_count: 100, col_count: 26, tables: [], merged_cells: [], charts: [], sparklines: [] });
	renderer.updateModel(data);
	renderer.setActiveSheetIndex(data.sheets.length - 1);
	buildSheetTabs();
	markDirty();
}

function deleteSheet(idx: number) {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets || data.sheets.length <= 1) return;
	data.sheets.splice(idx, 1);
	const newIdx = Math.min(idx, data.sheets.length - 1);
	renderer.setActiveSheetIndex(newIdx);
	renderer.updateModel(data);
	buildSheetTabs();
	markDirty();
}

function renameSheet(idx: number) {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets?.[idx]) return;

	showRenameDialog(data.sheets[idx].name, (newName) => {
		if (newName && newName.trim()) {
			data.sheets[idx].name = newName.trim();
			renderer!.updateModel(data);
			buildSheetTabs();
			markDirty();
		}
	});
}

function duplicateSheet(idx: number) {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets?.[idx]) return;

	const original = data.sheets[idx];
	const copy = JSON.parse(JSON.stringify(original));
	copy.name = `${original.name} (Copy)`;
	data.sheets.splice(idx + 1, 0, copy);
	renderer.updateModel(data);
	renderer.setActiveSheetIndex(idx + 1);
	buildSheetTabs();
	markDirty();
}

async function handleSave(targetUri?: string) {
	if (!writer || !renderer) {
		console.error('[XLSX Rust Viewer] Not initialized');
		return;
	}

	try {
		const model = renderer.getData();
		if (!model) {
			console.error('[XLSX Rust Viewer] No data to save');
			return;
		}

		// Collect chart info for diagnostics
		const totalCharts = model.sheets?.reduce((sum: number, s: any) => sum + (s.charts?.length ?? 0), 0) ?? 0;
		const chartDebug = model.sheets?.map((s: any, i: number) => {
			const charts = s.charts ?? [];
			return `${s.name}: ${charts.length} chart(s)` +
				(charts.length > 0 ? ` [${charts.map((c: any) => `${c.chart_type}/${c.series?.length ?? 0}series/${c.series?.[0]?.values_ref ?? 'no-ref'}`).join(', ')}]` : '');
		});

		const modelJson = JSON.stringify(model);

		// Serialize model back to XLSX bytes via Rust WASM
		const savedBytes: Uint8Array = writer.save(modelJson);

		// Convert Uint8Array to base64 for transfer to extension host
		let binary = '';
		const chunkSize = 8192;
		for (let i = 0; i < savedBytes.length; i += chunkSize) {
			const chunk = savedBytes.subarray(i, Math.min(i + chunkSize, savedBytes.length));
			binary += String.fromCharCode.apply(null, Array.from(chunk));
		}
		const base64Data = btoa(binary);

		// Send save data and diagnostics to extension host (shows in main DevTools)
		vscode.postMessage({
			type: 'saveData',
			data: base64Data,
			targetUri,
			chartDiag: { totalCharts, sheets: chartDebug }
		});
	} catch (e: unknown) {
		const message = e instanceof Error ? e.message : String(e);
		console.error('[XLSX Rust Viewer] Save failed:', message);
		vscode.postMessage({ type: 'error', message });
	}
}

// --- AI Tool: Apply Edit Operations ---

function handleApplyEdits(operations: any[]) {
	if (!renderer) return;
	const model = renderer.getData();
	if (!model?.sheets) return;

	for (const op of operations) {
		const sheetIdx = resolveSheetIndex(model, op.sheet);
		if (sheetIdx < 0 && op.type !== 'create_table' && op.type !== 'resize_table'
			&& op.type !== 'rename_table' && op.type !== 'set_table_style'
			&& op.type !== 'toggle_table_filter' && op.type !== 'set_totals_row'
			&& op.type !== 'convert_table_to_range') {
			console.warn('[applyEdits] Sheet not found:', op.sheet);
			continue;
		}

		// Switch to the target sheet if needed
		if (sheetIdx >= 0 && sheetIdx !== renderer.getActiveSheetIndex()) {
			renderer.setActiveSheetIndex(sheetIdx);
		}

		switch (op.type) {
			case 'set_cell_value': {
				const ref = parseCellRef(op.cell);
				if (!ref) break;
				const dataType = typeof op.value === 'number' ? 'n' : 's';
				renderer.updateCell(ref.row, ref.col, String(op.value), dataType);
				break;
			}
			case 'set_cell_formula': {
				const ref = parseCellRef(op.cell);
				if (!ref) break;
				renderer.updateCell(ref.row, ref.col, op.formula, 's');
				break;
			}
			case 'format_cell': {
				const ref = parseCellRef(op.cell);
				if (!ref) break;
				renderer.setSelection(ref.row, ref.col, ref.row, ref.col);
				if (op.format) {
					if (op.format.bold !== undefined) renderer.toggleFormat('bold');
					if (op.format.italic !== undefined) renderer.toggleFormat('italic');
					if (op.format.backgroundColor) renderer.applyFormat('fillColor', op.format.backgroundColor);
					if (op.format.fontSize) renderer.applyFormat('fontSize', String(op.format.fontSize));
				}
				break;
			}
			case 'insert_row': {
				renderer.insertRow(op.rowIndex);
				break;
			}
			case 'insert_column': {
				renderer.insertCol(op.colIndex);
				break;
			}
			case 'delete_row': {
				renderer.deleteRow(op.rowIndex);
				break;
			}
		case 'delete_column': {
			renderer.deleteCol(op.colIndex);
			break;
		}
		// --- Table operations (delegate to existing handleTableAction) ---
		case 'create_table': {
			const range = parseCellRange(op.range);
			if (!range) {
				console.warn('[applyEdits] Invalid range for create_table:', op.range);
				break;
			}
			renderer.setSelection(range.startRow, range.startCol, range.endRow, range.endCol);
			handleTableAction('createTable', {
				name: op.tableName,
				style: op.styleName || 'TableStyleMedium2',
			});
			break;
		}
		case 'rename_table': {
			handleTableAction('renameTable', { oldName: op.oldName, newName: op.newName });
			break;
		}
		case 'set_table_style': {
			handleTableAction('setTableStyle', { tableName: op.tableName, style: op.styleName });
			break;
		}
		case 'toggle_table_filter': {
			handleTableAction('toggleFilter', { tableName: op.tableName });
			break;
		}
		case 'set_totals_row': {
			handleTableAction('setTotalsRow', { tableName: op.tableName, enabled: op.enabled });
			break;
		}
		case 'convert_table_to_range': {
			handleTableAction('convertToRange', { tableName: op.tableName });
			break;
		}
		// --- Chart operations ---
		case 'insert_chart': {
			const sheet = model.sheets[sheetIdx];
			if (!sheet) break;
			if (!sheet.charts) sheet.charts = [];

			const anchorCol = op.position ? (parseCellRef(op.position)?.col ?? 0) : 0;
			const anchorRow = op.position ? (parseCellRef(op.position)?.row ?? (sheet.charts.length > 0 ? 20 : 10)) : (sheet.charts.length > 0 ? 20 : 10);

			const chartDef: ChartDefinition = {
				chart_type: op.chart_type,
				title: op.title,
				series: [{ values_ref: op.data_range, categories_cache: [], values_cache: [] }],
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
			sheet.charts.push(chartDef);
			syncChartOverlays();
			break;
		}
		case 'delete_chart': {
			const sheet = model.sheets[sheetIdx];
			if (!sheet?.charts || op.chart_index >= sheet.charts.length) {
				console.warn('[applyEdits] Invalid chart_index for delete_chart:', op.chart_index);
				break;
			}
			sheet.charts.splice(op.chart_index, 1);
			syncChartOverlays();
			break;
		}
		default:
			console.warn('[applyEdits] Unknown operation type:', op.type);
	}
}

	markDirty();
	renderer.render();
}

function resolveSheetIndex(model: any, sheet: string | number | undefined): number {
	if (sheet === undefined || sheet === null) return 0;
	if (typeof sheet === 'number') return sheet;
	const idx = model.sheets.findIndex((s: any) => s.name === sheet);
	return idx >= 0 ? idx : 0;
}

// --- Ribbon Action Handler ---

function handleRibbonAction(event: RibbonEvent) {
	if (!renderer) return;

	switch (event.action) {
		// Clipboard
		case 'cut': handleCut(); break;
		case 'copy': handleCopy(); break;
		case 'paste': handlePaste(); break;

		// History
		case 'undo': renderer.undo(); break;
		case 'redo': renderer.redo(); break;

		// Font formatting
		case 'bold': renderer.toggleFormat('bold'); markDirty(); break;
		case 'italic': renderer.toggleFormat('italic'); markDirty(); break;
		case 'underline': renderer.toggleFormat('underline'); markDirty(); break;
		case 'strikethrough': renderer.toggleFormat('strikethrough'); markDirty(); break;
		case 'fontFamily': renderer.applyFormat('fontFamily', event.value); markDirty(); break;
		case 'fontSize': renderer.applyFormat('fontSize', event.value); markDirty(); break;
		case 'textColor': renderer.applyFormat('textColor', event.value); markDirty(); break;
		case 'fillColor': renderer.applyFormat('fillColor', event.value); markDirty(); break;

		// Alignment
		case 'alignLeft': renderer.applyFormat('alignment', 'left'); markDirty(); break;
		case 'alignCenter': renderer.applyFormat('alignment', 'center'); markDirty(); break;
		case 'alignRight': renderer.applyFormat('alignment', 'right'); markDirty(); break;
		case 'wrapText': renderer.toggleFormat('wrapText'); markDirty(); break;
		case 'mergeCells': renderer.mergeCellsSelection(); markDirty(); break;

		// Number format
		case 'numberFormat': renderer.applyFormat('numberFormat', event.value); markDirty(); break;
		case 'currency': renderer.applyFormat('numberFormat', 'Currency'); markDirty(); break;
		case 'percent': renderer.applyFormat('numberFormat', 'Percentage'); markDirty(); break;
		case 'comma': renderer.applyFormat('numberFormat', 'Number'); markDirty(); break;
		case 'increaseDecimal': /* TODO */ break;
		case 'decreaseDecimal': /* TODO */ break;

		// Cell operations
		case 'insertRow': renderer.insertRow(); markDirty(); break;
		case 'insertCol': renderer.insertCol(); markDirty(); break;
		case 'deleteRow': renderer.deleteRow(); markDirty(); break;
		case 'deleteCol': renderer.deleteCol(); markDirty(); break;

		// Formulas
		case 'formulaSum': insertFormula('SUM'); break;
		case 'formulaAvg': insertFormula('AVG'); break;
		case 'formulaCount': insertFormula('COUNT'); break;
		case 'formulaMin': insertFormula('MIN'); break;
		case 'formulaMax': insertFormula('MAX'); break;

		// Conditional Formatting
		case 'conditionalFormatting': showConditionalFormattingDialog(); break;

		// Charts
		case 'insertChart': showChartWizard(); break;

		// View
		case 'gridlines': renderer.toggleGridlines(); break;
		case 'headers': renderer.toggleHeaders(); break;
		case 'freezePanes': renderer.freezePanes(); break;

		// Data
		case 'sortAZ': renderer.sortColumn(true); markDirty(); break;
		case 'sortZA': renderer.sortColumn(false); markDirty(); break;
		case 'clear': renderer.clearSelectedCells(); markDirty(); break;

		// File
		case 'save': handleSave(); break;
		case 'print': {
			// window.print() is blocked in sandboxed webviews; capture canvas and route through extension host
			const canvas = document.querySelector('canvas');
			if (canvas) {
				const dataUrl = canvas.toDataURL('image/png');
				vscode.postMessage({ type: 'print', imageData: dataUrl });
			}
			break;
		}
		case 'exportPDF': {
			// Capture canvas and route through extension host for export
			const exportCanvas = document.querySelector('canvas');
			if (exportCanvas) {
				const dataUrl = exportCanvas.toDataURL('image/png');
				vscode.postMessage({ type: 'exportImage', imageData: dataUrl });
			}
			break;
		}

		// Table operations (from Insert and Data tabs)
		case 'createTable': {
			if (!renderer) break;
			// Don't create a table if the selection is already inside one
			const selCell = renderer.getSelectedCell();
			if (selCell && renderer.getTableAtCell(selCell.row, selCell.col)) {
				console.log('[XLSX Rust Viewer] Selection is already inside a table');
				break;
			}
			handleTableAction('createTable');
			break;
		}
		case 'toggleTableFilter': {
			if (!renderer) break;
			const sel = renderer.getSelectedCell();
			if (sel) {
				const table = renderer.getTableAtCell(sel.row, sel.col);
				if (table) handleTableAction('toggleFilter', { tableName: table.name });
			}
			break;
		}
		case 'toggleTotalsRow': {
			if (!renderer) break;
			const sel2 = renderer.getSelectedCell();
			if (sel2) {
				const table = renderer.getTableAtCell(sel2.row, sel2.col);
				if (table) handleTableAction('setTotalsRow', { tableName: table.name, enabled: !table.has_totals_row });
			}
			break;
		}
		case 'setTableStyle': {
			if (!renderer) break;
			const sel3 = renderer.getSelectedCell();
			if (sel3) {
				const table = renderer.getTableAtCell(sel3.row, sel3.col);
				if (table) handleTableAction('setTableStyle', { tableName: table.name, style: event.value });
			}
			break;
		}
		case 'convertToRange': {
			if (!renderer) break;
			const sel4 = renderer.getSelectedCell();
			if (sel4) {
				const table = renderer.getTableAtCell(sel4.row, sel4.col);
				if (table) handleTableAction('convertToRange', { tableName: table.name });
			}
			break;
		}
	}
}

// --- Context Menu Action Handler ---

function handleFilterDropdownAction(event: FilterDropdownEvent) {
	if (!renderer) return;

	switch (event.action) {
		case 'sortAZ':
			renderer.sortTableColumn(event.tableName, event.colIndex, true);
			break;
		case 'sortZA':
			renderer.sortTableColumn(event.tableName, event.colIndex, false);
			break;
		case 'filter':
			if (event.allowedValues) {
				renderer.applyFilter(event.tableName, event.colIndex, event.allowedValues);
			}
			break;
		case 'clearFilter':
			renderer.clearFilter(event.tableName, event.colIndex);
			break;
	}
}

function showConditionalFormattingDialog() {
	if (!renderer || !cfDialog) return;
	const data = renderer.getData();
	const sheet = data?.sheets?.[renderer.getActiveSheetIndex?.() ?? 0];
	const existingRules = sheet?.conditional_formats || [];

	// Get current selection as sqref default
	const sel = renderer.getSelectedCell();
	const selRange = renderer.getSelectedRange?.();
	let sqref = 'A1:A10';
	if (selRange) {
		const c1 = getColName(selRange.startCol) + (selRange.startRow + 1);
		const c2 = getColName(selRange.endCol) + (selRange.endRow + 1);
		sqref = `${c1}:${c2}`;
	} else if (sel) {
		sqref = getColName(sel.col) + (sel.row + 1);
	}

	cfDialog.show(sqref, existingRules);
}

function handleCfDialogAction(event: CFDialogEvent) {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets) return;
	const sheetIdx = renderer.getActiveSheetIndex?.() ?? 0;
	const sheet = data.sheets[sheetIdx];
	if (!sheet) return;
	if (!sheet.conditional_formats) sheet.conditional_formats = [];

	switch (event.action) {
		case 'add':
			if (event.rule) {
				sheet.conditional_formats.push(event.rule);
				renderer.render();
				markDirty();
			}
			break;
		case 'edit':
			if (event.rule && event.ruleIndex !== undefined && event.ruleIndex < sheet.conditional_formats.length) {
				sheet.conditional_formats[event.ruleIndex] = event.rule;
				renderer.render();
				markDirty();
			}
			break;
		case 'delete':
			if (event.ruleIndex !== undefined && event.ruleIndex < sheet.conditional_formats.length) {
				sheet.conditional_formats.splice(event.ruleIndex, 1);
				renderer.render();
				markDirty();
			}
			break;
		case 'close':
			break;
	}
}

function handleContextMenuAction(event: ContextMenuEvent) {
	if (!renderer) return;

	switch (event.action) {
		case 'cut': handleCut(); break;
		case 'copy': handleCopy(); break;
		case 'paste': handlePaste(); break;
		case 'insertRowAbove': renderer.insertRow(event.row); markDirty(); break;
		case 'insertRowBelow': renderer.insertRow(event.row + 1); markDirty(); break;
		case 'insertColLeft': renderer.insertCol(event.col); markDirty(); break;
		case 'insertColRight': renderer.insertCol(event.col + 1); markDirty(); break;
		case 'deleteRow': renderer.deleteRow(event.row); markDirty(); break;
		case 'deleteCol': renderer.deleteCol(event.col); markDirty(); break;
		case 'clear': renderer.clearSelectedCells(); markDirty(); break;
		case 'sortAZ': renderer.sortColumn(true, event.col); markDirty(); break;
		case 'sortZA': renderer.sortColumn(false, event.col); markDirty(); break;
	case 'formatCells':
		// Switch ribbon to Home tab to show formatting options
		break;

	// Column/Row header actions
	case 'clearCol':
		if (renderer) {
			const data = renderer.getData();
			const idx = renderer.getActiveSheetIndex();
			const sheet = data?.sheets?.[idx];
			if (sheet?.cells) {
				for (const rowKey of Object.keys(sheet.cells)) {
					const r = Number(rowKey);
					if (sheet.cells[r]?.[event.col]) {
						renderer.updateCell(r, event.col, '', 's');
					}
				}
			}
			markDirty();
		}
		break;
	case 'clearRow':
		if (renderer) {
			const data = renderer.getData();
			const idx = renderer.getActiveSheetIndex();
			const sheet = data?.sheets?.[idx];
			if (sheet?.cells?.[event.row]) {
				for (const colKey of Object.keys(sheet.cells[event.row])) {
					renderer.updateCell(event.row, Number(colKey), '', 's');
				}
			}
			markDirty();
		}
		break;
	case 'hideCol':
		if (renderer) {
			renderer.setColWidth(event.col, 0);
			renderer.render();
			markDirty();
		}
		break;
	case 'hideRow':
		if (renderer) {
			renderer.setRowHeight(event.row, 0);
			renderer.render();
			markDirty();
		}
		break;
	case 'colWidthAuto':
		if (renderer) {
			// Reset to default width
			renderer.setColWidth(event.col, 100);
			renderer.render();
			markDirty();
		}
		break;
	case 'rowHeightAuto':
		if (renderer) {
			// Reset to default height
			renderer.setRowHeight(event.row, 24);
			renderer.render();
			markDirty();
		}
		break;

	// Table-specific context menu actions
	case 'tableInsertColLeft':
	case 'tableInsertColRight':
		if (event.tableName) {
			const colName = `Column${Date.now() % 10000}`;
			handleTableAction('addTableColumn', { tableName: event.tableName, colName });
		}
		break;
	case 'tableDeleteCol':
		if (event.tableName && renderer) {
			const tbl = renderer.getTableAtCell(event.row, event.col);
			if (tbl) {
				const relCol = event.col - tbl.range.start_col;
				handleTableAction('removeTableColumn', { tableName: event.tableName, colIndex: relCol });
			}
		}
		break;
	case 'tableRename':
		if (event.tableName) {
			showRenameDialog(event.tableName, (newName) => {
				if (newName && newName !== event.tableName) {
					handleTableAction('renameTable', { oldName: event.tableName!, newName });
				}
			});
		}
		break;
	case 'tableResize':
		// Resize to current selection
		if (event.tableName && renderer) {
			const sel = renderer.getSelectedRange();
			if (sel) {
				const rangeJson = JSON.stringify({
					start_row: Math.min(sel.startRow, sel.endRow),
					start_col: Math.min(sel.startCol, sel.endCol),
					end_row: Math.max(sel.startRow, sel.endRow),
					end_col: Math.max(sel.startCol, sel.endCol),
				});
				handleTableAction('resizeTable', { tableName: event.tableName, range: rangeJson });
			}
		}
		break;
	case 'tableToggleHeaders':
		// Headers toggle is not directly supported as a simple operation; skip for now
		break;
	case 'tableToggleTotals':
		if (event.tableName && renderer) {
			const t = renderer.getTableAtCell(event.row, event.col);
			if (t) handleTableAction('setTotalsRow', { tableName: event.tableName, enabled: !t.has_totals_row });
		}
		break;
	case 'tableToggleFilter':
		if (event.tableName) {
			handleTableAction('toggleFilter', { tableName: event.tableName });
		}
		break;
	case 'tableConvertToRange':
		if (event.tableName) {
			handleTableAction('convertToRange', { tableName: event.tableName });
		}
		break;
	case 'tableDelete':
		if (event.tableName && renderer) {
			const tblDel = renderer.getTableAtCell(event.row, event.col);
			if (tblDel) {
				// Remove the table structure first
				handleTableAction('convertToRange', { tableName: event.tableName });
				// Then clear all cells in the table range
				const r = tblDel.range;
				for (let row = r.start_row; row <= r.end_row; row++) {
					for (let col = r.start_col; col <= r.end_col; col++) {
						renderer.updateCell(row, col, '', 's');
					}
				}
				markDirty();
			}
		}
		break;
	}
}

// --- Table Action Handler ---

export function handleTableAction(action: string, params?: Record<string, unknown>) {
	if (!renderer || !tableOps) return;

	const modelJson = JSON.stringify(renderer.getData());
	let result: string | undefined;

	try {
		switch (action) {
			case 'createTable': {
				const sel = renderer.getSelectedRange();
				if (!sel) return;
				const range = JSON.stringify({
					start_row: Math.min(sel.startRow, sel.endRow),
					start_col: Math.min(sel.startCol, sel.endCol),
					end_row: Math.max(sel.startRow, sel.endRow),
					end_col: Math.max(sel.startCol, sel.endCol),
				});
				const name = (params?.name as string) || `Table${Date.now()}`;
				const style = (params?.style as string) || (ribbon ? ribbon.getSelectedTableStyle() : 'TableStyleMedium2');
				result = tableOps.create_table(modelJson, 0, range, name, style);
				break;
			}
			case 'resizeTable': {
				const tableName = params?.tableName as string;
				const rangeJson = params?.range as string;
				if (!tableName || !rangeJson) return;
				result = tableOps.resize_table(modelJson, tableName, rangeJson);
				break;
			}
			case 'renameTable': {
				const oldName = params?.oldName as string;
				const newName = params?.newName as string;
				if (!oldName || !newName) return;
				result = tableOps.rename_table(modelJson, oldName, newName);
				break;
			}
			case 'addTableColumn': {
				const tableName = params?.tableName as string;
				const colName = (params?.colName as string) || 'NewColumn';
				if (!tableName) return;
				result = tableOps.add_table_column(modelJson, tableName, colName);
				break;
			}
			case 'removeTableColumn': {
				const tableName = params?.tableName as string;
				const colIndex = params?.colIndex as number;
				if (!tableName || colIndex === undefined) return;
				result = tableOps.remove_table_column(modelJson, tableName, colIndex);
				break;
			}
			case 'setTotalsRow': {
				const tableName = params?.tableName as string;
				const enabled = params?.enabled as boolean;
				const functions = (params?.functions as string) || '[]';
				if (!tableName) return;
				result = tableOps.set_totals_row(modelJson, tableName, !!enabled, functions);
				break;
			}
			case 'setTableStyle': {
				const tableName = params?.tableName as string;
				const styleName = (params?.style as string) || '';
				if (!tableName) return;
				result = tableOps.set_table_style(modelJson, tableName, styleName);
				break;
			}
			case 'toggleFilter': {
				const tableName = params?.tableName as string;
				if (!tableName) return;
				result = tableOps.toggle_filter(modelJson, tableName);
				break;
			}
			case 'convertToRange': {
				const tableName = params?.tableName as string;
				if (!tableName) return;
				result = tableOps.convert_to_range(modelJson, tableName);
				break;
			}
		}
	} catch (e: unknown) {
		const msg = e instanceof Error ? e.message : String(e);
		console.error('[XLSX Rust Viewer] Table operation failed:', msg);
		return;
	}

	if (result) {
		const newModel = JSON.parse(result);
		renderer.updateModel(newModel);
		markDirty();
	}
}

// --- Rename Dialog (webview can't use prompt()) ---

function showRenameDialog(currentName: string, onConfirm: (newName: string) => void) {
	// Remove any existing dialog
	const existing = document.getElementById('rename-dialog-overlay');
	if (existing) existing.remove();

	const overlay = document.createElement('div');
	overlay.id = 'rename-dialog-overlay';
	overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:10000;';

	const box = document.createElement('div');
	box.style.cssText = 'background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-focusBorder,#007fd4);border-radius:6px;padding:16px 20px;min-width:280px;box-shadow:0 4px 16px rgba(0,0,0,0.3);';

	const label = document.createElement('div');
	label.textContent = 'Rename Table';
	label.style.cssText = 'color:var(--vscode-foreground,#ccc);font-size:13px;font-weight:600;margin-bottom:10px;';
	box.appendChild(label);

	const input = document.createElement('input');
	input.type = 'text';
	input.value = currentName;
	input.style.cssText = 'width:100%;box-sizing:border-box;padding:5px 8px;font-size:13px;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;outline:none;';
	box.appendChild(input);

	const btnRow = document.createElement('div');
	btnRow.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;margin-top:12px;';

	const cancel = document.createElement('button');
	cancel.textContent = 'Cancel';
	cancel.style.cssText = 'padding:4px 12px;font-size:12px;background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;cursor:pointer;';
	cancel.onclick = () => overlay.remove();
	btnRow.appendChild(cancel);

	const ok = document.createElement('button');
	ok.textContent = 'OK';
	ok.style.cssText = 'padding:4px 12px;font-size:12px;background:var(--vscode-button-background,#007fd4);color:var(--vscode-button-foreground,#fff);border:none;border-radius:3px;cursor:pointer;';
	ok.onclick = () => { overlay.remove(); onConfirm(input.value.trim()); };
	btnRow.appendChild(ok);

	box.appendChild(btnRow);
	overlay.appendChild(box);
	document.body.appendChild(overlay);

	input.focus();
	input.select();

	// Enter/Escape
	input.addEventListener('keydown', (e) => {
		e.stopPropagation();
		if (e.key === 'Enter') { overlay.remove(); onConfirm(input.value.trim()); }
		if (e.key === 'Escape') overlay.remove();
	});

	// Click outside to cancel
	overlay.addEventListener('mousedown', (e) => {
		if (e.target === overlay) overlay.remove();
	});
}

// --- Clipboard ---

async function handleCut() {
	if (!renderer) return;
	const data = renderer.getSelectedCellsData();
	if (data) {
		try {
			await navigator.clipboard.writeText(data);
		} catch {
			// Fallback: copy via textarea
			fallbackCopy(data);
		}
		renderer.clearSelectedCells();
		markDirty();
	}
}

async function handleCopy() {
	if (!renderer) return;
	const data = renderer.getSelectedCellsData();
	if (data) {
		try {
			await navigator.clipboard.writeText(data);
		} catch {
			fallbackCopy(data);
		}
	}
}

async function handlePaste() {
	if (!renderer) return;
	try {
		const text = await navigator.clipboard.readText();
		renderer.pasteData(text);
		markDirty();
	} catch {
		console.warn('[XLSX Rust Viewer] Clipboard read not available');
	}
}

function fallbackCopy(text: string) {
	const ta = document.createElement('textarea');
	ta.value = text;
	ta.style.position = 'fixed';
	ta.style.left = '-9999px';
	document.body.appendChild(ta);
	ta.select();
	document.execCommand('copy');
	document.body.removeChild(ta);
}

// --- Formula Insertion ---

function insertFormula(type: string) {
	if (!renderer) return;
	const range = renderer.getSelectedRange();
	if (!range) return;

	// Build a formula string like =SUM(A1:B5)
	const norm = {
		startRow: Math.min(range.startRow, range.endRow),
		startCol: Math.min(range.startCol, range.endCol),
		endRow: Math.max(range.startRow, range.endRow),
		endCol: Math.max(range.startCol, range.endCol),
	};
	const startRef = getColName(norm.startCol) + (norm.startRow + 1);
	const endRef = getColName(norm.endCol) + (norm.endRow + 1);
	const funcName = type === 'AVG' ? 'AVERAGE' : type;
	const formula = `=${funcName}(${startRef}:${endRef})`;

	// Insert formula cell below the selection
	renderer.updateCell(norm.endRow + 1, norm.endCol, formula, 's');
	markDirty();
	evaluateFormulas();
}

// --- Keyboard Shortcuts ---

document.addEventListener('keydown', (e) => {
	if (!renderer) return;

	// Don't intercept keys when an input/textarea has focus (formula bar, cell editor)
	const active = document.activeElement;
	if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) {
		return;
	}

	// Ctrl/Cmd shortcuts
	if (e.ctrlKey || e.metaKey) {
		switch (e.key.toLowerCase()) {
			case 'z':
				e.preventDefault();
				if (e.shiftKey) {
					renderer.redo();
				} else {
					renderer.undo();
				}
				return;
			case 'y':
				e.preventDefault();
				renderer.redo();
				return;
			case 's':
				e.preventDefault();
				handleSave();
				return;
			case 'x':
				e.preventDefault();
				handleCut();
				return;
			case 'c':
				e.preventDefault();
				handleCopy();
				return;
			case 'v':
				e.preventDefault();
				handlePaste();
				return;
			case 'b':
				e.preventDefault();
				renderer.toggleFormat('bold');
				markDirty();
				return;
			case 'i':
				e.preventDefault();
				renderer.toggleFormat('italic');
				markDirty();
				return;
			case 'u':
				e.preventDefault();
				renderer.toggleFormat('underline');
				markDirty();
				return;
			case 'a':
				e.preventDefault();
				renderer.selectAll();
				return;
			case 'f':
				e.preventDefault();
				toggleFindBar();
				return;
			case 'h':
				e.preventDefault();
				toggleFindBar(true);
				return;
		}
	}
});

// --- Chart Functions ---

function getRendererCoords(): RendererCoords | null {
	if (!renderer) return null;
	return {
		cx: (col: number) => renderer!.publicCx(col),
		ry: (row: number) => renderer!.publicRy(row),
		cw: (col: number) => renderer!.publicCw(col),
		rh: (row: number) => renderer!.publicRh(row),
		getScrollLeft: () => renderer!.publicScrollLeft(),
		getScrollTop: () => renderer!.publicScrollTop(),
		getHeaderWidth: () => renderer!.publicHeaderWidth(),
		getHeaderHeight: () => renderer!.publicHeaderHeight(),
	};
}

function syncChartOverlays() {
	if (!renderer || !chartManager) return;
	const data = renderer.getData();
	const sheetIdx = renderer.getActiveSheetIndex();
	const charts = data?.sheets?.[sheetIdx]?.charts;
	const coords = getRendererCoords();
	if (coords) {
		chartManager.syncCharts(charts, coords);
	}
}

function showChartWizard(editIndex?: number) {
	if (!renderer || !chartWizard) return;
	const sel = renderer.getSelectedCell();
	const selRange = renderer.getSelectedRange?.();
	let defaultRange = 'A1:D10';
	const anchorRow = sel?.row ?? 0;
	const anchorCol = sel?.col ?? 0;

	if (selRange) {
		const c1 = getColName(selRange.startCol) + (selRange.startRow + 1);
		const c2 = getColName(selRange.endCol) + (selRange.endRow + 1);
		defaultRange = `${c1}:${c2}`;
	}

	let editDef: ChartDefinition | undefined;
	if (editIndex !== undefined) {
		const data = renderer.getData();
		const sheetIdx = renderer.getActiveSheetIndex();
		editDef = data?.sheets?.[sheetIdx]?.charts?.[editIndex];
	}

	chartWizard.show(defaultRange, anchorRow, anchorCol, editDef, editIndex);
}

function handleChartWizardAction(event: ChartWizardEvent) {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets) return;
	const sheetIdx = renderer.getActiveSheetIndex();
	const sheet = data.sheets[sheetIdx];
	if (!sheet) return;
	if (!sheet.charts) sheet.charts = [];

	switch (event.action) {
		case 'insert':
			if (event.chartDef) {
				resolveChartData(event.chartDef, sheet);
				sheet.charts.push(event.chartDef);
				syncChartOverlays();
				markDirty();
			}
			break;
		case 'update':
			if (event.chartDef && event.editIndex !== undefined && event.editIndex < sheet.charts.length) {
				resolveChartData(event.chartDef, sheet);
				sheet.charts[event.editIndex] = event.chartDef;
				syncChartOverlays();
				markDirty();
			}
			break;
	}
}

/**
 * Resolve chart series data references against actual cell data.
 * Populates values_cache/categories_cache from the sheet cells,
 * and ensures values_ref includes the sheet name for saving.
 */
function resolveChartData(chartDef: ChartDefinition, sheet: any) {
	const sheetName = sheet.name || 'Sheet1';
	const cells = sheet.cells || {};

	for (const series of chartDef.series) {
		if (series.values_ref) {
			// Ensure the range includes sheet name for the writer
			if (!series.values_ref.includes('!')) {
				series.values_ref = `${sheetName}!${series.values_ref}`;
			}

			// Parse range and read cell values
			const parsed = parseCellRange(series.values_ref);
			if (parsed) {
				const { startRow, startCol, endRow, endCol } = parsed;

				const isVertical = startCol === endCol;

				if (isVertical) {
					// Single column: first row is header, rest are values
					const cats: string[] = [];
					const vals: number[] = [];
					let dataStartRow = startRow;
					for (let r = startRow; r <= endRow; r++) {
						const cell = cells[r]?.[startCol];
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

					// Build proper values_ref for the data rows only
					const valCol = getColName(startCol);
					series.values_ref = `${sheetName}!${valCol}${dataStartRow + 1}:${valCol}${endRow + 1}`;
					// No separate categories column in vertical single-column layout
					if (!series.categories_ref) {
						series.categories_ref = undefined;
					}
				} else {
					// Multi-column: first column = categories, remaining columns = values
					const cats: string[] = [];
					const vals: number[] = [];
					let dataStartRow = startRow;

					// Check if first row is a header row
					const firstCell = cells[startRow]?.[startCol];
					const firstVal = getCellValue(firstCell);
					if (typeof firstVal === 'string' && isNaN(Number(firstVal))) {
						dataStartRow = startRow + 1;
					}

					for (let r = dataStartRow; r <= endRow; r++) {
						const catCell = cells[r]?.[startCol];
						const catVal = getCellValue(catCell);
						cats.push(String(catVal ?? `Row ${r + 1}`));
						// Sum remaining columns for this row
						let sum = 0;
						for (let c = startCol + 1; c <= endCol; c++) {
							const vCell = cells[r]?.[c];
							const v = getCellValue(vCell);
							sum += typeof v === 'number' ? v : (parseFloat(String(v)) || 0);
						}
						vals.push(sum);
					}
					series.categories_cache = cats;
					series.values_cache = vals;

					// Build proper separate references for categories and values
					const catCol = getColName(startCol);
					const valStartCol = getColName(startCol + 1);
					const valEndCol = getColName(endCol);
					series.categories_ref = `${sheetName}!${catCol}${dataStartRow + 1}:${catCol}${endRow + 1}`;
					series.values_ref = `${sheetName}!${valStartCol}${dataStartRow + 1}:${valEndCol}${endRow + 1}`;
				}
			}
		}
	}
}

function parseCellRange(ref: string): { startRow: number; startCol: number; endRow: number; endCol: number } | null {
	// Strip sheet name if present
	let range = ref;
	const bangIdx = range.indexOf('!');
	if (bangIdx >= 0) range = range.substring(bangIdx + 1);
	// Strip $ signs
	range = range.replace(/\$/g, '');

	const parts = range.split(':');
	if (parts.length < 2) return null;

	const start = parseCellRef(parts[0]);
	const end = parseCellRef(parts[1]);
	if (!start || !end) return null;

	return { startRow: start.row, startCol: start.col, endRow: end.row, endCol: end.col };
}

function parseCellRef(ref: string): { row: number; col: number } | null {
	const match = ref.match(/^([A-Za-z]+)(\d+)$/);
	if (!match) return null;
	return { col: parseColName(match[1].toUpperCase()), row: parseInt(match[2], 10) - 1 };
}

function getCellValue(cell: any): string | number | null {
	if (!cell) return null;
	if (cell.data_type === 'n') return parseFloat(cell.value) || 0;
	return cell.value ?? null;
}

function handleChartAction(action: string, chartIndex: number, chartDef?: ChartDefinition) {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets) return;
	const sheetIdx = renderer.getActiveSheetIndex();
	const sheet = data.sheets[sheetIdx];
	if (!sheet?.charts) return;

	switch (action) {
		case 'delete':
			sheet.charts.splice(chartIndex, 1);
			syncChartOverlays();
			markDirty();
			break;
		case 'moved':
			if (chartDef && chartIndex < sheet.charts.length) {
				sheet.charts[chartIndex] = chartDef;
				markDirty();
			}
			break;
		case 'editChart':
			showChartWizard(chartIndex);
			break;
		case 'select':
			// Selection visual feedback is handled by ChartOverlay
			break;
	}
}

// --- Helpers ---

function markDirty() {
	vscode.postMessage({ type: 'dirty' });
	persistChartState();
}

/** Save chart definitions to webview state so they survive tab switches */
function persistChartState() {
	if (!renderer || !currentFileUri) return;
	const data = renderer.getData();
	if (!data?.sheets) return;

	const chartState: Record<string, any[]> = {};
	for (const sheet of data.sheets) {
		if (sheet.charts?.length) {
			chartState[sheet.name] = sheet.charts;
		}
	}

	// Merge into existing state (other files' charts are preserved)
	const prev = (vscode.getState() as Record<string, unknown>) || {};
	vscode.setState({ ...prev, [currentFileUri]: chartState });
}

/** Restore chart definitions from webview state after loading a file */
function restoreChartState() {
	if (!renderer || !currentFileUri) return;
	const state = vscode.getState() as Record<string, Record<string, any[]>> | null;
	if (!state || !state[currentFileUri]) return;

	const data = renderer.getData();
	if (!data?.sheets) return;

	const chartState = state[currentFileUri];
	let restored = 0;
	for (const sheet of data.sheets) {
		if (chartState[sheet.name]?.length && (!sheet.charts || sheet.charts.length === 0)) {
			sheet.charts = chartState[sheet.name];
			restored += sheet.charts.length;
		}
	}
	if (restored > 0) {
		console.log(`[XLSX Rust Viewer] Restored ${restored} chart(s) from webview state`);
	}
}

// Wire up renderer callbacks
function setupRendererCallbacks() {
	if (!renderer) return;

	// Initialize chart manager now that renderer is ready
	chartManager = new ChartManager(renderer.getWrapper(), handleChartAction);

	// Chart overlay repositioning on scroll/render
	renderer.onScrollChanged = () => {
		if (chartManager) {
			const coords = getRendererCoords();
			if (coords) chartManager.updatePositions(coords);
		}
	};

	// Custom HTML context menu (replaces native)
	renderer.onContextMenu = (row: number, col: number, x: number, y: number, headerType?: 'col' | 'row') => {
		if (contextMenu) {
			contextMenu.show(x, y, row, col, headerType);
		}
	};

	// Cell edit -> notify extension host of dirty state + re-evaluate formulas
	renderer.onCellEdit = (_row: number, _col: number, _value: string) => {
		markDirty();
		// Keep table column header names in sync with cell edits
		renderer!.syncTableHeaderName(_row, _col, _value);
		if (formulaEngine) {
			formulaEngine.invalidate(_row, _col);
		}
		evaluateFormulas();
	};

	// Selection changed -> update formula bar
	renderer.onSelectionChanged = (row: number, col: number) => {
		updateFormulaBar(row, col);
	};

	// Formula point-mode callbacks
	renderer.onFormulaRangeSelect = (row: number, col: number) => {
		handleFormulaPointClick(row, col);
	};

	renderer.onFormulaRangeDrag = (startRow: number, startCol: number, endRow: number, endCol: number) => {
		handleFormulaPointDrag(startRow, startCol, endRow, endCol);
	};

	// When a formula point-mode drag ends (mouseup), keep formulaDragActive=true
	// so the next click REPLACES the current reference instead of inserting a
	// duplicate.  formulaDragActive is reset when the user types in the formula
	// bar or inline editor (input event), which signals a new insertion point.
	renderer.onFormulaRangeDragEnd = () => {
		// intentionally do NOT reset formulaDragActive here
	};

	// Inline editor formula mode integration
	renderer.onInlineEditInput = (value: string) => {
		if (value.startsWith('=')) {
			enterFormulaMode();
			syncFormulaHighlights();
		} else if (isFormulaMode) {
			exitFormulaMode();
		}
		// User typed in the inline editor — reset point-mode so next click
		// inserts a fresh reference instead of replacing the previous one.
		formulaDragActive = false;
		formulaInsertStart = -1;
		formulaInsertEnd = -1;
	};

	renderer.onInlineEditCommit = () => {
		exitFormulaMode();
	};

	renderer.onInlineEditCancel = () => {
		exitFormulaMode();
	};
}

function updateFormulaBar(row: number, col: number) {
	const cellRefEl = document.getElementById('cell-ref');
	const formulaInput = document.getElementById('formula-input') as HTMLInputElement | null;
	if (cellRefEl) {
		cellRefEl.textContent = getColName(col) + (row + 1);
	}
	if (formulaInput && renderer) {
		const data = renderer.getData();
		const idx = renderer.getActiveSheetIndex();
		const cell = data?.sheets?.[idx]?.cells?.[row]?.[col];
		// Always show the raw formula in the formula bar (not the computed result)
		formulaInput.value = cell?.value ?? '';

		// If navigating away from formula editing, exit formula mode
		if (isFormulaMode) {
			exitFormulaMode();
		}
	}
}

function getColName(n: number): string {
	let s = '';
	let idx = n;
	while (idx >= 0) {
		s = String.fromCharCode((idx % 26) + 65) + s;
		idx = Math.floor(idx / 26) - 1;
	}
	return s;
}

/** Convert a column name like "A", "Z", "AA" to a zero-based index */
function parseColName(name: string): number {
	let result = 0;
	for (let i = 0; i < name.length; i++) {
		result = result * 26 + (name.charCodeAt(i) - 64);
	}
	return result - 1;
}

// --- Formula Point-Mode (cell reference selection) ---

const RANGE_COLORS = [
	'#4472C4', '#ED7D31', '#70AD47', '#FFC000',
	'#5B9BD5', '#FF0000', '#7030A0', '#00B0F0',
];

let isFormulaMode = false;
/** Index into the formula text where the last point-mode reference was inserted */
let formulaInsertStart = -1;
let formulaInsertEnd = -1;
/** Track whether the current mousedown-drag is actively extending a range */
let formulaDragActive = false;
/** Saved cursor position -- captured before the formula bar loses focus on canvas click */
let formulaSavedCursor = -1;

/**
 * Extract all cell/range references from a formula string and assign colors.
 * Returns FormulaRange[] for rendering on the canvas.
 */
function extractFormulaRanges(formula: string): FormulaRange[] {
	const ranges: FormulaRange[] = [];
	if (!formula.startsWith('=')) return ranges;

	// Match cell references and ranges, but not inside quotes
	// Handles: A1, $B$3, AA100, A1:B5, $A$1:$Z$99
	const refPattern = /(\$?[A-Z]{1,3}\$?\d+)(?::(\$?[A-Z]{1,3}\$?\d+))?/g;
	let colorIdx = 0;
	let match: RegExpExecArray | null;

	while ((match = refPattern.exec(formula)) !== null) {
		const startRef = match[1];
		const endRef = match[2];

		const startCell = parseCellRef(startRef);
		if (!startCell) continue;

		let endCell = endRef ? parseCellRef(endRef) : null;
		if (!endCell) endCell = startCell;

		ranges.push({
			startRow: startCell.row,
			startCol: startCell.col,
			endRow: endCell.row,
			endCol: endCell.col,
			color: RANGE_COLORS[colorIdx % RANGE_COLORS.length],
			textStart: match.index,
			textEnd: match.index + match[0].length,
		});
		colorIdx++;
	}

	return ranges;
}

/** Build a cell reference string from row/col (0-based) */
function cellRef(row: number, col: number): string {
	return getColName(col) + (row + 1);
}

/** Build a range reference string like "A1:C5" */
function rangeRef(r1: number, c1: number, r2: number, c2: number): string {
	const sr = Math.min(r1, r2), er = Math.max(r1, r2);
	const sc = Math.min(c1, c2), ec = Math.max(c1, c2);
	if (sr === er && sc === ec) return cellRef(sr, sc);
	return cellRef(sr, sc) + ':' + cellRef(er, ec);
}

/**
 * Check if the cursor is at a position in the formula text where a cell reference
 * is expected (after '(', ',', '+', '-', '*', '/', '=', '<', '>', ' ', '^', '&').
 * Note: ':' is NOT included -- it's the range separator and is handled by drag logic.
 */
function cursorExpectsRef(text: string, cursorPos: number): boolean {
	if (cursorPos <= 0) return false;
	// Look at the character just before the cursor
	const before = text.substring(0, cursorPos).trimEnd();
	if (before.length === 0) return false;
	const lastChar = before[before.length - 1];
	return '(,+-*/=<>^& '.includes(lastChar);
}

/** Enter formula mode and sync highlights */
function enterFormulaMode() {
	if (isFormulaMode) return;
	isFormulaMode = true;
	formulaInsertStart = -1;
	formulaInsertEnd = -1;
	formulaDragActive = false;
	if (renderer) renderer.setFormulaMode(true);
	syncFormulaHighlights();
}

/** Exit formula mode and clear highlights */
function exitFormulaMode() {
	if (!isFormulaMode) return;
	isFormulaMode = false;
	formulaInsertStart = -1;
	formulaInsertEnd = -1;
	formulaDragActive = false;
	if (renderer) renderer.setFormulaMode(false);
}

/** Read the formula bar text, extract ranges, and push highlights to the renderer */
function syncFormulaHighlights() {
	if (!renderer || !isFormulaMode) return;
	const formulaInput = getActiveFormulaInput();
	if (!formulaInput) return;
	const ranges = extractFormulaRanges(formulaInput.value);
	renderer.setFormulaRanges(ranges);
}

/**
 * Get the active formula input element -- either the formula bar or the inline cell editor.
 * Returns whichever is currently relevant for formula editing.
 */
function getActiveFormulaInput(): HTMLInputElement | null {
	// Check if inline editor is active
	if (renderer) {
		const editing = renderer.getEditingCell();
		if (editing) {
			const val = renderer.getEditInputValue();
			if (val.startsWith('=')) {
				// The inline editor is active with a formula; use it as the source
				// but we always update the formula bar too
				return document.getElementById('formula-input') as HTMLInputElement | null;
			}
		}
	}
	return document.getElementById('formula-input') as HTMLInputElement | null;
}

/**
 * Handle a point-mode click: insert/replace a cell reference at the cursor position.
 * Called from renderer.onFormulaRangeSelect.
 */
function handleFormulaPointClick(row: number, col: number) {
	const formulaInput = getActiveFormulaInput();
	if (!formulaInput || !isFormulaMode) return;

	const ref = cellRef(row, col);
	const text = formulaInput.value;

	// Use saved cursor (captured on blur) since the formula bar lost focus when canvas was clicked.
	// Fall back to selectionStart or end of text if saved cursor is invalid.
	let cursor = formulaSavedCursor >= 0 ? formulaSavedCursor : (formulaInput.selectionStart ?? text.length);
	// Clamp to valid range
	cursor = Math.min(cursor, text.length);

	if (formulaDragActive && formulaInsertStart >= 0 && formulaInsertEnd >= 0 && formulaInsertEnd <= text.length) {
		// This is a NEW click while a previous drag reference still exists.
		// Check: is the cursor still at the end of the previous insertion?
		// If so, replace the previous reference with the new cell ref.
		// If not, the user moved the cursor (typed something), so insert fresh.
		if (cursor >= formulaInsertStart && cursor <= formulaInsertEnd) {
			const before = text.substring(0, formulaInsertStart);
			const after = text.substring(formulaInsertEnd);
			formulaInput.value = before + ref + after;
			formulaInsertEnd = formulaInsertStart + ref.length;
		} else {
			// Cursor moved away from previous insertion -- treat as a fresh insert
			insertRefAtCursor(formulaInput, text, cursor, ref);
		}
	} else {
		// First click: insert at cursor position
		insertRefAtCursor(formulaInput, text, cursor, ref);
	}

	// Also sync to inline editor if it's active
	if (renderer && renderer.getEditingCell()) {
		renderer.setEditInputValue(formulaInput.value, formulaInsertEnd);
	}

	formulaDragActive = true;
	formulaSavedCursor = -1;
	syncFormulaHighlights();

	// Keep focus on the formula bar so the user can continue typing
	formulaInput.focus();
	formulaInput.setSelectionRange(formulaInsertEnd, formulaInsertEnd);
}

/** Insert a cell reference at the cursor position in the formula input */
function insertRefAtCursor(formulaInput: HTMLInputElement, text: string, cursor: number, ref: string) {
	if (cursorExpectsRef(text, cursor)) {
		const before = text.substring(0, cursor);
		const after = text.substring(cursor);
		formulaInput.value = before + ref + after;
		formulaInsertStart = cursor;
		formulaInsertEnd = cursor + ref.length;
	} else {
		// Cursor is right after a cell ref or similar -- just append at cursor
		const before = text.substring(0, cursor);
		const after = text.substring(cursor);
		formulaInput.value = before + ref + after;
		formulaInsertStart = cursor;
		formulaInsertEnd = cursor + ref.length;
	}
}

/**
 * Handle point-mode drag: update the reference to a range.
 * Called from renderer.onFormulaRangeDrag.
 */
function handleFormulaPointDrag(startRow: number, startCol: number, endRow: number, endCol: number) {
	const formulaInput = getActiveFormulaInput();
	if (!formulaInput || !isFormulaMode) return;

	if (formulaInsertStart < 0 || formulaInsertEnd < 0) return;

	const ref = rangeRef(startRow, startCol, endRow, endCol);
	const text = formulaInput.value;

	// Validate that our tracked insertion range is still within the text
	if (formulaInsertEnd > text.length) {
		formulaInsertEnd = text.length;
	}

	const before = text.substring(0, formulaInsertStart);
	const after = text.substring(formulaInsertEnd);
	formulaInput.value = before + ref + after;
	formulaInsertEnd = formulaInsertStart + ref.length;
	formulaInput.setSelectionRange(formulaInsertEnd, formulaInsertEnd);

	// Also sync to inline editor if it's active
	if (renderer && renderer.getEditingCell()) {
		renderer.setEditInputValue(formulaInput.value, formulaInsertEnd);
	}

	syncFormulaHighlights();
}

// --- Find & Replace Bar ---

let findBarVisible = false;

function toggleFindBar(showReplace: boolean = false) {
	let bar = document.getElementById('find-bar');
	if (bar && findBarVisible) {
		bar.remove();
		findBarVisible = false;
		if (renderer) renderer.clearFind();
		return;
	}
	if (bar) bar.remove();

	bar = document.createElement('div');
	bar.id = 'find-bar';
	bar.style.cssText = 'position:absolute;top:0;right:0;z-index:1000;background:var(--vscode-editorWidget-background,#252526);border:1px solid var(--vscode-focusBorder,#007acc);border-radius:0 0 0 6px;padding:8px 12px;box-shadow:0 4px 12px rgba(0,0,0,0.4);display:flex;flex-direction:column;gap:4px;';

	// Find row
	const findRow = document.createElement('div');
	findRow.style.cssText = 'display:flex;align-items:center;gap:6px;';

	const findInput = document.createElement('input');
	findInput.type = 'text';
	findInput.placeholder = 'Find...';
	findInput.style.cssText = 'width:200px;padding:3px 8px;font-size:12px;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;outline:none;';

	const matchLabel = document.createElement('span');
	matchLabel.style.cssText = 'font-size:11px;color:var(--vscode-descriptionForeground,#888);min-width:60px;';
	matchLabel.textContent = 'No results';

	const prevBtn = document.createElement('button');
	prevBtn.textContent = '\u25B2';
	prevBtn.title = 'Previous';
	prevBtn.style.cssText = 'padding:2px 6px;font-size:11px;background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;cursor:pointer;';
	prevBtn.onclick = () => { if (renderer) { const idx = renderer.findPrev(); updateMatchLabel(idx); } };

	const nextBtn = document.createElement('button');
	nextBtn.textContent = '\u25BC';
	nextBtn.title = 'Next';
	nextBtn.style.cssText = prevBtn.style.cssText;
	nextBtn.onclick = () => { if (renderer) { const idx = renderer.findNext(); updateMatchLabel(idx); } };

	const closeBtn = document.createElement('button');
	closeBtn.textContent = '\u2715';
	closeBtn.title = 'Close';
	closeBtn.style.cssText = 'padding:2px 6px;font-size:11px;background:transparent;color:var(--vscode-foreground,#ccc);border:none;cursor:pointer;';
	closeBtn.onclick = () => { bar!.remove(); findBarVisible = false; if (renderer) renderer.clearFind(); };

	findRow.appendChild(findInput);
	findRow.appendChild(matchLabel);
	findRow.appendChild(prevBtn);
	findRow.appendChild(nextBtn);
	findRow.appendChild(closeBtn);
	bar.appendChild(findRow);

	// Replace row (optional)
	let replaceInput: HTMLInputElement | null = null;
	if (showReplace) {
		const replaceRow = document.createElement('div');
		replaceRow.style.cssText = 'display:flex;align-items:center;gap:6px;';

		replaceInput = document.createElement('input');
		replaceInput.type = 'text';
		replaceInput.placeholder = 'Replace...';
		replaceInput.style.cssText = findInput.style.cssText;

		const replaceBtn = document.createElement('button');
		replaceBtn.textContent = 'Replace';
		replaceBtn.style.cssText = 'padding:2px 8px;font-size:11px;background:var(--vscode-button-background,#007fd4);color:var(--vscode-button-foreground,#fff);border:none;border-radius:3px;cursor:pointer;';
		replaceBtn.onclick = () => {
			if (renderer && replaceInput) {
				renderer.replaceCurrentMatch(replaceInput.value);
				updateMatchLabel(renderer.getFindMatchIndex());
				markDirty();
			}
		};

		const replaceAllBtn = document.createElement('button');
		replaceAllBtn.textContent = 'Replace All';
		replaceAllBtn.style.cssText = replaceBtn.style.cssText;
		replaceAllBtn.onclick = () => {
			if (renderer && replaceInput) {
				const count = renderer.replaceAll(findInput.value, replaceInput.value);
				matchLabel.textContent = `Replaced ${count}`;
				markDirty();
			}
		};

		replaceRow.appendChild(replaceInput);
		replaceRow.appendChild(replaceBtn);
		replaceRow.appendChild(replaceAllBtn);
		bar.appendChild(replaceRow);

		replaceInput.addEventListener('keydown', (e) => { e.stopPropagation(); });
	}

	function updateMatchLabel(idx: number) {
		if (!renderer) return;
		const count = renderer.getFindMatchCount();
		if (count === 0) {
			matchLabel.textContent = 'No results';
		} else {
			matchLabel.textContent = `${idx + 1} of ${count}`;
		}
	}

	findInput.addEventListener('input', () => {
		if (!renderer) return;
		const count = renderer.findInSheet(findInput.value);
		if (count > 0) {
			matchLabel.textContent = `1 of ${count}`;
		} else {
			matchLabel.textContent = 'No results';
		}
	});

	findInput.addEventListener('keydown', (e) => {
		e.stopPropagation();
		if (e.key === 'Enter') {
			if (renderer) { const idx = renderer.findNext(); updateMatchLabel(idx); }
		} else if (e.key === 'Escape') {
			bar!.remove();
			findBarVisible = false;
			if (renderer) renderer.clearFind();
		}
	});

	const canvasContainer = document.getElementById('canvas-container');
	if (canvasContainer) {
		canvasContainer.appendChild(bar);
	}
	findBarVisible = true;
	findInput.focus();
}

// --- Start ---

document.addEventListener('DOMContentLoaded', async () => {
	await initialize();
	setupRendererCallbacks();

	// Formula bar input
	const formulaInput = document.getElementById('formula-input') as HTMLInputElement | null;
	if (formulaInput) {
		// Stop propagation on all keys so canvas/global handlers don't interfere
		formulaInput.addEventListener('keydown', (e) => {
			e.stopPropagation();
			if (e.key === 'Enter' && renderer) {
				e.preventDefault();
				const sel = renderer.getSelectedCell();
				if (sel) {
					const val = formulaInput.value;
					// Formulas start with '=' and should be stored as string type
					const dataType = val.startsWith('=') ? 's' : (val.trim() !== '' && !isNaN(Number(val)) ? 'n' : 's');
					renderer.updateCell(sel.row, sel.col, val, dataType);
					markDirty();
					if (formulaEngine) formulaEngine.invalidate(sel.row, sel.col);
					evaluateFormulas();
					exitFormulaMode();
					// Return focus to canvas so arrow keys etc. work again
					const canvas = document.querySelector('canvas');
					if (canvas) canvas.focus();
				}
			} else if (e.key === 'Escape') {
				e.preventDefault();
				// Revert to current cell value and return focus
				if (renderer) {
					const sel = renderer.getSelectedCell();
					if (sel) {
						const data = renderer.getData();
						const idx = renderer.getActiveSheetIndex();
						const cell = data?.sheets?.[idx]?.cells?.[sel.row]?.[sel.col];
						formulaInput.value = cell?.value ?? '';
					}
				}
				exitFormulaMode();
				const canvas = document.querySelector('canvas');
				if (canvas) canvas.focus();
			}
		});

		// Track input changes to enter/exit formula mode and update highlights
		formulaInput.addEventListener('input', () => {
			const val = formulaInput.value;
			if (val.startsWith('=')) {
				enterFormulaMode();
				syncFormulaHighlights();
			} else {
				exitFormulaMode();
			}
			// User typed in the formula bar — reset point-mode so next click
			// inserts a fresh reference instead of replacing the previous one.
			formulaDragActive = false;
			formulaInsertStart = -1;
			formulaInsertEnd = -1;
		});

		// When formula bar gets focus, check if we should enter formula mode
		formulaInput.addEventListener('focus', () => {
			const val = formulaInput.value;
			if (val.startsWith('=')) {
				enterFormulaMode();
			}
			// Don't select-all if we're in formula mode (point-mode sets its own cursor)
			if (!isFormulaMode) {
				formulaInput.select();
			}
		});

		// Save the cursor position before the formula bar loses focus (canvas click steals focus)
		formulaInput.addEventListener('blur', () => {
			formulaSavedCursor = formulaInput.selectionStart ?? -1;
			// Delay to allow point-mode clicks on the canvas to register first.
			setTimeout(() => {
				if (renderer && renderer.isFormulaMode()) {
					// Still in formula mode -- a point-mode click happened, keep mode active
					return;
				}
				exitFormulaMode();
			}, 250);
		});
	}
});

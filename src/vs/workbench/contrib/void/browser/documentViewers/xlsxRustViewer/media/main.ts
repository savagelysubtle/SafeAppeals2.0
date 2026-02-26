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
import { ValidationDialog, VDDialogEvent } from './validationDialog.js';
import { FormatCellsDialog, FCDialogEvent } from './formatCellsDialog.js';
import { HyperlinkDialog, HLDialogEvent } from './hyperlinkDialog.js';
import { NameManagerDialog, NMDialogEvent, DefinedNameDef } from './nameManagerDialog.js';
import { ChartManager, ChartDefinition, RendererCoords } from './chartManager.js';
import { ChartWizardDialog, ChartWizardEvent } from './chartWizardDialog.js';
import { PasteSpecialDialog, PSDialogEvent } from './pasteSpecialDialog.js';
import { PivotTableDialog, PivotDialogEvent, PivotTableDef } from './pivotTableDialog.js';
import { computePivotTable, PivotOutput } from './pivotTableEngine.js';
import { PageSetupDialog, PageSetupDef, PageSetupEvent } from './pageSetupDialog.js';
import { CsvImportDialog, CsvImportEvent } from './csvImportDialog.js';

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
let vdDialog: ValidationDialog | null = null;
let fcDialog: FormatCellsDialog | null = null;
let hlDialog: HyperlinkDialog | null = null;
let nmDialog: NameManagerDialog | null = null;
let chartManager: ChartManager | null = null;
let chartWizard: ChartWizardDialog | null = null;
let psDialog: PasteSpecialDialog | null = null;
let pivotDialog: PivotTableDialog | null = null;
let pageSetupDialog: PageSetupDialog | null = null;
let csvImportDialog: CsvImportDialog | null = null;
let ribbon: Ribbon | null = null;

// Workbook-level pivot table configs (synced with model.pivot_tables)
let pivotTables: PivotTableDef[] = [];
// Last computed pivot output per pivot index (for drill-down)
const pivotOutputCache: Map<number, PivotOutput> = new Map();

// Workbook-level defined names (named ranges)
let definedNames: DefinedNameDef[] = [];

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

	// Initialize data validation dialog
	vdDialog = new ValidationDialog(document.body, handleVdDialogAction);

	// Initialize format cells dialog
	fcDialog = new FormatCellsDialog(document.body, handleFcDialogAction);

	// Initialize hyperlink dialog
	hlDialog = new HyperlinkDialog(document.body, handleHlDialogAction);

	// Initialize name manager dialog
	nmDialog = new NameManagerDialog(document.body, handleNmDialogAction);

	// Initialize paste special dialog
	psDialog = new PasteSpecialDialog(document.body, handlePsDialogAction);

	// Initialize pivot table dialog
	pivotDialog = new PivotTableDialog(document.body, handlePivotDialogAction);

	// Initialize page setup dialog
	pageSetupDialog = new PageSetupDialog(document.body, handlePageSetupDialogAction);

	// Initialize CSV import dialog
	csvImportDialog = new CsvImportDialog(document.body, handleCsvImportDialogAction);

	// Register hyperlink detector for context menu
	contextMenu.setHyperlinkDetector((row, col) => {
		if (!renderer) return undefined;
		return renderer.getHyperlinkForCell(row, col);
	});

	// Register pivot table detector for context menu
	contextMenu.setPivotDetector((row, col) => {
		if (!renderer) return -1;
		return renderer.getPivotZoneAtCell(row, col);
	});

	contextMenu.setHiddenDetectors(
		(col) => renderer ? renderer.isColHidden(col) : false,
		(row) => renderer ? renderer.isRowHidden(row) : false,
		() => renderer ? renderer.getHiddenCols().size > 0 : false,
		() => renderer ? renderer.getHiddenRows().size > 0 : false,
	);

	// Wire Ctrl+Click callback for hyperlinks
	renderer.onHyperlinkClick = (url, isInternal) => {
		if (isInternal) {
			navigateToInternalLink(url);
		} else {
			vscode.postMessage({ type: 'openExternal', url });
		}
	};

	// Chart manager will be initialized in setupRendererCallbacks after renderer is ready

	// Initialize chart wizard dialog
	chartWizard = new ChartWizardDialog(document.body, handleChartWizardAction);

	// Setup Name Box and formula bar autocomplete
	setupFormulaBarInteractions();

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
		case 'fileContent':
			// Response from extension host for importFile request
			if (message.content && csvImportDialog) {
				csvImportDialog.previewFile(message.content, message.fileName || '');
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

		// Load defined names (named ranges) from the parsed model
		definedNames = (model.defined_names ?? []) as DefinedNameDef[];
		if (formulaEngine) {
			try {
				formulaEngine.set_named_ranges(JSON.stringify(definedNames));
			} catch (e) {
				console.warn('[XLSX Rust Viewer] Named ranges init failed:', e);
			}
		}

		// Load pivot table configs from the parsed model
		pivotTables = (model.pivot_tables ?? []) as PivotTableDef[];
		pivotOutputCache.clear();
		// Re-compute all pivot tables from stored configs on load
		if (pivotTables.length > 0) {
			for (let pi = 0; pi < pivotTables.length; pi++) {
				_computeAndWritePivot(pi, model);
			}
		}
		_syncPivotZones();

		// Sync page setup (page breaks etc.) to the renderer for visual indicators
		_syncPageSetups();

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
	if (!data?.sheets) return;
	const activeIdx = renderer.getActiveSheetIndex();
	const activeSheet = data.sheets[activeIdx];
	if (!activeSheet) return;

	try {
		// Build all-sheets cells map for cross-sheet formula support
		const allSheets: Record<string, unknown> = {};
		for (const sheet of data.sheets) {
			allSheets[sheet.name] = sheet.cells ?? {};
		}
		const resultJson = formulaEngine.evaluate_all(JSON.stringify(allSheets), activeSheet.name);
		const results = JSON.parse(resultJson);
		renderer.setFormulaResults(results);
		updateStatusBar();
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
			_syncPivotZones();
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
	// Position temporarily off-screen to measure height, then reposition above the tabs
	menu.style.cssText = 'position:fixed;left:-9999px;top:-9999px;z-index:10000;';

	const data = renderer?.getData();
	const sheetName = data?.sheets?.[sheetIdx]?.name ?? '';
	const isOnlySheet = (data?.sheets?.length ?? 1) <= 1;

	const items: Array<{ label: string; action: () => void; danger?: boolean; disabled?: boolean }> = [
		{ label: 'Rename Sheet', action: () => renameSheet(sheetIdx) },
		{ label: 'Duplicate Sheet', action: () => duplicateSheet(sheetIdx) },
		{ label: 'Add Sheet', action: () => addSheet() },
		{ label: 'Delete Sheet', action: () => deleteSheet(sheetIdx), danger: true, disabled: isOnlySheet },
	];

	for (const item of items) {
		if (item.disabled) {
			const el = document.createElement('div');
			el.className = 'ctx-item';
			el.style.cssText = 'opacity:0.4;cursor:default;pointer-events:none;';
			el.innerHTML = `<span class="ctx-label">${item.label}</span>`;
			menu.appendChild(el);
			continue;
		}
		const el = document.createElement('div');
		el.className = 'ctx-item';
		if (item.danger) {
			el.style.color = '#f48771';
		}
		el.innerHTML = `<span class="ctx-label">${item.label}</span>`;
		el.onclick = () => { menu.remove(); item.action(); };
		menu.appendChild(el);
	}

	document.body.appendChild(menu);

	// Measure and position above the tab bar (opens upward)
	const menuH = menu.offsetHeight;
	const menuW = menu.offsetWidth;
	const safeX = Math.min(x, window.innerWidth - menuW - 4);
	const safeY = y - menuH - 4; // open above the click point
	menu.style.left = `${safeX}px`;
	menu.style.top = `${Math.max(4, safeY)}px`;

	const close = (e: MouseEvent) => {
		if (!menu.contains(e.target as Node)) {
			menu.remove();
			document.removeEventListener('mousedown', close);
		}
	};
	// Suppress the unused variable warning
	void sheetName;
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

	const sheetName = data.sheets[idx].name;

	// Show confirmation
	const overlay = document.createElement('div');
	overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:20000;';
	const box = document.createElement('div');
	box.style.cssText = 'background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-focusBorder,#007acc);border-radius:6px;padding:20px 24px;min-width:300px;box-shadow:0 4px 16px rgba(0,0,0,0.4);';
	box.innerHTML = `
		<div style="color:var(--vscode-foreground,#ccc);font-size:13px;font-weight:600;margin-bottom:8px;">Delete Sheet</div>
		<div style="color:var(--vscode-descriptionForeground,#999);font-size:12px;margin-bottom:16px;">
			Delete "<strong style="color:var(--vscode-foreground,#ccc)">${sheetName}</strong>"? This cannot be undone.
		</div>
		<div style="display:flex;gap:8px;justify-content:flex-end;">
			<button id="del-cancel" style="padding:4px 12px;font-size:12px;background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid #555;border-radius:3px;cursor:pointer;">Cancel</button>
			<button id="del-confirm" style="padding:4px 12px;font-size:12px;background:#c0392b;color:#fff;border:none;border-radius:3px;cursor:pointer;">Delete</button>
		</div>`;
	overlay.appendChild(box);
	document.body.appendChild(overlay);

	const cancel = () => overlay.remove();
	const confirm = () => {
		overlay.remove();
		if (!renderer) return;
		const d = renderer.getData();
		if (!d?.sheets || d.sheets.length <= 1) return;

		d.sheets.splice(idx, 1);

		// Remove pivot table configs that reference this sheet (source or dest)
		const surviving = pivotTables.filter(pt => pt.source_sheet !== sheetName && pt.dest_sheet !== sheetName);
		const removedIndices: number[] = [];
		pivotTables.forEach((pt, i) => {
			if (pt.source_sheet === sheetName || pt.dest_sheet === sheetName) removedIndices.push(i);
		});
		pivotTables.length = 0;
		surviving.forEach(pt => pivotTables.push(pt));
		removedIndices.forEach(i => pivotOutputCache.delete(i));
		if (d.pivot_tables) d.pivot_tables = surviving;

		const newIdx = Math.min(idx, d.sheets.length - 1);
		renderer.setActiveSheetIndex(newIdx);
		renderer.updateModel(d);
		buildSheetTabs();
		_syncPivotZones();
		markDirty();
	};

	box.querySelector('#del-cancel')!.addEventListener('click', cancel);
	box.querySelector('#del-confirm')!.addEventListener('click', confirm);
	overlay.addEventListener('mousedown', e => { if (e.target === overlay) cancel(); });
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
		case 'pasteSpecial': handlePasteSpecial(); break;

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

		// Data Validation
		case 'dataValidation': showDataValidationDialog(); break;
		case 'circleInvalidData':
			if (renderer) {
				renderer.setShowInvalidCircles(!renderer.getShowInvalidCircles());
			}
			break;

		// Charts
		case 'insertChart': showChartWizard(); break;

		// Hyperlinks
		case 'insertHyperlink': showHyperlinkDialog(); break;

		// Named Ranges
		case 'nameManager': showNameManagerDialog(); break;
		case 'defineName': showDefineNameDialog(); break;

		// Page Layout
		case 'pageMargins': handlePageMarginsChange(event.value ?? 'Normal'); break;
		case 'pageOrientation': handlePageOrientationChange(event.value ?? 'Portrait'); break;
		case 'paperSize': handlePaperSizeChange(event.value ?? 'Letter'); break;
		case 'setPrintArea': handleSetPrintArea(); break;
		case 'clearPrintArea': handleClearPrintArea(); break;
		case 'insertPageBreak': handleInsertPageBreak(); break;
		case 'removePageBreak': handleRemovePageBreak(); break;
		case 'resetPageBreaks': handleResetPageBreaks(); break;
		case 'printTitles': pageSetupDialog?.show(getActiveSheetPageSetup()); break;
		case 'fitToWidth': handleFitToWidth(event.value ?? 'Automatic'); break;
		case 'fitToHeight': handleFitToHeight(event.value ?? 'Automatic'); break;
		case 'printScale': handlePrintScale(parseInt(event.value ?? '100')); break;
		case 'printGridlines': handlePageSetupToggle('print_gridlines', event.value === '1'); break;
		case 'printHeadings': break; // informational only
		case 'centerHorizontally': handlePageSetupToggle('center_horizontally', event.value === '1'); break;
		case 'centerVertically': handlePageSetupToggle('center_vertically', event.value === '1'); break;
		case 'pageSetupDialog': pageSetupDialog?.show(getActiveSheetPageSetup()); break;
		case 'printPreview': handlePrintPreview(); break;

		// View
		case 'gridlines': renderer.toggleGridlines(); break;
		case 'headers': renderer.toggleHeaders(); break;
		case 'freezePanes': renderer.freezePanes(); break;
		case 'pageBreakPreview': renderer.setPageBreakPreview(event.value === '1'); break;

		// Zoom
		case 'zoomIn':   renderer.zoomIn(); break;
		case 'zoomOut':  renderer.zoomOut(); break;
		case 'zoomReset': renderer.setZoom(1); break;
		case 'zoomToFit': renderer.zoomToFit(); break;
		case 'zoom50':   renderer.setZoom(0.5); break;
		case 'zoom75':   renderer.setZoom(0.75); break;
		case 'zoom100':  renderer.setZoom(1); break;
		case 'zoom125':  renderer.setZoom(1.25); break;
		case 'zoom150':  renderer.setZoom(1.5); break;
		case 'zoom200':  renderer.setZoom(2); break;

		// Data
		case 'sortAZ': renderer.sortColumn(true); markDirty(); break;
		case 'sortZA': renderer.sortColumn(false); markDirty(); break;
		case 'clear': renderer.clearSelectedCells(); markDirty(); break;

		// Outline (Group / Ungroup) from ribbon — operates on current row/col selection
		case 'groupRows': {
			const selRG = renderer.getSelectedRange();
			if (selRG) {
				const gsr = Math.min(selRG.startRow, selRG.endRow);
				const ger = Math.max(selRG.startRow, selRG.endRow);
				renderer.addRowOutlineGroup(gsr, ger);
				markDirty();
			}
			break;
		}
		case 'ungroupRows': {
			const selURG = renderer.getSelectedRange();
			if (selURG) {
				const ugsr = Math.min(selURG.startRow, selURG.endRow);
				const uger = Math.max(selURG.startRow, selURG.endRow);
				renderer.removeRowOutlineGroup(ugsr, uger);
				markDirty();
			}
			break;
		}
		case 'groupCols': {
			const selCG = renderer.getSelectedRange();
			if (selCG) {
				const gsc = Math.min(selCG.startCol, selCG.endCol);
				const gec = Math.max(selCG.startCol, selCG.endCol);
				renderer.addColOutlineGroup(gsc, gec);
				markDirty();
			}
			break;
		}
		case 'ungroupCols': {
			const selUCG = renderer.getSelectedRange();
			if (selUCG) {
				const ugsc = Math.min(selUCG.startCol, selUCG.endCol);
				const ugec = Math.max(selUCG.startCol, selUCG.endCol);
				renderer.removeColOutlineGroup(ugsc, ugec);
				markDirty();
			}
			break;
		}

		// Fill
		case 'fillDown': renderer.fillDown(); markDirty(); evaluateFormulas(); break;
		case 'fillRight': renderer.fillRight(); markDirty(); evaluateFormulas(); break;
		case 'flashFill': {
			const filledCount = renderer.flashFill();
			if (filledCount > 0) { markDirty(); evaluateFormulas(); }
			break;
		}

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
		case 'exportPDF':
			handleExportPDF();
			break;
		case 'exportPNG': {
			// Capture canvas and save as PNG
			const exportCanvas = document.querySelector('canvas');
			if (exportCanvas) {
				const dataUrl = exportCanvas.toDataURL('image/png');
				vscode.postMessage({ type: 'exportImage', imageData: dataUrl });
			}
			break;
		}
		case 'exportCSV':
			handleExportCSV();
			break;
		case 'exportHTML':
			handleExportHTML();
			break;
		case 'importCSV':
			handleImportCSV();
			break;

		// Pivot table operations
		case 'insertPivotTable': showPivotTableDialog(); break;
		case 'refreshAllPivots': refreshAllPivotTables(); break;

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

function showDataValidationDialog() {
	if (!renderer || !vdDialog) return;
	const data = renderer.getData();
	const sheet = data?.sheets?.[renderer.getActiveSheetIndex?.() ?? 0];
	const existingRules = sheet?.data_validations ?? [];

	const sel = renderer.getSelectedCell();
	const selRange = renderer.getSelectedRange?.();
	let sqref = 'A1';
	if (selRange) {
		const c1 = getColName(selRange.startCol) + (selRange.startRow + 1);
		const c2 = getColName(selRange.endCol) + (selRange.endRow + 1);
		sqref = c1 === c2 ? c1 : `${c1}:${c2}`;
	} else if (sel) {
		sqref = getColName(sel.col) + (sel.row + 1);
	}

	vdDialog.show(sqref, existingRules);
}

function handleVdDialogAction(event: VDDialogEvent) {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets) return;
	const sheetIdx = renderer.getActiveSheetIndex?.() ?? 0;
	const sheet = data.sheets[sheetIdx];
	if (!sheet) return;
	if (!sheet.data_validations) sheet.data_validations = [];

	switch (event.action) {
		case 'add':
			if (event.rule) {
				sheet.data_validations.push(event.rule);
				renderer.setValidations(sheet.data_validations);
				if (vdDialog) vdDialog.refreshRules(sheet.data_validations);
				markDirty();
			}
			break;
		case 'edit':
			if (event.rule && event.ruleIndex !== undefined && event.ruleIndex < sheet.data_validations.length) {
				sheet.data_validations[event.ruleIndex] = event.rule;
				renderer.setValidations(sheet.data_validations);
				if (vdDialog) vdDialog.refreshRules(sheet.data_validations);
				markDirty();
			}
			break;
		case 'delete':
			if (event.ruleIndex !== undefined && event.ruleIndex < sheet.data_validations.length) {
				sheet.data_validations.splice(event.ruleIndex, 1);
				renderer.setValidations(sheet.data_validations);
				if (vdDialog) vdDialog.refreshRules(sheet.data_validations);
				markDirty();
			}
			break;
		case 'close':
			break;
	}
}

function showFormatCellsDialog(row: number, col: number): void {
	if (!renderer || !fcDialog) return;
	const currentStyle = renderer.getStyleAt(row, col);
	fcDialog.show(currentStyle);
}

function handleFcDialogAction(event: FCDialogEvent): void {
	if (!renderer || !event.style) return;
	if (event.action === 'apply') {
		renderer.applyStyle(event.style);
		markDirty();
	}
}

function showHyperlinkDialog(row?: number, col?: number): void {
	if (!renderer || !hlDialog) return;
	const data = renderer.getData();
	const sheetNames: string[] = (data?.sheets ?? []).map((s: any) => s.name as string);
	// Determine cell ref string
	let cellRef = 'A1';
	if (row !== undefined && col !== undefined) {
		cellRef = colToLetter(col) + (row + 1);
	} else {
		const sel = renderer.getSelectedCell();
		if (sel) cellRef = colToLetter(sel.col) + (sel.row + 1);
	}
	const existing = (row !== undefined && col !== undefined)
		? renderer.getHyperlinkForCell(row, col)
		: undefined;
	hlDialog.show(cellRef, sheetNames, existing);
}

function colToLetter(col: number): string {
	let s = '';
	let n = col;
	while (n >= 0) {
		s = String.fromCharCode((n % 26) + 65) + s;
		n = Math.floor(n / 26) - 1;
	}
	return s;
}

function handleHlDialogAction(event: HLDialogEvent): void {
	if (!renderer) return;
	if ((event.action === 'insert' || event.action === 'edit') && event.link) {
		renderer.addHyperlink(event.link);
		markDirty();
	} else if (event.action === 'remove' && event.link) {
		// Remove by cell_ref — find row/col from the link's cell_ref
		const cellRef = event.link.cell_ref;
		const m = cellRef.toUpperCase().match(/^([A-Z]+)(\d+)$/);
		if (m) {
			let col = 0;
			for (const ch of m[1]) { col = col * 26 + ch.charCodeAt(0) - 64; }
			const row = parseInt(m[2], 10) - 1;
			renderer.removeHyperlinkAt(row, col - 1);
			markDirty();
		}
	}
}

// --- Named Ranges (Name Manager) ---

function showNameManagerDialog(): void {
	if (!nmDialog || !renderer) return;
	const data = renderer.getData();
	const sheetNames: string[] = (data?.sheets ?? []).map((s: any) => s.name as string);
	nmDialog.show(definedNames, sheetNames);
}

function showDefineNameDialog(row?: number, col?: number): void {
	if (!nmDialog || !renderer) return;
	const data = renderer.getData();
	const sheetNames: string[] = (data?.sheets ?? []).map((s: any) => s.name as string);
	const activeSheetName = data?.sheets?.[renderer.getActiveSheetIndex()]?.name ?? '';

	// Build a default "Refers to" value from the current selection
	let defaultFormula = '';
	if (row !== undefined && col !== undefined) {
		defaultFormula = `${activeSheetName}!$${colToLetter(col)}$${row + 1}`;
	} else {
		const sel = renderer.getSelectedRange();
		if (sel) {
			const c1 = colToLetter(sel.startCol);
			const c2 = colToLetter(sel.endCol);
			if (sel.startRow === sel.endRow && sel.startCol === sel.endCol) {
				defaultFormula = `${activeSheetName}!$${c1}$${sel.startRow + 1}`;
			} else {
				defaultFormula = `${activeSheetName}!$${c1}$${sel.startRow + 1}:$${c2}$${sel.endRow + 1}`;
			}
		} else {
			const cell = renderer.getSelectedCell();
			if (cell) {
				defaultFormula = `${activeSheetName}!$${colToLetter(cell.col)}$${cell.row + 1}`;
			}
		}
	}

	// Open the Name Manager showing a pre-filled sub-dialog for a new entry
	nmDialog.show(definedNames, sheetNames);
	// Trigger "New..." with the pre-filled formula (internal helper exposed via method)
	(nmDialog as any)._openSubDialog(-1);
	if (defaultFormula) {
		(nmDialog as any).subFormulaInput.value = defaultFormula;
	}
}

function handleNmDialogAction(event: NMDialogEvent): void {
	if (!renderer) return;

	if (event.action === 'create' && event.name) {
		definedNames = [...definedNames, event.name];
	} else if (event.action === 'edit' && event.name && event.index !== undefined) {
		definedNames = definedNames.map((n, i) => i === event.index ? event.name! : n);
	} else if (event.action === 'delete' && event.index !== undefined) {
		definedNames = definedNames.filter((_, i) => i !== event.index);
	} else if (event.action === 'close') {
		return;
	}

	// Sync into the workbook model so saves include the changes
	const data = renderer.getData();
	if (data) {
		data.defined_names = definedNames;
	}

	// Re-register named ranges with the formula engine
	if (formulaEngine) {
		try {
			formulaEngine.set_named_ranges(JSON.stringify(definedNames));
		} catch (e) {
			console.warn('[XLSX Rust Viewer] Named ranges update failed:', e);
		}
	}

	evaluateFormulas();
	markDirty();

	// Refresh Name Box dropdown
	refreshNameBoxDropdown();
}

/** Navigate to a named range by resolving its formula */
function navigateToNamedRange(name: string): void {
	if (!renderer) return;
	const entry = definedNames.find(n => n.name.toUpperCase() === name.toUpperCase());
	if (!entry) return;

	// Parse formula: e.g. "Sheet1!$A$1:$C$10" or "'My Sheet'!$A$1"
	let formula = entry.formula.replace(/^=/, '');
	// Strip outer quotes from sheet name
	const bangIdx = formula.indexOf('!');
	if (bangIdx === -1) return;

	const sheetPart = formula.slice(0, bangIdx).replace(/^'|'$/g, '');
	const refPart = formula.slice(bangIdx + 1);

	const data = renderer.getData();
	const sheets: any[] = data?.sheets ?? [];
	const sheetIdx = sheets.findIndex((s: any) => s.name === sheetPart);
	if (sheetIdx !== -1) {
		renderer.setActiveSheetIndex(sheetIdx);
		buildSheetTabs();
		evaluateFormulas();
	}

	// Parse cell or range ref
	const rangeMatch = refPart.replace(/\$/g, '').toUpperCase().match(/^([A-Z]+)(\d+)(?::([A-Z]+)(\d+))?$/);
	if (rangeMatch) {
		const parseCol = (s: string) => { let c = 0; for (const ch of s) c = c * 26 + ch.charCodeAt(0) - 64; return c - 1; };
		const r1 = parseInt(rangeMatch[2], 10) - 1;
		const c1 = parseCol(rangeMatch[1]);
		const r2 = rangeMatch[4] ? parseInt(rangeMatch[4], 10) - 1 : r1;
		const c2 = rangeMatch[3] ? parseCol(rangeMatch[3]) : c1;
		renderer.setSelection(r1, c1, r2, c2);
	}
}

/** Navigate to an internal hyperlink (#SheetName!CellRef or #NamedRange). */
function navigateToInternalLink(url: string): void {
	if (!renderer) return;
	// Strip leading #
	const target = url.startsWith('#') ? url.slice(1) : url;

	// Check if it's a named range (no '!')
	const bangIdx = target.indexOf('!');
	if (bangIdx === -1) {
		// Could be a named range
		navigateToNamedRange(target);
		return;
	}

	const sheetName = target.slice(0, bangIdx).replace(/^'|'$/g, '');
	const cellRef = target.slice(bangIdx + 1);

	const data = renderer.getData();
	const sheets: any[] = data?.sheets ?? [];
	const sheetIdx = sheets.findIndex((s: any) => s.name === sheetName);
	if (sheetIdx === -1) return;

	renderer.setActiveSheetIndex(sheetIdx);
	buildSheetTabs();

	// Parse cell ref and select it
	const m = cellRef.replace(/\$/g, '').toUpperCase().match(/^([A-Z]+)(\d+)$/);
	if (m) {
		let col = 0;
		for (const ch of m[1]) { col = col * 26 + ch.charCodeAt(0) - 64; }
		const row = parseInt(m[2], 10) - 1;
		renderer.setSelection(row, col - 1, row, col - 1);
	}
}

// --- Name Box and Formula Autocomplete ---

/** Set up the Name Box input (cell-ref) and the formula bar autocomplete overlay. */
function setupFormulaBarInteractions(): void {
	const nameBoxEl = document.getElementById('cell-ref') as HTMLInputElement | null;
	const dropdownEl = document.getElementById('name-box-dropdown') as HTMLDivElement | null;
	const formulaInputEl = document.getElementById('formula-input') as HTMLInputElement | null;

	if (nameBoxEl && dropdownEl) {
		nameBoxEl.addEventListener('focus', () => {
			nameBoxEl.select();
			refreshNameBoxDropdown();
			dropdownEl.style.display = definedNames.length > 0 ? 'block' : 'none';
		});

		nameBoxEl.addEventListener('blur', () => {
			// Delay so click on dropdown item fires first
			setTimeout(() => {
				dropdownEl.style.display = 'none';
				// Restore to current cell address if not a valid named range
				if (renderer) {
					const sel = renderer.getSelectedCell();
					if (sel) updateFormulaBar(sel.row, sel.col);
				}
			}, 150);
		});

		nameBoxEl.addEventListener('keydown', (e) => {
			if (e.key === 'Enter') {
				e.preventDefault();
				const val = nameBoxEl.value.trim();
				dropdownEl.style.display = 'none';

				// Check if it matches a named range
				const matchedName = definedNames.find(n => n.name.toUpperCase() === val.toUpperCase());
				if (matchedName) {
					navigateToNamedRange(matchedName.name);
					return;
				}

				// Otherwise try to parse as a cell ref (e.g. "B5" or "Sheet1!B5")
				if (!renderer) return;
				const bangIdx = val.indexOf('!');
				let cellPart = val;
				if (bangIdx !== -1) {
					const sheetPart = val.slice(0, bangIdx).replace(/^'|'$/g, '');
					cellPart = val.slice(bangIdx + 1);
					const data = renderer.getData();
					const sheetIdx = (data?.sheets ?? []).findIndex((s: any) => s.name === sheetPart);
					if (sheetIdx !== -1) {
						renderer.setActiveSheetIndex(sheetIdx);
						buildSheetTabs();
						evaluateFormulas();
					}
				}
				const m = cellPart.replace(/\$/g, '').toUpperCase().match(/^([A-Z]+)(\d+)$/);
				if (m) {
					let col = 0;
					for (const ch of m[1]) { col = col * 26 + ch.charCodeAt(0) - 64; }
					const row = parseInt(m[2], 10) - 1;
					renderer.setSelection(row, col - 1, row, col - 1);
				}
				nameBoxEl.blur();
			} else if (e.key === 'Escape') {
				dropdownEl.style.display = 'none';
				nameBoxEl.blur();
			}
		});

		nameBoxEl.addEventListener('input', () => {
			const val = nameBoxEl.value.toLowerCase();
			refreshNameBoxDropdown(val);
			dropdownEl.style.display = 'block';
		});
	}

	// --- Formula bar autocomplete ---
	if (formulaInputEl) {
		const autoEl = createFormulaAutocomplete();
		formulaInputEl.addEventListener('input', () => {
			updateFormulaAutocomplete(formulaInputEl, autoEl);
		});
		formulaInputEl.addEventListener('keydown', (e) => {
			if (autoEl.style.display !== 'none') {
				if (e.key === 'ArrowDown') {
					e.preventDefault();
					moveAutocompleteSelection(autoEl, 1);
				} else if (e.key === 'ArrowUp') {
					e.preventDefault();
					moveAutocompleteSelection(autoEl, -1);
				} else if (e.key === 'Enter' || e.key === 'Tab') {
					const sel = autoEl.querySelector('.ac-item.selected') as HTMLElement | null;
					if (sel && autoEl.style.display !== 'none') {
						e.preventDefault();
						applyAutocomplete(formulaInputEl, sel.dataset['value'] ?? '', autoEl);
					}
				} else if (e.key === 'Escape') {
					autoEl.style.display = 'none';
				}
			}
		});
		formulaInputEl.addEventListener('blur', () => {
			setTimeout(() => { autoEl.style.display = 'none'; }, 150);
		});
	}
}

/** Refresh the Name Box dropdown list, optionally filtered by a prefix. */
function refreshNameBoxDropdown(filter?: string): void {
	const dropdownEl = document.getElementById('name-box-dropdown') as HTMLDivElement | null;
	if (!dropdownEl) return;
	dropdownEl.innerHTML = '';

	const data = renderer?.getData();
	const sheetNames: string[] = (data?.sheets ?? []).map((s: any) => s.name as string);

	const names = filter
		? definedNames.filter(n => !n.hidden && n.name.toLowerCase().includes(filter))
		: definedNames.filter(n => !n.hidden);

	if (names.length === 0) {
		dropdownEl.style.display = 'none';
		return;
	}

	for (const n of names) {
		const item = document.createElement('div');
		item.className = 'nb-item';
		const scopeLabel = n.local_sheet_id !== undefined
			? sheetNames[n.local_sheet_id] ?? 'Sheet'
			: 'Workbook';
		item.innerHTML = `${n.name}<span class="nb-scope">${scopeLabel}</span>`;
		item.addEventListener('mousedown', (e) => {
			e.preventDefault();
			navigateToNamedRange(n.name);
			dropdownEl.style.display = 'none';
		});
		dropdownEl.appendChild(item);
	}
}

/** Create the formula bar autocomplete overlay element */
function createFormulaAutocomplete(): HTMLDivElement {
	const existing = document.getElementById('formula-autocomplete');
	if (existing) return existing as HTMLDivElement;

	const el = document.createElement('div');
	el.id = 'formula-autocomplete';
	Object.assign(el.style, {
		display: 'none', position: 'fixed', zIndex: '300',
		background: '#1e1e1e', border: '1px solid #555', borderRadius: '2px',
		maxHeight: '200px', overflowY: 'auto', minWidth: '160px',
		boxShadow: '0 4px 12px rgba(0,0,0,0.6)', fontSize: '12px', color: '#ccc',
	});
	document.body.appendChild(el);
	return el;
}

const BUILTIN_FUNCTIONS = [
	'ABS','AND','AVERAGE','AVG','AVERAGEIF','AVERAGEIFS',
	'CELL','CEILING','CHAR','CHOOSE','CLEAN','CODE','COLUMN','COLUMNS','CONCAT','CONCATENATE','COUNT','COUNTA','COUNTIF','COUNTIFS',
	'DATE','DATEVALUE','DAY','DATEDIF','DB',
	'EDATE','EOMONTH','EXP','EXACT',
	'FALSE','FIND','FLOOR','FV',
	'HLOOKUP','HOUR',
	'IF','IFERROR','IFNA','IFS','INDEX','INDIRECT','INFO','INT','IRR','ISERR','ISERROR','ISBLANK','ISLOGICAL','ISNONTEXT','ISNUMBER','ISTEXT',
	'LARGE','LEFT','LEN','LN','LOG','LOG10','LOWER',
	'MATCH','MAX','MEDIAN','MID','MIN','MINUTE','MOD','MODE',
	'NA','NETWORKDAYS','NOT','NOW','NPER','NPV',
	'OFFSET','OR',
	'PERCENTILE','PERCENTILE.INC','PI','PMT','POWER','PRODUCT','PROPER','PV',
	'QUARTILE','QUARTILE.INC',
	'RAND','RANDBETWEEN','RANK','RANK.EQ','RATE','REPLACE','REPT','RIGHT','ROW','ROWS',
	'SEARCH','SECOND','SIGN','SLN','SMALL','SQRT','STDEV','STDEV.S','STDEVP','STDEV.P','SUBSTITUTE','SUM','SUMIF','SUMIFS','SUMPRODUCT','SWITCH',
	'TEXT','TEXTAFTER','TEXTBEFORE','TEXTJOIN','TIME','TIMEVALUE','TODAY','TRIM','TRUNC','TRUE','TYPE',
	'UPPER',
	'VALUE','VAR','VAR.S','VARP','VAR.P','VLOOKUP',
	'WEEKDAY','WEEKNUM','WORKDAY',
	'XLOOKUP','XOR',
	'YEAR',
];

/** Update the formula autocomplete list based on current input. */
function updateFormulaAutocomplete(input: HTMLInputElement, overlay: HTMLDivElement): void {
	const val = input.value;
	if (!val.startsWith('=')) { overlay.style.display = 'none'; return; }

	// Extract the current "word" being typed
	const cursor = input.selectionStart ?? val.length;
	let wordStart = cursor - 1;
	while (wordStart > 0 && /[\w$.]/.test(val[wordStart - 1])) wordStart--;
	const word = val.slice(wordStart, cursor).toUpperCase();

	if (word.length < 1) { overlay.style.display = 'none'; return; }

	const namedMatches = definedNames.filter(n => !n.hidden && n.name.toUpperCase().startsWith(word)).map(n => ({ label: n.name, isFunction: false }));
	const funcMatches = BUILTIN_FUNCTIONS.filter(f => f.startsWith(word)).map(f => ({ label: f, isFunction: true }));
	const allMatches = [...namedMatches, ...funcMatches].slice(0, 30);
	const matches = allMatches;
	if (matches.length === 0) { overlay.style.display = 'none'; return; }

	overlay.innerHTML = '';
	for (const m of matches) {
		const insertText = m.isFunction ? m.label + '(' : m.label;
		const item = document.createElement('div');
		item.className = 'ac-item';
		item.textContent = m.label + (m.isFunction ? '()' : '');
		item.dataset['value'] = insertText;
		item.dataset['wordStart'] = String(wordStart);
		item.dataset['wordEnd'] = String(cursor);
		Object.assign(item.style, { padding: '4px 10px', cursor: 'pointer' });
		item.addEventListener('mouseover', () => {
			overlay.querySelectorAll('.ac-item').forEach(i => i.classList.remove('selected'));
			item.classList.add('selected');
		});
		item.addEventListener('mousedown', (e) => {
			e.preventDefault();
			applyAutocomplete(input, insertText, overlay);
		});
		overlay.appendChild(item);
	}

	// Position overlay below the formula input
	const rect = input.getBoundingClientRect();
	overlay.style.left = rect.left + 'px';
	overlay.style.top = (rect.bottom + 2) + 'px';
	overlay.style.display = 'block';
}

function moveAutocompleteSelection(overlay: HTMLDivElement, dir: number): void {
	const items = Array.from(overlay.querySelectorAll('.ac-item'));
	const idx = items.findIndex(i => i.classList.contains('selected'));
	items.forEach(i => i.classList.remove('selected'));
	const next = Math.max(0, Math.min(items.length - 1, idx + dir));
	items[next]?.classList.add('selected');
	(items[next] as HTMLElement)?.scrollIntoView({ block: 'nearest' });
}

function applyAutocomplete(input: HTMLInputElement, name: string, overlay: HTMLDivElement): void {
	const items = overlay.querySelectorAll('.ac-item');
	const item = Array.from(items).find(i => (i as HTMLElement).dataset['value'] === name) as HTMLElement | null;
	if (!item) return;
	const wordStart = parseInt(item.dataset['wordStart'] ?? '0', 10);
	const wordEnd = parseInt(item.dataset['wordEnd'] ?? '0', 10);
	const before = input.value.slice(0, wordStart);
	const after = input.value.slice(wordEnd);
	input.value = before + name + after;
	input.setSelectionRange(wordStart + name.length, wordStart + name.length);
	overlay.style.display = 'none';
}

function handleContextMenuAction(event: ContextMenuEvent) {
	if (!renderer) return;

	switch (event.action) {
		case 'cut': handleCut(); break;
		case 'copy': handleCopy(); break;
		case 'paste': handlePaste(); break;
		case 'pasteSpecial': handlePasteSpecial(); break;
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
		showFormatCellsDialog(event.row, event.col);
		break;
	case 'insertHyperlink':
	case 'editHyperlink':
		showHyperlinkDialog(event.row, event.col);
		break;
	case 'removeHyperlink':
		renderer.removeHyperlinkAt(event.row, event.col);
		markDirty();
		break;
	case 'defineName':
		showDefineNameDialog(event.row, event.col);
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
			renderer.hideColumn(event.col);
			markDirty();
		}
		break;
	case 'unhideCol':
		if (renderer) {
			renderer.unhideColumn(event.col);
			markDirty();
		}
		break;
	case 'unhideAllCols':
		if (renderer) {
			renderer.unhideAllCols();
			markDirty();
		}
		break;
	case 'hideRow':
		if (renderer) {
			renderer.hideRow(event.row);
			markDirty();
		}
		break;
	case 'unhideRow':
		if (renderer) {
			renderer.unhideRow(event.row);
			markDirty();
		}
		break;
	case 'unhideAllRows':
		if (renderer) {
			renderer.unhideAllRows();
			markDirty();
		}
		break;
	case 'groupCols': {
		if (renderer) {
			const selForGroup = renderer.getSelectedRange();
			if (selForGroup) {
				const gsc = Math.min(selForGroup.startCol, selForGroup.endCol);
				const gec = Math.max(selForGroup.startCol, selForGroup.endCol);
				renderer.addColOutlineGroup(gsc, gec);
				markDirty();
			}
		}
		break;
	}
	case 'ungroupCols': {
		if (renderer) {
			const selForUngroup = renderer.getSelectedRange();
			if (selForUngroup) {
				const ugsc = Math.min(selForUngroup.startCol, selForUngroup.endCol);
				const ugec = Math.max(selForUngroup.startCol, selForUngroup.endCol);
				renderer.removeColOutlineGroup(ugsc, ugec);
				markDirty();
			}
		}
		break;
	}
	case 'groupRows': {
		if (renderer) {
			const selForGRow = renderer.getSelectedRange();
			if (selForGRow) {
				const gsr = Math.min(selForGRow.startRow, selForGRow.endRow);
				const ger = Math.max(selForGRow.startRow, selForGRow.endRow);
				renderer.addRowOutlineGroup(gsr, ger);
				markDirty();
			}
		}
		break;
	}
	case 'ungroupRows': {
		if (renderer) {
			const selForUGRow = renderer.getSelectedRange();
			if (selForUGRow) {
				const ugsr = Math.min(selForUGRow.startRow, selForUGRow.endRow);
				const uger = Math.max(selForUGRow.startRow, selForUGRow.endRow);
				renderer.removeRowOutlineGroup(ugsr, uger);
				markDirty();
			}
		}
		break;
	}
	case 'colWidthAuto':
		if (renderer) {
			renderer.autoFitColumn(event.col);
			markDirty();
		}
		break;
	case 'rowHeightAuto':
		if (renderer) {
			renderer.autoFitRow(event.row);
			markDirty();
		}
		break;
	case 'autoFitSelectedCols':
		if (renderer) {
			const selForCols = renderer.getSelectedRange();
			if (selForCols) {
				const sc = Math.min(selForCols.startCol, selForCols.endCol);
				const ec = Math.max(selForCols.startCol, selForCols.endCol);
				renderer.autoFitColumns(sc, ec);
				markDirty();
			}
		}
		break;
	case 'autoFitSelectedRows':
		if (renderer) {
			const selForRows = renderer.getSelectedRange();
			if (selForRows) {
				const sr = Math.min(selForRows.startRow, selForRows.endRow);
				const er = Math.max(selForRows.startRow, selForRows.endRow);
				renderer.autoFitRows(sr, er);
				markDirty();
			}
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

	// Pivot table context menu actions
	case 'insertPivotTable':
		showPivotTableDialog();
		break;
	case 'refreshPivot': {
		const pIdx = renderer ? renderer.getPivotZoneAtCell(event.row, event.col) : -1;
		if (pIdx >= 0) refreshPivotTable(pIdx);
		break;
	}
	case 'editPivot': {
		const epIdx = renderer ? renderer.getPivotZoneAtCell(event.row, event.col) : -1;
		if (epIdx >= 0) showPivotTableDialog(epIdx);
		break;
	}
	case 'deletePivot': {
		const dpIdx = renderer ? renderer.getPivotZoneAtCell(event.row, event.col) : -1;
		if (dpIdx >= 0) deletePivotTable(dpIdx);
		break;
	}
	case 'drillDown':
		drillDownPivot(event.row, event.col);
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
	const data = renderer.copySelectionToClipboard(true);
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
	const data = renderer.copySelectionToClipboard(false);
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
	const clip = renderer.getInternalClipboard();
	if (clip) {
		// Use internal clipboard for full fidelity paste (all + no op + no transpose)
		renderer.pasteSpecial({ what: 'all', operation: 'none', skipBlanks: false, transpose: false });
		markDirty();
		return;
	}
	try {
		// Try reading rich clipboard (HTML table detection)
		if (typeof navigator.clipboard.read === 'function') {
			try {
				const items = await navigator.clipboard.read();
				for (const item of items) {
					if (item.types.includes('text/html')) {
						const blob = await item.getType('text/html');
						const html = await blob.text();
						const parsed = parseHtmlTable(html);
						if (parsed) {
							renderer.pasteData(parsed);
							markDirty();
							return;
						}
					}
				}
			} catch {
				// Clipboard.read() not available or denied – fall through to readText
			}
		}
		const text = await navigator.clipboard.readText();
		renderer.pasteData(text);
		markDirty();
	} catch {
		console.warn('[XLSX Rust Viewer] Clipboard read not available');
	}
}

/** Parse an HTML string looking for a <table> and convert it to TSV for pasteData(). */
function parseHtmlTable(html: string): string | null {
	try {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		const table = doc.querySelector('table');
		if (!table) return null;
		const rows: string[] = [];
		for (const tr of Array.from(table.querySelectorAll('tr'))) {
			const cells: string[] = [];
			for (const cell of Array.from(tr.querySelectorAll('td,th'))) {
				const colspan = parseInt((cell as HTMLElement).getAttribute('colspan') || '1', 10);
				const text = (cell as HTMLElement).innerText ?? (cell as HTMLElement).textContent ?? '';
				cells.push(text.trim());
				// Pad merged columns with empty cells
				for (let c = 1; c < colspan; c++) cells.push('');
			}
			rows.push(cells.join('\t'));
		}
		return rows.join('\n');
	} catch {
		return null;
	}
}

function handlePasteSpecial() {
	if (!renderer || !psDialog) return;
	const clip = renderer.getInternalClipboard();
	if (!clip) {
		console.warn('[XLSX Rust Viewer] No internal clipboard – copy something first');
		return;
	}
	psDialog.show();
}

function handlePsDialogAction(event: PSDialogEvent) {
	if (event.action === 'paste' && event.options && renderer) {
		renderer.pasteSpecial(event.options);
		markDirty();
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
				if (e.shiftKey) {
					handlePasteSpecial();
				} else {
					handlePaste();
				}
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
			case 'd':
				e.preventDefault();
				renderer.fillDown();
				markDirty();
				evaluateFormulas();
				return;
			case 'r':
				e.preventDefault();
				renderer.fillRight();
				markDirty();
				evaluateFormulas();
				return;
			case 'e':
				e.preventDefault();
				{
					const filled = renderer.flashFill();
					if (filled > 0) {
						markDirty();
						evaluateFormulas();
					}
				}
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

// ============================================================================
// Pivot Table Wiring
// ============================================================================

/**
 * Extract column header strings from row 0 of the source range on a sheet.
 */
function _getPivotSourceHeaders(sheetIndex: number, rangeStr: string): string[] {
	if (!renderer) return [];
	const data = renderer.getData();
	const sheet = data?.sheets?.[sheetIndex];
	if (!sheet) return [];
	const parsed = parseCellRange(rangeStr);
	if (!parsed) return [];
	const { startRow, startCol, endCol } = parsed;
	const headers: string[] = [];
	for (let c = startCol; c <= endCol; c++) {
		const cell = sheet.cells?.[startRow]?.[c];
		headers.push(cell?.value || `Column${c - startCol + 1}`);
	}
	return headers;
}

/** Returns which headers appear to be numeric by sampling up to 5 data rows. */
function _getPivotNumericHeaders(sheetIndex: number, rangeStr: string): string[] {
	if (!renderer) return [];
	const data = renderer.getData();
	const sheet = data?.sheets?.[sheetIndex];
	if (!sheet) return [];
	const parsed = parseCellRange(rangeStr);
	if (!parsed) return [];
	const { startRow, startCol, endCol, endRow } = parsed;
	const numericHeaders: string[] = [];
	const sampleEnd = Math.min(startRow + 5, endRow);
	for (let c = startCol; c <= endCol; c++) {
		let numericCount = 0;
		let totalCount = 0;
		for (let r = startRow + 1; r <= sampleEnd; r++) {
			const cell = sheet.cells?.[r]?.[c];
			if (cell && cell.value !== '' && cell.value !== undefined) {
				totalCount++;
				if (cell.data_type === 'n' || (!isNaN(Number(cell.value)) && String(cell.value).trim() !== '')) {
					numericCount++;
				}
			}
		}
		const headerCell = sheet.cells?.[startRow]?.[c];
		const headerName = headerCell?.value || `Column${c - startCol + 1}`;
		if (totalCount > 0 && numericCount / totalCount >= 0.7) {
			numericHeaders.push(headerName);
		}
	}
	return numericHeaders;
}

/** Try to find the contiguous data range containing the given cell. */
function _autoDetectPivotRange(sheetIndex: number, row: number, col: number): string {
	if (!renderer) return 'A1:D10';
	const data = renderer.getData();
	const sheet = data?.sheets?.[sheetIndex];
	if (!sheet) return 'A1:D10';

	// Check if this cell is inside a defined Table
	for (const t of (sheet.tables ?? [])) {
		const tr = parseCellRange(t.range);
		if (tr && row >= tr.startRow && row <= tr.endRow && col >= tr.startCol && col <= tr.endCol) {
			return t.range;
		}
	}

	// Walk left/up to find the start of a contiguous data block
	let r0 = row;
	let c0 = col;
	while (r0 > 0 && sheet.cells?.[r0 - 1]?.[col]?.value) r0--;
	while (c0 > 0 && sheet.cells?.[row]?.[c0 - 1]?.value) c0--;

	// Walk right/down to find the end
	let r1 = row;
	let c1 = col;
	while (sheet.cells?.[r1 + 1]?.[c0]?.value) r1++;
	while (sheet.cells?.[r0]?.[c1 + 1]?.value) c1++;

	// Expand columns to the furthest non-empty header
	for (let c = c0; c <= c1 + 10; c++) {
		if (sheet.cells?.[r0]?.[c]?.value) c1 = c;
		else break;
	}
	// Expand rows to the furthest non-empty row
	for (let r = r0; r <= r1 + 100; r++) {
		let hasData = false;
		for (let c = c0; c <= c1; c++) {
			if (sheet.cells?.[r]?.[c]?.value) { hasData = true; break; }
		}
		if (hasData) r1 = r; else break;
	}

	return `${getColName(c0)}${r0 + 1}:${getColName(c1)}${r1 + 1}`;
}

/**
 * Compute pivot output for the config at pivotIndex and write cells to the dest sheet.
 * Operates directly on the provided model object (or renderer.getData() if omitted).
 */
function _computeAndWritePivot(pivotIndex: number, model?: any) {
	if (!renderer) return;
	const data = model ?? renderer.getData();
	if (!data?.sheets) return;
	const config = pivotTables[pivotIndex];
	if (!config) return;

	// Find source sheet
	const srcSheetIdx = data.sheets.findIndex((s: any) => s.name === config.source_sheet);
	if (srcSheetIdx < 0) { console.warn('[Pivot] Source sheet not found:', config.source_sheet); return; }
	const srcSheet = data.sheets[srcSheetIdx];

	// Build source data map
	const sourceData: Record<number, Record<number, { value: string; data_type: string }>> = {};
	const srcRange = parseCellRange(config.source_range);
	if (!srcRange) return;
	for (let r = srcRange.startRow; r <= srcRange.endRow; r++) {
		if (!srcSheet.cells?.[r]) continue;
		sourceData[r] = {};
		for (let c = srcRange.startCol; c <= srcRange.endCol; c++) {
			const cell = srcSheet.cells[r]?.[c];
			if (cell) sourceData[r][c] = { value: cell.value ?? '', data_type: cell.data_type ?? 's' };
		}
	}

	// Compute pivot
	const output = computePivotTable(sourceData, config);
	pivotOutputCache.set(pivotIndex, output);

	// Find / create destination sheet
	let destSheetIdx = data.sheets.findIndex((s: any) => s.name === config.dest_sheet);
	if (destSheetIdx < 0) {
		// Create new sheet
		const newSheet = {
			name: config.dest_sheet,
			cells: {},
			row_count: 100,
			col_count: 26,
			tables: [],
			merged_cells: [],
			charts: [],
			sparklines: [],
		};
		data.sheets.push(newSheet);
		destSheetIdx = data.sheets.length - 1;
	}
	const destSheet = data.sheets[destSheetIdx];

	// Parse destination cell
	const destCellParsed = parseCellRef(config.dest_cell);
	const destRow = destCellParsed?.row ?? 0;
	const destCol = destCellParsed?.col ?? 0;

	// Clear old pivot area before writing (use last cached output dimensions + 20 buffer)
	const prevOutput = model ? null : pivotOutputCache.get(pivotIndex);
	const clearRows = prevOutput ? prevOutput.rowCount + 5 : output.rowCount + 5;
	const clearCols = prevOutput ? prevOutput.colCount + 5 : output.colCount + 5;
	for (let r = destRow; r < destRow + clearRows; r++) {
		if (!destSheet.cells?.[r]) continue;
		for (let c = destCol; c < destCol + clearCols; c++) {
			delete destSheet.cells[r][c];
		}
	}

	// Write pivot output cells
	for (let r = 0; r < output.rowCount; r++) {
		const row = destRow + r;
		if (!destSheet.cells) destSheet.cells = {};
		if (!destSheet.cells[row]) destSheet.cells[row] = {};
		for (let c = 0; c < output.colCount; c++) {
			const col = destCol + c;
			const cell = output.cells[r]?.[c];
			if (!cell || cell.value === '') continue;
			destSheet.cells[row][col] = {
				value: cell.value,
				data_type: cell.dataType,
				style: cell.style ? _camelToSnakeStyle(cell.style) : null,
			};
		}
	}
	destSheet.row_count = Math.max(destSheet.row_count ?? 0, destRow + output.rowCount + 1);
	destSheet.col_count = Math.max(destSheet.col_count ?? 0, destCol + output.colCount + 1);
}

/** Convert camelCase style keys to snake_case for the data model. */
function _camelToSnakeStyle(style: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(style)) {
		const snake = k.replace(/[A-Z]/g, m => '_' + m.toLowerCase());
		out[snake] = v;
	}
	return out;
}

/** Update pivot zone tracking on the renderer after any pivot operation. */
function _syncPivotZones() {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets) { renderer.setPivotZones([]); return; }
	const zones: Array<{ startRow: number; startCol: number; endRow: number; endCol: number; pivotIndex: number }> = [];
	for (let pi = 0; pi < pivotTables.length; pi++) {
		const config = pivotTables[pi];
		const output = pivotOutputCache.get(pi);
		if (!output) continue;
		const destSheet = data.sheets.findIndex((s: any) => s.name === config.dest_sheet);
		if (destSheet < 0) continue;
		// Only show zone if we're on the dest sheet
		if (destSheet !== renderer.getActiveSheetIndex()) continue;
		const destCellParsed = parseCellRef(config.dest_cell);
		const destRow = destCellParsed?.row ?? 0;
		const destCol = destCellParsed?.col ?? 0;
		zones.push({
			startRow: destRow,
			startCol: destCol,
			endRow: destRow + output.rowCount - 1,
			endCol: destCol + output.colCount - 1,
			pivotIndex: pi,
		});
	}
	renderer.setPivotZones(zones);
}

/** Show the pivot table dialog (for create or edit). */
function showPivotTableDialog(editIndex?: number) {
	if (!renderer || !pivotDialog) return;
	const data = renderer.getData();
	if (!data?.sheets) return;
	const sheetNames = (data.sheets as any[]).map((s: any) => s.name as string);
	const activeSheetIdx = renderer.getActiveSheetIndex();

	if (editIndex !== undefined && pivotTables[editIndex]) {
		// Edit existing: use stored config's source range/sheet
		const config = pivotTables[editIndex];
		const srcIdx = data.sheets.findIndex((s: any) => s.name === config.source_sheet);
		const headers = _getPivotSourceHeaders(srcIdx >= 0 ? srcIdx : activeSheetIdx, config.source_range);
		pivotDialog.show(headers, config.source_range, config.source_sheet, sheetNames, config, editIndex);
	} else {
		// New pivot: use current selection or auto-detect the data range
		const sel = renderer.getSelectedRange();
		let sourceRange: string;
		const isSingleCell = !sel || (sel.startRow === sel.endRow && sel.startCol === sel.endCol);
		if (isSingleCell) {
			// Auto-detect the contiguous data block / table containing this cell
			const r = sel?.startRow ?? 0;
			const c = sel?.startCol ?? 0;
			sourceRange = _autoDetectPivotRange(activeSheetIdx, r, c);
		} else {
			const c1 = getColName(Math.min(sel.startCol, sel.endCol)) + (Math.min(sel.startRow, sel.endRow) + 1);
			const c2 = getColName(Math.max(sel.startCol, sel.endCol)) + (Math.max(sel.startRow, sel.endRow) + 1);
			sourceRange = `${c1}:${c2}`;
		}
		const headers = _getPivotSourceHeaders(activeSheetIdx, sourceRange);
		const numericHeaders = _getPivotNumericHeaders(activeSheetIdx, sourceRange);
		const sourceSheet = data.sheets[activeSheetIdx]?.name ?? 'Sheet1';
		pivotDialog.show(headers, sourceRange, sourceSheet, sheetNames, undefined, undefined, numericHeaders);
	}
}

/** Navigate to the destination sheet of a pivot config and rebuild tabs. */
function _navigateToPivotDest(config: PivotTableDef) {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets) return;
	const destIdx = data.sheets.findIndex((s: any) => s.name === config.dest_sheet);
	if (destIdx >= 0 && destIdx !== renderer.getActiveSheetIndex()) {
		renderer.setActiveSheetIndex(destIdx);
	}
	buildSheetTabs();
	syncChartOverlays();
	_syncPivotZones();
}

/** Handle events from the PivotTableDialog. */
function handlePivotDialogAction(event: PivotDialogEvent) {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data) return;
	if (!data.pivot_tables) data.pivot_tables = [];

	switch (event.action) {
		case 'create':
			if (event.config) {
				pivotTables.push(event.config);
				data.pivot_tables.push(event.config);
				const newIdx = pivotTables.length - 1;
				_computeAndWritePivot(newIdx);
				renderer.updateModel(data);
				_navigateToPivotDest(event.config);
				markDirty();
			}
			break;
		case 'update':
			if (event.config && event.editIndex !== undefined && event.editIndex < pivotTables.length) {
				pivotTables[event.editIndex] = event.config;
				data.pivot_tables[event.editIndex] = event.config;
				_computeAndWritePivot(event.editIndex);
				renderer.updateModel(data);
				_navigateToPivotDest(event.config);
				markDirty();
			}
			break;
		case 'delete':
			if (event.editIndex !== undefined) {
				deletePivotTable(event.editIndex);
			}
			break;
		case 'refresh':
			if (event.editIndex !== undefined) {
				refreshPivotTable(event.editIndex);
			}
			break;
		case 'cancel':
			break;
	}
}

/** Refresh a single pivot table by re-computing from current source data. */
function refreshPivotTable(pivotIndex: number) {
	if (!renderer) return;
	_computeAndWritePivot(pivotIndex);
	renderer.render();
	_syncPivotZones();
	markDirty();
}

/** Refresh all pivot tables. */
function refreshAllPivotTables() {
	for (let i = 0; i < pivotTables.length; i++) {
		_computeAndWritePivot(i);
	}
	if (renderer) {
		renderer.render();
		_syncPivotZones();
	}
	markDirty();
}

/** Delete a pivot table: clear output cells and remove config. */
function deletePivotTable(pivotIndex: number) {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets) return;
	const config = pivotTables[pivotIndex];
	if (!config) return;

	// Clear output cells
	const output = pivotOutputCache.get(pivotIndex);
	if (output) {
		const destSheetIdx = data.sheets.findIndex((s: any) => s.name === config.dest_sheet);
		if (destSheetIdx >= 0) {
			const destSheet = data.sheets[destSheetIdx];
			const destCellParsed = parseCellRef(config.dest_cell);
			const destRow = destCellParsed?.row ?? 0;
			const destCol = destCellParsed?.col ?? 0;
			for (let r = destRow; r < destRow + output.rowCount; r++) {
				if (!destSheet.cells?.[r]) continue;
				for (let c = destCol; c < destCol + output.colCount; c++) {
					delete destSheet.cells[r][c];
				}
			}
		}
		pivotOutputCache.delete(pivotIndex);
	}

	// Remove config and re-index remaining pivot outputs
	pivotTables.splice(pivotIndex, 1);
	if (data.pivot_tables) data.pivot_tables.splice(pivotIndex, 1);

	// Re-index pivot output cache (all indices > pivotIndex shift down by 1)
	const newCache: Map<number, PivotOutput> = new Map();
	for (const [idx, out] of pivotOutputCache.entries()) {
		if (idx > pivotIndex) newCache.set(idx - 1, out);
		else if (idx < pivotIndex) newCache.set(idx, out);
	}
	pivotOutputCache.clear();
	for (const [idx, out] of newCache.entries()) pivotOutputCache.set(idx, out);

	renderer.updateModel(data);
	_syncPivotZones();
	markDirty();
}

/** Drill down: create a new sheet with the source rows that contributed to the clicked cell. */
function drillDownPivot(row: number, col: number) {
	if (!renderer) return;
	const pivotIndex = renderer.getPivotZoneAtCell(row, col);
	if (pivotIndex < 0) return;

	const output = pivotOutputCache.get(pivotIndex);
	const config = pivotTables[pivotIndex];
	if (!output || !config) return;

	const data = renderer.getData();
	if (!data?.sheets) return;

	// Find the cell in the pivot output grid
	const destCellParsed = parseCellRef(config.dest_cell);
	const destRow = destCellParsed?.row ?? 0;
	const destCol = destCellParsed?.col ?? 0;
	const outR = row - destRow;
	const outC = col - destCol;
	if (outR < 0 || outC < 0 || outR >= output.rowCount || outC >= output.colCount) return;

	const pivotCell = output.cells[outR]?.[outC];
	if (!pivotCell?.sourceRows || pivotCell.sourceRows.length === 0) {
		console.log('[Pivot] No source rows for drill-down on this cell');
		return;
	}

	// Find source sheet and get headers
	const srcSheetIdx = data.sheets.findIndex((s: any) => s.name === config.source_sheet);
	if (srcSheetIdx < 0) return;
	const srcSheet = data.sheets[srcSheetIdx];
	const srcRange = parseCellRange(config.source_range);
	if (!srcRange) return;

	// Build drill-down sheet name
	let drillName = `PivotDrill_${pivotIndex + 1}`;
	let drillCounter = 1;
	while (data.sheets.some((s: any) => s.name === drillName)) {
		drillCounter++;
		drillName = `PivotDrill_${pivotIndex + 1}_${drillCounter}`;
	}

	// Create new sheet with header row + matching source rows
	const drillSheet: any = {
		name: drillName,
		cells: {},
		row_count: pivotCell.sourceRows.length + 2,
		col_count: srcRange.endCol - srcRange.startCol + 1,
		tables: [],
		merged_cells: [],
		charts: [],
		sparklines: [],
	};

	// Copy header row
	for (let c = srcRange.startCol; c <= srcRange.endCol; c++) {
		const headerCell = srcSheet.cells?.[srcRange.startRow]?.[c];
		const destC = c - srcRange.startCol;
		if (!drillSheet.cells[0]) drillSheet.cells[0] = {};
		drillSheet.cells[0][destC] = {
			value: headerCell?.value ?? `Col${destC + 1}`,
			data_type: headerCell?.data_type ?? 's',
			style: { bold: true },
		};
	}

	// Copy matching source rows (sourceRows are 1-based indices relative to header)
	let drillRow = 1;
	for (const srcRowOffset of pivotCell.sourceRows) {
		const actualSrcRow = srcRange.startRow + srcRowOffset;
		if (!drillSheet.cells[drillRow]) drillSheet.cells[drillRow] = {};
		for (let c = srcRange.startCol; c <= srcRange.endCol; c++) {
			const srcCell = srcSheet.cells?.[actualSrcRow]?.[c];
			if (!srcCell) continue;
			const destC = c - srcRange.startCol;
			drillSheet.cells[drillRow][destC] = {
				value: srcCell.value,
				data_type: srcCell.data_type,
				style: null,
			};
		}
		drillRow++;
	}

	data.sheets.push(drillSheet);
	renderer.updateModel(data);
	renderer.setActiveSheetIndex(data.sheets.length - 1);
	_syncPivotZones();
	buildSheetTabs();
	markDirty();
}

// ============================================================================

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
			const sel = renderer!.getSelectedRange();
			const selRange = sel ? {
				startRow: Math.min(sel.startRow, sel.endRow),
				startCol: Math.min(sel.startCol, sel.endCol),
				endRow: Math.max(sel.startRow, sel.endRow),
				endCol: Math.max(sel.startCol, sel.endCol),
			} : undefined;
			contextMenu.show(x, y, row, col, headerType, selRange);
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

	// Selection changed -> update formula bar and status bar
	renderer.onSelectionChanged = (row: number, col: number) => {
		updateFormulaBar(row, col);
		updateStatusBar();
	};

	// Zoom changed -> update status bar zoom display
	renderer.onZoomChanged = (scale: number) => {
		updateZoomDisplay(scale);
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
	const cellRefEl = document.getElementById('cell-ref') as HTMLInputElement | null;
	const formulaInput = document.getElementById('formula-input') as HTMLInputElement | null;
	if (cellRefEl && document.activeElement !== cellRefEl) {
		// Show cell address, or named range name if the cell is covered by one
		const cellAddr = getColName(col) + (row + 1);
		const matchingName = definedNames.find(n => {
			// Only single-cell named ranges show the name in the Name Box
			const f = n.formula.replace(/^=/, '');
			const clean = f.replace(/\$/g, '').toUpperCase();
			return clean === cellAddr || clean.endsWith('!' + cellAddr);
		});
		cellRefEl.value = matchingName ? matchingName.name : cellAddr;
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

// --- Status Bar ---

const statusBarEl = document.getElementById('status-bar') as HTMLDivElement | null;

// Which stat items are currently visible (persisted in memory)
const visibleStats = new Set<string>(['average', 'count', 'sum']);

// --- Zoom controls (left side of status bar) ---
let zoomSlider: HTMLInputElement | null = null;
let zoomLabel: HTMLSpanElement | null = null;
let statusStatsEl: HTMLDivElement | null = null;

function initStatusBarZoomControls() {
	if (!statusBarEl) return;
	statusBarEl.innerHTML = '';

	// Left: zoom controls
	const zoomCtrl = document.createElement('div');
	zoomCtrl.className = 'zoom-controls';

	const zoomMinusBtn = document.createElement('button');
	zoomMinusBtn.className = 'zoom-btn';
	zoomMinusBtn.textContent = '\u2212';
	zoomMinusBtn.title = 'Zoom Out';
	zoomMinusBtn.addEventListener('click', () => { if (renderer) renderer.zoomOut(); });

	const slider = document.createElement('input');
	slider.type = 'range';
	slider.className = 'zoom-slider';
	slider.min = '25';
	slider.max = '400';
	slider.step = '5';
	slider.value = '100';
	slider.title = 'Zoom';
	slider.addEventListener('input', () => {
		if (renderer) renderer.setZoom(parseInt(slider.value) / 100);
	});

	const label = document.createElement('span');
	label.className = 'zoom-label';
	label.textContent = '100%';

	const zoomPlusBtn = document.createElement('button');
	zoomPlusBtn.className = 'zoom-btn';
	zoomPlusBtn.textContent = '+';
	zoomPlusBtn.title = 'Zoom In';
	zoomPlusBtn.addEventListener('click', () => { if (renderer) renderer.zoomIn(); });

	zoomCtrl.appendChild(zoomMinusBtn);
	zoomCtrl.appendChild(slider);
	zoomCtrl.appendChild(label);
	zoomCtrl.appendChild(zoomPlusBtn);
	statusBarEl.appendChild(zoomCtrl);

	zoomSlider = slider;
	zoomLabel = label;

	// Right: stats
	const statsDiv = document.createElement('div');
	statsDiv.style.cssText = 'display:flex;align-items:center;gap:16px;';
	statusBarEl.appendChild(statsDiv);
	statusStatsEl = statsDiv;
}

function updateZoomDisplay(scale: number) {
	if (zoomSlider) zoomSlider.value = String(Math.round(scale * 100));
	if (zoomLabel) zoomLabel.textContent = `${Math.round(scale * 100)}%`;
}

/** Format a number for display in the status bar (up to 10 significant digits). */
function formatStat(n: number): string {
	if (Number.isInteger(n)) return String(n);
	// Up to 10 significant digits, trim trailing zeros
	return parseFloat(n.toPrecision(10)).toString();
}

function updateStatusBar() {
	if (!renderer || !statusStatsEl) return;
	const stats = renderer.getSelectionStats();
	statusStatsEl.innerHTML = '';
	if (!stats) return;

	// Only show stats when more than one cell is selected or there is a value
	const items: Array<{ key: string; label: string; value: string }> = [
		{ key: 'average',  label: 'Average',           value: stats.count > 0 ? formatStat(stats.avg) : '' },
		{ key: 'count',    label: 'Count',              value: stats.countAll > 0 ? String(stats.countAll) : '' },
		{ key: 'numCount', label: 'Numerical Count',    value: stats.count > 0 ? String(stats.count) : '' },
		{ key: 'min',      label: 'Min',                value: stats.count > 0 ? formatStat(stats.min) : '' },
		{ key: 'max',      label: 'Max',                value: stats.count > 0 ? formatStat(stats.max) : '' },
		{ key: 'sum',      label: 'Sum',                value: stats.count > 0 ? formatStat(stats.sum) : '' },
	];

	for (const item of items) {
		if (!visibleStats.has(item.key) || !item.value) continue;
		const el = document.createElement('span');
		el.className = 'status-item';
		el.textContent = `${item.label}: ${item.value}`;
		statusStatsEl.appendChild(el);
	}
}

function showStatusBarContextMenu(x: number, y: number) {
	// Remove any existing status context menu
	document.getElementById('status-ctx-menu')?.remove();

	const allItems: Array<{ key: string; label: string }> = [
		{ key: 'average',  label: 'Average' },
		{ key: 'count',    label: 'Count' },
		{ key: 'numCount', label: 'Numerical Count' },
		{ key: 'min',      label: 'Min' },
		{ key: 'max',      label: 'Max' },
		{ key: 'sum',      label: 'Sum' },
	];

	const menu = document.createElement('div');
	menu.id = 'status-ctx-menu';
	Object.assign(menu.style, {
		position: 'fixed',
		left: `${x}px`,
		top: `${Math.max(0, y - allItems.length * 28)}px`,
		background: '#1e1e1e',
		border: '1px solid #555',
		borderRadius: '4px',
		zIndex: '9999',
		minWidth: '180px',
		boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
		fontFamily: 'system-ui, sans-serif',
		fontSize: '13px',
		color: '#ccc',
		padding: '4px 0',
	});

	const header = document.createElement('div');
	header.textContent = 'Customize Status Bar';
	Object.assign(header.style, {
		padding: '4px 12px 6px',
		fontWeight: '600',
		color: '#aaa',
		fontSize: '11px',
		textTransform: 'uppercase',
		letterSpacing: '0.05em',
		borderBottom: '1px solid #444',
		marginBottom: '4px',
	});
	menu.appendChild(header);

	for (const item of allItems) {
		const row = document.createElement('label');
		Object.assign(row.style, {
			display: 'flex',
			alignItems: 'center',
			gap: '8px',
			padding: '5px 12px',
			cursor: 'pointer',
		});
		row.addEventListener('mouseenter', () => { row.style.background = 'rgba(255,255,255,0.08)'; });
		row.addEventListener('mouseleave', () => { row.style.background = ''; });

		const cb = document.createElement('input');
		cb.type = 'checkbox';
		cb.checked = visibleStats.has(item.key);
		cb.addEventListener('change', () => {
			if (cb.checked) visibleStats.add(item.key);
			else visibleStats.delete(item.key);
			updateStatusBar();
		});

		row.appendChild(cb);
		row.appendChild(document.createTextNode(item.label));
		menu.appendChild(row);
	}

	document.body.appendChild(menu);

	// Close on outside click
	const close = (e: MouseEvent) => {
		if (!menu.contains(e.target as Node)) {
			menu.remove();
			document.removeEventListener('mousedown', close);
		}
	};
	setTimeout(() => document.addEventListener('mousedown', close), 0);
}

initStatusBarZoomControls();

if (statusBarEl) {
	statusBarEl.addEventListener('contextmenu', (e) => {
		e.preventDefault();
		showStatusBarContextMenu(e.clientX, e.clientY);
	});
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

// =============================================================================
// PAGE SETUP HELPERS
// =============================================================================

/** Sync page break info from model to renderer for every sheet. */
function _syncPageSetups() {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets) return;
	for (const sheet of data.sheets as any[]) {
		const ps = sheet.page_setup;
		if (ps) {
			renderer.setSheetPageSetup(sheet.name, {
				row_breaks: ps.row_breaks ?? [],
				col_breaks: ps.col_breaks ?? [],
			});
		} else {
			renderer.setSheetPageSetup(sheet.name, null);
		}
	}
}

/** Get the PageSetupDef for the currently active sheet. */
function getActiveSheetPageSetup(): Partial<PageSetupDef> {
	if (!renderer) return {};
	const data = renderer.getData();
	if (!data?.sheets) return {};
	const sheet = data.sheets[renderer.getActiveSheetIndex()];
	return (sheet?.page_setup as Partial<PageSetupDef>) ?? {};
}

/** Mutate the active sheet's page_setup and resync renderer + mark dirty. */
function _applyPageSetup(patch: Partial<PageSetupDef>) {
	if (!renderer) return;
	const data = renderer.getData();
	if (!data?.sheets) return;
	const sheet = data.sheets[renderer.getActiveSheetIndex()];
	if (!sheet) return;
	if (!sheet.page_setup) {
		sheet.page_setup = {
			orientation: 'portrait', paper_size: 1, scale: 100,
			margin_left: 0.7, margin_right: 0.7, margin_top: 0.75, margin_bottom: 0.75,
			margin_header: 0.3, margin_footer: 0.3,
			header: '', footer: '', print_area: '', print_titles_rows: '', print_titles_cols: '',
			row_breaks: [], col_breaks: [], print_gridlines: false,
			center_horizontally: false, center_vertically: false,
		};
	}
	Object.assign(sheet.page_setup, patch);
	_syncPageSetups();
	markDirty();
}

function handlePageSetupDialogAction(event: PageSetupEvent) {
	if (event.action === 'apply' && event.setup) {
		_applyPageSetup(event.setup);
	}
}

function handlePageMarginsChange(preset: string) {
	const presets: Record<string, { margin_left: number; margin_right: number; margin_top: number; margin_bottom: number; margin_header: number; margin_footer: number }> = {
		'Normal':  { margin_left: 0.7, margin_right: 0.7, margin_top: 0.75, margin_bottom: 0.75, margin_header: 0.3, margin_footer: 0.3 },
		'Wide':    { margin_left: 1.0, margin_right: 1.0, margin_top: 1.0,  margin_bottom: 1.0,  margin_header: 0.5, margin_footer: 0.5 },
		'Narrow':  { margin_left: 0.25, margin_right: 0.25, margin_top: 0.75, margin_bottom: 0.75, margin_header: 0.3, margin_footer: 0.3 },
	};
	if (preset === 'Custom...') { pageSetupDialog?.show(getActiveSheetPageSetup()); return; }
	const p = presets[preset];
	if (p) _applyPageSetup(p);
}

function handlePageOrientationChange(value: string) {
	_applyPageSetup({ orientation: value.toLowerCase() });
}

function handlePaperSizeChange(value: string) {
	const sizeMap: Record<string, number> = { 'Letter': 1, 'A4': 9, 'Legal': 5, 'A3': 8, 'Tabloid': 3 };
	const id = sizeMap[value] ?? 1;
	_applyPageSetup({ paper_size: id });
}

function handleSetPrintArea() {
	if (!renderer) return;
	const sel = renderer.getSelectedRange();
	if (!sel) return;
	const c1 = getColName(Math.min(sel.startCol, sel.endCol)) + (Math.min(sel.startRow, sel.endRow) + 1);
	const c2 = getColName(Math.max(sel.startCol, sel.endCol)) + (Math.max(sel.startRow, sel.endRow) + 1);
	_applyPageSetup({ print_area: `${c1}:${c2}` });
}

function handleClearPrintArea() {
	_applyPageSetup({ print_area: '' });
}

function handleInsertPageBreak() {
	if (!renderer) return;
	const cell = renderer.getSelectedCell();
	if (!cell) return;
	const ps = getActiveSheetPageSetup() as PageSetupDef;
	const rowBreaks = [...(ps.row_breaks ?? [])];
	if (!rowBreaks.includes(cell.row) && cell.row > 0) rowBreaks.push(cell.row);
	rowBreaks.sort((a, b) => a - b);
	_applyPageSetup({ row_breaks: rowBreaks });
}

function handleRemovePageBreak() {
	if (!renderer) return;
	const cell = renderer.getSelectedCell();
	if (!cell) return;
	const ps = getActiveSheetPageSetup() as PageSetupDef;
	const rowBreaks = (ps.row_breaks ?? []).filter((r: number) => r !== cell.row);
	_applyPageSetup({ row_breaks: rowBreaks });
}

function handleResetPageBreaks() {
	_applyPageSetup({ row_breaks: [], col_breaks: [] });
}

function handleFitToWidth(value: string) {
	if (value === 'Automatic') {
		_applyPageSetup({ fit_to_width: undefined });
	} else {
		_applyPageSetup({ fit_to_width: parseInt(value) || 1, fit_to_height: getActiveSheetPageSetup().fit_to_height ?? 1 });
	}
}

function handleFitToHeight(value: string) {
	if (value === 'Automatic') {
		_applyPageSetup({ fit_to_height: undefined });
	} else {
		_applyPageSetup({ fit_to_height: parseInt(value) || 1, fit_to_width: getActiveSheetPageSetup().fit_to_width ?? 1 });
	}
}

function handlePrintScale(scale: number) {
	if (!isNaN(scale) && scale >= 10 && scale <= 400) {
		_applyPageSetup({ scale, fit_to_width: undefined, fit_to_height: undefined });
	}
}

function handlePageSetupToggle(key: keyof PageSetupDef, value: boolean) {
	_applyPageSetup({ [key]: value });
}

/** Paginated Print Preview: renders each page section into a canvas and sends to extension host. */
function handlePrintPreview() {
	if (!renderer) return;
	const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
	if (!canvas) return;

	const data = renderer.getData();
	const sheet = data?.sheets?.[renderer.getActiveSheetIndex()];
	const ps = sheet?.page_setup as PageSetupDef | undefined;

	// Build paginated HTML with header/footer substitutions
	const fileName = sheet?.name ?? 'Spreadsheet';
	const today = new Date().toLocaleDateString();
	const headerText = ps ? _resolveHFCode(ps.header, { sheet: sheet?.name ?? '', date: today, page: 1, pages: 1 }) : '';
	const footerText = ps ? _resolveHFCode(ps.footer, { sheet: sheet?.name ?? '', date: today, page: 1, pages: 1 }) : '';
	const orientation = ps?.orientation === 'landscape' ? 'landscape' : 'portrait';
	const dataUrl = canvas.toDataURL('image/png');

	const printHtml = [
		'<!DOCTYPE html><html><head><meta charset="utf-8">',
		`<title>Print Preview - ${fileName}</title>`,
		'<style>',
		`@media print { @page { margin:0.75in; size:${orientation}; } body { margin:0; } }`,
		'body { background:#e0e0e0; display:flex; flex-direction:column; align-items:center; padding:20px; font-family:system-ui,sans-serif; }',
		'.page { background:#fff; margin:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,.2); page-break-after:always; }',
		`.page-header { text-align:center; font-size:12px; color:#555; border-bottom:1px solid #ccc; padding-bottom:4px; margin-bottom:8px; }`,
		`.page-footer { text-align:center; font-size:12px; color:#555; border-top:1px solid #ccc; padding-top:4px; margin-top:8px; }`,
		'img { max-width:100%; }',
		'</style></head><body>',
		'<div class="page">',
		headerText ? `<div class="page-header">${headerText}</div>` : '',
		`<img src="${dataUrl}" />`,
		footerText ? `<div class="page-footer">${footerText}</div>` : '',
		'</div>',
		'<script>window.onload = function() { window.print(); }<\/script>',
		'</body></html>',
	].join('');

	vscode.postMessage({ type: 'print', imageData: dataUrl, printHtml });
}

/** Substitute Excel header/footer codes with actual values. */
function _resolveHFCode(template: string, ctx: { sheet: string; date: string; page: number; pages: number }): string {
	return template
		.replace(/&A/gi, ctx.sheet)
		.replace(/&D/gi, ctx.date)
		.replace(/&T/gi, new Date().toLocaleTimeString())
		.replace(/&P/gi, String(ctx.page))
		.replace(/&N/gi, String(ctx.pages))
		.replace(/&F/gi, ctx.sheet)
		.replace(/&L/gi, '').replace(/&C/gi, '').replace(/&R/gi, '');
}

// ─── Export as CSV ────────────────────────────────────────────────────────────

function csvEscape(value: string): string {
	if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
		return '"' + value.replace(/"/g, '""') + '"';
	}
	return value;
}

function handleExportCSV(): void {
	if (!renderer) return;
	const data = renderer.getData();
	const sheetIdx = renderer.getActiveSheetIndex();
	const sheet = data?.sheets?.[sheetIdx];
	if (!sheet) return;

	const cells: Record<number, Record<number, { value?: string; formatted?: string }>> = sheet.cells ?? {};
	const rowKeys = Object.keys(cells).map(Number).sort((a, b) => a - b);
	if (rowKeys.length === 0) return;

	const maxRow = rowKeys[rowKeys.length - 1] + 1;
	let maxCol = 0;
	for (const rk of rowKeys) {
		const colKeys = Object.keys(cells[rk]).map(Number);
		for (const ck of colKeys) {
			if (ck >= maxCol) maxCol = ck + 1;
		}
	}

	const lines: string[] = [];
	for (let r = 0; r < maxRow; r++) {
		const rowCells: string[] = [];
		for (let c = 0; c < maxCol; c++) {
			const cell = cells[r]?.[c];
			const val = cell ? (cell.formatted ?? cell.value ?? '') : '';
			rowCells.push(csvEscape(String(val)));
		}
		lines.push(rowCells.join(','));
	}

	const content = lines.join('\r\n');
	const defaultName = (sheet.name || 'Sheet1').replace(/[^\w\s-]/g, '_');
	vscode.postMessage({ type: 'exportFile', content, format: 'csv', defaultName: `${defaultName}.csv` });
}

// ─── Export as HTML table ─────────────────────────────────────────────────────

function handleExportHTML(): void {
	if (!renderer) return;
	const data = renderer.getData();
	const sheetIdx = renderer.getActiveSheetIndex();
	const sheet = data?.sheets?.[sheetIdx];
	if (!sheet) return;

	const cells: Record<number, Record<number, Record<string, unknown>>> = sheet.cells ?? {};
	const rowKeys = Object.keys(cells).map(Number).sort((a, b) => a - b);
	if (rowKeys.length === 0) return;

	const maxRow = rowKeys[rowKeys.length - 1] + 1;
	let maxCol = 0;
	for (const rk of rowKeys) {
		const colKeys = Object.keys(cells[rk]).map(Number);
		for (const ck of colKeys) {
			if (ck >= maxCol) maxCol = ck + 1;
		}
	}

	const htmlRows: string[] = [];
	for (let r = 0; r < maxRow; r++) {
		const rowCells: string[] = [];
		for (let c = 0; c < maxCol; c++) {
			const cell = cells[r]?.[c];
			const val = cell ? ((cell['formatted'] ?? cell['value'] ?? '') as string) : '';
			const style = _cellToInlineStyle(cell);
			rowCells.push(`<td style="${style}">${_escapeHtml(String(val))}</td>`);
		}
		htmlRows.push(`<tr>${rowCells.join('')}</tr>`);
	}

	const sheetName = sheet.name ?? 'Sheet';
	const tableHtml = [
		'<!DOCTYPE html><html><head><meta charset="utf-8">',
		`<title>${_escapeHtml(sheetName)}</title>`,
		'<style>',
		'body { font-family: Calibri, Arial, sans-serif; padding: 16px; }',
		'table { border-collapse: collapse; }',
		'td { border: 1px solid #d0d0d0; padding: 4px 8px; min-width: 48px; }',
		'</style></head><body>',
		`<h2>${_escapeHtml(sheetName)}</h2>`,
		'<table>',
		htmlRows.join('\n'),
		'</table></body></html>',
	].join('\n');

	const defaultName = sheetName.replace(/[^\w\s-]/g, '_');
	vscode.postMessage({ type: 'exportFile', content: tableHtml, format: 'html', defaultName: `${defaultName}.html` });
}

function _escapeHtml(s: string): string {
	return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _cellToInlineStyle(cell: Record<string, unknown> | undefined): string {
	if (!cell) return '';
	const parts: string[] = [];
	if (cell['bold']) parts.push('font-weight:bold');
	if (cell['italic']) parts.push('font-style:italic');
	if (cell['underline']) parts.push('text-decoration:underline');
	if (typeof cell['font_color'] === 'string' && cell['font_color']) parts.push(`color:${cell['font_color']}`);
	if (typeof cell['bg_color'] === 'string' && cell['bg_color']) parts.push(`background-color:${cell['bg_color']}`);
	const align = cell['align'] ?? cell['h_align'];
	if (typeof align === 'string' && align) parts.push(`text-align:${align}`);
	return parts.join(';');
}

// ─── Export as PDF (print-ready HTML) ────────────────────────────────────────

function handleExportPDF(): void {
	if (!renderer) return;
	const canvas = document.querySelector('canvas') as HTMLCanvasElement | null;
	if (!canvas) return;

	const data = renderer.getData();
	const sheetIdx = renderer.getActiveSheetIndex();
	const sheet = data?.sheets?.[sheetIdx];
	const ps = sheet?.page_setup as PageSetupDef | undefined;

	const fileName = sheet?.name ?? 'Spreadsheet';
	const today = new Date().toLocaleDateString();
	const headerText = ps ? _resolveHFCode(ps.header, { sheet: sheet?.name ?? '', date: today, page: 1, pages: 1 }) : '';
	const footerText = ps ? _resolveHFCode(ps.footer, { sheet: sheet?.name ?? '', date: today, page: 1, pages: 1 }) : '';
	const orientation = ps?.orientation === 'landscape' ? 'landscape' : 'portrait';
	const dataUrl = canvas.toDataURL('image/png');

	const printHtml = [
		'<!DOCTYPE html><html><head><meta charset="utf-8">',
		`<title>${_escapeHtml(fileName)}</title>`,
		'<style>',
		`@media print { @page { margin:0.75in; size:${orientation}; } body { margin:0; } }`,
		'body { background:#e0e0e0; display:flex; flex-direction:column; align-items:center; padding:20px; font-family:system-ui,sans-serif; }',
		'.page { background:#fff; margin:12px; padding:20px; box-shadow:0 2px 8px rgba(0,0,0,.2); page-break-after:always; }',
		'.page-header { text-align:center; font-size:12px; color:#555; border-bottom:1px solid #ccc; padding-bottom:4px; margin-bottom:8px; }',
		'.page-footer { text-align:center; font-size:12px; color:#555; border-top:1px solid #ccc; padding-top:4px; margin-top:8px; }',
		'img { max-width:100%; }',
		'</style></head><body>',
		'<div class="page">',
		headerText ? `<div class="page-header">${headerText}</div>` : '',
		`<img src="${dataUrl}" />`,
		footerText ? `<div class="page-footer">${footerText}</div>` : '',
		'</div>',
		'</body></html>',
	].join('');

	const defaultName = fileName.replace(/[^\w\s-]/g, '_');
	vscode.postMessage({ type: 'exportFile', content: printHtml, format: 'html', defaultName: `${defaultName}-print.html` });
}

// ─── Import CSV / TSV ─────────────────────────────────────────────────────────

function handleImportCSV(): void {
	// Request the extension host to open a file dialog and return the content
	vscode.postMessage({ type: 'importFile', formats: ['csv', 'tsv', 'txt'] });
}

function handleCsvImportDialogAction(event: CsvImportEvent): void {
	if (!renderer) return;
	if (event.action === 'close') return;
	const { rows, newSheet } = event;
	if (newSheet) {
		addSheet();
	}
	// Build TSV text from parsed rows and use pasteData
	const tsv = rows.map(r => r.join('\t')).join('\n');
	renderer.pasteData(tsv);
	markDirty();
}

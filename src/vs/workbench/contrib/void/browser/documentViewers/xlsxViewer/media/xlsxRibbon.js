// XLSX Ribbon Controller - Manages the ribbon UI for the spreadsheet viewer
// @ts-check

// ==========================================
// ClipboardManager - Handles copy/cut/paste operations
// ==========================================
class ClipboardManager {
	/**
	 * @param {any} grid - The x-spreadsheet grid instance
	 */
	constructor(grid) {
		this.grid = grid;
		this.clipboard = null; // {data, range, isCut, styles}
	}

	/**
	 * Copy selected cells to clipboard
	 * @returns {boolean} Success status
	 */
	copy() {
		const range = this.grid.sheet.selector.range;
		const { sri, sci, eri, eci } = range;

		if (sri === -1 || sci === -1) {
			console.warn('[ClipboardManager] No selection to copy');
			return false;
		}

		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;
		const styles = sheetData.styles || [];

		// Extract cell data from selection
		const data = [];
		const cellStyles = [];

		for (let r = sri; r <= eri; r++) {
			const rowData = [];
			const rowStyles = [];
			for (let c = sci; c <= eci; c++) {
				let cellValue = '';
				let cellStyle = null;
				let cellFormula = null;

				if (rows._ && rows._[r] && rows._[r].cells && rows._[r].cells[c]) {
					const cell = rows._[r].cells[c];
					cellValue = cell.text || '';
					cellFormula = cell._formula || null;
					if (typeof cell.style === 'number' && styles[cell.style]) {
						cellStyle = JSON.parse(JSON.stringify(styles[cell.style]));
					}
				}

				rowData.push({ text: cellValue, _formula: cellFormula });
				rowStyles.push(cellStyle);
			}
			data.push(rowData);
			cellStyles.push(rowStyles);
		}

		this.clipboard = {
			data: data,
			styles: cellStyles,
			range: { sri, sci, eri, eci },
			isCut: false
		};

		// Also copy to system clipboard as TSV for cross-app support
		const tsvData = data.map(row => row.map(cell => cell.text).join('\t')).join('\n');
		navigator.clipboard.writeText(tsvData).catch(err => {
			console.warn('[ClipboardManager] Could not copy to system clipboard:', err);
		});

		console.log('[ClipboardManager] Copied', data.length, 'rows');
		return true;
	}

	/**
	 * Cut selected cells (copy + mark for deletion)
	 * @returns {boolean} Success status
	 */
	cut() {
		if (!this.copy()) {
			return false;
		}
		this.clipboard.isCut = true;
		console.log('[ClipboardManager] Cut marked');
		return true;
	}

	/**
	 * Paste clipboard contents at current selection
	 * @param {Function} onContentChanged - Callback when content changes
	 * @returns {boolean} Success status
	 */
	paste(onContentChanged) {
		if (!this.clipboard || !this.clipboard.data) {
			console.warn('[ClipboardManager] No data to paste');
			return false;
		}

		const range = this.grid.sheet.selector.range;
		const targetRow = range.sri;
		const targetCol = range.sci;

		if (targetRow === -1 || targetCol === -1) {
			console.warn('[ClipboardManager] No target cell selected');
			return false;
		}

		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;
		if (!sheetData.styles) sheetData.styles = [];
		const styles = sheetData.styles;

		// Paste data
		for (let r = 0; r < this.clipboard.data.length; r++) {
			const row = this.clipboard.data[r];
			const styleRow = this.clipboard.styles[r];
			const destRow = targetRow + r;

			for (let c = 0; c < row.length; c++) {
				const destCol = targetCol + c;
				const cellData = row[c];
				const cellStyle = styleRow[c];

				// Ensure row and cell exist
				if (!rows._) rows._ = {};
				if (!rows._[destRow]) rows._[destRow] = { cells: {} };
				if (!rows._[destRow].cells) rows._[destRow].cells = {};
				if (!rows._[destRow].cells[destCol]) rows._[destRow].cells[destCol] = {};

				const destCell = rows._[destRow].cells[destCol];
				destCell.text = cellData.text;
				if (cellData._formula) {
					destCell._formula = cellData._formula;
				}

				// Apply style if present
				if (cellStyle) {
					const newStyleIndex = styles.length;
					styles.push(cellStyle);
					destCell.style = newStyleIndex;
				}
			}
		}

		// If it was a cut, clear the source cells
		if (this.clipboard.isCut) {
			const { sri, sci, eri, eci } = this.clipboard.range;
			for (let r = sri; r <= eri; r++) {
				for (let c = sci; c <= eci; c++) {
					if (rows._ && rows._[r] && rows._[r].cells && rows._[r].cells[c]) {
						rows._[r].cells[c].text = '';
						delete rows._[r].cells[c]._formula;
					}
				}
			}
			this.clipboard.isCut = false; // Only clear once
		}

		this.grid.reRender();
		if (onContentChanged) onContentChanged();

		console.log('[ClipboardManager] Pasted at row', targetRow, 'col', targetCol);
		return true;
	}

	/**
	 * Check if clipboard has content
	 * @returns {boolean}
	 */
	hasContent() {
		return this.clipboard !== null && this.clipboard.data !== null;
	}
}

// ==========================================
// HistoryManager - Handles undo/redo operations
// ==========================================
class HistoryManager {
	/**
	 * @param {any} grid - The x-spreadsheet grid instance
	 * @param {number} maxHistory - Maximum history stack size
	 */
	constructor(grid, maxHistory = 50) {
		this.grid = grid;
		this.undoStack = [];
		this.redoStack = [];
		this.maxHistory = maxHistory;
		this.isRestoring = false; // Prevent saving state during restore
	}

	/**
	 * Save current state to undo stack
	 */
	saveState() {
		if (this.isRestoring) return;

		try {
			const data = this.grid.getData();
			const snapshot = JSON.stringify(data);

			// Don't save if identical to last state
			if (this.undoStack.length > 0 && this.undoStack[this.undoStack.length - 1] === snapshot) {
				return;
			}

			this.undoStack.push(snapshot);

			// Limit stack size
			if (this.undoStack.length > this.maxHistory) {
				this.undoStack.shift();
			}

			// Clear redo stack on new action
			this.redoStack = [];

			console.log('[HistoryManager] State saved, undo stack size:', this.undoStack.length);
		} catch (e) {
			console.warn('[HistoryManager] Error saving state:', e);
		}
	}

	/**
	 * Undo last action
	 * @param {Function} onContentChanged - Callback when content changes
	 * @returns {boolean} Success status
	 */
	undo(onContentChanged) {
		if (this.undoStack.length <= 1) {
			console.log('[HistoryManager] Nothing to undo');
			return false;
		}

		try {
			this.isRestoring = true;

			// Save current state to redo stack
			const currentData = this.grid.getData();
			this.redoStack.push(JSON.stringify(currentData));

			// Pop current state and restore previous
			this.undoStack.pop();
			const previousSnapshot = this.undoStack[this.undoStack.length - 1];
			const previousData = JSON.parse(previousSnapshot);

			this.grid.loadData(previousData);
			this.grid.reRender();

			if (onContentChanged) onContentChanged();

			console.log('[HistoryManager] Undo performed, stack size:', this.undoStack.length);
			return true;
		} catch (e) {
			console.warn('[HistoryManager] Error during undo:', e);
			return false;
		} finally {
			this.isRestoring = false;
		}
	}

	/**
	 * Redo last undone action
	 * @param {Function} onContentChanged - Callback when content changes
	 * @returns {boolean} Success status
	 */
	redo(onContentChanged) {
		if (this.redoStack.length === 0) {
			console.log('[HistoryManager] Nothing to redo');
			return false;
		}

		try {
			this.isRestoring = true;

			// Get redo state
			const redoSnapshot = this.redoStack.pop();
			const redoData = JSON.parse(redoSnapshot);

			// Save current state to undo stack
			const currentData = this.grid.getData();
			this.undoStack.push(JSON.stringify(currentData));

			this.grid.loadData(redoData);
			this.grid.reRender();

			if (onContentChanged) onContentChanged();

			console.log('[HistoryManager] Redo performed, stack size:', this.redoStack.length);
			return true;
		} catch (e) {
			console.warn('[HistoryManager] Error during redo:', e);
			return false;
		} finally {
			this.isRestoring = false;
		}
	}

	/**
	 * Check if undo is available
	 * @returns {boolean}
	 */
	canUndo() {
		return this.undoStack.length > 1;
	}

	/**
	 * Check if redo is available
	 * @returns {boolean}
	 */
	canRedo() {
		return this.redoStack.length > 0;
	}

	/**
	 * Clear all history
	 */
	clear() {
		this.undoStack = [];
		this.redoStack = [];
	}
}

// ==========================================
// NumberFormatManager - Handles number formatting
// ==========================================
class NumberFormatManager {
	/**
	 * @param {any} grid - The x-spreadsheet grid instance
	 */
	constructor(grid) {
		this.grid = grid;
		this.decimalPlaces = 2;
	}

	/**
	 * Apply number format to selected cells
	 * @param {string} formatType - Format type (general, number, currency, percentage, date, time, accounting)
	 * @param {object} range - Selection range
	 * @param {Function} onContentChanged - Callback when content changes
	 */
	applyFormat(formatType, range, onContentChanged) {
		const { sri, sci, eri, eci } = range;
		if (sri === -1 || sci === -1) return;

		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		for (let r = sri; r <= eri; r++) {
			for (let c = sci; c <= eci; c++) {
				if (!rows._) continue;
				if (!rows._[r] || !rows._[r].cells || !rows._[r].cells[c]) continue;

				const cell = rows._[r].cells[c];
				const value = parseFloat(cell.text);

				if (isNaN(value)) continue;

				// Store format metadata
				cell._numberFormat = formatType;

				// Apply display formatting
				cell.text = this.formatValue(value, formatType);
			}
		}

		this.grid.reRender();
		if (onContentChanged) onContentChanged();
	}

	/**
	 * Format a value according to format type
	 * @param {number} value - The numeric value
	 * @param {string} formatType - Format type
	 * @returns {string} Formatted string
	 */
	formatValue(value, formatType) {
		switch (formatType) {
			case 'number':
				return value.toLocaleString('en-US', {
					minimumFractionDigits: this.decimalPlaces,
					maximumFractionDigits: this.decimalPlaces
				});

			case 'currency':
				return value.toLocaleString('en-US', {
					style: 'currency',
					currency: 'USD'
				});

			case 'accounting':
				const formatted = Math.abs(value).toLocaleString('en-US', {
					style: 'currency',
					currency: 'USD'
				});
				return value < 0 ? `(${formatted})` : formatted;

			case 'percentage':
				return (value * 100).toLocaleString('en-US', {
					minimumFractionDigits: this.decimalPlaces,
					maximumFractionDigits: this.decimalPlaces
				}) + '%';

			case 'date':
				// Treat as Excel serial date
				const date = new Date((value - 25569) * 86400 * 1000);
				return date.toLocaleDateString('en-US');

			case 'time':
				const hours = Math.floor(value * 24);
				const minutes = Math.floor((value * 24 - hours) * 60);
				const seconds = Math.floor(((value * 24 - hours) * 60 - minutes) * 60);
				return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

			case 'general':
			default:
				return value.toString();
		}
	}

	/**
	 * Increase decimal places for selected cells
	 * @param {object} range - Selection range
	 * @param {Function} onContentChanged - Callback
	 */
	increaseDecimals(range, onContentChanged) {
		this.decimalPlaces = Math.min(this.decimalPlaces + 1, 10);
		this.applyFormat('number', range, onContentChanged);
	}

	/**
	 * Decrease decimal places for selected cells
	 * @param {object} range - Selection range
	 * @param {Function} onContentChanged - Callback
	 */
	decreaseDecimals(range, onContentChanged) {
		this.decimalPlaces = Math.max(this.decimalPlaces - 1, 0);
		this.applyFormat('number', range, onContentChanged);
	}
}

// ==========================================
// CellOperationsManager - Handles insert/delete rows/columns
// ==========================================
class CellOperationsManager {
	/**
	 * @param {any} grid - The x-spreadsheet grid instance
	 */
	constructor(grid) {
		this.grid = grid;
	}

	/**
	 * Insert a row at the selected position
	 * @param {boolean} above - Insert above (true) or below (false)
	 * @param {Function} onContentChanged - Callback
	 */
	insertRow(above, onContentChanged) {
		const range = this.grid.sheet.selector.range;
		const targetRow = above ? range.sri : range.sri + 1;

		if (targetRow === -1) {
			console.warn('[CellOps] No row selected');
			return;
		}

		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		if (!rows._) rows._ = {};

		// Shift existing rows down
		const rowKeys = Object.keys(rows._).map(Number).sort((a, b) => b - a);
		for (const rowIndex of rowKeys) {
			if (rowIndex >= targetRow) {
				rows._[rowIndex + 1] = rows._[rowIndex];
				delete rows._[rowIndex];
			}
		}

		// Create empty row
		rows._[targetRow] = { cells: {} };

		// Update row count if needed
		if (rows.len) rows.len++;

		// Update formula references
		this._updateFormulaReferences('row', 'insert', targetRow);

		this.grid.reRender();
		if (onContentChanged) onContentChanged();

		console.log('[CellOps] Inserted row at', targetRow);
	}

	/**
	 * Delete the selected row
	 * @param {Function} onContentChanged - Callback
	 */
	deleteRow(onContentChanged) {
		const range = this.grid.sheet.selector.range;
		const targetRow = range.sri;

		if (targetRow === -1) {
			console.warn('[CellOps] No row selected');
			return;
		}

		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		if (!rows._) return;

		// Delete the row
		delete rows._[targetRow];

		// Shift remaining rows up
		const rowKeys = Object.keys(rows._).map(Number).sort((a, b) => a - b);
		for (const rowIndex of rowKeys) {
			if (rowIndex > targetRow) {
				rows._[rowIndex - 1] = rows._[rowIndex];
				delete rows._[rowIndex];
			}
		}

		// Update row count if needed
		if (rows.len) rows.len--;

		// Update formula references
		this._updateFormulaReferences('row', 'delete', targetRow);

		this.grid.reRender();
		if (onContentChanged) onContentChanged();

		console.log('[CellOps] Deleted row at', targetRow);
	}

	/**
	 * Insert a column at the selected position
	 * @param {boolean} left - Insert left (true) or right (false)
	 * @param {Function} onContentChanged - Callback
	 */
	insertColumn(left, onContentChanged) {
		const range = this.grid.sheet.selector.range;
		const targetCol = left ? range.sci : range.sci + 1;

		if (targetCol === -1) {
			console.warn('[CellOps] No column selected');
			return;
		}

		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		if (!rows._) return;

		// For each row, shift cells to the right
		for (const rowIndex of Object.keys(rows._)) {
			const row = rows._[rowIndex];
			if (!row || !row.cells) continue;

			const cellKeys = Object.keys(row.cells).map(Number).sort((a, b) => b - a);
			for (const colIndex of cellKeys) {
				if (colIndex >= targetCol) {
					row.cells[colIndex + 1] = row.cells[colIndex];
					delete row.cells[colIndex];
				}
			}
		}

		// Update column count if needed
		if (sheetData.cols && sheetData.cols.len) sheetData.cols.len++;

		// Update formula references
		this._updateFormulaReferences('col', 'insert', targetCol);

		this.grid.reRender();
		if (onContentChanged) onContentChanged();

		console.log('[CellOps] Inserted column at', targetCol);
	}

	/**
	 * Delete the selected column
	 * @param {Function} onContentChanged - Callback
	 */
	deleteColumn(onContentChanged) {
		const range = this.grid.sheet.selector.range;
		const targetCol = range.sci;

		if (targetCol === -1) {
			console.warn('[CellOps] No column selected');
			return;
		}

		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		if (!rows._) return;

		// For each row, delete the cell and shift remaining left
		for (const rowIndex of Object.keys(rows._)) {
			const row = rows._[rowIndex];
			if (!row || !row.cells) continue;

			delete row.cells[targetCol];

			const cellKeys = Object.keys(row.cells).map(Number).sort((a, b) => a - b);
			for (const colIndex of cellKeys) {
				if (colIndex > targetCol) {
					row.cells[colIndex - 1] = row.cells[colIndex];
					delete row.cells[colIndex];
				}
			}
		}

		// Update column count if needed
		if (sheetData.cols && sheetData.cols.len) sheetData.cols.len--;

		// Update formula references
		this._updateFormulaReferences('col', 'delete', targetCol);

		this.grid.reRender();
		if (onContentChanged) onContentChanged();

		console.log('[CellOps] Deleted column at', targetCol);
	}

	/**
	 * Update formula references after insert/delete operations
	 * @private
	 */
	_updateFormulaReferences(type, operation, index) {
		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		if (!rows._) return;

		for (const rowIndex of Object.keys(rows._)) {
			const row = rows._[rowIndex];
			if (!row || !row.cells) continue;

			for (const colIndex of Object.keys(row.cells)) {
				const cell = row.cells[colIndex];
				if (!cell || !cell._formula) continue;

				// Update the formula references
				cell._formula = this._adjustFormula(cell._formula, type, operation, index);
			}
		}
	}

	/**
	 * Adjust formula cell references
	 * @private
	 */
	_adjustFormula(formula, type, operation, index) {
		// Match cell references like A1, B2, AA10, etc.
		return formula.replace(/([A-Z]+)(\d+)/g, (match, col, row) => {
			let colNum = 0;
			for (let i = 0; i < col.length; i++) {
				colNum = colNum * 26 + (col.charCodeAt(i) - 64);
			}
			colNum--; // 0-indexed

			let rowNum = parseInt(row) - 1; // 0-indexed

			if (type === 'row') {
				if (operation === 'insert' && rowNum >= index) {
					rowNum++;
				} else if (operation === 'delete' && rowNum > index) {
					rowNum--;
				} else if (operation === 'delete' && rowNum === index) {
					return '#REF!';
				}
			} else if (type === 'col') {
				if (operation === 'insert' && colNum >= index) {
					colNum++;
				} else if (operation === 'delete' && colNum > index) {
					colNum--;
				} else if (operation === 'delete' && colNum === index) {
					return '#REF!';
				}
			}

			// Convert back to A1 notation
			let newCol = '';
			let temp = colNum + 1;
			while (temp > 0) {
				temp--;
				newCol = String.fromCharCode(65 + (temp % 26)) + newCol;
				temp = Math.floor(temp / 26);
			}

			return newCol + (rowNum + 1);
		});
	}
}

/**
 * XlsxRibbonController - Manages ribbon UI, selection tracking, and style application
 * for the XLSX spreadsheet viewer.
 *
 * Uses x-spreadsheet's indexed style system:
 * - Styles are stored in `grid.sheet.data.styles` array (centralized)
 * - Each cell's `style` property is an INTEGER INDEX into this array
 * - Cells are accessed via `grid.sheet.data.rows._[rowIndex].cells[colIndex]`
 */
class XlsxRibbonController {
	/**
	 * @param {any} gridInstance - The x-spreadsheet grid instance
	 * @param {object} options - Configuration options
	 * @param {Function} options.onContentChanged - Callback when content changes
	 * @param {Function} options.onSaveRequested - Callback when save is requested
	 * @param {Function} options.onPrintRequested - Callback when print is requested
	 */
	constructor(gridInstance, options = {}) {
		this.grid = gridInstance;
		this.onContentChanged = options.onContentChanged || (() => { });
		this.onSaveRequested = options.onSaveRequested || (() => { });
		this.onPrintRequested = options.onPrintRequested || (() => { });
		this.onExportPDFRequested = options.onExportPDFRequested || (() => { });

		// Initialize managers
		this.clipboardManager = new ClipboardManager(gridInstance);
		this.historyManager = new HistoryManager(gridInstance);
		this.numberFormatManager = new NumberFormatManager(gridInstance);
		this.cellOperationsManager = new CellOperationsManager(gridInstance);

		// Selection state - tracks the last valid selection for style operations
		this.lastSelection = { ri: -1, ci: -1, sri: -1, sci: -1, eri: -1, eci: -1 };

		// Debounce timer for ribbon state updates
		this.ribbonStateDebounceTimer = null;
		this.RIBBON_STATE_DEBOUNCE_MS = 50;

		// Debounce timer for drag selection tracking
		this._dragDebounce = null;

		// Formula entry mode state (for point-and-click formula building)
		this.isFormulaEntryMode = false;
		this.formulaCursorPosition = 0;
		this.formulaDragStart = null;
		this.isFormulaDragging = false;
		// Store the target cell where the formula is being entered
		this.formulaTargetCell = { ri: -1, ci: -1 };

		// Color palette for color pickers
		this.COLORS = [
			'#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
			'#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
			'#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
			'#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
			'#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
			'#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
			'#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
			'#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'
		];

		// DOM element references (cached after init)
		this.elements = {};

		console.log('[XlsxRibbon] Controller created with managers');
	}

	/**
	 * Initialize the ribbon controller - bind all event handlers
	 */
	init() {
		console.log('[XlsxRibbon] Initializing...');

		// Cache DOM element references
		this._cacheElements();

		// Setup selection tracking
		this._setupSelectionTracking();

		// Setup tab switching
		this._setupTabs();

		// Setup file operations
		this._setupFileOperations();

		// Setup clipboard operations (Cut, Copy, Paste)
		this._setupClipboardOperations();

		// Setup history operations (Undo, Redo)
		this._setupHistoryOperations();

		// Setup font styling
		this._setupFontStyling();

		// Setup alignment
		this._setupAlignment();

		// Setup color pickers
		this._setupColorPickers();

		// Setup number formatting
		this._setupNumberFormatting();

		// Setup cell operations (Insert/Delete rows/columns)
		this._setupCellOperations();

		// Setup formulas
		this._setupFormulas();

		// Setup merge button
		this._setupMerge();

		// Setup view options
		this._setupViewOptions();

		// Setup formula bar
		this._setupFormulaBar();

		// Setup point-and-click formula building
		this._setupFormulaReferencePicking();

		// Setup keyboard shortcuts
		this._setupKeyboardShortcuts();

		// Save initial state for undo
		this.historyManager.saveState();

		console.log('[XlsxRibbon] Initialization complete');
	}

	// ==========================================
	// Selection Management
	// ==========================================

	/**
	 * Save the current selection from the grid
	 * @param {boolean} [force=false] - Force update even if selection seems invalid
	 */
	saveCurrentSelection(force = false) {
		try {
			const selector = this.grid.sheet.selector;
			const range = selector.range;
			const { sri, sci, eri, eci } = range;

			if (sri !== undefined && sci !== undefined && sri !== -1 && sci !== -1) {
				this.lastSelection = {
					ri: sri,
					ci: sci,
					sri: sri,
					sci: sci,
					eri: eri !== undefined ? eri : sri,
					eci: eci !== undefined ? eci : sci
				};
				const cellCount = (this.lastSelection.eri - this.lastSelection.sri + 1) *
					(this.lastSelection.eci - this.lastSelection.sci + 1);
				console.log('[XlsxRibbon] Saved selection:', this.lastSelection, 'cells:', cellCount);
			} else if (force) {
				// Try to get from selector's ri/ci directly
				const ri = selector.ri;
				const ci = selector.ci;
				if (ri !== undefined && ri !== -1 && ci !== undefined && ci !== -1) {
					this.lastSelection = { ri, ci, sri: ri, sci: ci, eri: ri, eci: ci };
					console.log('[XlsxRibbon] Saved single cell selection:', this.lastSelection);
				}
			}
		} catch (e) {
			console.warn('[XlsxRibbon] Error saving selection:', e);
		}
	}

	/**
	 * Setup continuous selection tracking
	 * @private
	 */
	_setupSelectionTracking() {
		const spreadsheetEl = document.getElementById("x-spreadsheet-demo");
		if (!spreadsheetEl) return;

		// Track selection on mouse release (after drag selection is complete)
		spreadsheetEl.addEventListener("mouseup", (e) => {
			// Don't interfere with the event
			setTimeout(() => {
				this.saveCurrentSelection();
				this.scheduleRibbonStateUpdate();
			}, 50);
		});

		// Track during mouse drag for live selection feedback
		spreadsheetEl.addEventListener("mousemove", (e) => {
			// Only track if mouse button is pressed (dragging)
			if (e.buttons === 1) {
				// Debounce to avoid too many updates
				if (!this._dragDebounce) {
					this._dragDebounce = setTimeout(() => {
						this.saveCurrentSelection();
						this._dragDebounce = null;
					}, 100);
				}
			}
		});

		// Track selection on keyboard navigation (Shift+Arrow keys)
		spreadsheetEl.addEventListener("keyup", (e) => {
			if (e.key.startsWith('Arrow') || e.key === 'Tab' || e.key === 'Enter') {
				setTimeout(() => this.saveCurrentSelection(), 50);
			}
			// Handle Escape to exit edit mode
			if (e.key === 'Escape') {
				this._exitEditMode();
			}
			// Handle Delete/Backspace - clear _formula from selected cells
			if (e.key === 'Delete' || e.key === 'Backspace') {
				this._clearFormulaFromSelection();
			}
		});

		// Track on click (for single cell selection)
		spreadsheetEl.addEventListener("click", () => {
			setTimeout(() => this.saveCurrentSelection(), 50);
		});

		// Global Escape key handler to ensure we can always exit edit mode
		document.addEventListener("keydown", (e) => {
			if (e.key === 'Escape') {
				this._exitEditMode();
			}
		});
	}

	/**
	 * Exit formula entry mode without evaluating
	 * Cleans up incomplete formulas from the target cell
	 * @private
	 */
	_exitFormulaEntryMode() {
		console.log('[XlsxRibbon] Exiting formula entry mode');

		// Clean up incomplete formula from the target cell
		if (this.formulaTargetCell.ri !== -1 && this.formulaTargetCell.ci !== -1) {
			const { ri, ci } = this.formulaTargetCell;
			try {
				const sheetData = this.grid.sheet.data;
				const rows = sheetData.rows;
				if (rows._ && rows._[ri] && rows._[ri].cells && rows._[ri].cells[ci]) {
					const cell = rows._[ri].cells[ci];
					const text = cell.text || "";

					// If cell has an incomplete formula (no closing paren), clear it
					if (text.startsWith('=') && !text.endsWith(')')) {
						console.log('[XlsxRibbon] Clearing incomplete formula from cell:', text);
						cell.text = "";
						delete cell._formula;
						this.grid.sheet.data.setCellText(ri, ci, "", "finished");
						this.grid.reRender();
					}
					// Also clear _formula if it exists and is incomplete
					if (cell._formula && !cell._formula.endsWith(')')) {
						console.log('[XlsxRibbon] Clearing incomplete _formula:', cell._formula);
						delete cell._formula;
					}
				}
			} catch (e) {
				console.warn('[XlsxRibbon] Error cleaning up formula:', e);
			}
		}

		// Clear the formula bar if it has incomplete formula
		if (this.elements.formulaInput) {
			const formulaText = this.elements.formulaInput.value;
			if (formulaText.startsWith('=') && !formulaText.endsWith(')')) {
				this.elements.formulaInput.value = "";
			}
		}

		this.isFormulaEntryMode = false;
		this.isFormulaDragging = false;
		this.formulaDragStart = null;
		this.formulaTargetCell = { ri: -1, ci: -1 };
		this.formulaCursorPosition = 0;

		// Force update ribbon state
		this.scheduleRibbonStateUpdate();
	}

	/**
	 * Clear _formula property from all cells in the current selection
	 * Called when Delete/Backspace is pressed
	 * @private
	 */
	_clearFormulaFromSelection() {
		try {
			const range = this.grid.sheet.selector.range;
			const { sri, sci, eri, eci } = range;
			const sheetData = this.grid.sheet.data;
			const rows = sheetData.rows;

			if (!rows._) return;

			const endRow = eri !== undefined ? eri : sri;
			const endCol = eci !== undefined ? eci : sci;

			for (let r = sri; r <= endRow; r++) {
				for (let c = sci; c <= endCol; c++) {
					if (rows._[r] && rows._[r].cells && rows._[r].cells[c]) {
						const cell = rows._[r].cells[c];
						if (cell._formula) {
							console.log('[XlsxRibbon] Clearing _formula from cell', r, c);
							delete cell._formula;
						}
					}
				}
			}

			// Update formula bar to show empty
			this.scheduleRibbonStateUpdate();
		} catch (e) {
			console.warn('[XlsxRibbon] Error clearing formulas:', e);
		}
	}

	/**
	 * Exit edit mode and return focus to the spreadsheet
	 * @private
	 */
	_exitEditMode() {
		try {
			// Exit formula entry mode
			this._exitFormulaEntryMode();

			// Blur any active input
			if (document.activeElement && document.activeElement.tagName === 'INPUT') {
				document.activeElement.blur();
			}

			// Try to exit x-spreadsheet's edit mode if it has an internal editor
			if (this.grid && this.grid.sheet && this.grid.sheet.editor) {
				const editor = this.grid.sheet.editor;
				if (typeof editor.clear === 'function') {
					editor.clear();
				}
			}

			// Re-render to refresh the display
			this.grid.reRender();
			console.log('[XlsxRibbon] Exited edit mode');
		} catch (e) {
			console.warn('[XlsxRibbon] Error exiting edit mode:', e);
		}
	}

	// ==========================================
	// Style Management
	// ==========================================

	/**
	 * Set style for selected cells using x-spreadsheet's indexed style system
	 * @param {string} key - Style property key (e.g., 'font', 'color', 'align')
	 * @param {any} value - Style value
	 * @param {object} [optionalRange] - Optional range to apply style to
	 * @param {boolean} [saveHistory=true] - Whether to save state for undo
	 */
	setStyle(key, value, optionalRange, saveHistory = true) {
		let sri, sci, eri, eci;
		if (optionalRange) {
			({ sri, sci, eri, eci } = optionalRange);
		} else {
			({ sri, sci, eri, eci } = this.lastSelection);
		}

		// Save state for undo
		if (saveHistory && this.historyManager) {
			this.historyManager.saveState();
		}

		console.log('[XlsxRibbon] setStyle:', { key, value, range: { sri, sci, eri, eci } });

		// Validate range
		if (sri === -1 || sci === -1 || sri === undefined || sci === undefined) {
			console.warn('[XlsxRibbon] Invalid range, using current selector');
			const selector = this.grid.sheet.selector;
			({ sri, sci, eri, eci } = selector.range);
			if (sri === -1 || sci === -1) {
				console.warn('[XlsxRibbon] Still invalid range, aborting');
				return;
			}
		}

		const sheetData = this.grid.sheet.data;

		// Ensure styles array exists
		if (!sheetData.styles) {
			sheetData.styles = [];
		}
		const styles = sheetData.styles;

		// Access rows directly
		const rows = sheetData.rows;

		for (let r = sri; r <= eri; r++) {
			for (let c = sci; c <= eci; c++) {
				// Ensure row and cell exist
				if (!rows._) rows._ = {};
				if (!rows._[r]) rows._[r] = { cells: {} };
				if (!rows._[r].cells) rows._[r].cells = {};
				if (!rows._[r].cells[c]) rows._[r].cells[c] = {};

				const cell = rows._[r].cells[c];

				// Get current style (clone to avoid mutation)
				const currentStyleIndex = typeof cell.style === 'number' ? cell.style : undefined;
				let currentStyleObj = {};
				if (currentStyleIndex !== undefined && styles[currentStyleIndex]) {
					currentStyleObj = JSON.parse(JSON.stringify(styles[currentStyleIndex]));
				}

				// Merge new style
				let newStyleObj;
				if (key === "font") {
					const currentFont = currentStyleObj.font || {};
					newStyleObj = {
						...currentStyleObj,
						font: { ...currentFont, ...value }
					};
				} else {
					newStyleObj = {
						...currentStyleObj,
						[key]: value
					};
				}

				// Add to styles array and assign index
				const newStyleIndex = styles.length;
				styles.push(newStyleObj);
				cell.style = newStyleIndex;
			}
		}

		this.grid.reRender();
		this.onContentChanged();
	}

	/**
	 * Get the style object for a cell
	 * @param {number} ri - Row index
	 * @param {number} ci - Column index
	 * @returns {object} The style object or empty object
	 */
	getCellStyle(ri, ci) {
		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;
		const stylesArray = sheetData.styles || [];

		let cell = null;
		if (rows._ && rows._[ri] && rows._[ri].cells && rows._[ri].cells[ci]) {
			cell = rows._[ri].cells[ci];
		}

		if (cell && typeof cell.style === 'number') {
			const styleIndex = cell.style;
			if (styleIndex >= 0 && styleIndex < stylesArray.length) {
				return stylesArray[styleIndex] || {};
			}
		}

		return {};
	}

	// ==========================================
	// UI State Management
	// ==========================================

	/**
	 * Update ribbon UI to reflect current cell's style
	 */
	updateRibbonState() {
		const range = this.grid.sheet.selector.range;
		const { sri, sci } = range;
		const ri = sri;
		const ci = sci;

		if (ri === undefined || ci === undefined || ri === -1 || ci === -1) return;

		// Update cell name (A1, B2, etc.)
		// @ts-ignore
		const cellRef = XLSX.utils.encode_cell({ r: ri, c: ci });
		if (this.elements.cellName) {
			this.elements.cellName.textContent = cellRef;
		}

		// Update undo/redo button states
		this._updateUndoRedoButtons();

		// Get cell and style
		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;
		let cell = null;
		if (rows._ && rows._[ri] && rows._[ri].cells && rows._[ri].cells[ci]) {
			cell = rows._[ri].cells[ci];
		}

		const style = this.getCellStyle(ri, ci);

		// Update formula bar
		// Show cell text, or the original formula if text is a computed result
		if (this.elements.formulaInput) {
			// Don't update if user is currently typing in the formula bar OR in formula entry mode
			if (document.activeElement !== this.elements.formulaInput && !this.isFormulaEntryMode) {
				if (cell) {
					// Get actual cell text
					const cellText = cell.text || "";

					// ALWAYS clear _formula if cell is empty or has non-numeric content
					// _formula should only persist when cell shows a numeric result from a formula
					if (cell._formula) {
						const textIsNumeric = cellText !== "" && !isNaN(parseFloat(cellText));
						const formulaIsComplete = cell._formula.includes(')') && cell._formula.match(/^=\w+\([^)]+\)$/);

						if (!textIsNumeric || !formulaIsComplete) {
							console.log('[XlsxRibbon] Clearing stale _formula:', cell._formula, 'cellText:', cellText);
							delete cell._formula;
						}
					}

					// Now show what's appropriate
					let displayText = cellText;
					if (cell._formula && cellText !== "" && !cellText.startsWith('=')) {
						// Cell shows computed numeric value, display the formula
						displayText = cell._formula;
					}

					this.elements.formulaInput.value = displayText;
				} else {
					this.elements.formulaInput.value = "";
				}
			}
		}

		// Update toggle buttons
		this._updateToggleButton("btn-bold", style.font && style.font.bold);
		this._updateToggleButton("btn-italic", style.font && style.font.italic);
		this._updateToggleButton("btn-underline", style.underline);
		this._updateToggleButton("btn-strike", style.strike);

		// Update alignment buttons
		this._updateAlignButtons(style.align);

		// Update font dropdowns
		if (this.elements.fontFamily) {
			this.elements.fontFamily.value = (style.font && style.font.name) || "Helvetica";
		}
		if (this.elements.fontSize) {
			this.elements.fontSize.value = (style.font && style.font.size) || 10;
		}
	}

	/**
	 * Schedule a debounced ribbon state update
	 */
	scheduleRibbonStateUpdate() {
		if (this.ribbonStateDebounceTimer) {
			clearTimeout(this.ribbonStateDebounceTimer);
		}
		this.ribbonStateDebounceTimer = setTimeout(() => {
			this.updateRibbonState();
			this.ribbonStateDebounceTimer = null;
		}, this.RIBBON_STATE_DEBOUNCE_MS);
	}

	// ==========================================
	// Private Setup Methods
	// ==========================================

	/**
	 * Cache DOM element references
	 * @private
	 */
	_cacheElements() {
		this.elements = {
			cellName: document.getElementById("cell-name"),
			formulaInput: document.getElementById("formula-input"),
			fontFamily: document.getElementById("font-family"),
			fontSize: document.getElementById("font-size"),
			numberFormat: document.getElementById("number-format"),
			spreadsheet: document.getElementById("x-spreadsheet-demo"),
			btnUndo: document.getElementById("btn-undo"),
			btnRedo: document.getElementById("btn-redo")
		};
	}

	/**
	 * Setup tab switching
	 * @private
	 */
	_setupTabs() {
		const tabs = document.querySelectorAll(".ribbon-tab");
		tabs.forEach(tab => {
			tab.addEventListener("click", () => {
				document.querySelectorAll(".ribbon-tab").forEach(t => t.classList.remove("active"));
				document.querySelectorAll(".ribbon-panel").forEach(p => p.classList.remove("active"));

				tab.classList.add("active");
				const tabId = tab.getAttribute("data-tab");
				const panel = document.getElementById(`tab-${tabId}`);
				if (panel) panel.classList.add("active");
			});
		});
	}

	/**
	 * Setup file operations (save, print, export)
	 * @private
	 */
	_setupFileOperations() {
		const btnSave = document.getElementById("btn-save");
		const btnPrint = document.getElementById("btn-print");
		const btnExportPdf = document.getElementById("btn-export-pdf");

		if (btnSave) {
			btnSave.addEventListener("click", () => this.onSaveRequested());
		}
		if (btnPrint) {
			btnPrint.addEventListener("click", () => this.onPrintRequested());
		}
		if (btnExportPdf) {
			btnExportPdf.addEventListener("click", () => this.onExportPDFRequested());
		}
	}

	/**
	 * Setup clipboard operations (Cut, Copy, Paste)
	 * @private
	 */
	_setupClipboardOperations() {
		const btnCut = document.getElementById("btn-cut");
		const btnCopy = document.getElementById("btn-copy");
		const btnPaste = document.getElementById("btn-paste");

		if (btnCut) {
			btnCut.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this.clipboardManager.cut();
			});
		}

		if (btnCopy) {
			btnCopy.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.clipboardManager.copy();
			});
		}

		if (btnPaste) {
			btnPaste.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this.clipboardManager.paste(this.onContentChanged);
			});
		}
	}

	/**
	 * Setup history operations (Undo, Redo)
	 * @private
	 */
	_setupHistoryOperations() {
		const btnUndo = document.getElementById("btn-undo");
		const btnRedo = document.getElementById("btn-redo");

		if (btnUndo) {
			btnUndo.addEventListener("click", () => {
				this.historyManager.undo(this.onContentChanged);
				this.scheduleRibbonStateUpdate();
			});
		}

		if (btnRedo) {
			btnRedo.addEventListener("click", () => {
				this.historyManager.redo(this.onContentChanged);
				this.scheduleRibbonStateUpdate();
			});
		}
	}

	/**
	 * Setup number formatting operations
	 * @private
	 */
	_setupNumberFormatting() {
		const numberFormat = document.getElementById("number-format");
		const btnCurrency = document.getElementById("btn-currency");
		const btnPercent = document.getElementById("btn-percent");
		const btnComma = document.getElementById("btn-comma");
		const btnDecimalInc = document.getElementById("btn-decimal-inc");
		const btnDecimalDec = document.getElementById("btn-decimal-dec");

		if (numberFormat) {
			numberFormat.addEventListener("mousedown", () => this.saveCurrentSelection());
			numberFormat.addEventListener("change", (e) => {
				// @ts-ignore
				const format = e.target.value;
				this.historyManager.saveState();
				this.numberFormatManager.applyFormat(format, this.lastSelection, this.onContentChanged);
			});
		}

		if (btnCurrency) {
			btnCurrency.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this.numberFormatManager.applyFormat('currency', this.lastSelection, this.onContentChanged);
			});
		}

		if (btnPercent) {
			btnPercent.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this.numberFormatManager.applyFormat('percentage', this.lastSelection, this.onContentChanged);
			});
		}

		if (btnComma) {
			btnComma.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this.numberFormatManager.applyFormat('number', this.lastSelection, this.onContentChanged);
			});
		}

		if (btnDecimalInc) {
			btnDecimalInc.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this.numberFormatManager.increaseDecimals(this.lastSelection, this.onContentChanged);
			});
		}

		if (btnDecimalDec) {
			btnDecimalDec.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this.numberFormatManager.decreaseDecimals(this.lastSelection, this.onContentChanged);
			});
		}
	}

	/**
	 * Setup cell operations (Insert/Delete rows/columns)
	 * @private
	 */
	_setupCellOperations() {
		const btnInsertRow = document.getElementById("btn-insert-row");
		const btnInsertCol = document.getElementById("btn-insert-col");
		const btnDeleteRow = document.getElementById("btn-delete-row");
		const btnDeleteCol = document.getElementById("btn-delete-col");
		const btnClear = document.getElementById("btn-clear");

		if (btnInsertRow) {
			btnInsertRow.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this.cellOperationsManager.insertRow(true, this.onContentChanged);
			});
		}

		if (btnInsertCol) {
			btnInsertCol.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this.cellOperationsManager.insertColumn(true, this.onContentChanged);
			});
		}

		if (btnDeleteRow) {
			btnDeleteRow.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this.cellOperationsManager.deleteRow(this.onContentChanged);
			});
		}

		if (btnDeleteCol) {
			btnDeleteCol.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this.cellOperationsManager.deleteColumn(this.onContentChanged);
			});
		}

		if (btnClear) {
			btnClear.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this._clearSelectedCells();
			});
		}

		// Sort buttons
		const btnSortAsc = document.getElementById("btn-sort-asc");
		const btnSortDesc = document.getElementById("btn-sort-desc");

		if (btnSortAsc) {
			btnSortAsc.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this._sortColumn(true);
			});
		}

		if (btnSortDesc) {
			btnSortDesc.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this._sortColumn(false);
			});
		}
	}

	/**
	 * Sort column based on selection
	 * @private
	 * @param {boolean} ascending - Sort ascending (true) or descending (false)
	 */
	_sortColumn(ascending) {
		const { sri, sci, eri } = this.lastSelection;
		if (sri === -1 || sci === -1) return;

		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		if (!rows._) return;

		// Collect data from the column
		const columnData = [];
		for (let r = sri; r <= eri; r++) {
			let value = '';
			let rowData = rows._[r];
			if (rowData && rowData.cells && rowData.cells[sci]) {
				value = rowData.cells[sci].text || '';
			}
			columnData.push({ row: r, value: value, rowData: rowData });
		}

		// Sort the data
		columnData.sort((a, b) => {
			const aNum = parseFloat(a.value);
			const bNum = parseFloat(b.value);

			// Compare as numbers if both are numeric
			if (!isNaN(aNum) && !isNaN(bNum)) {
				return ascending ? aNum - bNum : bNum - aNum;
			}

			// Otherwise compare as strings
			const comparison = a.value.localeCompare(b.value);
			return ascending ? comparison : -comparison;
		});

		// Reorder the rows
		const newRows = {};
		for (let i = 0; i < columnData.length; i++) {
			const targetRow = sri + i;
			const sourceData = columnData[i].rowData;
			if (sourceData) {
				newRows[targetRow] = JSON.parse(JSON.stringify(sourceData));
			}
		}

		// Apply the sorted order
		for (let r = sri; r <= eri; r++) {
			if (newRows[r]) {
				rows._[r] = newRows[r];
			}
		}

		this.grid.reRender();
		this.onContentChanged();
		console.log('[XlsxRibbon] Column sorted', ascending ? 'ascending' : 'descending');
	}

	/**
	 * Clear content from selected cells
	 * @private
	 */
	_clearSelectedCells() {
		const { sri, sci, eri, eci } = this.lastSelection;
		if (sri === -1 || sci === -1) return;

		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		for (let r = sri; r <= eri; r++) {
			for (let c = sci; c <= eci; c++) {
				if (rows._ && rows._[r] && rows._[r].cells && rows._[r].cells[c]) {
					rows._[r].cells[c].text = '';
					delete rows._[r].cells[c]._formula;
					delete rows._[r].cells[c]._numberFormat;
				}
			}
		}

		this.grid.reRender();
		this.onContentChanged();
		console.log('[XlsxRibbon] Cleared cells in range');
	}

	/**
	 * Setup font styling buttons and dropdowns
	 * @private
	 */
	_setupFontStyling() {
		// Toggle buttons
		this._bindToggleButton("btn-bold", "bold");
		this._bindToggleButton("btn-italic", "italic");
		this._bindToggleButton("btn-underline", "underline");
		this._bindToggleButton("btn-strike", "strike");

		// Font family dropdown
		const fontFamily = this.elements.fontFamily;
		if (fontFamily) {
			fontFamily.addEventListener("mousedown", () => this.saveCurrentSelection());
			fontFamily.addEventListener("focus", () => this.saveCurrentSelection());
			fontFamily.addEventListener("change", (e) => {
				// @ts-ignore
				const fontName = e.target.value;
				const { sri, sci, eri, eci } = this.lastSelection;
				this.setStyle("font", { name: fontName }, { sri, sci, eri, eci });
			});
		}

		// Font size dropdown
		const fontSize = this.elements.fontSize;
		if (fontSize) {
			fontSize.addEventListener("mousedown", () => this.saveCurrentSelection());
			fontSize.addEventListener("focus", () => this.saveCurrentSelection());
			fontSize.addEventListener("change", (e) => {
				// @ts-ignore
				const size = parseInt(e.target.value);
				const { sri, sci, eri, eci } = this.lastSelection;
				this.setStyle("font", { size }, { sri, sci, eri, eci });
			});
		}
	}

	/**
	 * Setup alignment buttons
	 * @private
	 */
	_setupAlignment() {
		const alignLeft = document.getElementById("btn-align-left");
		const alignCenter = document.getElementById("btn-align-center");
		const alignRight = document.getElementById("btn-align-right");

		if (alignLeft) {
			alignLeft.addEventListener("click", () => this.setStyle("align", "left"));
		}
		if (alignCenter) {
			alignCenter.addEventListener("click", () => this.setStyle("align", "center"));
		}
		if (alignRight) {
			alignRight.addEventListener("click", () => this.setStyle("align", "right"));
		}
	}

	/**
	 * Setup color pickers
	 * @private
	 */
	_setupColorPickers() {
		this._initColorPicker("text-color-picker", "btn-text-color", "text-color-indicator", (color) => {
			const { sri, sci, eri, eci } = this.lastSelection;
			this.setStyle("color", color, { sri, sci, eri, eci });
		});

		this._initColorPicker("fill-color-picker", "btn-fill-color", "fill-color-indicator", (color) => {
			const { sri, sci, eri, eci } = this.lastSelection;
			this.setStyle("bgcolor", color, { sri, sci, eri, eci });
		});
	}

	/**
	 * Initialize a color picker
	 * @private
	 */
	_initColorPicker(pickerId, btnId, indicatorId, onSelect) {
		const picker = document.getElementById(pickerId);
		const btn = document.getElementById(btnId);
		const indicator = document.getElementById(indicatorId);

		if (!picker || !btn) return;

		// Populate colors
		this.COLORS.forEach(color => {
			const swatch = document.createElement("div");
			swatch.className = "color-swatch";
			swatch.style.backgroundColor = color;
			swatch.addEventListener("click", (e) => {
				e.stopPropagation();
				onSelect(color);
				if (indicator) indicator.style.backgroundColor = color;
				picker.classList.remove("show");
			});
			picker.appendChild(swatch);
		});

		// Toggle popup
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			this.saveCurrentSelection();
			document.querySelectorAll(".color-picker-popup").forEach(p => {
				if (p.id !== pickerId) p.classList.remove("show");
			});
			picker.classList.toggle("show");
		});

		// Close on click outside
		document.addEventListener("click", () => {
			picker.classList.remove("show");
		});
	}

	/**
	 * Setup formula buttons
	 * @private
	 */
	_setupFormulas() {
		const formulas = ['SUM', 'AVERAGE', 'COUNT', 'MIN', 'MAX'];
		formulas.forEach(formula => {
			const btn = document.getElementById(`btn-${formula.toLowerCase()}`);
			if (btn) {
				// Save selection BEFORE the click steals focus
				btn.addEventListener("mousedown", () => this.saveCurrentSelection());
				btn.addEventListener("click", () => this._insertFormula(formula));
			}
		});
	}

	/**
	 * Insert a formula into the cell below the selected range (Excel-like behavior)
	 * @private
	 */
	_insertFormula(formulaName) {
		const { sri, sci, eri, eci } = this.lastSelection;
		if (sri === -1 || sci === -1) {
			console.warn('[XlsxRibbon] No cell selected for formula');
			return;
		}

		// @ts-ignore
		const startCell = XLSX.utils.encode_cell({ r: sri, c: sci });
		// @ts-ignore
		const endCell = XLSX.utils.encode_cell({ r: eri, c: eci });

		// Determine target cell for formula insertion
		let targetRow, targetCol;
		let formula;
		let needsCellPicking = false;

		if (sri === eri && sci === eci) {
			// Single cell selected - insert empty formula and enable cell picking
			targetRow = sri;
			targetCol = sci;
			formula = `=${formulaName}(`;  // Leave open for user to pick cells
			needsCellPicking = true;
			console.log('[XlsxRibbon] Single cell - enabling cell picking mode');
		} else {
			// Range selected - insert complete formula with range
			targetRow = eri + 1;
			targetCol = sci;
			formula = `=${formulaName}(${startCell}:${endCell})`;
		}

		console.log(`[XlsxRibbon] Inserting formula: ${formula} at row ${targetRow}, col ${targetCol}`);

		// Move selection to the target cell first
		this.grid.sheet.selector.set(targetRow, targetCol);

		if (needsCellPicking) {
			// Enable formula entry mode for cell picking
			this.isFormulaEntryMode = true;
			this.formulaCursorPosition = formula.length;  // Cursor at end (inside parentheses)
			// Store the target cell so we know where to update the formula
			this.formulaTargetCell = { ri: targetRow, ci: targetCol };

			console.log('[XlsxRibbon] Setting up formula entry mode:', {
				targetRow,
				targetCol,
				formula,
				formulaTargetCell: this.formulaTargetCell
			});

			// Force set the formula in the cell
			const sheetData = this.grid.sheet.data;
			if (!sheetData.rows._) sheetData.rows._ = {};
			if (!sheetData.rows._[targetRow]) sheetData.rows._[targetRow] = { cells: {} };
			if (!sheetData.rows._[targetRow].cells) sheetData.rows._[targetRow].cells = {};
			if (!sheetData.rows._[targetRow].cells[targetCol]) sheetData.rows._[targetRow].cells[targetCol] = {};

			// Set the cell text directly
			sheetData.rows._[targetRow].cells[targetCol].text = formula;

			// Also use the API
			this.grid.sheet.data.setCellText(targetRow, targetCol, formula, "input");
			this.grid.reRender();

			// Focus the formula bar so user can click cells to add references
			if (this.elements.formulaInput) {
				this.elements.formulaInput.value = formula;
				this.elements.formulaInput.focus();
				// Position cursor at the end (inside the parentheses)
				this.elements.formulaInput.setSelectionRange(formula.length, formula.length);
			}

			console.log('[XlsxRibbon] Formula entry mode enabled - click cells to add references, then type ) and press Enter');
			console.log('[XlsxRibbon] Cell now contains:', sheetData.rows._[targetRow].cells[targetCol].text);
		} else {
			// Complete formula with range - evaluate immediately
			this.grid.sheet.data.setCellText(targetRow, targetCol, formula, "finished");
			this.grid.reRender();

			// Evaluate the formula
			const rangeStart = { r: sri, c: sci };
			const rangeEnd = { r: eri, c: eci };
			setTimeout(() => {
				this._ensureFormulaEvaluated(targetRow, targetCol, formulaName, rangeStart, rangeEnd, formula);
			}, 50);

			// Update formula bar
			if (this.elements.formulaInput) {
				this.elements.formulaInput.value = formula;
			}
		}

		// Update cell name display
		// @ts-ignore
		if (this.elements.cellName) {
			// @ts-ignore
			this.elements.cellName.textContent = XLSX.utils.encode_cell({ r: targetRow, c: targetCol });
		}

		this.onContentChanged();
	}

	/**
	 * Ensure a formula is evaluated - if x-spreadsheet didn't evaluate it, compute manually
	 * @private
	 */
	_ensureFormulaEvaluated(targetRow, targetCol, formulaName, rangeStart, rangeEnd, formula) {
		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		// Ensure cell exists
		if (!rows._) rows._ = {};
		if (!rows._[targetRow]) rows._[targetRow] = { cells: {} };
		if (!rows._[targetRow].cells) rows._[targetRow].cells = {};
		if (!rows._[targetRow].cells[targetCol]) rows._[targetRow].cells[targetCol] = {};

		const cell = rows._[targetRow].cells[targetCol];

		// Check if the cell text still shows the raw formula
		// x-spreadsheet should have replaced it with the evaluated result
		if (cell.text && cell.text.startsWith('=')) {
			console.log('[XlsxRibbon] x-spreadsheet did not evaluate formula, computing manually...');

			// Compute the result ourselves
			const result = this._evaluateFormula(formulaName, rangeStart.r, rangeStart.c, rangeEnd.r, rangeEnd.c);

			if (result !== null) {
				// Store the formula in a custom property for the formula bar
				cell._formula = formula;
				// Display the computed result
				cell.text = result.toString();

				console.log(`[XlsxRibbon] Formula ${formula} = ${result}`);

				// Re-render to show the result
				this.grid.reRender();

				// Update formula bar to still show the formula
				if (this.elements.formulaInput) {
					this.elements.formulaInput.value = formula;
				}
			}
		}
	}

	/**
	 * Evaluate a formula by computing the result from the source range
	 * @private
	 * @param {string} formulaName - The formula name (SUM, AVERAGE, etc.)
	 * @param {number} sri - Start row index
	 * @param {number} sci - Start column index
	 * @param {number} eri - End row index
	 * @param {number} eci - End column index
	 * @returns {number|null} The computed result or null if cannot compute
	 */
	_evaluateFormula(formulaName, sri, sci, eri, eci) {
		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		// Collect numeric values from the range
		const values = [];
		for (let r = sri; r <= eri; r++) {
			for (let c = sci; c <= eci; c++) {
				let cellValue = null;
				if (rows._ && rows._[r] && rows._[r].cells && rows._[r].cells[c]) {
					const text = rows._[r].cells[c].text;
					if (text !== undefined && text !== '' && !isNaN(parseFloat(text))) {
						cellValue = parseFloat(text);
					}
				}
				if (cellValue !== null) {
					values.push(cellValue);
				}
			}
		}

		if (values.length === 0) return 0;

		// Calculate result based on formula type
		switch (formulaName.toUpperCase()) {
			case 'SUM':
				return values.reduce((a, b) => a + b, 0);
			case 'AVERAGE':
				return values.reduce((a, b) => a + b, 0) / values.length;
			case 'COUNT':
				return values.length;
			case 'MIN':
				return Math.min(...values);
			case 'MAX':
				return Math.max(...values);
			default:
				return null;
		}
	}

	/**
	 * Setup merge button
	 * @private
	 */
	_setupMerge() {
		const btnMerge = document.getElementById("btn-merge");
		if (btnMerge) {
			btnMerge.addEventListener("click", () => {
				this.saveCurrentSelection();
				this._toggleMergeCells();
			});
		}

		const btnWrapText = document.getElementById("btn-wrap-text");
		if (btnWrapText) {
			btnWrapText.addEventListener("click", () => {
				this.saveCurrentSelection();
				this.historyManager.saveState();
				this._toggleWrapText();
			});
		}
	}

	/**
	 * Toggle merge for selected cells
	 * @private
	 */
	_toggleMergeCells() {
		const { sri, sci, eri, eci } = this.lastSelection;
		if (sri === -1 || sci === -1) {
			console.warn('[XlsxRibbon] No cells selected for merge');
			return;
		}

		// Need at least 2 cells to merge
		if (sri === eri && sci === eci) {
			console.log('[XlsxRibbon] Cannot merge single cell');
			return;
		}

		this.historyManager.saveState();

		const sheetData = this.grid.sheet.data;

		// Initialize merges array if not exists
		if (!sheetData.merges) {
			sheetData.merges = [];
		}

		// Check if current selection is already merged
		const mergeKey = `${sri}_${sci}_${eri}_${eci}`;
		const existingMergeIndex = sheetData.merges.findIndex(m => {
			return m.sri === sri && m.sci === sci && m.eri === eri && m.eci === eci;
		});

		if (existingMergeIndex !== -1) {
			// Unmerge
			sheetData.merges.splice(existingMergeIndex, 1);
			console.log('[XlsxRibbon] Unmerged cells');
		} else {
			// Merge - store the merge range
			sheetData.merges.push({
				sri: sri,
				sci: sci,
				eri: eri,
				eci: eci
			});

			// Copy value from top-left cell to merged cell
			const rows = sheetData.rows;
			let mergedValue = '';
			if (rows._ && rows._[sri] && rows._[sri].cells && rows._[sri].cells[sci]) {
				mergedValue = rows._[sri].cells[sci].text || '';
			}

			// Clear other cells in the merge range
			for (let r = sri; r <= eri; r++) {
				for (let c = sci; c <= eci; c++) {
					if (r === sri && c === sci) continue; // Keep top-left
					if (rows._ && rows._[r] && rows._[r].cells && rows._[r].cells[c]) {
						rows._[r].cells[c].text = '';
						delete rows._[r].cells[c]._formula;
					}
				}
			}

			console.log('[XlsxRibbon] Merged cells:', mergeKey);
		}

		this.grid.reRender();
		this.onContentChanged();
	}

	/**
	 * Toggle text wrap for selected cells
	 * @private
	 */
	_toggleWrapText() {
		const { sri, sci, eri, eci } = this.lastSelection;
		if (sri === -1 || sci === -1) return;

		const style = this.getCellStyle(sri, sci);
		const currentWrap = style.textwrap || false;

		this.setStyle('textwrap', !currentWrap, this.lastSelection);
		console.log('[XlsxRibbon] Text wrap toggled to:', !currentWrap);
	}

	/**
	 * Setup view options
	 * @private
	 */
	_setupViewOptions() {
		const chkGridlines = document.getElementById("chk-gridlines");
		const chkHeaders = document.getElementById("chk-headers");
		const btnFreezePanes = document.getElementById("btn-freeze-panes");

		if (chkGridlines) {
			chkGridlines.addEventListener("change", (e) => {
				// @ts-ignore
				const show = e.target.checked;
				this._toggleGridlines(show);
			});
		}

		if (chkHeaders) {
			chkHeaders.addEventListener("change", (e) => {
				// @ts-ignore
				const show = e.target.checked;
				this._toggleHeaders(show);
			});
		}

		if (btnFreezePanes) {
			btnFreezePanes.addEventListener("click", () => {
				this.saveCurrentSelection();
				this._toggleFreezePanes();
			});
		}
	}

	/**
	 * Toggle gridlines visibility
	 * @private
	 */
	_toggleGridlines(show) {
		const container = document.getElementById('x-spreadsheet-demo');
		if (container) {
			if (show) {
				container.classList.remove('hide-gridlines');
			} else {
				container.classList.add('hide-gridlines');
			}
			console.log('[XlsxRibbon] Gridlines', show ? 'shown' : 'hidden');
		}
	}

	/**
	 * Toggle row/column headers visibility
	 * @private
	 */
	_toggleHeaders(show) {
		const container = document.getElementById('x-spreadsheet-demo');
		if (container) {
			if (show) {
				container.classList.remove('hide-headers');
			} else {
				container.classList.add('hide-headers');
			}
			console.log('[XlsxRibbon] Headers', show ? 'shown' : 'hidden');
		}
	}

	/**
	 * Toggle freeze panes at current selection
	 * @private
	 */
	_toggleFreezePanes() {
		const { sri, sci } = this.lastSelection;
		if (sri === -1 || sci === -1) {
			console.log('[XlsxRibbon] No cell selected for freeze');
			return;
		}

		const sheetData = this.grid.sheet.data;

		// Toggle freeze at selection
		if (sheetData.freeze && sheetData.freeze[0] === sri && sheetData.freeze[1] === sci) {
			// Unfreeze
			delete sheetData.freeze;
			console.log('[XlsxRibbon] Panes unfrozen');
		} else {
			// Freeze at current row/column
			sheetData.freeze = [sri, sci];
			console.log('[XlsxRibbon] Panes frozen at row', sri, 'col', sci);
		}

		this.grid.reRender();
	}

	/**
	 * Setup formula bar
	 * @private
	 */
	_setupFormulaBar() {
		const formulaInput = this.elements.formulaInput;
		const spreadsheet = this.elements.spreadsheet;

		if (formulaInput) {
			// Track which cell we're editing
			let editingCell = { ri: -1, ci: -1 };

			// Handle formula input changes - update cell but don't evaluate yet
			formulaInput.addEventListener("input", (e) => {
				// @ts-ignore
				const text = e.target.value;

				// Detect formula entry mode
				this.isFormulaEntryMode = text.startsWith('=');
				this.formulaCursorPosition = formulaInput.selectionStart;

				// Use stored target cell if available, otherwise use current selection
				let targetRi = this.formulaTargetCell.ri;
				let targetCi = this.formulaTargetCell.ci;

				if (targetRi === -1 || targetCi === -1) {
					const range = this.grid.sheet.selector.range;
					targetRi = range.sri;
					targetCi = range.sci;

					// Store as editing cell if not in formula entry mode yet
					if (targetRi !== -1 && targetCi !== -1) {
						editingCell = { ri: targetRi, ci: targetCi };
						// Also set as formula target cell if starting a formula
						if (text.startsWith('=')) {
							this.formulaTargetCell = { ri: targetRi, ci: targetCi };
						}
					}
				}

				if (targetRi !== -1 && targetCi !== -1) {
					// Update the cell text
					const sheetData = this.grid.sheet.data;
					if (!sheetData.rows._) sheetData.rows._ = {};
					if (!sheetData.rows._[targetRi]) sheetData.rows._[targetRi] = { cells: {} };
					if (!sheetData.rows._[targetRi].cells) sheetData.rows._[targetRi].cells = {};
					if (!sheetData.rows._[targetRi].cells[targetCi]) sheetData.rows._[targetRi].cells[targetCi] = {};

					sheetData.rows._[targetRi].cells[targetCi].text = text;
					this.grid.sheet.data.setCellText(targetRi, targetCi, text, "input");
					this.grid.reRender();
				}
			});

			// Track cursor position changes
			formulaInput.addEventListener("click", () => {
				this.formulaCursorPosition = formulaInput.selectionStart;
			});
			formulaInput.addEventListener("keyup", () => {
				this.formulaCursorPosition = formulaInput.selectionStart;
			});

			// Handle blur - commit formula evaluation asynchronously to not block click
			formulaInput.addEventListener("blur", (e) => {
				// @ts-ignore
				const text = e.target.value;

				// Save cursor position before blur
				this.formulaCursorPosition = formulaInput.selectionStart;

				// Short delay to check if we're picking a cell for formula
				setTimeout(() => {
					// If we're actively dragging for formula reference, don't do anything
					if (this.isFormulaDragging) {
						console.log('[XlsxRibbon] Still dragging, keeping formula mode');
						return;
					}

					// Get target cell from stored target or editing cell
					let targetRi = this.formulaTargetCell.ri;
					let targetCi = this.formulaTargetCell.ci;
					if (targetRi === -1 || targetCi === -1) {
						targetRi = editingCell.ri;
						targetCi = editingCell.ci;
					}

					// Evaluate formula if complete (ends with parenthesis)
					if (targetRi !== -1 && targetCi !== -1 && text.startsWith('=') && text.endsWith(')')) {
						console.log('[XlsxRibbon] Formula complete, evaluating');
						this._evaluateFormulaFromText(targetRi, targetCi, text);
						this._exitFormulaEntryMode();
						editingCell = { ri: -1, ci: -1 };
					}
					// If formula bar is no longer focused and not dragging, exit formula mode
					else if (document.activeElement !== formulaInput && !this.isFormulaDragging) {
						console.log('[XlsxRibbon] Formula bar lost focus, exiting formula mode');
						this._exitFormulaEntryMode();
						editingCell = { ri: -1, ci: -1 };
					}
				}, 100);
			});

			// Handle Enter key to commit formula and evaluate
			formulaInput.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					// @ts-ignore
					const text = e.target.value;

					// Use the stored formula target cell, or editing cell, or current selection
					let ri = this.formulaTargetCell.ri;
					let ci = this.formulaTargetCell.ci;
					if (ri === -1 || ci === -1) {
						ri = editingCell.ri;
						ci = editingCell.ci;
					}
					if (ri === -1 || ci === -1) {
						const range = this.grid.sheet.selector.range;
						ri = range.sri;
						ci = range.sci;
					}

					// Exit formula entry mode
					this.isFormulaEntryMode = false;
					this.isFormulaDragging = false;
					this.formulaDragStart = null;
					this.formulaTargetCell = { ri: -1, ci: -1 };

					if (ri !== -1 && ci !== -1) {
						if (text.startsWith('=')) {
							// Evaluate the formula immediately
							this._evaluateFormulaFromText(ri, ci, text);
						} else {
							// Regular text - just set it
							this.grid.sheet.data.setCellText(ri, ci, text, "finished");
							this.grid.reRender();
							this.onContentChanged();
						}

						// Move to next row (Excel-like behavior)
						this.grid.sheet.selector.set(ri + 1, ci);
					}

					// Reset editing cell and blur the input
					editingCell = { ri: -1, ci: -1 };
					formulaInput.blur();
					this.grid.reRender();
					this.scheduleRibbonStateUpdate();
				}
			});
		}

		// Update ribbon state on selection change
		if (spreadsheet) {
			spreadsheet.addEventListener("click", () => {
				this.scheduleRibbonStateUpdate();
				// Check if selected cell has a formula that needs re-evaluation
				setTimeout(() => this._checkSelectedCellFormula(), 100);
			});

			spreadsheet.addEventListener("keyup", (e) => {
				this.scheduleRibbonStateUpdate();

				// When Enter is pressed in the spreadsheet, evaluate any formula in the cell
				if (e.key === "Enter") {
					setTimeout(() => this.evaluateCurrentCellFormula(), 50);
				}

				// Sync formula bar with cell content during typing
				this._syncFormulaBarWithCell();
			});

			// Also sync on keydown for immediate feedback
			spreadsheet.addEventListener("keydown", () => {
				setTimeout(() => this._syncFormulaBarWithCell(), 10);
			});

			// Sync on input events within the spreadsheet
			spreadsheet.addEventListener("input", () => {
				this._syncFormulaBarWithCell();
			}, true);

			// Also catch when focus returns to the spreadsheet
			spreadsheet.addEventListener("focus", () => {
				setTimeout(() => this.scheduleRibbonStateUpdate(), 50);
			}, true);
		}
	}

	/**
	 * Sync the formula bar with the content being typed in the cell
	 * @private
	 */
	_syncFormulaBarWithCell() {
		// Check if x-spreadsheet has an active editor
		if (this.grid && this.grid.sheet && this.grid.sheet.editor) {
			const editor = this.grid.sheet.editor;
			// Try to get the editor's input element
			const editorEl = editor.el ? editor.el.el : null;
			if (editorEl) {
				const textarea = editorEl.querySelector('textarea');
				if (textarea && document.activeElement === textarea) {
					// User is typing in cell - sync to formula bar
					const text = textarea.value;
					if (this.elements.formulaInput && document.activeElement !== this.elements.formulaInput) {
						this.elements.formulaInput.value = text;
					}
				}
			}
		}
	}

	/**
	 * Setup point-and-click formula building
	 * Allows users to click on cells while typing a formula to insert cell references
	 * @private
	 */
	_setupFormulaReferencePicking() {
		const spreadsheetEl = document.getElementById("x-spreadsheet-demo");
		if (!spreadsheetEl) return;

		console.log('[XlsxRibbon] Setting up formula reference picking');

		// Intercept mousedown on spreadsheet when in formula entry mode
		spreadsheetEl.addEventListener("mousedown", (e) => {
			const formulaInput = this.elements.formulaInput;

			// ONLY intercept clicks if:
			// 1. We have a stored target cell (meaning we explicitly started building a formula via button)
			// 2. AND the formula bar is currently focused
			const hasTargetCell = this.formulaTargetCell.ri !== -1 && this.formulaTargetCell.ci !== -1;
			const isFormulaBarFocused = document.activeElement === formulaInput;

			// Must have BOTH conditions - target cell stored AND formula bar focused
			if (hasTargetCell && isFormulaBarFocused && this.isFormulaEntryMode) {
				const text = formulaInput ? formulaInput.value : '';
				const cursorPos = this.formulaCursorPosition || text.length;
				const charBefore = cursorPos > 0 ? text.charAt(cursorPos - 1) : '=';

				// Cell reference is expected after: = ( + - * / , :
				const expectingRef = /[=\(\+\-\*\/,:\s]/.test(charBefore);

				if (expectingRef) {
					// Prevent default cell selection behavior
					e.stopImmediatePropagation();
					e.preventDefault();

					// Get clicked cell coordinates
					const clickedCell = this._getCellFromMouseEvent(e);
					if (clickedCell) {
						this.formulaDragStart = clickedCell;
						this.isFormulaDragging = true;
						console.log('[XlsxRibbon] Formula pick started at:', clickedCell);
					}
				} else {
					// Not expecting a reference, allow normal click and exit formula mode
					console.log('[XlsxRibbon] Not expecting cell ref, exiting formula mode');
					this._exitFormulaEntryMode();
				}
			} else if (hasTargetCell && !isFormulaBarFocused) {
				// User clicked away while formula bar was not focused - exit formula mode
				console.log('[XlsxRibbon] Clicked away from formula bar, exiting formula mode');
				this._exitFormulaEntryMode();
			}
		}, true);  // Use capture phase to intercept before x-spreadsheet

		// Track drag for range selection
		spreadsheetEl.addEventListener("mousemove", (e) => {
			if (this.isFormulaDragging && this.formulaDragStart) {
				const currentCell = this._getCellFromMouseEvent(e);
				if (currentCell) {
					// Could add visual highlight here
					this._updateFormulaRangePreview(this.formulaDragStart, currentCell);
				}
			}
		});

		// Complete selection on mouseup
		spreadsheetEl.addEventListener("mouseup", (e) => {
			if (this.isFormulaDragging && this.formulaDragStart) {
				const dragEnd = this._getCellFromMouseEvent(e);
				if (dragEnd) {
					if (this.formulaDragStart.row === dragEnd.row &&
						this.formulaDragStart.col === dragEnd.col) {
						// Single cell reference
						this._insertCellReference(this.formulaDragStart.row, this.formulaDragStart.col);
					} else {
						// Range reference
						this._insertRangeReference(this.formulaDragStart, dragEnd);
					}
				}

				// Reset drag state but KEEP formula entry mode active
				this.formulaDragStart = null;
				this.isFormulaDragging = false;
				this._clearFormulaRangePreview();

				// Return focus to formula bar so user can continue building formula
				const formulaInput = this.elements.formulaInput;
				if (formulaInput) {
					// Small delay to ensure focus works
					setTimeout(() => {
						formulaInput.focus();
						// Position cursor at the end of current text
						const newPos = formulaInput.value.length;
						this.formulaCursorPosition = newPos;
						formulaInput.setSelectionRange(newPos, newPos);
						console.log('[XlsxRibbon] Focus returned to formula bar, cursor at:', newPos);
					}, 10);
				}
			}
		});
	}

	/**
	 * Get cell coordinates from mouse event
	 * x-spreadsheet uses canvas, so we calculate from mouse position
	 * @private
	 */
	_getCellFromMouseEvent(e) {
		try {
			const sheetEl = this.grid.sheet.el.el;
			const rect = sheetEl.getBoundingClientRect();
			const x = e.clientX - rect.left;
			const y = e.clientY - rect.top;

			const data = this.grid.sheet.data;

			// Get index column width and header height
			const indexWidth = (data.cols && data.cols.indexWidth) || 60;
			const headerHeight = (data.rows && data.rows.height) || 25;

			// Skip if clicking on row/column headers
			if (x < indexWidth || y < headerHeight) {
				return null;
			}

			// Calculate column from x position
			let col = -1;
			let accX = indexWidth;
			const defaultColWidth = (data.cols && data.cols.width) || 100;
			const numCols = (data.cols && data.cols.len) || 26;

			for (let c = 0; c < numCols; c++) {
				const colData = data.cols._ && data.cols._[c];
				const colWidth = (colData && colData.width) || defaultColWidth;
				if (x >= accX && x < accX + colWidth) {
					col = c;
					break;
				}
				accX += colWidth;
			}

			// Calculate row from y position
			let row = -1;
			let accY = headerHeight;
			const defaultRowHeight = (data.rows && data.rows.height) || 25;
			const numRows = (data.rows && data.rows.len) || 100;

			for (let r = 0; r < numRows; r++) {
				const rowData = data.rows._ && data.rows._[r];
				const rowHeight = (rowData && rowData.height) || defaultRowHeight;
				if (y >= accY && y < accY + rowHeight) {
					row = r;
					break;
				}
				accY += rowHeight;
			}

			if (row >= 0 && col >= 0) {
				return { row, col };
			}
			return null;
		} catch (err) {
			console.warn('[XlsxRibbon] Error getting cell from mouse event:', err);
			return null;
		}
	}

	/**
	 * Insert a cell reference at the current cursor position in the formula bar
	 * @private
	 */
	_insertCellReference(row, col) {
		// @ts-ignore
		const cellRef = XLSX.utils.encode_cell({ r: row, c: col });
		this._insertTextAtCursor(cellRef);
		console.log('[XlsxRibbon] Inserted cell reference:', cellRef);
	}

	/**
	 * Insert a range reference at the current cursor position in the formula bar
	 * @private
	 */
	_insertRangeReference(start, end) {
		// Normalize range (start should be top-left, end should be bottom-right)
		const minRow = Math.min(start.row, end.row);
		const maxRow = Math.max(start.row, end.row);
		const minCol = Math.min(start.col, end.col);
		const maxCol = Math.max(start.col, end.col);

		// @ts-ignore
		const startRef = XLSX.utils.encode_cell({ r: minRow, c: minCol });
		// @ts-ignore
		const endRef = XLSX.utils.encode_cell({ r: maxRow, c: maxCol });
		const rangeRef = `${startRef}:${endRef}`;

		this._insertTextAtCursor(rangeRef);
		console.log('[XlsxRibbon] Inserted range reference:', rangeRef);
	}

	/**
	 * Insert text at the current cursor position in the formula bar
	 * @private
	 */
	_insertTextAtCursor(text) {
		const formulaInput = this.elements.formulaInput;
		if (!formulaInput) return;

		const currentValue = formulaInput.value;
		const cursorPos = this.formulaCursorPosition;

		// Insert text at cursor position
		const newValue = currentValue.slice(0, cursorPos) + text + currentValue.slice(cursorPos);

		console.log('[XlsxRibbon] _insertTextAtCursor:', {
			text,
			currentValue,
			cursorPos,
			newValue,
			targetCell: this.formulaTargetCell
		});

		// Update formula bar first
		formulaInput.value = newValue;

		// Update cursor position to after the inserted text
		const newCursorPos = cursorPos + text.length;
		this.formulaCursorPosition = newCursorPos;

		// Update the STORED target cell (not the current selector, which may have changed)
		const { ri, ci } = this.formulaTargetCell;
		if (ri !== -1 && ci !== -1) {
			// Force update the cell data
			const sheetData = this.grid.sheet.data;

			// Ensure the row and cell exist
			if (!sheetData.rows._) sheetData.rows._ = {};
			if (!sheetData.rows._[ri]) sheetData.rows._[ri] = { cells: {} };
			if (!sheetData.rows._[ri].cells) sheetData.rows._[ri].cells = {};
			if (!sheetData.rows._[ri].cells[ci]) sheetData.rows._[ri].cells[ci] = {};

			// Set the cell text directly
			sheetData.rows._[ri].cells[ci].text = newValue;

			// Also use the API method
			this.grid.sheet.data.setCellText(ri, ci, newValue, "input");

			// Force a complete re-render
			this.grid.reRender();

			console.log('[XlsxRibbon] Updated target cell:', { ri, ci }, 'to:', newValue);
			console.log('[XlsxRibbon] Cell now contains:', sheetData.rows._[ri].cells[ci].text);
		} else {
			console.warn('[XlsxRibbon] No target cell stored, using current selector');
			// Fallback to current selector if no target cell stored
			const range = this.grid.sheet.selector.range;
			const { sri, sci } = range;
			if (sri !== -1 && sci !== -1) {
				this.grid.sheet.data.setCellText(sri, sci, newValue, "input");
				this.grid.reRender();
			}
		}
	}

	/**
	 * Update visual preview of selected range during formula building (optional)
	 * @private
	 */
	_updateFormulaRangePreview(start, end) {
		// Could add a visual overlay to show the range being selected
		// For now, just log
		// console.log('[XlsxRibbon] Range preview:', start, 'to', end);
	}

	/**
	 * Clear the formula range preview
	 * @private
	 */
	_clearFormulaRangePreview() {
		// Remove any visual overlay if implemented
	}

	/**
	 * Check if the selected cell has a formula and re-evaluate if needed
	 * @private
	 */
	_checkSelectedCellFormula() {
		const range = this.grid.sheet.selector.range;
		const { sri, sci } = range;
		if (sri === -1 || sci === -1) return;

		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		if (!rows._ || !rows._[sri] || !rows._[sri].cells || !rows._[sri].cells[sci]) return;

		const cell = rows._[sri].cells[sci];

		// If cell has a stored formula, make sure formula bar shows it
		if (cell._formula) {
			if (this.elements.formulaInput) {
				this.elements.formulaInput.value = cell._formula;
			}
		}
		// If cell text looks like an unevaluated formula, try to evaluate it
		else if (cell.text && cell.text.startsWith('=')) {
			console.log('[XlsxRibbon] Found unevaluated formula, attempting evaluation:', cell.text);
			this._evaluateFormulaFromText(sri, sci, cell.text);
		}
	}

	/**
	 * Evaluate the formula in the currently selected cell
	 * Called after cell editing to ensure formulas are computed
	 */
	evaluateCurrentCellFormula() {
		const range = this.grid.sheet.selector.range;
		const { sri, sci } = range;
		if (sri === -1 || sci === -1) return;

		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		// Check if cell exists
		if (!rows._ || !rows._[sri] || !rows._[sri].cells || !rows._[sri].cells[sci]) return;

		const cell = rows._[sri].cells[sci];
		if (!cell) return;

		// Check if cell has an unevaluated formula
		if (cell.text && cell.text.startsWith('=')) {
			console.log('[XlsxRibbon] Evaluating formula in current cell:', cell.text);
			this._evaluateFormulaFromText(sri, sci, cell.text);
		}

		// Always sync formula bar with current cell
		this.updateRibbonState();
	}

	/**
	 * Re-evaluate all formulas in the spreadsheet
	 * Call this after loading data to ensure all formulas are computed
	 */
	reEvaluateAllFormulas() {
		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		if (!rows._) return;

		let formulasEvaluated = 0;

		for (const ri of Object.keys(rows._)) {
			const row = rows._[ri];
			if (!row || !row.cells) continue;

			for (const ci of Object.keys(row.cells)) {
				const cell = row.cells[ci];
				if (!cell) continue;

				// Check for stored formula or unevaluated formula text
				const formulaText = cell._formula || (cell.text && cell.text.startsWith('=') ? cell.text : null);
				if (formulaText) {
					this._evaluateFormulaFromText(parseInt(ri), parseInt(ci), formulaText);
					formulasEvaluated++;
				}
			}
		}

		if (formulasEvaluated > 0) {
			console.log(`[XlsxRibbon] Re-evaluated ${formulasEvaluated} formulas`);
			this.grid.reRender();
		}
	}

	/**
	 * Evaluate a formula entered in the formula bar
	 * @private
	 * @param {number} ri - Row index
	 * @param {number} ci - Column index
	 * @param {string} formulaText - The formula text (e.g., "=SUM(A1:A3)")
	 */
	_evaluateFormulaFromText(ri, ci, formulaText) {
		// Normalize: uppercase
		let formula = formulaText.toUpperCase().trim();

		// Auto-close parenthesis if missing
		if (formula.match(/^=(SUM|AVERAGE|COUNT|MIN|MAX)\([A-Z]+\d+[:+,][A-Z]+\d+$/) ||
			formula.match(/^=(SUM|AVERAGE|COUNT|MIN|MAX)\([A-Z]+\d+$/)) {
			formula = formula + ')';
			// Also update the cell with the corrected formula
			this.grid.sheet.data.setCellText(ri, ci, formulaText + ')', "finished");
			if (this.elements.formulaInput) {
				this.elements.formulaInput.value = formulaText + ')';
			}
		}

		// Parse formula: =FUNCTION(RANGE) - support both : and + as separators
		// Also support single cell references like =SUM(A1,A2) or =SUM(A1+A2)
		const rangeMatch = formula.match(/^=(SUM|AVERAGE|COUNT|MIN|MAX)\(([A-Z]+\d+)[:+,]([A-Z]+\d+)\)$/);
		const singleMatch = formula.match(/^=(SUM|AVERAGE|COUNT|MIN|MAX)\(([A-Z]+\d+)\)$/);

		if (rangeMatch) {
			const funcName = rangeMatch[1];
			const startRef = rangeMatch[2];
			const endRef = rangeMatch[3];

			// @ts-ignore
			const startCell = XLSX.utils.decode_cell(startRef);
			// @ts-ignore
			const endCell = XLSX.utils.decode_cell(endRef);

			// Compute immediately and update cell
			const result = this._evaluateFormula(funcName, startCell.r, startCell.c, endCell.r, endCell.c);
			if (result !== null) {
				this._setFormulaResult(ri, ci, formula.charAt(0) === '=' ? formulaText : '=' + formulaText, result);
			}
		} else if (singleMatch) {
			// Single cell formula - just get that cell's value
			const funcName = singleMatch[1];
			const cellRef = singleMatch[2];
			// @ts-ignore
			const cell = XLSX.utils.decode_cell(cellRef);
			const result = this._evaluateFormula(funcName, cell.r, cell.c, cell.r, cell.c);
			if (result !== null) {
				this._setFormulaResult(ri, ci, formula.charAt(0) === '=' ? formulaText : '=' + formulaText, result);
			}
		} else {
			console.log('[XlsxRibbon] Formula format not recognized:', formulaText);
			// Still try to ensure evaluation after x-spreadsheet processes
			setTimeout(() => {
				this._checkAndFixFormulaResult(ri, ci, formulaText);
			}, 100);
		}
	}

	/**
	 * Set the result of a formula evaluation
	 * @private
	 */
	_setFormulaResult(ri, ci, formula, result) {
		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		// Ensure cell exists
		if (!rows._) rows._ = {};
		if (!rows._[ri]) rows._[ri] = { cells: {} };
		if (!rows._[ri].cells) rows._[ri].cells = {};
		if (!rows._[ri].cells[ci]) rows._[ri].cells[ci] = {};

		const cell = rows._[ri].cells[ci];
		cell._formula = formula;
		cell.text = result.toString();

		console.log(`[XlsxRibbon] Formula ${formula} = ${result}`);

		this.grid.reRender();
		this.onContentChanged();

		// Keep formula bar showing the formula
		if (this.elements.formulaInput) {
			this.elements.formulaInput.value = formula;
		}
	}

	/**
	 * Check if x-spreadsheet evaluated correctly, fix if needed
	 * @private
	 */
	_checkAndFixFormulaResult(ri, ci, formulaText) {
		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;

		if (!rows._ || !rows._[ri] || !rows._[ri].cells || !rows._[ri].cells[ci]) return;

		const cell = rows._[ri].cells[ci];

		// If still showing formula text or seems wrong, try to evaluate
		if (cell.text && (cell.text.startsWith('=') || cell.text === formulaText)) {
			console.log('[XlsxRibbon] Formula may not have evaluated correctly, attempting manual evaluation');
			// Try parsing with more flexible regex
			this._evaluateFormulaFromText(ri, ci, formulaText);
		}
	}

	/**
	 * Setup keyboard shortcuts
	 * @private
	 */
	_setupKeyboardShortcuts() {
		document.addEventListener("keydown", (e) => {
			// Ctrl+S / Cmd+S - Save
			if ((e.ctrlKey || e.metaKey) && e.key === "s") {
				e.preventDefault();
				this.onSaveRequested();
			}

			// Ctrl+P / Cmd+P - Print
			if ((e.ctrlKey || e.metaKey) && e.key === "p") {
				e.preventDefault();
				this.onPrintRequested();
			}

			// Ctrl+Z / Cmd+Z - Undo
			if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
				e.preventDefault();
				this.historyManager.undo(this.onContentChanged);
				this.scheduleRibbonStateUpdate();
			}

			// Ctrl+Y / Cmd+Y or Ctrl+Shift+Z - Redo
			if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
				e.preventDefault();
				this.historyManager.redo(this.onContentChanged);
				this.scheduleRibbonStateUpdate();
			}

			// Ctrl+C / Cmd+C - Copy
			if ((e.ctrlKey || e.metaKey) && e.key === "c") {
				// Don't prevent default if formula input is focused (let browser handle)
				if (document.activeElement !== this.elements.formulaInput) {
					e.preventDefault();
					this.saveCurrentSelection();
					this.clipboardManager.copy();
				}
			}

			// Ctrl+X / Cmd+X - Cut
			if ((e.ctrlKey || e.metaKey) && e.key === "x") {
				if (document.activeElement !== this.elements.formulaInput) {
					e.preventDefault();
					this.saveCurrentSelection();
					this.historyManager.saveState();
					this.clipboardManager.cut();
				}
			}

			// Ctrl+V / Cmd+V - Paste
			if ((e.ctrlKey || e.metaKey) && e.key === "v") {
				if (document.activeElement !== this.elements.formulaInput) {
					e.preventDefault();
					this.saveCurrentSelection();
					this.historyManager.saveState();
					this.clipboardManager.paste(this.onContentChanged);
				}
			}

			// Ctrl+B / Cmd+B - Bold
			if ((e.ctrlKey || e.metaKey) && e.key === "b") {
				e.preventDefault();
				this.historyManager.saveState();
				this._toggleStyle("font", "bold");
			}

			// Ctrl+I / Cmd+I - Italic
			if ((e.ctrlKey || e.metaKey) && e.key === "i") {
				e.preventDefault();
				this.historyManager.saveState();
				this._toggleStyle("font", "italic");
			}

			// Ctrl+U / Cmd+U - Underline
			if ((e.ctrlKey || e.metaKey) && e.key === "u") {
				e.preventDefault();
				this.historyManager.saveState();
				this._toggleStyle("underline");
			}
		});
	}

	// ==========================================
	// Private Helper Methods
	// ==========================================

	/**
	 * Bind a toggle button to a style property
	 * @private
	 */
	_bindToggleButton(id, styleProp) {
		const btn = document.getElementById(id);
		if (!btn) return;

		btn.addEventListener("click", () => {
			this.saveCurrentSelection();
			this._toggleStyle(styleProp === "bold" || styleProp === "italic" ? "font" : styleProp, styleProp);
		});
	}

	/**
	 * Toggle a style property
	 * @private
	 */
	_toggleStyle(key, prop) {
		const { ri, ci } = this.lastSelection;
		if (ri === -1 || ci === -1) return;

		const style = this.getCellStyle(ri, ci);
		let currentVal = false;

		if (key === "font") {
			currentVal = style.font && style.font[prop];
			this.setStyle("font", { [prop]: !currentVal }, this.lastSelection);
			this._updateToggleButton(`btn-${prop}`, !currentVal);
		} else {
			currentVal = style[key];
			this.setStyle(key, !currentVal, this.lastSelection);
			this._updateToggleButton(`btn-${key}`, !currentVal);
		}
	}

	/**
	 * Update toggle button visual state
	 * @private
	 */
	_updateToggleButton(id, isActive) {
		const btn = document.getElementById(id);
		if (!btn) return;

		if (isActive) {
			btn.classList.add("active");
		} else {
			btn.classList.remove("active");
		}
	}

	/**
	 * Update alignment button states
	 * @private
	 */
	_updateAlignButtons(align) {
		const alignLeft = document.getElementById("btn-align-left");
		const alignCenter = document.getElementById("btn-align-center");
		const alignRight = document.getElementById("btn-align-right");

		[alignLeft, alignCenter, alignRight].forEach(btn => {
			if (btn) btn.classList.remove("active");
		});

		if (align === "center" && alignCenter) {
			alignCenter.classList.add("active");
		} else if (align === "right" && alignRight) {
			alignRight.classList.add("active");
		} else if (alignLeft) {
			alignLeft.classList.add("active");
		}
	}

	/**
	 * Update undo/redo button visual states
	 * @private
	 */
	_updateUndoRedoButtons() {
		const btnUndo = this.elements.btnUndo;
		const btnRedo = this.elements.btnRedo;

		if (btnUndo) {
			if (this.historyManager.canUndo()) {
				btnUndo.disabled = false;
				btnUndo.style.opacity = '1';
			} else {
				btnUndo.disabled = true;
				btnUndo.style.opacity = '0.5';
			}
		}

		if (btnRedo) {
			if (this.historyManager.canRedo()) {
				btnRedo.disabled = false;
				btnRedo.style.opacity = '1';
			} else {
				btnRedo.disabled = true;
				btnRedo.style.opacity = '0.5';
			}
		}
	}

	/**
	 * Public method to save state for undo
	 * Call this before any external modification
	 */
	saveStateForUndo() {
		this.historyManager.saveState();
	}
}

// Export for use in xlsxViewer.js
// @ts-ignore
window.XlsxRibbonController = XlsxRibbonController;


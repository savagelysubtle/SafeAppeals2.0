// XLSX Ribbon Controller - Manages the ribbon UI for the spreadsheet viewer
// @ts-check

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
		this.onContentChanged = options.onContentChanged || (() => {});
		this.onSaveRequested = options.onSaveRequested || (() => {});
		this.onPrintRequested = options.onPrintRequested || (() => {});

		// Selection state - tracks the last valid selection for style operations
		this.lastSelection = { ri: -1, ci: -1, sri: -1, sci: -1, eri: -1, eci: -1 };

		// Debounce timer for ribbon state updates
		this.ribbonStateDebounceTimer = null;
		this.RIBBON_STATE_DEBOUNCE_MS = 50;

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

		console.log('[XlsxRibbon] Controller created');
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

		// Setup font styling
		this._setupFontStyling();

		// Setup alignment
		this._setupAlignment();

		// Setup color pickers
		this._setupColorPickers();

		// Setup formulas
		this._setupFormulas();

		// Setup merge button
		this._setupMerge();

		// Setup view options
		this._setupViewOptions();

		// Setup formula bar
		this._setupFormulaBar();

		// Setup keyboard shortcuts
		this._setupKeyboardShortcuts();

		console.log('[XlsxRibbon] Initialization complete');
	}

	// ==========================================
	// Selection Management
	// ==========================================

	/**
	 * Save the current selection from the grid
	 */
	saveCurrentSelection() {
		const range = this.grid.sheet.selector.range;
		const { sri, sci, eri, eci } = range;

		if (sri !== undefined && sci !== undefined && sri !== -1 && sci !== -1) {
			this.lastSelection = { ri: sri, ci: sci, sri, sci, eri, eci };
			const cellCount = (eri - sri + 1) * (eci - sci + 1);
			console.log('[XlsxRibbon] Saved selection:', this.lastSelection, 'cells:', cellCount);
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
		spreadsheetEl.addEventListener("mouseup", () => {
			setTimeout(() => this.saveCurrentSelection(), 50);
		});

		// Track selection on keyboard navigation (Shift+Arrow keys)
		spreadsheetEl.addEventListener("keyup", (e) => {
			if (e.key.startsWith('Arrow') || e.key === 'Tab' || e.key === 'Enter') {
				setTimeout(() => this.saveCurrentSelection(), 50);
			}
		});

		// Track on click (for single cell selection)
		spreadsheetEl.addEventListener("click", () => {
			setTimeout(() => this.saveCurrentSelection(), 50);
		});
	}

	// ==========================================
	// Style Management
	// ==========================================

	/**
	 * Set style for selected cells using x-spreadsheet's indexed style system
	 * @param {string} key - Style property key (e.g., 'font', 'color', 'align')
	 * @param {any} value - Style value
	 * @param {object} [optionalRange] - Optional range to apply style to
	 */
	setStyle(key, value, optionalRange) {
		let sri, sci, eri, eci;
		if (optionalRange) {
			({ sri, sci, eri, eci } = optionalRange);
		} else {
			({ sri, sci, eri, eci } = this.lastSelection);
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

		// Get cell and style
		const sheetData = this.grid.sheet.data;
		const rows = sheetData.rows;
		let cell = null;
		if (rows._ && rows._[ri] && rows._[ri].cells && rows._[ri].cells[ci]) {
			cell = rows._[ri].cells[ci];
		}

		const style = this.getCellStyle(ri, ci);

		// Update formula bar
		if (this.elements.formulaInput) {
			this.elements.formulaInput.value = cell ? (cell.text || "") : "";
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
			spreadsheet: document.getElementById("x-spreadsheet-demo")
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
	 * Setup file operations (save, print)
	 * @private
	 */
	_setupFileOperations() {
		const btnSave = document.getElementById("btn-save");
		const btnPrint = document.getElementById("btn-print");

		if (btnSave) {
			btnSave.addEventListener("click", () => this.onSaveRequested());
		}
		if (btnPrint) {
			btnPrint.addEventListener("click", () => this.onPrintRequested());
		}
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
				btn.addEventListener("click", () => this._insertFormula(formula));
			}
		});
	}

	/**
	 * Insert a formula into the selected cell
	 * @private
	 */
	_insertFormula(formulaName) {
		const { ri, ci, sri, sci, eri, eci } = this.lastSelection;
		if (ri === -1 || ci === -1) {
			console.warn('[XlsxRibbon] No cell selected for formula');
			return;
		}

		// @ts-ignore
		const startCell = XLSX.utils.encode_cell({ r: sri, c: sci });
		// @ts-ignore
		const endCell = XLSX.utils.encode_cell({ r: eri, c: eci });

		const formula = sri === eri && sci === eci
			? `=${formulaName}()`
			: `=${formulaName}(${startCell}:${endCell})`;

		this.grid.sheet.data.setCellText(ri, ci, formula, "finished");
		this.grid.reRender();
		this.onContentChanged();
	}

	/**
	 * Setup merge button
	 * @private
	 */
	_setupMerge() {
		const btnMerge = document.getElementById("btn-merge");
		if (btnMerge) {
			btnMerge.addEventListener("click", () => {
				console.log("[XlsxRibbon] Merge clicked - requires internal API access");
			});
		}
	}

	/**
	 * Setup view options
	 * @private
	 */
	_setupViewOptions() {
		const chkGridlines = document.getElementById("chk-gridlines");
		if (chkGridlines) {
			chkGridlines.addEventListener("change", () => {
				console.log("[XlsxRibbon] Gridlines toggle - requires re-render");
			});
		}
	}

	/**
	 * Setup formula bar
	 * @private
	 */
	_setupFormulaBar() {
		const formulaInput = this.elements.formulaInput;
		const spreadsheet = this.elements.spreadsheet;

		if (formulaInput) {
			formulaInput.addEventListener("input", (e) => {
				// @ts-ignore
				const text = e.target.value;
				const range = this.grid.sheet.selector.range;
				const { sri, sci } = range;
				if (sri !== -1 && sci !== -1) {
					this.grid.sheet.data.setCellText(sri, sci, text, "finished");
					this.grid.reRender();
					this.onContentChanged();
				}
			});
		}

		// Update ribbon state on selection change
		if (spreadsheet) {
			spreadsheet.addEventListener("click", () => this.scheduleRibbonStateUpdate());
			spreadsheet.addEventListener("keyup", () => this.scheduleRibbonStateUpdate());
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

			// Ctrl+B / Cmd+B - Bold
			if ((e.ctrlKey || e.metaKey) && e.key === "b") {
				e.preventDefault();
				this._toggleStyle("font", "bold");
			}

			// Ctrl+I / Cmd+I - Italic
			if ((e.ctrlKey || e.metaKey) && e.key === "i") {
				e.preventDefault();
				this._toggleStyle("font", "italic");
			}

			// Ctrl+U / Cmd+U - Underline
			if ((e.ctrlKey || e.metaKey) && e.key === "u") {
				e.preventDefault();
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
}

// Export for use in xlsxViewer.js
// @ts-ignore
window.XlsxRibbonController = XlsxRibbonController;


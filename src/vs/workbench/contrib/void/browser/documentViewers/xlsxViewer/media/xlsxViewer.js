// XLSX Viewer Webview Script using x-data-spreadsheet
(function () {
	// Communication with host
	const vscode = acquireVsCodeApi();

	// Initialize x-spreadsheet
	// @ts-ignore
	const x_spreadsheet = window.x_spreadsheet;
	let grid = null;
	let workbook = null;
	let contentModified = false;

	// Debounce timers for performance
	let contentChangeDebounceTimer = null;
	let ribbonStateDebounceTimer = null;
	const CONTENT_CHANGE_DEBOUNCE_MS = 300;
	const RIBBON_STATE_DEBOUNCE_MS = 50;

	// Debounced content change notification
	function notifyContentChanged() {
		contentModified = true;
		if (contentChangeDebounceTimer) {
			clearTimeout(contentChangeDebounceTimer);
		}
		contentChangeDebounceTimer = setTimeout(() => {
			sendContentUpdate();
			contentChangeDebounceTimer = null;
		}, CONTENT_CHANGE_DEBOUNCE_MS);
	}

	function sendContentUpdate() {
		if (!grid) return;
		try {
			const data = grid.getData();
			const newWorkbook = xtos(data);
			// @ts-ignore
			const wbout = XLSX.write(newWorkbook, {
				bookType: "xlsx",
				type: "array"
			});
			const base64 = btoa(
				new Uint8Array(wbout).reduce((data, byte) => data + String.fromCharCode(byte), "")
			);
			vscode.postMessage({ type: "contentChanged", data: base64 });
		} catch (e) {
			console.error("[XLSX Webview] Failed to serialize content for update:", e);
		}
	}

	// Flush updates on visibility change or blur
	document.addEventListener("visibilitychange", () => {
		if (document.hidden && contentModified) {
			sendContentUpdate();
		}
	});
	window.addEventListener("blur", () => {
		if (contentModified) {
			sendContentUpdate();
		}
	});

	// Debounced ribbon state update
	function scheduleRibbonStateUpdate(callback) {
		if (ribbonStateDebounceTimer) {
			clearTimeout(ribbonStateDebounceTimer);
		}
		ribbonStateDebounceTimer = setTimeout(() => {
			callback();
			ribbonStateDebounceTimer = null;
		}, RIBBON_STATE_DEBOUNCE_MS);
	}

	// Define colors for palette
	const COLORS = [
		'#000000', '#434343', '#666666', '#999999', '#b7b7b7', '#cccccc', '#d9d9d9', '#efefef', '#f3f3f3', '#ffffff',
		'#980000', '#ff0000', '#ff9900', '#ffff00', '#00ff00', '#00ffff', '#4a86e8', '#0000ff', '#9900ff', '#ff00ff',
		'#e6b8af', '#f4cccc', '#fce5cd', '#fff2cc', '#d9ead3', '#d0e0e3', '#c9daf8', '#cfe2f3', '#d9d2e9', '#ead1dc',
		'#dd7e6b', '#ea9999', '#f9cb9c', '#ffe599', '#b6d7a8', '#a2c4c9', '#a4c2f4', '#9fc5e8', '#b4a7d6', '#d5a6bd',
		'#cc4125', '#e06666', '#f6b26b', '#ffd966', '#93c47d', '#76a5af', '#6d9eeb', '#6fa8dc', '#8e7cc3', '#c27ba0',
		'#a61c00', '#cc0000', '#e69138', '#f1c232', '#6aa84f', '#45818e', '#3c78d8', '#3d85c6', '#674ea7', '#a64d79',
		'#85200c', '#990000', '#b45f06', '#bf9000', '#38761d', '#134f5c', '#1155cc', '#0b5394', '#351c75', '#741b47',
		'#5b0f00', '#660000', '#783f04', '#7f6000', '#274e13', '#0c343d', '#1c4587', '#073763', '#20124d', '#4c1130'
	];

	// Notify host that webview is ready
	vscode.postMessage({ type: "ready" });

	// Listen for messages from host
	window.addEventListener("message", async (event) => {
		const message = event.data;

		switch (message.type) {
			case "loadXLSX":
				await handleLoadXLSX(message);
				contentModified = false;
				break;
			case "clearXLSX":
				if (grid) {
					grid.loadData({});
				}
				contentModified = false;
				break;
			case "saveRequest":
				saveSpreadsheet();
				break;
			case "saveComplete":
				handleSaveComplete(message);
				break;
			case "executeOperations":
				console.warn("Agent operations not yet implemented for x-spreadsheet");
				break;
		}
	});

	/**
	 * Handle save completion message from host
	 */
	function handleSaveComplete(message) {
		if (message.success) {
			contentModified = false;
			console.log("[XLSX Webview] Save successful");
			// Could show a brief toast/notification here if needed
		} else {
			console.error("[XLSX Webview] Save failed:", message.error);
			// Could show error notification to user
		}
	}

	async function handleLoadXLSX(message) {
		try {
			console.log("[XLSX Webview] Loading XLSX...");

			// Convert base64 to ArrayBuffer
			const binaryString = atob(message.data);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			// Parse workbook using SheetJS
			// @ts-ignore
			workbook = XLSX.read(bytes, { type: "array" });

			// Convert to x-spreadsheet data
			const data = stox(workbook);

			// Initialize grid if not already done
			if (!grid) {
				const options = {
					mode: "edit",
					showToolbar: false, // Hide default toolbar
					showGrid: true,
					showContextmenu: true,
					view: {
						height: () => document.documentElement.clientHeight - 130, // Adjust for ribbon + formula bar
						width: () => document.documentElement.clientWidth,
					},
					row: {
						len: 100,
						height: 25,
					},
					col: {
						len: 26,
						width: 100,
						indexWidth: 60,
						minWidth: 60,
					},
					style: {
						bgcolor: "#ffffff",
						align: "left",
						valign: "middle",
						textwrap: false,
						strike: false,
						underline: false,
						color: "#0a0a0a",
						font: {
							name: "Helvetica",
							size: 10,
							bold: false,
							italic: false,
						},
					},
				};
				grid = new x_spreadsheet("#x-spreadsheet-demo", options);

				// Initialize Ribbon Controller
				initRibbonController(grid);

				// Handle change events (debounced)
				grid.change((cdata) => {
					// Notify host that content changed (debounced)
					notifyContentChanged();
				});
			}

			// Load data into grid
			grid.loadData(data);
			console.log("[XLSX Webview] XLSX loaded successfully");

		} catch (error) {
			console.error("[XLSX Webview] Failed to load XLSX:", error);
			document.getElementById("x-spreadsheet-demo").innerHTML = `<div style="padding: 20px; color: var(--vscode-errorForeground);">
				Error loading spreadsheet: ${error.message}
			</div>`;
		}
	}

	// ==========================================
	// Ribbon Controller
	// ==========================================
	function initRibbonController(gridInstance) {
		// --- Tab Switching ---
		const tabs = document.querySelectorAll(".ribbon-tab");
		tabs.forEach(tab => {
			tab.addEventListener("click", () => {
				document.querySelectorAll(".ribbon-tab").forEach(t => t.classList.remove("active"));
				document.querySelectorAll(".ribbon-panel").forEach(p => p.classList.remove("active"));

				tab.classList.add("active");
				const tabId = tab.getAttribute("data-tab");
				document.getElementById(`tab-${tabId}`).classList.add("active");
			});
		});

		// --- File Operations ---
		document.getElementById("btn-save").addEventListener("click", saveSpreadsheet);
		document.getElementById("btn-print").addEventListener("click", handlePrint);

		// --- Font Styling ---
		bindToggleButton("btn-bold", "bold");
		bindToggleButton("btn-italic", "italic");
		bindToggleButton("btn-underline", "underline");
		bindToggleButton("btn-strike", "strike");

		// --- Alignment ---
		bindActionButton("btn-align-left", () => setStyle("align", "left"));
		bindActionButton("btn-align-center", () => setStyle("align", "center"));
		bindActionButton("btn-align-right", () => setStyle("align", "right"));

		// --- Font Family & Size ---
		document.getElementById("font-family").addEventListener("change", (e) => {
			// @ts-ignore
			setStyle("font", { name: e.target.value });
		});
		document.getElementById("font-size").addEventListener("change", (e) => {
			// @ts-ignore
			setStyle("font", { size: parseInt(e.target.value) });
		});

		// --- Color Pickers ---
		initColorPicker("text-color-picker", "btn-text-color", "text-color-indicator", (color) => {
			setStyle("color", color);
		});
		initColorPicker("fill-color-picker", "btn-fill-color", "fill-color-indicator", (color) => {
			setStyle("bgcolor", color);
		});

		// --- Formulas ---
		document.getElementById("btn-sum").addEventListener("click", () => insertFormula("SUM"));
		document.getElementById("btn-average").addEventListener("click", () => insertFormula("AVERAGE"));
		document.getElementById("btn-count").addEventListener("click", () => insertFormula("COUNT"));
		document.getElementById("btn-min").addEventListener("click", () => insertFormula("MIN"));
		document.getElementById("btn-max").addEventListener("click", () => insertFormula("MAX"));

		// --- Merge ---
		document.getElementById("btn-merge").addEventListener("click", () => {
			// x-spreadsheet doesn't expose a clean merge API from outside easily
			// We can try to simulate it or use internal methods if available
			// For now, just log
			console.log("Merge clicked - requires internal API access");
		});

		// --- View Options ---
		document.getElementById("chk-gridlines").addEventListener("change", (e) => {
			// @ts-ignore
			// Not easily toggleable in x-spreadsheet after init without re-render
			console.log("Gridlines toggle - requires re-render");
		});

		// --- Formula Bar & State Sync ---
		const formulaInput = document.getElementById("formula-input");
		const cellName = document.getElementById("cell-name");

		// Sync UI on selection change (debounced)
		// We hook into the canvas click/keydown or use a timer/observer because x-spreadsheet
		// doesn't emit a 'selection-change' event.
		document.getElementById("x-spreadsheet-demo").addEventListener("click", () => {
			scheduleRibbonStateUpdate(updateRibbonState);
		});
		document.getElementById("x-spreadsheet-demo").addEventListener("keyup", () => {
			scheduleRibbonStateUpdate(updateRibbonState);
		});

		// Formula Bar Input (debounced)
		formulaInput.addEventListener("input", (e) => {
			// @ts-ignore
			const text = e.target.value;
			const { ri, ci } = gridInstance.sheet.selector;
			if (ri !== -1 && ci !== -1) {
				gridInstance.sheet.data.setCellText(ri, ci, text, "finished");
				gridInstance.reRender();
				// Notify host of change (debounced)
				notifyContentChanged();
			}
		});

		function updateRibbonState() {
			const { ri, ci } = gridInstance.sheet.selector;
			if (ri === -1 || ci === -1) return;

			// Update Cell Name (A1, B2, etc.)
			// @ts-ignore
			const cellRef = XLSX.utils.encode_cell({ r: ri, c: ci });
			cellName.textContent = cellRef;

			// Get Cell Data
			const cell = gridInstance.sheet.data.getCell(ri, ci);
			const style = gridInstance.sheet.data.getCellStyle(ri, ci); // Merged style

			// Update Formula Bar
			// @ts-ignore
			formulaInput.value = cell ? (cell.text || "") : "";

			// Update Buttons
			updateToggleButton("btn-bold", style.font && style.font.bold);
			updateToggleButton("btn-italic", style.font && style.font.italic);
			updateToggleButton("btn-underline", style.underline);
			updateToggleButton("btn-strike", style.strike);

			// Update Alignment
			updateAlignButtons(style.align);

			// Update Font Dropdowns
			if (style.font) {
				// @ts-ignore
				document.getElementById("font-family").value = style.font.name || "Helvetica";
				// @ts-ignore
				document.getElementById("font-size").value = style.font.size || 10;
			}
		}
	}

	// --- Helper Functions ---

	function bindToggleButton(id, styleProp) {
		document.getElementById(id).addEventListener("click", () => {
			// We need to toggle. First get current state.
			const { ri, ci } = grid.sheet.selector;
			if (ri === -1) return;

			const style = grid.sheet.data.getCellStyle(ri, ci);
			let currentVal = false;

			if (styleProp === "bold" || styleProp === "italic") {
				currentVal = style.font && style.font[styleProp];
				// Apply
				setStyle("font", { [styleProp]: !currentVal });
			} else {
				currentVal = style[styleProp];
				setStyle(styleProp, !currentVal);
			}

			// Update UI immediately
			updateToggleButton(id, !currentVal);
		});
	}

	function bindActionButton(id, action) {
		document.getElementById(id).addEventListener("click", action);
	}

	function updateToggleButton(id, isActive) {
		const btn = document.getElementById(id);
		if (isActive) btn.classList.add("active");
		else btn.classList.remove("active");
	}

	function updateAlignButtons(align) {
		document.getElementById("btn-align-left").classList.remove("active");
		document.getElementById("btn-align-center").classList.remove("active");
		document.getElementById("btn-align-right").classList.remove("active");

		if (align === "center") document.getElementById("btn-align-center").classList.add("active");
		else if (align === "right") document.getElementById("btn-align-right").classList.add("active");
		else document.getElementById("btn-align-left").classList.add("active"); // Default
	}

	function setStyle(key, value) {
		const { ri, ci } = grid.sheet.selector;
		// Apply to selected range
		// x-spreadsheet internal API: sheet.data.setStyle(ri, ci, key, value)
		// But we want to apply to range.
		const { sri, sci, eri, eci } = grid.sheet.selector.range;

		for (let r = sri; r <= eri; r++) {
			for (let c = sci; c <= eci; c++) {
				// Special handling for font object merging
				if (key === "font") {
					const currentStyle = grid.sheet.data.getCellStyle(r, c);
					const currentFont = currentStyle.font || {};
					const newFont = { ...currentFont, ...value };
					grid.sheet.data.setStyle(r, c, "font", newFont);
				} else {
					grid.sheet.data.setStyle(r, c, key, value);
				}
			}
		}
		grid.reRender();
		// Notify host of change (debounced)
		notifyContentChanged();
	}

	function initColorPicker(pickerId, btnId, indicatorId, onSelect) {
		const picker = document.getElementById(pickerId);
		const btn = document.getElementById(btnId);
		const indicator = document.getElementById(indicatorId);

		// Populate colors
		COLORS.forEach(color => {
			const swatch = document.createElement("div");
			swatch.className = "color-swatch";
			swatch.style.backgroundColor = color;
			swatch.addEventListener("click", (e) => {
				e.stopPropagation();
				onSelect(color);
				indicator.style.backgroundColor = color;
				picker.classList.remove("show");
			});
			picker.appendChild(swatch);
		});

		// Toggle popup
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			// Close others
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

	// Keyboard shortcuts
	document.addEventListener("keydown", (e) => {
		// Ctrl+S / Cmd+S - Save
		if ((e.ctrlKey || e.metaKey) && e.key === "s") {
			e.preventDefault();
			saveSpreadsheet();
		}

		// Ctrl+P / Cmd+P - Print
		if ((e.ctrlKey || e.metaKey) && e.key === "p") {
			e.preventDefault();
			handlePrint();
		}
	});

	function saveSpreadsheet() {
		if (!grid) {
			return;
		}

		try {
			// Get data from x-spreadsheet
			const data = grid.getData();

			// Convert back to SheetJS workbook
			const newWorkbook = xtos(data);

			// Write to binary
			// @ts-ignore
			const wbout = XLSX.write(newWorkbook, {
				bookType: "xlsx",
				type: "array"
			});

			// Convert to base64
			const base64 = btoa(
				new Uint8Array(wbout).reduce((data, byte) => data + String.fromCharCode(byte), "")
			);

			// Send to host
			vscode.postMessage({
				type: "saveRequested",
				data: base64
			});

			console.log("[XLSX Webview] Save request sent");

		} catch (error) {
			console.error("[XLSX Webview] Failed to save:", error);
		}
	}

	/**
	 * Print the spreadsheet - converts to HTML table and prints
	 */
	function handlePrint() {
		if (!grid) {
			console.warn('[XLSX Webview] Grid not initialized for printing');
			return;
		}

		console.log('[XLSX Webview] Starting print process...');

		try {
			// Create hidden iframe for printing
			const printFrame = document.createElement('iframe');
			printFrame.style.position = 'absolute';
			printFrame.style.left = '-9999px';
			printFrame.style.width = '0';
			printFrame.style.height = '0';
			printFrame.style.border = 'none';
			printFrame.setAttribute('sandbox', 'allow-same-origin allow-scripts allow-modals');
			document.body.appendChild(printFrame);

			// Get data from x-spreadsheet
			const data = grid.getData();

			// Convert to HTML tables (one per sheet)
			let sheetsHTML = '';
			for (const [sheetIndex, sheet] of Object.entries(data)) {
				const sheetName = sheet.name || `Sheet ${parseInt(sheetIndex) + 1}`;
				const rows = sheet.rows || {};

				// Build HTML table
				let tableHTML = `<div class="sheet-section">
					<h2>${sheetName}</h2>
					<table class="spreadsheet-table">`;

				// Get max row and col
				let maxRow = 0;
				let maxCol = 0;
				for (const [rowIdx, row] of Object.entries(rows)) {
					const ri = parseInt(rowIdx);
					if (ri > maxRow) maxRow = ri;
					const cells = row.cells || {};
					for (const colIdx of Object.keys(cells)) {
						const ci = parseInt(colIdx);
						if (ci > maxCol) maxCol = ci;
					}
				}

				// Generate table rows
				for (let ri = 0; ri <= maxRow; ri++) {
					tableHTML += '<tr>';
					const row = rows[ri] || {};
					const cells = row.cells || {};

					for (let ci = 0; ci <= maxCol; ci++) {
						const cell = cells[ci] || {};
						const text = cell.text || '';
						const style = cell.style || {};

						// Build cell style
						let cellStyle = '';
						if (style.bold) cellStyle += 'font-weight: bold; ';
						if (style.italic) cellStyle += 'font-style: italic; ';
						if (style.underline) cellStyle += 'text-decoration: underline; ';
						if (style.color) cellStyle += `color: ${style.color}; `;
						if (style.bgcolor) cellStyle += `background-color: ${style.bgcolor}; `;
						if (style.fontSize) cellStyle += `font-size: ${style.fontSize}pt; `;
						if (style.align) cellStyle += `text-align: ${style.align}; `;

						tableHTML += `<td style="${cellStyle}">${text || ''}</td>`;
					}

					tableHTML += '</tr>';
				}

				tableHTML += '</table></div>';
				sheetsHTML += tableHTML;
			}

			// Build print HTML
			const printHTML = `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="UTF-8">
					<title>Print Spreadsheet</title>
					<style>
						@page {
							size: landscape;
							margin: 0.5in;
						}
						body {
							margin: 0;
							padding: 20px;
							font-family: 'Calibri', 'Arial', sans-serif;
							font-size: 10pt;
							color: #000;
							background: #fff;
						}
						.sheet-section {
							page-break-after: always;
							margin-bottom: 20px;
						}
						.sheet-section:last-child {
							page-break-after: auto;
						}
						h2 {
							margin: 0 0 10px 0;
							font-size: 14pt;
							font-weight: bold;
						}
						.spreadsheet-table {
							border-collapse: collapse;
							width: 100%;
							font-size: 10pt;
						}
						.spreadsheet-table td {
							border: 1px solid #ddd;
							padding: 4px 8px;
							min-width: 60px;
						}
						@media print {
							body { padding: 0; }
							.sheet-section { margin-bottom: 0; }
						}
					</style>
				</head>
				<body>
					${sheetsHTML}
				</body>
				</html>
			`;

			// Write to iframe and trigger print
			const doc = printFrame.contentDocument || printFrame.contentWindow.document;
			doc.open();
			doc.write(printHTML);
			doc.close();

			// Wait for content to load, then print
			setTimeout(() => {
				printFrame.contentWindow.focus();
				printFrame.contentWindow.print();

				// Cleanup after print dialog closes
				setTimeout(() => {
					document.body.removeChild(printFrame);
					console.log('[XLSX Webview] Print process complete');
				}, 1000);
			}, 500);

		} catch (error) {
			console.error('[XLSX Webview] Print error:', error);
		}
	}

	/**
	 * Insert a formula into the selected cell
	 */
	function insertFormula(formulaName) {
		if (!grid) return;

		const { ri, ci } = grid.sheet.selector;
		if (ri === -1 || ci === -1) return;

		// Get the selected range
		const { sri, sci, eri, eci } = grid.sheet.selector.range;

		// Build the range reference for the formula
		// @ts-ignore
		const startCell = XLSX.utils.encode_cell({ r: sri, c: sci });
		// @ts-ignore
		const endCell = XLSX.utils.encode_cell({ r: eri, c: eci });
		const rangeRef = sri === eri && sci === eci ? startCell : `${startCell}:${endCell}`;

		// Create the formula
		const formula = `=${formulaName}(${rangeRef})`;

		// Insert into the currently selected cell
		grid.sheet.data.setCellText(ri, ci, formula, "finished");
		grid.reRender();

		// Update formula bar
		const formulaInput = document.getElementById("formula-input");
		if (formulaInput) {
			// @ts-ignore
			formulaInput.value = formula;
		}

		// Notify host of change (debounced)
		notifyContentChanged();

		console.log(`[XLSX Webview] Inserted formula: ${formula} at cell ${XLSX.utils.encode_cell({ r: ri, c: ci })}`);
	}

	// ==========================================
	// Data Conversion Functions (SheetJS <-> x-spreadsheet)
	// ==========================================

	/**
	 * SheetJS to x-spreadsheet
	 */
	function stox(wb) {
		const out = [];
		wb.SheetNames.forEach(function (name) {
			const o = { name: name, rows: {} };
			const ws = wb.Sheets[name];
			// @ts-ignore
			const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");

			// Iterate through every cell in the range
			for (let R = range.s.r; R <= range.e.r; ++R) {
				for (let C = range.s.c; C <= range.e.c; ++C) {
					// @ts-ignore
					const cell_address = XLSX.utils.encode_cell({ r: R, c: C });
					const cell = ws[cell_address];

					if (!cell) continue;

					o.rows[R] = o.rows[R] || { cells: {} };
					o.rows[R].cells[C] = o.rows[R].cells[C] || {};

					// Value
					o.rows[R].cells[C].text = (cell.w || cell.v || "").toString();

					// Merges
					if (ws["!merges"]) {
						ws["!merges"].forEach(merge => {
							if (merge.s.r === R && merge.s.c === C) {
								o.rows[R].cells[C].merge = [
									merge.e.r - merge.s.r,
									merge.e.c - merge.s.c
								];
							}
						});
					}

					// Style (Basic import)
					// SheetJS free version doesn't give much style info, but we can try
					// if (cell.s) { ... }
				}
			}

			// Handle column widths
			if (ws["!cols"]) {
				o.cols = {};
				ws["!cols"].forEach((col, index) => {
					if (col) {
						o.cols[index] = { width: (col.wpx || 60) }; // Convert width
					}
				});
			}

			out.push(o);
		});
		return out;
	}

	/**
	 * x-spreadsheet to SheetJS
	 */
	function xtos(sdata) {
		// @ts-ignore
		const out = XLSX.utils.book_new();
		sdata.forEach(function (xws) {
			const ws = {};
			const range = { s: { c: 10000000, r: 10000000 }, e: { c: 0, r: 0 } };

			for (let ri = 0; ri < xws.rows.len; ++ri) {
				const row = xws.rows[ri];
				if (!row || !row.cells) continue;

				Object.keys(row.cells).forEach(function (k) {
					const idx = parseInt(k);
					const cell = row.cells[k];
					if (cell.text === undefined) return;

					range.s.r = Math.min(range.s.r, ri);
					range.s.c = Math.min(range.s.c, idx);
					range.e.r = Math.max(range.e.r, ri);
					range.e.c = Math.max(range.e.c, idx);

					// @ts-ignore
					const cell_ref = XLSX.utils.encode_cell({ c: idx, r: ri });

					// Determine type
					let type = "s";
					let val = cell.text;

					if (!isNaN(parseFloat(val)) && isFinite(val)) {
						type = "n";
						val = parseFloat(val);
					}

					ws[cell_ref] = { v: val, t: type };

					// Handle merges
					if (cell.merge) {
						if (!ws["!merges"]) ws["!merges"] = [];
						ws["!merges"].push({
							s: { r: ri, c: idx },
							e: { r: ri + cell.merge[0], c: idx + cell.merge[1] }
						});
					}
				});
			}

			if (range.s.c < 10000000) {
				// @ts-ignore
				ws["!ref"] = XLSX.utils.encode_range(range);
			} else {
				ws["!ref"] = "A1:A1";
			}

			// @ts-ignore
			XLSX.utils.book_append_sheet(out, ws, xws.name);
		});
		return out;
	}

})();

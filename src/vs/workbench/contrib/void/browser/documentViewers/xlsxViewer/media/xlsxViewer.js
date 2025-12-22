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

	// Debounce timer for content change notifications
	let contentChangeDebounceTimer = null;
	const CONTENT_CHANGE_DEBOUNCE_MS = 300;

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

				// Initialize Ribbon Controller using the new class
				// @ts-ignore
				const ribbonController = new window.XlsxRibbonController(grid, {
					onContentChanged: notifyContentChanged,
					onSaveRequested: saveSpreadsheet,
					onPrintRequested: handlePrint
				});
				ribbonController.init();

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
	// Keyboard Shortcuts (handled by XlsxRibbonController but kept here as backup)
	// ==========================================

	// Note: Keyboard shortcuts are now handled by XlsxRibbonController
	// These are kept as a fallback in case the controller fails to initialize

	// ==========================================
	// File Operations
	// ==========================================

	// Note: Ribbon UI is now handled by XlsxRibbonController class (xlsxRibbon.js)
	// The functions below (saveSpreadsheet, handlePrint) are utility functions
	// that are passed as callbacks to the ribbon controller

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
	 * Print the spreadsheet - converts to HTML table and sends to host for printing
	 */
	function handlePrint() {
		if (!grid) {
			console.warn('[XLSX Webview] Grid not initialized for printing');
			return;
		}

		console.log('[XLSX Webview] Starting print process...');

		try {
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

						// Get style using the indexed style system
						// cell.style is an integer index into grid.sheet.data.styles array
						const stylesArray = grid.sheet.data.styles || [];
						let style = {};
						if (typeof cell.style === 'number' && cell.style >= 0 && cell.style < stylesArray.length) {
							style = stylesArray[cell.style] || {};
						}

						// Build cell style - x-spreadsheet stores font in style.font object
						let cellStyle = '';

						// Handle font properties from style.font object
						if (style.font) {
							if (style.font.name) cellStyle += `font-family: "${style.font.name}"; `;
							if (style.font.size) cellStyle += `font-size: ${style.font.size}pt; `;
							if (style.font.bold) cellStyle += 'font-weight: bold; ';
							if (style.font.italic) cellStyle += 'font-style: italic; ';
						}

						// Handle other style properties
						if (style.underline) cellStyle += 'text-decoration: underline; ';
						if (style.strike) cellStyle += 'text-decoration: line-through; ';
						if (style.color) cellStyle += `color: ${style.color}; `;
						if (style.bgcolor) cellStyle += `background-color: ${style.bgcolor}; `;
						if (style.align) cellStyle += `text-align: ${style.align}; `;
						if (style.valign) cellStyle += `vertical-align: ${style.valign}; `;

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

			// Send to host to handle printing (bypass sandbox)
			vscode.postMessage({
				type: 'print',
				html: printHTML
			});
			console.log('[XLSX Webview] Sent print request to host');

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

// XLSX Viewer Webview Script
(function () {
	// Communication with host
	const vscode = acquireVsCodeApi();

	// Get previous state if it exists
	const previousState = vscode.getState() || {};

	let workbook = null;
	let currentSheetIndex = 0;
	let zoomLevel = 100;

	// Get DOM elements
	const container = document.getElementById('xlsx-container');
	const sheetTabsContainer = document.getElementById('sheet-tabs');
	const zoomInBtn = document.getElementById('zoom-in-btn');
	const zoomOutBtn = document.getElementById('zoom-out-btn');
	const zoomLevelSpan = document.getElementById('zoom-level');
	const cellRefSpan = document.getElementById('cell-ref');
	const sheetInfoSpan = document.getElementById('sheet-info');

	// Notify host that webview is ready
	vscode.postMessage({ type: 'ready' });

	// Listen for messages from host
	window.addEventListener('message', async (event) => {
		const message = event.data;

		switch (message.type) {
			case 'loadXLSX':
				await handleLoadXLSX(message);
				break;
			case 'executeOperations':
				executeDocumentOperations(message.operations);
				break;
		}
	});

	async function handleLoadXLSX(message) {
		try {
			console.log('[XLSX Webview] Loading XLSX...');
			container.innerHTML = '<div class="loading">Loading spreadsheet...</div>';

			// Convert base64 to ArrayBuffer
			const binaryString = atob(message.data);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			// Parse workbook using SheetJS
			workbook = XLSX.read(bytes, { type: 'array' });

			// Set initial sheet
			currentSheetIndex = message.startSheet || 0;
			if (currentSheetIndex >= workbook.SheetNames.length) {
				currentSheetIndex = 0;
			}

			// Render sheet tabs
			renderSheetTabs();

			// Render current sheet
			renderSheet(currentSheetIndex);

			console.log('[XLSX Webview] XLSX loaded successfully');

		} catch (error) {
			console.error('[XLSX Webview] Failed to load XLSX:', error);
			container.innerHTML = `<div style="padding: 20px; color: var(--vscode-errorForeground);">
				Error loading spreadsheet: ${error.message}
			</div>`;
		}
	}

	function renderSheetTabs() {
		sheetTabsContainer.innerHTML = '';

		workbook.SheetNames.forEach((sheetName, index) => {
			const tab = document.createElement('button');
			tab.className = 'sheet-tab';
			tab.textContent = sheetName;
			if (index === currentSheetIndex) {
				tab.classList.add('active');
			}

			tab.addEventListener('click', () => {
				switchSheet(index);
			});

			sheetTabsContainer.appendChild(tab);
		});
	}

	function switchSheet(index) {
		if (index === currentSheetIndex) {
			return;
		}

		currentSheetIndex = index;
		renderSheetTabs();
		renderSheet(index);

		// Notify host about sheet change
		vscode.postMessage({
			type: 'sheetChanged',
			sheetIndex: index,
			sheetName: workbook.SheetNames[index]
		});
	}

	function renderSheet(sheetIndex) {
		const sheetName = workbook.SheetNames[sheetIndex];
		const worksheet = workbook.Sheets[sheetName];

		// Convert sheet to HTML
		const html = XLSX.utils.sheet_to_html(worksheet, {
			id: 'xlsx-sheet-table',
			editable: false
		});

		container.innerHTML = html;

		// Apply custom styling class
		const table = container.querySelector('table');
		if (table) {
			table.className = 'xlsx-table';

			// Apply zoom
			table.style.transform = `scale(${zoomLevel / 100})`;
			table.style.transformOrigin = 'top left';

			// Make cells editable
			const cells = table.querySelectorAll('td');
			cells.forEach((cell, index) => {
				// Make cell contentEditable
				cell.contentEditable = 'true';
				cell.spellcheck = false;

				// Get cell address
				const rowIndex = Math.floor(index / (cells.length / table.rows.length));
				const colIndex = index % (cells.length / table.rows.length);
				const cellAddress = XLSX.utils.encode_cell({ r: rowIndex, c: colIndex });
				cell.dataset.cellAddress = cellAddress;

				// Track changes
				cell.addEventListener('input', (e) => {
					handleCellEdit(cell, cellAddress);
				});

				// Cell selection on click
				cell.addEventListener('click', (e) => {
					handleCellClick(e.target, e);
				});

				// Handle Enter key to move to next cell
				cell.addEventListener('keydown', (e) => {
					if (e.key === 'Enter' && !e.shiftKey) {
						e.preventDefault();
						const nextCell = cells[index + 1];
						if (nextCell) {
							nextCell.focus();
						}
					} else if (e.key === 'Tab') {
						e.preventDefault();
						const nextCell = e.shiftKey ? cells[index - 1] : cells[index + 1];
						if (nextCell) {
							nextCell.focus();
						}
					}
				});
			});

			// Update sheet info
			const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
			const rows = range.e.r - range.s.r + 1;
			const cols = range.e.c - range.s.c + 1;
			sheetInfoSpan.textContent = `${rows} rows × ${cols} columns - Click any cell to edit`;
		}
	}

	let isModified = false;

	function handleCellEdit(cell, cellAddress) {
		const sheetName = workbook.SheetNames[currentSheetIndex];
		const worksheet = workbook.Sheets[sheetName];

		// Update the workbook data
		const newValue = cell.textContent.trim();

		if (newValue === '') {
			// Delete the cell if empty
			delete worksheet[cellAddress];
		} else {
			// Try to parse as number
			const numValue = parseFloat(newValue);
			if (!isNaN(numValue) && newValue === numValue.toString()) {
				worksheet[cellAddress] = { t: 'n', v: numValue };
			} else {
				worksheet[cellAddress] = { t: 's', v: newValue };
			}
		}

		if (!isModified) {
			isModified = true;
			sheetInfoSpan.textContent += ' - Modified (Ctrl+S to save)';
		}

		console.log(`[XLSX Webview] Cell ${cellAddress} updated to: ${newValue}`);
	}

	function handleCellClick(cell, event) {
		// Remove previous selection
		const previousSelected = container.querySelector('td.selected');
		if (previousSelected) {
			previousSelected.classList.remove('selected');
		}

		// Add selection to clicked cell
		cell.classList.add('selected');

		// Get cell reference (A1 notation)
		const table = cell.closest('table');
		const rowIndex = Array.from(table.rows).indexOf(cell.parentElement);
		const colIndex = Array.from(cell.parentElement.cells).indexOf(cell);

		// Convert to A1 notation
		const cellRef = XLSX.utils.encode_cell({ r: rowIndex - 1, c: colIndex });
		cellRefSpan.textContent = cellRef;

		// Get cell content
		const cellText = cell.textContent.trim();

		// Notify host about selection
		if (cellText) {
			vscode.postMessage({
				type: 'cellSelected',
				selection: {
					sheet: workbook.SheetNames[currentSheetIndex],
					sheetIndex: currentSheetIndex,
					range: cellRef,
					text: cellText
				}
			});
		}
	}

	// Zoom controls
	zoomInBtn.addEventListener('click', () => {
		if (zoomLevel < 200) {
			zoomLevel += 10;
			updateZoom();
		}
	});

	zoomOutBtn.addEventListener('click', () => {
		if (zoomLevel > 50) {
			zoomLevel -= 10;
			updateZoom();
		}
	});

	function updateZoom() {
		zoomLevelSpan.textContent = `${zoomLevel}%`;
		const table = container.querySelector('table');
		if (table) {
			table.style.transform = `scale(${zoomLevel / 100})`;
		}
	}

	// Selection change handler (for range selections in future)
	document.addEventListener('selectionchange', () => {
		const selection = window.getSelection();
		if (selection && !selection.isCollapsed) {
			const selectedText = selection.toString().trim();
			if (selectedText) {
				// Could implement range selection here
			}
		} else {
			vscode.postMessage({ type: 'clearSelection' });
		}
	});

	// Save shortcut (Ctrl+S or Cmd+S)
	document.addEventListener('keydown', (e) => {
		if ((e.ctrlKey || e.metaKey) && e.key === 's') {
			e.preventDefault();
			saveSpreadsheet();
		}
	});

	function saveSpreadsheet() {
		if (!workbook || !isModified) {
			return;
		}

		try {
			// Convert workbook to binary
			const wbout = XLSX.write(workbook, {
				bookType: 'xlsx',
				type: 'array'
			});

			// Convert to base64
			const base64 = btoa(
				new Uint8Array(wbout).reduce((data, byte) => data + String.fromCharCode(byte), '')
			);

			// Send to host
			vscode.postMessage({
				type: 'saveRequested',
				data: base64
			});

			isModified = false;
			const range = XLSX.utils.decode_range(workbook.Sheets[workbook.SheetNames[currentSheetIndex]]['!ref'] || 'A1');
			const rows = range.e.r - range.s.r + 1;
			const cols = range.e.c - range.s.c + 1;
			sheetInfoSpan.textContent = `${rows} rows × ${cols} columns - Saved!`;

			setTimeout(() => {
				if (!isModified) {
					sheetInfoSpan.textContent = `${rows} rows × ${cols} columns - Click any cell to edit`;
				}
			}, 2000);

		} catch (error) {
			console.error('[XLSX Webview] Failed to save:', error);
			sheetInfoSpan.textContent = 'Save failed: ' + error.message;
		}
	}

	// ===== AGENT EDIT OPERATIONS =====

	/**
	 * Execute document operations from agent tool calls
	 */
	function executeDocumentOperations(operations) {
		if (!workbook || !Array.isArray(operations)) {
			console.warn('[XLSX Webview] Cannot execute operations: workbook not loaded or invalid operations');
			return;
		}

		console.log(`[XLSX Webview] Executing ${operations.length} operation(s)`);

		operations.forEach(op => {
			try {
				switch (op.type) {
					case 'set_cell_value':
						setCellValue(op.sheet, op.cell, op.value);
						break;
					case 'set_cell_formula':
						setCellFormula(op.sheet, op.cell, op.formula);
						break;
					case 'format_cell':
						formatCell(op.sheet, op.cell, op.format);
						break;
					case 'insert_row':
						insertRow(op.sheet, op.rowIndex);
						break;
					case 'insert_column':
						insertColumn(op.sheet, op.colIndex);
						break;
					case 'delete_row':
						deleteRow(op.sheet, op.rowIndex);
						break;
					case 'delete_column':
						deleteColumn(op.sheet, op.colIndex);
						break;
					default:
						console.warn(`[XLSX Webview] Unknown operation type: ${op.type}`);
				}
			} catch (error) {
				console.error(`[XLSX Webview] Error executing operation ${op.type}:`, error);
			}
		});

		// Mark as modified
		isModified = true;

		// Re-render the current sheet
		renderSheet(currentSheetIndex);

		sheetInfoSpan.textContent += ` - Modified (${operations.length} operation(s) applied)`;
	}

	/**
	 * Set a cell value
	 */
	function setCellValue(sheet, cell, value) {
		const sheetIndex = typeof sheet === 'number' ? sheet : workbook.SheetNames.indexOf(sheet);
		if (sheetIndex === -1) {
			console.warn(`[XLSX Webview] Sheet not found: ${sheet}`);
			return;
		}

		const worksheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];

		// Parse value type
		const numValue = parseFloat(value);
		if (!isNaN(numValue) && value === numValue.toString()) {
			worksheet[cell] = { t: 'n', v: numValue };
		} else {
			worksheet[cell] = { t: 's', v: value };
		}

		console.log(`[XLSX Webview] Set cell ${cell} to: ${value}`);
	}

	/**
	 * Set a cell formula
	 */
	function setCellFormula(sheet, cell, formula) {
		const sheetIndex = typeof sheet === 'number' ? sheet : workbook.SheetNames.indexOf(sheet);
		if (sheetIndex === -1) {
			console.warn(`[XLSX Webview] Sheet not found: ${sheet}`);
			return;
		}

		const worksheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];
		worksheet[cell] = { t: 'n', f: formula };

		console.log(`[XLSX Webview] Set cell ${cell} formula to: ${formula}`);
	}

	/**
	 * Format a cell
	 */
	function formatCell(sheet, cell, format) {
		// Note: SheetJS has limited formatting support
		// This is a placeholder for future implementation
		console.log(`[XLSX Webview] Format cell ${cell} (limited support):`, format);
	}

	/**
	 * Insert a row
	 */
	function insertRow(sheet, rowIndex) {
		const sheetIndex = typeof sheet === 'number' ? sheet : workbook.SheetNames.indexOf(sheet);
		if (sheetIndex === -1) {
			console.warn(`[XLSX Webview] Sheet not found: ${sheet}`);
			return;
		}

		// Note: Row insertion requires shifting all cells below
		// This is a simplified placeholder
		console.log(`[XLSX Webview] Insert row at index ${rowIndex} (simplified)`);
	}

	/**
	 * Insert a column
	 */
	function insertColumn(sheet, colIndex) {
		const sheetIndex = typeof sheet === 'number' ? sheet : workbook.SheetNames.indexOf(sheet);
		if (sheetIndex === -1) {
			console.warn(`[XLSX Webview] Sheet not found: ${sheet}`);
			return;
		}

		// Note: Column insertion requires shifting all cells to the right
		// This is a simplified placeholder
		console.log(`[XLSX Webview] Insert column at index ${colIndex} (simplified)`);
	}

	/**
	 * Delete a row
	 */
	function deleteRow(sheet, rowIndex) {
		console.log(`[XLSX Webview] Delete row at index ${rowIndex} (simplified)`);
	}

	/**
	 * Delete a column
	 */
	function deleteColumn(sheet, colIndex) {
		console.log(`[XLSX Webview] Delete column at index ${colIndex} (simplified)`);
	}

})();


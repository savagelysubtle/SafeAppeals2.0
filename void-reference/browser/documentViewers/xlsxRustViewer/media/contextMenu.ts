// Custom HTML Context Menu for XLSX Rust Viewer

import type { HyperlinkDef } from './renderer.js';

export interface ContextMenuEvent {
	action: string;
	row: number;
	col: number;
	tableName?: string;
	value?: string;
}

export interface ContextMenuSelectionRange {
	startRow: number;
	startCol: number;
	endRow: number;
	endCol: number;
}

interface MenuItem {
	action: string;
	label: string;
	shortcut?: string;
}

export interface TableInfo {
	name: string;
	has_totals_row: boolean;
	has_header_row: boolean;
	filter_enabled: boolean;
	column_count: number;
}

export class ContextMenu {
	private menu: HTMLElement;
	private onAction: (event: ContextMenuEvent) => void;
	private currentRow: number = 0;
	private currentCol: number = 0;
	private currentSelection: ContextMenuSelectionRange | null = null;
	private getTableAtCell: ((row: number, col: number) => TableInfo | null) | null = null;
	private getHyperlinkAtCell: ((row: number, col: number) => HyperlinkDef | undefined) | null = null;
	private getPivotAtCell: ((row: number, col: number) => number) | null = null;
	private _isColHidden: ((col: number) => boolean) | null = null;
	private _isRowHidden: ((row: number) => boolean) | null = null;
	private _hasHiddenCols: (() => boolean) | null = null;
	private _hasHiddenRows: (() => boolean) | null = null;

	constructor(container: HTMLElement, onAction: (event: ContextMenuEvent) => void) {
		this.onAction = onAction;
		this.menu = document.createElement('div');
		this.menu.className = 'xlsx-context-menu';
		this.menu.style.display = 'none';
		container.appendChild(this.menu);

		// Hide on click outside
		document.addEventListener('mousedown', (e) => {
			if (!this.menu.contains(e.target as Node)) {
				this.hide();
			}
		});

		// Hide on Escape or scroll
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') this.hide();
		});
	}

	/** Register a function that detects if a cell is inside a table */
	setTableDetector(fn: (row: number, col: number) => TableInfo | null) {
		this.getTableAtCell = fn;
	}

	/** Register a function that returns the hyperlink (if any) at a cell */
	setHyperlinkDetector(fn: (row: number, col: number) => HyperlinkDef | undefined) {
		this.getHyperlinkAtCell = fn;
	}

	/** Register a function that returns the pivot index (-1 if none) at a cell */
	setPivotDetector(fn: (row: number, col: number) => number) {
		this.getPivotAtCell = fn;
	}

	/** Register callbacks for hidden column/row state detection */
	setHiddenDetectors(
		isColHidden: (col: number) => boolean,
		isRowHidden: (row: number) => boolean,
		hasHiddenCols: () => boolean,
		hasHiddenRows: () => boolean,
	) {
		this._isColHidden = isColHidden;
		this._isRowHidden = isRowHidden;
		this._hasHiddenCols = hasHiddenCols;
		this._hasHiddenRows = hasHiddenRows;
	}

	show(x: number, y: number, row: number, col: number, headerType?: 'col' | 'row', selectionRange?: ContextMenuSelectionRange) {
		this.currentRow = row;
		this.currentCol = col;
		this.currentSelection = selectionRange ?? null;
		this.buildMenu(row, col, headerType);

		this.menu.style.left = `${x}px`;
		this.menu.style.top = `${y}px`;
		this.menu.style.display = 'block';

		// Ensure menu stays within viewport on all four sides
		requestAnimationFrame(() => {
			const rect = this.menu.getBoundingClientRect();

			let newLeft = x;
			let newTop = y;

			if (rect.right > window.innerWidth) {
				newLeft = x - rect.width;
			}
			if (rect.bottom > window.innerHeight) {
				newTop = y - rect.height;
			}

			// Clamp so the menu never clips above or to the left of the viewport
			if (newTop < 0) {
				newTop = 0;
			}
			if (newLeft < 0) {
				newLeft = 0;
			}

			this.menu.style.left = `${newLeft}px`;
			this.menu.style.top = `${newTop}px`;
		});
	}

	hide() {
		this.menu.style.display = 'none';
	}

	private buildMenu(row: number, col: number, headerType?: 'col' | 'row') {
		const colName = this.getColName(col);
		this.menu.innerHTML = '';

		let items: (MenuItem | null)[];
		let tableInfo: TableInfo | null = null;

		const sel = this.currentSelection;
		const multiColSelected = sel && Math.abs(sel.endCol - sel.startCol) > 0;
		const multiRowSelected = sel && Math.abs(sel.endRow - sel.startRow) > 0;

		if (headerType === 'col') {
			// Column header right-click menu
			const autoFitItem: MenuItem = multiColSelected
				? { action: 'autoFitSelectedCols', label: 'Auto-Fit Selected Columns' }
				: { action: 'colWidthAuto', label: 'Auto-Fit Column Width' };
			const isHidden = this._isColHidden ? this._isColHidden(col) : false;
			const hasHidden = this._hasHiddenCols ? this._hasHiddenCols() : false;
			const hideUnhideItems: (MenuItem | null)[] = isHidden
				? [{ action: 'unhideCol', label: `Unhide Column ${colName}` }]
				: [{ action: 'hideCol', label: `Hide Column ${colName}` }];
			if (hasHidden) {
				hideUnhideItems.push({ action: 'unhideAllCols', label: 'Unhide All Columns' });
			}
			items = [
				{ action: 'insertColLeft', label: `Insert Column Left` },
				{ action: 'insertColRight', label: `Insert Column Right` },
				null,
				{ action: 'deleteCol', label: `Delete Column ${colName}` },
				{ action: 'clearCol', label: `Clear Column ${colName}` },
				null,
				...hideUnhideItems,
				null,
				{ action: 'groupCols', label: 'Group Selected Columns' },
				{ action: 'ungroupCols', label: 'Ungroup Selected Columns' },
				null,
				autoFitItem,
				null,
				{ action: 'sortAZ', label: 'Sort A to Z' },
				{ action: 'sortZA', label: 'Sort Z to A' },
			];
		} else if (headerType === 'row') {
			// Row header right-click menu
			const autoFitItem: MenuItem = multiRowSelected
				? { action: 'autoFitSelectedRows', label: 'Auto-Fit Selected Rows' }
				: { action: 'rowHeightAuto', label: 'Auto-Fit Row Height' };
			const isHidden = this._isRowHidden ? this._isRowHidden(row) : false;
			const hasHidden = this._hasHiddenRows ? this._hasHiddenRows() : false;
			const hideUnhideItems: (MenuItem | null)[] = isHidden
				? [{ action: 'unhideRow', label: `Unhide Row ${row + 1}` }]
				: [{ action: 'hideRow', label: `Hide Row ${row + 1}` }];
			if (hasHidden) {
				hideUnhideItems.push({ action: 'unhideAllRows', label: 'Unhide All Rows' });
			}
			items = [
				{ action: 'insertRowAbove', label: 'Insert Row Above' },
				{ action: 'insertRowBelow', label: 'Insert Row Below' },
				null,
				{ action: 'deleteRow', label: `Delete Row ${row + 1}` },
				{ action: 'clearRow', label: `Clear Row ${row + 1}` },
				null,
				...hideUnhideItems,
				null,
				{ action: 'groupRows', label: 'Group Selected Rows' },
				{ action: 'ungroupRows', label: 'Ungroup Selected Rows' },
				null,
				autoFitItem,
			];
		} else {
			// Normal cell right-click menu
			const existingHyperlink = this.getHyperlinkAtCell ? this.getHyperlinkAtCell(row, col) : undefined;
			const hyperlinkItems: (MenuItem | null)[] = existingHyperlink
				? [
					{ action: 'editHyperlink', label: 'Edit Hyperlink...' },
					{ action: 'removeHyperlink', label: 'Remove Hyperlink' },
				  ]
				: [
					{ action: 'insertHyperlink', label: 'Insert Hyperlink...' },
				  ];

			items = [
				{ action: 'cut', label: 'Cut', shortcut: 'Ctrl+X' },
				{ action: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
				{ action: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
				{ action: 'pasteSpecial', label: 'Paste Special...', shortcut: 'Ctrl+Shift+V' },
				null,
				{ action: 'insertRowAbove', label: 'Insert Row Above' },
				{ action: 'insertRowBelow', label: 'Insert Row Below' },
				{ action: 'insertColLeft', label: 'Insert Column Left' },
				{ action: 'insertColRight', label: 'Insert Column Right' },
				null,
				{ action: 'deleteRow', label: `Delete Row ${row + 1}` },
				{ action: 'deleteCol', label: `Delete Column ${colName}` },
				null,
				{ action: 'clear', label: 'Clear Contents', shortcut: 'Del' },
				{ action: 'formatCells', label: 'Format Cells...' },
				null,
				...hyperlinkItems,
				null,
				{ action: 'defineName', label: 'Define Name...' },
				{ action: 'insertPivotTable', label: 'Insert PivotTable...' },
				null,
				{ action: 'sortAZ', label: 'Sort A to Z' },
				{ action: 'sortZA', label: 'Sort Z to A' },
			];

			// Check if cell is inside a table
			tableInfo = this.getTableAtCell ? this.getTableAtCell(row, col) : null;

			if (tableInfo) {
				items.push(null);
				items.push({ action: 'tableInsertColLeft', label: 'Insert Table Column Left' });
				items.push({ action: 'tableInsertColRight', label: 'Insert Table Column Right' });
				if (tableInfo.column_count > 1) {
					items.push({ action: 'tableDeleteCol', label: 'Delete Table Column' });
				}
				items.push(null);
				items.push({ action: 'tableRename', label: `Rename Table "${tableInfo.name}"...` });
				items.push({ action: 'tableResize', label: 'Resize Table...' });
				items.push({ action: 'tableToggleHeaders', label: tableInfo.has_header_row ? 'Hide Header Row' : 'Show Header Row' });
				items.push({ action: 'tableToggleTotals', label: tableInfo.has_totals_row ? 'Remove Totals Row' : 'Add Totals Row' });
				items.push({ action: 'tableToggleFilter', label: tableInfo.filter_enabled ? 'Remove Filter' : 'Add Filter' });
				items.push({ action: 'tableConvertToRange', label: 'Convert to Range' });
				items.push(null);
				items.push({ action: 'tableDelete', label: `Delete Table "${tableInfo.name}"` });
			}

			// Check if cell is inside a pivot table output zone
			const pivotIndex = this.getPivotAtCell ? this.getPivotAtCell(row, col) : -1;
			if (pivotIndex >= 0) {
				items.push(null);
				items.push({ action: 'refreshPivot', label: 'Refresh PivotTable' });
				items.push({ action: 'editPivot', label: 'Edit PivotTable...' });
				items.push({ action: 'drillDown', label: 'Show Details (Drill Down)' });
				items.push(null);
				items.push({ action: 'deletePivot', label: 'Delete PivotTable' });
			}
		}

		for (const item of items) {
			if (item === null) {
				const sep = document.createElement('div');
				sep.className = 'ctx-separator';
				this.menu.appendChild(sep);
			} else {
				const el = document.createElement('div');
				el.className = 'ctx-item';
				const label = document.createElement('span');
				label.className = 'ctx-label';
				label.textContent = item.label;
				el.appendChild(label);
				if (item.shortcut) {
					const sc = document.createElement('span');
					sc.className = 'ctx-shortcut';
					sc.textContent = item.shortcut;
					el.appendChild(sc);
				}
				el.onclick = () => {
					this.onAction({
						action: item.action,
						row: this.currentRow,
						col: this.currentCol,
						tableName: tableInfo?.name,
					});
					this.hide();
				};
				this.menu.appendChild(el);
			}
		}
	}

	private getColName(n: number): string {
		let s = '';
		let idx = n;
		while (idx >= 0) {
			s = String.fromCharCode((idx % 26) + 65) + s;
			idx = Math.floor(idx / 26) - 1;
		}
		return s;
	}
}

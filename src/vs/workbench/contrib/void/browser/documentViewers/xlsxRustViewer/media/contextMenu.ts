// Custom HTML Context Menu for XLSX Rust Viewer

export interface ContextMenuEvent {
	action: string;
	row: number;
	col: number;
	tableName?: string;
	value?: string;
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
	private getTableAtCell: ((row: number, col: number) => TableInfo | null) | null = null;

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

	show(x: number, y: number, row: number, col: number, headerType?: 'col' | 'row') {
		this.currentRow = row;
		this.currentCol = col;
		this.buildMenu(row, col, headerType);

		this.menu.style.left = `${x}px`;
		this.menu.style.top = `${y}px`;
		this.menu.style.display = 'block';

		// Ensure menu stays within viewport
		requestAnimationFrame(() => {
			const rect = this.menu.getBoundingClientRect();
			if (rect.right > window.innerWidth) {
				this.menu.style.left = `${x - rect.width}px`;
			}
			if (rect.bottom > window.innerHeight) {
				this.menu.style.top = `${y - rect.height}px`;
			}
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

		if (headerType === 'col') {
			// Column header right-click menu
			items = [
				{ action: 'insertColLeft', label: `Insert Column Left` },
				{ action: 'insertColRight', label: `Insert Column Right` },
				null,
				{ action: 'deleteCol', label: `Delete Column ${colName}` },
				{ action: 'clearCol', label: `Clear Column ${colName}` },
				null,
				{ action: 'hideCol', label: `Hide Column ${colName}` },
				null,
				{ action: 'colWidthAuto', label: 'Auto-Fit Column Width' },
				null,
				{ action: 'sortAZ', label: 'Sort A to Z' },
				{ action: 'sortZA', label: 'Sort Z to A' },
			];
		} else if (headerType === 'row') {
			// Row header right-click menu
			items = [
				{ action: 'insertRowAbove', label: 'Insert Row Above' },
				{ action: 'insertRowBelow', label: 'Insert Row Below' },
				null,
				{ action: 'deleteRow', label: `Delete Row ${row + 1}` },
				{ action: 'clearRow', label: `Clear Row ${row + 1}` },
				null,
				{ action: 'hideRow', label: `Hide Row ${row + 1}` },
				null,
				{ action: 'rowHeightAuto', label: 'Auto-Fit Row Height' },
			];
		} else {
			// Normal cell right-click menu
			items = [
				{ action: 'cut', label: 'Cut', shortcut: 'Ctrl+X' },
				{ action: 'copy', label: 'Copy', shortcut: 'Ctrl+C' },
				{ action: 'paste', label: 'Paste', shortcut: 'Ctrl+V' },
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

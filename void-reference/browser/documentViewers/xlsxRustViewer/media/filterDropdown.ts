// Filter Dropdown for XLSX Rust Viewer table column headers
// Provides sort, search, and checkbox-based value filtering (mimics Excel's filter dropdown)

export interface FilterDropdownEvent {
	action: 'sortAZ' | 'sortZA' | 'filter' | 'clearFilter';
	tableName: string;
	colIndex: number;
	/** For 'filter' action: the set of allowed values (unchecked values are hidden) */
	allowedValues?: Set<string>;
}

export class FilterDropdown {
	private container: HTMLElement;
	private onAction: (event: FilterDropdownEvent) => void;

	private tableName = '';
	private colIndex = 0;
	private allValues: string[] = [];
	private checkedValues: Set<string> = new Set();

	private searchInput!: HTMLInputElement;
	private checkboxList!: HTMLElement;
	private selectAllCheckbox!: HTMLInputElement;

	constructor(parent: HTMLElement, onAction: (event: FilterDropdownEvent) => void) {
		this.onAction = onAction;
		this.container = document.createElement('div');
		this.container.className = 'xlsx-filter-dropdown';
		this.container.style.display = 'none';
		parent.appendChild(this.container);

		// Hide on click outside
		document.addEventListener('mousedown', (e) => {
			if (this.container.style.display !== 'none' && !this.container.contains(e.target as Node)) {
				this.hide();
			}
		});

		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape' && this.container.style.display !== 'none') {
				this.hide();
			}
		});
	}

	show(x: number, y: number, tableName: string, colIndex: number, colName: string, uniqueValues: string[], currentFilter?: Set<string>) {
		this.tableName = tableName;
		this.colIndex = colIndex;
		this.allValues = uniqueValues;
		this.checkedValues = currentFilter ? new Set(currentFilter) : new Set(uniqueValues);

		this.container.innerHTML = '';
		this.buildUI(colName);

		this.container.style.left = `${x}px`;
		this.container.style.top = `${y}px`;
		this.container.style.display = 'block';

		// Ensure dropdown stays within viewport
		requestAnimationFrame(() => {
			const rect = this.container.getBoundingClientRect();
			if (rect.right > window.innerWidth) {
				this.container.style.left = `${x - rect.width}px`;
			}
			if (rect.bottom > window.innerHeight) {
				this.container.style.top = `${y - rect.height}px`;
			}
		});

		this.searchInput.focus();
	}

	hide() {
		this.container.style.display = 'none';
	}

	private buildUI(colName: string) {
		// Sort buttons
		const sortSection = document.createElement('div');
		sortSection.className = 'filter-sort-section';

		const sortAZ = this.createSortItem('↑ Sort A to Z', 'sortAZ');
		const sortZA = this.createSortItem('↓ Sort Z to A', 'sortZA');
		sortSection.appendChild(sortAZ);
		sortSection.appendChild(sortZA);
		this.container.appendChild(sortSection);

		this.addSeparator();

		// Clear filter item
		const clearItem = document.createElement('div');
		clearItem.className = 'filter-item filter-clear';
		clearItem.textContent = `Clear Filter From "${colName}"`;
		clearItem.onclick = () => {
			this.onAction({
				action: 'clearFilter',
				tableName: this.tableName,
				colIndex: this.colIndex,
			});
			this.hide();
		};
		this.container.appendChild(clearItem);

		this.addSeparator();

		// Search box
		this.searchInput = document.createElement('input');
		this.searchInput.className = 'filter-search';
		this.searchInput.type = 'text';
		this.searchInput.placeholder = 'Search';
		this.searchInput.addEventListener('input', () => this.filterCheckboxList());
		this.container.appendChild(this.searchInput);

		// Select All checkbox
		const selectAllRow = document.createElement('label');
		selectAllRow.className = 'filter-checkbox-row filter-select-all';
		this.selectAllCheckbox = document.createElement('input');
		this.selectAllCheckbox.type = 'checkbox';
		this.selectAllCheckbox.checked = this.checkedValues.size === this.allValues.length;
		this.selectAllCheckbox.addEventListener('change', () => this.toggleSelectAll());
		const selectAllLabel = document.createElement('span');
		selectAllLabel.textContent = '(Select All)';
		selectAllRow.appendChild(this.selectAllCheckbox);
		selectAllRow.appendChild(selectAllLabel);
		this.container.appendChild(selectAllRow);

		// Scrollable checkbox list
		this.checkboxList = document.createElement('div');
		this.checkboxList.className = 'filter-checkbox-list';
		this.populateCheckboxes(this.allValues);
		this.container.appendChild(this.checkboxList);

		this.addSeparator();

		// OK / Cancel buttons
		const btnRow = document.createElement('div');
		btnRow.className = 'filter-btn-row';

		const okBtn = document.createElement('button');
		okBtn.className = 'filter-btn filter-btn-ok';
		okBtn.textContent = 'OK';
		okBtn.onclick = () => this.applyFilter();

		const cancelBtn = document.createElement('button');
		cancelBtn.className = 'filter-btn filter-btn-cancel';
		cancelBtn.textContent = 'Cancel';
		cancelBtn.onclick = () => this.hide();

		btnRow.appendChild(okBtn);
		btnRow.appendChild(cancelBtn);
		this.container.appendChild(btnRow);
	}

	private createSortItem(label: string, action: 'sortAZ' | 'sortZA'): HTMLElement {
		const el = document.createElement('div');
		el.className = 'filter-item';
		el.textContent = label;
		el.onclick = () => {
			this.onAction({
				action,
				tableName: this.tableName,
				colIndex: this.colIndex,
			});
			this.hide();
		};
		return el;
	}

	private addSeparator() {
		const sep = document.createElement('div');
		sep.className = 'filter-separator';
		this.container.appendChild(sep);
	}

	private populateCheckboxes(values: string[]) {
		this.checkboxList.innerHTML = '';
		for (const val of values) {
			const row = document.createElement('label');
			row.className = 'filter-checkbox-row';
			const cb = document.createElement('input');
			cb.type = 'checkbox';
			cb.checked = this.checkedValues.has(val);
			cb.dataset.value = val;
			cb.addEventListener('change', () => {
				if (cb.checked) {
					this.checkedValues.add(val);
				} else {
					this.checkedValues.delete(val);
				}
				this.updateSelectAll();
			});
			const label = document.createElement('span');
			label.textContent = val === '' ? '(Blanks)' : val;
			if (val === '') label.style.fontStyle = 'italic';
			row.appendChild(cb);
			row.appendChild(label);
			this.checkboxList.appendChild(row);
		}
	}

	private filterCheckboxList() {
		const query = this.searchInput.value.toLowerCase();
		const filtered = query
			? this.allValues.filter(v => v.toLowerCase().includes(query))
			: this.allValues;
		this.populateCheckboxes(filtered);
	}

	private toggleSelectAll() {
		const checked = this.selectAllCheckbox.checked;
		const boxes = this.checkboxList.querySelectorAll<HTMLInputElement>('input[type="checkbox"]');
		boxes.forEach(cb => {
			cb.checked = checked;
			const val = cb.dataset.value ?? '';
			if (checked) {
				this.checkedValues.add(val);
			} else {
				this.checkedValues.delete(val);
			}
		});
	}

	private updateSelectAll() {
		this.selectAllCheckbox.checked = this.checkedValues.size === this.allValues.length;
	}

	private applyFilter() {
		// If everything is checked, treat as "clear filter"
		if (this.checkedValues.size === this.allValues.length) {
			this.onAction({
				action: 'clearFilter',
				tableName: this.tableName,
				colIndex: this.colIndex,
			});
		} else {
			this.onAction({
				action: 'filter',
				tableName: this.tableName,
				colIndex: this.colIndex,
				allowedValues: new Set(this.checkedValues),
			});
		}
		this.hide();
	}
}

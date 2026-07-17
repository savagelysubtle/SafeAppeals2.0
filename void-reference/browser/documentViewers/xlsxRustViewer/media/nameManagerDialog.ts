// Name Manager Dialog for XLSX Rust Viewer
// Provides CRUD management of defined names (named ranges).

export interface DefinedNameDef {
	name: string;
	formula: string;       // reference, e.g. "Sheet1!$A$1:$C$10" or constant "0.96"
	local_sheet_id?: number; // undefined = workbook scope
	comment?: string;
	hidden?: boolean;
}

export interface NMDialogEvent {
	action: 'create' | 'edit' | 'delete' | 'close';
	name?: DefinedNameDef;
	index?: number;        // index in the defined_names array for edit/delete
}

export class NameManagerDialog {
	private container: HTMLElement;
	private onAction: (event: NMDialogEvent) => void;

	private dialog!: HTMLDivElement;
	private listBody!: HTMLTableSectionElement;
	private filterInput!: HTMLInputElement;
	private scopeFilter!: HTMLSelectElement;
	private editBtn!: HTMLButtonElement;
	private deleteBtn!: HTMLButtonElement;

	// Sub-dialog (New/Edit form)
	private subDialog!: HTMLDivElement;
	private subNameInput!: HTMLInputElement;
	private subFormulaInput!: HTMLInputElement;
	private subScopeSelect!: HTMLSelectElement;
	private subCommentInput!: HTMLInputElement;
	private subTitle!: HTMLElement;

	private names: DefinedNameDef[] = [];
	private sheetNames: string[] = [];
	private selectedRow: number = -1;   // index in filtered list -> names array idx
	private filteredIndices: number[] = [];
	private editingIndex: number = -1;  // -1 = creating new

	constructor(container: HTMLElement, onAction: (event: NMDialogEvent) => void) {
		this.container = container;
		this.onAction = onAction;
		this._build();
		this._buildSubDialog();
	}

	// --- Public API ---

	show(names: DefinedNameDef[], sheetNames: string[]): void {
		this.names = names.map(n => ({ ...n }));
		this.sheetNames = sheetNames;
		this.selectedRow = -1;
		this._rebuildScopeFilter();
		this._refreshList();
		this._updateButtons();
		this.dialog.style.display = 'flex';
	}

	hide(): void {
		this.dialog.style.display = 'none';
		this.subDialog.style.display = 'none';
	}

	isVisible(): boolean {
		return this.dialog.style.display !== 'none';
	}

	// --- Build main dialog ---

	private _build(): void {
		this.dialog = document.createElement('div');
		Object.assign(this.dialog.style, {
			display: 'none',
			position: 'fixed',
			top: '60px',
			left: '50%',
			transform: 'translateX(-50%)',
			width: '600px',
			maxHeight: '80vh',
			background: '#1e1e1e',
			border: '1px solid #555',
			borderRadius: '4px',
			boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
			zIndex: '1000',
			flexDirection: 'column',
			fontFamily: 'Segoe UI, sans-serif',
			fontSize: '13px',
			color: '#ccc',
		});

		// Title bar
		const titleBar = document.createElement('div');
		Object.assign(titleBar.style, {
			display: 'flex', alignItems: 'center', justifyContent: 'space-between',
			padding: '10px 14px', borderBottom: '1px solid #444',
			background: '#252526', borderRadius: '4px 4px 0 0', cursor: 'grab',
		});
		titleBar.innerHTML = '<span style="font-weight:600;font-size:14px;">Name Manager</span>';
		const closeBtn = this._makeBtn('✕', '#c00', '#fff');
		closeBtn.title = 'Close';
		closeBtn.addEventListener('click', () => { this.hide(); this.onAction({ action: 'close' }); });
		titleBar.appendChild(closeBtn);
		this.dialog.appendChild(titleBar);

		// Filter row
		const filterRow = document.createElement('div');
		Object.assign(filterRow.style, { display: 'flex', gap: '6px', padding: '8px 14px', borderBottom: '1px solid #444' });

		this.filterInput = document.createElement('input');
		this.filterInput.placeholder = 'Filter by name...';
		this.filterInput.type = 'text';
		Object.assign(this.filterInput.style, {
			flex: '1', padding: '3px 8px', background: '#3c3c3c', border: '1px solid #555',
			color: '#ccc', borderRadius: '3px', fontSize: '12px', outline: 'none',
		});
		this.filterInput.addEventListener('input', () => this._refreshList());
		filterRow.appendChild(this.filterInput);

		this.scopeFilter = document.createElement('select');
		Object.assign(this.scopeFilter.style, {
			padding: '3px 6px', background: '#3c3c3c', border: '1px solid #555',
			color: '#ccc', borderRadius: '3px', fontSize: '12px', outline: 'none',
		});
		this.scopeFilter.addEventListener('change', () => this._refreshList());
		filterRow.appendChild(this.scopeFilter);
		this.dialog.appendChild(filterRow);

		// Table
		const tableWrap = document.createElement('div');
		Object.assign(tableWrap.style, { flex: '1', overflowY: 'auto', padding: '0 14px' });

		const table = document.createElement('table');
		Object.assign(table.style, { width: '100%', borderCollapse: 'collapse', marginTop: '6px' });

		const thead = table.createTHead();
		const headRow = thead.insertRow();
		for (const col of ['Name', 'Refers To', 'Scope', 'Comment']) {
			const th = document.createElement('th');
			th.textContent = col;
			Object.assign(th.style, {
				textAlign: 'left', padding: '4px 8px', fontSize: '11px',
				color: '#888', borderBottom: '1px solid #444', fontWeight: '600',
			});
			headRow.appendChild(th);
		}

		this.listBody = table.createTBody();
		table.appendChild(this.listBody);
		tableWrap.appendChild(table);
		this.dialog.appendChild(tableWrap);

		// Action buttons row
		const btnRow = document.createElement('div');
		Object.assign(btnRow.style, {
			display: 'flex', gap: '8px', padding: '10px 14px',
			borderTop: '1px solid #444', background: '#252526',
		});

		const newBtn = this._makeBtn('New...', '#0e639c', '#fff');
		newBtn.addEventListener('click', () => this._openSubDialog(-1));

		this.editBtn = this._makeBtn('Edit...', '#0e639c', '#fff');
		this.editBtn.disabled = true;
		this.editBtn.addEventListener('click', () => {
			if (this.selectedRow >= 0 && this.filteredIndices[this.selectedRow] !== undefined) {
				this._openSubDialog(this.filteredIndices[this.selectedRow]);
			}
		});

		this.deleteBtn = this._makeBtn('Delete', '#8b0000', '#fff');
		this.deleteBtn.disabled = true;
		this.deleteBtn.addEventListener('click', () => this._deleteSelected());

		const closeFooterBtn = this._makeBtn('Close', '#555', '#ccc');
		closeFooterBtn.style.marginLeft = 'auto';
		closeFooterBtn.addEventListener('click', () => { this.hide(); this.onAction({ action: 'close' }); });

		btnRow.append(newBtn, this.editBtn, this.deleteBtn, closeFooterBtn);
		this.dialog.appendChild(btnRow);

		this.container.appendChild(this.dialog);
		this._makeDraggable(titleBar);
	}

	// --- Build sub-dialog (New/Edit form) ---

	private _buildSubDialog(): void {
		this.subDialog = document.createElement('div');
		Object.assign(this.subDialog.style, {
			display: 'none',
			position: 'fixed',
			top: '120px',
			left: '50%',
			transform: 'translateX(-50%)',
			width: '380px',
			background: '#1e1e1e',
			border: '1px solid #555',
			borderRadius: '4px',
			boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
			zIndex: '1010',
			flexDirection: 'column',
			fontFamily: 'Segoe UI, sans-serif',
			fontSize: '13px',
			color: '#ccc',
		});

		const titleBar = document.createElement('div');
		Object.assign(titleBar.style, {
			display: 'flex', alignItems: 'center', justifyContent: 'space-between',
			padding: '8px 12px', borderBottom: '1px solid #444',
			background: '#252526', cursor: 'grab',
		});
		this.subTitle = document.createElement('span');
		this.subTitle.textContent = 'New Name';
		this.subTitle.style.fontWeight = '600';
		titleBar.appendChild(this.subTitle);
		const closeSubBtn = this._makeBtn('✕', '#c00', '#fff');
		closeSubBtn.addEventListener('click', () => { this.subDialog.style.display = 'none'; });
		titleBar.appendChild(closeSubBtn);
		this.subDialog.appendChild(titleBar);

		const body = document.createElement('div');
		body.style.padding = '14px';

		const addField = (label: string): HTMLInputElement => {
			const wrap = document.createElement('div');
			wrap.style.marginBottom = '10px';
			const lbl = document.createElement('label');
			lbl.textContent = label;
			lbl.style.cssText = 'display:block;font-size:11px;color:#888;margin-bottom:3px;';
			const inp = document.createElement('input');
			inp.type = 'text';
			Object.assign(inp.style, {
				width: '100%', boxSizing: 'border-box', padding: '4px 8px',
				background: '#3c3c3c', border: '1px solid #555', color: '#ccc',
				borderRadius: '3px', fontSize: '12px', outline: 'none',
			});
			wrap.appendChild(lbl);
			wrap.appendChild(inp);
			body.appendChild(wrap);
			return inp;
		};

		this.subNameInput = addField('Name:');
		this.subNameInput.placeholder = 'e.g. SalesTotal';

		// Scope selector
		const scopeWrap = document.createElement('div');
		scopeWrap.style.marginBottom = '10px';
		const scopeLbl = document.createElement('label');
		scopeLbl.textContent = 'Scope:';
		scopeLbl.style.cssText = 'display:block;font-size:11px;color:#888;margin-bottom:3px;';
		this.subScopeSelect = document.createElement('select');
		Object.assign(this.subScopeSelect.style, {
			width: '100%', padding: '4px 8px', background: '#3c3c3c',
			border: '1px solid #555', color: '#ccc', borderRadius: '3px',
			fontSize: '12px', outline: 'none',
		});
		scopeWrap.appendChild(scopeLbl);
		scopeWrap.appendChild(this.subScopeSelect);
		body.appendChild(scopeWrap);

		this.subCommentInput = addField('Comment:');
		this.subFormulaInput = addField('Refers to:');
		this.subFormulaInput.placeholder = 'e.g. Sheet1!$A$1:$C$10';

		this.subDialog.appendChild(body);

		// Footer buttons
		const footer = document.createElement('div');
		Object.assign(footer.style, {
			display: 'flex', justifyContent: 'flex-end', gap: '8px',
			padding: '10px 12px', borderTop: '1px solid #444', background: '#252526',
		});
		const okBtn = this._makeBtn('OK', '#0e639c', '#fff');
		okBtn.addEventListener('click', () => this._commitSubDialog());
		const cancelBtn = this._makeBtn('Cancel', '#555', '#ccc');
		cancelBtn.addEventListener('click', () => { this.subDialog.style.display = 'none'; });
		footer.append(okBtn, cancelBtn);
		this.subDialog.appendChild(footer);

		this.container.appendChild(this.subDialog);
		this._makeDraggable(titleBar);
	}

	// --- Internal helpers ---

	private _rebuildScopeFilter(): void {
		this.scopeFilter.innerHTML = '';
		const addOpt = (val: string, label: string) => {
			const opt = document.createElement('option');
			opt.value = val;
			opt.textContent = label;
			this.scopeFilter.appendChild(opt);
		};
		addOpt('all', 'All');
		addOpt('workbook', 'Workbook');
		for (const s of this.sheetNames) addOpt(s, s);
	}

	private _refreshList(): void {
		const filter = this.filterInput.value.toLowerCase();
		const scope = this.scopeFilter.value;

		this.filteredIndices = [];
		for (let i = 0; i < this.names.length; i++) {
			const n = this.names[i];
			if (n.hidden) continue;
			if (filter && !n.name.toLowerCase().includes(filter)) continue;
			if (scope === 'workbook' && n.local_sheet_id !== undefined) continue;
			if (scope !== 'all' && scope !== 'workbook') {
				const sheetIdx = this.sheetNames.indexOf(scope);
				if (n.local_sheet_id !== sheetIdx) continue;
			}
			this.filteredIndices.push(i);
		}

		this.listBody.innerHTML = '';
		this.filteredIndices.forEach((nameIdx, rowIdx) => {
			const n = this.names[nameIdx];
			const tr = this.listBody.insertRow();
			Object.assign(tr.style, { cursor: 'pointer', borderBottom: '1px solid #2d2d2d' });
			if (rowIdx === this.selectedRow) tr.style.background = '#094771';

			const scopeLabel = n.local_sheet_id !== undefined
				? (this.sheetNames[n.local_sheet_id] ?? `Sheet${n.local_sheet_id}`)
				: 'Workbook';

			const cells = [n.name, n.formula, scopeLabel, n.comment ?? ''];
			for (const text of cells) {
				const td = tr.insertCell();
				td.textContent = text;
				Object.assign(td.style, { padding: '5px 8px', fontSize: '12px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' });
			}

			tr.addEventListener('click', () => {
				this.selectedRow = rowIdx;
				this._refreshList();
				this._updateButtons();
			});
			tr.addEventListener('dblclick', () => {
				this.selectedRow = rowIdx;
				this._openSubDialog(nameIdx);
			});
		});

		if (this.selectedRow >= this.filteredIndices.length) {
			this.selectedRow = -1;
			this._updateButtons();
		}
	}

	private _updateButtons(): void {
		const hasSelection = this.selectedRow >= 0;
		this.editBtn.disabled = !hasSelection;
		this.deleteBtn.disabled = !hasSelection;
	}

	private _openSubDialog(nameIndex: number): void {
		this.editingIndex = nameIndex;
		this._rebuildSubScopeOptions();

		if (nameIndex === -1) {
			// New
			this.subTitle.textContent = 'New Name';
			this.subNameInput.value = '';
			this.subFormulaInput.value = '';
			this.subCommentInput.value = '';
			this.subScopeSelect.value = 'workbook';
		} else {
			// Edit
			const n = this.names[nameIndex];
			this.subTitle.textContent = 'Edit Name';
			this.subNameInput.value = n.name;
			this.subFormulaInput.value = n.formula;
			this.subCommentInput.value = n.comment ?? '';
			if (n.local_sheet_id !== undefined) {
				this.subScopeSelect.value = String(n.local_sheet_id);
			} else {
				this.subScopeSelect.value = 'workbook';
			}
		}

		this.subDialog.style.display = 'flex';
		this.subNameInput.focus();
	}

	private _rebuildSubScopeOptions(): void {
		this.subScopeSelect.innerHTML = '';
		const addOpt = (val: string, label: string) => {
			const opt = document.createElement('option');
			opt.value = val;
			opt.textContent = label;
			this.subScopeSelect.appendChild(opt);
		};
		addOpt('workbook', 'Workbook');
		this.sheetNames.forEach((s, i) => addOpt(String(i), s));
	}

	private _commitSubDialog(): void {
		const name = this.subNameInput.value.trim();
		const formula = this.subFormulaInput.value.trim();
		if (!name || !formula) return;

		const scopeVal = this.subScopeSelect.value;
		const local_sheet_id = scopeVal === 'workbook' ? undefined : parseInt(scopeVal, 10);

		const def: DefinedNameDef = {
			name,
			formula,
			local_sheet_id,
			comment: this.subCommentInput.value.trim() || undefined,
		};

		this.subDialog.style.display = 'none';

		if (this.editingIndex === -1) {
			this.onAction({ action: 'create', name: def });
		} else {
			this.onAction({ action: 'edit', name: def, index: this.editingIndex });
		}
	}

	private _deleteSelected(): void {
		if (this.selectedRow < 0) return;
		const nameIdx = this.filteredIndices[this.selectedRow];
		if (nameIdx === undefined) return;
		const n = this.names[nameIdx];
		if (!confirm(`Delete named range "${n.name}"?`)) return;
		this.onAction({ action: 'delete', index: nameIdx });
	}

	private _makeBtn(text: string, bg: string, color: string): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.textContent = text;
		Object.assign(btn.style, {
			padding: '4px 12px', background: bg, color, border: 'none',
			borderRadius: '3px', cursor: 'pointer', fontSize: '12px',
		});
		btn.addEventListener('mouseover', () => { if (!btn.disabled) btn.style.opacity = '0.85'; });
		btn.addEventListener('mouseout', () => { btn.style.opacity = '1'; });
		return btn;
	}

	private _makeDraggable(handle: HTMLElement): void {
		let dragging = false;
		let startX = 0;
		let startY = 0;
		let origLeft = 0;
		let origTop = 0;
		const dlg = handle.closest('div[style]') as HTMLElement ?? this.dialog;

		handle.addEventListener('mousedown', (e) => {
			dragging = true;
			startX = e.clientX;
			startY = e.clientY;
			const rect = dlg.getBoundingClientRect();
			origLeft = rect.left;
			origTop = rect.top;
			dlg.style.transform = 'none';
			dlg.style.left = origLeft + 'px';
			dlg.style.top = origTop + 'px';
			e.preventDefault();
		});

		document.addEventListener('mousemove', (e) => {
			if (!dragging) return;
			dlg.style.left = (origLeft + e.clientX - startX) + 'px';
			dlg.style.top = (origTop + e.clientY - startY) + 'px';
		});

		document.addEventListener('mouseup', () => { dragging = false; });
	}
}

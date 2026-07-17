// CSV Import Dialog for XLSX Rust Viewer

export interface CsvImportEvent {
	action: 'import' | 'close';
	rows: string[][];
	newSheet: boolean;
}

type Delimiter = ',' | '\t' | ';' | '|' | string;

export class CsvImportDialog {
	private container: HTMLDivElement;
	private onAction: (event: CsvImportEvent) => void;
	private dialog!: HTMLDivElement;
	private _titleText!: HTMLSpanElement;

	private _rawContent: string = '';

	// Controls
	private delimComma!: HTMLInputElement;
	private delimTab!: HTMLInputElement;
	private delimSemicolon!: HTMLInputElement;
	private delimPipe!: HTMLInputElement;
	private delimCustom!: HTMLInputElement;
	private customDelimInput!: HTMLInputElement;
	private hasHeaderCheck!: HTMLInputElement;
	private newSheetCheck!: HTMLInputElement;
	private previewTable!: HTMLDivElement;
	private importBtn!: HTMLButtonElement;

	constructor(container: HTMLElement, onAction: (event: CsvImportEvent) => void) {
		this.container = container as HTMLDivElement;
		this.onAction = onAction;
		this._build();
	}

	private _build(): void {
		this.dialog = document.createElement('div');
		Object.assign(this.dialog.style, {
			display: 'none',
			position: 'fixed',
			top: '60px',
			left: '50%',
			transform: 'translateX(-50%)',
			width: '560px',
			maxWidth: '95vw',
			background: '#1e1e1e',
			border: '1px solid #555',
			borderRadius: '6px',
			boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
			zIndex: '9999',
			fontFamily: 'var(--vscode-font-family, system-ui, sans-serif)',
			fontSize: '13px',
			color: 'var(--vscode-editor-foreground, #d4d4d4)',
		});

		// Title bar
		const titleBar = document.createElement('div');
		Object.assign(titleBar.style, {
			padding: '10px 14px',
			borderBottom: '1px solid #444',
			fontWeight: '600',
			fontSize: '14px',
			display: 'flex',
			justifyContent: 'space-between',
			alignItems: 'center',
		});
		this._titleText = document.createElement('span');
		this._titleText.textContent = 'Import CSV / TSV';
		titleBar.appendChild(this._titleText);
		const closeBtn = document.createElement('button');
		closeBtn.textContent = '✕';
		Object.assign(closeBtn.style, { background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', fontSize: '16px' });
		closeBtn.onclick = () => this.close();
		titleBar.appendChild(closeBtn);
		this.dialog.appendChild(titleBar);

		// Body
		const body = document.createElement('div');
		body.style.padding = '14px';

		// Delimiter section
		const delimLabel = document.createElement('div');
		delimLabel.textContent = 'Delimiter';
		Object.assign(delimLabel.style, { fontWeight: '600', marginBottom: '6px' });
		body.appendChild(delimLabel);

		const delimRow = document.createElement('div');
		Object.assign(delimRow.style, { display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' });

		const makeDelimRadio = (value: string, label: string): HTMLInputElement => {
			const wrapper = document.createElement('label');
			Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' });
			const input = document.createElement('input');
			input.type = 'radio';
			input.name = 'csv-delim';
			input.value = value;
			input.onchange = () => this._updatePreview();
			wrapper.appendChild(input);
			wrapper.appendChild(document.createTextNode(label));
			delimRow.appendChild(wrapper);
			return input;
		};

		this.delimComma = makeDelimRadio(',', 'Comma');
		this.delimTab = makeDelimRadio('\t', 'Tab');
		this.delimSemicolon = makeDelimRadio(';', 'Semicolon');
		this.delimPipe = makeDelimRadio('|', 'Pipe');
		this.delimCustom = makeDelimRadio('custom', 'Custom:');
		this.delimComma.checked = true;

		this.customDelimInput = document.createElement('input');
		this.customDelimInput.type = 'text';
		this.customDelimInput.maxLength = 1;
		Object.assign(this.customDelimInput.style, {
			width: '32px',
			background: '#2d2d2d',
			border: '1px solid #555',
			borderRadius: '3px',
			color: 'inherit',
			padding: '2px 4px',
			fontSize: '12px',
		});
		this.customDelimInput.oninput = () => {
			this.delimCustom.checked = true;
			this._updatePreview();
		};
		delimRow.appendChild(this.customDelimInput);
		body.appendChild(delimRow);

		// Options row
		const optRow = document.createElement('div');
		Object.assign(optRow.style, { display: 'flex', gap: '20px', marginBottom: '12px', alignItems: 'center' });

		const makeCheckbox = (label: string): HTMLInputElement => {
			const wrapper = document.createElement('label');
			Object.assign(wrapper.style, { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' });
			const input = document.createElement('input');
			input.type = 'checkbox';
			input.onchange = () => this._updatePreview();
			wrapper.appendChild(input);
			wrapper.appendChild(document.createTextNode(label));
			optRow.appendChild(wrapper);
			return input;
		};

		this.hasHeaderCheck = makeCheckbox('First row is header');
		this.newSheetCheck = makeCheckbox('Import to new sheet');
		body.appendChild(optRow);

		// Preview section
		const previewLabel = document.createElement('div');
		previewLabel.textContent = 'Preview (first 8 rows):';
		Object.assign(previewLabel.style, { fontWeight: '600', marginBottom: '6px' });
		body.appendChild(previewLabel);

		this.previewTable = document.createElement('div');
		Object.assign(this.previewTable.style, {
			border: '1px solid #444',
			borderRadius: '4px',
			overflow: 'auto',
			maxHeight: '200px',
			marginBottom: '14px',
			background: '#252526',
		});
		body.appendChild(this.previewTable);

		// Buttons
		const btnRow = document.createElement('div');
		Object.assign(btnRow.style, { display: 'flex', justifyContent: 'flex-end', gap: '8px' });

		const cancelBtn = document.createElement('button');
		cancelBtn.textContent = 'Cancel';
		Object.assign(cancelBtn.style, this._btnStyle(false));
		cancelBtn.onclick = () => this.close();

		this.importBtn = document.createElement('button');
		this.importBtn.textContent = 'Import';
		Object.assign(this.importBtn.style, this._btnStyle(true));
		this.importBtn.onclick = () => this._doImport();

		btnRow.appendChild(cancelBtn);
		btnRow.appendChild(this.importBtn);
		body.appendChild(btnRow);

		this.dialog.appendChild(body);
		this.container.appendChild(this.dialog);
	}

	private _btnStyle(primary: boolean): Partial<CSSStyleDeclaration> {
		return {
			padding: '5px 16px',
			border: primary ? 'none' : '1px solid #555',
			borderRadius: '3px',
			cursor: 'pointer',
			background: primary ? '#0e639c' : 'transparent',
			color: 'inherit',
			fontSize: '13px',
		};
	}

	private _getDelimiter(): Delimiter {
		if (this.delimTab.checked) return '\t';
		if (this.delimSemicolon.checked) return ';';
		if (this.delimPipe.checked) return '|';
		if (this.delimCustom.checked) return this.customDelimInput.value || ',';
		return ',';
	}

	/** Full RFC-4180-ish CSV parser that handles quoted fields. */
	private _parseCsv(text: string, delim: string): string[][] {
		const rows: string[][] = [];
		const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
		for (const line of lines) {
			if (line === '' && rows.length === lines.length - 1) continue; // skip trailing newline
			const cells: string[] = [];
			let i = 0;
			while (i <= line.length) {
				if (i === line.length) { cells.push(''); break; }
				if (line[i] === '"') {
					// Quoted field
					let field = '';
					i++;
					while (i < line.length) {
						if (line[i] === '"') {
							if (line[i + 1] === '"') { field += '"'; i += 2; }
							else { i++; break; }
						} else {
							field += line[i++];
						}
					}
					cells.push(field);
					if (line[i] === delim) i++;
				} else {
					const end = line.indexOf(delim, i);
					if (end === -1) { cells.push(line.slice(i)); i = line.length + 1; }
					else { cells.push(line.slice(i, end)); i = end + 1; }
				}
			}
			rows.push(cells);
		}
		return rows;
	}

	private _updatePreview(): void {
		const delim = this._getDelimiter();
		const allRows = this._parseCsv(this._rawContent, delim);
		const isHeader = this.hasHeaderCheck.checked;
		const previewRows = allRows.slice(0, isHeader ? 9 : 8);

		// Build HTML table
		const table = document.createElement('table');
		Object.assign(table.style, {
			borderCollapse: 'collapse',
			width: '100%',
			fontSize: '12px',
		});

		previewRows.forEach((row, ri) => {
			const tr = document.createElement('tr');
			tr.style.borderBottom = '1px solid #3a3a3a';
			row.forEach(cell => {
				const td = document.createElement(isHeader && ri === 0 ? 'th' : 'td');
				td.textContent = cell;
				Object.assign(td.style, {
					padding: '3px 8px',
					borderRight: '1px solid #3a3a3a',
					whiteSpace: 'nowrap',
					fontWeight: isHeader && ri === 0 ? '600' : 'normal',
					background: isHeader && ri === 0 ? '#2a3a4a' : 'transparent',
				});
				tr.appendChild(td);
			});
			table.appendChild(tr);
		});

		this.previewTable.innerHTML = '';
		this.previewTable.appendChild(table);
	}

	/** Called by main.ts when extension host returns file content. */
	public previewFile(content: string, fileName: string): void {
		this._rawContent = content;
		// Update title to show file name
		this._titleText.textContent = fileName ? `Import: ${fileName}` : 'Import CSV / TSV';
		// Auto-detect delimiter from file name
		if (fileName.endsWith('.tsv') || fileName.endsWith('.tab')) {
			this.delimTab.checked = true;
		} else {
			this.delimComma.checked = true;
		}
		this._updatePreview();
		this.show();
	}

	private _doImport(): void {
		const delim = this._getDelimiter();
		let allRows = this._parseCsv(this._rawContent, delim);
		if (this.hasHeaderCheck.checked) {
			allRows = allRows.slice(1);
		}
		this.onAction({ action: 'import', rows: allRows, newSheet: this.newSheetCheck.checked });
		this.close();
	}

	public show(): void {
		this.dialog.style.display = 'block';
	}

	public close(): void {
		this.dialog.style.display = 'none';
		this.onAction({ action: 'close', rows: [], newSheet: false });
	}
}

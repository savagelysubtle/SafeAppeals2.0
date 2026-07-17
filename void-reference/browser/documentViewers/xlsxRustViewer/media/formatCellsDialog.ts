// Format Cells Dialog for XLSX Rust Viewer
// Four-tab dialog: Font, Alignment, Number, Fill

import type { CellStyle } from './renderer.js';

export interface FCDialogEvent {
	action: 'apply' | 'close';
	style?: CellStyle;
}

type TabId = 'font' | 'alignment' | 'number' | 'fill';

const FONT_FAMILIES = [
	'Calibri', 'Arial', 'Arial Narrow', 'Times New Roman', 'Courier New',
	'Verdana', 'Georgia', 'Trebuchet MS', 'Tahoma', 'Cambria',
	'Comic Sans MS', 'Impact', 'Palatino Linotype', 'Garamond',
];

interface NumberPreset {
	label: string;
	code: string;
	decimals?: number;
}

const NUMBER_PRESETS: NumberPreset[] = [
	{ label: 'General',           code: 'General' },
	{ label: 'Number',            code: '0',          decimals: 0 },
	{ label: 'Number (2 dec)',    code: '0.00',        decimals: 2 },
	{ label: 'Number (,sep)',     code: '#,##0',       decimals: 0 },
	{ label: 'Number (,sep 2d)', code: '#,##0.00',    decimals: 2 },
	{ label: 'Currency ($)',      code: '"$"#,##0.00', decimals: 2 },
	{ label: 'Currency ($ neg)',  code: '"$"#,##0.00;[Red]"-$"#,##0.00', decimals: 2 },
	{ label: 'Percentage',        code: '0%',          decimals: 0 },
	{ label: 'Percentage (2d)',   code: '0.00%',       decimals: 2 },
	{ label: 'Scientific',        code: '0.00E+00',    decimals: 2 },
	{ label: 'Fraction',          code: '# ?/?'  },
	{ label: 'Short Date',        code: 'M/D/YYYY' },
	{ label: 'Long Date',         code: 'MMMM D, YYYY' },
	{ label: 'Time',              code: 'H:MM:SS AM/PM' },
	{ label: 'Text',              code: '@' },
];

export class FormatCellsDialog {
	private container: HTMLDivElement;
	private onAction: (event: FCDialogEvent) => void;

	// Tab buttons
	private tabButtons: Map<TabId, HTMLButtonElement> = new Map();
	private tabContents: Map<TabId, HTMLElement> = new Map();

	// Font tab
	private fontFamilySelect!: HTMLSelectElement;
	private fontSizeInput!: HTMLInputElement;
	private boldCheck!: HTMLInputElement;
	private italicCheck!: HTMLInputElement;
	private underlineCheck!: HTMLInputElement;
	private strikeCheck!: HTMLInputElement;
	private textColorInput!: HTMLInputElement;
	private fontPreview!: HTMLDivElement;

	// Alignment tab
	private alignLeft!: HTMLButtonElement;
	private alignCenter!: HTMLButtonElement;
	private alignRight!: HTMLButtonElement;
	private wrapTextCheck!: HTMLInputElement;

	// Number tab
	private numberPresetList!: HTMLSelectElement;
	private numberCustomInput!: HTMLInputElement;
	private numberPreview!: HTMLDivElement;

	// Fill tab
	private fillColorInput!: HTMLInputElement;
	private fillNoneBtn!: HTMLButtonElement;
	private fillPreview!: HTMLDivElement;

	// Dialog root
	private dialog!: HTMLDivElement;

	constructor(container: HTMLElement, onAction: (event: FCDialogEvent) => void) {
		this.container = container as HTMLDivElement;
		this.onAction = onAction;
		this._build();
	}

	private _build(): void {
		this.dialog = document.createElement('div');
		this.dialog.className = 'fc-dialog';
		Object.assign(this.dialog.style, {
			display: 'none',
			position: 'fixed',
			top: '80px',
			left: '50%',
			transform: 'translateX(-50%)',
			width: '480px',
			background: '#1e1e1e',
			border: '1px solid #555',
			borderRadius: '6px',
			boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
			zIndex: '9999',
			fontFamily: 'system-ui, sans-serif',
			fontSize: '13px',
			color: '#ccc',
			userSelect: 'none',
		});

		// --- Title bar (draggable) ---
		const titleBar = document.createElement('div');
		Object.assign(titleBar.style, {
			display: 'flex',
			alignItems: 'center',
			justifyContent: 'space-between',
			padding: '8px 12px',
			background: '#2d2d2d',
			borderRadius: '6px 6px 0 0',
			cursor: 'move',
			borderBottom: '1px solid #444',
		});
		const title = document.createElement('span');
		title.textContent = 'Format Cells';
		title.style.fontWeight = '600';
		const closeBtn = document.createElement('button');
		closeBtn.textContent = '✕';
		Object.assign(closeBtn.style, {
			background: 'none', border: 'none', color: '#ccc',
			cursor: 'pointer', fontSize: '14px', padding: '0 4px',
		});
		closeBtn.onclick = () => this.hide();
		titleBar.appendChild(title);
		titleBar.appendChild(closeBtn);
		this.dialog.appendChild(titleBar);
		this._makeDraggable(titleBar);

		// --- Tab bar ---
		const tabBar = document.createElement('div');
		Object.assign(tabBar.style, {
			display: 'flex',
			borderBottom: '1px solid #444',
			background: '#252526',
		});
		const tabs: { id: TabId; label: string }[] = [
			{ id: 'font', label: 'Font' },
			{ id: 'alignment', label: 'Alignment' },
			{ id: 'number', label: 'Number' },
			{ id: 'fill', label: 'Fill' },
		];
		for (const tab of tabs) {
			const btn = document.createElement('button');
			btn.textContent = tab.label;
			Object.assign(btn.style, {
				background: 'none', border: 'none', color: '#aaa',
				padding: '8px 16px', cursor: 'pointer', fontSize: '13px',
				borderBottom: '2px solid transparent',
			});
			btn.onclick = () => this._switchTab(tab.id);
			tabBar.appendChild(btn);
			this.tabButtons.set(tab.id, btn);
		}
		this.dialog.appendChild(tabBar);

		// --- Tab content area ---
		const body = document.createElement('div');
		body.style.padding = '16px';

		const fontContent = this._buildFontTab();
		const alignContent = this._buildAlignmentTab();
		const numberContent = this._buildNumberTab();
		const fillContent = this._buildFillTab();

		body.appendChild(fontContent);
		body.appendChild(alignContent);
		body.appendChild(numberContent);
		body.appendChild(fillContent);

		this.tabContents.set('font', fontContent);
		this.tabContents.set('alignment', alignContent);
		this.tabContents.set('number', numberContent);
		this.tabContents.set('fill', fillContent);

		this.dialog.appendChild(body);

		// --- Footer buttons ---
		const footer = document.createElement('div');
		Object.assign(footer.style, {
			display: 'flex', justifyContent: 'flex-end', gap: '8px',
			padding: '10px 16px', borderTop: '1px solid #444', background: '#252526',
			borderRadius: '0 0 6px 6px',
		});
		const cancelBtn = document.createElement('button');
		cancelBtn.textContent = 'Cancel';
		Object.assign(cancelBtn.style, {
			padding: '5px 16px', background: '#3a3a3a', border: '1px solid #555',
			color: '#ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
		});
		cancelBtn.onclick = () => this.hide();
		const applyBtn = document.createElement('button');
		applyBtn.textContent = 'Apply';
		Object.assign(applyBtn.style, {
			padding: '5px 16px', background: '#0078d7', border: 'none',
			color: '#fff', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
		});
		applyBtn.onclick = () => this._apply();
		footer.appendChild(cancelBtn);
		footer.appendChild(applyBtn);
		this.dialog.appendChild(footer);

		this.container.appendChild(this.dialog);
		this._switchTab('font');
	}

	// ── Font Tab ────────────────────────────────────────────────────────────

	private _buildFontTab(): HTMLElement {
		const el = document.createElement('div');

		const row1 = this._row();

		// Font family
		const ffCol = this._col('Font', '200px');
		this.fontFamilySelect = document.createElement('select');
		Object.assign(this.fontFamilySelect.style, {
			width: '100%', background: '#2a2a2a', border: '1px solid #555',
			color: '#ccc', borderRadius: '3px', padding: '4px 6px', fontSize: '13px',
		});
		// Blank = "no change" placeholder
		const blankOpt = document.createElement('option');
		blankOpt.value = '';
		blankOpt.textContent = '(unchanged)';
		this.fontFamilySelect.appendChild(blankOpt);
		for (const f of FONT_FAMILIES) {
			const opt = document.createElement('option');
			opt.value = f;
			opt.textContent = f;
			opt.style.fontFamily = f;
			this.fontFamilySelect.appendChild(opt);
		}
		this.fontFamilySelect.onchange = () => this._updateFontPreview();
		ffCol.appendChild(this.fontFamilySelect);
		row1.appendChild(ffCol);

		// Font size
		const fsCol = this._col('Size', '80px');
		this.fontSizeInput = document.createElement('input');
		this.fontSizeInput.type = 'number';
		this.fontSizeInput.min = '6';
		this.fontSizeInput.max = '96';
		Object.assign(this.fontSizeInput.style, {
			width: '100%', background: '#2a2a2a', border: '1px solid #555',
			color: '#ccc', borderRadius: '3px', padding: '4px 6px', fontSize: '13px',
		});
		this.fontSizeInput.oninput = () => this._updateFontPreview();
		fsCol.appendChild(this.fontSizeInput);
		row1.appendChild(fsCol);

		// Text color
		const tcCol = this._col('Color', '80px');
		this.textColorInput = document.createElement('input');
		this.textColorInput.type = 'color';
		this.textColorInput.value = '#ffffff';
		Object.assign(this.textColorInput.style, {
			width: '100%', height: '30px', background: 'none', border: '1px solid #555',
			borderRadius: '3px', cursor: 'pointer', padding: '2px',
		});
		this.textColorInput.oninput = () => this._updateFontPreview();
		tcCol.appendChild(this.textColorInput);
		row1.appendChild(tcCol);

		el.appendChild(row1);

		// Style checkboxes
		const styleRow = this._row();
		styleRow.style.marginTop = '12px';
		styleRow.style.flexWrap = 'wrap';
		styleRow.style.gap = '12px';

		this.boldCheck = this._checkbox('Bold');
		this.italicCheck = this._checkbox('Italic');
		this.underlineCheck = this._checkbox('Underline');
		this.strikeCheck = this._checkbox('Strikethrough');

		for (const cb of [this.boldCheck, this.italicCheck, this.underlineCheck, this.strikeCheck]) {
			const wrapper = cb.parentElement!;
			styleRow.appendChild(wrapper);
			cb.onchange = () => this._updateFontPreview();
		}
		el.appendChild(styleRow);

		// Preview
		const previewLabel = document.createElement('div');
		previewLabel.textContent = 'Preview';
		previewLabel.style.cssText = 'margin-top:14px;margin-bottom:4px;color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;';
		el.appendChild(previewLabel);
		this.fontPreview = document.createElement('div');
		Object.assign(this.fontPreview.style, {
			border: '1px solid #444', borderRadius: '4px', padding: '10px 14px',
			background: '#2a2a2a', minHeight: '40px', display: 'flex',
			alignItems: 'center',
		});
		this.fontPreview.textContent = 'AaBbCcYyZz 123';
		el.appendChild(this.fontPreview);

		return el;
	}

	// ── Alignment Tab ───────────────────────────────────────────────────────

	private _buildAlignmentTab(): HTMLElement {
		const el = document.createElement('div');

		const hLabel = document.createElement('div');
		hLabel.textContent = 'Horizontal Alignment';
		hLabel.style.cssText = 'color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;';
		el.appendChild(hLabel);

		const btnRow = document.createElement('div');
		btnRow.style.cssText = 'display:flex;gap:8px;margin-bottom:20px;';

		const makeAlignBtn = (label: string, value: string): HTMLButtonElement => {
			const btn = document.createElement('button');
			btn.textContent = label;
			Object.assign(btn.style, {
				flex: '1', padding: '8px', background: '#2a2a2a', border: '1px solid #555',
				color: '#ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
			});
			btn.dataset['align'] = value;
			btn.onclick = () => this._selectAlign(value);
			return btn;
		};

		this.alignLeft   = makeAlignBtn('⬛ Left',   'left');
		this.alignCenter = makeAlignBtn('⬜ Center', 'center');
		this.alignRight  = makeAlignBtn('⬛ Right',  'right');
		btnRow.appendChild(this.alignLeft);
		btnRow.appendChild(this.alignCenter);
		btnRow.appendChild(this.alignRight);
		el.appendChild(btnRow);

		// Wrap text
		const wrapWrapper = document.createElement('label');
		wrapWrapper.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;';
		this.wrapTextCheck = document.createElement('input');
		this.wrapTextCheck.type = 'checkbox';
		wrapWrapper.appendChild(this.wrapTextCheck);
		wrapWrapper.appendChild(document.createTextNode('Wrap Text'));
		el.appendChild(wrapWrapper);

		return el;
	}

	// ── Number Tab ──────────────────────────────────────────────────────────

	private _buildNumberTab(): HTMLElement {
		const el = document.createElement('div');

		const label = document.createElement('div');
		label.textContent = 'Format';
		label.style.cssText = 'color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;';
		el.appendChild(label);

		this.numberPresetList = document.createElement('select');
		this.numberPresetList.size = 8;
		Object.assign(this.numberPresetList.style, {
			width: '100%', background: '#2a2a2a', border: '1px solid #555',
			color: '#ccc', borderRadius: '3px', fontSize: '13px', marginBottom: '12px',
		});
		for (const preset of NUMBER_PRESETS) {
			const opt = document.createElement('option');
			opt.value = preset.code;
			opt.textContent = preset.label;
			this.numberPresetList.appendChild(opt);
		}
		this.numberPresetList.onchange = () => {
			this.numberCustomInput.value = this.numberPresetList.value;
			this._updateNumberPreview();
		};
		el.appendChild(this.numberPresetList);

		const customLabel = document.createElement('div');
		customLabel.textContent = 'Format Code';
		customLabel.style.cssText = 'color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;';
		el.appendChild(customLabel);

		this.numberCustomInput = document.createElement('input');
		this.numberCustomInput.type = 'text';
		this.numberCustomInput.placeholder = 'e.g. #,##0.00';
		Object.assign(this.numberCustomInput.style, {
			width: '100%', background: '#2a2a2a', border: '1px solid #555',
			color: '#ccc', borderRadius: '3px', padding: '4px 8px', fontSize: '13px',
			boxSizing: 'border-box', marginBottom: '12px',
		});
		this.numberCustomInput.oninput = () => this._updateNumberPreview();
		el.appendChild(this.numberCustomInput);

		const previewLabel = document.createElement('div');
		previewLabel.textContent = 'Preview';
		previewLabel.style.cssText = 'color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;';
		el.appendChild(previewLabel);

		this.numberPreview = document.createElement('div');
		Object.assign(this.numberPreview.style, {
			border: '1px solid #444', borderRadius: '4px', padding: '8px 12px',
			background: '#2a2a2a', color: '#ccc', fontSize: '13px',
		});
		this.numberPreview.textContent = 'e.g. 1234.56';
		el.appendChild(this.numberPreview);

		return el;
	}

	// ── Fill Tab ────────────────────────────────────────────────────────────

	private _buildFillTab(): HTMLElement {
		const el = document.createElement('div');

		const label = document.createElement('div');
		label.textContent = 'Background Color';
		label.style.cssText = 'color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px;';
		el.appendChild(label);

		const colorRow = document.createElement('div');
		colorRow.style.cssText = 'display:flex;align-items:center;gap:12px;margin-bottom:16px;';

		this.fillColorInput = document.createElement('input');
		this.fillColorInput.type = 'color';
		this.fillColorInput.value = '#ffffff';
		Object.assign(this.fillColorInput.style, {
			width: '48px', height: '32px', background: 'none',
			border: '1px solid #555', borderRadius: '3px', cursor: 'pointer', padding: '2px',
		});
		this.fillColorInput.oninput = () => {
			this.fillNoneBtn.style.outline = 'none';
			this._updateFillPreview();
		};
		colorRow.appendChild(this.fillColorInput);

		this.fillNoneBtn = document.createElement('button');
		this.fillNoneBtn.textContent = 'No Fill';
		Object.assign(this.fillNoneBtn.style, {
			padding: '5px 12px', background: '#2a2a2a', border: '1px solid #555',
			color: '#ccc', borderRadius: '4px', cursor: 'pointer', fontSize: '13px',
		});
		this.fillNoneBtn.onclick = () => {
			this.fillColorInput.value = '#ffffff';
			this.fillNoneBtn.style.outline = '2px solid #0078d7';
			this._updateFillPreview(true);
		};
		colorRow.appendChild(this.fillNoneBtn);
		el.appendChild(colorRow);

		// Quick palette
		const paletteLabel = document.createElement('div');
		paletteLabel.textContent = 'Quick Colors';
		paletteLabel.style.cssText = 'color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;';
		el.appendChild(paletteLabel);

		const palette = document.createElement('div');
		palette.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;margin-bottom:16px;';
		const PALETTE_COLORS = [
			'#ffffff','#f2f2f2','#d9d9d9','#bfbfbf','#a5a5a5','#7f7f7f','#595959','#000000',
			'#ffcccc','#ff9999','#ff6666','#ff0000','#cc0000','#990000','#660000','#330000',
			'#fff2cc','#ffe599','#ffd966','#ffc000','#f4b400','#e69138','#bf9000','#7f6000',
			'#d9ead3','#b6d7a8','#93c47d','#6aa84f','#38761d','#274e13','#00ff00','#00cc00',
			'#cfe2f3','#9fc5e8','#6fa8dc','#4a86e8','#1155cc','#1c4587','#0000ff','#0000cc',
			'#ead1dc','#ea9999','#e06666','#cc4125','#a61c00','#dd7e6b','#e4c7a0','#c9daf8',
		];
		for (const c of PALETTE_COLORS) {
			const swatch = document.createElement('button');
			Object.assign(swatch.style, {
				width: '20px', height: '20px', background: c,
				border: '1px solid #555', borderRadius: '2px', cursor: 'pointer', padding: '0',
			});
			swatch.title = c;
			swatch.onclick = () => {
				this.fillColorInput.value = c;
				this.fillNoneBtn.style.outline = 'none';
				this._updateFillPreview();
			};
			palette.appendChild(swatch);
		}
		el.appendChild(palette);

		const previewLabel = document.createElement('div');
		previewLabel.textContent = 'Preview';
		previewLabel.style.cssText = 'color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;';
		el.appendChild(previewLabel);

		this.fillPreview = document.createElement('div');
		Object.assign(this.fillPreview.style, {
			border: '1px solid #444', borderRadius: '4px', height: '32px',
			background: 'transparent',
		});
		el.appendChild(this.fillPreview);

		return el;
	}

	// ── Helpers ─────────────────────────────────────────────────────────────

	private _row(): HTMLDivElement {
		const d = document.createElement('div');
		d.style.cssText = 'display:flex;gap:12px;align-items:flex-start;';
		return d;
	}

	private _col(labelText: string, width: string): HTMLDivElement {
		const d = document.createElement('div');
		d.style.cssText = `display:flex;flex-direction:column;gap:4px;width:${width};`;
		const lbl = document.createElement('div');
		lbl.textContent = labelText;
		lbl.style.cssText = 'color:#888;font-size:11px;text-transform:uppercase;letter-spacing:.5px;';
		d.appendChild(lbl);
		return d;
	}

	private _checkbox(label: string): HTMLInputElement {
		const wrapper = document.createElement('label');
		wrapper.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;';
		const cb = document.createElement('input');
		cb.type = 'checkbox';
		wrapper.appendChild(cb);
		wrapper.appendChild(document.createTextNode(label));
		// wrapper is the parent, cb is the input
		return cb;
	}

	private _switchTab(id: TabId): void {
		for (const [tid, content] of this.tabContents) {
			content.style.display = tid === id ? 'block' : 'none';
		}
		for (const [tid, btn] of this.tabButtons) {
			const active = tid === id;
			btn.style.color = active ? '#0078d7' : '#aaa';
			btn.style.borderBottom = active ? '2px solid #0078d7' : '2px solid transparent';
			btn.style.fontWeight = active ? '600' : 'normal';
		}
	}

	private _selectAlign(value: string): void {
		for (const btn of [this.alignLeft, this.alignCenter, this.alignRight]) {
			const isActive = btn.dataset['align'] === value;
			btn.style.background = isActive ? '#0078d7' : '#2a2a2a';
			btn.style.color = isActive ? '#fff' : '#ccc';
			btn.style.borderColor = isActive ? '#0078d7' : '#555';
		}
	}

	private _currentAlign(): 'left' | 'center' | 'right' | undefined {
		for (const btn of [this.alignLeft, this.alignCenter, this.alignRight]) {
			if (btn.style.background === 'rgb(0, 120, 215)') {
				return btn.dataset['align'] as 'left' | 'center' | 'right';
			}
		}
		return undefined;
	}

	private _noFillSelected(): boolean {
		return this.fillNoneBtn.style.outline !== '' && this.fillNoneBtn.style.outline !== 'none';
	}

	private _updateFontPreview(): void {
		const ff = this.fontFamilySelect.value || 'inherit';
		const fs = this.fontSizeInput.value ? `${this.fontSizeInput.value}px` : 'inherit';
		const color = this.textColorInput.value || '#ccc';
		this.fontPreview.style.fontFamily = ff;
		this.fontPreview.style.fontSize = fs;
		this.fontPreview.style.fontWeight = this.boldCheck.checked ? 'bold' : 'normal';
		this.fontPreview.style.fontStyle = this.italicCheck.checked ? 'italic' : 'normal';
		const dec: string[] = [];
		if (this.underlineCheck.checked) dec.push('underline');
		if (this.strikeCheck.checked) dec.push('line-through');
		this.fontPreview.style.textDecoration = dec.join(' ') || 'none';
		this.fontPreview.style.color = color;
	}

	private _updateNumberPreview(): void {
		const code = this.numberCustomInput.value.trim();
		if (!code || code === 'General') {
			this.numberPreview.textContent = '1234.56  (General)';
			return;
		}
		this.numberPreview.textContent = `Format code: ${code}`;
	}

	private _updateFillPreview(noFill = false): void {
		this.fillPreview.style.background = noFill ? 'transparent' : this.fillColorInput.value;
	}

	private _apply(): void {
		const style: CellStyle = {};

		// Font
		if (this.fontFamilySelect.value) style.fontFamily = this.fontFamilySelect.value;
		const fs = parseInt(this.fontSizeInput.value, 10);
		if (fs > 0 && !isNaN(fs)) style.fontSize = fs;
		if (this.boldCheck.checked) style.bold = true;
		else if (!this.boldCheck.checked && this.boldCheck.dataset['wasSet'] === '1') style.bold = false;
		if (this.italicCheck.checked) style.italic = true;
		else if (!this.italicCheck.checked && this.italicCheck.dataset['wasSet'] === '1') style.italic = false;
		if (this.underlineCheck.checked) style.underline = true;
		else if (!this.underlineCheck.checked && this.underlineCheck.dataset['wasSet'] === '1') style.underline = false;
		if (this.strikeCheck.checked) style.strikethrough = true;
		else if (!this.strikeCheck.checked && this.strikeCheck.dataset['wasSet'] === '1') style.strikethrough = false;

		// Only set text color if it was explicitly loaded or changed
		if (this.textColorInput.dataset['loaded'] === '1') {
			style.textColor = this.textColorInput.value;
		}

		// Alignment
		const align = this._currentAlign();
		if (align) style.alignment = align;
		if (this.wrapTextCheck.checked) style.wrapText = true;
		else if (!this.wrapTextCheck.checked && this.wrapTextCheck.dataset['wasSet'] === '1') style.wrapText = false;

		// Number format
		const fmt = this.numberCustomInput.value.trim();
		if (fmt) style.numberFormat = fmt === 'General' ? undefined : fmt;

		// Fill
		if (this._noFillSelected()) {
			style.fillColor = undefined;
		} else if (this.fillColorInput.dataset['loaded'] === '1') {
			style.fillColor = this.fillColorInput.value;
		}

		this.onAction({ action: 'apply', style });
		this.hide();
	}

	// ── Public API ───────────────────────────────────────────────────────────

	show(currentStyle: CellStyle): void {
		// Populate Font tab
		this.fontFamilySelect.value = currentStyle.fontFamily ?? '';
		this.fontSizeInput.value = currentStyle.fontSize != null ? String(currentStyle.fontSize) : '';

		const setBool = (cb: HTMLInputElement, val: boolean | undefined) => {
			cb.checked = val === true;
			cb.dataset['wasSet'] = val !== undefined ? '1' : '0';
		};
		setBool(this.boldCheck, currentStyle.bold);
		setBool(this.italicCheck, currentStyle.italic);
		setBool(this.underlineCheck, currentStyle.underline);
		setBool(this.strikeCheck, currentStyle.strikethrough);

		if (currentStyle.textColor) {
			this.textColorInput.value = this._normalizeColor(currentStyle.textColor);
			this.textColorInput.dataset['loaded'] = '1';
		} else {
			this.textColorInput.value = '#ffffff';
			this.textColorInput.dataset['loaded'] = '0';
		}

		// Alignment tab
		this._selectAlign('');  // deselect all first
		if (currentStyle.alignment) this._selectAlign(currentStyle.alignment);
		this.wrapTextCheck.checked = currentStyle.wrapText === true;
		this.wrapTextCheck.dataset['wasSet'] = currentStyle.wrapText !== undefined ? '1' : '0';

		// Number tab
		const fmt = currentStyle.numberFormat ?? 'General';
		this.numberCustomInput.value = fmt;
		// Try to select preset
		let found = false;
		for (let i = 0; i < this.numberPresetList.options.length; i++) {
			if (this.numberPresetList.options[i].value === fmt) {
				this.numberPresetList.selectedIndex = i;
				found = true;
				break;
			}
		}
		if (!found) this.numberPresetList.selectedIndex = -1;
		this._updateNumberPreview();

		// Fill tab
		if (currentStyle.fillColor) {
			this.fillColorInput.value = this._normalizeColor(currentStyle.fillColor);
			this.fillColorInput.dataset['loaded'] = '1';
			this.fillNoneBtn.style.outline = 'none';
			this._updateFillPreview();
		} else {
			this.fillColorInput.value = '#ffffff';
			this.fillColorInput.dataset['loaded'] = '0';
			this.fillNoneBtn.style.outline = '2px solid #0078d7';
			this._updateFillPreview(true);
		}

		this._updateFontPreview();
		this._switchTab('font');
		this.dialog.style.display = 'block';
	}

	hide(): void {
		this.dialog.style.display = 'none';
		this.onAction({ action: 'close' });
	}

	isVisible(): boolean {
		return this.dialog.style.display !== 'none';
	}

	private _normalizeColor(color: string): string {
		// Ensure it's a 6-digit hex for <input type="color">
		if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
		if (/^#[0-9a-fA-F]{3}$/.test(color)) {
			const r = color[1], g = color[2], b = color[3];
			return `#${r}${r}${g}${g}${b}${b}`;
		}
		// ARGB from Excel e.g. "FFRRGGBB"
		if (/^[0-9a-fA-F]{8}$/.test(color)) return `#${color.slice(2)}`;
		return '#ffffff';
	}

	private _makeDraggable(handle: HTMLElement): void {
		let startX = 0, startY = 0, origLeft = 0, origTop = 0;

		handle.addEventListener('mousedown', (e) => {
			if (e.button !== 0) return;
			startX = e.clientX;
			startY = e.clientY;
			const rect = this.dialog.getBoundingClientRect();
			origLeft = rect.left;
			origTop = rect.top;
			this.dialog.style.transform = 'none';
			this.dialog.style.left = `${origLeft}px`;
			this.dialog.style.top = `${origTop}px`;

			const onMove = (ev: MouseEvent) => {
				this.dialog.style.left = `${origLeft + ev.clientX - startX}px`;
				this.dialog.style.top  = `${origTop  + ev.clientY - startY}px`;
			};
			const onUp = () => {
				document.removeEventListener('mousemove', onMove);
				document.removeEventListener('mouseup', onUp);
			};
			document.addEventListener('mousemove', onMove);
			document.addEventListener('mouseup', onUp);
			e.preventDefault();
		});
	}
}

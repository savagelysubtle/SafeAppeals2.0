// Paste Special Dialog for XLSX Rust Viewer

import type { PasteSpecialOptions } from './renderer.js';

export interface PSDialogEvent {
	action: 'paste' | 'close';
	options?: PasteSpecialOptions;
}

export class PasteSpecialDialog {
	private container: HTMLDivElement;
	private onAction: (event: PSDialogEvent) => void;
	private dialog!: HTMLDivElement;

	// Paste-what radio inputs
	private radioAll!: HTMLInputElement;
	private radioValues!: HTMLInputElement;
	private radioFormulas!: HTMLInputElement;
	private radioFormats!: HTMLInputElement;
	private radioColWidths!: HTMLInputElement;

	// Operation radio inputs
	private opNone!: HTMLInputElement;
	private opAdd!: HTMLInputElement;
	private opSubtract!: HTMLInputElement;
	private opMultiply!: HTMLInputElement;
	private opDivide!: HTMLInputElement;

	// Checkboxes
	private skipBlanksCheck!: HTMLInputElement;
	private transposeCheck!: HTMLInputElement;

	constructor(container: HTMLElement, onAction: (event: PSDialogEvent) => void) {
		this.container = container as HTMLDivElement;
		this.onAction = onAction;
		this._build();
	}

	private _build(): void {
		this.dialog = document.createElement('div');
		Object.assign(this.dialog.style, {
			display: 'none',
			position: 'fixed',
			top: '80px',
			left: '50%',
			transform: 'translateX(-50%)',
			width: '340px',
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

		// --- Title bar ---
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
		title.textContent = 'Paste Special';
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

		// --- Body ---
		const body = document.createElement('div');
		body.style.padding = '16px';

		// Paste section
		const pasteGroup = this._buildRadioGroup('Paste', [
			{ label: 'All',           ref: (el) => { this.radioAll = el; },      value: 'all',       checked: true },
			{ label: 'Values only',   ref: (el) => { this.radioValues = el; },   value: 'values' },
			{ label: 'Formulas only', ref: (el) => { this.radioFormulas = el; }, value: 'formulas' },
			{ label: 'Formats only',  ref: (el) => { this.radioFormats = el; },  value: 'formats' },
			{ label: 'Column widths', ref: (el) => { this.radioColWidths = el; }, value: 'colWidths' },
		], 'ps-what');
		body.appendChild(pasteGroup);

		// Operation section
		const opGroup = this._buildRadioGroup('Operation', [
			{ label: 'None',     ref: (el) => { this.opNone = el; },     value: 'none',     checked: true },
			{ label: 'Add',      ref: (el) => { this.opAdd = el; },      value: 'add' },
			{ label: 'Subtract', ref: (el) => { this.opSubtract = el; }, value: 'subtract' },
			{ label: 'Multiply', ref: (el) => { this.opMultiply = el; }, value: 'multiply' },
			{ label: 'Divide',   ref: (el) => { this.opDivide = el; },   value: 'divide' },
		], 'ps-op');
		body.appendChild(opGroup);

		// Checkboxes section
		const cbSection = document.createElement('div');
		cbSection.style.marginTop = '12px';
		this.skipBlanksCheck = this._buildCheckbox(cbSection, 'Skip blanks');
		this.transposeCheck  = this._buildCheckbox(cbSection, 'Transpose');
		body.appendChild(cbSection);

		// Footer buttons
		const footer = document.createElement('div');
		Object.assign(footer.style, {
			display: 'flex',
			justifyContent: 'flex-end',
			gap: '8px',
			marginTop: '16px',
		});
		const cancelBtn = this._buildBtn('Cancel', '#444', () => this.hide());
		const okBtn     = this._buildBtn('OK', '#0078d4', () => this._onOk());
		footer.appendChild(cancelBtn);
		footer.appendChild(okBtn);
		body.appendChild(footer);

		this.dialog.appendChild(body);
		this.container.appendChild(this.dialog);
	}

	private _buildRadioGroup(
		legend: string,
		items: { label: string; ref: (el: HTMLInputElement) => void; value: string; checked?: boolean }[],
		name: string,
	): HTMLElement {
		const wrapper = document.createElement('div');
		wrapper.style.marginBottom = '12px';

		const legendEl = document.createElement('div');
		legendEl.textContent = legend;
		Object.assign(legendEl.style, {
			fontWeight: '600',
			color: '#fff',
			marginBottom: '6px',
			fontSize: '12px',
			textTransform: 'uppercase',
			letterSpacing: '0.05em',
		});
		wrapper.appendChild(legendEl);

		const grid = document.createElement('div');
		Object.assign(grid.style, {
			display: 'grid',
			gridTemplateColumns: '1fr 1fr',
			gap: '4px 12px',
		});

		for (const item of items) {
			const label = document.createElement('label');
			Object.assign(label.style, { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' });
			const input = document.createElement('input');
			input.type = 'radio';
			input.name = name;
			input.value = item.value;
			if (item.checked) input.checked = true;
			item.ref(input);
			label.appendChild(input);
			label.appendChild(document.createTextNode(item.label));
			grid.appendChild(label);
		}

		wrapper.appendChild(grid);
		return wrapper;
	}

	private _buildCheckbox(parent: HTMLElement, labelText: string): HTMLInputElement {
		const label = document.createElement('label');
		Object.assign(label.style, { display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '6px' });
		const input = document.createElement('input');
		input.type = 'checkbox';
		label.appendChild(input);
		label.appendChild(document.createTextNode(labelText));
		parent.appendChild(label);
		return input;
	}

	private _buildBtn(text: string, bg: string, onClick: () => void): HTMLButtonElement {
		const btn = document.createElement('button');
		btn.textContent = text;
		Object.assign(btn.style, {
			padding: '6px 18px',
			background: bg,
			border: 'none',
			borderRadius: '4px',
			color: '#fff',
			cursor: 'pointer',
			fontSize: '13px',
		});
		btn.onclick = onClick;
		return btn;
	}

	private _onOk(): void {
		const what = (() => {
			if (this.radioValues.checked)   return 'values' as const;
			if (this.radioFormulas.checked) return 'formulas' as const;
			if (this.radioFormats.checked)  return 'formats' as const;
			if (this.radioColWidths.checked) return 'colWidths' as const;
			return 'all' as const;
		})();
		const operation = (() => {
			if (this.opAdd.checked)      return 'add' as const;
			if (this.opSubtract.checked) return 'subtract' as const;
			if (this.opMultiply.checked) return 'multiply' as const;
			if (this.opDivide.checked)   return 'divide' as const;
			return 'none' as const;
		})();
		const options: PasteSpecialOptions = {
			what,
			operation,
			skipBlanks: this.skipBlanksCheck.checked,
			transpose:  this.transposeCheck.checked,
		};
		this.hide();
		this.onAction({ action: 'paste', options });
	}

	private _makeDraggable(handle: HTMLElement): void {
		let startX = 0, startY = 0, origLeft = 0, origTop = 0;
		handle.addEventListener('mousedown', (e) => {
			startX = e.clientX;
			startY = e.clientY;
			const rect = this.dialog.getBoundingClientRect();
			origLeft = rect.left;
			origTop  = rect.top;
			this.dialog.style.transform = 'none';
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
		});
	}

	show(): void {
		// Reset to defaults
		this.radioAll.checked  = true;
		this.opNone.checked    = true;
		this.skipBlanksCheck.checked = false;
		this.transposeCheck.checked  = false;
		this.dialog.style.display = 'block';
	}

	hide(): void {
		this.dialog.style.display = 'none';
		this.onAction({ action: 'close' });
	}
}

// Data Validation Dialog for XLSX Rust Viewer
// Provides UI for creating, editing, and managing data validation rules

import type { DataValidationDef } from './renderer.js';

export interface VDDialogEvent {
	action: 'add' | 'edit' | 'delete' | 'close';
	rule?: DataValidationDef;
	ruleIndex?: number;
}

interface ValidationTypeOption {
	label: string;
	value: string;
}

const VALIDATION_TYPES: ValidationTypeOption[] = [
	{ label: 'Any Value', value: 'any' },
	{ label: 'Whole Number', value: 'whole' },
	{ label: 'Decimal', value: 'decimal' },
	{ label: 'List', value: 'list' },
	{ label: 'Date', value: 'date' },
	{ label: 'Time', value: 'time' },
	{ label: 'Text Length', value: 'textLength' },
	{ label: 'Custom Formula', value: 'custom' },
];

const OPERATORS: Array<{ label: string; value: string }> = [
	{ label: 'between', value: 'between' },
	{ label: 'not between', value: 'notBetween' },
	{ label: 'equal to', value: 'equal' },
	{ label: 'not equal to', value: 'notEqual' },
	{ label: 'greater than', value: 'greaterThan' },
	{ label: 'less than', value: 'lessThan' },
	{ label: 'greater than or equal to', value: 'greaterThanOrEqual' },
	{ label: 'less than or equal to', value: 'lessThanOrEqual' },
];

type TabId = 'settings' | 'input-message' | 'error-alert';

export class ValidationDialog {
	private container: HTMLDivElement;
	private onAction: (event: VDDialogEvent) => void;
	private editIndex: number | null = null;
	private existingRules: DataValidationDef[] = [];
	// Settings tab elements
	private typeSelect!: HTMLSelectElement;
	private operatorSelect!: HTMLSelectElement;
	private operatorRow!: HTMLElement;
	private value1Input!: HTMLInputElement;
	private value2Input!: HTMLInputElement;
	private value2Row!: HTMLElement;
	private value1Label!: HTMLElement;
	private listInput!: HTMLInputElement;
	private listRow!: HTMLElement;
	private formulaInput!: HTMLInputElement;
	private formulaRow!: HTMLElement;
	private allowBlankCheck!: HTMLInputElement;
	private showDropdownCheck!: HTMLInputElement;
	private showDropdownRow!: HTMLElement;
	private rangeInput!: HTMLInputElement;

	// Input message tab elements
	private showInputMsgCheck!: HTMLInputElement;
	private inputTitleInput!: HTMLInputElement;
	private inputMsgTextarea!: HTMLTextAreaElement;

	// Error alert tab elements
	private showErrorCheck!: HTMLInputElement;
	private errorStyleSelect!: HTMLSelectElement;
	private errorTitleInput!: HTMLInputElement;
	private errorMsgTextarea!: HTMLTextAreaElement;

	// Rule list
	private ruleListArea!: HTMLElement;

	// Tab content areas
	private settingsContent!: HTMLElement;
	private inputMsgContent!: HTMLElement;
	private errorAlertContent!: HTMLElement;
	private tabButtons!: Map<TabId, HTMLButtonElement>;

	constructor(parent: HTMLElement, onAction: (event: VDDialogEvent) => void) {
		this.onAction = onAction;
		this.container = document.createElement('div');
		this.container.style.cssText = this._dialogStyle();
		this.container.style.display = 'none';
		parent.appendChild(this.container);
		this._build();
	}

	private _dialogStyle(): string {
		return [
			'position:absolute',
			'right:16px',
			'top:60px',
			'width:440px',
			'background:#fff',
			'border:1px solid #c8c8c8',
			'border-radius:6px',
			'box-shadow:0 8px 32px rgba(0,0,0,0.18)',
			'z-index:9100',
			'font-family:system-ui,-apple-system,sans-serif',
			'font-size:13px',
			'color:#1a1a1a',
			'display:flex',
			'flex-direction:column',
			'max-height:90vh',
			'overflow:hidden',
		].join(';');
	}

	private _build(): void {
		this.container.innerHTML = '';
		this.tabButtons = new Map();

		// Title bar
		const titleBar = document.createElement('div');
		titleBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f3f3f3;border-bottom:1px solid #ddd;border-radius:6px 6px 0 0;cursor:move;user-select:none;flex-shrink:0;';
		const titleText = document.createElement('span');
		titleText.textContent = 'Data Validation';
		titleText.style.cssText = 'font-weight:600;font-size:14px;';
		const closeBtn = document.createElement('button');
		closeBtn.textContent = '×';
		closeBtn.style.cssText = 'background:none;border:none;font-size:18px;cursor:pointer;color:#666;padding:0 4px;line-height:1;';
		closeBtn.addEventListener('click', () => this.hide());
		titleBar.appendChild(titleText);
		titleBar.appendChild(closeBtn);
		this.container.appendChild(titleBar);
		this._makeDraggable(titleBar);

		// Scrollable body
		const body = document.createElement('div');
		body.style.cssText = 'flex:1;overflow-y:auto;padding:12px 14px;';

		// Existing rules list
		const rulesSection = document.createElement('div');
		rulesSection.style.marginBottom = '14px';
		const rulesLabel = document.createElement('div');
		rulesLabel.textContent = 'Active Rules:';
		rulesLabel.style.cssText = 'font-weight:600;margin-bottom:6px;';
		rulesSection.appendChild(rulesLabel);
		this.ruleListArea = document.createElement('div');
		this.ruleListArea.style.cssText = 'max-height:100px;overflow-y:auto;border:1px solid #ddd;border-radius:4px;background:#fafafa;';
		rulesSection.appendChild(this.ruleListArea);
		body.appendChild(rulesSection);

		// Separator
		const sep = document.createElement('div');
		sep.style.cssText = 'border-top:1px solid #e0e0e0;margin-bottom:12px;';
		body.appendChild(sep);

		// Range input
		const rangeRow = this._makeRow();
		const rangeLabel = this._makeLabel('Applies to range:');
		this.rangeInput = document.createElement('input');
		this.rangeInput.style.cssText = this._inputStyle();
		this.rangeInput.placeholder = 'e.g. A1:A10';
		rangeRow.appendChild(rangeLabel);
		rangeRow.appendChild(this.rangeInput);
		body.appendChild(rangeRow);

		// Tab bar
		const tabBar = document.createElement('div');
		tabBar.style.cssText = 'display:flex;border-bottom:2px solid #e0e0e0;margin-bottom:10px;';
		const tabs: Array<[TabId, string]> = [
			['settings', 'Settings'],
			['input-message', 'Input Message'],
			['error-alert', 'Error Alert'],
		];
		for (const [id, label] of tabs) {
			const btn = document.createElement('button');
			btn.textContent = label;
			btn.style.cssText = 'padding:6px 14px;border:none;background:none;cursor:pointer;font-size:13px;border-bottom:2px solid transparent;margin-bottom:-2px;';
			btn.addEventListener('click', () => this._switchTab(id));
			tabBar.appendChild(btn);
			this.tabButtons.set(id, btn);
		}
		body.appendChild(tabBar);

		// Settings tab content
		this.settingsContent = document.createElement('div');
		this._buildSettingsTab(this.settingsContent);
		body.appendChild(this.settingsContent);

		// Input message tab content
		this.inputMsgContent = document.createElement('div');
		this._buildInputMsgTab(this.inputMsgContent);
		body.appendChild(this.inputMsgContent);

		// Error alert tab content
		this.errorAlertContent = document.createElement('div');
		this._buildErrorAlertTab(this.errorAlertContent);
		body.appendChild(this.errorAlertContent);

		this.container.appendChild(body);

		// Footer
		const footer = document.createElement('div');
		footer.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;padding:10px 14px;border-top:1px solid #ddd;background:#f9f9f9;border-radius:0 0 6px 6px;flex-shrink:0;';
		const addBtn = document.createElement('button');
		addBtn.textContent = 'Add Rule';
		addBtn.style.cssText = this._primaryBtnStyle();
		addBtn.addEventListener('click', () => this._submitRule());
		const closeFooterBtn = document.createElement('button');
		closeFooterBtn.textContent = 'Close';
		closeFooterBtn.style.cssText = this._secondaryBtnStyle();
		closeFooterBtn.addEventListener('click', () => this.hide());
		footer.appendChild(addBtn);
		footer.appendChild(closeFooterBtn);
		this.container.appendChild(footer);

		this._switchTab('settings');
		this._updateSettingsUI();
	}

	private _buildSettingsTab(container: HTMLElement): void {
		// Validation type
		const typeRow = this._makeRow();
		typeRow.appendChild(this._makeLabel('Allow:'));
		this.typeSelect = document.createElement('select');
		this.typeSelect.style.cssText = this._selectStyle();
		for (const vt of VALIDATION_TYPES) {
			const opt = document.createElement('option');
			opt.value = vt.value;
			opt.textContent = vt.label;
			this.typeSelect.appendChild(opt);
		}
		this.typeSelect.addEventListener('change', () => this._updateSettingsUI());
		typeRow.appendChild(this.typeSelect);
		container.appendChild(typeRow);

		// Operator row
		this.operatorRow = this._makeRow();
		this.operatorRow.appendChild(this._makeLabel('Data:'));
		this.operatorSelect = document.createElement('select');
		this.operatorSelect.style.cssText = this._selectStyle();
		for (const op of OPERATORS) {
			const opt = document.createElement('option');
			opt.value = op.value;
			opt.textContent = op.label;
			this.operatorSelect.appendChild(opt);
		}
		this.operatorSelect.addEventListener('change', () => this._updateSettingsUI());
		this.operatorRow.appendChild(this.operatorSelect);
		container.appendChild(this.operatorRow);

		// Value 1 row
		const value1Row = this._makeRow();
		this.value1Label = this._makeLabel('Minimum:');
		this.value1Input = document.createElement('input');
		this.value1Input.style.cssText = this._inputStyle();
		value1Row.appendChild(this.value1Label);
		value1Row.appendChild(this.value1Input);
		container.appendChild(value1Row);

		// Value 2 row
		this.value2Row = this._makeRow();
		this.value2Row.appendChild(this._makeLabel('Maximum:'));
		this.value2Input = document.createElement('input');
		this.value2Input.style.cssText = this._inputStyle();
		this.value2Row.appendChild(this.value2Input);
		container.appendChild(this.value2Row);

		// List items row
		this.listRow = this._makeRow();
		this.listRow.appendChild(this._makeLabel('Source:'));
		this.listInput = document.createElement('input');
		this.listInput.style.cssText = this._inputStyle();
		this.listInput.placeholder = 'Comma-separated or =Sheet1!A1:A10';
		this.listRow.appendChild(this.listInput);
		container.appendChild(this.listRow);

		// Custom formula row
		this.formulaRow = this._makeRow();
		this.formulaRow.appendChild(this._makeLabel('Formula:'));
		this.formulaInput = document.createElement('input');
		this.formulaInput.style.cssText = this._inputStyle();
		this.formulaInput.placeholder = '=AND(ISTEXT(A1), LEN(A1)>0)';
		this.formulaRow.appendChild(this.formulaInput);
		container.appendChild(this.formulaRow);

		// Allow blank
		const blankRow = this._makeRow();
		this.allowBlankCheck = document.createElement('input');
		this.allowBlankCheck.type = 'checkbox';
		this.allowBlankCheck.checked = true;
		this.allowBlankCheck.style.marginRight = '6px';
		const blankLabel = document.createElement('label');
		blankLabel.style.cssText = 'display:flex;align-items:center;cursor:pointer;';
		blankLabel.appendChild(this.allowBlankCheck);
		blankLabel.appendChild(document.createTextNode('Ignore blank'));
		blankRow.appendChild(blankLabel);
		container.appendChild(blankRow);

		// Show dropdown (for list type)
		this.showDropdownRow = this._makeRow();
		this.showDropdownCheck = document.createElement('input');
		this.showDropdownCheck.type = 'checkbox';
		this.showDropdownCheck.checked = true;
		this.showDropdownCheck.style.marginRight = '6px';
		const dropdownLabel = document.createElement('label');
		dropdownLabel.style.cssText = 'display:flex;align-items:center;cursor:pointer;';
		dropdownLabel.appendChild(this.showDropdownCheck);
		dropdownLabel.appendChild(document.createTextNode('In-cell dropdown'));
		this.showDropdownRow.appendChild(dropdownLabel);
		container.appendChild(this.showDropdownRow);
	}

	private _buildInputMsgTab(container: HTMLElement): void {
		const row1 = this._makeRow();
		this.showInputMsgCheck = document.createElement('input');
		this.showInputMsgCheck.type = 'checkbox';
		this.showInputMsgCheck.checked = true;
		this.showInputMsgCheck.style.marginRight = '6px';
		const lbl = document.createElement('label');
		lbl.style.cssText = 'display:flex;align-items:center;cursor:pointer;';
		lbl.appendChild(this.showInputMsgCheck);
		lbl.appendChild(document.createTextNode('Show input message when cell is selected'));
		row1.appendChild(lbl);
		container.appendChild(row1);

		container.appendChild(this._makeSpacer());

		const titleRow = this._makeRow();
		titleRow.appendChild(this._makeLabel('Title:'));
		this.inputTitleInput = document.createElement('input');
		this.inputTitleInput.style.cssText = this._inputStyle();
		this.inputTitleInput.placeholder = 'Optional title (max 32 chars)';
		this.inputTitleInput.maxLength = 32;
		titleRow.appendChild(this.inputTitleInput);
		container.appendChild(titleRow);

		const msgRow = this._makeColRow();
		msgRow.appendChild(this._makeLabel('Message:'));
		this.inputMsgTextarea = document.createElement('textarea');
		this.inputMsgTextarea.style.cssText = `${this._inputStyle()}height:64px;resize:vertical;font-family:inherit;`;
		this.inputMsgTextarea.placeholder = 'Message shown when user enters data... (max 255 chars)';
		this.inputMsgTextarea.maxLength = 255;
		msgRow.appendChild(this.inputMsgTextarea);
		container.appendChild(msgRow);
	}

	private _buildErrorAlertTab(container: HTMLElement): void {
		const row1 = this._makeRow();
		this.showErrorCheck = document.createElement('input');
		this.showErrorCheck.type = 'checkbox';
		this.showErrorCheck.checked = true;
		this.showErrorCheck.style.marginRight = '6px';
		const lbl = document.createElement('label');
		lbl.style.cssText = 'display:flex;align-items:center;cursor:pointer;';
		lbl.appendChild(this.showErrorCheck);
		lbl.appendChild(document.createTextNode('Show error alert after invalid data is entered'));
		row1.appendChild(lbl);
		container.appendChild(row1);

		container.appendChild(this._makeSpacer());

		const styleRow = this._makeRow();
		styleRow.appendChild(this._makeLabel('Style:'));
		this.errorStyleSelect = document.createElement('select');
		this.errorStyleSelect.style.cssText = this._selectStyle();
		for (const [val, lbl2] of [['stop', '🚫 Stop'], ['warning', '⚠️ Warning'], ['information', 'ℹ️ Information']]) {
			const opt = document.createElement('option');
			opt.value = val;
			opt.textContent = lbl2;
			this.errorStyleSelect.appendChild(opt);
		}
		styleRow.appendChild(this.errorStyleSelect);
		container.appendChild(styleRow);

		const titleRow = this._makeRow();
		titleRow.appendChild(this._makeLabel('Title:'));
		this.errorTitleInput = document.createElement('input');
		this.errorTitleInput.style.cssText = this._inputStyle();
		this.errorTitleInput.placeholder = 'Optional error title (max 32 chars)';
		this.errorTitleInput.maxLength = 32;
		titleRow.appendChild(this.errorTitleInput);
		container.appendChild(titleRow);

		const msgRow = this._makeColRow();
		msgRow.appendChild(this._makeLabel('Message:'));
		this.errorMsgTextarea = document.createElement('textarea');
		this.errorMsgTextarea.style.cssText = `${this._inputStyle()}height:64px;resize:vertical;font-family:inherit;`;
		this.errorMsgTextarea.placeholder = 'Error message text... (max 255 chars)';
		this.errorMsgTextarea.maxLength = 255;
		msgRow.appendChild(this.errorMsgTextarea);
		container.appendChild(msgRow);
	}

	private _switchTab(id: TabId): void {
		this.settingsContent.style.display = id === 'settings' ? 'block' : 'none';
		this.inputMsgContent.style.display = id === 'input-message' ? 'block' : 'none';
		this.errorAlertContent.style.display = id === 'error-alert' ? 'block' : 'none';
		for (const [tabId, btn] of this.tabButtons) {
			const active = tabId === id;
			btn.style.fontWeight = active ? '600' : 'normal';
			btn.style.color = active ? '#0078d7' : '#555';
			btn.style.borderBottomColor = active ? '#0078d7' : 'transparent';
		}
	}

	private _updateSettingsUI(): void {
		const type = this.typeSelect.value;
		const op = this.operatorSelect.value;
		const isBetween = op === 'between' || op === 'notBetween';

		// Show/hide rows based on type
		this.operatorRow.style.display = (type === 'any' || type === 'list' || type === 'custom') ? 'none' : 'flex';
		this.value2Row.style.display = (type !== 'any' && type !== 'list' && type !== 'custom' && isBetween) ? 'flex' : 'none';
		this.listRow.style.display = type === 'list' ? 'flex' : 'none';
		this.formulaRow.style.display = type === 'custom' ? 'flex' : 'none';
		this.showDropdownRow.style.display = type === 'list' ? 'flex' : 'none';

		// Show value1 unless type is any/custom/list
		const showValue1 = type !== 'any' && type !== 'list' && type !== 'custom';
		const value1Parent = this.value1Input.parentElement;
		if (value1Parent) value1Parent.style.display = showValue1 ? 'flex' : 'none';

		// Update value1 label
		if (isBetween) {
			this.value1Label.textContent = 'Minimum:';
		} else {
			const opLabel = OPERATORS.find(o => o.value === op)?.label ?? 'Value';
			this.value1Label.textContent = `Value (${opLabel}):`;
		}

		// Placeholder hints based on type
		const placeholder = type === 'date' ? 'e.g. 2025-01-01' : type === 'time' ? 'e.g. 08:00' : 'Number';
		this.value1Input.placeholder = placeholder;
		this.value2Input.placeholder = placeholder;
	}

	private _submitRule(): void {
		const sqref = this.rangeInput.value.trim();
		if (!sqref) {
			this.rangeInput.style.borderColor = '#ff0000';
			this.rangeInput.focus();
			return;
		}
		this.rangeInput.style.borderColor = '';

		const rule = this._buildRule();
		if (!rule) return;
		rule.sqref = sqref;

		if (this.editIndex !== null) {
			this.onAction({ action: 'edit', rule, ruleIndex: this.editIndex });
			this.editIndex = null;
			// Reset footer button text
			const footer = this.container.lastElementChild as HTMLElement;
			const btn = footer.querySelector('button');
			if (btn) btn.textContent = 'Add Rule';
		} else {
			this.onAction({ action: 'add', rule });
		}

		this._refreshRuleList();
	}

	private _buildRule(): DataValidationDef | null {
		const type = this.typeSelect.value;
		const op = this.operatorSelect.value;

		let formula1: string | undefined;
		let formula2: string | undefined;

		if (type === 'list') {
			formula1 = this.listInput.value.trim() || undefined;
		} else if (type === 'custom') {
			formula1 = this.formulaInput.value.trim() || undefined;
		} else if (type !== 'any') {
			formula1 = this.value1Input.value.trim() || undefined;
			if (op === 'between' || op === 'notBetween') {
				formula2 = this.value2Input.value.trim() || undefined;
			}
		}

		return {
			validation_type: type,
			operator: (type !== 'any' && type !== 'list' && type !== 'custom') ? op : undefined,
			sqref: this.rangeInput.value.trim(),
			formula1,
			formula2,
			allow_blank: this.allowBlankCheck.checked,
			show_input_message: this.showInputMsgCheck.checked,
			show_error_message: this.showErrorCheck.checked,
			show_dropdown: this.showDropdownCheck.checked,
			input_title: this.inputTitleInput.value.trim() || undefined,
			input_message: this.inputMsgTextarea.value.trim() || undefined,
			error_title: this.errorTitleInput.value.trim() || undefined,
			error_message: this.errorMsgTextarea.value.trim() || undefined,
			error_style: this.errorStyleSelect.value,
		};
	}

	private _populateForm(rule: DataValidationDef): void {
		this.typeSelect.value = rule.validation_type;
		if (rule.operator) this.operatorSelect.value = rule.operator;
		this.rangeInput.value = rule.sqref;

		if (rule.validation_type === 'list') {
			this.listInput.value = rule.formula1 ?? '';
		} else if (rule.validation_type === 'custom') {
			this.formulaInput.value = rule.formula1 ?? '';
		} else {
			this.value1Input.value = rule.formula1 ?? '';
			this.value2Input.value = rule.formula2 ?? '';
		}

		this.allowBlankCheck.checked = rule.allow_blank;
		this.showDropdownCheck.checked = rule.show_dropdown;
		this.showInputMsgCheck.checked = rule.show_input_message;
		this.inputTitleInput.value = rule.input_title ?? '';
		this.inputMsgTextarea.value = rule.input_message ?? '';
		this.showErrorCheck.checked = rule.show_error_message;
		this.errorStyleSelect.value = rule.error_style;
		this.errorTitleInput.value = rule.error_title ?? '';
		this.errorMsgTextarea.value = rule.error_message ?? '';

		this._updateSettingsUI();
	}

	private _refreshRuleList(): void {
		this.ruleListArea.innerHTML = '';

		if (!this.existingRules.length) {
			const empty = document.createElement('div');
			empty.textContent = 'No validation rules defined.';
			empty.style.cssText = 'padding:8px 10px;color:#888;font-style:italic;font-size:12px;';
			this.ruleListArea.appendChild(empty);
			return;
		}

		for (let i = 0; i < this.existingRules.length; i++) {
			const rule = this.existingRules[i];
			const row = document.createElement('div');
			row.style.cssText = 'display:flex;align-items:center;padding:5px 8px;border-bottom:1px solid #eee;gap:6px;';

			const summary = document.createElement('span');
			summary.style.cssText = 'flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
			summary.title = rule.sqref;
			const typeLabel = VALIDATION_TYPES.find(t => t.value === rule.validation_type)?.label ?? rule.validation_type;
			summary.textContent = `${rule.sqref}: ${typeLabel}${rule.formula1 ? ` (${rule.formula1})` : ''}`;

			const editBtn = document.createElement('button');
			editBtn.textContent = 'Edit';
			editBtn.style.cssText = this._smallBtnStyle();
			editBtn.addEventListener('click', () => {
				this.editIndex = i;
				this._populateForm(rule);
				this._switchTab('settings');
				// Update footer button text
				const footer = this.container.lastElementChild as HTMLElement;
				const btn = footer.querySelector('button');
				if (btn) btn.textContent = 'Save Changes';
			});

			const delBtn = document.createElement('button');
			delBtn.textContent = 'Delete';
			delBtn.style.cssText = `${this._smallBtnStyle()}color:#c00;border-color:#f99;`;
			delBtn.addEventListener('click', () => {
				this.onAction({ action: 'delete', ruleIndex: i });
				this._refreshRuleList();
			});

			row.appendChild(summary);
			row.appendChild(editBtn);
			row.appendChild(delBtn);
			this.ruleListArea.appendChild(row);
		}
	}

	// ---- Public API ----

	show(sqref: string, existingRules: DataValidationDef[]): void {
		this.existingRules = existingRules ?? [];
		this.rangeInput.value = sqref;
		this.editIndex = null;
		this.typeSelect.value = 'any';
		this._updateSettingsUI();
		this._switchTab('settings');
		this._refreshRuleList();
		// Reset footer button
		const footer = this.container.lastElementChild as HTMLElement;
		const btn = footer.querySelector('button');
		if (btn) btn.textContent = 'Add Rule';
		this.container.style.display = 'flex';
	}

	hide(): void {
		this.container.style.display = 'none';
		this.onAction({ action: 'close' });
	}

	isVisible(): boolean {
		return this.container.style.display !== 'none';
	}

	/** Update the rule list display after external changes. */
	refreshRules(rules: DataValidationDef[]): void {
		this.existingRules = rules;
		this._refreshRuleList();
	}

	// ---- Helpers ----

	private _makeRow(): HTMLDivElement {
		const row = document.createElement('div');
		row.style.cssText = 'display:flex;align-items:center;gap:8px;margin-bottom:8px;';
		return row;
	}

	private _makeColRow(): HTMLDivElement {
		const row = document.createElement('div');
		row.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-bottom:8px;';
		return row;
	}

	private _makeLabel(text: string): HTMLElement {
		const lbl = document.createElement('label');
		lbl.textContent = text;
		lbl.style.cssText = 'min-width:90px;font-size:12px;color:#555;';
		return lbl;
	}

	private _makeSpacer(): HTMLElement {
		const el = document.createElement('div');
		el.style.height = '8px';
		return el;
	}

	private _inputStyle(): string {
		return 'flex:1;padding:5px 8px;border:1px solid #ccc;border-radius:4px;font-size:13px;outline:none;width:100%;box-sizing:border-box;';
	}

	private _selectStyle(): string {
		return 'flex:1;padding:5px 6px;border:1px solid #ccc;border-radius:4px;font-size:13px;';
	}

	private _primaryBtnStyle(): string {
		return 'padding:7px 18px;border-radius:4px;font-size:13px;cursor:pointer;border:1px solid #0078d7;background:#0078d7;color:#fff;font-weight:500;';
	}

	private _secondaryBtnStyle(): string {
		return 'padding:7px 18px;border-radius:4px;font-size:13px;cursor:pointer;border:1px solid #ccc;background:#fff;color:#333;';
	}

	private _smallBtnStyle(): string {
		return 'padding:3px 8px;border-radius:3px;font-size:11px;cursor:pointer;border:1px solid #ccc;background:#fff;color:#333;';
	}

	private _makeDraggable(handle: HTMLElement): void {
		let dragging = false;
		let offsetX = 0;
		let offsetY = 0;

		handle.addEventListener('mousedown', (e) => {
			dragging = true;
			const rect = this.container.getBoundingClientRect();
			offsetX = e.clientX - rect.left;
			offsetY = e.clientY - rect.top;
			e.preventDefault();
		});

		document.addEventListener('mousemove', (e) => {
			if (!dragging) return;
			this.container.style.left = `${e.clientX - offsetX}px`;
			this.container.style.top = `${e.clientY - offsetY}px`;
			this.container.style.right = 'auto';
			this.container.style.bottom = 'auto';
		});

		document.addEventListener('mouseup', () => { dragging = false; });
	}
}

// Conditional Formatting Dialog for XLSX Rust Viewer
// Provides UI for creating, editing, and managing conditional formatting rules

export interface CFDialogEvent {
	action: 'add' | 'edit' | 'delete' | 'close';
	rule?: ConditionalFormatRuleUI;
	ruleIndex?: number;
}

export interface ConditionalFormatRuleUI {
	rule_type: string;
	operator?: string;
	priority: number;
	values: string[];
	dxf_style?: {
		bold?: boolean;
		italic?: boolean;
		underline?: boolean;
		text_color?: string;
		fill_color?: string;
	};
	sqref: string;
	color_scale?: {
		colors: string[];
		values: number[];
		value_types: string[];
	};
	data_bar?: {
		color: string;
		min_value?: number;
		max_value?: number;
	};
	icon_set?: {
		icon_style: string;
		thresholds: number[];
		reverse: boolean;
	};
	rank?: number;
	percent?: boolean;
	bottom?: boolean;
	above_average?: boolean;
	text?: string;
}

interface RuleTypeOption {
	label: string;
	value: string;
	category: string;
}

const RULE_TYPES: RuleTypeOption[] = [
	// Highlight Cells Rules
	{ label: 'Greater Than', value: 'cellIs:greaterThan', category: 'Highlight Cells Rules' },
	{ label: 'Less Than', value: 'cellIs:lessThan', category: 'Highlight Cells Rules' },
	{ label: 'Equal To', value: 'cellIs:equal', category: 'Highlight Cells Rules' },
	{ label: 'Not Equal To', value: 'cellIs:notEqual', category: 'Highlight Cells Rules' },
	{ label: 'Between', value: 'cellIs:between', category: 'Highlight Cells Rules' },
	{ label: 'Not Between', value: 'cellIs:notBetween', category: 'Highlight Cells Rules' },
	{ label: 'Text Contains', value: 'containsText', category: 'Highlight Cells Rules' },
	{ label: 'Text Does Not Contain', value: 'notContainsText', category: 'Highlight Cells Rules' },
	{ label: 'Text Begins With', value: 'beginsWith', category: 'Highlight Cells Rules' },
	{ label: 'Text Ends With', value: 'endsWith', category: 'Highlight Cells Rules' },
	{ label: 'Duplicate Values', value: 'duplicateValues', category: 'Highlight Cells Rules' },
	{ label: 'Unique Values', value: 'uniqueValues', category: 'Highlight Cells Rules' },
	{ label: 'Contains Blanks', value: 'containsBlanks', category: 'Highlight Cells Rules' },
	// Top/Bottom Rules
	{ label: 'Top N', value: 'top10:top', category: 'Top/Bottom Rules' },
	{ label: 'Bottom N', value: 'top10:bottom', category: 'Top/Bottom Rules' },
	{ label: 'Above Average', value: 'aboveAverage:above', category: 'Top/Bottom Rules' },
	{ label: 'Below Average', value: 'aboveAverage:below', category: 'Top/Bottom Rules' },
	// Color Scales
	{ label: '2-Color Scale', value: 'colorScale:2', category: 'Color Scales' },
	{ label: '3-Color Scale', value: 'colorScale:3', category: 'Color Scales' },
	// Data Bars
	{ label: 'Data Bar', value: 'dataBar', category: 'Data Bars' },
	// Icon Sets
	{ label: '3 Arrows', value: 'iconSet:3Arrows', category: 'Icon Sets' },
	{ label: '3 Traffic Lights', value: 'iconSet:3TrafficLights1', category: 'Icon Sets' },
	{ label: '3 Symbols', value: 'iconSet:3Symbols', category: 'Icon Sets' },
	{ label: '3 Stars', value: 'iconSet:3Stars', category: 'Icon Sets' },
	{ label: '4 Arrows', value: 'iconSet:4Arrows', category: 'Icon Sets' },
	{ label: '4 Traffic Lights', value: 'iconSet:4TrafficLights', category: 'Icon Sets' },
	{ label: '5 Arrows', value: 'iconSet:5Arrows', category: 'Icon Sets' },
	{ label: '5 Quarters', value: 'iconSet:5Quarters', category: 'Icon Sets' },
	// Formula
	{ label: 'Custom Formula', value: 'expression', category: 'Custom' },
];

const PRESET_FORMATS: Array<{ label: string; textColor: string; fillColor: string }> = [
	{ label: 'Light Red Fill, Dark Red Text', textColor: '#9c0006', fillColor: '#ffc7ce' },
	{ label: 'Yellow Fill, Dark Yellow Text', textColor: '#9c6500', fillColor: '#ffeb9c' },
	{ label: 'Green Fill, Dark Green Text', textColor: '#006100', fillColor: '#c6efce' },
	{ label: 'Light Red Fill', textColor: '', fillColor: '#ffc7ce' },
	{ label: 'Light Yellow Fill', textColor: '', fillColor: '#ffeb9c' },
	{ label: 'Light Green Fill', textColor: '', fillColor: '#c6efce' },
	{ label: 'Red Text', textColor: '#ff0000', fillColor: '' },
	{ label: 'Custom Format...', textColor: '', fillColor: '' },
];

export class ConditionalFormatDialog {
	private container: HTMLElement;
	private onAction: (event: CFDialogEvent) => void;
	private editIndex: number | null = null;
	private existingRules: any[] = [];

	// DOM elements
	private ruleTypeSelect!: HTMLSelectElement;
	private configArea!: HTMLElement;
	private rangeInput!: HTMLInputElement;
	private ruleListArea!: HTMLElement;
	private previewArea!: HTMLElement;

	constructor(parent: HTMLElement, onAction: (event: CFDialogEvent) => void) {
		this.onAction = onAction;
		this.container = document.createElement('div');
		this.container.className = 'cf-dialog';
		this.container.style.display = 'none';
		parent.appendChild(this.container);
		this.build();
	}

	private build(): void {
		this.container.innerHTML = '';

		// Title bar
		const titleBar = document.createElement('div');
		titleBar.className = 'cf-dialog-title';
		titleBar.textContent = 'Conditional Formatting';

		const closeBtn = document.createElement('button');
		closeBtn.className = 'cf-dialog-close';
		closeBtn.textContent = '×';
		closeBtn.onclick = () => this.hide();
		titleBar.appendChild(closeBtn);
		this.container.appendChild(titleBar);

		// Make dialog draggable via title bar
		this.makeDraggable(titleBar);

		// Body
		const body = document.createElement('div');
		body.className = 'cf-dialog-body';

		// --- Existing rules list ---
		const rulesSection = document.createElement('div');
		rulesSection.className = 'cf-dialog-section';
		const rulesLabel = document.createElement('div');
		rulesLabel.className = 'cf-dialog-label';
		rulesLabel.textContent = 'Active Rules:';
		rulesSection.appendChild(rulesLabel);
		this.ruleListArea = document.createElement('div');
		this.ruleListArea.className = 'cf-rule-list';
		rulesSection.appendChild(this.ruleListArea);
		body.appendChild(rulesSection);

		// --- New Rule Section ---
		const newRuleSection = document.createElement('div');
		newRuleSection.className = 'cf-dialog-section';
		const newRuleLabel = document.createElement('div');
		newRuleLabel.className = 'cf-dialog-label';
		newRuleLabel.textContent = 'New Rule:';
		newRuleSection.appendChild(newRuleLabel);

		// Rule type selector
		const typeRow = document.createElement('div');
		typeRow.className = 'cf-dialog-row';
		const typeLabel = document.createElement('label');
		typeLabel.textContent = 'Rule Type:';
		typeLabel.className = 'cf-input-label';
		this.ruleTypeSelect = document.createElement('select');
		this.ruleTypeSelect.className = 'cf-select';
		let currentCategory = '';
		let optgroup: HTMLOptGroupElement | null = null;
		for (const rt of RULE_TYPES) {
			if (rt.category !== currentCategory) {
				currentCategory = rt.category;
				optgroup = document.createElement('optgroup');
				optgroup.label = currentCategory;
				this.ruleTypeSelect.appendChild(optgroup);
			}
			const opt = document.createElement('option');
			opt.value = rt.value;
			opt.textContent = rt.label;
			(optgroup || this.ruleTypeSelect).appendChild(opt);
		}
		this.ruleTypeSelect.onchange = () => this.updateConfigUI();
		typeRow.appendChild(typeLabel);
		typeRow.appendChild(this.ruleTypeSelect);
		newRuleSection.appendChild(typeRow);

		// Range input
		const rangeRow = document.createElement('div');
		rangeRow.className = 'cf-dialog-row';
		const rangeLabel = document.createElement('label');
		rangeLabel.textContent = 'Applies to:';
		rangeLabel.className = 'cf-input-label';
		this.rangeInput = document.createElement('input');
		this.rangeInput.className = 'cf-input';
		this.rangeInput.placeholder = 'e.g., A1:D10';
		rangeRow.appendChild(rangeLabel);
		rangeRow.appendChild(this.rangeInput);
		newRuleSection.appendChild(rangeRow);

		// Dynamic config area
		this.configArea = document.createElement('div');
		this.configArea.className = 'cf-config-area';
		newRuleSection.appendChild(this.configArea);

		// Preview
		this.previewArea = document.createElement('div');
		this.previewArea.className = 'cf-preview';
		this.previewArea.textContent = 'Preview: AaBbCcYyZz';
		newRuleSection.appendChild(this.previewArea);

		body.appendChild(newRuleSection);
		this.container.appendChild(body);

		// Footer buttons
		const footer = document.createElement('div');
		footer.className = 'cf-dialog-footer';
		const addBtn = document.createElement('button');
		addBtn.className = 'cf-btn cf-btn-primary';
		addBtn.textContent = 'Add Rule';
		addBtn.onclick = () => this.submitRule();
		const cancelBtn = document.createElement('button');
		cancelBtn.className = 'cf-btn';
		cancelBtn.textContent = 'Close';
		cancelBtn.onclick = () => this.hide();
		footer.appendChild(addBtn);
		footer.appendChild(cancelBtn);
		this.container.appendChild(footer);

		this.updateConfigUI();
	}

	private updateConfigUI(): void {
		this.configArea.innerHTML = '';
		const val = this.ruleTypeSelect.value;
		const [ruleType, subType] = val.split(':');

		if (ruleType === 'cellIs') {
			// Value input(s)
			const isBetween = subType === 'between' || subType === 'notBetween';
			const row = document.createElement('div');
			row.className = 'cf-dialog-row';
			const label = document.createElement('label');
			label.className = 'cf-input-label';
			label.textContent = isBetween ? 'Values:' : 'Value:';
			row.appendChild(label);
			const v1 = document.createElement('input');
			v1.className = 'cf-input';
			v1.type = 'number';
			v1.placeholder = isBetween ? 'Min' : 'Value';
			v1.dataset.cfField = 'value1';
			row.appendChild(v1);
			if (isBetween) {
				const andLabel = document.createElement('span');
				andLabel.textContent = ' and ';
				andLabel.style.margin = '0 4px';
				row.appendChild(andLabel);
				const v2 = document.createElement('input');
				v2.className = 'cf-input';
				v2.type = 'number';
				v2.placeholder = 'Max';
				v2.dataset.cfField = 'value2';
				row.appendChild(v2);
			}
			this.configArea.appendChild(row);
			this.addFormatSelector();
		} else if (['containsText', 'notContainsText', 'beginsWith', 'endsWith'].includes(ruleType)) {
			const row = document.createElement('div');
			row.className = 'cf-dialog-row';
			const label = document.createElement('label');
			label.className = 'cf-input-label';
			label.textContent = 'Text:';
			const inp = document.createElement('input');
			inp.className = 'cf-input';
			inp.placeholder = 'Search text';
			inp.dataset.cfField = 'text';
			row.appendChild(label);
			row.appendChild(inp);
			this.configArea.appendChild(row);
			this.addFormatSelector();
		} else if (ruleType === 'top10') {
			const row = document.createElement('div');
			row.className = 'cf-dialog-row';
			const label = document.createElement('label');
			label.className = 'cf-input-label';
			label.textContent = 'Count:';
			const inp = document.createElement('input');
			inp.className = 'cf-input';
			inp.type = 'number';
			inp.value = '10';
			inp.min = '1';
			inp.dataset.cfField = 'rank';
			row.appendChild(label);
			row.appendChild(inp);

			const pctLabel = document.createElement('label');
			pctLabel.style.marginLeft = '8px';
			const pctCheck = document.createElement('input');
			pctCheck.type = 'checkbox';
			pctCheck.dataset.cfField = 'percent';
			pctLabel.appendChild(pctCheck);
			pctLabel.appendChild(document.createTextNode(' %'));
			row.appendChild(pctLabel);
			this.configArea.appendChild(row);
			this.addFormatSelector();
		} else if (ruleType === 'aboveAverage') {
			this.addFormatSelector();
		} else if (ruleType === 'duplicateValues' || ruleType === 'uniqueValues' || ruleType === 'containsBlanks') {
			this.addFormatSelector();
		} else if (ruleType === 'colorScale') {
			const nColors = subType === '2' ? 2 : 3;
			const row = document.createElement('div');
			row.className = 'cf-dialog-row';
			const label = document.createElement('label');
			label.className = 'cf-input-label';
			label.textContent = 'Colors:';
			row.appendChild(label);
			const defaults2 = ['#F8696B', '#63BE7B'];
			const defaults3 = ['#F8696B', '#FFEB84', '#63BE7B'];
			const defaults = nColors === 2 ? defaults2 : defaults3;
			for (let i = 0; i < nColors; i++) {
				const cp = document.createElement('input');
				cp.type = 'color';
				cp.className = 'cf-color-input';
				cp.value = defaults[i];
				cp.dataset.cfField = `csColor${i}`;
				row.appendChild(cp);
			}
			this.configArea.appendChild(row);
		} else if (ruleType === 'dataBar') {
			const row = document.createElement('div');
			row.className = 'cf-dialog-row';
			const label = document.createElement('label');
			label.className = 'cf-input-label';
			label.textContent = 'Bar Color:';
			const cp = document.createElement('input');
			cp.type = 'color';
			cp.className = 'cf-color-input';
			cp.value = '#638EC6';
			cp.dataset.cfField = 'dbColor';
			row.appendChild(label);
			row.appendChild(cp);
			this.configArea.appendChild(row);
		} else if (ruleType === 'iconSet') {
			// Icon style is pre-selected from the dropdown
			const note = document.createElement('div');
			note.className = 'cf-dialog-note';
			note.textContent = `Icon set: ${subType || '3TrafficLights1'}`;
			this.configArea.appendChild(note);
		} else if (ruleType === 'expression') {
			const row = document.createElement('div');
			row.className = 'cf-dialog-row';
			const label = document.createElement('label');
			label.className = 'cf-input-label';
			label.textContent = 'Formula:';
			const inp = document.createElement('input');
			inp.className = 'cf-input';
			inp.placeholder = '=ISODD(A1)';
			inp.dataset.cfField = 'formula';
			row.appendChild(label);
			row.appendChild(inp);
			this.configArea.appendChild(row);
			this.addFormatSelector();
		}

		this.updatePreview();
	}

	private addFormatSelector(): void {
		const row = document.createElement('div');
		row.className = 'cf-dialog-row';
		const label = document.createElement('label');
		label.className = 'cf-input-label';
		label.textContent = 'Format:';
		row.appendChild(label);

		const sel = document.createElement('select');
		sel.className = 'cf-select';
		sel.dataset.cfField = 'formatPreset';
		for (const preset of PRESET_FORMATS) {
			const opt = document.createElement('option');
			opt.value = JSON.stringify(preset);
			opt.textContent = preset.label;
			sel.appendChild(opt);
		}
		sel.onchange = () => this.updatePreview();
		row.appendChild(sel);
		this.configArea.appendChild(row);

		// Custom color pickers (shown when "Custom Format..." selected)
		const customRow = document.createElement('div');
		customRow.className = 'cf-dialog-row cf-custom-colors';
		customRow.style.display = 'none';
		const tcLabel = document.createElement('label');
		tcLabel.className = 'cf-input-label';
		tcLabel.textContent = 'Text:';
		const tcInput = document.createElement('input');
		tcInput.type = 'color';
		tcInput.className = 'cf-color-input';
		tcInput.value = '#ff0000';
		tcInput.dataset.cfField = 'customTextColor';
		const fcLabel = document.createElement('label');
		fcLabel.className = 'cf-input-label';
		fcLabel.textContent = 'Fill:';
		fcLabel.style.marginLeft = '8px';
		const fcInput = document.createElement('input');
		fcInput.type = 'color';
		fcInput.className = 'cf-color-input';
		fcInput.value = '#ffc7ce';
		fcInput.dataset.cfField = 'customFillColor';
		customRow.appendChild(tcLabel);
		customRow.appendChild(tcInput);
		customRow.appendChild(fcLabel);
		customRow.appendChild(fcInput);
		this.configArea.appendChild(customRow);

		sel.addEventListener('change', () => {
			const v = JSON.parse(sel.value);
			customRow.style.display = v.label === 'Custom Format...' ? 'flex' : 'none';
			this.updatePreview();
		});
	}

	private updatePreview(): void {
		const format = this.getSelectedFormat();
		this.previewArea.style.color = format.textColor || '#000';
		this.previewArea.style.backgroundColor = format.fillColor || 'transparent';
		this.previewArea.textContent = 'Preview: AaBbCcYyZz';
	}

	private getSelectedFormat(): { textColor: string; fillColor: string } {
		const presetSel = this.configArea.querySelector('[data-cf-field="formatPreset"]') as HTMLSelectElement | null;
		if (presetSel) {
			const v = JSON.parse(presetSel.value);
			if (v.label === 'Custom Format...') {
				const tc = (this.configArea.querySelector('[data-cf-field="customTextColor"]') as HTMLInputElement)?.value || '';
				const fc = (this.configArea.querySelector('[data-cf-field="customFillColor"]') as HTMLInputElement)?.value || '';
				return { textColor: tc, fillColor: fc };
			}
			return { textColor: v.textColor, fillColor: v.fillColor };
		}
		return { textColor: '', fillColor: '' };
	}

	private submitRule(): void {
		const sqref = this.rangeInput.value.trim();
		if (!sqref) {
			this.rangeInput.style.borderColor = '#ff0000';
			return;
		}
		this.rangeInput.style.borderColor = '';
		const rule = this.buildRuleFromUI();
		if (!rule) return;
		rule.sqref = sqref;

		if (this.editIndex !== null) {
			this.onAction({ action: 'edit', rule, ruleIndex: this.editIndex });
			this.editIndex = null;
		} else {
			this.onAction({ action: 'add', rule });
		}
		this.refreshRuleList();
	}

	private buildRuleFromUI(): ConditionalFormatRuleUI | null {
		const selected = this.ruleTypeSelect.value;
		const [baseType, subType] = selected.split(':');

		const rule: ConditionalFormatRuleUI = {
			rule_type: baseType,
			priority: this.existingRules.length + 1,
			values: [],
			sqref: '',
		};

		if (baseType === 'cellIs') {
			rule.operator = subType;
			const v1 = (this.configArea.querySelector('[data-cf-field="value1"]') as HTMLInputElement)?.value || '0';
			rule.values = [v1];
			if (subType === 'between' || subType === 'notBetween') {
				const v2 = (this.configArea.querySelector('[data-cf-field="value2"]') as HTMLInputElement)?.value || '0';
				rule.values = [v1, v2];
			}
			const fmt = this.getSelectedFormat();
			rule.dxf_style = {};
			if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
			if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
		} else if (['containsText', 'notContainsText', 'beginsWith', 'endsWith'].includes(baseType)) {
			const text = (this.configArea.querySelector('[data-cf-field="text"]') as HTMLInputElement)?.value || '';
			rule.text = text;
			const fmt = this.getSelectedFormat();
			rule.dxf_style = {};
			if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
			if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
		} else if (baseType === 'top10') {
			const rank = parseInt((this.configArea.querySelector('[data-cf-field="rank"]') as HTMLInputElement)?.value || '10');
			const pct = (this.configArea.querySelector('[data-cf-field="percent"]') as HTMLInputElement)?.checked || false;
			rule.rank = rank;
			rule.percent = pct;
			rule.bottom = subType === 'bottom';
			const fmt = this.getSelectedFormat();
			rule.dxf_style = {};
			if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
			if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
		} else if (baseType === 'aboveAverage') {
			rule.above_average = subType !== 'below';
			const fmt = this.getSelectedFormat();
			rule.dxf_style = {};
			if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
			if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
		} else if (baseType === 'duplicateValues' || baseType === 'uniqueValues' || baseType === 'containsBlanks') {
			const fmt = this.getSelectedFormat();
			rule.dxf_style = {};
			if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
			if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
		} else if (baseType === 'colorScale') {
			const nColors = subType === '2' ? 2 : 3;
			const colors: string[] = [];
			for (let i = 0; i < nColors; i++) {
				const cp = this.configArea.querySelector(`[data-cf-field="csColor${i}"]`) as HTMLInputElement;
				colors.push(cp?.value || '#000000');
			}
			rule.color_scale = { colors, values: [], value_types: ['min', ...(nColors === 3 ? ['percentile'] : []), 'max'] };
		} else if (baseType === 'dataBar') {
			const cp = this.configArea.querySelector('[data-cf-field="dbColor"]') as HTMLInputElement;
			rule.data_bar = { color: cp?.value || '#638EC6' };
		} else if (baseType === 'iconSet') {
			rule.icon_set = { icon_style: subType || '3TrafficLights1', thresholds: [], reverse: false };
		} else if (baseType === 'expression') {
			const formula = (this.configArea.querySelector('[data-cf-field="formula"]') as HTMLInputElement)?.value || '';
			rule.values = [formula];
			const fmt = this.getSelectedFormat();
			rule.dxf_style = {};
			if (fmt.textColor) rule.dxf_style.text_color = fmt.textColor;
			if (fmt.fillColor) rule.dxf_style.fill_color = fmt.fillColor;
		}

		return rule;
	}

	private refreshRuleList(): void {
		this.ruleListArea.innerHTML = '';
		if (this.existingRules.length === 0) {
			const empty = document.createElement('div');
			empty.className = 'cf-rule-empty';
			empty.textContent = 'No conditional formatting rules.';
			this.ruleListArea.appendChild(empty);
			return;
		}

		for (let i = 0; i < this.existingRules.length; i++) {
			const rule = this.existingRules[i];
			const item = document.createElement('div');
			item.className = 'cf-rule-item';

			const desc = document.createElement('span');
			desc.className = 'cf-rule-desc';
			desc.textContent = this.describeRule(rule);

			const range = document.createElement('span');
			range.className = 'cf-rule-range';
			range.textContent = rule.sqref;

			const delBtn = document.createElement('button');
			delBtn.className = 'cf-rule-delete';
			delBtn.textContent = '×';
			delBtn.title = 'Delete rule';
			const idx = i;
			delBtn.onclick = (e) => {
				e.stopPropagation();
				this.onAction({ action: 'delete', ruleIndex: idx });
				this.existingRules.splice(idx, 1);
				this.refreshRuleList();
			};

			item.appendChild(desc);
			item.appendChild(range);
			item.appendChild(delBtn);

			// Color preview
			if (rule.dxf_style) {
				const preview = document.createElement('span');
				preview.className = 'cf-rule-preview';
				preview.textContent = 'Ab';
				if (rule.dxf_style.text_color) preview.style.color = rule.dxf_style.text_color;
				if (rule.dxf_style.fill_color) preview.style.backgroundColor = rule.dxf_style.fill_color;
				item.insertBefore(preview, range);
			}

			this.ruleListArea.appendChild(item);
		}
	}

	private describeRule(rule: any): string {
		switch (rule.rule_type) {
			case 'cellIs': return `Cell ${rule.operator || 'is'} ${rule.values?.join(', ') || ''}`;
			case 'containsText': return `Contains "${rule.text || ''}"`;
			case 'notContainsText': return `Does not contain "${rule.text || ''}"`;
			case 'beginsWith': return `Begins with "${rule.text || ''}"`;
			case 'endsWith': return `Ends with "${rule.text || ''}"`;
			case 'top10': return `${rule.bottom ? 'Bottom' : 'Top'} ${rule.rank || 10}${rule.percent ? '%' : ''}`;
			case 'aboveAverage': return rule.above_average !== false ? 'Above Average' : 'Below Average';
			case 'duplicateValues': return 'Duplicate Values';
			case 'uniqueValues': return 'Unique Values';
			case 'containsBlanks': return 'Contains Blanks';
			case 'colorScale': return `${rule.color_scale?.colors?.length || 2}-Color Scale`;
			case 'dataBar': return 'Data Bar';
			case 'iconSet': return `Icon Set (${rule.icon_set?.icon_style || '3TrafficLights'})`;
			case 'expression': return `Formula: ${rule.values?.[0] || ''}`;
			default: return rule.rule_type;
		}
	}

	show(sqref: string, existingRules: any[]): void {
		this.existingRules = existingRules || [];
		this.rangeInput.value = sqref;
		this.editIndex = null;
		this.ruleTypeSelect.value = RULE_TYPES[0].value;
		this.updateConfigUI();
		this.refreshRuleList();
		this.container.style.display = 'flex';
	}

	hide(): void {
		this.container.style.display = 'none';
		this.onAction({ action: 'close' });
	}

	isVisible(): boolean {
		return this.container.style.display !== 'none';
	}

	private makeDraggable(handle: HTMLElement): void {
		let dragging = false;
		let offsetX = 0;
		let offsetY = 0;

		handle.style.cursor = 'move';
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

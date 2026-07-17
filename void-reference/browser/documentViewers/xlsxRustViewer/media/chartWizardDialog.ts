/**
 * ChartWizardDialog -- modal dialog for inserting and editing charts.
 * Follows the same pattern as ConditionalFormatDialog.
 */

import type { ChartDefinition, ChartSeriesData, ChartAnchor } from './chartManager.js';

export interface ChartWizardEvent {
	action: 'insert' | 'update' | 'cancel';
	chartDef?: ChartDefinition;
	editIndex?: number;
}

const CHART_TYPES = [
	{ id: 'column', label: 'Column', icon: '\u2581\u2583\u2585\u2587' },
	{ id: 'bar', label: 'Bar', icon: '\u2590\u2590\u2590' },
	{ id: 'line', label: 'Line', icon: '\u2571\u2572\u2571' },
	{ id: 'area', label: 'Area', icon: '\u25E2\u25E3' },
	{ id: 'pie', label: 'Pie', icon: '\u25D5' },
	{ id: 'doughnut', label: 'Donut', icon: '\u25CE' },
	{ id: 'scatter', label: 'Scatter', icon: '\u2022\u2022\u2022' },
	{ id: 'radar', label: 'Radar', icon: '\u25CB' },
];

const LEGEND_POSITIONS = [
	{ id: 'right', label: 'Right' },
	{ id: 'top', label: 'Top' },
	{ id: 'bottom', label: 'Bottom' },
	{ id: 'left', label: 'Left' },
	{ id: 'none', label: 'None' },
];

const COLOR_SCHEMES = [
	{ id: 'default', label: 'Default', colors: ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'] },
	{ id: 'blue', label: 'Ocean', colors: ['#0077B6', '#00B4D8', '#90E0EF', '#CAF0F8', '#023E8A', '#03045E'] },
	{ id: 'warm', label: 'Warm', colors: ['#FF595E', '#FFCA3A', '#FF924C', '#C8553D', '#8AC926', '#FF6B6B'] },
	{ id: 'mono', label: 'Monochrome', colors: ['#2B2D42', '#8D99AE', '#EDF2F4', '#4A4E69', '#C9CCD5', '#636363'] },
	{ id: 'nature', label: 'Nature', colors: ['#386641', '#6A994E', '#A7C957', '#F2E8CF', '#BC4749', '#774936'] },
];

export class ChartWizardDialog {
	private overlay: HTMLDivElement;
	private dialog: HTMLDivElement;
	private onAction: (event: ChartWizardEvent) => void;
	// State
	private selectedType = 'column';
	private titleInput: HTMLInputElement | null = null;
	private rangeInput: HTMLInputElement | null = null;
	private legendSelect: HTMLSelectElement | null = null;
	private colorSchemeSelect: HTMLSelectElement | null = null;
	private xAxisInput: HTMLInputElement | null = null;
	private yAxisInput: HTMLInputElement | null = null;
	private swapRowsCols: HTMLInputElement | null = null;
	private editIndex?: number;

	constructor(_parent: HTMLElement, onAction: (event: ChartWizardEvent) => void) {
		this.onAction = onAction;

		this.overlay = document.createElement('div');
		this.overlay.className = 'chart-wizard-overlay';
		this.overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);display:none;z-index:10000;align-items:center;justify-content:center;';
		this.overlay.addEventListener('mousedown', (e) => {
			if (e.target === this.overlay) this.hide();
		});

		this.dialog = document.createElement('div');
		this.dialog.className = 'chart-wizard-dialog';
		this.overlay.appendChild(this.dialog);
		document.body.appendChild(this.overlay);
	}

	show(defaultRange: string, anchorRow: number, anchorCol: number, editDef?: ChartDefinition, editIndex?: number) {
		this.editIndex = editIndex;
		this.selectedType = editDef?.chart_type || 'column';
		this.buildUI(defaultRange, anchorRow, anchorCol, editDef);
		this.overlay.style.display = 'flex';
	}

	hide() {
		this.overlay.style.display = 'none';
	}

	isVisible(): boolean {
		return this.overlay.style.display !== 'none';
	}

	private buildUI(defaultRange: string, anchorRow: number, anchorCol: number, editDef?: ChartDefinition) {
		const d = this.dialog;
		d.innerHTML = '';
		d.style.cssText = 'background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-focusBorder,#007acc);border-radius:8px;padding:20px;min-width:500px;max-width:600px;box-shadow:0 8px 32px rgba(0,0,0,0.5);color:var(--vscode-foreground,#ccc);font-size:13px;';

		// Title bar
		const titleBar = document.createElement('div');
		titleBar.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;';
		const title = document.createElement('div');
		title.textContent = editDef ? 'Edit Chart' : 'Insert Chart';
		title.style.cssText = 'font-size:16px;font-weight:600;';
		const closeBtn = document.createElement('button');
		closeBtn.textContent = '\u2715';
		closeBtn.style.cssText = 'background:none;border:none;color:var(--vscode-foreground,#ccc);font-size:16px;cursor:pointer;padding:4px;';
		closeBtn.onclick = () => this.hide();
		titleBar.appendChild(title);
		titleBar.appendChild(closeBtn);
		d.appendChild(titleBar);

		// Step 1: Chart Type
		const section1 = this.section('Chart Type');
		const typeGrid = document.createElement('div');
		typeGrid.style.cssText = 'display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:12px;';
		for (const ct of CHART_TYPES) {
			const btn = document.createElement('button');
			btn.className = `chart-type-btn${ct.id === this.selectedType ? ' selected' : ''}`;
			btn.style.cssText = `padding:8px 4px;border:2px solid ${ct.id === this.selectedType ? 'var(--vscode-focusBorder,#007acc)' : 'var(--vscode-input-border,#555)'};border-radius:6px;background:${ct.id === this.selectedType ? 'rgba(0,122,204,0.15)' : 'transparent'};color:var(--vscode-foreground,#ccc);cursor:pointer;text-align:center;font-size:11px;`;
			const icon = document.createElement('div');
			icon.textContent = ct.icon;
			icon.style.cssText = 'font-size:20px;margin-bottom:2px;';
			const label = document.createElement('div');
			label.textContent = ct.label;
			btn.appendChild(icon);
			btn.appendChild(label);
			btn.onclick = () => {
				this.selectedType = ct.id;
				this.buildUI(this.rangeInput?.value || defaultRange, anchorRow, anchorCol, editDef);
			};
			typeGrid.appendChild(btn);
		}
		section1.appendChild(typeGrid);
		d.appendChild(section1);

		// Step 2: Data Range
		const section2 = this.section('Data Range');
		const rangeRow = document.createElement('div');
		rangeRow.style.cssText = 'display:flex;gap:8px;align-items:center;margin-bottom:8px;';
		const rangeLabel = document.createElement('label');
		rangeLabel.textContent = 'Range:';
		rangeLabel.style.cssText = 'min-width:50px;';
		this.rangeInput = document.createElement('input');
		this.rangeInput.type = 'text';
		this.rangeInput.value = editDef?.series?.[0]?.values_ref?.replace(/.*!/, '') || defaultRange;
		this.rangeInput.placeholder = 'e.g., A1:D10';
		this.rangeInput.style.cssText = 'flex:1;padding:5px 8px;font-size:13px;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;outline:none;';
		this.rangeInput.addEventListener('keydown', (e) => e.stopPropagation());
		rangeRow.appendChild(rangeLabel);
		rangeRow.appendChild(this.rangeInput);
		section2.appendChild(rangeRow);

		// Swap rows/cols checkbox
		const swapRow = document.createElement('div');
		swapRow.style.cssText = 'display:flex;align-items:center;gap:6px;';
		this.swapRowsCols = document.createElement('input');
		this.swapRowsCols.type = 'checkbox';
		this.swapRowsCols.id = 'swap-rows-cols';
		const swapLabel = document.createElement('label');
		swapLabel.htmlFor = 'swap-rows-cols';
		swapLabel.textContent = 'Series in rows (instead of columns)';
		swapLabel.style.cssText = 'font-size:12px;';
		swapRow.appendChild(this.swapRowsCols);
		swapRow.appendChild(swapLabel);
		section2.appendChild(swapRow);
		d.appendChild(section2);

		// Step 3: Customization
		const section3 = this.section('Customization');
		const customGrid = document.createElement('div');
		customGrid.style.cssText = 'display:grid;grid-template-columns:auto 1fr;gap:8px 12px;align-items:center;';

		// Title
		customGrid.appendChild(this.labelEl('Title:'));
		this.titleInput = document.createElement('input');
		this.titleInput.type = 'text';
		this.titleInput.value = editDef?.title || '';
		this.titleInput.placeholder = 'Chart title (optional)';
		this.titleInput.style.cssText = 'padding:5px 8px;font-size:13px;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;outline:none;';
		this.titleInput.addEventListener('keydown', (e) => e.stopPropagation());
		customGrid.appendChild(this.titleInput);

		// Legend
		customGrid.appendChild(this.labelEl('Legend:'));
		this.legendSelect = document.createElement('select');
		this.legendSelect.style.cssText = 'padding:4px 8px;font-size:12px;background:var(--vscode-input-background,#3c3c3c);color:var(--vscode-input-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:3px;';
		for (const lp of LEGEND_POSITIONS) {
			const opt = document.createElement('option');
			opt.value = lp.id;
			opt.textContent = lp.label;
			if (editDef?.legend?.position === lp.id || (!editDef && lp.id === 'right')) opt.selected = true;
			this.legendSelect.appendChild(opt);
		}
		customGrid.appendChild(this.legendSelect);

		// Color scheme
		customGrid.appendChild(this.labelEl('Colors:'));
		this.colorSchemeSelect = document.createElement('select');
		this.colorSchemeSelect.style.cssText = this.legendSelect.style.cssText;
		for (const cs of COLOR_SCHEMES) {
			const opt = document.createElement('option');
			opt.value = cs.id;
			opt.textContent = cs.label;
			this.colorSchemeSelect.appendChild(opt);
		}
		customGrid.appendChild(this.colorSchemeSelect);

		// X Axis
		customGrid.appendChild(this.labelEl('X Axis:'));
		this.xAxisInput = document.createElement('input');
		this.xAxisInput.type = 'text';
		this.xAxisInput.placeholder = 'X axis label (optional)';
		this.xAxisInput.value = editDef?.axes?.find(a => a.axis_type === 'category')?.title || '';
		this.xAxisInput.style.cssText = this.titleInput.style.cssText;
		this.xAxisInput.addEventListener('keydown', (e) => e.stopPropagation());
		customGrid.appendChild(this.xAxisInput);

		// Y Axis
		customGrid.appendChild(this.labelEl('Y Axis:'));
		this.yAxisInput = document.createElement('input');
		this.yAxisInput.type = 'text';
		this.yAxisInput.placeholder = 'Y axis label (optional)';
		this.yAxisInput.value = editDef?.axes?.find(a => a.axis_type === 'value')?.title || '';
		this.yAxisInput.style.cssText = this.titleInput.style.cssText;
		this.yAxisInput.addEventListener('keydown', (e) => e.stopPropagation());
		customGrid.appendChild(this.yAxisInput);

		section3.appendChild(customGrid);
		d.appendChild(section3);

		// Footer buttons
		const footer = document.createElement('div');
		footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;margin-top:16px;';
		const cancelBtn = document.createElement('button');
		cancelBtn.textContent = 'Cancel';
		cancelBtn.style.cssText = 'padding:6px 16px;font-size:13px;background:transparent;color:var(--vscode-foreground,#ccc);border:1px solid var(--vscode-input-border,#555);border-radius:4px;cursor:pointer;';
		cancelBtn.onclick = () => { this.hide(); this.onAction({ action: 'cancel' }); };

		const okBtn = document.createElement('button');
		okBtn.textContent = editDef ? 'Update Chart' : 'Insert Chart';
		okBtn.style.cssText = 'padding:6px 16px;font-size:13px;background:var(--vscode-button-background,#007fd4);color:var(--vscode-button-foreground,#fff);border:none;border-radius:4px;cursor:pointer;font-weight:500;';
		okBtn.onclick = () => this.submit(anchorRow, anchorCol);

		footer.appendChild(cancelBtn);
		footer.appendChild(okBtn);
		d.appendChild(footer);
	}

	private submit(anchorRow: number, anchorCol: number) {
		const range = this.rangeInput?.value || 'A1:D10';
		const title = this.titleInput?.value || undefined;
		const legendPos = this.legendSelect?.value || 'right';
		const colorSchemeId = this.colorSchemeSelect?.value || 'default';
		const xAxisTitle = this.xAxisInput?.value || undefined;
		const yAxisTitle = this.yAxisInput?.value || undefined;

		const colorScheme = COLOR_SCHEMES.find(cs => cs.id === colorSchemeId)?.colors;

		// Build a ChartDefinition from the form values
		const anchor: ChartAnchor = {
			from_col: anchorCol,
			from_row: anchorRow,
			from_col_off: 0,
			from_row_off: 0,
			to_col: anchorCol + 8,
			to_row: anchorRow + 15,
			to_col_off: 0,
			to_row_off: 0,
		};

		// Parse the range into a series -- the user provides a range like "A1:D10"
		const series: ChartSeriesData[] = [{
			values_ref: range,
			categories_cache: [],
			values_cache: [],
		}];

		const axes = [];
		if (this.selectedType !== 'pie' && this.selectedType !== 'doughnut') {
			axes.push({
				title: xAxisTitle,
				position: 'bottom',
				axis_type: 'category',
			});
			axes.push({
				title: yAxisTitle,
				position: 'left',
				axis_type: 'value',
			});
		}

		const chartDef: ChartDefinition = {
			chart_type: this.selectedType,
			series,
			title,
			legend: {
				position: legendPos === 'none' ? 'right' : legendPos,
				visible: legendPos !== 'none',
			},
			axes,
			anchor,
			style: colorScheme ? { color_scheme: colorScheme } : undefined,
		};

		this.hide();
		this.onAction({
			action: this.editIndex !== undefined ? 'update' : 'insert',
			chartDef,
			editIndex: this.editIndex,
		});
	}

	private section(title: string): HTMLDivElement {
		const sec = document.createElement('div');
		sec.style.cssText = 'margin-bottom:14px;';
		const h = document.createElement('div');
		h.textContent = title;
		h.style.cssText = 'font-size:12px;font-weight:600;color:var(--vscode-descriptionForeground,#888);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;';
		sec.appendChild(h);
		return sec;
	}

	private labelEl(text: string): HTMLLabelElement {
		const l = document.createElement('label');
		l.textContent = text;
		l.style.cssText = 'font-size:12px;color:var(--vscode-descriptionForeground,#aaa);';
		return l;
	}
}

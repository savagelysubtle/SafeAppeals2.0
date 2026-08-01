/**
 * ChartManager -- manages Chart.js overlay instances on the XLSX canvas.
 * Each chart is rendered in a positioned HTML div above the spreadsheet canvas,
 * following the same overlay pattern as filter buttons.
 */

import {
	Chart,
	BarController, LineController, PieController, ScatterController,
	DoughnutController, RadarController,
	BarElement, LineElement, PointElement, ArcElement, Filler,
	CategoryScale, LinearScale,
	Title as ChartTitle, Tooltip, Legend as ChartLegend,
} from 'chart.js';

Chart.register(
	BarController, LineController, PieController, ScatterController,
	DoughnutController, RadarController,
	BarElement, LineElement, PointElement, ArcElement, Filler,
	CategoryScale, LinearScale,
	ChartTitle, Tooltip, ChartLegend,
);

// --- Types matching the Rust model ---

export interface ChartAnchor {
	from_col: number;
	from_row: number;
	from_col_off: number;
	from_row_off: number;
	to_col: number;
	to_row: number;
	to_col_off: number;
	to_row_off: number;
}

export interface ChartSeriesData {
	name?: string;
	categories_ref?: string;
	values_ref?: string;
	categories_cache: string[];
	values_cache: number[];
	chart_type?: string;
}

export interface ChartAxisData {
	title?: string;
	position: string;
	min_val?: number;
	max_val?: number;
	axis_type: string;
}

export interface ChartLegendData {
	position: string;
	visible: boolean;
}

export interface ChartStyleData {
	color_scheme?: string[];
}

export interface ChartDefinition {
	chart_type: string;
	series: ChartSeriesData[];
	title?: string;
	legend?: ChartLegendData;
	axes: ChartAxisData[];
	anchor: ChartAnchor;
	style?: ChartStyleData;
}

// --- Renderer coordinate helpers ---

export interface RendererCoords {
	cx(col: number): number;
	ry(row: number): number;
	cw(col: number): number;
	rh(row: number): number;
	getScrollLeft(): number;
	getScrollTop(): number;
	getHeaderWidth(): number;
	getHeaderHeight(): number;
}

// --- Okabe–Ito colorblind-safe categorical palette (hardcoded fallback) ---

const OKABE_ITO_FALLBACK = [
	'#E69F00', '#56B4E9', '#009E73', '#F0E442',
	'#0072B2', '#D55E00', '#CC79A7', '#000000',
];

/** Wizard COLOR_SCHEMES ids → hex arrays (mirrors chartWizardDialog.ts). */
const WIZARD_SCHEME_COLORS: Record<string, string[]> = {
	blue: ['#0077B6', '#00B4D8', '#90E0EF', '#CAF0F8', '#023E8A', '#03045E'],
	warm: ['#FF595E', '#FFCA3A', '#FF924C', '#C8553D', '#8AC926', '#FF6B6B'],
	mono: ['#2B2D42', '#8D99AE', '#EDF2F4', '#4A4E69', '#C9CCD5', '#636363'],
	nature: ['#386641', '#6A994E', '#A7C957', '#F2E8CF', '#BC4749', '#774936'],
};

const GRIDLINE_COLOR = 'rgba(128,128,128,0.14)';
const MAX_BAR_THICKNESS = 48;

// --- ChartOverlay ---

class ChartOverlay {
	container: HTMLDivElement;
	chartCanvas: HTMLCanvasElement;
	chart: Chart;
	def: ChartDefinition;
	index: number;
	selected = false;
	private handles: HTMLDivElement[] = [];

	constructor(def: ChartDefinition, index: number, wrapper: HTMLElement, onSelect: (idx: number) => void, onDelete: (idx: number) => void, onDblClick: (idx: number) => void, onWheel: (e: WheelEvent) => void) {
		this.def = def;
		this.index = index;

		this.container = document.createElement('div');
		this.container.className = 'chart-overlay';
		this.container.style.cssText = 'position:absolute;z-index:10;pointer-events:auto;overflow:hidden;';

		this.chartCanvas = document.createElement('canvas');
		this.chartCanvas.style.cssText = 'width:100%;height:100%;display:block;';
		this.container.appendChild(this.chartCanvas);

		wrapper.appendChild(this.container);

		// Build Chart.js config
		const config = buildChartConfig(def);
		this.chart = new Chart(this.chartCanvas, config);

		// Create resize handles (8: corners + midpoints)
		this.createHandles();

		// Event handlers
		this.container.addEventListener('mousedown', (e) => {
			e.stopPropagation();
			onSelect(this.index);
		});
		this.container.addEventListener('dblclick', (e) => {
			e.stopPropagation();
			onDblClick(this.index);
		});
		this.container.addEventListener('keydown', (e) => {
			if (e.key === 'Delete' || e.key === 'Backspace') {
				e.preventDefault();
				onDelete(this.index);
			}
		});
		this.container.addEventListener('wheel', onWheel, { passive: false });
		this.container.tabIndex = -1;
	}

	private createHandles() {
		const positions = [
			{ cursor: 'nw-resize', top: '-4px', left: '-4px' },
			{ cursor: 'n-resize', top: '-4px', left: 'calc(50% - 4px)' },
			{ cursor: 'ne-resize', top: '-4px', right: '-4px' },
			{ cursor: 'w-resize', top: 'calc(50% - 4px)', left: '-4px' },
			{ cursor: 'e-resize', top: 'calc(50% - 4px)', right: '-4px' },
			{ cursor: 'sw-resize', bottom: '-4px', left: '-4px' },
			{ cursor: 's-resize', bottom: '-4px', left: 'calc(50% - 4px)' },
			{ cursor: 'se-resize', bottom: '-4px', right: '-4px' },
		];
		for (const pos of positions) {
			const h = document.createElement('div');
			h.className = 'chart-resize-handle';
			h.style.cssText = 'position:absolute;width:8px;height:8px;display:none;';
			h.style.cursor = pos.cursor;
			if ('top' in pos && pos.top) h.style.top = pos.top;
			if ('bottom' in pos && pos.bottom) h.style.bottom = pos.bottom;
			if ('left' in pos && pos.left) h.style.left = pos.left;
			if ('right' in pos && pos.right) h.style.right = pos.right;
			this.container.appendChild(h);
			this.handles.push(h);
		}
	}

	setSelected(sel: boolean) {
		this.selected = sel;
		this.container.classList.toggle('selected', sel);
		for (const h of this.handles) {
			h.style.display = sel ? 'block' : 'none';
		}
		if (sel) this.container.focus();
	}

	updatePosition(coords: RendererCoords) {
		const a = this.def.anchor;
		const scrollL = coords.getScrollLeft();
		const scrollT = coords.getScrollTop();
		const headerW = coords.getHeaderWidth();
		const headerH = coords.getHeaderHeight();

		const x1 = coords.cx(a.from_col) - scrollL + headerW;
		const y1 = coords.ry(a.from_row) - scrollT + headerH;
		const x2 = coords.cx(a.to_col) - scrollL + headerW;
		const y2 = coords.ry(a.to_row) - scrollT + headerH;

		const w = Math.max(x2 - x1, 100);
		const h = Math.max(y2 - y1, 80);

		this.container.style.left = `${x1}px`;
		this.container.style.top = `${y1}px`;
		this.container.style.width = `${w}px`;
		this.container.style.height = `${h}px`;

		// Visibility: hide if completely off-screen
		const visible = x2 > headerW && y2 > headerH;
		this.container.style.display = visible ? 'block' : 'none';

		this.chart.resize();
	}

	destroy() {
		this.chart.destroy();
		this.container.remove();
	}
}

// --- ChartManager ---

export type ChartManagerCallback = (action: string, chartIndex: number, data?: ChartDefinition) => void;

export class ChartManager {
	private wrapper: HTMLElement;
	private overlays: ChartOverlay[] = [];
	private onAction: ChartManagerCallback;
	private selectedIndex = -1;

	// Drag state
	private dragMode: 'move' | 'resize' | null = null;
	private dragOverlay: ChartOverlay | null = null;
	private dragStartX = 0;
	private dragStartY = 0;
	private dragOrigLeft = 0;
	private dragOrigTop = 0;
	private dragOrigWidth = 0;
	private dragOrigHeight = 0;
	private dragOrigAnchor: ChartAnchor | null = null;
	private dragHandle = '';
	private dragCoords: RendererCoords | null = null;
	private onWheel: (e: WheelEvent) => void;

	constructor(wrapper: HTMLElement, onAction: ChartManagerCallback, onWheel: (e: WheelEvent) => void) {
		this.wrapper = wrapper;
		this.onAction = onAction;
		this.onWheel = onWheel;

		// Global mouse handlers for drag
		window.addEventListener('mousemove', this.onMouseMove);
		window.addEventListener('mouseup', this.onMouseUp);
	}

	syncCharts(charts: ChartDefinition[] | undefined, coords: RendererCoords) {
		// Destroy existing overlays
		for (const o of this.overlays) o.destroy();
		this.overlays = [];
		this.selectedIndex = -1;

		if (!charts || charts.length === 0) return;

		for (let i = 0; i < charts.length; i++) {
			const overlay = new ChartOverlay(
				charts[i], i, this.wrapper,
				(idx) => this.selectChart(idx),
				(idx) => this.deleteChart(idx),
				(idx) => this.onAction('editChart', idx, this.overlays[idx]?.def),
				this.onWheel,
			);
			overlay.updatePosition(coords);
			this.setupDrag(overlay, coords);
			this.overlays.push(overlay);
		}
	}

	updatePositions(coords: RendererCoords) {
		for (const o of this.overlays) {
			o.updatePosition(coords);
		}
	}

	selectChart(index: number) {
		this.selectedIndex = index;
		for (let i = 0; i < this.overlays.length; i++) {
			this.overlays[i].setSelected(i === index);
		}
		this.onAction('select', index);
	}

	deselectAll() {
		this.selectedIndex = -1;
		for (const o of this.overlays) o.setSelected(false);
	}

	deleteChart(index: number) {
		this.onAction('delete', index);
	}

	getSelectedIndex(): number {
		return this.selectedIndex;
	}

	private setupDrag(overlay: ChartOverlay, coords: RendererCoords) {
		overlay.container.addEventListener('mousedown', (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (target.classList.contains('chart-resize-handle')) {
				this.dragMode = 'resize';
				this.dragHandle = target.style.cursor;
			} else {
				this.dragMode = 'move';
			}
			this.dragOverlay = overlay;
			this.dragStartX = e.clientX;
			this.dragStartY = e.clientY;
			this.dragOrigLeft = parseInt(overlay.container.style.left) || 0;
			this.dragOrigTop = parseInt(overlay.container.style.top) || 0;
			this.dragOrigWidth = parseInt(overlay.container.style.width) || 400;
			this.dragOrigHeight = parseInt(overlay.container.style.height) || 300;
			this.dragOrigAnchor = { ...overlay.def.anchor };
			this.dragCoords = coords;
			e.stopPropagation();
			e.preventDefault();
		});
	}

	private onMouseMove = (e: MouseEvent) => {
		if (!this.dragMode || !this.dragOverlay || !this.dragOrigAnchor) return;

		const dx = e.clientX - this.dragStartX;
		const dy = e.clientY - this.dragStartY;
		const style = this.dragOverlay.container.style;
		const wrapperW = this.wrapper.clientWidth;
		const wrapperH = this.wrapper.clientHeight;
		const headerW = this.dragCoords ? this.dragCoords.getHeaderWidth() : 40;
		const headerH = this.dragCoords ? this.dragCoords.getHeaderHeight() : 24;
		const minSize = 80;

		if (this.dragMode === 'move') {
			let newLeft = this.dragOrigLeft + dx;
			let newTop = this.dragOrigTop + dy;
			const w = this.dragOrigWidth;
			const h = this.dragOrigHeight;
			// Clamp: keep at least 40px visible within the wrapper
			newLeft = Math.max(headerW, Math.min(newLeft, wrapperW - 40));
			newTop = Math.max(headerH, Math.min(newTop, wrapperH - 40));
			// Prevent from going far off-screen right/bottom
			newLeft = Math.min(newLeft, wrapperW - Math.min(w, 40));
			newTop = Math.min(newTop, wrapperH - Math.min(h, 40));
			style.left = `${newLeft}px`;
			style.top = `${newTop}px`;
		} else if (this.dragMode === 'resize') {
			const handle = this.dragHandle;
			let left = this.dragOrigLeft;
			let top = this.dragOrigTop;
			let width = this.dragOrigWidth;
			let height = this.dragOrigHeight;

			if (handle.includes('e')) width = Math.max(minSize, this.dragOrigWidth + dx);
			if (handle.includes('s')) height = Math.max(minSize, this.dragOrigHeight + dy);
			if (handle.includes('w')) {
				const newW = Math.max(minSize, this.dragOrigWidth - dx);
				left = this.dragOrigLeft + (this.dragOrigWidth - newW);
				left = Math.max(headerW, left);
				width = newW;
			}
			if (handle.includes('n')) {
				const newH = Math.max(minSize, this.dragOrigHeight - dy);
				top = this.dragOrigTop + (this.dragOrigHeight - newH);
				top = Math.max(headerH, top);
				height = newH;
			}
			style.left = `${left}px`;
			style.top = `${top}px`;
			style.width = `${width}px`;
			style.height = `${height}px`;
			this.dragOverlay.chart.resize();
		}
	};

	private onMouseUp = (_e: MouseEvent) => {
		if (this.dragMode && this.dragOverlay && this.dragCoords) {
			// Convert final pixel position back to row/col anchor
			const style = this.dragOverlay.container.style;
			const left = parseInt(style.left) || 0;
			const top = parseInt(style.top) || 0;
			const width = parseInt(style.width) || 400;
			const height = parseInt(style.height) || 300;
			const coords = this.dragCoords;
			const scrollL = coords.getScrollLeft();
			const scrollT = coords.getScrollTop();
			const headerW = coords.getHeaderWidth();
			const headerH = coords.getHeaderHeight();

			const pixelX1 = left - headerW + scrollL;
			const pixelY1 = top - headerH + scrollT;
			const pixelX2 = pixelX1 + width;
			const pixelY2 = pixelY1 + height;

			// Find the column/row that contains each pixel coordinate
			const a = this.dragOverlay.def.anchor;
			a.from_col = this.pixelToCol(pixelX1, coords);
			a.from_row = this.pixelToRow(pixelY1, coords);
			a.to_col = Math.max(a.from_col + 2, this.pixelToCol(pixelX2, coords));
			a.to_row = Math.max(a.from_row + 2, this.pixelToRow(pixelY2, coords));

			this.onAction('moved', this.dragOverlay.index, this.dragOverlay.def);
		}
		this.dragMode = null;
		this.dragOverlay = null;
		this.dragOrigAnchor = null;
		this.dragCoords = null;
	};

	private pixelToCol(px: number, coords: RendererCoords): number {
		for (let c = 0; c < 200; c++) {
			if (coords.cx(c) + coords.cw(c) > px) return Math.max(0, c);
		}
		return 0;
	}

	private pixelToRow(px: number, coords: RendererCoords): number {
		for (let r = 0; r < 500; r++) {
			if (coords.ry(r) + coords.rh(r) > px) return Math.max(0, r);
		}
		return 0;
	}

	destroy() {
		for (const o of this.overlays) o.destroy();
		this.overlays = [];
		window.removeEventListener('mousemove', this.onMouseMove);
		window.removeEventListener('mouseup', this.onMouseUp);
	}
}

// --- Theme helpers ---

function resolveCssVar(name: string, fallback: string): string {
	const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
	return value || fallback;
}

function resolveThemePalette(): string[] {
	return Array.from({ length: 8 }, (_, i) =>
		resolveCssVar(`--xlsx-chart-c${i + 1}`, OKABE_ITO_FALLBACK[i])
	);
}

/**
 * Palette order: explicit style.color_scheme → CSS-var Okabe–Ito → hardcoded fallback.
 * color_scheme may be a hex array (wizard non-default) or a single scheme id (e.g. ['blue']).
 */
function resolvePalette(def: ChartDefinition): string[] {
	const scheme = def.style?.color_scheme;
	if (scheme && scheme.length > 0) {
		if (scheme.length === 1) {
			const id = scheme[0];
			if (id === 'default') {
				return resolveThemePalette();
			}
			const mapped = WIZARD_SCHEME_COLORS[id];
			if (mapped) {
				return mapped;
			}
		}
		if (scheme[0].startsWith('#')) {
			return scheme;
		}
	}
	return resolveThemePalette();
}

function hexToRgba(hex: string, alpha: number): string {
	const raw = hex.trim().replace(/^#/, '');
	const full = raw.length === 3
		? raw.split('').map(c => c + c).join('')
		: raw;
	if (full.length !== 6 || !/^[0-9a-fA-F]{6}$/.test(full)) {
		return `rgba(128,128,128,${alpha})`;
	}
	const r = parseInt(full.slice(0, 2), 16);
	const g = parseInt(full.slice(2, 4), 16);
	const b = parseInt(full.slice(4, 6), 16);
	return `rgba(${r},${g},${b},${alpha})`;
}

// --- Build Chart.js Config ---

function buildChartConfig(def: ChartDefinition): any {
	const chartType = mapChartType(def.chart_type);
	const isCategorical = chartType !== 'scatter';
	const palette = resolvePalette(def);

	const titleColor = resolveCssVar('--vscode-foreground', '#cccccc');
	const mutedColor = resolveCssVar('--vscode-descriptionForeground', '#999');
	const overlayBg = resolveCssVar('--vscode-editor-background', '#1e1e1e');

	// Extract labels from first series with categories
	let labels: string[] = [];
	for (const s of def.series) {
		if (s.categories_cache && s.categories_cache.length > 0) {
			labels = s.categories_cache;
			break;
		}
	}

	const isPieLike = chartType === 'pie' || chartType === 'doughnut';
	const isArea = def.chart_type === 'area';
	const isLineLike = chartType === 'line' || isArea;

	// Build datasets
	const datasets: any[] = def.series.map((s, i) => {
		const seriesColor = getColor(palette, i, 1) as string;
		const segmentCount = isPieLike ? Math.max(s.values_cache.length, 1) : 1;
		const fillColor = isPieLike
			? getColor(palette, i, segmentCount)
			: isArea
				? hexToRgba(seriesColor, 0.15)
				: seriesColor;

		const ds: any = {
			label: s.name || `Series ${i + 1}`,
			data: chartType === 'scatter'
				? s.values_cache.map((v, j) => ({
					x: s.categories_cache?.[j] ? parseFloat(s.categories_cache[j]) || j : j,
					y: v
				}))
				: s.values_cache,
			backgroundColor: fillColor,
			borderColor: isPieLike ? overlayBg : seriesColor,
			borderWidth: isPieLike ? 2 : (chartType === 'bar' ? 0 : 2),
		};

		if (chartType === 'bar') {
			ds.borderRadius = 2;
			ds.maxBarThickness = MAX_BAR_THICKNESS;
		}

		if (isLineLike || chartType === 'scatter') {
			ds.tension = isLineLike ? 0.3 : undefined;
			ds.pointRadius = 2;
			ds.pointHoverRadius = 4;
			if (isArea) {
				ds.fill = true;
			} else if (chartType === 'line') {
				ds.fill = false;
			}
		}

		// Combo chart: per-dataset type override
		if (s.chart_type) {
			const dsType = mapChartType(s.chart_type);
			ds.type = dsType;
			if (dsType === 'bar') {
				ds.borderWidth = 0;
				ds.borderRadius = 2;
				ds.maxBarThickness = MAX_BAR_THICKNESS;
				ds.backgroundColor = seriesColor;
			} else if (dsType === 'line') {
				ds.borderWidth = 2;
				ds.tension = 0.3;
				ds.pointRadius = 2;
				ds.pointHoverRadius = 4;
				ds.fill = false;
			}
		}

		return ds;
	});

	// Legend: respect explicit def.legend; when undefined, hide single-series, bottom for multi
	let legendDisplay: boolean;
	let legendPosition: 'top' | 'bottom' | 'left' | 'right';
	if (def.legend !== undefined) {
		legendDisplay = def.legend.visible !== false;
		legendPosition = mapLegendPosition(def.legend.position);
	} else {
		legendDisplay = def.series.length > 1;
		legendPosition = 'bottom';
	}

	const config: any = {
		type: chartType,
		data: {
			labels: isCategorical ? labels : undefined,
			datasets,
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: { duration: 0 },
			plugins: {
				title: {
					display: !!def.title,
					text: def.title || '',
					color: titleColor,
					font: { size: 14, weight: 'bold' },
				},
				legend: {
					display: legendDisplay,
					position: legendPosition,
					labels: { color: mutedColor, font: { size: 11 } },
				},
				tooltip: {
					enabled: true,
					padding: 10,
					cornerRadius: 6,
				},
			},
			scales: {} as Record<string, any>,
		},
	};

	// Axes for non-pie/doughnut charts
	if (chartType !== 'pie' && chartType !== 'doughnut' && chartType !== 'radar') {
		const xAxis: any = {
			ticks: { color: mutedColor },
			grid: { color: GRIDLINE_COLOR },
			border: { display: false },
		};
		const yAxis: any = {
			ticks: { color: mutedColor },
			grid: { color: GRIDLINE_COLOR },
			border: { display: false },
		};

		for (const ax of def.axes) {
			const target = ax.axis_type === 'category' ? xAxis : yAxis;
			if (ax.title) {
				target.title = { display: true, text: ax.title, color: mutedColor };
			}
			if (ax.min_val !== undefined) target.min = ax.min_val;
			if (ax.max_val !== undefined) target.max = ax.max_val;
		}

		config.options.scales = { x: xAxis, y: yAxis };
	}

	if (chartType === 'radar') {
		config.options.scales = {
			r: {
				ticks: { color: mutedColor, backdropColor: 'transparent' },
				grid: { color: GRIDLINE_COLOR },
				angleLines: { color: GRIDLINE_COLOR },
				pointLabels: { color: mutedColor },
			},
		};
	}

	return config;
}

function mapChartType(type: string): string {
	switch (type) {
		case 'bar': case 'column': return 'bar';
		case 'line': return 'line';
		case 'area': return 'line';
		case 'pie': return 'pie';
		case 'doughnut': return 'doughnut';
		case 'scatter': return 'scatter';
		case 'radar': return 'radar';
		default: return 'bar';
	}
}

function mapLegendPosition(pos?: string): 'top' | 'bottom' | 'left' | 'right' {
	switch (pos) {
		case 'top': return 'top';
		case 'bottom': return 'bottom';
		case 'left': return 'left';
		case 'right': return 'right';
		default: return 'right';
	}
}

function getColor(palette: string[], index: number, count: number): string | string[] {
	if (count > 1) {
		return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
	}
	return palette[index % palette.length];
}

// Ribbon Toolbar for XLSX Rust Viewer — Excel-style layout with SVG icons

export interface RibbonEvent {
	action: string;
	value?: string;
}

// --- SVG Icon Library (16x16 viewBox, stroke-based) ---
const IC: Record<string, string> = {
	paste: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor"><rect x="3" y="5" width="10" height="10" rx="1" stroke-width="1.2"/><path d="M6 5V3a1.5 1.5 0 013 0v2" stroke-width="1.2"/><line x1="6" y1="9" x2="10" y2="9" stroke-width="1"/><line x1="6" y1="11.5" x2="10" y2="11.5" stroke-width="1"/></svg>',
	cut: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><circle cx="5" cy="12" r="2"/><circle cx="11" cy="12" r="2"/><path d="M6.5 10.5L10 3M9.5 10.5L6 3"/></svg>',
	copy: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="5" y="5" width="9" height="9" rx="1"/><path d="M11 5V3a1 1 0 00-1-1H3a1 1 0 00-1 1v7a1 1 0 001 1h2"/></svg>',
	undo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h6a3 3 0 010 6H7"/><path d="M6.5 3.5L4 6l2.5 2.5"/></svg>',
	redo: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6H6a3 3 0 000 6h3"/><path d="M9.5 3.5L12 6 9.5 8.5"/></svg>',
	save: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M13 15H3a1 1 0 01-1-1V2a1 1 0 011-1h8l3 3v10a1 1 0 01-1 1z"/><path d="M5 1v4h5V1"/><rect x="4" y="9" width="8" height="5" rx=".5"/></svg>',
	print: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M4 5V1h8v4"/><rect x="2" y="5" width="12" height="6" rx="1"/><path d="M4 9v5h8V9"/><circle cx="11" cy="7.5" r=".5" fill="currentColor"/></svg>',
	exportPdf: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6z"/><path d="M9 1v5h5"/><path d="M8 13l3-3m0 0v3m0-3H8"/></svg>',
	alignL: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="3" x2="14" y2="3"/><line x1="2" y1="6.5" x2="10" y2="6.5"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="2" y1="13" x2="10" y2="13"/></svg>',
	alignC: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="3" x2="14" y2="3"/><line x1="4" y1="6.5" x2="12" y2="6.5"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="4" y1="13" x2="12" y2="13"/></svg>',
	alignR: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><line x1="2" y1="3" x2="14" y2="3"/><line x1="6" y1="6.5" x2="14" y2="6.5"/><line x1="2" y1="10" x2="14" y2="10"/><line x1="6" y1="13" x2="14" y2="13"/></svg>',
	wrap: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="2" y1="3" x2="14" y2="3"/><path d="M2 8h9.5a2.5 2.5 0 010 5H9"/><path d="M10.5 11.5L9 13l1.5 1.5"/></svg>',
	merge: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="14" height="8" rx="1"/><path d="M5 8h6M5 8l1.5-1.5M5 8l1.5 1.5M11 8l-1.5-1.5M11 8l-1.5 1.5"/></svg>',
	insertRow: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="6" width="14" height="4" rx=".5"/><line x1="8" y1="1" x2="8" y2="5"/><line x1="6" y1="3" x2="10" y2="3"/><rect x="1" y="11" width="14" height="4" rx=".5"/></svg>',
	insertCol: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="4" height="14" rx=".5"/><rect x="10" y="1" width="4" height="14" rx=".5"/><line x1="6" y1="8" x2="9" y2="8"/><line x1="7.5" y1="6" x2="7.5" y2="10"/></svg>',
	deleteRow: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="6" width="14" height="4" rx=".5"/><line x1="5" y1="3" x2="11" y2="3"/><rect x="1" y="11" width="14" height="4" rx=".5"/></svg>',
	deleteCol: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="4" height="14" rx=".5"/><rect x="10" y="1" width="4" height="14" rx=".5"/><line x1="6" y1="8" x2="9" y2="8"/></svg>',
	sortAsc: '<svg viewBox="0 0 16 16" fill="currentColor" stroke="none"><text x="1" y="6.5" font-size="6" font-weight="600" font-family="system-ui">A</text><text x="1" y="13" font-size="6" font-weight="600" font-family="system-ui">Z</text><path d="M12 3v10M12 13l-2.5-3h5z" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
	sortDesc: '<svg viewBox="0 0 16 16" fill="currentColor" stroke="none"><text x="1" y="6.5" font-size="6" font-weight="600" font-family="system-ui">Z</text><text x="1" y="13" font-size="6" font-weight="600" font-family="system-ui">A</text><path d="M12 3v10M12 13l-2.5-3h5z" stroke="currentColor" stroke-width="1" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
	clear: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M2 4h12M5 4V2.5a.5.5 0 01.5-.5h5a.5.5 0 01.5.5V4"/><path d="M3.5 4l1 10.5h7L12.5 4"/><line x1="6.5" y1="7" x2="6.5" y2="12"/><line x1="9.5" y1="7" x2="9.5" y2="12"/></svg>',
	gridlines: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5.5" x2="15" y2="5.5"/><line x1="1" y1="10.5" x2="15" y2="10.5"/><line x1="5.5" y1="1" x2="5.5" y2="15"/><line x1="10.5" y1="1" x2="10.5" y2="15"/></svg>',
	headers: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5.5" x2="15" y2="5.5"/><line x1="5.5" y1="1" x2="5.5" y2="15"/><rect x="1" y="1" width="4.5" height="4.5" fill="currentColor" opacity=".2"/><rect x="1" y="5.5" width="4.5" height="9.5" fill="currentColor" opacity=".1"/><rect x="5.5" y="1" width="9.5" height="4.5" fill="currentColor" opacity=".1"/></svg>',
	freeze: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><line x1="8" y1="1" x2="8" y2="15"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/><circle cx="8" cy="8" r="1.5" fill="currentColor"/></svg>',
	sigma: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3H4l4 5-4 5h8"/></svg>',
	table: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><line x1="1" y1="9" x2="15" y2="9"/><line x1="1" y1="13" x2="15" y2="13"/><line x1="5.5" y1="1" x2="5.5" y2="15"/><line x1="10.5" y1="1" x2="10.5" y2="15"/></svg>',
	tableStyle: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><line x1="1" y1="9" x2="15" y2="9"/><rect x="1" y="1" width="14" height="4" rx="1" fill="currentColor" opacity=".25"/><rect x="1" y="5" width="5" height="4" fill="currentColor" opacity=".08"/><rect x="1" y="9" width="5" height="4" fill="currentColor" opacity=".08"/></svg>',
	filter: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h12l-4.5 5v4l-3 2V8z"/></svg>',
	totals: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><line x1="2" y1="12.5" x2="14" y2="12.5" stroke-width="2"/><line x1="2" y1="10" x2="14" y2="10" stroke-width=".8"/><path d="M4 3l2.5 5M6.5 8l2.5-5M4 4.5h5"/></svg>',
	convertRange: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><path d="M8 8l-2 2 2 2"/><path d="M8 8l2 2-2 2"/></svg>',
	condFormat: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="6" height="14" rx="1"/><rect x="9" y="1" width="6" height="14" rx="1"/><rect x="1" y="1" width="6" height="5" fill="#ff6b6b" opacity=".6" rx="1"/><rect x="1" y="6" width="6" height="4" fill="#ffd93d" opacity=".6"/><rect x="1" y="10" width="6" height="5" fill="#6bcb77" opacity=".6" rx="1"/><rect x="9" y="1" width="6" height="14" rx="1"/><rect x="10" y="3" width="4" height="2" fill="#4472c4" opacity=".7" rx=".5"/><rect x="10" y="7" width="2.5" height="2" fill="#4472c4" opacity=".7" rx=".5"/><rect x="10" y="11" width="1" height="2" fill="#4472c4" opacity=".7" rx=".5"/></svg>',
	chart: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="14" height="14" rx="1"/><rect x="3" y="9" width="2" height="5" fill="#4472C4" stroke="none" rx=".3"/><rect x="7" y="5" width="2" height="9" fill="#ED7D31" stroke="none" rx=".3"/><rect x="11" y="7" width="2" height="7" fill="#70AD47" stroke="none" rx=".3"/></svg>',
};

// Color theme for each built-in table style (header color, banded row color)
interface StyleEntry { header: string; band: string; label: string }
const LIGHT_STYLES: [string, StyleEntry][] = [
	['TableStyleLight1',  { header: '#000000', band: '#f7f7f7', label: 'Black' }],
	['TableStyleLight2',  { header: '#4472c4', band: '#edf2fa', label: 'Blue' }],
	['TableStyleLight3',  { header: '#ed7d31', band: '#fef4eb', label: 'Orange' }],
	['TableStyleLight4',  { header: '#a5a5a5', band: '#f5f5f5', label: 'Gray' }],
	['TableStyleLight5',  { header: '#ffc000', band: '#fffbef', label: 'Gold' }],
	['TableStyleLight6',  { header: '#5b9bd5', band: '#eef4fa', label: 'Sky' }],
	['TableStyleLight7',  { header: '#70ad47', band: '#f0f7ec', label: 'Green' }],
	['TableStyleLight8',  { header: '#000000', band: '#f2f2f2', label: 'Black 2' }],
	['TableStyleLight9',  { header: '#4472c4', band: '#dbe5f5', label: 'Blue 2' }],
	['TableStyleLight10', { header: '#ed7d31', band: '#fce4cc', label: 'Orange 2' }],
	['TableStyleLight11', { header: '#a5a5a5', band: '#ececec', label: 'Gray 2' }],
	['TableStyleLight12', { header: '#ffc000', band: '#fff5d5', label: 'Gold 2' }],
	['TableStyleLight13', { header: '#5b9bd5', band: '#dde9f5', label: 'Sky 2' }],
	['TableStyleLight14', { header: '#70ad47', band: '#e2efda', label: 'Green 2' }],
	['TableStyleLight15', { header: '#000000', band: '#e8e8e8', label: 'Black 3' }],
	['TableStyleLight16', { header: '#4472c4', band: '#c9d8f0', label: 'Blue 3' }],
	['TableStyleLight17', { header: '#ed7d31', band: '#f9d5ad', label: 'Orange 3' }],
	['TableStyleLight18', { header: '#a5a5a5', band: '#e0e0e0', label: 'Gray 3' }],
	['TableStyleLight19', { header: '#ffc000', band: '#ffefb8', label: 'Gold 3' }],
	['TableStyleLight20', { header: '#5b9bd5', band: '#ccddf0', label: 'Sky 3' }],
	['TableStyleLight21', { header: '#70ad47', band: '#d4e7c8', label: 'Green 3' }],
];
const MEDIUM_STYLES: [string, StyleEntry][] = [
	['TableStyleMedium1',  { header: '#000000', band: '#e0e0e0', label: 'Black' }],
	['TableStyleMedium2',  { header: '#4472c4', band: '#d6e4f0', label: 'Blue' }],
	['TableStyleMedium3',  { header: '#ed7d31', band: '#fce4cc', label: 'Orange' }],
	['TableStyleMedium4',  { header: '#a5a5a5', band: '#dcdcdc', label: 'Gray' }],
	['TableStyleMedium5',  { header: '#ffc000', band: '#fff2cc', label: 'Gold' }],
	['TableStyleMedium6',  { header: '#5b9bd5', band: '#dce6f0', label: 'Sky' }],
	['TableStyleMedium7',  { header: '#70ad47', band: '#e2efda', label: 'Green' }],
	['TableStyleMedium8',  { header: '#000000', band: '#d0d0d0', label: 'Black 2' }],
	['TableStyleMedium9',  { header: '#4472c4', band: '#b8cde5', label: 'Blue 2' }],
	['TableStyleMedium10', { header: '#ed7d31', band: '#f9c99a', label: 'Orange 2' }],
	['TableStyleMedium11', { header: '#a5a5a5', band: '#cccccc', label: 'Gray 2' }],
	['TableStyleMedium12', { header: '#ffc000', band: '#ffe599', label: 'Gold 2' }],
	['TableStyleMedium13', { header: '#5b9bd5', band: '#bdd0e5', label: 'Sky 2' }],
	['TableStyleMedium14', { header: '#70ad47', band: '#c5dfb5', label: 'Green 2' }],
	['TableStyleMedium15', { header: '#000000', band: '#c0c0c0', label: 'Black 3' }],
	['TableStyleMedium16', { header: '#4472c4', band: '#9ab6da', label: 'Blue 3' }],
	['TableStyleMedium17', { header: '#ed7d31', band: '#f6ae68', label: 'Orange 3' }],
	['TableStyleMedium18', { header: '#a5a5a5', band: '#bcbcbc', label: 'Gray 3' }],
	['TableStyleMedium19', { header: '#ffc000', band: '#ffd966', label: 'Gold 3' }],
	['TableStyleMedium20', { header: '#5b9bd5', band: '#9dbada', label: 'Sky 3' }],
	['TableStyleMedium21', { header: '#70ad47', band: '#a8cf90', label: 'Green 3' }],
	['TableStyleMedium22', { header: '#000000', band: '#b0b0b0', label: 'Black 4' }],
	['TableStyleMedium23', { header: '#4472c4', band: '#7ca0cf', label: 'Blue 4' }],
	['TableStyleMedium24', { header: '#ed7d31', band: '#f39336', label: 'Orange 4' }],
	['TableStyleMedium25', { header: '#a5a5a5', band: '#aaaaaa', label: 'Gray 4' }],
	['TableStyleMedium26', { header: '#ffc000', band: '#ffcc33', label: 'Gold 4' }],
	['TableStyleMedium27', { header: '#5b9bd5', band: '#7ea4cf', label: 'Sky 4' }],
	['TableStyleMedium28', { header: '#70ad47', band: '#8bbf6b', label: 'Green 4' }],
];
const DARK_STYLES: [string, StyleEntry][] = [
	['TableStyleDark1',  { header: '#000000', band: '#404040', label: 'Black' }],
	['TableStyleDark2',  { header: '#4472c4', band: '#2b4a7a', label: 'Blue' }],
	['TableStyleDark3',  { header: '#ed7d31', band: '#7a4018', label: 'Orange' }],
	['TableStyleDark4',  { header: '#a5a5a5', band: '#5a5a5a', label: 'Gray' }],
	['TableStyleDark5',  { header: '#ffc000', band: '#8a6800', label: 'Gold' }],
	['TableStyleDark6',  { header: '#5b9bd5', band: '#2f5e8a', label: 'Sky' }],
	['TableStyleDark7',  { header: '#70ad47', band: '#3a5925', label: 'Green' }],
	['TableStyleDark8',  { header: '#1a1a1a', band: '#333333', label: 'Charcoal' }],
	['TableStyleDark9',  { header: '#264478', band: '#1a3060', label: 'Navy' }],
	['TableStyleDark10', { header: '#c55a11', band: '#6b3510', label: 'Rust' }],
	['TableStyleDark11', { header: '#7030a0', band: '#3d1a57', label: 'Purple' }],
];
// Combined lookup for style picker and ribbon references
const TABLE_STYLE_COLORS: Record<string, StyleEntry> = {};
for (const arr of [LIGHT_STYLES, MEDIUM_STYLES, DARK_STYLES]) {
	for (const [name, entry] of arr) {
		TABLE_STYLE_COLORS[name] = entry;
	}
}

export class Ribbon {
	private container: HTMLElement;
	private onAction: (event: RibbonEvent) => void;
	private activeTab: string = 'home';
	private tabContents: Map<string, HTMLElement> = new Map();
	private tabButtons: Map<string, HTMLElement> = new Map();
	private selectedTableStyle: string = 'TableStyleMedium2';

	constructor(container: HTMLElement, onAction: (event: RibbonEvent) => void) {
		this.container = container;
		this.onAction = onAction;
		this.build();
	}

	/** Returns the currently selected table style name for new table creation */
	getSelectedTableStyle(): string {
		return this.selectedTableStyle;
	}

	private build() {
		this.container.innerHTML = '';
		this.container.className = 'xlsx-ribbon';

		// --- Tab Bar ---
		const tabBar = this.el('div', 'ribbon-tab-bar');
		const tabsLeft = this.el('div', 'ribbon-tabs-left');
		for (const name of ['Home', 'Insert', 'View', 'Data']) {
			const key = name.toLowerCase();
			const btn = this.el('button', `ribbon-tab${key === this.activeTab ? ' active' : ''}`);
			btn.textContent = name;
			btn.onclick = () => this.switchTab(key);
			this.tabButtons.set(key, btn);
			tabsLeft.appendChild(btn);
		}
		tabBar.appendChild(tabsLeft);

		// File operations (always visible, right-aligned)
		const fileOps = this.el('div', 'ribbon-file-ops');
		fileOps.appendChild(this.iconBtn(IC.save, 'Save', 'save', 'Ctrl+S'));
		fileOps.appendChild(this.iconBtn(IC.print, 'Print', 'print', 'Ctrl+P'));
		fileOps.appendChild(this.iconBtn(IC.exportPdf, 'Export', 'exportPDF'));
		tabBar.appendChild(fileOps);
		this.container.appendChild(tabBar);

		// --- Tab Content ---
		const content = this.el('div', 'ribbon-content');
		content.appendChild(this.buildHomeTab());
		content.appendChild(this.buildInsertTab());
		content.appendChild(this.buildViewTab());
		content.appendChild(this.buildDataTab());
		this.container.appendChild(content);
	}

	// ======================= HOME TAB =======================
	private buildHomeTab(): HTMLElement {
		const panel = this.tabPanel('home', true);

		// --- Clipboard (Excel-style: tall Paste + stacked Cut/Copy) ---
		const clip = this.group('Clipboard');
		const clipBody = this.el('div', 'group-body clip-layout');
		const pasteBtn = this.tallBtn(IC.paste, 'Paste', 'paste');
		clipBody.appendChild(pasteBtn);
		const clipStack = this.el('div', 'clip-stack');
		clipStack.appendChild(this.iconBtn(IC.cut, 'Cut', 'cut', 'Ctrl+X'));
		clipStack.appendChild(this.iconBtn(IC.copy, 'Copy', 'copy', 'Ctrl+C'));
		clipBody.appendChild(clipStack);
		clip.insertBefore(clipBody, clip.lastChild);
		panel.appendChild(clip);

		// --- History ---
		const hist = this.group('History');
		const histBody = this.el('div', 'group-body');
		const histRow = this.el('div', 'btn-col');
		histRow.appendChild(this.iconBtn(IC.undo, 'Undo', 'undo', 'Ctrl+Z'));
		histRow.appendChild(this.iconBtn(IC.redo, 'Redo', 'redo', 'Ctrl+Y'));
		histBody.appendChild(histRow);
		hist.insertBefore(histBody, hist.lastChild);
		panel.appendChild(hist);

		// --- Font ---
		const font = this.group('Font');
		const fontBody = this.el('div', 'group-body font-body');
		// Row 1: dropdowns
		const fontR1 = this.el('div', 'btn-row');
		fontR1.appendChild(this.selectEl('fontFamily', [
			'system-ui', 'Arial', 'Calibri', 'Courier New', 'Georgia',
			'Helvetica', 'Times New Roman', 'Verdana'
		], undefined, 'font-select'));
		fontR1.appendChild(this.selectEl('fontSize', [
			'8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '36', '48', '72'
		], '13', 'size-select'));
		fontBody.appendChild(fontR1);
		// Row 2: format buttons + color
		const fontR2 = this.el('div', 'btn-row');
		fontR2.appendChild(this.fmtBtn('B', 'bold', 'fmt-bold'));
		fontR2.appendChild(this.fmtBtn('I', 'italic', 'fmt-italic'));
		fontR2.appendChild(this.fmtBtn('U', 'underline', 'fmt-underline'));
		fontR2.appendChild(this.fmtBtn('S', 'strikethrough', 'fmt-strike'));
		fontR2.appendChild(this.el('span', 'btn-separator'));
		fontR2.appendChild(this.colorBtn('A', 'textColor', '#cccccc'));
		fontR2.appendChild(this.colorBtn('\u25A0', 'fillColor', '#3c3c3c'));
		fontBody.appendChild(fontR2);
		font.insertBefore(fontBody, font.lastChild);
		panel.appendChild(font);

		// --- Alignment ---
		const align = this.group('Alignment');
		const alignBody = this.el('div', 'group-body');
		const alignR1 = this.el('div', 'btn-row');
		alignR1.appendChild(this.iconOnlyBtn(IC.alignL, 'alignLeft', 'Align Left'));
		alignR1.appendChild(this.iconOnlyBtn(IC.alignC, 'alignCenter', 'Align Center'));
		alignR1.appendChild(this.iconOnlyBtn(IC.alignR, 'alignRight', 'Align Right'));
		alignBody.appendChild(alignR1);
		const alignR2 = this.el('div', 'btn-row');
		alignR2.appendChild(this.iconBtn(IC.wrap, 'Wrap', 'wrapText'));
		alignR2.appendChild(this.iconBtn(IC.merge, 'Merge', 'mergeCells'));
		alignBody.appendChild(alignR2);
		align.insertBefore(alignBody, align.lastChild);
		panel.appendChild(align);

		// --- Number ---
		const numGrp = this.group('Number');
		const numBody = this.el('div', 'group-body');
		const numR1 = this.el('div', 'btn-row');
		numR1.appendChild(this.selectEl('numberFormat', [
			'General', 'Number', 'Currency', 'Percentage', 'Date', 'Text'
		], undefined, 'num-select'));
		numBody.appendChild(numR1);
		const numR2 = this.el('div', 'btn-row');
		numR2.appendChild(this.fmtBtn('$', 'currency'));
		numR2.appendChild(this.fmtBtn('%', 'percent'));
		numR2.appendChild(this.fmtBtn(',', 'comma'));
		numR2.appendChild(this.el('span', 'btn-separator'));
		numR2.appendChild(this.fmtBtn('.0+', 'increaseDecimal'));
		numR2.appendChild(this.fmtBtn('.0\u2013', 'decreaseDecimal'));
		numBody.appendChild(numR2);
		numGrp.insertBefore(numBody, numGrp.lastChild);
		panel.appendChild(numGrp);

		// --- Cells ---
		const cells = this.group('Cells');
		const cellsBody = this.el('div', 'group-body');
		const cellR1 = this.el('div', 'btn-row');
		cellR1.appendChild(this.iconBtn(IC.insertRow, '+ Row', 'insertRow', 'Insert Row'));
		cellR1.appendChild(this.iconBtn(IC.insertCol, '+ Col', 'insertCol', 'Insert Column'));
		cellsBody.appendChild(cellR1);
		const cellR2 = this.el('div', 'btn-row');
		cellR2.appendChild(this.iconBtn(IC.deleteRow, '\u2013 Row', 'deleteRow', 'Delete Row'));
		cellR2.appendChild(this.iconBtn(IC.deleteCol, '\u2013 Col', 'deleteCol', 'Delete Column'));
		cellsBody.appendChild(cellR2);
		cells.insertBefore(cellsBody, cells.lastChild);
		panel.appendChild(cells);

		// --- Styles ---
		const stylesGroup = this.group('Styles');
		const stylesBody = this.el('div', 'group-body');
		stylesBody.appendChild(this.tallBtn(IC.condFormat, 'Cond.\nFormat', 'conditionalFormatting'));
		stylesGroup.insertBefore(stylesBody, stylesGroup.lastChild);
		panel.appendChild(stylesGroup);

		// --- Formulas ---
		const fx = this.group('Formulas');
		const fxBody = this.el('div', 'group-body');
		const fxR1 = this.el('div', 'btn-row');
		fxR1.appendChild(this.iconBtn(IC.sigma, 'SUM', 'formulaSum'));
		fxR1.appendChild(this.fmtBtn('AVG', 'formulaAvg'));
		fxR1.appendChild(this.fmtBtn('CNT', 'formulaCount'));
		fxBody.appendChild(fxR1);
		const fxR2 = this.el('div', 'btn-row');
		fxR2.appendChild(this.fmtBtn('MIN', 'formulaMin'));
		fxR2.appendChild(this.fmtBtn('MAX', 'formulaMax'));
		fxBody.appendChild(fxR2);
		fx.insertBefore(fxBody, fx.lastChild);
		panel.appendChild(fx);

		return panel;
	}

	// ======================= INSERT TAB =======================
	private buildInsertTab(): HTMLElement {
		const panel = this.tabPanel('insert', false);

		// --- Charts group ---
		const chartGroup = this.group('Charts');
		const chartBody = this.el('div', 'group-body');
		chartBody.appendChild(this.tallBtn(IC.chart, 'Chart', 'insertChart'));
		chartGroup.insertBefore(chartBody, chartGroup.lastChild);
		panel.appendChild(chartGroup);

		// --- Tables group ---
		const tblGroup = this.group('Tables');
		const tblBody = this.el('div', 'group-body');
		tblBody.appendChild(this.tallBtn(IC.table, 'Table', 'createTable'));
		tblBody.appendChild(this.buildTableStylePicker());
		tblBody.appendChild(this.iconBtn(IC.convertRange, 'To Range', 'convertToRange', 'Convert Table to Range'));
		tblGroup.insertBefore(tblBody, tblGroup.lastChild);
		panel.appendChild(tblGroup);

		// --- Rows & Columns group ---
		const rcGroup = this.group('Rows & Columns');
		const rcBody = this.el('div', 'group-body');
		const rcR1 = this.el('div', 'btn-row');
		rcR1.appendChild(this.iconBtn(IC.insertRow, '+ Row', 'insertRow', 'Insert Row'));
		rcR1.appendChild(this.iconBtn(IC.insertCol, '+ Col', 'insertCol', 'Insert Column'));
		rcBody.appendChild(rcR1);
		const rcR2 = this.el('div', 'btn-row');
		rcR2.appendChild(this.iconBtn(IC.deleteRow, '\u2013 Row', 'deleteRow', 'Delete Row'));
		rcR2.appendChild(this.iconBtn(IC.deleteCol, '\u2013 Col', 'deleteCol', 'Delete Column'));
		rcBody.appendChild(rcR2);
		rcGroup.insertBefore(rcBody, rcGroup.lastChild);
		panel.appendChild(rcGroup);

		return panel;
	}

	/** Visual table style picker — shows colored mini table previews in a categorized dropdown grid */
	private buildTableStylePicker(): HTMLElement {
		const wrapper = document.createElement('div');
		wrapper.className = 'table-style-picker';
		wrapper.style.cssText = 'position:relative;display:inline-block;';

		// Trigger button showing current style swatch
		const trigger = document.createElement('button');
		trigger.className = 'ribbon-btn icon-btn table-style-trigger';
		trigger.title = 'Table Styles';
		const currentColors = TABLE_STYLE_COLORS[this.selectedTableStyle] || TABLE_STYLE_COLORS['TableStyleMedium2'];
		trigger.innerHTML = `${this.miniTableSvg(currentColors.header, currentColors.band)}<span class="btn-label">Styles</span>`;

		// Dropdown panel — use position:fixed to escape overflow:hidden on .ribbon-content
		const dropdown = document.createElement('div');
		dropdown.className = 'table-style-dropdown';
		dropdown.style.cssText = 'display:none;position:fixed;z-index:9999;background:var(--vscode-editor-background,#1e1e1e);border:1px solid var(--vscode-focusBorder,#007fd4);border-radius:4px;padding:8px;box-shadow:0 4px 12px rgba(0,0,0,0.4);max-height:400px;overflow-y:auto;width:260px;';

		const allCells: HTMLButtonElement[] = [];

		// Build a section for each category
		const categories: [string, [string, StyleEntry][]][] = [
			['Light', LIGHT_STYLES],
			['Medium', MEDIUM_STYLES],
			['Dark', DARK_STYLES],
		];

		for (const [catName, styles] of categories) {
			// Section header
			const header = document.createElement('div');
			header.textContent = catName;
			header.style.cssText = 'font-size:11px;font-weight:bold;color:var(--vscode-descriptionForeground,#888);padding:4px 2px 2px;margin-top:4px;';
			dropdown.appendChild(header);

			// 7-column grid for this category
			const grid = document.createElement('div');
			grid.style.cssText = 'display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:2px;';

			for (const [styleName, colors] of styles) {
				const cell = document.createElement('button');
				cell.className = 'table-style-cell';
				cell.title = `${catName} - ${colors.label}`;
				cell.style.cssText = `border:2px solid ${styleName === this.selectedTableStyle ? 'var(--vscode-focusBorder,#007fd4)' : 'transparent'};border-radius:3px;padding:2px;background:transparent;cursor:pointer;display:flex;align-items:center;justify-content:center;`;
				cell.innerHTML = this.miniTableSvg(colors.header, colors.band);
				cell.onclick = () => {
					this.selectedTableStyle = styleName;
					const newColors = TABLE_STYLE_COLORS[styleName];
					trigger.innerHTML = `${this.miniTableSvg(newColors.header, newColors.band)}<span class="btn-label">Styles</span>`;
					// Highlight selected
					allCells.forEach(c => { c.style.borderColor = 'transparent'; });
					cell.style.borderColor = 'var(--vscode-focusBorder,#007fd4)';
					dropdown.style.display = 'none';
					this.onAction({ action: 'setTableStyle', value: styleName });
				};
				allCells.push(cell);
				grid.appendChild(cell);
			}

			dropdown.appendChild(grid);
		}

		trigger.onclick = () => {
			const isHidden = dropdown.style.display === 'none';
			if (isHidden) {
				// Position dropdown below the trigger using fixed positioning
				const rect = trigger.getBoundingClientRect();
				dropdown.style.left = `${rect.left}px`;
				dropdown.style.top = `${rect.bottom + 2}px`;
				// Clamp to viewport so it doesn't overflow off-screen
				dropdown.style.display = 'block';
				const dropRect = dropdown.getBoundingClientRect();
				if (dropRect.right > window.innerWidth) {
					dropdown.style.left = `${window.innerWidth - dropRect.width - 4}px`;
				}
				if (dropRect.bottom > window.innerHeight) {
					dropdown.style.top = `${rect.top - dropRect.height - 2}px`;
				}
			} else {
				dropdown.style.display = 'none';
			}
		};

		// Close on click outside (check both trigger wrapper and dropdown since dropdown is in body)
		document.addEventListener('mousedown', (e) => {
			const target = e.target as Node;
			if (!wrapper.contains(target) && !dropdown.contains(target)) {
				dropdown.style.display = 'none';
			}
		});

		wrapper.appendChild(trigger);
		// Append dropdown to body so it's outside all overflow:hidden containers
		document.body.appendChild(dropdown);
		return wrapper;
	}

	/** Small inline SVG showing a 3-row mini table with header color and band color */
	private miniTableSvg(headerColor: string, bandColor: string): string {
		return `<svg width="28" height="20" viewBox="0 0 28 20" style="display:block;">` +
			`<rect x="0" y="0" width="28" height="6" rx="1" fill="${headerColor}"/>` +
			`<rect x="0" y="7" width="28" height="6" fill="${bandColor}"/>` +
			`<rect x="0" y="14" width="28" height="6" rx="1" fill="${bandColor}" opacity="0.5"/>` +
			`<rect x="0" y="0" width="28" height="20" rx="1" fill="none" stroke="${headerColor}" stroke-width="0.5" opacity="0.5"/>` +
			`</svg>`;
	}

	// ======================= VIEW TAB =======================
	private buildViewTab(): HTMLElement {
		const panel = this.tabPanel('view', false);

		const show = this.group('Show');
		const showBody = this.el('div', 'group-body');
		const showR = this.el('div', 'btn-col gap-6');
		showR.appendChild(this.toggleBtn(IC.gridlines, 'Gridlines', 'gridlines', true));
		showR.appendChild(this.toggleBtn(IC.headers, 'Headers', 'headers', true));
		showBody.appendChild(showR);
		show.insertBefore(showBody, show.lastChild);
		panel.appendChild(show);

		const win = this.group('Window');
		const winBody = this.el('div', 'group-body');
		winBody.appendChild(this.tallBtn(IC.freeze, 'Freeze\nPanes', 'freezePanes'));
		win.insertBefore(winBody, win.lastChild);
		panel.appendChild(win);

		return panel;
	}

	// ======================= DATA TAB =======================
	private buildDataTab(): HTMLElement {
		const panel = this.tabPanel('data', false);

		const sort = this.group('Sort & Filter');
		const sortBody = this.el('div', 'group-body');
		sortBody.appendChild(this.tallBtn(IC.sortAsc, 'Sort\nA\u2192Z', 'sortAZ'));
		sortBody.appendChild(this.tallBtn(IC.sortDesc, 'Sort\nZ\u2192A', 'sortZA'));
		const filterStack = this.el('div', 'btn-col gap-6');
		filterStack.appendChild(this.iconBtn(IC.filter, 'Filter', 'toggleTableFilter', 'Toggle Table Filter'));
		filterStack.appendChild(this.iconBtn(IC.totals, 'Totals', 'toggleTotalsRow', 'Toggle Totals Row'));
		sortBody.appendChild(filterStack);
		sort.insertBefore(sortBody, sort.lastChild);
		panel.appendChild(sort);

		const edit = this.group('Edit');
		const editBody = this.el('div', 'group-body');
		editBody.appendChild(this.tallBtn(IC.clear, 'Clear', 'clear'));
		edit.insertBefore(editBody, edit.lastChild);
		panel.appendChild(edit);

		return panel;
	}

	// ======================= TAB SWITCHING =======================
	private switchTab(key: string) {
		if (key === this.activeTab) return;
		this.tabButtons.get(this.activeTab)?.classList.remove('active');
		const prevPanel = this.tabContents.get(this.activeTab);
		if (prevPanel) prevPanel.style.display = 'none';
		this.activeTab = key;
		this.tabButtons.get(key)?.classList.add('active');
		const nextPanel = this.tabContents.get(key);
		if (nextPanel) nextPanel.style.display = 'flex';
	}

	// ======================= BUTTON FACTORIES =======================

	/** Small button with icon + text label */
	private iconBtn(svg: string, label: string, action: string, title?: string): HTMLButtonElement {
		const b = document.createElement('button');
		b.className = 'ribbon-btn icon-btn';
		b.innerHTML = `<span class="btn-icon">${svg}</span><span class="btn-label">${label}</span>`;
		b.title = title || label;
		b.onclick = () => this.onAction({ action });
		return b;
	}

	/** Icon-only button (no label) */
	private iconOnlyBtn(svg: string, action: string, title: string): HTMLButtonElement {
		const b = document.createElement('button');
		b.className = 'ribbon-btn icon-only-btn';
		b.innerHTML = `<span class="btn-icon">${svg}</span>`;
		b.title = title;
		b.onclick = () => this.onAction({ action });
		return b;
	}

	/** Tall (primary) button: icon above, text below */
	private tallBtn(svg: string, label: string, action: string): HTMLButtonElement {
		const b = document.createElement('button');
		b.className = 'ribbon-btn tall-btn';
		b.innerHTML = `<span class="btn-icon lg">${svg}</span><span class="btn-label-below">${label.replace('\n', '<br>')}</span>`;
		b.title = label.replace('\n', ' ');
		b.onclick = () => this.onAction({ action });
		return b;
	}

	/** Format button (styled text, e.g., B I U S) */
	private fmtBtn(label: string, action: string, extraClass?: string): HTMLButtonElement {
		const b = document.createElement('button');
		b.className = `ribbon-btn fmt-btn${extraClass ? ' ' + extraClass : ''}`;
		b.textContent = label;
		b.title = action.charAt(0).toUpperCase() + action.slice(1);
		b.onclick = () => this.onAction({ action });
		return b;
	}

	/** Color button with color indicator bar */
	private colorBtn(label: string, action: string, defaultColor: string): HTMLElement {
		const wrapper = document.createElement('span');
		wrapper.className = 'color-btn-wrapper';
		const btn = document.createElement('button');
		btn.className = 'ribbon-btn fmt-btn color-trigger';
		btn.innerHTML = `<span>${label}</span><span class="color-bar" style="background:${defaultColor}"></span>`;
		btn.title = action === 'textColor' ? 'Font Color' : 'Fill Color';
		// Hidden color input
		const input = document.createElement('input');
		input.type = 'color';
		input.className = 'color-input-hidden';
		input.value = defaultColor;
		input.oninput = () => {
			const bar = btn.querySelector('.color-bar') as HTMLElement;
			if (bar) bar.style.background = input.value;
			this.onAction({ action, value: input.value });
		};
		btn.onclick = () => input.click();
		wrapper.appendChild(btn);
		wrapper.appendChild(input);
		return wrapper;
	}

	/** Toggle button with icon + label + checkbox state */
	private toggleBtn(svg: string, label: string, action: string, checked: boolean): HTMLButtonElement {
		const b = document.createElement('button');
		b.className = `ribbon-btn toggle-btn${checked ? ' toggled' : ''}`;
		b.innerHTML = `<span class="btn-icon">${svg}</span><span class="btn-label">${label}</span>`;
		b.title = label;
		b.onclick = () => {
			b.classList.toggle('toggled');
			this.onAction({ action, value: b.classList.contains('toggled') ? '1' : '0' });
		};
		return b;
	}

	/** Dropdown select */
	private selectEl(action: string, options: string[], defaultVal?: string, extraClass?: string): HTMLSelectElement {
		const sel = document.createElement('select');
		sel.className = `ribbon-select${extraClass ? ' ' + extraClass : ''}`;
		sel.title = action;
		for (const opt of options) {
			const o = document.createElement('option');
			o.value = opt;
			o.textContent = opt;
			if (defaultVal && opt === defaultVal) o.selected = true;
			sel.appendChild(o);
		}
		sel.onchange = () => this.onAction({ action, value: sel.value });
		return sel;
	}

	// ======================= LAYOUT HELPERS =======================

	private el(tag: string, className: string): HTMLElement {
		const el = document.createElement(tag);
		el.className = className;
		return el;
	}

	private group(label: string): HTMLElement {
		const g = this.el('div', 'ribbon-group');
		const lbl = this.el('div', 'group-label');
		lbl.textContent = label;
		g.appendChild(lbl);
		return g;
	}

	private tabPanel(key: string, active: boolean): HTMLElement {
		const panel = this.el('div', 'ribbon-tab-panel');
		panel.style.display = active ? 'flex' : 'none';
		this.tabContents.set(key, panel);
		return panel;
	}
}

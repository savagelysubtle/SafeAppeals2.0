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
	import: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6z"/><path d="M9 1v5h5"/><path d="M8 7l-3 3m0 0v-3m0 3h3"/></svg>',
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
	orientation: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="2" y="1" width="8" height="10" rx="1"/><path d="M10 1l3 3v11H6v-2" stroke-linecap="round"/><path d="M10 1v3h3"/></svg>',
	margins: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="14" height="14" rx="1"/><rect x="3" y="3" width="10" height="10" stroke-dasharray="2 1.5"/></svg>',
	pageBreak: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><line x1="1" y1="8" x2="15" y2="8" stroke-dasharray="2 2" stroke="#4472C4"/><line x1="1" y1="4" x2="15" y2="4"/><line x1="1" y1="12" x2="15" y2="12"/></svg>',
	printArea: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="2" y="2" width="12" height="12" rx="1"/><rect x="4" y="4" width="8" height="8" stroke="#4472C4" stroke-width="1.5" stroke-dasharray="2 1"/></svg>',
	printTitles: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="1" width="14" height="14" rx="1"/><rect x="1" y="1" width="14" height="4" fill="currentColor" opacity=".2" rx="1"/><rect x="1" y="1" width="4" height="14" fill="currentColor" opacity=".15" rx="1"/></svg>',
	scaleToFit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="2" width="14" height="12" rx="1"/><path d="M4 8h8M8 4v8"/><path d="M6 6L4 8l2 2M10 6l2 2-2 2"/></svg>',
	pageSetupDlg: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="2" y="1" width="10" height="13" rx="1"/><path d="M12 1l3 3v12H5v-2"/><path d="M12 1v3h3"/><line x1="5" y1="6" x2="10" y2="6"/><line x1="5" y1="9" x2="10" y2="9"/><line x1="5" y1="12" x2="8" y2="12"/></svg>',
	printPreview: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="2" y="2" width="12" height="14" rx="1"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="9" x2="11" y2="9"/><line x1="5" y1="12" x2="8" y2="12"/><circle cx="11" cy="12" r="2.5"/><line x1="12.8" y1="13.8" x2="14.5" y2="15.5"/></svg>',
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
	dataValid: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><line x1="5.5" y1="1" x2="5.5" y2="15"/><path d="M8 8l1.5 1.5L12 7" stroke="#4472c4" stroke-width="1.5"/><rect x="6" y="6" width="7" height="7" rx=".5" stroke="#4472c4" opacity=".3" stroke-dasharray="1.5 1"/></svg>',
	circleInvalid: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><ellipse cx="8" cy="8" rx="6" ry="5" stroke="#cc0000" stroke-dasharray="2 1.5"/><line x1="5" y1="8" x2="11" y2="8" stroke="#cc0000"/></svg>',
	group: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="3" width="14" height="10" rx="1"/><line x1="1" y1="7" x2="15" y2="7"/><line x1="1" y1="11" x2="15" y2="11"/><rect x="3" y="5" width="4" height="4" fill="currentColor" opacity=".2"/><rect x="9" y="5" width="4" height="4" fill="currentColor" opacity=".2"/><path d="M5 2v2M11 2v2" stroke-width="1.5"/></svg>',
	ungroup: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="3" width="14" height="10" rx="1" stroke-dasharray="2 1.5"/><line x1="1" y1="7" x2="15" y2="7" stroke-dasharray="2 1.5"/><line x1="1" y1="11" x2="15" y2="11" stroke-dasharray="2 1.5"/><path d="M5 2v2M11 2v2" stroke-width="1.5"/></svg>',
	chart: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="1" width="14" height="14" rx="1"/><rect x="3" y="9" width="2" height="5" fill="#4472C4" stroke="none" rx=".3"/><rect x="7" y="5" width="2" height="9" fill="#ED7D31" stroke="none" rx=".3"/><rect x="11" y="7" width="2" height="7" fill="#70AD47" stroke="none" rx=".3"/></svg>',
	hyperlink: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l2-2a3.5 3.5 0 0 0-4.95-4.95L7.5 3.5"/><path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0l-2 2a3.5 3.5 0 0 0 4.95 4.95L8.5 12.5"/></svg>',
	nameManager: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="3" width="14" height="10" rx="1"/><line x1="1" y1="6" x2="15" y2="6"/><line x1="5.5" y1="3" x2="5.5" y2="13"/><path d="M3 9h1M7.5 9h4M7.5 11h2.5" stroke-width="1"/></svg>',
	defineName: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><rect x="1" y="3" width="10" height="10" rx="1"/><line x1="1" y1="6" x2="11" y2="6"/><path d="M13 5v8M13 9h2" stroke-width="1.4"/></svg>',
	fillDown: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="4" rx="0.5" fill="currentColor" opacity="0.2"/><rect x="2" y="2" width="12" height="12" rx="0.5"/><path d="M8 7v5M5.5 10l2.5 2.5 2.5-2.5"/></svg>',
	fillRight: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="4" height="12" rx="0.5" fill="currentColor" opacity="0.2"/><rect x="2" y="2" width="12" height="12" rx="0.5"/><path d="M7 8h5M10 5.5l2.5 2.5-2.5 2.5"/></svg>',
	flashFill: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 2L4 9h4l-1 5 5-7h-4z" fill="currentColor" opacity="0.25"/><path d="M9 2L4 9h4l-1 5 5-7h-4z"/></svg>',
	pivotTable: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.1"><rect x="1" y="1" width="14" height="14" rx="1"/><line x1="1" y1="5" x2="15" y2="5"/><line x1="1" y1="9" x2="15" y2="9"/><line x1="1" y1="13" x2="15" y2="13"/><line x1="5.5" y1="1" x2="5.5" y2="15"/><rect x="1" y="1" width="4.5" height="4" fill="currentColor" opacity=".3" rx="1"/><rect x="5.5" y="1" width="9.5" height="4" fill="currentColor" opacity=".15" rx="1"/><rect x="1" y="5" width="4.5" height="4" fill="currentColor" opacity=".15"/><path d="M11 11.5l-2 2m0 0l2 2m-2-2h4" stroke="#4472C4" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
	zoomIn: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="7" cy="7" r="5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/><line x1="5" y1="7" x2="9" y2="7"/><line x1="7" y1="5" x2="7" y2="9"/></svg>',
	zoomOut: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="7" cy="7" r="5"/><line x1="10.5" y1="10.5" x2="14" y2="14"/><line x1="5" y1="7" x2="9" y2="7"/></svg>',
	zoomFit: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="12" height="12" rx="1"/><path d="M5 8h6M8 5v6"/><path d="M2 6V2h4M10 2h4v4M14 10v4h-4M6 14H2v-4"/></svg>',
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
		for (const name of ['Home', 'Insert', 'Formulas', 'Page Layout', 'View', 'Data']) {
			const key = name.toLowerCase().replace(' ', '-');
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
		fileOps.appendChild(this._buildExportDropdown());
		fileOps.appendChild(this.iconBtn(IC.import, 'Import CSV/TSV', 'importCSV'));
		tabBar.appendChild(fileOps);
		this.container.appendChild(tabBar);

		// --- Tab Content ---
		const content = this.el('div', 'ribbon-content');
		content.appendChild(this.buildHomeTab());
		content.appendChild(this.buildInsertTab());
		content.appendChild(this.buildFormulasTab());
		content.appendChild(this.buildPageLayoutTab());
		content.appendChild(this.buildViewTab());
		content.appendChild(this.buildDataTab());
		this.container.appendChild(content);
	}

	// ======================= HOME TAB =======================
	private buildHomeTab(): HTMLElement {
		const panel = this.tabPanel('home', true);

		// --- Clipboard (Paste + Cut/Copy/Paste Special in one row) ---
		const clip = this.group('Clipboard');
		const clipBody = this.el('div', 'group-body clip-layout');
		clipBody.appendChild(this.tallBtn(IC.paste, 'Paste', 'paste'));
		const clipStack = this.el('div', 'clip-stack');
		clipStack.appendChild(this.iconOnlyBtn(IC.cut, 'cut', 'Cut (Ctrl+X)'));
		clipStack.appendChild(this.iconOnlyBtn(IC.copy, 'copy', 'Copy (Ctrl+C)'));
		clipStack.appendChild(this.iconOnlyBtn(IC.paste, 'pasteSpecial', 'Paste Special... (Ctrl+Shift+V)'));
		clipBody.appendChild(clipStack);
		clip.appendChild(clipBody);
		panel.appendChild(clip);

		// --- History ---
		const hist = this.group('History');
		const histBody = this.el('div', 'group-body');
		const histRow = this.el('div', 'btn-row');
		histRow.appendChild(this.iconOnlyBtn(IC.undo, 'undo', 'Undo (Ctrl+Z)'));
		histRow.appendChild(this.iconOnlyBtn(IC.redo, 'redo', 'Redo (Ctrl+Y)'));
		histBody.appendChild(histRow);
		hist.appendChild(histBody);
		panel.appendChild(hist);

		// --- Font ---
		const font = this.group('Font');
		const fontBody = this.el('div', 'group-body font-body');
		const fontR1 = this.el('div', 'btn-row');
		fontR1.appendChild(this.selectEl('fontFamily', [
			'system-ui', 'Arial', 'Calibri', 'Courier New', 'Georgia',
			'Helvetica', 'Times New Roman', 'Verdana'
		], undefined, 'font-select'));
		fontR1.appendChild(this.selectEl('fontSize', [
			'8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '36', '48', '72'
		], '13', 'size-select'));
		fontBody.appendChild(fontR1);
		const fontR2 = this.el('div', 'btn-row');
		fontR2.appendChild(this.fmtBtn('B', 'bold', 'fmt-bold'));
		fontR2.appendChild(this.fmtBtn('I', 'italic', 'fmt-italic'));
		fontR2.appendChild(this.fmtBtn('U', 'underline', 'fmt-underline'));
		fontR2.appendChild(this.fmtBtn('S', 'strikethrough', 'fmt-strike'));
		fontR2.appendChild(this.el('span', 'btn-separator'));
		fontR2.appendChild(this.colorBtn('A', 'textColor', '#cccccc'));
		fontR2.appendChild(this.colorBtn('\u25A0', 'fillColor', '#3c3c3c'));
		fontBody.appendChild(fontR2);
		font.appendChild(fontBody);
		panel.appendChild(font);

		// --- Alignment (icon-only dense group) ---
		const align = this.group('Alignment');
		const alignBody = this.el('div', 'group-body');
		const alignRow = this.el('div', 'btn-row');
		alignRow.appendChild(this.iconOnlyBtn(IC.alignL, 'alignLeft', 'Align Left'));
		alignRow.appendChild(this.iconOnlyBtn(IC.alignC, 'alignCenter', 'Align Center'));
		alignRow.appendChild(this.iconOnlyBtn(IC.alignR, 'alignRight', 'Align Right'));
		alignRow.appendChild(this.iconOnlyBtn(IC.wrap, 'wrapText', 'Wrap'));
		alignRow.appendChild(this.iconOnlyBtn(IC.merge, 'mergeCells', 'Merge'));
		alignBody.appendChild(alignRow);
		align.appendChild(alignBody);
		panel.appendChild(align);

		// --- Number ---
		const numGrp = this.group('Number');
		const numBody = this.el('div', 'group-body');
		const numRow = this.el('div', 'btn-row');
		numRow.appendChild(this.selectEl('numberFormat', [
			'General', 'Number', 'Currency', 'Percentage', 'Date', 'Text'
		], undefined, 'num-select'));
		numRow.appendChild(this.fmtBtn('$', 'currency'));
		numRow.appendChild(this.fmtBtn('%', 'percent'));
		numRow.appendChild(this.fmtBtn(',', 'comma'));
		numRow.appendChild(this.el('span', 'btn-separator'));
		numRow.appendChild(this.fmtBtn('.0+', 'increaseDecimal'));
		numRow.appendChild(this.fmtBtn('.0\u2013', 'decreaseDecimal'));
		numBody.appendChild(numRow);
		numGrp.appendChild(numBody);
		panel.appendChild(numGrp);

		// --- Cells (icon-only dense group) ---
		const cells = this.group('Cells');
		const cellsBody = this.el('div', 'group-body');
		const cellRow = this.el('div', 'btn-row');
		cellRow.appendChild(this.iconOnlyBtn(IC.insertRow, 'insertRow', 'Insert Row'));
		cellRow.appendChild(this.iconOnlyBtn(IC.insertCol, 'insertCol', 'Insert Column'));
		cellRow.appendChild(this.iconOnlyBtn(IC.deleteRow, 'deleteRow', 'Delete Row'));
		cellRow.appendChild(this.iconOnlyBtn(IC.deleteCol, 'deleteCol', 'Delete Column'));
		cellsBody.appendChild(cellRow);
		cells.appendChild(cellsBody);
		panel.appendChild(cells);

		// --- Editing (icon-only dense group) ---
		const editGroup = this.group('Editing');
		const editBody = this.el('div', 'group-body');
		const editRow = this.el('div', 'btn-row');
		editRow.appendChild(this.iconOnlyBtn(IC.fillDown, 'fillDown', 'Fill Down (Ctrl+D)'));
		editRow.appendChild(this.iconOnlyBtn(IC.fillRight, 'fillRight', 'Fill Right (Ctrl+R)'));
		editRow.appendChild(this.iconOnlyBtn(IC.flashFill, 'flashFill', 'Flash Fill (Ctrl+E)'));
		editBody.appendChild(editRow);
		editGroup.appendChild(editBody);
		panel.appendChild(editGroup);

		// --- Styles ---
		const stylesGroup = this.group('Styles');
		const stylesBody = this.el('div', 'group-body');
		stylesBody.appendChild(this.tallBtn(IC.condFormat, 'Cond. Format', 'conditionalFormatting'));
		stylesGroup.appendChild(stylesBody);
		panel.appendChild(stylesGroup);

		// --- Formulas ---
		const fx = this.group('Formulas');
		const fxBody = this.el('div', 'group-body');
		const fxRow = this.el('div', 'btn-row');
		fxRow.appendChild(this.iconBtn(IC.sigma, 'SUM', 'formulaSum'));
		fxRow.appendChild(this.fmtBtn('AVG', 'formulaAvg'));
		fxRow.appendChild(this.fmtBtn('CNT', 'formulaCount'));
		fxRow.appendChild(this.fmtBtn('MIN', 'formulaMin'));
		fxRow.appendChild(this.fmtBtn('MAX', 'formulaMax'));
		fxBody.appendChild(fxRow);
		fx.appendChild(fxBody);
		panel.appendChild(fx);

		return panel;
	}

	// ======================= INSERT TAB =======================
	private buildInsertTab(): HTMLElement {
		const panel = this.tabPanel('insert', false);

		// --- PivotTable group ---
		const pivotGroup = this.group('PivotTable');
		const pivotBody = this.el('div', 'group-body');
		pivotBody.appendChild(this.tallBtn(IC.pivotTable, 'PivotTable', 'insertPivotTable'));
		pivotGroup.appendChild(pivotBody);
		panel.appendChild(pivotGroup);

		// --- Charts group ---
		const chartGroup = this.group('Charts');
		const chartBody = this.el('div', 'group-body');
		chartBody.appendChild(this.tallBtn(IC.chart, 'Chart', 'insertChart'));
		chartGroup.appendChild(chartBody);
		panel.appendChild(chartGroup);

		// --- Tables group ---
		const tblGroup = this.group('Tables');
		const tblBody = this.el('div', 'group-body');
		tblBody.appendChild(this.tallBtn(IC.table, 'Table', 'createTable'));
		tblBody.appendChild(this.buildTableStylePicker());
		tblBody.appendChild(this.iconOnlyBtn(IC.convertRange, 'convertToRange', 'Convert Table to Range'));
		tblGroup.appendChild(tblBody);
		panel.appendChild(tblGroup);

		// --- Rows & Columns group ---
		const rcGroup = this.group('Rows & Columns');
		const rcBody = this.el('div', 'group-body');
		const rcRow = this.el('div', 'btn-row');
		rcRow.appendChild(this.iconOnlyBtn(IC.insertRow, 'insertRow', 'Insert Row'));
		rcRow.appendChild(this.iconOnlyBtn(IC.insertCol, 'insertCol', 'Insert Column'));
		rcRow.appendChild(this.iconOnlyBtn(IC.deleteRow, 'deleteRow', 'Delete Row'));
		rcRow.appendChild(this.iconOnlyBtn(IC.deleteCol, 'deleteCol', 'Delete Column'));
		rcBody.appendChild(rcRow);
		rcGroup.appendChild(rcBody);
		panel.appendChild(rcGroup);

		// --- Links group ---
		const linkGroup = this.group('Links');
		const linkBody = this.el('div', 'group-body');
		linkBody.appendChild(this.tallBtn(IC.hyperlink, 'Hyperlink', 'insertHyperlink'));
		linkGroup.appendChild(linkBody);
		panel.appendChild(linkGroup);

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

	// ======================= FORMULAS TAB =======================
	private buildFormulasTab(): HTMLElement {
		const panel = this.tabPanel('formulas', false);

		// Defined Names group
		const namesGroup = this.group('Defined Names');
		const namesBody = this.el('div', 'group-body');
		namesBody.appendChild(this.tallBtn(IC.nameManager, 'Name Manager', 'nameManager'));
		namesBody.appendChild(this.iconBtn(IC.defineName, 'Define Name', 'defineName'));
		namesGroup.appendChild(namesBody);
		panel.appendChild(namesGroup);

		return panel;
	}

	// ======================= PAGE LAYOUT TAB =======================
	private buildPageLayoutTab(): HTMLElement {
		const panel = this.tabPanel('page-layout', false);

		// --- Page Setup group (icon + select per control, single row) ---
		const pg = this.group('Page Setup');
		const pgBody = this.el('div', 'group-body');

		const marginsWrap = this.el('div', 'btn-row');
		const marginsIcon = document.createElement('div');
		marginsIcon.innerHTML = IC.margins;
		marginsIcon.className = 'btn-icon';
		marginsIcon.title = 'Margins';
		const marginsDropdown = this.selectEl('pageMargins', ['Normal', 'Wide', 'Narrow', 'Custom...'], 'Normal', 'ribbon-select-sm');
		marginsDropdown.title = 'Margins';
		marginsWrap.appendChild(marginsIcon);
		marginsWrap.appendChild(marginsDropdown);
		pgBody.appendChild(marginsWrap);

		const orientWrap = this.el('div', 'btn-row');
		const orientIcon = document.createElement('div');
		orientIcon.innerHTML = IC.orientation;
		orientIcon.className = 'btn-icon';
		orientIcon.title = 'Orientation';
		const orientDropdown = this.selectEl('pageOrientation', ['Portrait', 'Landscape'], 'Portrait', 'ribbon-select-sm');
		orientDropdown.title = 'Orientation';
		orientWrap.appendChild(orientIcon);
		orientWrap.appendChild(orientDropdown);
		pgBody.appendChild(orientWrap);

		const sizeWrap = this.el('div', 'btn-row');
		const sizeIcon = document.createElement('div');
		sizeIcon.innerHTML = IC.pageSetupDlg;
		sizeIcon.className = 'btn-icon';
		sizeIcon.title = 'Size';
		const sizeDropdown = this.selectEl('paperSize', ['Letter', 'A4', 'Legal', 'A3', 'Tabloid'], 'Letter', 'ribbon-select-sm');
		sizeDropdown.title = 'Size';
		sizeWrap.appendChild(sizeIcon);
		sizeWrap.appendChild(sizeDropdown);
		pgBody.appendChild(sizeWrap);

		pg.appendChild(pgBody);
		panel.appendChild(pg);

		// --- Print Area group ---
		const paGrp = this.group('Print Area');
		const paBody = this.el('div', 'group-body');
		paBody.appendChild(this.smallBtn(IC.printArea, 'Set Print Area', 'setPrintArea'));
		paBody.appendChild(this.smallBtn(IC.printArea, 'Clear Print Area', 'clearPrintArea'));
		paGrp.appendChild(paBody);
		panel.appendChild(paGrp);

		// --- Page Breaks group ---
		const pbGrp = this.group('Breaks');
		const pbBody = this.el('div', 'group-body btn-row');
		pbBody.appendChild(this.smallBtn(IC.pageBreak, 'Insert Page Break', 'insertPageBreak'));
		pbBody.appendChild(this.smallBtn(IC.pageBreak, 'Remove Page Break', 'removePageBreak'));
		pbBody.appendChild(this.smallBtn(IC.pageBreak, 'Reset All Breaks', 'resetPageBreaks'));
		pbGrp.appendChild(pbBody);
		panel.appendChild(pbGrp);

		// --- Print Titles group ---
		const ptGrp = this.group('Print Titles');
		const ptBody = this.el('div', 'group-body');
		ptBody.appendChild(this.tallBtn(IC.printTitles, 'Print Titles', 'printTitles'));
		ptGrp.appendChild(ptBody);
		panel.appendChild(ptGrp);

		// --- Scale to Fit group ---
		const sfGrp = this.group('Scale to Fit');
		const sfBody = this.el('div', 'group-body btn-row');

		const widthWrap = this.el('div', 'ribbon-label-row');
		const widthLbl = document.createElement('span');
		widthLbl.textContent = 'Width:';
		widthLbl.className = 'ribbon-inline-label';
		const widthSel = this.selectEl('fitToWidth', ['Automatic', '1', '2', '3', '4', '5', '6', '7', '8', '9'], 'Automatic', 'ribbon-select-sm');
		widthWrap.appendChild(widthLbl);
		widthWrap.appendChild(widthSel);
		sfBody.appendChild(widthWrap);

		const heightWrap = this.el('div', 'ribbon-label-row');
		const heightLbl = document.createElement('span');
		heightLbl.textContent = 'Height:';
		heightLbl.className = 'ribbon-inline-label';
		const heightSel = this.selectEl('fitToHeight', ['Automatic', '1', '2', '3', '4', '5', '6', '7', '8', '9'], 'Automatic', 'ribbon-select-sm');
		heightWrap.appendChild(heightLbl);
		heightWrap.appendChild(heightSel);
		sfBody.appendChild(heightWrap);

		const scaleWrap = this.el('div', 'ribbon-label-row');
		const scaleLbl = document.createElement('span');
		scaleLbl.textContent = 'Scale:';
		scaleLbl.className = 'ribbon-inline-label';
		const scaleInput = document.createElement('input');
		scaleInput.type = 'number';
		scaleInput.min = '10'; scaleInput.max = '400'; scaleInput.value = '100';
		scaleInput.className = 'ribbon-num-input';
		scaleInput.title = 'Print scale (10–400%)';
		const scalePct = document.createElement('span');
		scalePct.textContent = '%';
		scalePct.className = 'ribbon-inline-label';
		scaleInput.onchange = () => this.onAction({ action: 'printScale', value: scaleInput.value });
		scaleWrap.appendChild(scaleLbl);
		scaleWrap.appendChild(scaleInput);
		scaleWrap.appendChild(scalePct);
		sfBody.appendChild(scaleWrap);

		sfGrp.appendChild(sfBody);
		panel.appendChild(sfGrp);

		// --- Sheet Options group ---
		const soGrp = this.group('Sheet Options');
		const soBody = this.el('div', 'group-body btn-row');
		soBody.appendChild(this.toggleBtn(IC.gridlines, 'Print Gridlines', 'printGridlines', false));
		soBody.appendChild(this.toggleBtn(IC.headers, 'Print Headings', 'printHeadings', false));
		soBody.appendChild(this.toggleBtn(IC.headers, 'Center Horiz.', 'centerHorizontally', false));
		soBody.appendChild(this.toggleBtn(IC.headers, 'Center Vert.', 'centerVertically', false));
		soGrp.appendChild(soBody);
		panel.appendChild(soGrp);

		// --- Page Setup Dialog + Print Preview ---
		const dlgGrp = this.group('');
		const dlgBody = this.el('div', 'group-body btn-row');
		dlgBody.appendChild(this.tallBtn(IC.pageSetupDlg, 'Page Setup', 'pageSetupDialog'));
		dlgBody.appendChild(this.tallBtn(IC.printPreview, 'Print Preview', 'printPreview'));
		dlgGrp.appendChild(dlgBody);
		panel.appendChild(dlgGrp);

		return panel;
	}

	// ======================= VIEW TAB =======================
	private buildViewTab(): HTMLElement {
		const panel = this.tabPanel('view', false);

		const show = this.group('Show');
		const showBody = this.el('div', 'group-body');
		const showR = this.el('div', 'btn-row');
		showR.appendChild(this.toggleBtn(IC.gridlines, 'Gridlines', 'gridlines', true));
		showR.appendChild(this.toggleBtn(IC.headers, 'Headers', 'headers', true));
		showBody.appendChild(showR);
		show.appendChild(showBody);
		panel.appendChild(show);

		const win = this.group('Window');
		const winBody = this.el('div', 'group-body');
		winBody.appendChild(this.tallBtn(IC.freeze, 'Freeze Panes', 'freezePanes'));
		win.appendChild(winBody);
		panel.appendChild(win);

		const views = this.group('Workbook Views');
		const viewsBody = this.el('div', 'group-body btn-row');
		viewsBody.appendChild(this.toggleBtn(IC.pageBreak, 'Page Break Preview', 'pageBreakPreview', false));
		views.appendChild(viewsBody);
		panel.appendChild(views);

		const zoomGrp = this.group('Zoom');
		const zoomBody = this.el('div', 'group-body');
		zoomBody.appendChild(this.tallBtn(IC.zoomIn, 'Zoom In', 'zoomIn'));
		zoomBody.appendChild(this.tallBtn(IC.zoomOut, 'Zoom Out', 'zoomOut'));
		const zoomStack = this.el('div', 'btn-row');
		zoomStack.appendChild(this.iconBtn(IC.zoomFit, '100%', 'zoomReset', 'Reset to 100%'));
		zoomStack.appendChild(this.iconBtn(IC.zoomFit, 'Fit', 'zoomToFit', 'Zoom to Fit'));

		// Preset zoom dropdown
		const presetSel = document.createElement('select');
		presetSel.title = 'Preset Zoom';
		presetSel.style.cssText = 'font-size:11px;border:1px solid #ccc;border-radius:3px;padding:1px 2px;cursor:pointer;background:var(--vscode-editor-background,#fff);color:inherit;';
		for (const [pct, action] of [['50%','zoom50'],['75%','zoom75'],['100%','zoom100'],['125%','zoom125'],['150%','zoom150'],['200%','zoom200']] as const) {
			const opt = document.createElement('option');
			opt.value = action;
			opt.textContent = pct;
			presetSel.appendChild(opt);
		}
		presetSel.value = 'zoom100';
		presetSel.addEventListener('change', () => {
			this.onAction({ action: presetSel.value });
			presetSel.value = 'zoom100';
		});
		zoomStack.appendChild(presetSel);
		zoomBody.appendChild(zoomStack);
		zoomGrp.appendChild(zoomBody);
		panel.appendChild(zoomGrp);

		return panel;
	}

	// ======================= DATA TAB =======================
	private buildDataTab(): HTMLElement {
		const panel = this.tabPanel('data', false);

		const sort = this.group('Sort & Filter');
		const sortBody = this.el('div', 'group-body');
		sortBody.appendChild(this.tallBtn(IC.sortAsc, 'Sort A\u2192Z', 'sortAZ'));
		sortBody.appendChild(this.tallBtn(IC.sortDesc, 'Sort Z\u2192A', 'sortZA'));
		const filterStack = this.el('div', 'btn-row');
		filterStack.appendChild(this.iconOnlyBtn(IC.filter, 'toggleTableFilter', 'Toggle Table Filter'));
		filterStack.appendChild(this.iconOnlyBtn(IC.totals, 'toggleTotalsRow', 'Toggle Totals Row'));
		sortBody.appendChild(filterStack);
		sort.appendChild(sortBody);
		panel.appendChild(sort);

		// Data Validation group
		const dvGroup = this.group('Data Tools');
		const dvBody = this.el('div', 'group-body');
		dvBody.appendChild(this.tallBtn(IC.dataValid, 'Data Validation', 'dataValidation'));
		dvBody.appendChild(this.iconOnlyBtn(IC.circleInvalid, 'circleInvalidData', 'Circle Invalid Data'));
		dvGroup.appendChild(dvBody);
		panel.appendChild(dvGroup);

		const edit = this.group('Edit');
		const editBody = this.el('div', 'group-body');
		editBody.appendChild(this.tallBtn(IC.clear, 'Clear', 'clear'));
		edit.appendChild(editBody);
		panel.appendChild(edit);

		// Outline / Group group
		const outlineGroup = this.group('Outline');
		const outlineBody = this.el('div', 'group-body');
		outlineBody.appendChild(this.tallBtn(IC.group, 'Group Rows', 'groupRows'));
		outlineBody.appendChild(this.tallBtn(IC.group, 'Group Columns', 'groupCols'));
		outlineBody.appendChild(this.tallBtn(IC.ungroup, 'Ungroup Rows', 'ungroupRows'));
		outlineBody.appendChild(this.tallBtn(IC.ungroup, 'Ungroup Columns', 'ungroupCols'));
		outlineGroup.appendChild(outlineBody);
		panel.appendChild(outlineGroup);

		// PivotTable connections group
		const pvGroup = this.group('PivotTable');
		const pvBody = this.el('div', 'group-body');
		pvBody.appendChild(this.tallBtn(IC.pivotTable, 'Refresh All', 'refreshAllPivots'));
		pvGroup.appendChild(pvBody);
		panel.appendChild(pvGroup);

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

	/** Tall (primary) button: icon + label in a single row */
	private tallBtn(svg: string, label: string, action: string): HTMLButtonElement {
		const b = document.createElement('button');
		b.className = 'ribbon-btn tall-btn';
		const flat = label.replace(/\n/g, ' ');
		b.innerHTML = `<span class="btn-icon lg">${svg}</span><span class="btn-label-below">${flat}</span>`;
		b.title = flat;
		b.onclick = () => this.onAction({ action });
		return b;
	}

	/** Small button: icon + label side-by-side (compact) */
	private smallBtn(svg: string, label: string, action: string): HTMLButtonElement {
		const b = document.createElement('button');
		b.className = 'ribbon-btn small-btn';
		b.innerHTML = `<span class="btn-icon sm">${svg}</span><span class="btn-label">${label}</span>`;
		b.title = label;
		b.onclick = () => this.onAction({ action });
		return b;
	}

	/** Export dropdown button (Export as CSV / HTML / PDF / PNG) */
	private _buildExportDropdown(): HTMLElement {
		const wrapper = document.createElement('div');
		Object.assign(wrapper.style, { position: 'relative', display: 'inline-flex', alignItems: 'center' });

		// Main icon part (triggers exportPDF for backwards compat)
		const mainBtn = document.createElement('button');
		mainBtn.className = 'ribbon-btn icon-only-btn';
		mainBtn.innerHTML = `<span class="btn-icon">${IC.exportPdf}</span>`;
		mainBtn.title = 'Export';
		mainBtn.onclick = () => {
			menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
		};

		// Chevron to open menu
		const chevron = document.createElement('button');
		chevron.className = 'ribbon-btn icon-only-btn';
		chevron.style.padding = '0 2px';
		chevron.title = 'Export options';
		chevron.innerHTML = '<svg viewBox="0 0 8 8" fill="currentColor" style="width:8px;height:8px"><path d="M1 2.5l3 3 3-3"/></svg>';
		chevron.onclick = () => {
			menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
		};

		// Dropdown menu
		const menu = document.createElement('div');
		Object.assign(menu.style, {
			display: 'none',
			position: 'absolute',
			top: '100%',
			right: '0',
			background: 'var(--vscode-menu-background, #1e1e1e)',
			border: '1px solid var(--vscode-menu-border, #555)',
			borderRadius: '4px',
			boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
			zIndex: '9999',
			minWidth: '160px',
			padding: '4px 0',
			fontSize: '13px',
		});

		const addItem = (label: string, action: string) => {
			const item = document.createElement('button');
			item.textContent = label;
			Object.assign(item.style, {
				display: 'block',
				width: '100%',
				padding: '5px 14px',
				background: 'none',
				border: 'none',
				cursor: 'pointer',
				color: 'var(--vscode-menu-foreground, #d4d4d4)',
				textAlign: 'left',
				fontSize: '13px',
			});
			item.onmouseenter = () => { item.style.background = 'var(--vscode-menu-selectionBackground, #0e639c)'; };
			item.onmouseleave = () => { item.style.background = 'none'; };
			item.onclick = () => { menu.style.display = 'none'; this.onAction({ action }); };
			menu.appendChild(item);
		};

		addItem('Export as CSV', 'exportCSV');
		addItem('Export as HTML', 'exportHTML');
		addItem('Export as PDF (HTML)', 'exportPDF');
		addItem('Export as PNG', 'exportPNG');

		// Close menu when clicking outside
		document.addEventListener('click', (e) => {
			if (!wrapper.contains(e.target as Node)) menu.style.display = 'none';
		});

		wrapper.appendChild(mainBtn);
		wrapper.appendChild(chevron);
		wrapper.appendChild(menu);
		return wrapper;
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

	private group(_label: string): HTMLElement {
		return this.el('div', 'ribbon-group');
	}

	private tabPanel(key: string, active: boolean): HTMLElement {
		const panel = this.el('div', 'ribbon-tab-panel');
		panel.style.display = active ? 'flex' : 'none';
		this.tabContents.set(key, panel);
		return panel;
	}
}

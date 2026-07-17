/**
 * pageSetupDialog.ts — Multi-tab Page Setup dialog.
 * Follows the same overlay+centered-dialog pattern as formatCellsDialog.ts.
 * Tabs: Page | Margins | Header/Footer | Sheet
 */

export interface PageSetupDef {
	orientation: string        // "portrait" | "landscape"
	paper_size: number         // Excel paper size index
	scale: number              // 10-400
	fit_to_width?: number
	fit_to_height?: number
	margin_left: number
	margin_right: number
	margin_top: number
	margin_bottom: number
	margin_header: number
	margin_footer: number
	header: string
	footer: string
	print_area: string
	print_titles_rows: string
	print_titles_cols: string
	row_breaks: number[]
	col_breaks: number[]
	print_gridlines: boolean
	center_horizontally: boolean
	center_vertically: boolean
}

export interface PageSetupEvent {
	action: 'apply' | 'cancel'
	setup?: PageSetupDef
}

const PAPER_SIZES: { label: string; id: number }[] = [
	{ label: 'Letter (8.5" x 11")', id: 1 },
	{ label: 'Letter Small (8.5" x 11")', id: 2 },
	{ label: 'Tabloid (11" x 17")', id: 3 },
	{ label: 'Ledger (17" x 11")', id: 4 },
	{ label: 'Legal (8.5" x 14")', id: 5 },
	{ label: 'Statement (5.5" x 8.5")', id: 6 },
	{ label: 'Executive (7.25" x 10.5")', id: 7 },
	{ label: 'A3 (297mm x 420mm)', id: 8 },
	{ label: 'A4 (210mm x 297mm)', id: 9 },
	{ label: 'A4 Small (210mm x 297mm)', id: 10 },
	{ label: 'A5 (148mm x 210mm)', id: 11 },
	{ label: 'B4 (250mm x 354mm)', id: 12 },
	{ label: 'B5 (182mm x 257mm)', id: 13 },
]

const HEADER_FOOTER_PRESETS = [
	{ label: '(none)', value: '' },
	{ label: 'Page 1', value: '&CPage &P' },
	{ label: 'Page 1 of ?', value: '&CPage &P of &N' },
	{ label: 'Filename', value: '&C&F' },
	{ label: 'Filename & Date', value: '&L&F&RDate: &D' },
	{ label: 'Sheet Name', value: '&C&A' },
	{ label: 'Page Number (right)', value: '&RPage &P' },
	{ label: 'Custom...', value: '__custom__' },
]

function defaultSetup(): PageSetupDef {
	return {
		orientation: 'portrait',
		paper_size: 1,
		scale: 100,
		fit_to_width: undefined,
		fit_to_height: undefined,
		margin_left: 0.7,
		margin_right: 0.7,
		margin_top: 0.75,
		margin_bottom: 0.75,
		margin_header: 0.3,
		margin_footer: 0.3,
		header: '',
		footer: '',
		print_area: '',
		print_titles_rows: '',
		print_titles_cols: '',
		row_breaks: [],
		col_breaks: [],
		print_gridlines: false,
		center_horizontally: false,
		center_vertically: false,
	}
}

export class PageSetupDialog {
	private overlay: HTMLDivElement
	private dialog: HTMLDivElement
	private onAction: (e: PageSetupEvent) => void
	private setup: PageSetupDef = defaultSetup()

	// Tab references
	private tabs: { label: string; key: string }[] = [
		{ label: 'Page', key: 'page' },
		{ label: 'Margins', key: 'margins' },
		{ label: 'Header/Footer', key: 'header-footer' },
		{ label: 'Sheet', key: 'sheet' },
	]
	private activeTabKey = 'page'
	private tabBtns: Map<string, HTMLButtonElement> = new Map()
	private tabPanels: Map<string, HTMLDivElement> = new Map()

	constructor(_parent: HTMLElement, onAction: (e: PageSetupEvent) => void) {
		this.onAction = onAction

		this.overlay = document.createElement('div')
		this.overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.55);display:none;z-index:10001;align-items:center;justify-content:center;'
		this.overlay.addEventListener('mousedown', e => { if (e.target === this.overlay) this._cancel() })

		this.dialog = document.createElement('div')
		this.dialog.style.cssText = [
			'background:#252526;color:#ccc;border:1px solid #555;border-radius:4px;',
			'display:flex;flex-direction:column;width:520px;max-height:90vh;',
			'font-family:var(--vscode-font-family,sans-serif);font-size:12px;',
		].join('')

		this.overlay.appendChild(this.dialog)
		document.body.appendChild(this.overlay)
	}

	show(setup?: Partial<PageSetupDef>) {
		this.setup = { ...defaultSetup(), ...setup }
		this._buildUI()
		this.overlay.style.display = 'flex'
	}

	hide() {
		this.overlay.style.display = 'none'
		this.dialog.innerHTML = ''
		this.tabBtns.clear()
		this.tabPanels.clear()
	}

	// -----------------------------------------------------------------------

	private _buildUI() {
		this.dialog.innerHTML = ''
		this.tabBtns.clear()
		this.tabPanels.clear()

		// Title bar
		const title = document.createElement('div')
		title.style.cssText = 'padding:10px 14px 8px;font-weight:600;font-size:13px;border-bottom:1px solid #444;flex-shrink:0;'
		title.textContent = 'Page Setup'
		this.dialog.appendChild(title)

		// Tab bar
		const tabBar = document.createElement('div')
		tabBar.style.cssText = 'display:flex;border-bottom:1px solid #444;background:#1e1e1e;flex-shrink:0;'
		for (const { label, key } of this.tabs) {
			const btn = document.createElement('button')
			btn.textContent = label
			btn.style.cssText = 'padding:6px 14px;background:none;border:none;color:#ccc;cursor:pointer;font-size:12px;border-bottom:2px solid transparent;'
			if (key === this.activeTabKey) {
				btn.style.borderBottomColor = '#4fc3f7'
				btn.style.color = '#fff'
			}
			btn.onclick = () => this._switchTab(key)
			this.tabBtns.set(key, btn)
			tabBar.appendChild(btn)
		}
		this.dialog.appendChild(tabBar)

		// Panels
		const body = document.createElement('div')
		body.style.cssText = 'flex:1;overflow-y:auto;min-height:200px;'

		for (const { key } of this.tabs) {
			const panel = document.createElement('div')
			panel.style.cssText = `display:${key === this.activeTabKey ? 'block' : 'none'};padding:16px;`
			this.tabPanels.set(key, panel)
			body.appendChild(panel)
		}
		this.dialog.appendChild(body)

		this._buildPageTab()
		this._buildMarginsTab()
		this._buildHeaderFooterTab()
		this._buildSheetTab()

		// Footer buttons
		const footer = document.createElement('div')
		footer.style.cssText = 'display:flex;justify-content:flex-end;gap:8px;padding:10px 14px;border-top:1px solid #444;flex-shrink:0;'

		const okBtn = document.createElement('button')
		okBtn.textContent = 'OK'
		okBtn.style.cssText = 'padding:4px 16px;background:#0078d4;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:12px;'
		okBtn.onclick = () => this._apply()

		const cancelBtn = document.createElement('button')
		cancelBtn.textContent = 'Cancel'
		cancelBtn.style.cssText = 'padding:4px 14px;background:#3c3c3c;color:#ccc;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:12px;'
		cancelBtn.onclick = () => this._cancel()

		footer.appendChild(cancelBtn)
		footer.appendChild(okBtn)
		this.dialog.appendChild(footer)
	}

	private _switchTab(key: string) {
		this.tabBtns.get(this.activeTabKey)!.style.borderBottomColor = 'transparent'
		this.tabBtns.get(this.activeTabKey)!.style.color = '#ccc'
		this.tabPanels.get(this.activeTabKey)!.style.display = 'none'
		this.activeTabKey = key
		this.tabBtns.get(key)!.style.borderBottomColor = '#4fc3f7'
		this.tabBtns.get(key)!.style.color = '#fff'
		this.tabPanels.get(key)!.style.display = 'block'
	}

	// -----------------------------------------------------------------------
	// PAGE TAB
	// -----------------------------------------------------------------------
	private _buildPageTab() {
		const panel = this.tabPanels.get('page')!
		const s = this.setup

		// Orientation
		const orientSec = this._section('Orientation')
		const portraitBtn = this._radioBtn('Portrait', 'orient', s.orientation === 'portrait', () => { s.orientation = 'portrait' })
		const landscapeBtn = this._radioBtn('Landscape', 'orient', s.orientation === 'landscape', () => { s.orientation = 'landscape' })
		orientSec.appendChild(this._row(portraitBtn, landscapeBtn))
		panel.appendChild(orientSec)

		// Scaling
		const scaleSec = this._section('Scaling')
		const useScale = !s.fit_to_width && !s.fit_to_height
		const scaleRadio = this._radioBtn('Adjust to:', 'scale-mode', useScale, () => {
			s.fit_to_width = undefined; s.fit_to_height = undefined
			scaleInput.disabled = false; fitWInput.disabled = true; fitHInput.disabled = true
		})
		const scaleInput = document.createElement('input')
		scaleInput.type = 'number'; scaleInput.min = '10'; scaleInput.max = '400'
		scaleInput.value = String(s.scale)
		scaleInput.disabled = !useScale
		scaleInput.style.cssText = 'width:55px;margin:0 4px;'
		scaleInput.className = 'dialog-input'
		scaleInput.onchange = () => { s.scale = parseInt(scaleInput.value) || 100 }
		const scalePct = document.createElement('span'); scalePct.textContent = '% normal size'

		const fitRadio = this._radioBtn('Fit to:', 'scale-mode', !useScale, () => {
			s.fit_to_width = parseInt(fitWInput.value) || 1
			s.fit_to_height = parseInt(fitHInput.value) || 1
			scaleInput.disabled = true; fitWInput.disabled = false; fitHInput.disabled = false
		})
		const fitWInput = document.createElement('input')
		fitWInput.type = 'number'; fitWInput.min = '1'; fitWInput.max = '99'
		fitWInput.value = String(s.fit_to_width ?? 1); fitWInput.disabled = useScale
		fitWInput.style.cssText = 'width:40px;margin:0 4px;'; fitWInput.className = 'dialog-input'
		fitWInput.onchange = () => { s.fit_to_width = parseInt(fitWInput.value) || 1 }
		const fitMid = document.createElement('span'); fitMid.textContent = 'page(s) wide by'
		const fitHInput = document.createElement('input')
		fitHInput.type = 'number'; fitHInput.min = '0'; fitHInput.max = '99'
		fitHInput.value = String(s.fit_to_height ?? 1); fitHInput.disabled = useScale
		fitHInput.style.cssText = 'width:40px;margin:0 4px;'; fitHInput.className = 'dialog-input'
		fitHInput.onchange = () => { s.fit_to_height = parseInt(fitHInput.value) || 1 }
		const fitTall = document.createElement('span'); fitTall.textContent = 'tall'

		scaleSec.appendChild(this._row(scaleRadio, scaleInput, scalePct))
		scaleSec.appendChild(this._row(fitRadio, fitWInput, fitMid, fitHInput, fitTall))
		panel.appendChild(scaleSec)

		// Paper size
		const paperSec = this._section('Paper size')
		const paperSel = document.createElement('select')
		paperSel.className = 'dialog-input'
		paperSel.style.cssText = 'width:100%;'
		for (const p of PAPER_SIZES) {
			const o = document.createElement('option')
			o.value = String(p.id); o.textContent = p.label
			if (p.id === s.paper_size) o.selected = true
			paperSel.appendChild(o)
		}
		paperSel.onchange = () => { s.paper_size = parseInt(paperSel.value) }
		paperSec.appendChild(paperSel)
		panel.appendChild(paperSec)

		// First page number
		const fpnSec = this._section('First page number')
		const fpnInput = document.createElement('input')
		fpnInput.type = 'text'; fpnInput.value = 'Auto'; fpnInput.className = 'dialog-input'
		fpnInput.style.cssText = 'width:70px;'
		fpnInput.title = 'Auto or a specific page number'
		fpnSec.appendChild(fpnInput)
		panel.appendChild(fpnSec)
	}

	// -----------------------------------------------------------------------
	// MARGINS TAB
	// -----------------------------------------------------------------------
	private _buildMarginsTab() {
		const panel = this.tabPanels.get('margins')!
		const s = this.setup

		const fields: { label: string; key: keyof PageSetupDef }[] = [
			{ label: 'Top:', key: 'margin_top' },
			{ label: 'Bottom:', key: 'margin_bottom' },
			{ label: 'Left:', key: 'margin_left' },
			{ label: 'Right:', key: 'margin_right' },
			{ label: 'Header:', key: 'margin_header' },
			{ label: 'Footer:', key: 'margin_footer' },
		]

		const grid = document.createElement('div')
		grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;'

		for (const { label, key } of fields) {
			const wrap = document.createElement('div')
			const lbl = document.createElement('div')
			lbl.textContent = label
			lbl.style.cssText = 'margin-bottom:3px;color:#aaa;font-size:11px;'
			const inp = document.createElement('input')
			inp.type = 'number'; inp.step = '0.05'; inp.min = '0'
			inp.value = String((s[key] as number).toFixed(2))
			inp.className = 'dialog-input'
			inp.style.cssText = 'width:100%;'
			inp.onchange = () => { (s as unknown as Record<string, number>)[key as string] = parseFloat(inp.value) || 0 }
			wrap.appendChild(lbl); wrap.appendChild(inp)
			grid.appendChild(wrap)
		}
		panel.appendChild(grid)

		// Centering checkboxes
		const centerSec = this._section('Center on page')
		const chkH = this._checkbox('Horizontally', s.center_horizontally, v => { s.center_horizontally = v })
		const chkV = this._checkbox('Vertically', s.center_vertically, v => { s.center_vertically = v })
		centerSec.appendChild(this._row(chkH, chkV))
		panel.appendChild(centerSec)

		// Visual margin preview
		const preview = document.createElement('div')
		preview.style.cssText = 'margin-top:14px;width:120px;height:160px;border:1px solid #555;position:relative;background:#2d2d2d;margin-left:auto;margin-right:auto;'
		const inner = document.createElement('div')
		inner.style.cssText = 'position:absolute;inset:16px 14px 16px 14px;border:1px dashed #4472c4;background:#333;'
		preview.appendChild(inner)
		panel.appendChild(preview)
	}

	// -----------------------------------------------------------------------
	// HEADER/FOOTER TAB
	// -----------------------------------------------------------------------
	private _buildHeaderFooterTab() {
		const panel = this.tabPanels.get('header-footer')!
		const s = this.setup

		const hint = document.createElement('div')
		hint.style.cssText = 'color:#aaa;font-size:11px;margin-bottom:10px;'
		hint.textContent = 'Format codes: &L left  &C center  &R right  &P page#  &N total pages  &D date  &T time  &F filename  &A sheet name'
		panel.appendChild(hint)

		// Header
		const headerSec = this._section('Header')
		const headerPreset = document.createElement('select')
		headerPreset.className = 'dialog-input'; headerPreset.style.cssText = 'width:100%;margin-bottom:6px;'
		for (const p of HEADER_FOOTER_PRESETS) {
			const o = document.createElement('option'); o.value = p.value; o.textContent = p.label
			if (p.value === s.header || (p.value === '__custom__' && !HEADER_FOOTER_PRESETS.some(x => x.value === s.header))) o.selected = true
			headerPreset.appendChild(o)
		}
		const headerInput = document.createElement('textarea')
		headerInput.value = s.header; headerInput.rows = 2
		headerInput.className = 'dialog-input'; headerInput.style.cssText = 'width:100%;resize:vertical;font-family:monospace;'
		headerPreset.onchange = () => {
			if (headerPreset.value !== '__custom__') { headerInput.value = headerPreset.value; s.header = headerPreset.value }
		}
		headerInput.onchange = () => { s.header = headerInput.value }
		headerSec.appendChild(headerPreset); headerSec.appendChild(headerInput)
		panel.appendChild(headerSec)

		// Footer
		const footerSec = this._section('Footer')
		const footerPreset = document.createElement('select')
		footerPreset.className = 'dialog-input'; footerPreset.style.cssText = 'width:100%;margin-bottom:6px;'
		for (const p of HEADER_FOOTER_PRESETS) {
			const o = document.createElement('option'); o.value = p.value; o.textContent = p.label
			if (p.value === s.footer) o.selected = true
			footerPreset.appendChild(o)
		}
		const footerInput = document.createElement('textarea')
		footerInput.value = s.footer; footerInput.rows = 2
		footerInput.className = 'dialog-input'; footerInput.style.cssText = 'width:100%;resize:vertical;font-family:monospace;'
		footerPreset.onchange = () => {
			if (footerPreset.value !== '__custom__') { footerInput.value = footerPreset.value; s.footer = footerPreset.value }
		}
		footerInput.onchange = () => { s.footer = footerInput.value }
		footerSec.appendChild(footerPreset); footerSec.appendChild(footerInput)
		panel.appendChild(footerSec)
	}

	// -----------------------------------------------------------------------
	// SHEET TAB
	// -----------------------------------------------------------------------
	private _buildSheetTab() {
		const panel = this.tabPanels.get('sheet')!
		const s = this.setup

		// Print area
		const paSec = this._section('Print area')
		const paInput = document.createElement('input')
		paInput.type = 'text'; paInput.value = s.print_area
		paInput.placeholder = 'e.g. A1:H50'
		paInput.className = 'dialog-input'; paInput.style.cssText = 'width:100%;'
		paInput.onchange = () => { s.print_area = paInput.value.trim().replace(/\$/g, '') }
		paSec.appendChild(paInput)
		panel.appendChild(paSec)

		// Print titles
		const ptSec = this._section('Print titles')
		const ptRowWrap = document.createElement('div'); ptRowWrap.style.marginBottom = '6px'
		const ptRowLbl = document.createElement('div'); ptRowLbl.textContent = 'Rows to repeat at top:'
		ptRowLbl.style.cssText = 'color:#aaa;font-size:11px;margin-bottom:3px;'
		const ptRowInput = document.createElement('input')
		ptRowInput.type = 'text'; ptRowInput.value = s.print_titles_rows
		ptRowInput.placeholder = 'e.g. 1:2'; ptRowInput.className = 'dialog-input'
		ptRowInput.style.cssText = 'width:100%;'
		ptRowInput.onchange = () => { s.print_titles_rows = ptRowInput.value.trim() }
		ptRowWrap.appendChild(ptRowLbl); ptRowWrap.appendChild(ptRowInput)

		const ptColWrap = document.createElement('div')
		const ptColLbl = document.createElement('div'); ptColLbl.textContent = 'Columns to repeat at left:'
		ptColLbl.style.cssText = 'color:#aaa;font-size:11px;margin-bottom:3px;'
		const ptColInput = document.createElement('input')
		ptColInput.type = 'text'; ptColInput.value = s.print_titles_cols
		ptColInput.placeholder = 'e.g. A:B'; ptColInput.className = 'dialog-input'
		ptColInput.style.cssText = 'width:100%;'
		ptColInput.onchange = () => { s.print_titles_cols = ptColInput.value.trim() }
		ptColWrap.appendChild(ptColLbl); ptColWrap.appendChild(ptColInput)

		ptSec.appendChild(ptRowWrap); ptSec.appendChild(ptColWrap)
		panel.appendChild(ptSec)

		// Print options
		const optSec = this._section('Print')
		const chkGrid = this._checkbox('Gridlines', s.print_gridlines, v => { s.print_gridlines = v })
		optSec.appendChild(chkGrid)
		panel.appendChild(optSec)

		// Page order
		const orderSec = this._section('Page order')
		const downOverBtn = this._radioBtn('Down, then over', 'page-order', true, () => {})
		const overDownBtn = this._radioBtn('Over, then down', 'page-order', false, () => {})
		orderSec.appendChild(this._row(downOverBtn, overDownBtn))
		panel.appendChild(orderSec)
	}

	// -----------------------------------------------------------------------
	// Helpers
	// -----------------------------------------------------------------------
	private _section(title: string): HTMLDivElement {
		const sec = document.createElement('div')
		sec.style.cssText = 'margin-bottom:14px;'
		if (title) {
			const lbl = document.createElement('div')
			lbl.textContent = title
			lbl.style.cssText = 'font-size:11px;color:#aaa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;border-bottom:1px solid #3c3c3c;padding-bottom:3px;'
			sec.appendChild(lbl)
		}
		return sec
	}

	private _row(...items: HTMLElement[]): HTMLDivElement {
		const row = document.createElement('div')
		row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:4px;flex-wrap:wrap;'
		for (const i of items) row.appendChild(i)
		return row
	}

	private _radioBtn(label: string, group: string, checked: boolean, onChange: () => void): HTMLLabelElement {
		const lbl = document.createElement('label')
		lbl.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;'
		const inp = document.createElement('input')
		inp.type = 'radio'; inp.name = group; inp.checked = checked
		inp.onchange = () => { if (inp.checked) onChange() }
		const span = document.createElement('span'); span.textContent = label
		lbl.appendChild(inp); lbl.appendChild(span)
		return lbl
	}

	private _checkbox(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLLabelElement {
		const lbl = document.createElement('label')
		lbl.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;margin-right:10px;'
		const inp = document.createElement('input')
		inp.type = 'checkbox'; inp.checked = checked
		inp.onchange = () => onChange(inp.checked)
		const span = document.createElement('span'); span.textContent = label
		lbl.appendChild(inp); lbl.appendChild(span)
		return lbl
	}

	private _apply() {
		this.onAction({ action: 'apply', setup: { ...this.setup } })
		this.hide()
	}

	private _cancel() {
		this.onAction({ action: 'cancel' })
		this.hide()
	}
}

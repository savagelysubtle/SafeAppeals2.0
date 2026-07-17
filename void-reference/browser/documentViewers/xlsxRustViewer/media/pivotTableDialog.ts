/**
 * pivotTableDialog.ts -- Pivot Table Field Builder dialog.
 * Drag-and-drop field placement into Rows / Columns / Values / Filters areas.
 * Follows ChartWizardDialog pattern (overlay + centered dialog).
 */

import type { PivotTableDef, PivotFieldDef, PivotCalcFieldDef, PivotFilterValueDef } from './pivotTableEngine.js'

export type { PivotTableDef, PivotFieldDef }

export interface PivotDialogEvent {
	action: 'create' | 'update' | 'delete' | 'refresh' | 'cancel'
	config?: PivotTableDef
	editIndex?: number
}

const AGGREGATIONS = ['sum', 'count', 'average', 'min', 'max', 'product', 'countNums'] as const

const PIVOT_STYLES = [
	{ id: 'PivotStyleMedium', label: 'Medium (Blue)' },
	{ id: 'PivotStyleLight', label: 'Light' },
	{ id: 'PivotStyleDark', label: 'Dark' },
]

// ---------------------------------------------------------------------------

export class PivotTableDialog {
	private overlay: HTMLDivElement
	private dialog: HTMLDivElement
	private onAction: (event: PivotDialogEvent) => void

	// Dialog state
	private allHeaders: string[] = []
	private sourceRange = ''
	private sourceSheet = ''
	private sheetNames: string[] = []
	private editIndex?: number

	// Field placements
	private fieldAreas: Map<string, 'none' | 'row' | 'column' | 'value' | 'filter'> = new Map()
	private fieldAggregation: Map<string, string> = new Map()
	private fieldGroupBy: Map<string, string> = new Map()
	private fieldSortOrder: Map<string, string> = new Map()
	private filterValues: Map<string, string[]> = new Map() // field -> included values
	private calcFields: PivotCalcFieldDef[] = []

	// UI elements
	private fieldListEl!: HTMLDivElement
	private areaEls: { row: HTMLDivElement; column: HTMLDivElement; value: HTMLDivElement; filter: HTMLDivElement } | null = null
	private destSheetSelect!: HTMLSelectElement
	private destCellInput!: HTMLInputElement
	private styleSelect!: HTMLSelectElement
	private showGrandRowsCheck!: HTMLInputElement
	private showGrandColsCheck!: HTMLInputElement
	private showSubtotalsCheck!: HTMLInputElement

	// Dragging state
	private dragFieldName: string | null = null

	constructor(_parent: HTMLElement, onAction: (event: PivotDialogEvent) => void) {
		this.onAction = onAction

		this.overlay = document.createElement('div')
		this.overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);display:none;z-index:10000;align-items:center;justify-content:center;'
		this.overlay.addEventListener('mousedown', e => {
			if (e.target === this.overlay) this.hide()
		})

		this.dialog = document.createElement('div')
		this.dialog.style.cssText = [
			'background:#252526;color:#ccc;border:1px solid #555;border-radius:4px;',
			'display:flex;flex-direction:column;width:780px;max-height:90vh;overflow:hidden;',
			'font-family:var(--vscode-font-family,sans-serif);font-size:12px;',
		].join('')
		this.overlay.appendChild(this.dialog)
		document.body.appendChild(this.overlay)
	}

	// ---------------------------------------------------------------------------
	// Public API
	// ---------------------------------------------------------------------------

	show(
		sourceHeaders: string[],
		sourceRange: string,
		sourceSheet: string,
		sheetNames: string[],
		existingConfig?: PivotTableDef,
		editIndex?: number,
		numericHeaders?: string[]
	) {
		this.allHeaders = sourceHeaders
		this.sourceRange = sourceRange
		this.sourceSheet = sourceSheet
		this.sheetNames = sheetNames
		this.editIndex = editIndex

		// Reset state
		this.fieldAreas.clear()
		this.fieldAggregation.clear()
		this.fieldGroupBy.clear()
		this.fieldSortOrder.clear()
		this.filterValues.clear()
		this.calcFields = []

		// Initialize all headers as 'none'
		for (const h of sourceHeaders) this.fieldAreas.set(h, 'none')

		if (existingConfig) {
			// Restore existing config
			for (const f of existingConfig.fields) {
				if (sourceHeaders.includes(f.name)) {
					this.fieldAreas.set(f.name, f.area as 'row' | 'column' | 'value' | 'filter')
					if (f.aggregation) this.fieldAggregation.set(f.name, f.aggregation)
					if (f.group_by) this.fieldGroupBy.set(f.name, f.group_by)
					if (f.sort_order) this.fieldSortOrder.set(f.name, f.sort_order)
				}
			}
			for (const fv of (existingConfig.filter_values ?? [])) {
				this.filterValues.set(fv.field_name, fv.included_values)
			}
			this.calcFields = existingConfig.calc_fields ? [...existingConfig.calc_fields] : []
		} else if (numericHeaders && numericHeaders.length > 0) {
			// Auto-assign for new pivot: first non-numeric col → Rows, numeric cols → Values
			let assignedRow = false
			for (const h of sourceHeaders) {
				if (numericHeaders.includes(h)) {
					this.fieldAreas.set(h, 'value')
				} else if (!assignedRow) {
					this.fieldAreas.set(h, 'row')
					assignedRow = true
				}
			}
		}

		this._buildUI(existingConfig)
		this.overlay.style.display = 'flex'
	}

	hide() {
		this.overlay.style.display = 'none'
		this.dialog.innerHTML = ''
	}

	isVisible() { return this.overlay.style.display !== 'none' }

	// ---------------------------------------------------------------------------
	// UI construction
	// ---------------------------------------------------------------------------

	private _buildUI(existingConfig?: PivotTableDef) {
		this.dialog.innerHTML = ''

		// Title bar
		const titleBar = document.createElement('div')
		titleBar.style.cssText = 'background:#37373d;padding:8px 12px;font-weight:bold;font-size:13px;display:flex;justify-content:space-between;align-items:center;cursor:move;'
		titleBar.textContent = existingConfig ? 'Edit PivotTable' : 'Create PivotTable'
		const closeBtn = document.createElement('button')
		closeBtn.textContent = '✕'
		closeBtn.style.cssText = 'background:none;border:none;color:#ccc;cursor:pointer;font-size:14px;padding:0 4px;'
		closeBtn.onclick = () => this.hide()
		titleBar.appendChild(closeBtn)
		this.dialog.appendChild(titleBar)
		this._makeDraggable(titleBar)

		// Body -- two columns
		const body = document.createElement('div')
		body.style.cssText = 'display:flex;flex:1;overflow:hidden;padding:12px;gap:12px;min-height:400px;'

		// Left: field list
		const leftPanel = document.createElement('div')
		leftPanel.style.cssText = 'width:200px;flex-shrink:0;display:flex;flex-direction:column;gap:8px;'
		const leftLabel = document.createElement('div')
		leftLabel.style.cssText = 'font-weight:bold;color:#ddd;font-size:11px;text-transform:uppercase;'
		leftLabel.textContent = 'Field List'
		leftPanel.appendChild(leftLabel)
		this.fieldListEl = document.createElement('div')
		this.fieldListEl.style.cssText = 'flex:1;overflow-y:auto;background:#1e1e1e;border:1px solid #444;border-radius:3px;padding:4px;display:flex;flex-direction:column;gap:2px;'
		leftPanel.appendChild(this.fieldListEl)
		body.appendChild(leftPanel)

		// Right: area boxes in 2x2 grid
		const rightPanel = document.createElement('div')
		rightPanel.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:8px;'

		const areasGrid = document.createElement('div')
		areasGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:8px;flex:1;'

		const filterEl = this._buildAreaBox('Filters', 'filter')
		const columnEl = this._buildAreaBox('Columns', 'column')
		const rowEl = this._buildAreaBox('Rows', 'row')
		const valueEl = this._buildAreaBox('Values', 'value')
		this.areaEls = { row: rowEl, column: columnEl, value: valueEl, filter: filterEl }

		areasGrid.appendChild(filterEl)
		areasGrid.appendChild(columnEl)
		areasGrid.appendChild(rowEl)
		areasGrid.appendChild(valueEl)
		rightPanel.appendChild(areasGrid)

		// Options row below areas
		const optionsRow = document.createElement('div')
		optionsRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:16px;align-items:center;padding:8px 0;border-top:1px solid #444;'

		this.showGrandRowsCheck = this._checkbox('Grand Total Rows', existingConfig?.show_grand_total_rows ?? true)
		this.showGrandColsCheck = this._checkbox('Grand Total Columns', existingConfig?.show_grand_total_cols ?? false)
		this.showSubtotalsCheck = this._checkbox('Subtotals', existingConfig?.show_subtotals ?? false)
		optionsRow.appendChild(this.showGrandRowsCheck.parentElement!)
		optionsRow.appendChild(this.showGrandColsCheck.parentElement!)
		optionsRow.appendChild(this.showSubtotalsCheck.parentElement!)

		// Style picker
		const styleWrap = this._labeledControl('Style', () => {
			this.styleSelect = document.createElement('select')
			this.styleSelect.style.cssText = 'background:#3c3c3c;color:#ccc;border:1px solid #555;padding:2px 4px;border-radius:2px;'
			for (const s of PIVOT_STYLES) {
				const opt = document.createElement('option')
				opt.value = s.id
				opt.textContent = s.label
				if (existingConfig?.style_name === s.id) opt.selected = true
				this.styleSelect.appendChild(opt)
			}
			return this.styleSelect
		})
		optionsRow.appendChild(styleWrap)
		rightPanel.appendChild(areasGrid)
		rightPanel.appendChild(optionsRow)

		// Destination row
		const destRow = document.createElement('div')
		destRow.style.cssText = 'display:flex;gap:12px;align-items:center;border-top:1px solid #444;padding-top:8px;'

		const destSheetWrap = this._labeledControl('Destination Sheet', () => {
			this.destSheetSelect = document.createElement('select')
			this.destSheetSelect.style.cssText = 'background:#3c3c3c;color:#ccc;border:1px solid #555;padding:2px 4px;border-radius:2px;'
			const newOpt = document.createElement('option')
			newOpt.value = '__new__'
			newOpt.textContent = '+ New Sheet'
			this.destSheetSelect.appendChild(newOpt)
			for (const s of this.sheetNames) {
				const opt = document.createElement('option')
				opt.value = s
				opt.textContent = s
				if (existingConfig?.dest_sheet === s) opt.selected = true
				this.destSheetSelect.appendChild(opt)
			}
			return this.destSheetSelect
		})

		const destCellWrap = this._labeledControl('Cell', () => {
			this.destCellInput = document.createElement('input')
			this.destCellInput.type = 'text'
			this.destCellInput.value = existingConfig?.dest_cell ?? 'A1'
			this.destCellInput.style.cssText = 'background:#3c3c3c;color:#ccc;border:1px solid #555;padding:2px 4px;width:60px;border-radius:2px;'
			return this.destCellInput
		})

		destRow.appendChild(destSheetWrap)
		destRow.appendChild(destCellWrap)
		rightPanel.appendChild(destRow)

		body.appendChild(rightPanel)
		this.dialog.appendChild(body)

		// Footer
		const footer = document.createElement('div')
		footer.style.cssText = 'display:flex;justify-content:space-between;padding:10px 12px;border-top:1px solid #444;gap:8px;'

		const leftFooter = document.createElement('div')
		leftFooter.style.cssText = 'display:flex;gap:8px;'
		if (existingConfig) {
			const delBtn = this._btn('Delete PivotTable', '#c0392b')
			delBtn.onclick = () => {
				this.onAction({ action: 'delete', editIndex: this.editIndex })
				this.hide()
			}
			const refreshBtn = this._btn('Refresh', '#5a5a5a')
			refreshBtn.onclick = () => {
				this.onAction({ action: 'refresh', editIndex: this.editIndex })
				this.hide()
			}
			leftFooter.appendChild(delBtn)
			leftFooter.appendChild(refreshBtn)
		}
		footer.appendChild(leftFooter)

		const rightFooter = document.createElement('div')
		rightFooter.style.cssText = 'display:flex;gap:8px;'
		const cancelBtn = this._btn('Cancel', '#5a5a5a')
		cancelBtn.onclick = () => {
			this.onAction({ action: 'cancel' })
			this.hide()
		}
		const okBtn = this._btn('OK', '#0e639c')
		okBtn.onclick = () => this._submit()
		rightFooter.appendChild(cancelBtn)
		rightFooter.appendChild(okBtn)
		footer.appendChild(rightFooter)

		this.dialog.appendChild(footer)

		// Populate field list and areas
		this._renderFieldList()
		this._renderAreas()
	}

	// ---------------------------------------------------------------------------
	// Field list rendering
	// ---------------------------------------------------------------------------

	private _renderFieldList() {
		this.fieldListEl.innerHTML = ''
		const unplacedFields = this.allHeaders.filter(h => this.fieldAreas.get(h) === 'none')
		if (unplacedFields.length === 0) {
			const empty = document.createElement('div')
			empty.style.cssText = 'color:#666;padding:8px;text-align:center;font-size:11px;'
			empty.textContent = 'All fields placed'
			this.fieldListEl.appendChild(empty)
			return
		}
		for (const h of unplacedFields) {
			const chip = this._fieldChip(h, 'none')
			this.fieldListEl.appendChild(chip)
		}
	}

	private _renderAreas() {
		if (!this.areaEls) return
		for (const area of ['row', 'column', 'value', 'filter'] as const) {
			const el = this.areaEls[area]
			const chipsContainer = el.querySelector('.chips-container') as HTMLDivElement
			if (!chipsContainer) continue
			chipsContainer.innerHTML = ''
			const fieldsInArea = this.allHeaders.filter(h => this.fieldAreas.get(h) === area)
			for (const h of fieldsInArea) {
				chipsContainer.appendChild(this._fieldChip(h, area))
			}
		}
	}

	// ---------------------------------------------------------------------------
	// Field chip
	// ---------------------------------------------------------------------------

	private _fieldChip(name: string, area: 'none' | 'row' | 'column' | 'value' | 'filter'): HTMLDivElement {
		const chip = document.createElement('div')
		chip.style.cssText = [
			'display:flex;align-items:center;justify-content:space-between;',
			'background:#3c3c3c;border:1px solid #555;border-radius:3px;',
			'padding:3px 6px;font-size:11px;cursor:grab;gap:4px;',
		].join('')
		chip.draggable = true

		const label = document.createElement('span')
		label.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'

		if (area === 'value') {
			const agg = this.fieldAggregation.get(name) ?? 'sum'
			const aggLabel = agg.charAt(0).toUpperCase() + agg.slice(1)
			label.textContent = `${aggLabel} of ${name}`
		} else {
			label.textContent = name
		}
		chip.appendChild(label)

		// Settings button for placed chips
		if (area !== 'none') {
			const settingsBtn = document.createElement('button')
			settingsBtn.textContent = '▾'
			settingsBtn.style.cssText = 'background:none;border:none;color:#aaa;cursor:pointer;padding:0 2px;font-size:10px;'
			settingsBtn.onclick = (e) => {
				e.stopPropagation()
				this._showFieldPopover(name, area, settingsBtn)
			}
			chip.appendChild(settingsBtn)

			// Remove button
			const removeBtn = document.createElement('button')
			removeBtn.textContent = '✕'
			removeBtn.style.cssText = 'background:none;border:none;color:#888;cursor:pointer;padding:0 2px;font-size:10px;'
			removeBtn.onclick = (e) => {
				e.stopPropagation()
				this.fieldAreas.set(name, 'none')
				this._renderFieldList()
				this._renderAreas()
			}
			chip.appendChild(removeBtn)
		}

		// Drag events
		chip.addEventListener('dragstart', () => {
			this.dragFieldName = name
			chip.style.opacity = '0.5'
		})
		chip.addEventListener('dragend', () => {
			chip.style.opacity = '1'
			this.dragFieldName = null
		})

		return chip
	}

	// ---------------------------------------------------------------------------
	// Area box with drop zone
	// ---------------------------------------------------------------------------

	private _buildAreaBox(label: string, area: 'row' | 'column' | 'value' | 'filter'): HTMLDivElement {
		const box = document.createElement('div')
		box.style.cssText = 'display:flex;flex-direction:column;border:1px solid #444;border-radius:3px;overflow:hidden;'

		const header = document.createElement('div')
		header.style.cssText = 'background:#2d2d30;padding:4px 8px;font-weight:bold;font-size:11px;color:#9cdcfe;'
		header.textContent = label
		box.appendChild(header)

		const chipsContainer = document.createElement('div')
		chipsContainer.className = 'chips-container'
		chipsContainer.style.cssText = 'flex:1;overflow-y:auto;padding:4px;display:flex;flex-direction:column;gap:2px;min-height:60px;'
		box.appendChild(chipsContainer)

		// Drop zone events
		box.addEventListener('dragover', e => {
			e.preventDefault()
			box.style.borderColor = '#0e639c'
		})
		box.addEventListener('dragleave', () => {
			box.style.borderColor = '#444'
		})
		box.addEventListener('drop', e => {
			e.preventDefault()
			box.style.borderColor = '#444'
			if (this.dragFieldName) {
				this.fieldAreas.set(this.dragFieldName, area)
				if (area === 'value' && !this.fieldAggregation.has(this.dragFieldName)) {
					this.fieldAggregation.set(this.dragFieldName, 'sum')
				}
				this._renderFieldList()
				this._renderAreas()
			}
		})

		return box
	}

	// ---------------------------------------------------------------------------
	// Field configuration popover
	// ---------------------------------------------------------------------------

	private _showFieldPopover(name: string, area: 'row' | 'column' | 'value' | 'filter', anchor: HTMLElement) {
		// Remove any existing popover
		document.querySelector('.pivot-field-popover')?.remove()

		const popover = document.createElement('div')
		popover.className = 'pivot-field-popover'
		popover.style.cssText = [
			'position:fixed;background:#252526;border:1px solid #555;border-radius:4px;',
			'padding:10px;min-width:180px;z-index:20000;display:flex;flex-direction:column;gap:8px;',
			'box-shadow:0 4px 12px rgba(0,0,0,0.5);',
		].join('')

		const rect = anchor.getBoundingClientRect()
		popover.style.left = `${Math.min(rect.left, window.innerWidth - 200)}px`
		popover.style.top = `${rect.bottom + 4}px`

		if (area === 'value') {
			const aggLabel = document.createElement('div')
			aggLabel.style.cssText = 'font-size:11px;font-weight:bold;color:#9cdcfe;'
			aggLabel.textContent = 'Summarize Values By'
			popover.appendChild(aggLabel)

			const currentAgg = this.fieldAggregation.get(name) ?? 'sum'
			for (const agg of AGGREGATIONS) {
				const row = document.createElement('div')
				row.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;padding:3px 0;'
				const radio = document.createElement('input')
				radio.type = 'radio'
				radio.name = 'agg'
				radio.value = agg
				radio.checked = agg === currentAgg
				radio.style.cursor = 'pointer'
				radio.onchange = () => {
					this.fieldAggregation.set(name, agg)
					this._renderAreas()
					popover.remove()
				}
				const l = document.createElement('label')
				l.textContent = agg.charAt(0).toUpperCase() + agg.slice(1)
				l.style.cursor = 'pointer'
				l.onclick = () => { radio.click() }
				row.appendChild(radio)
				row.appendChild(l)
				popover.appendChild(row)
			}
		} else if (area === 'row' || area === 'column') {
			// Sort order
			const sortLabel = document.createElement('div')
			sortLabel.style.cssText = 'font-size:11px;font-weight:bold;color:#9cdcfe;'
			sortLabel.textContent = 'Sort'
			popover.appendChild(sortLabel)

			for (const [val, lab] of [['asc', 'A → Z'], ['desc', 'Z → A'], ['none', 'No Sort']]) {
				const row = document.createElement('div')
				row.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;'
				const radio = document.createElement('input')
				radio.type = 'radio'
				radio.name = 'sort'
				radio.value = val
				radio.checked = (this.fieldSortOrder.get(name) ?? 'none') === val
				radio.onchange = () => { this.fieldSortOrder.set(name, val); popover.remove() }
				const l = document.createElement('label')
				l.textContent = lab
				l.onclick = () => radio.click()
				row.appendChild(radio)
				row.appendChild(l)
				popover.appendChild(row)
			}

			// Date grouping
			const grpLabel = document.createElement('div')
			grpLabel.style.cssText = 'font-size:11px;font-weight:bold;color:#9cdcfe;margin-top:6px;'
			grpLabel.textContent = 'Group By'
			popover.appendChild(grpLabel)

			for (const [val, lab] of [['none', 'None'], ['day', 'Day'], ['month', 'Month'], ['quarter', 'Quarter'], ['year', 'Year']]) {
				const row = document.createElement('div')
				row.style.cssText = 'display:flex;align-items:center;gap:6px;cursor:pointer;'
				const radio = document.createElement('input')
				radio.type = 'radio'
				radio.name = 'grp'
				radio.value = val
				radio.checked = (this.fieldGroupBy.get(name) ?? 'none') === val
				radio.onchange = () => { this.fieldGroupBy.set(name, val); popover.remove() }
				const l = document.createElement('label')
				l.textContent = lab
				l.onclick = () => radio.click()
				row.appendChild(radio)
				row.appendChild(l)
				popover.appendChild(row)
			}
		} else if (area === 'filter') {
			// Filter value checklist (simplified -- user enters comma-separated values)
			const filterLabel = document.createElement('div')
			filterLabel.style.cssText = 'font-size:11px;font-weight:bold;color:#9cdcfe;'
			filterLabel.textContent = 'Include values (comma-separated):'
			popover.appendChild(filterLabel)

			const textarea = document.createElement('textarea')
			textarea.rows = 3
			textarea.value = (this.filterValues.get(name) ?? []).join(', ')
			textarea.style.cssText = 'background:#3c3c3c;color:#ccc;border:1px solid #555;border-radius:2px;width:100%;resize:vertical;font-size:11px;'
			textarea.placeholder = 'Leave empty to include all'
			popover.appendChild(textarea)

			const applyBtn = this._btn('Apply', '#0e639c')
			applyBtn.onclick = () => {
				const vals = textarea.value.split(',').map(v => v.trim()).filter(v => v)
				if (vals.length > 0) {
					this.filterValues.set(name, vals)
				} else {
					this.filterValues.delete(name)
				}
				popover.remove()
			}
			popover.appendChild(applyBtn)
		}

		// Close on outside click
		const closePopover = (e: MouseEvent) => {
			if (!popover.contains(e.target as Node)) {
				popover.remove()
				document.removeEventListener('mousedown', closePopover)
			}
		}
		document.body.appendChild(popover)
		setTimeout(() => document.addEventListener('mousedown', closePopover), 50)
	}

	// ---------------------------------------------------------------------------
	// Submit
	// ---------------------------------------------------------------------------

	private _submit() {
		const fields: PivotFieldDef[] = []
		for (const [name, area] of this.fieldAreas) {
			if (area === 'none') continue
			const colIndex = this.allHeaders.indexOf(name)
			if (colIndex === -1) continue
			// Determine actual source_col from the source range
			const rangeStart = this._parseSourceRangeStartCol()
			fields.push({
				name,
				source_col: rangeStart + colIndex,
				area,
				aggregation: area === 'value' ? (this.fieldAggregation.get(name) ?? 'sum') : undefined,
				group_by: (area === 'row' || area === 'column') ? (this.fieldGroupBy.get(name) ?? 'none') : undefined,
				sort_order: (area === 'row' || area === 'column') ? (this.fieldSortOrder.get(name) ?? 'none') : undefined,
			})
		}

		const filterValuesArr: PivotFilterValueDef[] = []
		for (const [field_name, included_values] of this.filterValues) {
			filterValuesArr.push({ field_name, included_values })
		}

		const destSheet = this.destSheetSelect.value === '__new__'
			? `Pivot_${Date.now()}`
			: this.destSheetSelect.value

		const config: PivotTableDef = {
			name: `PivotTable${this.editIndex != null ? this.editIndex + 1 : ''}`,
			source_sheet: this.sourceSheet,
			source_range: this.sourceRange,
			dest_sheet: destSheet,
			dest_cell: this.destCellInput.value || 'A1',
			fields,
			calc_fields: this.calcFields,
			style_name: this.styleSelect.value,
			show_grand_total_rows: this.showGrandRowsCheck.checked,
			show_grand_total_cols: this.showGrandColsCheck.checked,
			show_subtotals: this.showSubtotalsCheck.checked,
			compact_layout: false,
			filter_values: filterValuesArr,
		}

		const isNew = this.destSheetSelect.value === '__new__'
		if (isNew) {
			(config as PivotTableDef & { _createNewSheet: boolean })._createNewSheet = true
		}

		this.onAction({
			action: this.editIndex != null ? 'update' : 'create',
			config,
			editIndex: this.editIndex,
		})
		this.hide()
	}

	private _parseSourceRangeStartCol(): number {
		const m = this.sourceRange.match(/^([A-Za-z]+)/)
		if (!m) return 0
		let col = 0
		for (const ch of m[1].toUpperCase()) col = col * 26 + (ch.charCodeAt(0) - 64)
		return col - 1
	}

	// ---------------------------------------------------------------------------
	// Helpers
	// ---------------------------------------------------------------------------

	private _btn(label: string, bg: string): HTMLButtonElement {
		const btn = document.createElement('button')
		btn.textContent = label
		btn.style.cssText = `background:${bg};color:#fff;border:none;padding:5px 12px;border-radius:3px;cursor:pointer;font-size:12px;`
		return btn
	}

	private _checkbox(label: string, defaultValue: boolean): HTMLInputElement {
		const wrap = document.createElement('label')
		wrap.style.cssText = 'display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;'
		const cb = document.createElement('input')
		cb.type = 'checkbox'
		cb.checked = defaultValue
		cb.style.cursor = 'pointer'
		const span = document.createElement('span')
		span.textContent = label
		wrap.appendChild(cb)
		wrap.appendChild(span)
		// Return the actual checkbox input; caller accesses parentElement for layout
		Object.defineProperty(cb, '_wrapEl', { value: wrap })
		// Trick: attach parentElement early for layout
		// We'll use a different approach -- store wrap on cb and return cb
		document.createElement('span').appendChild(wrap) // detach trick below
		// Actually just return cb and let caller use cb.parentElement
		return cb
	}

	private _labeledControl(label: string, buildFn: () => HTMLElement): HTMLElement {
		const wrap = document.createElement('div')
		wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;'
		const l = document.createElement('label')
		l.style.cssText = 'font-size:10px;color:#9cdcfe;'
		l.textContent = label
		wrap.appendChild(l)
		wrap.appendChild(buildFn())
		return wrap
	}

	private _makeDraggable(handle: HTMLElement) {
		let startX = 0, startY = 0, origLeft = 0, origTop = 0
		handle.addEventListener('mousedown', (e: MouseEvent) => {
			const rect = this.dialog.getBoundingClientRect()
			startX = e.clientX; startY = e.clientY
			origLeft = rect.left; origTop = rect.top
			this.dialog.style.position = 'absolute'
			this.overlay.style.alignItems = 'flex-start'
			this.overlay.style.justifyContent = 'flex-start'
			this.dialog.style.left = `${origLeft}px`
			this.dialog.style.top = `${origTop}px`
			const onMove = (me: MouseEvent) => {
				this.dialog.style.left = `${origLeft + me.clientX - startX}px`
				this.dialog.style.top = `${origTop + me.clientY - startY}px`
			}
			const onUp = () => {
				document.removeEventListener('mousemove', onMove)
				document.removeEventListener('mouseup', onUp)
			}
			document.addEventListener('mousemove', onMove)
			document.addEventListener('mouseup', onUp)
		})
	}
}

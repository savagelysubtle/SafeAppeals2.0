/**
 * pivotTableEngine.ts -- In-app pivot table computation engine.
 * Computes aggregated output from source cell data based on a PivotTableDef config.
 * Output is a dense 2D grid of PivotOutputCell ready to be written as regular cells.
 */

// ---------------------------------------------------------------------------
// Types (mirror parser.rs structs)
// ---------------------------------------------------------------------------

export interface PivotFieldDef {
	name: string
	source_col: number
	area: 'row' | 'column' | 'value' | 'filter'
	aggregation?: string // 'sum' | 'count' | 'average' | 'min' | 'max' | 'countNums' | 'product'
	group_by?: string // 'none' | 'day' | 'month' | 'quarter' | 'year'
	custom_name?: string
	sort_order?: string // 'asc' | 'desc' | 'none'
	number_format?: string
}

export interface PivotCalcFieldDef {
	name: string
	formula: string // e.g. "'Revenue' - 'Cost'"
}

export interface PivotFilterValueDef {
	field_name: string
	included_values: string[]
}

export interface PivotTableDef {
	name: string
	source_sheet: string
	source_range: string // "A1:F100"
	dest_sheet: string
	dest_cell: string // "A1"
	fields: PivotFieldDef[]
	calc_fields?: PivotCalcFieldDef[]
	style_name?: string
	show_grand_total_rows?: boolean
	show_grand_total_cols?: boolean
	show_subtotals?: boolean
	compact_layout?: boolean
	filter_values?: PivotFilterValueDef[]
}

export interface PivotOutputCell {
	value: string
	dataType: string // 'n' | 's' | 'null'
	style?: Record<string, unknown>
	isHeader?: boolean
	isGrandTotal?: boolean
	isSubtotal?: boolean
	sourceRows?: number[] // row indices in source data (1-based, skipping header)
}

export interface PivotOutput {
	cells: PivotOutputCell[][]
	rowCount: number
	colCount: number
}

// ---------------------------------------------------------------------------
// Date serial helpers (Excel 1900 epoch, including Lotus leap-year bug)
// ---------------------------------------------------------------------------

function serialToDate(serial: number): [number, number, number] {
	// Excel date serial: 1 = Jan 1 1900; 60 = fake Feb 29 1900 (Lotus bug)
	let s = Math.floor(serial)
	if (s <= 0) return [1900, 1, 1]
	if (s === 60) return [1900, 2, 29] // Lotus bug
	if (s < 60) s += 1 // shift for Lotus bug
	// Convert to Julian day number
	const jd = s + 2415018
	const l = jd + 68569
	const n = Math.floor((4 * l) / 146097)
	const lAdj = l - Math.floor((146097 * n + 3) / 4)
	const i = Math.floor((4000 * (lAdj + 1)) / 1461001)
	const lAdj2 = lAdj - Math.floor((1461 * i) / 4) + 31
	const j = Math.floor((80 * lAdj2) / 2447)
	const day = lAdj2 - Math.floor((2447 * j) / 80)
	const lAdj3 = Math.floor(j / 11)
	const month = j + 2 - 12 * lAdj3
	const year = 100 * (n - 49) + i + lAdj3
	return [year, month, day]
}

function groupDateSerial(serial: number, groupBy: string): string {
	const [year, month] = serialToDate(serial)
	if (groupBy === 'year') return String(year)
	if (groupBy === 'quarter') return `Q${Math.ceil(month / 3)} ${year}`
	if (groupBy === 'month') {
		const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
			'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
		return `${MONTHS[month - 1]} ${year}`
	}
	if (groupBy === 'day') {
		return `${year}-${String(month).padStart(2, '0')}-${String(serialToDate(serial)[2]).padStart(2, '0')}`
	}
	return String(serial)
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function aggregate(values: number[], fn: string): number | null {
	if (values.length === 0) return null
	switch (fn) {
		case 'sum': return values.reduce((a, b) => a + b, 0)
		case 'count': return values.length
		case 'average': return values.reduce((a, b) => a + b, 0) / values.length
		case 'min': return Math.min(...values)
		case 'max': return Math.max(...values)
		case 'product': return values.reduce((a, b) => a * b, 1)
		case 'countNums': return values.length // already filtered to numeric
		default: return values.reduce((a, b) => a + b, 0)
	}
}

// ---------------------------------------------------------------------------
// Parse cell ref helper (e.g. "A1" -> {row:0, col:0})
// ---------------------------------------------------------------------------

function parseCellRefZeroBased(ref: string): { row: number; col: number } {
	const m = ref.toUpperCase().match(/^([A-Z]+)(\d+)$/)
	if (!m) return { row: 0, col: 0 }
	let col = 0
	for (const ch of m[1]) col = col * 26 + (ch.charCodeAt(0) - 64)
	return { row: parseInt(m[2]) - 1, col: col - 1 }
}

function parseCellRangeZeroBased(range: string): {
	startRow: number; startCol: number; endRow: number; endCol: number
} {
	const parts = range.split(':')
	if (parts.length === 2) {
		const s = parseCellRefZeroBased(parts[0])
		const e = parseCellRefZeroBased(parts[1])
		return { startRow: s.row, startCol: s.col, endRow: e.row, endCol: e.col }
	}
	const s = parseCellRefZeroBased(parts[0])
	return { startRow: s.row, startCol: s.col, endRow: s.row, endCol: s.col }
}

// ---------------------------------------------------------------------------
// Calculated field evaluation (simple arithmetic over aggregated values)
// ---------------------------------------------------------------------------

function evalCalcField(formula: string, aggregatedRow: Map<string, number | null>): number | null {
	// Replace 'FieldName' references with their values
	let expr = formula.replace(/'([^']+)'/g, (_match, name) => {
		const val = aggregatedRow.get(name)
		return val != null ? String(val) : '0'
	})
	// Safety: only allow math operators and numbers
	if (!/^[\d\s+\-*/().]+$/.test(expr)) return null
	try {
		// eslint-disable-next-line no-new-func
		return Function(`"use strict"; return (${expr})`)() as number
	} catch {
		return null
	}
}

// ---------------------------------------------------------------------------
// Style helpers
// ---------------------------------------------------------------------------

function headerStyle(styleName?: string): Record<string, unknown> {
	if (styleName === 'PivotStyleDark') {
		return { bold: true, fill_color: '#1F3864', text_color: '#FFFFFF', alignment: 'center' }
	}
	if (styleName === 'PivotStyleLight') {
		return { bold: true, fill_color: '#D9E1F2', text_color: '#000000', alignment: 'center' }
	}
	// Default: PivotStyleMedium
	return { bold: true, fill_color: '#4472C4', text_color: '#FFFFFF', alignment: 'center' }
}


function grandTotalStyle(styleName?: string): Record<string, unknown> {
	if (styleName === 'PivotStyleDark') {
		return { bold: true, fill_color: '#1A2D4A', text_color: '#FFFFFF' }
	}
	if (styleName === 'PivotStyleLight') {
		return { bold: true, fill_color: '#9DC3E6' }
	}
	return { bold: true, fill_color: '#2E75B6', text_color: '#FFFFFF' }
}

function altRowStyle(rowIndex: number, styleName?: string): Record<string, unknown> | undefined {
	if (rowIndex % 2 === 1) return undefined
	if (styleName === 'PivotStyleDark') return { fill_color: '#212F3C' }
	if (styleName === 'PivotStyleLight') return { fill_color: '#EEF3FB' }
	return { fill_color: '#EEF3FB' }
}

// ---------------------------------------------------------------------------
// Main computation
// ---------------------------------------------------------------------------

export function computePivotTable(
	sourceData: Record<number, Record<number, { value: string; data_type: string }>>,
	config: PivotTableDef,
	_formulaResults?: Record<string, { display: string; numeric: number | null }>
): PivotOutput {
	const range = parseCellRangeZeroBased(config.source_range)

	// ---- Step 1: Extract headers from row 0 of source range ----
	const headers: string[] = []
	for (let c = range.startCol; c <= range.endCol; c++) {
		const cell = sourceData[range.startRow]?.[c]
		headers.push(cell?.value ?? `Col${c - range.startCol + 1}`)
	}

	// Map field name -> source column index within the range
	const colIndexOfField = new Map<string, number>()
	for (const field of config.fields) {
		colIndexOfField.set(field.name, field.source_col)
	}

	// ---- Step 2: Read data rows (skip header) ----
	interface DataRow { values: string[]; sourceRow: number }
	const dataRows: DataRow[] = []
	for (let r = range.startRow + 1; r <= range.endRow; r++) {
		const rowData = sourceData[r]
		if (!rowData) continue
		const values: string[] = []
		for (let c = range.startCol; c <= range.endCol; c++) {
			values.push(rowData[c]?.value ?? '')
		}
		// Skip completely empty rows
		if (values.every(v => v === '')) continue
		dataRows.push({ values, sourceRow: r - range.startRow })
	}

	// ---- Step 3: Apply filters ----
	const filterMap = new Map<string, Set<string>>()
	for (const fv of (config.filter_values ?? [])) {
		filterMap.set(fv.field_name, new Set(fv.included_values.map(v => v.toLowerCase())))
	}

	const filteredRows = dataRows.filter(row => {
		for (const [fieldName, allowed] of filterMap) {
			const field = config.fields.find(f => f.name === fieldName)
			if (!field) continue
			const colOffset = field.source_col - range.startCol
			const val = row.values[colOffset] ?? ''
			if (!allowed.has(val.toLowerCase())) return false
		}
		return true
	})

	// ---- Step 4: Separate fields by area ----
	const rowFields = config.fields.filter(f => f.area === 'row')
	const colFields = config.fields.filter(f => f.area === 'column')
	const valueFields = config.fields.filter(f => f.area === 'value')
	const calcFieldDefs = config.calc_fields ?? []

	// All value column names (regular + calculated)
	const valueColNames = [
		...valueFields.map(f => f.custom_name ?? `${f.aggregation ?? 'Sum'} of ${f.name}`),
		...calcFieldDefs.map(f => f.name),
	]

	// ---- Step 5: Collect cell value for a field from a data row ----
	function getFieldValue(row: DataRow, field: PivotFieldDef): string {
		const colOffset = field.source_col - range.startCol
		let val = row.values[colOffset] ?? ''
		// Date grouping
		if (field.group_by && field.group_by !== 'none') {
			const num = parseFloat(val)
			if (!isNaN(num)) {
				val = groupDateSerial(num, field.group_by)
			}
		}
		return val
	}

	// ---- Step 6: Build unique row-group keys and column-group keys ----
	// A "group key" is a tuple of field values for all fields in that area.

	type GroupKey = string[] // one entry per field in area
	function keyStr(key: GroupKey): string { return key.join('\u0000') }

	const rowGroupOrder: string[] = [] // ordered unique row keys
	const rowGroupSet = new Set<string>()

	const colGroupOrder: string[] = []
	const colGroupSet = new Set<string>()

	for (const row of filteredRows) {
		if (rowFields.length > 0) {
			const k = keyStr(rowFields.map(f => getFieldValue(row, f)))
			if (!rowGroupSet.has(k)) { rowGroupSet.add(k); rowGroupOrder.push(k) }
		}
		if (colFields.length > 0) {
			const k = keyStr(colFields.map(f => getFieldValue(row, f)))
			if (!colGroupSet.has(k)) { colGroupSet.add(k); colGroupOrder.push(k) }
		}
	}

	// If no row fields, use a single implicit group
	const effectiveRowKeys = rowGroupOrder.length > 0 ? rowGroupOrder : ['']
	// If no col fields, use a single implicit group
	const effectiveColKeys = colGroupOrder.length > 0 ? colGroupOrder : ['']

	// Sort if requested
	function sortKeys(keys: string[], field?: PivotFieldDef): string[] {
		if (!field || field.sort_order === 'none') return keys
		const sorted = [...keys].sort()
		return field.sort_order === 'desc' ? sorted.reverse() : sorted
	}
	const sortedRowKeys = sortKeys(effectiveRowKeys, rowFields[0])
	const sortedColKeys = sortKeys(effectiveColKeys, colFields[0])

	// ---- Step 7: Aggregate values for each (rowKey, colKey) intersection ----
	// Map: rowKey -> colKey -> valueFieldIndex -> number[]
	const accumulator = new Map<string, Map<string, number[][]>>()

	for (const row of filteredRows) {
		const rk = rowFields.length > 0
			? keyStr(rowFields.map(f => getFieldValue(row, f)))
			: ''
		const ck = colFields.length > 0
			? keyStr(colFields.map(f => getFieldValue(row, f)))
			: ''

		if (!accumulator.has(rk)) accumulator.set(rk, new Map())
		const byCol = accumulator.get(rk)!
		if (!byCol.has(ck)) {
			byCol.set(ck, valueFields.map(() => []))
		}
		const numArrays = byCol.get(ck)!

		for (let vi = 0; vi < valueFields.length; vi++) {
			const vf = valueFields[vi]
			const colOffset = vf.source_col - range.startCol
			const rawVal = row.values[colOffset] ?? ''
			const num = parseFloat(rawVal)
			if (!isNaN(num)) {
				numArrays[vi].push(num)
			}
		}
	}

	// ---- Step 8: Build output grid ----
	// Layout:
	//   Row 0: column field headers (one row per colField level) + value col names
	//   Then data rows, one per row group key
	//   Grand total row at bottom (if enabled)
	//
	// Columns:
	//   0..rowFields.length-1: row field header cells
	//   then for each colKey: valueFields.length columns
	//   Last: grand total columns (if enabled)

	const numColGroups = sortedColKeys.length
	const numValueCols = valueColNames.length
	const numRowFieldCols = Math.max(rowFields.length, 1)

	// Number of header rows = max(1, colFields.length)
	const numHeaderRows = Math.max(1, colFields.length)

	const totalCols = numRowFieldCols + numColGroups * numValueCols +
		(config.show_grand_total_cols ? numValueCols : 0)

	const outRows: PivotOutputCell[][] = []

	// Helper to create empty cell
	function emptyCell(): PivotOutputCell { return { value: '', dataType: 'null' } }

	// ---- Header rows ----
	for (let hi = 0; hi < numHeaderRows; hi++) {
		const headerRow: PivotOutputCell[] = []
		// Row field header label(s)
		for (let rf = 0; rf < numRowFieldCols; rf++) {
			if (hi === numHeaderRows - 1 && rf < rowFields.length) {
				headerRow.push({
					value: rowFields[rf].custom_name ?? rowFields[rf].name,
					dataType: 's',
					isHeader: true,
					style: headerStyle(config.style_name),
				})
			} else {
				headerRow.push({ ...emptyCell(), isHeader: true, style: headerStyle(config.style_name) })
			}
		}
		// Column group cells
		for (const ck of sortedColKeys) {
			const colKeyParts = ck.split('\u0000')
			for (let vi = 0; vi < numValueCols; vi++) {
				// Show column field value in top header rows, value col name in last
				let label: string
				if (numColGroups === 1 && ck === '') {
					// No column grouping -- just show value col name
					label = hi === numHeaderRows - 1 ? valueColNames[vi] : ''
				} else if (hi < colFields.length) {
					label = vi === 0 ? (colKeyParts[hi] ?? '') : ''
				} else {
					label = valueColNames[vi]
				}
				headerRow.push({
					value: label,
					dataType: 's',
					isHeader: true,
					style: headerStyle(config.style_name),
				})
			}
		}
		// Grand total column header
		if (config.show_grand_total_cols) {
			for (let vi = 0; vi < numValueCols; vi++) {
				headerRow.push({
					value: hi === numHeaderRows - 1 ? `Grand Total (${valueColNames[vi]})` : '',
					dataType: 's',
					isHeader: true,
					style: grandTotalStyle(config.style_name),
				})
			}
		}
		outRows.push(headerRow)
	}

	// ---- Data rows ----
	let dataRowIndex = 0
	for (const rk of sortedRowKeys) {
		const rowKeyParts = rk.split('\u0000')
		const dataRow: PivotOutputCell[] = []
		const alt = altRowStyle(dataRowIndex, config.style_name)

		// Row field value cells
		for (let rf = 0; rf < numRowFieldCols; rf++) {
			dataRow.push({
				value: rowKeyParts[rf] ?? '',
				dataType: 's',
				style: alt,
			})
		}

		// For grand total row tracking
		const grandTotals: number[][] = valueFields.map(() => [])

		// Column group value cells
		for (const ck of sortedColKeys) {
			const byCol = accumulator.get(rk)
			const numArrays = byCol?.get(ck) ?? valueFields.map(() => [])

			// Collect aggregated values for this (rk, ck)
			const aggValues: (number | null)[] = []
			for (let vi = 0; vi < valueFields.length; vi++) {
				const result = aggregate(numArrays[vi], valueFields[vi].aggregation ?? 'sum')
				aggValues.push(result)
				// Accumulate grand total
				if (result != null) grandTotals[vi].push(result)
			}

			// Calculated fields
			const aggMap = new Map<string, number | null>()
			for (let vi = 0; vi < valueFields.length; vi++) {
				aggMap.set(valueFields[vi].name, aggValues[vi])
			}
			const calcValues: (number | null)[] = calcFieldDefs.map(cf => evalCalcField(cf.formula, aggMap))

			const allValues = [...aggValues, ...calcValues]
			for (let vi = 0; vi < numValueCols; vi++) {
				const v = allValues[vi]
				dataRow.push({
					value: v != null ? String(Math.round(v * 1e10) / 1e10) : '',
					dataType: v != null ? 'n' : 'null',
					style: alt,
				})
			}
		}

		// Grand total columns
		if (config.show_grand_total_cols) {
			for (let vi = 0; vi < valueFields.length; vi++) {
				const gt = aggregate(grandTotals[vi], valueFields[vi].aggregation ?? 'sum')
				dataRow.push({
					value: gt != null ? String(Math.round(gt * 1e10) / 1e10) : '',
					dataType: gt != null ? 'n' : 'null',
					isGrandTotal: true,
					style: grandTotalStyle(config.style_name),
				})
			}
			// Calc fields grand totals
			for (const _cf of calcFieldDefs) {
				dataRow.push({ value: '', dataType: 'null', isGrandTotal: true, style: grandTotalStyle(config.style_name) })
			}
		}

		outRows.push(dataRow)
		dataRowIndex++
	}

	// ---- Grand total row ----
	if (config.show_grand_total_rows && sortedRowKeys.length > 0) {
		const gtRow: PivotOutputCell[] = []
		// Row label
		for (let rf = 0; rf < numRowFieldCols; rf++) {
			gtRow.push({
				value: rf === 0 ? 'Grand Total' : '',
				dataType: 's',
				isGrandTotal: true,
				style: grandTotalStyle(config.style_name),
			})
		}
		// Grand totals per column group
		for (const ck of sortedColKeys) {
			for (let vi = 0; vi < valueFields.length; vi++) {
				// Collect all values for this column group across all row groups
				const allNums: number[] = []
				for (const rk of sortedRowKeys) {
					const numArrays = accumulator.get(rk)?.get(ck) ?? []
					for (const n of (numArrays[vi] ?? [])) allNums.push(n)
				}
				const gt = aggregate(allNums, valueFields[vi].aggregation ?? 'sum')
				gtRow.push({
					value: gt != null ? String(Math.round(gt * 1e10) / 1e10) : '',
					dataType: gt != null ? 'n' : 'null',
					isGrandTotal: true,
					style: grandTotalStyle(config.style_name),
				})
			}
			// Calc fields
			for (const _cf of calcFieldDefs) {
				gtRow.push({ value: '', dataType: 'null', isGrandTotal: true, style: grandTotalStyle(config.style_name) })
			}
		}
		// Grand total of grand totals
		if (config.show_grand_total_cols) {
			for (let vi = 0; vi < valueFields.length; vi++) {
				const allNums: number[] = []
				for (const rk of sortedRowKeys) {
					for (const ck of sortedColKeys) {
						const numArrays = accumulator.get(rk)?.get(ck) ?? []
						for (const n of (numArrays[vi] ?? [])) allNums.push(n)
					}
				}
				const gt = aggregate(allNums, valueFields[vi].aggregation ?? 'sum')
				gtRow.push({
					value: gt != null ? String(Math.round(gt * 1e10) / 1e10) : '',
					dataType: gt != null ? 'n' : 'null',
					isGrandTotal: true,
					style: grandTotalStyle(config.style_name),
				})
			}
			for (const _cf of calcFieldDefs) {
				gtRow.push({ value: '', dataType: 'null', isGrandTotal: true, style: grandTotalStyle(config.style_name) })
			}
		}
		outRows.push(gtRow)
	}

	const rowCount = outRows.length
	const colCount = totalCols

	// Pad all rows to the same width
	for (const row of outRows) {
		while (row.length < colCount) row.push(emptyCell())
	}

	return { cells: outRows, rowCount, colCount }
}

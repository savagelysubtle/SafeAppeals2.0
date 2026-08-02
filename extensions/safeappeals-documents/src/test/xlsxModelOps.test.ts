/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	buildChartDefinition,
	cellDisplayValue,
	cellStyleToModelStyle,
	extractWorkbookAgentContext,
	extractWorkbookText,
	formatOpToStyle,
	formatWorkbookReadOutput,
	getColName,
	mergeFormulaResultsIntoSheet,
	normalizeFormula,
	parseCellRange,
	parseCellRef,
	resolveChartData,
	resolveSheetIndex,
	type ChartDefinition,
	type WorkbookModel,
	type WorkbookSheet,
} from '../xlsx/xlsxModelOps';

suite('xlsxModelOps', () => {
	test('normalizeFormula trims and ensures leading =', () => {
		assert.deepStrictEqual(
			{
				plain: normalizeFormula('SUM(A1:A2)'),
				withEquals: normalizeFormula('=SUM(A1:A2)'),
				padded: normalizeFormula('  AVERAGE(B1:B3)  '),
				paddedEquals: normalizeFormula('  =A1+B1  '),
			},
			{
				plain: '=SUM(A1:A2)',
				withEquals: '=SUM(A1:A2)',
				padded: '=AVERAGE(B1:B3)',
				paddedEquals: '=A1+B1',
			},
		);
	});

	test('A1 parsing, sheet index, and col names', () => {
		const model: WorkbookModel = {
			sheets: [
				{ name: 'Sheet1', cells: {}, row_count: 0, col_count: 0 },
				{ name: 'Data', cells: {}, row_count: 0, col_count: 0 },
			],
		};
		assert.deepStrictEqual(
			{
				a1: parseCellRef('A1'),
				sheetPrefixed: parseCellRef('Data!$B$3'),
				range: parseCellRange('A1:B2'),
				sheet0: resolveSheetIndex(model, undefined),
				sheetData: resolveSheetIndex(model, 'Data'),
				sheetBad: resolveSheetIndex(model, 'Nope'),
				colAA: getColName(26),
			},
			{
				a1: { row: 0, col: 0 },
				sheetPrefixed: { row: 2, col: 1 },
				range: { startRow: 0, startCol: 0, endRow: 1, endCol: 1 },
				sheet0: 0,
				sheetData: 1,
				sheetBad: -1,
				colAA: 'AA',
			},
		);
	});

	test('formatOpToStyle and cellStyleToModelStyle mapping', () => {
		const overlay = formatOpToStyle({
			bold: true,
			fontSize: 14,
			fillColor: '#ff0000',
			backgroundColor: '#00ff00',
			alignment: 'center',
			numberFormat: '0.00',
			wrapText: true,
		});
		assert.deepStrictEqual(
			{
				overlay,
				model: cellStyleToModelStyle(overlay, { italic: true }),
			},
			{
				overlay: {
					bold: true,
					fontSize: 14,
					fillColor: '#00ff00',
					alignment: 'center',
					numberFormat: '0.00',
					wrapText: true,
				},
				model: {
					italic: true,
					bold: true,
					font_size: 14,
					fill_color: '#00ff00',
					alignment: 'center',
					number_format: '0.00',
					wrap_text: true,
				},
			},
		);
	});

	test('resolveChartData and extractWorkbookText', () => {
		const sheet: WorkbookSheet = {
			name: 'Sheet1',
			cells: {
				'0': {
					'0': { value: 'Score', data_type: 's' },
					'1': { value: 'Amt', data_type: 's' },
				},
				'1': {
					'0': { value: 'A', data_type: 's' },
					'1': { value: '10', data_type: 'n' },
				},
				'2': {
					'0': { value: 'B', data_type: 's' },
					'1': { value: '20', data_type: 'n' },
				},
			},
			row_count: 3,
			col_count: 2,
			charts: [],
		};
		const chart: ChartDefinition = {
			chart_type: 'column',
			series: [{ values_ref: 'A1:B3', categories_cache: [], values_cache: [] }],
			axes: [
				{ axis_type: 'category', position: 'bottom' },
				{ axis_type: 'value', position: 'left' },
			],
			anchor: {
				from_col: 0, from_row: 10, from_col_off: 0, from_row_off: 0,
				to_col: 8, to_row: 25, to_col_off: 0, to_row_off: 0,
			},
		};
		resolveChartData(chart, sheet);
		const built = buildChartDefinition(
			{ chart_type: 'bar', data_range: 'B1:B3', title: 'T' },
			sheet,
		);
		assert.ok(!('error' in built));
		assert.deepStrictEqual(
			{
				cats: chart.series[0].categories_cache,
				vals: chart.series[0].values_cache,
				tsv: extractWorkbookText({ sheets: [sheet] }),
				builtType: (built as ChartDefinition).chart_type,
				builtTitle: (built as ChartDefinition).title,
			},
			{
				cats: ['A', 'B'],
				vals: [10, 20],
				tsv: '# Sheet: Sheet1\nScore\tAmt\nA\t10\nB\t20',
				builtType: 'bar',
				builtTitle: 'T',
			},
		);
	});

	test('mergeFormulaResultsIntoSheet sets formula_result for save/TSV display', () => {
		const sheet: WorkbookSheet = {
			name: 'Sheet1',
			cells: {
				'0': { '0': { value: '1', data_type: 'n' } },
				'1': { '0': { value: '2', data_type: 'n' } },
				'2': { '0': { value: '=SUM(A1:A2)', data_type: 'f' } },
			},
			row_count: 3,
			col_count: 1,
		};
		const merged = mergeFormulaResultsIntoSheet(sheet, {
			'2:0': { display: '3', is_error: false, numeric: 3 },
			'0:0': { display: '1', is_error: false, numeric: 1 }, // non-formula ignored
		});
		assert.deepStrictEqual(
			{
				merged,
				formula_result: sheet.cells['2']['0'].formula_result,
				value: sheet.cells['2']['0'].value,
				data_type: sheet.cells['2']['0'].data_type,
				display: cellDisplayValue(sheet.cells['2']['0']),
				tsv: extractWorkbookText({ sheets: [sheet] }),
			},
			{
				merged: 1,
				formula_result: '3',
				value: '=SUM(A1:A2)',
				data_type: 'f',
				display: '3',
				tsv: '# Sheet: Sheet1\n1\n2\n3',
			},
		);
	});

	test('extractWorkbookAgentContext surfaces tables, styles, formulas, charts', () => {
		const sheet: WorkbookSheet = {
			name: 'Sheet1',
			cells: {
				'0': {
					'0': {
						value: 'Name',
						data_type: 's',
						style: { bold: true, fill_color: '#ffcc00' },
					},
					'1': {
						value: 'Score',
						data_type: 's',
						style: { bold: true, fill_color: '#ffcc00' },
					},
				},
				'1': {
					'0': { value: 'Ada', data_type: 's' },
					'1': { value: '42', data_type: 'n', style: { number_format: '0.00' } },
				},
				'2': {
					'0': { value: 'Bob', data_type: 's' },
					'1': { value: '7', data_type: 'n' },
				},
				'3': {
					'0': { value: '=SUM(B2:B3)', data_type: 'f', formula_result: '49' },
				},
			},
			row_count: 4,
			col_count: 2,
			tables: [{
				name: 'People',
				display_name: 'People',
				range: { start_row: 0, start_col: 0, end_row: 2, end_col: 1 },
				columns: [{ name: 'Name', col_index: 0 }, { name: 'Score', col_index: 1 }],
				has_header_row: true,
				has_totals_row: false,
				style_name: 'TableStyleMedium2',
				filter_enabled: true,
			}],
			charts: [{
				chart_type: 'column',
				title: 'Scores',
				series: [{
					values_ref: 'B2:B3',
					categories_ref: 'A2:A3',
					categories_cache: [],
					values_cache: [],
				}],
				axes: [],
				anchor: {
					from_col: 3, from_row: 1, from_col_off: 0, from_row_off: 0,
					to_col: 11, to_row: 16, to_col_off: 0, to_row_off: 0,
				},
			}],
		};
		const ctx = extractWorkbookAgentContext({ sheets: [sheet] });
		const s0 = ctx.sheets[0];
		assert.deepStrictEqual(
			{
				sheetNames: ctx.sheetNames,
				usedRange: s0.usedRange,
				table: s0.tables[0],
				chart: s0.charts[0],
				formula: s0.formulas.find(f => f.cell === 'A4'),
				headerStyle: s0.styledCells.find(c => c.cell === 'A1')?.style,
				numberFormat: s0.styledCells.find(c => c.cell === 'B2')?.style?.number_format,
			},
			{
				sheetNames: ['Sheet1'],
				usedRange: 'A1:B4',
				table: {
					name: 'People',
					range: 'A1:B3',
					columns: ['Name', 'Score'],
					styleName: 'TableStyleMedium2',
					hasHeaderRow: true,
					hasTotalsRow: false,
					filterEnabled: true,
				},
				chart: {
					index: 0,
					chartType: 'column',
					title: 'Scores',
					dataRange: 'B2:B3',
					categoriesRef: 'A2:A3',
					anchor: 'D2',
				},
				formula: { cell: 'A4', formula: '=SUM(B2:B3)', display: '49' },
				headerStyle: { bold: true, fill_color: '#ffcc00' },
				numberFormat: '0.00',
			},
		);

		const combined = formatWorkbookReadOutput({ sheets: [sheet] });
		assert.ok(combined.includes('--- Workbook structure (JSON) ---'));
		assert.ok(combined.includes('--- Cell values (TSV) ---'));
		assert.ok(combined.includes('"name": "People"'));
		assert.ok(combined.includes('Ada\t42'));
	});
});

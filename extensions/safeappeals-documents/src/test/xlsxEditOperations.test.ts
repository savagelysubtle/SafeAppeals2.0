/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	describeXlsxEditOperations,
	findUnsupportedXlsxEditOpTypes,
	normalizeXlsxEditOperation,
	normalizeXlsxEditOperations,
	SUPPORTED_XLSX_EDIT_OP_TYPES,
} from '../xlsx/xlsxEditOperations';

suite('xlsxEditOperations', () => {
	test('normalize aliases format_cells and camelCase chart fields', () => {
		assert.deepStrictEqual(
			normalizeXlsxEditOperations([
				{ type: 'format_cells', range: 'A1:B2', format: { bold: true } },
				{
					type: 'create_chart',
					chartType: 'bar',
					dataRange: 'A1:B10',
					chartIndex: 0,
					title: 'Sales',
				},
				{ type: 'insert_chart', chart_type: 'line', data_range: 'C1:C5' },
				'not-an-object',
			]),
			[
				{ type: 'format_range', range: 'A1:B2', format: { bold: true } },
				{
					type: 'create_chart',
					chart_type: 'bar',
					data_range: 'A1:B10',
					chart_index: 0,
					title: 'Sales',
				},
				{ type: 'insert_chart', chart_type: 'line', data_range: 'C1:C5' },
				'not-an-object',
			],
		);
	});

	test('describe and unsupported detection cover supported list', () => {
		const normalized = normalizeXlsxEditOperation({ type: 'format_cells', range: 'A1:A2' });
		assert.deepStrictEqual(
			{
				supportedIncludesCreateChart: SUPPORTED_XLSX_EDIT_OP_TYPES.includes('create_chart'),
				supportedIncludesFormatRange: SUPPORTED_XLSX_EDIT_OP_TYPES.includes('format_range'),
				supportedIncludesResizeTable: SUPPORTED_XLSX_EDIT_OP_TYPES.includes('resize_table'),
				describeMentionsCreateChart: describeXlsxEditOperations().includes('create_chart'),
				formatCellsBecomesRange: (normalized as { type: string }).type,
				unsupported: findUnsupportedXlsxEditOpTypes([
					{ type: 'format_range' },
					{ type: 'create_chart' },
					{ type: 'explode_sheet' },
					{ type: 'explode_sheet' },
				]),
			},
			{
				supportedIncludesCreateChart: true,
				supportedIncludesFormatRange: true,
				supportedIncludesResizeTable: true,
				describeMentionsCreateChart: true,
				formatCellsBecomesRange: 'format_range',
				unsupported: ['explode_sheet'],
			},
		);
	});
});

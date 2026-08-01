/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import JSZip from 'jszip';
import {
	createXlsxBuffer,
	normalizeSheets,
	sanitizeSheetName,
	tsvToRows,
} from '../xlsx/xlsxWriter';

suite('xlsxWriter', () => {
	test('tsvToRows splits tabs and newlines', () => {
		assert.deepStrictEqual(
			{
				basic: tsvToRows('a\tb\nc\td'),
				empty: tsvToRows(''),
				trailing: tsvToRows('x\ty\n'),
				single: tsvToRows('only'),
			},
			{
				basic: [['a', 'b'], ['c', 'd']],
				empty: [],
				trailing: [['x', 'y']],
				single: [['only']],
			},
		);
	});

	test('sanitizeSheetName strips invalid chars and caps length', () => {
		assert.deepStrictEqual(
			{
				invalid: sanitizeSheetName('A/B\\C?D*E[F]G', 'Sheet1'),
				long: sanitizeSheetName('x'.repeat(40), 'Sheet1').length,
				empty: sanitizeSheetName('   ', 'Sheet1'),
			},
			{
				invalid: 'ABCDEFG',
				long: 31,
				empty: 'Sheet1',
			},
		);
	});

	test('normalizeSheets unique names and empty default', () => {
		assert.deepStrictEqual(
			{
				empty: normalizeSheets({}).map(s => s.name),
				dupes: normalizeSheets({
					sheets: [{ name: 'Data' }, { name: 'Data' }],
				}).map(s => s.name),
				topLevel: normalizeSheets({
					sheetName: 'Summary',
					tsv: 'a\tb',
				}).map(s => ({ name: s.name, rows: s.rows })),
			},
			{
				empty: ['Sheet1'],
				dupes: ['Data', 'Data (2)'],
				topLevel: [{ name: 'Summary', rows: [['a', 'b']] }],
			},
		);
	});

	test('createXlsxBuffer produces zip with workbook and worksheet', async () => {
		const bytes = await createXlsxBuffer({
			sheets: [{
				name: 'Numbers',
				rows: [['Name', 'Score'], ['Ada', 42], ['Bob', 3.5]],
			}],
		});
		const zip = await JSZip.loadAsync(bytes);
		const workbook = await zip.file('xl/workbook.xml')?.async('string');
		const sheet = await zip.file('xl/worksheets/sheet1.xml')?.async('string');
		assert.ok(workbook, 'missing xl/workbook.xml');
		assert.ok(sheet, 'missing xl/worksheets/sheet1.xml');
		assert.ok(workbook.includes('name="Numbers"'), 'sheet name missing from workbook');
		assert.ok(sheet.includes('t="inlineStr"'), 'expected inlineStr cells');
		assert.ok(sheet.includes('<v>42</v>'), 'expected numeric cell');
		assert.ok(sheet.includes('Ada'), 'expected string cell');
	});
});

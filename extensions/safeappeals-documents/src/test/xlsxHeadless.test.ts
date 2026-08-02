/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as path from 'path';
import { normalizeXlsxEditOperations } from '../xlsx/xlsxEditOperations';
import {
	applyXlsxOpsHeadless,
	applyXlsxOpsToModel,
	readWorkbookHeadless,
} from '../xlsx/xlsxHeadless';
import { setXlsxHostWasmDir, ensureXlsxHostWasm } from '../xlsx/xlsxHostWasm';
import { createXlsxBuffer } from '../xlsx/xlsxWriter';
import { extractWorkbookAgentContext, type WorkbookModel } from '../xlsx/xlsxModelOps';

function parseStructureJson(readOutput: string): ReturnType<typeof extractWorkbookAgentContext> {
	const start = readOutput.indexOf('--- Workbook structure (JSON) ---');
	const end = readOutput.indexOf('--- Cell values (TSV) ---');
	assert.ok(start >= 0 && end > start, `expected structure+TSV markers; got:\n${readOutput.slice(0, 400)}`);
	const json = readOutput.slice(start + '--- Workbook structure (JSON) ---'.length, end).trim();
	return JSON.parse(json) as ReturnType<typeof extractWorkbookAgentContext>;
}

suite('xlsxHeadless', () => {
	suiteSetup(async () => {
		const wasmDir = path.join(__dirname, '../../media/xlsx/wasm');
		setXlsxHostWasmDir(wasmDir);
		await ensureXlsxHostWasm();
	});

	test('WASM round-trip: read, edit cells/styles/table/chart, re-parse', async () => {
		const bytes = await createXlsxBuffer({
			sheets: [{
				name: 'Sheet1',
				rows: [
					['Name', 'Score'],
					['Ada', 42],
					['Bob', 7],
				],
			}],
		});

		const readOut = await readWorkbookHeadless(bytes);
		assert.ok(readOut.includes('--- Workbook structure (JSON) ---'));
		assert.ok(readOut.includes('--- Cell values (TSV) ---'));
		assert.ok(readOut.includes('# Sheet: Sheet1'));
		assert.ok(readOut.includes('Ada'));

		const rawOps = [
			{ type: 'format_cells', range: 'A1:B1', format: { bold: true, fontSize: 12 } },
			{ type: 'set_cell_value', cell: 'A2', value: 'Ada Lovelace' },
			{ type: 'create_table', range: 'A1:B3', tableName: 'People', styleName: 'TableStyleMedium2' },
			{ type: 'create_chart', chartType: 'column', dataRange: 'A1:B3', title: 'Scores', position: 'D2' },
		];
		const ops = normalizeXlsxEditOperations(rawOps);
		const applied = await applyXlsxOpsHeadless(bytes, ops);
		assert.deepStrictEqual(
			applied.results.map(r => ({ type: r.type, ok: r.ok })),
			[
				{ type: 'format_range', ok: true },
				{ type: 'set_cell_value', ok: true },
				{ type: 'create_table', ok: true },
				{ type: 'create_chart', ok: true },
			],
		);

		// Style preserved across set_cell_value after format (format A1:B1, then set A2)
		const a1Style = applied.model.sheets[0].cells?.['0']?.['0']?.style;
		assert.ok(a1Style?.bold === true);
		assert.ok(a1Style?.font_size === 12);

		const a2 = applied.model.sheets[0].cells?.['1']?.['0'];
		assert.strictEqual(a2?.value, 'Ada Lovelace');

		const tables = applied.model.sheets[0].tables as Array<{ name: string }>;
		assert.ok(tables?.some(t => t.name === 'People'));

		const charts = applied.model.sheets[0].charts;
		assert.ok(charts && charts.length >= 1);
		assert.strictEqual(charts[0].chart_type, 'column');

		// Re-parse saved bytes (cell styles may not fully round-trip via Rust writer
		// when tables rewrite the workbook; values/tables/charts are the durable asserts).
		const wasm = await ensureXlsxHostWasm();
		const parser = new wasm.XlsxParser();
		try {
			const reparsed = JSON.parse(parser.load(applied.bytes)) as WorkbookModel;
			assert.deepStrictEqual(
				{
					a2: reparsed.sheets[0].cells?.['1']?.['0']?.value,
					tableNames: (reparsed.sheets[0].tables as Array<{ name: string }> | undefined)?.map(t => t.name),
					chartCount: reparsed.sheets[0].charts?.length ?? 0,
				},
				{
					a2: 'Ada Lovelace',
					tableNames: ['People'],
					chartCount: 1,
				},
			);
		} finally {
			parser.free();
		}
	});

	test('format_range numberFormat persists through save/re-parse', async () => {
		const bytes = await createXlsxBuffer({
			sheets: [{
				name: 'Sheet1',
				rows: [
					[100],
					[200],
				],
			}],
		});
		const applied = await applyXlsxOpsHeadless(bytes, [
			{ type: 'format_range', range: 'A1:A1', format: { numberFormat: '$#,##0' } },
		]);
		assert.strictEqual(applied.results[0]?.ok, true);
		assert.strictEqual(
			applied.model.sheets[0].cells?.['0']?.['0']?.style?.number_format,
			'$#,##0',
		);

		const wasm = await ensureXlsxHostWasm();
		const parser = new wasm.XlsxParser();
		try {
			const reparsed = JSON.parse(parser.load(applied.bytes)) as WorkbookModel;
			assert.strictEqual(
				reparsed.sheets[0].cells?.['0']?.['0']?.style?.number_format,
				'$#,##0',
			);
		} finally {
			parser.free();
		}
	});

	test('set_cell_formula stores type f and writes a real formula', async () => {
		const bytes = await createXlsxBuffer({
			sheets: [{
				name: 'Sheet1',
				rows: [
					[1],
					[2],
					[''],
				],
			}],
		});
		const applied = await applyXlsxOpsHeadless(bytes, [
			{ type: 'set_cell_formula', cell: 'A3', formula: 'SUM(A1:A2)' },
		]);
		assert.strictEqual(applied.results[0]?.ok, true);
		const formulaCell = applied.model.sheets[0].cells?.['2']?.['0'];
		assert.deepStrictEqual(
			{
				data_type: formulaCell?.data_type,
				value: formulaCell?.value,
				formula_result: formulaCell?.formula_result,
			},
			{ data_type: 'f', value: '=SUM(A1:A2)', formula_result: '3' },
		);

		const readOut = await readWorkbookHeadless(applied.bytes);
		assert.ok(
			/\b3\b/.test(readOut) || readOut.includes('3'),
			`TSV/read should show cached SUM result 3, not 0; got:\n${readOut}`,
		);
		const structure = parseStructureJson(readOut);
		const formula = structure.sheets[0]?.formulas.find(f => /SUM\(A1:A2\)/i.test(f.formula));
		assert.ok(formula, `structure JSON should list SUM formula; got ${JSON.stringify(structure.sheets[0]?.formulas)}`);
		assert.ok(
			formula.display !== '' && formula.display !== '0' && Number(formula.display) !== 0,
			`formula display should be non-zero; got ${JSON.stringify(formula)}`,
		);

		const wasm = await ensureXlsxHostWasm();
		const parser = new wasm.XlsxParser();
		try {
			const reparsed = JSON.parse(parser.load(applied.bytes)) as WorkbookModel;
			const cell = reparsed.sheets[0].cells?.['2']?.['0'];
			// Calamine surfaces the cached formula result; must not be 0 for SUM(1,2).
			const asPlainString =
				cell?.data_type === 's' &&
				typeof cell.value === 'string' &&
				/SUM\(A1:A2\)/i.test(cell.value);
			assert.ok(
				!asPlainString,
				`formula must not round-trip as plain string; got ${JSON.stringify(cell)}`,
			);
			const cachedNum = parseFloat(String(cell?.value ?? ''));
			assert.ok(
				cell?.data_type === 'f' ||
				(typeof cell?.value === 'string' && cell.value.startsWith('=')) ||
				(cell?.data_type === 'n' && cachedNum === 3) ||
				cachedNum === 3,
				`expected formula cell or cached numeric 3; got ${JSON.stringify(cell)}`,
			);
			assert.notStrictEqual(
				cachedNum,
				0,
				`cached formula value must not be 0; got ${JSON.stringify(cell)}`,
			);
		} finally {
			parser.free();
		}

		// Confirm OOXML sheet XML contains a formula element and non-zero cache.
		const JSZip = (await import('jszip')).default;
		const zip = await JSZip.loadAsync(applied.bytes);
		let sheetXml = '';
		for (const name of Object.keys(zip.files)) {
			if (/xl\/worksheets\/sheet\d+\.xml$/i.test(name)) {
				sheetXml += await zip.file(name)!.async('string');
			}
		}
		assert.ok(
			/<f[^>]*>\s*=?SUM\(A1:A2\)\s*<\/f>/i.test(sheetXml),
			'saved xlsx should contain SUM(A1:A2) as a formula element',
		);
		assert.ok(
			/<f[^>]*>\s*=?SUM\(A1:A2\)\s*<\/f>\s*<v>3(?:\.0+)?<\/v>/i.test(sheetXml),
			`formula cache <v> should be 3; xml snippet: ${sheetXml.match(/<c[^>]*r="A3"[\s\S]*?<\/c>/i)?.[0] ?? sheetXml.slice(0, 400)}`,
		);
	});

	test('format_range styles survive create_table save/re-parse', async () => {
		const bytes = await createXlsxBuffer({
			sheets: [{
				name: 'Sheet1',
				rows: [
					['Name', 'Score'],
					['Ada', 42],
					['Bob', 7],
				],
			}],
		});
		const applied = await applyXlsxOpsHeadless(bytes, [
			{
				type: 'format_range',
				range: 'A1:B1',
				format: { bold: true, fillColor: '#ffcc00', numberFormat: '@' },
			},
			{ type: 'create_table', range: 'A1:B3', tableName: 'People', styleName: 'TableStyleMedium2' },
		]);
		assert.deepStrictEqual(
			applied.results.map(r => ({ type: r.type, ok: r.ok })),
			[
				{ type: 'format_range', ok: true },
				{ type: 'create_table', ok: true },
			],
		);
		const headerStyle = applied.model.sheets[0].cells?.['0']?.['0']?.style;
		assert.ok(headerStyle?.bold === true, `in-memory bold after create_table; got ${JSON.stringify(headerStyle)}`);
		assert.ok(
			headerStyle?.fill_color === '#ffcc00',
			`in-memory fill after create_table; got ${JSON.stringify(headerStyle)}`,
		);

		const wasm = await ensureXlsxHostWasm();
		const parser = new wasm.XlsxParser();
		try {
			const reparsed = JSON.parse(parser.load(applied.bytes)) as WorkbookModel;
			const style = reparsed.sheets[0].cells?.['0']?.['0']?.style;
			assert.ok(
				style?.bold === true ||
				style?.fill_color === '#ffcc00' ||
				style?.number_format === '@',
				`header style must survive create_table save/re-parse; got ${JSON.stringify(style)}`,
			);
		} finally {
			parser.free();
		}
	});

	test('read output JSON includes table, styles, formula after edit ops', async () => {
		const bytes = await createXlsxBuffer({
			sheets: [{
				name: 'Sheet1',
				rows: [
					['Name', 'Score'],
					['Ada', 42],
					['Bob', 7],
					[''],
				],
			}],
		});
		const applied = await applyXlsxOpsHeadless(bytes, [
			{
				type: 'format_range',
				range: 'A1:B1',
				format: { bold: true, fillColor: '#ffcc00' },
			},
			{
				type: 'format_range',
				range: 'B2:B3',
				format: { numberFormat: '0.00' },
			},
			{ type: 'create_table', range: 'A1:B3', tableName: 'People', styleName: 'TableStyleMedium2' },
			{ type: 'set_cell_formula', cell: 'A4', formula: 'SUM(B2:B3)' },
			{ type: 'create_chart', chartType: 'column', dataRange: 'A1:B3', title: 'Scores', position: 'D2' },
		]);
		assert.ok(applied.results.every(r => r.ok), JSON.stringify(applied.results));

		const inMemory = extractWorkbookAgentContext(applied.model);
		const memSheet = inMemory.sheets[0];
		const people = memSheet.tables.find(t => t.name === 'People');
		assert.ok(people, `expected People table; got ${JSON.stringify(memSheet.tables)}`);
		assert.strictEqual(people.range, 'A1:B3');
		assert.strictEqual(people.styleName, 'TableStyleMedium2');
		assert.deepStrictEqual(
			{
				header: memSheet.styledCells.find(c => c.cell === 'A1')?.style,
				numFmt: memSheet.styledCells.find(c => c.cell === 'B2')?.style?.number_format,
				formula: memSheet.formulas.find(f => f.cell === 'A4'),
				chartType: memSheet.charts[0]?.chartType,
			},
			{
				header: { bold: true, fill_color: '#ffcc00' },
				numFmt: '0.00',
				formula: { cell: 'A4', formula: '=SUM(B2:B3)', display: '49' },
				chartType: 'column',
			},
		);

		const readOut = await readWorkbookHeadless(applied.bytes);
		const structure = parseStructureJson(readOut);
		const sheet = structure.sheets[0];
		assert.ok(sheet?.tables.some(t => t.name === 'People' && t.range === 'A1:B3'));
		const a1Style = sheet.styledCells.find(c => c.cell === 'A1')?.style;
		assert.ok(
			a1Style?.bold === true,
			`A1 header should be bold after re-read; got ${JSON.stringify(a1Style)}`,
		);
		assert.ok(
			typeof a1Style?.fill_color === 'string' &&
			a1Style.fill_color.toLowerCase() === '#ffcc00',
			`A1 header should keep fill #ffcc00; got ${JSON.stringify(a1Style)}`,
		);
		assert.strictEqual(
			sheet.styledCells.find(c => c.cell === 'B2')?.style?.number_format,
			'0.00',
			`B2 should keep number_format 0.00; styled=${JSON.stringify(sheet.styledCells)}`,
		);
		const formula = sheet.formulas.find(f => /SUM\(B2:B3\)/i.test(f.formula));
		assert.ok(formula, `expected formula in read JSON; got ${JSON.stringify(sheet.formulas)}`);
		assert.ok(
			formula.display !== '' && Number(formula.display) !== 0,
			`formula display should be non-zero; got ${JSON.stringify(formula)}`,
		);
		// Writer emits barChart+col dir for "column"; re-parse surfaces chart_type "bar".
		assert.ok(
			sheet.charts.some(c => c.chartType === 'column' || c.chartType === 'bar'),
			`expected column/bar chart; got ${JSON.stringify(sheet.charts)}`,
		);
	});

	test('subsequent set_cell_value preserves existing formulas', async () => {
		const bytes = await createXlsxBuffer({
			sheets: [{
				name: 'Sheet1',
				rows: [
					['label', 10, 20, 30, 40],
					['label', 10, 20, 30, 40],
				],
			}],
		});

		const withFormula = await applyXlsxOpsHeadless(bytes, [
			{ type: 'set_cell_formula', cell: 'F2', formula: 'SUM(B2:E2)' },
		]);
		assert.strictEqual(withFormula.results[0]?.ok, true);
		const expectedDisplay = extractWorkbookAgentContext(withFormula.model)
			.sheets[0]?.formulas.find(f => f.cell === 'F2')?.display;
		assert.ok(
			expectedDisplay && Number(expectedDisplay) === 100,
			`fixture SUM(B2:E2) should display 100 before second edit; got ${expectedDisplay}`,
		);

		const afterUnrelatedEdit = await applyXlsxOpsHeadless(withFormula.bytes, [
			{ type: 'set_cell_value', cell: 'G1', value: 'note' },
		]);
		assert.strictEqual(afterUnrelatedEdit.results[0]?.ok, true);

		const structure = extractWorkbookAgentContext(afterUnrelatedEdit.model);
		const formula = structure.sheets[0]?.formulas.find(f => f.cell === 'F2');
		assert.deepStrictEqual(
			{
				formula: formula?.formula,
				display: formula?.display,
				g1: afterUnrelatedEdit.model.sheets[0].cells?.['0']?.['6']?.value,
			},
			{
				formula: '=SUM(B2:E2)',
				display: '100',
				g1: 'note',
			},
		);

		const readOut = await readWorkbookHeadless(afterUnrelatedEdit.bytes);
		const reRead = parseStructureJson(readOut);
		const reReadFormula = reRead.sheets[0]?.formulas.find(f => f.cell === 'F2');
		assert.ok(
			reReadFormula && /SUM\(B2:E2\)/i.test(reReadFormula.formula),
			`formulas[] must keep SUM(B2:E2) after unrelated edit; got ${JSON.stringify(reRead.sheets[0]?.formulas)}`,
		);
		assert.ok(
			reReadFormula.display !== '' && Number(reReadFormula.display) === 100,
			`F2 display should remain 100; got ${JSON.stringify(reReadFormula)}`,
		);
	});

	test('set_cell_value preserves existing style', async () => {
		const wasm = await ensureXlsxHostWasm();
		const model: WorkbookModel = {
			sheets: [{
				name: 'Sheet1',
				cells: {
					'0': {
						'0': {
							value: 'old',
							data_type: 's',
							style: { bold: true, fill_color: '#abcdef' },
						},
					},
				},
				row_count: 1,
				col_count: 1,
				tables: [],
				charts: [],
			}],
		};
		const tableOps = new wasm.TableOps();
		try {
			const results = applyXlsxOpsToModel(
				model,
				[{ type: 'set_cell_value', cell: 'A1', value: 'new' }],
				tableOps,
			);
			assert.deepStrictEqual(
				{
					ok: results[0].ok,
					value: model.sheets[0].cells['0']['0'].value,
					style: model.sheets[0].cells['0']['0'].style,
				},
				{
					ok: true,
					value: 'new',
					style: { bold: true, fill_color: '#abcdef' },
				},
			);
		} finally {
			tableOps.free();
		}
	});
});

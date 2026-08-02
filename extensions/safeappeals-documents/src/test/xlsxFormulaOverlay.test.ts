/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import { overlayFormulasFromXlsx } from '../xlsx/xlsxFormulaOverlay';
import { applyXlsxOpsHeadless } from '../xlsx/xlsxHeadless';
import { setXlsxHostWasmDir, ensureXlsxHostWasm } from '../xlsx/xlsxHostWasm';
import { createXlsxBuffer } from '../xlsx/xlsxWriter';
import type { WorkbookModel } from '../xlsx/xlsxModelOps';

suite('xlsxFormulaOverlay', () => {
	suiteSetup(async () => {
		const wasmDir = path.join(__dirname, '../../media/xlsx/wasm');
		setXlsxHostWasmDir(wasmDir);
		await ensureXlsxHostWasm();
	});

	test('restores formula text after calamine parse (cold-load parity)', async () => {
		const bytes = await createXlsxBuffer({
			sheets: [{
				name: 'Sheet1',
				rows: [[1], [2], ['']],
			}],
		});
		const applied = await applyXlsxOpsHeadless(bytes, [
			{ type: 'set_cell_formula', cell: 'A3', formula: 'SUM(A1:A2)' },
		]);
		assert.strictEqual(applied.results[0]?.ok, true);

		const wasm = await ensureXlsxHostWasm();
		const parser = new wasm.XlsxParser();
		try {
			const model = JSON.parse(parser.load(applied.bytes)) as WorkbookModel;
			const before = model.sheets[0].cells?.['2']?.['0'];
			assert.notStrictEqual(
				before?.data_type,
				'f',
				'calamine should not emit data_type f (precondition)',
			);

			const overlaid = await overlayFormulasFromXlsx(applied.bytes, model);
			assert.ok(overlaid >= 1, `expected at least one formula overlay; got ${overlaid}`);
			assert.deepStrictEqual(
				{
					data_type: model.sheets[0].cells?.['2']?.['0']?.data_type,
					value: model.sheets[0].cells?.['2']?.['0']?.value,
					formula_result: model.sheets[0].cells?.['2']?.['0']?.formula_result,
				},
				{
					data_type: 'f',
					value: '=SUM(A1:A2)',
					formula_result: '3',
				},
			);
		} finally {
			parser.free();
		}
	});

	test('webview handleLoad imports and calls shared overlay', () => {
		const mainPath = path.join(__dirname, '../../webview-src/xlsx/main.ts');
		const src = fs.readFileSync(mainPath, 'utf8');
		assert.ok(
			/from\s+['"]\.\.\/\.\.\/src\/xlsx\/xlsxFormulaOverlay['"]/.test(src),
			'main.ts should import overlayFormulasFromXlsx from shared module',
		);
		assert.ok(
			/await\s+overlayFormulasFromXlsx\s*\(\s*bytes\s*,\s*model\s*\)/.test(src),
			'handleLoad should await overlayFormulasFromXlsx(bytes, model) before setData',
		);
		const overlayCall = src.indexOf('await overlayFormulasFromXlsx(bytes, model)');
		const setDataCall = src.indexOf('renderer.setData(model)');
		assert.ok(overlayCall >= 0 && setDataCall > overlayCall, 'overlay must run before setData');
	});
});

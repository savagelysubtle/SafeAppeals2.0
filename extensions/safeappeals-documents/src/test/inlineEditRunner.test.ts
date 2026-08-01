/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	buildXlsxSetCellOpsFromEditedText,
	modelIdMatches,
	normalizeDocxInlineEditHtml,
	parseA1Range,
	pickInlineEditModel,
	PREFERRED_INLINE_EDIT_MODEL_IDS,
	stripMarkdownFences,
} from '../inlineEditHelpers';

suite('inlineEditRunner helpers', () => {
	test('stripMarkdownFences removes outer fence when selection was unfenced', () => {
		assert.deepStrictEqual(
			stripMarkdownFences('```\nHello world\n```', 'Hello world'),
			'Hello world',
		);
		assert.deepStrictEqual(
			stripMarkdownFences('```text\nShort\n```', 'Short'),
			'Short',
		);
	});

	test('stripMarkdownFences keeps fences when selection used them', () => {
		const selection = '```js\nconst x = 1;\n```';
		assert.deepStrictEqual(
			stripMarkdownFences('```js\nconst x = 2;\n```', selection),
			'```js\nconst x = 2;\n```',
		);
	});

	test('normalizeDocxInlineEditHtml converts markdown emphasis to HTML', () => {
		assert.deepStrictEqual(
			normalizeDocxInlineEditHtml('**Word**', 'Word'),
			'<strong>Word</strong>',
		);
		assert.deepStrictEqual(
			normalizeDocxInlineEditHtml('__Word__ and *italic*', 'Word and italic'),
			'<strong>Word</strong> and <em>italic</em>',
		);
		assert.deepStrictEqual(
			normalizeDocxInlineEditHtml('```\n**Bold**\n```', 'Bold'),
			'<strong>Bold</strong>',
		);
	});

	test('normalizeDocxInlineEditHtml leaves HTML and plain text alone', () => {
		assert.deepStrictEqual(
			normalizeDocxInlineEditHtml('<strong>Word</strong>', 'Word'),
			'<strong>Word</strong>',
		);
		assert.deepStrictEqual(
			normalizeDocxInlineEditHtml('plain text', 'plain text'),
			'plain text',
		);
	});

	test('parseA1Range handles single cell and ranges', () => {
		assert.deepStrictEqual(parseA1Range('B2'), {
			sheet: undefined,
			startCol: 1,
			startRow: 2,
			endCol: 1,
			endRow: 2,
		});
		assert.deepStrictEqual(parseA1Range('Sheet1!A1:C2'), {
			sheet: 'Sheet1',
			startCol: 0,
			startRow: 1,
			endCol: 2,
			endRow: 2,
		});
	});

	test('buildXlsxSetCellOpsFromEditedText fills single cell', () => {
		assert.deepStrictEqual(
			buildXlsxSetCellOpsFromEditedText('edited', { sheet: 'Data', range: 'B2' }),
			[{ type: 'set_cell_value', sheet: 'Data', cell: 'B2', value: 'edited' }],
		);
	});

	test('buildXlsxSetCellOpsFromEditedText fills multi-cell TSV row-major', () => {
		assert.deepStrictEqual(
			buildXlsxSetCellOpsFromEditedText('a\tb\nc\td', { sheet: 'Sheet1', range: 'A1:B2' }),
			[
				{ type: 'set_cell_value', sheet: 'Sheet1', cell: 'A1', value: 'a' },
				{ type: 'set_cell_value', sheet: 'Sheet1', cell: 'B1', value: 'b' },
				{ type: 'set_cell_value', sheet: 'Sheet1', cell: 'A2', value: 'c' },
				{ type: 'set_cell_value', sheet: 'Sheet1', cell: 'B2', value: 'd' },
			],
		);
	});

	test('pickInlineEditModel prefers gpt-5.6-terra over sol/luna/5.2', () => {
		assert.strictEqual(PREFERRED_INLINE_EDIT_MODEL_IDS[0], 'gpt-5.6-terra');
		const picked = pickInlineEditModel([
			{ id: 'gpt-5.6-sol', family: 'openai', vendor: 'safeappeals-cloud' },
			{ id: 'gpt-5.6-luna', family: 'openai', vendor: 'safeappeals-cloud' },
			{ id: 'gpt-5.2', family: 'openai', vendor: 'safeappeals-cloud' },
			{ id: 'gpt-5.6-terra', family: 'openai', vendor: 'safeappeals-cloud' },
		]);
		assert.deepStrictEqual(picked?.id, 'gpt-5.6-terra');
	});

	test('pickInlineEditModel matches terra effort suffixes via segment prefix', () => {
		assert.strictEqual(modelIdMatches('gpt-5.6-terra-medium', 'gpt-5.6-terra'), true);
		assert.strictEqual(modelIdMatches('gpt-5.6-terracotta', 'gpt-5.6-terra'), false);
		assert.strictEqual(modelIdMatches('gpt-4o-mini', 'gpt-4o'), false);
		const picked = pickInlineEditModel([
			{ id: 'gpt-5.6-sol', family: 'openai', vendor: 'safeappeals-cloud' },
			{ id: 'gpt-5.6-terra-medium', family: 'openai', vendor: 'safeappeals-cloud' },
		]);
		assert.deepStrictEqual(picked?.id, 'gpt-5.6-terra-medium');
	});

	test('pickInlineEditModel prefers non-mini gpt-4 family when no exact preferred id', () => {
		const picked = pickInlineEditModel([
			{ id: 'gpt-4o-mini', family: 'gpt-4o-mini', vendor: 'safeappeals-cloud' },
			{ id: 'gpt-4o', family: 'gpt-4o', vendor: 'safeappeals-cloud' },
		]);
		assert.deepStrictEqual(picked?.id, 'gpt-4o');
	});
});

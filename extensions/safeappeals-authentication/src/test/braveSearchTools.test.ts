/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	formatMultiWebSearchResults,
	formatWebSearchResults,
	sanitizeMultiWebSearchInput,
	sanitizeWebSearchInput,
} from '../chat/braveSearchHelpers';

suite('braveSearchTools sanitization', () => {
	test('sanitizeWebSearchInput clamps query, count, and offset', () => {
		const longQuery = 'a'.repeat(500);
		assert.deepStrictEqual(
			sanitizeWebSearchInput({ query: `  ${longQuery}  `, count: 99, offset: -3 }),
			{
				query: 'a'.repeat(400),
				count: 20,
				offset: 0,
			},
		);
		assert.deepStrictEqual(
			sanitizeWebSearchInput({ query: 'ok', count: 0, offset: 12 }),
			{ query: 'ok', count: 10, offset: 9 },
		);
		assert.deepStrictEqual(
			sanitizeWebSearchInput({ query: 'ok', count: 1, offset: 12 }),
			{ query: 'ok', count: 1, offset: 9 },
		);
		assert.deepStrictEqual(
			sanitizeWebSearchInput({ query: 'defaults' }),
			{ query: 'defaults', count: 10, offset: 0 },
		);
	});

	test('sanitizeWebSearchInput rejects empty query', () => {
		assert.deepStrictEqual(
			sanitizeWebSearchInput({ query: '   ' }),
			{ error: 'query is required (non-empty string, max 400 characters).' },
		);
		assert.deepStrictEqual(
			sanitizeWebSearchInput({}),
			{ error: 'query is required (non-empty string, max 400 characters).' },
		);
	});

	test('sanitizeMultiWebSearchInput trims, caps length, and limits to 10 queries', () => {
		const queries = Array.from({ length: 12 }, (_, i) => ` q${i} `);
		queries[0] = 'x'.repeat(450);
		assert.deepStrictEqual(
			sanitizeMultiWebSearchInput({ queries, count: 25 }),
			{
				queries: ['x'.repeat(400), ...queries.slice(1, 10).map(q => q.trim())],
				count: 20,
			},
		);
		assert.deepStrictEqual(
			sanitizeMultiWebSearchInput({ queries: ['', '  ', 1 as unknown as string] }),
			{ error: 'queries must be a non-empty array of 1–10 strings.' },
		);
	});
});

suite('braveSearchTools formatting', () => {
	test('formatWebSearchResults mirrors Void layout including age', () => {
		assert.deepStrictEqual(
			formatWebSearchResults([]),
			'No results found.',
		);
		assert.deepStrictEqual(
			formatWebSearchResults([
				{
					title: 'Title A',
					url: 'https://a.example',
					description: 'Desc A',
					age: '2 days ago',
				},
				{
					title: 'Title B',
					url: 'https://b.example',
					description: 'Desc B',
				},
			]),
			[
				'1. **Title A**',
				'   URL: https://a.example',
				'   Desc A',
				'   Published: 2 days ago',
				'',
				'2. **Title B**',
				'   URL: https://b.example',
				'   Desc B',
			].join('\n'),
		);
	});

	test('formatMultiWebSearchResults includes errors and separators', () => {
		assert.deepStrictEqual(
			formatMultiWebSearchResults([
				{
					query: 'alpha',
					results: [{ title: 'A', url: 'https://a', description: 'da' }],
				},
				{ query: 'beta', results: [], error: 'rate limited' },
				{ query: 'gamma', results: [] },
			]),
			[
				'## Search: "alpha"',
				'',
				'1. **A**',
				'   URL: https://a',
				'   da',
				'',
				'---',
				'',
				'## Search: "beta"',
				'',
				'❌ Error: rate limited',
				'',
				'---',
				'',
				'## Search: "gamma"',
				'',
				'No results found.',
			].join('\n'),
		);
	});
});

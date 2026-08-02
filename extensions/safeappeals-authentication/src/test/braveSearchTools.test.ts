/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	applySiteFilter,
	formatCreditsFooter,
	formatMultiWebSearchResults,
	formatWebSearchResults,
	formatWebSearchToolBody,
	sanitizeFreshness,
	sanitizeMultiWebSearchInput,
	sanitizeSafesearch,
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
				safesearch: 'moderate',
			},
		);
		assert.deepStrictEqual(
			sanitizeWebSearchInput({ query: 'ok', count: 0, offset: 12 }),
			{ query: 'ok', count: 10, offset: 9, safesearch: 'moderate' },
		);
		assert.deepStrictEqual(
			sanitizeWebSearchInput({ query: 'ok', count: 1, offset: 12 }),
			{ query: 'ok', count: 1, offset: 9, safesearch: 'moderate' },
		);
		assert.deepStrictEqual(
			sanitizeWebSearchInput({ query: 'defaults' }),
			{ query: 'defaults', count: 10, offset: 0, safesearch: 'moderate' },
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

	test('sanitizeWebSearchInput maps freshness aliases, safesearch, site, and autoFetch', () => {
		assert.deepStrictEqual(sanitizeFreshness('past_day'), 'pd');
		assert.deepStrictEqual(sanitizeFreshness('past_week'), 'pw');
		assert.deepStrictEqual(sanitizeFreshness('past_month'), 'pm');
		assert.deepStrictEqual(sanitizeFreshness('past_year'), 'py');
		assert.deepStrictEqual(sanitizeFreshness('pd'), 'pd');
		assert.deepStrictEqual(sanitizeFreshness('2022-04-01to2022-07-30'), '2022-04-01to2022-07-30');
		assert.deepStrictEqual(sanitizeFreshness('nope'), undefined);
		assert.deepStrictEqual(sanitizeSafesearch('STRICT'), 'strict');
		assert.deepStrictEqual(sanitizeSafesearch('bogus'), 'moderate');
		assert.deepStrictEqual(applySiteFilter('case law', 'https://www.example.com/path'), 'case law site:example.com');
		assert.deepStrictEqual(applySiteFilter('foo site:already.com', 'example.com'), 'foo site:already.com');

		assert.deepStrictEqual(
			sanitizeWebSearchInput({
				query: 'appeals',
				safesearch: 'strict',
				freshness: 'past_week',
				country: 'us',
				search_lang: 'EN',
				ui_lang: 'en-us',
				site: 'https://www.ssa.gov/',
				autoFetch: 3,
			}),
			{
				query: 'appeals site:ssa.gov',
				count: 10,
				offset: 0,
				safesearch: 'strict',
				freshness: 'pw',
				country: 'US',
				search_lang: 'en',
				ui_lang: 'en-US',
				site: 'ssa.gov',
				autoFetch: 3,
			},
		);
		assert.deepStrictEqual(
			sanitizeWebSearchInput({ query: 'x', autoFetch: 99 }),
			{ query: 'x', count: 10, offset: 0, safesearch: 'moderate', autoFetch: 5 },
		);
		assert.deepStrictEqual(
			sanitizeWebSearchInput({ query: 'x', autoFetch: 0 }),
			{ query: 'x', count: 10, offset: 0, safesearch: 'moderate' },
		);
	});

	test('sanitizeMultiWebSearchInput trims, caps length, limits to 10, and applies site', () => {
		const queries = Array.from({ length: 12 }, (_, i) => ` q${i} `);
		queries[0] = 'x'.repeat(450);
		assert.deepStrictEqual(
			sanitizeMultiWebSearchInput({ queries, count: 25 }),
			{
				queries: ['x'.repeat(400), ...queries.slice(1, 10).map(q => q.trim())],
				count: 20,
				safesearch: 'moderate',
			},
		);
		assert.deepStrictEqual(
			sanitizeMultiWebSearchInput({ queries: ['', '  ', 1 as unknown as string] }),
			{ error: 'queries must be a non-empty array of 1–10 strings.' },
		);
		assert.deepStrictEqual(
			sanitizeMultiWebSearchInput({
				queries: ['alpha', 'beta site:keep.com'],
				site: 'example.org',
				freshness: 'py',
			}),
			{
				queries: ['alpha site:example.org', 'beta site:keep.com'],
				count: 10,
				safesearch: 'moderate',
				freshness: 'py',
				site: 'example.org',
			},
		);
	});
});

suite('braveSearchTools formatting', () => {
	test('formatWebSearchResults mirrors Void layout including age, domain, thumbnail, extra snippets', () => {
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
					domain: 'a.example',
					thumbnail: 'https://a.example/thumb.jpg',
					extra_snippets: ['Extra one', 'Extra two'],
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
				'   Domain: a.example',
				'   Thumbnail: https://a.example/thumb.jpg',
				'   Extra snippets:',
				'   - Extra one',
				'   - Extra two',
				'',
				'2. **Title B**',
				'   URL: https://b.example',
				'   Desc B',
			].join('\n'),
		);
	});

	test('formatWebSearchToolBody always appends credits footer (incl. after autoFetch)', () => {
		assert.ok(
			formatCreditsFooter(250, 449750).includes('Credits used: 250. Credits remaining: 449750.'),
		);
		const withFetch = formatWebSearchToolBody(
			[{ title: 'T', url: 'https://t', description: 'd', age: '1 day ago' }],
			250,
			1000,
			'\n\n---\n\n## Full page text\n\nhello',
		);
		assert.ok(withFetch.includes('Published: 1 day ago'));
		assert.ok(withFetch.includes('## Full page text'));
		assert.ok(withFetch.endsWith('Credits used: 250. Credits remaining: 1000.'));
		assert.strictEqual(
			formatCreditsFooter(undefined, undefined),
			'\n\n---\nCredits used: ?. Credits remaining: ?.',
		);
		assert.strictEqual(
			formatCreditsFooter('250', '99'),
			'\n\n---\nCredits used: 250. Credits remaining: 99.',
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

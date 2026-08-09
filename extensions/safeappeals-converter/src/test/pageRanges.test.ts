/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as path from 'node:path';
import { PageRangeError, parseOptionalPageRanges, parsePageRanges } from '../pageRanges';

suite('page ranges', () => {
	test('normalizes valid ranges', () => {
		assert.deepStrictEqual(parsePageRanges('5, 1-3', 5), [1, 2, 3, 5]);
	});

	for (const input of ['1-2-3', '1.5', '0', '-1', '2-1', '1,,2']) {
		test(`rejects malformed range ${input}`, () => {
			assert.throws(() => parsePageRanges(input, 10), PageRangeError);
		});
	}

	test('rejects overlapping and repeated pages', () => {
		assert.throws(() => parsePageRanges('1-3,3', 10), error =>
			error instanceof PageRangeError && error.code === 'duplicate');
	});

	test('enforces actual page bounds', () => {
		assert.throws(() => parsePageRanges('1,4', 3), error =>
			error instanceof PageRangeError && error.code === 'bounds');
	});

	test('rejects huge safe-integer ranges before expansion without a page count', () => {
		assert.throws(() => parsePageRanges('1-9007199254740991'), error =>
			error instanceof PageRangeError && error.code === 'format');
	});

	test('preserves prompt cancellation without parsing an error', () => {
		assert.strictEqual(parseOptionalPageRanges(undefined, 3), undefined);
	});

	test('host and browser parsers share the same acceptance and error-code vectors', () => {
		const browserParser = require(path.resolve(__dirname, '../../media/dashboard/pageRanges.js')) as {
			parsePageRanges(input: string, pageCount?: number): number[];
		};
		const vectors = [
			'5, 1-3', '', '1-2-3', '1.5', '0', '-1', '2-1', '1,,2', '1-3,3', '1,4',
			'1-9007199254740991', '9007199254740992', '1-9007199254740992',
		];
		const result = (parse: (input: string, pageCount?: number) => number[]) => vectors.map(input => {
			try {
				return { input, pages: parse(input, 3) };
			} catch (error) {
				return { input, code: error instanceof Error ? error.message : String(error) };
			}
		});
		assert.deepStrictEqual(result(parsePageRanges), result(browserParser.parsePageRanges));
	});
});

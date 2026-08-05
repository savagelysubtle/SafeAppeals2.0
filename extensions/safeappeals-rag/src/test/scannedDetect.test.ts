/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { detectScannedPdf } from '../scannedDetect';
import { SCANNED_CHARS_PER_PAGE_THRESHOLD } from '../types';

suite('scannedDetect', () => {
	test('marks low chars/page as scanned', () => {
		const result = detectScannedPdf([{ text: 'x'.repeat(40) }, { text: 'y'.repeat(40) }]);
		assert.deepStrictEqual(
			{ scanned: result.scanned, charsPerPage: result.charsPerPage, pageCount: result.pageCount },
			{ scanned: true, charsPerPage: 40, pageCount: 2 },
		);
	});

	test('marks high chars/page as born-digital', () => {
		const text = 'a'.repeat(SCANNED_CHARS_PER_PAGE_THRESHOLD);
		const result = detectScannedPdf([{ text }, { text }]);
		assert.strictEqual(result.scanned, false);
		assert.strictEqual(result.charsPerPage, SCANNED_CHARS_PER_PAGE_THRESHOLD);
	});

	test('empty pages are scanned (0 chars/page)', () => {
		assert.deepStrictEqual(detectScannedPdf([]), {
			scanned: true,
			charsPerPage: 0,
			pageCount: 1,
			totalChars: 0,
		});
	});
});

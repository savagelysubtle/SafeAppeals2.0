/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	formatByteCount,
	formatOcrDownloadStatus,
	mapFileDownloadPercent,
	OCR_CONNECTING_PERCENT,
	OCR_INSTALLING_MAX_PERCENT,
	OCR_INSTALLING_MIN_PERCENT,
	OCR_INSTALL_START_PERCENT,
	OCR_STARTING_PERCENT,
	searchPackModelPercent,
} from '../localAiSetupProgress';

suite('localAiSetupProgress', () => {
	test('mapFileDownloadPercent maps completed files into installing band', () => {
		assert.deepStrictEqual(
			mapFileDownloadPercent({
				completedFiles: 0,
				totalFiles: 4,
			}),
			{ percent: OCR_INSTALLING_MIN_PERCENT, indeterminate: false },
		);
		assert.deepStrictEqual(
			mapFileDownloadPercent({
				completedFiles: 2,
				totalFiles: 4,
			}),
			{ percent: 45, indeterminate: false },
		);
		assert.deepStrictEqual(
			mapFileDownloadPercent({
				completedFiles: 4,
				totalFiles: 4,
			}),
			{ percent: OCR_INSTALLING_MAX_PERCENT, indeterminate: false },
		);
	});

	test('mapFileDownloadPercent blends in-file bytes when Content-Length is known', () => {
		assert.deepStrictEqual(
			mapFileDownloadPercent({
				completedFiles: 3,
				totalFiles: 12,
				bytesReceived: 3_500_000_000,
				bytesTotal: 7_000_000_000,
			}),
			{ percent: 30, indeterminate: false },
		);
	});

	test('mapFileDownloadPercent prefers pack byte totals for smooth progress', () => {
		const packBytesTotal = 7_000_000_000;
		const packBytesReceived = 3_500_000_000;
		const expectedPercent = Math.round(
			OCR_INSTALLING_MIN_PERCENT +
				(packBytesReceived / packBytesTotal) * (OCR_INSTALLING_MAX_PERCENT - OCR_INSTALLING_MIN_PERCENT),
		);
		assert.deepStrictEqual(
			mapFileDownloadPercent({
				completedFiles: 3,
				totalFiles: 12,
				packBytesReceived,
				packBytesTotal,
			}),
			{ percent: expectedPercent, indeterminate: false },
		);
	});

	test('mapFileDownloadPercent is indeterminate without Content-Length during download', () => {
		assert.deepStrictEqual(
			mapFileDownloadPercent({
				completedFiles: 3,
				totalFiles: 12,
				bytesReceived: 1024,
			}),
			{ indeterminate: true },
		);
	});

	test('formatByteCount renders GB and MB labels', () => {
		assert.strictEqual(formatByteCount(6_700_000_000), '6.2 GB');
		assert.strictEqual(formatByteCount(1_200_000), '1.1 MB');
	});

	test('formatOcrDownloadStatus shows pack byte totals when known', () => {
		assert.strictEqual(
			formatOcrDownloadStatus({
				completedFiles: 3,
				totalFiles: 12,
				packBytesReceived: 1_200_000_000,
				packBytesTotal: 6_700_000_000,
			}),
			'Downloading scanned-PDF tools (4/12): 1.1 GB / 6.2 GB',
		);
	});

	test('formatOcrDownloadStatus includes file index and name when no byte totals', () => {
		assert.strictEqual(
			formatOcrDownloadStatus({
				completedFiles: 3,
				totalFiles: 12,
				relativePath: 'weights/model.safetensors',
			}),
			'Downloading scanned-PDF tools (4/12): model.safetensors…',
		);
	});

	test('searchPackModelPercent advances per model', () => {
		assert.strictEqual(searchPackModelPercent(0, 2), 0);
		assert.strictEqual(searchPackModelPercent(1, 2), 50);
		assert.strictEqual(searchPackModelPercent(2, 2), 100);
	});

	test('ocr phase constants follow install → starting → connecting order', () => {
		assert.ok(OCR_INSTALL_START_PERCENT < OCR_INSTALLING_MIN_PERCENT);
		assert.ok(OCR_INSTALLING_MAX_PERCENT < OCR_STARTING_PERCENT);
		assert.ok(OCR_STARTING_PERCENT < OCR_CONNECTING_PERCENT);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { installOcrWithEnsure } from '../localAiSetupOcr';
import { fakeMlBridge } from '../mlBridge';
import { UNLIMITED_OCR_MODEL_ID } from '../types';

suite('installOcrWithEnsure', () => {
	test('marks installed only when consent install and ensure both succeed', async () => {
		const progress: Array<{ message: string; percent?: number; indeterminate?: boolean }> = [];
		const ml = fakeMlBridge({
			artifactReady: false,
			consentInstall: async (modelId, userConsented, options) => {
				assert.strictEqual(modelId, UNLIMITED_OCR_MODEL_ID);
				assert.strictEqual(userConsented, true);
				options?.onProgress?.({
					completedFiles: 2,
					totalFiles: 4,
					relativePath: 'weights/model.bin',
				});
				return { kind: 'installed', modelId, version: '1.0.0' };
			},
			ensureDocParseReady: async () => ({ ready: true }),
		});

		const result = await installOcrWithEnsure(ml, (message, percent, indeterminate) => {
			progress.push({ message, percent, indeterminate });
		});

		assert.deepStrictEqual(result, { sessionOutcome: 'installed' });
		assert.deepStrictEqual(progress, [
			{ message: 'Installing scanned-PDF tools…', percent: 5, indeterminate: false },
			{
				message: 'Downloading scanned-PDF tools (3/4): model.bin…',
				percent: 45,
				indeterminate: false,
			},
			{ message: 'Starting scanned PDF tools…', percent: 85, indeterminate: false },
			{ message: 'Connecting…', percent: 95, indeterminate: false },
		]);
	});

	test('download ok but ensure fail returns retry-friendly failed outcome', async () => {
		const ml = fakeMlBridge({
			consentInstall: async (modelId, _userConsented) => ({
				kind: 'already-ready',
				modelId,
				version: '1.0.0',
			}),
			ensureDocParseReady: async () => ({
				ready: false,
				detail: 'sidecar binary missing',
			}),
		});

		const result = await installOcrWithEnsure(ml, () => { });

		assert.strictEqual(result.sessionOutcome, 'failed');
		assert.ok(result.errorMessage?.includes('Download finished but scanned PDF tools could not start'));
		assert.ok(result.errorMessage?.includes('sidecar binary missing'));
	});

	test('fails closed when artifact pins are not configured', async () => {
		const ml = fakeMlBridge({ ocrPinConfigured: false });

		const result = await installOcrWithEnsure(ml, () => { });

		assert.deepStrictEqual(result, {
			sessionOutcome: 'failed',
			errorMessage: 'Unlimited-OCR download pins are not configured for this build.',
		});
	});
});

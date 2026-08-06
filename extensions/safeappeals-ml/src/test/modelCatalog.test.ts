/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	BGE_SMALL_SPEC,
	MS_MARCO_MINILM_SPEC,
	ModelCatalog,
	UNLIMITED_OCR_SPEC,
	createDefaultModelCatalog,
	isArtifactPinConfigured,
} from '../modelCatalog';
import type { HwSnapshot } from '../types';

function snapshot(partial: Partial<HwSnapshot> = {}): HwSnapshot {
	return {
		platform: 'linux',
		arch: 'x64',
		osRelease: '6.8.0',
		cpuModel: 'Test CPU',
		cpuCount: 8,
		totalRamMb: 32_768,
		freeRamMb: 16_384,
		diskFreeMb: 100_000,
		gpuVramMb: 12_288,
		gpuName: 'Test GPU',
		probedAt: 1,
		...partial,
	};
}

suite('modelCatalog', () => {
	test('seeds Unlimited-OCR and Search pack specs', () => {
		const catalog = createDefaultModelCatalog();
		assert.deepStrictEqual(catalog.get('unlimited-ocr'), UNLIMITED_OCR_SPEC);
		assert.deepStrictEqual(catalog.get('bge-small-en-v1.5'), BGE_SMALL_SPEC);
		assert.deepStrictEqual(catalog.get('ms-marco-minilm-l6-v2'), MS_MARCO_MINILM_SPEC);
		assert.strictEqual(UNLIMITED_OCR_SPEC.minVramMb, 8192);
		assert.strictEqual(UNLIMITED_OCR_SPEC.diskMb, 7000);
		assert.strictEqual(UNLIMITED_OCR_SPEC.pageSoftCap, 40);
		assert.ok(UNLIMITED_OCR_SPEC.sha256);
		assert.ok(UNLIMITED_OCR_SPEC.files?.length);
		assert.ok(isArtifactPinConfigured(UNLIMITED_OCR_SPEC));
		assert.strictEqual(BGE_SMALL_SPEC.minVramMb, 0);
		assert.strictEqual(BGE_SMALL_SPEC.diskMb, 150);
		assert.strictEqual(MS_MARCO_MINILM_SPEC.minVramMb, 0);
		assert.strictEqual(MS_MARCO_MINILM_SPEC.diskMb, 100);
		assert.ok(BGE_SMALL_SPEC.files?.length);
		assert.ok(MS_MARCO_MINILM_SPEC.files?.length);
		assert.ok(BGE_SMALL_SPEC.sha256);
		assert.ok(MS_MARCO_MINILM_SPEC.sha256);
	});

	test('evaluate marks Unlimited-OCR eligible on capable machine', () => {
		const catalog = new ModelCatalog();
		assert.deepStrictEqual(catalog.evaluate('unlimited-ocr', snapshot()), {
			eligible: true,
			reasons: [],
		});
	});

	test('evaluate rejects Unlimited-OCR when VRAM is insufficient', () => {
		const catalog = new ModelCatalog();
		const result = catalog.evaluate('unlimited-ocr', snapshot({ gpuVramMb: 4096 }));
		assert.strictEqual(result.eligible, false);
		assert.ok(result.reasons.some(r => /Graphics memory 4096 MB/.test(r)));
	});

	test('evaluate rejects Unlimited-OCR when GPU is unknown', () => {
		const catalog = new ModelCatalog();
		const result = catalog.evaluate(
			'unlimited-ocr',
			snapshot({ gpuVramMb: undefined, gpuName: undefined }),
		);
		assert.strictEqual(result.eligible, false);
		assert.ok(result.reasons.some(r => /Graphics memory unknown/.test(r)));
	});

	test('evaluate rejects when disk or RAM is below threshold', () => {
		const catalog = new ModelCatalog();
		const result = catalog.evaluate(
			'unlimited-ocr',
			snapshot({ totalRamMb: 8192, diskFreeMb: 1000 }),
		);
		assert.strictEqual(result.eligible, false);
		assert.ok(result.reasons.some(r => /System memory/.test(r)));
		assert.ok(result.reasons.some(r => /Free disk/.test(r)));
	});

	test('Search pack models do not require VRAM', () => {
		const catalog = new ModelCatalog();
		const cpuOnly = snapshot({
			gpuVramMb: undefined,
			gpuName: undefined,
			totalRamMb: 4096,
			diskFreeMb: 5_000,
		});
		assert.deepStrictEqual(catalog.evaluate('bge-small-en-v1.5', cpuOnly), {
			eligible: true,
			reasons: [],
		});
		assert.deepStrictEqual(catalog.evaluate('ms-marco-minilm-l6-v2', cpuOnly), {
			eligible: true,
			reasons: [],
		});
	});

	test('isArtifactPinConfigured rejects missing sha256 and incomplete files', () => {
		assert.strictEqual(isArtifactPinConfigured(undefined), false);
		assert.strictEqual(
			isArtifactPinConfigured({ ...UNLIMITED_OCR_SPEC, sha256: undefined }),
			false,
		);
		assert.strictEqual(
			isArtifactPinConfigured({
				...UNLIMITED_OCR_SPEC,
				files: [{ relativePath: 'x.bin', downloadUrl: '', sha256: 'abc' }],
			}),
			false,
		);
	});

	test('evaluate returns unknown-model reason', () => {
		const catalog = new ModelCatalog();
		assert.deepStrictEqual(catalog.evaluate('no-such-model', snapshot()), {
			eligible: false,
			reasons: ['Unknown model: no-such-model'],
		});
	});
});

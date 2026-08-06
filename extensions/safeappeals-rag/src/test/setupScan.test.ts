/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { SEARCH_PACK_MODEL_IDS } from '../localAiSetupState';
import { fakeMlBridge } from '../mlBridge';
import { buildPrivateSearchSetupScan } from '../setupScan';
import { BGE_SMALL_MODEL_ID, MS_MARCO_CE_MODEL_ID } from '../types';

suite('setupScan', () => {
	test('ml unavailable returns unavailable scan with defaults', async () => {
		const scan = await buildPrivateSearchSetupScan(undefined);
		assert.deepStrictEqual(scan, {
			searchPack: {
				status: 'unavailable',
				readyModelIds: [],
				missingModelIds: [],
				diskMb: 350,
			},
			ocr: {
				status: 'unavailable',
				diskMb: 7000,
			},
			includeOcrInInstall: false,
		});
	});

	test('all Search pack models ready and OCR ready', async () => {
		const ml = fakeMlBridge({
			artifactReady: true,
			evaluate: { eligible: true, reasons: [] },
		});
		const scan = await buildPrivateSearchSetupScan(ml);
		assert.deepStrictEqual(scan, {
			searchPack: {
				status: 'ready',
				readyModelIds: [...SEARCH_PACK_MODEL_IDS],
				missingModelIds: [],
				diskMb: 350,
			},
			ocr: {
				status: 'ready',
				diskMb: 7000,
			},
			includeOcrInInstall: false,
		});
	});

	test('partial Search pack missing lists ready and missing model ids', async () => {
		const ml = fakeMlBridge({
			artifactDirs: {
				[BGE_SMALL_MODEL_ID]: '/fake/bge',
			},
			evaluate: { eligible: false, reasons: ['Insufficient GPU VRAM'] },
			ocrPinConfigured: true,
		});
		const scan = await buildPrivateSearchSetupScan(ml);
		assert.deepStrictEqual(scan, {
			searchPack: {
				status: 'missing',
				readyModelIds: [BGE_SMALL_MODEL_ID],
				missingModelIds: [MS_MARCO_CE_MODEL_ID],
				diskMb: 350,
			},
			ocr: {
				status: 'ineligible',
				diskMb: 7000,
			},
			includeOcrInInstall: false,
		});
	});

	test('OCR missing-eligible when pinned, eligible, and not ready', async () => {
		const ml = fakeMlBridge({
			evaluate: { eligible: true, reasons: [] },
			artifactDirs: {
				[BGE_SMALL_MODEL_ID]: '/fake/bge',
				[MS_MARCO_CE_MODEL_ID]: '/fake/msmarco',
			},
		});
		const scan = await buildPrivateSearchSetupScan(ml);
		assert.deepStrictEqual(scan, {
			searchPack: {
				status: 'ready',
				readyModelIds: [...SEARCH_PACK_MODEL_IDS],
				missingModelIds: [],
				diskMb: 350,
			},
			ocr: {
				status: 'missing-eligible',
				diskMb: 7000,
			},
			includeOcrInInstall: true,
		});
	});

	test('OCR ineligible when not pinned', async () => {
		const ml = fakeMlBridge({
			artifactDirs: {
				[BGE_SMALL_MODEL_ID]: '/fake/bge',
				[MS_MARCO_CE_MODEL_ID]: '/fake/msmarco',
			},
			ocrPinConfigured: false,
		});
		const scan = await buildPrivateSearchSetupScan(ml);
		assert.deepStrictEqual(scan, {
			searchPack: {
				status: 'ready',
				readyModelIds: [...SEARCH_PACK_MODEL_IDS],
				missingModelIds: [],
				diskMb: 350,
			},
			ocr: {
				status: 'ineligible',
				diskMb: 7000,
			},
			includeOcrInInstall: false,
		});
	});

	test('OCR ineligible when hardware not eligible', async () => {
		const ml = fakeMlBridge({
			artifactDirs: {
				[BGE_SMALL_MODEL_ID]: '/fake/bge',
				[MS_MARCO_CE_MODEL_ID]: '/fake/msmarco',
			},
			evaluate: { eligible: false, reasons: ['Insufficient GPU VRAM'] },
		});
		const scan = await buildPrivateSearchSetupScan(ml);
		assert.deepStrictEqual(scan, {
			searchPack: {
				status: 'ready',
				readyModelIds: [...SEARCH_PACK_MODEL_IDS],
				missingModelIds: [],
				diskMb: 350,
			},
			ocr: {
				status: 'ineligible',
				diskMb: 7000,
			},
			includeOcrInInstall: false,
		});
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { IConverterPdfPagesClient } from '../converterBridge';
import { ConverterDigitalPdfExtract } from '../converterDigitalPdfExtract';
import { IngestRouter } from '../ingestRouter';
import { fakeMlBridge } from '../mlBridge';
import { SCANNED_CHARS_PER_PAGE_THRESHOLD } from '../types';

function fakeClient(
	overrides: Partial<IConverterPdfPagesClient> & {
		extractPdfPages?: IConverterPdfPagesClient['extractPdfPages'];
	},
): IConverterPdfPagesClient {
	return {
		isSidecarAvailable: true,
		extractPdfPages: async () => ({ success: true, pages: [{ page: 1, text: 'hello' }] }),
		...overrides,
	};
}

suite('ConverterDigitalPdfExtract', () => {
	test('maps converter pages to PageText for detectScannedPdf', async () => {
		const rich = 'w'.repeat(SCANNED_CHARS_PER_PAGE_THRESHOLD + 5);
		const extractor = new ConverterDigitalPdfExtract({
			getClient: async () =>
				fakeClient({
					extractPdfPages: async () => ({
						success: true,
						pages: [
							{ page: 1, text: rich },
							{ page: 2, text: rich },
						],
					}),
				}),
		});

		const result = await extractor.extract('file:///case/brief.pdf', new Uint8Array());
		assert.strictEqual(result.kind, 'ok');
		if (result.kind === 'ok') {
			assert.strictEqual(result.pages.length, 2);
		}

		const ml = fakeMlBridge({});
		const router = new IngestRouter({
			...ml,
			digitalPdf: extractor,
		});
		const ingest = await router.ingest({
			sourceUri: 'file:///case/brief.pdf',
			bytes: new TextEncoder().encode('%PDF-fake'),
		});
		assert.strictEqual(ingest.kind, 'ok');
		if (ingest.kind === 'ok') {
			assert.strictEqual(ingest.fidelity, 'digital');
			assert.strictEqual(ingest.scanned, false);
			assert.strictEqual(ingest.pageCount, 2);
		}
	});

	test('fail closed when converter extension client missing', async () => {
		const extractor = new ConverterDigitalPdfExtract({
			getClient: async () => undefined,
		});
		const result = await extractor.extract('file:///case/missing.pdf', new Uint8Array());
		assert.deepStrictEqual(result, {
			kind: 'unavailable',
			reason:
				'safeappeals-converter extension unavailable — born-digital PDF extract requires the converter sidecar.',
		});
	});

	test('fail closed when sidecar binary unavailable', async () => {
		const extractor = new ConverterDigitalPdfExtract({
			getClient: async () =>
				fakeClient({
					isSidecarAvailable: false,
				}),
		});
		const result = await extractor.extract('file:///case/no-sidecar.pdf', new Uint8Array());
		assert.strictEqual(result.kind, 'unavailable');
		if (result.kind === 'unavailable') {
			assert.ok(result.reason.includes('sa-converter binary'));
		}
	});

	test('sparse converter pages feed scanned ladder via IngestRouter', async () => {
		const extractor = new ConverterDigitalPdfExtract({
			getClient: async () =>
				fakeClient({
					extractPdfPages: async () => ({
						success: true,
						pages: [{ page: 1, text: 'tiny' }],
					}),
				}),
		});
		const ml = fakeMlBridge({
			evaluate: { eligible: false, reasons: ['GPU below requirement'] },
		});
		const router = new IngestRouter({ ...ml, digitalPdf: extractor });
		const result = await router.ingest({
			sourceUri: 'file:///case/scan.pdf',
			bytes: new TextEncoder().encode('%PDF-fake'),
		});
		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.strictEqual(result.code, 'scanned-ocr-ineligible');
			assert.strictEqual(result.scanned, true);
		}
	});
});

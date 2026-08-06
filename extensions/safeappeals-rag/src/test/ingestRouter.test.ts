/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { IDocParseBackend } from '../docParseBackend';
import { FakeDigitalPdfExtractor } from '../digitalPdfExtract';
import { IngestRouter } from '../ingestRouter';
import { fakeMlBridge } from '../mlBridge';
import { SealedMarkdownStore } from '../sealedMarkdown';
import { SCANNED_CHARS_PER_PAGE_THRESHOLD } from '../types';

function utf8(text: string): Uint8Array {
	return new TextEncoder().encode(text);
}

function readyDocParse(markdown = '# OCR\nhello'): IDocParseBackend {
	return {
		isReady: () => true,
		parsePdf: async (request) => ({
			kind: 'ok',
			markdown,
			anchors: [{ sourceUri: request.sourceUri, page: 1 }],
			pageCount: 1,
		}),
	};
}

suite('ingestRouter ladder', () => {
	test('born-digital PDF uses digital fidelity without OCR', async () => {
		const pageText = 'w'.repeat(SCANNED_CHARS_PER_PAGE_THRESHOLD + 10);
		const ml = fakeMlBridge({ evaluate: { eligible: false, reasons: ['should not matter'] } });
		const sealedStore = SealedMarkdownStore.createMemoryOnlyForTesting();
		const router = new IngestRouter({
			...ml,
			digitalPdf: new FakeDigitalPdfExtractor({
				kind: 'ok',
				pages: [{ text: pageText }, { text: pageText }],
			}),
			docParse: readyDocParse(),
			sealedStore,
		});

		const sourceUri = 'file:///case/brief.pdf';
		const result = await router.ingest({
			sourceUri,
			bytes: utf8('%PDF-fake'),
		});

		assert.strictEqual(result.kind, 'ok');
		if (result.kind === 'ok') {
			assert.deepStrictEqual(
				{
					fidelity: result.fidelity,
					scanned: result.scanned,
					pageCount: result.pageCount,
				},
				{ fidelity: 'digital', scanned: false, pageCount: 2 },
			);
			assert.ok(result.markdown.includes('<!-- page 1 -->'));
			assert.ok(result.anchors.length >= 1);
		}
		const sealed = await sealedStore.get(sourceUri);
		assert.ok(sealed);
		assert.strictEqual(sealed?.fidelity, 'digital');
	});

	test('scanned PDF hard-disables when catalog ineligible (no Tesseract)', async () => {
		const ml = fakeMlBridge({
			evaluate: { eligible: false, reasons: ['Graphics memory 2048 MB is below the 8192 MB requirement'] },
			artifactReady: true,
		});
		const router = new IngestRouter({
			...ml,
			digitalPdf: new FakeDigitalPdfExtractor({
				kind: 'ok',
				pages: [{ text: 'sparse' }],
			}),
			docParse: readyDocParse(),
		});

		const result = await router.ingest({
			sourceUri: 'file:///case/scan.pdf',
			bytes: utf8('%PDF-fake'),
		});

		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.deepStrictEqual(
				{ code: result.code, scanned: result.scanned },
				{ code: 'scanned-ocr-ineligible', scanned: true },
			);
			assert.ok(result.message.length > 0);
			assert.ok(!/tesseract/i.test(result.message));
		}
	});

	test('scanned PDF hard-disables when artifact pins are not configured', async () => {
		const ml = fakeMlBridge({
			evaluate: { eligible: true, reasons: [] },
			artifactReady: true,
			ocrPinConfigured: false,
		});
		const router = new IngestRouter({
			...ml,
			digitalPdf: new FakeDigitalPdfExtractor({
				kind: 'ok',
				pages: [{ text: 'tiny' }],
			}),
			docParse: readyDocParse(),
		});

		const result = await router.ingest({
			sourceUri: 'file:///case/scan.pdf',
			bytes: utf8('%PDF-fake'),
		});

		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.strictEqual(result.code, 'scanned-ocr-unpinned');
			assert.ok(/downloadUrl|sha256|pins/i.test(result.message));
		}
	});

	test('scanned PDF hard-disables when eligible but artifacts not installed', async () => {
		const ml = fakeMlBridge({ evaluate: { eligible: true, reasons: [] }, artifactReady: false });
		const router = new IngestRouter({
			...ml,
			digitalPdf: new FakeDigitalPdfExtractor({
				kind: 'ok',
				pages: [{ text: '' }],
			}),
			docParse: readyDocParse(),
		});

		const result = await router.ingest({
			sourceUri: 'file:///case/scan.pdf',
			bytes: utf8('%PDF-fake'),
		});

		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.strictEqual(result.code, 'scanned-ocr-not-installed');
		}
	});

	test('scanned PDF hard-disables when artifacts ready but DocParse sidecar not ready', async () => {
		const ml = fakeMlBridge({ evaluate: { eligible: true, reasons: [] }, artifactReady: true });
		const router = new IngestRouter({
			...ml,
			digitalPdf: new FakeDigitalPdfExtractor({
				kind: 'ok',
				pages: [{ text: 'x'.repeat(10) }],
			}),
			// default NotReadyDocParseBackend
		});

		const result = await router.ingest({
			sourceUri: 'file:///case/scan.pdf',
			bytes: utf8('%PDF-fake'),
		});

		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.strictEqual(result.code, 'scanned-ocr-sidecar-not-ready');
		}
	});

	test('scanned PDF tries ensure once before sidecar-not-ready hard-disable', async () => {
		let ensureCalls = 0;
		let ready = false;
		const ml = fakeMlBridge({ evaluate: { eligible: true, reasons: [] }, artifactReady: true });
		const router = new IngestRouter({
			...ml,
			digitalPdf: new FakeDigitalPdfExtractor({
				kind: 'ok',
				pages: [{ text: 'x'.repeat(10) }],
			}),
			docParse: {
				isReady: () => ready,
				parsePdf: async (request) => ({
					kind: 'ok',
					markdown: '# OCR after ensure',
					anchors: [{ sourceUri: request.sourceUri, page: 1 }],
					pageCount: 1,
				}),
			},
			ensureDocParseReady: async () => {
				ensureCalls++;
				return { ready: true };
			},
			refreshDocParseReady: async () => {
				ready = true;
				return true;
			},
		});

		const result = await router.ingest({
			sourceUri: 'file:///case/scan.pdf',
			bytes: utf8('%PDF-fake'),
		});

		assert.strictEqual(ensureCalls, 1);
		assert.strictEqual(result.kind, 'ok');
		if (result.kind === 'ok') {
			assert.strictEqual(result.fidelity, 'ocr');
			assert.strictEqual(result.markdown, '# OCR after ensure');
		}
	});

	test('scanned PDF ensure failure still hard-disables sidecar-not-ready', async () => {
		let ensureCalls = 0;
		const ml = fakeMlBridge({ evaluate: { eligible: true, reasons: [] }, artifactReady: true });
		const router = new IngestRouter({
			...ml,
			digitalPdf: new FakeDigitalPdfExtractor({
				kind: 'ok',
				pages: [{ text: 'x'.repeat(10) }],
			}),
			ensureDocParseReady: async () => {
				ensureCalls++;
				return { ready: false, detail: 'sidecar refused to start' };
			},
		});

		const result = await router.ingest({
			sourceUri: 'file:///case/scan.pdf',
			bytes: utf8('%PDF-fake'),
		});

		assert.strictEqual(ensureCalls, 1);
		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.strictEqual(result.code, 'scanned-ocr-sidecar-not-ready');
		}
	});

	test('scanned PDF uses OCR when catalog+artifacts+sidecar ready', async () => {
		const ml = fakeMlBridge({ evaluate: { eligible: true, reasons: [] }, artifactReady: true });
		const sealedStore = SealedMarkdownStore.createMemoryOnlyForTesting();
		const router = new IngestRouter({
			...ml,
			digitalPdf: new FakeDigitalPdfExtractor({
				kind: 'ok',
				pages: [{ text: 'tiny' }],
			}),
			docParse: readyDocParse('# From OCR'),
			sealedStore,
		});

		const sourceUri = 'file:///case/scan.pdf';
		const result = await router.ingest({
			sourceUri,
			bytes: utf8('%PDF-fake'),
		});

		assert.strictEqual(result.kind, 'ok');
		if (result.kind === 'ok') {
			assert.deepStrictEqual(
				{ fidelity: result.fidelity, scanned: result.scanned, markdown: result.markdown },
				{ fidelity: 'ocr', scanned: true, markdown: '# From OCR' },
			);
		}
		const sealed = await sealedStore.get(sourceUri);
		assert.deepStrictEqual(sealed?.markdown, '# From OCR');
	});

	test('unavailable digital extract hard-disables as extract-failed without scanned ladder', async () => {
		let catalogCalled = false;
		const ml = fakeMlBridge({ evaluate: { eligible: true, reasons: [] }, artifactReady: true });
		const router = new IngestRouter({
			catalog: {
				evaluate: (...args) => {
					catalogCalled = true;
					return ml.catalog.evaluate(...args);
				},
			},
			probe: ml.probe,
			artifacts: ml.artifacts,
			digitalPdf: new FakeDigitalPdfExtractor({
				kind: 'unavailable',
				reason: 'TODO: pdfium',
			}),
			docParse: readyDocParse(),
		});

		const result = await router.ingest({
			sourceUri: 'file:///case/mystery.pdf',
			bytes: utf8('%PDF-fake'),
		});

		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.deepStrictEqual(
				{ code: result.code, scanned: result.scanned },
				{ code: 'extract-failed', scanned: false },
			);
		}
		assert.strictEqual(catalogCalled, false);
	});

	test('non-PDF txt/md extract succeeds and seals', async () => {
		const ml = fakeMlBridge({});
		const sealedStore = SealedMarkdownStore.createMemoryOnlyForTesting();
		const router = new IngestRouter({ ...ml, sealedStore });
		const body = '# Notes\nhello';
		const sourceUri = 'file:///case/notes.md';
		const result = await router.ingest({
			sourceUri,
			bytes: utf8(body),
		});
		assert.deepStrictEqual(result, {
			kind: 'ok',
			markdown: body,
			fidelity: 'native-text',
			anchors: [{ sourceUri, charRange: { start: 0, end: body.length } }],
			scanned: false,
		});
		const sealed = await sealedStore.get(sourceUri);
		assert.deepStrictEqual(sealed?.markdown, body);
	});

	test('docx stub hard-disables as unsupported', async () => {
		const ml = fakeMlBridge({});
		const router = new IngestRouter({ ...ml });
		const result = await router.ingest({
			sourceUri: 'file:///case/affidavit.docx',
			bytes: utf8('PK'),
		});
		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.strictEqual(result.code, 'unsupported-format');
		}
	});

	test('scanned PDF PathGuard failure uses path-outside-workspace code', async () => {
		const ml = fakeMlBridge({ evaluate: { eligible: true, reasons: [] }, artifactReady: true });
		const router = new IngestRouter({
			...ml,
			digitalPdf: new FakeDigitalPdfExtractor({
				kind: 'ok',
				pages: [{ text: 'tiny' }],
			}),
			docParse: {
				isReady: () => true,
				parsePdf: async () => ({
					kind: 'error',
					code: 'path-outside-workspace',
					message: 'Path is outside the workspace: file:///outside/scan.pdf',
				}),
			},
		});
		const result = await router.ingest({
			sourceUri: 'file:///outside/scan.pdf',
			bytes: utf8('%PDF-fake'),
		});
		assert.strictEqual(result.kind, 'hard-disable');
		if (result.kind === 'hard-disable') {
			assert.strictEqual(result.code, 'path-outside-workspace');
		}
	});
});

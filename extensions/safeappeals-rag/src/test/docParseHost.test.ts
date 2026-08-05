/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	assertLoopbackDocParseUrl,
	DEFAULT_DOCPARSE_SIDECAR_URL,
	DocParseHost,
	DOCPARSE_URL_ENV,
	type DocParseHttpFetch,
} from '../docParseHost';

suite('docParseHost', () => {
	test('resolveBaseUrl prefers env over setting', () => {
		const url = DocParseHost.resolveBaseUrl(
			() => 'http://127.0.0.1:9000',
			{ [DOCPARSE_URL_ENV]: 'http://127.0.0.1:9100' },
		);
		assert.strictEqual(url, 'http://127.0.0.1:9100');
	});

	test('resolveBaseUrl falls back to default', () => {
		const url = DocParseHost.resolveBaseUrl((_k, def) => def, {});
		assert.strictEqual(url, DEFAULT_DOCPARSE_SIDECAR_URL);
	});

	test('health + parse against fake sidecar', async () => {
		const fetchImpl: DocParseHttpFetch = async (url, init) => {
			if (url.endsWith('/health')) {
				return {
					ok: true,
					status: 200,
					json: async () => ({ ok: true, model: 'unlimited-ocr-fake' }),
					text: async () => '',
				};
			}
			if (url.endsWith('/parse') && init?.method === 'POST') {
				const body = JSON.parse(init.body ?? '{}') as { sourceUri?: string; pageFrom?: number; pageTo?: number };
				return {
					ok: true,
					status: 200,
					json: async () => ({
						markdown: `# OCR ${body.pageFrom}-${body.pageTo}`,
						pageCount: (body.pageTo ?? 1) - (body.pageFrom ?? 1) + 1,
						anchors: [{ sourceUri: body.sourceUri, page: body.pageFrom ?? 1 }],
					}),
					text: async () => '',
				};
			}
			return { ok: false, status: 404, json: async () => ({}), text: async () => 'missing' };
		};

		const host = new DocParseHost({
			baseUrl: 'http://127.0.0.1:8742',
			httpFetch: fetchImpl,
		});
		assert.strictEqual(host.isHealthyCached, false);
		const health = await host.health();
		assert.deepStrictEqual(health, { ok: true, model: 'unlimited-ocr-fake' });
		assert.strictEqual(host.isHealthyCached, true);

		const parsed = await host.parse({
			sourceUri: 'file:///case/scan.pdf',
			pdfBytes: Buffer.from('%PDF-fake'),
			pageFrom: 1,
			pageTo: 2,
		});
		assert.deepStrictEqual(
			{ markdown: parsed.markdown, pageCount: parsed.pageCount },
			{ markdown: '# OCR 1-2', pageCount: 2 },
		);
	});

	test('health failure clears cache', async () => {
		const host = new DocParseHost({
			baseUrl: 'http://127.0.0.1:8742',
			httpFetch: async () => {
				throw new Error('connection refused');
			},
		});
		const health = await host.health();
		assert.strictEqual(health.ok, false);
		assert.strictEqual(host.isHealthyCached, false);
	});

	test('rejects non-loopback URL at construct and never fetches', async () => {
		let fetchCount = 0;
		assert.throws(
			() =>
				new DocParseHost({
					baseUrl: 'http://example.com:8742',
					httpFetch: async () => {
						fetchCount++;
						return { ok: true, status: 200, json: async () => ({}), text: async () => '' };
					},
				}),
			/localhost-only/,
		);
		assert.strictEqual(fetchCount, 0);
	});

	test('resolveBaseUrl rejects remote env override', () => {
		assert.throws(
			() =>
				DocParseHost.resolveBaseUrl(
					() => 'http://127.0.0.1:8742',
					{ [DOCPARSE_URL_ENV]: 'https://evil.example/ocr' },
				),
			/localhost-only/,
		);
	});

	test('assertLoopbackDocParseUrl allows loopback forms and rejects remote', () => {
		assert.throws(() => assertLoopbackDocParseUrl('http://10.0.0.5:8742'), /localhost-only/);
		assert.doesNotThrow(() => assertLoopbackDocParseUrl('http://localhost:8742'));
		assert.doesNotThrow(() => assertLoopbackDocParseUrl('http://[::1]:8742'));
	});
});

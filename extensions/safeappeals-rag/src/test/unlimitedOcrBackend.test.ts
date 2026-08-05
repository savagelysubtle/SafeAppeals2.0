/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { DocParseHost, type DocParseHttpFetch } from '../docParseHost';
import { UnlimitedOCRBackend } from '../unlimitedOcrBackend';

function fakeFetch(handler: (url: string, body?: string) => unknown): DocParseHttpFetch {
	return async (url, init) => {
		try {
			const payload = handler(url, init?.body);
			return {
				ok: true,
				status: 200,
				json: async () => payload,
				text: async () => JSON.stringify(payload),
			};
		} catch (err) {
			return {
				ok: false,
				status: 500,
				json: async () => ({}),
				text: async () => (err instanceof Error ? err.message : String(err)),
			};
		}
	};
}

suite('unlimitedOcrBackend', () => {
	test('isReady false when artifacts missing', async () => {
		const host = new DocParseHost({
			baseUrl: 'http://127.0.0.1:8742',
			httpFetch: fakeFetch(url => {
				if (url.endsWith('/health')) {
					return { ok: true };
				}
				throw new Error('unexpected');
			}),
		});
		const backend = new UnlimitedOCRBackend({
			host,
			artifacts: { isReady: async () => false },
			getWorkspaceRoots: () => ['/case'],
		});
		assert.strictEqual(await backend.refreshReady(), false);
		assert.strictEqual(backend.isReady(), false);
	});

	test('isReady false when sidecar unhealthy', async () => {
		const host = new DocParseHost({
			baseUrl: 'http://127.0.0.1:8742',
			httpFetch: fakeFetch(() => {
				throw new Error('down');
			}),
		});
		const backend = new UnlimitedOCRBackend({
			host,
			artifacts: { isReady: async () => true },
			getWorkspaceRoots: () => ['/case'],
		});
		assert.strictEqual(await backend.refreshReady(), false);
		assert.strictEqual(backend.isReady(), false);
	});

	test('parsePdf rejects paths outside workspace', async () => {
		const host = new DocParseHost({
			baseUrl: 'http://127.0.0.1:8742',
			httpFetch: fakeFetch(url => {
				if (url.endsWith('/health')) {
					return { ok: true };
				}
				return { markdown: 'x', pageCount: 1, anchors: [] };
			}),
		});
		const backend = new UnlimitedOCRBackend({
			host,
			artifacts: { isReady: async () => true },
			getWorkspaceRoots: () => ['/case'],
			countPages: () => 1,
		});
		await backend.refreshReady();
		const result = await backend.parsePdf({
			sourceUri: 'file:///etc/passwd',
			bytes: Buffer.from('%PDF'),
		});
		assert.strictEqual(result.kind, 'error');
		if (result.kind === 'error') {
			assert.deepStrictEqual(
				{ code: result.code, pathMsg: /outside the workspace/.test(result.message) },
				{ code: 'path-outside-workspace', pathMsg: true },
			);
		}
	});

	test('parsePdf soft-cap splits and concatenates', async () => {
		const calls: Array<{ from?: number; to?: number }> = [];
		const host = new DocParseHost({
			baseUrl: 'http://127.0.0.1:8742',
			httpFetch: fakeFetch((url, body) => {
				if (url.endsWith('/health')) {
					return { ok: true };
				}
				const parsed = JSON.parse(body ?? '{}') as { pageFrom?: number; pageTo?: number };
				calls.push({ from: parsed.pageFrom, to: parsed.pageTo });
				return {
					markdown: `pages-${parsed.pageFrom}-${parsed.pageTo}`,
					pageCount: (parsed.pageTo ?? 1) - (parsed.pageFrom ?? 1) + 1,
					anchors: [],
				};
			}),
		});
		const warnings: string[] = [];
		const backend = new UnlimitedOCRBackend({
			host,
			artifacts: { isReady: async () => true },
			getWorkspaceRoots: () => ['/case'],
			pageSoftCap: 40,
			countPages: () => 85,
			log: m => warnings.push(m),
		});
		await backend.refreshReady();
		const result = await backend.parsePdf({
			sourceUri: 'file:///case/scan.pdf',
			bytes: Buffer.from('%PDF'),
		});
		assert.strictEqual(result.kind, 'ok');
		if (result.kind === 'ok') {
			assert.strictEqual(result.pageCount, 85);
			assert.ok(result.markdown.includes('pages-1-40'));
			assert.ok(result.markdown.includes('pages-41-80'));
			assert.ok(result.markdown.includes('pages-81-85'));
		}
		assert.deepStrictEqual(calls, [
			{ from: 1, to: 40 },
			{ from: 41, to: 80 },
			{ from: 81, to: 85 },
		]);
		assert.ok(warnings.some(w => /soft cap/.test(w)));
	});

	test('single job when under soft cap', async () => {
		let parseCalls = 0;
		const host = new DocParseHost({
			baseUrl: 'http://127.0.0.1:8742',
			httpFetch: fakeFetch(url => {
				if (url.endsWith('/health')) {
					return { ok: true };
				}
				parseCalls++;
				return {
					markdown: '# one',
					pageCount: 3,
					anchors: [{ sourceUri: 'file:///case/a.pdf', page: 1 }],
				};
			}),
		});
		const backend = new UnlimitedOCRBackend({
			host,
			artifacts: { isReady: async () => true },
			getWorkspaceRoots: () => ['/case'],
			countPages: () => 3,
		});
		await backend.refreshReady();
		const result = await backend.parsePdf({
			sourceUri: 'file:///case/a.pdf',
			bytes: Buffer.from('%PDF'),
		});
		assert.deepStrictEqual(
			{ kind: result.kind, parseCalls, ready: backend.isReady() },
			{ kind: 'ok', parseCalls: 1, ready: true },
		);
	});

	test('sidecar parse failure invokes onSidecarCrash', async () => {
		const crashes: string[] = [];
		const host = new DocParseHost({
			baseUrl: 'http://127.0.0.1:8742',
			httpFetch: fakeFetch(url => {
				if (url.endsWith('/health')) {
					return { ok: true };
				}
				throw new Error('connection reset');
			}),
		});
		const backend = new UnlimitedOCRBackend({
			host,
			artifacts: { isReady: async () => true },
			getWorkspaceRoots: () => ['/case'],
			countPages: () => 1,
			onSidecarCrash: message => crashes.push(message),
		});
		await backend.refreshReady();
		const result = await backend.parsePdf({
			sourceUri: 'file:///case/a.pdf',
			bytes: Buffer.from('%PDF'),
		});
		assert.strictEqual(result.kind, 'error');
		assert.ok(crashes.some(m => /connection reset/.test(m)));
	});
});

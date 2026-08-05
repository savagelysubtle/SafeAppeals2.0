/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	assertLoopbackSmokeUrl,
	smokeDocParseHealth,
} from '../docParseSmoke';

suite('docParseSmoke', () => {
	test('assertLoopbackSmokeUrl rejects remote hosts', () => {
		assert.throws(() => assertLoopbackSmokeUrl('http://evil.example:8742'), /localhost-only/);
		assert.doesNotThrow(() => assertLoopbackSmokeUrl('http://127.0.0.1:8742'));
	});

	test('smokeDocParseHealth succeeds on ok:true and never contacts remote', async () => {
		const urls: string[] = [];
		await smokeDocParseHealth({
			baseUrl: 'http://127.0.0.1:8742',
			fetchImpl: async url => {
				urls.push(url);
				return {
					ok: true,
					status: 200,
					json: async () => ({ ok: true }),
				};
			},
		});
		assert.deepStrictEqual(urls, ['http://127.0.0.1:8742/health']);
	});

	test('smokeDocParseHealth fails closed on remote baseUrl without fetch', async () => {
		let fetchCount = 0;
		await assert.rejects(
			() =>
				smokeDocParseHealth({
					baseUrl: 'https://remote.example/ocr',
					fetchImpl: async () => {
						fetchCount++;
						return { ok: true, status: 200, json: async () => ({ ok: true }) };
					},
				}),
			/localhost-only/,
		);
		assert.strictEqual(fetchCount, 0);
	});
});

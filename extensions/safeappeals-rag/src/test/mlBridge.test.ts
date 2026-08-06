/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { fakeMlBridge } from '../mlBridge';

suite('mlBridge ensureDocParseReady', () => {
	test('fake bridge delegates to injected ensureDocParseReady', async () => {
		let called = false;
		const ml = fakeMlBridge({
			artifactReady: true,
			ensureDocParseReady: async () => {
				called = true;
				return { ready: true };
			},
		});

		const result = await ml.ensureDocParseReady();

		assert.strictEqual(called, true);
		assert.deepStrictEqual(result, { ready: true });
	});

	test('fake bridge default ensure fails closed when artifacts not ready', async () => {
		const ml = fakeMlBridge({ artifactReady: false });

		const result = await ml.ensureDocParseReady();

		assert.deepStrictEqual(result, {
			ready: false,
			detail: 'Unlimited-OCR artifacts are not ready.',
		});
	});

	test('fake bridge default ensure succeeds when artifacts ready', async () => {
		const ml = fakeMlBridge({ artifactReady: true });

		const result = await ml.ensureDocParseReady();

		assert.strictEqual(result.ready, true);
	});
});

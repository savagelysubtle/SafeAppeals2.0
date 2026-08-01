/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { startOAuthLoopback } from '../oauthLoopback';

suite('oauthLoopback', () => {
	test('mismatched state returns 400 without settling; matching code succeeds', async () => {
		const loopback = await startOAuthLoopback({
			expectedState: 'good-state',
			finishUrl: 'https://safeappeals.com/auth/finish',
			port: 0,
			timeoutMs: 5_000,
		});

		try {
			let settledEarly = false;
			void loopback.code.then(
				() => { settledEarly = true; },
				() => { settledEarly = true; },
			);

			const bad = await fetch(`${loopback.redirectUri}?code=x&state=wrong`, { redirect: 'manual' });
			assert.strictEqual(bad.status, 400);
			await new Promise(resolve => setTimeout(resolve, 50));
			assert.strictEqual(settledEarly, false, 'promise must not settle on rejected state');

			const [result, ok] = await Promise.all([
				loopback.code,
				fetch(`${loopback.redirectUri}?code=the-code&state=good-state`, { redirect: 'manual' }),
			]);
			assert.strictEqual(ok.status, 302);
			assert.ok(String(ok.headers.get('location') || '').includes('status=success'));
			assert.deepStrictEqual(result, { code: 'the-code', state: 'good-state' });
		} finally {
			loopback.dispose();
		}
	});
});

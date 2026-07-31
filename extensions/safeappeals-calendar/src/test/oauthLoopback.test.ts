/*--- Ephemeral OAuth loopback + PKCE unit tests ---*/

import 'mocha';
import * as assert from 'assert';
import * as crypto from 'crypto';
import { createOAuthState, createPkcePair, startOAuthLoopback } from '../oauthLoopback';

suite('oauthLoopback', () => {
	test('startOAuthLoopback binds an ephemeral port and exposes redirect URI', async () => {
		const loopback = await startOAuthLoopback({ timeoutMs: 5_000 });
		const match = /^http:\/\/127\.0\.0\.1:(\d+)\/auth\/callback$/.exec(loopback.redirectUri);
		assert.ok(match, `unexpected redirect URI: ${loopback.redirectUri}`);
		const port = Number(match[1]);
		assert.ok(port > 0 && port !== 47294, `expected ephemeral port, got ${port}`);

		const codePromise = loopback.waitForCode;
		const res = await fetch(`${loopback.redirectUri}?code=test-code&state=ok`);
		assert.strictEqual(res.status, 200);
		const result = await codePromise;
		assert.deepStrictEqual(result, { code: 'test-code', state: 'ok' });
	});

	test('startOAuthLoopback with localhost hostname exposes localhost redirect URI', async () => {
		const loopback = await startOAuthLoopback({ hostname: 'localhost', timeoutMs: 5_000 });
		try {
			const match = /^http:\/\/localhost:(\d+)\/auth\/callback$/.exec(loopback.redirectUri);
			assert.ok(match, `unexpected redirect URI: ${loopback.redirectUri}`);
			assert.ok(Number(match[1]) > 0);
		} finally {
			loopback.close();
		}
	});

	test('startOAuthLoopback rejects wrong state and missing state', async () => {
		const expected = createOAuthState();
		const wrong = await startOAuthLoopback({ expectedState: expected, timeoutMs: 5_000 });
		const wrongRejected = assert.rejects(wrong.waitForCode, /invalid_state/);
		const wrongRes = await fetch(`${wrong.redirectUri}?code=x&state=wrong`);
		assert.strictEqual(wrongRes.status, 400);
		await wrongRejected;

		const missing = await startOAuthLoopback({ expectedState: expected, timeoutMs: 5_000 });
		const missingRejected = assert.rejects(missing.waitForCode, /invalid_state/);
		const missingRes = await fetch(`${missing.redirectUri}?code=x`);
		assert.strictEqual(missingRes.status, 400);
		await missingRejected;
	});

	test('close() cancels waitForCode and stops the listener', async () => {
		const loopback = await startOAuthLoopback({ timeoutMs: 60_000 });
		const rejected = assert.rejects(loopback.waitForCode, /OAuth loopback closed/);
		loopback.close();
		await rejected;
		loopback.close(); // idempotent
	});

	test('createPkcePair produces S256 challenge matching verifier', () => {
		const { verifier, challenge } = createPkcePair();
		assert.ok(verifier.length >= 43);
		assert.ok(challenge.length >= 43);
		const expected = crypto.createHash('sha256').update(verifier).digest('base64')
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '');
		assert.strictEqual(challenge, expected);
	});
});

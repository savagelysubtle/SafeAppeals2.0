/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { parseOrphanedAuthCode } from '../orphanedAuthCode';

suite('parseOrphanedAuthCode', () => {
	const now = 1_700_000_000_000;
	const maxAgeMs = 5 * 60 * 1000;

	test('restores a fresh orphaned code payload', () => {
		const raw = JSON.stringify({
			code: 'auth-code',
			state: 'state-1',
			ts: now - 60_000,
		});
		assert.deepStrictEqual(parseOrphanedAuthCode(raw, now, maxAgeMs), {
			code: 'auth-code',
			state: 'state-1',
			ts: now - 60_000,
		});
	});

	test('accepts an already-parsed object', () => {
		assert.deepStrictEqual(parseOrphanedAuthCode({
			code: 'auth-code',
			state: 'state-1',
			ts: now - 1_000,
		}, now, maxAgeMs), {
			code: 'auth-code',
			state: 'state-1',
			ts: now - 1_000,
		});
	});

	test('rejects expired orphaned code', () => {
		const raw = JSON.stringify({
			code: 'auth-code',
			state: 'state-1',
			ts: now - maxAgeMs - 1,
		});
		assert.strictEqual(parseOrphanedAuthCode(raw, now, maxAgeMs), undefined);
	});

	test('rejects malformed or missing fields', () => {
		assert.strictEqual(parseOrphanedAuthCode(undefined, now, maxAgeMs), undefined);
		assert.strictEqual(parseOrphanedAuthCode('{', now, maxAgeMs), undefined);
		assert.strictEqual(parseOrphanedAuthCode(JSON.stringify({
			code: '',
			state: 's',
			ts: now,
		}), now, maxAgeMs), undefined);
		assert.strictEqual(parseOrphanedAuthCode(JSON.stringify({
			code: 'c',
			state: 's',
		}), now, maxAgeMs), undefined);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	parseRestoredPendingSignIn,
	pickNewestPending,
	shouldSettlePendingOnExchangeFailure,
} from '../pendingSignIn';

suite('shouldSettlePendingOnExchangeFailure', () => {
	test('settles only when state matched', () => {
		assert.deepStrictEqual(
			{
				matched: shouldSettlePendingOnExchangeFailure(true),
				mismatched: shouldSettlePendingOnExchangeFailure(false),
			},
			{ matched: true, mismatched: false },
		);
	});
});

suite('parseRestoredPendingSignIn', () => {
	const now = 1_700_000_000_000;
	const maxAgeMs = 5 * 60 * 1000;

	test('restores a fresh pending payload', () => {
		const raw = JSON.stringify({
			codeVerifier: 'verifier',
			state: 'state-1',
			startedAt: now - 60_000,
		});
		assert.deepStrictEqual(parseRestoredPendingSignIn(raw, now, maxAgeMs), {
			codeVerifier: 'verifier',
			state: 'state-1',
			startedAt: now - 60_000,
		});
	});

	test('rejects expired pending', () => {
		const raw = JSON.stringify({
			codeVerifier: 'verifier',
			state: 'state-1',
			startedAt: now - maxAgeMs - 1,
		});
		assert.strictEqual(parseRestoredPendingSignIn(raw, now, maxAgeMs), undefined);
	});

	test('rejects malformed or missing fields', () => {
		assert.strictEqual(parseRestoredPendingSignIn(undefined, now, maxAgeMs), undefined);
		assert.strictEqual(parseRestoredPendingSignIn('{', now, maxAgeMs), undefined);
		assert.strictEqual(parseRestoredPendingSignIn(JSON.stringify({
			codeVerifier: '',
			state: 's',
			startedAt: now,
		}), now, maxAgeMs), undefined);
		assert.strictEqual(parseRestoredPendingSignIn(JSON.stringify({
			codeVerifier: 'v',
			state: 's',
		}), now, maxAgeMs), undefined);
	});
});

suite('pickNewestPending', () => {
	const older = {
		pending: { codeVerifier: 'old-v', state: 'old-s', startedAt: 100 },
		source: 'secrets' as const,
	};
	const newer = {
		pending: { codeVerifier: 'new-v', state: 'new-s', startedAt: 200 },
		source: 'localStorage' as const,
	};
	const sameAgeSecrets = {
		pending: { codeVerifier: 'sec-v', state: 'sec-s', startedAt: 200 },
		source: 'secrets' as const,
	};
	const sameAgeLs = {
		pending: { codeVerifier: 'ls-v', state: 'ls-s', startedAt: 200 },
		source: 'localStorage' as const,
	};

	test('picks the latest startedAt and prefers localStorage on ties', () => {
		assert.deepStrictEqual(
			{
				newest: pickNewestPending([older, newer, undefined])?.source,
				tie: pickNewestPending([sameAgeSecrets, sameAgeLs])?.source,
				empty: pickNewestPending([undefined, undefined]),
			},
			{ newest: 'localStorage', tie: 'localStorage', empty: undefined },
		);
	});
});

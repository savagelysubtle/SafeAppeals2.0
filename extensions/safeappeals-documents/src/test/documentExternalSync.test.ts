/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	EXTERNAL_RELOAD_SETTLE_MS,
	isWithinLoadSettleWindow,
	nextIgnoreDirtyUntil,
	settleTimerClearsExternalSyncAuthority,
	shouldApplyWebviewDocumentBytes,
	shouldSkipWebviewSerialize,
} from '../documentExternalSync';

suite('documentExternalSync save contract', () => {
	test('after reloadFromBytes, save must skip pre-reload webview serialize', () => {
		assert.deepStrictEqual(
			{
				afterExternalSync: shouldSkipWebviewSerialize({
					freshFromWebview: false,
					freshFromExternalSync: true,
				}),
				afterWebviewSave: shouldSkipWebviewSerialize({
					freshFromWebview: true,
					freshFromExternalSync: false,
				}),
				normalSave: shouldSkipWebviewSerialize({
					freshFromWebview: false,
					freshFromExternalSync: false,
				}),
				bothFlags: shouldSkipWebviewSerialize({
					freshFromWebview: true,
					freshFromExternalSync: true,
				}),
			},
			{
				afterExternalSync: true,
				afterWebviewSave: true,
				normalSave: false,
				bothFlags: true,
			},
		);
	});

	test('contentChanged/saveRequested cannot overwrite host while external sync flag set', () => {
		assert.deepStrictEqual(
			{
				whileExternalSync: shouldApplyWebviewDocumentBytes({ freshFromExternalSync: true }),
				afterFlagCleared: shouldApplyWebviewDocumentBytes({ freshFromExternalSync: false }),
			},
			{
				whileExternalSync: false,
				afterFlagCleared: true,
			},
		);
	});

	test('settle timer clears dirty-ignore only, not authority flag', () => {
		const now = 1_000_000;
		const until = nextIgnoreDirtyUntil(now);
		// After settle elapses, dirty-ignore expires but authority remains until saveAs/dispose.
		assert.deepStrictEqual(
			{
				settleTimerClearsAuthority: settleTimerClearsExternalSyncAuthority(),
				dirtyIgnoreExpired: isWithinLoadSettleWindow(until, until),
				authorityStillBlocksWebview: shouldApplyWebviewDocumentBytes({
					freshFromExternalSync: true,
				}),
				authorityStillSkipsSerialize: shouldSkipWebviewSerialize({
					freshFromWebview: false,
					freshFromExternalSync: true,
				}),
			},
			{
				settleTimerClearsAuthority: false,
				dirtyIgnoreExpired: false,
				authorityStillBlocksWebview: false,
				authorityStillSkipsSerialize: true,
			},
		);
	});

	test('load settle window suppresses dirty until timeout', () => {
		const now = 1_000_000;
		const until = nextIgnoreDirtyUntil(now);
		assert.strictEqual(until, now + EXTERNAL_RELOAD_SETTLE_MS);
		assert.strictEqual(isWithinLoadSettleWindow(until, now), true);
		assert.strictEqual(isWithinLoadSettleWindow(until, now + EXTERNAL_RELOAD_SETTLE_MS - 1), true);
		assert.strictEqual(isWithinLoadSettleWindow(until, until), false);
	});
});

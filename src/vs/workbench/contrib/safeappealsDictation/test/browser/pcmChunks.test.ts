/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { encodeBase64, VSBuffer } from '../../../../../base/common/buffer.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { concatPcm16Base64Chunks } from '../../browser/pcmChunks.js';

suite('concatPcm16Base64Chunks', () => {

	ensureNoDisposablesAreLeakedInTestSuite();

	test('returns empty string for no chunks', () => {
		assert.strictEqual(concatPcm16Base64Chunks([]), '');
	});

	test('returns single chunk unchanged', () => {
		const chunk = encodeBase64(VSBuffer.fromString('abcd'));
		assert.strictEqual(concatPcm16Base64Chunks([chunk]), chunk);
	});

	test('concatenates multiple PCM16 base64 chunks', () => {
		const a = VSBuffer.wrap(new Uint8Array([0x01, 0x02]));
		const b = VSBuffer.wrap(new Uint8Array([0x03, 0x04, 0x05]));
		const c = VSBuffer.wrap(new Uint8Array([0x06]));
		const result = concatPcm16Base64Chunks([
			encodeBase64(a),
			encodeBase64(b),
			encodeBase64(c),
		]);
		assert.strictEqual(result, encodeBase64(VSBuffer.concat([a, b, c])));
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	WHISPER_PCM_SAMPLE_RATE,
	int16ToPcmf32,
	pcm16Base64ToInt16,
	pcm16Base64ToPcmf32,
	resampleTo16kMono,
} from '../pcm16';

function encodePcm16Base64(samples: number[]): string {
	const bytes = Buffer.alloc(samples.length * 2);
	for (let i = 0; i < samples.length; i++) {
		bytes.writeInt16LE(samples[i]!, i * 2);
	}
	return bytes.toString('base64');
}

suite('pcm16', () => {
	test('pcm16Base64ToInt16 decodes little-endian Int16', () => {
		const base64 = encodePcm16Base64([1000, -1000, 0, 32767]);
		const samples = pcm16Base64ToInt16(base64);
		assert.deepStrictEqual([...samples], [1000, -1000, 0, 32767]);
	});

	test('int16ToPcmf32 scales by /32768', () => {
		const pcm = int16ToPcmf32(Int16Array.from([1000, -1000]));
		assert.ok(Math.abs(pcm[0]! - 1000 / 32768) < 1e-9);
		assert.ok(Math.abs(pcm[1]! - -1000 / 32768) < 1e-9);
	});

	test('pcm16Base64ToPcmf32 at 16 kHz does not resample', () => {
		const base64 = encodePcm16Base64([1000, -1000, 500, -500]);
		const pcm = pcm16Base64ToPcmf32(base64, WHISPER_PCM_SAMPLE_RATE);
		assert.strictEqual(pcm.length, 4);
		assert.ok(Math.abs(pcm[0]! - 1000 / 32768) < 1e-9);
	});

	test('resampleTo16kMono halves length when downsampling 32 kHz → 16 kHz', () => {
		const input = new Float32Array(8);
		for (let i = 0; i < input.length; i++) {
			input[i] = i / 10;
		}
		const out = resampleTo16kMono(input, 32_000);
		assert.strictEqual(out.length, 4);
		assert.ok(Math.abs(out[0]! - 0) < 1e-6);
		assert.ok(Math.abs(out[1]! - 0.2) < 1e-6);
	});

	test('pcm16Base64ToPcmf32 resamples 48 kHz → 16 kHz', () => {
		// 48 samples at 48 kHz ≈ 1 ms → ~16 samples at 16 kHz
		const samples = Array.from({ length: 48 }, (_, i) => (i % 2 === 0 ? 1000 : -1000));
		const pcm = pcm16Base64ToPcmf32(encodePcm16Base64(samples), 48_000);
		assert.strictEqual(pcm.length, 16);
	});

	test('rejects non-positive sampleRate', () => {
		assert.throws(
			() => pcm16Base64ToPcmf32(encodePcm16Base64([1]), 0),
			/Invalid sample rate/,
		);
	});
});

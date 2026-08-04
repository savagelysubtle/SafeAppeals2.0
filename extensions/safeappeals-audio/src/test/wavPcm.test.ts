/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { WHISPER_PCM_SAMPLE_RATE, wavBytesToPcmf32 } from '../wavPcm';

function buildPcm16Wav(options: {
	sampleRate: number;
	channels: number;
	samplesPerChannel: number;
}): Buffer {
	const { sampleRate, channels, samplesPerChannel } = options;
	const dataSize = samplesPerChannel * channels * 2;
	const bytes = Buffer.alloc(44 + dataSize);
	bytes.write('RIFF', 0, 'ascii');
	bytes.writeUInt32LE(36 + dataSize, 4);
	bytes.write('WAVE', 8, 'ascii');
	bytes.write('fmt ', 12, 'ascii');
	bytes.writeUInt32LE(16, 16);
	bytes.writeUInt16LE(1, 20); // PCM
	bytes.writeUInt16LE(channels, 22);
	bytes.writeUInt32LE(sampleRate, 24);
	bytes.writeUInt32LE(sampleRate * channels * 2, 28);
	bytes.writeUInt16LE(channels * 2, 32);
	bytes.writeUInt16LE(16, 34);
	bytes.write('data', 36, 'ascii');
	bytes.writeUInt32LE(dataSize, 40);
	for (let i = 0; i < samplesPerChannel * channels; i++) {
		bytes.writeInt16LE(i % 2 === 0 ? 1000 : -1000, 44 + i * 2);
	}
	return bytes;
}

suite('wavBytesToPcmf32', () => {
	test('decodes 16 kHz mono PCM16', () => {
		const wav = buildPcm16Wav({
			sampleRate: WHISPER_PCM_SAMPLE_RATE,
			channels: 1,
			samplesPerChannel: 4,
		});
		const pcm = wavBytesToPcmf32(wav);
		assert.ok(pcm);
		assert.strictEqual(pcm!.length, 4);
		assert.ok(Math.abs(pcm![0]! - 1000 / 32768) < 1e-6);
	});

	test('rejects 44.1 kHz WAV (must resample before Whisper)', () => {
		const wav = buildPcm16Wav({
			sampleRate: 44_100,
			channels: 1,
			samplesPerChannel: 4,
		});
		assert.strictEqual(wavBytesToPcmf32(wav), undefined);
	});

	test('rejects 48 kHz stereo WAV', () => {
		const wav = buildPcm16Wav({
			sampleRate: 48_000,
			channels: 2,
			samplesPerChannel: 4,
		});
		assert.strictEqual(wavBytesToPcmf32(wav), undefined);
	});

	test('downmixes 16 kHz stereo to mono', () => {
		const wav = buildPcm16Wav({
			sampleRate: WHISPER_PCM_SAMPLE_RATE,
			channels: 2,
			samplesPerChannel: 2,
		});
		const pcm = wavBytesToPcmf32(wav);
		assert.ok(pcm);
		assert.strictEqual(pcm!.length, 2);
	});
});

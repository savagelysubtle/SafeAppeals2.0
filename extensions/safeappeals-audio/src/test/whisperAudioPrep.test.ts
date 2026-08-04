/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as path from 'node:path';
import { WHISPER_PCM_SAMPLE_RATE } from '../wavPcm';
import {
	FFMPEG_REQUIRED_FOR_WHISPER_MSG,
	isRiffWave,
	prepareWhisperInput,
	shouldAttemptPcmf32,
	sourceExtensionForAudio,
} from '../whisperAudioPrep';

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

suite('whisperAudioPrep', () => {
	test('isRiffWave detects RIFF/WAVE header', () => {
		const wav = buildPcm16Wav({
			sampleRate: WHISPER_PCM_SAMPLE_RATE,
			channels: 1,
			samplesPerChannel: 2,
		});
		assert.strictEqual(isRiffWave(wav), true);
		assert.strictEqual(isRiffWave(Buffer.from('not-a-wav')), false);
	});

	test('shouldAttemptPcmf32: RIFF header wins over .mp3 name; .wav name also attempts', () => {
		const wav = buildPcm16Wav({
			sampleRate: WHISPER_PCM_SAMPLE_RATE,
			channels: 1,
			samplesPerChannel: 2,
		});
		assert.strictEqual(shouldAttemptPcmf32(wav, 'misnamed.mp3'), true);
		assert.strictEqual(shouldAttemptPcmf32(Buffer.from('fake-mp3'), 'capture.wav'), true);
		assert.strictEqual(shouldAttemptPcmf32(Buffer.from('fake-mp3'), 'capture.mp3'), false);
	});

	test('16 kHz PCM WAV → pcmf32, no ffmpeg call', async () => {
		const wav = buildPcm16Wav({
			sampleRate: WHISPER_PCM_SAMPLE_RATE,
			channels: 1,
			samplesPerChannel: 4,
		});
		let convertCalls = 0;
		let writeCalls = 0;
		const result = await prepareWhisperInput({
			audioBytes: wav,
			filename: 'clip.wav',
			mimeType: 'audio/wav',
			tmpDir: '/tmp/sa-audio-test',
			id: 'rec1',
			ffmpegAvailable: false,
			convertToWhisperWav: async () => {
				convertCalls++;
			},
			writeFile: async () => {
				writeCalls++;
			},
		});
		assert.strictEqual(result.input.kind, 'pcmf32');
		if (result.input.kind === 'pcmf32') {
			assert.strictEqual(result.input.pcmf32.length, 4);
		}
		assert.deepStrictEqual(result.tmpPaths, []);
		assert.strictEqual(convertCalls, 0);
		assert.strictEqual(writeCalls, 0);
	});

	test('misnamed .mp3 that is RIFF 16 kHz PCM → pcmf32 (header wins)', async () => {
		const wav = buildPcm16Wav({
			sampleRate: WHISPER_PCM_SAMPLE_RATE,
			channels: 1,
			samplesPerChannel: 2,
		});
		let convertCalls = 0;
		const result = await prepareWhisperInput({
			audioBytes: wav,
			filename: 'clip.mp3',
			mimeType: 'audio/mpeg',
			tmpDir: '/tmp/sa-audio-test',
			id: 'rec-misnamed',
			ffmpegAvailable: true,
			convertToWhisperWav: async () => {
				convertCalls++;
			},
			writeFile: async () => { },
		});
		assert.strictEqual(result.input.kind, 'pcmf32');
		assert.strictEqual(convertCalls, 0);
	});

	test('44.1 kHz WAV → convertToWhisperWav, returns wavPath', async () => {
		const wav = buildPcm16Wav({
			sampleRate: 44_100,
			channels: 1,
			samplesPerChannel: 4,
		});
		const written: Array<{ path: string; bytes: Buffer }> = [];
		let convertFrom: string | undefined;
		let convertTo: string | undefined;
		const result = await prepareWhisperInput({
			audioBytes: wav,
			filename: 'clip.wav',
			mimeType: 'audio/wav',
			tmpDir: '/tmp/sa-audio-test',
			id: 'rec441',
			ffmpegAvailable: true,
			convertToWhisperWav: async (inputPath, outputWavPath) => {
				convertFrom = inputPath;
				convertTo = outputWavPath;
			},
			writeFile: async (filePath, data) => {
				written.push({ path: filePath, bytes: data });
			},
		});
		assert.strictEqual(result.input.kind, 'wavPath');
		if (result.input.kind === 'wavPath') {
			assert.strictEqual(result.input.wavPath, path.join('/tmp/sa-audio-test', 'rec441-whisper.wav'));
		}
		assert.strictEqual(written.length, 1);
		assert.strictEqual(written[0]!.path, path.join('/tmp/sa-audio-test', 'rec441-source.wav'));
		assert.strictEqual(convertFrom, written[0]!.path);
		assert.strictEqual(convertTo, path.join('/tmp/sa-audio-test', 'rec441-whisper.wav'));
		assert.deepStrictEqual(result.tmpPaths, [
			path.join('/tmp/sa-audio-test', 'rec441-source.wav'),
			path.join('/tmp/sa-audio-test', 'rec441-whisper.wav'),
		]);
	});

	for (const filename of ['a.mp3', 'a.webm', 'a.m4a', 'a.flac', 'a.ogg'] as const) {
		test(`${filename} → convertToWhisperWav`, async () => {
			const bytes = Buffer.from('fake-compressed-audio');
			let convertCalls = 0;
			const result = await prepareWhisperInput({
				audioBytes: bytes,
				filename,
				mimeType: 'application/octet-stream',
				tmpDir: '/tmp/sa-audio-test',
				id: `id-${path.extname(filename).slice(1)}`,
				ffmpegAvailable: true,
				convertToWhisperWav: async () => {
					convertCalls++;
				},
				writeFile: async () => { },
			});
			assert.strictEqual(result.input.kind, 'wavPath');
			assert.strictEqual(convertCalls, 1);
			assert.ok(result.tmpPaths.some(p => p.endsWith(`-source${path.extname(filename)}`)));
		});
	}

	test('44.1 kHz WAV + ffmpeg unavailable → throws; does not return raw wavPath', async () => {
		const wav = buildPcm16Wav({
			sampleRate: 44_100,
			channels: 1,
			samplesPerChannel: 4,
		});
		let convertCalls = 0;
		await assert.rejects(
			() => prepareWhisperInput({
				audioBytes: wav,
				filename: 'clip.wav',
				mimeType: 'audio/wav',
				tmpDir: '/tmp/sa-audio-test',
				id: 'rec-no-ff',
				ffmpegAvailable: false,
				convertToWhisperWav: async () => {
					convertCalls++;
				},
				writeFile: async () => { },
			}),
			(error: unknown) => {
				assert.ok(error instanceof Error);
				assert.strictEqual(error.message, FFMPEG_REQUIRED_FOR_WHISPER_MSG);
				assert.match(error.message, /Non-16 kHz WAV/);
				return true;
			},
		);
		assert.strictEqual(convertCalls, 0);
	});

	test('sourceExtensionForAudio prefers filename then mime', () => {
		assert.strictEqual(sourceExtensionForAudio('note.flac', 'audio/mpeg'), '.flac');
		assert.strictEqual(sourceExtensionForAudio('note', 'audio/mpeg'), '.mp3');
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { WHISPER_PCM_SAMPLE_RATE } from './wavPcm';

export { WHISPER_PCM_SAMPLE_RATE };

/**
 * Decode base64 little-endian Int16 PCM (no WAV header) to an Int16Array.
 */
export function pcm16Base64ToInt16(base64: string): Int16Array {
	const bytes = Buffer.from(base64, 'base64');
	const sampleCount = Math.floor(bytes.byteLength / 2);
	const samples = new Int16Array(sampleCount);
	for (let i = 0; i < sampleCount; i++) {
		samples[i] = bytes.readInt16LE(i * 2);
	}
	return samples;
}

/**
 * Convert Int16 PCM samples to Float32 in [-1, 1) via `/ 32768`
 * (matches {@link wavBytesToPcmf32} Int16 path).
 */
export function int16ToPcmf32(samples: Int16Array): Float32Array {
	const out = new Float32Array(samples.length);
	for (let i = 0; i < samples.length; i++) {
		out[i] = samples[i]! / 32768;
	}
	return out;
}

/**
 * Linear-resample mono Float32 audio to {@link WHISPER_PCM_SAMPLE_RATE}.
 * Returns `input` unchanged when already at 16 kHz (or empty).
 */
export function resampleTo16kMono(input: Float32Array, sampleRate: number): Float32Array {
	if (input.length === 0 || sampleRate === WHISPER_PCM_SAMPLE_RATE) {
		return input;
	}
	if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
		throw new Error(`Invalid sample rate for resample: ${sampleRate}`);
	}

	const outLength = Math.max(1, Math.round((input.length * WHISPER_PCM_SAMPLE_RATE) / sampleRate));
	const out = new Float32Array(outLength);
	const ratio = sampleRate / WHISPER_PCM_SAMPLE_RATE;
	const last = input.length - 1;
	for (let i = 0; i < outLength; i++) {
		const srcIndex = i * ratio;
		const i0 = Math.floor(srcIndex);
		const i1 = Math.min(i0 + 1, last);
		const frac = srcIndex - i0;
		const s0 = input[i0] ?? 0;
		const s1 = input[i1] ?? s0;
		out[i] = s0 + (s1 - s0) * frac;
	}
	return out;
}

/**
 * Decode mic/chunk base64 Int16LE PCM to 16 kHz mono Float32 for kutalia `pcmf32`.
 * Linear-resamples when `sampleRate !== 16000`.
 */
export function pcm16Base64ToPcmf32(base64: string, sampleRate: number): Float32Array {
	if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
		throw new Error(`Invalid sample rate: ${sampleRate}`);
	}
	const int16 = pcm16Base64ToInt16(base64);
	const pcmf32 = int16ToPcmf32(int16);
	return resampleTo16kMono(pcmf32, sampleRate);
}

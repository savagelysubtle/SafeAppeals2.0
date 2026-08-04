/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/** Whisper / kutalia `pcmf32` input must be 16 kHz mono float samples. */
export const WHISPER_PCM_SAMPLE_RATE = 16_000;

/**
 * Decode a PCM WAV buffer to mono Float32 samples for kutalia `pcmf32`.
 * Returns undefined when the container is not a supported 16 kHz PCM WAV.
 *
 * Non-16 kHz WAVs must be resampled (ffmpeg) before Whisper — passing native-rate
 * pcmf32 makes speech sound like noise and triggers non-speech hallucinations
 * ("(grunting)", "(growling)", "[Barking]", …).
 */
export function wavBytesToPcmf32(bytes: Buffer): Float32Array | undefined {
	if (bytes.length < 44) {
		return undefined;
	}
	if (bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WAVE') {
		return undefined;
	}

	let offset = 12;
	let audioFormat = 0;
	let channels = 0;
	let sampleRate = 0;
	let bitsPerSample = 0;
	let dataOffset = -1;
	let dataSize = 0;

	while (offset + 8 <= bytes.length) {
		const chunkId = bytes.toString('ascii', offset, offset + 4);
		const chunkSize = bytes.readUInt32LE(offset + 4);
		const chunkData = offset + 8;
		if (chunkId === 'fmt ' && chunkSize >= 16) {
			audioFormat = bytes.readUInt16LE(chunkData);
			channels = bytes.readUInt16LE(chunkData + 2);
			sampleRate = bytes.readUInt32LE(chunkData + 4);
			bitsPerSample = bytes.readUInt16LE(chunkData + 14);
		} else if (chunkId === 'data') {
			dataOffset = chunkData;
			dataSize = chunkSize;
			break;
		}
		offset = chunkData + chunkSize + (chunkSize % 2);
	}

	if (dataOffset < 0 || audioFormat !== 1 || (bitsPerSample !== 16 && bitsPerSample !== 32)) {
		return undefined;
	}
	if (channels < 1 || sampleRate !== WHISPER_PCM_SAMPLE_RATE) {
		return undefined;
	}

	const end = Math.min(bytes.length, dataOffset + dataSize);
	if (bitsPerSample === 16) {
		const frameCount = Math.floor((end - dataOffset) / (2 * channels));
		const out = new Float32Array(frameCount);
		for (let i = 0; i < frameCount; i++) {
			let sample = 0;
			for (let ch = 0; ch < channels; ch++) {
				sample += bytes.readInt16LE(dataOffset + (i * channels + ch) * 2);
			}
			out[i] = (sample / channels) / 32768;
		}
		return out;
	}

	const frameCount = Math.floor((end - dataOffset) / (4 * channels));
	const out = new Float32Array(frameCount);
	for (let i = 0; i < frameCount; i++) {
		let sample = 0;
		for (let ch = 0; ch < channels; ch++) {
			sample += bytes.readInt32LE(dataOffset + (i * channels + ch) * 4);
		}
		out[i] = (sample / channels) / 2147483648;
	}
	return out;
}

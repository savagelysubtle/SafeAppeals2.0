/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import { deleteFileIfExists } from './shared/secureFs';
import { wavBytesToPcmf32 } from './wavPcm';
import type { WhisperAudioInput } from './whisperHost';

/** Clear error when ffmpeg is required to normalize audio for Whisper. */
export const FFMPEG_REQUIRED_FOR_WHISPER_MSG =
	'ffmpeg is required to prepare audio for Whisper. Non-16 kHz WAV and all non-WAV formats must be converted to 16 kHz mono PCM. Install ffmpeg or set safeappeals.audio.ffmpegPath.';

export interface PrepareWhisperInputOptions {
	readonly audioBytes: Buffer;
	readonly filename: string;
	readonly mimeType: string;
	readonly tmpDir: string;
	/** Unique prefix for temp filenames (e.g. recording id). */
	readonly id: string;
	readonly ffmpegAvailable: boolean;
	readonly convertToWhisperWav: (inputPath: string, outputWavPath: string) => Promise<void>;
	readonly writeFile: (filePath: string, data: Buffer) => Promise<void>;
}

export interface PrepareWhisperInputResult {
	readonly input: WhisperAudioInput;
	readonly tmpPaths: string[];
}

/**
 * True when bytes begin with a RIFF/WAVE header (extension is not trusted alone).
 */
export function isRiffWave(bytes: Buffer): boolean {
	return bytes.length >= 12
		&& bytes.toString('ascii', 0, 4) === 'RIFF'
		&& bytes.toString('ascii', 8, 12) === 'WAVE';
}

/**
 * Attempt in-memory pcmf32 only for WAV-looking content (RIFF/WAVE header or `.wav` name).
 * Header wins for misnamed files (e.g. 16 kHz PCM RIFF bytes named `.mp3`).
 */
export function shouldAttemptPcmf32(audioBytes: Buffer, filename: string): boolean {
	return isRiffWave(audioBytes) || path.extname(filename).toLowerCase() === '.wav';
}

/**
 * Resolve a source file extension from filename, else mime type.
 */
export function sourceExtensionForAudio(filename: string, mimeType: string): string {
	const fromName = path.extname(filename).toLowerCase();
	if (fromName) {
		return fromName;
	}
	return extForMime(mimeType);
}

/**
 * Prepare Whisper input so only verified 16 kHz PCM reaches `pcmf32`.
 * Every other case writes managed tmp + ffmpeg-normalizes to 16 kHz mono pcm_s16le.
 * Never returns a raw source path for Whisper (`fname_inp`) without conversion.
 */
export async function prepareWhisperInput(
	options: PrepareWhisperInputOptions,
): Promise<PrepareWhisperInputResult> {
	const {
		audioBytes,
		filename,
		mimeType,
		tmpDir,
		id,
		ffmpegAvailable,
		convertToWhisperWav,
		writeFile,
	} = options;

	if (shouldAttemptPcmf32(audioBytes, filename)) {
		const pcmf32 = wavBytesToPcmf32(audioBytes);
		if (pcmf32) {
			return { input: { kind: 'pcmf32', pcmf32 }, tmpPaths: [] };
		}
	}

	if (!ffmpegAvailable) {
		throw new Error(FFMPEG_REQUIRED_FOR_WHISPER_MSG);
	}

	const tmpPaths: string[] = [];
	try {
		const sourceExt = sourceExtensionForAudio(filename, mimeType);
		const sourcePath = path.join(tmpDir, `${id}-source${sourceExt}`);
		await writeFile(sourcePath, audioBytes);
		tmpPaths.push(sourcePath);

		const wavPath = path.join(tmpDir, `${id}-whisper.wav`);
		await convertToWhisperWav(sourcePath, wavPath);
		tmpPaths.push(wavPath);

		return { input: { kind: 'wavPath', wavPath }, tmpPaths };
	} catch (error) {
		for (const tmpPath of tmpPaths) {
			await deleteFileIfExists(tmpPath);
		}
		throw error;
	}
}

function extForMime(mimeType: string): string {
	if (mimeType.includes('wav')) {
		return '.wav';
	}
	if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
		return '.mp3';
	}
	if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
		return '.m4a';
	}
	if (mimeType.includes('ogg')) {
		return '.ogg';
	}
	if (mimeType.includes('flac')) {
		return '.flac';
	}
	return '.webm';
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';

const execFileAsync = promisify(execFile);

export interface BinaryProbe {
	readonly available: boolean;
	readonly path?: string;
	readonly detail?: string;
}

export type AudioExportFormat = 'wav' | 'flac' | 'mp3' | 'm4a';

/**
 * Codec args for user-facing audio export (preserve rate/channels; not Whisper 16 kHz mono).
 */
export function exportFormatFfmpegArgs(format: AudioExportFormat): string[] {
	switch (format) {
		case 'wav':
			return ['-c:a', 'pcm_s16le'];
		case 'flac':
			return ['-c:a', 'flac'];
		case 'mp3':
			return ['-c:a', 'libmp3lame', '-q:a', '2'];
		case 'm4a':
			return ['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'];
	}
}

/**
 * BYO ffmpeg/ffprobe detection and convert-to-Whisper-WAV helpers.
 * Hard-disables non-WAV convert when ffmpeg is missing (never soft-fallback).
 */
export class FfmpegHost {
	private ffmpeg: BinaryProbe = { available: false, detail: 'Not probed' };
	private ffprobe: BinaryProbe = { available: false, detail: 'Not probed' };

	constructor(private readonly log: (message: string) => void) { }

	async refresh(): Promise<{ ffmpeg: BinaryProbe; ffprobe: BinaryProbe }> {
		this.ffmpeg = await resolveBinary('ffmpeg', 'safeappeals.audio.ffmpegPath');
		this.ffprobe = await resolveBinary('ffprobe', 'safeappeals.audio.ffprobePath');
		this.log(
			this.ffmpeg.available
				? `ffmpeg: ${this.ffmpeg.path ?? 'available'}`
				: `ffmpeg unavailable: ${this.ffmpeg.detail ?? 'missing'}`,
		);
		return { ffmpeg: this.ffmpeg, ffprobe: this.ffprobe };
	}

	getFfmpeg(): BinaryProbe {
		return this.ffmpeg;
	}

	getFfprobe(): BinaryProbe {
		return this.ffprobe;
	}

	isAvailable(): boolean {
		return this.ffmpeg.available;
	}

	/**
	 * True when the file must be converted before Whisper (anything that is not `.wav`).
	 */
	static needsConversion(filename: string): boolean {
		return path.extname(filename).toLowerCase() !== '.wav';
	}

	/**
	 * Convert input audio to 16 kHz mono PCM WAV for Whisper.
	 * Throws when ffmpeg is unavailable — callers must hard-disable beforehand.
	 */
	async convertToWhisperWav(inputPath: string, outputWavPath: string): Promise<void> {
		if (!this.ffmpeg.available || !this.ffmpeg.path) {
			throw new Error(
				this.ffmpeg.detail
				?? 'ffmpeg is required to prepare audio for Whisper. Non-16 kHz WAV and all non-WAV formats must be converted to 16 kHz mono PCM. Install ffmpeg or set safeappeals.audio.ffmpegPath.',
			);
		}
		const ffmpegPath = this.ffmpeg.path;
		try {
			await execFileAsync(ffmpegPath, [
				'-y',
				'-i', inputPath,
				'-ar', '16000',
				'-ac', '1',
				'-c:a', 'pcm_s16le',
				outputWavPath,
			], {
				timeout: 10 * 60 * 1000,
				maxBuffer: 4 * 1024 * 1024,
			});
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			throw new Error(`ffmpeg conversion failed: ${detail}`);
		}
	}

	/**
	 * Convert input audio to a user-facing export format (preserve sample rate / channels).
	 * Throws when ffmpeg is unavailable — callers must gate beforehand.
	 */
	async convertToExportFormat(
		inputPath: string,
		outputPath: string,
		format: AudioExportFormat,
	): Promise<void> {
		if (!this.ffmpeg.available || !this.ffmpeg.path) {
			throw new Error(
				this.ffmpeg.detail
				?? 'ffmpeg is required to convert audio for export. Install ffmpeg or set safeappeals.audio.ffmpegPath.',
			);
		}
		const ffmpegPath = this.ffmpeg.path;
		try {
			await execFileAsync(ffmpegPath, [
				'-y',
				'-i', inputPath,
				...exportFormatFfmpegArgs(format),
				outputPath,
			], {
				timeout: 10 * 60 * 1000,
				maxBuffer: 4 * 1024 * 1024,
			});
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			throw new Error(`ffmpeg export conversion failed: ${detail}`);
		}
	}

	/**
	 * Probe duration in seconds via ffprobe. Returns 0 when ffprobe is unavailable.
	 */
	async probeDuration(inputPath: string): Promise<number> {
		if (!this.ffprobe.available || !this.ffprobe.path) {
			return 0;
		}
		try {
			const { stdout } = await execFileAsync(this.ffprobe.path, [
				'-v', 'error',
				'-show_entries', 'format=duration',
				'-of', 'default=noprint_wrappers=1:nokey=1',
				inputPath,
			], {
				timeout: 30_000,
				maxBuffer: 256 * 1024,
			});
			const value = Number.parseFloat(stdout.trim());
			return Number.isFinite(value) ? value : 0;
		} catch (error) {
			this.log(`ffprobe duration failed: ${error instanceof Error ? error.message : String(error)}`);
			return 0;
		}
	}
}

export async function resolveBinary(
	defaultName: string,
	settingKey: string,
): Promise<BinaryProbe> {
	const configured = vscode.workspace.getConfiguration().get<string>(settingKey, '')?.trim();
	const candidates = configured ? [configured] : [defaultName];

	for (const candidate of candidates) {
		if (path.isAbsolute(candidate)) {
			try {
				await access(candidate, fsConstants.X_OK);
				return { available: true, path: candidate };
			} catch {
				return {
					available: false,
					detail: `Configured ${defaultName} path is not executable: ${candidate}`,
				};
			}
		}

		try {
			const { stdout } = await execFileAsync(candidate, ['-version'], {
				timeout: 5000,
				maxBuffer: 256 * 1024,
			});
			const firstLine = stdout.split('\n')[0]?.trim();
			return {
				available: true,
				path: candidate,
				detail: firstLine || `${defaultName} available on PATH`,
			};
		} catch (error) {
			if (configured) {
				return {
					available: false,
					detail: error instanceof Error ? error.message : String(error),
				};
			}
		}
	}

	return {
		available: false,
		detail: missingBinaryDetail(defaultName, settingKey),
	};
}

function missingBinaryDetail(defaultName: string, settingKey: string): string {
	if (defaultName === 'ffmpeg') {
		if (process.platform === 'linux') {
			return `ffmpeg not found. Install with: sudo apt install ffmpeg — or set ${settingKey}.`;
		}
		if (process.platform === 'darwin') {
			return `ffmpeg not found. Install with: brew install ffmpeg — or set ${settingKey}.`;
		}
		return `ffmpeg not found. Install ffmpeg, then set ${settingKey} if it is not on PATH.`;
	}
	if (defaultName === 'ffprobe' && process.platform === 'linux') {
		return `ffprobe not found. Install with: sudo apt install ffmpeg — or set ${settingKey}.`;
	}
	return `${defaultName} not found. Install it or set ${settingKey}.`;
}

/**
 * Gate helpers for import/transcribe hard-disable rules.
 */
export function assertCanImportNonWav(ffmpegAvailable: boolean, filename: string): void {
	if (FfmpegHost.needsConversion(filename) && !ffmpegAvailable) {
		throw new Error(
			`Cannot import ${filename}: ffmpeg is required for non-WAV formats. Install ffmpeg or set safeappeals.audio.ffmpegPath.`,
		);
	}
}

export function assertCanTranscribeFormat(ffmpegAvailable: boolean, filename: string): void {
	if (FfmpegHost.needsConversion(filename) && !ffmpegAvailable) {
		throw new Error(
			`Cannot transcribe ${filename}: ffmpeg is required to convert non-WAV audio for Whisper. WAV that is not 16 kHz PCM also needs ffmpeg at runtime.`,
		);
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import type { AudioExportFormat } from './ffmpegHost';

export type { AudioExportFormat };

export const AUDIO_EXPORT_FORMATS: readonly AudioExportFormat[] = ['wav', 'flac', 'mp3', 'm4a'];

export const AUDIO_EXPORT_FORMAT_LABELS: Record<AudioExportFormat, string> = {
	wav: 'WAV (.wav)',
	flac: 'FLAC (.flac)',
	mp3: 'MP3 (.mp3)',
	m4a: 'MP4 Audio (M4A)',
};

export function exportAudioExtension(format: AudioExportFormat): string {
	return `.${format}`;
}

/**
 * True when ffmpeg must transcode; false when the source already matches the target family (passthrough).
 */
export function needsFfmpegForExport(sourceFilename: string, targetFormat: AudioExportFormat): boolean {
	const ext = path.extname(sourceFilename).toLowerCase();
	switch (targetFormat) {
		case 'wav':
			return ext !== '.wav';
		case 'flac':
			return ext !== '.flac';
		case 'mp3':
			return ext !== '.mp3';
		case 'm4a':
			return ext !== '.m4a' && ext !== '.mp4';
	}
}

/**
 * Hard-fail when export needs ffmpeg and it is unavailable (passthrough still allowed).
 */
export function assertCanExportAudio(
	ffmpegAvailable: boolean,
	sourceFilename: string,
	targetFormat: AudioExportFormat,
): void {
	if (needsFfmpegForExport(sourceFilename, targetFormat) && !ffmpegAvailable) {
		throw new Error(
			`Cannot export ${sourceFilename} as ${AUDIO_EXPORT_FORMAT_LABELS[targetFormat]}: ffmpeg is required. Install ffmpeg or set safeappeals.audio.ffmpegPath.`,
		);
	}
}

export function filterForAudioExport(format: AudioExportFormat): { [name: string]: string[] } {
	switch (format) {
		case 'wav':
			return { WAV: ['wav'] };
		case 'flac':
			return { FLAC: ['flac'] };
		case 'mp3':
			return { MP3: ['mp3'] };
		case 'm4a':
			return { 'MP4 Audio': ['m4a'] };
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	assertCanExportAudio,
	exportAudioExtension,
	needsFfmpegForExport,
} from '../audioExportService';
import { exportFormatFfmpegArgs } from '../ffmpegHost';

suite('audioExportService', () => {
	test('needsFfmpegForExport matrix and codec args', () => {
		assert.deepStrictEqual({
			wavPassthrough: needsFfmpegForExport('clip.wav', 'wav'),
			wavFromWebm: needsFfmpegForExport('clip.webm', 'wav'),
			flacPassthrough: needsFfmpegForExport('clip.flac', 'flac'),
			flacFromMp3: needsFfmpegForExport('clip.mp3', 'flac'),
			mp3Passthrough: needsFfmpegForExport('clip.mp3', 'mp3'),
			mp3FromWav: needsFfmpegForExport('clip.wav', 'mp3'),
			m4aPassthrough: needsFfmpegForExport('clip.m4a', 'm4a'),
			mp4Passthrough: needsFfmpegForExport('clip.mp4', 'm4a'),
			m4aFromWebm: needsFfmpegForExport('clip.webm', 'm4a'),
			extensions: {
				wav: exportAudioExtension('wav'),
				flac: exportAudioExtension('flac'),
				mp3: exportAudioExtension('mp3'),
				m4a: exportAudioExtension('m4a'),
			},
			args: {
				wav: exportFormatFfmpegArgs('wav'),
				flac: exportFormatFfmpegArgs('flac'),
				mp3: exportFormatFfmpegArgs('mp3'),
				m4a: exportFormatFfmpegArgs('m4a'),
			},
		}, {
			wavPassthrough: false,
			wavFromWebm: true,
			flacPassthrough: false,
			flacFromMp3: true,
			mp3Passthrough: false,
			mp3FromWav: true,
			m4aPassthrough: false,
			mp4Passthrough: false,
			m4aFromWebm: true,
			extensions: {
				wav: '.wav',
				flac: '.flac',
				mp3: '.mp3',
				m4a: '.m4a',
			},
			args: {
				wav: ['-c:a', 'pcm_s16le'],
				flac: ['-c:a', 'flac'],
				mp3: ['-c:a', 'libmp3lame', '-q:a', '2'],
				m4a: ['-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart'],
			},
		});
	});

	test('assertCanExportAudio allows passthrough without ffmpeg', () => {
		assert.doesNotThrow(() => assertCanExportAudio(false, 'note.wav', 'wav'));
		assert.throws(
			() => assertCanExportAudio(false, 'note.webm', 'mp3'),
			/ffmpeg is required/,
		);
		assert.doesNotThrow(() => assertCanExportAudio(true, 'note.webm', 'mp3'));
	});
});

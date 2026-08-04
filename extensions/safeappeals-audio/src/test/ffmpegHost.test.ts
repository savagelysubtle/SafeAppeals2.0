/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	assertCanImportNonWav,
	assertCanTranscribeFormat,
	FfmpegHost,
} from '../ffmpegHost';

suite('FfmpegHost gates', () => {
	test('needsConversion is false only for wav', () => {
		assert.deepStrictEqual({
			wav: FfmpegHost.needsConversion('a.wav'),
			mp3: FfmpegHost.needsConversion('a.mp3'),
			webm: FfmpegHost.needsConversion('a.webm'),
		}, {
			wav: false,
			mp3: true,
			webm: true,
		});
	});

	test('non-WAV import hard-fails without ffmpeg and allows WAV', () => {
		assert.throws(
			() => assertCanImportNonWav(false, 'note.mp3'),
			/ffmpeg is required for non-WAV/,
		);
		assert.doesNotThrow(() => assertCanImportNonWav(false, 'note.wav'));
		assert.doesNotThrow(() => assertCanImportNonWav(true, 'note.mp3'));
	});

	test('non-WAV transcribe hard-fails without ffmpeg', () => {
		assert.throws(
			() => assertCanTranscribeFormat(false, 'capture.webm'),
			/ffmpeg is required to convert non-WAV.*WAV that is not 16 kHz/,
		);
		assert.doesNotThrow(() => assertCanTranscribeFormat(false, 'capture.wav'));
	});
});

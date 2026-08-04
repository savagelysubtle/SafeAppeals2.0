/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { TranscriptionProgress } from '../types';
import {
	normalizeProgress,
	parseWhisperOutput,
	stageForProgress,
	WhisperHost,
} from '../whisperHost';

suite('WhisperHost', () => {
	test('progress helpers map stages', () => {
		assert.deepStrictEqual({
			zero: { value: normalizeProgress(0), stage: stageForProgress(0) },
			fraction: { value: normalizeProgress(0.42), stage: stageForProgress(normalizeProgress(0.42)) },
			high: { value: normalizeProgress(97), stage: stageForProgress(97) },
		}, {
			zero: { value: 0, stage: 'loading_model' },
			fraction: { value: 42, stage: 'processing' },
			high: { value: 97, stage: 'finalizing' },
		});
	});

	test('parseWhisperOutput handles kutalia transcription tuples', () => {
		assert.deepStrictEqual(
			parseWhisperOutput({
				transcription: [
					['00:00:00.000', '00:00:02.000', ' Hello'],
					['00:00:02.000', '00:00:04.000', ' world'],
				],
			}),
			{
				text: 'Hello world',
				segments: [
					{ start: 0, end: 2, text: 'Hello' },
					{ start: 2, end: 4, text: 'world' },
				],
				language: 'en',
			},
		);
	});

	test('transcribe uses injected mock and always sets translate false', async () => {
		const progressEvents: TranscriptionProgress[] = [];
		let seenTranslate: boolean | undefined;
		const host = new WhisperHost({
			getModelPath: () => '/tmp/model.bin',
			onProgress: p => progressEvents.push(p),
			getTranscribe: () => async options => {
				seenTranslate = options.translate;
				options.progress_callback?.(0.1);
				options.progress_callback?.(0.9);
				return {
					transcription: [['00:00:00.000', '00:00:01.000', ' mocked']],
				};
			},
		});

		const result = await host.transcribe('r1', { kind: 'wavPath', wavPath: '/managed/a.wav' });
		assert.deepStrictEqual({
			result,
			seenTranslate,
			stages: progressEvents.map(p => p.stage),
			gate: host.canTranscribe(),
		}, {
			result: {
				text: 'mocked',
				segments: [{ start: 0, end: 1, text: 'mocked' }],
				language: 'en',
			},
			seenTranslate: false,
			stages: ['loading_model', 'processing', 'processing', 'finalizing'],
			gate: { ok: true },
		});
	});

	test('transcribe passes initial_prompt when prompt provided', async () => {
		let seenInitialPrompt: string | undefined;
		let seenTranslate: boolean | undefined;
		const host = new WhisperHost({
			getModelPath: () => '/tmp/model.bin',
			getTranscribe: () => async options => {
				seenInitialPrompt = options.initial_prompt;
				seenTranslate = options.translate;
				return {
					transcription: [['00:00:00.000', '00:00:01.000', ' refined']],
				};
			},
		});

		const result = await host.transcribe(
			'r1',
			{ kind: 'wavPath', wavPath: '/managed/a.wav' },
			{ initialPrompt: 'Speaker 1: hello\nSpeaker 2: world' },
		);
		assert.deepStrictEqual({
			result,
			seenInitialPrompt,
			seenTranslate,
		}, {
			result: {
				text: 'refined',
				segments: [{ start: 0, end: 1, text: 'refined' }],
				language: 'en',
			},
			seenInitialPrompt: 'Speaker 1: hello\nSpeaker 2: world',
			seenTranslate: false,
		});
	});

	test('hard-disables when model missing', () => {
		const host = new WhisperHost({
			getModelPath: () => undefined,
			getTranscribe: () => async () => ({ transcription: [] }),
		});
		assert.deepStrictEqual(host.canTranscribe(), {
			ok: false,
			reason: 'Whisper model not found in SafeAppeals app data. The default model installs automatically — use Install Default Whisper Model, or Choose Different Whisper Model… only if your hardware can run another model.',
		});
	});
});

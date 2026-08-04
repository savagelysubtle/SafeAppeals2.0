/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	alignSpeakers,
	assignSpeakers,
	parseDiarizationOutput,
} from '../alignSpeakers';
import type { TranscriptSegment } from '../types';

/** Fixture text from `.spike-diarization/diarization-output-2-two-speakers-en.txt` (EN 2-speaker sample). */
const SPIKE_EN_2_SPEAKER_OUTPUT = `
OfflineSpeakerDiarizationConfig(...)
Started
0.031 -- 3.035 speaker_01
0.368 -- 0.841 speaker_00
2.680 -- 4.030 speaker_00
4.030 -- 5.026 speaker_01
5.026 -- 11.320 speaker_00
11.320 -- 13.919 speaker_01
13.987 -- 15.573 speaker_00
15.522 -- 16.822 speaker_01
17.362 -- 23.032 speaker_01
17.412 -- 17.767 speaker_00
23.032 -- 23.926 speaker_00
24.382 -- 27.419 speaker_01
`;

suite('alignSpeakers', () => {
	test('parseDiarizationOutput reads sherpa CLI intervals', () => {
		const intervals = parseDiarizationOutput(SPIKE_EN_2_SPEAKER_OUTPUT);
		assert.deepStrictEqual({
			count: intervals.length,
			first: intervals[0],
			speakers: [...new Set(intervals.map(i => i.speakerId))].sort((a, b) => a - b),
			last: intervals[intervals.length - 1],
		}, {
			count: 12,
			first: { start: 0.031, end: 3.035, speakerId: 1 },
			speakers: [0, 1],
			last: { start: 24.382, end: 27.419, speakerId: 1 },
		});
	});

	test('assignSpeakers picks max overlap; ties favor earlier interval', () => {
		const segments: TranscriptSegment[] = [
			{ start: 0.5, end: 2.5, text: 'hello from A' },
			{ start: 4.2, end: 4.8, text: 'reply from B' },
			{ start: 6, end: 10, text: 'longer turn A' },
		];
		const intervals = parseDiarizationOutput(SPIKE_EN_2_SPEAKER_OUTPUT);
		const labeled = assignSpeakers(segments, intervals);
		assert.deepStrictEqual(
			labeled.map(s => ({ text: s.text, speaker: s.speaker, speakerId: s.speakerId })),
			[
				{ text: 'hello from A', speaker: 'Speaker 2', speakerId: 1 },
				{ text: 'reply from B', speaker: 'Speaker 2', speakerId: 1 },
				{ text: 'longer turn A', speaker: 'Speaker 1', speakerId: 0 },
			],
		);
	});

	test('alignSpeakers persists speaker string without speakerId', () => {
		const segments: TranscriptSegment[] = [
			{ start: 5.5, end: 8, text: 'only A' },
		];
		const intervals = parseDiarizationOutput(SPIKE_EN_2_SPEAKER_OUTPUT);
		const aligned = alignSpeakers(segments, intervals);
		assert.deepStrictEqual(aligned, [
			{ start: 5.5, end: 8, text: 'only A', speaker: 'Speaker 1' },
		]);
	});

	test('empty intervals default to Speaker 1', () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, end: 1, text: 'solo' },
		];
		assert.deepStrictEqual(alignSpeakers(segments, []), [
			{ start: 0, end: 1, text: 'solo', speaker: 'Speaker 1' },
		]);
	});

	test('no-overlap uses nearest midpoint', () => {
		const segments: TranscriptSegment[] = [
			{ start: 30, end: 31, text: 'after all intervals' },
		];
		const intervals = parseDiarizationOutput(SPIKE_EN_2_SPEAKER_OUTPUT);
		const aligned = alignSpeakers(segments, intervals);
		assert.strictEqual(aligned[0]?.speaker, 'Speaker 2');
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { StoredRecording, TranscriptSegment } from '../types';
import {
	REFINE_PROMPT_MAX_CHARS,
	buildRefineInitialPrompt,
	diarizationIntervalsFromSegments,
	executeRefinePass,
	isUnacceptableRefineResult,
	shouldRunAutoRefine,
	stripRefinePromptMarkup,
} from '../transcriptRefine';

function baseRecording(overrides: Partial<StoredRecording> = {}): StoredRecording {
	return {
		id: 'rec-1',
		filename: 'hearing.wav',
		blobRelativePath: 'recordings/rec-1.enc',
		createdAt: '2026-01-01T00:00:00.000Z',
		duration: 10,
		status: 'completed',
		mimeType: 'audio/wav',
		isImported: false,
		transcript: 'prior diarized text',
		transcriptSegments: [
			{ start: 0, end: 2, text: 'prior diarized text', speaker: 'Speaker 1' },
		],
		diarizationIntervals: [{ start: 0, end: 2, speakerId: 0 }],
		...overrides,
	};
}

const autoRefineReady = {
	refineEnabled: true,
	whisperAddonAvailable: true,
	whisperModelAvailable: true,
	memoryOnly: false,
	secretStorageAvailable: true,
	hasSpeakers: true,
	hasIntervals: true,
	needsFfmpegConversion: false,
	ffmpegAvailable: true,
} as const;

suite('transcriptRefine', () => {
	test('buildRefineInitialPrompt formats Speaker N lines', () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, end: 1, text: 'hello', speaker: 'Speaker 1' },
			{ start: 1, end: 2, text: 'world', speaker: 'Speaker 2' },
			{ start: 2, end: 3, text: 'missing speaker' },
		];
		assert.strictEqual(
			buildRefineInitialPrompt(segments),
			'Speaker 1: hello\nSpeaker 2: world\nSpeaker 1: missing speaker',
		);
	});

	test('buildRefineInitialPrompt strips simple SRT-ish markup', () => {
		assert.strictEqual(stripRefinePromptMarkup('<i>hello</i> {an8} world'), 'hello world');
		const segments: TranscriptSegment[] = [
			{ start: 0, end: 1, text: '<b>Objection</b> sustained', speaker: 'Speaker 1' },
		];
		assert.strictEqual(
			buildRefineInitialPrompt(segments),
			'Speaker 1: Objection sustained',
		);
	});

	test('buildRefineInitialPrompt truncates at word boundary under max chars', () => {
		const word = 'word';
		const chunks: string[] = [];
		while (chunks.join(' ').length < REFINE_PROMPT_MAX_CHARS + 40) {
			chunks.push(word);
		}
		const longText = chunks.join(' ');
		const segments: TranscriptSegment[] = [
			{ start: 0, end: 1, text: longText, speaker: 'Speaker 1' },
		];
		const prompt = buildRefineInitialPrompt(segments);
		assert.ok(prompt.length <= REFINE_PROMPT_MAX_CHARS);
		assert.ok(prompt.startsWith('Speaker 1: word'));
		assert.ok(!prompt.endsWith(' '));
	});

	test('diarizationIntervalsFromSegments merges contiguous same speaker', () => {
		const segments: TranscriptSegment[] = [
			{ start: 0, end: 1, text: 'a', speaker: 'Speaker 1' },
			{ start: 1, end: 2, text: 'b', speaker: 'Speaker 1' },
			{ start: 2, end: 3.5, text: 'c', speaker: 'Speaker 2' },
			{ start: 3.5, end: 4, text: 'd', speaker: 'Speaker 2' },
			{ start: 4, end: 5, text: 'e', speaker: 'Speaker 1' },
		];
		assert.deepStrictEqual(diarizationIntervalsFromSegments(segments), [
			{ start: 0, end: 2, speakerId: 0 },
			{ start: 2, end: 4, speakerId: 1 },
			{ start: 4, end: 5, speakerId: 0 },
		]);
	});

	test('isUnacceptableRefineResult rejects empty and hallucination loops', () => {
		assert.strictEqual(isUnacceptableRefineResult('', []), true);
		assert.strictEqual(isUnacceptableRefineResult('   ', [{ start: 0, end: 1, text: '   ' }]), true);

		const tags = Array.from({ length: 6 }, () => '(grunting)').join(' ');
		assert.strictEqual(isUnacceptableRefineResult(tags, []), true);

		const barkLoop = Array.from({ length: 12 }, () => '[Barking]').join(' ');
		assert.strictEqual(isUnacceptableRefineResult(barkLoop, []), true);

		const tokenLoop = Array.from({ length: 20 }, () => 'uh').join(' ');
		assert.strictEqual(isUnacceptableRefineResult(tokenLoop, []), true);

		assert.strictEqual(
			isUnacceptableRefineResult('Speaker one said the hearing is postponed until Monday.', []),
			false,
		);
	});

	test('executeRefinePass happy path restores speakers and updates transcript', async () => {
		const prior = baseRecording({
			transcript: 'old wording from first pass',
			transcriptSegments: [
				{ start: 0, end: 2, text: 'old wording', speaker: 'Speaker 1' },
				{ start: 2, end: 4, text: 'from first pass', speaker: 'Speaker 2' },
			],
			diarizationIntervals: [
				{ start: 0, end: 2, speakerId: 0 },
				{ start: 2, end: 4, speakerId: 1 },
			],
		});
		let updateCalls = 0;
		const updated = await executeRefinePass({
			priorSegments: prior.transcriptSegments!,
			diarizationIntervals: prior.diarizationIntervals,
			transcribe: async initialPrompt => {
				assert.ok(initialPrompt.includes('Speaker 1:'));
				assert.ok(initialPrompt.includes('Speaker 2:'));
				return {
					text: 'clearer wording from refine pass',
					language: 'en',
					segments: [
						{ start: 0, end: 2, text: 'clearer wording' },
						{ start: 2, end: 4, text: 'from refine pass' },
					],
				};
			},
			updateRecording: async patch => {
				updateCalls += 1;
				return {
					...prior,
					...patch,
				};
			},
		});

		assert.strictEqual(updateCalls, 1);
		assert.strictEqual(updated.transcript, 'clearer wording from refine pass');
		assert.deepStrictEqual(
			updated.transcriptSegments?.map(s => ({ text: s.text, speaker: s.speaker })),
			[
				{ text: 'clearer wording', speaker: 'Speaker 1' },
				{ text: 'from refine pass', speaker: 'Speaker 2' },
			],
		);
		assert.deepStrictEqual(updated.diarizationIntervals, prior.diarizationIntervals);
	});

	test('executeRefinePass failure does not overwrite prior diarized data', async () => {
		const prior = baseRecording();
		let updateCalls = 0;
		const updateRecording = async () => {
			updateCalls += 1;
			return prior;
		};

		await assert.rejects(
			() => executeRefinePass({
				priorSegments: prior.transcriptSegments!,
				diarizationIntervals: prior.diarizationIntervals,
				transcribe: async () => {
					throw new Error('whisper crashed');
				},
				updateRecording,
			}),
			/whisper crashed/,
		);
		assert.strictEqual(updateCalls, 0);

		await assert.rejects(
			() => executeRefinePass({
				priorSegments: prior.transcriptSegments!,
				diarizationIntervals: prior.diarizationIntervals,
				transcribe: async () => ({ text: '', segments: [] }),
				updateRecording,
			}),
			/unacceptable result/,
		);
		assert.strictEqual(updateCalls, 0);

		const hallucinated = Array.from({ length: 12 }, () => '[Barking]').join(' ');
		await assert.rejects(
			() => executeRefinePass({
				priorSegments: prior.transcriptSegments!,
				diarizationIntervals: prior.diarizationIntervals,
				transcribe: async () => ({
					text: hallucinated,
					segments: [{ start: 0, end: 1, text: hallucinated }],
				}),
				updateRecording,
			}),
			/unacceptable result/,
		);
		assert.strictEqual(updateCalls, 0);
		assert.strictEqual(prior.transcript, 'prior diarized text');
		assert.strictEqual(prior.transcriptSegments?.[0]?.speaker, 'Speaker 1');
	});

	test('shouldRunAutoRefine no-ops when refine disabled or whisper unavailable', () => {
		assert.strictEqual(
			shouldRunAutoRefine({ ...autoRefineReady, refineEnabled: false }),
			false,
		);
		assert.strictEqual(
			shouldRunAutoRefine({ ...autoRefineReady, whisperAddonAvailable: false }),
			false,
		);
		assert.strictEqual(
			shouldRunAutoRefine({ ...autoRefineReady, whisperModelAvailable: false }),
			false,
		);
		assert.strictEqual(shouldRunAutoRefine({ ...autoRefineReady }), true);
	});
});

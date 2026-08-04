/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	EXPORT_FORMATS,
	formatSrtTime,
	formatTranscriptJson,
	formatTranscriptSrt,
	formatTranscriptTxt,
} from '../exportService';
import type { StoredRecording } from '../types';

function completedRecording(overrides: Partial<StoredRecording> = {}): StoredRecording {
	return {
		id: 'rec-1',
		filename: 'hearing.wav',
		blobRelativePath: 'recordings/rec-1.saenc',
		createdAt: '2026-08-03T12:00:00.000Z',
		duration: 5,
		status: 'completed',
		mimeType: 'audio/wav',
		isImported: false,
		transcript: 'Hello world from the hearing.',
		transcriptSegments: [
			{ start: 0, end: 2.5, text: 'Hello world' },
			{ start: 2.5, end: 5, text: 'from the hearing.' },
		],
		language: 'en',
		...overrides,
	};
}

suite('exportService', () => {
	test('txt/srt/json snapshots', () => {
		const recording = completedRecording();
		assert.deepStrictEqual({
			formats: [...EXPORT_FORMATS],
			txt: formatTranscriptTxt(recording),
			srt: formatTranscriptSrt(recording),
			json: formatTranscriptJson(recording),
			srtTime: formatSrtTime(3661.5),
		}, {
			formats: ['txt', 'srt', 'json', 'docx'],
			txt: 'Hello world from the hearing.\n',
			srt: '1\n00:00:00,000 --> 00:00:02,500\nHello world\n\n2\n00:00:02,500 --> 00:00:05,000\nfrom the hearing.\n\n',
			json: '{\n\t"id": "rec-1",\n\t"filename": "hearing.wav",\n\t"duration": 5,\n\t"createdAt": "2026-08-03T12:00:00.000Z",\n\t"transcript": "Hello world from the hearing.",\n\t"segments": [\n\t\t{\n\t\t\t"start": 0,\n\t\t\t"end": 2.5,\n\t\t\t"text": "Hello world"\n\t\t},\n\t\t{\n\t\t\t"start": 2.5,\n\t\t\t"end": 5,\n\t\t\t"text": "from the hearing."\n\t\t}\n\t],\n\t"language": "en"\n}\n',
			srtTime: '01:01:01,500',
		});
	});

	test('txt/srt/json include speakers when present', () => {
		const recording = completedRecording({
			transcriptSegments: [
				{ start: 0, end: 2.5, text: 'Hello world', speaker: 'Speaker 1' },
				{ start: 2.5, end: 5, text: 'from the hearing.', speaker: 'Speaker 2' },
			],
		});
		assert.deepStrictEqual({
			txt: formatTranscriptTxt(recording),
			srt: formatTranscriptSrt(recording),
			json: formatTranscriptJson(recording),
		}, {
			txt: 'Speaker 1:\nHello world\n\nSpeaker 2:\nfrom the hearing.\n',
			srt: '1\n00:00:00,000 --> 00:00:02,500\nSpeaker 1: Hello world\n\n2\n00:00:02,500 --> 00:00:05,000\nSpeaker 2: from the hearing.\n\n',
			json: '{\n\t"id": "rec-1",\n\t"filename": "hearing.wav",\n\t"duration": 5,\n\t"createdAt": "2026-08-03T12:00:00.000Z",\n\t"transcript": "Hello world from the hearing.",\n\t"segments": [\n\t\t{\n\t\t\t"start": 0,\n\t\t\t"end": 2.5,\n\t\t\t"text": "Hello world",\n\t\t\t"speaker": "Speaker 1"\n\t\t},\n\t\t{\n\t\t\t"start": 2.5,\n\t\t\t"end": 5,\n\t\t\t"text": "from the hearing.",\n\t\t\t"speaker": "Speaker 2"\n\t\t}\n\t],\n\t"language": "en"\n}\n',
		});
	});

	test('export refuses incomplete transcript', () => {
		assert.throws(
			() => formatTranscriptTxt(completedRecording({ status: 'pending', transcript: undefined })),
			/no completed transcript/,
		);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { TranscriptSegment } from './types';

/**
 * One continuous speaker interval from sherpa-onnx offline diarization.
 */
export interface DiarizationInterval {
	readonly start: number;
	readonly end: number;
	readonly speakerId: number;
}

/**
 * Whisper segment with an assigned speaker label (`Speaker 1`, …).
 */
export interface LabeledTranscriptSegment extends TranscriptSegment {
	readonly speaker: string;
	readonly speakerId: number;
}

/** Parse sherpa-onnx CLI lines: `1.617 -- 3.271 speaker_00` */
export function parseDiarizationOutput(text: string): DiarizationInterval[] {
	const intervals: DiarizationInterval[] = [];
	const re = /^(\d+(?:\.\d+)?)\s+--\s+(\d+(?:\.\d+)?)\s+speaker_(\d+)\s*$/gm;
	for (const match of text.matchAll(re)) {
		const start = Number(match[1]);
		const end = Number(match[2]);
		const speakerId = Number(match[3]);
		if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
			intervals.push({ start, end, speakerId });
		}
	}
	return intervals;
}

function overlapSeconds(a0: number, a1: number, b0: number, b1: number): number {
	return Math.max(0, Math.min(a1, b1) - Math.max(a0, b0));
}

/**
 * Assign each Whisper segment the speaker with maximum temporal overlap.
 * Ties break toward the earlier-starting diarization interval; if no overlap,
 * use the nearest interval by midpoint.
 */
export function assignSpeakers(
	segments: readonly TranscriptSegment[],
	intervals: readonly DiarizationInterval[],
): LabeledTranscriptSegment[] {
	if (intervals.length === 0) {
		return segments.map(seg => ({
			...seg,
			speakerId: 0,
			speaker: 'Speaker 1',
		}));
	}

	return segments.map(seg => {
		let best: DiarizationInterval | undefined;
		let bestOverlap = -1;
		for (const interval of intervals) {
			const ov = overlapSeconds(seg.start, seg.end, interval.start, interval.end);
			if (ov > bestOverlap || (ov === bestOverlap && best && interval.start < best.start)) {
				bestOverlap = ov;
				best = interval;
			}
		}

		if (!best || bestOverlap <= 0) {
			const mid = (seg.start + seg.end) / 2;
			best = intervals.reduce((nearest, cur) => {
				const nMid = (nearest.start + nearest.end) / 2;
				const cMid = (cur.start + cur.end) / 2;
				return Math.abs(cMid - mid) < Math.abs(nMid - mid) ? cur : nearest;
			});
		}

		return {
			...seg,
			speakerId: best.speakerId,
			speaker: `Speaker ${best.speakerId + 1}`,
		};
	});
}

/**
 * Align diarization intervals onto ASR segments for persistence.
 * Returns new segment objects with optional `speaker` (never mutates input).
 */
export function alignSpeakers(
	segments: readonly TranscriptSegment[],
	intervals: readonly DiarizationInterval[],
): TranscriptSegment[] {
	return assignSpeakers(segments, intervals).map(seg => ({
		start: seg.start,
		end: seg.end,
		text: seg.text,
		speaker: seg.speaker,
	}));
}

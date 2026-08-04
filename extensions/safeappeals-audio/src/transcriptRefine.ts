/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { alignSpeakers, type DiarizationInterval } from './alignSpeakers';
import type { StoredRecording, TranscriptSegment } from './types';

/** Max chars for Whisper `initial_prompt` on the local refine pass. */
export const REFINE_PROMPT_MAX_CHARS = 800;

const SPEAKER_LABEL_RE = /^Speaker\s+(\d+)\s*$/i;
/** Non-speech tags Whisper sometimes loops: `(grunting)`, `[Barking]`, etc. */
const NON_SPEECH_TAG_RE = /[\[(][^\]\)]{0,48}[\])]/g;
/** Simple SRT/HTML-ish markup: `<i>…</i>`, `{an8}`, etc. */
const SRT_MARKUP_RE = /<\/?[a-zA-Z][^>]*>|\{[^}]*\}/g;

/**
 * Strip simple SRT/HTML-ish tags from text used in refine prompts.
 */
export function stripRefinePromptMarkup(text: string): string {
	return text.replace(SRT_MARKUP_RE, '').replace(/\s+/g, ' ').trim();
}

/**
 * Build a speaker-labeled cue string for a local Whisper refine pass.
 * Truncates at a word boundary from the start when over {@link REFINE_PROMPT_MAX_CHARS}.
 */
export function buildRefineInitialPrompt(segments: TranscriptSegment[]): string {
	const lines = segments.map(seg => {
		const speaker = seg.speaker?.trim() || 'Speaker 1';
		return `${speaker}: ${stripRefinePromptMarkup(seg.text)}`;
	});
	const joined = lines.join('\n');
	if (joined.length <= REFINE_PROMPT_MAX_CHARS) {
		return joined;
	}
	const slice = joined.slice(0, REFINE_PROMPT_MAX_CHARS);
	const lastSpace = slice.lastIndexOf(' ');
	const lastNewline = slice.lastIndexOf('\n');
	const cut = Math.max(lastSpace, lastNewline);
	if (cut > 0) {
		return slice.slice(0, cut);
	}
	return slice;
}

/** Patch persisted after a successful refine pass. */
export interface RefinePassUpdate {
	transcript: string;
	transcriptSegments: TranscriptSegment[];
	diarizationIntervals: DiarizationInterval[];
	language?: string;
}

/** Whisper output for {@link executeRefinePass}. */
export interface RefinePassWhisperResult {
	text: string;
	segments: TranscriptSegment[];
	language?: string;
}

/**
 * Soft gate for auto refine after diarization (manual Improve Transcript ignores `refineEnabled`).
 */
export function shouldRunAutoRefine(input: {
	refineEnabled: boolean;
	whisperAddonAvailable: boolean;
	whisperModelAvailable: boolean;
	memoryOnly: boolean;
	secretStorageAvailable: boolean;
	hasSpeakers: boolean;
	hasIntervals: boolean;
	needsFfmpegConversion: boolean;
	ffmpegAvailable: boolean;
}): boolean {
	if (!input.refineEnabled) {
		return false;
	}
	if (!input.whisperAddonAvailable || !input.whisperModelAvailable) {
		return false;
	}
	if (input.memoryOnly || !input.secretStorageAvailable) {
		return false;
	}
	if (!input.hasSpeakers && !input.hasIntervals) {
		return false;
	}
	if (input.needsFfmpegConversion && !input.ffmpegAvailable) {
		return false;
	}
	return true;
}

/**
 * Thin refine orchestrator with injectable Whisper + store update.
 * On unacceptable output or Whisper throw, {@link updateRecording} is never called.
 */
export async function executeRefinePass(args: {
	priorSegments: TranscriptSegment[];
	diarizationIntervals?: DiarizationInterval[];
	transcribe: (initialPrompt: string) => Promise<RefinePassWhisperResult>;
	updateRecording: (patch: RefinePassUpdate) => Promise<StoredRecording | undefined>;
}): Promise<StoredRecording> {
	const initialPrompt = buildRefineInitialPrompt(args.priorSegments);
	const result = await args.transcribe(initialPrompt);
	if (isUnacceptableRefineResult(result.text, result.segments)) {
		throw new Error(
			'Transcript refine produced an unacceptable result; keeping the previous version.',
		);
	}
	const intervals = args.diarizationIntervals
		?? diarizationIntervalsFromSegments(args.priorSegments);
	const labeled = alignSpeakers(result.segments, intervals);
	const updated = await args.updateRecording({
		transcript: result.text,
		transcriptSegments: labeled,
		diarizationIntervals: intervals,
		language: result.language,
	});
	if (!updated) {
		throw new Error('Failed to persist refined transcript.');
	}
	return updated;
}

/**
 * Merge contiguous same-speaker transcript segments into diarization intervals.
 * Parses `Speaker N` → speakerId `N - 1` (default 0 when missing/unparseable).
 */
export function diarizationIntervalsFromSegments(
	segments: readonly TranscriptSegment[],
): DiarizationInterval[] {
	const intervals: DiarizationInterval[] = [];
	for (const seg of segments) {
		const speakerId = parseSpeakerId(seg.speaker);
		const last = intervals[intervals.length - 1];
		if (last && last.speakerId === speakerId) {
			intervals[intervals.length - 1] = {
				start: last.start,
				end: seg.end,
				speakerId,
			};
			continue;
		}
		intervals.push({
			start: seg.start,
			end: seg.end,
			speakerId,
		});
	}
	return intervals;
}

/**
 * Reject empty or clearly hallucinated refine output so the prior diarized store is kept.
 * Heuristic only — keeps legal audio local and never sends text to cloud.
 */
export function isUnacceptableRefineResult(
	text: string,
	segments: readonly TranscriptSegment[],
): boolean {
	const trimmed = text.trim();
	const segmentText = segments
		.map(s => s.text.trim())
		.filter(Boolean)
		.join(' ')
		.trim();
	if (!trimmed && !segmentText) {
		return true;
	}
	if (!trimmed) {
		return true;
	}

	const tags = trimmed.match(NON_SPEECH_TAG_RE) ?? [];
	if (tags.length >= 3) {
		const tagChars = tags.reduce((sum, tag) => sum + tag.length, 0);
		if (tagChars / trimmed.length >= 0.35) {
			return true;
		}
	}

	const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
	if (tokens.length >= 8) {
		const counts = new Map<string, number>();
		for (const token of tokens) {
			if (token.length > 16) {
				continue;
			}
			counts.set(token, (counts.get(token) ?? 0) + 1);
		}
		for (const count of counts.values()) {
			if (count / tokens.length >= 0.5) {
				return true;
			}
		}
	}

	return false;
}

function parseSpeakerId(speaker: string | undefined): number {
	if (!speaker) {
		return 0;
	}
	const match = SPEAKER_LABEL_RE.exec(speaker.trim());
	if (!match) {
		return 0;
	}
	const n = Number(match[1]);
	if (!Number.isFinite(n) || n < 1) {
		return 0;
	}
	return Math.floor(n) - 1;
}

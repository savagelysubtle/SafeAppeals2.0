/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { TranscriptSegment, TranscriptionProgress } from './types';
import {
	probeWhisperAddon,
	type WhisperProbeOptions,
	type WhisperTranscribeFn,
	type WhisperTranscribeOptions,
} from './whisperProbe';

export type { WhisperTranscribeFn, WhisperTranscribeOptions };

export interface TranscriptionResult {
	text: string;
	segments: TranscriptSegment[];
	language: string;
}

export type WhisperAudioInput =
	| { readonly kind: 'wavPath'; readonly wavPath: string }
	| { readonly kind: 'pcmf32'; readonly pcmf32: Float32Array };

export interface WhisperHostOptions {
	readonly getTranscribe?: () => WhisperTranscribeFn | undefined;
	readonly getModelPath: () => string | undefined;
	readonly probeOptions?: WhisperProbeOptions;
	readonly log?: (message: string) => void;
	readonly onProgress?: (progress: TranscriptionProgress) => void;
}

/**
 * Kutalia whisper-node-addon wrapper. Inject {@link WhisperHostOptions.getTranscribe} in tests.
 */
export class WhisperHost {
	private cachedTranscribe: WhisperTranscribeFn | undefined | null = null;

	constructor(private readonly options: WhisperHostOptions) { }

	isAddonAvailable(): boolean {
		return this.resolveTranscribe() !== undefined;
	}

	/**
	 * Drop the cached kutalia `transcribe` binding so the next call re-probes.
	 * Does **not** free native addon RSS — kutalia exposes no unload/free API.
	 */
	clearTranscribeCache(): void {
		this.cachedTranscribe = null;
	}

	canTranscribe(): { ok: true } | { ok: false; reason: string } {
		if (!this.resolveTranscribe()) {
			return {
				ok: false,
				reason: 'Whisper native addon is unavailable. Transcription is disabled.',
			};
		}
		const model = this.options.getModelPath();
		if (!model) {
			return {
				ok: false,
				reason: 'Whisper model not found in SafeAppeals app data. The default model installs automatically — use Install Default Whisper Model, or Choose Different Whisper Model… only if your hardware can run another model.',
			};
		}
		return { ok: true };
	}

	async transcribe(
		recordingId: string,
		input: WhisperAudioInput,
		options?: { initialPrompt?: string },
	): Promise<TranscriptionResult> {
		const gate = this.canTranscribe();
		if (!gate.ok) {
			throw new Error(gate.reason);
		}
		const transcribeFn = this.resolveTranscribe();
		if (!transcribeFn) {
			throw new Error('Whisper native addon is unavailable.');
		}
		const model = this.options.getModelPath();
		if (!model) {
			throw new Error('Whisper model path is not configured.');
		}

		this.emitProgress(recordingId, 0, 'loading_model');

		const base: WhisperTranscribeOptions = {
			model,
			language: 'en',
			use_gpu: true,
			no_prints: true,
			translate: false,
			no_timestamps: false,
			progress_callback: (progress: number) => {
				const normalized = normalizeProgress(progress);
				const stage = stageForProgress(normalized);
				this.emitProgress(recordingId, normalized, stage);
			},
		};

		const prompt = options?.initialPrompt?.trim();
		if (prompt) {
			base.initial_prompt = prompt;
		}

		const raw = input.kind === 'pcmf32'
			? await transcribeFn({ ...base, pcmf32: input.pcmf32, translate: false })
			: await transcribeFn({ ...base, fname_inp: input.wavPath, translate: false });

		this.emitProgress(recordingId, 100, 'finalizing');
		const parsed = parseWhisperOutput(raw);
		this.options.log?.(
			`Whisper finished for ${recordingId}: ${parsed.text.length} chars, ${parsed.segments.length} segments`,
		);
		return parsed;
	}

	private resolveTranscribe(): WhisperTranscribeFn | undefined {
		if (this.options.getTranscribe) {
			return this.options.getTranscribe();
		}
		if (this.cachedTranscribe !== null) {
			return this.cachedTranscribe;
		}
		const probe = probeWhisperAddon(this.options.probeOptions ?? {});
		this.cachedTranscribe = probe.loaded && probe.transcribe ? probe.transcribe : undefined;
		return this.cachedTranscribe;
	}

	private emitProgress(
		recordingId: string,
		progress: number,
		stage: TranscriptionProgress['stage'],
	): void {
		this.options.onProgress?.({ recordingId, progress, stage });
	}
}

export function normalizeProgress(progress: number): number {
	if (!Number.isFinite(progress)) {
		return 0;
	}
	const scaled = progress <= 1 ? progress * 100 : progress;
	return Math.max(0, Math.min(100, Math.round(scaled)));
}

export function stageForProgress(progress: number): TranscriptionProgress['stage'] {
	if (progress < 5) {
		return 'loading_model';
	}
	if (progress >= 95) {
		return 'finalizing';
	}
	return 'processing';
}

export function parseWhisperOutput(output: unknown): TranscriptionResult {
	const segments: TranscriptSegment[] = [];
	let fullText = '';

	if (typeof output === 'string') {
		const lines = output.split('\n').filter(line => line.trim());
		const timestampRegex = /\[(\d{2}):(\d{2}):(\d{2})\.(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})\.(\d{3})\]\s*(.*)/;
		for (const line of lines) {
			const match = line.match(timestampRegex);
			if (match) {
				const start = hmsToSeconds(match[1]!, match[2]!, match[3]!, match[4]!);
				const end = hmsToSeconds(match[5]!, match[6]!, match[7]!, match[8]!);
				const text = match[9]!.trim();
				if (text) {
					segments.push({ start, end, text });
					fullText += (fullText ? ' ' : '') + text;
				}
			} else if (line.trim()) {
				fullText += (fullText ? ' ' : '') + line.trim();
			}
		}
	} else if (Array.isArray(output)) {
		for (const seg of output) {
			appendSegmentObject(seg, segments, text => {
				fullText += (fullText ? ' ' : '') + text;
			});
		}
	} else if (output && typeof output === 'object') {
		const obj = output as Record<string, unknown>;
		if (Array.isArray(obj.transcription)) {
			for (const seg of obj.transcription) {
				if (Array.isArray(seg) && seg.length >= 3) {
					const start = parseTimeString(String(seg[0]));
					const end = parseTimeString(String(seg[1]));
					const text = String(seg[2]).trim();
					if (text) {
						segments.push({ start, end, text });
						fullText += (fullText ? ' ' : '') + text;
					}
				} else if (typeof seg === 'string' && seg.trim()) {
					fullText += (fullText ? ' ' : '') + seg.trim();
				}
			}
		} else if (Array.isArray(obj.segments)) {
			return parseWhisperOutput(obj.segments);
		} else if (typeof obj.text === 'string') {
			fullText = obj.text;
		} else if (Array.isArray(obj.results)) {
			return parseWhisperOutput(obj.results);
		}
	}

	return { text: fullText, segments, language: 'en' };
}

function appendSegmentObject(
	seg: unknown,
	segments: TranscriptSegment[],
	appendText: (text: string) => void,
): void {
	if (!seg || typeof seg !== 'object') {
		return;
	}
	const record = seg as Record<string, unknown>;
	const startRaw = typeof record.start === 'number' ? record.start : 0;
	const endRaw = typeof record.end === 'number' ? record.end : 0;
	const start = startRaw > 1000 ? startRaw / 1000 : startRaw;
	const end = endRaw > 1000 ? endRaw / 1000 : endRaw;
	const text = String(record.text ?? record.speech ?? '').trim();
	if (!text) {
		return;
	}
	segments.push({ start, end, text });
	appendText(text);
}

function hmsToSeconds(h: string, m: string, s: string, ms: string): number {
	return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

function parseTimeString(timeStr: string): number {
	const match = timeStr.match(/(\d{2}):(\d{2}):(\d{2})\.(\d{3})/);
	if (!match) {
		return 0;
	}
	return hmsToSeconds(match[1]!, match[2]!, match[3]!, match[4]!);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Spike only — not wired into extension activation.
 *--------------------------------------------------------------------------------------------*/

/**
 * Offline speaker diarization spike:
 * 1) Run (or read) sherpa-onnx offline speaker diarization intervals
 * 2) Transcribe with existing Whisper (kutalia) — no re-ASR for speakers
 * 3) Assign Speaker N to each Whisper segment by max time overlap
 * 4) Emit TXT / SRT / JSON with speakers
 *
 * Usage (from extensions/safeappeals-audio):
 *   bun scripts/spike-diarization.ts [--wav path] [--diarization-out path] [--skip-whisper]
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { spawnSync } from 'node:child_process';
import { WhisperHost, parseWhisperOutput } from '../src/whisperHost';
import type { TranscriptSegment } from '../src/types';

interface DiarizationInterval {
	start: number;
	end: number;
	speakerId: number;
}

interface LabeledSegment extends TranscriptSegment {
	speaker: string;
	speakerId: number;
}

const EXT_ROOT = path.resolve(import.meta.dir, '..');
const SPIKE_ROOT = path.join(EXT_ROOT, '.spike-diarization');
const DEFAULT_WAV = path.join(SPIKE_ROOT, 'test-wavs', '2-two-speakers-en.wav');
const DEFAULT_MODEL_DIR = path.join(SPIKE_ROOT, 'models');
const BIN_DIR = path.join(SPIKE_ROOT, 'sherpa-onnx-v1.13.4-linux-x64-shared');
const DIAR_BIN = path.join(BIN_DIR, 'bin', 'sherpa-onnx-offline-speaker-diarization');
const SEG_MODEL = path.join(DEFAULT_MODEL_DIR, 'sherpa-onnx-pyannote-segmentation-3-0', 'model.int8.onnx');
const EMB_MODEL = path.join(DEFAULT_MODEL_DIR, '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx');
const OUT_DIR = path.join(SPIKE_ROOT, 'aligned-export');
const WHISPER_MODEL =
	process.env.SAFEAPPEALS_WHISPER_MODEL
	?? path.join(
		os.homedir(),
		'.config/code-oss-dev/User/globalStorage/safeappeals.safeappeals-audio/models/whisper/ggml-base.en.bin',
	);

function parseArgs(argv: string[]): {
	wav: string;
	diarizationOut?: string;
	skipWhisper: boolean;
	numClusters: number;
} {
	let wav = DEFAULT_WAV;
	let diarizationOut: string | undefined;
	let skipWhisper = false;
	let numClusters = 2;
	for (let i = 0; i < argv.length; i++) {
		const a = argv[i];
		if (a === '--wav' && argv[i + 1]) {
			wav = path.resolve(argv[++i]!);
		} else if (a === '--diarization-out' && argv[i + 1]) {
			diarizationOut = path.resolve(argv[++i]!);
		} else if (a === '--skip-whisper') {
			skipWhisper = true;
		} else if (a === '--num-clusters' && argv[i + 1]) {
			numClusters = Number(argv[++i]);
		}
	}
	return { wav, diarizationOut, skipWhisper, numClusters };
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
 * Ties break toward the earlier-starting diarization interval; if no overlap, use nearest interval by midpoint.
 */
export function assignSpeakers(
	segments: readonly TranscriptSegment[],
	intervals: readonly DiarizationInterval[],
): LabeledSegment[] {
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

function formatSrtTime(seconds: number): string {
	const totalMs = Math.max(0, Math.round(seconds * 1000));
	const hours = Math.floor(totalMs / 3_600_000);
	const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
	const secs = Math.floor((totalMs % 60_000) / 1000);
	const ms = totalMs % 1000;
	const pad = (n: number, w: number) => n.toString().padStart(w, '0');
	return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
}

function formatTxt(labeled: readonly LabeledSegment[]): string {
	const lines: string[] = [];
	let current: string | undefined;
	for (const seg of labeled) {
		const text = seg.text.trim();
		if (!text) {
			continue;
		}
		if (seg.speaker !== current) {
			if (lines.length > 0) {
				lines.push('');
			}
			lines.push(`${seg.speaker}:`);
			current = seg.speaker;
		}
		lines.push(text);
	}
	return `${lines.join('\n')}\n`;
}

function formatSrt(labeled: readonly LabeledSegment[]): string {
	return labeled.map((seg, i) => {
		const body = `${seg.speaker}: ${seg.text.trim()}`;
		return `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${body}\n`;
	}).join('\n') + '\n';
}

function formatJson(
	labeled: readonly LabeledSegment[],
	meta: { wav: string; durationHint: number; diarizationIntervals: DiarizationInterval[] },
): string {
	return `${JSON.stringify({
		sourceWav: meta.wav,
		duration: meta.durationHint,
		language: 'en',
		transcript: labeled.map(s => `${s.speaker}: ${s.text.trim()}`).join('\n'),
		segments: labeled.map(s => ({
			start: s.start,
			end: s.end,
			text: s.text,
			speaker: s.speaker,
			speakerId: s.speakerId,
		})),
		diarizationIntervals: meta.diarizationIntervals.map(i => ({
			start: i.start,
			end: i.end,
			speaker: `Speaker ${i.speakerId + 1}`,
			speakerId: i.speakerId,
		})),
	}, null, '\t')}\n`;
}

function runDiarization(wav: string, numClusters: number): { text: string; wallMs: number } {
	if (!fs.existsSync(DIAR_BIN)) {
		throw new Error(`Missing sherpa binary: ${DIAR_BIN}`);
	}
	if (!fs.existsSync(SEG_MODEL) || !fs.existsSync(EMB_MODEL)) {
		throw new Error(`Missing models under ${DEFAULT_MODEL_DIR}`);
	}
	const started = Date.now();
	const result = spawnSync(DIAR_BIN, [
		`--clustering.num-clusters=${numClusters}`,
		`--segmentation.pyannote-model=${SEG_MODEL}`,
		`--embedding.model=${EMB_MODEL}`,
		wav,
	], {
		encoding: 'utf8',
		env: {
			...process.env,
			LD_LIBRARY_PATH: `${path.join(BIN_DIR, 'lib')}${path.delimiter}${process.env.LD_LIBRARY_PATH ?? ''}`,
		},
		maxBuffer: 16 * 1024 * 1024,
	});
	const wallMs = Date.now() - started;
	const combined = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
	if (result.status !== 0) {
		throw new Error(`Diarization failed (exit ${result.status}): ${combined.slice(-2000)}`);
	}
	return { text: combined, wallMs };
}

async function runWhisper(wav: string): Promise<{ segments: TranscriptSegment[]; text: string; wallMs: number }> {
	const host = new WhisperHost({
		getModelPath: () => (fs.existsSync(WHISPER_MODEL) ? WHISPER_MODEL : undefined),
		probeOptions: {
			cacheDir: path.join(SPIKE_ROOT, 'whisper-native-cache'),
		},
		log: msg => console.error(`[whisper] ${msg}`),
	});
	const gate = host.canTranscribe();
	if (!gate.ok) {
		throw new Error(gate.reason);
	}
	const started = Date.now();
	const result = await host.transcribe('spike', { kind: 'wavPath', wavPath: wav });
	return { segments: result.segments, text: result.text, wallMs: Date.now() - started };
}

/** Synthetic segments from diarization when Whisper is skipped (alignment demo only). */
function syntheticSegmentsFromDiarization(intervals: readonly DiarizationInterval[]): TranscriptSegment[] {
	return intervals.map((interval, index) => ({
		start: interval.start,
		end: interval.end,
		text: `[utterance ${index + 1}]`,
	}));
}

async function main(): Promise<void> {
	const args = parseArgs(process.argv.slice(2));
	if (!fs.existsSync(args.wav)) {
		throw new Error(`WAV not found: ${args.wav}`);
	}

	fs.mkdirSync(OUT_DIR, { recursive: true });

	let diarText: string;
	let diarWallMs = 0;
	if (args.diarizationOut && fs.existsSync(args.diarizationOut)) {
		diarText = fs.readFileSync(args.diarizationOut, 'utf8');
		console.error(`Using cached diarization: ${args.diarizationOut}`);
	} else {
		console.error(`Running diarization on ${args.wav} (clusters=${args.numClusters})…`);
		const ran = runDiarization(args.wav, args.numClusters);
		diarText = ran.text;
		diarWallMs = ran.wallMs;
		const cached = path.join(OUT_DIR, 'diarization-raw.txt');
		fs.writeFileSync(cached, diarText);
		console.error(`Diarization wall ${diarWallMs} ms → ${cached}`);
	}

	const intervals = parseDiarizationOutput(diarText);
	const speakerCount = new Set(intervals.map(i => i.speakerId)).size;
	console.error(`Parsed ${intervals.length} diarization intervals, ${speakerCount} speakers`);
	if (speakerCount < 2) {
		console.error('WARNING: fewer than 2 speakers detected — check embedding language / sample.');
	}

	let segments: TranscriptSegment[];
	let whisperWallMs = 0;
	let fullText = '';
	if (args.skipWhisper) {
		segments = syntheticSegmentsFromDiarization(intervals);
		fullText = segments.map(s => s.text).join(' ');
		console.error('Skipped Whisper — using synthetic utterance placeholders.');
	} else {
		console.error(`Running Whisper (model=${WHISPER_MODEL})…`);
		const whisper = await runWhisper(args.wav);
		segments = whisper.segments;
		fullText = whisper.text;
		whisperWallMs = whisper.wallMs;
		console.error(`Whisper wall ${whisperWallMs} ms, ${segments.length} segments, ${fullText.length} chars`);
		fs.writeFileSync(path.join(OUT_DIR, 'whisper-segments.json'), `${JSON.stringify(segments, null, '\t')}\n`);
	}

	const labeled = assignSpeakers(segments, intervals);
	const durationHint = Math.max(
		...intervals.map(i => i.end),
		...segments.map(s => s.end),
		0,
	);

	const txt = formatTxt(labeled);
	const srt = formatSrt(labeled);
	const json = formatJson(labeled, {
		wav: args.wav,
		durationHint,
		diarizationIntervals: intervals,
	});

	fs.writeFileSync(path.join(OUT_DIR, 'transcript-speakers.txt'), txt);
	fs.writeFileSync(path.join(OUT_DIR, 'transcript-speakers.srt'), srt);
	fs.writeFileSync(path.join(OUT_DIR, 'transcript-speakers.json'), json);

	const report = {
		wav: args.wav,
		speakerCount,
		intervalCount: intervals.length,
		segmentCount: labeled.length,
		diarWallMs,
		whisperWallMs,
		shipModelsBytes: {
			segmentationInt8: fs.statSync(SEG_MODEL).size,
			embeddingCampplus: fs.statSync(EMB_MODEL).size,
		},
		outputs: {
			txt: path.join(OUT_DIR, 'transcript-speakers.txt'),
			srt: path.join(OUT_DIR, 'transcript-speakers.srt'),
			json: path.join(OUT_DIR, 'transcript-speakers.json'),
		},
		sampleLabeled: labeled.slice(0, 8).map(s => ({
			start: s.start,
			end: s.end,
			speaker: s.speaker,
			text: s.text.trim().slice(0, 80),
		})),
	};
	fs.writeFileSync(path.join(OUT_DIR, 'spike-report.json'), `${JSON.stringify(report, null, '\t')}\n`);
	console.log(JSON.stringify(report, null, '\t'));
}

if (import.meta.main) {
	main().catch(err => {
		console.error(err);
		process.exit(1);
	});
}

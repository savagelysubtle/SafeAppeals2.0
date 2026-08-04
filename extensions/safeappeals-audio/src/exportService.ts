/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { StoredRecording, TranscriptSegment } from './types';

export type ExportFormat = 'txt' | 'srt' | 'json' | 'docx';

export const EXPORT_FORMATS: readonly ExportFormat[] = ['txt', 'srt', 'json', 'docx'];

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
	txt: 'Plain Text (.txt)',
	srt: 'Subtitles (.srt)',
	json: 'JSON Data (.json)',
	docx: 'Word Document (.docx)',
};

export function assertHasTranscript(recording: StoredRecording): void {
	if (!recording.transcript || recording.transcript.trim() === '') {
		throw new Error('Recording has no completed transcript to export.');
	}
	if (recording.status !== 'completed') {
		throw new Error('Only completed transcriptions can be exported.');
	}
}

function hasSpeakerLabels(segments: readonly TranscriptSegment[]): boolean {
	return segments.some(seg => !!seg.speaker);
}

export function formatTranscriptTxt(recording: StoredRecording): string {
	assertHasTranscript(recording);
	const segments = recording.transcriptSegments ?? [];
	if (hasSpeakerLabels(segments)) {
		const lines: string[] = [];
		let current: string | undefined;
		for (const seg of segments) {
			const text = seg.text.trim();
			if (!text) {
				continue;
			}
			const speaker = seg.speaker ?? 'Speaker';
			if (speaker !== current) {
				if (lines.length > 0) {
					lines.push('');
				}
				lines.push(`${speaker}:`);
				current = speaker;
			}
			lines.push(text);
		}
		return `${lines.join('\n')}\n`;
	}
	return `${recording.transcript!.trim()}\n`;
}

export function formatTranscriptSrt(recording: StoredRecording): string {
	assertHasTranscript(recording);
	const segments = recording.transcriptSegments ?? [];
	if (segments.length === 0) {
		return `1\n${formatSrtTime(0)} --> ${formatSrtTime(Math.max(recording.duration, 0))}\n${recording.transcript!.trim()}\n`;
	}
	return segments.map((seg, index) => formatSrtCue(index + 1, seg)).join('\n') + '\n';
}

export function formatTranscriptJson(recording: StoredRecording): string {
	assertHasTranscript(recording);
	return `${JSON.stringify({
		id: recording.id,
		filename: recording.filename,
		duration: recording.duration,
		createdAt: recording.createdAt,
		transcript: recording.transcript,
		segments: recording.transcriptSegments ?? [],
		language: recording.language ?? 'en',
	}, null, '\t')}\n`;
}

export async function formatTranscriptDocx(recording: StoredRecording): Promise<Buffer> {
	assertHasTranscript(recording);
	const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');
	const created = new Date(recording.createdAt);
	const dateLabel = Number.isNaN(created.getTime()) ? recording.createdAt : created.toLocaleString();
	const bodyText = formatTranscriptTxt(recording).trimEnd();
	const doc = new Document({
		sections: [{
			children: [
				new Paragraph({
					heading: HeadingLevel.HEADING_1,
					children: [new TextRun(recording.filename)],
				}),
				new Paragraph({
					children: [new TextRun({ text: dateLabel, italics: true })],
				}),
				new Paragraph({ children: [] }),
				...bodyText.split(/\n/).map(line => new Paragraph({
					children: [new TextRun(line)],
				})),
			],
		}],
	});
	return Buffer.from(await Packer.toBuffer(doc));
}

export function exportExtension(format: ExportFormat): string {
	return `.${format}`;
}

export function formatSrtTime(seconds: number): string {
	const totalMs = Math.max(0, Math.round(seconds * 1000));
	const hours = Math.floor(totalMs / 3_600_000);
	const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
	const secs = Math.floor((totalMs % 60_000) / 1000);
	const ms = totalMs % 1000;
	return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(secs, 2)},${pad(ms, 3)}`;
}

function formatSrtCue(index: number, seg: TranscriptSegment): string {
	const text = seg.text.trim();
	const body = seg.speaker ? `${seg.speaker}: ${text}` : text;
	return `${index}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${body}\n`;
}

function pad(value: number, width: number): string {
	return value.toString().padStart(width, '0');
}

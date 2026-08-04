/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

export type RecorderState = 'idle' | 'recording' | 'paused';

export type RecordingStatus = 'pending' | 'transcribing' | 'completed' | 'failed';

export interface TranscriptSegment {
	start: number;
	end: number;
	text: string;
	/** Present after Identify Speakers / diarization (e.g. `Speaker 1`). */
	speaker?: string;
}

export interface StoredRecording {
	id: string;
	filename: string;
	blobRelativePath: string;
	createdAt: string;
	duration: number;
	status: RecordingStatus;
	mimeType: string;
	isImported: boolean;
	originalFilename?: string;
	transcript?: string;
	transcriptSegments?: TranscriptSegment[];
	/** Raw sherpa-onnx intervals; kept for refine re-alignment after a third Whisper pass. */
	diarizationIntervals?: { start: number; end: number; speakerId: number }[];
	language?: string;
	fileSizeBytes?: number;
}

export interface RecordingCatalog {
	version: 1;
	recordings: StoredRecording[];
}

export interface TranscriptionProgress {
	recordingId: string;
	progress: number;
	stage: 'loading_model' | 'processing' | 'finalizing';
}

export const SUPPORTED_AUDIO_EXTENSIONS = [
	'.wav',
	'.mp3',
	'.m4a',
	'.ogg',
	'.webm',
	'.flac',
] as const;

export function isSupportedAudioFile(filename: string): boolean {
	const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
	return (SUPPORTED_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

export interface CapabilityStatus {
	whisperAddon: { available: boolean; detail?: string };
	whisperModel: { available: boolean; path?: string; detail?: string };
	ffmpeg: { available: boolean; path?: string; detail?: string };
	ffprobe: { available: boolean; path?: string; detail?: string };
	diarization: {
		available: boolean;
		enabled: boolean;
		detail?: string;
		binaryPath?: string;
		segmentationModelPath?: string;
		embeddingModelPath?: string;
	};
	secretStorage: { available: boolean; detail?: string };
	memoryOnly: boolean;
}

export const AUDIO_DEK_KEY = 'safeappeals-audio.dek';
export const CATALOG_FILENAME = 'recordings.json';
export const RECORDINGS_DIRNAME = 'recordings';
export const TMP_DIRNAME = 'tmp';

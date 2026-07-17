/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// ============================================================================
// Recording Lifecycle States
// ============================================================================

/**
 * State of the recorder itself (not individual recordings)
 */
export type RecorderState = 'idle' | 'recording' | 'paused';

/**
 * Status of an individual recording
 */
export type RecordingStatus = 'pending' | 'transcribing' | 'completed' | 'failed';

/**
 * Playback state for UI components (managed per-card in React)
 */
export type PlaybackState = 'stopped' | 'playing' | 'paused';

// ============================================================================
// Status Labels & Colors
// ============================================================================

export const RECORDING_STATUS_LABELS: Record<RecordingStatus, string> = {
	pending: 'Pending',
	transcribing: 'Transcribing',
	completed: 'Completed',
	failed: 'Failed'
};

export const RECORDING_STATUS_COLORS: Record<RecordingStatus, string> = {
	pending: 'var(--vscode-charts-yellow)',
	transcribing: 'var(--vscode-charts-blue)',
	completed: 'var(--vscode-charts-green)',
	failed: 'var(--vscode-errorForeground)'
};

export const RECORDER_STATE_COLORS: Record<RecorderState, string> = {
	idle: 'var(--vscode-descriptionForeground)',
	recording: 'var(--vscode-charts-red)',
	paused: 'var(--vscode-charts-yellow)'
};

// ============================================================================
// Recording Data Structures
// ============================================================================

/**
 * Represents a single audio recording or imported audio file
 */
export interface Recording {
	id: string;
	filename: string;
	filePath: string;               // Full path to WAV file
	createdAt: string;              // ISO timestamp
	duration: number;               // Duration in seconds
	status: RecordingStatus;
	transcript?: string;            // Full transcript text
	transcriptSegments?: TranscriptSegment[];  // Timestamped segments
	isImported: boolean;            // true if imported vs recorded
	language?: string;              // Detected language from transcription
}

/**
 * A timestamped segment from transcription
 */
export interface TranscriptSegment {
	start: number;                  // Start time in seconds
	end: number;                    // End time in seconds
	text: string;
}

/**
 * Result from transcription service
 */
export interface TranscriptionResult {
	text: string;
	segments: TranscriptSegment[];
	language: string;
}

/**
 * Progress event during transcription
 */
export interface TranscriptionProgress {
	recordingId: string;
	progress: number;               // 0-100
	stage: 'loading_model' | 'processing' | 'finalizing';
}

// ============================================================================
// Export Formats
// ============================================================================

export type ExportFormat = 'docx' | 'txt' | 'srt' | 'json';

export const EXPORT_FORMAT_LABELS: Record<ExportFormat, string> = {
	docx: 'Word Document (.docx)',
	txt: 'Plain Text (.txt)',
	srt: 'Subtitles (.srt)',
	json: 'JSON Data (.json)'
};

// ============================================================================
// Supported Audio Formats
// ============================================================================

export const SUPPORTED_AUDIO_FORMATS = [
	'audio/wav',
	'audio/wave',
	'audio/x-wav',
	'audio/mp3',
	'audio/mpeg',
	'audio/mp4',
	'audio/m4a',
	'audio/ogg',
	'audio/webm',
	'audio/flac'
] as const;

export const SUPPORTED_AUDIO_EXTENSIONS = [
	'.wav',
	'.mp3',
	'.m4a',
	'.ogg',
	'.webm',
	'.flac'
] as const;

/**
 * Check if a file is a supported audio format
 */
export function isSupportedAudioFile(filename: string): boolean {
	const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
	return SUPPORTED_AUDIO_EXTENSIONS.includes(ext as typeof SUPPORTED_AUDIO_EXTENSIONS[number]);
}

// ============================================================================
// Service Events
// ============================================================================

export interface RecorderStateChangedEvent {
	previousState: RecorderState;
	currentState: RecorderState;
}

export interface RecordingCompletedEvent {
	recording: Recording;
}

export interface RecordingsChangedEvent {
	recordings: Recording[];
}

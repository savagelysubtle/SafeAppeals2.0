/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import {
	ExportFormat,
	RecorderState,
	Recording,
	TranscriptionProgress,
	TranscriptionResult
} from './audioRecorderTypes.js';

// ============================================================================
// Audio Recorder Service Interface
// ============================================================================

export interface IAudioRecorderService {
	readonly _serviceBrand: undefined;

	// ========================================================================
	// Recording Lifecycle
	// ========================================================================

	/**
	 * Current state of the recorder
	 */
	readonly state: RecorderState;

	/**
	 * Fires when the recorder state changes
	 */
	readonly onStateChanged: Event<RecorderState>;

	/**
	 * Start recording audio
	 */
	startRecording(): Promise<void>;

	/**
	 * Stop recording and save the audio file
	 * @returns The completed recording
	 */
	stopRecording(): Promise<Recording>;

	/**
	 * Pause the current recording
	 */
	pauseRecording(): void;

	/**
	 * Resume a paused recording
	 */
	resumeRecording(): void;

	/**
	 * Get the current elapsed recording time in seconds
	 */
	getElapsedTime(): number;

	// ========================================================================
	// Recording Management
	// ========================================================================

	/**
	 * Fires when the recordings list changes
	 */
	readonly onRecordingsChanged: Event<Recording[]>;

	/**
	 * Get all recordings for the current workspace
	 */
	getRecordings(): Promise<Recording[]>;

	/**
	 * Get a single recording by ID
	 */
	getRecording(id: string): Promise<Recording | undefined>;

	/**
	 * Delete a recording
	 */
	deleteRecording(id: string): Promise<void>;

	/**
	 * Import an audio file as a recording
	 */
	importAudio(filePath: string): Promise<Recording>;

	// ========================================================================
	// Playback Support
	// ========================================================================

	/**
	 * Get a blob URL for playing back a recording
	 * The caller is responsible for revoking the URL when done
	 */
	getAudioUrl(recordingId: string): Promise<string>;

	/**
	 * Get the raw audio data for a recording
	 */
	getAudioData(recordingId: string): Promise<Uint8Array>;

	// ========================================================================
	// Transcription
	// ========================================================================

	/**
	 * Fires during transcription to report progress
	 */
	readonly onTranscriptionProgress: Event<TranscriptionProgress>;

	/**
	 * Transcribe a recording using Whisper
	 */
	transcribe(recordingId: string): Promise<TranscriptionResult>;

	/**
	 * Check if the Whisper model is loaded
	 */
	isModelLoaded(): boolean;

	/**
	 * Get the current Whisper model name
	 */
	getModelName(): string;

	// ========================================================================
	// Export
	// ========================================================================

	/**
	 * Export a recording's transcript in the specified format
	 */
	exportRecording(recordingId: string, format: ExportFormat): Promise<void>;
}

export const IAudioRecorderService = createDecorator<IAudioRecorderService>('audioRecorderService');

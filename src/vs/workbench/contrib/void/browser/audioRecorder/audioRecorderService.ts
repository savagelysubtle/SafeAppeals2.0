/*--------------------------------------------------------------------------------------
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IAudioRecorderService } from '../../common/audioRecorder/IAudioRecorderService.js';
import {
	ExportFormat,
	RecorderState,
	Recording,
	TranscriptionProgress,
	TranscriptionResult
} from '../../common/audioRecorder/audioRecorderTypes.js';

// ============================================================================
// Audio Recorder Service Implementation
// ============================================================================

export class AudioRecorderService extends Disposable implements IAudioRecorderService {
	declare readonly _serviceBrand: undefined;

	// IPC channel to main process
	private readonly channel: IChannel;

	// Workspace ID for per-workspace storage
	private workspaceId: string = '';

	// Recording state
	private _state: RecorderState = 'idle';
	private recordingStartTime: number = 0;
	private pausedDuration: number = 0;
	private lastPauseTime: number = 0;

	// Recordings cache
	private _recordings: Recording[] = [];

	// MediaRecorder for browser-side audio capture
	private mediaRecorder: MediaRecorder | null = null;
	private audioChunks: Blob[] = [];

	// Events
	private readonly _onStateChanged = this._register(new Emitter<RecorderState>());
	readonly onStateChanged: Event<RecorderState> = this._onStateChanged.event;

	private readonly _onRecordingsChanged = this._register(new Emitter<Recording[]>());
	readonly onRecordingsChanged: Event<Recording[]> = this._onRecordingsChanged.event;

	private readonly _onTranscriptionProgress = this._register(new Emitter<TranscriptionProgress>());
	readonly onTranscriptionProgress: Event<TranscriptionProgress> = this._onTranscriptionProgress.event;

	// Whisper model state
	private _modelLoaded = false;
	private _modelName = 'distil-whisper/distil-large-v3.5-ONNX';

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super();

		// Get the IPC channel
		this.channel = mainProcessService.getChannel('void-channel-audio-recorder');

		// Initialize workspace
		this.initializeWorkspace();
	}

	// ========================================================================
	// Initialization
	// ========================================================================

	private async initializeWorkspace(): Promise<void> {
		this.workspaceId = this.generateWorkspaceId();

		try {
			await this.channel.call('initialize', { workspaceId: this.workspaceId });
			await this.loadRecordings();
			console.log('[AudioRecorderService] Initialized for workspace:', this.workspaceId);
		} catch (error) {
			console.error('[AudioRecorderService] Failed to initialize:', error);
		}
	}

	private generateWorkspaceId(): string {
		const folders = this.contextService.getWorkspace().folders;
		if (folders.length === 0) {
			// Use a default ID for no workspace
			return 'no-workspace';
		}

		// Hash the workspace path for a consistent ID
		const workspacePath = folders[0].uri.fsPath;
		return this.hashString(workspacePath).substring(0, 16);
	}

	private hashString(str: string): string {
		// Simple hash for browser environment
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			const char = str.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash;
		}
		return Math.abs(hash).toString(16);
	}

	// ========================================================================
	// Recording Lifecycle
	// ========================================================================

	get state(): RecorderState {
		return this._state;
	}

	private setState(newState: RecorderState): void {
		if (this._state !== newState) {
			this._state = newState;
			this._onStateChanged.fire(newState);
		}
	}

	async startRecording(): Promise<void> {
		if (this._state !== 'idle') {
			console.warn('[AudioRecorderService] Cannot start recording, current state:', this._state);
			return;
		}

		try {
			// Request microphone access
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					sampleRate: 16000,
					channelCount: 1
				}
			});

			// Create MediaRecorder
			this.mediaRecorder = new MediaRecorder(stream, {
				mimeType: 'audio/webm'
			});

			this.audioChunks = [];

			this.mediaRecorder.ondataavailable = (event) => {
				if (event.data.size > 0) {
					this.audioChunks.push(event.data);
				}
			};

			this.mediaRecorder.onstop = () => {
				// Stop all tracks to release microphone
				stream.getTracks().forEach(track => track.stop());
			};

			// Start recording
			this.mediaRecorder.start(100); // Collect data every 100ms
			this.recordingStartTime = Date.now();
			this.pausedDuration = 0;

			this.setState('recording');
			console.log('[AudioRecorderService] Recording started');
		} catch (error) {
			console.error('[AudioRecorderService] Failed to start recording:', error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: 'Failed to start recording. Please ensure microphone access is granted.'
			});
			throw error;
		}
	}

	async stopRecording(): Promise<Recording> {
		if (this._state !== 'recording' && this._state !== 'paused') {
			throw new Error('Cannot stop recording, current state: ' + this._state);
		}

		return new Promise((resolve, reject) => {
			if (!this.mediaRecorder) {
				reject(new Error('No MediaRecorder available'));
				return;
			}

			const originalOnStop = this.mediaRecorder.onstop;

			this.mediaRecorder.onstop = async (event) => {
				// Call original onstop to stop tracks
				if (originalOnStop && this.mediaRecorder) {
					originalOnStop.call(this.mediaRecorder, event);
				}

				try {
					// Convert to WAV
					const webmBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
					const wavData = await this.convertToWav(webmBlob);

					// Calculate duration
					const duration = this.getElapsedTime();

					// Generate filename
					const filename = `recording_${Date.now()}.wav`;

					// Save to main process
					const recording = await this.channel.call<Recording>('saveRecording', {
						workspaceId: this.workspaceId,
						audioData: wavData,
						filename,
						duration,
						isImported: false
					});

					// Update local cache
					this._recordings.unshift(recording);
					this._onRecordingsChanged.fire(this._recordings);

					this.setState('idle');
					this.mediaRecorder = null;
					this.audioChunks = [];

					console.log('[AudioRecorderService] Recording saved:', recording.id);
					resolve(recording);
				} catch (error) {
					reject(error);
				}
			};

			this.mediaRecorder.stop();
		});
	}

	pauseRecording(): void {
		if (this._state !== 'recording') {
			console.warn('[AudioRecorderService] Cannot pause, current state:', this._state);
			return;
		}

		if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
			this.mediaRecorder.pause();
			this.lastPauseTime = Date.now();
			this.setState('paused');
			console.log('[AudioRecorderService] Recording paused');
		}
	}

	resumeRecording(): void {
		if (this._state !== 'paused') {
			console.warn('[AudioRecorderService] Cannot resume, current state:', this._state);
			return;
		}

		if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
			this.mediaRecorder.resume();
			this.pausedDuration += Date.now() - this.lastPauseTime;
			this.setState('recording');
			console.log('[AudioRecorderService] Recording resumed');
		}
	}

	getElapsedTime(): number {
		if (this._state === 'idle') {
			return 0;
		}

		const now = Date.now();
		let elapsed = now - this.recordingStartTime - this.pausedDuration;

		if (this._state === 'paused') {
			elapsed -= (now - this.lastPauseTime);
		}

		return Math.max(0, elapsed / 1000); // Return seconds
	}

	// ========================================================================
	// Recording Management
	// ========================================================================

	async getRecordings(): Promise<Recording[]> {
		return this._recordings;
	}

	async getRecording(id: string): Promise<Recording | undefined> {
		return this._recordings.find(r => r.id === id);
	}

	async deleteRecording(id: string): Promise<void> {
		await this.channel.call('deleteRecording', { workspaceId: this.workspaceId, id });

		this._recordings = this._recordings.filter(r => r.id !== id);
		this._onRecordingsChanged.fire(this._recordings);

		console.log('[AudioRecorderService] Recording deleted:', id);
	}

	async importAudio(filePath: string): Promise<Recording> {
		const recording = await this.channel.call<Recording>('importAudioFile', {
			workspaceId: this.workspaceId,
			sourcePath: filePath
		});

		this._recordings.unshift(recording);
		this._onRecordingsChanged.fire(this._recordings);

		console.log('[AudioRecorderService] Audio imported:', recording.id);
		return recording;
	}

	private async loadRecordings(): Promise<void> {
		try {
			this._recordings = await this.channel.call<Recording[]>('getRecordings', {
				workspaceId: this.workspaceId
			});
			this._onRecordingsChanged.fire(this._recordings);
		} catch (error) {
			console.error('[AudioRecorderService] Failed to load recordings:', error);
		}
	}

	// ========================================================================
	// Playback Support
	// ========================================================================

	async getAudioUrl(recordingId: string): Promise<string> {
		const audioData = await this.channel.call<Uint8Array>('getAudioData', {
			workspaceId: this.workspaceId,
			recordingId
		});

		// Create a new ArrayBuffer copy to ensure proper typing for Blob
		const buffer = new ArrayBuffer(audioData.length);
		new Uint8Array(buffer).set(audioData);
		const blob = new Blob([buffer], { type: 'audio/wav' });
		return URL.createObjectURL(blob);
	}

	async getAudioData(recordingId: string): Promise<Uint8Array> {
		return this.channel.call<Uint8Array>('getAudioData', {
			workspaceId: this.workspaceId,
			recordingId
		});
	}

	// ========================================================================
	// Transcription
	// ========================================================================

	async transcribe(recordingId: string): Promise<TranscriptionResult> {
		const recording = await this.getRecording(recordingId);
		if (!recording) {
			throw new Error(`Recording not found: ${recordingId}`);
		}

		// Update status to transcribing
		await this.channel.call('updateTranscriptionStatus', {
			workspaceId: this.workspaceId,
			recordingId,
			status: 'transcribing'
		});

		this.updateLocalRecordingStatus(recordingId, 'transcribing');

		try {
			// Fire progress: loading model
			this._onTranscriptionProgress.fire({
				recordingId,
				progress: 5,
				stage: 'loading_model'
			});

			// Get audio data
			const audioData = await this.getAudioData(recordingId);

			// Dynamic import of transformers
			const { pipeline } = await import('@huggingface/transformers');

			this._onTranscriptionProgress.fire({
				recordingId,
				progress: 15,
				stage: 'loading_model'
			});

			// Create transcription pipeline
			const transcriber = await pipeline('automatic-speech-recognition', this._modelName, {
				dtype: 'fp32'
			});

			this._modelLoaded = true;

			this._onTranscriptionProgress.fire({
				recordingId,
				progress: 30,
				stage: 'processing'
			});

			// Decode WAV to Float32Array
			const audioFloat32 = await this.decodeWavToFloat32(audioData);

			this._onTranscriptionProgress.fire({
				recordingId,
				progress: 40,
				stage: 'processing'
			});

			// Run transcription
			const result = await transcriber(audioFloat32, {
				return_timestamps: true,
				chunk_length_s: 30,
				stride_length_s: 5
			});

			this._onTranscriptionProgress.fire({
				recordingId,
				progress: 90,
				stage: 'finalizing'
			});

			// Format result - handle array or single result
			const singleResult = Array.isArray(result) ? result[0] : result;
			const transcriptionResult: TranscriptionResult = {
				text: singleResult && 'text' in singleResult && typeof singleResult.text === 'string' ? singleResult.text : '',
				segments: singleResult && 'chunks' in singleResult && Array.isArray(singleResult.chunks)
					? singleResult.chunks.map((chunk: { timestamp?: [number, number]; text?: string }) => ({
						start: chunk.timestamp?.[0] ?? 0,
						end: chunk.timestamp?.[1] ?? 0,
						text: chunk.text ?? ''
					}))
					: [],
				language: 'en'
			};

			// Save to database
			await this.channel.call('updateTranscription', {
				workspaceId: this.workspaceId,
				recordingId,
				result: transcriptionResult
			});

			// Update local cache
			this.updateLocalRecording(recordingId, {
				status: 'completed',
				transcript: transcriptionResult.text,
				transcriptSegments: transcriptionResult.segments,
				language: transcriptionResult.language
			});

			this._onTranscriptionProgress.fire({
				recordingId,
				progress: 100,
				stage: 'finalizing'
			});

			console.log('[AudioRecorderService] Transcription complete:', recordingId);
			return transcriptionResult;
		} catch (error) {
			console.error('[AudioRecorderService] Transcription failed:', error);

			await this.channel.call('updateTranscriptionStatus', {
				workspaceId: this.workspaceId,
				recordingId,
				status: 'failed'
			});

			this.updateLocalRecordingStatus(recordingId, 'failed');
			throw error;
		}
	}

	isModelLoaded(): boolean {
		return this._modelLoaded;
	}

	getModelName(): string {
		return this._modelName;
	}

	// ========================================================================
	// Export
	// ========================================================================

	async exportRecording(recordingId: string, format: ExportFormat): Promise<void> {
		const exportPath = await this.channel.call<string>('exportRecording', {
			workspaceId: this.workspaceId,
			recordingId,
			format
		});

		this.notificationService.notify({
			severity: Severity.Info,
			message: `Recording exported to: ${exportPath}`
		});
	}

	// ========================================================================
	// Audio Processing Helpers
	// ========================================================================

	private async convertToWav(webmBlob: Blob): Promise<Uint8Array> {
		// Decode WebM to AudioBuffer using Web Audio API
		const audioContext = new AudioContext({ sampleRate: 16000 });
		const arrayBuffer = await webmBlob.arrayBuffer();
		const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

		// Get mono channel data
		const channelData = audioBuffer.getChannelData(0);

		// Resample if needed
		const targetSampleRate = 16000;
		const resampledData = audioBuffer.sampleRate === targetSampleRate
			? channelData
			: this.resample(channelData, audioBuffer.sampleRate, targetSampleRate);

		// Convert to WAV
		const wavBuffer = this.encodeWav(resampledData, targetSampleRate);

		audioContext.close();
		return wavBuffer;
	}

	private resample(data: Float32Array, fromRate: number, toRate: number): Float32Array {
		const ratio = fromRate / toRate;
		const newLength = Math.round(data.length / ratio);
		const result = new Float32Array(newLength);

		for (let i = 0; i < newLength; i++) {
			const srcIndex = i * ratio;
			const srcIndexFloor = Math.floor(srcIndex);
			const srcIndexCeil = Math.min(srcIndexFloor + 1, data.length - 1);
			const t = srcIndex - srcIndexFloor;
			result[i] = data[srcIndexFloor] * (1 - t) + data[srcIndexCeil] * t;
		}

		return result;
	}

	private encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
		const buffer = new ArrayBuffer(44 + samples.length * 2);
		const view = new DataView(buffer);

		// WAV header
		const writeString = (offset: number, str: string) => {
			for (let i = 0; i < str.length; i++) {
				view.setUint8(offset + i, str.charCodeAt(i));
			}
		};

		writeString(0, 'RIFF');
		view.setUint32(4, 36 + samples.length * 2, true);
		writeString(8, 'WAVE');
		writeString(12, 'fmt ');
		view.setUint32(16, 16, true); // Subchunk1Size
		view.setUint16(20, 1, true); // AudioFormat (PCM)
		view.setUint16(22, 1, true); // NumChannels
		view.setUint32(24, sampleRate, true);
		view.setUint32(28, sampleRate * 2, true); // ByteRate
		view.setUint16(32, 2, true); // BlockAlign
		view.setUint16(34, 16, true); // BitsPerSample
		writeString(36, 'data');
		view.setUint32(40, samples.length * 2, true);

		// Write samples
		const offset = 44;
		for (let i = 0; i < samples.length; i++) {
			const sample = Math.max(-1, Math.min(1, samples[i]));
			view.setInt16(offset + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
		}

		return new Uint8Array(buffer);
	}

	private async decodeWavToFloat32(wavData: Uint8Array): Promise<Float32Array> {
		const view = new DataView(wavData.buffer);

		// Parse WAV header
		const numChannels = view.getUint16(22, true);
		const sampleRate = view.getUint32(24, true);
		const bitsPerSample = view.getUint16(34, true);

		// Find data chunk
		let dataOffset = 44;
		const dataSize = view.getUint32(40, true);

		const numSamples = dataSize / (bitsPerSample / 8) / numChannels;
		const samples = new Float32Array(numSamples);

		for (let i = 0; i < numSamples; i++) {
			const sampleOffset = dataOffset + i * numChannels * (bitsPerSample / 8);

			if (bitsPerSample === 16) {
				const sample = view.getInt16(sampleOffset, true);
				samples[i] = sample / 32768.0;
			} else if (bitsPerSample === 8) {
				const sample = view.getUint8(sampleOffset);
				samples[i] = (sample - 128) / 128.0;
			}
		}

		// Resample to 16kHz if needed
		if (sampleRate !== 16000) {
			return this.resample(samples, sampleRate, 16000);
		}

		return samples;
	}

	// ========================================================================
	// Local Cache Helpers
	// ========================================================================

	private updateLocalRecording(id: string, updates: Partial<Recording>): void {
		const index = this._recordings.findIndex(r => r.id === id);
		if (index !== -1) {
			this._recordings[index] = { ...this._recordings[index], ...updates };
			this._onRecordingsChanged.fire(this._recordings);
		}
	}

	private updateLocalRecordingStatus(id: string, status: Recording['status']): void {
		this.updateLocalRecording(id, { status });
	}
}

registerSingleton(IAudioRecorderService, AudioRecorderService, InstantiationType.Delayed);

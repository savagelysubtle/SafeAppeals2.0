/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { CapabilityService } from './capabilityService';
import {
	AUDIO_EXPORT_FORMAT_LABELS,
	AUDIO_EXPORT_FORMATS,
	assertCanExportAudio,
	exportAudioExtension,
	filterForAudioExport,
	needsFfmpegForExport,
	type AudioExportFormat,
} from './audioExportService';
import {
	assertCanImportNonWav,
	assertCanTranscribeFormat,
	FfmpegHost,
} from './ffmpegHost';
import {
	EXPORT_FORMATS,
	exportExtension,
	formatTranscriptDocx,
	formatTranscriptJson,
	formatTranscriptSrt,
	formatTranscriptTxt,
	type ExportFormat,
} from './exportService';
import { RecordingStore } from './recordingStore';
import { deleteFileIfExists, ensureDir, writeFileAtomic } from './shared/secureFs';
import { assertTranscriptionStorageReady, canTranscribeWithStorage } from './transcriptionGates';
import type { CapabilityStatus, RecorderState, StoredRecording, TranscriptionProgress } from './types';
import { isSupportedAudioFile, TMP_DIRNAME } from './types';
import { alignSpeakers } from './alignSpeakers';
import {
	DiarizationHost,
	isDiarizationEnabledSetting,
	readMaxSpeakersSetting,
	resolveDiarizationPaths,
} from './diarizationHost';
import { DiarizationSlotAdapter } from './ml/adapters/diarizationAdapter';
import { EmbeddingStubAdapter } from './ml/adapters/embeddingAdapter';
import { FfmpegStubAdapter } from './ml/adapters/ffmpegAdapter';
import { WhisperSlotAdapter } from './ml/adapters/whisperAdapter';
import { MlBusyError } from './ml/errors';
import { MlResourceEngine } from './ml/resourceEngine';
import {
	executeRefinePass,
	shouldRunAutoRefine,
} from './transcriptRefine';
import { prepareWhisperInput } from './whisperAudioPrep';
import { WhisperHost } from './whisperHost';

/** Machine-scoped gate for auto refine after diarization (manual Improve Transcript ignores this). */
export function isRefineEnabledSetting(): boolean {
	return vscode.workspace
		.getConfiguration('safeappeals.audio')
		.get<boolean>('refine.enabled', true) === true;
}

/**
 * Façade over RecordingStore, FfmpegHost, WhisperHost, MlResourceEngine, and export helpers.
 */
export class AudioService implements vscode.Disposable {
	private store: RecordingStore | undefined;
	private storeChangeSubscription: vscode.Disposable | undefined;
	private capabilities: CapabilityService | undefined;
	private ffmpegHost: FfmpegHost | undefined;
	private whisperHost: WhisperHost | undefined;
	private diarizationHost: DiarizationHost | undefined;
	private mlEngine: MlResourceEngine | undefined;
	private memoryOnly = true;
	private recorderState: RecorderState = 'idle';
	private elapsedSeconds = 0;
	/** Recording ids with in-flight transcribe or diarize (prevents same-id parallel leases). */
	private readonly busyRecordingIds = new Set<string>();
	/** One-shot toast when auto-diarize is on but assets are missing. */
	private diarizationAssetsMissingWarned = false;
	private readonly disposables: vscode.Disposable[] = [];
	private readonly onDidChangeRecordingsEmitter = new vscode.EventEmitter<StoredRecording[]>();
	private readonly onDidChangeCapabilitiesEmitter = new vscode.EventEmitter<CapabilityStatus>();
	private readonly onCommandRequestEmitter = new vscode.EventEmitter<'startRecording' | 'stopRecording'>();
	private readonly onTranscriptionProgressEmitter = new vscode.EventEmitter<TranscriptionProgress>();

	readonly onDidChangeRecordings = this.onDidChangeRecordingsEmitter.event;
	readonly onDidChangeCapabilities = this.onDidChangeCapabilitiesEmitter.event;
	readonly onCommandRequest = this.onCommandRequestEmitter.event;
	readonly onTranscriptionProgress = this.onTranscriptionProgressEmitter.event;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly log: (message: string) => void,
	) {
		this.disposables.push(
			this.onDidChangeRecordingsEmitter,
			this.onDidChangeCapabilitiesEmitter,
			this.onCommandRequestEmitter,
			this.onTranscriptionProgressEmitter,
			vscode.workspace.onDidChangeWorkspaceFolders(() => {
				void this.reinitialize();
			}),
			vscode.workspace.onDidChangeConfiguration(e => {
				if (e.affectsConfiguration('safeappeals.audio')) {
					void this.refreshCapabilities();
				}
			}),
		);
	}

	async initialize(): Promise<void> {
		await this.reinitialize();
	}

	getRecorderState(): RecorderState {
		return this.recorderState;
	}

	getElapsedSeconds(): number {
		return this.elapsedSeconds;
	}

	setRecorderState(state: RecorderState, elapsedSeconds: number): void {
		this.recorderState = state;
		this.elapsedSeconds = elapsedSeconds;
	}

	hasWorkspace(): boolean {
		return (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
	}

	isMemoryOnly(): boolean {
		return this.memoryOnly;
	}

	getRecordings(): StoredRecording[] {
		return this.store?.getRecordings() ?? [];
	}

	getRecording(id: string): StoredRecording | undefined {
		return this.store?.getRecording(id);
	}

	getCapabilities(): CapabilityStatus | undefined {
		return this.capabilities?.getStatus();
	}

	requestStartRecording(): void {
		this.onCommandRequestEmitter.fire('startRecording');
	}

	requestStopRecording(): void {
		this.onCommandRequestEmitter.fire('stopRecording');
	}

	async saveCapturedAudio(input: {
		filename: string;
		mimeType: string;
		duration: number;
		audioBase64: string;
	}): Promise<StoredRecording> {
		if (!this.store) {
			throw new Error('Audio store is not ready.');
		}
		const audioBytes = Buffer.from(input.audioBase64, 'base64');
		const recording = await this.store.addRecording({
			filename: input.filename,
			mimeType: input.mimeType,
			duration: input.duration,
			audioBytes,
			isImported: false,
		});
		this.log(`Saved recording ${recording.id} (${audioBytes.byteLength} bytes, memoryOnly=${this.memoryOnly})`);
		void this.maybeAutoTranscribeOnSave(recording);
		return recording;
	}

	async importAudioFile(uri: vscode.Uri): Promise<StoredRecording> {
		if (!this.store || !this.ffmpegHost) {
			throw new Error('Audio store is not ready.');
		}
		const basename = path.basename(uri.fsPath);
		if (!isSupportedAudioFile(basename)) {
			throw new Error(`Unsupported audio format: ${basename}`);
		}
		assertCanImportNonWav(this.ffmpegHost.isAvailable(), basename);

		const audioBytes = Buffer.from(await fs.readFile(uri.fsPath));
		const ext = path.extname(basename).toLowerCase();
		const mimeType = mimeForExtension(ext);
		let duration = 0;
		if (this.ffmpegHost.getFfprobe().available) {
			duration = await this.ffmpegHost.probeDuration(uri.fsPath);
		}

		const recording = await this.store.addRecording({
			filename: basename,
			mimeType,
			duration,
			audioBytes,
			isImported: true,
			originalFilename: basename,
		});
		this.log(`Imported ${basename} as ${recording.id}`);
		return recording;
	}

	async deleteRecording(id: string): Promise<void> {
		await this.store?.deleteRecording(id);
	}

	async renameRecording(id: string, filename: string): Promise<StoredRecording | undefined> {
		return this.store?.updateRecording(id, { filename });
	}

	async getPlaybackPayload(id: string): Promise<{ mimeType: string; audioBase64: string } | undefined> {
		const recording = this.store?.getRecording(id);
		if (!recording || !this.store) {
			return undefined;
		}
		const bytes = await this.store.openAudioBytes(id);
		if (!bytes) {
			return undefined;
		}
		return {
			mimeType: recording.mimeType,
			audioBase64: bytes.toString('base64'),
		};
	}

	async clearCache(): Promise<void> {
		await this.store?.clearCache();
	}

	async refreshCapabilities(): Promise<CapabilityStatus | undefined> {
		if (!this.capabilities) {
			return undefined;
		}
		const status = await this.capabilities.refresh();
		this.onDidChangeCapabilitiesEmitter.fire(status);
		return status;
	}

	/**
	 * @param options.rejectIfBusy Default `true` (manual / UI). Auto-transcribe passes
	 * `false` so a different recording can FIFO-queue; same-recording stays a no-op/busy.
	 */
	async transcribeRecording(
		id: string,
		options?: { rejectIfBusy?: boolean },
	): Promise<StoredRecording> {
		if (!this.store || !this.ffmpegHost || !this.whisperHost || !this.mlEngine) {
			throw new Error('Audio service is not ready.');
		}
		const rejectIfBusy = options?.rejectIfBusy ?? true;
		assertTranscriptionStorageReady({
			memoryOnly: this.memoryOnly,
			storeRootDir: this.store.getRootDir(),
			secretStorageAvailable: this.capabilities?.getStatus()?.secretStorage.available,
		});

		const recording = this.store.getRecording(id);
		if (!recording) {
			throw new Error(`Recording not found: ${id}`);
		}
		if (recording.status === 'transcribing' || this.busyRecordingIds.has(id)) {
			throw new MlBusyError('This recording is already being transcribed or diarized.');
		}

		const gate = this.whisperHost.canTranscribe();
		if (!gate.ok) {
			throw new Error(gate.reason);
		}
		assertCanTranscribeFormat(this.ffmpegHost.isAvailable(), recording.filename);

		const previousStatus = recording.status;
		this.busyRecordingIds.add(id);
		await this.store.updateRecording(id, { status: 'transcribing' });

		const tmpPaths: string[] = [];
		// Unique per invocation so parallel callers never share a jobId re-entrancy path.
		const jobId = `${id}:whisper:${randomUUID()}`;
		let completed: StoredRecording | undefined;
		try {
			const audioBytes = await this.store.openAudioBytes(id);
			if (!audioBytes) {
				throw new Error('Could not decrypt audio for transcription.');
			}

			const result = await this.mlEngine.withLease('whisper', { jobId, rejectIfBusy }, async () => {
				// Only verified 16 kHz PCM → pcmf32; everything else requires ffmpeg → 16 kHz WAV.
				// Never hand raw / wrong-rate files to whisper.cpp (hallucination risk).
				const tmpDir = await this.ensureTempDir();
				const prepared = await prepareWhisperInput({
					audioBytes,
					filename: recording.filename,
					mimeType: recording.mimeType,
					tmpDir,
					id,
					ffmpegAvailable: this.ffmpegHost!.isAvailable(),
					convertToWhisperWav: (inputPath, outputWavPath) =>
						this.ffmpegHost!.convertToWhisperWav(inputPath, outputWavPath),
					writeFile: writeFileAtomic,
				});
				tmpPaths.push(...prepared.tmpPaths);
				return this.whisperHost!.transcribe(id, prepared.input);
			});

			const updated = await this.store.updateRecording(id, {
				status: 'completed',
				transcript: result.text,
				transcriptSegments: result.segments,
				language: result.language,
			});
			if (!updated) {
				throw new Error('Failed to persist transcription.');
			}
			completed = updated;
			return updated;
		} catch (error) {
			// Busy reject must not sticky-fail a recording that never started Whisper.
			if (error instanceof MlBusyError) {
				await this.store.updateRecording(id, { status: previousStatus });
			} else {
				await this.store.updateRecording(id, { status: 'failed' });
			}
			throw error;
		} finally {
			this.busyRecordingIds.delete(id);
			for (const tmpPath of tmpPaths) {
				await deleteFileIfExists(tmpPath);
			}
			if (completed) {
				void this.maybeAutoDiarizeAfterTranscribe(completed);
			}
		}
	}

	/**
	 * Run sherpa-onnx diarization and assign speakers onto existing transcript segments.
	 * On failure, ASR text/segments are left unchanged (no partial speaker overwrite).
	 */
	async diarizeRecording(id: string): Promise<StoredRecording> {
		if (!this.store || !this.ffmpegHost || !this.diarizationHost || !this.mlEngine) {
			throw new Error('Audio service is not ready.');
		}
		assertTranscriptionStorageReady({
			memoryOnly: this.memoryOnly,
			storeRootDir: this.store.getRootDir(),
			secretStorageAvailable: this.capabilities?.getStatus()?.secretStorage.available,
		});

		const recording = this.store.getRecording(id);
		if (!recording) {
			throw new Error(`Recording not found: ${id}`);
		}
		if (recording.status === 'transcribing' || this.busyRecordingIds.has(id)) {
			throw new MlBusyError('This recording is already being transcribed or diarized.');
		}
		if (recording.status !== 'completed') {
			throw new Error('Identify Speakers requires a completed transcript.');
		}
		const segments = recording.transcriptSegments;
		if (!segments || segments.length === 0) {
			throw new Error('Identify Speakers requires transcript segments. Re-transcribe the recording first.');
		}

		const caps = this.capabilities?.getStatus();
		if (!caps?.diarization.available) {
			throw new Error(
				caps?.diarization.detail
				?? 'Speaker diarization is unavailable until the sherpa-onnx binary and models are installed.',
			);
		}
		// Diarization always needs 16 kHz mono WAV — never skip convert for "looks like WAV".
		if (!this.ffmpegHost.isAvailable()) {
			throw new Error(
				'ffmpeg is required to prepare 16 kHz mono audio for speaker diarization.',
			);
		}

		this.busyRecordingIds.add(id);
		const tmpPaths: string[] = [];
		const jobId = `${id}:diarization:${randomUUID()}`;
		try {
			const audioBytes = await this.store.openAudioBytes(id);
			if (!audioBytes) {
				throw new Error('Could not decrypt audio for diarization.');
			}

			const tmpDir = await this.ensureTempDir();
			const sourceExt = path.extname(recording.filename) || extForMime(recording.mimeType);
			const sourcePath = path.join(tmpDir, `${id}-diar-source${sourceExt}`);
			await writeFileAtomic(sourcePath, audioBytes);
			tmpPaths.push(sourcePath);

			const wavPath = path.join(tmpDir, `${id}-diar.wav`);
			await this.ffmpegHost.convertToWhisperWav(sourcePath, wavPath);
			tmpPaths.push(wavPath);

			const numClusters = readMaxSpeakersSetting();
			const intervals = await this.mlEngine.withLease(
				'diarization',
				{ jobId, rejectIfBusy: true },
				async () => {
					return this.diarizationHost!.diarize(wavPath, { numClusters });
				},
			);

			const labeled = alignSpeakers(segments, intervals);
			const updated = await this.store.updateRecording(id, {
				transcriptSegments: labeled,
				diarizationIntervals: intervals,
			});
			if (!updated) {
				throw new Error('Failed to persist speaker labels.');
			}
			this.log(`Diarization complete for ${id}: ${intervals.length} intervals → ${labeled.length} segments`);
			return updated;
		} finally {
			this.busyRecordingIds.delete(id);
			for (const tmpPath of tmpPaths) {
				await deleteFileIfExists(tmpPath);
			}
		}
	}

	/**
	 * Third local Whisper pass with a speaker-labeled `initial_prompt`.
	 * On unacceptable output or any failure, prior diarized data is left unchanged.
	 */
	async refineRecording(
		id: string,
		options?: { rejectIfBusy?: boolean },
	): Promise<StoredRecording> {
		if (!this.store || !this.ffmpegHost || !this.whisperHost || !this.mlEngine) {
			throw new Error('Audio service is not ready.');
		}
		const rejectIfBusy = options?.rejectIfBusy ?? true;
		assertTranscriptionStorageReady({
			memoryOnly: this.memoryOnly,
			storeRootDir: this.store.getRootDir(),
			secretStorageAvailable: this.capabilities?.getStatus()?.secretStorage.available,
		});

		const recording = this.store.getRecording(id);
		if (!recording) {
			throw new Error(`Recording not found: ${id}`);
		}
		if (recording.status === 'transcribing' || this.busyRecordingIds.has(id)) {
			throw new MlBusyError('This recording is already being transcribed or diarized.');
		}
		if (recording.status !== 'completed') {
			throw new Error('Improve Transcript requires a completed transcript.');
		}
		const segments = recording.transcriptSegments;
		if (!segments || segments.length === 0) {
			throw new Error('Improve Transcript requires transcript segments. Re-transcribe the recording first.');
		}
		const hasSpeakers = segments.some(seg => !!seg.speaker?.trim());
		const hasIntervals = (recording.diarizationIntervals?.length ?? 0) > 0;
		if (!hasSpeakers && !hasIntervals) {
			throw new Error('Improve Transcript requires speaker-labeled segments. Run Identify Speakers first.');
		}

		const gate = this.whisperHost.canTranscribe();
		if (!gate.ok) {
			throw new Error(gate.reason);
		}
		assertCanTranscribeFormat(this.ffmpegHost.isAvailable(), recording.filename);

		this.busyRecordingIds.add(id);
		const tmpPaths: string[] = [];
		const jobId = `${id}:refine:${randomUUID()}`;
		try {
			const audioBytes = await this.store.openAudioBytes(id);
			if (!audioBytes) {
				throw new Error('Could not decrypt audio for transcript refine.');
			}

			const updated = await executeRefinePass({
				priorSegments: segments,
				diarizationIntervals: recording.diarizationIntervals,
				transcribe: async initialPrompt => {
					return this.mlEngine!.withLease('whisper', { jobId, rejectIfBusy }, async () => {
						const tmpDir = await this.ensureTempDir();
						const prepared = await prepareWhisperInput({
							audioBytes,
							filename: recording.filename,
							mimeType: recording.mimeType,
							tmpDir,
							id,
							ffmpegAvailable: this.ffmpegHost!.isAvailable(),
							convertToWhisperWav: (inputPath, outputWavPath) =>
								this.ffmpegHost!.convertToWhisperWav(inputPath, outputWavPath),
							writeFile: writeFileAtomic,
						});
						tmpPaths.push(...prepared.tmpPaths);
						return this.whisperHost!.transcribe(id, prepared.input, { initialPrompt });
					});
				},
				updateRecording: patch => this.store!.updateRecording(id, patch),
			});
			this.log(
				`Refine complete for ${id}: ${(updated.transcript ?? '').length} chars, ${(updated.transcriptSegments ?? []).length} segments`,
			);
			return updated;
		} finally {
			this.busyRecordingIds.delete(id);
			for (const tmpPath of tmpPaths) {
				await deleteFileIfExists(tmpPath);
			}
		}
	}

	/**
	 * Soft-fail auto refine after diarization when `refine.enabled` and Whisper are ready.
	 */
	async runAutoRefineIfEnabled(recording: StoredRecording): Promise<void> {
		const caps = this.getCapabilities();
		const hasSpeakers = !!recording.transcriptSegments?.some(seg => !!seg.speaker?.trim());
		const hasIntervals = (recording.diarizationIntervals?.length ?? 0) > 0;
		const refineEnabled = isRefineEnabledSetting();
		if (!shouldRunAutoRefine({
			refineEnabled,
			whisperAddonAvailable: !!caps?.whisperAddon.available,
			whisperModelAvailable: !!caps?.whisperModel.available,
			memoryOnly: this.memoryOnly,
			secretStorageAvailable: !!caps?.secretStorage.available,
			hasSpeakers,
			hasIntervals,
			needsFfmpegConversion: FfmpegHost.needsConversion(recording.filename),
			ffmpegAvailable: !!caps?.ffmpeg.available,
		})) {
			if (refineEnabled && (!caps?.whisperAddon.available || !caps.whisperModel.available)) {
				this.log(`autoRefine skipped for ${recording.id}: Whisper not ready`);
			} else if (
				refineEnabled
				&& FfmpegHost.needsConversion(recording.filename)
				&& !caps?.ffmpeg.available
			) {
				this.log(`autoRefine skipped for ${recording.id}: ffmpeg required for format`);
			}
			return;
		}

		try {
			void vscode.window.showInformationMessage(vscode.l10n.t('Improving transcript…'));
			await this.refineRecording(recording.id, { rejectIfBusy: false });
			void vscode.window.showInformationMessage(vscode.l10n.t('Transcript improvement complete.'));
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			this.log(`autoRefine failed for ${recording.id}: ${detail}`);
			void vscode.window.showWarningMessage(
				vscode.l10n.t('Transcript improvement failed: {0}', detail),
			);
		}
	}

	async exportTranscript(id: string, format?: ExportFormat): Promise<void> {
		const recording = this.store?.getRecording(id);
		if (!recording) {
			throw new Error(`Recording not found: ${id}`);
		}

		const chosen = format ?? readConfiguredTranscriptExportFormat();
		if (!chosen) {
			return;
		}

		const bytes = await this.buildExportBytes(recording, chosen);
		const defaultName = `${path.parse(recording.filename).name}${exportExtension(chosen)}`;

		const destination = await vscode.window.showQuickPick(
			[
				{ label: vscode.l10n.t('Save As…'), id: 'save' as const },
				{ label: vscode.l10n.t('Save to Workspace transcripts/'), id: 'workspace' as const },
			],
			{ placeHolder: vscode.l10n.t('Export Destination') },
		);
		if (!destination) {
			return;
		}

		if (destination.id === 'save') {
			const uri = await vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(defaultName),
				filters: filterForFormat(chosen),
				saveLabel: vscode.l10n.t('Export Transcript'),
			});
			if (!uri) {
				return;
			}
			// User-chosen path: never writeFileAtomic (that chmods parent to 0700).
			await fs.writeFile(uri.fsPath, bytes);
			void vscode.window.showInformationMessage(
				vscode.l10n.t('Transcript exported. Exports leave the encrypted store as plain files you chose.'),
			);
			return;
		}

		const folder = vscode.workspace.workspaceFolders?.[0];
		if (!folder) {
			throw new Error('Open a workspace folder to save under transcripts/.');
		}
		const outDir = path.join(folder.uri.fsPath, 'transcripts');
		await fs.mkdir(outDir, { recursive: true });
		const outPath = path.join(outDir, defaultName);
		// Workspace destination: plain write — do not chmod lawyer-owned folders.
		await fs.writeFile(outPath, bytes);
		void vscode.window.showInformationMessage(
			vscode.l10n.t('Transcript saved to {0}. Exports leave the encrypted store as plain files.', outPath),
		);
	}

	/**
	 * Export decrypted audio via Save dialog (WAV / FLAC / MP3 / M4A).
	 * Transcode uses store tmp/ + ffmpeg; passthrough writes bytes when source already matches.
	 */
	async exportAudio(id: string, format?: AudioExportFormat): Promise<void> {
		if (!this.store || !this.ffmpegHost) {
			throw new Error('Audio service is not ready.');
		}
		const recording = this.store.getRecording(id);
		if (!recording) {
			throw new Error(`Recording not found: ${id}`);
		}

		const chosen = format ?? readConfiguredAudioExportFormat();
		if (!chosen) {
			return;
		}

		const ffmpegAvailable = this.ffmpegHost.isAvailable();
		if (needsFfmpegForExport(recording.filename, chosen) && !ffmpegAvailable) {
			void vscode.window.showWarningMessage(
				vscode.l10n.t(
					'ffmpeg is required to export as {0}. Install ffmpeg or set safeappeals.audio.ffmpegPath.',
					AUDIO_EXPORT_FORMAT_LABELS[chosen],
				),
			);
			return;
		}
		assertCanExportAudio(ffmpegAvailable, recording.filename, chosen);

		const defaultName = `${path.parse(recording.filename).name}${exportAudioExtension(chosen)}`;
		const destination = await vscode.window.showQuickPick(
			[
				{ label: vscode.l10n.t('Save As…'), id: 'save' as const },
				{ label: vscode.l10n.t('Save to Workspace recordings/'), id: 'workspace' as const },
			],
			{ placeHolder: vscode.l10n.t('Export Destination') },
		);
		if (!destination) {
			return;
		}

		let destPath: string;
		if (destination.id === 'save') {
			const uri = await vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(defaultName),
				filters: filterForAudioExport(chosen),
				saveLabel: vscode.l10n.t('Export Audio'),
			});
			if (!uri) {
				return;
			}
			destPath = uri.fsPath;
		} else {
			const folder = vscode.workspace.workspaceFolders?.[0];
			if (!folder) {
				throw new Error('Open a workspace folder to save under recordings/.');
			}
			const outDir = path.join(folder.uri.fsPath, 'recordings');
			await fs.mkdir(outDir, { recursive: true });
			destPath = path.join(outDir, defaultName);
		}

		const exportBytes = await this.buildAudioExportBytes(id, recording, chosen);
		// User/workspace path: never writeFileAtomic (that chmods parent to 0700).
		await fs.writeFile(destPath, exportBytes);

		if (destination.id === 'workspace') {
			void vscode.window.showInformationMessage(
				vscode.l10n.t('Audio saved to {0}. Exports leave the encrypted store as plain files.', destPath),
			);
		} else {
			void vscode.window.showInformationMessage(
				vscode.l10n.t('Audio exported. Exports leave the encrypted store as plain files you chose.'),
			);
		}
	}

	/**
	 * Decrypt recording and optionally transcode via managed store tmp/ + ffmpeg.
	 */
	private async buildAudioExportBytes(
		id: string,
		recording: StoredRecording,
		format: AudioExportFormat,
	): Promise<Buffer> {
		if (!this.store || !this.ffmpegHost) {
			throw new Error('Audio service is not ready.');
		}
		const audioBytes = await this.store.openAudioBytes(id);
		if (!audioBytes) {
			throw new Error('Could not decrypt audio for export.');
		}
		if (!needsFfmpegForExport(recording.filename, format)) {
			return audioBytes;
		}
		if (this.memoryOnly || !this.store.getRootDir()) {
			throw new Error(
				'Cannot convert audio for export while secure storage is unavailable.',
			);
		}
		const tmpPaths: string[] = [];
		try {
			const tmpDir = await this.ensureExportTempDir();
			const sourceExt = path.extname(recording.filename) || extForMime(recording.mimeType);
			const sourcePath = path.join(tmpDir, `${id}-export-source${sourceExt}`);
			const outPath = path.join(tmpDir, `${id}-export${exportAudioExtension(format)}`);
			// Register both paths before ffmpeg so failed/partial output is cleaned up.
			tmpPaths.push(sourcePath, outPath);
			await writeFileAtomic(sourcePath, audioBytes);
			await this.ffmpegHost.convertToExportFormat(sourcePath, outPath, format);
			return await fs.readFile(outPath);
		} finally {
			for (const tmpPath of tmpPaths) {
				await deleteFileIfExists(tmpPath);
			}
		}
	}

	async dispose(): Promise<void> {
		this.storeChangeSubscription?.dispose();
		this.storeChangeSubscription = undefined;
		while (this.disposables.length) {
			this.disposables.pop()?.dispose();
		}
		this.busyRecordingIds.clear();
		if (this.mlEngine) {
			await this.mlEngine.dispose();
			this.mlEngine = undefined;
		}
		void this.diarizationHost?.unload();
		this.diarizationHost = undefined;
		this.whisperHost = undefined;
		this.ffmpegHost = undefined;
		this.capabilities = undefined;
		this.store?.dispose();
		this.store = undefined;
	}

	/**
	 * Soft-fail auto-transcribe after capture when the setting is on and capabilities allow it.
	 */
	private async maybeAutoTranscribeOnSave(recording: StoredRecording): Promise<void> {
		const enabled = vscode.workspace.getConfiguration('safeappeals.audio').get<boolean>('autoTranscribeOnSave', false);
		if (!enabled) {
			return;
		}

		const caps = this.getCapabilities();
		if (!canTranscribeWithStorage({
			memoryOnly: this.memoryOnly,
			secretStorageAvailable: caps?.secretStorage.available ?? false,
		})) {
			this.log(`autoTranscribeOnSave skipped for ${recording.id}: secure storage unavailable`);
			void vscode.window.showWarningMessage(
				vscode.l10n.t('Auto-transcribe skipped: secure storage is unavailable.'),
			);
			return;
		}
		if (!caps?.whisperAddon.available || !caps.whisperModel.available) {
			this.log(`autoTranscribeOnSave skipped for ${recording.id}: Whisper not ready`);
			void vscode.window.showWarningMessage(
				vscode.l10n.t('Auto-transcribe skipped: Whisper addon or model is not available.'),
			);
			return;
		}
		if (FfmpegHost.needsConversion(recording.filename) && !caps.ffmpeg.available) {
			this.log(`autoTranscribeOnSave skipped for ${recording.id}: ffmpeg required for non-WAV`);
			void vscode.window.showWarningMessage(
				vscode.l10n.t('Auto-transcribe skipped: ffmpeg is required for this recording format (non-WAV, or WAV that is not 16 kHz PCM).'),
			);
			return;
		}

		try {
			// Queue behind another heavy job; same-recording busy is still a soft no-op via MlBusyError.
			await this.transcribeRecording(recording.id, { rejectIfBusy: false });
			void vscode.window.showInformationMessage(vscode.l10n.t('Transcription complete.'));
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			this.log(`autoTranscribeOnSave failed for ${recording.id}: ${detail}`);
			void vscode.window.showWarningMessage(
				vscode.l10n.t('Auto-transcribe failed: {0}', detail),
			);
		}
	}

	/**
	 * Soft-fail auto-diarize after transcription when diarization is enabled and ready.
	 * `diarization.enabled` gates this path only; manual Identify Speakers ignores it.
	 */
	private async maybeAutoDiarizeAfterTranscribe(recording: StoredRecording): Promise<void> {
		if (!isDiarizationEnabledSetting()) {
			return;
		}
		const caps = this.getCapabilities();
		if (!caps?.diarization.available) {
			this.log(`autoDiarize skipped for ${recording.id}: diarization assets missing`);
			if (!this.diarizationAssetsMissingWarned) {
				this.diarizationAssetsMissingWarned = true;
				void vscode.window.showWarningMessage(
					vscode.l10n.t(
						'Speaker identification is enabled but diarization assets were not found. Configure safeappeals.audio.diarization paths in Settings, install models under app data models/diarization/, or place the Linux spike under the extension .spike-diarization/ folder, then reload.',
					),
				);
			}
			return;
		}
		if (!caps.ffmpeg.available) {
			this.log(`autoDiarize skipped for ${recording.id}: ffmpeg unavailable`);
			return;
		}
		if (this.memoryOnly || !caps.secretStorage.available) {
			return;
		}
		try {
			void vscode.window.showInformationMessage(
				vscode.l10n.t('Identifying speakers…'),
			);
			const diarized = await this.diarizeRecording(recording.id);
			void vscode.window.showInformationMessage(vscode.l10n.t('Speaker identification complete.'));
			await this.runAutoRefineIfEnabled(diarized);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			this.log(`autoDiarize failed for ${recording.id}: ${detail}`);
			void vscode.window.showWarningMessage(
				vscode.l10n.t('Speaker identification failed: {0}', detail),
			);
		}
	}

	private async buildExportBytes(recording: StoredRecording, format: ExportFormat): Promise<Buffer> {
		switch (format) {
			case 'txt':
				return Buffer.from(formatTranscriptTxt(recording), 'utf8');
			case 'srt':
				return Buffer.from(formatTranscriptSrt(recording), 'utf8');
			case 'json':
				return Buffer.from(formatTranscriptJson(recording), 'utf8');
			case 'docx':
				return formatTranscriptDocx(recording);
		}
	}

	/**
	 * Temp only under encrypted store root (`globalStorageUri/workspaces/<hash>/tmp`).
	 * Never uses os.tmpdir() for case audio.
	 */
	private async ensureTempDir(): Promise<string> {
		assertTranscriptionStorageReady({
			memoryOnly: this.memoryOnly,
			storeRootDir: this.store?.getRootDir(),
			secretStorageAvailable: this.capabilities?.getStatus()?.secretStorage.available,
		});
		const root = this.store!.getRootDir()!;
		const tmpDir = path.join(root, TMP_DIRNAME);
		await ensureDir(tmpDir);
		return tmpDir;
	}

	/**
	 * Managed tmp for export transcode (same store root as transcription; never os.tmpdir).
	 */
	private async ensureExportTempDir(): Promise<string> {
		if (this.memoryOnly || !this.store?.getRootDir()) {
			throw new Error(
				'Cannot convert audio for export while secure storage is unavailable.',
			);
		}
		const tmpDir = path.join(this.store.getRootDir()!, TMP_DIRNAME);
		await ensureDir(tmpDir);
		return tmpDir;
	}

	private nativeCacheDir(): string {
		return path.join(this.context.globalStorageUri.fsPath, 'native');
	}

	private async reinitialize(): Promise<void> {
		this.storeChangeSubscription?.dispose();
		this.storeChangeSubscription = undefined;
		this.store?.dispose();
		this.store = undefined;
		this.capabilities = undefined;
		this.ffmpegHost = undefined;
		this.whisperHost = undefined;
		void this.diarizationHost?.unload();
		this.diarizationHost = undefined;
		if (this.mlEngine) {
			await this.mlEngine.dispose();
			this.mlEngine = undefined;
		}

		const folder = vscode.workspace.workspaceFolders?.[0]?.uri;
		const created = await RecordingStore.create(this.context, folder, this.log);
		this.store = created.store;
		this.memoryOnly = created.memoryOnly;

		if (created.memoryOnly) {
			void vscode.window.showWarningMessage(
				vscode.l10n.t(
					'Safe Appeals Audio: secure storage is unavailable. Recordings will stay in memory only for this session and will not be written to disk.',
				),
			);
		} else if (!folder) {
			this.log('No workspace folder; encrypted store uses workspaces/_nofolder until a folder is opened.');
		}

		this.storeChangeSubscription = this.store.onDidChange(recordings => {
			this.onDidChangeRecordingsEmitter.fire(recordings);
		});

		const nativeCacheDir = this.nativeCacheDir();
		const globalStorageFsPath = this.context.globalStorageUri.fsPath;
		const extensionPath = this.context.extensionUri.fsPath;
		this.ffmpegHost = new FfmpegHost(this.log);
		this.capabilities = new CapabilityService(
			this.log,
			this.memoryOnly,
			formatDekReasonDetail(created.dekReason),
			this.ffmpegHost,
			nativeCacheDir,
			globalStorageFsPath,
			extensionPath,
		);
		this.whisperHost = new WhisperHost({
			getModelPath: () => this.capabilities?.getStatus()?.whisperModel.path,
			probeOptions: { cacheDir: nativeCacheDir },
			log: this.log,
			onProgress: progress => this.onTranscriptionProgressEmitter.fire(progress),
		});
		this.diarizationHost = new DiarizationHost({
			getPaths: () => resolveDiarizationPaths(globalStorageFsPath, extensionPath),
			log: this.log,
		});
		this.mlEngine = new MlResourceEngine({}, [
			new WhisperSlotAdapter(this.whisperHost),
			new DiarizationSlotAdapter(this.diarizationHost),
			new EmbeddingStubAdapter(),
			new FfmpegStubAdapter(),
		]);

		const status = await this.capabilities.refresh();
		this.onDidChangeCapabilitiesEmitter.fire(status);
		this.onDidChangeRecordingsEmitter.fire(this.getRecordings());
	}
}

function formatDekReasonDetail(reason: string | undefined): string | undefined {
	if (!reason) {
		return undefined;
	}
	switch (reason) {
		case 'secret-storage-unusable':
			return 'OS keyring / SecretStorage could not store the encryption key.';
		case 'secret-storage-not-durable':
			return 'SecretStorage is not durable across restarts.';
		case 'key-lost-with-data':
			return 'Encryption key was lost while encrypted data remains.';
		default:
			return reason;
	}
}

function mimeForExtension(ext: string): string {
	switch (ext) {
		case '.wav':
			return 'audio/wav';
		case '.mp3':
			return 'audio/mpeg';
		case '.m4a':
			return 'audio/mp4';
		case '.ogg':
			return 'audio/ogg';
		case '.webm':
			return 'audio/webm';
		case '.flac':
			return 'audio/flac';
		default:
			return 'application/octet-stream';
	}
}

function extForMime(mimeType: string): string {
	if (mimeType.includes('wav')) {
		return '.wav';
	}
	if (mimeType.includes('mpeg') || mimeType.includes('mp3')) {
		return '.mp3';
	}
	if (mimeType.includes('mp4') || mimeType.includes('m4a')) {
		return '.m4a';
	}
	if (mimeType.includes('ogg')) {
		return '.ogg';
	}
	if (mimeType.includes('flac')) {
		return '.flac';
	}
	return '.webm';
}

function filterForFormat(format: ExportFormat): { [name: string]: string[] } {
	switch (format) {
		case 'txt':
			return { Text: ['txt'] };
		case 'srt':
			return { Subtitles: ['srt'] };
		case 'json':
			return { JSON: ['json'] };
		case 'docx':
			return { Word: ['docx'] };
	}
}

function readConfiguredAudioExportFormat(): AudioExportFormat {
	const configured = vscode.workspace.getConfiguration('safeappeals.audio').get<string>('defaultAudioExportFormat', 'wav');
	if ((AUDIO_EXPORT_FORMATS as readonly string[]).includes(configured)) {
		return configured as AudioExportFormat;
	}
	return 'wav';
}

function readConfiguredTranscriptExportFormat(): ExportFormat {
	const configured = vscode.workspace.getConfiguration('safeappeals.audio').get<string>('defaultTranscriptExportFormat', 'txt');
	if ((EXPORT_FORMATS as readonly string[]).includes(configured)) {
		return configured as ExportFormat;
	}
	return 'txt';
}

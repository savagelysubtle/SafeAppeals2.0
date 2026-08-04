/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
import * as vscode from 'vscode';
import { AudioService } from './audioService';
import { AudioSidebarProvider } from './audioSidebar';
import { FfmpegHost } from './ffmpegHost';
import { canTranscribeWithStorage } from './transcriptionGates';
import type { StoredRecording } from './types';
import {
	downloadWhisperModelFile,
	existingWhisperModelPath,
	whisperModelDestination,
	WHISPER_MODEL_FILENAME,
} from './whisperModelDownload';
import { probeWhisperAddon } from './whisperProbe';

let audioService: AudioService | undefined;
let outputChannel: vscode.OutputChannel | undefined;

function log(message: string): void {
	outputChannel?.appendLine(`[${new Date().toISOString()}] ${message}`);
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	outputChannel = vscode.window.createOutputChannel('Safe Appeals Audio');
	context.subscriptions.push(outputChannel);

	const nativeCacheDir = path.join(context.globalStorageUri.fsPath, 'native');
	const whisperProbe = probeWhisperAddon({ cacheDir: nativeCacheDir });
	log(
		whisperProbe.loaded
			? `P0 ABI smoke: kutalia loaded (transcribe=${whisperProbe.hasTranscribe})`
			: `P0 ABI smoke: kutalia failed — ${whisperProbe.detail ?? 'unknown'} (pivot to Architecture B if systemic)`,
	);

	audioService = new AudioService(context, log);
	context.subscriptions.push(audioService);
	await audioService.initialize();

	const ensureDefaultWhisperModel = async (options?: {
		readonly showAlreadyPresent?: boolean;
	}): Promise<void> => {
		const destinationPath = whisperModelDestination(context.globalStorageUri.fsPath);
		const already = await existingWhisperModelPath(destinationPath);
		if (already) {
			await audioService?.refreshCapabilities();
			if (options?.showAlreadyPresent) {
				void vscode.window.showInformationMessage(
					vscode.l10n.t('SafeAppeals default Whisper model is already installed.'),
				);
			}
			return;
		}

		try {
			await vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: vscode.l10n.t('Installing SafeAppeals default Whisper model ({0})', WHISPER_MODEL_FILENAME),
					cancellable: true,
				},
				async (progress, token) => {
					const abort = new AbortController();
					const cancelSub = token.onCancellationRequested(() => abort.abort());
					try {
						progress.report({ message: vscode.l10n.t('Starting download…') });
						let lastPercent = -1;
						await downloadWhisperModelFile({
							destinationPath,
							signal: abort.signal,
							onProgress: (downloadedBytes, totalBytes) => {
								if (!totalBytes || totalBytes <= 0) {
									progress.report({
										message: vscode.l10n.t('{0} MB downloaded', (downloadedBytes / (1024 * 1024)).toFixed(1)),
									});
									return;
								}
								const percent = Math.min(100, Math.floor((downloadedBytes / totalBytes) * 100));
								if (percent === lastPercent) {
									return;
								}
								const increment = lastPercent < 0 ? percent : percent - lastPercent;
								lastPercent = percent;
								progress.report({
									increment,
									message: vscode.l10n.t('{0}%', percent),
								});
							},
						});
						await audioService?.refreshCapabilities();
					} finally {
						cancelSub.dispose();
					}
				},
			);
			void vscode.window.showInformationMessage(
				vscode.l10n.t('SafeAppeals default Whisper model is ready.'),
			);
		} catch (error) {
			if (error instanceof Error && error.name === 'AbortError') {
				void vscode.window.showWarningMessage(vscode.l10n.t('Whisper model install cancelled.'));
				return;
			}
			const detail = error instanceof Error ? error.message : String(error);
			log(`Whisper model install failed: ${detail}`);
			void vscode.window.showErrorMessage(
				vscode.l10n.t('SafeAppeals default Whisper model install failed: {0}', detail),
			);
		}
	};

	// Install the researched default model into app data on first activation (no user action required).
	void ensureDefaultWhisperModel();

	const importAudio = async (): Promise<void> => {
		if (audioService?.isMemoryOnly()) {
			void vscode.window.showWarningMessage(
				vscode.l10n.t('Import is disabled while secure storage is unavailable (memory-only mode).'),
			);
			return;
		}
		const caps = audioService?.getCapabilities();
		const picked = await vscode.window.showOpenDialog({
			canSelectMany: false,
			filters: {
				Audio: caps?.ffmpeg.available
					? ['wav', 'mp3', 'm4a', 'ogg', 'webm', 'flac']
					: ['wav'],
			},
			openLabel: vscode.l10n.t('Import Audio'),
		});
		const uri = picked?.[0];
		if (!uri || !audioService) {
			return;
		}
		try {
			await audioService.importAudioFile(uri);
			void vscode.window.showInformationMessage(vscode.l10n.t('Audio file imported.'));
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			void vscode.window.showErrorMessage(detail);
		}
	};

	const clearCache = async (): Promise<void> => {
		if (audioService?.isMemoryOnly()) {
			void vscode.window.showWarningMessage(
				vscode.l10n.t('There is no encrypted audio cache to clear while secure storage is unavailable.'),
			);
			return;
		}
		const confirm = await vscode.window.showWarningMessage(
			vscode.l10n.t('Clear all encrypted audio recordings for the current store? This cannot be undone.'),
			{ modal: true },
			vscode.l10n.t('Clear Audio Cache'),
		);
		if (confirm !== vscode.l10n.t('Clear Audio Cache')) {
			return;
		}
		await audioService?.clearCache();
		void vscode.window.showInformationMessage(vscode.l10n.t('Audio cache cleared.'));
	};

	const openFolder = async (): Promise<void> => {
		await vscode.commands.executeCommand('workbench.action.files.openFolder');
	};

	const chooseWhisperModel = async (): Promise<void> => {
		const proceed = await vscode.window.showWarningMessage(
			vscode.l10n.t(
				'SafeAppeals already installs a default Whisper model researched for typical PCs. Changing it is optional and requires enough RAM/CPU (or GPU) for the model you pick. Accuracy and speed will vary — leave the default unless you know you need another model.',
			),
			{ modal: true },
			vscode.l10n.t('Choose Different Model'),
		);
		if (proceed !== vscode.l10n.t('Choose Different Model')) {
			return;
		}

		const picked = await vscode.window.showOpenDialog({
			canSelectMany: false,
			filters: {
				'Whisper Model': ['bin'],
			},
			openLabel: vscode.l10n.t('Choose Different Model'),
		});
		const uri = picked?.[0];
		if (!uri) {
			return;
		}
		// Machine-scoped setting: Global target writes the machine settings store (not Settings Sync).
		await vscode.workspace.getConfiguration().update(
			'safeappeals.audio.whisperModelPath',
			uri.fsPath,
			vscode.ConfigurationTarget.Global,
		);
		await audioService?.refreshCapabilities();
		void vscode.window.showInformationMessage(
			vscode.l10n.t('Whisper model path updated to {0}. Your mileage may vary with a non-default model.', uri.fsPath),
		);
	};

	const downloadWhisperModel = async (): Promise<void> => {
		// Clear an override so the researched SafeAppeals default is used again.
		await vscode.workspace.getConfiguration().update(
			'safeappeals.audio.whisperModelPath',
			'',
			vscode.ConfigurationTarget.Global,
		);
		await ensureDefaultWhisperModel({ showAlreadyPresent: true });
	};

	const pickRecording = async (requireCompletedTranscript: boolean): Promise<string | undefined> => {
		const recordings = audioService?.getRecordings() ?? [];
		const candidates = requireCompletedTranscript
			? recordings.filter(r => r.status === 'completed' && !!r.transcript)
			: recordings;
		if (candidates.length === 0) {
			void vscode.window.showWarningMessage(
				requireCompletedTranscript
					? vscode.l10n.t('No completed transcripts to export.')
					: vscode.l10n.t('No recordings available.'),
			);
			return undefined;
		}
		const picked = await vscode.window.showQuickPick(
			candidates.map(r => ({
				label: r.filename,
				description: r.status,
				id: r.id,
			})),
			{ placeHolder: vscode.l10n.t('Select Recording') },
		);
		return picked?.id;
	};

	const sidebarProvider = new AudioSidebarProvider(
		context.extensionUri,
		() => audioService,
		importAudio,
		clearCache,
	);

	const openRecorder = async (): Promise<void> => {
		await vscode.commands.executeCommand('workbench.view.extension.safeappeals-audio');
		AudioSidebarProvider.focus();
	};

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(AudioSidebarProvider.viewType, sidebarProvider),
		vscode.commands.registerCommand('safeappeals-audio.openRecorder', () => openRecorder()),
		vscode.commands.registerCommand('safeappeals-audio.openSettings', () =>
			vscode.commands.executeCommand('workbench.action.openSettings', 'safeappeals.audio'),
		),
		vscode.commands.registerCommand('safeappeals-audio.startRecording', async () => {
			await openRecorder();
			audioService?.requestStartRecording();
		}),
		vscode.commands.registerCommand('safeappeals-audio.stopRecording', async () => {
			await openRecorder();
			audioService?.requestStopRecording();
		}),
		vscode.commands.registerCommand('safeappeals-audio.importAudio', () => importAudio()),
		vscode.commands.registerCommand('safeappeals-audio.clearCache', () => clearCache()),
		vscode.commands.registerCommand('safeappeals-audio.openFolder', () => openFolder()),
		vscode.commands.registerCommand('safeappeals-audio.chooseWhisperModel', () => chooseWhisperModel()),
		vscode.commands.registerCommand('safeappeals-audio.downloadWhisperModel', () => downloadWhisperModel()),
		vscode.commands.registerCommand(
			'safeappeals-audio.transcribePcm',
			async (args: { pcm16Base64: string; sampleRate: number }): Promise<string> => {
				if (!audioService) {
					throw new Error('Audio service is not ready.');
				}
				return audioService.transcribePcm(args);
			},
		),
		vscode.commands.registerCommand('safeappeals-audio.transcribe', async () => {
			const id = await pickRecording(false);
			if (!id || !audioService) {
				return;
			}
			const recording = audioService.getRecording(id);
			if (!recording) {
				return;
			}
			const caps = audioService.getCapabilities();
			if (!canTranscribeWithStorage({
				memoryOnly: audioService.isMemoryOnly(),
				secretStorageAvailable: caps?.secretStorage.available ?? false,
			})) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('Transcription is disabled while secure storage is unavailable (memory-only mode).'),
				);
				return;
			}
			if (!caps?.whisperAddon.available || !caps.whisperModel.available) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('Transcription is disabled until the Whisper addon and model path are available.'),
				);
				return;
			}
			if (FfmpegHost.needsConversion(recording.filename) && !caps.ffmpeg.available) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('ffmpeg is required to transcribe non-WAV recordings.'),
				);
				return;
			}
			try {
				await audioService.transcribeRecording(id);
				void vscode.window.showInformationMessage(vscode.l10n.t('Transcription complete.'));
			} catch (error) {
				void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
			}
		}),
		vscode.commands.registerCommand('safeappeals-audio.exportTranscript', async () => {
			const id = await pickRecording(true);
			if (!id || !audioService) {
				return;
			}
			try {
				await audioService.exportTranscript(id);
			} catch (error) {
				void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
			}
		}),
		vscode.commands.registerCommand('safeappeals-audio.exportAudio', async () => {
			const id = await pickRecording(false);
			if (!id || !audioService) {
				return;
			}
			try {
				await audioService.exportAudio(id);
			} catch (error) {
				void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
			}
		}),
		vscode.commands.registerCommand('safeappeals-audio.identifySpeakers', async () => {
			const id = await pickRecording(true);
			if (!id || !audioService) {
				return;
			}
			const recording = audioService.getRecording(id);
			if (!recording) {
				return;
			}
			if (!recording.transcriptSegments?.length) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('Identify Speakers requires transcript segments. Transcribe the recording first.'),
				);
				return;
			}
			const caps = audioService.getCapabilities();
			if (!canTranscribeWithStorage({
				memoryOnly: audioService.isMemoryOnly(),
				secretStorageAvailable: caps?.secretStorage.available ?? false,
			})) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('Identify Speakers is disabled while secure storage is unavailable (memory-only mode).'),
				);
				return;
			}
			if (!caps?.diarization.available) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t(
						'Identify Speakers is unavailable until the sherpa-onnx binary and models are installed. Configure safeappeals.audio.diarization paths in Settings, or place the Linux spike under .spike-diarization/.',
					),
				);
				return;
			}
			if (!caps.ffmpeg.available) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('ffmpeg is required to prepare audio for speaker identification.'),
				);
				return;
			}
			try {
				let diarized: StoredRecording | undefined;
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: vscode.l10n.t('Identifying speakers…'),
						cancellable: false,
					},
					async () => {
						diarized = await audioService!.diarizeRecording(id);
					},
				);
				void vscode.window.showInformationMessage(vscode.l10n.t('Speaker identification complete.'));
				if (diarized) {
					await audioService.runAutoRefineIfEnabled(diarized);
				}
			} catch (error) {
				void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
			}
		}),
		vscode.commands.registerCommand('safeappeals-audio.refineTranscript', async () => {
			const id = await pickRecording(true);
			if (!id || !audioService) {
				return;
			}
			const recording = audioService.getRecording(id);
			if (!recording) {
				return;
			}
			const hasSpeakers = recording.transcriptSegments?.some(seg => !!seg.speaker?.trim());
			const hasIntervals = (recording.diarizationIntervals?.length ?? 0) > 0;
			if (!hasSpeakers && !hasIntervals) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('Improve Transcript requires speaker-labeled segments. Run Identify Speakers first.'),
				);
				return;
			}
			const caps = audioService.getCapabilities();
			if (!canTranscribeWithStorage({
				memoryOnly: audioService.isMemoryOnly(),
				secretStorageAvailable: caps?.secretStorage.available ?? false,
			})) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('Improve Transcript is disabled while secure storage is unavailable (memory-only mode).'),
				);
				return;
			}
			if (!caps?.whisperAddon.available || !caps.whisperModel.available) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('Improve Transcript requires the Whisper addon and model.'),
				);
				return;
			}
			if (FfmpegHost.needsConversion(recording.filename) && !caps.ffmpeg.available) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t('ffmpeg is required to improve transcripts for this recording format.'),
				);
				return;
			}
			try {
				await vscode.window.withProgress(
					{
						location: vscode.ProgressLocation.Notification,
						title: vscode.l10n.t('Improving transcript…'),
						cancellable: false,
					},
					async () => {
						await audioService!.refineRecording(id);
					},
				);
				void vscode.window.showInformationMessage(vscode.l10n.t('Transcript improvement complete.'));
			} catch (error) {
				void vscode.window.showErrorMessage(error instanceof Error ? error.message : String(error));
			}
		}),
	);
}

export function deactivate(): void {
	audioService = undefined;
	outputChannel = undefined;
}

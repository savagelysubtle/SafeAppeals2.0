/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { AudioService } from './audioService';
import { FfmpegHost } from './ffmpegHost';
import type { HostToWebviewMessage, WebviewToHostMessage } from './protocol';
import type { StoredRecording } from './types';

/**
 * Activity-bar webview sidebar for the audio recorder.
 */
export class AudioSidebarProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'safeappeals-audio.sidebar';
	private static current: AudioSidebarProvider | undefined;

	private view: vscode.WebviewView | undefined;
	private readonly viewDisposables: vscode.Disposable[] = [];

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly getService: () => AudioService | undefined,
		private readonly importAudio: () => Promise<void>,
		private readonly clearCache: () => Promise<void>,
	) {
		AudioSidebarProvider.current = this;
	}

	static focus(): void {
		void vscode.commands.executeCommand('safeappeals-audio.sidebar.focus');
	}

	static postCommand(command: 'startRecording' | 'stopRecording'): void {
		void AudioSidebarProvider.current?.postMessage({ type: 'command', command });
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.disposeViewState();
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			enableMicrophone: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar'),
				this.extensionUri,
			],
		};
		webviewView.webview.html = getAudioWebviewHtml(webviewView.webview, this.extensionUri);

		const service = this.getService();
		if (service) {
			this.viewDisposables.push(
				service.onDidChangeRecordings(recordings => {
					void this.postMessage({ type: 'recordingsUpdated', recordings });
				}),
				service.onDidChangeCapabilities(capabilities => {
					void this.postMessage({
						type: 'capabilitiesUpdated',
						capabilities,
						memoryOnly: service.isMemoryOnly(),
					});
				}),
				service.onTranscriptionProgress(progress => {
					void this.postMessage({ type: 'transcriptionProgress', progress });
				}),
				service.onCommandRequest(command => {
					void this.postMessage({ type: 'command', command });
				}),
			);
		}

		this.viewDisposables.push(
			webviewView.webview.onDidReceiveMessage(msg => {
				void this.onMessage(msg as WebviewToHostMessage);
			}),
		);

		webviewView.onDidDispose(() => {
			if (this.view === webviewView) {
				this.disposeViewState();
			}
		});
	}

	private async onMessage(message: WebviewToHostMessage): Promise<void> {
		const service = this.getService();
		try {
			switch (message.type) {
				case 'ready':
					await this.postBootstrap();
					return;
				case 'saveRecording': {
					if (!service) {
						throw new Error('Audio service is not available.');
					}
					await service.saveCapturedAudio(message);
					return;
				}
				case 'deleteRecording':
					await service?.deleteRecording(message.id);
					return;
				case 'renameRecording':
					await service?.renameRecording(message.id, message.filename);
					return;
				case 'requestPlayback': {
					if (!service) {
						return;
					}
					const payload = await service.getPlaybackPayload(message.id);
					if (!payload) {
						void this.postMessage({
							type: 'error',
							message: vscode.l10n.t('Could not decrypt audio for playback.'),
						});
						return;
					}
					void this.postMessage({
						type: 'playbackData',
						id: message.id,
						mimeType: payload.mimeType,
						audioBase64: payload.audioBase64,
					});
					return;
				}
				case 'transcribe': {
					if (!service) {
						return;
					}
					const caps = service.getCapabilities();
					if (service.isMemoryOnly() || !caps?.secretStorage.available) {
						throw new Error(
							vscode.l10n.t('Transcription is disabled while secure storage is unavailable (memory-only mode).'),
						);
					}
					await service.transcribeRecording(message.id);
					void vscode.window.showInformationMessage(vscode.l10n.t('Transcription complete.'));
					return;
				}
				case 'identifySpeakers': {
					if (!service) {
						return;
					}
					const caps = service.getCapabilities();
					if (service.isMemoryOnly() || !caps?.secretStorage.available) {
						throw new Error(
							vscode.l10n.t('Identify Speakers is disabled while secure storage is unavailable (memory-only mode).'),
						);
					}
					if (!caps?.diarization.available) {
						throw new Error(
							caps?.diarization.detail
							?? vscode.l10n.t(
								'Identify Speakers is unavailable until the sherpa-onnx binary and models are installed.',
							),
						);
					}
					if (!caps.ffmpeg.available) {
						throw new Error(
							vscode.l10n.t('ffmpeg is required to prepare audio for speaker identification.'),
						);
					}
					let diarized: StoredRecording | undefined;
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: vscode.l10n.t('Identifying speakers…'),
							cancellable: false,
						},
						async () => {
							diarized = await service.diarizeRecording(message.id);
						},
					);
					void vscode.window.showInformationMessage(vscode.l10n.t('Speaker identification complete.'));
					if (diarized) {
						await service.runAutoRefineIfEnabled(diarized);
					}
					return;
				}
				case 'refineTranscript': {
					if (!service) {
						return;
					}
					const caps = service.getCapabilities();
					if (service.isMemoryOnly() || !caps?.secretStorage.available) {
						throw new Error(
							vscode.l10n.t('Improve Transcript is disabled while secure storage is unavailable (memory-only mode).'),
						);
					}
					if (!caps?.whisperAddon.available || !caps.whisperModel.available) {
						throw new Error(
							vscode.l10n.t('Improve Transcript requires the Whisper addon and model.'),
						);
					}
					const recording = service.getRecording(message.id);
					if (!recording) {
						throw new Error(vscode.l10n.t('Recording not found: {0}', message.id));
					}
					if (FfmpegHost.needsConversion(recording.filename) && !caps.ffmpeg.available) {
						void vscode.window.showWarningMessage(
							vscode.l10n.t('ffmpeg is required to improve transcripts for this recording format.'),
						);
						return;
					}
					await vscode.window.withProgress(
						{
							location: vscode.ProgressLocation.Notification,
							title: vscode.l10n.t('Improving transcript…'),
							cancellable: false,
						},
						async () => {
							await service.refineRecording(message.id);
						},
					);
					void vscode.window.showInformationMessage(vscode.l10n.t('Transcript improvement complete.'));
					return;
				}
				case 'exportTranscript': {
					if (!service) {
						return;
					}
					await service.exportTranscript(message.id, message.format);
					return;
				}
				case 'exportAudio': {
					if (!service) {
						return;
					}
					await service.exportAudio(message.id, message.format);
					return;
				}
				case 'importAudio':
					await this.importAudio();
					return;
				case 'clearCache':
					await this.clearCache();
					return;
				case 'openFolder':
					await vscode.commands.executeCommand('safeappeals-audio.openFolder');
					return;
				case 'chooseWhisperModel':
					await vscode.commands.executeCommand('safeappeals-audio.chooseWhisperModel');
					return;
				case 'downloadWhisperModel':
					await vscode.commands.executeCommand('safeappeals-audio.downloadWhisperModel');
					return;
				case 'recorderState':
					service?.setRecorderState(message.state, message.elapsedSeconds);
					return;
				case 'error':
					void vscode.window.showErrorMessage(message.message);
					return;
			}
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			void this.postMessage({ type: 'error', message: detail });
			void vscode.window.showErrorMessage(detail);
		}
	}

	private async postBootstrap(): Promise<void> {
		const service = this.getService();
		if (!service) {
			return;
		}
		let capabilities = service.getCapabilities();
		if (!capabilities) {
			capabilities = await service.refreshCapabilities();
		}
		if (!capabilities) {
			return;
		}
		await this.postMessage({
			type: 'bootstrap',
			recordings: service.getRecordings(),
			capabilities,
			hasWorkspace: service.hasWorkspace(),
			memoryOnly: service.isMemoryOnly(),
			recorderState: service.getRecorderState(),
			elapsedSeconds: service.getElapsedSeconds(),
		});
	}

	private async postMessage(message: HostToWebviewMessage): Promise<void> {
		await this.view?.webview.postMessage(message);
	}

	private disposeViewState(): void {
		while (this.viewDisposables.length) {
			this.viewDisposables.pop()?.dispose();
		}
		this.view = undefined;
	}
}

export function getAudioWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const mediaRoot = vscode.Uri.joinPath(extensionUri, 'media', 'sidebar');
	const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'sidebar.js'));
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'sidebar.css'));
	const csp = [
		`default-src 'none'`,
		`img-src ${webview.cspSource} https: data:`,
		`media-src ${webview.cspSource} blob: data:`,
		`style-src ${webview.cspSource} 'unsafe-inline'`,
		`script-src ${webview.cspSource}`,
		`font-src ${webview.cspSource}`,
	].join('; ');
	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy" content="${csp}" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<link rel="stylesheet" href="${styleUri}" />
	<title>Audio Recorder</title>
</head>
<body>
	<div id="root"></div>
	<script src="${scriptUri}"></script>
</body>
</html>`;
}

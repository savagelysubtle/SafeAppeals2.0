/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { access } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as vscode from 'vscode';
import {
	isDiarizationEnabledSetting,
	resolveDiarizationPaths,
} from './diarizationHost';
import { FfmpegHost } from './ffmpegHost';
import type { CapabilityStatus } from './types';
import { existingWhisperModelPath, whisperModelDestination } from './whisperModelDownload';
import { probeWhisperAddon } from './whisperProbe';

/**
 * Probes whisper addon, ffmpeg/ffprobe, whisper model path, and diarization assets.
 * Model resolution: machine setting override → managed SafeAppeals app data
 * (`…/User/globalStorage/<extensionId>/models/whisper/`).
 */
export class CapabilityService {
	private cached: CapabilityStatus | undefined;
	private readonly ffmpegHost: FfmpegHost;
	private readonly nativeCacheDir: string | undefined;
	private readonly globalStorageFsPath: string | undefined;
	private readonly extensionPath: string | undefined;

	constructor(
		private readonly log: (message: string) => void,
		private readonly memoryOnly: boolean,
		private readonly secretStorageDetail?: string,
		ffmpegHost?: FfmpegHost,
		nativeCacheDir?: string,
		globalStorageFsPath?: string,
		extensionPath?: string,
	) {
		this.ffmpegHost = ffmpegHost ?? new FfmpegHost(log);
		this.nativeCacheDir = nativeCacheDir;
		this.globalStorageFsPath = globalStorageFsPath;
		this.extensionPath = extensionPath;
	}

	getFfmpegHost(): FfmpegHost {
		return this.ffmpegHost;
	}

	async refresh(): Promise<CapabilityStatus> {
		const whisper = probeWhisperAddon(
			this.nativeCacheDir ? { cacheDir: this.nativeCacheDir } : {},
		);
		this.log(
			whisper.loaded
				? `Whisper addon: ${whisper.detail ?? 'loaded'}`
				: `Whisper addon failed to load: ${whisper.detail ?? 'unknown'}`,
		);

		const { ffmpeg, ffprobe } = await this.ffmpegHost.refresh();
		const model = await this.resolveModelPath();
		const diarization = await this.resolveDiarization();

		this.cached = {
			whisperAddon: {
				available: whisper.loaded && whisper.hasTranscribe,
				detail: whisper.detail,
			},
			whisperModel: model,
			ffmpeg,
			ffprobe,
			diarization,
			secretStorage: {
				available: !this.memoryOnly,
				detail: this.secretStorageDetail,
			},
			memoryOnly: this.memoryOnly,
		};
		return this.cached;
	}

	getStatus(): CapabilityStatus | undefined {
		return this.cached;
	}

	canTranscribe(): boolean {
		const status = this.cached;
		return !!status
			&& !status.memoryOnly
			&& status.secretStorage.available
			&& status.whisperAddon.available
			&& status.whisperModel.available;
	}

	/**
	 * True when binary + models are present and secure storage is ready.
	 * Manual Identify Speakers does not require `diarization.enabled` (that gates auto only).
	 */
	canDiarize(): boolean {
		const status = this.cached;
		return !!status
			&& !status.memoryOnly
			&& status.secretStorage.available
			&& status.diarization.available;
	}

	/**
	 * True when manual diarize is possible and auto-after-transcribe is enabled.
	 */
	canAutoDiarize(): boolean {
		return this.canDiarize() && isDiarizationEnabledSetting();
	}

	private async resolveModelPath(): Promise<{ available: boolean; path?: string; detail?: string }> {
		const configured = vscode.workspace
			.getConfiguration()
			.get<string>('safeappeals.audio.whisperModelPath', '')
			?.trim();

		if (configured) {
			try {
				await access(configured, fsConstants.R_OK);
				return { available: true, path: configured };
			} catch {
				return {
					available: false,
					path: configured,
					detail: `Whisper model not readable: ${configured}. Reinstall the SafeAppeals default or choose a different model (requires suitable hardware; results vary).`,
				};
			}
		}

		// Default: SafeAppeals app data for this extension (machine-local, not per-workspace).
		if (this.globalStorageFsPath) {
			const managed = whisperModelDestination(this.globalStorageFsPath);
			const existing = await existingWhisperModelPath(managed);
			if (existing) {
				this.log(`Whisper model: using SafeAppeals default at ${existing}`);
				return { available: true, path: existing };
			}
		}

		return {
			available: false,
			detail: 'SafeAppeals default Whisper model is not installed yet. It installs automatically on startup; use Install Default Whisper Model to retry, or Choose Different Whisper Model… only if your hardware can run another model.',
		};
	}

	private async resolveDiarization(): Promise<CapabilityStatus['diarization']> {
		const enabled = isDiarizationEnabledSetting();
		const paths = await resolveDiarizationPaths(this.globalStorageFsPath, this.extensionPath);
		if (!paths) {
			this.log('Diarization: binary/models missing (hard-disabled until installed or paths configured)');
			return {
				available: false,
				enabled,
				detail: 'Speaker diarization requires the sherpa-onnx binary and segmentation/embedding models. Set safeappeals.audio.diarization.binaryPath / segmentationModelPath / embeddingModelPath, install under app data models/diarization/, or place the Linux spike under .spike-diarization/.',
			};
		}
		this.log(`Diarization: available at ${paths.binary}`);
		return {
			available: true,
			enabled,
			binaryPath: paths.binary,
			segmentationModelPath: paths.segmentationModel,
			embeddingModelPath: paths.embeddingModel,
		};
	}
}

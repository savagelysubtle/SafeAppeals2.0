/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { access, constants as fsConstants } from 'node:fs';
import { spawn, type ChildProcess } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import * as vscode from 'vscode';
import {
	parseDiarizationOutput,
	type DiarizationInterval,
} from './alignSpeakers';
import { MlBackendUnavailableError, MlCancelledError } from './ml/errors';

const accessAsync = promisify(access);

const MANAGED_DIARIZATION_DIRNAME = 'models';
const MANAGED_DIARIZATION_SUBDIR = 'diarization';
const DEFAULT_BINARY_NAME = 'sherpa-onnx-offline-speaker-diarization';
const DEFAULT_SEG_REL = path.join('sherpa-onnx-pyannote-segmentation-3-0', 'model.int8.onnx');
const DEFAULT_EMB_REL = '3dspeaker_speech_campplus_sv_en_voxceleb_16k.onnx';
/** Local Linux spike layout under the extension folder (dev / smoke only). */
const SPIKE_DIARIZATION_DIR = '.spike-diarization';
const SPIKE_LINUX_SHARED_DIR = 'sherpa-onnx-v1.13.4-linux-x64-shared';

const KILL_ESCALATE_MS = 2_000;

export interface DiarizationPaths {
	readonly binary: string;
	readonly segmentationModel: string;
	readonly embeddingModel: string;
	/** Directory to prepend to LD_LIBRARY_PATH (sherpa shared libs). */
	readonly libraryDir?: string;
}

export interface DiarizeOptions {
	readonly numClusters: number;
	readonly signal?: AbortSignal;
}

export interface DiarizationHostOptions {
	readonly getPaths: () => Promise<DiarizationPaths | undefined> | DiarizationPaths | undefined;
	readonly log?: (message: string) => void;
}

/**
 * Spawns sherpa-onnx offline speaker diarization CLI.
 * Never writes case audio — callers pass a managed-tmp WAV path.
 */
export class DiarizationHost {
	private activeChild: ChildProcess | undefined;
	private killEscalateTimer: ReturnType<typeof setTimeout> | undefined;

	constructor(private readonly options: DiarizationHostOptions) { }

	async resolvePaths(): Promise<DiarizationPaths | undefined> {
		return this.options.getPaths();
	}

	async isAvailable(): Promise<boolean> {
		const paths = await this.resolvePaths();
		return !!paths;
	}

	/**
	 * Soft-cancel: SIGTERM the active child, then SIGKILL after a short grace period.
	 */
	cancel(_reason?: string): void {
		this.killActiveChild();
	}

	async unload(): Promise<void> {
		this.killActiveChild();
	}

	/**
	 * Run diarization on a 16 kHz mono WAV under managed storage.
	 */
	async diarize(wavPath: string, options: DiarizeOptions): Promise<DiarizationInterval[]> {
		if (options.signal?.aborted) {
			throw new MlCancelledError('Diarization aborted before start.');
		}

		const resolved = await this.resolvePaths();
		if (!resolved) {
			throw new MlBackendUnavailableError(
				'Diarization is unavailable: sherpa-onnx binary or models are not installed. Set safeappeals.audio.diarization.* paths or install models under app data models/diarization/.',
			);
		}

		const numClusters = clampMaxSpeakers(options.numClusters);
		const args = [
			`--clustering.num-clusters=${numClusters}`,
			`--segmentation.pyannote-model=${resolved.segmentationModel}`,
			`--embedding.model=${resolved.embeddingModel}`,
			wavPath,
		];

		const env = { ...process.env };
		if (resolved.libraryDir) {
			const existing = env.LD_LIBRARY_PATH ?? '';
			env.LD_LIBRARY_PATH = existing
				? `${resolved.libraryDir}${path.delimiter}${existing}`
				: resolved.libraryDir;
		}

		this.options.log?.(
			`Diarization: spawning ${resolved.binary} (clusters=${numClusters})`,
		);

		const combined = await this.spawnAndCollect(resolved.binary, args, env, options.signal);
		const intervals = parseDiarizationOutput(combined);
		if (intervals.length === 0) {
			throw new Error('Diarization produced no speaker intervals.');
		}
		return intervals;
	}

	private spawnAndCollect(
		binary: string,
		args: string[],
		env: NodeJS.ProcessEnv,
		signal?: AbortSignal,
	): Promise<string> {
		return new Promise((resolve, reject) => {
			if (signal?.aborted) {
				reject(new MlCancelledError('Diarization aborted before start.'));
				return;
			}

			const child = spawn(binary, args, {
				env,
				stdio: ['ignore', 'pipe', 'pipe'],
			});
			this.activeChild = child;

			let stdout = '';
			let stderr = '';
			child.stdout?.setEncoding('utf8');
			child.stderr?.setEncoding('utf8');
			child.stdout?.on('data', (chunk: string) => {
				stdout += chunk;
			});
			child.stderr?.on('data', (chunk: string) => {
				stderr += chunk;
			});

			const onAbort = () => {
				this.killActiveChild();
			};
			signal?.addEventListener('abort', onAbort, { once: true });

			const cleanup = () => {
				signal?.removeEventListener('abort', onAbort);
				if (this.activeChild === child) {
					this.activeChild = undefined;
				}
				if (this.killEscalateTimer) {
					clearTimeout(this.killEscalateTimer);
					this.killEscalateTimer = undefined;
				}
			};

			child.on('error', error => {
				cleanup();
				reject(new Error(`Failed to start diarization binary: ${error.message}`));
			});

			child.on('close', (code, killSignal) => {
				cleanup();
				const combined = `${stdout}\n${stderr}`;
				if (signal?.aborted || killSignal === 'SIGTERM' || killSignal === 'SIGKILL') {
					reject(new MlCancelledError('Diarization was cancelled.'));
					return;
				}
				if (code !== 0) {
					reject(new Error(
						`Diarization failed (exit ${code ?? 'unknown'}): ${combined.slice(-2000)}`,
					));
					return;
				}
				resolve(combined);
			});
		});
	}

	private killActiveChild(): void {
		const child = this.activeChild;
		if (!child || child.killed) {
			return;
		}
		try {
			child.kill('SIGTERM');
		} catch {
			// ignore
		}
		if (this.killEscalateTimer) {
			clearTimeout(this.killEscalateTimer);
		}
		this.killEscalateTimer = setTimeout(() => {
			if (this.activeChild === child && !child.killed) {
				try {
					child.kill('SIGKILL');
				} catch {
					// ignore
				}
			}
			this.killEscalateTimer = undefined;
		}, KILL_ESCALATE_MS);
	}
}

export function clampMaxSpeakers(value: number): number {
	if (!Number.isFinite(value)) {
		return 2;
	}
	return Math.min(4, Math.max(1, Math.round(value)));
}

export function readMaxSpeakersSetting(): number {
	const raw = vscode.workspace
		.getConfiguration('safeappeals.audio')
		.get<number>('diarization.maxSpeakers', 2);
	return clampMaxSpeakers(raw ?? 2);
}

export function isDiarizationEnabledSetting(): boolean {
	return vscode.workspace
		.getConfiguration('safeappeals.audio')
		.get<boolean>('diarization.enabled', true) === true;
}

/**
 * Resolve binary + model paths:
 * 1) Explicit machine settings (all three) when present and readable
 * 2) Managed `globalStorage/models/diarization/` layout when complete
 * 3) Extension-relative Linux spike layout under `.spike-diarization/` when readable
 * 4) Otherwise undefined (hard-disable)
 */
export async function resolveDiarizationPaths(
	globalStorageFsPath: string | undefined,
	extensionPath?: string,
): Promise<DiarizationPaths | undefined> {
	const cfg = vscode.workspace.getConfiguration('safeappeals.audio');
	const binarySetting = cfg.get<string>('diarization.binaryPath', '')?.trim() ?? '';
	const segSetting = cfg.get<string>('diarization.segmentationModelPath', '')?.trim() ?? '';
	const embSetting = cfg.get<string>('diarization.embeddingModelPath', '')?.trim() ?? '';

	if (binarySetting && segSetting && embSetting) {
		const ok = await allReadable([binarySetting, segSetting, embSetting]);
		if (ok) {
			return {
				binary: binarySetting,
				segmentationModel: segSetting,
				embeddingModel: embSetting,
				libraryDir: await libraryDirBesideBinary(binarySetting),
			};
		}
		return undefined;
	}

	if (globalStorageFsPath) {
		const root = path.join(globalStorageFsPath, MANAGED_DIARIZATION_DIRNAME, MANAGED_DIARIZATION_SUBDIR);
		const binary = path.join(root, 'bin', DEFAULT_BINARY_NAME);
		const segmentationModel = path.join(root, DEFAULT_SEG_REL);
		const embeddingModel = path.join(root, DEFAULT_EMB_REL);
		const ok = await allReadable([binary, segmentationModel, embeddingModel]);
		if (ok) {
			return {
				binary,
				segmentationModel,
				embeddingModel,
				libraryDir: await libraryDirBesideBinary(binary),
			};
		}
	}

	if (extensionPath) {
		const spike = spikeDiarizationPaths(extensionPath);
		const ok = await allReadable([spike.binary, spike.segmentationModel, spike.embeddingModel]);
		if (ok) {
			return {
				...spike,
				libraryDir: await libraryDirBesideBinary(spike.binary),
			};
		}
	}

	return undefined;
}

/**
 * Linux spike asset layout under `{extensionPath}/.spike-diarization/`.
 * Used for local smoke; only returned when files are readable.
 */
export function spikeDiarizationPaths(extensionPath: string): Omit<DiarizationPaths, 'libraryDir'> {
	const root = path.join(extensionPath, SPIKE_DIARIZATION_DIR);
	return {
		binary: path.join(root, SPIKE_LINUX_SHARED_DIR, 'bin', DEFAULT_BINARY_NAME),
		segmentationModel: path.join(root, 'models', DEFAULT_SEG_REL),
		embeddingModel: path.join(root, 'models', DEFAULT_EMB_REL),
	};
}

async function libraryDirBesideBinary(binaryPath: string): Promise<string | undefined> {
	const libDir = path.resolve(path.dirname(binaryPath), '..', 'lib');
	try {
		await accessAsync(libDir, fsConstants.R_OK);
		return libDir;
	} catch {
		return undefined;
	}
}

async function allReadable(paths: readonly string[]): Promise<boolean> {
	for (const p of paths) {
		try {
			await accessAsync(p, fsConstants.R_OK);
		} catch {
			return false;
		}
	}
	return true;
}

export function managedDiarizationRoot(globalStorageFsPath: string): string {
	return path.join(globalStorageFsPath, MANAGED_DIARIZATION_DIRNAME, MANAGED_DIARIZATION_SUBDIR);
}

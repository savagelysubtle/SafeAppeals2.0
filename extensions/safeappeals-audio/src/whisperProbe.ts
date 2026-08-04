/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';

export interface WhisperTranscribeOptions {
	model: string;
	language?: string;
	use_gpu?: boolean;
	no_prints?: boolean;
	translate?: boolean;
	no_timestamps?: boolean;
	/** Optional cue text for a local refine pass (never used for cloud/LM). */
	initial_prompt?: string;
	progress_callback?: (progress: number) => void;
	fname_inp?: string;
	pcmf32?: Float32Array;
}

export type WhisperTranscribeFn = (options: WhisperTranscribeOptions) => Promise<unknown>;

export interface WhisperAddonProbeResult {
	readonly loaded: boolean;
	readonly hasTranscribe: boolean;
	readonly detail?: string;
	readonly nativeLibDir?: string;
	readonly transcribe?: WhisperTranscribeFn;
}

export interface WhisperProbeOptions {
	/**
	 * Managed directory (typically under `context.globalStorageUri/native`) where kutalia
	 * binaries are copied and RUNPATH-fixed. Vendor `node_modules` is never mutated.
	 */
	readonly cacheDir?: string;
}

/** Stale CI RUNPATH strings embedded in kutalia linux prebuilds. */
const STALE_RUNPATHS = [
	'/home/runner/work/whisper-node-addon/whisper-node-addon/deps/whisper.cpp/build/Release:',
	'/home/runner/work/whisper-node-addon/whisper-node-addon/deps/whisper.cpp/build/Release',
] as const;

let cachedProbe: WhisperAddonProbeResult | undefined;
let cachedProbeKey: string | undefined;

/**
 * Resolve vendor platform folder. On macOS, try both `mac-${arch}` (kutalia layout)
 * and `darwin-${arch}` before failing.
 */
export function resolveVendorNativeLibDir(): string | undefined {
	try {
		const addonRoot = path.dirname(require.resolve('@kutalia/whisper-node-addon/package.json'));
		const arch = os.arch();
		const candidates: string[] = [];
		if (process.platform === 'darwin') {
			candidates.push(`mac-${arch}`, `darwin-${arch}`);
		} else if (process.platform === 'win32') {
			candidates.push(`win32-${arch}`);
		} else {
			candidates.push(`linux-${arch}`);
		}
		for (const folder of candidates) {
			const nativeLibDir = path.join(addonRoot, 'dist', folder);
			if (fs.existsSync(path.join(nativeLibDir, 'whisper.node'))) {
				return nativeLibDir;
			}
		}
		return undefined;
	} catch {
		return undefined;
	}
}

function replaceStaleRunpath(data: Buffer): { buffer: Buffer; changed: boolean } {
	let changed = false;
	const next = Buffer.from(data);
	for (const stale of STALE_RUNPATHS) {
		const staleBuf = Buffer.from(stale, 'ascii');
		let index = next.indexOf(staleBuf);
		while (index >= 0) {
			const replacement = Buffer.concat([
				Buffer.from('$ORIGIN', 'ascii'),
				Buffer.alloc(stale.length - '$ORIGIN'.length, 0),
			]);
			replacement.copy(next, index);
			changed = true;
			index = next.indexOf(staleBuf, index + 1);
		}
	}
	return { buffer: next, changed };
}

/**
 * Copy vendor natives into a managed cache and rewrite RUNPATH only on the copy.
 * Never mutates files under node_modules.
 */
function prepareManagedNativeDir(vendorDir: string, cacheDir: string): string {
	const marker = path.basename(vendorDir);
	let version = 'unknown';
	try {
		const pkg = JSON.parse(
			fs.readFileSync(require.resolve('@kutalia/whisper-node-addon/package.json'), 'utf8'),
		) as { version?: string };
		version = pkg.version ?? 'unknown';
	} catch {
		// keep unknown
	}
	const managedDir = path.join(cacheDir, `kutalia-${version}-${marker}`);
	fs.mkdirSync(managedDir, { recursive: true, mode: 0o700 });

	const stampPath = path.join(managedDir, '.ready');
	if (!fs.existsSync(stampPath)) {
		for (const entry of fs.readdirSync(vendorDir)) {
			const from = path.join(vendorDir, entry);
			const to = path.join(managedDir, entry);
			const stat = fs.statSync(from);
			if (!stat.isFile()) {
				continue;
			}
			fs.copyFileSync(from, to);
			if (process.platform !== 'win32') {
				fs.chmodSync(to, 0o600);
			}
		}
		if (process.platform === 'linux') {
			fixRunpathsInDir(managedDir);
		}
		fs.writeFileSync(stampPath, `${new Date().toISOString()}\n`, { mode: 0o600 });
	} else if (process.platform === 'linux') {
		// Idempotent: ensure copies still have $ORIGIN (e.g. partial prior write).
		fixRunpathsInDir(managedDir);
	}

	return managedDir;
}

function fixRunpathsInDir(dir: string): void {
	let entries: string[];
	try {
		entries = fs.readdirSync(dir);
	} catch {
		return;
	}
	for (const entry of entries) {
		if (entry !== 'whisper.node' && !entry.includes('.so')) {
			continue;
		}
		const filePath = path.join(dir, entry);
		try {
			const data = fs.readFileSync(filePath);
			const replaced = replaceStaleRunpath(data);
			if (replaced.changed) {
				fs.writeFileSync(filePath, replaced.buffer);
			}
		} catch {
			// Best-effort per file.
		}
	}
}

function loadTranscribeFromNativeDir(nativeLibDir: string): WhisperTranscribeFn {
	const nodePath = path.join(nativeLibDir, 'whisper.node');
	// Absolute require loads the .node from the managed copy ($ORIGIN finds sibling libs).
	// eslint-disable-next-line @typescript-eslint/no-require-imports
	const binding = require(nodePath) as { whisper?: (...args: unknown[]) => unknown };
	if (typeof binding.whisper !== 'function') {
		throw new Error('whisper.node loaded but whisper() export is missing');
	}
	const whisperAsync = promisify(binding.whisper.bind(binding)) as (params: Record<string, unknown>) => Promise<unknown>;
	return async (options: WhisperTranscribeOptions) => {
		if (!options.model) {
			throw new Error('Model path is required');
		}
		if (!options.fname_inp && !options.pcmf32) {
			throw new Error('Input file path or pcmf32 is required');
		}
		return whisperAsync({
			language: 'en',
			use_gpu: true,
			flash_attn: false,
			no_prints: true,
			comma_in_time: false,
			no_timestamps: false,
			detect_language: false,
			audio_ctx: 0,
			max_len: 0,
			...options,
			// Always override — never translate legal case audio.
			translate: false,
		});
	};
}

/**
 * Attempt to load `@kutalia/whisper-node-addon` natives.
 *
 * Prefer copying into {@link WhisperProbeOptions.cacheDir} and loading from that copy
 * (RUNPATH rewritten to `$ORIGIN` on the copy only). Vendor node_modules is never mutated.
 * Does not set process-wide `LD_LIBRARY_PATH` — `$ORIGIN` on the managed copy is sufficient
 * on Linux when the rewrite succeeds.
 */
export function probeWhisperAddon(options: WhisperProbeOptions = {}): WhisperAddonProbeResult {
	const probeKey = options.cacheDir ?? '';
	if (cachedProbe && cachedProbeKey === probeKey) {
		return cachedProbe;
	}

	const vendorDir = resolveVendorNativeLibDir();
	if (!vendorDir) {
		const result: WhisperAddonProbeResult = {
			loaded: false,
			hasTranscribe: false,
			detail: 'kutalia native platform folder not found (tried mac-/darwin-/linux-/win32- layouts)',
		};
		cachedProbe = result;
		cachedProbeKey = probeKey;
		return result;
	}

	try {
		let nativeLibDir = vendorDir;
		if (options.cacheDir) {
			nativeLibDir = prepareManagedNativeDir(vendorDir, options.cacheDir);
		} else if (process.platform === 'linux') {
			// Without a managed cache, refuse to mutate vendor files; load may fail on linux.
			const result: WhisperAddonProbeResult = {
				loaded: false,
				hasTranscribe: false,
				nativeLibDir: vendorDir,
				detail: 'Whisper native cacheDir is required on Linux (managed copy with $ORIGIN RUNPATH).',
			};
			cachedProbe = result;
			cachedProbeKey = probeKey;
			return result;
		}

		const transcribe = loadTranscribeFromNativeDir(nativeLibDir);
		const result: WhisperAddonProbeResult = {
			loaded: true,
			hasTranscribe: true,
			nativeLibDir,
			transcribe,
			detail: `Whisper native addon loaded from managed copy (${nativeLibDir})`,
		};
		cachedProbe = result;
		cachedProbeKey = probeKey;
		return result;
	} catch (error) {
		const result: WhisperAddonProbeResult = {
			loaded: false,
			hasTranscribe: false,
			nativeLibDir: vendorDir,
			detail: error instanceof Error ? error.message : String(error),
		};
		cachedProbe = result;
		cachedProbeKey = probeKey;
		return result;
	}
}

/** Test helper: clear module-level probe cache. */
export function resetWhisperProbeCacheForTests(): void {
	cachedProbe = undefined;
	cachedProbeKey = undefined;
}

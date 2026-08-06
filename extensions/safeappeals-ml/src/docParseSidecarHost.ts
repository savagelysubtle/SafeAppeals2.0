/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { smokeDocParseHealth, type SmokeFetch } from './docParseSmoke';

const HEALTH_POLL_INTERVAL_MS = 500;
const HEALTH_TIMEOUT_MS = 60_000;

export type DocParseSpawn = (
	command: string,
	args: readonly string[],
	options: SpawnOptions,
) => ChildProcess;

export interface DocParseSidecarHostOptions {
	readonly extensionPath: string;
	/** Directory containing Unlimited-OCR weights; required to spawn. */
	modelDir?: string;
	readonly baseUrl?: string;
	readonly log: (message: string) => void;
	readonly smokeFetch?: SmokeFetch;
	/** Injectable spawn for unit tests. */
	readonly spawnFn?: DocParseSpawn;
}

/**
 * Managed HTTP child for `sa-docparse`. Polls `/health` after spawn; BYO when binary absent.
 */
export class DocParseSidecarHost {
	private process: ChildProcess | undefined;
	private disposed = false;
	private starting: Promise<ChildProcess | undefined> | undefined;
	private readonly binaryPath: string | undefined;
	private readonly inferScriptPath: string | undefined;
	private modelDir: string | undefined;
	private readonly baseUrl: string;
	private readonly log: (message: string) => void;
	private readonly smokeFetch?: SmokeFetch;
	private readonly spawnFn: DocParseSpawn;

	constructor(options: DocParseSidecarHostOptions) {
		this.binaryPath = resolveDocParseBinaryPath(options.extensionPath);
		this.inferScriptPath = resolveDocParseInferScriptPath(options.extensionPath);
		this.modelDir = options.modelDir;
		this.baseUrl = (options.baseUrl?.trim() || 'http://127.0.0.1:8742').replace(/\/+$/, '');
		this.log = options.log;
		this.smokeFetch = options.smokeFetch;
		this.spawnFn = options.spawnFn ?? spawn;
	}

	get childProcess(): ChildProcess | undefined {
		return this.process;
	}

	get isBinaryAvailable(): boolean {
		return Boolean(this.binaryPath);
	}

	get isRunning(): boolean {
		return Boolean(this.process && !this.process.killed);
	}

	get baseUrlValue(): string {
		return this.baseUrl;
	}

	/** Refresh model directory after consent install completes. */
	setModelDir(modelDir: string | undefined): void {
		this.modelDir = modelDir;
	}

	async ensureStarted(): Promise<ChildProcess | undefined> {
		if (this.disposed) {
			throw new Error('DocParseSidecarHost is disposed');
		}
		if (this.isRunning) {
			return this.process;
		}
		if (!this.binaryPath) {
			return undefined;
		}
		if (this.starting) {
			return this.starting;
		}
		this.starting = this.startInternal();
		try {
			return await this.starting;
		} finally {
			this.starting = undefined;
		}
	}

	async start(): Promise<void> {
		await this.ensureStarted();
		if (this.binaryPath && !this.isRunning) {
			throw new Error('DocParse sidecar failed to start');
		}
	}

	async stop(): Promise<void> {
		const child = this.process;
		this.process = undefined;
		if (child) {
			await terminateChildProcess(child);
		}
	}

	dispose(): void {
		this.disposed = true;
		void this.stop();
	}

	private async startInternal(): Promise<ChildProcess | undefined> {
		if (!this.binaryPath) {
			return undefined;
		}

		this.assertModelDirReady();

		const { host, port } = parseSidecarListenTarget(this.baseUrl);

		this.log(`Starting sa-docparse: ${this.binaryPath} (modelDir=${this.modelDir})`);
		const spawnEnv: NodeJS.ProcessEnv = {
			...process.env,
			SA_DOCPARSE_MODEL_DIR: this.modelDir!,
			SA_DOCPARSE_HOST: host,
			SA_DOCPARSE_PORT: String(port),
		};
		if (this.inferScriptPath) {
			spawnEnv.SA_DOCPARSE_INFER_SCRIPT = this.inferScriptPath;
		}
		const child = this.spawnFn(this.binaryPath, [], {
			stdio: ['ignore', 'pipe', 'pipe'],
			env: spawnEnv,
		});
		this.process = child;

		child.stdout?.setEncoding('utf8');
		child.stdout?.on('data', chunk => {
			const text = String(chunk).trim();
			if (text) {
				this.log(`[sa-docparse stdout] ${text}`);
			}
		});
		child.stderr?.setEncoding('utf8');
		child.stderr?.on('data', chunk => {
			const text = String(chunk).trim();
			if (text) {
				this.log(`[sa-docparse stderr] ${text}`);
			}
		});

		child.on('error', err => {
			this.log(`sa-docparse process error: ${err.message}`);
		});

		child.on('exit', (code, signal) => {
			this.log(`sa-docparse exited (code=${code}, signal=${signal})`);
			if (this.process === child) {
				this.process = undefined;
			}
		});

		try {
			await this.waitForHealth();
		} catch (err) {
			await this.stop();
			throw err;
		}

		return child;
	}

	private assertModelDirReady(): void {
		if (!this.modelDir) {
			throw new Error(
				'Unlimited-OCR model directory is not configured; install and verify artifacts first.',
			);
		}
		if (!isNonEmptyDirectory(this.modelDir)) {
			throw new Error(
				`Unlimited-OCR model directory is missing or empty: ${this.modelDir}`,
			);
		}
	}

	private async waitForHealth(): Promise<void> {
		const deadline = Date.now() + HEALTH_TIMEOUT_MS;
		let lastError = 'unknown';

		while (Date.now() < deadline) {
			if (!this.process || this.process.killed) {
				throw new Error('DocParse sidecar exited before health check succeeded');
			}
			try {
				await smokeDocParseHealth({
					baseUrl: this.baseUrl,
					fetchImpl: this.smokeFetch,
				});
				this.log(`sa-docparse health ok @ ${this.baseUrl}`);
				return;
			} catch (err) {
				lastError = err instanceof Error ? err.message : String(err);
				await sleep(HEALTH_POLL_INTERVAL_MS);
			}
		}

		throw new Error(
			`DocParse sidecar health check timed out after ${HEALTH_TIMEOUT_MS}ms: ${lastError}`,
		);
	}
}

function isRegularFile(candidate: string): boolean {
	try {
		return fs.statSync(candidate).isFile();
	} catch {
		return false;
	}
}

function isNonEmptyDirectory(dir: string): boolean {
	try {
		const entries = fs.readdirSync(dir);
		return entries.length > 0;
	} catch {
		return false;
	}
}

function parseSidecarListenTarget(baseUrl: string): { host: string; port: number } {
	const parsed = new URL(baseUrl);
	const port = parsed.port
		? Number(parsed.port)
		: parsed.protocol === 'https:'
			? 443
			: 80;
	if (!Number.isFinite(port) || port <= 0) {
		throw new Error(`DocParse baseUrl has invalid port: ${baseUrl}`);
	}
	return { host: parsed.hostname, port };
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

const CHILD_TERMINATE_GRACE_MS = 2_000;

/** SIGTERM then wait for exit; SIGKILL after grace. Destroys stdio pipes. */
export async function terminateChildProcess(
	child: ChildProcess,
	options: { readonly graceMs?: number } = {},
): Promise<void> {
	const graceMs = options.graceMs ?? CHILD_TERMINATE_GRACE_MS;
	if (child.exitCode != null || child.signalCode != null) {
		destroyChildStreams(child);
		return;
	}

	await new Promise<void>(resolve => {
		let settled = false;
		const settle = (): void => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(sigKillTimer);
			clearTimeout(hardCapTimer);
			child.removeListener('exit', settle);
			destroyChildStreams(child);
			resolve();
		};

		child.once('exit', settle);

		const sigKillTimer = setTimeout(() => {
			try {
				child.kill('SIGKILL');
			} catch {
				// best-effort
			}
		}, graceMs);

		// Never hang callers if exit never fires (e.g. uncooperative mock child).
		const hardCapTimer = setTimeout(settle, graceMs + 500);

		try {
			child.kill('SIGTERM');
		} catch {
			// Wait for exit or timers — do not settle synchronously.
		}
	});
}

function destroyChildStreams(child: ChildProcess): void {
	child.stdout?.destroy();
	child.stderr?.destroy();
	child.stdin?.destroy();
}

/**
 * Resolve the sa-docparse binary path:
 * 1. SAFEAPPEALS_DOCPARSE_PATH env
 * 2. extensionPath/bin/sa-docparse[.exe]
 * 3. repo rust/target/release/sa-docparse (dev)
 */
export function resolveDocParseBinaryPath(extensionPath: string): string | undefined {
	const envPath = process.env.SAFEAPPEALS_DOCPARSE_PATH?.trim();
	if (envPath && isRegularFile(envPath)) {
		return envPath;
	}

	const exeName = process.platform === 'win32' ? 'sa-docparse.exe' : 'sa-docparse';
	const bundled = path.join(extensionPath, 'bin', exeName);
	if (isRegularFile(bundled)) {
		return bundled;
	}

	const devPath = path.join(extensionPath, '..', '..', 'rust', 'target', 'release', exeName);
	if (isRegularFile(devPath)) {
		return path.resolve(devPath);
	}

	return undefined;
}

/**
 * Resolve infer_unlimited_ocr.py for the sidecar spawn env:
 * 1. SA_DOCPARSE_INFER_SCRIPT env (when file exists)
 * 2. extensionPath/bin/python/infer_unlimited_ocr.py
 * 3. repo rust/docparse/python/infer_unlimited_ocr.py (dev)
 */
export function resolveDocParseInferScriptPath(extensionPath: string): string | undefined {
	const envPath = process.env.SA_DOCPARSE_INFER_SCRIPT?.trim();
	if (envPath && isRegularFile(envPath)) {
		return path.resolve(envPath);
	}

	const bundled = path.join(extensionPath, 'bin', 'python', 'infer_unlimited_ocr.py');
	if (isRegularFile(bundled)) {
		return path.resolve(bundled);
	}

	const devPath = path.join(
		extensionPath,
		'..',
		'..',
		'rust',
		'docparse',
		'python',
		'infer_unlimited_ocr.py',
	);
	if (isRegularFile(devPath)) {
		return path.resolve(devPath);
	}

	return undefined;
}

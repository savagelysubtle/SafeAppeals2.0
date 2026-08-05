/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type {
	SidecarErrorResponse,
	SidecarProgressNotification,
	SidecarRequest,
	SidecarResponse,
} from './types';
import { isSidecarErrorResponse, isSidecarProgressNotification, isSidecarResponse } from './protocol';

const KEEPALIVE_INTERVAL_MS = 30_000;
const RESTART_DELAY_MS = 1_000;
const MAX_RESTART_ATTEMPTS = 5;
const REQUEST_TIMEOUT_MS = 120_000;

export interface SidecarHostOptions {
	extensionPath: string;
	log: (message: string) => void;
}

export interface SidecarProgressEvent {
	jobId: string;
	progress: number;
	message: string;
}

/**
 * Spawns and manages the `sa-converter` NDJSON sidecar process.
 */
export class SidecarHost extends EventEmitter {
	private process: ChildProcessWithoutNullStreams | undefined;
	private stdoutBuffer = '';
	private readonly pending = new Map<string, {
		resolve: (value: Record<string, unknown>) => void;
		reject: (error: Error) => void;
		timer: NodeJS.Timeout;
	}>();
	private keepaliveTimer: NodeJS.Timeout | undefined;
	private disposed = false;
	private restartAttempts = 0;
	private binaryPath: string | undefined;
	private starting: Promise<void> | undefined;

	constructor(private readonly options: SidecarHostOptions) {
		super();
		this.binaryPath = resolveConverterBinaryPath(options.extensionPath);
	}

	get isBinaryAvailable(): boolean {
		return Boolean(this.binaryPath);
	}

	get binaryResolvedPath(): string | undefined {
		return this.binaryPath;
	}

	async start(): Promise<void> {
		if (this.disposed) {
			throw new Error('SidecarHost is disposed');
		}
		if (!this.binaryPath) {
			throw new Error(
				'sa-converter binary not found. Set SAFEAPPEALS_CONVERTER_PATH or build rust/converter.',
			);
		}
		if (this.starting) {
			return this.starting;
		}
		this.starting = this.spawnProcess();
		try {
			await this.starting;
		} finally {
			this.starting = undefined;
		}
	}

	async request(method: string, params: Record<string, unknown> = {}): Promise<Record<string, unknown>> {
		await this.start();
		if (!this.process?.stdin.writable) {
			throw new Error('Sidecar process is not running');
		}

		const id = randomUUID();
		const payload: SidecarRequest = { id, method, params };
		const line = `${JSON.stringify(payload)}\n`;

		return new Promise<Record<string, unknown>>((resolve, reject) => {
			const timer = setTimeout(() => {
				this.pending.delete(id);
				reject(new Error(`Sidecar request timed out: ${method}`));
			}, REQUEST_TIMEOUT_MS);

			this.pending.set(id, { resolve, reject, timer });

			this.process!.stdin.write(line, err => {
				if (err) {
					clearTimeout(timer);
					this.pending.delete(id);
					reject(err);
				}
			});
		});
	}

	async ping(): Promise<Record<string, unknown>> {
		return this.request('ping');
	}

	async shutdown(): Promise<void> {
		if (this.process?.stdin.writable) {
			try {
				await this.request('shutdown');
			} catch {
				// Process may already be exiting.
			}
		}
	}

	dispose(): void {
		this.disposed = true;
		this.clearKeepalive();
		this.rejectAllPending(new Error('SidecarHost disposed'));
		if (this.process) {
			this.process.kill();
			this.process = undefined;
		}
	}

	private async spawnProcess(): Promise<void> {
		if (this.process) {
			return;
		}
		if (!this.binaryPath) {
			throw new Error('sa-converter binary not found');
		}

		this.options.log(`Starting sa-converter: ${this.binaryPath}`);
		const child = spawn(this.binaryPath, [], {
			stdio: ['pipe', 'pipe', 'pipe'],
			env: { ...process.env },
		});
		this.process = child;

		child.stdout.setEncoding('utf8');
		child.stdout.on('data', chunk => this.onStdoutData(String(chunk)));
		child.stderr.setEncoding('utf8');
		child.stderr.on('data', chunk => {
			const text = String(chunk).trim();
			if (text) {
				this.options.log(`[sa-converter stderr] ${text}`);
			}
		});

		child.on('error', err => {
			this.options.log(`Sidecar process error: ${err.message}`);
			this.emit('crash', err);
		});

		child.on('exit', (code, signal) => {
			this.options.log(`Sidecar exited (code=${code}, signal=${signal})`);
			this.process = undefined;
			this.clearKeepalive();
			this.rejectAllPending(new Error('Sidecar process exited'));
			this.emit('exit', code, signal);
			if (!this.disposed) {
				void this.scheduleRestart();
			}
		});

		this.restartAttempts = 0;
		this.startKeepalive();

		try {
			await this.ping();
			this.emit('ready');
		} catch (err) {
			this.options.log(`Sidecar ping failed: ${err instanceof Error ? err.message : String(err)}`);
			throw err;
		}
	}

	private onStdoutData(chunk: string): void {
		this.stdoutBuffer += chunk;
		let newlineIndex = this.stdoutBuffer.indexOf('\n');
		while (newlineIndex >= 0) {
			const line = this.stdoutBuffer.slice(0, newlineIndex).trim();
			this.stdoutBuffer = this.stdoutBuffer.slice(newlineIndex + 1);
			if (line) {
				this.handleLine(line);
			}
			newlineIndex = this.stdoutBuffer.indexOf('\n');
		}
	}

	private handleLine(line: string): void {
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			this.options.log(`Ignoring non-JSON sidecar stdout: ${line.slice(0, 200)}`);
			return;
		}

		if (isSidecarProgressNotification(parsed)) {
			this.emitProgress(parsed);
			return;
		}

		if (isSidecarResponse(parsed)) {
			this.resolvePending(parsed);
			return;
		}

		if (isSidecarErrorResponse(parsed)) {
			this.rejectPending(parsed);
		}
	}

	private emitProgress(notification: SidecarProgressNotification): void {
		const event: SidecarProgressEvent = {
			jobId: notification.params.job_id,
			progress: notification.params.progress,
			message: notification.params.message,
		};
		this.emit('progress', event);
	}

	private resolvePending(response: SidecarResponse): void {
		const entry = this.pending.get(response.id);
		if (!entry) {
			return;
		}
		clearTimeout(entry.timer);
		this.pending.delete(response.id);
		entry.resolve(response.result);
	}

	private rejectPending(response: SidecarErrorResponse): void {
		const entry = this.pending.get(response.id);
		if (!entry) {
			return;
		}
		clearTimeout(entry.timer);
		this.pending.delete(response.id);
		entry.reject(new Error(`${response.error.code}: ${response.error.message}`));
	}

	private rejectAllPending(error: Error): void {
		for (const [id, entry] of this.pending) {
			clearTimeout(entry.timer);
			entry.reject(error);
			this.pending.delete(id);
		}
	}

	private startKeepalive(): void {
		this.clearKeepalive();
		this.keepaliveTimer = setInterval(() => {
			if (this.disposed || !this.process) {
				return;
			}
			void this.ping().catch(err => {
				this.options.log(`Keepalive ping failed: ${err instanceof Error ? err.message : String(err)}`);
			});
		}, KEEPALIVE_INTERVAL_MS);
	}

	private clearKeepalive(): void {
		if (this.keepaliveTimer) {
			clearInterval(this.keepaliveTimer);
			this.keepaliveTimer = undefined;
		}
	}

	private async scheduleRestart(): Promise<void> {
		if (this.disposed || this.restartAttempts >= MAX_RESTART_ATTEMPTS) {
			this.options.log('Sidecar restart budget exhausted');
			this.emit('failed');
			return;
		}
		this.restartAttempts += 1;
		const delay = RESTART_DELAY_MS * this.restartAttempts;
		this.options.log(`Restarting sidecar in ${delay}ms (attempt ${this.restartAttempts})`);
		await new Promise(resolve => setTimeout(resolve, delay));
		if (this.disposed) {
			return;
		}
		try {
			await this.spawnProcess();
			this.emit('restarted');
		} catch (err) {
			this.options.log(`Sidecar restart failed: ${err instanceof Error ? err.message : String(err)}`);
			void this.scheduleRestart();
		}
	}
}

/**
 * Resolve the sa-converter binary path:
 * 1. SAFEAPPEALS_CONVERTER_PATH env
 * 2. extensionPath/bin/sa-converter[.exe]
 * 3. repo rust/target/release/sa-converter (dev)
 */
function isRegularFile(candidate: string): boolean {
	try {
		return fs.statSync(candidate).isFile();
	} catch {
		return false;
	}
}

export function resolveConverterBinaryPath(extensionPath: string): string | undefined {
	const envPath = process.env.SAFEAPPEALS_CONVERTER_PATH?.trim();
	if (envPath && isRegularFile(envPath)) {
		return envPath;
	}

	const exeName = process.platform === 'win32' ? 'sa-converter.exe' : 'sa-converter';
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

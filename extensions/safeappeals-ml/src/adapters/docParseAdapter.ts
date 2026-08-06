/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { ChildProcess } from 'node:child_process';
import { terminateChildProcess } from '../docParseSidecarHost';
import {
	assertLoopbackSmokeUrl,
	DEFAULT_DOCPARSE_SMOKE_URL,
	DOCPARSE_SMOKE_URL_ENV,
	resolveDocParseSmokeBaseUrl,
	smokeDocParseHealth,
	type SmokeFetch,
} from '../docParseSmoke';
import { MlBackendUnavailableError, MlCancelledError } from '../errors';
import type { ResourceAdapter } from '../engineTypes';

/**
 * Heavy-slot adapter for the Unlimited-OCR / DocParse localhost sidecar.
 *
 * v1: verify BYO localhost `/health` on load. Inference never runs in the EH.
 * When SafeAppeals owns the child process (`ownedProcess`), unload kills it.
 * Otherwise unload only clears the loaded flag (BYO sidecar stays up).
 */
export class DocParseAdapter implements ResourceAdapter {
	readonly kind = 'docparse' as const;
	readonly estimateMb: number;
	private loaded = false;
	private ownedProcess: ChildProcess | undefined;
	private readonly baseUrl: string;
	private readonly fetchImpl?: SmokeFetch;
	private readonly log?: (message: string) => void;
	/** Optional spawn hook — when provided, load may start a sidecar we own. */
	private readonly spawnOwned?: () => Promise<ChildProcess | undefined>;

	constructor(options: {
		readonly baseUrl?: string;
		readonly estimateMb?: number;
		readonly fetchImpl?: SmokeFetch;
		readonly log?: (message: string) => void;
		/**
		 * Optional: spawn a localhost sidecar we own. Return undefined to stay BYO-only.
		 * Kill-on-unload applies only when a process is returned / assigned.
		 */
		readonly spawnOwned?: () => Promise<ChildProcess | undefined>;
		readonly env?: NodeJS.ProcessEnv;
	} = {}) {
		this.estimateMb = options.estimateMb ?? 1600;
		this.fetchImpl = options.fetchImpl;
		this.log = options.log;
		this.spawnOwned = options.spawnOwned;
		const raw =
			options.baseUrl?.trim() ||
			resolveDocParseSmokeBaseUrl(options.env ?? process.env, DEFAULT_DOCPARSE_SMOKE_URL);
		this.baseUrl = assertLoopbackSmokeUrl(raw);
	}

	get baseUrlValue(): string {
		return this.baseUrl;
	}

	/** True when unload will kill a child we spawned. */
	get ownsProcess(): boolean {
		return this.ownedProcess !== undefined && !this.ownedProcess.killed;
	}

	async load(signal: AbortSignal): Promise<void> {
		if (signal.aborted) {
			throw new MlCancelledError('DocParse load aborted.');
		}

		if (this.spawnOwned && !this.ownsProcess) {
			try {
				const child = await this.spawnOwned();
				if (child) {
					this.ownedProcess = child;
					this.log?.(
						`DocParseAdapter spawned owned sidecar pid=${child.pid ?? 'unknown'}`,
					);
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				this.log?.(`DocParseAdapter spawn failed (falling back to BYO health): ${message}`);
			}
		}

		if (signal.aborted) {
			await this.killOwnedProcess();
			throw new MlCancelledError('DocParse load aborted.');
		}

		try {
			await smokeDocParseHealth({
				baseUrl: this.baseUrl,
				fetchImpl: this.fetchImpl,
			});
		} catch (err) {
			await this.killOwnedProcess();
			const detail = err instanceof Error ? err.message : String(err);
			throw new MlBackendUnavailableError(
				`DocParse sidecar is not healthy at ${this.baseUrl}: ${detail}. ` +
				`Start a localhost Unlimited-OCR runner or set ${DOCPARSE_SMOKE_URL_ENV}.`,
			);
		}

		if (signal.aborted) {
			await this.killOwnedProcess();
			throw new MlCancelledError('DocParse load aborted.');
		}

		this.loaded = true;
		this.log?.(`DocParseAdapter ready (BYO health ok @ ${this.baseUrl})`);
	}

	async unload(): Promise<void> {
		await this.killOwnedProcess();
		this.loaded = false;
	}

	cancel(reason: string): void {
		this.log?.(`DocParseAdapter cancel: ${reason}`);
		// BYO HTTP jobs are not cancellable from EH; owned child is killed on unload/crash path.
		if (this.ownedProcess && !this.ownedProcess.killed) {
			try {
				this.ownedProcess.kill('SIGTERM');
			} catch {
				// best-effort
			}
		}
	}

	isLoaded(): boolean {
		return this.loaded;
	}

	private async killOwnedProcess(): Promise<void> {
		const child = this.ownedProcess;
		this.ownedProcess = undefined;
		if (!child || child.killed) {
			return;
		}
		this.log?.(`DocParseAdapter killing owned sidecar pid=${child.pid ?? 'unknown'}`);
		await terminateChildProcess(child);
	}
}

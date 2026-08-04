/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';
import * as vscode from 'vscode';
import {
	MlAcquireTimeoutError,
	MlBackendCrashedError,
	MlBackendUnavailableError,
	MlBudgetExceededError,
	MlBusyError,
	MlCancelledError,
	MlError,
} from './errors';
import {
	DEFAULT_ML_ENGINE_OPTIONS,
	DEFAULT_ML_ESTIMATES_MB,
	isHeavyKind,
	type AcquireOptions,
	type MlEngineOptions,
	type MlEngineSnapshot,
	type MlLease,
	type ResourceAdapter,
	type ResourceKind,
	type SlotSnapshot,
	type SlotState,
} from './types';

interface QueuedAcquire {
	readonly id: string;
	readonly kind: ResourceKind;
	readonly options: AcquireOptions;
	readonly enqueuedAt: number;
	readonly resolve: (lease: MlLease) => void;
	readonly reject: (error: Error) => void;
	timeoutHandle?: ReturnType<typeof setTimeout>;
	abortHandler?: () => void;
	/** True once resolve/reject has been called (incl. cancel during in-flight prepare). */
	settled?: boolean;
}

interface LeaseAlsContext {
	readonly kind: ResourceKind;
	readonly jobId: string;
}

interface SlotRuntime {
	state: SlotState;
	refCount: number;
	lastUsedAt?: number;
	adapter?: ResourceAdapter;
}

/**
 * Process-local coordinator for exclusive heavy ML slots (whisper / diarization / embedding)
 * plus a separate ffmpeg utility lane. Serializes load/unload, queues FIFO waiters, cancels,
 * idle-evicts, and enforces an estimated peak RSS budget.
 */
export class MlResourceEngine implements vscode.Disposable {
	private readonly options: MlEngineOptions;
	private readonly slots: Record<ResourceKind, SlotRuntime>;
	private readonly onDidChangeEmitter = new vscode.EventEmitter<MlEngineSnapshot>();
	private readonly heavyQueue: QueuedAcquire[] = [];
	private readonly ffmpegQueue: QueuedAcquire[] = [];

	private heavyKindLoaded: ResourceKind | undefined;
	private heavyActiveJobId: string | undefined;
	private ffmpegActiveJobId: string | undefined;
	/** Waiter currently inside prepare/ensureLoaded — never splice this head on cancel. */
	private heavyPreparing: QueuedAcquire | undefined;
	private ffmpegPreparing: QueuedAcquire | undefined;
	private idleTimer: ReturnType<typeof setTimeout> | undefined;
	private transitionChain: Promise<void> = Promise.resolve();
	private disposed = false;
	/**
	 * Nested same-jobId re-entrancy (same call stack via {@link withLease}) only.
	 * Parallel acquires that reuse a jobId are serialized like distinct jobs — they must
	 * not both hold heavy leases / run Whisper concurrently.
	 */
	private readonly leaseAls = new AsyncLocalStorage<LeaseAlsContext>();

	readonly onDidChange = this.onDidChangeEmitter.event;

	constructor(options: Partial<MlEngineOptions> = {}, adapters: readonly ResourceAdapter[] = []) {
		this.options = {
			peakRssBudgetMb: options.peakRssBudgetMb ?? DEFAULT_ML_ENGINE_OPTIONS.peakRssBudgetMb,
			idleUnloadMs: options.idleUnloadMs ?? DEFAULT_ML_ENGINE_OPTIONS.idleUnloadMs,
			acquireTimeoutMs: options.acquireTimeoutMs ?? DEFAULT_ML_ENGINE_OPTIONS.acquireTimeoutMs,
			estimatesMb: {
				...DEFAULT_ML_ESTIMATES_MB,
				...options.estimatesMb,
			},
		};
		this.slots = {
			whisper: { state: 'cold', refCount: 0 },
			diarization: { state: 'cold', refCount: 0 },
			embedding: { state: 'cold', refCount: 0 },
			ffmpeg: { state: 'cold', refCount: 0 },
		};
		for (const adapter of adapters) {
			this.registerAdapter(adapter);
		}
	}

	registerAdapter(adapter: ResourceAdapter): void {
		this.assertNotDisposed();
		const existing = this.slots[adapter.kind].adapter;
		if (existing?.isLoaded()) {
			throw new MlError(
				'adapter_replace_loaded',
				`Cannot replace loaded adapter for ${adapter.kind}. Request unload first.`,
			);
		}
		this.slots[adapter.kind].adapter = adapter;
		this.fireChange();
	}

	acquire(kind: ResourceKind, options: AcquireOptions): Promise<MlLease> {
		this.assertNotDisposed();
		if (!options.jobId) {
			return Promise.reject(new MlError('invalid_job', 'AcquireOptions.jobId is required.'));
		}
		if (options.signal?.aborted) {
			return Promise.reject(new MlCancelledError('Acquire aborted before start.'));
		}

		if (options.rejectIfBusy && this.isLaneBusyFor(kind, options.jobId)) {
			const busyKind = isHeavyKind(kind) ? (this.heavyActiveKind() ?? kind) : 'ffmpeg';
			const busyJob = isHeavyKind(kind) ? this.heavyActiveJobId : this.ffmpegActiveJobId;
			return Promise.reject(
				new MlBusyError(`ML lane is busy with ${busyKind} (job ${busyJob ?? 'unknown'}).`),
			);
		}

		return new Promise<MlLease>((resolve, reject) => {
			const queued: QueuedAcquire = {
				id: randomUUID(),
				kind,
				options,
				enqueuedAt: Date.now(),
				resolve,
				reject,
			};

			if (options.signal) {
				queued.abortHandler = () => {
					this.removeQueued(queued, new MlCancelledError('Acquire aborted while waiting.'));
				};
				options.signal.addEventListener('abort', queued.abortHandler, { once: true });
			}

			queued.timeoutHandle = setTimeout(() => {
				this.removeQueued(
					queued,
					new MlAcquireTimeoutError(
						`Timed out after ${this.options.acquireTimeoutMs}ms waiting for ${kind}.`,
					),
				);
			}, this.options.acquireTimeoutMs);

			const queue = isHeavyKind(kind) ? this.heavyQueue : this.ffmpegQueue;
			queue.push(queued);
			this.fireChange();
			void this.pump();
		});
	}

	async withLease<T>(
		kind: ResourceKind,
		options: AcquireOptions,
		fn: (lease: MlLease) => Promise<T>,
	): Promise<T> {
		const lease = await this.acquire(kind, options);
		try {
			// ALS marks the active stack so nested same-jobId acquires can re-enter;
			// parallel callers that reuse jobId will not see this context.
			return await this.leaseAls.run({ kind, jobId: options.jobId }, () => fn(lease));
		} finally {
			await lease.release();
		}
	}

	async requestUnload(kind: ResourceKind): Promise<void> {
		await this.runExclusive(async () => {
			this.assertNotDisposed();
			const slot = this.slots[kind];
			if (slot.refCount > 0) {
				throw new MlBusyError(`Cannot unload ${kind} while leases are held.`);
			}
			await this.unloadSlot(kind);
			if (isHeavyKind(kind) && this.heavyKindLoaded === kind) {
				this.heavyKindLoaded = undefined;
			}
			this.clearIdleTimer();
			this.fireChange();
		});
		void this.pump();
	}

	cancelJob(jobId: string, reason = 'Job cancelled.'): void {
		if (this.disposed) {
			return;
		}

		for (const queued of [...this.heavyQueue, ...this.ffmpegQueue]) {
			if (queued.options.jobId === jobId) {
				this.removeQueued(queued, new MlCancelledError(reason));
			}
		}

		const heavySlot = this.heavyKindLoaded ? this.slots[this.heavyKindLoaded] : undefined;
		if (this.heavyActiveJobId === jobId && heavySlot?.adapter) {
			heavySlot.adapter.cancel?.(reason);
		}
		if (this.ffmpegActiveJobId === jobId) {
			this.slots.ffmpeg.adapter?.cancel?.(reason);
		}
		this.fireChange();
	}

	/**
	 * Minimal crash hook: mark the slot crashed, cancel active work, and drain waiters
	 * with {@link MlBackendCrashedError}. The active lease holder must still release();
	 * the next acquire resets `crashed` → cold and reloads.
	 */
	reportCrash(kind: ResourceKind, message?: string): void {
		if (this.disposed) {
			return;
		}
		const error = new MlBackendCrashedError(message ?? `${kind} backend crashed.`);
		void this.runExclusive(async () => {
			if (this.disposed) {
				return;
			}
			const slot = this.slots[kind];
			slot.state = 'crashed';
			slot.adapter?.cancel?.(message ?? 'crashed');

			const queue = isHeavyKind(kind) ? this.heavyQueue : this.ffmpegQueue;
			for (const queued of [...queue]) {
				this.removeQueued(queued, error);
			}
			this.fireChange();
		}).then(() => {
			void this.pump();
		});
	}

	getSnapshot(): MlEngineSnapshot {
		const slots = {} as Record<ResourceKind, SlotSnapshot>;
		for (const kind of Object.keys(this.slots) as ResourceKind[]) {
			const slot = this.slots[kind];
			slots[kind] = {
				state: slot.state,
				refCount: slot.refCount,
				lastUsedAt: slot.lastUsedAt,
			};
		}
		return {
			heavyKindLoaded: this.heavyKindLoaded,
			activeJobId: this.heavyActiveJobId ?? this.ffmpegActiveJobId,
			queueLength: this.heavyQueue.length + this.ffmpegQueue.length,
			estimatedRssMb: this.estimateRssMb(),
			budgetMb: this.options.peakRssBudgetMb,
			slots,
		};
	}

	async dispose(): Promise<void> {
		if (this.disposed) {
			return;
		}
		this.disposed = true;
		this.clearIdleTimer();

		const drainError = new MlCancelledError('ML resource engine disposed.');
		for (const queued of [...this.heavyQueue, ...this.ffmpegQueue]) {
			this.finalizeQueued(queued, drainError);
		}
		this.heavyQueue.length = 0;
		this.ffmpegQueue.length = 0;

		await this.runExclusive(async () => {
			for (const kind of Object.keys(this.slots) as ResourceKind[]) {
				this.slots[kind].refCount = 0;
				try {
					await this.unloadSlot(kind);
				} catch {
					// Best-effort unload on dispose.
				}
			}
			this.heavyKindLoaded = undefined;
			this.heavyActiveJobId = undefined;
			this.ffmpegActiveJobId = undefined;
		});

		this.onDidChangeEmitter.dispose();
	}

	private pump(): Promise<void> {
		return this.runExclusive(async () => {
			if (this.disposed) {
				return;
			}
			await this.pumpHeavy();
			await this.pumpFfmpeg();
		});
	}

	private async pumpHeavy(): Promise<void> {
		while (this.heavyQueue.length > 0) {
			const next = this.heavyQueue[0]!;
			if (next.settled || next.options.signal?.aborted) {
				this.heavyQueue.shift();
				if (!next.settled) {
					this.finalizeQueued(next, new MlCancelledError('Acquire aborted while waiting.'));
				} else {
					this.clearQueuedSideEffects(next);
				}
				continue;
			}

			const activeKind = this.heavyActiveKind();
			const activeJob = this.heavyActiveJobId;
			const activeRefs = activeKind ? this.slots[activeKind].refCount : 0;

			// Nested same-jobId re-entrancy only (ALS from withLease). Parallel same jobId waits.
			if (
				activeKind === next.kind &&
				activeJob === next.options.jobId &&
				activeRefs > 0 &&
				this.isNestedReentrant(next.kind, next.options.jobId)
			) {
				this.heavyQueue.shift();
				this.grantLease(next);
				continue;
			}

			if (activeRefs > 0) {
				if (next.options.rejectIfBusy) {
					this.heavyQueue.shift();
					this.finalizeQueued(
						next,
						new MlBusyError(`Heavy ML lane is busy with ${activeKind} (job ${activeJob}).`),
					);
					continue;
				}
				// Lane busy with another job/kind (or parallel same jobId) — wait for release.
				return;
			}

			// Lane free (refCount 0). May still have a cold/ready/crashed loaded kind.
			this.heavyPreparing = next;
			try {
				await this.prepareHeavyKind(next.kind, next.options.signal);
			} catch (error) {
				this.heavyPreparing = undefined;
				this.dropQueueHeadIf(this.heavyQueue, next);
				if (!next.settled) {
					this.finalizeQueued(next, toError(error));
				} else {
					this.clearQueuedSideEffects(next);
				}
				continue;
			}
			this.heavyPreparing = undefined;

			// Cancel/timeout may have settled the waiter during prepare without splicing.
			// Model is resident with no lease — start idle eviction so it does not stick forever.
			if (this.heavyQueue[0] !== next || next.settled || next.options.signal?.aborted) {
				this.dropQueueHeadIf(this.heavyQueue, next);
				if (!next.settled) {
					this.finalizeQueued(next, new MlCancelledError('Acquire aborted during load.'));
				} else {
					this.clearQueuedSideEffects(next);
				}
				this.scheduleIdleEviction();
				continue;
			}

			this.heavyQueue.shift();
			this.grantLease(next);
		}
	}

	private async pumpFfmpeg(): Promise<void> {
		while (this.ffmpegQueue.length > 0) {
			const next = this.ffmpegQueue[0]!;
			if (next.settled || next.options.signal?.aborted) {
				this.ffmpegQueue.shift();
				if (!next.settled) {
					this.finalizeQueued(next, new MlCancelledError('Acquire aborted while waiting.'));
				} else {
					this.clearQueuedSideEffects(next);
				}
				continue;
			}

			const slot = this.slots.ffmpeg;
			if (slot.refCount > 0) {
				if (
					this.ffmpegActiveJobId === next.options.jobId &&
					this.isNestedReentrant('ffmpeg', next.options.jobId)
				) {
					this.ffmpegQueue.shift();
					this.grantLease(next);
					continue;
				}
				if (next.options.rejectIfBusy) {
					this.ffmpegQueue.shift();
					this.finalizeQueued(next, new MlBusyError('ffmpeg utility lane is busy.'));
					continue;
				}
				return;
			}

			this.ffmpegPreparing = next;
			try {
				await this.ensureLoaded('ffmpeg', next.options.signal);
			} catch (error) {
				this.ffmpegPreparing = undefined;
				this.dropQueueHeadIf(this.ffmpegQueue, next);
				if (!next.settled) {
					this.finalizeQueued(next, toError(error));
				} else {
					this.clearQueuedSideEffects(next);
				}
				continue;
			}
			this.ffmpegPreparing = undefined;

			// Load finished but waiter cancelled — ffmpeg stub stays ready (no idle timer);
			// scheduleIdleEviction is a no-op unless a heavy model is also resident.
			if (this.ffmpegQueue[0] !== next || next.settled || next.options.signal?.aborted) {
				this.dropQueueHeadIf(this.ffmpegQueue, next);
				if (!next.settled) {
					this.finalizeQueued(next, new MlCancelledError('Acquire aborted during load.'));
				} else {
					this.clearQueuedSideEffects(next);
				}
				this.scheduleIdleEviction();
				continue;
			}

			this.ffmpegQueue.shift();
			this.grantLease(next);
		}
	}

	private grantLease(queued: QueuedAcquire): void {
		if (queued.settled) {
			return;
		}
		queued.settled = true;
		this.clearQueuedSideEffects(queued);

		const slot = this.slots[queued.kind];
		slot.refCount += 1;
		slot.state = 'running';
		slot.lastUsedAt = Date.now();

		if (isHeavyKind(queued.kind)) {
			this.heavyKindLoaded = queued.kind;
			this.heavyActiveJobId = queued.options.jobId;
			this.clearIdleTimer();
		} else {
			this.ffmpegActiveJobId = queued.options.jobId;
		}

		let released = false;
		const lease: MlLease = {
			id: randomUUID(),
			kind: queued.kind,
			jobId: queued.options.jobId,
			release: async () => {
				if (released) {
					return;
				}
				released = true;
				await this.releaseLease(queued.kind, queued.options.jobId);
			},
		};

		this.fireChange();
		queued.resolve(lease);
	}

	private async releaseLease(kind: ResourceKind, jobId: string): Promise<void> {
		await this.runExclusive(async () => {
			if (this.disposed) {
				return;
			}
			const slot = this.slots[kind];
			if (slot.refCount <= 0) {
				return;
			}
			slot.refCount -= 1;
			slot.lastUsedAt = Date.now();

			if (slot.refCount === 0) {
				slot.state = slot.adapter?.isLoaded() ? 'ready' : 'cold';
				if (isHeavyKind(kind)) {
					if (this.heavyActiveJobId === jobId) {
						this.heavyActiveJobId = undefined;
					}
					this.scheduleIdleEviction();
				} else if (this.ffmpegActiveJobId === jobId) {
					this.ffmpegActiveJobId = undefined;
				}
			}

			this.fireChange();
		});
		void this.pump();
	}

	private async prepareHeavyKind(kind: ResourceKind, signal?: AbortSignal): Promise<void> {
		const loaded = this.heavyKindLoaded;
		if (loaded && loaded !== kind) {
			await this.unloadSlot(loaded);
			this.heavyKindLoaded = undefined;
		}

		// Affinity: diarization/embedding must not share residency with whisper (already unloaded above).
		// Acquiring whisper also evicts other heavies via the same path.
		await this.ensureLoaded(kind, signal);
		this.heavyKindLoaded = kind;
	}

	private async ensureLoaded(kind: ResourceKind, signal?: AbortSignal): Promise<void> {
		const slot = this.slots[kind];
		const adapter = slot.adapter;
		if (!adapter) {
			throw new MlBackendUnavailableError(`No adapter registered for ${kind}.`);
		}
		if (slot.state === 'crashed') {
			slot.state = 'cold';
		}
		if (adapter.isLoaded() && (slot.state === 'ready' || slot.state === 'running')) {
			return;
		}

		this.assertBudgetAllows(kind);
		slot.state = 'loading';
		this.fireChange();

		try {
			const loadSignal = signal ?? new AbortController().signal;
			await adapter.load(loadSignal);
			if (loadSignal.aborted) {
				throw new MlCancelledError(`Load of ${kind} was aborted.`);
			}
			slot.state = 'ready';
			slot.lastUsedAt = Date.now();
			this.fireChange();
		} catch (error) {
			slot.state = error instanceof MlBackendCrashedError ? 'crashed' : 'cold';
			this.fireChange();
			throw error;
		}
	}

	private assertBudgetAllows(kind: ResourceKind): void {
		const adapter = this.slots[kind].adapter;
		const estimate = adapter?.estimateMb ?? this.options.estimatesMb[kind];
		// Exclusive heavy: after affinity unload, resident heavy estimate is 0.
		// Ffmpeg may still be resident; count only non-conflicting residents.
		let resident = 0;
		for (const other of Object.keys(this.slots) as ResourceKind[]) {
			if (other === kind) {
				continue;
			}
			const otherSlot = this.slots[other];
			if (!otherSlot.adapter?.isLoaded()) {
				continue;
			}
			if (isHeavyKind(kind) && isHeavyKind(other)) {
				// Should already be unloaded; ignore if still marked loaded mid-transition.
				continue;
			}
			resident += otherSlot.adapter.estimateMb;
		}
		if (resident + estimate > this.options.peakRssBudgetMb) {
			throw new MlBudgetExceededError(
				`Loading ${kind} (~${estimate} MB) would exceed peak RSS budget ` +
				`(${this.options.peakRssBudgetMb} MB; currently ~${resident} MB resident). ` +
				`Unload other AI features or restart the window.`,
			);
		}
	}

	private async unloadSlot(kind: ResourceKind): Promise<void> {
		const slot = this.slots[kind];
		const adapter = slot.adapter;
		if (!adapter || (!adapter.isLoaded() && slot.state === 'cold')) {
			slot.state = 'cold';
			return;
		}
		slot.state = 'unloading';
		this.fireChange();
		try {
			await adapter.unload();
			slot.state = 'cold';
		} catch (error) {
			slot.state = 'crashed';
			throw error instanceof Error ? error : new MlBackendCrashedError(String(error));
		} finally {
			this.fireChange();
		}
	}

	private scheduleIdleEviction(): void {
		this.clearIdleTimer();
		if (this.options.idleUnloadMs <= 0) {
			return;
		}
		const kindToEvict = this.heavyKindLoaded;
		if (!kindToEvict) {
			return;
		}
		this.idleTimer = setTimeout(() => {
			void this.runExclusive(async () => {
				if (this.disposed) {
					return;
				}
				const slot = this.slots[kindToEvict];
				if (slot.refCount > 0 || this.heavyQueue.length > 0) {
					// Fairness: never jump the queue; waiters will reuse or replace residency.
					return;
				}
				if (this.heavyKindLoaded !== kindToEvict) {
					return;
				}
				try {
					await this.unloadSlot(kindToEvict);
					if (this.heavyKindLoaded === kindToEvict) {
						this.heavyKindLoaded = undefined;
					}
				} catch {
					// Leave crashed state; next acquire decides.
				}
				this.fireChange();
			}).then(() => {
				void this.pump();
			});
		}, this.options.idleUnloadMs);
	}

	private clearIdleTimer(): void {
		if (this.idleTimer !== undefined) {
			clearTimeout(this.idleTimer);
			this.idleTimer = undefined;
		}
	}

	private heavyActiveKind(): ResourceKind | undefined {
		for (const kind of ['whisper', 'diarization', 'embedding'] as const) {
			if (this.slots[kind].refCount > 0) {
				return kind;
			}
		}
		return undefined;
	}

	/** True when the lane cannot grant immediately (nested same-job re-enter is not busy). */
	private isLaneBusyFor(kind: ResourceKind, jobId: string): boolean {
		if (isHeavyKind(kind)) {
			const active = this.heavyActiveKind();
			if (!active) {
				return this.heavyQueue.length > 0;
			}
			if (active === kind && this.heavyActiveJobId === jobId && this.isNestedReentrant(kind, jobId)) {
				return false;
			}
			return true;
		}
		if (this.slots.ffmpeg.refCount === 0) {
			return this.ffmpegQueue.length > 0;
		}
		if (this.ffmpegActiveJobId === jobId && this.isNestedReentrant('ffmpeg', jobId)) {
			return false;
		}
		return true;
	}

	private isNestedReentrant(kind: ResourceKind, jobId: string): boolean {
		const ctx = this.leaseAls.getStore();
		return ctx?.kind === kind && ctx?.jobId === jobId;
	}

	private estimateRssMb(): number {
		let total = 0;
		for (const kind of Object.keys(this.slots) as ResourceKind[]) {
			const slot = this.slots[kind];
			if (slot.adapter?.isLoaded()) {
				total += slot.adapter.estimateMb;
			}
		}
		return total;
	}

	private removeQueued(queued: QueuedAcquire, error: Error): void {
		if (queued.settled) {
			return;
		}
		// Never splice the in-flight prepare head — pump finalizes after await returns.
		if (this.heavyPreparing === queued || this.ffmpegPreparing === queued) {
			this.finalizeQueued(queued, error);
			this.fireChange();
			return;
		}
		const heavyIdx = this.heavyQueue.indexOf(queued);
		if (heavyIdx >= 0) {
			this.heavyQueue.splice(heavyIdx, 1);
		}
		const ffmpegIdx = this.ffmpegQueue.indexOf(queued);
		if (ffmpegIdx >= 0) {
			this.ffmpegQueue.splice(ffmpegIdx, 1);
		}
		this.finalizeQueued(queued, error);
		this.fireChange();
	}

	private finalizeQueued(queued: QueuedAcquire, error: Error): void {
		if (queued.settled) {
			this.clearQueuedSideEffects(queued);
			return;
		}
		queued.settled = true;
		this.clearQueuedSideEffects(queued);
		queued.reject(error);
	}

	private dropQueueHeadIf(queue: QueuedAcquire[], expected: QueuedAcquire): void {
		if (queue[0] === expected) {
			queue.shift();
		}
	}

	private clearQueuedSideEffects(queued: QueuedAcquire): void {
		if (queued.timeoutHandle !== undefined) {
			clearTimeout(queued.timeoutHandle);
			queued.timeoutHandle = undefined;
		}
		if (queued.abortHandler && queued.options.signal) {
			queued.options.signal.removeEventListener('abort', queued.abortHandler);
			queued.abortHandler = undefined;
		}
	}

	private fireChange(): void {
		if (!this.disposed) {
			this.onDidChangeEmitter.fire(this.getSnapshot());
		}
	}

	private runExclusive<T>(fn: () => Promise<T>): Promise<T> {
		const run = this.transitionChain.then(fn, fn);
		this.transitionChain = run.then(
			() => undefined,
			() => undefined,
		);
		return run;
	}

	private assertNotDisposed(): void {
		if (this.disposed) {
			throw new MlCancelledError('ML resource engine is disposed.');
		}
	}
}

function toError(error: unknown): Error {
	return error instanceof Error ? error : new Error(String(error));
}

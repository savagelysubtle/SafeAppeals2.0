/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'node:crypto';
import { MlBusyError } from '../ml/errors';
import type { AcquireOptions, MlLease, ResourceAdapter, ResourceKind } from '../ml/types';
import type { IMlResourceEngine } from '../mlEngineBridge';

/**
 * Minimal test double for {@link IMlResourceEngine}: exclusive heavy lane + rejectIfBusy.
 */
export class FakeMlResourceEngine implements IMlResourceEngine {
	private readonly adapters = new Map<ResourceKind, ResourceAdapter>();
	private heavyJobId: string | undefined;
	private heavyKind: ResourceKind | undefined;
	private heavyRefs = 0;

	constructor(adapters: readonly ResourceAdapter[] = []) {
		for (const adapter of adapters) {
			this.registerAdapter(adapter);
		}
	}

	registerAdapter(adapter: ResourceAdapter): void {
		this.adapters.set(adapter.kind, adapter);
	}

	reportCrash(_kind: ResourceKind, _message?: string): void {
		// no-op for unit tests
	}

	cancelJob(_jobId: string, _reason?: string): void {
		// no-op for unit tests
	}

	async requestUnload(kind: ResourceKind): Promise<void> {
		const adapter = this.adapters.get(kind);
		if (adapter?.isLoaded()) {
			await adapter.unload();
		}
	}

	async dispose(): Promise<void> {
		for (const adapter of this.adapters.values()) {
			if (adapter.isLoaded()) {
				await adapter.unload();
			}
		}
		this.adapters.clear();
		this.heavyRefs = 0;
		this.heavyJobId = undefined;
		this.heavyKind = undefined;
	}

	async acquire(kind: ResourceKind, options: AcquireOptions): Promise<MlLease> {
		if (options.rejectIfBusy && this.heavyRefs > 0) {
			throw new MlBusyError(`ML lane is busy with ${this.heavyKind} (job ${this.heavyJobId}).`);
		}
		while (this.heavyRefs > 0) {
			await new Promise(resolve => setTimeout(resolve, 5));
		}
		const adapter = this.adapters.get(kind);
		if (adapter && !adapter.isLoaded()) {
			await adapter.load(options.signal ?? new AbortController().signal);
		}
		this.heavyRefs += 1;
		this.heavyKind = kind;
		this.heavyJobId = options.jobId;
		let released = false;
		return {
			id: randomUUID(),
			kind,
			jobId: options.jobId,
			release: async () => {
				if (released) {
					return;
				}
				released = true;
				this.heavyRefs = Math.max(0, this.heavyRefs - 1);
				if (this.heavyRefs === 0) {
					this.heavyJobId = undefined;
					this.heavyKind = undefined;
				}
			},
		};
	}

	async withLease<T>(
		kind: ResourceKind,
		options: AcquireOptions,
		fn: (lease: MlLease) => Promise<T>,
	): Promise<T> {
		const lease = await this.acquire(kind, options);
		try {
			return await fn(lease);
		} finally {
			await lease.release();
		}
	}
}

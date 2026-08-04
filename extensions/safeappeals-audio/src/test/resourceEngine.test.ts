/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	MlBackendCrashedError,
	MlBackendUnavailableError,
	MlBudgetExceededError,
	MlBusyError,
	MlCancelledError,
} from '../ml/errors';
import { MlResourceEngine } from '../ml/resourceEngine';
import type { ResourceAdapter, ResourceKind } from '../ml/types';

class FakeAdapter implements ResourceAdapter {
	readonly kind: ResourceKind;
	readonly estimateMb: number;
	loaded = false;
	loadCount = 0;
	unloadCount = 0;
	cancelCount = 0;
	loadDelayMs = 0;
	unloadDelayMs = 0;
	failLoadWith: Error | undefined;
	private loadBlock: { promise: Promise<void>; release: () => void } | undefined;

	constructor(kind: ResourceKind, estimateMb = 100) {
		this.kind = kind;
		this.estimateMb = estimateMb;
	}

	/** Hold `load()` until {@link releaseLoad} — useful for cancel-active races. */
	blockNextLoad(): void {
		let release!: () => void;
		const promise = new Promise<void>(resolve => {
			release = resolve;
		});
		this.loadBlock = { promise, release };
	}

	releaseLoad(): void {
		this.loadBlock?.release();
		this.loadBlock = undefined;
	}

	async load(signal: AbortSignal): Promise<void> {
		if (this.failLoadWith) {
			throw this.failLoadWith;
		}
		if (this.loadBlock) {
			await this.loadBlock.promise;
		}
		if (this.loadDelayMs > 0) {
			await delay(this.loadDelayMs);
		}
		if (signal.aborted) {
			throw new MlCancelledError(`${this.kind} load aborted`);
		}
		this.loadCount += 1;
		this.loaded = true;
	}

	async unload(): Promise<void> {
		if (this.unloadDelayMs > 0) {
			await delay(this.unloadDelayMs);
		}
		this.unloadCount += 1;
		this.loaded = false;
	}

	cancel(_reason: string): void {
		this.cancelCount += 1;
	}

	isLoaded(): boolean {
		return this.loaded;
	}
}

function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

suite('MlResourceEngine', () => {
	test('exclusive heavy lane: whisper and diarization never concurrent', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const diar = new FakeAdapter('diarization', 50);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper, diar]);

		const leaseA = await engine.acquire('whisper', { jobId: 'a' });
		assert.strictEqual(engine.getSnapshot().heavyKindLoaded, 'whisper');
		assert.strictEqual(whisper.loaded, true);

		const diarPromise = engine.acquire('diarization', { jobId: 'b' });
		await delay(20);
		assert.strictEqual(engine.getSnapshot().queueLength, 1);
		assert.strictEqual(diar.loadCount, 0);

		await leaseA.release();
		const leaseB = await diarPromise;
		assert.strictEqual(whisper.loaded, false);
		assert.strictEqual(diar.loaded, true);
		assert.strictEqual(engine.getSnapshot().heavyKindLoaded, 'diarization');
		await leaseB.release();
		await engine.dispose();
	});

	test('queue is FIFO across jobs', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		const first = await engine.acquire('whisper', { jobId: '1' });
		const order: string[] = [];

		const p2 = engine.acquire('whisper', { jobId: '2' }).then(async lease => {
			order.push('2');
			await lease.release();
		});
		const p3 = engine.acquire('whisper', { jobId: '3' }).then(async lease => {
			order.push('3');
			await lease.release();
		});
		await delay(10);
		assert.strictEqual(engine.getSnapshot().queueLength, 2);

		order.push('1');
		await first.release();
		await Promise.all([p2, p3]);
		assert.deepStrictEqual(order, ['1', '2', '3']);
		await engine.dispose();
	});

	test('cancel queued acquire rejects with MlCancelledError', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		const held = await engine.acquire('whisper', { jobId: 'hold' });
		const controller = new AbortController();
		const queued = engine.acquire('whisper', { jobId: 'queued', signal: controller.signal });
		await delay(10);
		controller.abort();

		await assert.rejects(queued, (err: unknown) => err instanceof MlCancelledError);
		assert.strictEqual(engine.getSnapshot().queueLength, 0);
		await held.release();
		await engine.dispose();
	});

	test('cancelJob on active calls adapter.cancel (best-effort)', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		const lease = await engine.acquire('whisper', { jobId: 'active' });
		engine.cancelJob('active', 'stop');
		assert.strictEqual(whisper.cancelCount, 1);
		await lease.release();
		await engine.dispose();
	});

	test('cancelJob removes queued waiter', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		const held = await engine.acquire('whisper', { jobId: 'hold' });
		const queued = engine.acquire('whisper', { jobId: 'victim' });
		await delay(10);
		engine.cancelJob('victim');
		await assert.rejects(queued, (err: unknown) => err instanceof MlCancelledError);
		await held.release();
		await engine.dispose();
	});

	test('idle eviction unloads after idleUnloadMs', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const engine = new MlResourceEngine({ idleUnloadMs: 40 }, [whisper]);

		await engine.withLease('whisper', { jobId: 'j1' }, async () => {
			assert.strictEqual(whisper.loaded, true);
		});
		assert.strictEqual(whisper.loaded, true);
		await delay(80);
		assert.strictEqual(whisper.loaded, false);
		assert.ok(whisper.unloadCount >= 1);
		await engine.dispose();
	});

	test('budget exceeded rejects before load', async () => {
		const whisper = new FakeAdapter('whisper', 900);
		const engine = new MlResourceEngine({
			peakRssBudgetMb: 500,
			idleUnloadMs: 60_000,
		}, [whisper]);

		await assert.rejects(
			engine.acquire('whisper', { jobId: 'big' }),
			(err: unknown) => err instanceof MlBudgetExceededError,
		);
		assert.strictEqual(whisper.loadCount, 0);
		await engine.dispose();
	});

	test('withLease releases in finally even when fn throws', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		await assert.rejects(
			engine.withLease('whisper', { jobId: 'boom' }, async () => {
				throw new Error('work failed');
			}),
			/work failed/,
		);
		assert.strictEqual(engine.getSnapshot().slots.whisper.refCount, 0);
		assert.strictEqual(engine.getSnapshot().activeJobId, undefined);

		// Lane is free for the next job.
		await engine.withLease('whisper', { jobId: 'ok' }, async () => {
			assert.strictEqual(engine.getSnapshot().slots.whisper.refCount, 1);
		});
		await engine.dispose();
	});

	test('dispose drains queue with MlCancelledError', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		const held = await engine.acquire('whisper', { jobId: 'hold' });
		const queued = engine.acquire('whisper', { jobId: 'waiting' });
		await delay(10);

		const disposePromise = engine.dispose();
		await assert.rejects(queued, (err: unknown) => err instanceof MlCancelledError);
		await held.release();
		await disposePromise;
		assert.strictEqual(whisper.loaded, false);
	});

	test('rejectIfBusy fails fast with MlBusyError', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		const held = await engine.acquire('whisper', { jobId: 'hold' });
		await assert.rejects(
			engine.acquire('whisper', { jobId: 'other', rejectIfBusy: true }),
			(err: unknown) => err instanceof MlBusyError,
		);
		await held.release();
		await engine.dispose();
	});

	test('nested withLease same jobId re-enters; parallel same jobId serializes', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		await engine.withLease('whisper', { jobId: 'nested' }, async () => {
			assert.strictEqual(engine.getSnapshot().slots.whisper.refCount, 1);
			await engine.withLease('whisper', { jobId: 'nested' }, async () => {
				assert.strictEqual(engine.getSnapshot().slots.whisper.refCount, 2);
				assert.strictEqual(whisper.loadCount, 1);
			});
			assert.strictEqual(engine.getSnapshot().slots.whisper.refCount, 1);
		});

		const order: string[] = [];
		const p1 = engine.withLease('whisper', { jobId: 'parallel' }, async () => {
			order.push('1start');
			await delay(40);
			order.push('1end');
		});
		const p2 = engine.withLease('whisper', { jobId: 'parallel' }, async () => {
			order.push('2start');
			order.push('2end');
		});
		await Promise.all([p1, p2]);
		assert.deepStrictEqual(order, ['1start', '1end', '2start', '2end']);
		assert.strictEqual(engine.getSnapshot().slots.whisper.refCount, 0);
		await engine.dispose();
	});

	test('cancel during blocked load does not phantom-lease or deadlock', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		whisper.blockNextLoad();
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		const controller = new AbortController();
		const acquirePromise = engine.acquire('whisper', {
			jobId: 'loading',
			signal: controller.signal,
		});
		await delay(20);
		controller.abort();

		await assert.rejects(acquirePromise, (err: unknown) => err instanceof MlCancelledError);
		whisper.releaseLoad();
		await delay(30);

		assert.strictEqual(engine.getSnapshot().slots.whisper.refCount, 0);
		assert.strictEqual(engine.getSnapshot().queueLength, 0);

		await engine.withLease('whisper', { jobId: 'after-cancel' }, async () => {
			assert.strictEqual(whisper.loaded, true);
			assert.strictEqual(engine.getSnapshot().slots.whisper.refCount, 1);
		});
		await engine.dispose();
	});

	test('cancelJob during blocked load settles waiter and leaves lane usable', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		whisper.blockNextLoad();
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		const acquirePromise = engine.acquire('whisper', { jobId: 'victim' });
		await delay(20);
		engine.cancelJob('victim');
		await assert.rejects(acquirePromise, (err: unknown) => err instanceof MlCancelledError);
		whisper.releaseLoad();
		await delay(30);

		assert.strictEqual(engine.getSnapshot().queueLength, 0);
		await engine.withLease('whisper', { jobId: 'next' }, async () => {
			assert.ok(whisper.loadCount >= 1);
		});
		await engine.dispose();
	});

	test('cancel during load that completes schedules idle eviction', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		whisper.blockNextLoad();
		// No AbortSignal: cancelJob settles the waiter while load still finishes successfully.
		const engine = new MlResourceEngine({ idleUnloadMs: 40 }, [whisper]);

		const acquirePromise = engine.acquire('whisper', { jobId: 'victim' });
		await delay(20);
		engine.cancelJob('victim');
		await assert.rejects(acquirePromise, (err: unknown) => err instanceof MlCancelledError);
		whisper.releaseLoad();
		await delay(30);

		assert.strictEqual(whisper.loaded, true);
		assert.strictEqual(engine.getSnapshot().slots.whisper.refCount, 0);
		assert.strictEqual(engine.getSnapshot().heavyKindLoaded, 'whisper');

		await delay(80);
		assert.strictEqual(whisper.loaded, false);
		assert.ok(whisper.unloadCount >= 1);
		await engine.dispose();
	});

	test('reportCrash marks slot crashed and drains waiters', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		const held = await engine.acquire('whisper', { jobId: 'active' });
		const queued = engine.acquire('whisper', { jobId: 'waiting' });
		await delay(10);

		engine.reportCrash('whisper', 'native died');
		await assert.rejects(
			queued,
			(err: unknown) => err instanceof MlBackendCrashedError,
		);
		assert.strictEqual(engine.getSnapshot().slots.whisper.state, 'crashed');
		assert.strictEqual(whisper.cancelCount, 1);

		await held.release();
		await engine.withLease('whisper', { jobId: 'recover' }, async () => {
			assert.strictEqual(engine.getSnapshot().slots.whisper.state, 'running');
		});
		await engine.dispose();
	});

	test('registerAdapter accepts diarization after construction', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper]);

		await assert.rejects(
			engine.acquire('diarization', { jobId: 'd' }),
			(err: unknown) => err instanceof MlBackendUnavailableError,
		);

		const diar = new FakeAdapter('diarization', 50);
		engine.registerAdapter(diar);
		await engine.withLease('diarization', { jobId: 'd' }, async () => {
			assert.strictEqual(diar.loaded, true);
		});
		await engine.dispose();
	});

	test('acquiring diarization unloads whisper first', async () => {
		const whisper = new FakeAdapter('whisper', 100);
		const diar = new FakeAdapter('diarization', 50);
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [whisper, diar]);

		await engine.withLease('whisper', { jobId: 'w' }, async () => { /* warm */ });
		assert.strictEqual(whisper.loaded, true);

		await engine.withLease('diarization', { jobId: 'd' }, async () => {
			assert.strictEqual(whisper.loaded, false);
			assert.strictEqual(diar.loaded, true);
		});
		assert.ok(whisper.unloadCount >= 1);
		await engine.dispose();
	});

	test('embedding stub refuses load via unavailable error path', async () => {
		const embedding = new FakeAdapter('embedding', 400);
		embedding.failLoadWith = new MlBackendUnavailableError('stub');
		const engine = new MlResourceEngine({ idleUnloadMs: 60_000 }, [embedding]);

		await assert.rejects(
			engine.acquire('embedding', { jobId: 'e' }),
			(err: unknown) => err instanceof MlBackendUnavailableError,
		);
		await engine.dispose();
	});
});

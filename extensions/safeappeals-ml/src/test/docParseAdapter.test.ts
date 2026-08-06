/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { DocParseAdapter } from '../adapters/docParseAdapter';
import { MlBackendUnavailableError } from '../errors';
import type { SmokeFetch } from '../docParseSmoke';

function okHealthFetch(): SmokeFetch {
	return async () => ({
		ok: true,
		status: 200,
		json: async () => ({ ok: true, model: 'test' }),
	});
}

function failHealthFetch(): SmokeFetch {
	return async () => ({
		ok: false,
		status: 503,
		json: async () => ({ ok: false }),
	});
}

suite('DocParseAdapter', () => {
	test('load succeeds on BYO localhost health', async () => {
		const adapter = new DocParseAdapter({
			baseUrl: 'http://127.0.0.1:8742',
			fetchImpl: okHealthFetch(),
		});
		await adapter.load(new AbortController().signal);
		assert.strictEqual(adapter.isLoaded(), true);
		assert.strictEqual(adapter.ownsProcess, false);
		await adapter.unload();
		assert.strictEqual(adapter.isLoaded(), false);
	});

	test('load fails closed when health is down', async () => {
		const adapter = new DocParseAdapter({
			baseUrl: 'http://127.0.0.1:8742',
			fetchImpl: failHealthFetch(),
		});
		await assert.rejects(
			adapter.load(new AbortController().signal),
			(err: unknown) => err instanceof MlBackendUnavailableError,
		);
		assert.strictEqual(adapter.isLoaded(), false);
	});

	test('unload kills owned process when spawnOwned returns one', async () => {
		const fake = new EventEmitter() as ChildProcess;
		let killed = false;
		(fake as { killed: boolean }).killed = false;
		(fake as { pid: number }).pid = 4242;
		(fake as { kill: (signal?: NodeJS.Signals) => boolean }).kill = () => {
			killed = true;
			(fake as { killed: boolean }).killed = true;
			fake.emit('exit', 0, 'SIGTERM');
			return true;
		};

		const adapter = new DocParseAdapter({
			baseUrl: 'http://127.0.0.1:8742',
			fetchImpl: okHealthFetch(),
			spawnOwned: async () => fake,
		});
		await adapter.load(new AbortController().signal);
		assert.strictEqual(adapter.ownsProcess, true);
		await adapter.unload();
		assert.strictEqual(killed, true);
		assert.strictEqual(adapter.isLoaded(), false);
		assert.strictEqual(adapter.ownsProcess, false);
	});
});

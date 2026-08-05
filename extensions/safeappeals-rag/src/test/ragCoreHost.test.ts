/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import {
	RagCoreHost,
	type RagCapabilities,
	type RagCoreLoadResult,
	type RagCoreNativeApi,
	type RagOpResult,
	type RagSearchResult,
	type RagStats,
} from '../ragCoreHost';

function memorySecrets(): {
	store: Map<string, string>;
	api: {
		get(key: string): Promise<string | undefined>;
		store(key: string, value: string): Promise<void>;
		delete(key: string): Promise<void>;
	};
} {
	const store = new Map<string, string>();
	return {
		store,
		api: {
			async get(key) {
				return store.get(key);
			},
			async store(key, value) {
				store.set(key, value);
			},
			async delete(key) {
				store.delete(key);
			},
		},
	};
}

function memoryMemento(): {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown): Promise<void>;
} {
	const data = new Map<string, unknown>();
	return {
		get: <T>(key: string) => data.get(key) as T | undefined,
		update: async (key: string, value: unknown) => {
			if (value === undefined) {
				data.delete(key);
			} else {
				data.set(key, value);
			}
		},
	};
}

type FakeNative = RagCoreNativeApi & {
	setCapabilities(partial: Partial<RagCapabilities>): void;
};

function fakeNative(overrides: Partial<RagCapabilities> = {}): FakeNative {
	const caps: RagCapabilities = {
		hybrid: true,
		rerank: false,
		queryProcessor: true,
		modelsPresent: true,
		storageReady: true,
		dims: 512,
		...overrides,
	};
	let open = false;
	return {
		ping: () => 'pong',
		version: () => '0.1.0-test',
		capabilities: () => ({ ...caps }),
		setCapabilities: (partial: Partial<RagCapabilities>) => {
			Object.assign(caps, partial);
		},
		openWorkspace: (_root, dek): RagOpResult => {
			if (dek.length !== 32) {
				return { ok: false, error: 'DEK must be 32 bytes' };
			}
			open = true;
			return { ok: true };
		},
		closeWorkspace: (): RagOpResult => {
			open = false;
			return { ok: true };
		},
		stats: (): RagStats => ({
			documents: open ? 1 : 0,
			chunks: open ? 2 : 0,
			vectors: open ? 2 : 0,
			textDocs: open ? 2 : 0,
		}),
		chunkDocument: input => [
			{
				chunkId: `${input.docId}:0`,
				docId: input.docId,
				text: input.text,
				chunkIndex: 0,
				tokenCount: 3,
				chunkType: 'parent',
				sourceUri: input.sourceUri,
			},
		],
		indexChunks: () => ({ ok: true, count: 1 }),
		removeDoc: () => ({ ok: true }),
		search: (query): RagSearchResult => ({
			ok: true,
			results: [
				{
					chunkId: 'c1',
					docId: 'd1',
					text: query,
					fusedScore: 1,
					scope: 'case_index',
				},
			],
		}),
	};
}

function fakeContext(tmpRoot: string) {
	const secrets = memorySecrets();
	return {
		globalStorageUri: { fsPath: tmpRoot, scheme: 'file', path: tmpRoot },
		secrets: secrets.api,
		globalState: memoryMemento(),
		_secrets: secrets.store,
	};
}

suite('ragCoreHost gates', () => {
	let tmpRoot: string;

	setup(async () => {
		tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-rag-host-'));
	});

	teardown(async () => {
		await fs.rm(tmpRoot, { recursive: true, force: true });
	});

	test('native-missing soft-fails and hard-disables', async () => {
		const context = fakeContext(tmpRoot);
		const host = await RagCoreHost.create({
			context: context as never,
			workspaceId: 'ws1',
			getArtifactDir: async () => undefined,
			skipModelsGate: true,
			load: (): RagCoreLoadResult => ({
				ok: false,
				error: 'addon missing for electron-146',
				expectedPath: '/prebuilds/linux-x64/electron-146/rag_core.node',
			}),
		});
		const status = host.getStatus();
		assert.strictEqual(status.disableCode, 'native-missing');
		assert.strictEqual(status.available, false);
		assert.ok(status.expectedPath?.includes('electron-146'));
		assert.ok(status.electron146Note.length > 0);
	});

	test('crypto-unavailable when SecretStorage probe fails', async () => {
		const context = fakeContext(tmpRoot);
		context.secrets = {
			async get() {
				throw new Error('no keyring');
			},
			async store() {
				throw new Error('no keyring');
			},
			async delete() { },
		};
		const host = await RagCoreHost.create({
			context: context as never,
			workspaceId: 'ws1',
			getArtifactDir: async () => undefined,
			skipModelsGate: true,
			load: () => ({
				ok: true,
				native: fakeNative(),
				bindingPath: '/fake/rag_core.node',
			}),
		});
		assert.strictEqual(host.getStatus().disableCode, 'crypto-unavailable');
		assert.strictEqual(host.isAvailable, false);
	});

	test('models-missing when no embed dir and modelsPresent false', async () => {
		const context = fakeContext(tmpRoot);
		const host = await RagCoreHost.create({
			context: context as never,
			workspaceId: 'ws1',
			getArtifactDir: async () => undefined,
			load: () => ({
				ok: true,
				native: fakeNative({ modelsPresent: false }),
				bindingPath: '/fake/rag_core.node',
			}),
		});
		const status = host.getStatus();
		assert.strictEqual(status.disableCode, 'models-missing');
		assert.strictEqual(status.workspaceOpen, true);
		const gate = host.assertIndexingAllowed();
		assert.strictEqual(gate.ok, false);
		if (!gate.ok) {
			assert.strictEqual(gate.code, 'models-missing');
		}
	});

	test('opens single workspace root and searches when available', async () => {
		const context = fakeContext(tmpRoot);
		const host = await RagCoreHost.create({
			context: context as never,
			workspaceId: 'abcd1234',
			getArtifactDir: async () => undefined,
			skipModelsGate: true,
			load: () => ({
				ok: true,
				native: fakeNative({ modelsPresent: true }),
				bindingPath: '/fake/rag_core.node',
			}),
		});
		const status = host.getStatus();
		assert.strictEqual(status.available, true);
		assert.strictEqual(
			status.workspaceRoot,
			path.join(tmpRoot, 'rag', 'abcd1234'),
		);
		const search = host.search('rating reduction', { finalK: 4 });
		assert.strictEqual(search.ok, true);
		assert.strictEqual(search.results.length, 1);
		const close = host.closeWorkspace();
		assert.strictEqual(close.ok, true);
	});

	test('refreshModelGates clears models-missing after Search pack dirs appear', async () => {
		const context = fakeContext(tmpRoot);
		const embedDir = path.join(tmpRoot, 'bge-small');
		await fs.mkdir(embedDir, { recursive: true });
		let artifactDir: string | undefined;
		const native = fakeNative({ modelsPresent: false });
		const host = await RagCoreHost.create({
			context: context as never,
			workspaceId: 'ws1',
			getArtifactDir: async () => artifactDir,
			load: () => ({
				ok: true,
				native,
				bindingPath: '/fake/rag_core.node',
			}),
		});
		assert.strictEqual(host.getStatus().disableCode, 'models-missing');
		assert.strictEqual(host.isAvailable, false);

		artifactDir = embedDir;
		native.setCapabilities({ modelsPresent: true });
		await host.refreshModelGates();

		assert.strictEqual(host.getStatus().disableCode, undefined);
		assert.strictEqual(host.isAvailable, true);
		assert.strictEqual(host.assertIndexingAllowed().ok, true);
		assert.strictEqual(host.getStatus().modelEnv?.embedReady, true);
	});

	test('openWorkspace clearing modelsPresent sticky models-missing after try_load_default', async () => {
		const context = fakeContext(tmpRoot);
		const native = fakeNative({ modelsPresent: false });
		const originalOpen = native.openWorkspace.bind(native);
		native.openWorkspace = (root, dek) => {
			const result = originalOpen(root, dek);
			// Simulate native try_load_default succeeding during openWorkspace.
			native.setCapabilities({ modelsPresent: true });
			return result;
		};

		const host = await RagCoreHost.create({
			context: context as never,
			workspaceId: 'ws-sticky',
			getArtifactDir: async () => undefined,
			load: () => ({
				ok: true,
				native,
				bindingPath: '/fake/rag_core.node',
			}),
		});

		assert.strictEqual(host.getStatus().disableCode, undefined);
		assert.strictEqual(host.isAvailable, true);
		assert.strictEqual(host.getStatus().capabilities?.modelsPresent, true);
		assert.strictEqual(host.assertIndexingAllowed().ok, true);
	});
});

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
	const caps = {
		hybrid: true,
		rerank: false,
		queryProcessor: true,
		modelsPresent: true,
		storageReady: true,
		dims: 384,
		indexWriteCapable: true,
		indexWriteRole: 'primary' as const,
		...overrides,
	};
	let open = false;
	return {
		ping: () => 'pong',
		version: () => '0.1.0-test',
		capabilities: () => ({ ...caps }) as RagCapabilities,
		setCapabilities: (partial: Partial<RagCapabilities>) => {
			Object.assign(caps, partial);
		},
		openWorkspace: (_root, dek, _preferSecondary): RagOpResult => {
			if (dek.length !== 32) {
				return { ok: false, error: 'DEK must be 32 bytes' };
			}
			open = true;
			// Role comes from capabilities (flock is SoT in real native); preferSecondary is a no-op hint.
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
		getDocument: () => null,
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
		assert.ok(status.electron146Note.includes('electron-146'));
		assert.ok(!status.electron146Note.includes('not produced yet'));
	});

	test('openWorkspace succeeds with lazy writer; LockBusy surfaces on indexChunks', async () => {
		const context = fakeContext(tmpRoot);
		const lockError =
			'LockBusy: Failed to acquire index writer at .../text.tantivy/.tantivy-writer.lock';
		const native = fakeNative({ modelsPresent: true });
		native.indexChunks = () => ({ ok: false, error: lockError });

		const host = await RagCoreHost.create({
			context: context as never,
			workspaceId: 'ws-lock',
			getArtifactDir: async () => undefined,
			skipModelsGate: true,
			load: () => ({
				ok: true,
				native,
				bindingPath: '/fake/rag_core.node',
			}),
		});

		const status = host.getStatus();
		assert.strictEqual(status.disableCode, undefined);
		assert.strictEqual(status.available, true);
		assert.strictEqual(status.workspaceOpen, true);

		const indexResult = host.indexChunks(
			{
				id: 'd1',
				path: '/x',
				filename: 'x',
				filetype: 'md',
				filesize: 1,
				checksum: 'c',
				scope: 'case_index',
				isCoreReference: false,
				createdAt: 't',
				lastIndexedAt: 't',
			},
			[],
		);
		assert.strictEqual(indexResult.ok, false);
		assert.ok(indexResult.error?.includes('LockBusy'));

		const gate = host.assertIndexingAllowed();
		assert.strictEqual(gate.ok, false);
		if (!gate.ok) {
			assert.strictEqual(gate.code, 'index-lock-busy');
		}
		assert.strictEqual(host.getStatus().disableCode, 'index-lock-busy');
	});

	test('secondary session allows search but blocks indexing', async () => {
		const context = fakeContext(tmpRoot);
		const host = await RagCoreHost.create({
			context: context as never,
			workspaceId: 'ws-secondary',
			getArtifactDir: async () => undefined,
			skipModelsGate: true,
			preferSecondary: true,
			load: () => ({
				ok: true,
				native: fakeNative({ indexWriteRole: 'secondary', indexWriteCapable: false }),
				bindingPath: '/fake/rag_core.node',
			}),
		});

		const status = host.getStatus();
		assert.strictEqual(status.indexWriteRole, 'secondary');
		assert.strictEqual(status.available, true);
		assert.strictEqual(host.assertSearchAllowed().ok, true);

		const indexGate = host.assertIndexingAllowed();
		assert.strictEqual(indexGate.ok, false);
		if (!indexGate.ok) {
			assert.strictEqual(indexGate.code, 'read-only-session');
		}

		const search = host.search('query', { finalK: 4 });
		assert.strictEqual(search.ok, true);
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

	test('refreshModelGates keeps models-missing when ensureEmbedderLoaded fails', async () => {
		const context = fakeContext(tmpRoot);
		const embedDir = path.join(tmpRoot, 'bge-small');
		await fs.mkdir(embedDir, { recursive: true });
		let artifactDir: string | undefined;
		const native = fakeNative({ modelsPresent: false });
		native.ensureEmbedderLoaded = () => ({
			ok: false,
			error: 'fastembed load failed',
			loaded: false,
		});
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
		await host.refreshModelGates();

		// Artifacts present but cold — still available until ensure fails.
		assert.strictEqual(host.getStatus().disableCode, undefined);
		assert.strictEqual(host.isAvailable, true);

		const ensureResult = host.ensureEmbedderLoaded();
		assert.strictEqual(ensureResult.ok, false);
		await host.refreshModelGates();

		const status = host.getStatus();
		assert.strictEqual(status.disableCode, 'models-missing');
		assert.strictEqual(status.modelEnv?.embedReady, true);
		assert.strictEqual(status.capabilities?.modelsPresent, false);
		assert.strictEqual(host.isAvailable, false);
		assert.ok(status.reasons[0]?.includes('failed to load'));
	});

	test('refreshModelGates clears models-missing when Search pack dirs appear', async () => {
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
		await host.refreshModelGates();

		assert.strictEqual(host.getStatus().disableCode, undefined);
		assert.strictEqual(host.isAvailable, true);
		assert.strictEqual(host.assertIndexingAllowed().ok, true);
		assert.strictEqual(host.getStatus().modelEnv?.embedReady, true);
	});

	test('initialize stays available when embed dir present but embedder cold', async () => {
		const context = fakeContext(tmpRoot);
		const embedDir = path.join(tmpRoot, 'bge-small');
		await fs.mkdir(embedDir, { recursive: true });
		const host = await RagCoreHost.create({
			context: context as never,
			workspaceId: 'ws-cold',
			getArtifactDir: async () => embedDir,
			load: () => ({
				ok: true,
				native: fakeNative({ modelsPresent: false }),
				bindingPath: '/fake/rag_core.node',
			}),
		});

		const status = host.getStatus();
		assert.strictEqual(status.disableCode, undefined);
		assert.strictEqual(status.workspaceOpen, true);
		assert.strictEqual(status.modelEnv?.embedReady, true);
		assert.strictEqual(status.capabilities?.modelsPresent, false);
		assert.strictEqual(host.isAvailable, true);
		assert.strictEqual(host.assertIndexingAllowed().ok, true);
	});

	test('openWorkspace does not auto-load embedder; ensureEmbedderLoaded flips modelsPresent', async () => {
		const context = fakeContext(tmpRoot);
		const embedDir = path.join(tmpRoot, 'bge-small');
		await fs.mkdir(embedDir, { recursive: true });
		let ensureCalled = false;
		const native = fakeNative({ modelsPresent: false });
		const originalOpen = native.openWorkspace.bind(native);
		native.openWorkspace = (root, dek) => {
			const result = originalOpen(root, dek);
			// openWorkspace must not load BGE — modelsPresent stays false until lease load.
			assert.strictEqual(native.capabilities().modelsPresent, false);
			return result;
		};
		native.ensureEmbedderLoaded = () => {
			ensureCalled = true;
			native.setCapabilities({ modelsPresent: true });
			return { ok: true, loaded: true };
		};

		const host = await RagCoreHost.create({
			context: context as never,
			workspaceId: 'ws-sticky',
			getArtifactDir: async () => embedDir,
			load: () => ({
				ok: true,
				native,
				bindingPath: '/fake/rag_core.node',
			}),
		});

		assert.strictEqual(host.getStatus().disableCode, undefined);
		assert.strictEqual(host.isAvailable, true);
		assert.strictEqual(host.getStatus().capabilities?.modelsPresent, false);

		host.ensureEmbedderLoaded();
		assert.strictEqual(ensureCalled, true);
		assert.strictEqual(host.getStatus().capabilities?.modelsPresent, true);

		await host.refreshModelGates();
		assert.strictEqual(host.getStatus().disableCode, undefined);
		assert.strictEqual(host.isAvailable, true);
		assert.strictEqual(host.assertIndexingAllowed().ok, true);
	});

	test('clearEmbedder after warm load keeps availability when artifacts present', async () => {
		const context = fakeContext(tmpRoot);
		const embedDir = path.join(tmpRoot, 'bge-small');
		await fs.mkdir(embedDir, { recursive: true });
		const native = fakeNative({ modelsPresent: false });
		native.ensureEmbedderLoaded = () => {
			native.setCapabilities({ modelsPresent: true });
			return { ok: true, loaded: true };
		};
		native.clearEmbedder = () => {
			native.setCapabilities({ modelsPresent: false });
			return { ok: true };
		};

		const host = await RagCoreHost.create({
			context: context as never,
			workspaceId: 'ws-unload',
			getArtifactDir: async () => embedDir,
			load: () => ({
				ok: true,
				native,
				bindingPath: '/fake/rag_core.node',
			}),
		});

		assert.strictEqual(host.isAvailable, true);
		host.ensureEmbedderLoaded();
		assert.strictEqual(host.getStatus().capabilities?.modelsPresent, true);

		host.clearEmbedder();
		assert.strictEqual(host.getStatus().capabilities?.modelsPresent, false);
		assert.strictEqual(host.getStatus().disableCode, undefined);
		assert.strictEqual(host.isAvailable, true);
		assert.strictEqual(host.assertIndexingAllowed().ok, true);
	});
});

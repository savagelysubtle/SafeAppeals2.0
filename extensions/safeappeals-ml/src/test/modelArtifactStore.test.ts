/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { createHash } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { ModelCatalog } from '../modelCatalog';
import { ModelArtifactStore, sha256Hex } from '../modelArtifactStore';
import type { ModelSpec } from '../types';

const PAYLOAD = new Uint8Array(Buffer.from('fake-unlimited-ocr-weights-for-unit-tests', 'utf8'));
const DIGEST = sha256Hex(PAYLOAD);

function testSpec(partial: Partial<ModelSpec> = {}): ModelSpec {
	return {
		id: 'unlimited-ocr',
		version: '1.0.0-test',
		minVramMb: 8192,
		minRamMb: 16384,
		diskMb: 1,
		backends: ['cuda-vllm'],
		pageSoftCap: 40,
		sha256: DIGEST,
		downloadUrl: 'https://example.test/unlimited-ocr.bin',
		artifactFileName: 'model.safetensors',
		...partial,
	};
}

suite('modelArtifactStore', () => {
	let tmpRoot: string;

	setup(async () => {
		tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-ml-artifacts-'));
	});

	teardown(async () => {
		await fs.rm(tmpRoot, { recursive: true, force: true });
	});

	test('isReady is false before consent download', async () => {
		const catalog = new ModelCatalog([testSpec()]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => {
				throw new Error('fetcher must not run');
			},
		});
		assert.strictEqual(await store.isReady('unlimited-ocr'), false);
	});

	test('downloadWithConsent refuses without literal userConsented true', async () => {
		const catalog = new ModelCatalog([testSpec()]);
		let fetchCount = 0;
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => {
				fetchCount++;
				return PAYLOAD;
			},
		});
		await assert.rejects(
			() =>
				(store as { downloadWithConsent: (o: { modelId: string; userConsented: boolean }) => Promise<unknown> })
					.downloadWithConsent({
						modelId: 'unlimited-ocr',
						userConsented: false,
					}),
			/userConsented/,
		);
		assert.strictEqual(fetchCount, 0);
		assert.strictEqual(await store.isReady('unlimited-ocr'), false);
	});

	test('downloadWithConsent verifies SHA and marks ready', async () => {
		const catalog = new ModelCatalog([testSpec()]);
		let fetchedUrl: string | undefined;
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async (url: string) => {
				fetchedUrl = url;
				return PAYLOAD;
			},
		});

		const result = await store.downloadWithConsent({
			modelId: 'unlimited-ocr',
			userConsented: true,
		});

		assert.deepStrictEqual(
			{ modelId: result.modelId, version: result.version, fetchedUrl },
			{
				modelId: 'unlimited-ocr',
				version: '1.0.0-test',
				fetchedUrl: 'https://example.test/unlimited-ocr.bin',
			},
		);
		assert.strictEqual(await store.isReady('unlimited-ocr'), true);

		const artifactPath = path.join(
			tmpRoot,
			'ml-models',
			'unlimited-ocr',
			'1.0.0-test',
			'model.safetensors',
		);
		const onDisk = await fs.readFile(artifactPath);
		assert.strictEqual(createHash('sha256').update(onDisk).digest('hex'), DIGEST);
	});

	test('downloadWithConsent rejects SHA mismatch and stays not ready', async () => {
		const catalog = new ModelCatalog([testSpec({ sha256: '0'.repeat(64) })]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => PAYLOAD,
		});
		await assert.rejects(
			() =>
				store.downloadWithConsent({
					modelId: 'unlimited-ocr',
					userConsented: true,
				}),
			/SHA-256 mismatch/,
		);
		assert.strictEqual(await store.isReady('unlimited-ocr'), false);
	});

	test('download refuses when sha256/downloadUrl not pinned', async () => {
		const catalog = new ModelCatalog([
			testSpec({ sha256: undefined, downloadUrl: undefined }),
		]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => PAYLOAD,
		});
		await assert.rejects(
			() =>
				store.downloadWithConsent({
					modelId: 'unlimited-ocr',
					userConsented: true,
				}),
			/sha256/,
		);
	});

	test('isReady normalizes SHA case on both sides', async () => {
		const catalog = new ModelCatalog([testSpec({ sha256: DIGEST.toUpperCase() })]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => PAYLOAD,
		});
		await store.downloadWithConsent({
			modelId: 'unlimited-ocr',
			userConsented: true,
			sha256: DIGEST,
		});
		assert.strictEqual(await store.isReady('unlimited-ocr'), true);
	});

	test('purge removes model artifacts', async () => {
		const catalog = new ModelCatalog([testSpec()]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => PAYLOAD,
		});
		await store.downloadWithConsent({
			modelId: 'unlimited-ocr',
			userConsented: true,
		});
		assert.strictEqual(await store.isReady('unlimited-ocr'), true);
		const purged = await store.purge('unlimited-ocr');
		assert.deepStrictEqual(purged, { purged: ['unlimited-ocr'] });
		assert.strictEqual(await store.isReady('unlimited-ocr'), false);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as os from 'node:os';
import * as path from 'node:path';
import { promises as fs } from 'node:fs';
import { consentInstallModel, consentInstallUnlimitedOcr } from '../consentInstall';
import type { HwCapabilityProbe } from '../hwCapabilityProbe';
import { ModelCatalog } from '../modelCatalog';
import { ModelArtifactStore, sha256Hex } from '../modelArtifactStore';
import type { HwSnapshot, ModelSpec } from '../types';

const PAYLOAD = new Uint8Array(Buffer.from('consent-install-test-bytes', 'utf8'));
const DIGEST = sha256Hex(PAYLOAD);

function eligibleSnapshot(): HwSnapshot {
	return {
		platform: 'linux',
		arch: 'x64',
		osRelease: '6.8.0',
		cpuModel: 'Test CPU',
		cpuCount: 16,
		totalRamMb: 64_000,
		freeRamMb: 32_000,
		diskFreeMb: 100_000,
		gpuVramMb: 24_576,
		gpuName: 'Test GPU',
		probedAt: 1,
	};
}

function ocrSpec(partial: Partial<ModelSpec> = {}): ModelSpec {
	return {
		id: 'unlimited-ocr',
		version: '1.0.0-test',
		minVramMb: 8192,
		minRamMb: 16384,
		diskMb: 1,
		backends: ['cuda-vllm'],
		pageSoftCap: 40,
		sha256: DIGEST,
		downloadUrl: 'https://example.test/ocr.bin',
		artifactFileName: 'model.safetensors',
		...partial,
	};
}

suite('consentInstall', () => {
	let tmpRoot: string;

	setup(async () => {
		tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-ml-consent-'));
	});

	teardown(async () => {
		await fs.rm(tmpRoot, { recursive: true, force: true });
	});

	test('never downloads when ineligible even with consent', async () => {
		let fetchCount = 0;
		const catalog = new ModelCatalog([ocrSpec()]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => {
				fetchCount++;
				return PAYLOAD;
			},
		});
		const probe = fakeProbe({
			...eligibleSnapshot(),
			gpuVramMb: 2048,
			gpuName: 'Tiny GPU',
		});

		const outcome = await consentInstallModel(
			{ probe, catalog, store },
			{ modelId: 'unlimited-ocr', userConsented: true },
		);

		assert.strictEqual(outcome.kind, 'ineligible');
		assert.strictEqual(fetchCount, 0);
		assert.strictEqual(await store.isReady('unlimited-ocr'), false);
	});

	test('eligible without consent returns consent-required and does not fetch', async () => {
		let fetchCount = 0;
		const catalog = new ModelCatalog([ocrSpec()]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => {
				fetchCount++;
				return PAYLOAD;
			},
		});
		const probe = fakeProbe(eligibleSnapshot());

		const outcome = await consentInstallModel(
			{ probe, catalog, store },
			{ modelId: 'unlimited-ocr', userConsented: false },
		);

		assert.deepStrictEqual(outcome, { kind: 'consent-required', modelId: 'unlimited-ocr' });
		assert.strictEqual(fetchCount, 0);
	});

	test('eligible + consent refuses when catalog pins are missing', async () => {
		let fetchCount = 0;
		const catalog = new ModelCatalog([
			ocrSpec({ sha256: undefined, downloadUrl: undefined, files: undefined }),
		]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => {
				fetchCount++;
				return PAYLOAD;
			},
		});
		const probe = fakeProbe(eligibleSnapshot());

		const outcome = await consentInstallModel(
			{ probe, catalog, store },
			{ modelId: 'unlimited-ocr', userConsented: true },
		);

		assert.strictEqual(outcome.kind, 'error');
		if (outcome.kind === 'error') {
			assert.ok(/sha256 pinned/.test(outcome.message));
		}
		assert.strictEqual(fetchCount, 0);
	});

	test('eligible + consent downloads and marks ready', async () => {
		const catalog = new ModelCatalog([ocrSpec()]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => PAYLOAD,
		});
		const probe = fakeProbe(eligibleSnapshot());

		const outcome = await consentInstallModel(
			{ probe, catalog, store },
			{ modelId: 'unlimited-ocr', userConsented: true },
		);

		assert.deepStrictEqual(outcome, {
			kind: 'installed',
			modelId: 'unlimited-ocr',
			version: '1.0.0-test',
		});
		assert.strictEqual(await store.isReady('unlimited-ocr'), true);
	});

	test('failed smoke marks install broken (not ready)', async () => {
		const catalog = new ModelCatalog([ocrSpec()]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => PAYLOAD,
		});
		const probe = fakeProbe(eligibleSnapshot());

		const outcome = await consentInstallModel(
			{ probe, catalog, store },
			{
				modelId: 'unlimited-ocr',
				userConsented: true,
				smokeTest: async () => {
					throw new Error('sidecar ping failed');
				},
			},
		);

		assert.strictEqual(outcome.kind, 'error');
		if (outcome.kind === 'error') {
			assert.ok(/smoke failed/.test(outcome.message));
		}
		assert.strictEqual(await store.isReady('unlimited-ocr'), false);
	});

	test('unlimited-OCR ensureDocParseReady success keeps artifacts ready', async () => {
		const catalog = new ModelCatalog([ocrSpec()]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => PAYLOAD,
		});
		const probe = fakeProbe(eligibleSnapshot());

		const outcome = await consentInstallUnlimitedOcr(
			{ probe, catalog, store },
			true,
			{
				ensureDocParseReady: async () => ({ ready: true }),
			},
		);

		assert.deepStrictEqual(outcome, {
			kind: 'installed',
			modelId: 'unlimited-ocr',
			version: '1.0.0-test',
		});
		assert.strictEqual(await store.isReady('unlimited-ocr'), true);
	});

	test('unlimited-OCR ensureDocParseReady failure does not mark broken', async () => {
		const catalog = new ModelCatalog([ocrSpec()]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			fetcher: async () => PAYLOAD,
		});
		const probe = fakeProbe(eligibleSnapshot());

		const outcome = await consentInstallUnlimitedOcr(
			{ probe, catalog, store },
			true,
			{
				ensureDocParseReady: async () => ({
					ready: false,
					detail: 'sidecar was down before start',
				}),
			},
		);

		assert.strictEqual(outcome.kind, 'error');
		if (outcome.kind === 'error') {
			assert.ok(/sidecar was down/.test(outcome.message));
		}
		assert.strictEqual(await store.isReady('unlimited-ocr'), true);
	});
});

function fakeProbe(snapshot: HwSnapshot): HwCapabilityProbe {
	return {
		snapshot: async () => snapshot,
	} as unknown as HwCapabilityProbe;
}

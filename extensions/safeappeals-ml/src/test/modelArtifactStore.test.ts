/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { Readable, Writable } from 'node:stream';
import { ModelCatalog, BGE_SMALL_SPEC, MS_MARCO_MINILM_SPEC, UNLIMITED_OCR_SPEC } from '../modelCatalog';
import {
	ModelArtifactStore,
	downloadUrlToFile,
	packDigestSha256,
	resolvePackRelativePath,
	sha256Hex,
	sha256HexFromFile,
	waitForWritableDrain,
	type DownloadToFileFn,
} from '../modelArtifactStore';
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

/** Test helper: write Uint8Array payload to destPath like a streaming download would. */
function downloadToFileFromPayload(
	payloads: ReadonlyMap<string, Uint8Array>,
): DownloadToFileFn {
	return async (url, destPath, options) => {
		const payload = payloads.get(url);
		if (!payload) {
			throw new Error(`unexpected url: ${url}`);
		}
		const total = payload.byteLength;
		options?.onProgress?.({ bytesReceived: 0, bytesTotal: total });
		await fs.mkdir(path.dirname(destPath), { recursive: true });
		await fs.writeFile(destPath, payload);
		options?.onProgress?.({ bytesReceived: total, bytesTotal: total });
		return { digest: sha256Hex(payload), bytesWritten: total };
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

	test('packDigestSha256 matches BGE Search pack catalog pin', () => {
		assert.ok(BGE_SMALL_SPEC.files?.length);
		assert.strictEqual(
			packDigestSha256(BGE_SMALL_SPEC.files!),
			BGE_SMALL_SPEC.sha256,
		);
	});

	test('packDigestSha256 matches ms-marco CE Search pack catalog pin', () => {
		assert.ok(MS_MARCO_MINILM_SPEC.files?.length);
		assert.strictEqual(
			packDigestSha256(MS_MARCO_MINILM_SPEC.files!),
			MS_MARCO_MINILM_SPEC.sha256,
		);
	});

	test('packDigestSha256 matches Unlimited-OCR HF pack catalog pin', () => {
		assert.ok(UNLIMITED_OCR_SPEC.files?.length);
		assert.strictEqual(
			packDigestSha256(UNLIMITED_OCR_SPEC.files!),
			UNLIMITED_OCR_SPEC.sha256,
		);
	});

	test('resolvePackRelativePath accepts nested paths under pack dir', () => {
		const packDir = path.join(tmpRoot, 'pack');
		const resolved = resolvePackRelativePath(packDir, 'onnx/model.onnx');
		assert.strictEqual(resolved, path.join(packDir, 'onnx', 'model.onnx'));
	});

	test('resolvePackRelativePath rejects path traversal', () => {
		const packDir = path.join(tmpRoot, 'pack');
		assert.throws(
			() => resolvePackRelativePath(packDir, '../escape'),
			/Unsafe artifact relativePath/,
		);
	});

	test('resolvePackRelativePath rejects absolute paths', () => {
		const packDir = path.join(tmpRoot, 'pack');
		assert.throws(
			() => resolvePackRelativePath(packDir, '/etc/passwd'),
			/Unsafe artifact relativePath/,
		);
	});

	test('resolvePackRelativePath rejects empty segments and backslash-normalized traversal', () => {
		const packDir = path.join(tmpRoot, 'pack');
		assert.throws(
			() => resolvePackRelativePath(packDir, 'onnx//model.onnx'),
			/Unsafe artifact relativePath/,
		);
		assert.throws(
			() => resolvePackRelativePath(packDir, '..\\escape'),
			/Unsafe artifact relativePath/,
		);
	});

	test('waitForWritableDrain resolves when stream emits drain', async () => {
		const stream = new Writable({
			write(_chunk, _encoding, callback) {
				callback();
			},
		});

		stream.write = (() => false) as typeof stream.write;

		const drainPromise = waitForWritableDrain(stream);
		setImmediate(() => {
			stream.emit('drain');
		});
		await drainPromise;
	});

	test('downloadUrlToFile streams chunks to disk with correct SHA', async () => {
		const payload = Buffer.from('chunk-one-chunk-two-chunk-three', 'utf8');
		const expectedDigest = createHash('sha256').update(payload).digest('hex');
		const destPath = path.join(tmpRoot, 'streamed.bin');

		const chunks = [payload.subarray(0, 6), payload.subarray(6, 16), payload.subarray(16)];
		const body = Readable.from(chunks);
		const progressEvents: { bytesReceived: number; bytesTotal?: number }[] = [];

		const fetchImpl = (async () => ({
			ok: true,
			status: 200,
			headers: {
				get: (name: string) => (name === 'content-length' ? String(payload.byteLength) : null),
			},
			body: Readable.toWeb(body),
		})) as unknown as typeof fetch;

		const result = await downloadUrlToFile('https://example.test/streamed.bin', destPath, {
			onProgress: progress => progressEvents.push(progress),
			now: () => 1,
			fetchImpl,
			maxAttempts: 1,
		});
		assert.strictEqual(result.digest, expectedDigest);
		assert.strictEqual(result.bytesWritten, payload.byteLength);
		const onDisk = await fs.readFile(destPath);
		assert.strictEqual(createHash('sha256').update(onDisk).digest('hex'), expectedDigest);
		assert.ok(progressEvents.length >= 2);
		assert.strictEqual(progressEvents.at(-1)?.bytesReceived, payload.byteLength);
	});

	test('downloadUrlToFile resumes from existing partial with Range request', async () => {
		const fullPayload = Buffer.from('first-part-second-part-third-part', 'utf8');
		const firstPart = fullPayload.subarray(0, 11);
		const secondPart = fullPayload.subarray(11);
		const expectedDigest = createHash('sha256').update(fullPayload).digest('hex');
		const destPath = path.join(tmpRoot, 'resumed.bin');
		const partialPath = `${destPath}.partial`;

		await fs.mkdir(path.dirname(destPath), { recursive: true });
		await fs.writeFile(partialPath, firstPart);

		let capturedRange: string | undefined;
		const fetchImpl = (async (
			_url: string | URL | Request,
			init?: RequestInit,
		) => {
			const headers = init?.headers as Record<string, string> | undefined;
			capturedRange = headers?.['Range'] ?? headers?.['range'];
			const body = Readable.from([secondPart]);
			return {
				ok: true,
				status: 206,
				headers: {
					get: (name: string) => {
						if (name === 'content-range') {
							return `bytes ${firstPart.byteLength}-${fullPayload.byteLength - 1}/${fullPayload.byteLength}`;
						}
						if (name === 'content-length') {
							return String(secondPart.byteLength);
						}
						return null;
					},
				},
				body: Readable.toWeb(body),
			};
		}) as unknown as typeof fetch;

		const result = await downloadUrlToFile('https://example.test/resumed.bin', destPath, {
			fetchImpl,
			now: () => 1,
			maxAttempts: 1,
		});

		assert.strictEqual(capturedRange, `bytes=${firstPart.byteLength}-`);
		assert.strictEqual(result.digest, expectedDigest);
		assert.strictEqual(result.bytesWritten, fullPayload.byteLength);
		const onDisk = await fs.readFile(destPath);
		assert.strictEqual(createHash('sha256').update(onDisk).digest('hex'), expectedDigest);
		await assert.rejects(() => fs.access(partialPath));
	});

	test('downloadUrlToFile aborts on idle stall and retains partial', async () => {
		const firstChunk = Buffer.from('partial-data-', 'utf8');
		const destPath = path.join(tmpRoot, 'stalled.bin');
		const partialPath = `${destPath}.partial`;

		let pushed = false;
		const body = new Readable({
			read() {
				if (!pushed) {
					pushed = true;
					this.push(firstChunk);
				}
			},
		});

		let fetchImplCalled = 0;
		const fetchImpl = (async () => {
			fetchImplCalled++;
			return {
				ok: true,
				status: 200,
				headers: { get: () => null },
				body: Readable.toWeb(body),
			};
		}) as unknown as typeof fetch;

		await assert.rejects(
			() =>
				downloadUrlToFile('https://example.test/stalled.bin', destPath, {
					fetchImpl,
					idleTimeoutMs: 50,
					maxAttempts: 1,
					now: () => 1,
				}),
			/stalled/,
		);

		const partialStat = await fs.stat(partialPath);
		assert.strictEqual(partialStat.size, firstChunk.byteLength);
		assert.strictEqual(fetchImplCalled, 1);
	});

	test('downloadUrlToFile retries after 416 clears partial and completes', async () => {
		const fullPayload = Buffer.from('full-payload-after-416-retry', 'utf8');
		const expectedDigest = createHash('sha256').update(fullPayload).digest('hex');
		const destPath = path.join(tmpRoot, '416-retry.bin');
		const partialPath = `${destPath}.partial`;

		await fs.mkdir(path.dirname(destPath), { recursive: true });
		await fs.writeFile(partialPath, Buffer.from('stale-partial'));

		let fetchCalls = 0;
		const fetchImpl = (async () => {
			fetchCalls++;
			if (fetchCalls === 1) {
				return {
					ok: false,
					status: 416,
					headers: { get: () => null },
					body: null,
				};
			}
			const body = Readable.from([fullPayload]);
			return {
				ok: true,
				status: 200,
				headers: {
					get: (name: string) =>
						name === 'content-length' ? String(fullPayload.byteLength) : null,
				},
				body: Readable.toWeb(body),
			};
		}) as unknown as typeof fetch;

		const result = await downloadUrlToFile('https://example.test/416-retry.bin', destPath, {
			fetchImpl,
			maxAttempts: 2,
			now: () => 1,
		});

		assert.strictEqual(fetchCalls, 2);
		assert.strictEqual(result.digest, expectedDigest);
		const onDisk = await fs.readFile(destPath);
		assert.strictEqual(createHash('sha256').update(onDisk).digest('hex'), expectedDigest);
		await assert.rejects(() => fs.access(partialPath));
	});

	test('downloadUrlToFile truncates partial when server returns 200 instead of 206', async () => {
		const fullPayload = Buffer.from('complete-file-body-from-scratch', 'utf8');
		const stalePartial = Buffer.from('stale-partia');
		const expectedDigest = createHash('sha256').update(fullPayload).digest('hex');
		const destPath = path.join(tmpRoot, 'truncate-200.bin');
		const partialPath = `${destPath}.partial`;

		await fs.mkdir(path.dirname(destPath), { recursive: true });
		await fs.writeFile(partialPath, stalePartial);

		const fetchImpl = (async () => {
			const body = Readable.from([fullPayload]);
			return {
				ok: true,
				status: 200,
				headers: {
					get: (name: string) =>
						name === 'content-length' ? String(fullPayload.byteLength) : null,
				},
				body: Readable.toWeb(body),
			};
		}) as unknown as typeof fetch;

		const result = await downloadUrlToFile('https://example.test/truncate-200.bin', destPath, {
			fetchImpl,
			maxAttempts: 1,
			now: () => 1,
		});

		assert.strictEqual(result.digest, expectedDigest);
		assert.strictEqual(result.bytesWritten, fullPayload.byteLength);
		const onDisk = await fs.readFile(destPath);
		assert.strictEqual(onDisk.byteLength, fullPayload.byteLength);
		assert.strictEqual(createHash('sha256').update(onDisk).digest('hex'), expectedDigest);
	});

	test('downloadUrlToFile resumes after stall on second attempt with Range', async () => {
		const fullPayload = Buffer.from('stall-then-resume-full-payload', 'utf8');
		const firstPart = fullPayload.subarray(0, 10);
		const secondPart = fullPayload.subarray(10);
		const expectedDigest = createHash('sha256').update(fullPayload).digest('hex');
		const destPath = path.join(tmpRoot, 'stall-resume.bin');
		const partialPath = `${destPath}.partial`;

		let fetchCalls = 0;
		const fetchImpl = (async (
			_url: string | URL | Request,
			init?: RequestInit,
		) => {
			fetchCalls++;
			if (fetchCalls === 1) {
				let pushed = false;
				const body = new Readable({
					read() {
						if (!pushed) {
							pushed = true;
							this.push(firstPart);
						}
					},
				});
				return {
					ok: true,
					status: 200,
					headers: { get: () => null },
					body: Readable.toWeb(body),
				};
			}

			const headers = init?.headers as Record<string, string> | undefined;
			const range = headers?.['Range'] ?? headers?.['range'];
			assert.strictEqual(range, `bytes=${firstPart.byteLength}-`);
			const body = Readable.from([secondPart]);
			return {
				ok: true,
				status: 206,
				headers: {
					get: (name: string) => {
						if (name === 'content-range') {
							return `bytes ${firstPart.byteLength}-${fullPayload.byteLength - 1}/${fullPayload.byteLength}`;
						}
						if (name === 'content-length') {
							return String(secondPart.byteLength);
						}
						return null;
					},
				},
				body: Readable.toWeb(body),
			};
		}) as unknown as typeof fetch;

		const result = await downloadUrlToFile('https://example.test/stall-resume.bin', destPath, {
			fetchImpl,
			idleTimeoutMs: 50,
			maxAttempts: 2,
			now: () => 1,
		});

		assert.strictEqual(fetchCalls, 2);
		assert.strictEqual(result.digest, expectedDigest);
		assert.strictEqual(result.bytesWritten, fullPayload.byteLength);
		const onDisk = await fs.readFile(destPath);
		assert.strictEqual(createHash('sha256').update(onDisk).digest('hex'), expectedDigest);
		await assert.rejects(() => fs.access(partialPath));
	});

	test('downloadWithConsent removes bad artifact file on SHA mismatch', async () => {
		const catalog = new ModelCatalog([testSpec({ sha256: '0'.repeat(64) })]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			downloadToFile: downloadToFileFromPayload(
				new Map([['https://example.test/unlimited-ocr.bin', PAYLOAD]]),
			),
		});
		const artifactPath = path.join(
			tmpRoot,
			'ml-models',
			'unlimited-ocr',
			'1.0.0-test',
			'model.safetensors',
		);
		const partialPath = `${artifactPath}.partial`;

		await assert.rejects(
			() =>
				store.downloadWithConsent({
					modelId: 'unlimited-ocr',
					userConsented: true,
				}),
			/SHA-256 mismatch/,
		);
		await assert.rejects(() => fs.access(artifactPath));
		await assert.rejects(() => fs.access(partialPath));
		assert.strictEqual(await store.isReady('unlimited-ocr'), false);
	});

	test('sha256HexFromFile matches in-memory digest', async () => {
		const payload = Buffer.from('stream-hash-from-disk', 'utf8');
		const filePath = path.join(tmpRoot, 'hash-me.bin');
		await fs.writeFile(filePath, payload);
		assert.strictEqual(await sha256HexFromFile(filePath), sha256Hex(payload));
	});

	test('multi-file downloadWithConsent verifies per-file SHA and marks ready', async () => {
		const onnxPayload = new Uint8Array(Buffer.from('fake-onnx-model-bytes', 'utf8'));
		const tokenizerPayload = new Uint8Array(Buffer.from('fake-tokenizer-json', 'utf8'));
		const configPayload = new Uint8Array(Buffer.from('fake-config-json', 'utf8'));
		const onnxSha = sha256Hex(onnxPayload);
		const tokenizerSha = sha256Hex(tokenizerPayload);
		const configSha = sha256Hex(configPayload);
		const packSha = packDigestSha256([
			{ relativePath: 'config.json', sha256: configSha },
			{ relativePath: 'onnx/model.onnx', sha256: onnxSha },
			{ relativePath: 'tokenizer.json', sha256: tokenizerSha },
		]);

		const spec: ModelSpec = {
			id: 'test-search-pack',
			version: '1.0.0-test',
			minVramMb: 0,
			minRamMb: 1024,
			diskMb: 1,
			backends: ['cpu-ort'],
			artifactFileName: 'pack',
			sha256: packSha,
			files: [
				{
					relativePath: 'onnx/model.onnx',
					downloadUrl: 'https://example.test/onnx/model.onnx',
					sha256: onnxSha,
				},
				{
					relativePath: 'tokenizer.json',
					downloadUrl: 'https://example.test/tokenizer.json',
					sha256: tokenizerSha,
				},
				{
					relativePath: 'config.json',
					downloadUrl: 'https://example.test/config.json',
					sha256: configSha,
				},
			],
		};

		const fetchedUrls: string[] = [];
		const payloads = new Map<string, Uint8Array>([
			['https://example.test/onnx/model.onnx', onnxPayload],
			['https://example.test/tokenizer.json', tokenizerPayload],
			['https://example.test/config.json', configPayload],
		]);
		const catalog = new ModelCatalog([spec]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			downloadToFile: async (url, destPath, options) => {
				fetchedUrls.push(url);
				return downloadToFileFromPayload(payloads)(url, destPath, options);
			},
		});

		const result = await store.downloadWithConsent({
			modelId: 'test-search-pack',
			userConsented: true,
		});

		assert.deepStrictEqual(
			{
				modelId: result.modelId,
				version: result.version,
				fetchedUrls: fetchedUrls.sort(),
			},
			{
				modelId: 'test-search-pack',
				version: '1.0.0-test',
				fetchedUrls: [
					'https://example.test/config.json',
					'https://example.test/onnx/model.onnx',
					'https://example.test/tokenizer.json',
				],
			},
		);
		assert.strictEqual(await store.isReady('test-search-pack'), true);

		const baseDir = path.join(tmpRoot, 'ml-models', 'test-search-pack', '1.0.0-test');
		const onnxOnDisk = await fs.readFile(path.join(baseDir, 'onnx', 'model.onnx'));
		assert.strictEqual(sha256Hex(onnxOnDisk), onnxSha);
		const manifestRaw = await fs.readFile(path.join(baseDir, 'manifest.json'), 'utf8');
		const manifest = JSON.parse(manifestRaw) as {
			fileName: string;
			sha256: string;
			files: { relativePath: string; sha256: string }[];
		};
		assert.strictEqual(manifest.fileName, 'pack');
		assert.strictEqual(manifest.sha256, packSha);
		assert.strictEqual(manifest.files.length, 3);
	});

	test('multi-file download skips files already on disk with matching hash', async () => {
		const smallPayload = new Uint8Array(Buffer.from('small-config', 'utf8'));
		const bigPayload = new Uint8Array(Buffer.from('big-weights-data-here', 'utf8'));
		const smallSha = sha256Hex(smallPayload);
		const bigSha = sha256Hex(bigPayload);
		const packSha = packDigestSha256([
			{ relativePath: 'config.json', sha256: smallSha },
			{ relativePath: 'model.safetensors', sha256: bigSha },
		]);
		const spec: ModelSpec = {
			id: 'test-resume-pack',
			version: '1.0.0-test',
			minVramMb: 0,
			minRamMb: 1024,
			diskMb: 7000,
			backends: ['cpu-ort'],
			sha256: packSha,
			files: [
				{
					relativePath: 'config.json',
					downloadUrl: 'https://example.test/config.json',
					sha256: smallSha,
				},
				{
					relativePath: 'model.safetensors',
					downloadUrl: 'https://example.test/model.safetensors',
					sha256: bigSha,
				},
			],
		};

		const baseDir = path.join(tmpRoot, 'ml-models', 'test-resume-pack', '1.0.0-test');
		const existingPath = path.join(baseDir, 'config.json');
		await fs.mkdir(path.dirname(existingPath), { recursive: true });
		await fs.writeFile(existingPath, smallPayload);

		const fetchedUrls: string[] = [];
		const catalog = new ModelCatalog([spec]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			downloadToFile: async (url, destPath, options) => {
				fetchedUrls.push(url);
				return downloadToFileFromPayload(
					new Map([['https://example.test/model.safetensors', bigPayload]]),
				)(url, destPath, options);
			},
		});

		await store.downloadWithConsent({
			modelId: 'test-resume-pack',
			userConsented: true,
		});

		assert.deepStrictEqual(fetchedUrls, ['https://example.test/model.safetensors']);
		assert.strictEqual(await store.isReady('test-resume-pack'), true);
	});

	test('multi-file downloadWithConsent reports progress after each file', async () => {
		const onnxPayload = new Uint8Array(Buffer.from('onnx', 'utf8'));
		const tokenizerPayload = new Uint8Array(Buffer.from('tokenizer', 'utf8'));
		const onnxSha = sha256Hex(onnxPayload);
		const tokenizerSha = sha256Hex(tokenizerPayload);
		const packSha = packDigestSha256([
			{ relativePath: 'model.onnx', sha256: onnxSha },
			{ relativePath: 'tokenizer.json', sha256: tokenizerSha },
		]);
		const spec: ModelSpec = {
			id: 'test-progress-pack',
			version: '1.0.0-test',
			minVramMb: 0,
			minRamMb: 1024,
			diskMb: 100,
			backends: ['cpu-ort'],
			artifactFileName: 'pack',
			sha256: packSha,
			files: [
				{
					relativePath: 'model.onnx',
					downloadUrl: 'https://example.test/model.onnx',
					sha256: onnxSha,
				},
				{
					relativePath: 'tokenizer.json',
					downloadUrl: 'https://example.test/tokenizer.json',
					sha256: tokenizerSha,
				},
			],
		};
		const progressEvents: import('../modelArtifactStore').ArtifactDownloadProgress[] = [];
		const catalog = new ModelCatalog([spec]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			downloadToFile: downloadToFileFromPayload(
				new Map([
					['https://example.test/model.onnx', onnxPayload],
					['https://example.test/tokenizer.json', tokenizerPayload],
				]),
			),
		});

		await store.downloadWithConsent({
			modelId: 'test-progress-pack',
			userConsented: true,
			onProgress: progress => progressEvents.push(progress),
		});

		const completedEvents = progressEvents.filter(
			event =>
				event.bytesReceived !== undefined &&
				event.bytesTotal !== undefined &&
				event.bytesReceived === event.bytesTotal &&
				event.fileIndex !== undefined &&
				event.completedFiles === event.fileIndex + 1,
		);
		assert.deepStrictEqual(completedEvents, [
			{
				completedFiles: 1,
				totalFiles: 2,
				relativePath: 'model.onnx',
				fileIndex: 0,
				bytesReceived: onnxPayload.byteLength,
				bytesTotal: onnxPayload.byteLength,
				packBytesReceived: onnxPayload.byteLength,
				packBytesTotal: 100 * 1024 * 1024,
			},
			{
				completedFiles: 2,
				totalFiles: 2,
				relativePath: 'tokenizer.json',
				fileIndex: 1,
				bytesReceived: tokenizerPayload.byteLength,
				bytesTotal: tokenizerPayload.byteLength,
				packBytesReceived: onnxPayload.byteLength + tokenizerPayload.byteLength,
				packBytesTotal: 100 * 1024 * 1024,
			},
		]);
		assert.ok(progressEvents.some(event => event.completedFiles === 0 && event.relativePath === 'model.onnx'));
	});

	test('multi-file download reports pack byte progress during large file', async () => {
		const bigPayload = new Uint8Array(Buffer.alloc(1000, 0xab));
		const bigSha = sha256Hex(bigPayload);
		const packSha = packDigestSha256([{ relativePath: 'model.safetensors', sha256: bigSha }]);
		const spec: ModelSpec = {
			id: 'test-pack-bytes',
			version: '1.0.0-test',
			minVramMb: 0,
			minRamMb: 1024,
			diskMb: 7000,
			backends: ['cpu-ort'],
			sha256: packSha,
			files: [
				{
					relativePath: 'model.safetensors',
					downloadUrl: 'https://example.test/model.safetensors',
					sha256: bigSha,
				},
			],
		};
		const packProgress: { packBytesReceived?: number; packBytesTotal?: number }[] = [];
		const catalog = new ModelCatalog([spec]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			downloadToFile: async (_url, destPath, options) => {
				options?.onProgress?.({ bytesReceived: 500, bytesTotal: 1000 });
				await fs.mkdir(path.dirname(destPath), { recursive: true });
				await fs.writeFile(destPath, bigPayload);
				options?.onProgress?.({ bytesReceived: 1000, bytesTotal: 1000 });
				return { digest: bigSha, bytesWritten: 1000 };
			},
		});

		await store.downloadWithConsent({
			modelId: 'test-pack-bytes',
			userConsented: true,
			onProgress: progress => {
				if (progress.packBytesReceived !== undefined) {
					packProgress.push({
						packBytesReceived: progress.packBytesReceived,
						packBytesTotal: progress.packBytesTotal,
					});
				}
			},
		});

		assert.ok(
			packProgress.some(
				event => event.packBytesReceived === 500 && event.packBytesTotal === 7000 * 1024 * 1024,
			),
		);
	});

	test('multi-file download rejects per-file SHA mismatch', async () => {
		const spec: ModelSpec = {
			id: 'test-pack-bad-sha',
			version: '1.0.0-test',
			minVramMb: 0,
			minRamMb: 1024,
			diskMb: 1,
			backends: ['cpu-ort'],
			sha256: packDigestSha256([
				{ relativePath: 'model.onnx', sha256: '0'.repeat(64) },
			]),
			files: [
				{
					relativePath: 'model.onnx',
					downloadUrl: 'https://example.test/model.onnx',
					sha256: '0'.repeat(64),
				},
			],
		};
		const catalog = new ModelCatalog([spec]);
		const store = new ModelArtifactStore({
			globalStorageFsPath: tmpRoot,
			catalog,
			downloadToFile: downloadToFileFromPayload(
				new Map([['https://example.test/model.onnx', PAYLOAD]]),
			),
		});
		await assert.rejects(
			() =>
				store.downloadWithConsent({
					modelId: 'test-pack-bad-sha',
					userConsented: true,
				}),
			/SHA-256 mismatch/,
		);
		assert.strictEqual(await store.isReady('test-pack-bad-sha'), false);
	});
});

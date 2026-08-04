/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import {
	downloadWhisperModelFile,
	existingWhisperModelPath,
	whisperModelDestination,
	WHISPER_MODEL_FILENAME,
	WHISPER_MODEL_URL,
} from '../whisperModelDownload';

suite('whisperModelDownload', () => {
	let tempDir: string;

	suiteSetup(async () => {
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sa-whisper-dl-'));
	});

	suiteTeardown(async () => {
		await fs.rm(tempDir, { recursive: true, force: true });
	});

	test('destination path is under globalStorage models/whisper', () => {
		assert.strictEqual(
			whisperModelDestination('/tmp/global-storage'),
			path.join('/tmp/global-storage', 'models', 'whisper', WHISPER_MODEL_FILENAME),
		);
		assert.ok(WHISPER_MODEL_URL.includes('ggml-base.en.bin'));
	});

	test('skips download when a large model file already exists', async () => {
		const dest = path.join(tempDir, 'models', 'whisper', WHISPER_MODEL_FILENAME);
		await fs.mkdir(path.dirname(dest), { recursive: true });
		// 100 MiB marker — meets MIN_EXISTING_BYTES without writing a full model.
		const handle = await fs.open(dest, 'w');
		try {
			await handle.truncate(100 * 1024 * 1024);
		} finally {
			await handle.close();
		}

		assert.strictEqual(await existingWhisperModelPath(dest), dest);

		let fetchCalls = 0;
		const result = await downloadWhisperModelFile({
			destinationPath: dest,
			fetchImpl: async () => {
				fetchCalls += 1;
				throw new Error('fetch should not be called');
			},
		});
		assert.deepStrictEqual({ result, fetchCalls }, { result: dest, fetchCalls: 0 });
	});

	test('streams mock response to destination atomically', async () => {
		const dest = path.join(tempDir, 'download-fresh', WHISPER_MODEL_FILENAME);
		const payload = Buffer.alloc(128, 0xab);
		const progress: Array<{ downloaded: number; total: number | undefined }> = [];

		const result = await downloadWhisperModelFile({
			destinationPath: dest,
			fetchImpl: async () => {
				return new Response(payload, {
					status: 200,
					headers: { 'content-length': String(payload.byteLength) },
				});
			},
			onProgress: (downloadedBytes, totalBytes) => {
				progress.push({ downloaded: downloadedBytes, total: totalBytes });
			},
		});

		const written = await fs.readFile(result);
		assert.deepStrictEqual({
			path: result,
			bytes: written.equals(payload),
			progressEndsAt: progress.at(-1),
		}, {
			path: dest,
			bytes: true,
			progressEndsAt: { downloaded: payload.byteLength, total: payload.byteLength },
		});
	});
});

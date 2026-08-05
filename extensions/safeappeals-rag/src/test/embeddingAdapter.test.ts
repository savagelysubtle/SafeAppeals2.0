/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import { EmbeddingAdapter } from '../embeddingAdapter';
import { SA_RAG_EMBED_MODEL_DIR } from '../modelEnvSync';

suite('EmbeddingAdapter', () => {
	test('load syncs env and marks ready when artifact dir exists', async () => {
		const env: NodeJS.ProcessEnv = {};
		const adapter = new EmbeddingAdapter({
			getArtifactDir: async modelId =>
				modelId === 'bge-small-en-v1.5' ? '/tmp/fake-bge' : undefined,
			ensureRagCoreReady: async () => { /* ok */ },
		});
		// Bypass existsSync via process.env already pointing at a "dir" through sync helper:
		// inject by pre-setting env that directoryExists accepts via real exists — use stub by
		// calling sync through adapter with a real temp-less path: override via env pre-set.
		env[SA_RAG_EMBED_MODEL_DIR] = '/tmp';
		const prev = process.env[SA_RAG_EMBED_MODEL_DIR];
		process.env[SA_RAG_EMBED_MODEL_DIR] = '/tmp';
		try {
			await adapter.load(new AbortController().signal);
			assert.strictEqual(adapter.isLoaded(), true);
			assert.strictEqual(adapter.lastSyncResult?.embedReady, true);
			await adapter.unload();
			assert.strictEqual(adapter.isLoaded(), false);
		} finally {
			if (prev === undefined) {
				delete process.env[SA_RAG_EMBED_MODEL_DIR];
			} else {
				process.env[SA_RAG_EMBED_MODEL_DIR] = prev;
			}
		}
	});

	test('load fails when embed dir unavailable', async () => {
		const prev = process.env[SA_RAG_EMBED_MODEL_DIR];
		delete process.env[SA_RAG_EMBED_MODEL_DIR];
		const adapter = new EmbeddingAdapter({
			getArtifactDir: async () => undefined,
		});
		try {
			await assert.rejects(
				adapter.load(new AbortController().signal),
				/Embedding backend is not ready/,
			);
			assert.strictEqual(adapter.isLoaded(), false);
		} finally {
			if (prev !== undefined) {
				process.env[SA_RAG_EMBED_MODEL_DIR] = prev;
			}
		}
	});
});

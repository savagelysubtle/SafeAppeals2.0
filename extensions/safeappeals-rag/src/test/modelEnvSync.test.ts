/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import {
	SA_RAG_CE_MODEL_DIR,
	SA_RAG_EMBED_MODEL_DIR,
	syncRagModelEnv,
} from '../modelEnvSync';
import { BGE_SMALL_MODEL_ID, MS_MARCO_CE_MODEL_ID } from '../types';

suite('modelEnvSync', () => {
	test('sets embed/CE env from artifact dirs when ready', async () => {
		const env: NodeJS.ProcessEnv = {};
		const result = await syncRagModelEnv({
			env,
			directoryExists: () => true,
			getArtifactDir: async (modelId) => {
				if (modelId === BGE_SMALL_MODEL_ID) {
					return '/ml/bge';
				}
				if (modelId === MS_MARCO_CE_MODEL_ID) {
					return '/ml/ce';
				}
				return undefined;
			},
		});
		assert.deepStrictEqual(result, {
			embedDir: '/ml/bge',
			ceDir: '/ml/ce',
			synced: true,
			embedReady: true,
		});
		assert.strictEqual(env[SA_RAG_EMBED_MODEL_DIR], '/ml/bge');
		assert.strictEqual(env[SA_RAG_CE_MODEL_DIR], '/ml/ce');
	});

	test('preserves existing BYO embed dir', async () => {
		const env: NodeJS.ProcessEnv = {
			[SA_RAG_EMBED_MODEL_DIR]: '/byo/embed',
		};
		const result = await syncRagModelEnv({
			env,
			directoryExists: dir => dir === '/byo/embed',
			getArtifactDir: async () => '/ml/bge',
		});
		assert.strictEqual(result.embedDir, '/byo/embed');
		assert.strictEqual(env[SA_RAG_EMBED_MODEL_DIR], '/byo/embed');
		assert.strictEqual(result.synced, false);
	});

	test('does not claim embedReady when artifacts missing', async () => {
		const env: NodeJS.ProcessEnv = {};
		const result = await syncRagModelEnv({
			env,
			directoryExists: () => false,
			getArtifactDir: async () => undefined,
		});
		assert.deepStrictEqual(
			{ embedReady: result.embedReady, embedDir: result.embedDir, synced: result.synced },
			{ embedReady: false, embedDir: undefined, synced: false },
		);
	});
});

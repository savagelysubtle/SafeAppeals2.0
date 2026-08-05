/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const path = require('path');
const { loadRagCore, expectedNativeBindingPath } = require('../nativeLoader');

const packageRoot = path.join(__dirname, '..');
const result = loadRagCore(packageRoot);

if (!result.ok) {
	console.error('[rag-core] smoke failed (soft):', result.error);
	console.error('[rag-core] expected path:', result.expectedPath || expectedNativeBindingPath(packageRoot));
	process.exit(2);
}

const pong = result.native.ping();
const ver = result.native.version();
const caps = result.native.capabilities();

/**
 * M5 expected capabilities (SQLCipher + hybrid RRF + QP + CE capability field).
 * `rerank` stays false in smoke without SA_RAG_CE_MODEL_DIR / Search pack — assert
 * the field exists (boolean) rather than requiring a CE model download in CI.
 */
const expectedCaps = {
	hybrid: true,
	rerank: false,
	queryProcessor: true,
	modelsPresent: false,
	storageReady: true,
	dims: 512,
};

if (pong !== 'pong') {
	console.error('[rag-core] unexpected ping:', pong);
	process.exit(1);
}
if (typeof ver !== 'string' || ver.length === 0) {
	console.error('[rag-core] unexpected version:', ver);
	process.exit(1);
}
if (JSON.stringify(caps) !== JSON.stringify(expectedCaps)) {
	console.error('[rag-core] unexpected capabilities:', caps);
	console.error('[rag-core] expected:', expectedCaps);
	process.exit(1);
}

const requiredFns = [
	'openWorkspace',
	'closeWorkspace',
	'stats',
	'chunkDocument',
	'embedBatch',
	'indexChunks',
	'removeDoc',
	'search',
];
for (const name of requiredFns) {
	if (typeof result.native[name] !== 'function') {
		console.error(`[rag-core] missing export: ${name}`);
		process.exit(1);
	}
}

const st = result.native.stats();
if (typeof st.textDocs !== 'number') {
	console.error('[rag-core] stats() missing textDocs:', st);
	process.exit(1);
}

console.log('[rag-core] smoke ok', {
	bindingPath: result.bindingPath,
	version: ver,
	capabilities: caps,
	stats: st,
});

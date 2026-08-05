/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Unit-style checks for dual-ABI path resolution (no native .node required).
 */

'use strict';

const assert = require('assert');
const path = require('path');
const {
	ADDON_FILENAME,
	expectedNativeBindingPath,
	resolveNativeBindingPath,
	loadRagCore,
} = require('../nativeLoader');

const packageRoot = path.join(__dirname, '..');
const abi = process.versions.modules;
const runtime = process.versions.electron ? 'electron' : 'node';

const expected = expectedNativeBindingPath(packageRoot);
assert.strictEqual(ADDON_FILENAME, 'rag_core.node');
assert.ok(
	expected.endsWith(
		path.join('prebuilds', `${process.platform}-${process.arch}`, `${runtime}-${abi}`, 'rag_core.node'),
	),
	`unexpected expected path: ${expected}`,
);

// Without a committed prebuild, resolve/load must fail soft.
const resolved = resolveNativeBindingPath(packageRoot);
const loaded = loadRagCore(packageRoot);
if (resolved) {
	assert.strictEqual(loaded.ok, true, 'if prebuild exists, load should succeed');
	assert.strictEqual(typeof loaded.native.ping(), 'string');
} else {
	assert.strictEqual(loaded.ok, false);
	assert.ok(typeof loaded.error === 'string' && loaded.error.includes('rag-core native addon'));
	assert.strictEqual(loaded.expectedPath, expected);
}

console.log('[rag-core] loader tests ok', {
	expected,
	prebuildPresent: Boolean(resolved),
	loadOk: loaded.ok,
});

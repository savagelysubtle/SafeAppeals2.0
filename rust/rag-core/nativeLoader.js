/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const fs = require('fs');
const path = require('path');

/** @type {string} */
const ADDON_FILENAME = 'rag_core.node';

/**
 * @returns {{ runtime: string, abi: string }}
 */
function resolveRuntimeAbi() {
	const abi = process.versions.modules;
	const runtime = process.versions.electron ? 'electron' : 'node';
	return { runtime, abi };
}

/**
 * @param {string} packageRoot
 * @returns {string}
 */
function expectedNativeBindingPath(packageRoot) {
	const { runtime, abi } = resolveRuntimeAbi();
	return path.join(
		packageRoot,
		'prebuilds',
		`${process.platform}-${process.arch}`,
		`${runtime}-${abi}`,
		ADDON_FILENAME,
	);
}

/**
 * @param {string} packageRoot
 * @returns {string | undefined}
 */
function resolveNativeBindingPath(packageRoot) {
	const candidate = expectedNativeBindingPath(packageRoot);
	return fs.existsSync(candidate) ? candidate : undefined;
}

/**
 * @param {string} [packageRoot]
 * @returns {{ ok: true, native: object, bindingPath: string } | { ok: false, error: string, expectedPath: string }}
 */
function loadRagCore(packageRoot = __dirname) {
	const expectedPath = expectedNativeBindingPath(packageRoot);
	const bindingPath = resolveNativeBindingPath(packageRoot);
	if (!bindingPath) {
		const { runtime, abi } = resolveRuntimeAbi();
		return {
			ok: false,
			error:
				`rag-core native addon not found for ${runtime}-${abi} ` +
				`(${process.platform}-${process.arch}). Expected: ${expectedPath}. ` +
				`Private search is unavailable until the matching dual-ABI prebuild is installed.`,
			expectedPath,
		};
	}

	try {
		const native = require(bindingPath);
		if (
			typeof native.ping !== 'function' ||
			typeof native.version !== 'function' ||
			typeof native.capabilities !== 'function'
		) {
			return {
				ok: false,
				error: `rag-core binding at ${bindingPath} is missing required exports (ping/version/capabilities).`,
				expectedPath,
			};
		}
		return { ok: true, native, bindingPath };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			error: `Failed to load rag-core native addon at ${bindingPath}: ${message}`,
			expectedPath,
		};
	}
}

module.exports = {
	ADDON_FILENAME,
	expectedNativeBindingPath,
	resolveNativeBindingPath,
	loadRagCore,
};

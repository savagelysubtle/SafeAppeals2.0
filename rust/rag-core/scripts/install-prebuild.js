/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Copy the napi-rs build output into the dual-ABI prebuilds layout for the
 * current process runtime + ABI.
 *
 * Usage (from rust/rag-core):
 *   bun run build && bun run install-prebuild
 *
 * Layout:
 *   prebuilds/<platform>-<arch>/<runtime>-<abi>/rag_core.node
 */

'use strict';

const fs = require('fs');
const path = require('path');

const packageRoot = path.join(__dirname, '..');
const addonName = 'rag_core.node';
const platformArch = `${process.platform}-${process.arch}`;
const abi = process.versions.modules;
const runtime = process.versions.electron ? 'electron' : 'node';
const runtimeAbi = `${runtime}-${abi}`;

/** @returns {string[]} */
function findBuiltAddons() {
	const names = fs.readdirSync(packageRoot);
	const platformNamed = names
		.filter(n => n.startsWith('rag_core.') && n.endsWith('.node'))
		.map(n => path.join(packageRoot, n));
	const candidates = [
		path.join(packageRoot, addonName),
		...platformNamed,
		path.join(packageRoot, platformArch, addonName),
		path.join(packageRoot, 'napi-artifacts', platformArch, addonName),
	];
	return candidates.filter(p => fs.existsSync(p));
}

const found = findBuiltAddons();
if (found.length === 0) {
	console.error(
		`[rag-core] No built rag_core*.node found. Run \`bun run build\` first.\n` +
			`Expected e.g. rag_core.linux-x64-gnu.node in ${packageRoot}`,
	);
	process.exit(1);
}

const source = found[0];
const destDir = path.join(packageRoot, 'prebuilds', platformArch, runtimeAbi);
const dest = path.join(destDir, addonName);
fs.mkdirSync(destDir, { recursive: true });
fs.copyFileSync(source, dest);
console.log(`[rag-core] Installed prebuild: ${dest}`);
console.log(`[rag-core] Source: ${source}`);

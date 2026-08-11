/*--------------------------------------------------------------------------------------
 *  Rebuild better-sqlite3-multiple-ciphers prebuilds for the current platform.
 *  Usage: bun run rebuild-prebuilds   (from extensions/safeappeals-time-tracker)
 *  On Windows, run this on a Windows host with MSVC to produce win32-x64 binaries.
 *--------------------------------------------------------------------------------------*/

'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const extensionRoot = path.resolve(__dirname, '..');
const packageDir = path.join(extensionRoot, 'node_modules', 'better-sqlite3-multiple-ciphers');
const releaseNode = path.join(packageDir, 'build', 'Release', 'better_sqlite3.node');
const platformArch = `${process.platform}-${process.arch}`;
const prebuildsRoot = path.join(extensionRoot, 'prebuilds', platformArch);

function run(cmd, args, opts = {}) {
	console.log(`> ${cmd} ${args.join(' ')}`);
	const result = spawnSync(cmd, args, {
		cwd: opts.cwd || packageDir,
		stdio: 'inherit',
		env: { ...process.env, ...(opts.env || {}) },
		shell: process.platform === 'win32',
	});
	if (result.status !== 0) {
		throw new Error(`${cmd} exited with status ${result.status}`);
	}
}

function copyBinding(runtimeAbi) {
	const destDir = path.join(prebuildsRoot, runtimeAbi);
	fs.mkdirSync(destDir, { recursive: true });
	const dest = path.join(destDir, 'better_sqlite3.node');
	fs.copyFileSync(releaseNode, dest);
	console.log(`Copied ${releaseNode} → ${dest}`);
}

function main() {
	if (!fs.existsSync(packageDir)) {
		throw new Error(`Missing ${packageDir}. Run npm install in extensions/safeappeals-time-tracker first.`);
	}

	const npmrc = path.join(extensionRoot, '.npmrc');
	const npmrcText = fs.readFileSync(npmrc, 'utf8');
	const targetMatch = npmrcText.match(/^\s*target\s*=\s*"?([^"\n]+)"?/m);
	const electronTarget = targetMatch ? targetMatch[1] : '42.6.0';

	console.log(`Building Electron ABI prebuild (target=${electronTarget}) for ${platformArch}…`);
	run(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
		'node-gyp', 'rebuild', '--release',
		`--target=${electronTarget}`,
		'--dist-url=https://electronjs.org/headers',
		'--runtime=electron',
	]);
	if (!fs.existsSync(releaseNode)) {
		throw new Error(`Expected native addon missing after Electron rebuild: ${releaseNode}`);
	}
	// Electron 42.x → NODE_MODULE_VERSION 146 (keep in sync with product Electron major).
	copyBinding('electron-146');

	// Extension .npmrc pins Electron headers (target/runtime/disturl). Those bleed into
	// bare `node-gyp rebuild` via npm_config_* and produce another electron-146 binary
	// labeled node-<modules>. Override explicitly for the host-Node ABI pass.
	const hostNodeVersion = process.versions.node; // e.g. 24.18.0
	console.log(`Building Node ABI prebuild (host Node ${process.version}, modules=${process.versions.modules}) for ${platformArch}…`);
	run(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
		'node-gyp', 'rebuild', '--release',
		`--target=${hostNodeVersion}`,
		'--dist-url=https://nodejs.org/dist',
		'--runtime=node',
	], {
		env: {
			npm_config_target: hostNodeVersion,
			npm_config_runtime: 'node',
			npm_config_disturl: 'https://nodejs.org/dist',
			npm_config_dist_url: 'https://nodejs.org/dist',
			npm_config_build_from_source: 'true',
		},
	});
	if (!fs.existsSync(releaseNode)) {
		throw new Error(`Expected native addon missing after Node rebuild: ${releaseNode}`);
	}
	if (process.versions.modules !== '137') {
		console.warn(`WARNING: host NODE_MODULE_VERSION is ${process.versions.modules}, expected 137 (Node 24.x). Folder will be node-${process.versions.modules}.`);
	}
	copyBinding(`node-${process.versions.modules}`);

	console.log('Done. Verify with PREBUILDS.md smoke checks before committing.');
}

main();

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

'use strict';

const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const extensionRoot = path.resolve(__dirname, '..');
if (process.platform !== 'linux' || process.arch !== 'x64') {
	throw new Error(`SA_FS_UNSUPPORTED: secure filesystem prebuilds are not implemented for ${process.platform}-${process.arch}`);
}

const crateRoot = path.join(extensionRoot, 'native', 'secure-fs');
const result = spawnSync('cargo', ['build', '--release', '--manifest-path', path.join(crateRoot, 'Cargo.toml')], {
	cwd: extensionRoot,
	stdio: 'inherit',
});
if (result.status !== 0) {
	throw new Error(`cargo build exited with status ${result.status}`);
}

const source = path.join(crateRoot, 'target', 'release', 'libsafeappeals_secure_fs.so');
for (const runtime of ['node-137', 'electron-146']) {
	const destination = path.join(extensionRoot, 'prebuilds', 'linux-x64', runtime, 'safeappeals_secure_fs.node');
	fs.mkdirSync(path.dirname(destination), { recursive: true });
	fs.copyFileSync(source, destination);
	console.log(`Wrote ${destination}`);
}

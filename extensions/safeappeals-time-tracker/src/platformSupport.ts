/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Platforms where durable encrypted Time Tracker storage is supported.
 * Linux uses secure-fs for migration/purge; Windows uses SQLCipher + atomic
 * encrypted files once better-sqlite3-multiple-ciphers prebuilds exist.
 */
export function supportsDurableTimeTrackerStorage(): boolean {
	return process.arch === 'x64' && (process.platform === 'linux' || process.platform === 'win32');
}

export function secureFsPrebuildPath(extensionRoot: string = path.join(__dirname, '..')): string | undefined {
	const abi = process.versions.modules;
	const root = path.join(extensionRoot, 'prebuilds', `${process.platform}-${process.arch}`);
	for (const runtimeAbi of [`electron-${abi}`, `node-${abi}`]) {
		const candidate = path.join(root, runtimeAbi, 'safeappeals_secure_fs.node');
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}
	return undefined;
}

export function hasSecureFsPrebuild(extensionRoot?: string): boolean {
	return Boolean(secureFsPrebuildPath(extensionRoot));
}

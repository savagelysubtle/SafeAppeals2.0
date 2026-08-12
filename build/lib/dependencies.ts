/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import fs from 'fs';
import path from 'path';
import cp from 'child_process';
const root = fs.realpathSync(path.dirname(path.dirname(import.meta.dirname)));

function getNpmProductionDependencies(folder: string): string[] {
	let raw: string;

	try {
		raw = cp.execSync('npm ls --all --omit=dev --parseable', { cwd: folder, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' }, stdio: [null, null, null] });
	} catch (err) {
		const regex = /^npm ERR! .*$/gm;
		let match: RegExpExecArray | null;

		while (match = regex.exec(err.message)) {
			if (/ELSPROBLEMS/.test(match[0])) {
				continue;
			} else if (/invalid: xterm/.test(match[0])) {
				continue;
			} else if (/A complete log of this run/.test(match[0])) {
				continue;
			} else {
				throw err;
			}
		}

		raw = err.stdout;
	}

	const realFolder = fs.realpathSync(folder);
	return raw.split(/\r?\n/).filter(line => {
		const trimmed = line.trim();
		if (!trimmed) {
			return false;
		}
		// npm ls always emits the folder itself as the first parseable line.
		// Including it makes packageTask glob `/**` (entire monorepo) and
		// Buffer.concat the tree into node_modules.asar — blows the 2GiB
		// write limit (seen as ERR_OUT_OF_RANGE length ≈ 13e9).
		let realLine: string;
		try {
			realLine = fs.realpathSync(trimmed);
		} catch {
			return false;
		}
		if (realLine === realFolder) {
			return false;
		}
		const rel = path.relative(realFolder, realLine);
		if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
			return false;
		}
		return true;
	});
}

export function getProductionDependencies(folderPath: string): string[] {
	const result = getNpmProductionDependencies(folderPath);
	// Account for distro npm dependencies
	const realFolderPath = fs.realpathSync(folderPath);
	const relativeFolderPath = path.relative(root, realFolderPath);
	const distroFolderPath = `${root}/.build/distro/npm/${relativeFolderPath}`;

	if (fs.existsSync(distroFolderPath)) {
		result.push(...getNpmProductionDependencies(distroFolderPath));
	}

	return [...new Set(result)];
}

if (import.meta.main) {
	console.log(JSON.stringify(getProductionDependencies(root), null, '  '));
}

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

	// Prefer realpath so npm ls and our filters share one path identity.
	// This tree is reachable as both /mnt/Dev/... and a UUID mount; mixed
	// identities made every dep look outside the folder (0 packages) or kept
	// the repo root (globbed /** into node_modules.asar → 13GB write crash).
	const realFolder = fs.realpathSync(folder);

	try {
		raw = cp.execSync('npm ls --all --omit=dev --parseable', { cwd: realFolder, encoding: 'utf8', env: { ...process.env, NODE_ENV: 'production' }, stdio: [null, null, null] });
	} catch (err) {
		// npm ls exits non-zero for ELSPROBLEMS / invalid peer versions but still
		// prints a usable parseable tree on stdout. Prefer that over failing the
		// whole package. Only rethrow when stdout is empty (real hard failure).
		const stdout = typeof err?.stdout === 'string' ? err.stdout : '';
		if (!stdout.trim()) {
			throw err;
		}
		raw = stdout;
	}

	return raw.split(/\r?\n/).flatMap(line => {
		const trimmed = line.trim();
		if (!trimmed) {
			return [];
		}
		// npm ls always emits the folder itself as the first parseable line.
		// Including it makes packageTask glob `/**` (entire monorepo) and
		// Buffer.concat the tree into node_modules.asar — blows the 2GiB
		// write limit (seen as ERR_OUT_OF_RANGE length ≈ 13e9).
		const realLine = resolveNpmParseablePath(trimmed, realFolder);
		if (!realLine || realLine === realFolder) {
			return [];
		}
		const rel = path.relative(realFolder, realLine);
		if (!rel || rel.startsWith('..') || path.isAbsolute(rel)) {
			return [];
		}
		return [realLine];
	});
}

/**
 * Map an `npm ls --parseable` path onto a real filesystem path under `realFolder`.
 * Some environments redact UUID mount segments in child stdout (`/mnt/<uuid>` →
 * `/mnt/***`), which breaks realpath; recover via the `node_modules/...` suffix.
 */
function resolveNpmParseablePath(trimmed: string, realFolder: string): string | undefined {
	try {
		if (fs.existsSync(trimmed)) {
			return fs.realpathSync(trimmed);
		}
	} catch {
		// fall through
	}

	const marker = `${path.sep}node_modules${path.sep}`;
	const idx = trimmed.indexOf(marker);
	if (idx !== -1) {
		const candidate = path.join(realFolder, trimmed.slice(idx + 1));
		try {
			if (fs.existsSync(candidate)) {
				return fs.realpathSync(candidate);
			}
		} catch {
			return undefined;
		}
	}

	// Project root line (no node_modules) — caller filters equality to realFolder.
	if (!trimmed.includes(`${path.sep}node_modules`)) {
		return realFolder;
	}
	return undefined;
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

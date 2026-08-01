/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';

/**
 * Returns true when `candidateFsPath` is inside any of `workspaceRootFsPaths`
 * (or equal to a root). Normalizes with `path.resolve`. Does not resolve symlinks.
 */
export function isPathInsideWorkspaceRoot(
	candidateFsPath: string,
	workspaceRootFsPaths: readonly string[],
): boolean {
	if (!candidateFsPath || workspaceRootFsPaths.length === 0) {
		return false;
	}
	const resolvedCandidate = path.resolve(candidateFsPath);
	for (const root of workspaceRootFsPaths) {
		const resolvedRoot = path.resolve(root);
		if (resolvedCandidate === resolvedRoot) {
			return true;
		}
		const prefix = resolvedRoot.endsWith(path.sep)
			? resolvedRoot
			: resolvedRoot + path.sep;
		if (resolvedCandidate.startsWith(prefix)) {
			return true;
		}
	}
	return false;
}

/**
 * Resolves a user/model path against workspace roots (fsPath strings).
 * Returns undefined when outside all roots or no roots are provided.
 */
export function resolveRelativeToRoot(
	pathValue: string,
	workspaceRootFsPaths: readonly string[],
): string | undefined {
	if (!pathValue || typeof pathValue !== 'string') {
		return undefined;
	}
	const trimmed = pathValue.trim();
	if (!trimmed || workspaceRootFsPaths.length === 0) {
		return undefined;
	}

	let candidate: string;
	if (trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)) {
		candidate = path.resolve(trimmed);
	} else {
		candidate = path.resolve(workspaceRootFsPaths[0], trimmed);
	}

	if (!isPathInsideWorkspaceRoot(candidate, workspaceRootFsPaths)) {
		return undefined;
	}
	return candidate;
}

/**
 * Posix-normalize a URI path segment list; reject escapes above the root.
 */
export function normalizeUriPath(uriPath: string): string | undefined {
	const normalizedPath = path.posix.normalize(uriPath);
	if (normalizedPath === '..' || normalizedPath.startsWith('../')) {
		return undefined;
	}
	return normalizedPath;
}

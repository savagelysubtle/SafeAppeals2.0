/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

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
 * Posix-normalize a URI path segment list; reject escapes above the root.
 */
export function normalizeUriPath(uriPath: string): string | undefined {
	const normalizedPath = path.posix.normalize(uriPath);
	if (normalizedPath === '..' || normalizedPath.startsWith('../')) {
		return undefined;
	}
	return normalizedPath;
}

function normalizeResolvedUri(uri: vscode.Uri): vscode.Uri | undefined {
	try {
		if (uri.scheme === 'file') {
			return vscode.Uri.file(path.resolve(uri.fsPath));
		}
		const normalizedPath = normalizeUriPath(uri.path);
		if (!normalizedPath) {
			return undefined;
		}
		return uri.with({ path: normalizedPath });
	} catch {
		return undefined;
	}
}

/**
 * Resolves a user/model path against workspace folders.
 * Fail closed: no open folder ⇒ undefined. Paths must stay inside a workspace root.
 * Local mirror of documents `resolveWorkspaceRelativePath` (no cross-extension import).
 */
export function resolveWorkspaceRelativePath(
	pathValue: string,
	workspaceFolders: readonly vscode.WorkspaceFolder[],
): vscode.Uri | undefined {
	if (!pathValue || typeof pathValue !== 'string') {
		return undefined;
	}
	const trimmed = pathValue.trim();
	if (!trimmed || workspaceFolders.length === 0) {
		return undefined;
	}

	let candidate: vscode.Uri;
	try {
		if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
			candidate = vscode.Uri.parse(trimmed);
		} else if (trimmed.startsWith('/') || /^[A-Za-z]:[\\/]/.test(trimmed)) {
			candidate = vscode.Uri.file(trimmed);
		} else {
			candidate = vscode.Uri.joinPath(workspaceFolders[0].uri, trimmed);
		}
	} catch {
		return undefined;
	}

	const normalized = normalizeResolvedUri(candidate);
	if (!normalized) {
		return undefined;
	}

	for (const folder of workspaceFolders) {
		if (normalized.scheme !== folder.uri.scheme) {
			continue;
		}
		if (normalized.scheme === 'file') {
			if (isPathInsideWorkspaceRoot(normalized.fsPath, [folder.uri.fsPath])) {
				return normalized;
			}
		} else {
			const folderPath = folder.uri.path.endsWith('/')
				? folder.uri.path
				: folder.uri.path + '/';
			if (normalized.path === folder.uri.path || normalized.path.startsWith(folderPath)) {
				return normalized;
			}
		}
	}
	return undefined;
}

/**
 * Resolve a workspace path, then `fs.realpath` and re-check containment so
 * symlink escapes outside the workspace are rejected before file reads.
 */
export async function resolveWorkspaceFilePath(
	pathValue: string,
	workspaceFolders: readonly vscode.WorkspaceFolder[],
): Promise<vscode.Uri | undefined> {
	const uri = resolveWorkspaceRelativePath(pathValue, workspaceFolders);
	if (!uri || uri.scheme !== 'file') {
		return undefined;
	}

	let realPath: string;
	try {
		realPath = await fs.realpath(uri.fsPath);
	} catch {
		return undefined;
	}

	const realRoots: string[] = [];
	for (const folder of workspaceFolders) {
		if (folder.uri.scheme !== 'file') {
			continue;
		}
		try {
			realRoots.push(await fs.realpath(folder.uri.fsPath));
		} catch {
			realRoots.push(path.resolve(folder.uri.fsPath));
		}
	}
	if (!isPathInsideWorkspaceRoot(realPath, realRoots)) {
		return undefined;
	}
	return vscode.Uri.file(realPath);
}

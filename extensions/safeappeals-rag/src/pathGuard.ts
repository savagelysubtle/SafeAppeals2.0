/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'node:path';
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

/** Collect absolute fs paths for all file-scheme workspace folder roots. */
export function getWorkspaceRootPaths(
	workspaceFolders: readonly vscode.WorkspaceFolder[] | undefined,
): string[] {
	if (!workspaceFolders?.length) {
		return [];
	}
	return workspaceFolders
		.filter(f => f.uri.scheme === 'file')
		.map(f => path.resolve(f.uri.fsPath));
}

/**
 * Convert a `file:` URI or absolute fs path to a platform path.
 * Uses WHATWG URL so unit tests do not depend on a full vscode.Uri implementation.
 */
export function sourceUriToFsPath(sourceUri: string): string {
	if (sourceUri.startsWith('file:')) {
		const url = new URL(sourceUri);
		if (url.protocol !== 'file:') {
			throw new Error(`Unsupported source URI: ${sourceUri}`);
		}
		let pathname = decodeURIComponent(url.pathname);
		// Windows file URLs: `/C:/Users/...` → `C:/Users/...`
		if (/^\/[A-Za-z]:\//.test(pathname)) {
			pathname = pathname.slice(1);
		}
		return pathname;
	}
	if (sourceUri.startsWith('/') || /^[A-Za-z]:[\\/]/.test(sourceUri)) {
		return sourceUri;
	}
	throw new Error(`Unsupported source URI: ${sourceUri}`);
}

/**
 * Fail-closed: `sourceUri` must resolve to a file path inside a workspace root.
 * Non-file schemes and missing workspace → rejected.
 */
export function assertSourceUriInWorkspace(
	sourceUri: string,
	workspaceRootFsPaths: readonly string[],
): string {
	if (!sourceUri || workspaceRootFsPaths.length === 0) {
		throw new Error('Path is outside the workspace or no workspace folder is open.');
	}

	let fsPath: string;
	try {
		fsPath = sourceUriToFsPath(sourceUri);
	} catch (err) {
		throw new Error(
			err instanceof Error ? err.message : `Invalid source URI: ${sourceUri}`,
		);
	}

	const resolved = path.resolve(fsPath);
	if (!isPathInsideWorkspaceRoot(resolved, workspaceRootFsPaths)) {
		throw new Error(`Path is outside the workspace: ${sourceUri}`);
	}
	return resolved;
}

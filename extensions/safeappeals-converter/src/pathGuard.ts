/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'node:fs/promises';
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

function pathHasParentDirEscape(resolvedPath: string): boolean {
	return path.normalize(resolvedPath).split(path.sep).includes('..');
}

async function pathExists(candidate: string): Promise<boolean> {
	try {
		await fs.access(candidate);
		return true;
	} catch {
		return false;
	}
}

/**
 * Canonicalize a path mirroring rust/converter sandbox.rs:
 * existing paths via realpath; non-existent Save-As targets via nearest existing
 * ancestor plus filename suffix.
 */
export async function canonicalizePathForSandbox(resolvedPath: string): Promise<string> {
	if (pathHasParentDirEscape(resolvedPath)) {
		throw new Error(`Path escape detected: ${resolvedPath}`);
	}

	if (await pathExists(resolvedPath)) {
		return fs.realpath(resolvedPath);
	}

	let ancestor = path.dirname(resolvedPath);
	if (!ancestor || ancestor === resolvedPath) {
		ancestor = '.';
	}

	let foundAncestor = ancestor;
	if (!(await pathExists(foundAncestor))) {
		let current = foundAncestor;
		while (true) {
			if (await pathExists(current)) {
				foundAncestor = current;
				break;
			}
			const next = path.dirname(current);
			if (next === current) {
				throw new Error(`No existing ancestor for path: ${resolvedPath}`);
			}
			current = next;
		}
	}

	const canonicalAncestor = await fs.realpath(foundAncestor);
	const suffix = path.relative(foundAncestor, resolvedPath);
	let result = canonicalAncestor;
	if (suffix && suffix !== '.') {
		for (const part of suffix.split(path.sep)) {
			if (part === '..') {
				throw new Error(`Path escape via parent dir: ${resolvedPath}`);
			}
			if (part && part !== '.') {
				result = path.join(result, part);
			}
		}
	}

	return result;
}

async function getRealWorkspaceRoots(
	workspaceFolders: readonly vscode.WorkspaceFolder[],
): Promise<string[]> {
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
	return realRoots;
}

/**
 * Resolve a workspace path, canonicalize (including non-existent outputs), and
 * re-check containment so symlink escapes outside the workspace are rejected.
 */
export async function resolveWorkspaceFilePath(
	pathValue: string,
	workspaceFolders: readonly vscode.WorkspaceFolder[],
): Promise<vscode.Uri | undefined> {
	const uri = resolveWorkspaceRelativePath(pathValue, workspaceFolders);
	if (!uri || uri.scheme !== 'file') {
		return undefined;
	}

	const resolved = path.resolve(uri.fsPath);
	if (pathHasParentDirEscape(resolved)) {
		return undefined;
	}

	let canonical: string;
	try {
		canonical = await canonicalizePathForSandbox(resolved);
	} catch {
		return undefined;
	}

	const realRoots = await getRealWorkspaceRoots(workspaceFolders);
	if (!isPathInsideWorkspaceRoot(canonical, realRoots)) {
		return undefined;
	}
	return vscode.Uri.file(resolved);
}

/** Collect absolute fs paths for all workspace folder roots. */
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

/** Guard a list of paths — returns allowed fs paths or throws. */
export async function assertPathsInWorkspace(
	paths: readonly string[],
	workspaceFolders: readonly vscode.WorkspaceFolder[],
): Promise<string[]> {
	const resolved: string[] = [];
	for (const p of paths) {
		const uri = await resolveWorkspaceFilePath(p, workspaceFolders);
		if (!uri) {
			throw new Error(`Path is outside the workspace or invalid: ${p}`);
		}
		resolved.push(uri.fsPath);
	}
	return resolved;
}

/** Guard a single path — returns allowed fs path or throws. */
export async function assertPathInWorkspace(
	pathValue: string,
	workspaceFolders: readonly vscode.WorkspaceFolder[],
): Promise<string> {
	const paths = await assertPathsInWorkspace([pathValue], workspaceFolders);
	return paths[0];
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as path from 'path';
import * as vscode from 'vscode';
import { isPathInsideWorkspaceRoot } from './toolAllowlist';

/** Workspace-relative directory for SafeAppeals plan files. */
export const SAFEAPPEALS_PLANS_DIR = '.safeAppeals/plans';

/**
 * Slugifies a plan display name for use in filenames.
 * Lowercases, replaces non-alphanumeric runs with `_`, then trims edge underscores.
 */
export function slugifyPlanName(name: string): string {
	const slug = name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/_+/g, '_')
		.replace(/^_+|_+$/g, '');
	return slug.length > 0 ? slug : 'plan';
}

/**
 * Builds a Cursor-style plan filename: `{slug}_{hash}.plan.md`.
 * `hash` is typically 8 hex characters; the caller supplies it.
 */
export function buildPlanFileName(name: string, hash: string): string {
	return `${slugifyPlanName(name)}_${hash}.plan.md`;
}

/**
 * Resolves the plans directory under a workspace folder.
 * Throws when the resolved path escapes the workspace root.
 */
export function resolvePlansDirectory(workspaceFolder: vscode.Uri): vscode.Uri {
	const uri = joinUnderWorkspace(workspaceFolder, SAFEAPPEALS_PLANS_DIR.split('/'));
	assertInsideWorkspace(uri, workspaceFolder);
	return uri;
}

/**
 * Resolves a plan file URI under `.safeAppeals/plans`.
 * Throws when the resolved path escapes the workspace root.
 */
export function resolvePlanFileUri(
	workspaceFolder: vscode.Uri,
	name: string,
	hash: string,
): vscode.Uri {
	const fileName = buildPlanFileName(name, hash);
	const uri = joinUnderWorkspace(workspaceFolder, [...SAFEAPPEALS_PLANS_DIR.split('/'), fileName]);
	assertInsideWorkspace(uri, workspaceFolder);
	return uri;
}

function joinUnderWorkspace(workspaceFolder: vscode.Uri, segments: readonly string[]): vscode.Uri {
	if (typeof vscode.Uri.joinPath === 'function') {
		return vscode.Uri.joinPath(workspaceFolder, ...segments);
	}
	const fsPath = path.resolve(workspaceFolder.fsPath, ...segments);
	return vscode.Uri.file(fsPath);
}

function assertInsideWorkspace(candidate: vscode.Uri, workspaceFolder: vscode.Uri): void {
	if (!isPathInsideWorkspaceRoot(candidate.fsPath, [workspaceFolder.fsPath])) {
		throw new Error(`Plan path escapes workspace root: ${candidate.fsPath}`);
	}
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { openSampleCase, SAMPLE_CODE_WORKSPACE_FILENAME, sampleCaseRootUri } from './sampleCase';
import { takeTour } from './tour';

/** Application-scoped flag: open Tutorials after the sample case workspace is ready. */
export const TUTORIALS_PENDING_KEY = 'safeappeals.tutorials.pendingAfterSampleOpen';

/** Walkthrough contributed by this extension (publisher.extension#walkthroughId). */
export const TUTORIALS_WALKTHROUGH_ID = 'safeappeals.safeappeals-timeline#safeappealsTimelineSetup';

const SETTLE_MS = 400;
const RETRY_INTERVAL_MS = 250;
const RESUME_TIMEOUT_MS = 15_000;

export type TutorialsPendingState = {
	pending: true;
	startedAt: number;
};

/**
 * Whether a stored globalState value means Tutorials resume is pending.
 * Accepts legacy `true` or `{ pending: true, startedAt }`.
 */
export function isTutorialsPendingValue(value: unknown): boolean {
	if (value === true) {
		return true;
	}
	if (value !== null && typeof value === 'object' && (value as { pending?: unknown }).pending === true) {
		return true;
	}
	return false;
}

/**
 * True when the open workspace is the materialized sample case (folder root
 * under globalStorage/…/sample-case, or `sample_case.code-workspace`).
 *
 * Match is by normalized fsPath only — not URI string equality — so a workspace
 * opened as `file://…/sample-case` matches the same disk path as
 * `vscode-userdata:…/sample-case` (callers pass {@link vscode.Uri.fsPath}).
 */
export function isSampleCaseWorkspaceMatch(args: {
	sampleRootFsPath: string;
	sampleWorkspaceFsPath: string;
	folderFsPaths: readonly string[];
	workspaceFileFsPath: string | undefined;
}): boolean {
	const normalize = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
	const root = normalize(args.sampleRootFsPath);
	const sampleWorkspace = normalize(args.sampleWorkspaceFsPath);

	if (args.workspaceFileFsPath) {
		const wf = normalize(args.workspaceFileFsPath);
		if (wf === sampleWorkspace || wf.endsWith(`/${SAMPLE_CODE_WORKSPACE_FILENAME.toLowerCase()}`)) {
			// Prefer exact match; filename suffix alone is only accepted when under sample root.
			if (wf === sampleWorkspace || wf.startsWith(`${root}/`)) {
				return true;
			}
		}
	}

	return args.folderFsPaths.some(folder => {
		const n = normalize(folder);
		return n === root;
	});
}

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

async function markTutorialsPending(context: vscode.ExtensionContext): Promise<void> {
	const state: TutorialsPendingState = { pending: true, startedAt: Date.now() };
	await context.globalState.update(TUTORIALS_PENDING_KEY, state);
}

async function clearTutorialsPending(context: vscode.ExtensionContext): Promise<void> {
	await context.globalState.update(TUTORIALS_PENDING_KEY, undefined);
}

function isSampleCaseWorkspace(context: vscode.ExtensionContext): boolean {
	const root = sampleCaseRootUri(context);
	const workspaceUri = vscode.Uri.joinPath(root, SAMPLE_CODE_WORKSPACE_FILENAME);
	const folders = vscode.workspace.workspaceFolders ?? [];
	return isSampleCaseWorkspaceMatch({
		sampleRootFsPath: root.fsPath,
		sampleWorkspaceFsPath: workspaceUri.fsPath,
		folderFsPaths: folders.map(f => f.uri.fsPath),
		workspaceFileFsPath: vscode.workspace.workspaceFile?.fsPath,
	});
}

async function waitUntilSampleWorkspaceReady(context: vscode.ExtensionContext): Promise<boolean> {
	const deadline = Date.now() + RESUME_TIMEOUT_MS;
	while (Date.now() < deadline) {
		const foldersReady = (vscode.workspace.workspaceFolders?.length ?? 0) > 0;
		if (foldersReady && isSampleCaseWorkspace(context)) {
			await sleep(SETTLE_MS);
			if (isSampleCaseWorkspace(context) && (vscode.workspace.workspaceFolders?.length ?? 0) > 0) {
				return true;
			}
		}
		await sleep(RETRY_INTERVAL_MS);
	}
	return false;
}

/**
 * If Tutorials was requested and this window is the sample case, run the tour.
 * The workbench sample-case command opens Explore More on completion. Safe to call
 * from activate and from {@link openTutorials} when the sample is already open in
 * the same window.
 */
export async function resumePendingTutorials(context: vscode.ExtensionContext): Promise<void> {
	if (!isTutorialsPendingValue(context.globalState.get(TUTORIALS_PENDING_KEY))) {
		return;
	}

	if (!isSampleCaseWorkspace(context)) {
		// Pending flag is application-scoped; the other window (sample) will resume.
		return;
	}

	const ready = await waitUntilSampleWorkspaceReady(context);
	if (!ready) {
		await clearTutorialsPending(context);
		void vscode.window.showInformationMessage(
			'Tutorials could not finish opening automatically. Use Command Palette → “Take the Tour”, then open Get Started from the Safe Appeals walkthrough.',
			'Take the Tour',
		).then(choice => {
			if (choice === 'Take the Tour') {
				void vscode.commands.executeCommand('safeappeals-timeline.takeTour');
			}
		});
		return;
	}

	try {
		await takeTour();
	} finally {
		await clearTutorialsPending(context);
	}
}

/**
 * Tutorials hub: open the sample case (no credits / AI), then tour + walkthrough.
 */
export async function openTutorials(context: vscode.ExtensionContext): Promise<void> {
	await markTutorialsPending(context);
	const { reloading } = await openSampleCase(context);
	if (reloading) {
		// openFolder will reload this window or open another — leave pending set
		// for activate → resumePendingTutorials after the sample is file:// ready.
		return;
	}
	// Sample already open as file:// in this window — resume immediately.
	await resumePendingTutorials(context);
}

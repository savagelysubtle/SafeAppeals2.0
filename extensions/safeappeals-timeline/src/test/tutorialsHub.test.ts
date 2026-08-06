/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	isSampleCaseWorkspaceMatch,
	isTutorialsPendingValue,
	openTutorials,
	resumePendingTutorials,
	TUTORIALS_PENDING_KEY,
	TUTORIALS_WALKTHROUGH_ID,
} from '../tutorialsHub';
import { SAMPLE_CASE_TOUR_CORE_COMMAND } from '../tour';

suite('tutorialsHub', () => {
	test('pending flag helpers and sample workspace match', () => {
		const sampleRoot = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline/sample-case';
		const sampleWorkspace = `${sampleRoot}/sample_case.code-workspace`;
		// Same fsPath would be reported for file:// and vscode-userdata: URIs.
		const sampleRootWithTrailingSlash = `${sampleRoot}/`;

		assert.deepStrictEqual({
			pendingKey: TUTORIALS_PENDING_KEY,
			walkthroughId: TUTORIALS_WALKTHROUGH_ID,
			pendingTrue: isTutorialsPendingValue(true),
			pendingObject: isTutorialsPendingValue({ pending: true, startedAt: 1 }),
			pendingFalse: isTutorialsPendingValue(false),
			pendingMissing: isTutorialsPendingValue(undefined),
			pendingEmptyObject: isTutorialsPendingValue({}),
			matchFolderRoot: isSampleCaseWorkspaceMatch({
				sampleRootFsPath: sampleRoot,
				sampleWorkspaceFsPath: sampleWorkspace,
				folderFsPaths: [sampleRoot],
				workspaceFileFsPath: undefined,
			}),
			matchWorkspaceFile: isSampleCaseWorkspaceMatch({
				sampleRootFsPath: sampleRoot,
				sampleWorkspaceFsPath: sampleWorkspace,
				folderFsPaths: [sampleRoot],
				workspaceFileFsPath: sampleWorkspace,
			}),
			// file:// vs userdata: callers pass .fsPath; trailing slash still matches.
			matchSameFsPathNormalized: isSampleCaseWorkspaceMatch({
				sampleRootFsPath: sampleRoot,
				sampleWorkspaceFsPath: sampleWorkspace,
				folderFsPaths: [sampleRootWithTrailingSlash],
				workspaceFileFsPath: sampleWorkspace,
			}),
			rejectOtherFolder: isSampleCaseWorkspaceMatch({
				sampleRootFsPath: sampleRoot,
				sampleWorkspaceFsPath: sampleWorkspace,
				folderFsPaths: ['/home/user/cases/real-matter'],
				workspaceFileFsPath: undefined,
			}),
			rejectForeignWorkspaceNamedSample: isSampleCaseWorkspaceMatch({
				sampleRootFsPath: sampleRoot,
				sampleWorkspaceFsPath: sampleWorkspace,
				folderFsPaths: ['/tmp/other'],
				workspaceFileFsPath: '/tmp/other/sample_case.code-workspace',
			}),
		}, {
			pendingKey: 'safeappeals.tutorials.pendingAfterSampleOpen',
			walkthroughId: 'safeappeals.safeappeals-timeline#safeappealsTimelineSetup',
			pendingTrue: true,
			pendingObject: true,
			pendingFalse: false,
			pendingMissing: false,
			pendingEmptyObject: false,
			matchFolderRoot: true,
			matchWorkspaceFile: true,
			matchSameFsPathNormalized: true,
			rejectOtherFolder: false,
			rejectForeignWorkspaceNamedSample: false,
		});
	});

	test('openTutorials leaves pending when openSampleCase reloads the window', async () => {
		const originalExecuteCommand = vscode.commands.executeCommand;
		const originalFolders = vscode.workspace.workspaceFolders;
		const originalWorkspaceFile = vscode.workspace.workspaceFile;
		let openFolderCount = 0;
		let walkthroughCount = 0;
		vscode.commands.executeCommand = (async (command: string) => {
			if (command === 'vscode.openFolder') {
				openFolderCount += 1;
			}
			if (command === 'workbench.action.openWalkthrough') {
				walkthroughCount += 1;
			}
			return undefined;
		}) as typeof vscode.commands.executeCommand;

		// Empty window → openSampleCase issues openFolder (reloading: true).
		(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = undefined;
		(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile = undefined;

		const storageRoot = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline';
		let pending: unknown;
		const context = {
			globalStorageUri: vscode.Uri.parse(`vscode-userdata:${storageRoot}`),
			globalState: {
				get: (key: string) => (key === TUTORIALS_PENDING_KEY ? pending : undefined),
				update: async (key: string, value: unknown) => {
					if (key === TUTORIALS_PENDING_KEY) {
						pending = value;
					}
				},
			},
		} as unknown as vscode.ExtensionContext;

		try {
			await openTutorials(context);

			assert.deepStrictEqual({
				openFolderCount,
				walkthroughCount,
				pendingKept: isTutorialsPendingValue(pending),
			}, {
				openFolderCount: 1,
				walkthroughCount: 0,
				pendingKept: true,
			});
		} finally {
			vscode.commands.executeCommand = originalExecuteCommand;
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = originalFolders;
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile = originalWorkspaceFile;
		}
	});

	test('resumePendingTutorials calls takeTour once without opening walkthrough', async () => {
		const originalExecuteCommand = vscode.commands.executeCommand;
		const originalFolders = vscode.workspace.workspaceFolders;
		const originalWorkspaceFile = vscode.workspace.workspaceFile;
		let coreTourCount = 0;
		let walkthroughCount = 0;
		vscode.commands.executeCommand = (async (command: string) => {
			if (command === SAMPLE_CASE_TOUR_CORE_COMMAND) {
				coreTourCount += 1;
			}
			if (command === 'workbench.action.openWalkthrough') {
				walkthroughCount += 1;
			}
			return undefined;
		}) as typeof vscode.commands.executeCommand;

		const storageRoot = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline';
		const sampleRoot = `${storageRoot}/sample-case`;
		const workspacePath = `${sampleRoot}/sample_case.code-workspace`;
		(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile = vscode.Uri.file(workspacePath);
		(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = [{
			uri: vscode.Uri.file(sampleRoot),
			name: 'sample-case',
			index: 0,
		}];

		let pending: unknown = { pending: true, startedAt: Date.now() };
		const context = {
			globalStorageUri: vscode.Uri.parse(`vscode-userdata:${storageRoot}`),
			globalState: {
				get: (key: string) => (key === TUTORIALS_PENDING_KEY ? pending : undefined),
				update: async (key: string, value: unknown) => {
					if (key === TUTORIALS_PENDING_KEY) {
						pending = value;
					}
				},
			},
		} as unknown as vscode.ExtensionContext;

		try {
			await resumePendingTutorials(context);
			assert.deepStrictEqual({
				coreTourCount,
				walkthroughCount,
				pendingCleared: !isTutorialsPendingValue(pending),
			}, {
				coreTourCount: 1,
				walkthroughCount: 0,
				pendingCleared: true,
			});
		} finally {
			vscode.commands.executeCommand = originalExecuteCommand;
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = originalFolders;
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile = originalWorkspaceFile;
		}
	});

	test('openTutorials same-window resume calls takeTour once without opening walkthrough', async () => {
		const originalExecuteCommand = vscode.commands.executeCommand;
		const originalFolders = vscode.workspace.workspaceFolders;
		const originalWorkspaceFile = vscode.workspace.workspaceFile;
		let coreTourCount = 0;
		let walkthroughCount = 0;
		let openFolderCount = 0;
		vscode.commands.executeCommand = (async (command: string) => {
			if (command === 'vscode.openFolder') {
				openFolderCount += 1;
			}
			if (command === SAMPLE_CASE_TOUR_CORE_COMMAND) {
				coreTourCount += 1;
			}
			if (command === 'workbench.action.openWalkthrough') {
				walkthroughCount += 1;
			}
			return undefined;
		}) as typeof vscode.commands.executeCommand;

		const storageRoot = '/home/user/.config/SafeAppeals/globalStorage/safeappeals.safeappeals-timeline';
		const sampleRoot = `${storageRoot}/sample-case`;
		const workspacePath = `${sampleRoot}/sample_case.code-workspace`;
		(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile = vscode.Uri.file(workspacePath);
		(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = [{
			uri: vscode.Uri.file(sampleRoot),
			name: 'sample-case',
			index: 0,
		}];

		let pending: unknown;
		const context = {
			globalStorageUri: vscode.Uri.parse(`vscode-userdata:${storageRoot}`),
			globalState: {
				get: (key: string) => (key === TUTORIALS_PENDING_KEY ? pending : undefined),
				update: async (key: string, value: unknown) => {
					if (key === TUTORIALS_PENDING_KEY) {
						pending = value;
					}
				},
			},
		} as unknown as vscode.ExtensionContext;

		try {
			await openTutorials(context);
			assert.deepStrictEqual({
				openFolderCount,
				coreTourCount,
				walkthroughCount,
				pendingCleared: !isTutorialsPendingValue(pending),
			}, {
				openFolderCount: 0,
				coreTourCount: 1,
				walkthroughCount: 0,
				pendingCleared: true,
			});
		} finally {
			vscode.commands.executeCommand = originalExecuteCommand;
			(vscode.workspace as { workspaceFolders?: readonly vscode.WorkspaceFolder[] }).workspaceFolders = originalFolders;
			(vscode.workspace as { workspaceFile?: vscode.Uri }).workspaceFile = originalWorkspaceFile;
		}
	});
});

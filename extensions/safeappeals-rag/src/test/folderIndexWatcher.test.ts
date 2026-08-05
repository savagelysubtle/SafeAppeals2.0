/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as path from 'node:path';
import * as vscode from 'vscode';
import {
	FolderIndexWatcher,
	INDEX_DENY_DIR_NAMES,
	isUnderDeniedDir,
	type FolderIndexGate,
} from '../folderIndexWatcher';
import type { IndexPipelineResult } from '../indexPipeline';
import { CORE_REFERENCES_FOLDER } from '../types';

function uriFile(fsPath: string): vscode.Uri {
	return vscode.Uri.file(fsPath);
}

function workspaceFolder(root: string): vscode.WorkspaceFolder {
	return {
		uri: uriFile(root),
		name: path.basename(root),
		index: 0,
	};
}

function fakeFsWatcher(): vscode.FileSystemWatcher {
	return {
		onDidCreate: () => ({ dispose() { /* no-op */ } }),
		onDidChange: () => ({ dispose() { /* no-op */ } }),
		onDidDelete: () => ({ dispose() { /* no-op */ } }),
		dispose() { /* no-op */ },
	} as unknown as vscode.FileSystemWatcher;
}

suite('folderIndexWatcher', () => {
	test('deny-list treats node_modules/out/.git as noise', () => {
		assert.ok(INDEX_DENY_DIR_NAMES.has('node_modules'));
		assert.ok(INDEX_DENY_DIR_NAMES.has('out'));
		assert.ok(INDEX_DENY_DIR_NAMES.has('.git'));
		assert.strictEqual(
			isUnderDeniedDir('/case/node_modules/pkg/readme.md', '/case'),
			true,
		);
		assert.strictEqual(
			isUnderDeniedDir('/case/pleadings/brief.md', '/case'),
			false,
		);
	});

	test('startup scan schedules core_references and other workspace txt/md', async () => {
		const root = '/case';
		const indexed: string[] = [];
		const walkedRoots: string[] = [];
		const watcher = new FolderIndexWatcher({
			debounceMs: 10_000,
			getWorkspaceFolders: () => [workspaceFolder(root)],
			isIndexingAllowed: () => ({ ok: true }),
			indexPipeline: {
				indexPath: async source => {
					indexed.push(source);
					return {
						kind: 'ok',
						docId: 'd1',
						chunkCount: 1,
						scope: source.includes(CORE_REFERENCES_FOLDER)
							? 'core_reference'
							: 'case_index',
					} satisfies IndexPipelineResult;
				},
			},
			walkWorkspaceIndexableFiles: async workspaceRoot => {
				walkedRoots.push(workspaceRoot);
				return [
					path.join(workspaceRoot, CORE_REFERENCES_FOLDER, 'regs.md'),
					path.join(workspaceRoot, 'pleadings', 'brief.md'),
					path.join(workspaceRoot, 'node_modules', 'pkg', 'readme.md'),
				];
			},
			createWatcher: () => fakeFsWatcher(),
			onDidSaveTextDocument: () => ({ dispose() { /* no-op */ } }),
		});

		await watcher.runStartupScanForTesting('unit');
		assert.deepStrictEqual(walkedRoots, [root]);

		const coreUri = uriFile(path.join(root, CORE_REFERENCES_FOLDER, 'regs.md'));
		const caseUri = uriFile(path.join(root, 'pleadings', 'brief.md'));
		await watcher.flushForTesting(coreUri);
		await watcher.flushForTesting(caseUri);
		// node_modules path must not be scheduled / indexed
		assert.deepStrictEqual(indexed, [coreUri.toString(), caseUri.toString()]);
		watcher.dispose();
	});

	test('startup scan defers when models-missing and retries on notifyModelsReady', async () => {
		let gate: FolderIndexGate = { ok: false, code: 'models-missing', message: 'missing' };
		const walked: string[] = [];
		const watcher = new FolderIndexWatcher({
			debounceMs: 10_000,
			getWorkspaceFolders: () => [workspaceFolder('/case')],
			isIndexingAllowed: () => gate,
			indexPipeline: {
				indexPath: async () => ({ kind: 'skipped', reason: 'unused' }),
			},
			walkWorkspaceIndexableFiles: async root => {
				walked.push(root);
				return [];
			},
			createWatcher: () => fakeFsWatcher(),
			onDidSaveTextDocument: () => ({ dispose() { /* no-op */ } }),
		});

		await watcher.runStartupScanForTesting('activate');
		assert.strictEqual(watcher.isStartupScanPendingForTesting(), true);
		assert.deepStrictEqual(walked, []);

		gate = { ok: true };
		await new Promise<void>(resolve => {
			const prev = walked.length;
			watcher.notifyModelsReady();
			const poll = setInterval(() => {
				if (walked.length > prev || !watcher.isStartupScanPendingForTesting()) {
					clearInterval(poll);
					resolve();
				}
			}, 5);
		});
		assert.strictEqual(watcher.isStartupScanPendingForTesting(), false);
		assert.deepStrictEqual(walked, ['/case']);
		watcher.dispose();
	});

	test('save under core_references schedules reindex', async () => {
		const root = '/case';
		const indexed: string[] = [];
		let saveListener: ((document: vscode.TextDocument) => void) | undefined;
		const watcher = new FolderIndexWatcher({
			debounceMs: 10_000,
			getWorkspaceFolders: () => [workspaceFolder(root)],
			isIndexingAllowed: () => ({ ok: true }),
			indexPipeline: {
				indexPath: async source => {
					indexed.push(source);
					return {
						kind: 'ok',
						docId: 'd1',
						chunkCount: 2,
						scope: 'core_reference',
					};
				},
			},
			walkWorkspaceIndexableFiles: async () => [],
			createWatcher: () => fakeFsWatcher(),
			onDidSaveTextDocument: listener => {
				saveListener = listener;
				return { dispose() { /* no-op */ } };
			},
		});
		watcher.start();
		assert.ok(saveListener);

		const savedUri = uriFile(path.join(root, CORE_REFERENCES_FOLDER, 'manual.md'));
		saveListener!({
			uri: savedUri,
			fileName: savedUri.fsPath,
		} as vscode.TextDocument);

		await watcher.flushForTesting(savedUri);
		assert.deepStrictEqual(indexed, [savedUri.toString()]);
		watcher.dispose();
	});

	test('save outside core_references schedules case_index reindex', async () => {
		const root = '/case';
		const indexed: string[] = [];
		let saveListener: ((document: vscode.TextDocument) => void) | undefined;
		const watcher = new FolderIndexWatcher({
			debounceMs: 10_000,
			getWorkspaceFolders: () => [workspaceFolder(root)],
			isIndexingAllowed: () => ({ ok: true }),
			indexPipeline: {
				indexPath: async source => {
					indexed.push(source);
					return {
						kind: 'ok',
						docId: 'd2',
						chunkCount: 1,
						scope: 'case_index',
					};
				},
			},
			walkWorkspaceIndexableFiles: async () => [],
			createWatcher: () => fakeFsWatcher(),
			onDidSaveTextDocument: listener => {
				saveListener = listener;
				return { dispose() { /* no-op */ } };
			},
		});
		watcher.start();

		const saved = uriFile(path.join(root, 'pleadings', 'claim.txt'));
		saveListener!({
			uri: saved,
			fileName: saved.fsPath,
		} as vscode.TextDocument);
		await watcher.flushForTesting(saved);
		assert.deepStrictEqual(indexed, [saved.toString()]);

		// Deny-listed path must not index
		const junk = uriFile(path.join(root, 'node_modules', 'x.md'));
		saveListener!({
			uri: junk,
			fileName: junk.fsPath,
		} as vscode.TextDocument);
		await watcher.flushForTesting(junk);
		assert.deepStrictEqual(indexed, [saved.toString()]);
		watcher.dispose();
	});
});

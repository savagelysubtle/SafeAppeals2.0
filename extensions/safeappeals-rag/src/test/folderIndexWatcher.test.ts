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
import {
	docIdForSourceUri,
	type IndexPipelineResult,
} from '../indexPipeline';
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
		assert.ok(INDEX_DENY_DIR_NAMES.has('apps'));
		assert.ok(INDEX_DENY_DIR_NAMES.has('to_sort'));
		assert.ok(INDEX_DENY_DIR_NAMES.has('tosort'));
		assert.ok(INDEX_DENY_DIR_NAMES.has('.venv'));
		assert.ok(INDEX_DENY_DIR_NAMES.has('venv'));
		assert.strictEqual(
			isUnderDeniedDir('/case/node_modules/pkg/readme.md', '/case'),
			true,
		);
		assert.strictEqual(
			isUnderDeniedDir('/case/apps/foo.md', '/case'),
			true,
		);
		assert.strictEqual(
			isUnderDeniedDir('/case/to_sort/intake.pdf', '/case'),
			true,
		);
		assert.strictEqual(
			isUnderDeniedDir('/case/tosort/legacy.pdf', '/case'),
			true,
		);
		assert.strictEqual(
			isUnderDeniedDir('/case/pleadings/brief.md', '/case'),
			false,
		);
	});

	test('startup scan indexes core_references and other workspace txt/md/pdf', async () => {
		const root = '/case';
		const indexed: string[] = [];
		const walkedRoots: string[] = [];
		const logLines: string[] = [];
		const watcher = new FolderIndexWatcher({
			debounceMs: 10_000,
			getWorkspaceFolders: () => [workspaceFolder(root)],
			isIndexingAllowed: () => ({ ok: true }),
			log: message => {
				logLines.push(message);
			},
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
					path.join(workspaceRoot, CORE_REFERENCES_FOLDER, 'manual.pdf'),
					path.join(workspaceRoot, 'pleadings', 'brief.md'),
					path.join(workspaceRoot, 'pleadings', 'decision.pdf'),
					path.join(workspaceRoot, 'node_modules', 'pkg', 'readme.md'),
				];
			},
			createWatcher: () => fakeFsWatcher(),
			onDidSaveTextDocument: () => ({ dispose() { /* no-op */ } }),
		});

		const scheduled = await watcher.runStartupScanForTesting('unit');
		assert.strictEqual(scheduled, 4);
		assert.deepStrictEqual(walkedRoots, [root]);
		assert.deepStrictEqual(indexed, [
			uriFile(path.join(root, CORE_REFERENCES_FOLDER, 'regs.md')).toString(),
			uriFile(path.join(root, CORE_REFERENCES_FOLDER, 'manual.pdf')).toString(),
			uriFile(path.join(root, 'pleadings', 'brief.md')).toString(),
			uriFile(path.join(root, 'pleadings', 'decision.pdf')).toString(),
		]);
		const stats = watcher.getLastScanStatsForTesting();
		assert.ok(stats);
		assert.strictEqual(stats!.scheduled, 4);
		assert.strictEqual(stats!.indexed, 4);
		assert.strictEqual(stats!.skippedUnchanged, 0);
		assert.ok(logLines.some(l => l.includes('Startup scan complete (unit): 4 indexed')));
		watcher.dispose();
	});

	test('startup scan logs one summary for unchanged skips', async () => {
		const root = '/case';
		const logLines: string[] = [];
		const watcher = new FolderIndexWatcher({
			debounceMs: 10_000,
			getWorkspaceFolders: () => [workspaceFolder(root)],
			isIndexingAllowed: () => ({ ok: true }),
			log: message => {
				logLines.push(message);
			},
			indexPipeline: {
				indexPath: async () => ({
					kind: 'skipped',
					reason: 'Document already indexed (unchanged)',
				}),
			},
			walkWorkspaceIndexableFiles: async workspaceRoot => [
				path.join(workspaceRoot, 'a.md'),
				path.join(workspaceRoot, 'b.md'),
			],
			createWatcher: () => fakeFsWatcher(),
			onDidSaveTextDocument: () => ({ dispose() { /* no-op */ } }),
		});

		await watcher.runStartupScanForTesting('unit');
		assert.ok(logLines.some(l => l.includes('Startup scan complete (unit): 2 skipped (unchanged)')));
		assert.strictEqual(
			logLines.filter(l => l.includes('Auto-index skipped')).length,
			0,
		);
		const stats = watcher.getLastScanStatsForTesting();
		assert.strictEqual(stats?.skippedUnchanged, 2);
		assert.strictEqual(stats?.indexed, 0);
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

	test('warm-then-scan sequencing: deferInitialScan then runInitialScan after gate clears', async () => {
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
				return [path.join(root, 'pleadings', 'a.md')];
			},
			createWatcher: () => fakeFsWatcher(),
			onDidSaveTextDocument: () => ({ dispose() { /* no-op */ } }),
		});

		// Activate order: start watchers without scan → warm clears gate → runInitialScan.
		watcher.start({ deferInitialScan: true });
		assert.strictEqual(watcher.isStartupScanPendingForTesting(), false);
		assert.deepStrictEqual(walked, []);

		gate = { ok: true };
		await watcher.runInitialScan('activate-after-warm');
		watcher.notifyModelsReady(); // no-op when not pending
		assert.strictEqual(watcher.isStartupScanPendingForTesting(), false);
		assert.deepStrictEqual(walked, ['/case']);
		watcher.dispose();
	});

	test('delete of case-scope PDF calls removeDoc with PathGuard docId', async () => {
		const root = '/case';
		const removed: string[] = [];
		const pdfUri = uriFile(path.join(root, 'pleadings', 'decision.pdf'));
		const watcher = new FolderIndexWatcher({
			debounceMs: 10_000,
			getWorkspaceFolders: () => [workspaceFolder(root)],
			isIndexingAllowed: () => ({ ok: true }),
			indexPipeline: {
				indexPath: async () => ({ kind: 'skipped', reason: 'unused' }),
			},
			walkWorkspaceIndexableFiles: async () => [],
			removeDoc: docId => {
				removed.push(docId);
				return { ok: true };
			},
			createWatcher: () => fakeFsWatcher(),
			onDidSaveTextDocument: () => ({ dispose() { /* no-op */ } }),
		});
		watcher.start({ deferInitialScan: true });

		await watcher.handleDeleteForTesting(pdfUri);
		assert.deepStrictEqual(removed, [docIdForSourceUri(pdfUri.toString())]);
		watcher.dispose();
	});

	test('delete of case-scope file calls removeDoc with PathGuard docId', async () => {
		const root = '/case';
		const removed: string[] = [];
		const caseUri = uriFile(path.join(root, 'pleadings', 'claim.txt'));
		const junkUri = uriFile(path.join(root, 'node_modules', 'pkg', 'readme.md'));
		const watcher = new FolderIndexWatcher({
			debounceMs: 10_000,
			getWorkspaceFolders: () => [workspaceFolder(root)],
			isIndexingAllowed: () => ({ ok: true }),
			indexPipeline: {
				indexPath: async () => ({ kind: 'skipped', reason: 'unused' }),
			},
			walkWorkspaceIndexableFiles: async () => [],
			removeDoc: docId => {
				removed.push(docId);
				return { ok: true };
			},
			createWatcher: () => fakeFsWatcher(),
			onDidSaveTextDocument: () => ({ dispose() { /* no-op */ } }),
		});
		watcher.start({ deferInitialScan: true });

		await watcher.handleDeleteForTesting(caseUri);
		assert.deepStrictEqual(removed, [docIdForSourceUri(caseUri.toString())]);

		await watcher.handleDeleteForTesting(junkUri);
		assert.deepStrictEqual(removed, [docIdForSourceUri(caseUri.toString())]);
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

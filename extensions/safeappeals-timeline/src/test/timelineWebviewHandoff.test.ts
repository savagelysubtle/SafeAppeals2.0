/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import { TimelinePanel } from '../timelinePanel';
import type { TimelineService } from '../timelineService';
import { TimelineWebviewHost } from '../timelineWebviewHost';
import type { CaseTimeline } from '../timelineTypes';

async function flushUntil(predicate: () => boolean, attempts = 200): Promise<void> {
	for (let i = 0; i < attempts; i++) {
		if (predicate()) {
			return;
		}
		await new Promise<void>(resolve => setImmediate(resolve));
	}
}

suite('timeline webview host sidebar callbacks', () => {
	test('openTimeline and selectEvent invoke host callbacks', async () => {
		const calls: Array<{ type: string; eventId?: string }> = [];
		const host = new TimelineWebviewHost(
			() => undefined,
			async () => true,
			{
				onOpenTimeline: () => calls.push({ type: 'openTimeline' }),
				onSelectEvent: eventId => calls.push({ type: 'selectEvent', eventId }),
			},
		);

		await host.handleMessage({ type: 'openTimeline' });
		await host.handleMessage({ type: 'selectEvent', eventId: 'evt-42' });

		assert.deepStrictEqual(calls, [
			{ type: 'openTimeline' },
			{ type: 'selectEvent', eventId: 'evt-42' },
		]);
	});
});

suite('timeline webview host deleteEvent confirmation', () => {
	let originalShowWarningMessage: typeof vscode.window.showWarningMessage;
	let warningChoice: string | undefined;
	let deleteCalls: string[];
	let warningCalls: Array<{ message: string; options: vscode.MessageOptions; items: string[] }>;

	const sampleTimeline: CaseTimeline = {
		version: 1,
		jurisdictionId: 'bc-wcb',
		events: [{
			id: 'evt-1',
			date: '2025-01-01',
			title: 'Statute of limitations',
			category: 'deadline',
			isDeadline: true,
			linkedDocuments: [],
			source: 'statute',
			createdAt: '2024-01-01T00:00:00.000Z',
			updatedAt: '2024-01-01T00:00:00.000Z',
		}],
		notificationsEnabled: true,
	};

	suiteSetup(() => {
		originalShowWarningMessage = vscode.window.showWarningMessage;
	});

	setup(() => {
		deleteCalls = [];
		warningCalls = [];
		warningChoice = undefined;
		vscode.window.showWarningMessage = (async (
			message: string,
			...rest: Array<string | vscode.MessageOptions>
		) => {
			const options = typeof rest[0] === 'object' ? rest[0] as vscode.MessageOptions : {};
			const items = rest.filter((item): item is string => typeof item === 'string');
			warningCalls.push({ message, options, items });
			return warningChoice;
		}) as typeof vscode.window.showWarningMessage;
	});

	teardown(() => {
		vscode.window.showWarningMessage = originalShowWarningMessage;
	});

	function createHost(): TimelineWebviewHost {
		const service = {
			getTimeline: () => sampleTimeline,
			loadTimeline: async () => sampleTimeline,
			deleteEvent: async (id: string) => {
				deleteCalls.push(id);
			},
			onDidChangeTimeline: () => ({ dispose() { /* no-op */ } }),
		};
		return new TimelineWebviewHost(
			() => service as unknown as TimelineService,
			async () => true,
		);
	}

	test('cancels when warning returns undefined', async () => {
		warningChoice = undefined;
		const host = createHost();
		await host.handleMessage({ type: 'deleteEvent', id: 'evt-1' });
		assert.deepStrictEqual(
			{ warningCalls, deleteCalls },
			{
				warningCalls: [{
					message: 'Delete "Statute of limitations"?',
					options: { modal: true },
					items: ['Delete'],
				}],
				deleteCalls: [],
			},
		);
	});

	test('deletes when warning returns Delete', async () => {
		warningChoice = 'Delete';
		const host = createHost();
		await host.handleMessage({ type: 'deleteEvent', id: 'evt-1' });
		assert.deepStrictEqual(
			{ warningCalls, deleteCalls },
			{
				warningCalls: [{
					message: 'Delete "Statute of limitations"?',
					options: { modal: true },
					items: ['Delete'],
				}],
				deleteCalls: ['evt-1'],
			},
		);
	});
});

suite('timeline webview host pickDocuments', () => {
	let originalShowOpenDialog: typeof vscode.window.showOpenDialog;
	let originalWorkspaceFolders: typeof vscode.workspace.workspaceFolders;
	let originalAsRelativePath: typeof vscode.workspace.asRelativePath;
	let openDialogResult: vscode.Uri[] | undefined;
	let openDialogOptions: vscode.OpenDialogOptions | undefined;
	let posted: unknown[];

	suiteSetup(() => {
		originalShowOpenDialog = vscode.window.showOpenDialog;
		originalWorkspaceFolders = vscode.workspace.workspaceFolders;
		originalAsRelativePath = vscode.workspace.asRelativePath;
	});

	setup(() => {
		posted = [];
		openDialogResult = undefined;
		openDialogOptions = undefined;
		const folderUri = vscode.Uri.file('/tmp/timeline-workspace');
		Object.defineProperty(vscode.workspace, 'workspaceFolders', {
			configurable: true,
			get: () => [{ uri: folderUri, name: 'timeline-workspace', index: 0 }],
		});
		vscode.workspace.asRelativePath = ((uri: vscode.Uri | string, _includeWorkspaceFolder?: boolean) => {
			const fsPath = typeof uri === 'string' ? uri : uri.fsPath;
			const prefix = folderUri.fsPath.endsWith('/') ? folderUri.fsPath : `${folderUri.fsPath}/`;
			if (fsPath.startsWith(prefix)) {
				return fsPath.slice(prefix.length);
			}
			if (fsPath === folderUri.fsPath) {
				return '';
			}
			return fsPath;
		}) as typeof vscode.workspace.asRelativePath;
		vscode.window.showOpenDialog = (async (options?: vscode.OpenDialogOptions) => {
			openDialogOptions = options;
			return openDialogResult;
		}) as typeof vscode.window.showOpenDialog;
	});

	teardown(() => {
		vscode.window.showOpenDialog = originalShowOpenDialog;
		vscode.workspace.asRelativePath = originalAsRelativePath;
		Object.defineProperty(vscode.workspace, 'workspaceFolders', {
			configurable: true,
			get: () => originalWorkspaceFolders,
		});
	});

	test('pickDocuments posts documentsPicked with workspace-relative paths', async () => {
		openDialogResult = [
			vscode.Uri.file('/tmp/timeline-workspace/docs/decision.pdf'),
			vscode.Uri.file('/tmp/timeline-workspace/notes/intake.md'),
		];
		const host = new TimelineWebviewHost(
			() => undefined,
			async msg => {
				posted.push(msg);
				return true;
			},
		);

		await host.handleMessage({ type: 'pickDocuments' });

		assert.deepStrictEqual({
			options: {
				canSelectMany: openDialogOptions?.canSelectMany,
				canSelectFiles: openDialogOptions?.canSelectFiles,
				canSelectFolders: openDialogOptions?.canSelectFolders,
				openLabel: openDialogOptions?.openLabel,
			},
			posted,
		}, {
			options: {
				canSelectMany: true,
				canSelectFiles: true,
				canSelectFolders: false,
				openLabel: 'Attach',
			},
			posted: [{
				type: 'documentsPicked',
				uris: ['docs/decision.pdf', 'notes/intake.md'],
			}],
		});
	});

	test('pickDocuments no-ops when dialog cancelled', async () => {
		openDialogResult = undefined;
		const host = new TimelineWebviewHost(
			() => undefined,
			async msg => {
				posted.push(msg);
				return true;
			},
		);

		await host.handleMessage({ type: 'pickDocuments' });

		assert.deepStrictEqual(posted, []);
	});

	test('pickDocuments uses uri.toString for files outside workspace', async () => {
		const outside = vscode.Uri.file('/other/place/evidence.pdf');
		openDialogResult = [outside];
		const host = new TimelineWebviewHost(
			() => undefined,
			async msg => {
				posted.push(msg);
				return true;
			},
		);

		await host.handleMessage({ type: 'pickDocuments' });

		assert.deepStrictEqual(posted, [{
			type: 'documentsPicked',
			uris: [outside.toString()],
		}]);
	});
});

suite('timeline panel pending select', () => {
	let originalCreate: typeof vscode.window.createWebviewPanel;
	let originalExecuteCommand: typeof vscode.commands.executeCommand;
	let messageHandler: ((msg: unknown) => unknown) | undefined;
	let posted: unknown[];

	suiteSetup(() => {
		originalCreate = vscode.window.createWebviewPanel;
		originalExecuteCommand = vscode.commands.executeCommand;
	});

	setup(() => {
		posted = [];
		messageHandler = undefined;
		// Bootstrap awaits calendar soft-pull; stub so official host does not race flushUntil.
		vscode.commands.executeCommand = (async (command: string) => {
			if (command === 'safeappeals-calendar.getEvents') {
				return [];
			}
			return undefined;
		}) as typeof vscode.commands.executeCommand;
		vscode.window.createWebviewPanel = ((_viewType, _title, _showOptions, _options) => {
			const webview = {
				html: '',
				cspSource: 'vscode-webview:',
				asWebviewUri: (uri: vscode.Uri) => uri,
				postMessage: async (msg: unknown) => {
					posted.push(msg);
					return true;
				},
				onDidReceiveMessage: (listener: (msg: unknown) => unknown) => {
					messageHandler = listener;
					return { dispose() { /* no-op */ } };
				},
			};
			return {
				webview,
				viewColumn: vscode.ViewColumn.One,
				onDidDispose: () => ({ dispose() { /* no-op */ } }),
				reveal: () => { /* no-op */ },
				dispose: () => { /* no-op */ },
			} as unknown as vscode.WebviewPanel;
		}) as typeof vscode.window.createWebviewPanel;
	});

	teardown(() => {
		TimelinePanel.current?.dispose();
		vscode.window.createWebviewPanel = originalCreate;
		vscode.commands.executeCommand = originalExecuteCommand;
	});

	test('showAndSelectEvent delivers pending id after ready', async () => {
		const extensionUri = vscode.Uri.file('/tmp/safeappeals-timeline-handoff-test');
		TimelinePanel.showAndSelectEvent(extensionUri, () => undefined, 'evt-pending');

		const immediateSelects = posted
			.filter((msg): msg is { type: string; eventId: string } =>
				!!msg && typeof msg === 'object' && (msg as { type?: string }).type === 'selectEvent')
			.map(msg => msg.eventId);

		posted.length = 0;
		assert.ok(messageHandler, 'webview message handler should be registered');
		void messageHandler!({ type: 'ready' });

		await flushUntil(() => posted.some(msg =>
			!!msg && typeof msg === 'object' && (msg as { type?: string }).type === 'selectEvent'));

		assert.deepStrictEqual(
			{
				immediateSelects,
				afterReady: {
					hadBootstrap: posted.some(msg =>
						!!msg && typeof msg === 'object' && (msg as { type?: string }).type === 'bootstrap'),
					selectEventIds: posted
						.filter((msg): msg is { type: string; eventId: string } =>
							!!msg && typeof msg === 'object' && (msg as { type?: string }).type === 'selectEvent')
						.map(msg => msg.eventId),
				},
			},
			{
				immediateSelects: ['evt-pending'],
				afterReady: {
					hadBootstrap: true,
					selectEventIds: ['evt-pending'],
				},
			},
		);
	});
});

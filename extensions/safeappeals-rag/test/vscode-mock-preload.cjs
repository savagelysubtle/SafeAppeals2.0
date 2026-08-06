/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

'use strict';

/**
 * Minimal `vscode` module stub for mocha unit tests that import extension sources.
 * Usage: mocha --require ./test/vscode-mock-preload.cjs --ui tdd out/test/*.test.js
 */
const Module = require('module');
const originalLoad = Module._load;

/** Shared config store so update()/get() persist across getConfiguration() calls in tests. */
const configurationValues = Object.create(null);

const vscodeMock = {
	EventEmitter: class {
		constructor() {
			this._listeners = new Set();
			this.event = (listener) => {
				this._listeners.add(listener);
				return { dispose: () => this._listeners.delete(listener) };
			};
		}
		fire(data) {
			for (const listener of [...this._listeners]) {
				listener(data);
			}
		}
		dispose() {
			this._listeners.clear();
		}
	},
	ConfigurationTarget: { Global: 1, Workspace: 2, WorkspaceFolder: 3 },
	RelativePattern: class RelativePattern {
		constructor(base, pattern) {
			this.base = base;
			this.pattern = pattern;
		}
	},
	workspace: {
		workspaceFolders: undefined,
		fs: {
			readFile: async () => new Uint8Array(),
			writeFile: async () => { },
			createDirectory: async () => { },
		},
		getConfiguration: () => ({
			get: (key, defaultValue) => (key in configurationValues ? configurationValues[key] : defaultValue),
			update: async (key, value) => {
				configurationValues[key] = value;
			},
		}),
		onDidChangeWorkspaceFolders: () => ({ dispose() { } }),
		onDidSaveTextDocument: () => ({ dispose() { } }),
		createFileSystemWatcher: () => ({
			onDidCreate: () => ({ dispose() { } }),
			onDidChange: () => ({ dispose() { } }),
			onDidDelete: () => ({ dispose() { } }),
			dispose() { },
		}),
		asRelativePath: (uri) => String(uri),
	},
	ProgressLocation: { Notification: 15 },
	window: {
		showErrorMessage: async () => undefined,
		showWarningMessage: async () => undefined,
		showInformationMessage: async () => undefined,
		withProgress: async (_options, task) =>
			task(
				{ report: () => { } },
				{ isCancellationRequested: false, onCancellationRequested: () => ({ dispose() { } }) },
			),
		showInputBox: async () => undefined,
		showSaveDialog: async () => undefined,
		showOpenDialog: async () => undefined,
		showQuickPick: async () => undefined,
		activeTextEditor: undefined,
		visibleTextEditors: [],
		createOutputChannel: () => ({ appendLine() { }, dispose() { }, show() { } }),
		createWebviewPanel: () => ({
			webview: {
				html: '',
				onDidReceiveMessage: () => ({ dispose() { } }),
				postMessage: async () => true,
				asWebviewUri: (u) => u,
				cspSource: 'vscode-webview:',
			},
			onDidDispose: () => ({ dispose() { } }),
			reveal: () => { },
			dispose: () => { },
		}),
	},
	commands: {
		registerCommand: () => ({ dispose() { } }),
		executeCommand: async () => undefined,
	},
	extensions: {
		getExtension: () => undefined,
	},
	Uri: {
		file: (fsPath) => ({ scheme: 'file', fsPath, path: fsPath, toString: () => `file://${fsPath}` }),
		parse: (value) => ({ scheme: 'file', fsPath: value, path: value, toString: () => value }),
		joinPath: (base, ...parts) => {
			const fsPath = [base.fsPath || base.path, ...parts].join('/');
			return { scheme: 'file', fsPath, path: fsPath, toString: () => `file://${fsPath}` };
		},
	},
	ViewColumn: { One: 1 },
	l10n: {
		t: (message, ...args) => {
			let result = message;
			for (let i = 0; i < args.length; i++) {
				result = result.replace(`{${i}}`, String(args[i]));
			}
			return result;
		},
	},
	LanguageModelToolResult: class LanguageModelToolResult {
		constructor(content) {
			this.content = content;
		}
	},
	LanguageModelTextPart: class LanguageModelTextPart {
		constructor(value) {
			this.value = value;
		}
	},
	CancellationTokenSource: class CancellationTokenSource {
		constructor() {
			this.token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() { } }) };
		}
	},
	lm: {
		registerTool: () => ({ dispose() { } }),
	},
};

Module._load = function (request, parent, isMain) {
	if (request === 'vscode') {
		return vscodeMock;
	}
	return originalLoad(request, parent, isMain);
};

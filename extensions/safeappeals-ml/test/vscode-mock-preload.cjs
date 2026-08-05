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
	workspace: {
		workspaceFolders: undefined,
		fs: {
			readFile: async () => new Uint8Array(),
			writeFile: async () => { },
			createDirectory: async () => { },
		},
		getConfiguration: () => ({
			get: (_key, defaultValue) => defaultValue,
		}),
		onDidChangeWorkspaceFolders: () => ({ dispose() { } }),
		asRelativePath: (uri) => String(uri),
	},
	window: {
		showErrorMessage: async () => undefined,
		showWarningMessage: async () => undefined,
		showInformationMessage: async () => undefined,
		showSaveDialog: async () => undefined,
		showOpenDialog: async () => undefined,
		showQuickPick: async () => undefined,
		activeTextEditor: undefined,
		visibleTextEditors: [],
		createOutputChannel: () => ({ appendLine() { }, dispose() { } }),
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
	CancellationTokenSource: class CancellationTokenSource {
		constructor() {
			this.token = { isCancellationRequested: false, onCancellationRequested: () => ({ dispose() { } }) };
		}
	},
};

Module._load = function (request, parent, isMain) {
	if (request === 'vscode') {
		return vscodeMock;
	}
	return originalLoad(request, parent, isMain);
};

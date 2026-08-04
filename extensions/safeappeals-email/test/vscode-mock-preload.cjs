/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
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
	authentication: {
		registerAuthenticationProvider: () => ({ dispose() { } }),
		getSession: async () => undefined,
	},
	l10n: {
		t: (message, ...args) => {
			let out = message;
			for (let i = 0; i < args.length; i++) {
				out = out.replace(`{${i}}`, args[i] ?? '');
			}
			return out;
		},
	},
	window: {
		showErrorMessage: async () => undefined,
		showWarningMessage: async () => undefined,
		showInformationMessage: async () => undefined,
		createOutputChannel: () => ({ appendLine() { }, dispose() { } }),
	},
	commands: {
		executeCommand: async () => undefined,
	},
	env: {
		uiKind: 1,
		openExternal: async () => true,
	},
	Uri: {
		file: (fsPath) => ({
			scheme: 'file',
			fsPath,
			path: fsPath,
			toString: () => `file://${fsPath}`,
			with: (change) => ({
				scheme: change.scheme || 'file',
				fsPath: change.path || fsPath,
				path: change.path || fsPath,
				toString: () => `file://${change.path || fsPath}`,
				with() { return this; },
			}),
		}),
		parse: (value) => {
			if (value.startsWith('file://')) {
				const fsPath = value.slice('file://'.length);
				return {
					scheme: 'file',
					fsPath,
					path: fsPath,
					toString: () => value,
					with(change) {
						return {
							scheme: change.scheme || 'file',
							fsPath: change.path || fsPath,
							path: change.path || fsPath,
							toString: () => `file://${change.path || fsPath}`,
							with() { return this; },
						};
					},
				};
			}
			return { scheme: 'unknown', path: value, fsPath: value, toString: () => value, with() { return this; } };
		},
		joinPath: (base, ...segments) => {
			const path = require('path');
			const fsPath = path.join(base.fsPath || base.path || '', ...segments);
			return {
				scheme: 'file',
				fsPath,
				path: fsPath,
				toString: () => `file://${fsPath}`,
				with(change) {
					return {
						scheme: change.scheme || 'file',
						fsPath: change.path || fsPath,
						path: change.path || fsPath,
						toString: () => `file://${change.path || fsPath}`,
						with() { return this; },
					};
				},
			};
		},
	},
	workspace: {
		workspaceFolders: undefined,
	},
	UIKind: { Desktop: 1, Web: 2 },
	CancellationError: class CancellationError extends Error {
		constructor() {
			super('Canceled');
			this.name = 'Canceled';
		}
	},
};

Module._load = function (request, parent, isMain) {
	if (request === 'vscode') {
		return vscodeMock;
	}
	return originalLoad(request, parent, isMain);
};

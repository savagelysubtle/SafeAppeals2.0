/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RichTextEditorProvider } from './richTextEditorProvider';
import { MonacoRichTextEditor } from './monacoRichTextEditor';
import { VoidWebviewBridge } from './voidWebviewBridge';
import { registerVoidActions } from './voidActions';
import { isWebEnvironment } from './conversion';

export function activate(context: vscode.ExtensionContext) {
	const isWeb = isWebEnvironment();

	let monacoEditor: MonacoRichTextEditor | undefined;
	let webviewBridge: VoidWebviewBridge | undefined;

	if (!isWeb) {
		// Desktop: Use Monaco-based editor
		monacoEditor = new MonacoRichTextEditor(context);

		// Register the custom editor provider (webview for rich UI)
		const provider = new RichTextEditorProvider(context);
		provider.setMonacoEditor(monacoEditor);

		const disposable = vscode.window.registerCustomEditorProvider('txtRichEditor.editor', provider, {
			supportsMultipleEditorsPerDocument: false,
		});

		// Register export DOCX command
		const exportCommand = vscode.commands.registerCommand('txtRichEditor.exportDocx', () => {
			provider.exportDocx();
		});

		// Register import DOCX command
		const importCommand = vscode.commands.registerCommand('txtRichEditor.importDocx', () => {
			provider.importDocx();
		});

		context.subscriptions.push(disposable, exportCommand, importCommand);
	} else {
		// Web: Use webview-only editor with void bridge
		const provider = new RichTextEditorProvider(context);
		webviewBridge = new VoidWebviewBridge(context);
		provider.setWebviewBridge(webviewBridge);

		const disposable = vscode.window.registerCustomEditorProvider('txtRichEditor.editor', provider, {
			supportsMultipleEditorsPerDocument: false,
		});

		context.subscriptions.push(disposable);
	}

	// Register command to open with rich editor
	const openCommand = vscode.commands.registerCommand('txtRichEditor.openWithRichEditor', (uri: vscode.Uri) => {
		if (uri) {
			if (!isWeb && monacoEditor) {
				// Desktop: Open with Monaco
				monacoEditor.openFile(uri);
			} else {
				// Web: Open with webview
				vscode.commands.executeCommand('vscode.openWith', uri, 'txtRichEditor.editor');
			}
		}
	});

	context.subscriptions.push(openCommand);

	// Register Void integration actions (Ctrl+L and Ctrl+K)
	registerVoidActions(context, monacoEditor);

	// Set context key for rich text editor
	vscode.commands.executeCommand('setContext', 'richTextEditorActive', false);

	// Update context when editor changes
	const editorChangeDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
		if (editor) {
			const fileExtension = editor.document.uri.fsPath.split('.').pop()?.toLowerCase();
			const isRichTextFile = ['txt', 'gdoc', 'docx'].includes(fileExtension || '');
			vscode.commands.executeCommand('setContext', 'richTextEditorActive', isRichTextFile);
		} else {
			vscode.commands.executeCommand('setContext', 'richTextEditorActive', false);
		}
	});

	context.subscriptions.push(editorChangeDisposable);
}

export function deactivate() {
	// Cleanup if needed
}

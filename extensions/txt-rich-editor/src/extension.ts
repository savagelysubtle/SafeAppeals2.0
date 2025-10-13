/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RichTextEditorProvider } from './richTextEditorProvider';
import { DocxEditorProvider } from './docxEditorProvider';
import { MonacoRichTextEditor } from './monacoRichTextEditor';
import { VoidWebviewBridge } from './voidWebviewBridge';
import { registerVoidActions } from './voidActions';
import { isWebEnvironment } from './conversion';
import { Logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
	const isWeb = isWebEnvironment();

	// Create logger for error tracking
	const logger = new Logger('Rich Text Editor');
	context.subscriptions.push(logger);

	logger.info('Rich Text Editor extension activating...');
	logger.info(`Environment: ${isWeb ? 'Web' : 'Desktop'}`);

	let monacoEditor: MonacoRichTextEditor | undefined;
	let webviewBridge: VoidWebviewBridge | undefined;

	if (!isWeb) {
		// Desktop: Use Monaco-based editor
		logger.info('Initializing Monaco-based rich text editor for desktop...');
		monacoEditor = new MonacoRichTextEditor(context);

		// Register the custom editor provider (webview for rich UI)
		const provider = new RichTextEditorProvider(context, logger);
		provider.setMonacoEditor(monacoEditor);

		// Register for text files (.txt, .gdoc)
		const textDisposable = vscode.window.registerCustomEditorProvider('txtRichEditor.editor', provider, {
			supportsMultipleEditorsPerDocument: false,
		});

		// Register DOCX editor provider (handles binary files)
		const docxProvider = new DocxEditorProvider(context, logger);
		const docxDisposable = vscode.window.registerCustomEditorProvider('txtRichEditor.docxEditor', docxProvider, {
			supportsMultipleEditorsPerDocument: false,
			webviewOptions: {
				retainContextWhenHidden: true
			}
		});

		// Register export DOCX command
		const exportCommand = vscode.commands.registerCommand('txtRichEditor.exportDocx', () => {
			// Try text editor first, then DOCX editor
			provider.exportDocx();
		});

		// Register import DOCX command
		const importCommand = vscode.commands.registerCommand('txtRichEditor.importDocx', () => {
			provider.importDocx();
		});

		context.subscriptions.push(textDisposable, docxDisposable, exportCommand, importCommand);
	} else {
		// Web: Use webview-only editor with void bridge
		logger.info('Initializing webview-based rich text editor for web...');
		const provider = new RichTextEditorProvider(context, logger);
		webviewBridge = new VoidWebviewBridge(context);
		provider.setWebviewBridge(webviewBridge);

		// Register for text files only (DOCX not supported in web)
		const textDisposable = vscode.window.registerCustomEditorProvider('txtRichEditor.editor', provider, {
			supportsMultipleEditorsPerDocument: false,
		});

		context.subscriptions.push(textDisposable);
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

	// Register command to show output channel
	const showLogsCommand = vscode.commands.registerCommand('txtRichEditor.showLogs', () => {
		logger.show();
	});
	context.subscriptions.push(showLogsCommand);

	logger.info('Rich Text Editor extension activated successfully');
}

export function deactivate() {
	// Cleanup if needed
}


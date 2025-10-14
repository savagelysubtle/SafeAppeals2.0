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
import { CommandManager } from './commands/commandManager';
import { DocumentConverter } from './conversion';
import { AIDispatcher } from './ai/aiDispatcher';
import { EditorProviderRegistry } from './editorProviderRegistry';

export function activate(context: vscode.ExtensionContext) {
	const isWeb = isWebEnvironment();

	// Create logger for error tracking
	const logger = new Logger('Rich Text Editor');
	context.subscriptions.push(logger);

	logger.info('Rich Text Editor extension activating...');
	logger.info(`Environment: ${isWeb ? 'Web' : 'Desktop'}`);

	// Initialize core services
	const editorRegistry = new EditorProviderRegistry(logger);
	const commandManager = new CommandManager(context, logger);
	const documentConverter = new DocumentConverter(logger);
	const aiDispatcher = new AIDispatcher(logger);

	// Connect command manager to editor registry
	commandManager.setEditorRegistry(editorRegistry);

	// Register commands
	commandManager.registerCommands();
	context.subscriptions.push(commandManager, editorRegistry);

	// Register txt-rich-editor specific Ctrl+L and Ctrl+K handlers
	// These intercept the void commands when a txt-rich-editor is active
	const txtRichCtrlL = vscode.commands.registerCommand(
		'txtRichEditor.ctrlL',
		async () => {
			// Get active editor
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }

			const document = editor.document;
			const fileExt = document.uri.fsPath.split('.').pop()?.toLowerCase();

			// Only handle for our file types
			if (!['txt', 'gdoc', 'docx'].includes(fileExt || '')) {
				// Let the default void.ctrlLAction handle it
				return vscode.commands.executeCommand('void.ctrlLAction');
			}

			// For txt-rich-editor, request plain text from webview
			return vscode.commands.executeCommand('txtRichEditor.webview.addToChat');
		}
	);

	const txtRichCtrlK = vscode.commands.registerCommand(
		'txtRichEditor.ctrlK',
		async () => {
			// Get active editor
			const editor = vscode.window.activeTextEditor;
			if (!editor) { return; }

			const document = editor.document;
			const fileExt = document.uri.fsPath.split('.').pop()?.toLowerCase();

			// Only handle for our file types
			if (!['txt', 'gdoc', 'docx'].includes(fileExt || '')) {
				// Let the default void.ctrlKAction handle it
				return vscode.commands.executeCommand('void.ctrlKAction');
			}

			// For txt-rich-editor, request inline edit from webview
			return vscode.commands.executeCommand('txtRichEditor.webview.inlineEdit');
		}
	);

	context.subscriptions.push(txtRichCtrlL, txtRichCtrlK);

	// Diagnostic command to test the integration
	const diagnosticCommand = vscode.commands.registerCommand(
		'txtRichEditor.diagnostic',
		async () => {
			const activeEditor = vscode.window.activeTextEditor;
			const info = [];

			info.push('=== txt-rich-editor Diagnostic ===\n');

			// Check active editor
			if (activeEditor) {
				info.push(`Active Editor: ${activeEditor.document.uri.toString()}`);
				info.push(`Scheme: ${activeEditor.document.uri.scheme}`);
				info.push(`Language: ${activeEditor.document.languageId}`);
				info.push(`Extension: ${activeEditor.document.uri.fsPath.split('.').pop()}`);
			} else {
				info.push('No active text editor');
			}

			// Check editor registry
			info.push(`\nEditor Registry:`);
			info.push(`Active editors: ${editorRegistry.getActiveEditorCount()}`);
			info.push(`Is rich text editor active: ${editorRegistry.isRichTextEditorActive()}`);

			const editorInfo = editorRegistry.getEditorInfo();
			if (editorInfo.length > 0) {
				info.push('\nRegistered editors:');
				editorInfo.forEach(e => {
					info.push(`  - ${e.uri} (${e.type}) ${e.isActive ? '← ACTIVE' : ''}`);
				});
			} else {
				info.push('No editors registered in registry');
			}

			// Check commands
			const commands = await vscode.commands.getCommands();
			const relevantCommands = commands.filter(c =>
				c.includes('txtRich') || c.includes('void')
			);
			info.push(`\nRelevant commands registered: ${relevantCommands.length}`);

			// Show result
			const message = info.join('\n');
			logger.info(message);

			// Show in a new document
			const doc = await vscode.workspace.openTextDocument({
				content: message,
				language: 'plaintext'
			});
			await vscode.window.showTextDocument(doc);
		}
	);

	context.subscriptions.push(diagnosticCommand);

	let monacoEditor: MonacoRichTextEditor | undefined;
	let webviewBridge: VoidWebviewBridge | undefined;

	if (!isWeb) {
		// Desktop: Use Monaco-based editor
		logger.info('Initializing Monaco-based rich text editor for desktop...');
		monacoEditor = new MonacoRichTextEditor(context);

		// Register the custom editor provider (webview for rich UI)
		const provider = new RichTextEditorProvider(context, logger, commandManager, documentConverter, aiDispatcher, editorRegistry);
		provider.setMonacoEditor(monacoEditor);

		// Register for text files (.txt, .gdoc)
		const textDisposable = vscode.window.registerCustomEditorProvider('txtRichEditor.editor', provider, {
			supportsMultipleEditorsPerDocument: false,
		});

		// Register DOCX editor provider (handles binary files)
		const docxProvider = new DocxEditorProvider(context, logger, commandManager, documentConverter, aiDispatcher, editorRegistry);
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
		const provider = new RichTextEditorProvider(context, logger, commandManager, documentConverter, aiDispatcher, editorRegistry);
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
			// Determine which editor to use based on file extension
			const fileExtension = uri.fsPath.split('.').pop()?.toLowerCase();
			const viewType = fileExtension === 'docx' ? 'txtRichEditor.docxEditor' : 'txtRichEditor.editor';

			// Use vscode.openWith to explicitly open with our custom editor
			vscode.commands.executeCommand('vscode.openWith', uri, viewType);
		}
	});

	// Register command to open as plain text
	const openAsPlainTextCommand = vscode.commands.registerCommand('txtRichEditor.openAsPlainText', (uri: vscode.Uri) => {
		if (uri) {
			// Open with the default text editor (bypassing custom editors)
			vscode.commands.executeCommand('vscode.openWith', uri, 'default');
		}
	});

	context.subscriptions.push(openCommand, openAsPlainTextCommand);

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


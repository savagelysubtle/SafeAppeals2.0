/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RichTextEditorProvider } from './richTextEditorProvider';

export function activate(context: vscode.ExtensionContext) {
	// Register the custom editor provider
	const provider = new RichTextEditorProvider(context);
	const disposable = vscode.window.registerCustomEditorProvider('txtRichEditor.editor', provider, {
		supportsMultipleEditorsPerDocument: false,
	});

	// Register command to open with rich editor
	const openCommand = vscode.commands.registerCommand('txtRichEditor.openWithRichEditor', (uri: vscode.Uri) => {
		if (uri) {
			vscode.commands.executeCommand('vscode.openWith', uri, 'txtRichEditor.editor');
		}
	});

	// Register export DOCX command
	const exportCommand = vscode.commands.registerCommand('txtRichEditor.exportDocx', () => {
		provider.exportDocx();
	});

	// Register import DOCX command
	const importCommand = vscode.commands.registerCommand('txtRichEditor.importDocx', () => {
		provider.importDocx();
	});

	context.subscriptions.push(disposable, openCommand, exportCommand, importCommand);
}

export function deactivate() {
	// Cleanup if needed
}

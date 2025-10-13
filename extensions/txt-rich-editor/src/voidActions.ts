/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { MonacoRichTextEditor } from './monacoRichTextEditor';
import { isWebEnvironment } from './conversion';

/**
 * Registers Ctrl+L and Ctrl+K actions for rich text editor
 */
export function registerVoidActions(
	context: vscode.ExtensionContext,
	monacoEditor: MonacoRichTextEditor | undefined
): void {

	// Register Ctrl+L action - Add selection to Void chat
	const ctrlLCommand = vscode.commands.registerCommand(
		'txtRichEditor.addToVoidChat',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) return;

			const document = editor.document;
			const fileExtension = document.uri.fsPath.split('.').pop()?.toLowerCase();

			// Only activate for our file types
			if (!['txt', 'gdoc', 'docx'].includes(fileExtension || '')) {
				return;
			}

			// Get plain text (strip HTML formatting)
			// const selection = editor.selection;

			if (!isWebEnvironment() && monacoEditor) {
				// Desktop: Monaco editor
				// Get plain text - either selection or entire file
				// const plainText = selection.isEmpty
				// 	? monacoEditor.getPlainText(document)
				// 	: document.getText(selection);

				// For now, Void integration needs to be completed
				// This will extract and use plain text when full Void service integration is available
			} else {
				// Web: Will be handled by webview bridge
				vscode.commands.executeCommand('txtRichEditor.webview.addToChat');
				return;
			}

			// Call Void's Ctrl+L command with our plain text
			// This assumes Void's API is accessible
			try {
				await vscode.commands.executeCommand('void.cmdL');
			} catch (error) {
				vscode.window.showWarningMessage(
					'Void chat integration not available. Make sure Void is installed.'
				);
			}
		}
	);

	// Register Ctrl+K action - Inline edit
	const ctrlKCommand = vscode.commands.registerCommand(
		'txtRichEditor.inlineEdit',
		async () => {
			const editor = vscode.window.activeTextEditor;
			if (!editor) return;

			const document = editor.document;
			const fileExtension = document.uri.fsPath.split('.').pop()?.toLowerCase();

			// Only activate for our file types
			if (!['txt', 'gdoc', 'docx'].includes(fileExtension || '')) {
				return;
			}

			if (!isWebEnvironment() && monacoEditor) {
				// Desktop: Monaco editor with HTML-aware editing
				const selection = editor.selection;
				const uri = document.uri;

				// Get HTML state for this document
				const htmlState = monacoEditor.getHtmlState(uri);

				if (htmlState) {
					// Extract HTML for selected range
					// Store it in a temporary state for the edit handler
					context.workspaceState.update(
						`richTextEditContext:${uri.toString()}`,
						{
							html: htmlState,
							range: {
								start: { line: selection.start.line, character: selection.start.character },
								end: { line: selection.end.line, character: selection.end.character }
							}
						}
					);
				}

				// Call Void's Ctrl+K command
				try {
					await vscode.commands.executeCommand('void.ctrlK');
				} catch (error) {
					vscode.window.showWarningMessage(
						'Void inline edit not available. Make sure Void is installed.'
					);
				}
			} else {
				// Web: Will be handled by webview bridge
				vscode.commands.executeCommand('txtRichEditor.webview.inlineEdit');
			}
		}
	);

	context.subscriptions.push(ctrlLCommand, ctrlKCommand);
}

/**
 * Check if the active editor is a rich text editor
 */
export function isRichTextEditorActive(): boolean {
	const editor = vscode.window.activeTextEditor;
	if (!editor) return false;

	const fileExtension = editor.document.uri.fsPath.split('.').pop()?.toLowerCase();
	return ['txt', 'gdoc', 'docx'].includes(fileExtension || '');
}


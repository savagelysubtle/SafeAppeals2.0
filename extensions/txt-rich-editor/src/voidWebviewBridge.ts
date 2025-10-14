/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Bridge between webview editor and Void services for web environments
 */
export class VoidWebviewBridge {
	private currentPanel: vscode.WebviewPanel | undefined;

	constructor(private readonly context: vscode.ExtensionContext) {
		this.registerCommands();
	}

	/**
	 * Set the current webview panel
	 */
	public setPanel(panel: vscode.WebviewPanel): void {
		this.currentPanel = panel;

		// Listen for messages from webview
		panel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.type) {
					case 'void-add-to-chat':
						await this.handleAddToChat(message.plainText, message.selection);
						break;
					case 'void-inline-edit':
						await this.handleInlineEdit(message.html, message.selection);
						break;
					case 'void-apply-edit':
						await this.handleApplyEdit(message.html);
						break;
				}
			},
			undefined,
			this.context.subscriptions
		);
	}

	/**
	 * Register webview-specific commands
	 */
	private registerCommands(): void {
		// Command triggered from web environment to add to chat
		const addToChatCmd = vscode.commands.registerCommand(
			'txtRichEditor.webview.addToChat',
			() => {
				if (this.currentPanel) {
					// Request plain text from webview
					this.currentPanel.webview.postMessage({
						type: 'request-plain-text-for-chat'
					});
				}
			}
		);

		// Command triggered from web environment for inline edit
		const inlineEditCmd = vscode.commands.registerCommand(
			'txtRichEditor.webview.inlineEdit',
			() => {
				if (this.currentPanel) {
					// Request HTML and selection from webview
					this.currentPanel.webview.postMessage({
						type: 'request-html-for-inline-edit'
					});
				}
			}
		);

		// Register a command that Void can call to get rich text content
		const getRichTextContentCmd = vscode.commands.registerCommand(
			'txtRichEditor.getContentForChat',
			async () => {
				return await this.getRichTextContentForChat();
			}
		);

		this.context.subscriptions.push(addToChatCmd, inlineEditCmd, getRichTextContentCmd);
	}

	/**
	 * Handle adding content to Void chat
	 */
	private async handleAddToChat(plainText: string, selection?: { start: number; end: number }): Promise<void> {
		try {
			// Get the current document URI
			const activeEditor = vscode.window.activeTextEditor;
			if (!activeEditor) {
				vscode.window.showWarningMessage('No active editor found');
				return;
			}

			const documentUri = activeEditor.document.uri;
			const language = activeEditor.document.languageId || 'plaintext';

			// Prepare the data for Void
			const voidOptions: any = {
				uri: documentUri.toString(),
				language: language,
				type: selection ? 'selection' : 'file'
			};

			// If there's a selection, include range information
			// For rich text editors, we approximate line numbers based on character offsets
			if (selection) {
				// Calculate approximate line numbers
				// This is a simplified approach - rich text doesn't have "lines" like code
				const totalText = plainText.length;
				const selectionStart = selection.start;
				const selectionEnd = selection.end;

				// Approximate: assume ~80 chars per line
				const approxStartLine = Math.floor(selectionStart / 80) + 1;
				const approxEndLine = Math.floor(selectionEnd / 80) + 1;

				voidOptions.range = [approxStartLine, approxEndLine];
			} else {
				voidOptions.range = null;
			}

			// Call Void's extension API to add content directly to chat
			try {
				await vscode.commands.executeCommand('void.addContentToChat', voidOptions);

				// Show success message
				const message = selection
					? `Added selection (${plainText.length} chars) to Void chat`
					: `Added entire document to Void chat`;
				vscode.window.showInformationMessage(message);

			} catch (voidError) {
				// If Void's API isn't available, fall back to workspace state
				console.warn('Void API not available, using fallback method:', voidError);

				await this.context.workspaceState.update('richTextChatContent', {
					text: plainText,
					selection,
					uri: documentUri.toString(),
					timestamp: Date.now()
				});

				// Try to open sidebar manually
				try {
					await vscode.commands.executeCommand('void.openSidebar');
				} catch (error) {
					vscode.window.showWarningMessage(
						'Could not add to Void chat. Make sure Void is installed and up to date.'
					);
				}
			}

		} catch (error) {
			vscode.window.showErrorMessage(
				`Could not add to Void chat: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	/**
	 * Handle inline edit request
	 */
	private async handleInlineEdit(html: string, selection?: { start: number; end: number }): Promise<void> {
		try {
			// Store the HTML context temporarily
			await this.context.workspaceState.update('richTextEditContext', {
				html,
				selection
			});

			// Call Void's inline edit command
			await vscode.commands.executeCommand('void.ctrlKAction');
		} catch (error) {
			vscode.window.showWarningMessage(
				'Could not start inline edit. Make sure Void is installed.'
			);
		}
	}

	/**
	 * Handle applying edit from Void back to webview
	 */
	private async handleApplyEdit(html: string): Promise<void> {
		if (this.currentPanel) {
			// Send edited HTML back to webview
			this.currentPanel.webview.postMessage({
				type: 'apply-html-edit',
				html
			});
		}
	}

	/**
	 * Send edited content to webview (called from extension when Void completes edit)
	 */
	public sendEditToWebview(html: string): void {
		if (this.currentPanel) {
			this.currentPanel.webview.postMessage({
				type: 'apply-html-edit',
				html
			});
		}
	}

	/**
	 * Get rich text content for chat integration
	 */
	private async getRichTextContentForChat(): Promise<{ text: string; uri: string } | null> {
		try {
			// Get the stored content from workspace state
			const storedContent = this.context.workspaceState.get('richTextChatContent') as any;

			if (storedContent && storedContent.text) {
				return {
					text: storedContent.text,
					uri: storedContent.uri || ''
				};
			}

			return null;
		} catch (error) {
			console.error('Error getting rich text content for chat:', error);
			return null;
		}
	}
}


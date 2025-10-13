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

		this.context.subscriptions.push(addToChatCmd, inlineEditCmd);
	}

	/**
	 * Handle adding content to Void chat
	 */
	private async handleAddToChat(plainText: string, selection?: { start: number; end: number }): Promise<void> {
		try {
			// Store the text temporarily
			await this.context.workspaceState.update('richTextChatContent', {
				text: plainText,
				selection
			});

			// Call Void's add to chat command
			await vscode.commands.executeCommand('void.cmdL');
		} catch (error) {
			vscode.window.showWarningMessage(
				'Could not add to Void chat. Make sure Void is installed.'
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
			await vscode.commands.executeCommand('void.ctrlK');
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
}


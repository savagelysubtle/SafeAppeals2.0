/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { RichTextEditorProvider } from './richTextEditorProvider';
import { DocxEditorProvider } from './docxEditorProvider';
import { Logger } from './logger';

export interface ActiveEditor {
	provider: RichTextEditorProvider | DocxEditorProvider;
	webviewPanel: vscode.WebviewPanel;
	document: vscode.TextDocument | vscode.CustomDocument;
	type: 'text' | 'docx';
}

export class EditorProviderRegistry {
	private readonly activeEditors = new Map<string, ActiveEditor>();
	private readonly logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Register an active editor
	 */
	registerEditor(
		documentUri: string,
		provider: RichTextEditorProvider | DocxEditorProvider,
		webviewPanel: vscode.WebviewPanel,
		document: vscode.TextDocument | vscode.CustomDocument,
		type: 'text' | 'docx'
	): void {
		this.activeEditors.set(documentUri, {
			provider,
			webviewPanel,
			document,
			type
		});

		this.logger.info(`Registered active editor: ${documentUri} (${type})`);

		// Listen for webview disposal
		webviewPanel.onDidDispose(() => {
			this.unregisterEditor(documentUri);
		});
	}

	/**
	 * Unregister an editor
	 */
	unregisterEditor(documentUri: string): void {
		if (this.activeEditors.has(documentUri)) {
			this.activeEditors.delete(documentUri);
			this.logger.info(`Unregistered editor: ${documentUri}`);
		}
	}

	/**
	 * Get the currently active editor
	 */
	getActiveEditor(): ActiveEditor | undefined {
		const activeEditor = vscode.window.activeTextEditor;
		if (!activeEditor) {
			return undefined;
		}

		const documentUri = activeEditor.document.uri.toString();
		return this.activeEditors.get(documentUri);
	}

	/**
	 * Get editor by document URI
	 */
	getEditor(documentUri: string): ActiveEditor | undefined {
		return this.activeEditors.get(documentUri);
	}

	/**
	 * Get all active editors
	 */
	getAllEditors(): ActiveEditor[] {
		return Array.from(this.activeEditors.values());
	}

	/**
	 * Check if an editor is active for the given document
	 */
	hasActiveEditor(documentUri: string): boolean {
		return this.activeEditors.has(documentUri);
	}

	/**
	 * Send message to active editor
	 */
	async sendMessageToActiveEditor(message: any): Promise<any> {
		const activeEditor = this.getActiveEditor();
		if (!activeEditor) {
			throw new Error('No active editor found');
		}

		return this.sendMessageToEditor(activeEditor.document.uri.toString(), message);
	}

	/**
	 * Send message to specific editor
	 */
	async sendMessageToEditor(documentUri: string, message: any): Promise<any> {
		const editor = this.activeEditors.get(documentUri);
		if (!editor) {
			throw new Error(`No editor found for document: ${documentUri}`);
		}

		this.logger.info(`Sending message to editor: ${message.type}`);

		// Send message to webview
		editor.webviewPanel.webview.postMessage(message);

		// For commands that need responses, we'll handle them through the provider's message handler
		return Promise.resolve();
	}

	/**
	 * Execute command on active editor
	 */
	async executeCommandOnActiveEditor(command: string, args?: any[]): Promise<any> {
		const activeEditor = this.getActiveEditor();
		if (!activeEditor) {
			throw new Error('No active editor found');
		}

		return this.executeCommandOnEditor(activeEditor.document.uri.toString(), command, args);
	}

	/**
	 * Execute command on specific editor
	 */
	async executeCommandOnEditor(documentUri: string, command: string, args?: any[]): Promise<any> {
		const message = {
			type: 'execute-command',
			data: {
				command,
				args: args || []
			},
			timestamp: Date.now()
		};

		return this.sendMessageToEditor(documentUri, message);
	}

	/**
	 * Get active editor count
	 */
	getActiveEditorCount(): number {
		return this.activeEditors.size;
	}

	/**
	 * Check if any rich text editor is active
	 */
	isRichTextEditorActive(): boolean {
		return this.getActiveEditor() !== undefined;
	}

	/**
	 * Get editor info for debugging
	 */
	getEditorInfo(): Array<{ uri: string; type: string; isActive: boolean }> {
		const activeEditor = vscode.window.activeTextEditor;
		const activeUri = activeEditor?.document.uri.toString();

		return Array.from(this.activeEditors.entries()).map(([uri, editor]) => ({
			uri,
			type: editor.type,
			isActive: uri === activeUri
		}));
	}

	/**
	 * Dispose all editors
	 */
	dispose(): void {
		this.logger.info('Disposing editor provider registry');
		this.activeEditors.clear();
	}
}

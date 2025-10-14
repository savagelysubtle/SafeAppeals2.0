/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { Logger } from '../logger';
import { EditorProviderRegistry } from '../editorProviderRegistry';

export interface CommandInfo {
	id: string;
	title: string;
	category?: string;
	icon?: string;
	enablement?: string;
	handler: (...args: any[]) => any;
}

export class CommandManager {
	private readonly disposables: vscode.Disposable[] = [];
	private readonly logger: Logger;
	private editorRegistry?: EditorProviderRegistry;

	constructor(private readonly _context: vscode.ExtensionContext, logger: Logger) {
		this.logger = logger;
	}

	/**
	 * Set the editor registry for command routing
	 */
	setEditorRegistry(registry: EditorProviderRegistry): void {
		this.editorRegistry = registry;
	}

	/**
	 * Register all commands for the rich text editor
	 */
	registerCommands(): void {
		const commands: CommandInfo[] = [
			// File operations
			{
				id: 'txtRich.newDoc',
				title: 'New Rich Document',
				icon: '$(file-add)',
				handler: this.newDoc
			},
			{
				id: 'txtRich.openDoc',
				title: 'Open Document',
				icon: '$(file)',
				handler: this.openDoc
			},
			{
				id: 'txtRich.saveDoc',
				title: 'Save Document',
				icon: '$(save)',
				enablement: 'richActive',
				handler: this.saveDoc
			},

			// Export/Import operations
			{
				id: 'txtRich.exportPdf',
				title: 'Export → PDF',
				icon: '$(export)',
				enablement: 'richActive',
				handler: this.exportPdf
			},
			{
				id: 'txtRich.exportDocx',
				title: 'Export → DOCX',
				icon: '$(export)',
				enablement: 'richActive',
				handler: this.exportDocx
			},
			{
				id: 'txtRich.importDocx',
				title: 'Import DOCX',
				icon: '$(import)',
				enablement: 'richActive',
				handler: this.importDocx
			},

			// Format operations
			{
				id: 'txtRich.format.bold',
				title: 'Bold',
				icon: '$(bold)',
				enablement: 'richActive',
				handler: this.formatBold
			},
			{
				id: 'txtRich.format.italic',
				title: 'Italic',
				icon: '$(italic)',
				enablement: 'richActive',
				handler: this.formatItalic
			},
			{
				id: 'txtRich.format.underline',
				title: 'Underline',
				icon: '$(underline)',
				enablement: 'richActive',
				handler: this.formatUnderline
			},
			{
				id: 'txtRich.format.strikethrough',
				title: 'Strikethrough',
				icon: '$(strikethrough)',
				enablement: 'richActive',
				handler: this.formatStrikethrough
			},

			// Paragraph operations
			{
				id: 'txtRich.paragraph.alignLeft',
				title: 'Align Left',
				icon: '$(align-left)',
				enablement: 'richActive',
				handler: this.alignLeft
			},
			{
				id: 'txtRich.paragraph.alignCenter',
				title: 'Align Center',
				icon: '$(align-center)',
				enablement: 'richActive',
				handler: this.alignCenter
			},
			{
				id: 'txtRich.paragraph.alignRight',
				title: 'Align Right',
				icon: '$(align-right)',
				enablement: 'richActive',
				handler: this.alignRight
			},
			{
				id: 'txtRich.paragraph.justify',
				title: 'Justify',
				icon: '$(align-justify)',
				enablement: 'richActive',
				handler: this.justify
			},

			// List operations
			{
				id: 'txtRich.list.bullet',
				title: 'Bullet List',
				icon: '$(list-unordered)',
				enablement: 'richActive',
				handler: this.bulletList
			},
			{
				id: 'txtRich.list.numbered',
				title: 'Numbered List',
				icon: '$(list-ordered)',
				enablement: 'richActive',
				handler: this.numberedList
			},

			// Style operations
			{
				id: 'txtRich.style.heading1',
				title: 'Heading 1',
				icon: '$(heading)',
				enablement: 'richActive',
				handler: this.heading1
			},
			{
				id: 'txtRich.style.heading2',
				title: 'Heading 2',
				icon: '$(heading)',
				enablement: 'richActive',
				handler: this.heading2
			},
			{
				id: 'txtRich.style.heading3',
				title: 'Heading 3',
				icon: '$(heading)',
				enablement: 'richActive',
				handler: this.heading3
			},
			{
				id: 'txtRich.style.normal',
				title: 'Normal Text',
				icon: '$(text-size)',
				enablement: 'richActive',
				handler: this.normalText
			},

			// Undo/Redo
			{
				id: 'txtRich.undo',
				title: 'Undo',
				icon: '$(undo)',
				enablement: 'richActive',
				handler: this.undo
			},
			{
				id: 'txtRich.redo',
				title: 'Redo',
				icon: '$(redo)',
				enablement: 'richActive',
				handler: this.redo
			},

			// AI operations
			{
				id: 'txtRich.ai.summarize',
				title: 'AI Summarize',
				icon: '$(sparkle)',
				enablement: 'richActive',
				handler: this.aiSummarize
			},
			{
				id: 'txtRich.ai.grammar',
				title: 'AI Grammar Check',
				icon: '$(check)',
				enablement: 'richActive',
				handler: this.aiGrammar
			},
			{
				id: 'txtRich.ai.improve',
				title: 'AI Improve Text',
				icon: '$(wand)',
				enablement: 'richActive',
				handler: this.aiImprove
			},

			// Page layout
			{
				id: 'txtRich.page.margins',
				title: 'Page Margins',
				icon: '$(layout)',
				enablement: 'richActive',
				handler: this.pageMargins
			},
			{
				id: 'txtRich.page.orientation',
				title: 'Page Orientation',
				icon: '$(rotate)',
				enablement: 'richActive',
				handler: this.pageOrientation
			},
			{
				id: 'txtRich.page.size',
				title: 'Page Size',
				icon: '$(file-media)',
				enablement: 'richActive',
				handler: this.pageSize
			},

			// View operations
			{
				id: 'txtRich.view.zoomIn',
				title: 'Zoom In',
				icon: '$(zoom-in)',
				enablement: 'richActive',
				handler: this.zoomIn
			},
			{
				id: 'txtRich.view.zoomOut',
				title: 'Zoom Out',
				icon: '$(zoom-out)',
				enablement: 'richActive',
				handler: this.zoomOut
			},
			{
				id: 'txtRich.view.zoomReset',
				title: 'Reset Zoom',
				icon: '$(zoom-reset)',
				enablement: 'richActive',
				handler: this.zoomReset
			},
			{
				id: 'txtRich.view.xmlView',
				title: 'Show XML View',
				icon: '$(code)',
				enablement: 'richActive',
				handler: this.xmlView
			},
			{
				id: 'txtRich.view.normalView',
				title: 'Normal View',
				icon: '$(file-text)',
				enablement: 'richActive',
				handler: this.normalView
			},
			{
				id: 'txtRich.view.showRulers',
				title: 'Show Rulers',
				icon: '$(ruler)',
				enablement: 'richActive',
				handler: this.showRulers
			},
			{
				id: 'txtRich.view.showMargins',
				title: 'Show Margins',
				icon: '$(layout)',
				enablement: 'richActive',
				handler: this.showMargins
			},

			// Void integration
			{
				id: 'txtRich.void.addToChat',
				title: 'Add Selection to Void Chat',
				icon: '$(comment)',
				enablement: 'richActive',
				handler: this.addToVoidChat
			},
			{
				id: 'txtRich.void.inlineEdit',
				title: 'Void Inline Edit',
				icon: '$(edit)',
				enablement: 'richActive',
				handler: this.voidInlineEdit
			},

			// Debug/Utility
			{
				id: 'txtRich.showLogs',
				title: 'Show Rich Text Editor Logs',
				icon: '$(output)',
				handler: this.showLogs
			},
			{
				id: 'txtRich.testCommand',
				title: 'Test Command Integration',
				icon: '$(test-view-icon)',
				enablement: 'richActive',
				handler: this.testCommand
			}
		];

		// Register each command
		commands.forEach(command => {
			const disposable = vscode.commands.registerCommand(command.id, command.handler.bind(this));
			this.disposables.push(disposable);
		});

		this.logger.info(`Registered ${commands.length} commands`);
	}

	/**
	 * Execute command on active editor
	 */
	private async executeOnActiveEditor(command: string, args?: any[]): Promise<void> {
		if (!this.editorRegistry) {
			this.logger.warn(`No editor registry available for command: ${command}`);
			return;
		}

		try {
			await this.editorRegistry.executeCommandOnActiveEditor(command, args);
			this.logger.info(`Command executed successfully: ${command}`);
		} catch (error) {
			this.logger.error(`Failed to execute command ${command}:`, error);
			vscode.window.showErrorMessage(`Failed to execute ${command}: ${error}`);
		}
	}

	/**
	 * Dispose all registered commands
	 */
	dispose(): void {
		this.disposables.forEach(disposable => disposable.dispose());
		this.disposables.length = 0;
	}

	// File operation handlers
	private async newDoc(): Promise<void> {
		this.logger.info('Creating new rich document');
		// Implementation will be added when we integrate with the editor providers
	}

	private async openDoc(): Promise<void> {
		this.logger.info('Opening document');
		// Implementation will be added when we integrate with the editor providers
	}

	private async saveDoc(): Promise<void> {
		this.logger.info('Saving document');
		// Implementation will be added when we integrate with the editor providers
	}

	// Export/Import handlers
	private async exportPdf(): Promise<void> {
		this.logger.info('Exporting to PDF');
		// Implementation will be added when we integrate with the editor providers
	}

	private async exportDocx(): Promise<void> {
		this.logger.info('Exporting to DOCX');
		// Implementation will be added when we integrate with the editor providers
	}

	private async importDocx(): Promise<void> {
		this.logger.info('Importing DOCX');
		// Implementation will be added when we integrate with the editor providers
	}

	// Format handlers
	private async formatBold(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.format.bold');
	}

	private async formatItalic(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.format.italic');
	}

	private async formatUnderline(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.format.underline');
	}

	private async formatStrikethrough(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.format.strikethrough');
	}

	// Paragraph handlers
	private async alignLeft(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.paragraph.alignLeft');
	}

	private async alignCenter(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.paragraph.alignCenter');
	}

	private async alignRight(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.paragraph.alignRight');
	}

	private async justify(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.paragraph.justify');
	}

	// List handlers
	private async bulletList(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.list.bullet');
	}

	private async numberedList(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.list.numbered');
	}

	// Style handlers
	private async heading1(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.style.heading1');
	}

	private async heading2(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.style.heading2');
	}

	private async heading3(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.style.heading3');
	}

	private async normalText(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.style.normal');
	}

	// Undo/Redo handlers
	private async undo(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.undo');
	}

	private async redo(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.redo');
	}

	// AI handlers
	private async aiSummarize(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.ai.summarize');
	}

	private async aiGrammar(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.ai.grammar');
	}

	private async aiImprove(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.ai.improve');
	}

	// Page layout handlers
	private async pageMargins(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.page.margins');
	}

	private async pageOrientation(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.page.orientation');
	}

	private async pageSize(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.page.size');
	}

	// View handlers
	private async zoomIn(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.view.zoomIn');
	}

	private async zoomOut(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.view.zoomOut');
	}

	private async zoomReset(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.view.zoomReset');
	}

	private async xmlView(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.view.xmlView');
	}

	private async normalView(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.view.normalView');
	}

	private async showRulers(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.view.showRulers');
	}

	private async showMargins(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.view.showMargins');
	}

	// Void integration handlers
	private async addToVoidChat(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.void.addToChat');
	}

	private async voidInlineEdit(): Promise<void> {
		await this.executeOnActiveEditor('txtRich.void.inlineEdit');
	}

	// Debug/Utility handlers
	private async showLogs(): Promise<void> {
		this.logger.show();
	}

	private async testCommand(): Promise<void> {
		this.logger.info('Testing command integration...');

		if (!this.editorRegistry) {
			vscode.window.showErrorMessage('Editor registry not available');
			return;
		}

		const activeEditor = this.editorRegistry.getActiveEditor();
		if (!activeEditor) {
			vscode.window.showErrorMessage('No active rich text editor found');
			return;
		}

		try {
			// Test sending a command to the webview
			await this.editorRegistry.sendMessageToActiveEditor({
				type: 'execute-webview-command',
				data: {
					command: 'bold',
					args: []
				}
			});

			vscode.window.showInformationMessage('✅ Command integration test successful! Bold formatting applied.');
			this.logger.info('Command integration test completed successfully');
		} catch (error) {
			vscode.window.showErrorMessage(`❌ Command integration test failed: ${error}`);
			this.logger.error('Command integration test failed:', error);
		}
	}
}

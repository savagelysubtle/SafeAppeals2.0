/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DocumentConverter, docxToHtmlWithLayout, htmlToDocxBuffer } from './conversion';
import { Logger } from './logger';
import { generateRibbonHtml } from './ribbonHtml';
import { EditorProviderRegistry } from './editorProviderRegistry';

/**
 * Custom editor provider for DOCX files (binary files)
 * Uses CustomReadonlyEditorProvider since DOCX files are binary ZIP archives
 */
export class DocxEditorProvider implements vscode.CustomReadonlyEditorProvider<vscode.CustomDocument> {
	private currentDocument: vscode.CustomDocument | undefined;
	private currentHtml: string = '';
	private currentPageLayout: any = null;
	private currentXml: string = '';

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly logger: Logger,
		private readonly _commandManager?: any,
		private readonly _documentConverter?: DocumentConverter,
		private readonly _aiDispatcher?: any,
		private readonly _editorRegistry?: EditorProviderRegistry
	) { }

	async openCustomDocument(
		uri: vscode.Uri,
		_openContext: vscode.CustomDocumentOpenContext,
		_token: vscode.CancellationToken
	): Promise<vscode.CustomDocument> {
		this.logger.info(`Opening DOCX file: ${uri.fsPath}`);

		return {
			uri,
			dispose: () => {
				this.logger.trace('DOCX document disposed');
			}
		};
	}

	async resolveCustomEditor(
		document: vscode.CustomDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken
	): Promise<void> {
		this.currentDocument = document;

		// Register with editor registry for command routing
		if (this._editorRegistry) {
			this._editorRegistry.registerEditor(
				document.uri.toString(),
				this,
				webviewPanel,
				document,
				'docx'
			);
		}

		// Setup webview
		webviewPanel.webview.options = {
			enableScripts: true,
		};

		// Set the webview's HTML content
		webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

		// Handle messages from the webview
		webviewPanel.webview.onDidReceiveMessage(
			async (message) => {
				switch (message.type) {
					case 'ready':
						await this.loadDocxContent(document.uri, webviewPanel);
						return;
					case 'request-export-docx':
						await this.handleExportDocx(message.html);
						return;
					case 'request-xml-view':
						await this.handleXmlViewRequest(webviewPanel);
						return;
					case 'request-normal-view':
						await this.handleNormalViewRequest(webviewPanel);
						return;
					case 'content-updated':
						// Store the current HTML for export
						this.currentHtml = message.html;
						return;
				}
			},
			undefined,
			this.context.subscriptions
		);
	}

	private async loadDocxContent(uri: vscode.Uri, webviewPanel: vscode.WebviewPanel): Promise<void> {
		try {
			this.logger.info('=== DOCX EDITOR PROVIDER: Starting DOCX load ===');
			this.logger.info(`File: ${uri.fsPath}`);

			// Read the DOCX file as binary
			const fileData = await vscode.workspace.fs.readFile(uri);
			this.logger.info(`DOCX file size: ${fileData.length} bytes`);

			// Convert DOCX to HTML
			this.logger.info('Calling docxToHtmlWithLayout...');
			const result = await docxToHtmlWithLayout(fileData);
			if (!result.success) {
				throw new Error(result.error || 'Failed to convert DOCX to HTML');
			}

			this.logger.info('✅ DOCX converted to HTML successfully');
			this.logger.info(`HTML length: ${result.content?.length || 0} characters`);
			this.logger.info(`HTML preview: ${result.content?.substring(0, 200)}...`);

			this.currentHtml = result.content || '';
			this.currentPageLayout = result.pageLayout;

			// Store the original XML for XML view
			if (this._documentConverter) {
				try {
					const xmlResult = await this._documentConverter.xmlHandler.parseDocx(fileData);
					this.currentXml = xmlResult.xml;
					this.logger.info('Stored original XML for XML view');
				} catch (error) {
					this.logger.warn(`Failed to store original XML: ${error}`);
				}
			}

			// Send to webview
			this.logger.info('Sending content to webview...');
			webviewPanel.webview.postMessage({
				type: 'set-content',
				content: result.content || '',
				isHtml: true,
				readonly: false, // Allow editing
				pageLayout: result.pageLayout
			});
			this.logger.info('✅ Content sent to webview');
			this.logger.info('=== END DOCX EDITOR PROVIDER ===');
		} catch (error) {
			this.logger.error('❌ Failed to load DOCX content', error);
			const errorMessage = error instanceof Error ? error.message : String(error);

			vscode.window.showErrorMessage(`Failed to open DOCX file: ${errorMessage}`);

			// Show error in webview
			webviewPanel.webview.postMessage({
				type: 'set-content',
				content: `<p style="color: red;">Error loading DOCX file: ${errorMessage}</p>`,
				isHtml: true,
				readonly: true
			});
		}
	}

	private async handleExportDocx(html: string): Promise<void> {
		if (!this.currentDocument) {
			this.logger.error('Export DOCX: No document available');
			vscode.window.showErrorMessage('No document available for export');
			return;
		}

		try {
			this.logger.info('Starting DOCX export...');
			const buffer = await htmlToDocxBuffer(html);
			this.logger.trace(`Generated DOCX buffer: ${buffer.length} bytes`);

			// Suggest filename based on current document
			const fileName = this.currentDocument.uri.fsPath;
			const lastDotIndex = fileName.lastIndexOf('.');
			const baseName = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
			const lastSlashIndex = Math.max(fileName.lastIndexOf('/'), fileName.lastIndexOf('\\'));
			const dirName = lastSlashIndex > 0 ? fileName.substring(0, lastSlashIndex + 1) : '';
			const suggestedPath = dirName + baseName.substring(baseName.lastIndexOf('\\') + 1) + '_edited.docx';

			const uri = await vscode.window.showSaveDialog({
				defaultUri: vscode.Uri.file(suggestedPath),
				filters: {
					'Word Documents': ['docx']
				}
			});

			if (uri) {
				await vscode.workspace.fs.writeFile(uri, buffer);
				this.logger.info(`Document exported successfully to: ${uri.fsPath}`);
				vscode.window.showInformationMessage(`Document exported to ${uri.fsPath}`);
			} else {
				this.logger.info('DOCX export cancelled by user');
			}
		} catch (error) {
			this.logger.error('Failed to export DOCX', error);
			const errorMessage = error instanceof Error ? error.message : String(error);
			vscode.window.showErrorMessage(`Failed to export DOCX: ${errorMessage}`);
		}
	}

	public async exportDocx(): Promise<void> {
		if (this.currentHtml) {
			await this.handleExportDocx(this.currentHtml);
		} else {
			vscode.window.showErrorMessage('No content available to export');
		}
	}

	private async handleXmlViewRequest(webviewPanel: vscode.WebviewPanel): Promise<void> {
		try {
			if (this.currentXml) {
				this.logger.info('Sending XML view to webview');
				webviewPanel.webview.postMessage({
					type: 'set-xml-content',
					content: this.currentXml
				});
			} else {
				this.logger.warn('No XML content available for XML view');
				webviewPanel.webview.postMessage({
					type: 'set-xml-content',
					content: 'No XML content available. Please reload the document.'
				});
			}
		} catch (error) {
			this.logger.error('Failed to handle XML view request:', error);
		}
	}

	private async handleNormalViewRequest(webviewPanel: vscode.WebviewPanel): Promise<void> {
		try {
			this.logger.info('Sending normal view to webview');
			webviewPanel.webview.postMessage({
				type: 'set-content',
				content: this.currentHtml,
				isHtml: true,
				readonly: false,
				pageLayout: this.currentPageLayout
			});
		} catch (error) {
			this.logger.error('Failed to handle normal view request:', error);
		}
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		return generateRibbonHtml(webview, 'docx');
	}
}


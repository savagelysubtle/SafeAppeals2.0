/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DocumentConverter, docxToHtmlWithLayout, htmlToDocxBuffer } from './conversion';
import { Logger } from './logger';
import { generateRibbonHtml } from './ribbonHtml';
import { EditorProviderRegistry } from './editorProviderRegistry';
import { MarginController, PageLayout } from './marginController';
import { DocxPageLayout } from './docxXmlHandler';

/**
 * Custom editor provider for DOCX files (binary files)
 * Uses CustomReadonlyEditorProvider since DOCX files are binary ZIP archives
 */
export class DocxEditorProvider implements vscode.CustomReadonlyEditorProvider<vscode.CustomDocument> {
	private currentDocument: vscode.CustomDocument | undefined;
	private currentHtml: string = '';
	private currentPageLayout: DocxPageLayout | null = null;
	private currentXml: string = '';
	private currentWebviewPanel: vscode.WebviewPanel | undefined;
	private marginController: MarginController;

	constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly logger: Logger,
		private readonly _commandManager?: any,
		private readonly _documentConverter?: DocumentConverter,
		private readonly _aiDispatcher?: any,
		private readonly _editorRegistry?: EditorProviderRegistry
	) {
		// Initialize MarginController with default Letter page settings
		this.marginController = new MarginController(logger, {
			margins: { top: 96, right: 96, bottom: 96, left: 96 }, // 1 inch at 96 DPI
			orientation: 'portrait',
			size: { width: 816, height: 1056, name: 'Letter' },
			zoom: 1.0
		});

		// Listen for layout changes and sync to webview
		this.marginController.on('layout-changed', (layout: PageLayout) => {
			this.sendLayoutToWebview(layout);
		});
	}

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
		this.currentWebviewPanel = webviewPanel;

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
					case 'page-layout-update':
						// Handle page layout updates from webview (margin drags, etc.)
						await this.handlePageLayoutUpdate(message.data);
						return;
					case 'request-page-layout':
						// Send current page layout to webview
						this.sendLayoutToWebview(this.marginController.getLayout());
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
			this.currentPageLayout = result.pageLayout || null;

			// Update MarginController with DOCX layout if available
			if (result.pageLayout) {
				this.applyDocxLayoutToController(result.pageLayout);
			}

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
				pageLayout: this.convertLayoutForWebview(this.marginController.getLayout())
			});
			this.logger.info('✅ Content sent to webview');

			// Send the layout after content to ensure webview is ready
			setTimeout(() => {
				this.sendLayoutToWebview(this.marginController.getLayout());
			}, 100);

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
				pageLayout: this.convertLayoutForWebview(this.marginController.getLayout())
			});
		} catch (error) {
			this.logger.error('Failed to handle normal view request:', error);
		}
	}

	/**
	 * Convert DOCX page layout (twips) to MarginController layout (pixels)
	 */
	private applyDocxLayoutToController(docxLayout: DocxPageLayout): void {
		// Convert twips to pixels (1 twip = 1/20 point, 1 point = 1.33 pixels at 96 DPI)
		const twipsToPixels = (twips: number) => Math.round(twips * 1.33 / 20);

		const marginsPx = {
			top: twipsToPixels(docxLayout.margins.top),
			right: twipsToPixels(docxLayout.margins.right),
			bottom: twipsToPixels(docxLayout.margins.bottom),
			left: twipsToPixels(docxLayout.margins.left)
		};

		const pageSizePx = {
			width: twipsToPixels(docxLayout.pageSize.width),
			height: twipsToPixels(docxLayout.pageSize.height),
			name: this.getPageSizeName(twipsToPixels(docxLayout.pageSize.width), twipsToPixels(docxLayout.pageSize.height))
		};

		this.marginController.setLayout({
			margins: marginsPx,
			orientation: docxLayout.orientation,
			size: pageSizePx
		});

		this.logger.info(`Applied DOCX layout to controller: ${JSON.stringify({ margins: marginsPx, size: pageSizePx, orientation: docxLayout.orientation })}`);
	}

	/**
	 * Determine page size name from dimensions
	 */
	private getPageSizeName(width: number, height: number): string {
		const sizes = [
			{ name: 'Letter', width: 816, height: 1056 },
			{ name: 'A4', width: 794, height: 1123 },
			{ name: 'Legal', width: 816, height: 1344 },
			{ name: 'Tabloid', width: 1056, height: 1632 }
		];

		for (const size of sizes) {
			if (Math.abs(width - size.width) < 10 && Math.abs(height - size.height) < 10) {
				return size.name;
			}
		}

		return 'Custom';
	}

	/**
	 * Send page layout to webview
	 */
	private sendLayoutToWebview(layout: PageLayout): void {
		if (this.currentWebviewPanel) {
			this.currentWebviewPanel.webview.postMessage({
				type: 'page-layout-changed',
				pageLayout: this.convertLayoutForWebview(layout)
			});
		}
	}

	/**
	 * Convert MarginController layout to webview format (pixels)
	 */
	private convertLayoutForWebview(layout: PageLayout): any {
		return {
			margins: {
				top: layout.margins.top,
				right: layout.margins.right,
				bottom: layout.margins.bottom,
				left: layout.margins.left
			},
			pageSize: {
				width: layout.size.width,
				height: layout.size.height,
				name: layout.size.name
			},
			orientation: layout.orientation,
			zoom: layout.zoom
		};
	}

	/**
	 * Handle page layout updates from webview
	 */
	private async handlePageLayoutUpdate(data: any): Promise<void> {
		try {
			if (data.margins) {
				this.marginController.setMargins(data.margins);
			}
			if (data.orientation) {
				this.marginController.setOrientation(data.orientation);
			}
			if (data.pageSize) {
				this.marginController.setPageSize(data.pageSize);
			}
			if (data.zoom !== undefined) {
				this.marginController.setZoom(data.zoom);
			}
		} catch (error) {
			this.logger.error('Failed to update page layout:', error);
		}
	}

	private getHtmlForWebview(webview: vscode.Webview): string {
		return generateRibbonHtml(webview, 'docx');
	}
}


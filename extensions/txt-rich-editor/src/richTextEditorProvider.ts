/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DocumentConverter, isWebEnvironment, docxToHtml, htmlToDocxBuffer, readDocxFile, writeDocxFile } from './conversion';
import { MonacoRichTextEditor } from './monacoRichTextEditor';
import { VoidWebviewBridge } from './voidWebviewBridge';
import { Logger } from './logger';
import { EditorProviderRegistry } from './editorProviderRegistry';
import { MarginController, PageLayout } from './marginController';
import { generateRibbonHtml } from './ribbonHtml';

export class RichTextEditorProvider implements vscode.CustomTextEditorProvider {
    private currentDocument: vscode.TextDocument | undefined;
    private currentWebviewPanel: vscode.WebviewPanel | undefined;
    // private _monacoEditor: MonacoRichTextEditor | undefined; // For future desktop/Monaco integration
    private webviewBridge: VoidWebviewBridge | undefined;
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

    public setMonacoEditor(_editor: MonacoRichTextEditor): void {
        // this._monacoEditor = editor;
        // Monaco editor integration reserved for future implementation
    }

    public setWebviewBridge(bridge: VoidWebviewBridge): void {
        this.webviewBridge = bridge;
    }

    public async resolveCustomTextEditor(
        document: vscode.TextDocument,
        webviewPanel: vscode.WebviewPanel,
        _token: vscode.CancellationToken
    ): Promise<void> {
        this.logger.info(`Opening file: ${document.uri.fsPath}`);
        this.logger.trace(`File size: ${document.getText().length} characters`);

        this.currentDocument = document;
        this.currentWebviewPanel = webviewPanel;

        // Register with editor registry for command routing
        if (this._editorRegistry) {
            this._editorRegistry.registerEditor(
                document.uri.toString(),
                this,
                webviewPanel,
                document,
                'text'
            );
        }

        // If webview bridge is available (web environment), register the panel
        if (this.webviewBridge) {
            this.webviewBridge.setPanel(webviewPanel);
        }

        // Setup webview
        webviewPanel.webview.options = {
            enableScripts: true,
        };

        // Set the webview's initial html content
        webviewPanel.webview.html = this.getHtmlForWebview(webviewPanel.webview);

        // Handle messages from the webview
        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'edit':
                        this.updateDocument(document, message.edits);
                        return;
                    case 'ready':
                        // Send initial content to webview
                        await this.sendInitialContent(document, webviewPanel);
                        return;
                    case 'request-export-docx':
                        await this.handleExportDocx(message.html);
                        return;
                    case 'request-import-docx':
                        await this.handleImportDocx(webviewPanel);
                        return;
                    case 'content-updated':
                        // Content was updated in webview, sync if needed
                        return;
                    case 'execute-command':
                        // Handle command execution from webview
                        await this.handleCommandExecution(message.data);
                        return;
                    case 'command-response':
                        // Handle command response from webview
                        this.logger.info(`Command response: ${message.data.success ? 'success' : 'failed'}`);
                        return;
                    case 'request-xml-view':
                        // Handle XML view request
                        await this.handleXmlViewRequest(webviewPanel);
                        return;
                    case 'request-normal-view':
                        // Handle normal view request
                        await this.handleNormalViewRequest(webviewPanel);
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

        // Handle document changes
        const changeDocumentSubscription = vscode.workspace.onDidChangeTextDocument(e => {
            if (e.document.uri.toString() === document.uri.toString()) {
                webviewPanel.webview.postMessage({
                    type: 'content',
                    content: document.getText()
                });
            }
        });

        webviewPanel.onDidDispose(() => {
            changeDocumentSubscription.dispose();
        });
    }

    private updateDocument(document: vscode.TextDocument, edits: any[]) {
        const edit = new vscode.WorkspaceEdit();

        for (const change of edits) {
            edit.replace(
                document.uri,
                new vscode.Range(
                    document.positionAt(change.start),
                    document.positionAt(change.end)
                ),
                change.text
            );
        }

        return vscode.workspace.applyEdit(edit);
    }

    private async sendInitialContent(document: vscode.TextDocument, webviewPanel: vscode.WebviewPanel): Promise<void> {
        const documentType = this.getDocumentType();

        if (documentType === 'docx') {
            try {
                this.logger.info('Attempting to load DOCX file...');
                // Load DOCX file and convert to HTML
                const buffer = await readDocxFile(document.uri.fsPath);
                this.logger.trace(`DOCX file loaded: ${buffer.length} bytes`);

                const html = await docxToHtml(buffer);
                this.logger.info('DOCX successfully converted to HTML');
                this.logger.trace(`HTML length: ${html.length} characters`);

                webviewPanel.webview.postMessage({
                    type: 'set-content',
                    content: html,
                    isHtml: true
                });
            } catch (error) {
                // Fall back to plain text if conversion fails
                this.logger.error('Failed to load DOCX content', error);
                const errorMessage = error instanceof Error ? error.message : String(error);

                vscode.window.showWarningMessage(`Failed to load DOCX content: ${errorMessage}. Falling back to plain text.`);

                webviewPanel.webview.postMessage({
                    type: 'set-content',
                    content: document.getText(),
                    isHtml: false
                });
            }
        } else {
            // For .txt and .gdoc files, send plain text
            this.logger.trace(`Loading ${documentType} file as plain text`);
            webviewPanel.webview.postMessage({
                type: 'set-content',
                content: document.getText(),
                isHtml: false,
                pageLayout: this.convertLayoutForWebview(this.marginController.getLayout())
            });
        }

        // Send initial page layout after a short delay to ensure webview is ready
        setTimeout(() => {
            this.sendLayoutToWebview(this.marginController.getLayout());
        }, 100);
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
            const fileName = this.currentDocument.fileName;
            const lastDotIndex = fileName.lastIndexOf('.');
            const baseName = lastDotIndex > 0 ? fileName.substring(0, lastDotIndex) : fileName;
            const dirName = fileName.substring(0, fileName.lastIndexOf('/') + 1);
            const suggestedPath = dirName + baseName + '.docx';

            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(suggestedPath),
                filters: {
                    'Word Documents': ['docx']
                }
            });

            if (uri) {
                await writeDocxFile(uri.fsPath, buffer);
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

    private async handleImportDocx(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            this.logger.info('Starting DOCX import...');
            const uri = await vscode.window.showOpenDialog({
                filters: {
                    'Word Documents': ['docx']
                },
                canSelectMany: false
            });

            if (uri && uri.length > 0) {
                this.logger.info(`Importing DOCX from: ${uri[0].fsPath}`);
                const buffer = await readDocxFile(uri[0].fsPath);
                this.logger.trace(`DOCX file loaded: ${buffer.length} bytes`);

                const html = await docxToHtml(buffer);
                this.logger.info('DOCX successfully converted to HTML');
                this.logger.trace(`HTML length: ${html.length} characters`);

                webviewPanel.webview.postMessage({
                    type: 'set-content',
                    content: html,
                    isHtml: true
                });

                vscode.window.showInformationMessage(`DOCX imported from ${uri[0].fsPath}`);
            } else {
                this.logger.info('DOCX import cancelled by user');
            }
        } catch (error) {
            this.logger.error('Failed to import DOCX', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            vscode.window.showErrorMessage(`Failed to import DOCX: ${errorMessage}`);
        }
    }

    public async exportDocx(): Promise<void> {
        if (!this.currentWebviewPanel) {
            vscode.window.showErrorMessage('No editor available for export');
            return;
        }

        // Request HTML content from webview
        this.currentWebviewPanel.webview.postMessage({
            type: 'request-html-for-export'
        });
    }

    public async importDocx(): Promise<void> {
        if (!this.currentWebviewPanel) {
            vscode.window.showErrorMessage('No editor available for import');
            return;
        }

        await this.handleImportDocx(this.currentWebviewPanel);
    }

    private async handleCommandExecution(commandData: { command: string; args?: any[] }): Promise<void> {
        try {
            this.logger.info(`Executing command: ${commandData.command}`);

            // Map VS Code commands to webview actions
            const commandMap: { [key: string]: string } = {
                'txtRich.format.bold': 'bold',
                'txtRich.format.italic': 'italic',
                'txtRich.format.underline': 'underline',
                'txtRich.format.strikethrough': 'strikethrough',
                'txtRich.paragraph.alignLeft': 'alignLeft',
                'txtRich.paragraph.alignCenter': 'alignCenter',
                'txtRich.paragraph.alignRight': 'alignRight',
                'txtRich.paragraph.justify': 'justify',
                'txtRich.list.bullet': 'bulletList',
                'txtRich.list.numbered': 'numberList',
                'txtRich.style.heading1': 'heading1',
                'txtRich.style.heading2': 'heading2',
                'txtRich.style.heading3': 'heading3',
                'txtRich.style.normal': 'normalText',
                'txtRich.undo': 'undo',
                'txtRich.redo': 'redo',
                'txtRich.view.zoomIn': 'zoomIn',
                'txtRich.view.zoomOut': 'zoomOut',
                'txtRich.view.zoomReset': 'zoomReset',
                'txtRich.view.xmlView': 'xmlView',
                'txtRich.view.normalView': 'normalView',
                'txtRich.view.showRulers': 'showRulers',
                'txtRich.view.showMargins': 'showMargins',
                'txtRich.void.addToChat': 'addToChat',
                'txtRich.void.inlineEdit': 'inlineEdit'
            };

            const webviewCommand = commandMap[commandData.command];
            if (webviewCommand && this.currentWebviewPanel) {
                // Send command to webview for execution
                this.currentWebviewPanel.webview.postMessage({
                    type: 'execute-webview-command',
                    data: {
                        command: webviewCommand,
                        args: commandData.args || []
                    }
                });
            } else {
                this.logger.warn(`Unknown command: ${commandData.command}`);
            }
        } catch (error) {
            this.logger.error(`Failed to execute command ${commandData.command}:`, error);
        }
    }

    private async handleXmlViewRequest(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            if (!this.currentDocument) {
                this.logger.warn('No current document for XML view');
                return;
            }

            const documentType = this.getDocumentType();
            if (documentType === 'docx') {
                // For DOCX files, we need to get the raw XML
                // This would require storing the original XML during conversion
                this.logger.info('XML view requested for DOCX file');
                webviewPanel.webview.postMessage({
                    type: 'set-xml-content',
                    content: 'XML view for DOCX files requires storing original XML during conversion. This feature is not yet implemented.'
                });
            } else {
                // For text files, show the raw content
                const content = this.currentDocument.getText();
                webviewPanel.webview.postMessage({
                    type: 'set-xml-content',
                    content: content
                });
            }
        } catch (error) {
            this.logger.error('Failed to handle XML view request:', error);
        }
    }

    private async handleNormalViewRequest(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            if (!this.currentDocument) {
                this.logger.warn('No current document for normal view');
                return;
            }

            // Send the normal content back to the webview
            await this.sendInitialContent(this.currentDocument, webviewPanel);
        } catch (error) {
            this.logger.error('Failed to handle normal view request:', error);
        }
    }

    private getDocumentType(): string {
        if (!this.currentDocument) {
            return 'txt';
        }

        const fileName = this.currentDocument.fileName.toLowerCase();
        if (fileName.endsWith('.gdoc')) {
            return 'gdoc';
        } else if (fileName.endsWith('.docx')) {
            return 'docx';
        }
        return 'txt';
    }

    private sendLayoutToWebview(layout: PageLayout): void {
        if (this.currentWebviewPanel) {
            this.currentWebviewPanel.webview.postMessage({
                type: 'page-layout-changed',
                pageLayout: this.convertLayoutForWebview(layout)
            });
        }
    }

    private async handlePageLayoutUpdate(data: any): Promise<void> {
        try {
            this.logger.info('Handling page layout update from webview');

            // Update margin controller with new layout data
            if (data.margins) {
                this.marginController.setMargins(data.margins);
            }

            if (data.orientation) {
                this.marginController.setOrientation(data.orientation);
            }

            if (data.size) {
                this.marginController.setPageSize(data.size);
            }

            if (data.zoom) {
                this.marginController.setZoom(data.zoom);
            }

            this.logger.info('Page layout updated successfully');
        } catch (error) {
            this.logger.error('Failed to handle page layout update:', error);
        }
    }

    private convertLayoutForWebview(layout: PageLayout): any {
        return {
            margins: layout.margins,
            orientation: layout.orientation,
            size: layout.size,
            zoom: layout.zoom,
            contentArea: this.marginController.getContentArea()
        };
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        // Get file extension to determine document type
        const documentType = this.getDocumentType();
        return generateRibbonHtml(webview, documentType);
    }
}

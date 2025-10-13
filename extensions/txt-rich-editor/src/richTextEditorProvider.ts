/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { docxToHtml, htmlToDocxBuffer, readDocxFile, writeDocxFile, isWebEnvironment } from './conversion';
import { MonacoRichTextEditor } from './monacoRichTextEditor';
import { VoidWebviewBridge } from './voidWebviewBridge';

export class RichTextEditorProvider implements vscode.CustomTextEditorProvider {
    private currentDocument: vscode.TextDocument | undefined;
    private currentWebviewPanel: vscode.WebviewPanel | undefined;
    // private _monacoEditor: MonacoRichTextEditor | undefined; // For future desktop/Monaco integration
    private webviewBridge: VoidWebviewBridge | undefined;

    constructor(private readonly context: vscode.ExtensionContext) { }

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
        this.currentDocument = document;
        this.currentWebviewPanel = webviewPanel;

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
                // Load DOCX file and convert to HTML
                const buffer = await readDocxFile(document.uri.fsPath);
                const html = await docxToHtml(buffer);
                webviewPanel.webview.postMessage({
                    type: 'set-content',
                    content: html,
                    isHtml: true
                });
            } catch (error) {
                // Fall back to plain text if conversion fails
                vscode.window.showWarningMessage(`Failed to load DOCX content: ${error}. Falling back to plain text.`);
                webviewPanel.webview.postMessage({
                    type: 'set-content',
                    content: document.getText(),
                    isHtml: false
                });
            }
        } else {
            // For .txt and .gdoc files, send plain text
            webviewPanel.webview.postMessage({
                type: 'set-content',
                content: document.getText(),
                isHtml: false
            });
        }
    }

    private async handleExportDocx(html: string): Promise<void> {
        if (!this.currentDocument) {
            vscode.window.showErrorMessage('No document available for export');
            return;
        }

        try {
            const buffer = await htmlToDocxBuffer(html);

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
                vscode.window.showInformationMessage(`Document exported to ${uri.fsPath}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to export DOCX: ${error}`);
        }
    }

    private async handleImportDocx(webviewPanel: vscode.WebviewPanel): Promise<void> {
        try {
            const uri = await vscode.window.showOpenDialog({
                filters: {
                    'Word Documents': ['docx']
                },
                canSelectMany: false
            });

            if (uri && uri.length > 0) {
                const buffer = await readDocxFile(uri[0].fsPath);
                const html = await docxToHtml(buffer);

                webviewPanel.webview.postMessage({
                    type: 'set-content',
                    content: html,
                    isHtml: true
                });

                vscode.window.showInformationMessage(`DOCX imported from ${uri[0].fsPath}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to import DOCX: ${error}`);
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

    private getHtmlForWebview(_webview: vscode.Webview): string {
        // Get file extension to determine document type
        const documentType = this.getDocumentType();
        const isWeb = isWebEnvironment();

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rich Text Editor</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            margin: 0;
            padding: 0;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        /* Ribbon UI Styles */
        .ribbon {
            background: linear-gradient(to bottom, #f8f8f8 0%, #e8e8e8 100%);
            border-bottom: 1px solid #d0d0d0;
            padding: 8px 12px;
            display: flex;
            flex-direction: column;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }

        .ribbon-tabs {
            display: flex;
            margin-bottom: 8px;
        }

        .ribbon-tab {
            background: transparent;
            border: none;
            padding: 6px 12px;
            cursor: pointer;
            font-size: 13px;
            color: #333;
            border-radius: 3px 3px 0 0;
            margin-right: 2px;
        }

        .ribbon-tab.active {
            background: white;
            border: 1px solid #d0d0d0;
            border-bottom: none;
            color: #000;
        }

        .ribbon-content {
            background: white;
            border: 1px solid #d0d0d0;
            border-top: none;
            padding: 12px;
            display: flex;
            flex-wrap: wrap;
            gap: 16px;
        }

        .ribbon-group {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
        }

        .ribbon-group-title {
            font-size: 11px;
            color: #666;
            margin-bottom: 6px;
            font-weight: bold;
        }

        .ribbon-group-content {
            display: flex;
            gap: 2px;
            align-items: center;
        }

        .ribbon-button {
            background: transparent;
            border: 1px solid transparent;
            padding: 6px 8px;
            cursor: pointer;
            font-size: 12px;
            color: #333;
            border-radius: 3px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 28px;
            height: 28px;
        }

        .ribbon-button:hover {
            background: #e6f3ff;
            border-color: #b3d9ff;
        }

        .ribbon-button.active {
            background: #cce7ff;
            border-color: #99d6ff;
        }

        .ribbon-button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .ribbon-button:disabled:hover {
            background: transparent;
            border-color: transparent;
        }

        .ribbon-select {
            background: white;
            border: 1px solid #ccc;
            padding: 4px 6px;
            font-size: 12px;
            border-radius: 3px;
            min-width: 80px;
        }

        .ribbon-select:hover {
            border-color: #999;
        }

        /* Editor container with layered elements */
        .editor-container {
            position: relative;
            flex: 1;
            overflow: hidden;
            background-color: #ffffff;
            box-shadow: inset 0 1px 3px rgba(0,0,0,0.05);
            display: flex;
            justify-content: center;
        }

        .editor-canvas-layer {
            position: absolute;
            top: 0;
            left: 60px; /* Left margin for line numbers */
            right: 0;
            bottom: 0;
            z-index: 1;
            pointer-events: none;
        }

        .ruler-top {
            position: absolute;
            top: 0;
            left: 60px;
            right: 0;
            height: 32px;
            background: linear-gradient(to bottom, #fafafa 0%, #ececec 100%);
            border-bottom: 1px solid #c0c0c0;
            z-index: 10;
            box-shadow: 0 1px 2px rgba(0,0,0,0.05);
        }

        .margin-left {
            position: absolute;
            left: 0;
            top: 0;
            width: 60px;
            bottom: 0;
            background: linear-gradient(to right, #fafafa 0%, #f0f0f0 100%);
            border-right: 1px solid #c0c0c0;
            z-index: 10;
            box-shadow: 1px 0 2px rgba(0,0,0,0.05);
        }

        .margin-indicator {
            position: absolute;
            top: 32px; /* Below ruler */
            bottom: 0;
            width: 1px;
            background: rgba(0, 120, 215, 0.4);
            pointer-events: none;
            z-index: 9;
            transition: left 0.1s ease, right 0.1s ease;
        }

        .margin-left-indicator {
            left: 100px; /* Left text margin */
        }

        .margin-right-indicator {
            right: 100px; /* Right text margin */
        }

        .margin-handle {
            position: absolute;
            top: 0;
            width: 12px;
            height: 32px;
            cursor: ew-resize;
            z-index: 11;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .margin-handle:hover {
            background: rgba(0, 120, 215, 0.1);
        }

        .margin-handle::after {
            content: '';
            width: 6px;
            height: 12px;
            background: #0078d4;
            border-radius: 2px;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
        }

        .margin-handle-left {
            left: 154px; /* Just before left margin indicator */
        }

        .margin-handle-right {
            right: 94px; /* Just before right margin indicator */
        }

        .editor-wrapper {
            position: absolute;
            top: 32px; /* Below ruler */
            left: 60px; /* After line numbers */
            right: 0;
            bottom: 0;
            overflow-y: auto;
            overflow-x: hidden;
        }

        .editor {
            position: relative;
            width: 100%;
            max-width: calc(100% - 120px); /* Account for centered content */
            padding: 10px 120px 40px 120px; /* Space for margins */
            margin: 0 auto; /* Center the content */
            outline: none;
            line-height: 1.6;
            z-index: 2;
            background: transparent;
            min-height: calc(100vh - 250px);
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 14px;
            color: #1a1a1a;
            box-sizing: border-box;
        }

        .editor:focus {
            outline: none;
        }

        .editor::selection {
            background: rgba(0, 120, 215, 0.25);
        }

        .editor b {
            font-weight: bold;
        }

        .editor i {
            font-style: italic;
        }

        .editor u {
            text-decoration: underline;
        }

        .editor h1 {
            font-size: 2em;
            font-weight: bold;
            margin: 0.67em 0;
        }

        .editor h2 {
            font-size: 1.5em;
            font-weight: bold;
            margin: 0.75em 0;
        }

        .editor h3 {
            font-size: 1.17em;
            font-weight: bold;
            margin: 0.83em 0;
        }

        .editor ul, .editor ol {
            margin: 1em 0;
            padding-left: 2em;
        }

        .editor li {
            margin: 0.25em 0;
        }

        .editor blockquote {
            margin: 1em 0;
            padding-left: 1em;
            border-left: 3px solid var(--vscode-textBlockQuote-border);
            color: var(--vscode-textBlockQuote-foreground);
        }

        .editor code {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textCodeBlock-foreground);
            padding: 2px 4px;
            border-radius: 3px;
            font-family: var(--vscode-editor-font-family);
        }

        .editor pre {
            background-color: var(--vscode-textCodeBlock-background);
            color: var(--vscode-textCodeBlock-foreground);
            padding: 1em;
            border-radius: 3px;
            overflow-x: auto;
            margin: 1em 0;
        }

        .editor pre code {
            background: none;
            padding: 0;
        }
    </style>
</head>
<body>
    <div class="ribbon">
        <div class="ribbon-tabs">
            <button class="ribbon-tab active" id="homeTab">Home</button>
            <button class="ribbon-tab" id="insertTab">Insert</button>
            <button class="ribbon-tab" id="pageLayoutTab">Page Layout</button>
            <button class="ribbon-tab" id="viewTab">View</button>
            <button class="ribbon-tab" id="formatTab">Format</button>
        </div>

        <div class="ribbon-content" id="homeContent">
            <!-- Clipboard Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Clipboard</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="undo" title="Undo (Ctrl+Z)">↶</button>
                    <button class="ribbon-button" id="redo" title="Redo (Ctrl+Y)">↷</button>
                </div>
            </div>

            <!-- Font Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Font</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="bold" title="Bold (Ctrl+B)"><b>B</b></button>
                    <button class="ribbon-button" id="italic" title="Italic (Ctrl+I)"><i>I</i></button>
                    <button class="ribbon-button" id="underline" title="Underline (Ctrl+U)"><u>U</u></button>
                    <button class="ribbon-button" id="strikethrough" title="Strikethrough"><s>S</s></button>
                    <select class="ribbon-select" id="fontSize" title="Font Size">
                        <option value="8">8</option>
                        <option value="9">9</option>
                        <option value="10">10</option>
                        <option value="11" selected>11</option>
                        <option value="12">12</option>
                        <option value="14">14</option>
                        <option value="16">16</option>
                        <option value="18">18</option>
                        <option value="20">20</option>
                        <option value="24">24</option>
                    </select>
                </div>
            </div>

            <!-- Paragraph Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Paragraph</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="alignLeft" title="Align Left">⬅</button>
                    <button class="ribbon-button" id="alignCenter" title="Align Center">⬆</button>
                    <button class="ribbon-button" id="alignRight" title="Align Right">➡</button>
                    <button class="ribbon-button" id="indent" title="Increase Indent">⤇</button>
                    <button class="ribbon-button" id="outdent" title="Decrease Indent">⤆</button>
                </div>
            </div>

            <!-- Lists Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Lists</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="bulletList" title="Bullet List">•</button>
                    <button class="ribbon-button" id="numberList" title="Numbered List">1.</button>
                </div>
            </div>

            <!-- Styles Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Styles</div>
                <div class="ribbon-group-content">
                    <select class="ribbon-select" id="heading" title="Heading Level">
                        <option value="p">Normal</option>
                        <option value="h1">Heading 1</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                    </select>
                    <button class="ribbon-button" id="blockquote" title="Blockquote">"</button>
                </div>
            </div>

            <!-- File Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">File</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="importDocx" title="Import DOCX" ${isWeb ? 'disabled' : ''}>📁</button>
                    <button class="ribbon-button" id="exportDocx" title="Export DOCX" ${isWeb ? 'disabled' : ''}>💾</button>
                </div>
            </div>

        </div>

        <!-- INSERT TAB -->
        <div class="ribbon-content" id="insertContent" style="display: none;">
            <!-- Tables Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Tables</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="insertTable" title="Insert Table">📊</button>
                    <button class="ribbon-button" id="quickTable" title="Quick Table (3x3)">⊞</button>
                </div>
            </div>

            <!-- Illustrations Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Illustrations</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="insertImage" title="Insert Image">🖼️</button>
                    <button class="ribbon-button" id="insertShape" title="Insert Shape">⬜</button>
                    <button class="ribbon-button" id="insertChart" title="Insert Chart">📈</button>
                </div>
            </div>

            <!-- Links Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Links</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="insertLink" title="Insert Hyperlink">🔗</button>
                    <button class="ribbon-button" id="insertBookmark" title="Insert Bookmark">🔖</button>
                </div>
            </div>

            <!-- Text Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Text</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="insertTextBox" title="Insert Text Box">▭</button>
                    <button class="ribbon-button" id="insertDate" title="Insert Date/Time">📅</button>
                    <button class="ribbon-button" id="insertSymbol" title="Insert Symbol">Ω</button>
                </div>
            </div>

            <!-- Signature Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Signature</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="insertSignature" title="Insert Signature Line">✍️</button>
                </div>
            </div>
        </div>

        <!-- PAGE LAYOUT TAB -->
        <div class="ribbon-content" id="pageLayoutContent" style="display: none;">
            <!-- Page Setup Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Page Setup</div>
                <div class="ribbon-group-content">
                    <select class="ribbon-select" id="pageSize" title="Page Size">
                        <option value="letter">Letter (8.5" × 11")</option>
                        <option value="a4">A4 (210mm × 297mm)</option>
                        <option value="legal">Legal (8.5" × 14")</option>
                        <option value="tabloid">Tabloid (11" × 17")</option>
                    </select>
                    <button class="ribbon-button" id="pageOrientation" title="Page Orientation">📄</button>
                    <button class="ribbon-button" id="pageMargins" title="Margins">↔️</button>
                </div>
            </div>

            <!-- Columns Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Columns</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="oneColumn" title="One Column">║</button>
                    <button class="ribbon-button" id="twoColumns" title="Two Columns">║║</button>
                    <button class="ribbon-button" id="threeColumns" title="Three Columns">║║║</button>
                </div>
            </div>

            <!-- Page Background Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Page Background</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="pageColor" title="Page Color">🎨</button>
                    <button class="ribbon-button" id="pageBorders" title="Page Borders">⊡</button>
                    <button class="ribbon-button" id="watermark" title="Watermark">💧</button>
                </div>
            </div>

            <!-- Line Numbers Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Line Numbers</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="lineNumbers" title="Toggle Line Numbers">🔢</button>
                </div>
            </div>
        </div>

        <!-- VIEW TAB -->
        <div class="ribbon-content" id="viewContent" style="display: none;">
            <!-- Zoom Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Zoom</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="zoomIn" title="Zoom In">🔍+</button>
                    <button class="ribbon-button" id="zoomOut" title="Zoom Out">🔍-</button>
                    <select class="ribbon-select" id="zoomLevel" title="Zoom Level">
                        <option value="50">50%</option>
                        <option value="75">75%</option>
                        <option value="100" selected>100%</option>
                        <option value="125">125%</option>
                        <option value="150">150%</option>
                        <option value="200">200%</option>
                    </select>
                </div>
            </div>

            <!-- Show Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Show</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="showRuler" title="Toggle Ruler">📏</button>
                    <button class="ribbon-button" id="showGridlines" title="Show Gridlines">⊞</button>
                    <button class="ribbon-button" id="showParagraphMarks" title="Show Paragraph Marks">¶</button>
                </div>
            </div>

            <!-- View Mode Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">View Mode</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="printLayout" title="Print Layout">📄</button>
                    <button class="ribbon-button" id="webLayout" title="Web Layout">🌐</button>
                    <button class="ribbon-button" id="focusMode" title="Focus Mode">👁️</button>
                </div>
            </div>

            <!-- Window Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Window</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="splitView" title="Split View">⊟</button>
                    <button class="ribbon-button" id="fullScreen" title="Full Screen">⛶</button>
                </div>
            </div>
        </div>

        <!-- FORMAT TAB -->
        <div class="ribbon-content" id="formatContent" style="display: none;">
            <!-- Text Effects Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Text Effects</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="textShadow" title="Text Shadow">S̲</button>
                    <button class="ribbon-button" id="textOutline" title="Text Outline">O</button>
                    <button class="ribbon-button" id="textGlow" title="Text Glow">✨</button>
                </div>
            </div>

            <!-- Color Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Color</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="textColor" title="Text Color">A</button>
                    <button class="ribbon-button" id="highlightColor" title="Highlight Color">🖍️</button>
                    <button class="ribbon-button" id="backgroundColor" title="Background Color">🎨</button>
                </div>
            </div>

            <!-- Spacing Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Spacing</div>
                <div class="ribbon-group-content">
                    <select class="ribbon-select" id="lineSpacing" title="Line Spacing">
                        <option value="1.0">1.0</option>
                        <option value="1.15">1.15</option>
                        <option value="1.5">1.5</option>
                        <option value="1.6" selected>1.6</option>
                        <option value="2.0">2.0</option>
                        <option value="2.5">2.5</option>
                        <option value="3.0">3.0</option>
                    </select>
                    <button class="ribbon-button" id="paragraphSpacing" title="Paragraph Spacing">↕️</button>
                </div>
            </div>

            <!-- Case Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Change Case</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="uppercase" title="UPPERCASE">AA</button>
                    <button class="ribbon-button" id="lowercase" title="lowercase">aa</button>
                    <button class="ribbon-button" id="capitalize" title="Capitalize">Aa</button>
                </div>
            </div>

            <!-- Clear Formatting Group -->
            <div class="ribbon-group">
                <div class="ribbon-group-title">Clear</div>
                <div class="ribbon-group-content">
                    <button class="ribbon-button" id="clearFormatting" title="Clear All Formatting">🧹</button>
                </div>
            </div>
        </div>
    </div>

    <div style="padding: 8px 12px; background: linear-gradient(to bottom, #fafafa 0%, #f5f5f5 100%); border-bottom: 1px solid #d0d0d0; font-size: 11px; color: #666; display: flex; align-items: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
        <span style="background: #0078d4; color: white; padding: 2px 6px; border-radius: 3px; font-weight: 600; margin-right: 8px;">${documentType.toUpperCase()}</span>
        <span>Rich formatting is visual only • File saves as plain text</span>
        ${isWeb ? '<span style="margin-left: 8px; color: #d13438;">• DOCX import/export not available in web</span>' : ''}
    </div>

    <!-- Editor container with canvas layer -->
    <div class="editor-container">
        <!-- Rulers and margins -->
        <canvas class="ruler-top" id="rulerTop"></canvas>
        <canvas class="margin-left" id="marginLeft"></canvas>

        <!-- Margin indicators -->
        <div class="margin-indicator margin-left-indicator" id="leftMarginIndicator"></div>
        <div class="margin-indicator margin-right-indicator" id="rightMarginIndicator"></div>

        <!-- Margin drag handles -->
        <div class="margin-handle margin-handle-left" id="leftMarginHandle" title="Drag to adjust left margin"></div>
        <div class="margin-handle margin-handle-right" id="rightMarginHandle" title="Drag to adjust right margin"></div>

        <canvas class="editor-canvas-layer" id="editorCanvas"></canvas>

        <div class="editor-wrapper" id="editorWrapper">
            <div class="editor" id="editor" contenteditable="true"></div>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        const editor = document.getElementById('editor');
        const editorWrapper = document.getElementById('editorWrapper');
        const editorCanvas = document.getElementById('editorCanvas');
        const rulerTop = document.getElementById('rulerTop');
        const marginLeft = document.getElementById('marginLeft');
        const leftMarginIndicator = document.getElementById('leftMarginIndicator');
        const rightMarginIndicator = document.getElementById('rightMarginIndicator');
        const leftMarginHandle = document.getElementById('leftMarginHandle');
        const rightMarginHandle = document.getElementById('rightMarginHandle');

        // Margin settings (in pixels)
        const MARGIN_CONFIG = {
            left: 100,
            right: 100,
            top: 38,
            bottom: 40,
            lineNumberWidth: 60,
            minMargin: 20,
            maxMargin: 300
        };

        // Initialize canvas and rulers
        let canvasInitialized = false;
        let debounceTimeout = null;

        function initializeCanvas() {
            if (!editorCanvas || !rulerTop || !marginLeft) return;

            const container = editorWrapper.parentElement;
            if (!container) return;

            // Size canvases
            const rect = container.getBoundingClientRect();
            editorCanvas.width = rect.width - MARGIN_CONFIG.lineNumberWidth;
            editorCanvas.height = rect.height;

            rulerTop.width = rect.width - MARGIN_CONFIG.lineNumberWidth;
            rulerTop.height = 32;

            marginLeft.width = MARGIN_CONFIG.lineNumberWidth;
            marginLeft.height = rect.height;

            // Position margin indicators
            updateMarginIndicators();

            canvasInitialized = true;
            renderCanvas();
        }

        function updateMarginIndicators() {
            if (leftMarginIndicator && rightMarginIndicator) {
                leftMarginIndicator.style.left = (MARGIN_CONFIG.left) + 'px';
                rightMarginIndicator.style.right = MARGIN_CONFIG.right + 'px';
            }

            if (leftMarginHandle && rightMarginHandle) {
                // Position handles on the ruler at margin positions
                const leftPos = MARGIN_CONFIG.left - 6;
                const rightPos = MARGIN_CONFIG.right - 6;
                leftMarginHandle.style.left = leftPos + 'px';
                rightMarginHandle.style.right = rightPos + 'px';
            }

            // Update editor padding
            if (editor) {
                editor.style.paddingLeft = MARGIN_CONFIG.left + 'px';
                editor.style.paddingRight = MARGIN_CONFIG.right + 'px';
            }
        }

        // Draggable margin handles
        let isDragging = false;
        let dragTarget = null;
        let dragStartX = 0;
        let dragStartMargin = 0;

        function startDrag(e, target) {
            isDragging = true;
            dragTarget = target;
            dragStartX = e.clientX;
            dragStartMargin = target === 'left' ? MARGIN_CONFIG.left : MARGIN_CONFIG.right;
            e.preventDefault();
        }

        function doDrag(e) {
            if (!isDragging || !dragTarget) return;

            const delta = e.clientX - dragStartX;

            if (dragTarget === 'left') {
                const newMargin = Math.max(MARGIN_CONFIG.minMargin, Math.min(MARGIN_CONFIG.maxMargin, dragStartMargin + delta));
                MARGIN_CONFIG.left = newMargin;
            } else if (dragTarget === 'right') {
                const newMargin = Math.max(MARGIN_CONFIG.minMargin, Math.min(MARGIN_CONFIG.maxMargin, dragStartMargin - delta));
                MARGIN_CONFIG.right = newMargin;
            }

            updateMarginIndicators();
            renderCanvas();
        }

        function stopDrag() {
            isDragging = false;
            dragTarget = null;
        }

        if (leftMarginHandle) {
            leftMarginHandle.addEventListener('mousedown', (e) => startDrag(e, 'left'));
        }

        if (rightMarginHandle) {
            rightMarginHandle.addEventListener('mousedown', (e) => startDrag(e, 'right'));
        }

        document.addEventListener('mousemove', doDrag);
        document.addEventListener('mouseup', stopDrag);

        // TAB SWITCHING
        const tabs = {
            homeTab: document.getElementById('homeTab'),
            insertTab: document.getElementById('insertTab'),
            pageLayoutTab: document.getElementById('pageLayoutTab'),
            viewTab: document.getElementById('viewTab'),
            formatTab: document.getElementById('formatTab')
        };

        const tabContents = {
            homeContent: document.getElementById('homeContent'),
            insertContent: document.getElementById('insertContent'),
            pageLayoutContent: document.getElementById('pageLayoutContent'),
            viewContent: document.getElementById('viewContent'),
            formatContent: document.getElementById('formatContent')
        };

        function switchTab(tabName) {
            // Hide all content
            Object.values(tabContents).forEach(content => {
                if (content) content.style.display = 'none';
            });

            // Remove active class from all tabs
            Object.values(tabs).forEach(tab => {
                if (tab) tab.classList.remove('active');
            });

            // Show selected content and activate tab
            const contentId = tabName.replace('Tab', 'Content');
            if (tabContents[contentId]) {
                tabContents[contentId].style.display = 'flex';
            }
            if (tabs[tabName]) {
                tabs[tabName].classList.add('active');
            }
        }

        // Attach tab click handlers
        Object.keys(tabs).forEach(tabName => {
            if (tabs[tabName]) {
                tabs[tabName].addEventListener('click', () => switchTab(tabName));
            }
        });

        function renderCanvas() {
            if (!canvasInitialized) return;

            // Clear and render canvas
            const ctx = editorCanvas.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, editorCanvas.width, editorCanvas.height);

            // Render rulers
            renderTopRuler();
            renderLeftMargin();
        }

        function renderTopRuler() {
            const ctx = rulerTop.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, rulerTop.width, rulerTop.height);

            // Gradient background
            const gradient = ctx.createLinearGradient(0, 0, 0, rulerTop.height);
            gradient.addColorStop(0, '#fafafa');
            gradient.addColorStop(1, '#ececec');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, rulerTop.width, rulerTop.height);

            // Border
            ctx.strokeStyle = '#c0c0c0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, rulerTop.height - 0.5);
            ctx.lineTo(rulerTop.width, rulerTop.height - 0.5);
            ctx.stroke();

            ctx.strokeStyle = '#666';
            ctx.fillStyle = '#333';
            ctx.font = '10px "Segoe UI", sans-serif';
            ctx.textBaseline = 'top';
            ctx.lineWidth = 1;

            const charWidth = 8;
            for (let i = 0; i < rulerTop.width / charWidth; i++) {
                const x = i * charWidth;
                if (i % 10 === 0 && i > 0) {
                    ctx.strokeStyle = '#666';
                    ctx.beginPath();
                    ctx.moveTo(x + 0.5, rulerTop.height - 10);
                    ctx.lineTo(x + 0.5, rulerTop.height - 1);
                    ctx.stroke();
                    ctx.fillStyle = '#333';
                    ctx.fillText(i.toString(), x + 2, 6);
                } else if (i % 5 === 0 && i > 0) {
                    ctx.strokeStyle = '#999';
                    ctx.beginPath();
                    ctx.moveTo(x + 0.5, rulerTop.height - 7);
                    ctx.lineTo(x + 0.5, rulerTop.height - 1);
                    ctx.stroke();
                }
            }
        }

        function renderLeftMargin() {
            const ctx = marginLeft.getContext('2d');
            if (!ctx) return;

            ctx.clearRect(0, 0, marginLeft.width, marginLeft.height);

            // Gradient background
            const gradient = ctx.createLinearGradient(0, 0, marginLeft.width, 0);
            gradient.addColorStop(0, '#fafafa');
            gradient.addColorStop(1, '#f0f0f0');
            ctx.fillStyle = gradient;
            ctx.fillRect(0, 0, marginLeft.width, marginLeft.height);

            // Border
            ctx.strokeStyle = '#c0c0c0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(marginLeft.width - 0.5, 0);
            ctx.lineTo(marginLeft.width - 0.5, marginLeft.height);
            ctx.stroke();

            ctx.font = '11px "Segoe UI", Consolas, monospace';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'top';

            const lineHeight = 22.4; // 1.6 line-height * 14px font
            const scrollOffset = editorWrapper.scrollTop || 0;
            const startLine = Math.floor(scrollOffset / lineHeight);
            const visibleLines = Math.ceil(marginLeft.height / lineHeight) + 2;

            ctx.fillStyle = '#888';

            for (let i = 0; i < visibleLines; i++) {
                const lineNum = startLine + i + 1;
                const y = 32 + (i * lineHeight) + 10 - (scrollOffset % lineHeight); // 32 = ruler height, 10 = padding

                if (y > 32 && y < marginLeft.height) {
                    ctx.fillText(lineNum.toString(), marginLeft.width - 8, y);
                }
            }
        }

        // Debounced canvas update on editor input
        function scheduleCanvasUpdate() {
            if (debounceTimeout) {
                clearTimeout(debounceTimeout);
            }
            debounceTimeout = setTimeout(() => {
                renderCanvas();
            }, 50);
        }

        // Initialize on load
        setTimeout(initializeCanvas, 100);

        // Reinitialize on resize
        window.addEventListener('resize', () => {
            initializeCanvas();
        });
        const undoBtn = document.getElementById('undo');
        const redoBtn = document.getElementById('redo');
        const boldBtn = document.getElementById('bold');
        const italicBtn = document.getElementById('italic');
        const underlineBtn = document.getElementById('underline');
        const strikethroughBtn = document.getElementById('strikethrough');
        const fontSizeSelect = document.getElementById('fontSize');
        const headingSelect = document.getElementById('heading');
        const bulletListBtn = document.getElementById('bulletList');
        const numberListBtn = document.getElementById('numberList');
        const blockquoteBtn = document.getElementById('blockquote');
        const alignLeftBtn = document.getElementById('alignLeft');
        const alignCenterBtn = document.getElementById('alignCenter');
        const alignRightBtn = document.getElementById('alignRight');
        const indentBtn = document.getElementById('indent');
        const outdentBtn = document.getElementById('outdent');
        const importDocxBtn = document.getElementById('importDocx');
        const exportDocxBtn = document.getElementById('exportDocx');

        let isUpdating = false;

        // Send ready message
        vscode.postMessage({ type: 'ready' });

        // Handle messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'set-content':
                    if (!isUpdating) {
                        isUpdating = true;
                        if (message.isHtml) {
                            editor.innerHTML = message.content;
                        } else {
                            editor.innerHTML = escapeHtml(message.content);
                        }
                        isUpdating = false;
                    }
                    break;
                case 'request-html-for-export':
                    // Send HTML content for export
                    vscode.postMessage({
                        type: 'request-export-docx',
                        html: editor.innerHTML
                    });
                    break;
                case 'request-plain-text-for-chat':
                    // Extract plain text and send to Void chat
                    const plainText = editor.innerText || editor.textContent;
                    const selection = window.getSelection();
                    let selectionInfo = undefined;
                    if (selection && !selection.isCollapsed) {
                        const range = selection.getRangeAt(0);
                        selectionInfo = {
                            start: range.startOffset,
                            end: range.endOffset
                        };
                    }
                    vscode.postMessage({
                        type: 'void-add-to-chat',
                        plainText: selectionInfo ? selection.toString() : plainText,
                        selection: selectionInfo
                    });
                    break;
                case 'request-html-for-inline-edit':
                    // Extract HTML and send for inline editing
                    const htmlContent = editor.innerHTML;
                    const currentSelection = window.getSelection();
                    let htmlSelectionInfo = undefined;
                    if (currentSelection && !currentSelection.isCollapsed) {
                        const range = currentSelection.getRangeAt(0);
                        htmlSelectionInfo = {
                            start: range.startOffset,
                            end: range.endOffset
                        };
                    }
                    vscode.postMessage({
                        type: 'void-inline-edit',
                        html: htmlContent,
                        selection: htmlSelectionInfo
                    });
                    break;
                case 'apply-html-edit':
                    // Apply edited HTML from Void back to editor
                    if (!isUpdating && message.html) {
                        isUpdating = true;
                        editor.innerHTML = message.html;
                        isUpdating = false;
                    }
                    break;
            }
        });

        // Handle editor content changes
        editor.addEventListener('input', () => {
            if (!isUpdating) {
                const plainText = editor.innerText;
                vscode.postMessage({
                    type: 'edit',
                    edits: [{
                        start: 0,
                        end: editor.innerText.length,
                        text: plainText
                    }]
                });

                // Update canvas with debouncing
                scheduleCanvasUpdate();
            }
        });

        // Update canvas on scroll - use requestAnimationFrame for smooth updates
        editorWrapper.addEventListener('scroll', () => {
            requestAnimationFrame(() => {
                renderLeftMargin();
            });
        });

        // Handle clipboard buttons
        undoBtn.addEventListener('click', () => {
            document.execCommand('undo');
            updateButtonStates();
        });

        redoBtn.addEventListener('click', () => {
            document.execCommand('redo');
            updateButtonStates();
        });

        // Handle formatting buttons
        boldBtn.addEventListener('click', () => {
            document.execCommand('bold');
            updateButtonStates();
        });

        italicBtn.addEventListener('click', () => {
            document.execCommand('italic');
            updateButtonStates();
        });

        underlineBtn.addEventListener('click', () => {
            document.execCommand('underline');
            updateButtonStates();
        });

        strikethroughBtn.addEventListener('click', () => {
            document.execCommand('strikeThrough');
            updateButtonStates();
        });

        // Handle font size
        fontSizeSelect.addEventListener('change', () => {
            const size = fontSizeSelect.value;
            document.execCommand('fontSize', false, '7');
            const fontElements = document.getElementsByTagName('font');
            for (let i = fontElements.length - 1; i >= 0; i--) {
                if (fontElements[i].size === '7') {
                    fontElements[i].removeAttribute('size');
                    fontElements[i].style.fontSize = size + 'px';
                }
            }
        });

        // Handle heading selection
        headingSelect.addEventListener('change', () => {
            const value = headingSelect.value;
            if (value === 'p') {
                document.execCommand('formatBlock', false, 'div');
            } else {
                document.execCommand('formatBlock', false, value);
            }
            updateButtonStates();
        });

        // Handle list buttons
        bulletListBtn.addEventListener('click', () => {
            document.execCommand('insertUnorderedList');
            updateButtonStates();
        });

        numberListBtn.addEventListener('click', () => {
            document.execCommand('insertOrderedList');
            updateButtonStates();
        });

        // Handle blockquote
        blockquoteBtn.addEventListener('click', () => {
            document.execCommand('formatBlock', false, 'blockquote');
            updateButtonStates();
        });

        // Handle alignment
        alignLeftBtn.addEventListener('click', () => {
            document.execCommand('justifyLeft');
            updateButtonStates();
        });

        alignCenterBtn.addEventListener('click', () => {
            document.execCommand('justifyCenter');
            updateButtonStates();
        });

        alignRightBtn.addEventListener('click', () => {
            document.execCommand('justifyRight');
            updateButtonStates();
        });

        // Handle indentation
        indentBtn.addEventListener('click', () => {
            document.execCommand('indent');
            updateButtonStates();
        });

        outdentBtn.addEventListener('click', () => {
            document.execCommand('outdent');
            updateButtonStates();
        });

        // Handle DOCX import/export
        importDocxBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'request-import-docx' });
        });

        exportDocxBtn.addEventListener('click', () => {
            vscode.postMessage({ type: 'request-html-for-export' });
        });

        // Keyboard shortcuts
        editor.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'b':
                        e.preventDefault();
                        document.execCommand('bold');
                        updateButtonStates();
                        break;
                    case 'i':
                        e.preventDefault();
                        document.execCommand('italic');
                        updateButtonStates();
                        break;
                    case 'u':
                        e.preventDefault();
                        document.execCommand('underline');
                        updateButtonStates();
                        break;
                }
            }
        });

        function updateButtonStates() {
            // Update formatting button states
            boldBtn.classList.toggle('active', document.queryCommandState('bold'));
            italicBtn.classList.toggle('active', document.queryCommandState('italic'));
            underlineBtn.classList.toggle('active', document.queryCommandState('underline'));
            strikethroughBtn.classList.toggle('active', document.queryCommandState('strikeThrough'));

            // Update alignment button states
            alignLeftBtn.classList.toggle('active', document.queryCommandState('justifyLeft'));
            alignCenterBtn.classList.toggle('active', document.queryCommandState('justifyCenter'));
            alignRightBtn.classList.toggle('active', document.queryCommandState('justifyRight'));

            // Update heading select based on current block element
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                const blockElement = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
                    ? range.commonAncestorContainer.parentElement
                    : range.commonAncestorContainer;

                if (blockElement) {
                    const tagName = blockElement.tagName.toLowerCase();
                    if (['h1', 'h2', 'h3'].includes(tagName)) {
                        headingSelect.value = tagName;
                    } else {
                        headingSelect.value = 'p';
                    }
                }
            }
        }

        function escapeHtml(text) {
            const div = document.createElement('div');
            div.textContent = text;
            return div.innerHTML.replace(/\\n/g, '<br>');
        }

        // Update button states periodically
        setInterval(updateButtonStates, 100);

        // === INSERT TAB FEATURES ===

        // Quick Table (3x3)
        document.getElementById('quickTable')?.addEventListener('click', () => {
            const table = document.createElement('table');
            table.style.borderCollapse = 'collapse';
            table.style.margin = '10px 0';
            table.style.border = '1px solid #ccc';

            for (let i = 0; i < 3; i++) {
                const row = table.insertRow();
                for (let j = 0; j < 3; j++) {
                    const cell = row.insertCell();
                    cell.style.border = '1px solid #ccc';
                    cell.style.padding = '8px';
                    cell.style.minWidth = '80px';
                    cell.contentEditable = 'true';
                    cell.innerHTML = '&nbsp;';
                }
            }

            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(table);
            }
        });

        // Insert Date
        document.getElementById('insertDate')?.addEventListener('click', () => {
            const now = new Date();
            const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
            document.execCommand('insertText', false, dateStr);
        });

        // Insert Symbol
        document.getElementById('insertSymbol')?.addEventListener('click', () => {
            const symbols = ['©', '®', '™', '°', '±', '÷', '×', '§', '¶', '†', '‡', '•', '◊', '…', '→', '←', '↑', '↓', '↔', '⇒', '⇐', '∞', '≈', '≠', '≤', '≥'];
            const symbol = symbols[Math.floor(Math.random() * symbols.length)];
            document.execCommand('insertText', false, symbol);
        });

        // === PAGE LAYOUT TAB FEATURES ===

        // Page Size
        document.getElementById('pageSize')?.addEventListener('change', (e) => {
            const size = e.target.value;
            const sizes = {
                'letter': { width: '816px' },
                'a4': { width: '794px' },
                'legal': { width: '816px' },
                'tabloid': { width: '1056px' }
            };
            if (sizes[size]) {
                editor.style.maxWidth = sizes[size].width;
            }
        });

        // Column Layouts
        document.getElementById('oneColumn')?.addEventListener('click', () => {
            editor.style.columnCount = '1';
            editor.style.columnGap = '0';
        });

        document.getElementById('twoColumns')?.addEventListener('click', () => {
            editor.style.columnCount = '2';
            editor.style.columnGap = '30px';
        });

        document.getElementById('threeColumns')?.addEventListener('click', () => {
            editor.style.columnCount = '3';
            editor.style.columnGap = '20px';
        });

        // Page Background
        document.getElementById('pageColor')?.addEventListener('click', () => {
            const color = prompt('Enter background color (e.g., #f0f0f0, lightblue):');
            if (color) {
                editor.style.backgroundColor = color;
            }
        });

        // === VIEW TAB FEATURES ===

        // Zoom
        let currentZoom = 100;
        document.getElementById('zoomIn')?.addEventListener('click', () => {
            currentZoom = Math.min(200, currentZoom + 10);
            editor.style.fontSize = (14 * currentZoom / 100) + 'px';
            document.getElementById('zoomLevel').value = currentZoom;
        });

        document.getElementById('zoomOut')?.addEventListener('click', () => {
            currentZoom = Math.max(50, currentZoom - 10);
            editor.style.fontSize = (14 * currentZoom / 100) + 'px';
            document.getElementById('zoomLevel').value = currentZoom;
        });

        document.getElementById('zoomLevel')?.addEventListener('change', (e) => {
            currentZoom = parseInt(e.target.value);
            editor.style.fontSize = (14 * currentZoom / 100) + 'px';
        });

        // Toggle Ruler
        document.getElementById('showRuler')?.addEventListener('click', () => {
            const rulerTop = document.getElementById('rulerTop');
            if (rulerTop) {
                rulerTop.style.display = rulerTop.style.display === 'none' ? 'block' : 'none';
            }
        });

        // Focus Mode
        document.getElementById('focusMode')?.addEventListener('click', () => {
            const ribbon = document.querySelector('.ribbon');
            if (ribbon) {
                ribbon.style.display = ribbon.style.display === 'none' ? 'flex' : 'none';
            }
        });

        // === FORMAT TAB FEATURES ===

        // Text Color
        document.getElementById('textColor')?.addEventListener('click', () => {
            const color = prompt('Enter text color (e.g., #ff0000, red):');
            if (color) {
                document.execCommand('foreColor', false, color);
            }
        });

        // Highlight Color
        document.getElementById('highlightColor')?.addEventListener('click', () => {
            const color = prompt('Enter highlight color (e.g., yellow, #ffff00):');
            if (color) {
                document.execCommand('hiliteColor', false, color);
            }
        });

        // Line Spacing
        document.getElementById('lineSpacing')?.addEventListener('change', (e) => {
            editor.style.lineHeight = e.target.value;
        });

        // Text Case Transformations
        document.getElementById('uppercase')?.addEventListener('click', () => {
            const selection = window.getSelection();
            if (selection && selection.toString()) {
                const text = selection.toString().toUpperCase();
                document.execCommand('insertText', false, text);
            }
        });

        document.getElementById('lowercase')?.addEventListener('click', () => {
            const selection = window.getSelection();
            if (selection && selection.toString()) {
                const text = selection.toString().toLowerCase();
                document.execCommand('insertText', false, text);
            }
        });

        document.getElementById('capitalize')?.addEventListener('click', () => {
            const selection = window.getSelection();
            if (selection && selection.toString()) {
                const text = selection.toString().replace(/\\b\\w/g, l => l.toUpperCase());
                document.execCommand('insertText', false, text);
            }
        });

        // Clear Formatting
        document.getElementById('clearFormatting')?.addEventListener('click', () => {
            document.execCommand('removeFormat');
            document.execCommand('unlink');
        });
    </script>
</body>
</html>`;
    }
}

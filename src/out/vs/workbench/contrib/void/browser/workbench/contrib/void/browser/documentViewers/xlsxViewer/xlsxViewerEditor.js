/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
import * as DOM from '../../../../../../base/browser/dom.js';
import { VSBuffer } from '../../../../../../base/common/buffer.js';
import { FileAccess } from '../../../../../../base/common/network.js';
import { URI } from '../../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';
import { EditorPane } from '../../../../../browser/parts/editor/editorPane.js';
import { asWebviewUri } from '../../../../webview/common/webview.js';
import { XLSXViewerInput } from './xlsxViewerInput.js';
export class XLSXViewerEditor extends EditorPane {
    storageService;
    webviewService;
    fileService;
    static ID = 'void.xlsxViewer';
    static SHEET_STORAGE_PREFIX = 'xlsxViewer.lastSheet.';
    _element;
    _dimension;
    webview;
    _currentInput;
    _webviewReady = false;
    _pendingInput;
    _xlsxDataCache;
    _isLoading = false;
    constructor(group, telemetryService, themeService, storageService, webviewService, fileService) {
        super(XLSXViewerEditor.ID, group, telemetryService, themeService, storageService);
        this.storageService = storageService;
        this.webviewService = webviewService;
        this.fileService = fileService;
    }
    createEditor(parent) {
        this._element = DOM.append(parent, DOM.$('div.xlsx-viewer-container'));
        this._element.style.width = '100%';
        this._element.style.height = '100%';
        this._element.style.position = 'relative';
    }
    async setInput(input, options, context, token) {
        await super.setInput(input, options, context, token);
        if (token.isCancellationRequested || !(input instanceof XLSXViewerInput)) {
            return;
        }
        this._currentInput = input;
        console.log('[XLSX Viewer] setInput called for:', input.resource.toString());
        // Get saved sheet for this XLSX from storage
        const storageKey = XLSXViewerEditor.SHEET_STORAGE_PREFIX + input.resource.toString();
        const savedSheet = this.storageService.getNumber(storageKey, -1 /* StorageScope.WORKSPACE */, 0);
        // Create webview if it doesn't exist
        if (!this.webview && this._element) {
            this.webview = this.webviewService.createWebviewOverlay({
                title: 'XLSX Viewer',
                providedViewType: 'void.xlsxViewer',
                options: {
                    enableFindWidget: false,
                    retainContextWhenHidden: true
                },
                contentOptions: {
                    allowScripts: true,
                    localResourceRoots: [this.getMediaUri()]
                },
                extension: undefined
            });
            // Mount webview to container
            const targetWindow = DOM.getWindow(this._element);
            this.webview.claim(this, targetWindow, undefined);
            this.webview.layoutWebviewOverElement(this._element);
            // Set up message handlers
            this._register(this.webview.onMessage(message => {
                this.handleWebviewMessage(message);
            }));
            // Load webview HTML
            this.webview.setHtml(this.getWebviewHTML());
            // Layout if we have dimensions
            if (this._dimension) {
                this.webview.layoutWebviewOverElement(this._element, this._dimension);
            }
        }
        // If webview exists and is ready, check if we need to reload
        if (this.webview && this._webviewReady) {
            const currentUri = input.resource.toString();
            // If same XLSX is already loaded and cached, resend to webview
            if (this._xlsxDataCache?.uri === currentUri) {
                console.log('✅ [XLSX Viewer] Same XLSX cached, resending to webview');
                this.webview.postMessage({
                    type: 'loadXLSX',
                    data: this._xlsxDataCache.data,
                    encoding: 'base64',
                    xlsxUri: currentUri,
                    startSheet: savedSheet
                });
                return;
            }
            // Different XLSX, load it
            console.log('[XLSX Viewer] Different XLSX, loading');
            await this.loadXLSX(input, savedSheet);
        }
        else {
            // Webview not ready yet, queue the input
            console.log('[XLSX Viewer] Webview not ready, queuing input');
            this._pendingInput = input;
        }
    }
    async loadXLSX(input, startSheet = 0) {
        if (this._isLoading || !this.webview) {
            return;
        }
        this._isLoading = true;
        try {
            const currentUri = input.resource.toString();
            console.log('[XLSX Viewer] Loading XLSX:', currentUri);
            // Read file as buffer
            const fileContent = await this.fileService.readFile(input.resource);
            // Convert to base64 manually (like PDF viewer)
            const uint8Array = new Uint8Array(fileContent.value.buffer);
            let base64 = '';
            const chunkSize = 8192;
            for (let i = 0; i < uint8Array.length; i += chunkSize) {
                const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
                base64 += String.fromCharCode.apply(null, Array.from(chunk));
            }
            const base64Data = btoa(base64);
            // Cache the data
            this._xlsxDataCache = { uri: currentUri, data: base64Data };
            // Send to webview
            this.webview.postMessage({
                type: 'loadXLSX',
                data: base64Data,
                encoding: 'base64',
                xlsxUri: currentUri,
                startSheet: startSheet
            });
            console.log('[XLSX Viewer] XLSX loaded successfully');
        }
        catch (error) {
            console.error('[XLSX Viewer] Failed to load XLSX:', error);
        }
        finally {
            this._isLoading = false;
        }
    }
    handleWebviewMessage(message) {
        console.log('[XLSX Viewer] Received message from webview:', JSON.stringify(message));
        const data = message.message || message;
        switch (data.type) {
            case 'ready':
                console.log('[XLSX Viewer] Webview ready');
                this._webviewReady = true;
                // If there's a pending input, load it now
                if (this._pendingInput) {
                    console.log('[XLSX Viewer] Processing pending input');
                    const pendingInput = this._pendingInput;
                    this._pendingInput = undefined;
                    // Get saved sheet
                    const storageKey = XLSXViewerEditor.SHEET_STORAGE_PREFIX + pendingInput.resource.toString();
                    const savedSheet = this.storageService.getNumber(storageKey, -1 /* StorageScope.WORKSPACE */, 0);
                    this.loadXLSX(pendingInput, savedSheet);
                }
                break;
            case 'sheetChanged':
                // Track current sheet and save to storage
                if (this._currentInput) {
                    console.log('[XLSX Viewer] Sheet changed to:', data.sheetIndex);
                    this._currentInput.currentSheet = data.sheetIndex;
                    // Save to storage for persistence across sessions
                    const storageKey = XLSXViewerEditor.SHEET_STORAGE_PREFIX + this._currentInput.resource.toString();
                    this.storageService.store(storageKey, data.sheetIndex, -1 /* StorageScope.WORKSPACE */, 0 /* StorageTarget.USER */);
                }
                break;
            case 'cellSelected':
            case 'rangeSelected':
                // Store selection for Ctrl+K
                if (this._currentInput) {
                    this._currentInput.selection = data.selection;
                }
                break;
            case 'clearSelection':
                if (this._currentInput) {
                    this._currentInput.selection = null;
                }
                break;
            case 'saveRequested':
                if (this._currentInput && data.data) {
                    this.saveXLSX(this._currentInput.resource, data.data);
                }
                break;
            case 'applyEdits':
                // Forward agent edit operations to webview for execution
                if (this.webview) {
                    this.webview.postMessage({
                        type: 'executeOperations',
                        operations: data.operations
                    });
                }
                break;
        }
    }
    async saveXLSX(uri, base64Data) {
        try {
            // Convert base64 to buffer
            const binaryString = atob(base64Data);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            await this.fileService.writeFile(uri, VSBuffer.wrap(bytes));
            console.log('[XLSX Viewer] Spreadsheet saved successfully');
        }
        catch (error) {
            console.error('[XLSX Viewer] Failed to save spreadsheet:', error);
        }
    }
    getInput() {
        return this._currentInput;
    }
    getWebview() {
        return this.webview;
    }
    layout(dimension) {
        this._dimension = dimension;
        if (this.webview && this._element) {
            this.webview.layoutWebviewOverElement(this._element, dimension);
        }
    }
    setEditorVisible(visible) {
        if (this.webview && this._element) {
            const targetWindow = DOM.getWindow(this._element);
            if (visible) {
                this.webview.claim(this, targetWindow, undefined);
            }
            else {
                this.webview.release(this);
            }
        }
        super.setEditorVisible(visible);
    }
    clearInput() {
        if (this.webview) {
            this.webview.postMessage({ type: 'clearXLSX' });
        }
        this._currentInput = undefined;
        super.clearInput();
    }
    dispose() {
        if (this.webview) {
            this.webview.release(this);
        }
        super.dispose();
    }
    getMediaUri() {
        return FileAccess.asFileUri('vs/workbench/contrib/void/browser/documentViewers/xlsxViewer/media');
    }
    getWebviewHTML() {
        if (!this.webview) {
            return '';
        }
        const nonce = generateUuid();
        const mediaUri = this.getMediaUri();
        const xlsxLibUri = asWebviewUri(URI.joinPath(mediaUri, 'lib', 'xlsx.full.min.js'));
        const scriptUri = asWebviewUri(URI.joinPath(mediaUri, 'xlsxViewer.js'));
        const styleUri = asWebviewUri(URI.joinPath(mediaUri, 'xlsxViewer.css'));
        return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' vscode-resource:; style-src 'unsafe-inline' vscode-resource:;">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>XLSX Viewer</title>
	<link rel="stylesheet" href="${styleUri}">
</head>
<body>
	<div id="xlsx-toolbar">
		<div id="sheet-tabs"></div>
		<div id="toolbar-actions">
			<button id="zoom-in-btn" title="Zoom In">+</button>
			<button id="zoom-out-btn" title="Zoom Out">-</button>
			<span id="zoom-level">100%</span>
		</div>
	</div>
	<div id="xlsx-container"></div>
	<div id="status-bar">
		<span id="cell-ref"></span>
		<span id="sheet-info"></span>
	</div>
	<script nonce="${nonce}" src="${xlsxLibUri}"></script>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }
}

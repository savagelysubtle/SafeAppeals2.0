/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as DOM from '../../../../../../base/browser/dom.js';
import { Dimension } from '../../../../../../base/browser/dom.js';
import { CodeWindow } from '../../../../../../base/browser/window.js';
import { VSBuffer } from '../../../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { FileAccess } from '../../../../../../base/common/network.js';
import { URI } from '../../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';
import { IEditorOptions } from '../../../../../../platform/editor/common/editor.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../../../common/editor.js';
import { EditorInput } from '../../../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../../../services/editor/common/editorGroupsService.js';
import { IOverlayWebview, IWebviewService } from '../../../../webview/browser/webview.js';
import { asWebviewUri } from '../../../../webview/common/webview.js';
import { XLSXSelection, XLSXViewerInput } from './xlsxViewerInput.js';

export class XLSXViewerEditor extends EditorPane {
	static readonly ID = 'void.xlsxViewer';
	private static readonly SHEET_STORAGE_PREFIX = 'xlsxViewer.lastSheet.';

	private _element?: HTMLElement;
	private _dimension?: Dimension;
	private webview?: IOverlayWebview;
	private _currentInput?: XLSXViewerInput;
	private _webviewReady: boolean = false;
	private _pendingInput?: XLSXViewerInput;
	private _xlsxDataCache?: { uri: string; data: string };
	private _isLoading: boolean = false;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService private readonly storageService: IStorageService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IFileService private readonly fileService: IFileService
	) {
		super(XLSXViewerEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		this._element = DOM.append(parent, DOM.$('div.xlsx-viewer-container'));
		this._element.style.width = '100%';
		this._element.style.height = '100%';
		this._element.style.position = 'relative';
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
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
			this.webview.claim(this, targetWindow as CodeWindow, undefined);
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
		} else {
			// Webview not ready yet, queue the input
			console.log('[XLSX Viewer] Webview not ready, queuing input');
			this._pendingInput = input;
		}
	}

	private async loadXLSX(input: XLSXViewerInput, startSheet: number = 0): Promise<void> {
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

		} catch (error) {
			console.error('[XLSX Viewer] Failed to load XLSX:', error);
		} finally {
			this._isLoading = false;
		}
	}

	private handleWebviewMessage(message: any): void {
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
					this._currentInput.selection = data.selection as XLSXSelection;
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

	private async saveXLSX(uri: URI, base64Data: string): Promise<void> {
		try {
			// Convert base64 to buffer
			const binaryString = atob(base64Data);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			await this.fileService.writeFile(uri, VSBuffer.wrap(bytes));
			console.log('[XLSX Viewer] Spreadsheet saved successfully');

		} catch (error) {
			console.error('[XLSX Viewer] Failed to save spreadsheet:', error);
		}
	}

	public getInput(): XLSXViewerInput | undefined {
		return this._currentInput;
	}

	public getWebview(): IOverlayWebview | undefined {
		return this.webview;
	}

	override layout(dimension: Dimension): void {
		this._dimension = dimension;
		if (this.webview && this._element) {
			this.webview.layoutWebviewOverElement(this._element, dimension);
		}
	}

	override setEditorVisible(visible: boolean): void {
		if (this.webview && this._element) {
			const targetWindow = DOM.getWindow(this._element);
			if (visible) {
				this.webview.claim(this, targetWindow as CodeWindow, undefined);
			} else {
				this.webview.release(this);
			}
		}
		super.setEditorVisible(visible);
	}

	override clearInput(): void {
		if (this.webview) {
			this.webview.postMessage({ type: 'clearXLSX' });
		}
		this._currentInput = undefined;
		super.clearInput();
	}

	override dispose(): void {
		if (this.webview) {
			this.webview.release(this);
		}
		super.dispose();
	}

	private getMediaUri(): URI {
		return FileAccess.asFileUri('vs/workbench/contrib/void/browser/documentViewers/xlsxViewer/media');
	}

	private getWebviewHTML(): string {
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

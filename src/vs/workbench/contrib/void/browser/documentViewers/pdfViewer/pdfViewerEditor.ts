/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as DOM from '../../../../../../base/browser/dom.js';
import { Dimension } from '../../../../../../base/browser/dom.js';
import { CodeWindow } from '../../../../../../base/browser/window.js';
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
import { IVoidSettingsService } from '../../../common/voidSettingsService.js';
import { PDFSelection, PDFViewerInput } from './pdfViewerInput.js';

export class PDFViewerEditor extends EditorPane {
	static readonly ID = 'void.pdfViewer';

	private _element?: HTMLElement;
	private _dimension?: Dimension;
	private webview?: IOverlayWebview;
	private _currentInput?: PDFViewerInput;
	private _webviewReady: boolean = false;
	private _pendingInput?: { input: PDFViewerInput; savedPage: number }; // Track input waiting for webview ready
	private static readonly PAGE_STORAGE_PREFIX = 'pdfViewer.lastPage.';

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService private readonly storageService: IStorageService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IFileService private readonly fileService: IFileService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService
	) {
		super(PDFViewerEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		this._element = DOM.append(parent, DOM.$('div.pdf-viewer-container'));
		this._element.style.width = '100%';
		this._element.style.height = '100%';
		this._element.style.position = 'relative';
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		if (token.isCancellationRequested || !(input instanceof PDFViewerInput)) {
			return;
		}

		this._currentInput = input;

		console.log('[PDF Viewer] setInput called for:', input.resource.toString());

		// Get saved page for this PDF from storage
		const storageKey = PDFViewerEditor.PAGE_STORAGE_PREFIX + input.resource.toString();
		const savedPage = this.storageService.getNumber(storageKey, -1 /* StorageScope.WORKSPACE */, 1);
		console.log('[PDF Viewer] Saved page from storage:', savedPage);

		// Create webview if it doesn't exist
		if (!this.webview && this._element) {
			// Create webview with proper options
			this.webview = this.webviewService.createWebviewOverlay({
				title: 'PDF Viewer',
				providedViewType: 'void.pdfViewer',
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

		// If webview exists and is ready, ask it what its current state is
		if (this.webview && this._webviewReady) {
			console.log('[PDF Viewer] Asking webview for state');
			this.webview.postMessage({
				type: 'getState',
				requestedUri: input.resource.toString(),
				savedPage: savedPage // Pass the saved page to webview
			});
			// The webview will respond with 'state' message, handled in handleWebviewMessage
			return;
		}

		// Webview exists but not ready yet - wait for it to become ready
		if (this.webview && !this._webviewReady) {
			console.log('[PDF Viewer] Webview exists but not ready, will load when ready');
			this._pendingInput = { input, savedPage };
			return;
		}

		// No webview - load PDF at saved page
		console.log('[PDF Viewer] No webview, loading PDF at page:', savedPage);
		this.loadPDF(input, savedPage);
	}

	private async loadPDF(input: PDFViewerInput, startPage: number): Promise<void> {
		console.log('[PDF Viewer] Loading PDF, starting at page:', startPage);
		try {
			const pdfUri = input.resource;
			const pdfContent = await this.fileService.readFile(pdfUri);

			// Convert to base64 in chunks to avoid stack overflow
			if (this.webview) {
				const uint8Array = new Uint8Array(pdfContent.value.buffer);
				let base64 = '';
				const chunkSize = 8192; // Process 8KB at a time

				for (let i = 0; i < uint8Array.length; i += chunkSize) {
					const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
					base64 += String.fromCharCode.apply(null, Array.from(chunk));
				}

				this.webview.postMessage({
					type: 'loadPDF',
					data: btoa(base64),
					encoding: 'base64',
					preloadStrategy: this.voidSettingsService.state.globalSettings.pdfPreloadStrategy,
					startPage: startPage,
					pdfUri: input.resource.toString()
				});
			}
		} catch (error) {
			console.error('Failed to load PDF:', error);
		}
	}

	private handleWebviewMessage(message: any): void {
		console.log('[PDF Viewer] Received message from webview:', JSON.stringify(message));

		// Unwrap the message - VSCode webview wraps messages in a 'message' property
		const data = message.message || message;

		switch (data.type) {
			case 'ready': {
				// Webview is now ready to receive messages
				console.log('[PDF Viewer] Webview ready');
				this._webviewReady = true;

				// If there's a pending input waiting for webview to be ready, load it now
				if (this._pendingInput) {
					console.log('[PDF Viewer] Processing pending input, loading PDF');
					const { input, savedPage } = this._pendingInput;
					this._pendingInput = undefined;

					// Webview is fresh and has no PDF, so load it directly
					this.loadPDF(input, savedPage);
				}
				break;
			}
		}

		// For all other messages, we need a current input
		if (!this._currentInput) {
			return;
		}

		switch (data.type) {
			case 'state': {
				// Webview reported its current state
				console.log('[PDF Viewer] Webview state:', data);
				const webviewUri = data.loadedPdfUri;
				const webviewPage = data.currentPage;
				const requestedUri = this._currentInput?.resource.toString();

				if (webviewUri === requestedUri && webviewPage) {
					// Same PDF already loaded, just make sure we're on the right page
					console.log('[PDF Viewer] Same PDF loaded, staying on page:', webviewPage);
					// Webview already has correct state, do nothing
				} else {
					// Different PDF or no PDF loaded, load it at saved page
					const storageKey = PDFViewerEditor.PAGE_STORAGE_PREFIX + requestedUri;
					const savedPage = this.storageService.getNumber(storageKey, -1, 1);
					console.log('[PDF Viewer] Different or no PDF, loading at page:', savedPage);
					this.loadPDF(this._currentInput!, savedPage);
				}
				break;
			}
			case 'pageChanged': {
				// Track current page and save to storage
				console.log('[PDF Viewer] Page changed to:', data.page);
				this._currentInput.currentPage = data.page;

				// Save to storage for persistence across sessions
				const storageKey = PDFViewerEditor.PAGE_STORAGE_PREFIX + this._currentInput.resource.toString();
				this.storageService.store(storageKey, data.page, -1 /* StorageScope.WORKSPACE */, 0 /* StorageTarget.USER */);
				console.log('[PDF Viewer] Saved page to storage:', data.page);
				break;
			}
			case 'textSelected':
				// Store selection for Ctrl+K
				this._currentInput.selection = data.selection as PDFSelection;
				break;
			case 'clearSelection':
				this._currentInput.selection = null;
				break;
			case 'selectionRect':
				// Store selection rectangle for widget positioning
				if (this._selectionRectResolve) {
					this._selectionRectResolve(data.rect);
					this._selectionRectResolve = undefined;
				}
				break;
		}
	}

	// Public methods for Ctrl+K integration
	public getInput(): PDFViewerInput | undefined {
		return this._currentInput;
	}

	public async getSelectionRect(): Promise<DOMRect | undefined> {
		return new Promise((resolve) => {
			this._selectionRectResolve = resolve;
			// Request selection rect from webview
			this.webview?.postMessage({ type: 'getSelectionRect' });
			// Timeout after 1 second
			setTimeout(() => {
				if (this._selectionRectResolve) {
					this._selectionRectResolve(undefined);
					this._selectionRectResolve = undefined;
				}
			}, 1000);
		});
	}

	private _selectionRectResolve?: (rect: DOMRect | undefined) => void;

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
			this.webview.postMessage({ type: 'clearPDF' });
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
		// Get the URI for the media folder
		const moduleUri = FileAccess.asFileUri('vs/workbench/contrib/void/browser/documentViewers/pdfViewer/media');
		return moduleUri;
	}

	private getWebviewHTML(): string {
		if (!this.webview) {
			throw new Error('Webview not initialized');
		}

		const nonce = generateUuid();
		const mediaUri = this.getMediaUri();

		// Convert to webview-accessible URIs using the standalone function
		const cssUri = asWebviewUri(URI.joinPath(mediaUri, 'pdfViewer.css'));
		const viewerJsUri = asWebviewUri(URI.joinPath(mediaUri, 'pdfViewer.js'));

		console.log('[PDF Viewer] Media URIs generated:');
		console.log('  Media base:', mediaUri.toString());
		console.log('  CSS:', cssUri.toString());
		console.log('  Viewer script:', viewerJsUri.toString());

		// Use CDN for PDF.js - it's a UMD build that works without ES modules
		const pdfJsCdnUri = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
		const pdfWorkerCdnUri = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

		return `<!DOCTYPE html>
		<html>
		<head>
			<meta charset="UTF-8">
			<meta http-equiv="Content-Security-Policy"
				  content="default-src 'none';
						   script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com vscode-resource:;
						   worker-src blob:;
						   style-src 'nonce-${nonce}' 'unsafe-inline' vscode-resource:;
						   img-src data: vscode-resource:;
						   connect-src *;
						   font-src data: vscode-resource:;">
			<link rel="stylesheet" nonce="${nonce}" href="${cssUri}">
		</head>
		<body>
			<div id="pdf-viewer-layout">
				<div id="sidebar">
					<div id="sidebar-header">
						<button id="toggle-sidebar" title="Toggle Sidebar">☰</button>
						<div id="sidebar-tabs">
							<button class="sidebar-tab active" data-tab="thumbnails">Thumbnails</button>
							<button class="sidebar-tab" data-tab="outline">Outline</button>
						</div>
					</div>
					<div id="sidebar-content">
						<div id="thumbnails-view" class="tab-content active">
							<div id="thumbnails-container"></div>
						</div>
						<div id="outline-view" class="tab-content">
							<div id="outline-container"></div>
						</div>
					</div>
				</div>
				<div id="pdf-container">
					<div id="pdf-controls">
						<button id="prev-page">Previous</button>
						<span id="page-info">Page <span id="current-page">1</span> of <span id="total-pages">1</span></span>
						<button id="next-page">Next</button>
						<button id="zoom-in">Zoom In</button>
						<button id="zoom-out">Zoom Out</button>
					</div>
					<div id="canvas-wrapper">
						<div id="pdf-render-container">
							<canvas id="pdf-canvas"></canvas>
							<div id="pdf-text-layer" class="pdf-text-layer"></div>
						</div>
					</div>
				</div>
			</div>
			<script nonce="${nonce}">
				window.PDF_WORKER_URI = '${pdfWorkerCdnUri}';
				console.log('[PDF Viewer HTML] Worker URI set:', window.PDF_WORKER_URI);
				console.log('[PDF Viewer HTML] About to load scripts...');

				// Add global error handler
				window.addEventListener('error', (e) => {
					console.error('[PDF Viewer HTML] Global error:', e.message, e.filename, e.lineno, e.colno, e.error);
				}, true);
			</script>
			<script nonce="${nonce}" src="${pdfJsCdnUri}"></script>
			<script nonce="${nonce}" src="${viewerJsUri}"></script>
		</body>
		</html>`;
	}
}


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
import { ICommandService } from '../../../../../../platform/commands/common/commands.js';
import { IEditorOptions } from '../../../../../../platform/editor/common/editor.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { INotificationService, Severity } from '../../../../../../platform/notification/common/notification.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
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
import { IDocuSignService } from '../../docuSign/docuSignService.js';
import { IPDFAnnotationService, PDFAnnotation } from './pdfAnnotationService.js';
import { PDFSelection, PDFViewerInput } from './pdfViewerInput.js';

export class PDFViewerEditor extends EditorPane {
	static readonly ID = 'void.pdfViewer';

	private _element?: HTMLElement;
	private _dimension?: Dimension;
	private webview?: IOverlayWebview;
	private _currentInput?: PDFViewerInput;
	private _webviewReady: boolean = false;
	private _pendingInput?: { input: PDFViewerInput; savedPage: number }; // Track input waiting for webview ready
	private _lastLoadedPdfUri?: string; // Track what PDF we last sent to the webview
	private _pdfDataCache?: { uri: string; data: string }; // Cache PDF data to avoid reloading
	private _isLoading: boolean = false; // Prevent concurrent loads
	private static readonly PAGE_STORAGE_PREFIX = 'pdfViewer.lastPage.';

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService private readonly storageService: IStorageService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IFileService private readonly fileService: IFileService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IPDFAnnotationService private readonly pdfAnnotationService: IPDFAnnotationService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IDocuSignService private readonly docuSignService: IDocuSignService,
		@INotificationService private readonly notificationService: INotificationService,
		@ICommandService private readonly commandService: ICommandService
	) {
		super(PDFViewerEditor.ID, group, telemetryService, themeService, storageService);

		// Listen for annotation changes and notify webview
		this._register(this.pdfAnnotationService.onDidChangeAnnotations(uri => {
			if (this._currentInput && this._currentInput.resource.toString() === uri.toString()) {
				this.sendAnnotationsToWebview();
			}
		}));
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
		console.log('[PDF Viewer] Webview state:', {
			hasWebview: !!this.webview,
			webviewReady: this._webviewReady,
			lastLoadedUri: this._lastLoadedPdfUri,
			hasCachedData: !!this._pdfDataCache
		});

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

		// If webview exists and is ready, check if we need to reload
		if (this.webview && this._webviewReady) {
			const currentUri = input.resource.toString();

			console.log('[PDF Viewer] Checking cache:', {
				lastLoadedUri: this._lastLoadedPdfUri,
				currentUri: currentUri,
				hasCachedData: !!this._pdfDataCache,
				cachedUri: this._pdfDataCache?.uri,
				uriMatches: this._lastLoadedPdfUri === currentUri,
				cacheMatches: this._pdfDataCache?.uri === currentUri
			});

			// If same PDF is already loaded and cached, send it again (webview might have been reloaded)
			if (this._pdfDataCache?.uri === currentUri) {
				console.log('✅ [PDF Viewer] Same PDF cached, resending to webview and navigating to page:', savedPage);
				this.webview.postMessage({
					type: 'loadPDF',
					data: this._pdfDataCache.data,
					encoding: 'base64',
					preloadStrategy: this.voidSettingsService.state.globalSettings.pdfPreloadStrategy,
					startPage: savedPage,
					pdfUri: currentUri,
					skipPreload: true // Skip preload since we're just restoring state
				});

				// Update lastLoadedUri
				this._lastLoadedPdfUri = currentUri;
				return;
			}

			// Different PDF, load it
			console.log('[PDF Viewer] Different PDF, loading at page:', savedPage);
			this.loadPDF(input, savedPage);
			return;
		}

		// Webview exists but not ready yet - wait for it to become ready
		if (this.webview && !this._webviewReady) {
			console.log('[PDF Viewer] Webview exists but not ready, will load when ready');
			this._pendingInput = { input, savedPage };
			return;
		}

		// No webview - load PDF at saved page
		console.log('[PDF Viewer] No webview exists, loading PDF at page:', savedPage);
		this.loadPDF(input, savedPage);
	}

	private sendAnnotationsToWebview(): void {
		if (!this.webview || !this._currentInput) {
			return;
		}
		const annotations = this.pdfAnnotationService.getAnnotations(this._currentInput.resource);
		this.webview.postMessage({
			type: 'loadAnnotations',
			annotations: annotations
		});
	}

	private async loadPDF(input: PDFViewerInput, startPage: number): Promise<void> {
		// Prevent concurrent loads
		if (this._isLoading) {
			console.log('[PDF Viewer] Already loading, skipping duplicate load request');
			return;
		}

		this._isLoading = true;
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

				const base64Data = btoa(base64);

				// Cache the PDF data for fast restoration
				this._pdfDataCache = {
					uri: input.resource.toString(),
					data: base64Data
				};

				this.webview.postMessage({
					type: 'loadPDF',
					data: base64Data,
					encoding: 'base64',
					preloadStrategy: this.voidSettingsService.state.globalSettings.pdfPreloadStrategy,
					startPage: startPage,
					pdfUri: input.resource.toString()
				});

				// Track that we've loaded this PDF
				this._lastLoadedPdfUri = input.resource.toString();
			}
		} catch (error) {
			console.error('Failed to load PDF:', error);
		} finally {
			this._isLoading = false;
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
			case 'pdfLoaded':
				// PDF finished loading - send annotations to webview
				console.log('[PDF Viewer] PDF loaded, sending annotations');
				this.sendAnnotationsToWebview();
				break;
			case 'addAnnotation': {
				// Add a new annotation
				const annotation = data.annotation as Omit<PDFAnnotation, 'id' | 'createdAt'>;
				const created = this.pdfAnnotationService.addAnnotation(annotation);
				console.log('[PDF Viewer] Added annotation:', created.id);
				break;
			}
			case 'updateAnnotation': {
				// Update an existing annotation
				const { annotationId, updates } = data;
				this.pdfAnnotationService.updateAnnotation(annotationId, updates);
				console.log('[PDF Viewer] Updated annotation:', annotationId);
				break;
			}
			case 'deleteAnnotation': {
				// Delete an annotation
				console.log('[PDF Viewer] Deleting annotation:', data.annotationId);
				this.pdfAnnotationService.deleteAnnotation(data.annotationId);
				// Explicitly send updated annotations (don't rely solely on event)
				this.sendAnnotationsToWebview();
				console.log('[PDF Viewer] Deleted annotation and sent update');
				break;
			}
			case 'addSignatureAnnotation': {
				// Add a signature annotation
				const annotation = data.annotation as Omit<PDFAnnotation, 'id' | 'createdAt'>;
				const created = this.pdfAnnotationService.addAnnotation(annotation);
				console.log('[PDF Viewer] Added signature annotation:', created.id);
				break;
			}
			case 'getAnnotations':
				// Webview requesting annotations
				this.sendAnnotationsToWebview();
				break;

			case 'printPdf':
				// Open the original PDF in system browser for native printing
				// This is much more efficient than rendering pages to images
				this.printPdf();
				break;

			case 'sendForDocuSign':
				// Handle DocuSign send for signature
				console.log('[PDF Viewer] DocuSign send request');
				this.handleSendForDocuSign();
				break;

			case 'savePdfSignature': {
				// Save a signature to persistent storage for reuse
				const signature = data.signature as { id: string; dataURL: string; createdAt: number };
				this.saveSignatureToStorage(signature);
				break;
			}

			case 'loadPdfSignatures':
				// Load all saved signatures from persistent storage
				this.sendSavedSignaturesToWebview();
				break;

			case 'deletePdfSignature': {
				// Delete a saved signature from storage
				this.deleteSignatureFromStorage(data.signatureId);
				break;
			}
		}
	}

	private static readonly SIGNATURES_STORAGE_KEY = 'void.pdfSavedSignatures';

	private saveSignatureToStorage(signature: { id: string; dataURL: string; createdAt: number }): void {
		const stored = this.storageService.get(PDFViewerEditor.SIGNATURES_STORAGE_KEY, -1 /* StorageScope.WORKSPACE */);
		let signatures: Array<{ id: string; dataURL: string; createdAt: number }> = [];

		if (stored) {
			try {
				signatures = JSON.parse(stored);
			} catch (e) {
				console.error('[PDF Viewer] Failed to parse saved signatures:', e);
			}
		}

		// Add new signature
		signatures.push(signature);

		// Save back to storage
		this.storageService.store(
			PDFViewerEditor.SIGNATURES_STORAGE_KEY,
			JSON.stringify(signatures),
			-1 /* StorageScope.WORKSPACE */,
			0 /* StorageTarget.USER */
		);

		console.log('[PDF Viewer] Saved signature:', signature.id);

		// Send updated list to webview
		this.sendSavedSignaturesToWebview();
	}

	private deleteSignatureFromStorage(signatureId: string): void {
		const stored = this.storageService.get(PDFViewerEditor.SIGNATURES_STORAGE_KEY, -1 /* StorageScope.WORKSPACE */);
		let signatures: Array<{ id: string; dataURL: string; createdAt: number }> = [];

		if (stored) {
			try {
				signatures = JSON.parse(stored);
			} catch (e) {
				console.error('[PDF Viewer] Failed to parse saved signatures:', e);
			}
		}

		// Remove signature
		signatures = signatures.filter(s => s.id !== signatureId);

		// Save back to storage
		this.storageService.store(
			PDFViewerEditor.SIGNATURES_STORAGE_KEY,
			JSON.stringify(signatures),
			-1 /* StorageScope.WORKSPACE */,
			0 /* StorageTarget.USER */
		);

		console.log('[PDF Viewer] Deleted signature:', signatureId);

		// Send updated list to webview
		this.sendSavedSignaturesToWebview();
	}

	private sendSavedSignaturesToWebview(): void {
		const stored = this.storageService.get(PDFViewerEditor.SIGNATURES_STORAGE_KEY, -1 /* StorageScope.WORKSPACE */);
		let signatures: Array<{ id: string; dataURL: string; createdAt: number }> = [];

		if (stored) {
			try {
				signatures = JSON.parse(stored);
			} catch (e) {
				console.error('[PDF Viewer] Failed to parse saved signatures:', e);
			}
		}

		this.webview?.postMessage({
			type: 'savedSignatures',
			signatures
		});

		console.log('[PDF Viewer] Sent saved signatures to webview:', signatures.length);
	}

	private async printPdf(): Promise<void> {
		// Open the original PDF file in the system's default browser
		// Browsers can print PDFs natively, which is more efficient and higher quality
		if (!this._currentInput) {
			console.warn('[PDF Viewer] No PDF loaded for printing');
			return;
		}

		console.log('[PDF Viewer] Opening PDF in system browser for printing');

		try {
			// Simply open the original PDF file in the system browser
			await this.openerService.open(this._currentInput.resource, { openExternal: true });
			console.log('[PDF Viewer] Opened PDF in system browser');
		} catch (error) {
			console.error('[PDF Viewer] Print error:', error);
		}
	}

	/**
	 * Handle Send for DocuSign e-signature request
	 */
	private async handleSendForDocuSign(): Promise<void> {
		if (!this._currentInput) {
			console.warn('[PDF Viewer] No PDF loaded for DocuSign');
			return;
		}

		console.log('[PDF Viewer] Initiating DocuSign flow');

		// Check if DocuSign service is configured and signed in
		if (!this.docuSignService.isSignedIn()) {
			this.notificationService.notify({
				severity: Severity.Warning,
				message: 'Please sign in to DocuSign first. Go to Settings > DocuSign to configure.',
			});
			return;
		}

		try {
			// Get the PDF data (use cached data if available)
			const pdfUri = this._currentInput.resource.toString();
			let pdfBase64: string;

			if (this._pdfDataCache?.uri === pdfUri) {
				pdfBase64 = this._pdfDataCache.data;
			} else {
				// Load the PDF if not cached
				const fileContent = await this.fileService.readFile(this._currentInput.resource);
				const uint8Array = new Uint8Array(fileContent.value.buffer);
				let binaryString = '';
				for (let i = 0; i < uint8Array.length; i++) {
					binaryString += String.fromCharCode(uint8Array[i]);
				}
				pdfBase64 = btoa(binaryString);
			}

			// Get filename
			const path = this._currentInput.resource.path;
			const filename = path.substring(path.lastIndexOf('/') + 1) || 'document.pdf';

			// Execute the DocuSign command
			await this.commandService.executeCommand('void.docusign.sendForSignature', {
				documentBase64: pdfBase64,
				documentUri: pdfUri,
				filename: filename
			});

		} catch (error) {
			console.error('[PDF Viewer] DocuSign error:', error);
			this.notificationService.notify({
				severity: Severity.Error,
				message: `Failed to send for signature: ${error instanceof Error ? error.message : 'Unknown error'}`,
			});
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

	protected override setEditorVisible(visible: boolean): void {
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
			this._lastLoadedPdfUri = undefined; // Clear the loaded PDF tracker
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
						   style-src 'unsafe-inline' vscode-resource:;
						   img-src data: vscode-resource:;
						   connect-src *;
						   font-src data: vscode-resource:;">
			<link rel="stylesheet" href="${cssUri}">
		</head>
		<body>
			<div id="pdf-viewer-layout">
				<div id="sidebar">
					<div id="sidebar-header">
						<button id="toggle-sidebar" title="Toggle Sidebar">☰</button>
						<div id="sidebar-tabs">
							<button class="sidebar-tab active" data-tab="thumbnails">Thumbnails</button>
							<button class="sidebar-tab" data-tab="outline">Outline</button>
							<button class="sidebar-tab" data-tab="bookmarks">Bookmarks</button>
						</div>
					</div>
					<div id="sidebar-content">
						<div id="thumbnails-view" class="tab-content active">
							<div id="thumbnails-container"></div>
						</div>
						<div id="outline-view" class="tab-content">
							<div id="outline-container"></div>
						</div>
						<div id="bookmarks-view" class="tab-content">
							<div id="bookmarks-header">
								<button id="add-bookmark" title="Add Bookmark">+ Add Bookmark</button>
							</div>
							<div id="bookmarks-container"></div>
						</div>
					</div>
				</div>
				<div id="pdf-container">
					<div id="pdf-controls">
						<button id="prev-page">Previous</button>
						<span id="page-info">Page <span id="current-page">1</span> of <span id="total-pages">1</span></span>
						<button id="next-page">Next</button>
						<span class="controls-separator"></span>
						<button id="zoom-in">Zoom In</button>
						<button id="zoom-out">Zoom Out</button>
						<span class="controls-separator"></span>
						<button id="print-btn" title="Print (Ctrl+P)">🖨️ Print</button>
						<span class="controls-separator"></span>
						<button id="add-signature" title="Add Signature">✍️ Signature</button>
						<button id="send-docusign" title="Send for e-Signature via DocuSign">📧 DocuSign</button>
						<span class="controls-separator"></span>
					<div id="annotation-toolbar">
							<button class="highlight-btn highlight-yellow" data-color="yellow" title="Yellow Highlight">🖍️</button>
							<button class="highlight-btn highlight-green" data-color="green" title="Green Highlight">🖍️</button>
							<button class="highlight-btn highlight-blue" data-color="blue" title="Blue Highlight">🖍️</button>
							<button class="highlight-btn highlight-pink" data-color="pink" title="Pink Highlight">🖍️</button>
							<button id="delete-highlight" title="Delete Highlight">🗑️</button>
						</div>
					</div>
					<div id="canvas-wrapper">
						<div id="pdf-render-container">
							<canvas id="pdf-canvas"></canvas>
							<div id="pdf-text-layer" class="pdf-text-layer"></div>
						</div>
					</div>
				</div>
			</div>

			<!-- Signature Modal -->
			<div id="signature-modal" class="signature-modal">
				<div class="signature-modal-content">
					<div class="signature-modal-header">
						<h3>Draw Your Signature</h3>
						<button id="close-signature-modal" class="close-modal-btn">×</button>
					</div>
				<div class="signature-modal-body">
					<div class="signature-mode-toggle">
						<button id="draw-mode-btn" class="mode-btn active">✏️ Draw</button>
						<button id="type-mode-btn" class="mode-btn">✍️ Type</button>
					</div>

					<div id="draw-mode-container" class="signature-mode-container">
						<div class="signature-canvas-container">
							<canvas id="signature-canvas" width="400" height="200"></canvas>
							<div class="signature-instructions">Draw your signature using mouse or touch</div>
						</div>
					</div>

					<div id="type-mode-container" class="signature-mode-container hidden">
						<div class="signature-text-container">
							<input type="text" id="signature-text-input" placeholder="Type your name" maxlength="50" class="signature-text-input">
							<div class="signature-text-preview">
								<canvas id="signature-text-canvas" width="400" height="200"></canvas>
							</div>
							<div class="signature-font-controls">
								<label>Style:
									<select id="signature-font-select" class="signature-font-select">
										<option value="signature1">Classic Script</option>
										<option value="signature2">Elegant Cursive</option>
										<option value="signature3">Modern Script</option>
										<option value="signature4">Bold Signature</option>
									</select>
								</label>
								<label>Size:
									<input type="range" id="signature-size-slider" min="20" max="80" value="40" class="signature-size-slider">
									<span id="signature-size-value">40px</span>
								</label>
							</div>
						</div>
					</div>

					<div class="signature-actions">
						<button id="clear-signature" class="signature-btn">Clear</button>
						<button id="save-signature" class="signature-btn primary">Save Signature</button>
					</div>
						<div class="saved-signatures">
							<h4>Saved Signatures</h4>
							<div id="saved-signatures-list"></div>
						</div>
					</div>
					<div class="signature-modal-footer">
						<button id="cancel-signature" class="signature-btn">Cancel</button>
						<button id="done-signature" class="signature-btn primary">Done</button>
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


/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { EditorPane } from '../../../../../browser/parts/editor/editorPane.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { PDFViewerInput, PDFSelection } from './pdfViewerInput.js';
import { IEditorOptions } from '../../../../../../platform/editor/common/editor.js';
import { IEditorOpenContext } from '../../../../../common/editor.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { IWebviewService, IOverlayWebview } from '../../../../webview/browser/webview.js';
import { asWebviewUri } from '../../../../webview/common/webview.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import * as DOM from '../../../../../../base/browser/dom.js';
import { Dimension } from '../../../../../../base/browser/dom.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';
import { CodeWindow } from '../../../../../../base/browser/window.js';
import { FileAccess } from '../../../../../../base/common/network.js';
import { URI } from '../../../../../../base/common/uri.js';
import { EditorInput } from '../../../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../../../services/editor/common/editorGroupsService.js';

export class PDFViewerEditor extends EditorPane {
	static readonly ID = 'void.pdfViewer';

	private _element?: HTMLElement;
	private _dimension?: Dimension;
	private webview?: IOverlayWebview;
	private _currentInput?: PDFViewerInput;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IFileService private readonly fileService: IFileService
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

		// Load PDF file
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
					encoding: 'base64'
				});
			}
		} catch (error) {
			console.error('Failed to load PDF:', error);
			// Could show an error message in the webview here
		}
	}

	private handleWebviewMessage(message: any): void {
		if (!this._currentInput) {
			return;
		}

		switch (message.type) {
			case 'pageChanged':
				// Track current page for Ctrl+K
				this._currentInput.currentPage = message.page;
				break;
			case 'textSelected':
				// Store selection for Ctrl+K
				this._currentInput.selection = message.selection as PDFSelection;
				break;
			case 'clearSelection':
				this._currentInput.selection = null;
				break;
		}
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
			<div id="pdf-container">
				<canvas id="pdf-canvas"></canvas>
				<div id="pdf-controls">
					<button id="prev-page">Previous</button>
					<span id="page-info">Page <span id="current-page">1</span> of <span id="total-pages">1</span></span>
					<button id="next-page">Next</button>
					<button id="zoom-in">Zoom In</button>
					<button id="zoom-out">Zoom Out</button>
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


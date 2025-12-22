/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as DOM from '../../../../../../base/browser/dom.js';
import { Dimension } from '../../../../../../base/browser/dom.js';
import { CodeWindow } from '../../../../../../base/browser/window.js';
import { VSBuffer } from '../../../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../../../base/common/cancellation.js';
import { IDisposable } from '../../../../../../base/common/lifecycle.js';
import { FileAccess } from '../../../../../../base/common/network.js';
import { URI } from '../../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';
import { IEditorOptions } from '../../../../../../platform/editor/common/editor.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
import { IOpenerService } from '../../../../../../platform/opener/common/opener.js';
import { IStorageService } from '../../../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../../../common/editor.js';
import { EditorInput } from '../../../../../common/editor/editorInput.js';
import { IEditorGroup } from '../../../../../services/editor/common/editorGroupsService.js';
import { INativeWorkbenchEnvironmentService } from '../../../../../services/environment/electron-sandbox/environmentService.js';
import { IWorkingCopyService } from '../../../../../services/workingCopy/common/workingCopyService.js';
import { IOverlayWebview, IWebviewService } from '../../../../webview/browser/webview.js';
import { asWebviewUri } from '../../../../webview/common/webview.js';
import { XLSXViewerInput } from './xlsxViewerInput.js';
import { XLSXWorkingCopy } from './xlsxWorkingCopy.js';

export class XLSXViewerEditor extends EditorPane {
	static readonly ID = 'void.xlsxViewer';

	private _element?: HTMLElement;
	private _dimension?: Dimension;
	private webview?: IOverlayWebview;
	private _currentInput?: XLSXViewerInput;
	private _webviewReady: boolean = false;
	private _pendingInput?: XLSXViewerInput;
	private _xlsxDataCache?: { uri: string; data: string };
	private _isLoading: boolean = false;
	private _workingCopy?: XLSXWorkingCopy;
	private _workingCopyDisposable?: IDisposable;
	private _saveCompleteResolver?: (success: boolean) => void;
	private _pendingSaveTimeout?: NodeJS.Timeout;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IFileService private readonly fileService: IFileService,
		@IWorkingCopyService private readonly workingCopyService: IWorkingCopyService,
		@IOpenerService private readonly openerService: IOpenerService,
		@INativeWorkbenchEnvironmentService private readonly environmentService: INativeWorkbenchEnvironmentService
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

		// Create or get working copy for this document
		this.ensureWorkingCopy(input.resource, input.getName());

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

			// If input has modified content, use that
			if (input.hasContent()) {
				console.log('[XLSX Viewer] Loading from input modified content');
				this.webview.postMessage({
					type: 'loadXLSX',
					data: input.getContent(),
					encoding: 'base64',
					xlsxUri: currentUri
				});
				return;
			}

			// If same XLSX is already loaded and cached, resend to webview
			if (this._xlsxDataCache?.uri === currentUri) {
				console.log('✅ [XLSX Viewer] Same XLSX cached, resending to webview');
				this.webview.postMessage({
					type: 'loadXLSX',
					data: this._xlsxDataCache.data,
					encoding: 'base64',
					xlsxUri: currentUri
				});
				return;
			}

			// Different XLSX, load it
			console.log('[XLSX Viewer] Different XLSX, loading');
			await this.loadXLSX(input);
		} else {
			// Webview not ready yet, queue the input
			console.log('[XLSX Viewer] Webview not ready, queuing input');
			this._pendingInput = input;
		}
	}

	private async loadXLSX(input: XLSXViewerInput): Promise<void> {
		if (this._isLoading || !this.webview) {
			return;
		}

		// If input has modified content, use that instead of loading from disk
		if (input.hasContent()) {
			console.log('[XLSX Viewer] Loading XLSX from input content');
			this.webview.postMessage({
				type: 'loadXLSX',
				data: input.getContent(),
				encoding: 'base64',
				xlsxUri: input.resource.toString()
			});
			return;
		}

		this._isLoading = true;

		try {
			const currentUri = input.resource.toString();
			console.log('[XLSX Viewer] Loading XLSX:', currentUri);

			const fileContent = await this.fileService.readFile(input.resource);

			// Convert to base64 manually
			const uint8Array = new Uint8Array(fileContent.value.buffer);
			let base64 = '';
			const chunkSize = 8192;

			for (let i = 0; i < uint8Array.length; i += chunkSize) {
				const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
				base64 += String.fromCharCode.apply(null, Array.from(chunk));
			}

			const base64Data = btoa(base64);
			console.log('[XLSX Viewer] Base64 encoded - Length:', base64Data.length);

			// Cache the data
			this._xlsxDataCache = { uri: currentUri, data: base64Data };

			// Send to webview
			this.webview.postMessage({
				type: 'loadXLSX',
				data: base64Data,
				encoding: 'base64',
				xlsxUri: currentUri
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
					this.loadXLSX(pendingInput);
				}
				break;

			case 'contentChanged':
				// Mark working copy as dirty when content changes
				if (this._workingCopy) {
					// console.log('[XLSX Viewer] Content changed, marking working copy dirty'); // noisy
					this._workingCopy.markDirty();
				}
				// Update input content if provided
				if (this._currentInput && data.data) {
					this._currentInput.setContent(data.data);
				}
				break;

			case 'saveRequested':
				if (this._currentInput && data.data) {
					// Await the save and resolve based on actual result
					this.saveXLSX(this._currentInput.resource, data.data)
						.then(() => {
							if (this._saveCompleteResolver) {
								this._saveCompleteResolver(true);
							}
						})
						.catch((error) => {
							console.error('[XLSX Viewer] Save failed:', error);
							if (this._saveCompleteResolver) {
								this._saveCompleteResolver(false);
							}
						});
				} else {
					// Resolve with false if no data
					if (this._saveCompleteResolver) {
						this._saveCompleteResolver(false);
					}
				}
				break;

			case 'executeOperations':
				// Forward agent edit operations to webview for execution
				if (this.webview) {
					this.webview.postMessage({
						type: 'executeOperations',
						operations: data.operations
					});
				}
				break;

			case 'print':
				// Handle printing from the main editor process (outside sandbox)
				if (data.html) {
					this.printHtml(data.html);
				}
				break;
		}
	}

	private async printHtml(html: string): Promise<void> {
		// Write HTML to a temp file and open in system browser for printing
		// This bypasses all CSP, Trusted Types, and Electron sandbox restrictions
		console.log('[XLSX Viewer] Printing via temp file in browser');

		try {
			// Add print script to HTML to auto-trigger print dialog
			const printReadyHtml = html.replace(
				'</body>',
				`<script>
					window.onload = function() {
						setTimeout(function() {
							window.print();
						}, 500);
					};
				</script>
				</body>`
			);

			// Generate a unique temp file path
			const tempDir = this.environmentService.tmpDir;
			const tempFileName = `xlsx-print-${generateUuid()}.html`;
			const tempFileUri = URI.joinPath(tempDir, tempFileName);

			console.log('[XLSX Viewer] Writing print HTML to:', tempFileUri.toString());

			// Write HTML to temp file
			await this.fileService.writeFile(tempFileUri, VSBuffer.fromString(printReadyHtml));

			// Open in external browser
			await this.openerService.open(tempFileUri, { openExternal: true });

			console.log('[XLSX Viewer] Opened print file in browser');

			// Schedule cleanup of temp file after a delay (give user time to print)
			setTimeout(async () => {
				try {
					await this.fileService.del(tempFileUri);
					console.log('[XLSX Viewer] Cleaned up temp print file');
				} catch (e) {
					// Ignore cleanup errors
					console.warn('[XLSX Viewer] Could not clean up temp file:', e);
				}
			}, 60000); // Cleanup after 1 minute

		} catch (error) {
			console.error('[XLSX Viewer] Print error:', error);
		}
	}

	private async saveXLSX(uri: URI, base64Data: string): Promise<void> {
		try {
			console.log('[XLSX Viewer] Saving XLSX, size:', base64Data.length);

			const binaryString = atob(base64Data);
			const uint8Array = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				uint8Array[i] = binaryString.charCodeAt(i);
			}
			const bytes = VSBuffer.wrap(uint8Array);

			await this.fileService.writeFile(uri, bytes);
			console.log('[XLSX Viewer] Document saved successfully');

			// Update the cache with the newly saved data so navigating away and back shows correct content
			this._xlsxDataCache = { uri: uri.toString(), data: base64Data };
			console.log('[XLSX Viewer] Cache updated with saved data');

			// Mark working copy as saved
			if (this._workingCopy) {
				this._workingCopy.markSaved();
			}

			// Notify webview
			if (this.webview) {
				this.webview.postMessage({ type: 'saveComplete', success: true });
			}

		} catch (error) {
			console.error('[XLSX Viewer] Failed to save document:', error);

			if (this.webview) {
				this.webview.postMessage({
					type: 'saveComplete',
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}
	}

	/**
	 * Ensure a working copy exists for the given resource
	 */
	private ensureWorkingCopy(resource: URI, name: string): void {
		// Clean up old working copy if it exists
		if (this._workingCopy) {
			this._workingCopyDisposable?.dispose();
			this._workingCopy.dispose();
			this._workingCopy = undefined;
			this._workingCopyDisposable = undefined;
		}

		// Create new working copy
		this._workingCopy = new XLSXWorkingCopy(resource, name);

		// Connect working copy to input for dirty state reporting
		if (this._currentInput) {
			this._currentInput.setWorkingCopy(this._workingCopy);
		}

		// Set up save handler
		this._workingCopy.setSaveHandler(async (reason) => {
			console.log('[XLSX Viewer] Working copy save triggered, reason:', reason, 'webviewReady:', this._webviewReady);

			// If webview isn't ready, return false to skip this save attempt
			if (!this.webview || !this._webviewReady) {
				console.warn('[XLSX Viewer] Webview not ready for save, will retry later');
				return false;
			}

			try {
				// Request save from webview
				this.webview.postMessage({ type: 'saveRequest', reason });

				// Wait for save response (with timeout)
				const success = await this.waitForSaveComplete();
				console.log('[XLSX Viewer] Save result:', success);
				return success;
			} catch (error) {
				console.error('[XLSX Viewer] Save handler error:', error);
				return false;
			}
		});

		// Register with working copy service
		this._workingCopyDisposable = this.workingCopyService.registerWorkingCopy(this._workingCopy);
		console.log('[XLSX Viewer] Working copy registered for:', resource.toString());
	}

	/**
	 * Wait for save complete message from webview
	 */
	private waitForSaveComplete(): Promise<boolean> {
		return new Promise((resolve) => {
			// Clear any existing timeout
			if (this._pendingSaveTimeout) {
				clearTimeout(this._pendingSaveTimeout);
			}

			// Set new timeout (5 seconds for active saves)
			this._pendingSaveTimeout = setTimeout(() => {
				console.warn('[XLSX Viewer] Save timeout after 5 seconds');
				this._saveCompleteResolver = undefined;
				this._pendingSaveTimeout = undefined;
				resolve(false);
			}, 5000);

			// Store the resolve function to be called when save completes
			this._saveCompleteResolver = (success: boolean) => {
				if (this._pendingSaveTimeout) {
					clearTimeout(this._pendingSaveTimeout);
					this._pendingSaveTimeout = undefined;
				}
				this._saveCompleteResolver = undefined;
				resolve(success);
			};
		});
	}

	/**
	 * Trigger save programmatically (e.g., Ctrl+S)
	 */
	async triggerSave(): Promise<boolean> {
		if (this._workingCopy) {
			return await this._workingCopy.save();
		}
		return false;
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
			this.webview.postMessage({ type: 'clearXLSX' });
		}

		// Unregister working copy and clear input's reference to prevent stale dirty state
		if (this._workingCopy) {
			if (this._currentInput) {
				this._currentInput.clearWorkingCopy();
			}
			this._workingCopyDisposable?.dispose();
			this._workingCopy.dispose();
			this._workingCopy = undefined;
			this._workingCopyDisposable = undefined;
		}

		this._currentInput = undefined;
		super.clearInput();
	}

	override dispose(): void {
		// Clean up pending save timeout
		if (this._pendingSaveTimeout) {
			clearTimeout(this._pendingSaveTimeout);
			this._pendingSaveTimeout = undefined;
		}

		// Reject any pending save promises
		if (this._saveCompleteResolver) {
			this._saveCompleteResolver(false);
			this._saveCompleteResolver = undefined;
		}

		// Clean up working copy
		if (this._workingCopy) {
			this._workingCopyDisposable?.dispose();
			this._workingCopy.dispose();
			this._workingCopy = undefined;
			this._workingCopyDisposable = undefined;
		}

		if (this.webview) {
			this.webview.release(this);
		}
		super.dispose();
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
		const xspreadsheetJsUri = asWebviewUri(URI.joinPath(mediaUri, 'lib', 'xspreadsheet.js'));
		const xspreadsheetCssUri = asWebviewUri(URI.joinPath(mediaUri, 'lib', 'xspreadsheet.css'));
		const ribbonUri = asWebviewUri(URI.joinPath(mediaUri, 'xlsxRibbon.js'));
		const scriptUri = asWebviewUri(URI.joinPath(mediaUri, 'xlsxViewer.js'));
		const styleUri = asWebviewUri(URI.joinPath(mediaUri, 'xlsxViewer.css'));

		// Icons (Simple SVGs for demonstration)
		const icons = {
			save: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M14 4.414L11.586 2H2v12h12V4.414zM11 3v3H5V3h6zm-1 11H6v-4h4v4zm2 0h-1v-4a1 1 0 0 0-1-1H6a1 1 0 0 0-1 1v4H3V4h1v3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.414l1 1V14z"/></svg>`,
			undo: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3a5 5 0 0 0-5 5v1H1V8a7 7 0 1 1 14 0V5h-2v3a5 5 0 1 0-5-5z"/><path d="M1 9l2.5-2.5L6 9H1z"/></svg>`,
			redo: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3a5 5 0 0 1 5 5v1h2V8a7 7 0 1 0-14 0V5h2v3a5 5 0 1 1 5-5z"/><path d="M15 9l-2.5-2.5L10 9h5z"/></svg>`,
			bold: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M4 2h4.5a3.5 3.5 0 0 1 3.5 3.5c0 1.3-.7 2.4-1.8 3a3.5 3.5 0 0 1 1.8 3c0 1.9-1.6 3.5-3.5 3.5H4V2zm2 5h2.5a1.5 1.5 0 1 0 0-3H6v3zm0 6h2.5a1.5 1.5 0 1 0 0-3H6v3z"/></svg>`,
			italic: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M6 2h6v2H9.5l-3 8H9v2H3v-2h2.5l3-8H6V2z"/></svg>`,
			underline: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 2h2v6a3 3 0 0 0 6 0V2h2v6a5 5 0 1 1-10 0V2zm0 11h10v2H3v-2z"/></svg>`,
			strikethrough: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M3 7h10v2H3V7zm1-5h2v3H4V2zm6 0h2v3h-2V2zM4 11h2v3H4v-3zm6 0h2v3h-2v-3z"/></svg>`,
			alignLeft: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v2H2V2zm0 4h8v2H2V6zm0 4h12v2H2v-2zm0 4h8v2H2v-2z"/></svg>`,
			alignCenter: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v2H2V2zm2 4h8v2H4V6zm-2 4h12v2H2v-2zm2 4h8v2H4v-2z"/></svg>`,
			alignRight: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v2H2V2zm4 4h8v2H6V6zm-4 4h12v2H2v-2zm4 4h8v2H6v-2z"/></svg>`,
			merge: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v12H2V2zm1 1v10h10V3H3zm2 2h6v6H5V5z"/></svg>`,
			textColor: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M8 2L3 14h2l1-3h4l1 3h2L8 2zm-2 7l2-5 2 5H6z"/><path d="M2 14h12v2H2v-2z" fill="currentColor"/></svg>`,
			fillColor: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M13.6 4.8l-2.4-2.4c-.5-.5-1.3-.5-1.8 0L2.2 9.6c-.5.5-.5 1.3 0 1.8l2.4 2.4c.5.5 1.3.5 1.8 0l7.2-7.2c.5-.5.5-1.3 0-1.8zM5.5 12.9L3.1 10.5l7.2-7.2 2.4 2.4-7.2 7.2z"/><path d="M2 14h12v2H2v-2z" fill="currentColor"/></svg>`,
			border: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v12H2V2zm1 1v10h10V3H3zm2 2h6v6H5V5z"/></svg>`, // Placeholder
			clear: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M11.4 4L10 2.6 8.6 4 7.2 2.6 5.8 4 4.4 2.6 3 4v10h10V4h-1.6zM12 13H4V5h8v8z"/></svg>`,
			chevronDown: `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M4.427 5.427l3.396 3.396a.25.25 0 0 0 .354 0l3.396-3.396A.25.25 0 0 1 12 5.5v.5a.25.25 0 0 1-.073.177l-3.75 3.75a.25.25 0 0 1-.354 0l-3.75-3.75A.25.25 0 0 1 4 6v-.5a.25.25 0 0 1 .427-.073z"/></svg>`
		};

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' vscode-resource:; style-src 'unsafe-inline' vscode-resource:;">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>XLSX Viewer</title>
	<link rel="stylesheet" href="${xspreadsheetCssUri}">
	<link rel="stylesheet" href="${styleUri}?v=${Date.now()}">
</head>
<body>
	<div class="ribbon-container">
		<div class="ribbon-tabs">
			<div class="ribbon-tab active" data-tab="home">Home</div>
			<div class="ribbon-tab" data-tab="view">View</div>
			<div class="ribbon-tab" data-tab="data">Data</div>
		</div>

		<div class="ribbon-content">
			<!-- Home Tab -->
			<div class="ribbon-panel active" id="tab-home">
				<div class="ribbon-group">
					<div class="ribbon-btn-col">
						<button class="ribbon-btn" id="btn-save" title="Save (Ctrl+S)">${icons.save}<span>Save</span></button>
					</div>
					<div class="ribbon-btn-col">
						<button class="ribbon-btn" id="btn-print" title="Print (Ctrl+P)">🖨️<span>Print</span></button>
					</div>
					<div class="ribbon-group-label">File</div>
				</div>
				<div class="ribbon-separator"></div>

				<div class="ribbon-group">
					<div class="ribbon-btn-row">
						<button class="ribbon-icon-btn" id="btn-undo" title="Undo">${icons.undo}</button>
						<button class="ribbon-icon-btn" id="btn-redo" title="Redo">${icons.redo}</button>
					</div>
					<div class="ribbon-group-label">History</div>
				</div>
				<div class="ribbon-separator"></div>

				<div class="ribbon-group">
					<div class="ribbon-btn-row">
						<select id="font-family" class="ribbon-select" style="width: 100px;">
							<option value="Helvetica">Helvetica</option>
							<option value="Arial">Arial</option>
							<option value="Times New Roman">Times New Roman</option>
							<option value="Courier New">Courier New</option>
							<option value="Verdana">Verdana</option>
						</select>
						<select id="font-size" class="ribbon-select" style="width: 50px;">
							<option value="8">8</option>
							<option value="9">9</option>
							<option value="10" selected>10</option>
							<option value="11">11</option>
							<option value="12">12</option>
							<option value="14">14</option>
							<option value="16">16</option>
							<option value="18">18</option>
							<option value="24">24</option>
						</select>
					</div>
					<div class="ribbon-btn-row">
						<button class="ribbon-icon-btn" id="btn-bold" title="Bold">${icons.bold}</button>
						<button class="ribbon-icon-btn" id="btn-italic" title="Italic">${icons.italic}</button>
						<button class="ribbon-icon-btn" id="btn-underline" title="Underline">${icons.underline}</button>
						<button class="ribbon-icon-btn" id="btn-strike" title="Strikethrough">${icons.strikethrough}</button>
						<div class="ribbon-divider"></div>

						<div class="ribbon-dropdown-btn-container">
							<button class="ribbon-icon-btn" id="btn-text-color" title="Text Color">
								<div style="display:flex; flex-direction:column; align-items:center;">
									${icons.textColor}
									<div id="text-color-indicator" style="width:12px; height:3px; background-color: #000; margin-top:-2px;"></div>
								</div>
								${icons.chevronDown}
							</button>
							<div class="color-picker-popup" id="text-color-picker">
								<!-- Colors injected by JS -->
							</div>
						</div>

						<div class="ribbon-dropdown-btn-container">
							<button class="ribbon-icon-btn" id="btn-fill-color" title="Fill Color">
								<div style="display:flex; flex-direction:column; align-items:center;">
									${icons.fillColor}
									<div id="fill-color-indicator" style="width:12px; height:3px; background-color: transparent; margin-top:-2px;"></div>
								</div>
								${icons.chevronDown}
							</button>
							<div class="color-picker-popup" id="fill-color-picker">
								<!-- Colors injected by JS -->
							</div>
						</div>

					</div>
					<div class="ribbon-group-label">Font</div>
				</div>
				<div class="ribbon-separator"></div>

				<div class="ribbon-group">
					<div class="ribbon-btn-row">
						<button class="ribbon-icon-btn" id="btn-align-left" title="Align Left">${icons.alignLeft}</button>
						<button class="ribbon-icon-btn" id="btn-align-center" title="Align Center">${icons.alignCenter}</button>
						<button class="ribbon-icon-btn" id="btn-align-right" title="Align Right">${icons.alignRight}</button>
					</div>
					<div class="ribbon-btn-row">
						<button class="ribbon-icon-btn" id="btn-merge" title="Merge Cells">${icons.merge}</button>
					</div>
					<div class="ribbon-group-label">Alignment</div>
				</div>
				<div class="ribbon-separator"></div>

				<div class="ribbon-group">
					<div class="ribbon-btn-row">
						<button class="ribbon-btn" id="btn-sum" title="AutoSum">Σ <span>SUM</span></button>
					</div>
					<div class="ribbon-btn-row">
						<button class="ribbon-icon-btn" id="btn-average" title="Average">AVG</button>
						<button class="ribbon-icon-btn" id="btn-count" title="Count">CNT</button>
						<button class="ribbon-icon-btn" id="btn-min" title="Minimum">MIN</button>
						<button class="ribbon-icon-btn" id="btn-max" title="Maximum">MAX</button>
					</div>
					<div class="ribbon-group-label">Formulas</div>
				</div>
			</div>

			<!-- View Tab -->
			<div class="ribbon-panel" id="tab-view">
				<div class="ribbon-group">
					<div class="ribbon-btn-row">
						<label><input type="checkbox" id="chk-gridlines" checked> Gridlines</label>
					</div>
					<div class="ribbon-group-label">Show</div>
				</div>
			</div>

			<!-- Data Tab -->
			<div class="ribbon-panel" id="tab-data">
				<div class="ribbon-group">
					<div class="ribbon-btn-col">
						<button class="ribbon-btn" id="btn-clear" title="Clear All">${icons.clear}<span>Clear</span></button>
					</div>
					<div class="ribbon-group-label">Data Tools</div>
				</div>
			</div>
		</div>
	</div>

	<div id="formula-bar">
		<div id="cell-name">A1</div>
		<div id="formula-sep">|</div>
		<div id="formula-icon">fx</div>
		<input type="text" id="formula-input" placeholder="">
	</div>

	<div id="x-spreadsheet-demo"></div>

	<script nonce="${nonce}" src="${xlsxLibUri}"></script>
	<script nonce="${nonce}" src="${xspreadsheetJsUri}"></script>
	<script nonce="${nonce}" src="${ribbonUri}?v=${Date.now()}"></script>
	<script nonce="${nonce}" src="${scriptUri}?v=${Date.now()}"></script>
</body>
</html>`;
	}
}

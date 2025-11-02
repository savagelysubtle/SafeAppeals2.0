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
import { DOCXSelection, DOCXViewerInput } from './docxViewerInput.js';

export class DOCXViewerEditor extends EditorPane {
	static readonly ID = 'void.docxViewer';

	private _element?: HTMLElement;
	private _dimension?: Dimension;
	private webview?: IOverlayWebview;
	private _currentInput?: DOCXViewerInput;
	private _webviewReady: boolean = false;
	private _pendingInput?: DOCXViewerInput;
	private _docxDataCache?: { uri: string; data: string };
	private _isLoading: boolean = false;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IFileService private readonly fileService: IFileService
	) {
		super(DOCXViewerEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		this._element = DOM.append(parent, DOM.$('div.docx-viewer-container'));
		this._element.style.width = '100%';
		this._element.style.height = '100%';
		this._element.style.position = 'relative';
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		if (token.isCancellationRequested || !(input instanceof DOCXViewerInput)) {
			return;
		}

		this._currentInput = input;
		console.log('[DOCX Viewer] setInput called for:', input.resource.toString());

		// Create webview if it doesn't exist
		if (!this.webview && this._element) {
			this.webview = this.webviewService.createWebviewOverlay({
				title: 'DOCX Viewer',
				providedViewType: 'void.docxViewer',
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

			// If same DOCX is already loaded and cached, resend to webview
			if (this._docxDataCache?.uri === currentUri) {
				console.log('✅ [DOCX Viewer] Same DOCX cached, resending to webview');
				this.webview.postMessage({
					type: 'loadDOCX',
					data: this._docxDataCache.data,
					encoding: 'base64',
					docxUri: currentUri
				});
				return;
			}

			// Different DOCX, load it
			console.log('[DOCX Viewer] Different DOCX, loading');
			await this.loadDOCX(input);
		} else {
			// Webview not ready yet, queue the input
			console.log('[DOCX Viewer] Webview not ready, queuing input');
			this._pendingInput = input;
		}
	}

	private async loadDOCX(input: DOCXViewerInput): Promise<void> {
		if (this._isLoading || !this.webview) {
			return;
		}

		this._isLoading = true;

		try {
			const currentUri = input.resource.toString();
			console.log('[DOCX Viewer] Loading DOCX:', currentUri);

			// Retry logic for newly created files that may still be populating
			let fileContent: Awaited<ReturnType<typeof this.fileService.readFile>> | undefined;
			let retries = 0;
			const maxRetries = 5; // Try up to 5 times
			const retryDelay = 100; // Wait 100ms between retries

			while (retries < maxRetries) {
				try {
					fileContent = await this.fileService.readFile(input.resource);
					console.log(`[DOCX Viewer] File read attempt ${retries + 1}/${maxRetries} - Size: ${fileContent.value.byteLength} bytes`);

					// If file is empty, it might still be populating - wait and retry
					if (fileContent.value.byteLength === 0) {
						if (retries < maxRetries - 1) {
							console.warn(`[DOCX Viewer] File is empty, waiting ${retryDelay}ms before retry...`);
							await new Promise(resolve => setTimeout(resolve, retryDelay));
							retries++;
							continue;
						} else {
							// Last retry failed
							throw new Error('DOCX file is empty (0 bytes) after multiple retries. The file may not have been created correctly.');
						}
					}

					// File has content, break out of retry loop
					break;

				} catch (error) {
					if (retries < maxRetries - 1) {
						console.warn(`[DOCX Viewer] Error reading file on attempt ${retries + 1}, retrying...`, error);
						await new Promise(resolve => setTimeout(resolve, retryDelay));
						retries++;
					} else {
						throw error;
					}
				}
			}

			// Ensure fileContent was successfully read
			if (!fileContent) {
				throw new Error('Failed to read file after multiple retries');
			}

			// Convert to base64 manually (like PDF viewer)
			const uint8Array = new Uint8Array(fileContent.value.buffer);

			// Verify ZIP signature
			if (uint8Array.length >= 4) {
				const signature = Array.from(uint8Array.slice(0, 4)).map(b => '0x' + b.toString(16).toUpperCase()).join(' ');
				console.log('[DOCX Viewer] File ZIP signature:', signature);
				const isValidZip = uint8Array[0] === 0x50 && uint8Array[1] === 0x4B;
				if (!isValidZip) {
					console.error('[DOCX Viewer] Invalid ZIP signature - file may be corrupted');
					throw new Error(`File does not have a valid ZIP signature. Expected 0x50 0x4B, got ${signature.substring(0, 11)}`);
				}
			}

			let base64 = '';
			const chunkSize = 8192;

			for (let i = 0; i < uint8Array.length; i += chunkSize) {
				const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
				base64 += String.fromCharCode.apply(null, Array.from(chunk));
			}

			const base64Data = btoa(base64);
			console.log('[DOCX Viewer] Base64 encoded - Length:', base64Data.length);

			// Cache the data
			this._docxDataCache = { uri: currentUri, data: base64Data };

			// Send to webview
			this.webview.postMessage({
				type: 'loadDOCX',
				data: base64Data,
				encoding: 'base64',
				docxUri: currentUri
			});

			console.log('[DOCX Viewer] DOCX loaded successfully');

		} catch (error) {
			console.error('[DOCX Viewer] Failed to load DOCX:', error);
		} finally {
			this._isLoading = false;
		}
	}

	private handleWebviewMessage(message: any): void {
		console.log('[DOCX Viewer] Received message from webview:', JSON.stringify(message));

		const data = message.message || message;

		switch (data.type) {
			case 'ready':
				console.log('[DOCX Viewer] Webview ready');
				this._webviewReady = true;

				// If there's a pending input, load it now
				if (this._pendingInput) {
					console.log('[DOCX Viewer] Processing pending input');
					const pendingInput = this._pendingInput;
					this._pendingInput = undefined;
					this.loadDOCX(pendingInput);
				}
				break;

			case 'textSelected':
				// Store selection for Ctrl+K
				if (this._currentInput) {
					this._currentInput.selection = data.selection as DOCXSelection;
				}
				break;

			case 'clearSelection':
				if (this._currentInput) {
					this._currentInput.selection = null;
				}
				break;

			case 'saveRequested':
				if (this._currentInput && (data.text || data.docxData)) {
					this.saveDOCX(this._currentInput.resource, data.text, data.html, data.docxData);
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

	private async saveDOCX(uri: URI, text: string, html?: string, docxData?: string): Promise<void> {
		try {
			let bytes: VSBuffer;

			if (docxData) {
				// Convert base64 DOCX data to bytes
				console.log('[DOCX Viewer] Saving as DOCX format, size:', docxData.length);
				const binaryString = atob(docxData);
				const uint8Array = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					uint8Array[i] = binaryString.charCodeAt(i);
				}
				bytes = VSBuffer.wrap(uint8Array);
			} else {
				// Fallback to plain text
				console.warn('[DOCX Viewer] No DOCX data provided, saving as plain text');
				bytes = VSBuffer.fromString(text);
			}

			await this.fileService.writeFile(uri, bytes);
			console.log('[DOCX Viewer] Document saved successfully');

			// Notify webview
			if (this.webview) {
				this.webview.postMessage({ type: 'saveComplete', success: true });
			}

		} catch (error) {
			console.error('[DOCX Viewer] Failed to save document:', error);

			if (this.webview) {
				this.webview.postMessage({
					type: 'saveComplete',
					success: false,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
			}
		}
	}

	public getInput(): DOCXViewerInput | undefined {
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
			this.webview.postMessage({ type: 'clearDOCX' });
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
		return FileAccess.asFileUri('vs/workbench/contrib/void/browser/documentViewers/docxViewer/media');
	}

	private getWebviewHTML(): string {
		if (!this.webview) {
			return '';
		}

		const nonce = generateUuid();
		const mediaUri = this.getMediaUri();

		// Tiptap and dependencies
		const tiptapDocxBundleUri = asWebviewUri(URI.joinPath(mediaUri, 'tiptapDocxBundle.js'));
		const tiptapBundleUri = asWebviewUri(URI.joinPath(mediaUri, 'tiptapBundle.js'));
		const docxLibUri = asWebviewUri(URI.joinPath(mediaUri, 'lib', 'docx-preview.min.js'));
		const scriptUri = asWebviewUri(URI.joinPath(mediaUri, 'docxViewerTiptap.js'));
		const styleUri = asWebviewUri(URI.joinPath(mediaUri, 'docxViewer.css'));

		// CDN dependencies (only JSZip for docx-preview)
		const jszipCdnUri = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
		// Note: Tiptap and docx library are now bundled in tiptapDocxBundle.js

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data: blob: vscode-resource:; script-src 'nonce-${nonce}' https://cdnjs.cloudflare.com vscode-resource:; style-src 'unsafe-inline' vscode-resource:; font-src data: vscode-resource:;">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>DOCX Viewer</title>
	<link rel="stylesheet" href="${styleUri}">
</head>
<body>
	<div id="docx-toolbar">
		<!-- File Operations -->
		<button id="save-btn" title="Save (Ctrl+S)">💾 Save</button>
		<span class="toolbar-separator">|</span>

		<!-- Edit Operations -->
		<button id="undo-btn" title="Undo (Ctrl+Z)">↶ Undo</button>
		<button id="redo-btn" title="Redo (Ctrl+Y)">↷ Redo</button>
		<span class="toolbar-separator">|</span>

		<!-- Text Formatting -->
		<button id="bold-btn" title="Bold (Ctrl+B)"><strong>B</strong></button>
		<button id="italic-btn" title="Italic (Ctrl+I)"><em>I</em></button>
		<button id="underline-btn" title="Underline (Ctrl+U)"><u>U</u></button>
		<button id="strikethrough-btn" title="Strikethrough"><s>S</s></button>
		<span class="toolbar-separator">|</span>

		<!-- Headings & Paragraphs -->
		<select id="text-style-select" title="Text Style">
			<option value="paragraph" selected>Normal Text</option>
			<option value="heading1">Heading 1</option>
			<option value="heading2">Heading 2</option>
			<option value="heading3">Heading 3</option>
			<option value="heading4">Heading 4</option>
		</select>
		<span class="toolbar-separator">|</span>

		<!-- Lists -->
		<button id="bullet-list-btn" title="Bullet List">• List</button>
		<button id="ordered-list-btn" title="Numbered List">1. List</button>
		<span class="toolbar-separator">|</span>

		<!-- Alignment -->
		<button id="align-left-btn" title="Align Left">⬅</button>
		<button id="align-center-btn" title="Align Center">⬌</button>
		<button id="align-right-btn" title="Align Right">➡</button>
		<span class="toolbar-separator">|</span>

		<!-- Page Settings -->
		<button id="page-break-btn" title="Page Break">📄 Break</button>
		<select id="page-size-select" title="Page Size">
			<option value="letter" selected>Letter</option>
			<option value="legal">Legal</option>
			<option value="tabloid">Tabloid</option>
			<option value="a4">A4</option>
			<option value="a3">A3</option>
		</select>
		<select id="margin-preset-select" title="Margins">
			<option value="normal" selected>Normal</option>
			<option value="narrow">Narrow</option>
			<option value="moderate">Moderate</option>
			<option value="wide">Wide</option>
		</select>

		<div id="status-text">Loading...</div>
	</div>
	<div id="docx-container"></div>

	<!-- Load dependencies in order -->
	<script nonce="${nonce}" src="${jszipCdnUri}"></script>
	<script nonce="${nonce}" src="${docxLibUri}"></script>
	<script nonce="${nonce}" src="${tiptapDocxBundleUri}"></script>
	<script nonce="${nonce}" src="${tiptapBundleUri}"></script>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

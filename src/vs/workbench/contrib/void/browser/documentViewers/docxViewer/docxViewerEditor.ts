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
				if (this._currentInput && data.text) {
					this.saveDOCX(this._currentInput.resource, data.text, data.html, data.margins);
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

	private async saveDOCX(uri: URI, text: string, html?: string, margins?: any): Promise<void> {
		try {
			// For now, save as plain text
			// TODO: Implement HTML to DOCX conversion to preserve formatting
			const bytes = VSBuffer.fromString(text);
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

		const docxLibUri = asWebviewUri(URI.joinPath(mediaUri, 'lib', 'docx-preview.min.js'));
		const scriptUri = asWebviewUri(URI.joinPath(mediaUri, 'docxViewer.js'));
		const styleUri = asWebviewUri(URI.joinPath(mediaUri, 'docxViewer.css'));

		// JSZip is required by docx-preview
		const jszipCdnUri = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';

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
		<button id="save-btn" title="Save (Ctrl+S)">💾 Save</button>
		<div id="status-text"></div>
	</div>
	<div id="docx-ribbon">
		<!-- Text Formatting Section -->
		<div class="ribbon-group">
			<label>Font</label>
			<select id="font-family">
				<option value="Arial">Arial</option>
				<option value="Times New Roman">Times New Roman</option>
				<option value="Calibri" selected>Calibri</option>
				<option value="Courier New">Courier New</option>
				<option value="Georgia">Georgia</option>
				<option value="Verdana">Verdana</option>
			</select>
			<select id="font-size">
				<option value="8">8</option>
				<option value="10">10</option>
				<option value="12">12</option>
				<option value="14" selected>14</option>
				<option value="16">16</option>
				<option value="18">18</option>
				<option value="20">20</option>
				<option value="24">24</option>
				<option value="28">28</option>
				<option value="32">32</option>
			</select>
		</div>

		<!-- Basic Formatting Buttons -->
		<div class="ribbon-group">
			<label>Style</label>
			<button id="bold-btn" class="format-btn" title="Bold (Ctrl+B)"><strong>B</strong></button>
			<button id="italic-btn" class="format-btn" title="Italic (Ctrl+I)"><em>I</em></button>
			<button id="underline-btn" class="format-btn" title="Underline (Ctrl+U)"><u>U</u></button>
			<button id="strikethrough-btn" class="format-btn" title="Strikethrough"><s>S</s></button>
			<input type="color" id="text-color" title="Text Color" value="#000000">
			<input type="color" id="highlight-color" title="Highlight" value="#ffff00">
		</div>

		<!-- Paragraph Formatting -->
		<div class="ribbon-group">
			<label>Paragraph</label>
			<button id="align-left-btn" class="format-btn" title="Align Left">⬅</button>
			<button id="align-center-btn" class="format-btn" title="Align Center">↔</button>
			<button id="align-right-btn" class="format-btn" title="Align Right">➡</button>
			<button id="justify-btn" class="format-btn" title="Justify">≡</button>
			<button id="bullets-btn" class="format-btn" title="Bullets">•</button>
			<button id="numbering-btn" class="format-btn" title="Numbering">1.</button>
			<button id="indent-btn" class="format-btn" title="Increase Indent">→|</button>
			<button id="outdent-btn" class="format-btn" title="Decrease Indent">|←</button>
		</div>

		<!-- Styles -->
		<div class="ribbon-group">
			<label>Styles</label>
			<select id="heading-style">
				<option value="">Normal</option>
				<option value="h1">Heading 1</option>
				<option value="h2">Heading 2</option>
				<option value="h3">Heading 3</option>
				<option value="h4">Heading 4</option>
				<option value="h5">Heading 5</option>
				<option value="h6">Heading 6</option>
			</select>
		</div>

		<!-- Insert -->
		<div class="ribbon-group">
			<label>Insert</label>
			<button id="insert-table-btn" class="format-btn" title="Insert Table">⊞</button>
			<button id="insert-image-btn" class="format-btn" title="Insert Image">🖼</button>
			<button id="page-break-btn" class="format-btn" title="Insert Page Break">📄</button>
		</div>

		<!-- Page Setup -->
		<div class="ribbon-group">
			<label>Page</label>
			<button id="margins-btn" class="format-btn" title="Adjust Margins">📏</button>
		</div>
	</div>
	<div id="docx-container"></div>
	<script nonce="${nonce}" src="${jszipCdnUri}"></script>
	<script nonce="${nonce}" src="${docxLibUri}"></script>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

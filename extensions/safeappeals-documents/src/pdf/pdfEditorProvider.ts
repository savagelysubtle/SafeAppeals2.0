/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { PdfAnnotation, PdfAnnotationStore, SavedSignature } from './annotationStore';

/**
 * Readonly custom editor: PDF bytes are never written back.
 * Annotations / signatures / last-page live in workspaceState (sidecar model).
 * Forms are in-memory only in the webview (same as the old viewer).
 */
export class PdfEditorProvider implements vscode.CustomReadonlyEditorProvider {
	public static readonly viewType = 'safeappeals.pdfViewer';

	public static register(
		context: vscode.ExtensionContext,
		annotationStore: PdfAnnotationStore,
	): vscode.Disposable {
		const provider = new PdfEditorProvider(context, annotationStore);
		return vscode.window.registerCustomEditorProvider(
			PdfEditorProvider.viewType,
			provider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			},
		);
	}

	private constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly annotationStore: PdfAnnotationStore,
	) { }

	async openCustomDocument(
		uri: vscode.Uri,
		_openContext: vscode.CustomDocumentOpenContext,
		_token: vscode.CancellationToken,
	): Promise<vscode.CustomDocument> {
		return { uri, dispose: () => { /* no-op */ } };
	}

	async resolveCustomEditor(
		document: vscode.CustomDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'pdf');

		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [mediaRoot, this.context.extensionUri],
		};

		webviewPanel.webview.html = this.getHtml(webviewPanel.webview, mediaRoot);

		const disposables: vscode.Disposable[] = [];
		let webviewReady = false;
		let pendingLoad = true;

		const sendAnnotations = () => {
			webviewPanel.webview.postMessage({
				type: 'loadAnnotations',
				annotations: this.annotationStore.getAnnotations(document.uri),
			});
		};

		const sendSignatures = () => {
			webviewPanel.webview.postMessage({
				type: 'savedSignatures',
				signatures: this.annotationStore.getSavedSignatures(),
			});
		};

		const loadPdf = async () => {
			try {
				const bytes = await vscode.workspace.fs.readFile(document.uri);
				const base64 = bufferToBase64(bytes);
				const startPage = this.annotationStore.getLastPage(document.uri);
				webviewPanel.webview.postMessage({
					type: 'loadPDF',
					data: base64,
					encoding: 'base64',
					preloadStrategy: 'all',
					startPage,
					pdfUri: document.uri.toString(),
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				void vscode.window.showErrorMessage(`Failed to load PDF: ${message}`);
			}
		};

		disposables.push(
			webviewPanel.webview.onDidReceiveMessage(async (raw: unknown) => {
				const data = unwrapMessage(raw);
				if (!data?.type) {
					return;
				}

				switch (data.type) {
					case 'ready': {
						webviewReady = true;
						if (pendingLoad) {
							pendingLoad = false;
							await loadPdf();
						}
						break;
					}
					case 'pdfLoaded':
						sendAnnotations();
						sendSignatures();
						break;
					case 'pageChanged': {
						const page = Number(data.page);
						if (Number.isFinite(page) && page >= 1) {
							await this.annotationStore.setLastPage(document.uri, page);
						}
						break;
					}
					case 'addAnnotation':
					case 'addSignatureAnnotation': {
						const annotation = data.annotation as Omit<PdfAnnotation, 'id' | 'createdAt'>;
						if (annotation) {
							await this.annotationStore.addAnnotation(annotation);
							sendAnnotations();
						}
						break;
					}
					case 'updateAnnotation': {
						const annotationId = String(data.annotationId ?? '');
						const updates = data.updates as Partial<PdfAnnotation> | undefined;
						if (annotationId && updates) {
							await this.annotationStore.updateAnnotation(annotationId, updates);
							sendAnnotations();
						}
						break;
					}
					case 'deleteAnnotation': {
						const annotationId = String(data.annotationId ?? '');
						if (annotationId) {
							await this.annotationStore.deleteAnnotation(annotationId);
							sendAnnotations();
						}
						break;
					}
					case 'getAnnotations':
						sendAnnotations();
						break;
					case 'savePdfSignature': {
						const signature = data.signature as SavedSignature | undefined;
						if (signature?.id && signature.dataURL) {
							await this.annotationStore.saveSignature(signature);
							sendSignatures();
						}
						break;
					}
					case 'loadPdfSignatures':
						sendSignatures();
						break;
					case 'deletePdfSignature': {
						const signatureId = String(data.signatureId ?? '');
						if (signatureId) {
							await this.annotationStore.deleteSignature(signatureId);
							sendSignatures();
						}
						break;
					}
					case 'exportAnnotations': {
						const annotations = this.annotationStore.getAnnotations(document.uri);
						webviewPanel.webview.postMessage({
							type: 'downloadAnnotations',
							json: JSON.stringify(annotations, null, 2),
						});
						break;
					}
					case 'printPdf':
						await vscode.env.openExternal(document.uri);
						break;
					case 'sendForDocuSign':
						// DocuSign retired in the bolt-on migration; ignore.
						break;
					case 'error': {
						const err = String(data.error ?? 'Unknown PDF viewer error');
						void vscode.window.showErrorMessage(err);
						break;
					}
					default:
						break;
				}
			}),
		);

		disposables.push(
			this.annotationStore.onDidChangeAnnotations(uri => {
				if (uri.toString() === document.uri.toString()) {
					sendAnnotations();
				}
			}),
		);

		disposables.push(
			webviewPanel.onDidDispose(() => {
				for (const d of disposables) {
					d.dispose();
				}
			}),
		);

		// If the webview was restored and already posted ready before we subscribed,
		// still attempt load shortly after resolve.
		setTimeout(() => {
			if (!webviewReady && pendingLoad) {
				// Wait for ready; webview main.ts posts ready after WASM init.
			} else if (webviewReady && pendingLoad) {
				pendingLoad = false;
				void loadPdf();
			}
		}, 0);
	}

	private getHtml(webview: vscode.Webview, mediaRoot: vscode.Uri): string {
		const nonce = randomUUID();
		const cspSource = webview.cspSource;

		const asMedia = (...parts: string[]) =>
			webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, ...parts)).toString();

		const cssUri = asMedia('pdfViewer.css');
		const scriptUri = asMedia('pdfRustViewer.js');
		const wasmUri = asMedia('wasm', 'pdf_viewer_bg.wasm');
		const pdfiumJsUri = asMedia('wasm', 'pdfium.js');
		const pdfiumWasmUri = asMedia('wasm', 'pdfium.wasm');

		return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none';
			script-src 'nonce-${nonce}' 'wasm-unsafe-eval' ${cspSource};
			style-src 'unsafe-inline' ${cspSource};
			img-src data: ${cspSource};
			connect-src ${cspSource};
			font-src data: ${cspSource};">
	<link rel="stylesheet" href="${cssUri}">
</head>
<body>
	<div id="config" data-wasm-url="${wasmUri}" data-pdfium-url="${pdfiumWasmUri}" style="display:none;"></div>
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
				<div class="controls-group">
					<button id="prev-page" title="Previous Page">&lsaquo;</button>
					<span id="page-info">Page <span id="current-page">1</span> of <span id="total-pages">1</span></span>
					<button id="next-page" title="Next Page">&rsaquo;</button>
				</div>
				<span class="controls-separator"></span>
				<div class="controls-group">
					<button id="zoom-out" title="Zoom Out">&minus;</button>
					<button id="zoom-in" title="Zoom In">&plus;</button>
				</div>
				<span class="controls-separator"></span>
				<div class="controls-group">
					<button id="fit-width" title="Fit Width">Fit W</button>
					<button id="fit-page" title="Fit Page">Fit P</button>
					<button id="actual-size" title="Actual Size (100%)">100%</button>
				</div>
				<span class="controls-separator"></span>
				<div class="controls-group">
					<button id="rotate-view" title="Rotate 90&deg;">&#8635;</button>
					<button id="dark-mode-reading" title="Invert Colors">&#9680;</button>
					<button id="scroll-mode-toggle" title="Toggle Continuous Scroll">&#8801;</button>
				</div>
				<span class="controls-separator"></span>
				<div class="controls-group">
					<button id="print-btn" title="Print (Ctrl+P)">Print</button>
					<button id="export-annotations" title="Export Annotations as JSON">Export</button>
				</div>
				<span class="controls-separator"></span>
				<div class="controls-group">
					<button id="add-signature" title="Add Signature">Signature</button>
				</div>
				<span class="controls-separator"></span>
				<div id="annotation-toolbar" class="controls-group">
					<button class="highlight-btn highlight-yellow" data-color="yellow" title="Yellow Highlight"></button>
					<button class="highlight-btn highlight-green" data-color="green" title="Green Highlight"></button>
					<button class="highlight-btn highlight-blue" data-color="blue" title="Blue Highlight"></button>
					<button class="highlight-btn highlight-pink" data-color="pink" title="Pink Highlight"></button>
					<button id="redact-tool" title="Redaction Tool">&#9646;</button>
					<button id="delete-highlight" title="Delete Selected Annotation">&times;</button>
				</div>
			</div>
			<div id="canvas-wrapper">
				<div id="pdf-render-container">
					<canvas id="pdf-canvas"></canvas>
					<div id="pdf-text-layer" class="pdf-text-layer"></div>
				</div>
			</div>
			<div id="continuous-scroll-container"></div>
		</div>
	</div>

	<div id="signature-modal" class="signature-modal">
		<div class="signature-modal-content">
			<div class="signature-modal-header">
				<h3>Draw Your Signature</h3>
				<button id="close-signature-modal" class="close-modal-btn">×</button>
			</div>
			<div class="signature-modal-body">
				<div class="signature-mode-toggle">
					<button id="draw-mode-btn" class="mode-btn active">Draw</button>
					<button id="type-mode-btn" class="mode-btn">Type</button>
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
		window.addEventListener('error', (e) => {
			console.error('[PDF Viewer HTML] Global error:', e.message, e.filename, e.lineno);
		}, true);
	</script>
	<script nonce="${nonce}" src="${pdfiumJsUri}"></script>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

function unwrapMessage(raw: unknown): Record<string, unknown> | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	const obj = raw as Record<string, unknown>;
	// Some hosts wrap as { message: {...} }
	if (obj.message && typeof obj.message === 'object') {
		return obj.message as Record<string, unknown>;
	}
	return obj;
}

function bufferToBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64');
}

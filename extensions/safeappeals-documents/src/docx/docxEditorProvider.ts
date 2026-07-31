/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { DocxDocument } from './docxDocument';

/**
 * Editable CustomEditorProvider for .docx (viewType safeappeals.docxViewer).
 *
 * Save pipeline (mirrors void DOCX viewer):
 * 1. Host reads file bytes → base64 → webview `loadDOCX`
 * 2. Webview: docx-preview → HTML → TipTap; edits use TipTap history (undo/redo)
 * 3. On change: webview debounces serialize (docx Packer) → `contentChanged`
 * 4. On save: host writes cached/serialized DOCX bytes (or requests `saveRequest`)
 *
 * Undo/redo: TipTap-owned inside the webview (StarterKit history), same as the
 * old editor — not VS Code CustomDocumentEditEvent. We fire content-change
 * events for dirty/auto-save only.
 */
export class DocxEditorProvider implements vscode.CustomEditorProvider<DocxDocument> {
	public static readonly viewType = 'safeappeals.docxViewer';

	private readonly _onDidChangeCustomDocument =
		new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<DocxDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	/** Per-document webview panels + pending save waiters. */
	private readonly _panels = new Map<string, vscode.WebviewPanel>();
	private readonly _saveWaiters = new Map<string, {
		resolve: (ok: boolean) => void;
		timer: ReturnType<typeof setTimeout>;
	}>();
	/** Bytes already refreshed by a user-initiated webview save; skip re-serialize. */
	private readonly _freshFromWebview = new Set<string>();

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new DocxEditorProvider(context);
		return vscode.window.registerCustomEditorProvider(
			DocxEditorProvider.viewType,
			provider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			},
		);
	}

	private constructor(private readonly context: vscode.ExtensionContext) { }

	async openCustomDocument(
		uri: vscode.Uri,
		openContext: vscode.CustomDocumentOpenContext,
		_token: vscode.CancellationToken,
	): Promise<DocxDocument> {
		const document = await DocxDocument.create(uri, openContext.backupId);

		const changeSub = document.onDidChangeContent(() => {
			this._onDidChangeCustomDocument.fire({ document });
		});
		document.onDidDispose(() => changeSub.dispose());

		return document;
	}

	async resolveCustomEditor(
		document: DocxDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		const key = document.uri.toString();
		this._panels.set(key, webviewPanel);

		const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'docx');

		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [mediaRoot, this.context.extensionUri],
		};

		webviewPanel.webview.html = this.getHtml(webviewPanel.webview, mediaRoot);

		const disposables: vscode.Disposable[] = [];
		let webviewReady = false;
		let pendingLoad = true;
		/** TipTap often fires onUpdate right after setContent — ignore briefly after load. */
		let ignoreDirtyUntil = 0;

		const loadDocx = async () => {
			try {
				ignoreDirtyUntil = Date.now() + 1500;
				const base64 = bufferToBase64(document.documentData);
				webviewPanel.webview.postMessage({
					type: 'loadDOCX',
					data: base64,
					jsonContent: document.jsonContent,
					encoding: 'base64',
					docxUri: document.uri.toString(),
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				void vscode.window.showErrorMessage(`Failed to load DOCX: ${message}`);
			}
		};

		const requestSerializeAndWait = (timeoutMs = 30_000): Promise<boolean> => {
			return new Promise(resolve => {
				const existing = this._saveWaiters.get(key);
				if (existing) {
					clearTimeout(existing.timer);
					existing.resolve(false);
				}
				const timer = setTimeout(() => {
					this._saveWaiters.delete(key);
					resolve(false);
				}, timeoutMs);
				this._saveWaiters.set(key, { resolve, timer });
				webviewPanel.webview.postMessage({ type: 'saveRequest' });
			});
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
							await loadDocx();
						}
						break;
					}
					case 'contentChanged': {
						const settling = Date.now() < ignoreDirtyUntil;
						const docxData = (data.docxData ?? data.data) as string | undefined;
						if (typeof docxData === 'string' && docxData.length > 0) {
							try {
								const bytes = base64ToBuffer(docxData);
								const json =
									typeof data.jsonContent === 'string' ? data.jsonContent : undefined;
								document.updateFromWebview(bytes, json, { silent: settling });
							} catch (e) {
								console.error('[DOCX] Failed to decode contentChanged bytes', e);
								if (!settling) {
									document.markDirty();
								}
							}
						} else if (!settling) {
							document.markDirty();
						}
						break;
					}
					case 'saveRequested': {
						// Response to host `saveRequest`, OR user Ctrl+S / ribbon Save in webview.
						const docxData = data.docxData as string | undefined;
						const waiter = this._saveWaiters.get(key);
						try {
							if (typeof docxData === 'string' && docxData.length > 0) {
								const bytes = base64ToBuffer(docxData);
								const json =
									typeof data.jsonContent === 'string' ? data.jsonContent : undefined;
								// Keep dirty until saveCustomDocument finishes (VS Code clears the dot).
								document.updateFromWebview(bytes, json);
							}
							if (waiter) {
								clearTimeout(waiter.timer);
								this._saveWaiters.delete(key);
								waiter.resolve(typeof docxData === 'string' && docxData.length > 0);
							} else if (typeof docxData === 'string' && docxData.length > 0) {
								// Route through workbench save so dirty state clears correctly.
								this._freshFromWebview.add(key);
								await vscode.commands.executeCommand('workbench.action.files.save');
							} else {
								webviewPanel.webview.postMessage({
									type: 'saveComplete',
									success: false,
									error: 'No DOCX data from webview',
								});
							}
						} catch (error) {
							const message = error instanceof Error ? error.message : String(error);
							webviewPanel.webview.postMessage({
								type: 'saveComplete',
								success: false,
								error: message,
							});
							if (waiter) {
								clearTimeout(waiter.timer);
								this._saveWaiters.delete(key);
								waiter.resolve(false);
							}
						}
						break;
					}
					case 'print': {
						// Old host printed HTML via a browser window; open a disposable doc.
						const html = String(data.html ?? '');
						if (html) {
							const panel = vscode.window.createWebviewPanel(
								'safeappeals.docxPrint',
								'Print DOCX',
								vscode.ViewColumn.Beside,
								{ enableScripts: true },
							);
							panel.webview.html = html;
						}
						break;
					}
					case 'openLink': {
						const url = String(data.url ?? '');
						if (url) {
							await vscode.env.openExternal(vscode.Uri.parse(url));
						}
						break;
					}
					case 'inlineEditRequest':
					case 'executeCommand':
					case 'textSelected':
					case 'clearSelection':
						// Out of scope for rung 5b (AI / chat bridge).
						break;
					case 'error': {
						const err = String(data.error ?? 'Unknown DOCX editor error');
						void vscode.window.showErrorMessage(err);
						break;
					}
					default:
						break;
				}
			}),
		);

		disposables.push(
			webviewPanel.onDidDispose(() => {
				this._panels.delete(key);
				const waiter = this._saveWaiters.get(key);
				if (waiter) {
					clearTimeout(waiter.timer);
					this._saveWaiters.delete(key);
					waiter.resolve(false);
				}
				for (const d of disposables) {
					d.dispose();
				}
			}),
		);

		// Expose serialize helper on panel for saveCustomDocument when dirty cache is stale.
		(webviewPanel as unknown as { __docxRequestSave?: () => Promise<boolean> }).__docxRequestSave =
			() => {
				if (!webviewReady) {
					return Promise.resolve(document.documentData.byteLength > 0);
				}
				return requestSerializeAndWait();
			};

		setTimeout(() => {
			if (webviewReady && pendingLoad) {
				pendingLoad = false;
				void loadDocx();
			}
		}, 0);
	}

	async saveCustomDocument(
		document: DocxDocument,
		cancellation: vscode.CancellationToken,
	): Promise<void> {
		const key = document.uri.toString();
		const panel = this._panels.get(key);
		const alreadyFresh = this._freshFromWebview.has(key);
		this._freshFromWebview.delete(key);

		if (!alreadyFresh) {
			const requestSave = panel
				? (panel as unknown as { __docxRequestSave?: () => Promise<boolean> }).__docxRequestSave
				: undefined;
			if (requestSave) {
				const ok = await requestSave();
				if (!ok && document.documentData.byteLength === 0) {
					throw new Error('DOCX save failed: webview did not return document bytes');
				}
			}
		}

		await document.saveAs(document.uri, cancellation);
		document.markClean();
		panel?.webview.postMessage({ type: 'saveComplete', success: true });
	}

	async saveCustomDocumentAs(
		document: DocxDocument,
		destination: vscode.Uri,
		cancellation: vscode.CancellationToken,
	): Promise<void> {
		const panel = this._panels.get(document.uri.toString());
		const requestSave = panel
			? (panel as unknown as { __docxRequestSave?: () => Promise<boolean> }).__docxRequestSave
			: undefined;
		if (requestSave) {
			await requestSave();
		}
		await document.saveAs(destination, cancellation);
	}

	async revertCustomDocument(
		document: DocxDocument,
		cancellation: vscode.CancellationToken,
	): Promise<void> {
		await document.revert(cancellation);
		const panel = this._panels.get(document.uri.toString());
		if (panel) {
			const base64 = bufferToBase64(document.documentData);
			panel.webview.postMessage({
				type: 'loadDOCX',
				data: base64,
				encoding: 'base64',
				docxUri: document.uri.toString(),
			});
		}
	}

	async backupCustomDocument(
		document: DocxDocument,
		context: vscode.CustomDocumentBackupContext,
		cancellation: vscode.CancellationToken,
	): Promise<vscode.CustomDocumentBackup> {
		const panel = this._panels.get(document.uri.toString());
		const requestSave = panel
			? (panel as unknown as { __docxRequestSave?: () => Promise<boolean> }).__docxRequestSave
			: undefined;
		if (requestSave) {
			await requestSave();
		}
		return document.backup(context.destination, cancellation);
	}

	private getHtml(webview: vscode.Webview, mediaRoot: vscode.Uri): string {
		const nonce = randomUUID();
		const cspSource = webview.cspSource;
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'docxEditor.js')).toString();
		const cssUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'docxViewer.css')).toString();

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none';
			script-src 'nonce-${nonce}' ${cspSource};
			style-src 'unsafe-inline' ${cspSource};
			img-src data: blob: ${cspSource};
			font-src data: ${cspSource};
			connect-src data: blob: ${cspSource};">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>DOCX Editor</title>
	<link rel="stylesheet" href="${cssUri}">
	<style>
		a, a[href], .tiptap-editor a, .ProseMirror a, .docx-link {
			color: #0066cc !important;
			text-decoration: underline !important;
			cursor: pointer !important;
		}
		a:hover, .ProseMirror a:hover { color: #0044aa !important; }
	</style>
</head>
<body>
	<div id="docx-ribbon-container">
		<div class="ribbon-tabs">
			<button class="ribbon-tab active" data-tab="home">Home</button>
			<button class="ribbon-tab" data-tab="insert">Insert</button>
			<button class="ribbon-tab" data-tab="layout">Layout</button>
		</div>

		<div class="ribbon-panel active" data-panel="home">
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="save-btn" title="Save (Ctrl+S)">
						<span class="ribbon-btn-icon">💾</span>
						<span class="ribbon-btn-label">Save</span>
					</button>
					<button class="ribbon-btn" id="print-btn" title="Print (Ctrl+P)">
						<span class="ribbon-btn-icon">🖨️</span>
						<span class="ribbon-btn-label">Print</span>
					</button>
				</div>
				<span class="ribbon-section-label">File</span>
			</div>
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn ribbon-btn-small" id="undo-btn" title="Undo (Ctrl+Z)">↶</button>
					<button class="ribbon-btn ribbon-btn-small" id="redo-btn" title="Redo (Ctrl+Y)">↷</button>
				</div>
				<span class="ribbon-section-label">Undo</span>
			</div>
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<select class="ribbon-select" id="font-family-select" title="Font Family">
						<option value="Calibri" selected>Calibri</option>
						<option value="Arial">Arial</option>
						<option value="Times New Roman">Times New Roman</option>
						<option value="Georgia">Georgia</option>
						<option value="Verdana">Verdana</option>
						<option value="Courier New">Courier New</option>
					</select>
					<select class="ribbon-select" id="font-size-select" title="Font Size" style="width: 60px;">
						<option value="8">8</option><option value="9">9</option><option value="10">10</option>
						<option value="11" selected>11</option><option value="12">12</option>
						<option value="14">14</option><option value="16">16</option><option value="18">18</option>
						<option value="20">20</option><option value="24">24</option><option value="28">28</option>
						<option value="36">36</option><option value="48">48</option><option value="72">72</option>
					</select>
				</div>
				<div class="ribbon-section-content">
					<button class="ribbon-btn ribbon-btn-small" id="bold-btn" title="Bold (Ctrl+B)"><strong>B</strong></button>
					<button class="ribbon-btn ribbon-btn-small" id="italic-btn" title="Italic (Ctrl+I)"><em>I</em></button>
					<button class="ribbon-btn ribbon-btn-small" id="underline-btn" title="Underline (Ctrl+U)"><u>U</u></button>
					<button class="ribbon-btn ribbon-btn-small" id="strikethrough-btn" title="Strikethrough"><s>S</s></button>
					<input type="color" class="ribbon-color-picker" id="font-color-picker" value="#000000" title="Font Color">
				</div>
				<span class="ribbon-section-label">Font</span>
			</div>
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn ribbon-btn-small" id="align-left-btn" title="Align Left">⬅</button>
					<button class="ribbon-btn ribbon-btn-small" id="align-center-btn" title="Align Center">⬌</button>
					<button class="ribbon-btn ribbon-btn-small" id="align-right-btn" title="Align Right">➡</button>
				</div>
				<div class="ribbon-section-content">
					<button class="ribbon-btn ribbon-btn-small" id="bullet-list-btn" title="Bullet List">•</button>
					<button class="ribbon-btn ribbon-btn-small" id="ordered-list-btn" title="Numbered List">1.</button>
				</div>
				<span class="ribbon-section-label">Paragraph</span>
			</div>
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<select class="ribbon-select" id="text-style-select" title="Text Style" style="width: 100px;">
						<option value="paragraph" selected>Normal</option>
						<option value="heading1">Heading 1</option>
						<option value="heading2">Heading 2</option>
						<option value="heading3">Heading 3</option>
						<option value="heading4">Heading 4</option>
					</select>
				</div>
				<span class="ribbon-section-label">Styles</span>
			</div>
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="insert-signature-line-btn" title="Insert a signature line">
						<span class="ribbon-btn-icon">✍️</span>
						<span class="ribbon-btn-label">Signature Line</span>
					</button>
				</div>
				<span class="ribbon-section-label">Signature</span>
			</div>
		</div>

		<div class="ribbon-panel" data-panel="insert">
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="insert-table-btn" title="Insert Table">
						<span class="ribbon-btn-icon">📊</span>
						<span class="ribbon-btn-label">Table</span>
					</button>
				</div>
				<span class="ribbon-section-label">Tables</span>
			</div>
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="insert-image-btn" title="Insert Image">
						<span class="ribbon-btn-icon">🖼️</span>
						<span class="ribbon-btn-label">Picture</span>
					</button>
				</div>
				<span class="ribbon-section-label">Illustrations</span>
			</div>
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="insert-link-btn" title="Insert Link">
						<span class="ribbon-btn-icon">🔗</span>
						<span class="ribbon-btn-label">Link</span>
					</button>
				</div>
				<span class="ribbon-section-label">Links</span>
			</div>
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="page-break-btn" title="Page Break">
						<span class="ribbon-btn-icon">📄</span>
						<span class="ribbon-btn-label">Page Break</span>
					</button>
					<button class="ribbon-btn" id="insert-hr-btn" title="Horizontal Line">
						<span class="ribbon-btn-icon">━</span>
						<span class="ribbon-btn-label">Line</span>
					</button>
				</div>
				<span class="ribbon-section-label">Pages</span>
			</div>
		</div>

		<div class="ribbon-panel" data-panel="layout">
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<select class="ribbon-select" id="page-size-select" title="Page Size">
						<option value="letter" selected>Letter</option>
						<option value="legal">Legal</option>
						<option value="tabloid">Tabloid</option>
						<option value="a4">A4</option>
						<option value="a3">A3</option>
					</select>
				</div>
				<span class="ribbon-section-label">Size</span>
			</div>
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<select class="ribbon-select" id="margin-preset-select" title="Margins">
						<option value="normal" selected>Normal</option>
						<option value="narrow">Narrow</option>
						<option value="moderate">Moderate</option>
						<option value="wide">Wide</option>
					</select>
				</div>
				<span class="ribbon-section-label">Margins</span>
			</div>
			<div class="ribbon-section">
				<div class="ribbon-section-content">
					<button class="ribbon-btn" id="orientation-portrait-btn" title="Portrait">
						<span class="ribbon-btn-icon">📃</span>
						<span class="ribbon-btn-label">Portrait</span>
					</button>
					<button class="ribbon-btn" id="orientation-landscape-btn" title="Landscape">
						<span class="ribbon-btn-icon">📃</span>
						<span class="ribbon-btn-label">Landscape</span>
					</button>
				</div>
				<span class="ribbon-section-label">Orientation</span>
			</div>
		</div>
	</div>

	<div id="docx-container">
		<div id="docx-ruler-sticky-wrapper">
			<div id="docx-ruler"></div>
		</div>
	</div>

	<div id="docx-statusbar">
		<div class="statusbar-left">
			<span class="statusbar-item" id="page-count-display">Page 1 of 1</span>
			<span class="statusbar-item" id="word-count-display">0 words</span>
			<span class="statusbar-item" id="status-text">Loading...</span>
		</div>
		<div class="statusbar-right">
			<span class="statusbar-item">
				<button class="ribbon-btn ribbon-btn-small" id="zoom-out-btn" title="Zoom Out">−</button>
				<input type="range" id="zoom-slider" min="50" max="200" value="100" title="Zoom">
				<button class="ribbon-btn ribbon-btn-small" id="zoom-in-btn" title="Zoom In">+</button>
				<span id="zoom-display">100%</span>
			</span>
		</div>
	</div>

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
	if (obj.message && typeof obj.message === 'object') {
		return obj.message as Record<string, unknown>;
	}
	return obj;
}

function bufferToBase64(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('base64');
}

function base64ToBuffer(base64: string): Uint8Array {
	return new Uint8Array(Buffer.from(base64, 'base64'));
}

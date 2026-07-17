/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { XlsxDocument } from './xlsxDocument';

/**
 * Editable CustomEditorProvider for .xlsx/.xls (viewType safeappeals.xlsxViewer).
 *
 * Save pipeline (adapted from void xlsxRustViewer + DOCX house pattern):
 * 1. Host reads file bytes → base64 → webview `loadXLSX`
 * 2. Webview: Rust WASM parse → Canvas model; edits use webview undo stack
 * 3. On change: webview posts `dirty` (no bytes); host marks dirty
 * 4. On save: host posts `saveRequest` / `saveXLSX`, awaits `saveData` bytes, writes
 *
 * Divergences from old XLSXRustWorkingCopy / EditorPane:
 * - No host-side debounced auto-write on dirty (old wrote to disk after 500ms)
 * - Real hot-exit backups (old backup() returned {})
 * - Ctrl+S / ribbon Save routes through workbench.action.files.save
 *
 * Undo/redo: webview-owned (CanvasRenderer undoStack), same framework as DOCX
 * (TipTap history) — not VS Code CustomDocumentEditEvent.
 */
export class XlsxEditorProvider implements vscode.CustomEditorProvider<XlsxDocument> {
	public static readonly viewType = 'safeappeals.xlsxViewer';

	private readonly _onDidChangeCustomDocument =
		new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<XlsxDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	private readonly _panels = new Map<string, vscode.WebviewPanel>();
	private readonly _saveWaiters = new Map<string, {
		resolve: (ok: boolean) => void;
		timer: ReturnType<typeof setTimeout>;
	}>();
	/** Bytes already refreshed by a user-initiated webview save; skip re-serialize. */
	private readonly _freshFromWebview = new Set<string>();

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new XlsxEditorProvider(context);
		return vscode.window.registerCustomEditorProvider(
			XlsxEditorProvider.viewType,
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
	): Promise<XlsxDocument> {
		const document = await XlsxDocument.create(uri, openContext.backupId);

		const changeSub = document.onDidChangeContent(() => {
			this._onDidChangeCustomDocument.fire({ document });
		});
		document.onDidDispose(() => changeSub.dispose());

		return document;
	}

	async resolveCustomEditor(
		document: XlsxDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		const key = document.uri.toString();
		this._panels.set(key, webviewPanel);

		const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'xlsx');

		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [mediaRoot, this.context.extensionUri],
		};

		webviewPanel.webview.html = this.getHtml(webviewPanel.webview, mediaRoot);

		const disposables: vscode.Disposable[] = [];
		let webviewReady = false;
		let pendingLoad = true;

		const loadXlsx = async () => {
			try {
				const base64 = bufferToBase64(document.documentData);
				webviewPanel.webview.postMessage({
					type: 'loadXLSX',
					data: base64,
					xlsxUri: document.uri.toString(),
				});
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				void vscode.window.showErrorMessage(`Failed to load XLSX: ${message}`);
			}
		};

		const sendWasmBinary = async () => {
			try {
				const wasmUri = vscode.Uri.joinPath(mediaRoot, 'wasm', 'xlsx_rust_viewer_bg.wasm');
				const wasmBytes = await vscode.workspace.fs.readFile(wasmUri);
				webviewPanel.webview.postMessage({
					type: 'wasmBinary',
					data: bufferToBase64(wasmBytes),
				});
			} catch (error) {
				console.error('[XLSX] Failed to send WASM binary:', error);
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
				webviewPanel.webview.postMessage({
					type: 'saveRequest',
					targetUri: document.uri.toString(),
				});
			});
		};

		void sendWasmBinary();

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
							await loadXlsx();
						}
						break;
					}
					case 'dirty': {
						document.markDirty();
						break;
					}
					case 'saveData': {
						// Response to host saveRequest, OR user Ctrl+S / ribbon Save.
						const xlsxData = data.data as string | undefined;
						const waiter = this._saveWaiters.get(key);
						try {
							if (typeof xlsxData === 'string' && xlsxData.length > 0) {
								const bytes = base64ToBuffer(xlsxData);
								document.updateFromWebview(bytes);
							}
							if (waiter) {
								clearTimeout(waiter.timer);
								this._saveWaiters.delete(key);
								waiter.resolve(typeof xlsxData === 'string' && xlsxData.length > 0);
							} else if (typeof xlsxData === 'string' && xlsxData.length > 0) {
								this._freshFromWebview.add(key);
								await vscode.commands.executeCommand('workbench.action.files.save');
							} else {
								webviewPanel.webview.postMessage({
									type: 'saveComplete',
									success: false,
									error: 'No XLSX data from webview',
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
						const imageData = String(data.imageData ?? '');
						const printHtml = typeof data.printHtml === 'string' ? data.printHtml : undefined;
						if (imageData || printHtml) {
							await this.handlePrint(document, imageData, printHtml);
						}
						break;
					}
					case 'exportImage': {
						const imageData = String(data.imageData ?? '');
						if (imageData) {
							await this.handleExportImage(document, imageData);
						}
						break;
					}
					case 'exportFile': {
						await this.handleExportFile(
							document,
							String(data.content ?? ''),
							String(data.format ?? 'txt'),
							String(data.defaultName ?? 'export.txt'),
						);
						break;
					}
					case 'importFile': {
						const formats = Array.isArray(data.formats)
							? (data.formats as string[])
							: ['csv', 'tsv', 'txt'];
						await this.handleImportFile(webviewPanel, formats);
						break;
					}
					case 'openExternal': {
						const url = String(data.url ?? '');
						if (url) {
							await vscode.env.openExternal(vscode.Uri.parse(url));
						}
						break;
					}
					case 'testChartResult':
					case 'applyEdits':
						// Chart self-test / AI applyEdits — out of scope (rung 12 / later).
						break;
					case 'error': {
						const err = String(data.message ?? data.error ?? 'Unknown XLSX editor error');
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

		(webviewPanel as unknown as { __xlsxRequestSave?: () => Promise<boolean> }).__xlsxRequestSave =
			() => {
				if (!webviewReady) {
					return Promise.resolve(document.documentData.byteLength > 0);
				}
				return requestSerializeAndWait();
			};

		setTimeout(() => {
			if (webviewReady && pendingLoad) {
				pendingLoad = false;
				void loadXlsx();
			}
		}, 0);
	}

	async saveCustomDocument(
		document: XlsxDocument,
		cancellation: vscode.CancellationToken,
	): Promise<void> {
		const key = document.uri.toString();
		const panel = this._panels.get(key);
		const alreadyFresh = this._freshFromWebview.has(key);
		this._freshFromWebview.delete(key);

		if (!alreadyFresh) {
			const requestSave = panel
				? (panel as unknown as { __xlsxRequestSave?: () => Promise<boolean> }).__xlsxRequestSave
				: undefined;
			if (requestSave) {
				const ok = await requestSave();
				if (!ok && document.documentData.byteLength === 0) {
					throw new Error('XLSX save failed: webview did not return document bytes');
				}
			}
		}

		await document.saveAs(document.uri, cancellation);
		document.markClean();
		panel?.webview.postMessage({ type: 'saveComplete', success: true });
	}

	async saveCustomDocumentAs(
		document: XlsxDocument,
		destination: vscode.Uri,
		cancellation: vscode.CancellationToken,
	): Promise<void> {
		const panel = this._panels.get(document.uri.toString());
		const requestSave = panel
			? (panel as unknown as { __xlsxRequestSave?: () => Promise<boolean> }).__xlsxRequestSave
			: undefined;
		if (requestSave) {
			await requestSave();
		}
		await document.saveAs(destination, cancellation);
	}

	async revertCustomDocument(
		document: XlsxDocument,
		cancellation: vscode.CancellationToken,
	): Promise<void> {
		await document.revert(cancellation);
		const panel = this._panels.get(document.uri.toString());
		if (panel) {
			const base64 = bufferToBase64(document.documentData);
			panel.webview.postMessage({
				type: 'loadXLSX',
				data: base64,
				xlsxUri: document.uri.toString(),
			});
		}
	}

	async backupCustomDocument(
		document: XlsxDocument,
		context: vscode.CustomDocumentBackupContext,
		cancellation: vscode.CancellationToken,
	): Promise<vscode.CustomDocumentBackup> {
		const panel = this._panels.get(document.uri.toString());
		const requestSave = panel
			? (panel as unknown as { __xlsxRequestSave?: () => Promise<boolean> }).__xlsxRequestSave
			: undefined;
		if (requestSave) {
			await requestSave();
		}
		return document.backup(context.destination, cancellation);
	}

	private async handlePrint(
		document: XlsxDocument,
		imageDataUrl: string,
		printHtmlOverride?: string,
	): Promise<void> {
		try {
			const fileName = document.uri.path.replace(/^.*[\\/]/, '') || 'Spreadsheet';
			const printHtml = printHtmlOverride ?? [
				'<!DOCTYPE html><html><head><meta charset="utf-8">',
				`<title>Print - ${fileName}</title>`,
				'<style>',
				'@media print { @page { margin: 0.5in; } body { margin: 0; } }',
				'body { display: flex; justify-content: center; padding: 20px; }',
				'img { max-width: 100%; height: auto; }',
				'</style></head><body>',
				`<img src="${imageDataUrl}" onload="window.print()">`,
				'</body></html>',
			].join('');

			const panel = vscode.window.createWebviewPanel(
				'safeappeals.xlsxPrint',
				'Print Spreadsheet',
				vscode.ViewColumn.Beside,
				{ enableScripts: true },
			);
			panel.webview.html = printHtml;
		} catch (error) {
			console.error('[XLSX] Print failed:', error);
		}
	}

	private async handleExportImage(document: XlsxDocument, imageDataUrl: string): Promise<void> {
		try {
			const baseName = document.uri.path.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '') || 'spreadsheet';
			const defaultUri = vscode.Uri.joinPath(document.uri, '..', `${baseName}.png`);
			const result = await vscode.window.showSaveDialog({
				title: 'Export as Image',
				defaultUri,
				filters: { 'PNG Image': ['png'] },
			});
			if (!result) {
				return;
			}
			const base64 = imageDataUrl.replace(/^data:image\/png;base64,/, '');
			await vscode.workspace.fs.writeFile(result, base64ToBuffer(base64));
		} catch (error) {
			console.error('[XLSX] Export image failed:', error);
		}
	}

	private async handleExportFile(
		document: XlsxDocument,
		content: string,
		format: string,
		defaultName: string,
	): Promise<void> {
		if (!content) {
			return;
		}
		const filterMap: Record<string, { name: string; exts: string[] }> = {
			csv: { name: 'CSV (Comma Separated)', exts: ['csv'] },
			html: { name: 'HTML Document', exts: ['html', 'htm'] },
		};
		const filter = filterMap[format] ?? { name: 'Text File', exts: ['txt'] };
		const defaultUri = vscode.Uri.joinPath(document.uri, '..', defaultName);
		try {
			const result = await vscode.window.showSaveDialog({
				title: `Export as ${filter.name}`,
				defaultUri,
				filters: { [filter.name]: filter.exts },
			});
			if (result) {
				await vscode.workspace.fs.writeFile(result, Buffer.from(content, 'utf8'));
			}
		} catch (error) {
			console.error('[XLSX] Export file failed:', error);
		}
	}

	private async handleImportFile(
		webviewPanel: vscode.WebviewPanel,
		formats: string[],
	): Promise<void> {
		try {
			const result = await vscode.window.showOpenDialog({
				title: 'Import File',
				canSelectMany: false,
				filters: { 'Delimited Text': formats },
			});
			if (!result?.length) {
				return;
			}
			const fileUri = result[0];
			const fileBytes = await vscode.workspace.fs.readFile(fileUri);
			const text = Buffer.from(fileBytes).toString('utf8');
			const fileName = fileUri.path.replace(/^.*[\\/]/, '');
			webviewPanel.webview.postMessage({
				type: 'fileContent',
				content: text,
				fileName,
			});
		} catch (error) {
			console.error('[XLSX] Import file failed:', error);
		}
	}

	private getHtml(webview: vscode.Webview, mediaRoot: vscode.Uri): string {
		const nonce = randomUUID();
		const cspSource = webview.cspSource;
		const asMedia = (...parts: string[]) =>
			webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, ...parts)).toString();

		const scriptUri = asMedia('xlsxViewer.js');
		const cssUri = asMedia('xlsxViewer.css');
		const wasmUri = asMedia('wasm', 'xlsx_rust_viewer_bg.wasm');

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none';
			script-src 'nonce-${nonce}' 'wasm-unsafe-eval' ${cspSource};
			style-src 'unsafe-inline' ${cspSource};
			img-src data: blob: ${cspSource};
			font-src data: ${cspSource};
			connect-src data: blob: ${cspSource};">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>XLSX Editor</title>
	<link rel="stylesheet" href="${cssUri}">
</head>
<body>
	<div id="config" data-wasm-url="${wasmUri}" style="display:none;"></div>
	<div id="ribbon-container"></div>
	<div id="formula-bar">
		<div id="name-box-wrapper" style="position:relative;">
			<input id="cell-ref" type="text" value="A1" autocomplete="off" spellcheck="false" />
			<div id="name-box-dropdown" style="display:none;position:absolute;top:100%;left:0;z-index:200;background:#1e1e1e;border:1px solid #555;min-width:180px;max-height:220px;overflow-y:auto;border-radius:2px;"></div>
		</div>
		<span class="fx-label">fx</span>
		<input id="formula-input" type="text" />
	</div>
	<div id="canvas-container"></div>
	<div id="sheet-tabs"></div>
	<div id="status-bar"></div>
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

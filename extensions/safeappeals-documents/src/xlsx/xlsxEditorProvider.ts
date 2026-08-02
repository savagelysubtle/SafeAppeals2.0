/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import {
	EXTERNAL_RELOAD_SETTLE_MS,
	isWithinLoadSettleWindow,
	nextIgnoreDirtyUntil,
	shouldApplyWebviewDocumentBytes,
	shouldSkipWebviewSerialize,
} from '../documentExternalSync';
import { cancelDocumentInlineEdit } from '../inlineEditSession';
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
export interface XlsxSelectionInfo {
	uri: string;
	sheet?: string;
	range?: string;
	valuesTsv?: string;
}

export class XlsxEditorProvider implements vscode.CustomEditorProvider<XlsxDocument> {
	public static readonly viewType = 'safeappeals.xlsxViewer';

	private static _instance: XlsxEditorProvider | undefined;

	/** Active provider used by agent tools / commands. */
	public static get instance(): XlsxEditorProvider | undefined {
		return XlsxEditorProvider._instance;
	}

	private readonly _onDidChangeCustomDocument =
		new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<XlsxDocument>>();
	public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

	private readonly _panels = new Map<string, vscode.WebviewPanel>();
	/** Open CustomDocuments (for dirty checks + host-byte sync after headless writes). */
	private readonly _documents = new Map<string, XlsxDocument>();
	/** URIs whose webview has signaled WASM ready. */
	private readonly _readyUris = new Set<string>();
	private readonly _readyWaiters = new Map<string, Array<{
		resolve: (ok: boolean) => void;
		timer: ReturnType<typeof setTimeout>;
	}>>();
	private readonly _saveWaiters = new Map<string, {
		resolve: (ok: boolean) => void;
		timer: ReturnType<typeof setTimeout>;
	}>();
	private readonly _applyWaiters = new Map<string, {
		resolve: (result: { ok: boolean; error?: string; results?: unknown }) => void;
		timer: ReturnType<typeof setTimeout>;
	}>();
	private readonly _textWaiters = new Map<string, {
		resolve: (text: string | undefined) => void;
		timer: ReturnType<typeof setTimeout>;
	}>();
	/** Bytes already refreshed by a user-initiated webview save; skip re-serialize. */
	private readonly _freshFromWebview = new Set<string>();
	/**
	 * Host bytes synced from headless/external write; next save must write these
	 * and must not re-serialize the pre-reload WASM model.
	 */
	private readonly _freshFromExternalSync = new Set<string>();
	/** Per-URI deadline for ignoring dirty signals after loadXLSX. */
	private readonly _ignoreDirtyUntil = new Map<string, number>();
	private readonly _externalSyncSettleTimers = new Map<string, ReturnType<typeof setTimeout>>();
	/** Last selection reported by an XLSX webview (Phase E bridge). */
	private _lastSelection: XlsxSelectionInfo | undefined;

	public static register(context: vscode.ExtensionContext): vscode.Disposable {
		const provider = new XlsxEditorProvider(context);
		XlsxEditorProvider._instance = provider;
		const registration = vscode.window.registerCustomEditorProvider(
			XlsxEditorProvider.viewType,
			provider,
			{
				webviewOptions: {
					retainContextWhenHidden: true,
				},
				supportsMultipleEditorsPerDocument: false,
			},
		);
		return vscode.Disposable.from(
			registration,
			{ dispose: () => {
				if (XlsxEditorProvider._instance === provider) {
					XlsxEditorProvider._instance = undefined;
				}
			} },
		);
	}

	private constructor(private readonly context: vscode.ExtensionContext) { }

	public get lastSelection(): XlsxSelectionInfo | undefined {
		return this._lastSelection;
	}

	public isOpen(uri: vscode.Uri): boolean {
		return this._panels.has(uri.toString());
	}

	/** True when the webview has signaled WASM ready for this URI. */
	public isReady(uri: vscode.Uri): boolean {
		return this._readyUris.has(uri.toString());
	}

	public isDirty(uri: vscode.Uri): boolean {
		return this._documents.get(uri.toString())?.isDirty ?? false;
	}

	/**
	 * Wait until the webview signals ready, or `timeoutMs` elapses.
	 * Returns true when ready; false when closed or timed out still not ready.
	 */
	public awaitReady(uri: vscode.Uri, timeoutMs = 8_000): Promise<boolean> {
		const key = uri.toString();
		if (this._readyUris.has(key)) {
			return Promise.resolve(true);
		}
		if (!this._panels.has(key)) {
			return Promise.resolve(false);
		}
		return new Promise(resolve => {
			const timer = setTimeout(() => {
				const list = this._readyWaiters.get(key);
				if (list) {
					const idx = list.findIndex(w => w.timer === timer);
					if (idx >= 0) {
						list.splice(idx, 1);
					}
					if (list.length === 0) {
						this._readyWaiters.delete(key);
					}
				}
				resolve(this._readyUris.has(key));
			}, timeoutMs);
			const list = this._readyWaiters.get(key) ?? [];
			list.push({ resolve, timer });
			this._readyWaiters.set(key, list);
		});
	}

	public findPanel(uri: vscode.Uri): vscode.WebviewPanel | undefined {
		return this._panels.get(uri.toString());
	}

	/**
	 * Sync host CustomDocument bytes and reload the webview after a headless write.
	 * Marks host bytes authoritative for the next save (skip stale WASM serialize)
	 * and suppresses dirty until the mid-session load settles.
	 */
	public reloadFromBytes(uri: vscode.Uri, bytes: Uint8Array): boolean {
		const key = uri.toString();
		const document = this._documents.get(key);
		if (document) {
			document.syncFromExternalBytes(bytes);
		}
		this.beginExternalReload(key);
		const panel = this._panels.get(key);
		if (!panel) {
			return !!document;
		}
		panel.webview.postMessage({
			type: 'loadXLSX',
			data: bufferToBase64(bytes),
			xlsxUri: key,
		});
		return true;
	}

	/** @internal Exported for unit tests of the save-skip contract. */
	public isFreshFromExternalSync(uri: vscode.Uri): boolean {
		return this._freshFromExternalSync.has(uri.toString());
	}

	private beginExternalReload(key: string): void {
		this._freshFromExternalSync.add(key);
		this._ignoreDirtyUntil.set(key, nextIgnoreDirtyUntil(Date.now()));
		const existing = this._externalSyncSettleTimers.get(key);
		if (existing) {
			clearTimeout(existing);
		}
		// Settle timer clears dirty-ignore only. Authority flag stays until
		// successful saveAs / saveCustomDocumentAs, or dispose.
		this._externalSyncSettleTimers.set(key, setTimeout(() => {
			this._externalSyncSettleTimers.delete(key);
			this._ignoreDirtyUntil.delete(key);
		}, EXTERNAL_RELOAD_SETTLE_MS + 100));
	}

	/** Clear host-byte authority after successful save, or on dispose. */
	private clearExternalSyncAuthority(key: string): void {
		this._freshFromExternalSync.delete(key);
		const settleTimer = this._externalSyncSettleTimers.get(key);
		if (settleTimer) {
			clearTimeout(settleTimer);
			this._externalSyncSettleTimers.delete(key);
		}
		this._ignoreDirtyUntil.delete(key);
	}

	private isSettlingLoad(key: string): boolean {
		const until = this._ignoreDirtyUntil.get(key) ?? 0;
		return isWithinLoadSettleWindow(until, Date.now());
	}

	private markReady(key: string): void {
		this._readyUris.add(key);
		const waiters = this._readyWaiters.get(key);
		if (!waiters) {
			return;
		}
		this._readyWaiters.delete(key);
		for (const w of waiters) {
			clearTimeout(w.timer);
			w.resolve(true);
		}
	}

	private clearReady(key: string): void {
		this._readyUris.delete(key);
		const waiters = this._readyWaiters.get(key);
		if (!waiters) {
			return;
		}
		this._readyWaiters.delete(key);
		for (const w of waiters) {
			clearTimeout(w.timer);
			w.resolve(false);
		}
	}

	/**
	 * Ask the active XLSX webview to open its in-document inline-edit popup (Ctrl+K).
	 * Returns true when a panel was messaged.
	 */
	public showInlineEditPopup(): boolean {
		const uri = this.resolveActiveEditorUri();
		if (!uri) {
			return false;
		}
		const panel = this._panels.get(uri.toString());
		if (!panel) {
			return false;
		}
		panel.webview.postMessage({ type: 'showInlineEdit' });
		return true;
	}

	private resolveActiveEditorUri(): vscode.Uri | undefined {
		const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
		const input = tab?.input;
		if (input instanceof vscode.TabInputCustom && input.viewType === XlsxEditorProvider.viewType) {
			return input.uri;
		}
		return undefined;
	}

	/**
	 * Post applyEdits to the open XLSX webview, wait for ack, then serialize/save.
	 */
	public async applyEditsAndWait(
		uri: vscode.Uri,
		operations: readonly unknown[],
		options?: { save?: boolean; timeoutMs?: number },
	): Promise<{ ok: boolean; error?: string; results?: unknown }> {
		const key = uri.toString();
		const panel = this._panels.get(key);
		if (!panel) {
			return { ok: false, error: 'XLSX editor is not open for this URI' };
		}
		if (!this.isReady(uri)) {
			return { ok: false, error: 'XLSX editor is not ready yet' };
		}
		const requestId = randomUUID();
		const timeoutMs = options?.timeoutMs ?? 30_000;
		const applyResult = await new Promise<{ ok: boolean; error?: string; results?: unknown }>(resolve => {
			const existing = this._applyWaiters.get(key);
			if (existing) {
				clearTimeout(existing.timer);
				existing.resolve({ ok: false, error: 'Superseded by a newer applyEdits request' });
			}
			const timer = setTimeout(() => {
				this._applyWaiters.delete(key);
				resolve({ ok: false, error: 'Timed out waiting for applyEditsResult' });
			}, timeoutMs);
			this._applyWaiters.set(key, { resolve, timer });
			panel.webview.postMessage({
				type: 'applyEdits',
				requestId,
				operations,
				ops: operations,
			});
		});
		if (!applyResult.ok) {
			return applyResult;
		}
		if (options?.save !== false) {
			const saved = await this.saveAndWait(uri);
			if (!saved) {
				return { ok: false, error: 'Edits applied but serialize/save failed' };
			}
		}
		return applyResult;
	}

	public async requestTextAndWait(uri: vscode.Uri, timeoutMs = 15_000): Promise<string | undefined> {
		const key = uri.toString();
		const panel = this._panels.get(key);
		if (!panel) {
			return undefined;
		}
		const requestId = randomUUID();
		return new Promise(resolve => {
			const existing = this._textWaiters.get(key);
			if (existing) {
				clearTimeout(existing.timer);
				existing.resolve(undefined);
			}
			const timer = setTimeout(() => {
				this._textWaiters.delete(key);
				resolve(undefined);
			}, timeoutMs);
			this._textWaiters.set(key, { resolve, timer });
			panel.webview.postMessage({ type: 'getText', requestId });
		});
	}

	public async saveAndWait(uri: vscode.Uri): Promise<boolean> {
		const panel = this._panels.get(uri.toString());
		if (!panel) {
			return false;
		}
		const requestSave = (panel as unknown as { __xlsxRequestSave?: () => Promise<boolean> }).__xlsxRequestSave;
		if (!requestSave) {
			return false;
		}
		return requestSave();
	}

	async openCustomDocument(
		uri: vscode.Uri,
		openContext: vscode.CustomDocumentOpenContext,
		_token: vscode.CancellationToken,
	): Promise<XlsxDocument> {
		const document = await XlsxDocument.create(uri, openContext.backupId);
		const key = document.uri.toString();
		this._documents.set(key, document);

		const changeSub = document.onDidChangeContent(() => {
			this._onDidChangeCustomDocument.fire({ document });
		});
		document.onDidDispose(() => {
			this._documents.delete(key);
			changeSub.dispose();
		});

		return document;
	}

	async resolveCustomEditor(
		document: XlsxDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		const key = document.uri.toString();
		this._documents.set(key, document);
		this._panels.set(key, webviewPanel);
		this.clearReady(key);

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
				this._ignoreDirtyUntil.set(key, nextIgnoreDirtyUntil(Date.now()));
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
						this.markReady(key);
						if (pendingLoad) {
							pendingLoad = false;
							await loadXlsx();
						}
						break;
					}
					case 'dirty': {
						if (
							shouldApplyWebviewDocumentBytes({
								freshFromExternalSync: this._freshFromExternalSync.has(key),
							})
							&& !this.isSettlingLoad(key)
						) {
							document.markDirty();
						}
						break;
					}
					case 'saveData': {
						// Response to host saveRequest, OR user Ctrl+S / ribbon Save.
						const waiter = this._saveWaiters.get(key);
						if (!shouldApplyWebviewDocumentBytes({
							freshFromExternalSync: this._freshFromExternalSync.has(key),
						})) {
							// Keep host bytes; skip-serialize save writes them.
							if (waiter) {
								clearTimeout(waiter.timer);
								this._saveWaiters.delete(key);
								waiter.resolve(true);
							} else {
								try {
									await vscode.commands.executeCommand('workbench.action.files.save');
								} catch (error) {
									const message = error instanceof Error ? error.message : String(error);
									webviewPanel.webview.postMessage({
										type: 'saveComplete',
										success: false,
										error: message,
									});
								}
							}
							break;
						}
						const xlsxData = data.data as string | undefined;
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
						// Chart self-test — ignored for now.
						break;
					case 'applyEditsResult': {
						const waiter = this._applyWaiters.get(key);
						if (waiter) {
							clearTimeout(waiter.timer);
							this._applyWaiters.delete(key);
							waiter.resolve({
								ok: data.ok !== false && data.success !== false,
								error: typeof data.error === 'string' ? data.error : undefined,
								results: data.results,
							});
						}
						break;
					}
					case 'getTextResult': {
						const waiter = this._textWaiters.get(key);
						if (waiter) {
							clearTimeout(waiter.timer);
							this._textWaiters.delete(key);
							waiter.resolve(typeof data.text === 'string' ? data.text : undefined);
						}
						break;
					}
					case 'selectionChanged':
					case 'textSelected': {
						this._lastSelection = {
							uri: key,
							sheet: typeof data.sheet === 'string' ? data.sheet : undefined,
							range: typeof data.range === 'string' ? data.range : undefined,
							valuesTsv: typeof data.valuesTsv === 'string'
								? data.valuesTsv
								: (typeof data.text === 'string' ? data.text : undefined),
						};
						break;
					}
					case 'inlineEditRequest': {
						const selection = data.selection as {
							text?: string;
							sheet?: string;
							range?: string;
						} | undefined;
						const instructions = typeof data.instructions === 'string' ? data.instructions : undefined;
						const text = String(selection?.text ?? '');
						this._lastSelection = {
							uri: key,
							sheet: typeof selection?.sheet === 'string' ? selection.sheet : undefined,
							range: typeof selection?.range === 'string' ? selection.range : undefined,
							valuesTsv: text || undefined,
						};
						await vscode.commands.executeCommand('safeappeals.documents.inlineEdit', {
							uri: key,
							text,
							instructions,
							kind: 'xlsx',
							sheet: this._lastSelection.sheet,
							range: this._lastSelection.range,
						});
						break;
					}
					case 'inlineEditCancel': {
						cancelDocumentInlineEdit(key);
						break;
					}
					case 'addToChat': {
						const text = String(data.text ?? this._lastSelection?.valuesTsv ?? '');
						const sheet = typeof data.sheet === 'string' ? data.sheet : this._lastSelection?.sheet;
						const range = typeof data.range === 'string' ? data.range : this._lastSelection?.range;
						if (text.trim()) {
							this._lastSelection = {
								uri: key,
								sheet,
								range,
								valuesTsv: text.trim(),
							};
						}
						await vscode.commands.executeCommand('safeappeals.documents.addToChat', {
							uri: key,
							text: text.trim(),
							kind: 'xlsx',
							sheet,
							range,
						});
						break;
					}
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
				this.clearReady(key);
				this.clearExternalSyncAuthority(key);
				const waiter = this._saveWaiters.get(key);
				if (waiter) {
					clearTimeout(waiter.timer);
					this._saveWaiters.delete(key);
					waiter.resolve(false);
				}
				const applyWaiter = this._applyWaiters.get(key);
				if (applyWaiter) {
					clearTimeout(applyWaiter.timer);
					this._applyWaiters.delete(key);
					applyWaiter.resolve({ ok: false, error: 'XLSX webview disposed' });
				}
				cancelDocumentInlineEdit(key);
				const textWaiter = this._textWaiters.get(key);
				if (textWaiter) {
					clearTimeout(textWaiter.timer);
					this._textWaiters.delete(key);
					textWaiter.resolve(undefined);
				}
				for (const d of disposables) {
					d.dispose();
				}
			}),
		);

		// Never report success from stale host cache when the webview is not ready.
		(webviewPanel as unknown as { __xlsxRequestSave?: () => Promise<boolean> }).__xlsxRequestSave =
			() => {
				if (!webviewReady || !this.isReady(document.uri)) {
					return Promise.resolve(false);
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
		const hadExternalSync = this._freshFromExternalSync.has(key);
		const skipSerialize = shouldSkipWebviewSerialize({
			freshFromWebview: this._freshFromWebview.has(key),
			freshFromExternalSync: hadExternalSync,
		});
		this._freshFromWebview.delete(key);
		// Keep _freshFromExternalSync until saveAs succeeds so webview cannot poison host mid-save.

		if (!skipSerialize) {
			const requestSave = panel
				? (panel as unknown as { __xlsxRequestSave?: () => Promise<boolean> }).__xlsxRequestSave
				: undefined;
			if (requestSave) {
				const ok = await requestSave();
				if (!ok) {
					throw new Error(
						'XLSX save failed: webview is not ready or did not return document bytes',
					);
				}
			}
		}

		await document.saveAs(document.uri, cancellation);
		if (hadExternalSync) {
			this.clearExternalSyncAuthority(key);
		}
		document.markClean();
		panel?.webview.postMessage({ type: 'saveComplete', success: true });
	}

	async saveCustomDocumentAs(
		document: XlsxDocument,
		destination: vscode.Uri,
		cancellation: vscode.CancellationToken,
	): Promise<void> {
		const key = document.uri.toString();
		const panel = this._panels.get(key);
		const hadExternalSync = this._freshFromExternalSync.has(key);
		const skipSerialize = shouldSkipWebviewSerialize({
			freshFromWebview: this._freshFromWebview.has(key),
			freshFromExternalSync: hadExternalSync,
		});
		if (!skipSerialize) {
			const requestSave = panel
				? (panel as unknown as { __xlsxRequestSave?: () => Promise<boolean> }).__xlsxRequestSave
				: undefined;
			if (requestSave) {
				const ok = await requestSave();
				if (!ok) {
					throw new Error(
						'XLSX save-as failed: webview is not ready or did not return document bytes',
					);
				}
			}
		}
		await document.saveAs(destination, cancellation);
		if (hadExternalSync) {
			this.clearExternalSyncAuthority(key);
		}
	}

	async revertCustomDocument(
		document: XlsxDocument,
		cancellation: vscode.CancellationToken,
	): Promise<void> {
		await document.revert(cancellation);
		const key = document.uri.toString();
		const panel = this._panels.get(key);
		if (panel) {
			this.beginExternalReload(key);
			const base64 = bufferToBase64(document.documentData);
			panel.webview.postMessage({
				type: 'loadXLSX',
				data: base64,
				xlsxUri: key,
			});
		}
	}

	async backupCustomDocument(
		document: XlsxDocument,
		context: vscode.CustomDocumentBackupContext,
		cancellation: vscode.CancellationToken,
	): Promise<vscode.CustomDocumentBackup> {
		const key = document.uri.toString();
		const panel = this._panels.get(key);
		if (this._freshFromExternalSync.has(key)) {
			return document.backup(context.destination, cancellation);
		}
		const requestSave = panel
			? (panel as unknown as { __xlsxRequestSave?: () => Promise<boolean> }).__xlsxRequestSave
			: undefined;
		if (requestSave) {
			const ok = await requestSave();
			if (!ok) {
				throw new Error(
					'XLSX backup failed: webview is not ready or did not return document bytes',
				);
			}
		} else if (panel && !this.isReady(document.uri)) {
			throw new Error(
				'XLSX backup failed: webview is not ready or did not return document bytes',
			);
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

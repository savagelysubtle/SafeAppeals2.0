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
import { IFileDialogService } from '../../../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../../../platform/files/common/files.js';
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
import { XLSXRustViewerInput } from './xlsxRustViewerInput.js';

export class XLSXRustViewerEditor extends EditorPane {
	static readonly ID = 'void.xlsxRustViewer';

	private _element?: HTMLElement;
	private _dimension?: Dimension;
	private webview?: IOverlayWebview;
	private _currentInput?: XLSXRustViewerInput;
	private _webviewReady: boolean = false;
	private _pendingInput?: XLSXRustViewerInput;

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IFileService private readonly fileService: IFileService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService
	) {
		super(XLSXRustViewerEditor.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		this._element = DOM.append(parent, DOM.$('div.xlsx-rust-viewer-container'));
		this._element.style.width = '100%';
		this._element.style.height = '100%';
		this._element.style.position = 'relative';
	}

	override async setInput(input: EditorInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);

		if (token.isCancellationRequested || !(input instanceof XLSXRustViewerInput)) {
			return;
		}

		this._currentInput = input;
		console.log('[XLSX Rust Viewer] setInput called for:', input.resource.toString());

		// Create webview if it doesn't exist
		if (!this.webview && this._element) {
			this.webview = this.webviewService.createWebviewOverlay({
				title: 'XLSX Rust Viewer',
				providedViewType: 'void.xlsxRustViewer',
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
			await this.loadXLSX(input);
		} else {
			// Webview not ready yet, queue the input
			console.log('[XLSX Rust Viewer] Webview not ready, queuing input');
			this._pendingInput = input;
		}
	}

	private async loadXLSX(input: XLSXRustViewerInput): Promise<void> {
		if (!this.webview) {
			return;
		}

		try {
			const currentUri = input.resource.toString();
			console.log('[XLSX Rust Viewer] Loading XLSX:', currentUri);

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

			// Send to webview
			this.webview.postMessage({
				type: 'loadXLSX',
				data: base64Data,
				xlsxUri: currentUri
			});

		} catch (error) {
			console.error('[XLSX Rust Viewer] Failed to load XLSX:', error);
		}
	}

	private handleWebviewMessage(message: any): void {
		const data = message.message || message;

		switch (data.type) {
			case 'ready':
				console.log('[XLSX Rust Viewer] Webview ready');
				this._webviewReady = true;

				// If there's a pending input, load it now
				if (this._pendingInput) {
					const pendingInput = this._pendingInput;
					this._pendingInput = undefined;
					this.loadXLSX(pendingInput);
				}
				break;

			case 'dirty':
				console.log('[XLSX Rust Viewer] Model modified');
				// Future: integrate with working copy to track dirty state
				break;

			case 'saveData':
				this.handleSaveData(data.data);
				break;

			case 'print':
				this.handlePrint(data.imageData);
				break;

			case 'exportImage':
				this.handleExportImage(data.imageData);
				break;

			case 'error':
				console.error('[XLSX Rust Viewer] Webview error:', data.message);
				break;
		}
	}

	/**
	 * Request the webview to serialize the current model back to XLSX bytes.
	 */
	public triggerSave(): void {
		if (this.webview && this._webviewReady) {
			this.webview.postMessage({ type: 'saveXLSX' });
		}
	}

	/**
	 * Handle the serialized XLSX bytes coming back from the webview and write to disk.
	 */
	private async handleSaveData(base64Data: string): Promise<void> {
		if (!this._currentInput) return;

		try {
			// Decode base64 to bytes
			const binaryString = atob(base64Data);
			const bytes = new Uint8Array(binaryString.length);
			for (let i = 0; i < binaryString.length; i++) {
				bytes[i] = binaryString.charCodeAt(i);
			}

			// Write to the original file
			await this.fileService.writeFile(this._currentInput.resource, VSBuffer.wrap(bytes));
			console.log('[XLSX Rust Viewer] File saved to disk:', this._currentInput.resource.toString());
		} catch (error) {
			console.error('[XLSX Rust Viewer] Failed to save file:', error);
		}
	}

	/**
	 * Open a print-ready HTML page in the default browser with the canvas snapshot.
	 * Writes a temp HTML file because data: URIs don't work with openExternal on Windows.
	 */
	private async handlePrint(imageDataUrl: string): Promise<void> {
		if (!imageDataUrl) return;

		try {
			const fileName = this._currentInput?.getName() ?? 'Spreadsheet';
			const printHtml = [
				'<!DOCTYPE html><html><head><meta charset="utf-8">',
				`<title>Print - ${fileName}</title>`,
				'<style>',
				'@media print { @page { margin: 0.5in; } body { margin: 0; } }',
				'body { display: flex; justify-content: center; padding: 20px; }',
				'img { max-width: 100%; height: auto; }',
				'</style>',
				'</head><body>',
				`<img src="${imageDataUrl}" onload="window.print()">`,
				'</body></html>',
			].join('');

			// Write temp HTML file next to the source file
			const parentUri = this._currentInput
				? URI.joinPath(this._currentInput.resource, '..')
				: undefined;
			const tmpName = `.~print-${generateUuid().slice(0, 8)}.html`;
			const tmpUri = parentUri
				? URI.joinPath(parentUri, tmpName)
				: URI.parse(`file:///tmp/${tmpName}`);

			await this.fileService.writeFile(tmpUri, VSBuffer.fromString(printHtml));

			// Open in default browser
			await this.openerService.open(tmpUri, { openExternal: true });

			// Clean up temp file after a delay
			setTimeout(() => {
				this.fileService.del(tmpUri).catch(() => { /* ignore cleanup errors */ });
			}, 30000);
		} catch (error) {
			console.error('[XLSX Rust Viewer] Print failed:', error);
		}
	}

	/**
	 * Export the canvas snapshot as a PNG image file via Save dialog.
	 */
	private async handleExportImage(imageDataUrl: string): Promise<void> {
		if (!imageDataUrl) return;

		try {
			// Suggest a default filename based on the source xlsx
			const baseName = this._currentInput
				? this._currentInput.resource.path.replace(/^.*[\\/]/, '').replace(/\.[^.]+$/, '')
				: 'spreadsheet';
			const defaultUri = this._currentInput
				? URI.joinPath(this._currentInput.resource, '..', `${baseName}.png`)
				: undefined;

			const result = await this.fileDialogService.showSaveDialog({
				title: 'Export as Image',
				defaultUri,
				filters: [
					{ name: 'PNG Image', extensions: ['png'] }
				]
			});

			if (result) {
				// Strip the data URL prefix to get raw base64
				const base64 = imageDataUrl.replace(/^data:image\/png;base64,/, '');
				const binaryString = atob(base64);
				const bytes = new Uint8Array(binaryString.length);
				for (let i = 0; i < binaryString.length; i++) {
					bytes[i] = binaryString.charCodeAt(i);
				}
				await this.fileService.writeFile(result, VSBuffer.wrap(bytes));
				console.log('[XLSX Rust Viewer] Image exported to:', result.toString());
			}
		} catch (error) {
			console.error('[XLSX Rust Viewer] Export failed:', error);
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
			this.webview.postMessage({ type: 'clearXLSX' });
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

	public getInput(): XLSXRustViewerInput | undefined {
		return this._currentInput;
	}

	public getWebview(): IOverlayWebview | undefined {
		return this.webview;
	}

	override layout(dimension: Dimension): void {
		this._dimension = dimension;
		if (this.webview && this._element) {
			this.webview.layoutWebviewOverElement(this._element, dimension);
			this.webview.postMessage({ type: 'layout' });
		}
	}

	private getMediaUri(): URI {
		return FileAccess.asFileUri('vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media');
	}

	private getWebviewHTML(): string {
		if (!this.webview) {
			return '';
		}

		const nonce = generateUuid();
		const mediaUri = this.getMediaUri();

		// Bundled webview script (IIFE, built by esbuild from main.ts + renderer.ts + wasm glue)
		const scriptUri = asWebviewUri(URI.joinPath(mediaUri, 'xlsxRustViewer.js'));
		// WASM binary - loaded at runtime via fetch() inside the bundled script
		const wasmUri = asWebviewUri(URI.joinPath(mediaUri, 'wasm', 'xlsx_rust_viewer_bg.wasm'));

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' 'wasm-unsafe-eval' vscode-resource:; style-src 'unsafe-inline' vscode-resource:; connect-src https:;">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>XLSX Rust Viewer</title>
	<style>
		/* ============================== LAYOUT ============================== */
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			overflow: hidden;
			background: var(--vscode-editor-background, #1e1e1e);
			color: var(--vscode-editor-foreground, #ccc);
			font-family: var(--vscode-font-family, system-ui, -apple-system, sans-serif);
			font-size: var(--vscode-font-size, 13px);
			display: flex; flex-direction: column; height: 100vh;
		}
		#ribbon-container { flex-shrink: 0; }
		#formula-bar {
			display: flex; align-items: center; gap: 6px;
			padding: 3px 8px;
			background: var(--vscode-editorWidget-background, #252526);
			border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
			flex-shrink: 0; height: 28px;
		}
		#cell-ref {
			min-width: 56px; padding: 2px 8px;
			background: var(--vscode-input-background, #3c3c3c);
			border: 1px solid var(--vscode-input-border, #3c3c3c);
			color: var(--vscode-input-foreground, #ccc);
			font-size: 12px; text-align: center; border-radius: 3px;
			font-weight: 600; letter-spacing: 0.5px;
		}
		.fx-label {
			font-style: italic; font-weight: 600; font-size: 13px;
			color: var(--vscode-descriptionForeground, #888);
			padding: 0 2px;
		}
		#formula-input {
			flex: 1; padding: 2px 8px; height: 22px;
			background: var(--vscode-input-background, #3c3c3c);
			border: 1px solid var(--vscode-input-border, #3c3c3c);
			color: var(--vscode-input-foreground, #ccc);
			font-size: 12px; outline: none; border-radius: 3px;
			font-family: inherit;
		}
		#formula-input:focus { border-color: var(--vscode-focusBorder, #007acc); }
		#canvas-container { flex: 1; position: relative; overflow: hidden; min-height: 0; }
		canvas { display: block; outline: none; }

		/* ============================== SHEET TABS ============================== */
		#sheet-tabs {
			display: flex; align-items: stretch; gap: 0;
			background: var(--vscode-editorGroupHeader-tabsBackground, #1e1e1e);
			border-top: 1px solid var(--vscode-panel-border, #3c3c3c);
			height: 28px; flex-shrink: 0; overflow-x: auto;
			scrollbar-width: thin;
		}
		.sheet-tab {
			padding: 0 16px; border: none; border-right: 1px solid var(--vscode-panel-border, #3c3c3c);
			background: transparent;
			color: var(--vscode-foreground, #ccc);
			cursor: pointer; font-size: 12px;
			white-space: nowrap; display: flex; align-items: center;
			transition: background 0.12s;
		}
		.sheet-tab:hover { background: var(--vscode-toolbar-hoverBackground, rgba(90,93,94,0.31)); }
		.sheet-tab.active {
			background: var(--vscode-editor-background, #1e1e1e);
			color: var(--vscode-editor-foreground, #fff);
			border-bottom: 2px solid var(--vscode-focusBorder, #007acc);
			font-weight: 500;
		}
		.sheet-tab-add {
			padding: 0 12px; font-size: 16px; font-weight: 300;
			color: var(--vscode-descriptionForeground, #888);
		}
		.sheet-tab-add:hover { color: var(--vscode-foreground, #fff); }

		/* ============================== RIBBON ============================== */
		.xlsx-ribbon {
			background: var(--vscode-sideBar-background, #252526);
			border-bottom: 1px solid var(--vscode-panel-border, #3c3c3c);
			user-select: none;
		}

		/* --- Tab Bar --- */
		.ribbon-tab-bar {
			display: flex; align-items: stretch; justify-content: space-between;
			background: var(--vscode-titleBar-activeBackground, #1e1e1e);
			height: 32px;
		}
		.ribbon-tabs-left { display: flex; }
		.ribbon-tab {
			padding: 0 16px; border: none;
			background: transparent;
			color: var(--vscode-foreground, #ccc);
			cursor: pointer; font-size: 12px; font-weight: 500;
			border-bottom: 2px solid transparent;
			transition: all 0.15s ease;
			display: flex; align-items: center;
		}
		.ribbon-tab:hover {
			background: var(--vscode-toolbar-hoverBackground, rgba(90,93,94,0.31));
			color: var(--vscode-editor-foreground, #fff);
		}
		.ribbon-tab.active {
			background: var(--vscode-sideBar-background, #252526);
			color: var(--vscode-editor-foreground, #fff);
			border-bottom-color: var(--vscode-focusBorder, #007acc);
		}
		.ribbon-file-ops {
			display: flex; gap: 1px; align-items: center;
			margin-left: auto; padding: 0 6px;
		}

		/* --- Content Area --- */
		.ribbon-content {
			display: flex; padding: 4px 2px 0; min-height: 72px;
			overflow-x: auto; overflow-y: hidden;
		}
		.ribbon-tab-panel { display: flex; width: 100%; }

		/* --- Groups --- */
		.ribbon-group {
			display: flex; flex-direction: column;
			align-items: center; justify-content: space-between;
			padding: 0 10px 0;
			border-right: 1px solid var(--vscode-panel-border, #3c3c3c);
			position: relative;
		}
		.ribbon-group:last-child { border-right: none; }
		.group-body {
			display: flex; gap: 4px; align-items: center;
			flex: 1; padding: 2px 0;
		}
		.group-label {
			font-size: 9px; text-transform: uppercase; letter-spacing: 0.8px;
			color: var(--vscode-descriptionForeground, #666);
			padding: 2px 0 3px; white-space: nowrap;
			text-align: center; width: 100%;
		}

		/* --- Button rows/cols --- */
		.btn-row { display: flex; gap: 2px; align-items: center; }
		.btn-col { display: flex; flex-direction: column; gap: 2px; }
		.btn-col.gap-6 { gap: 6px; }
		.btn-separator { width: 1px; height: 16px; background: var(--vscode-panel-border, #3c3c3c); margin: 0 2px; }

		/* --- Base button --- */
		.ribbon-btn {
			display: inline-flex; align-items: center; gap: 4px;
			padding: 3px 6px;
			border: 1px solid transparent;
			background: transparent;
			color: var(--vscode-editor-foreground, #ccc);
			cursor: pointer; font-size: 11px;
			border-radius: 3px; white-space: nowrap;
			transition: all 0.1s ease;
			line-height: 1.2;
		}
		.ribbon-btn:hover {
			background: var(--vscode-toolbar-hoverBackground, rgba(90,93,94,0.31));
		}
		.ribbon-btn:active {
			background: var(--vscode-list-activeSelectionBackground, rgba(4,57,94,0.4));
		}
		.ribbon-btn svg { width: 16px; height: 16px; flex-shrink: 0; }
		.btn-icon { display: flex; align-items: center; justify-content: center; }
		.btn-icon svg { width: 16px; height: 16px; }
		.btn-icon.lg svg { width: 22px; height: 22px; }
		.btn-label { font-size: 11px; }

		/* Icon-only buttons */
		.icon-only-btn { padding: 4px 5px; }
		.icon-only-btn svg { width: 16px; height: 16px; }

		/* --- Tall (primary) buttons --- */
		.tall-btn {
			flex-direction: column; gap: 2px;
			padding: 5px 8px 3px;
			min-width: 46px; min-height: 54px;
			justify-content: center; text-align: center;
		}
		.tall-btn .btn-icon.lg { margin-bottom: 1px; }
		.btn-label-below {
			font-size: 10px; line-height: 1.3;
			text-align: center;
		}

		/* --- Format (text) buttons --- */
		.fmt-btn {
			min-width: 24px; min-height: 24px;
			justify-content: center; padding: 2px 4px;
			font-size: 13px; font-weight: 400;
		}
		.fmt-bold { font-weight: 800; }
		.fmt-italic { font-style: italic; font-family: Georgia, serif; }
		.fmt-underline { text-decoration: underline; text-underline-offset: 2px; }
		.fmt-strike { text-decoration: line-through; }

		/* --- Color buttons --- */
		.color-btn-wrapper { display: inline-flex; position: relative; }
		.color-trigger {
			flex-direction: column; gap: 0; padding: 2px 4px 0;
			min-width: 26px; min-height: 24px;
		}
		.color-trigger span:first-child { font-size: 13px; font-weight: 600; line-height: 1; }
		.color-bar {
			width: 18px; height: 3px; border-radius: 1px;
			margin-top: 1px;
		}
		.color-input-hidden {
			position: absolute; width: 0; height: 0;
			opacity: 0; pointer-events: none;
		}

		/* --- Toggle buttons --- */
		.toggle-btn.toggled {
			background: var(--vscode-list-activeSelectionBackground, rgba(4,57,94,0.4));
			border-color: var(--vscode-focusBorder, #007acc);
		}

		/* --- Selects --- */
		.ribbon-select {
			padding: 3px 6px; height: 24px;
			border: 1px solid var(--vscode-input-border, #3c3c3c);
			background: var(--vscode-input-background, #3c3c3c);
			color: var(--vscode-input-foreground, #ccc);
			font-size: 11px; border-radius: 3px;
			cursor: pointer; outline: none;
			font-family: inherit;
		}
		.ribbon-select:focus { border-color: var(--vscode-focusBorder, #007acc); }
		.font-select { width: 120px; }
		.size-select { width: 50px; }
		.num-select { width: 100px; }

		/* --- Clipboard Excel-style layout --- */
		.clip-layout { gap: 3px; }
		.clip-stack { display: flex; flex-direction: column; gap: 2px; }

		/* --- Font group --- */
		.font-body { flex-direction: column; gap: 3px; align-items: flex-start; }

		/* ============================== CONTEXT MENU ============================== */
		.xlsx-context-menu {
			position: fixed; z-index: 1000;
			min-width: 220px;
			background: var(--vscode-menu-background, #252526);
			border: 1px solid var(--vscode-menu-border, #454545);
			border-radius: 6px;
			box-shadow: 0 6px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
			padding: 5px 0;
			font-size: 12px;
			backdrop-filter: blur(8px);
		}
		.ctx-item {
			display: flex; justify-content: space-between; align-items: center;
			padding: 5px 24px 5px 12px; cursor: pointer;
			color: var(--vscode-menu-foreground, #ccc);
			border-radius: 0; transition: background 0.08s;
		}
		.ctx-item:hover {
			background: var(--vscode-list-activeSelectionBackground, #094771);
			color: var(--vscode-list-activeSelectionForeground, #fff);
		}
		.ctx-label { flex: 1; }
		.ctx-shortcut {
			margin-left: 32px;
			color: var(--vscode-descriptionForeground, #666);
			font-size: 11px; opacity: 0.8;
		}
		.ctx-item:hover .ctx-shortcut { color: inherit; opacity: 0.7; }
		.ctx-separator {
			height: 1px; margin: 5px 10px;
			background: var(--vscode-menu-separatorBackground, #3c3c3c);
		}
		/* --- Filter Dropdown --- */
		.xlsx-filter-dropdown {
			position: fixed; z-index: 1001;
			width: 260px;
			background: var(--vscode-menu-background, #252526);
			border: 1px solid var(--vscode-menu-border, #454545);
			border-radius: 6px;
			box-shadow: 0 6px 20px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04);
			padding: 5px 0;
			font-size: 12px;
			backdrop-filter: blur(8px);
			color: var(--vscode-menu-foreground, #ccc);
		}
		.filter-item {
			padding: 5px 12px; cursor: pointer;
			border-radius: 0; transition: background 0.08s;
		}
		.filter-item:hover {
			background: var(--vscode-list-activeSelectionBackground, #094771);
			color: var(--vscode-list-activeSelectionForeground, #fff);
		}
		.filter-clear { font-style: italic; opacity: 0.85; }
		.filter-separator {
			height: 1px; margin: 5px 10px;
			background: var(--vscode-menu-separatorBackground, #3c3c3c);
		}
		.filter-search {
			display: block; width: calc(100% - 24px); margin: 6px 12px;
			padding: 4px 8px;
			background: var(--vscode-input-background, #3c3c3c);
			color: var(--vscode-input-foreground, #ccc);
			border: 1px solid var(--vscode-input-border, #555);
			border-radius: 3px; outline: none; font-size: 12px;
		}
		.filter-search:focus { border-color: var(--vscode-focusBorder, #007fd4); }
		.filter-checkbox-list {
			max-height: 180px; overflow-y: auto;
			padding: 0 6px;
		}
		.filter-checkbox-row {
			display: flex; align-items: center; gap: 6px;
			padding: 3px 6px; cursor: pointer; border-radius: 3px;
		}
		.filter-checkbox-row:hover {
			background: var(--vscode-list-hoverBackground, #2a2d2e);
		}
		.filter-select-all {
			padding: 4px 12px; font-weight: bold;
		}
		.filter-btn-row {
			display: flex; justify-content: flex-end; gap: 6px;
			padding: 6px 12px;
		}
		.filter-btn {
			padding: 4px 16px; border: none; border-radius: 3px;
			cursor: pointer; font-size: 12px;
		}
		.filter-btn-ok {
			background: var(--vscode-button-background, #0e639c);
			color: var(--vscode-button-foreground, #fff);
		}
		.filter-btn-ok:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
		.filter-btn-cancel {
			background: var(--vscode-button-secondaryBackground, #3a3d41);
			color: var(--vscode-button-secondaryForeground, #ccc);
		}
		.filter-btn-cancel:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
		/* --- Filter Arrow Buttons (overlaid on table headers) --- */
		.filter-arrow-btn {
			position: absolute;
			z-index: 5;
			pointer-events: auto;
			cursor: pointer;
			width: 18px;
			border: none;
			background: transparent;
			color: #fff;
			font-size: 10px;
			line-height: 1;
			padding: 0;
			margin: 0;
			display: flex;
			align-items: center;
			justify-content: center;
			opacity: 0.85;
			transition: background 0.1s, opacity 0.1s;
		}
		.filter-arrow-btn:hover {
			background: rgba(255,255,255,0.18);
			opacity: 1;
			border-radius: 2px;
		}

		/* Conditional Formatting Dialog */
		.cf-dialog {
			position: fixed;
			top: 50%;
			left: 50%;
			transform: translate(-50%, -50%);
			width: 420px;
			max-height: 80vh;
			background: var(--vscode-editorWidget-background, #252526);
			border: 1px solid var(--vscode-editorWidget-border, #454545);
			border-radius: 6px;
			box-shadow: 0 8px 32px rgba(0,0,0,0.4);
			display: flex;
			flex-direction: column;
			z-index: 10000;
			font-family: var(--vscode-font-family, system-ui);
			font-size: 12px;
			color: var(--vscode-foreground, #ccc);
		}
		.cf-dialog-title {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 8px 12px;
			font-weight: 600;
			font-size: 13px;
			background: var(--vscode-titleBar-activeBackground, #3c3c3c);
			border-bottom: 1px solid var(--vscode-editorWidget-border, #454545);
			border-radius: 6px 6px 0 0;
			user-select: none;
		}
		.cf-dialog-close {
			background: none;
			border: none;
			color: var(--vscode-foreground, #ccc);
			font-size: 18px;
			cursor: pointer;
			padding: 0 4px;
			line-height: 1;
		}
		.cf-dialog-close:hover { color: #ff4444; }
		.cf-dialog-body {
			padding: 12px;
			overflow-y: auto;
			flex: 1;
		}
		.cf-dialog-section {
			margin-bottom: 12px;
		}
		.cf-dialog-label {
			font-weight: 600;
			margin-bottom: 6px;
			font-size: 11px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: var(--vscode-descriptionForeground, #999);
		}
		.cf-dialog-row {
			display: flex;
			align-items: center;
			gap: 6px;
			margin-bottom: 6px;
		}
		.cf-input-label {
			min-width: 70px;
			font-size: 12px;
		}
		.cf-select, .cf-input {
			flex: 1;
			padding: 4px 6px;
			background: var(--vscode-input-background, #3c3c3c);
			border: 1px solid var(--vscode-input-border, #555);
			color: var(--vscode-input-foreground, #ccc);
			border-radius: 3px;
			font-size: 12px;
			font-family: inherit;
		}
		.cf-select:focus, .cf-input:focus {
			border-color: var(--vscode-focusBorder, #007fd4);
			outline: none;
		}
		.cf-color-input {
			width: 32px;
			height: 24px;
			padding: 0;
			border: 1px solid var(--vscode-input-border, #555);
			border-radius: 3px;
			cursor: pointer;
			background: none;
		}
		.cf-config-area {
			margin-top: 6px;
		}
		.cf-dialog-note {
			padding: 4px 8px;
			background: var(--vscode-textBlockQuote-background, #333);
			border-radius: 3px;
			font-size: 11px;
			color: var(--vscode-descriptionForeground, #999);
		}
		.cf-preview {
			margin-top: 8px;
			padding: 8px 12px;
			border: 1px solid var(--vscode-input-border, #555);
			border-radius: 3px;
			font-size: 13px;
			text-align: center;
		}
		.cf-dialog-footer {
			display: flex;
			justify-content: flex-end;
			gap: 8px;
			padding: 8px 12px;
			border-top: 1px solid var(--vscode-editorWidget-border, #454545);
		}
		.cf-btn {
			padding: 5px 14px;
			border: 1px solid var(--vscode-button-secondaryBackground, #3a3d41);
			background: var(--vscode-button-secondaryBackground, #3a3d41);
			color: var(--vscode-button-secondaryForeground, #ccc);
			border-radius: 3px;
			cursor: pointer;
			font-size: 12px;
		}
		.cf-btn:hover { background: var(--vscode-button-secondaryHoverBackground, #45494e); }
		.cf-btn-primary {
			background: var(--vscode-button-background, #0e639c);
			color: var(--vscode-button-foreground, #fff);
			border-color: var(--vscode-button-background, #0e639c);
		}
		.cf-btn-primary:hover { background: var(--vscode-button-hoverBackground, #1177bb); }
		.cf-rule-list {
			max-height: 120px;
			overflow-y: auto;
			border: 1px solid var(--vscode-input-border, #555);
			border-radius: 3px;
			margin-bottom: 6px;
		}
		.cf-rule-empty {
			padding: 8px;
			text-align: center;
			color: var(--vscode-descriptionForeground, #888);
			font-style: italic;
		}
		.cf-rule-item {
			display: flex;
			align-items: center;
			gap: 6px;
			padding: 4px 8px;
			border-bottom: 1px solid var(--vscode-input-border, #444);
			cursor: pointer;
		}
		.cf-rule-item:last-child { border-bottom: none; }
		.cf-rule-item:hover { background: var(--vscode-list-hoverBackground, #2a2d2e); }
		.cf-rule-desc {
			flex: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 11px;
		}
		.cf-rule-range {
			font-size: 10px;
			color: var(--vscode-descriptionForeground, #888);
			min-width: 50px;
			text-align: right;
		}
		.cf-rule-preview {
			padding: 1px 4px;
			border-radius: 2px;
			font-size: 11px;
			min-width: 20px;
			text-align: center;
		}
		.cf-rule-delete {
			background: none;
			border: none;
			color: var(--vscode-errorForeground, #f48771);
			cursor: pointer;
			font-size: 14px;
			padding: 0 2px;
			line-height: 1;
		}
		.cf-rule-delete:hover { color: #ff4444; }
		.cf-custom-colors {
			margin-top: 4px;
		}

		/* --- Chart Overlays --- */
		.chart-overlay {
			position: absolute;
			z-index: 10;
			border: 1px solid var(--vscode-editorWidget-border, #454545);
			background: var(--vscode-editor-background, #1e1e1e);
			pointer-events: auto;
			cursor: move;
			box-shadow: 0 2px 8px rgba(0,0,0,0.15);
			border-radius: 4px;
			overflow: hidden;
		}
		.chart-overlay.selected {
			border: 2px solid var(--vscode-focusBorder, #007acc);
			box-shadow: 0 0 0 1px var(--vscode-focusBorder, #007acc), 0 4px 12px rgba(0,0,0,0.3);
		}
		.chart-resize-handle {
			position: absolute;
			width: 8px;
			height: 8px;
			background: var(--vscode-focusBorder, #007acc);
			border-radius: 50%;
			z-index: 11;
		}
		.chart-resize-handle:hover {
			background: var(--vscode-button-hoverBackground, #1177bb);
			transform: scale(1.3);
		}

		/* --- Chart Wizard Dialog --- */
		.chart-wizard-overlay {
			position: fixed;
			inset: 0;
			background: rgba(0,0,0,0.5);
			z-index: 10000;
			display: none;
			align-items: center;
			justify-content: center;
		}
		.chart-wizard-dialog {
			background: var(--vscode-editor-background, #1e1e1e);
			border: 1px solid var(--vscode-focusBorder, #007acc);
			border-radius: 8px;
			box-shadow: 0 8px 32px rgba(0,0,0,0.5);
		}
	</style>
</head>
<body>
	<div id="config" data-wasm-url="${wasmUri}" style="display:none;"></div>
	<div id="ribbon-container"></div>
	<div id="formula-bar">
		<span id="cell-ref">A1</span>
		<span class="fx-label">fx</span>
		<input id="formula-input" type="text" />
	</div>
	<div id="canvas-container"></div>
	<div id="sheet-tabs"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

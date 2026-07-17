/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Editable custom document for .xlsx / .xls files.
 *
 * Bytes live on disk; the webview owns the Rust-WASM workbook model and
 * serializes via `XlsxWriter.save(modelJson)`. We keep the last serialized
 * bytes so save/backup/revert do not require a live webview when a snapshot
 * was already flushed.
 *
 * Divergence from old XLSXRustWorkingCopy: that stub returned `{}` from
 * backup(); here we write real hot-exit backups (binary XLSX bytes).
 */
export class XlsxDocument implements vscode.CustomDocument {
	private readonly _onDidDispose = new vscode.EventEmitter<void>();
	public readonly onDidDispose = this._onDidDispose.event;

	private readonly _onDidChangeContent = new vscode.EventEmitter<{
		readonly content?: Uint8Array;
	}>();
	/** Fired when document bytes/content change (dirty tracking for the provider). */
	public readonly onDidChangeContent = this._onDidChangeContent.event;

	private _disposed = false;
	private _documentData: Uint8Array;
	private _isDirty = false;

	private constructor(
		public readonly uri: vscode.Uri,
		initialData: Uint8Array,
	) {
		this._documentData = initialData;
	}

	static async create(
		uri: vscode.Uri,
		backupId: string | undefined,
	): Promise<XlsxDocument> {
		if (backupId) {
			const backupUri = vscode.Uri.parse(backupId);
			const data = await vscode.workspace.fs.readFile(backupUri);
			return new XlsxDocument(uri, data);
		}

		const data = await vscode.workspace.fs.readFile(uri);
		return new XlsxDocument(uri, data);
	}

	get documentData(): Uint8Array {
		return this._documentData;
	}

	get isDirty(): boolean {
		return this._isDirty;
	}

	/**
	 * Apply a webview-serialized XLSX snapshot.
	 * Marks dirty unless `silent` (load settle) or `markClean` (after save).
	 */
	updateFromWebview(
		data: Uint8Array,
		options?: { markClean?: boolean; silent?: boolean },
	): void {
		this._documentData = data;
		if (options?.markClean) {
			this._isDirty = false;
			return;
		}
		if (options?.silent) {
			return;
		}
		this._isDirty = true;
		this._onDidChangeContent.fire({ content: data });
	}

	/** Mark dirty without new bytes (edit before serialize finishes). */
	markDirty(): void {
		if (!this._isDirty) {
			this._isDirty = true;
			this._onDidChangeContent.fire({});
		} else {
			this._onDidChangeContent.fire({});
		}
	}

	markClean(): void {
		this._isDirty = false;
	}

	async saveAs(targetResource: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
		if (cancellation.isCancellationRequested) {
			return;
		}
		await vscode.workspace.fs.writeFile(targetResource, this._documentData);
		if (targetResource.toString() === this.uri.toString()) {
			this._isDirty = false;
		}
	}

	async revert(_cancellation: vscode.CancellationToken): Promise<void> {
		const data = await vscode.workspace.fs.readFile(this.uri);
		this._documentData = data;
		this._isDirty = false;
		this._onDidChangeContent.fire({ content: data });
	}

	async backup(
		destination: vscode.Uri,
		cancellation: vscode.CancellationToken,
	): Promise<vscode.CustomDocumentBackup> {
		await this.saveAs(destination, cancellation);

		return {
			id: destination.toString(),
			delete: async () => {
				try {
					await vscode.workspace.fs.delete(destination);
				} catch {
					// ignore
				}
			},
		};
	}

	dispose(): void {
		if (this._disposed) {
			return;
		}
		this._disposed = true;
		this._onDidDispose.fire();
		this._onDidDispose.dispose();
		this._onDidChangeContent.dispose();
	}
}

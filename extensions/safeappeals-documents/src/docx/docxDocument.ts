/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/**
 * Editable custom document for .docx files.
 *
 * Bytes live on disk; the webview owns TipTap state and serializes via the
 * `docx` Packer. We keep the last serialized bytes (+ optional TipTap JSON for
 * image round-trip) so save/backup/revert do not require a live webview when
 * contentChanged already flushed a snapshot.
 *
 * Divergence from old DOCXWorkingCopy: that stub returned `{}` from backup();
 * here we write real hot-exit backups (binary DOCX + optional JSON sidecar meta).
 */
export class DocxDocument implements vscode.CustomDocument {
	private readonly _onDidDispose = new vscode.EventEmitter<void>();
	public readonly onDidDispose = this._onDidDispose.event;

	private readonly _onDidChangeContent = new vscode.EventEmitter<{
		readonly content?: Uint8Array;
	}>();
	/** Fired when document bytes/content change (dirty tracking for the provider). */
	public readonly onDidChangeContent = this._onDidChangeContent.event;

	private _disposed = false;
	private _documentData: Uint8Array;
	private _jsonContent: string | undefined;
	private _isDirty = false;

	private constructor(
		public readonly uri: vscode.Uri,
		initialData: Uint8Array,
		jsonContent?: string,
	) {
		this._documentData = initialData;
		this._jsonContent = jsonContent;
	}

	static async create(
		uri: vscode.Uri,
		backupId: string | undefined,
	): Promise<DocxDocument> {
		if (backupId) {
			const backupUri = vscode.Uri.parse(backupId);
			const data = await vscode.workspace.fs.readFile(backupUri);
			let jsonContent: string | undefined;
			try {
				const metaUri = vscode.Uri.parse(`${backupId}.json`);
				const metaBytes = await vscode.workspace.fs.readFile(metaUri);
				jsonContent = Buffer.from(metaBytes).toString('utf8');
			} catch {
				// optional sidecar
			}
			return new DocxDocument(uri, data, jsonContent);
		}

		const data = await vscode.workspace.fs.readFile(uri);
		return new DocxDocument(uri, data);
	}

	get documentData(): Uint8Array {
		return this._documentData;
	}

	get jsonContent(): string | undefined {
		return this._jsonContent;
	}

	get isDirty(): boolean {
		return this._isDirty;
	}

	/**
	 * Apply a webview-serialized DOCX snapshot (and optional TipTap JSON).
	 * Marks dirty unless `silent` (load settle) or `markClean` (after save).
	 */
	updateFromWebview(
		data: Uint8Array,
		jsonContent: string | undefined,
		options?: { markClean?: boolean; silent?: boolean },
	): void {
		this._documentData = data;
		if (jsonContent !== undefined) {
			this._jsonContent = jsonContent;
		}
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

	/** Mark dirty without new bytes (e.g. edit before serialize finishes). */
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

	/**
	 * Replace in-memory bytes after an external/headless write so a later save
	 * cannot overwrite disk with a stale host cache. Does not fire dirty events.
	 */
	syncFromExternalBytes(data: Uint8Array): void {
		this._documentData = data;
		this._jsonContent = undefined;
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
		this._jsonContent = undefined;
		this._isDirty = false;
		this._onDidChangeContent.fire({ content: data });
	}

	async backup(
		destination: vscode.Uri,
		cancellation: vscode.CancellationToken,
	): Promise<vscode.CustomDocumentBackup> {
		await this.saveAs(destination, cancellation);
		if (this._jsonContent) {
			try {
				await vscode.workspace.fs.writeFile(
					vscode.Uri.parse(`${destination.toString()}.json`),
					Buffer.from(this._jsonContent, 'utf8'),
				);
			} catch {
				// best-effort JSON sidecar
			}
		}

		return {
			id: destination.toString(),
			delete: async () => {
				try {
					await vscode.workspace.fs.delete(destination);
				} catch {
					// ignore
				}
				try {
					await vscode.workspace.fs.delete(vscode.Uri.parse(`${destination.toString()}.json`));
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

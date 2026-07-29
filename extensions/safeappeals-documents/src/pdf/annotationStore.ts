/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import * as path from 'path';
import * as vscode from 'vscode';
import { acquireDek, loadJson, writeEncryptedJson } from '../shared/encryptedStore';

/**
 * Annotation model matches the old workbench PDFAnnotationService
 * (`void-reference/.../pdfAnnotationService.ts`).
 *
 * Persistence:
 * - Annotations → encrypted `pdf-annotations.json` under `context.storageUri`
 *   when a folder is open, otherwise under `context.globalStorageUri` (so
 *   single-file PDF sessions still persist). Entries are keyed by `pdfUri`.
 *   Memory-only only when SecretStorage/DEK is unavailable.
 * - Saved signatures → `context.secrets` (global SecretStorage).
 * - Last-page keys remain in workspaceState.
 */
export interface PdfAnnotation {
	id: string;
	pdfUri: string;
	page: number;
	text: string;
	color: string;
	boundingBoxes: Array<{ page: number; x: number; y: number; width: number; height: number }>;
	note?: string;
	imageData?: string;
	createdAt: number;
}

export interface SavedSignature {
	id: string;
	dataURL: string;
	createdAt: number;
}

const LEGACY_ANNOTATIONS_KEY = 'void.pdfAnnotations';
const LEGACY_SIGNATURES_KEY = 'void.pdfSavedSignatures';
const SIGNATURES_SECRETS_KEY = 'safeappeals-documents.pdfSignatures';
const ANNOTATIONS_DEK_KEY = 'safeappeals-documents.dek.pdfAnnotations';
const ANNOTATIONS_FILE = 'pdf-annotations.json';
const PAGE_PREFIX = 'pdfViewer.lastPage.';
const SIGNATURES_MAX_BYTES = 256 * 1024;

export class PdfAnnotationStore {
	private _annotations = new Map<string, PdfAnnotation>();
	private _signatures: SavedSignature[] = [];
	private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	readonly onDidChangeAnnotations = this._onDidChange.event;

	private constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly log: ((msg: string) => void) | undefined,
		private readonly annotationsPath: string | undefined,
		private readonly dek: Buffer | undefined,
	) { }

	/**
	 * Async factory: loads encrypted annotations + SecretStorage signatures,
	 * migrates legacy workspaceState keys, then returns a ready store.
	 * Never throws.
	 */
	static async create(
		context: vscode.ExtensionContext,
		log?: (msg: string) => void,
	): Promise<PdfAnnotationStore> {
		try {
			const baseUri = context.storageUri ?? context.globalStorageUri;
			const locationKind = context.storageUri ? 'workspace' : 'global';
			log?.(
				`PDF annotations store location: ${locationKind} (${baseUri.fsPath})`,
			);

			let annotationsPath: string | undefined = path.join(baseUri.fsPath, ANNOTATIONS_FILE);
			let dek: Buffer | undefined;

			const dekResult = await acquireDek({
				secrets: context.secrets,
				keyId: ANNOTATIONS_DEK_KEY,
				existingDataPaths: [annotationsPath],
				log,
			});
			if (dekResult.kind === 'ok') {
				dek = dekResult.dek;
			} else {
				log?.(
					`PDF annotations DEK unavailable (${dekResult.reason}); running memory-only`,
				);
				void vscode.window.showWarningMessage(
					'Safe Appeals Documents: PDF annotations cannot be encrypted at rest (SecretStorage unavailable). Annotations will not persist to disk for this session.',
				);
				annotationsPath = undefined;
			}

			const store = new PdfAnnotationStore(context, log, annotationsPath, dek);

			if (store.dek && store.annotationsPath) {
				const loaded = await loadJson<PdfAnnotation[]>(
					store.annotationsPath,
					store.dek,
					log,
				);
				if (Array.isArray(loaded.value)) {
					store._annotations = new Map(loaded.value.map(a => [a.id, a]));
				}
			}

			await store._migrateLegacyAnnotations();
			await store._loadSignatures();
			await store._migrateLegacySignatures();

			return store;
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			log?.(`PdfAnnotationStore.create failed; falling back to empty memory store: ${detail}`);
			return new PdfAnnotationStore(context, log, undefined, undefined);
		}
	}

	private async _migrateLegacyAnnotations(): Promise<void> {
		const legacy = this.context.workspaceState.get<PdfAnnotation[]>(LEGACY_ANNOTATIONS_KEY);
		if (!Array.isArray(legacy) || legacy.length === 0) {
			return;
		}
		for (const annotation of legacy) {
			if (annotation?.id) {
				this._annotations.set(annotation.id, annotation);
			}
		}
		if (this.dek && this.annotationsPath) {
			await this._persistAnnotations();
			await this.context.workspaceState.update(LEGACY_ANNOTATIONS_KEY, undefined);
			this.log?.(`Migrated ${legacy.length} PDF annotation(s) from workspaceState to encrypted file`);
		} else {
			this.log?.(
				`Seeded ${legacy.length} PDF annotation(s) from workspaceState into memory; deferred encrypted migration`,
			);
		}
	}

	private async _loadSignatures(): Promise<void> {
		try {
			const raw = await this.context.secrets.get(SIGNATURES_SECRETS_KEY);
			if (raw === undefined || raw === '') {
				this._signatures = [];
				return;
			}
			const parsed: unknown = JSON.parse(raw);
			if (!Array.isArray(parsed)) {
				this.log?.('PDF signatures secret was not a JSON array; treating as empty');
				this._signatures = [];
				return;
			}
			this._signatures = parsed.filter(isSavedSignature);
		} catch (error) {
			const detail = error instanceof Error ? error.message : String(error);
			this.log?.(`PDF signatures secret unparseable; treating as empty: ${detail}`);
			this._signatures = [];
		}
	}

	private async _migrateLegacySignatures(): Promise<void> {
		const legacy = this.context.workspaceState.get<SavedSignature[]>(LEGACY_SIGNATURES_KEY);
		if (!Array.isArray(legacy) || legacy.length === 0) {
			return;
		}
		const byId = new Map(this._signatures.map(s => [s.id, s]));
		let added = 0;
		for (const signature of legacy) {
			if (!isSavedSignature(signature)) {
				continue;
			}
			if (!byId.has(signature.id)) {
				byId.set(signature.id, signature);
				added++;
			}
		}
		this._signatures = Array.from(byId.values());
		await this._persistSignatures();
		await this.context.workspaceState.update(LEGACY_SIGNATURES_KEY, undefined);
		this.log?.(
			`Migrated ${added} PDF signature(s) from workspaceState into SecretStorage (${legacy.length} legacy entr${legacy.length === 1 ? 'y' : 'ies'})`,
		);
	}

	private async _persistAnnotations(): Promise<void> {
		if (!this.dek || !this.annotationsPath) {
			return;
		}
		await writeEncryptedJson(
			this.annotationsPath,
			Array.from(this._annotations.values()),
			this.dek,
		);
	}

	private async _persistSignatures(): Promise<void> {
		const serialized = JSON.stringify(this._signatures);
		const bytes = Buffer.byteLength(serialized, 'utf8');
		if (bytes > SIGNATURES_MAX_BYTES) {
			this.log?.(
				`Saved PDF signatures JSON is ${bytes} bytes (limit ${SIGNATURES_MAX_BYTES}); SecretStorage may reject or slow large values`,
			);
		}
		await this.context.secrets.store(SIGNATURES_SECRETS_KEY, serialized);
	}

	getAnnotations(pdfUri: vscode.Uri): PdfAnnotation[] {
		const uriStr = pdfUri.toString();
		return Array.from(this._annotations.values())
			.filter(a => a.pdfUri === uriStr)
			.sort((a, b) => a.createdAt - b.createdAt);
	}

	async addAnnotation(annotation: Omit<PdfAnnotation, 'id' | 'createdAt'>): Promise<PdfAnnotation> {
		const created: PdfAnnotation = {
			...annotation,
			id: randomUUID(),
			createdAt: Date.now(),
		};
		this._annotations.set(created.id, created);
		await this._persistAnnotations();
		this._onDidChange.fire(vscode.Uri.parse(created.pdfUri));
		return created;
	}

	async updateAnnotation(annotationId: string, updates: Partial<PdfAnnotation>): Promise<void> {
		const existing = this._annotations.get(annotationId);
		if (!existing) {
			return;
		}
		const updated = { ...existing, ...updates, id: annotationId };
		this._annotations.set(annotationId, updated);
		await this._persistAnnotations();
		this._onDidChange.fire(vscode.Uri.parse(updated.pdfUri));
	}

	async deleteAnnotation(annotationId: string): Promise<void> {
		const annotation = this._annotations.get(annotationId);
		if (!annotation) {
			return;
		}
		this._annotations.delete(annotationId);
		await this._persistAnnotations();
		this._onDidChange.fire(vscode.Uri.parse(annotation.pdfUri));
	}

	getLastPage(pdfUri: vscode.Uri): number {
		return this.context.workspaceState.get<number>(PAGE_PREFIX + pdfUri.toString(), 1);
	}

	async setLastPage(pdfUri: vscode.Uri, page: number): Promise<void> {
		await this.context.workspaceState.update(PAGE_PREFIX + pdfUri.toString(), page);
	}

	getSavedSignatures(): SavedSignature[] {
		return this._signatures.slice();
	}

	async saveSignature(signature: SavedSignature): Promise<void> {
		this._signatures.push(signature);
		await this._persistSignatures();
	}

	async deleteSignature(signatureId: string): Promise<void> {
		this._signatures = this._signatures.filter(s => s.id !== signatureId);
		await this._persistSignatures();
	}
}

function isSavedSignature(value: unknown): value is SavedSignature {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const candidate = value as Partial<SavedSignature>;
	return (
		typeof candidate.id === 'string' &&
		typeof candidate.dataURL === 'string' &&
		typeof candidate.createdAt === 'number'
	);
}

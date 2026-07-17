/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { randomUUID } from 'crypto';

/**
 * Annotation model matches the old workbench PDFAnnotationService
 * (`void-reference/.../pdfAnnotationService.ts`).
 *
 * Persistence: workspaceState under key `void.pdfAnnotations` (same key as the
 * 1.95-era workbench service). Values do not migrate automatically from the
 * old workbench storage namespace — key parity is for future importers / rung 14.
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

const ANNOTATIONS_KEY = 'void.pdfAnnotations';
const SIGNATURES_KEY = 'void.pdfSavedSignatures';
const PAGE_PREFIX = 'pdfViewer.lastPage.';

export class PdfAnnotationStore {
	private _annotations = new Map<string, PdfAnnotation>();
	private readonly _onDidChange = new vscode.EventEmitter<vscode.Uri>();
	readonly onDidChangeAnnotations = this._onDidChange.event;

	constructor(private readonly context: vscode.ExtensionContext) {
		this._load();
	}

	private _load(): void {
		const stored = this.context.workspaceState.get<PdfAnnotation[]>(ANNOTATIONS_KEY);
		if (Array.isArray(stored)) {
			this._annotations = new Map(stored.map(a => [a.id, a]));
		}
	}

	private async _persist(): Promise<void> {
		await this.context.workspaceState.update(
			ANNOTATIONS_KEY,
			Array.from(this._annotations.values()),
		);
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
		await this._persist();
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
		await this._persist();
		this._onDidChange.fire(vscode.Uri.parse(updated.pdfUri));
	}

	async deleteAnnotation(annotationId: string): Promise<void> {
		const annotation = this._annotations.get(annotationId);
		if (!annotation) {
			return;
		}
		this._annotations.delete(annotationId);
		await this._persist();
		this._onDidChange.fire(vscode.Uri.parse(annotation.pdfUri));
	}

	getLastPage(pdfUri: vscode.Uri): number {
		return this.context.workspaceState.get<number>(PAGE_PREFIX + pdfUri.toString(), 1);
	}

	async setLastPage(pdfUri: vscode.Uri, page: number): Promise<void> {
		await this.context.workspaceState.update(PAGE_PREFIX + pdfUri.toString(), page);
	}

	getSavedSignatures(): SavedSignature[] {
		return this.context.workspaceState.get<SavedSignature[]>(SIGNATURES_KEY, []);
	}

	async saveSignature(signature: SavedSignature): Promise<void> {
		const signatures = this.getSavedSignatures();
		signatures.push(signature);
		await this.context.workspaceState.update(SIGNATURES_KEY, signatures);
	}

	async deleteSignature(signatureId: string): Promise<void> {
		const signatures = this.getSavedSignatures().filter(s => s.id !== signatureId);
		await this.context.workspaceState.update(SIGNATURES_KEY, signatures);
	}
}

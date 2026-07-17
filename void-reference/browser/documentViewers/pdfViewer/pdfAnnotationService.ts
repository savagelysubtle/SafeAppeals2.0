/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../../base/common/lifecycle.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../../../platform/storage/common/storage.js';
import { createDecorator } from '../../../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../../../platform/instantiation/common/extensions.js';
import { Emitter, Event } from '../../../../../../base/common/event.js';
import { URI } from '../../../../../../base/common/uri.js';
import { generateUuid } from '../../../../../../base/common/uuid.js';

export interface PDFAnnotation {
	id: string;
	pdfUri: string;
	page: number;
	text: string;
	color: string; // e.g., 'yellow', 'green', 'red', 'blue'
	boundingBoxes: Array<{ page: number; x: number; y: number; width: number; height: number }>;
	note?: string; // Optional AI-generated or user note
	imageData?: string; // Base64 PNG data for signature images
	createdAt: number;
}

export interface IPDFAnnotationService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeAnnotations: Event<URI>;

	getAnnotations(pdfUri: URI): PDFAnnotation[];
	getAnnotationsForPage(pdfUri: URI, page: number): PDFAnnotation[];
	addAnnotation(annotation: Omit<PDFAnnotation, 'id' | 'createdAt'>): PDFAnnotation;
	updateAnnotation(annotationId: string, updates: Partial<PDFAnnotation>): void;
	deleteAnnotation(annotationId: string): void;
	deleteAnnotationsForPage(pdfUri: URI, page: number): void;
	clearAll(): void;
}

export const IPDFAnnotationService = createDecorator<IPDFAnnotationService>('pdfAnnotationService');

export class PDFAnnotationService extends Disposable implements IPDFAnnotationService {
	readonly _serviceBrand: undefined;

	private static readonly STORAGE_KEY = 'void.pdfAnnotations';

	private readonly _onDidChangeAnnotations = this._register(new Emitter<URI>());
	readonly onDidChangeAnnotations = this._onDidChangeAnnotations.event;

	private _annotations: Map<string, PDFAnnotation> = new Map();

	constructor(
		@IStorageService private readonly storageService: IStorageService
	) {
		super();
		this._loadAnnotations();
	}

	private _loadAnnotations(): void {
		const stored = this.storageService.get(PDFAnnotationService.STORAGE_KEY, StorageScope.WORKSPACE);
		if (stored) {
			try {
				const parsed = JSON.parse(stored) as PDFAnnotation[];
				this._annotations = new Map(parsed.map(a => [a.id, a]));
			} catch (error) {
				console.error('Failed to load PDF annotations:', error);
				this._annotations = new Map();
			}
		}
	}

	private _saveAnnotations(): void {
		const annotationsArray = Array.from(this._annotations.values());
		this.storageService.store(
			PDFAnnotationService.STORAGE_KEY,
			JSON.stringify(annotationsArray),
			StorageScope.WORKSPACE,
			StorageTarget.USER
		);
	}

	getAnnotations(pdfUri: URI): PDFAnnotation[] {
		const uriStr = pdfUri.toString();
		return Array.from(this._annotations.values())
			.filter(a => a.pdfUri === uriStr)
			.sort((a, b) => a.createdAt - b.createdAt);
	}

	getAnnotationsForPage(pdfUri: URI, page: number): PDFAnnotation[] {
		const uriStr = pdfUri.toString();
		return Array.from(this._annotations.values())
			.filter(a => a.pdfUri === uriStr && a.page === page)
			.sort((a, b) => a.createdAt - b.createdAt);
	}

	addAnnotation(annotation: Omit<PDFAnnotation, 'id' | 'createdAt'>): PDFAnnotation {
		const newAnnotation: PDFAnnotation = {
			...annotation,
			id: generateUuid(),
			createdAt: Date.now()
		};

		this._annotations.set(newAnnotation.id, newAnnotation);
		this._saveAnnotations();
		this._onDidChangeAnnotations.fire(URI.parse(newAnnotation.pdfUri));

		return newAnnotation;
	}

	updateAnnotation(annotationId: string, updates: Partial<PDFAnnotation>): void {
		const existing = this._annotations.get(annotationId);
		if (!existing) {
			return;
		}

		const updated = { ...existing, ...updates, id: annotationId }; // Preserve ID
		this._annotations.set(annotationId, updated);
		this._saveAnnotations();
		this._onDidChangeAnnotations.fire(URI.parse(updated.pdfUri));
	}

	deleteAnnotation(annotationId: string): void {
		const annotation = this._annotations.get(annotationId);
		if (!annotation) {
			return;
		}

		this._annotations.delete(annotationId);
		this._saveAnnotations();
		this._onDidChangeAnnotations.fire(URI.parse(annotation.pdfUri));
	}

	deleteAnnotationsForPage(pdfUri: URI, page: number): void {
		const uriStr = pdfUri.toString();
		let changed = false;

		for (const [id, annotation] of this._annotations.entries()) {
			if (annotation.pdfUri === uriStr && annotation.page === page) {
				this._annotations.delete(id);
				changed = true;
			}
		}

		if (changed) {
			this._saveAnnotations();
			this._onDidChangeAnnotations.fire(pdfUri);
		}
	}

	clearAll(): void {
		this._annotations.clear();
		this._saveAnnotations();
	}
}

// Register as singleton
registerSingleton(IPDFAnnotationService, PDFAnnotationService, InstantiationType.Delayed);


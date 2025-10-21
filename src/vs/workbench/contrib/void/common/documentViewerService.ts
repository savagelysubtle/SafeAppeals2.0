/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';

export const IDocumentViewerService = createDecorator<IDocumentViewerService>('documentViewerService');

export interface DocumentContentExtractor {
	/**
	 * Extract text content from entire document
	 */
	extractContent(uri: URI): Promise<string>;

	/**
	 * Extract text content from specific page range (for PDFs)
	 */
	extractContentRange?(uri: URI, startPage: number, endPage: number): Promise<string>;
}

export interface IDocumentViewerService {
	_serviceBrand: undefined;

	/**
	 * Extract text for AI (whole document)
	 */
	getTextContent(uri: URI): Promise<string | null>;

	/**
	 * Extract text for specific pages (for Ctrl+K selection)
	 */
	getTextContentRange(uri: URI, startPage: number, endPage: number): Promise<string | null>;

	/**
	 * Check if file is viewable document
	 */
	isDocumentFile(uri: URI): boolean;

	/**
	 * Register extractors for specific file extensions
	 */
	registerExtractor(extensions: string[], extractor: DocumentContentExtractor): void;
}

export class DocumentViewerService implements IDocumentViewerService {
	readonly _serviceBrand: undefined;

	private readonly extractorOfExtension = new Map<string, DocumentContentExtractor>();

	constructor() {
		// Service starts empty, extractors registered by document viewer contributions
	}

	registerExtractor(extensions: string[], extractor: DocumentContentExtractor): void {
		for (const ext of extensions) {
			this.extractorOfExtension.set(ext.toLowerCase(), extractor);
		}
	}

	isDocumentFile(uri: URI): boolean {
		const ext = this.getFileExtension(uri);
		return this.extractorOfExtension.has(ext);
	}

	async getTextContent(uri: URI): Promise<string | null> {
		const ext = this.getFileExtension(uri);
		const extractor = this.extractorOfExtension.get(ext);

		if (!extractor) {
			return null;
		}

		try {
			return await extractor.extractContent(uri);
		} catch (error) {
			console.error(`Failed to extract content from ${uri.toString()}:`, error);
			return null;
		}
	}

	async getTextContentRange(uri: URI, startPage: number, endPage: number): Promise<string | null> {
		const ext = this.getFileExtension(uri);
		const extractor = this.extractorOfExtension.get(ext);

		if (!extractor || !extractor.extractContentRange) {
			// Fallback to full content if range extraction not supported
			return await this.getTextContent(uri);
		}

		try {
			return await extractor.extractContentRange(uri, startPage, endPage);
		} catch (error) {
			console.error(`Failed to extract content range from ${uri.toString()}:`, error);
			return null;
		}
	}

	private getFileExtension(uri: URI): string {
		const path = uri.path;
		const lastDot = path.lastIndexOf('.');
		if (lastDot === -1) {
			return '';
		}
		return path.substring(lastDot + 1).toLowerCase();
	}
}

// Register as singleton
registerSingleton(IDocumentViewerService, DocumentViewerService, InstantiationType.Delayed);


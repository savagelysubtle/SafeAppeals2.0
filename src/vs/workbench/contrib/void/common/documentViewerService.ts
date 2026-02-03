/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';

export const IDocumentViewerService = createDecorator<IDocumentViewerService>('documentViewerService');

/**
 * Metadata about a document (page count, etc.)
 */
export interface DocumentMetadata {
	pageCount: number;
	title?: string;
	author?: string;
	wordCount?: number;
}

/**
 * Result of content extraction, including OCR status
 */
export interface ContentExtractionResult {
	text: string;
	wasOCR?: boolean;
	ocrLanguage?: string;
}

export interface DocumentContentExtractor {
	/**
	 * Extract text content from entire document (may be limited for large docs)
	 */
	extractContent(uri: URI): Promise<string>;

	/**
	 * Extract text content from specific page range (for PDFs)
	 */
	extractContentRange?(uri: URI, startPage: number, endPage: number): Promise<string>;

	/**
	 * Extract ALL text content from document (for chat file drops)
	 * Unlike extractContent, this extracts all pages without limitations
	 */
	extractFullContent?(uri: URI): Promise<string>;

	/**
	 * Extract ALL text content with OCR status information
	 * Returns both the text and whether OCR was used (for scanned PDFs)
	 */
	extractFullContentWithOCRInfo?(uri: URI): Promise<ContentExtractionResult>;

	/**
	 * Get document metadata (page count, etc.) without extracting full content
	 */
	getMetadata?(uri: URI): Promise<DocumentMetadata>;
}

export interface IDocumentViewerService {
	_serviceBrand: undefined;

	/**
	 * Extract text for AI (may be limited for large documents)
	 */
	getTextContent(uri: URI): Promise<string | null>;

	/**
	 * Extract ALL text for AI (used for chat file drops)
	 * This extracts complete content without page limitations
	 */
	getFullTextContent(uri: URI): Promise<string | null>;

	/**
	 * Extract ALL text with OCR status information
	 * Returns both text and whether OCR was used (for scanned PDFs)
	 */
	getFullTextContentWithOCRInfo(uri: URI): Promise<ContentExtractionResult | null>;

	/**
	 * Extract text for specific pages (for Ctrl+K selection)
	 */
	getTextContentRange(uri: URI, startPage: number, endPage: number): Promise<string | null>;

	/**
	 * Get document metadata (page count, etc.) without extracting full content
	 */
	getDocumentMetadata(uri: URI): Promise<DocumentMetadata | null>;

	/**
	 * Check if file is viewable document
	 */
	isDocumentFile(uri: URI): boolean;

	/**
	 * Check if file is a PDF document
	 */
	isPDFFile(uri: URI): boolean;

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

	isPDFFile(uri: URI): boolean {
		const ext = this.getFileExtension(uri);
		return ext === 'pdf';
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

	async getFullTextContent(uri: URI): Promise<string | null> {
		const ext = this.getFileExtension(uri);
		const extractor = this.extractorOfExtension.get(ext);

		if (!extractor) {
			return null;
		}

		try {
			// Use extractFullContent if available, otherwise fall back to extractContent
			if (extractor.extractFullContent) {
				return await extractor.extractFullContent(uri);
			}
			return await extractor.extractContent(uri);
		} catch (error) {
			console.error(`Failed to extract full content from ${uri.toString()}:`, error);
			return null;
		}
	}

	async getFullTextContentWithOCRInfo(uri: URI): Promise<ContentExtractionResult | null> {
		const ext = this.getFileExtension(uri);
		const extractor = this.extractorOfExtension.get(ext);

		if (!extractor) {
			return null;
		}

		try {
			// Use extractFullContentWithOCRInfo if available
			if (extractor.extractFullContentWithOCRInfo) {
				return await extractor.extractFullContentWithOCRInfo(uri);
			}
			// Fall back to extractFullContent without OCR info
			if (extractor.extractFullContent) {
				const text = await extractor.extractFullContent(uri);
				return { text, wasOCR: false };
			}
			// Final fallback to extractContent
			const text = await extractor.extractContent(uri);
			return { text, wasOCR: false };
		} catch (error) {
			console.error(`Failed to extract full content with OCR info from ${uri.toString()}:`, error);
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

	async getDocumentMetadata(uri: URI): Promise<DocumentMetadata | null> {
		const ext = this.getFileExtension(uri);
		const extractor = this.extractorOfExtension.get(ext);

		if (!extractor || !extractor.getMetadata) {
			return null;
		}

		try {
			return await extractor.getMetadata(uri);
		} catch (error) {
			console.error(`Failed to get metadata from ${uri.toString()}:`, error);
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


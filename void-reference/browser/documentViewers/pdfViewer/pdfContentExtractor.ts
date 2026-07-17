/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../../base/common/uri.js';
import { ContentExtractionResult, DocumentContentExtractor, DocumentMetadata } from '../../../common/documentViewerService.js';
import { IChannel } from '../../../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../../../platform/ipc/common/mainProcessService.js';

/**
 * Maximum pages to extract fully before switching to RAG-based approach
 * This prevents context window overflow for very large PDFs
 */
export const PDF_FULL_EXTRACTION_PAGE_LIMIT = 30;

/**
 * Maximum characters to extract from a PDF for chat context
 * Prevents overwhelming the context window with large documents
 */
export const PDF_MAX_CHARS_FOR_CHAT = 150_000;

/**
 * Extracts PDF text content using electron-main ragFileService via IPC
 */
export class PDFContentExtractor implements DocumentContentExtractor {
	private readonly channel: IChannel;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService
	) {
		// Get the channel for electron-main communication
		this.channel = this.mainProcessService.getChannel('void-channel-pdf-extractor');
	}

	async extractContent(uri: URI): Promise<string> {
		try {
			// Extract full PDF content for Ctrl+L (with limits to prevent context overflow)
			// This provides much better context than single-page extraction
			console.log(`[PDFContentExtractor] Ctrl+L extraction for: ${uri.fsPath}`);
			const result = await this.extractFullContentWithOCRInfo(uri);

			// Add helpful context about extraction
			const ocrNote = result.wasOCR ? ' (extracted via OCR from scanned document)' : '';
			return `[PDF Content${ocrNote}]\n\n${result.text}`;
		} catch (error) {
			console.error(`Failed to extract PDF content from ${uri.toString()}:`, error);
			throw error;
		}
	}

	async extractContentRange(uri: URI, startPage: number, endPage: number): Promise<string> {
		try {
			const result = await this.channel.call<{ text: string }>('extractPDFContent', {
				uri: uri.toString(),
				startPage,
				endPage
			});
			return result.text;
		} catch (error) {
			console.error(`Failed to extract PDF content range from ${uri.toString()}:`, error);
			throw error;
		}
	}

	/**
	 * Extract ALL pages from PDF (for chat file drops)
	 * This extracts complete content, respecting character limits to prevent context overflow
	 */
	async extractFullContent(uri: URI): Promise<string> {
		const result = await this.extractFullContentWithOCRInfo(uri);
		return result.text;
	}

	/**
	 * Extract ALL pages from PDF with OCR status information
	 * This extracts complete content and indicates if OCR was used for scanned PDFs
	 */
	async extractFullContentWithOCRInfo(uri: URI): Promise<ContentExtractionResult> {
		try {
			console.log(`[PDFContentExtractor] Extracting full content from: ${uri.fsPath}`);

			// First get metadata to know total pages
			const metadata = await this.getMetadata(uri);
			const totalPages = metadata.pageCount;

			console.log(`[PDFContentExtractor] PDF has ${totalPages} pages`);

			// For very large PDFs, extract in chunks to manage memory
			if (totalPages > PDF_FULL_EXTRACTION_PAGE_LIMIT) {
				console.log(`[PDFContentExtractor] Large PDF detected (${totalPages} pages). Extracting first ${PDF_FULL_EXTRACTION_PAGE_LIMIT} pages.`);
				// Extract first N pages for very large documents
				const result = await this.channel.call<{ text: string; wasOCR?: boolean; ocrLanguage?: string }>('extractPDFContent', {
					uri: uri.toString(),
					startPage: 1,
					endPage: PDF_FULL_EXTRACTION_PAGE_LIMIT
				});

				let text = result.text;

				// Truncate if still too large
				if (text.length > PDF_MAX_CHARS_FOR_CHAT) {
					text = text.substring(0, PDF_MAX_CHARS_FOR_CHAT);
					text += `\n\n[Content truncated - document has ${totalPages} pages, showing first ${PDF_FULL_EXTRACTION_PAGE_LIMIT} pages, limited to ${(PDF_MAX_CHARS_FOR_CHAT / 1000).toFixed(0)}k characters]`;
				} else {
					text += `\n\n[Showing first ${PDF_FULL_EXTRACTION_PAGE_LIMIT} of ${totalPages} pages. Use read_file tool with page numbers to access remaining content.]`;
				}

				return {
					text,
					wasOCR: result.wasOCR,
					ocrLanguage: result.ocrLanguage
				};
			}

			// For smaller PDFs, extract all pages
			const result = await this.channel.call<{ text: string; wasOCR?: boolean; ocrLanguage?: string }>('extractPDFContent', {
				uri: uri.toString(),
				allPages: true
			});

			let text = result.text;

			// Apply character limit
			if (text.length > PDF_MAX_CHARS_FOR_CHAT) {
				text = text.substring(0, PDF_MAX_CHARS_FOR_CHAT);
				text += `\n\n[Content truncated - limited to ${(PDF_MAX_CHARS_FOR_CHAT / 1000).toFixed(0)}k characters]`;
			}

			console.log(`[PDFContentExtractor] Extracted ${text.length} characters from ${totalPages} pages${result.wasOCR ? ' (via OCR)' : ''}`);
			return {
				text,
				wasOCR: result.wasOCR,
				ocrLanguage: result.ocrLanguage
			};
		} catch (error) {
			console.error(`Failed to extract full PDF content from ${uri.toString()}:`, error);
			throw error;
		}
	}

	/**
	 * Get PDF metadata (page count, title, author) without extracting full content
	 * Uses a quick extraction of just the first page to get metadata
	 */
	async getMetadata(uri: URI): Promise<DocumentMetadata> {
		try {
			// Extract first page to get metadata (page count is included in response)
			const result = await this.channel.call<{ text: string; pageCount?: number; title?: string; author?: string }>('extractPDFContent', {
				uri: uri.toString(),
				startPage: 1,
				endPage: 1
			});

			// If the channel doesn't return pageCount, estimate from text length
			// This is a fallback - the actual implementation should return pageCount
			const pageCount = result.pageCount ?? 1;

			return {
				pageCount,
				title: result.title,
				author: result.author,
				wordCount: result.text.split(/\s+/).length
			};
		} catch (error) {
			console.error(`Failed to get PDF metadata from ${uri.toString()}:`, error);
			// Return minimal metadata on error
			return { pageCount: 1 };
		}
	}
}


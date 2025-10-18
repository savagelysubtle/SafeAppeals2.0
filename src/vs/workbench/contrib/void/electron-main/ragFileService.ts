/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ExtractedContent } from '../common/ragServiceTypes.js';
import { readFileSync } from 'fs';
import { normalize } from 'path';

export class RAGFileService {
	constructor(@ILogService private readonly logService: ILogService) { }

	async extractContent(uri: URI): Promise<ExtractedContent> {
		const filepath = this.getFilePath(uri);
		this.logService.info(`Extracting content from: ${filepath}`);

		const fileExt = filepath.split('.').pop()?.toLowerCase() || '';

		try {
			switch (fileExt) {
				case 'pdf':
					return await this.extractPDF(uri);
				case 'docx':
					return await this.extractDOCX(uri);
				case 'txt':
				case 'md':
					return await this.extractText(uri);
				case 'rtf':
					throw new Error('RTF format not supported yet. Please convert to TXT or DOCX.');
				case 'odt':
					throw new Error('ODT format not supported yet. Please convert to DOCX.');
				default:
					throw new Error(`Unsupported file format: ${fileExt}`);
			}
		} catch (error) {
			this.logService.error(`Failed to extract content from ${filepath}:`, error);
			throw error;
		}
	}

	/**
	 * Safely get the file system path from a URI, handling Windows paths correctly
	 */
	private getFilePath(uri: URI): string {
		this.logService.info('URI Debug:', {
			scheme: uri.scheme,
			authority: uri.authority,
			path: uri.path,
			fsPath: uri.fsPath,
			toString: uri.toString()
		});

		// Try fsPath first (handles Windows drive letters correctly)
		if (uri.fsPath) {
			const normalized = normalize(uri.fsPath);
			this.logService.info(`Normalized path: ${uri.fsPath} -> ${normalized}`);
			return normalized;
		}
		// Fallback to path
		if (uri.path) {
			const normalized = normalize(uri.path);
			this.logService.info(`Normalized path from uri.path: ${uri.path} -> ${normalized}`);
			return normalized;
		}
		throw new Error('Invalid URI: no path available');
	}

	private async extractPDF(uri: URI): Promise<ExtractedContent> {
		let pdf: any = null;
		let loadingTask: any = null;

		try {
			// Dynamic import for pdfjs-dist (works in Node.js ESM environment)
			// @ts-ignore - pdfjs-dist mjs build doesn't have type definitions
			const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');

			const filepath = this.getFilePath(uri);

			// Memory optimization: Use file path instead of loading entire file into memory
			loadingTask = pdfjsLib.getDocument({
				url: filepath,
				useSystemFonts: true,
				verbosity: 0, // Suppress warnings
				maxImageSize: 1024 * 1024, // Limit image size to 1MB
				disableFontFace: true, // Don't load fonts (we only need text)
				cMapPacked: true
			});

			pdf = await loadingTask.promise;
			const totalPages = pdf.numPages;

			this.logService.info(`PDF has ${totalPages} pages. Starting extraction...`);

			const metadata: ExtractedContent['metadata'] = {
				title: '',
				author: '',
				pageCount: totalPages,
				wordCount: 0,
				language: 'unknown'
			};

			// Use array and join instead of string concatenation for better memory
			const textParts: string[] = [];
			const BATCH_SIZE = 10; // Process pages in batches to avoid memory buildup

			// Extract text from pages in batches
			for (let batch = 0; batch < totalPages; batch += BATCH_SIZE) {
				const batchEnd = Math.min(batch + BATCH_SIZE, totalPages);
				this.logService.info(`Processing pages ${batch + 1} to ${batchEnd}...`);

				for (let pageNum = batch + 1; pageNum <= batchEnd; pageNum++) {
					let page: any = null;
					try {
						page = await pdf.getPage(pageNum);
						const textContent = await page.getTextContent();

						// Extract text with better memory management
						const pageText = textContent.items
							.map((item: any) => item.str || '')
							.filter((str: string) => str.trim().length > 0)
							.join(' ');

						if (pageText.trim()) {
							textParts.push(pageText);
						}

						// Cleanup page resources
						page.cleanup();
					} finally {
						page = null; // Help GC
					}
				}

				// Force garbage collection hint after each batch
				if (global.gc) {
					global.gc();
				}
			}

			// Extract metadata if available
			try {
				const pdfMetadata = await pdf.getMetadata();
				if (pdfMetadata?.info) {
					metadata.title = pdfMetadata.info.Title || '';
					metadata.author = pdfMetadata.info.Author || '';
				}
			} catch (metaError) {
				this.logService.warn('Could not extract PDF metadata:', metaError);
			}

			// Join all text parts
			const fullText = textParts.join('\n\n');

			// Calculate word count and detect language
			metadata.wordCount = this.countWords(fullText);
			metadata.language = this.detectLanguage(fullText);

			this.logService.info(`PDF extraction complete: ${fullText.length} characters, ${metadata.wordCount} words`);

			return {
				text: fullText.trim(),
				metadata
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logService.error('Failed to extract PDF:', error);
			throw new Error(`Failed to extract PDF content: ${errorMsg}`);
		} finally {
			// Cleanup PDF resources
			try {
				if (pdf) {
					await pdf.destroy();
				}
				if (loadingTask) {
					loadingTask.destroy();
				}
			} catch (cleanupError) {
				this.logService.warn('Error during PDF cleanup:', cleanupError);
			}

			// Help garbage collector
			pdf = null;
			loadingTask = null;

			if (global.gc) {
				global.gc();
			}
		}
	}

	private async extractDOCX(uri: URI): Promise<ExtractedContent> {
		try {
			// Dynamic import to avoid bundling issues
			const mammoth = await import('mammoth');

			const filepath = this.getFilePath(uri);
			const buffer = readFileSync(filepath);
			const result = await mammoth.extractRawText({ buffer });

			const metadata: ExtractedContent['metadata'] = {
				wordCount: this.countWords(result.value),
				language: this.detectLanguage(result.value)
			};

			// Extract additional metadata if available
			if (result.messages && result.messages.length > 0) {
				this.logService.info(`DOCX extraction messages for ${uri.fsPath}:`, result.messages);
			}

			return {
				text: result.value.trim(),
				metadata
			};
		} catch (error) {
			this.logService.error(`DOCX extraction failed for ${uri.fsPath}:`, error);
			throw new Error(`Failed to extract DOCX content: ${error.message}`);
		}
	}

	private async extractText(uri: URI): Promise<ExtractedContent> {
		try {
			const filepath = this.getFilePath(uri);
			const content = readFileSync(filepath, 'utf-8');

			const metadata: ExtractedContent['metadata'] = {
				wordCount: this.countWords(content),
				language: this.detectLanguage(content)
			};

			return {
				text: content.trim(),
				metadata
			};
		} catch (error) {
			this.logService.error(`Text extraction failed for ${uri.fsPath}:`, error);
			throw new Error(`Failed to extract text content: ${error.message}`);
		}
	}

	private countWords(text: string): number {
		// Simple word count - split by whitespace and filter empty strings
		return text.split(/\s+/).filter(word => word.length > 0).length;
	}

	private detectLanguage(text: string): string {
		// Simple language detection based on common words
		// This is a basic implementation - could be improved with a proper language detection library

		const englishWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
		const spanishWords = ['el', 'la', 'de', 'que', 'y', 'a', 'en', 'un', 'es', 'se', 'no', 'te', 'lo', 'le'];
		const frenchWords = ['le', 'de', 'et', 'à', 'un', 'il', 'être', 'et', 'en', 'avoir', 'que', 'pour'];

		const words = text.toLowerCase().split(/\s+/);
		const sampleSize = Math.min(100, words.length);
		const sample = words.slice(0, sampleSize);

		let englishCount = 0;
		let spanishCount = 0;
		let frenchCount = 0;

		for (const word of sample) {
			if (englishWords.includes(word)) englishCount++;
			if (spanishWords.includes(word)) spanishCount++;
			if (frenchWords.includes(word)) frenchCount++;
		}

		if (spanishCount > englishCount && spanishCount > frenchCount) return 'es';
		if (frenchCount > englishCount && frenchCount > spanishCount) return 'fr';
		return 'en'; // Default to English
	}
}

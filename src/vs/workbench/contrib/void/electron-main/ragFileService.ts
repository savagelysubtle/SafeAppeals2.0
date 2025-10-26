/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { readFileSync } from 'fs';
import { normalize } from 'path';
import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { ExtractedContent } from '../common/ragServiceTypes.js';

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
				case 'xlsx':
				case 'xls':
					return await this.extractXLSX(uri);
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
		return await this.extractPDFPages(uri);
	}

	/**
	 * Extract PDF pages with optional page range support
	 * @param uri The URI of the PDF file
	 * @param startPage Optional start page (1-indexed), defaults to 1
	 * @param endPage Optional end page (1-indexed), defaults to last page
	 */
	async extractPDFPages(uri: URI, startPage?: number, endPage?: number): Promise<ExtractedContent> {
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

			// Determine page range
			const firstPage = Math.max(1, startPage || 1);
			const lastPage = Math.min(totalPages, endPage || totalPages);

			this.logService.info(`PDF has ${totalPages} pages. Extracting pages ${firstPage} to ${lastPage}...`);

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
			for (let batch = firstPage; batch <= lastPage; batch += BATCH_SIZE) {
				const batchEnd = Math.min(batch + BATCH_SIZE - 1, lastPage);
				this.logService.info(`Processing pages ${batch} to ${batchEnd}...`);

				for (let pageNum = batch; pageNum <= batchEnd; pageNum++) {
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

			// Extract metadata if available (only for full document extraction)
			if (!startPage && !endPage) {
				try {
					const pdfMetadata = await pdf.getMetadata();
					if (pdfMetadata?.info) {
						metadata.title = pdfMetadata.info.Title || '';
						metadata.author = pdfMetadata.info.Author || '';
					}
				} catch (metaError) {
					this.logService.warn('Could not extract PDF metadata:', metaError);
				}
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

			// Check if file is empty or too small to be a valid DOCX
			if (buffer.length === 0) {
				this.logService.warn(`DOCX file is empty: ${uri.fsPath}`);
				return {
					text: '[Empty DOCX file - file contains no data]',
					metadata: { wordCount: 0 }
				};
			}

			if (buffer.length < 100) {
				this.logService.warn(`DOCX file may be corrupted (too small): ${uri.fsPath}`);
				return {
					text: '[Corrupted or incomplete DOCX file - file is too small to be valid]',
					metadata: { wordCount: 0 }
				};
			}

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
			// Return a helpful error message instead of throwing
			return {
				text: `[Error reading DOCX file: ${error.message}. The file may be corrupted or was not created properly.]`,
				metadata: { wordCount: 0 }
			};
		}
	}

	private async extractXLSX(uri: URI): Promise<ExtractedContent> {
		try {
			// Dynamic import to avoid bundling issues
			const XLSX = await import('xlsx');

			const filepath = this.getFilePath(uri);
			const buffer = readFileSync(filepath);

			// Parse workbook
			const workbook = XLSX.read(buffer, { type: 'buffer' });

			// Extract text from all sheets
			const textParts: string[] = [];
			workbook.SheetNames.forEach((sheetName) => {
				textParts.push(`\n=== Sheet: ${sheetName} ===\n`);
				const worksheet = workbook.Sheets[sheetName];

				// Convert sheet to CSV-like text
				const csv = XLSX.utils.sheet_to_csv(worksheet);
				textParts.push(csv);
			});

			const fullText = textParts.join('\n');

			const metadata: ExtractedContent['metadata'] = {
				wordCount: this.countWords(fullText),
				language: 'unknown', // Spreadsheets don't have a primary language
				title: workbook.Props?.Title || '',
				author: workbook.Props?.Author || ''
			};

			return {
				text: fullText.trim(),
				metadata
			};
		} catch (error) {
			this.logService.error(`XLSX extraction failed for ${uri.fsPath}:`, error);
			throw new Error(`Failed to extract XLSX content: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

	/**
	 * Create an empty but valid DOCX file
	 */
	async createEmptyDOCX(uri: URI): Promise<void> {
		try {
			const { Document, Packer, Paragraph } = await import('docx');
			const { writeFileSync } = await import('fs');

			// Create a minimal valid DOCX document
			// Based on docx 9.5.1 documentation: sections must have children array,
			// and Paragraph must have children array (even if empty)
			const doc = new Document({
				sections: [{
					properties: {},
					children: [
						new Paragraph({
							children: [], // Empty children array is the correct minimal structure
						})
					]
				}]
			});

			// Generate buffer and validate it
			this.logService.info('[createEmptyDOCX] Starting Packer.toBuffer()...');
			const buffer = await Packer.toBuffer(doc);

			// Verify buffer integrity
			this.logService.info(`[createEmptyDOCX] Buffer created - Type: ${buffer.constructor.name}, Size: ${buffer.length} bytes`);
			this.logService.info(`[createEmptyDOCX] Is Buffer? ${Buffer.isBuffer(buffer)}`);

			// Check for valid ZIP signature (first 4 bytes should be 50 4B 03 04)
			if (buffer.length >= 4) {
				const zipSignature = buffer.slice(0, 4);
				const isValidZip = zipSignature[0] === 0x50 && zipSignature[1] === 0x4B;
				this.logService.info(`[createEmptyDOCX] Valid ZIP signature: ${isValidZip} (${Array.from(zipSignature.slice(0, 4)).map(b => '0x' + b.toString(16).toUpperCase()).join(' ')})`);

				if (!isValidZip) {
					throw new Error(`Invalid ZIP signature in buffer. Expected 0x50 0x4B, got ${Array.from(zipSignature.slice(0, 2)).map(b => '0x' + b.toString(16)).join(' ')}`);
				}
			} else {
				throw new Error(`Buffer too small: ${buffer.length} bytes. Expected minimum 1200 bytes for valid DOCX.`);
			}

			// Expected size range: 1200-2000 bytes for minimal empty DOCX
			if (buffer.length < 1000) {
				this.logService.warn(`[createEmptyDOCX] Buffer size (${buffer.length} bytes) is smaller than expected (1200-2000 bytes). File may be incomplete.`);
			}

			// Write to disk
			const filepath = this.getFilePath(uri);
			this.logService.info(`[createEmptyDOCX] Writing ${buffer.length} bytes to: ${filepath}`);
			writeFileSync(filepath, buffer);

			// Verify file was written correctly
			const { statSync } = await import('fs');
			const stats = statSync(filepath);
			this.logService.info(`[createEmptyDOCX] File written successfully. Disk size: ${stats.size} bytes`);

			if (stats.size !== buffer.length) {
				throw new Error(`File size mismatch! Buffer: ${buffer.length} bytes, Disk: ${stats.size} bytes`);
			}

			if (stats.size === 0) {
				throw new Error(`Created file is 0 bytes! This indicates a writeFileSync failure.`);
			}

			this.logService.info(`[createEmptyDOCX] ✅ Successfully created valid DOCX file: ${filepath} (${stats.size} bytes)`);
		} catch (error) {
			this.logService.error(`[createEmptyDOCX] ❌ Failed to create empty DOCX file:`, error);
			throw new Error(`Failed to create DOCX file: ${error.message}`);
		}
	}

	/**
	 * Create an empty but valid XLSX file
	 */
	async createEmptyXLSX(uri: URI): Promise<void> {
		try {
			const XLSX = await import('xlsx');
			const { writeFileSync } = await import('fs');

			// Create a minimal valid XLSX workbook
			const workbook = XLSX.utils.book_new();
			const worksheet = XLSX.utils.aoa_to_sheet([[]]); // Empty sheet
			XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

			// Write the XLSX
			const filepath = this.getFilePath(uri);
			const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
			writeFileSync(filepath, buffer);

			this.logService.info(`Created empty XLSX file: ${filepath}`);
		} catch (error) {
			this.logService.error(`Failed to create empty XLSX file:`, error);
			throw new Error(`Failed to create XLSX file: ${error.message}`);
		}
	}
}

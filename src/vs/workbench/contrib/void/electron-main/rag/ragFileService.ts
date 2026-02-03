/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createHash } from 'crypto';
import { readFileSync, statSync } from 'fs';
import { normalize } from 'path';
import * as os from 'os';
import * as path from 'path';
import { URI } from '../../../../../base/common/uri.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { ExtractedContent, OCRCacheEntry } from '../../common/rag/ragServiceTypes.js';
import { RAGIndexService } from './ragIndexService.js';
import { FileConverterMainService } from '../fileConverterChannel.js';

// Threshold for detecting scanned PDFs (characters per page)
const SCANNED_PDF_THRESHOLD = 50;

export class RAGFileService {
	public useDoclingForPdf = true; // Use Docling by default for enhanced PDF extraction
	public useHybridPdfExtraction = true; // Use hybrid extraction (PDF.js metadata + Docling content)

	// OCR settings
	public enableAutoOCR = true;           // Enable automatic OCR for scanned PDFs
	public ocrLanguage = 'eng';            // OCR language (Tesseract language code)
	public ocrScannedThreshold = SCANNED_PDF_THRESHOLD; // Chars/page threshold for scanned detection

	// Optional dependencies for OCR
	private indexService: RAGIndexService | null = null;
	private fileConverter: FileConverterMainService | null = null;

	constructor(@ILogService private readonly logService: ILogService) { }

	/**
	 * Set the file converter service for OCR
	 * This is a global service, not workspace-specific
	 */
	setFileConverter(fileConverter: FileConverterMainService): void {
		this.fileConverter = fileConverter;
		this.logService.info('[RAGFileService] File converter set for OCR support');
	}

	/**
	 * Set the current workspace's index service for OCR caching
	 * This is workspace-specific and changes when workspace switches
	 */
	setIndexService(indexService: RAGIndexService | null): void {
		this.indexService = indexService;
		if (indexService) {
			this.logService.info('[RAGFileService] Index service set for OCR caching');
		}
	}

	/**
	 * Check if a PDF appears to be scanned (image-based) rather than text-based
	 * @param text Extracted text content
	 * @param pageCount Number of pages in the document
	 * @returns True if the PDF appears to be scanned
	 */
	private isScannedPDF(text: string, pageCount: number): boolean {
		if (!pageCount || pageCount === 0) return false;

		const charsPerPage = text.length / pageCount;
		const isScanned = charsPerPage < this.ocrScannedThreshold;

		if (isScanned) {
			this.logService.info(`[PDF] Scanned PDF detected: ${charsPerPage.toFixed(1)} chars/page (threshold: ${this.ocrScannedThreshold})`);
		}

		return isScanned;
	}

	/**
	 * Calculate SHA256 hash of file content for OCR cache key
	 */
	private calculateFileHash(filepath: string): string {
		const content = readFileSync(filepath);
		return createHash('sha256').update(content).digest('hex');
	}

	/**
	 * Extract text from a scanned PDF using OCR
	 * This method:
	 * 1. Checks the OCR cache for existing results
	 * 2. If not cached, converts PDF pages to images
	 * 3. Runs OCR on each image
	 * 4. Combines and caches the result
	 *
	 * @param uri The URI of the PDF file
	 * @param filepath The filesystem path to the PDF
	 * @param pageCount Number of pages in the PDF
	 * @returns ExtractedContent with OCR text, or null if OCR failed
	 */
	async extractWithOCR(uri: URI, filepath: string, pageCount: number): Promise<ExtractedContent | null> {
		// Check if file converter is available (required for OCR)
		if (!this.fileConverter) {
			this.logService.warn('[OCR] File converter not set - skipping OCR extraction');
			return null;
		}

		const startTime = Date.now();
		this.logService.info(`[OCR] ========== OCR EXTRACTION START ==========`);
		this.logService.info(`[OCR] File: ${filepath}`);
		this.logService.info(`[OCR] Pages: ${pageCount}`);
		this.logService.info(`[OCR] Language: ${this.ocrLanguage}`);
		this.logService.info(`[OCR] Caching: ${this.indexService ? 'enabled' : 'disabled (no workspace context)'}`);

		try {
			// Step 1: Calculate file hash and check cache (if indexService available)
			const fileHash = this.calculateFileHash(filepath);
			this.logService.info(`[OCR] File hash: ${fileHash.substring(0, 16)}...`);

			// Check cache only if indexService is available
			if (this.indexService) {
				const cachedResult = await this.indexService.getOCRCache(fileHash);
				if (cachedResult) {
					// Only use cache if it has actual content (skip empty/failed OCR results)
					if (cachedResult.ocrText.length > 0) {
						this.logService.info(`[OCR] Cache HIT - returning cached OCR text (${cachedResult.ocrText.length} chars)`);
						return {
							text: cachedResult.ocrText,
							metadata: {
								pageCount: cachedResult.pageCount,
								wordCount: this.countWords(cachedResult.ocrText),
								language: cachedResult.language
							},
							wasOCR: true,
							ocrLanguage: cachedResult.language
						};
					} else {
						this.logService.info(`[OCR] Cache contains empty result - re-running OCR`);
						// Delete the bad cache entry
						await this.indexService.invalidateOCRCache(fileHash);
					}
				}
			}

			this.logService.info(`[OCR] Cache MISS - performing OCR extraction`);

			// Step 2: Create temp directory for image files
			const tempDir = path.join(os.tmpdir(), `ocr-${fileHash.substring(0, 8)}`);
			const fs = await import('fs');
			if (!fs.existsSync(tempDir)) {
				fs.mkdirSync(tempDir, { recursive: true });
			}
			this.logService.info(`[OCR] Temp directory: ${tempDir}`);

			// Step 3: Convert PDF to images using Python converter
			// Pass the temp directory - Python will create page_001.png, page_002.png, etc. inside it
			this.logService.info(`[OCR] Converting PDF to images...`);

			const pdf2imagesResult = await this.fileConverter.convert(
				filepath,
				tempDir,  // Pass directory, not pattern - Python handles naming
				'pdf2images',
				{ dpi: 300, format: 'png', output_prefix: 'page' }
			);

			if (!pdf2imagesResult.success) {
				this.logService.error(`[OCR] PDF to images conversion failed: ${pdf2imagesResult.error}`);
				// Clean up temp directory
				this.cleanupTempDir(tempDir);
				return null;
			}

			this.logService.info(`[OCR] PDF converted to images successfully`);

			// Step 4: Find all generated image files
			// Python creates files like page_001.png, page_002.png in the temp directory
			const imageFiles = fs.readdirSync(tempDir)
				.filter((f: string) => f.endsWith('.png') && !fs.statSync(path.join(tempDir, f)).isDirectory())
				.sort()
				.map((f: string) => path.join(tempDir, f));

			this.logService.info(`[OCR] Found ${imageFiles.length} page images`);

			// Step 5: OCR each image
			const ocrTexts: string[] = [];
			for (let i = 0; i < imageFiles.length; i++) {
				const imageFile = imageFiles[i];
				const outputTextFile = imageFile.replace('.png', '.txt');

				this.logService.info(`[OCR] Processing page ${i + 1}/${imageFiles.length}...`);

				const ocrResult = await this.fileConverter.convert(
					imageFile,
					outputTextFile,
					'image2text',
					{ language: this.ocrLanguage }
				);

				if (ocrResult.success && fs.existsSync(outputTextFile)) {
					const pageText = fs.readFileSync(outputTextFile, 'utf-8');
					ocrTexts.push(pageText.trim());
					this.logService.info(`[OCR] Page ${i + 1}: ${pageText.length} chars extracted`);
				} else {
					this.logService.warn(`[OCR] Page ${i + 1} OCR failed: ${ocrResult.error}`);
					ocrTexts.push(''); // Empty placeholder for failed page
				}
			}

			// Step 6: Combine OCR results
			const fullOcrText = ocrTexts.join('\n\n--- Page Break ---\n\n');
			this.logService.info(`[OCR] Total OCR text: ${fullOcrText.length} chars`);

			// Step 7: Cache the result (if indexService available and result has content)
			if (this.indexService) {
				if (fullOcrText.length > 0) {
					const fileStats = statSync(filepath);
					const cacheEntry: OCRCacheEntry = {
						id: fileHash,
						filepath: filepath,
						ocrText: fullOcrText,
						pageCount: imageFiles.length,
						language: this.ocrLanguage,
						createdAt: new Date().toISOString(),
						fileModifiedAt: fileStats.mtime.toISOString()
					};

					await this.indexService.setOCRCache(cacheEntry);
					this.logService.info(`[OCR] Result cached successfully`);
				} else {
					this.logService.info(`[OCR] Skipping cache (empty OCR result - may indicate OCR failure)`);
				}
			} else {
				this.logService.info(`[OCR] Skipping cache (no workspace context)`);
			}

			// Step 8: Clean up temp directory
			this.cleanupTempDir(tempDir);

			const totalTime = Date.now() - startTime;
			this.logService.info(`[OCR] ========== OCR EXTRACTION COMPLETE ==========`);
			this.logService.info(`[OCR] Total time: ${totalTime}ms (${(totalTime / 1000 / imageFiles.length).toFixed(2)}s per page)`);
			this.logService.info(`[OCR] Characters extracted: ${fullOcrText.length.toLocaleString()}`);

			return {
				text: fullOcrText,
				metadata: {
					pageCount: imageFiles.length,
					wordCount: this.countWords(fullOcrText),
					language: this.ocrLanguage
				},
				wasOCR: true,
				ocrLanguage: this.ocrLanguage
			};

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logService.error(`[OCR] OCR extraction failed: ${errorMsg}`);
			this.logService.error('[OCR] Error details:', error);
			return null;
		}
	}

	/**
	 * Clean up temporary directory used for OCR
	 */
	private async cleanupTempDir(tempDir: string): Promise<void> {
		try {
			const fs = await import('fs');
			if (fs.existsSync(tempDir)) {
				const files = fs.readdirSync(tempDir);
				for (const file of files) {
					fs.unlinkSync(path.join(tempDir, file));
				}
				fs.rmdirSync(tempDir);
				this.logService.info(`[OCR] Cleaned up temp directory: ${tempDir}`);
			}
		} catch (error) {
			this.logService.warn(`[OCR] Failed to cleanup temp directory ${tempDir}:`, error);
		}
	}

	async extractContent(uri: URI): Promise<ExtractedContent> {
		const filepath = this.getFilePath(uri);
		this.logService.info(`Extracting content from: ${filepath}`);

		const fileExt = filepath.split('.').pop()?.toLowerCase() || '';

		try {
			switch (fileExt) {
				case 'pdf':
					if (this.useDoclingForPdf && this.useHybridPdfExtraction) {
						this.logService.info('[PDF Extraction] Using hybrid extraction (PDF.js metadata + Docling content)');
						return await this.extractPdfHybrid(uri);
					} else if (this.useDoclingForPdf) {
						this.logService.info('[PDF Extraction] Using Docling SDK for enhanced extraction');
						return await this.extractPdfWithDocling(uri);
					} else {
						this.logService.info('[PDF Extraction] Using standard pdfjs-dist extraction');
						return await this.extractPDF(uri);
					}
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
		// Validate that we received a valid URI object
		if (!uri) {
			throw new Error('Invalid URI: URI is null or undefined');
		}

		this.logService.info('[getFilePath] URI Debug:', {
			scheme: uri.scheme,
			authority: uri.authority,
			path: uri.path,
			fsPath: uri.fsPath,
			toString: uri.toString()
		});

		// Try fsPath first (handles Windows drive letters correctly)
		if (uri.fsPath) {
			const normalized = normalize(uri.fsPath);
			this.logService.info(`[getFilePath] Normalized path from fsPath: ${uri.fsPath} -> ${normalized}`);
			return normalized;
		}

		// Fallback: manually construct Windows path from URI.path
		// For URIs like file:///d%3A/path or file:///d:/path
		if (uri.path && uri.scheme === 'file') {
			let decodedPath = decodeURIComponent(uri.path);

			// Handle Windows paths: /d:/path/to/file -> d:\path\to\file
			// or /D:/path -> D:\path
			const windowsPathMatch = decodedPath.match(/^\/([a-zA-Z]:)(\/.*)/);
			if (windowsPathMatch) {
				// Extract drive letter and rest of path
				const driveLetter = windowsPathMatch[1]; // e.g., "d:" or "D:"
				const restOfPath = windowsPathMatch[2];  // e.g., "/Coding/test3"

				// Convert forward slashes to backslashes
				const windowsPath = driveLetter + restOfPath.replace(/\//g, '\\');
				const normalized = normalize(windowsPath);
				this.logService.info(`[getFilePath] Converted Windows path: ${decodedPath} -> ${windowsPath} -> ${normalized}`);
				return normalized;
			}

			// For non-Windows paths or if regex didn't match, just normalize
			const normalized = normalize(decodedPath);
			this.logService.info(`[getFilePath] Normalized path from uri.path: ${uri.path} -> ${decodedPath} -> ${normalized}`);
			return normalized;
		}

		// If we reach here, the URI is invalid
		throw new Error(`Invalid URI: no valid path available. URI details: ${JSON.stringify({
			scheme: uri.scheme,
			authority: uri.authority,
			path: uri.path,
			fsPath: uri.fsPath,
			toString: uri.toString()
		})}`);
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

		// Start timing
		const startTime = Date.now();

		try {
			// Dynamic import for pdfjs-dist (works in Node.js ESM environment)
			// @ts-ignore - pdfjs-dist mjs build doesn't have type definitions
			const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');

			const filepath = this.getFilePath(uri);

			this.logService.info(`[PDF.js] ========== STANDARD EXTRACTION START ==========`);
			this.logService.info(`[PDF.js] File: ${filepath}`);

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

			this.logService.info(`[PDF.js] PDF has ${totalPages} pages. Extracting pages ${firstPage} to ${lastPage}...`);

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
			const charCount = fullText.length;

			// Calculate word count and detect language
			metadata.wordCount = this.countWords(fullText);
			metadata.language = this.detectLanguage(fullText);

			// Calculate total extraction time
			const totalTime = Date.now() - startTime;

			// Log extraction summary
			this.logService.info(`[PDF.js] ========== EXTRACTION SUMMARY ==========`);
			this.logService.info(`[PDF.js] Total extraction time: ${totalTime.toLocaleString()}ms`);
			this.logService.info(`[PDF.js] Characters extracted: ${charCount.toLocaleString()}`);
			this.logService.info(`[PDF.js] Words extracted: ${metadata.wordCount.toLocaleString()}`);
			this.logService.info(`[PDF.js] Pages processed: ${metadata.pageCount}`);
			this.logService.info(`[PDF.js] Characters per second: ${Math.round(charCount / (totalTime / 1000)).toLocaleString()}`);

			// Check if this appears to be a scanned PDF
			if (this.enableAutoOCR && this.isScannedPDF(fullText, metadata.pageCount || 1)) {
				this.logService.info(`[PDF.js] Scanned PDF detected - attempting OCR extraction`);

				// Try OCR extraction
				const ocrResult = await this.extractWithOCR(uri, filepath, metadata.pageCount || 1);
				if (ocrResult) {
					this.logService.info(`[PDF.js] OCR extraction successful - using OCR text`);
					return ocrResult;
				} else {
					this.logService.warn(`[PDF.js] OCR extraction failed - using sparse text extraction`);
				}
			}

			this.logService.info(`[PDF.js] ========== STANDARD EXTRACTION COMPLETE ==========`);

			return {
				text: fullText.trim(),
				metadata
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			const totalTime = Date.now() - startTime;
			this.logService.error(`[PDF.js] ========== EXTRACTION FAILED ==========`);
			this.logService.error(`[PDF.js] Failed after ${totalTime}ms`);
			this.logService.error('[PDF.js] Error details:', error);
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

	/**
	 * Hybrid PDF extraction: combines PDF.js metadata with Docling content
	 * - Uses PDF.js for fast metadata extraction (title, author, dates, page count)
	 * - Uses Docling for ML-powered content extraction (tables, multi-column, layout)
	 * - Falls back to PDF.js-only extraction if Docling fails
	 */
	async extractPdfHybrid(uri: URI): Promise<ExtractedContent> {
		const startTime = Date.now();

		this.logService.info(`[Hybrid PDF] ========== HYBRID EXTRACTION START ==========`);
		this.logService.info(`[Hybrid PDF] Strategy: PDF.js metadata + Docling content`);

		try {
			// Step 1: Extract metadata with PDF.js (fast, reliable)
			this.logService.info('[Hybrid PDF] Step 1/2: Extracting metadata with PDF.js...');
			const metadataStartTime = Date.now();

			// @ts-ignore - pdfjs-dist mjs build doesn't have type definitions
			const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');
			const filepath = this.getFilePath(uri);

			const loadingTask = pdfjsLib.getDocument({
				url: filepath,
				useSystemFonts: true,
				verbosity: 0,
				maxImageSize: 1024 * 1024,
				disableFontFace: true,
				cMapPacked: true
			});

			const pdf = await loadingTask.promise;
			const pdfMetadata = await pdf.getMetadata().catch(() => ({ info: {}, metadata: null }));

			// Extract rich metadata from PDF.js
			const metadata: ExtractedContent['metadata'] = {
				title: pdfMetadata.info?.Title || '',
				author: pdfMetadata.info?.Author || '',
				pageCount: pdf.numPages,
				wordCount: 0, // Will be updated from Docling content
				language: 'en' // Will be detected from Docling content
			};

			// Store additional PDF.js metadata for logging (not in interface)
			const pdfJsExtendedMetadata = {
				subject: pdfMetadata.info?.Subject || '',
				keywords: pdfMetadata.info?.Keywords || '',
				creator: pdfMetadata.info?.Creator || '',
				producer: pdfMetadata.info?.Producer || '',
				creationDate: pdfMetadata.info?.CreationDate || '',
				modificationDate: pdfMetadata.info?.ModDate || ''
			};

			// Clean up PDF.js resources
			await pdf.cleanup();
			await pdf.destroy();

			const metadataTime = Date.now() - metadataStartTime;
			this.logService.info(`[Hybrid PDF] ✓ Metadata extracted in ${metadataTime}ms`);
			this.logService.info(`[Hybrid PDF]   - Title: ${metadata.title || '(none)'}`);
			this.logService.info(`[Hybrid PDF]   - Author: ${metadata.author || '(none)'}`);
			this.logService.info(`[Hybrid PDF]   - Pages: ${metadata.pageCount}`);

			// Step 2: Extract content with Docling (slow, high-quality)
			this.logService.info('[Hybrid PDF] Step 2/2: Extracting content with Docling...');
			const contentStartTime = Date.now();

			const { Docling } = await import('docling-sdk');
			const client = new Docling({
				api: {
					baseUrl: 'http://localhost:5001',
					timeout: 60000
				}
			});

			const fs = await import('fs');
			const fileBuffer = await fs.promises.readFile(filepath);

			const result = await client.convertFile({
				files: fileBuffer,
				filename: filepath.split(/[\\/]/).pop() || 'document.pdf',
				to_formats: ['md']
			});

			let text = result.document.md_content || result.document.text_content || '';
			const doclingDoc = result.document.json_content;

			const contentTime = Date.now() - contentStartTime;
			this.logService.info(`[Hybrid PDF] ✓ Content extracted in ${contentTime}ms`);
			this.logService.info(`[Hybrid PDF]   - Characters: ${text.length.toLocaleString()}`);

			// Check if this appears to be a scanned PDF (very little or no text)
			if (this.enableAutoOCR && this.isScannedPDF(text, metadata.pageCount || 1)) {
				this.logService.info(`[Hybrid PDF] Scanned PDF detected - attempting OCR extraction`);

				const ocrResult = await this.extractWithOCR(uri, filepath, metadata.pageCount || 1);
				if (ocrResult) {
					this.logService.info(`[Hybrid PDF] OCR extraction successful - using OCR text`);
					return ocrResult;
				} else {
					this.logService.warn(`[Hybrid PDF] OCR extraction failed - using sparse Docling text`);
				}
			}

			// Detect tables
			let tableCount = 0;
			if (doclingDoc?.tables && Array.isArray(doclingDoc.tables)) {
				tableCount = doclingDoc.tables.length;
			} else {
				const markdownTableRegex = /\|[^\n]+\|[\n\r]+\|[-:\s|]+\|/g;
				const tableMatches = text.match(markdownTableRegex);
				tableCount = tableMatches ? tableMatches.length : 0;
			}

			// Update metadata with content-derived values
			metadata.wordCount = this.countWords(text);
			metadata.language = this.detectLanguage(text);

			const totalTime = Date.now() - startTime;

			this.logService.info(`[Hybrid PDF] ========== HYBRID EXTRACTION SUMMARY ==========`);
			this.logService.info(`[Hybrid PDF] Total time: ${totalTime}ms (metadata: ${metadataTime}ms, content: ${contentTime}ms)`);
			this.logService.info(`[Hybrid PDF] Metadata source: PDF.js`);
			this.logService.info(`[Hybrid PDF]   - Title: ${metadata.title || '(empty)'}`);
			this.logService.info(`[Hybrid PDF]   - Author: ${metadata.author || '(empty)'}`);
			this.logService.info(`[Hybrid PDF]   - Creator: ${pdfJsExtendedMetadata.creator || '(empty)'}`);
			this.logService.info(`[Hybrid PDF]   - Creation date: ${pdfJsExtendedMetadata.creationDate || '(empty)'}`);
			this.logService.info(`[Hybrid PDF] Content source: Docling ML`);
			this.logService.info(`[Hybrid PDF]   - Words: ${metadata.wordCount?.toLocaleString()}`);
			this.logService.info(`[Hybrid PDF]   - Tables: ${tableCount}`);
			this.logService.info(`[Hybrid PDF]   - Language: ${metadata.language}`);
			this.logService.info(`[Hybrid PDF] ========== HYBRID EXTRACTION COMPLETE ==========`);

			return {
				text: text.trim(),
				metadata
			};

		} catch (error) {
			// Fallback: use PDF.js-only extraction if Docling fails
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logService.warn(`[Hybrid PDF] Docling extraction failed: ${errorMsg}`);
			this.logService.warn(`[Hybrid PDF] Falling back to PDF.js-only extraction`);

			return await this.extractPDFPages(uri);
		}
	}

	/**
	 * Extract PDF content using Docling SDK for better document structure extraction
	 * This method provides enhanced layout analysis and better handling of tables, figures, and complex layouts
	 * @param uri The URI of the PDF file
	 */
	async extractPdfWithDocling(uri: URI): Promise<ExtractedContent> {
		// Start timing
		const startTime = Date.now();

		try {
			// Dynamic import for docling-sdk
			const { Docling } = await import('docling-sdk');

			const filepath = this.getFilePath(uri);
			this.logService.info(`[Docling] ========== DOCLING EXTRACTION START ==========`);
			this.logService.info(`[Docling] File: ${filepath}`);
			this.logService.info(`[Docling] Timestamp: ${new Date().toISOString()}`);

			// Initialize Docling client in API mode
			// Connects to docling-serve running on localhost:5001
			const converterStartTime = Date.now();

			const client = new Docling({
				api: {
					baseUrl: 'http://localhost:5001',
					timeout: 60000 // 60 second timeout for large PDFs
				}
			});
			const converterInitTime = Date.now() - converterStartTime;
			this.logService.info(`[Docling] Docling API client initialized in ${converterInitTime}ms`);
			this.logService.info(`[Docling] Connecting to Docling Serve at http://localhost:5001`);

			// Convert PDF to markdown using Docling API
			this.logService.info('[Docling] Starting document conversion...');
			const conversionStartTime = Date.now();

			// Read the file as a buffer
			const fs = await import('fs');
			const fileBuffer = await fs.promises.readFile(filepath);

			// Convert using Docling API - sends to docling-serve
			const result = await client.convertFile({
				files: fileBuffer,
				filename: filepath.split(/[\\/]/).pop() || 'document.pdf',
				to_formats: ['md']
			});

			const conversionTime = Date.now() - conversionStartTime;
			this.logService.info(`[Docling] Document conversion completed in ${conversionTime}ms`);

			// DEBUG: Log the entire result structure
			this.logService.info(`[Docling] DEBUG: Result keys: ${Object.keys(result).join(', ')}`);
			this.logService.info(`[Docling] DEBUG: result.document keys: ${result.document ? Object.keys(result.document).join(', ') : 'null'}`);
			this.logService.info(`[Docling] DEBUG: md_content length: ${result.document.md_content?.length || 0}`);
			this.logService.info(`[Docling] DEBUG: text_content length: ${result.document.text_content?.length || 0}`);
			this.logService.info(`[Docling] DEBUG: json_content exists: ${!!result.document.json_content}`);

			// Extract the converted text from the response
			const text = result.document.md_content || result.document.text_content || '';
			const charCount = text.length;

			// Get the JSON document for metadata
			const doclingDoc = result.document.json_content;

			// Analyze document structure features
			this.logService.info(`[Docling] ========== DOCUMENT ANALYSIS ==========`);

			// 1. Character count
			this.logService.info(`[Docling] Total characters: ${charCount.toLocaleString()}`);

			// 2. Detect tables (look for markdown table syntax or result metadata)
			let tableCount = 0;
			let hasMultiColumnLayout = false;

			// Check if result object contains table information in json_content
			if (doclingDoc?.tables && Array.isArray(doclingDoc.tables)) {
				tableCount = doclingDoc.tables.length;
				this.logService.info(`[Docling] ✓ Tables detected: ${tableCount} table${tableCount !== 1 ? 's' : ''}`);
				if (tableCount > 0) {
					this.logService.info(`[Docling]   Table details:`, JSON.stringify(doclingDoc.tables.slice(0, 3).map((t: any) => ({
						rows: t.num_rows || t.data?.num_rows || '?',
						cols: t.num_cols || t.data?.num_cols || '?'
					}))));
				}
			} else {
				// Fallback: detect markdown tables in text
				const markdownTableRegex = /\|[^\n]+\|[\n\r]+\|[-:\s|]+\|/g;
				const tableMatches = text.match(markdownTableRegex);
				tableCount = tableMatches ? tableMatches.length : 0;
				if (tableCount > 0) {
					this.logService.info(`[Docling] ✓ Markdown tables detected: ${tableCount} (detected from text format)`);
				} else {
					this.logService.info(`[Docling] ✗ No tables detected`);
				}
			}

			// 3. Detect multi-column layout
			// For now, use heuristic detection since layout info is not directly available in the response
			// We'll detect based on page structure or content patterns
			const lines = text.split('\n');
			let suspectedMultiColumn = false;

			// Check for multiple consecutive lines with unusual spacing patterns
			let consecutiveWideSpacing = 0;
			for (const line of lines) {
				// Look for lines with multiple wide gaps (potential column separation)
				const wideGaps = (line.match(/\s{10,}/g) || []).length;
				if (wideGaps >= 2) {
					consecutiveWideSpacing++;
					if (consecutiveWideSpacing > 3) {
						suspectedMultiColumn = true;
						break;
					}
				} else {
					consecutiveWideSpacing = 0;
				}
			}

			hasMultiColumnLayout = suspectedMultiColumn;
			if (suspectedMultiColumn) {
				this.logService.info(`[Docling] ⚠️ Possible multi-column layout detected (heuristic)`);
			} else {
				this.logService.info(`[Docling] ✗ No multi-column layout detected`);
			}

			// Extract metadata from the document
			// Try to get metadata from origin or calculate from content
			const metadata: ExtractedContent['metadata'] = {
				title: doclingDoc?.name || doclingDoc?.origin?.filename || '',
				author: '', // Not available in DoclingDocument structure
				pageCount: doclingDoc?.page_dimensions?.length || 0,
				wordCount: this.countWords(text),
				language: this.detectLanguage(text)
			};

			// Dates are not available in the DoclingDocument structure
			// We could potentially read them from file system if needed

			// Calculate total extraction time
			const totalTime = Date.now() - startTime;

			// Final summary
			this.logService.info(`[Docling] ========== EXTRACTION SUMMARY ==========`);
			this.logService.info(`[Docling] Total extraction time: ${totalTime.toLocaleString()}ms`);
			this.logService.info(`[Docling] Characters extracted: ${charCount.toLocaleString()}`);
			this.logService.info(`[Docling] Words extracted: ${(metadata.wordCount || 0).toLocaleString()}`);
			this.logService.info(`[Docling] Pages processed: ${metadata.pageCount}`);
			this.logService.info(`[Docling] Tables found: ${tableCount}`);
			this.logService.info(`[Docling] Multi-column layout: ${hasMultiColumnLayout ? 'Yes' : 'No'}`);
			this.logService.info(`[Docling] Language detected: ${metadata.language}`);

			// Performance metrics
			this.logService.info(`[Docling] Performance metrics:`);
			this.logService.info(`[Docling]   - Init time: ${converterInitTime}ms`);
			this.logService.info(`[Docling]   - Conversion time: ${conversionTime}ms`);
			this.logService.info(`[Docling]   - Processing overhead: ${totalTime - conversionTime - converterInitTime}ms`);
			this.logService.info(`[Docling]   - Characters per second: ${Math.round(charCount / (totalTime / 1000)).toLocaleString()}`);

			this.logService.info(`[Docling] ========== DOCLING EXTRACTION COMPLETE ==========`);

			return {
				text: text.trim(),
				metadata
			};

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			const totalTime = Date.now() - startTime;

			this.logService.error(`[Docling] ========== EXTRACTION FAILED ==========`);
			this.logService.error(`[Docling] Failed after ${totalTime}ms`);
			this.logService.error('[Docling] Error details:', error);

			// Provide helpful error context
			if (errorMsg.includes('Python') || errorMsg.includes('python')) {
				throw new Error(`Docling extraction failed: Python environment required. ${errorMsg}`);
			} else if (errorMsg.includes('command not found') || errorMsg.includes('spawn')) {
				throw new Error(`Docling extraction failed: Docling CLI not found or not properly installed. ${errorMsg}`);
			} else {
				throw new Error(`Docling extraction failed: ${errorMsg}`);
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
	 * Edit a DOCX file with the given operations
	 */
	async editDOCX(uri: URI, operations: Array<{
		type: 'insert_text' | 'replace_text';
		position?: number;
		text?: string;
		search?: string;
		replace?: string;
		all?: boolean;
	}>): Promise<{ success: boolean; message: string }> {
		try {
			const { Document, Packer, Paragraph, TextRun } = await import('docx');
			const mammoth = await import('mammoth');
			const { readFileSync, writeFileSync } = await import('fs');

			this.logService.info(`[RAGFileService] ========== editDOCX START ==========`);
			this.logService.info(`[RAGFileService] Editing DOCX: ${uri.fsPath}`);
			this.logService.info(`[RAGFileService] Operations count: ${operations.length}`);
			operations.forEach((op, idx) => {
				this.logService.info(`[RAGFileService] Operation ${idx + 1}:`, JSON.stringify(op));
			});

			// Read existing DOCX file (create empty file if it doesn't exist)
			const filepath = this.getFilePath(uri);
			this.logService.info(`[RAGFileService] Reading file from: ${filepath}`);

			let buffer: Buffer;
			try {
				buffer = readFileSync(filepath);
				this.logService.info(`[RAGFileService] File buffer size: ${buffer.length} bytes`);
			} catch (error: any) {
				// If file doesn't exist, create an empty DOCX file first
				if (error.code === 'ENOENT') {
					this.logService.info(`[RAGFileService] File does not exist, creating empty DOCX file first...`);
					await this.createEmptyDOCX(uri);
					buffer = readFileSync(filepath);
					this.logService.info(`[RAGFileService] Created empty DOCX file, buffer size: ${buffer.length} bytes`);
				} else {
					throw error;
				}
			}

			// Extract text content using mammoth
			this.logService.info('[RAGFileService] Extracting text from DOCX using mammoth...');
			const { value: extractedText } = await mammoth.extractRawText({ buffer });
			this.logService.info(`[RAGFileService] Extracted ${extractedText.length} characters`);
			this.logService.info(`[RAGFileService] Extracted text preview: "${extractedText.substring(0, 100)}"`);

			let modifiedText = extractedText;
			this.logService.info(`[RAGFileService] Initial modifiedText: "${modifiedText.substring(0, 100)}" (${modifiedText.length} chars)`);

			// Apply operations sequentially
			for (let i = 0; i < operations.length; i++) {
				const op = operations[i];
				this.logService.info(`[RAGFileService] Applying operation ${i + 1}/${operations.length}: ${op.type}`);

				switch (op.type) {
					case 'insert_text':
						if (typeof op.position === 'number' && op.text) {
							const pos = Math.min(op.position, modifiedText.length);
							const beforeLength = modifiedText.length;
							modifiedText = modifiedText.slice(0, pos) + op.text + modifiedText.slice(pos);
							this.logService.info(`[RAGFileService] Inserted "${op.text}" at position ${pos}`);
							this.logService.info(`[RAGFileService] Text length: ${beforeLength} -> ${modifiedText.length}`);
							this.logService.info(`[RAGFileService] Modified text after insert: "${modifiedText.substring(0, 100)}"`);
						} else {
							this.logService.warn(`[RAGFileService] Invalid insert_text operation: position=${op.position}, text=${op.text}`);
						}
						break;

					case 'replace_text':
						if (op.search && typeof op.replace === 'string') {
							const beforeLength = modifiedText.length;
							if (op.all) {
								const count = (modifiedText.match(new RegExp(op.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length;
								modifiedText = modifiedText.split(op.search).join(op.replace);
								this.logService.info(`[RAGFileService] Replaced ${count} occurrences: "${op.search}" -> "${op.replace}"`);
							} else {
								modifiedText = modifiedText.replace(op.search, op.replace);
								this.logService.info(`[RAGFileService] Replaced first occurrence: "${op.search}" -> "${op.replace}"`);
							}
							this.logService.info(`[RAGFileService] Text length: ${beforeLength} -> ${modifiedText.length}`);
							this.logService.info(`[RAGFileService] Modified text after replace: "${modifiedText.substring(0, 100)}"`);
						} else {
							this.logService.warn(`[RAGFileService] Invalid replace_text operation: search=${op.search}, replace=${op.replace}`);
						}
						break;
				}
			}

			this.logService.info(`[RAGFileService] Final modifiedText after all operations: "${modifiedText.substring(0, 100)}" (${modifiedText.length} chars)`);

			// Create new document with modified content
			this.logService.info(`[RAGFileService] Creating new document with modified text (length: ${modifiedText.length})...`);
			this.logService.info(`[RAGFileService] Modified text preview: "${modifiedText.substring(0, 100)}"`);

			// Handle empty text case - ensure at least one paragraph exists
			let paragraphs: any[];
			if (modifiedText.trim().length === 0) {
				this.logService.warn('[RAGFileService] Modified text is empty or whitespace only, creating empty paragraph');
				paragraphs = [new Paragraph({ children: [new TextRun(' ')] })];
			} else {
				// Split by newlines and create paragraphs
				const lines = modifiedText.split('\n');
				this.logService.info(`[RAGFileService] Split into ${lines.length} line(s)`);
				paragraphs = lines.map((line, index) => {
					const trimmedLine = line.trim();
					// Use non-breaking space if line is empty to ensure paragraph exists
					const text = trimmedLine.length > 0 ? trimmedLine : ' ';
					this.logService.info(`[RAGFileService] Paragraph ${index + 1}: "${text.substring(0, 50)}"`);
					return new Paragraph({
						children: [new TextRun(text)]
					});
				});
			}

			this.logService.info(`[RAGFileService] Created ${paragraphs.length} paragraph(s)`);

			const doc = new Document({
				creator: 'Safe Appeals Navigator',
				title: 'Edited Document',
				description: 'Edited by Safe Appeals Navigator',
				sections: [{
					properties: {},
					children: paragraphs
				}]
			});

			// Generate and save
			this.logService.info('[RAGFileService] Packing document to buffer...');
			const newBuffer = await Packer.toBuffer(doc);
			this.logService.info(`[RAGFileService] Generated buffer: ${newBuffer.length} bytes`);

			// Ensure parent directory exists before writing
			const { dirname } = await import('path');
			const { mkdirSync } = await import('fs');
			const parentDir = dirname(filepath);
			try {
				mkdirSync(parentDir, { recursive: true });
				this.logService.info(`[RAGFileService] Ensured parent directory exists: ${parentDir}`);
			} catch (mkdirError: any) {
				// Ignore error if directory already exists
				if (mkdirError.code !== 'EEXIST') {
					this.logService.warn(`[RAGFileService] Warning: Could not create parent directory: ${mkdirError.message}`);
				}
			}

			// Write buffer to disk
			writeFileSync(filepath, newBuffer as Uint8Array<ArrayBuffer>);
			this.logService.info(`[RAGFileService] ✅ File written to disk: ${filepath}`);

			// Verify we can read it back immediately
			try {
				const verifyBuffer = readFileSync(filepath);
				this.logService.info(`[RAGFileService] ✅ Verified file exists on disk: ${verifyBuffer.length} bytes`);

				// Try to extract text to verify it's readable
				const { value: verifyText } = await mammoth.extractRawText({ buffer: verifyBuffer });
				this.logService.info(`[RAGFileService] ✅ Verified document can be read: "${verifyText.substring(0, 100)}" (${verifyText.length} chars)`);
				if (verifyText.trim() !== modifiedText.trim()) {
					this.logService.warn(`[RAGFileService] ⚠️ WARNING: Read text differs from written text! Written: "${modifiedText.substring(0, 50)}", Read: "${verifyText.substring(0, 50)}"`);
				}
			} catch (verifyError) {
				this.logService.error(`[RAGFileService] ❌ Failed to verify written document:`, verifyError);
			}

			this.logService.info(`[RAGFileService] ✅ Successfully saved edited DOCX: ${filepath} (${newBuffer.length} bytes)`);

			this.logService.info(`[RAGFileService] ========== editDOCX SUCCESS ==========`);
			return {
				success: true,
				message: `Applied ${operations.length} edit operation(s) to ${uri.fsPath}`
			};
		} catch (error) {
			this.logService.error('[RAGFileService] ========== editDOCX ERROR ==========');
			this.logService.error('[RAGFileService] Failed to edit DOCX:', error);
			if (error instanceof Error) {
				this.logService.error('[RAGFileService] Error message:', error.message);
				this.logService.error('[RAGFileService] Error stack:', error.stack);
			}
			throw error;
		}
	}

	/**
	 * Edit an XLSX file with the given operations
	 */
	async editXLSX(uri: URI, operations: Array<{
		type: 'set_cell_value' | 'set_cell_formula';
		sheet: string | number;
		cell: string;
		value?: any;
		formula?: string;
	}>): Promise<{ success: boolean; message: string }> {
		try {
			const XLSX = await import('xlsx');
			const { readFileSync, writeFileSync } = await import('fs');

			this.logService.info(`[RAGFileService] Editing XLSX: ${uri.fsPath}`);

			// Read and parse workbook (create empty file if it doesn't exist)
			const filepath = this.getFilePath(uri);
			let buffer: Buffer;
			try {
				buffer = readFileSync(filepath);
			} catch (error: any) {
				// If file doesn't exist, create an empty XLSX file first
				if (error.code === 'ENOENT') {
					this.logService.info(`[RAGFileService] File does not exist, creating empty XLSX file first...`);
					await this.createEmptyXLSX(uri);
					buffer = readFileSync(filepath);
					this.logService.info(`[RAGFileService] Created empty XLSX file, buffer size: ${buffer.length} bytes`);
				} else {
					throw error;
				}
			}
			const workbook = XLSX.read(buffer, { type: 'buffer' });

			this.logService.info(`[RAGFileService] Loaded workbook with ${workbook.SheetNames.length} sheets`);

			// Apply operations
			for (const op of operations) {
				// Resolve sheet name
				let sheetName: string;
				if (typeof op.sheet === 'number') {
					sheetName = workbook.SheetNames[op.sheet];
					if (!sheetName) {
						throw new Error(`Sheet index ${op.sheet} out of range (workbook has ${workbook.SheetNames.length} sheets)`);
					}
				} else {
					sheetName = op.sheet;
					if (!workbook.Sheets[sheetName]) {
						throw new Error(`Sheet "${sheetName}" not found in workbook`);
					}
				}

				const worksheet = workbook.Sheets[sheetName];

				switch (op.type) {
					case 'set_cell_value':
						if (op.value !== undefined) {
							worksheet[op.cell] = {
								t: typeof op.value === 'number' ? 'n' : 's',
								v: op.value
							};
							this.logService.info(`[RAGFileService] Set ${sheetName}!${op.cell} = ${op.value}`);
						}
						break;

					case 'set_cell_formula':
						if (op.formula) {
							worksheet[op.cell] = {
								t: 'n',
								f: op.formula
							};
							this.logService.info(`[RAGFileService] Set ${sheetName}!${op.cell} = ${op.formula}`);
						}
						break;
				}
			}

			// Write back to file
			const newBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

			// Ensure parent directory exists before writing
			const { dirname } = await import('path');
			const { mkdirSync } = await import('fs');
			const parentDir = dirname(filepath);
			try {
				mkdirSync(parentDir, { recursive: true });
				this.logService.info(`[RAGFileService] Ensured parent directory exists: ${parentDir}`);
			} catch (mkdirError: any) {
				// Ignore error if directory already exists
				if (mkdirError.code !== 'EEXIST') {
					this.logService.warn(`[RAGFileService] Warning: Could not create parent directory: ${mkdirError.message}`);
				}
			}

			// Write buffer to disk
			writeFileSync(filepath, newBuffer as Uint8Array<ArrayBuffer>);

			this.logService.info(`[RAGFileService] ✅ Successfully saved edited XLSX: ${filepath} (${newBuffer.length} bytes)`);

			return {
				success: true,
				message: `Successfully edited XLSX file: ${operations.length} operation(s) applied`
			};
		} catch (error) {
			this.logService.error('[RAGFileService] Failed to edit XLSX:', error);
			throw error;
		}
	}

	/**
	 * Create an empty but valid DOCX file
	 */
	async createEmptyDOCX(uri: URI): Promise<void> {
		try {
			const { Document, Packer, Paragraph, TextRun } = await import('docx');
			const { writeFileSync, mkdirSync } = await import('fs');
			const { dirname } = await import('path');

			// Create a minimal valid DOCX document following docx.js v9.5.1 official patterns
			// Based on official documentation: https://docx.js.org/index
			// A proper paragraph should have children with TextRun objects, not raw text property
			const doc = new Document({
				creator: 'Safe Appeals Navigator',
				title: 'New Document',
				description: 'Created by Safe Appeals Navigator',
				sections: [{
					properties: {},
					children: [
						// Use proper TextRun structure as per docx.js documentation
						// A single space ensures the paragraph is visible and valid
						new Paragraph({
							children: [
								new TextRun(' ')
							]
						}),
						// Add a second paragraph to ensure proper document structure
						new Paragraph({
							children: [
								new TextRun('')
							]
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

			// Expected size range: 1200-2500 bytes for minimal empty DOCX with proper structure
			if (buffer.length < 1000) {
				this.logService.warn(`[createEmptyDOCX] Buffer size (${buffer.length} bytes) is smaller than expected (1200-2500 bytes). File may be incomplete.`);
			}

			// Write to disk
			const filepath = this.getFilePath(uri);
			const parentDir = dirname(filepath);

			// Ensure parent directory exists
			try {
				mkdirSync(parentDir, { recursive: true });
				this.logService.info(`[createEmptyDOCX] Ensured parent directory exists: ${parentDir}`);
			} catch (mkdirError: any) {
				// Ignore error if directory already exists
				if (mkdirError.code !== 'EEXIST') {
					this.logService.warn(`[createEmptyDOCX] Warning: Could not create parent directory: ${mkdirError.message}`);
				}
			}

			this.logService.info(`[createEmptyDOCX] Writing ${buffer.length} bytes to: ${filepath}`);
			// Write buffer to disk
			writeFileSync(filepath, buffer as Uint8Array<ArrayBuffer>);

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
			const { writeFileSync, mkdirSync } = await import('fs');
			const { dirname } = await import('path');

			// Create a minimal valid XLSX workbook
			const workbook = XLSX.utils.book_new();
			const worksheet = XLSX.utils.aoa_to_sheet([[]]); // Empty sheet
			XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');

			// Write the XLSX
			const filepath = this.getFilePath(uri);
			const parentDir = dirname(filepath);

			// Ensure parent directory exists
			try {
				mkdirSync(parentDir, { recursive: true });
				this.logService.info(`[createEmptyXLSX] Ensured parent directory exists: ${parentDir}`);
			} catch (mkdirError: any) {
				// Ignore error if directory already exists
				if (mkdirError.code !== 'EEXIST') {
					this.logService.warn(`[createEmptyXLSX] Warning: Could not create parent directory: ${mkdirError.message}`);
				}
			}

			const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
			writeFileSync(filepath, buffer);

			this.logService.info(`Created empty XLSX file: ${filepath}`);
		} catch (error) {
			this.logService.error(`Failed to create empty XLSX file:`, error);
			throw new Error(`Failed to create XLSX file: ${error.message}`);
		}
	}
}

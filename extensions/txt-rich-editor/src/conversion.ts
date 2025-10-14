/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import * as mammoth from 'mammoth';
import htmlToDocx from 'html-to-docx';
import { DocxXmlHandler, DocxPageLayout } from './docxXmlHandler';
import { Logger } from './logger';

export interface ConversionResult {
	success: boolean;
	content?: string;
	error?: string;
	images?: Map<string, Uint8Array>;
	pageLayout?: DocxPageLayout;
}

export class DocumentConverter {
	public readonly xmlHandler: DocxXmlHandler;
	private readonly logger: Logger;

	constructor(logger: Logger) {
		this.logger = logger;
		this.xmlHandler = new DocxXmlHandler(logger);
	}

	/**
	 * Convert DOCX to HTML with fallback support
	 */
	async docxToHtml(buffer: Uint8Array): Promise<ConversionResult> {
		try {
			this.logger.info('Converting DOCX to HTML...');

			// Try XML-based conversion first (faster, more accurate)
			try {
				const docxDoc = await this.xmlHandler.parseDocx(buffer);
				const html = this.xmlHandler.docxXmlToHtml(docxDoc);

				this.logger.info('Successfully converted DOCX to HTML using XML handler');
				return {
					success: true,
					content: html,
					images: docxDoc.images,
					pageLayout: docxDoc.pageLayout
				};
			} catch (xmlError) {
				this.logger.warn('XML conversion failed, falling back to mammoth');
			}

			// Fallback to mammoth
			const result = await mammoth.convertToHtml({ buffer });
			const html = result.value;

			// Log any conversion messages
			if (result.messages.length > 0) {
				this.logger.info('Mammoth conversion messages');
			}

			this.logger.info('Successfully converted DOCX to HTML using mammoth');
			return {
				success: true,
				content: html
			};
		} catch (error) {
			this.logger.error('Failed to convert DOCX to HTML:', error);
			return {
				success: false,
				error: `Failed to convert DOCX to HTML: ${error}`
			};
		}
	}

	/**
	 * Convert HTML to DOCX with fallback support
	 */
	async htmlToDocx(html: string, images: Map<string, Uint8Array> = new Map()): Promise<ConversionResult> {
		try {
			this.logger.info('Converting HTML to DOCX...');

			// Try XML-based conversion first
			try {
				const docxXml = this.xmlHandler.htmlToDocxXml(html);
				const buffer = await this.xmlHandler.generateDocxBuffer(docxXml, images);

				this.logger.info('Successfully converted HTML to DOCX using XML handler');
				return {
					success: true,
					content: buffer.toString()
				};
			} catch (xmlError) {
				this.logger.warn('XML conversion failed, falling back to html-to-docx');
			}

			// Fallback to html-to-docx library
			const buffer = await htmlToDocx(html, undefined, {
				table: { row: { cantSplit: true } },
				footer: true,
				header: true,
				font: 'Calibri',
				fontSize: 11,
				complexScriptFont: 'Calibri',
				rightToLeft: false
			});

			this.logger.info('Successfully converted HTML to DOCX using html-to-docx');
			return {
				success: true,
				content: buffer.toString()
			};
		} catch (error) {
			this.logger.error('Failed to convert HTML to DOCX:', error);
			return {
				success: false,
				error: `Failed to convert HTML to DOCX: ${error}`
			};
		}
	}

	/**
	 * Convert HTML to PDF (requires puppeteer)
	 */
	async htmlToPdf(html: string): Promise<ConversionResult> {
		try {
			this.logger.info('Converting HTML to PDF...');

			// Check if puppeteer is available
			try {
				const puppeteer = require('puppeteer');

				const browser = await puppeteer.launch({
					headless: true,
					args: ['--no-sandbox', '--disable-setuid-sandbox']
				});

				const page = await browser.newPage();

				// Set page size to A4
				await page.setViewport({ width: 794, height: 1123 }); // A4 at 96 DPI

				// Set content with proper CSS for print
				const printHtml = `
					<!DOCTYPE html>
					<html>
					<head>
						<meta charset="UTF-8">
						<style>
							body {
								font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
								font-size: 12pt;
								line-height: 1.6;
								margin: 1in;
								color: #000;
							}
							@page {
								size: A4;
								margin: 1in;
							}
							h1 { font-size: 18pt; font-weight: bold; margin: 0.5em 0; }
							h2 { font-size: 16pt; font-weight: bold; margin: 0.4em 0; }
							h3 { font-size: 14pt; font-weight: bold; margin: 0.3em 0; }
							p { margin: 0.5em 0; }
							ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
							table { border-collapse: collapse; width: 100%; margin: 0.5em 0; }
							th, td { border: 1px solid #ccc; padding: 0.3em; }
							th { background-color: #f0f0f0; font-weight: bold; }
						</style>
					</head>
					<body>
						${html}
					</body>
					</html>
				`;

				await page.setContent(printHtml, { waitUntil: 'networkidle0' });

				const pdfBuffer = await page.pdf({
					format: 'A4',
					margin: {
						top: '1in',
						right: '1in',
						bottom: '1in',
						left: '1in'
					},
					printBackground: true
				});

				await browser.close();

				this.logger.info('Successfully converted HTML to PDF');
				return {
					success: true,
					content: pdfBuffer.toString()
				};
			} catch (puppeteerError) {
				this.logger.warn('Puppeteer not available, PDF export disabled');
				return {
					success: false,
					error: 'PDF export requires puppeteer to be installed'
				};
			}
		} catch (error) {
			this.logger.error('Failed to convert HTML to PDF:', error);
			return {
				success: false,
				error: `Failed to convert HTML to PDF: ${error}`
			};
		}
	}

	/**
	 * Clean HTML content for safe editing
	 */
	cleanHtml(html: string): string {
		try {
			this.logger.info('Cleaning HTML content...');

			// Remove script tags and event handlers
			let cleanedHtml = html
				.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
				.replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
				.replace(/javascript:/gi, '')
				.replace(/vbscript:/gi, '');

			// Remove dangerous attributes
			cleanedHtml = cleanedHtml
				.replace(/\s*style\s*=\s*["'][^"']*["']/gi, '')
				.replace(/\s*class\s*=\s*["'][^"']*["']/gi, '');

			// Normalize whitespace
			cleanedHtml = cleanedHtml
				.replace(/\s+/g, ' ')
				.replace(/>\s+</g, '><')
				.trim();

			this.logger.info('Successfully cleaned HTML content');
			return cleanedHtml;
		} catch (error) {
			this.logger.error('Failed to clean HTML content:', error);
			return html; // Return original if cleaning fails
		}
	}

	/**
	 * Extract plain text from HTML
	 */
	extractPlainText(html: string): string {
		try {
			this.logger.info('Extracting plain text from HTML...');

			// Remove HTML tags and decode entities
			let plainText = html
				.replace(/<[^>]*>/g, '')
				.replace(/&nbsp;/g, ' ')
				.replace(/&amp;/g, '&')
				.replace(/&lt;/g, '<')
				.replace(/&gt;/g, '>')
				.replace(/&quot;/g, '"')
				.replace(/&#39;/g, "'")
				.replace(/&apos;/g, "'");

			// Normalize whitespace
			plainText = plainText
				.replace(/\s+/g, ' ')
				.trim();

			this.logger.info('Successfully extracted plain text');
			return plainText;
		} catch (error) {
			this.logger.error('Failed to extract plain text:', error);
			return html; // Return original if extraction fails
		}
	}

	/**
	 * Validate HTML content
	 */
	validateHtml(html: string): { isValid: boolean; errors: string[] } {
		const errors: string[] = [];

		try {
			// Check for basic HTML structure
			if (!html.includes('<') && !html.includes('>')) {
				errors.push('Content does not appear to be HTML');
			}

			// Check for dangerous content
			if (html.includes('<script')) {
				errors.push('HTML contains script tags');
			}

			if (html.includes('javascript:') || html.includes('vbscript:')) {
				errors.push('HTML contains javascript or vbscript protocols');
			}

			// Check for balanced tags (basic check)
			const openTags = (html.match(/<[^/][^>]*>/g) || []).length;
			const closeTags = (html.match(/<\/[^>]*>/g) || []).length;

			if (Math.abs(openTags - closeTags) > 5) {
				errors.push('HTML may have unbalanced tags');
			}

			return {
				isValid: errors.length === 0,
				errors
			};
		} catch (error) {
			return {
				isValid: false,
				errors: [`Validation error: ${error}`]
			};
		}
	}
}

/**
 * Check if running in web environment
 */
export function isWebEnvironment(): boolean {
	return typeof window !== 'undefined' && typeof require === 'undefined';
}

/**
 * Legacy exports for backward compatibility
 */
export async function docxToHtml(buffer: Uint8Array): Promise<string> {
	const converter = new DocumentConverter(new Logger('Legacy'));
	const result = await converter.docxToHtml(buffer);
	return result.success ? result.content || '' : '';
}

export async function docxToHtmlWithLayout(buffer: Uint8Array): Promise<ConversionResult> {
	const converter = new DocumentConverter(new Logger('Legacy'));
	return await converter.docxToHtml(buffer);
}

export async function htmlToDocxBuffer(html: string): Promise<Uint8Array> {
	const converter = new DocumentConverter(new Logger('Legacy'));
	const result = await converter.htmlToDocx(html);
	return result.success ? new TextEncoder().encode(result.content || '') : new Uint8Array();
}

export async function readDocxFile(uri: any): Promise<Uint8Array> {
	return vscode.workspace.fs.readFile(uri);
}

export async function writeDocxFile(uri: any, buffer: Uint8Array): Promise<void> {
	return vscode.workspace.fs.writeFile(uri, buffer);
}

/**
 * Get file extension from URI
 */
export function getFileExtension(uri: string): string {
	const parts = uri.split('.');
	return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

/**
 * Check if file type is supported
 */
export function isSupportedFileType(uri: string): boolean {
	const extension = getFileExtension(uri);
	return ['txt', 'gdoc', 'docx'].includes(extension);
}

/**
 * Get MIME type for file extension
 */
export function getMimeType(extension: string): string {
	switch (extension.toLowerCase()) {
		case 'txt':
			return 'text/plain';
		case 'gdoc':
			return 'text/html';
		case 'docx':
			return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
		default:
			return 'text/plain';
	}
}

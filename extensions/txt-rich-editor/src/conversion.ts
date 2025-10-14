/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import { DocxXmlHandler } from './docxXmlHandler';

// Dynamic imports to handle optional dependencies
let mammoth: any;
let htmlToDocx: any;

async function loadDependencies() {
	if (!mammoth) {
		try {
			mammoth = await import('mammoth');
		} catch (error) {
			// mammoth not available
		}
	}

	if (!htmlToDocx) {
		try {
			htmlToDocx = await import('html-to-docx');
		} catch (error) {
			// html-to-docx not available
		}
	}
}

export async function docxToHtml(buffer: Uint8Array, useNativeParser: boolean = true): Promise<string> {
	// Try native DOCX XML parser first for better format preservation
	if (useNativeParser) {
		try {
			console.log('Attempting native DOCX parser...');
			const handler = new DocxXmlHandler();
			const docxDoc = await handler.parseDocxBuffer(buffer);
			console.log('DOCX parsed successfully, XML length:', docxDoc.xml.length);
			const html = handler.docxXmlToHtml(docxDoc);
			console.log('Native parser succeeded, HTML length:', html.length);
			return html;
		} catch (error) {
			console.warn('Native DOCX parser failed, falling back to mammoth:', error);
		}
	}

	// Fallback to mammoth
	console.log('Using mammoth fallback parser...');
	await loadDependencies();

	if (!mammoth) {
		throw new Error('mammoth library not available');
	}

	try {
		const result = await mammoth.convertToHtml({ buffer });
		console.log('Mammoth parser succeeded, HTML length:', result.value.length);
		return sanitizeHtml(result.value);
	} catch (error) {
		throw new Error(`Failed to convert DOCX to HTML: ${error}`);
	}
}

export async function htmlToDocxBuffer(html: string, useNativeGenerator: boolean = true): Promise<Uint8Array> {
	// Try native DOCX XML generator first for better format preservation
	if (useNativeGenerator) {
		try {
			const handler = new DocxXmlHandler();
			const docxDoc = handler.htmlToDocxXml(html);
			return await handler.generateDocxBuffer(docxDoc);
		} catch (error) {
			console.warn('Native DOCX generator failed, falling back to html-to-docx:', error);
		}
	}

	// Fallback to html-to-docx
	await loadDependencies();

	if (!htmlToDocx) {
		throw new Error('html-to-docx library not available');
	}

	try {
		const docxBuffer = await htmlToDocx(html, null, {
			table: { row: { cantSplit: true } },
			footer: true,
			header: true,
			font: 'Calibri',
			fontSize: 11,
			complexScriptFont: 'Calibri',
			rightToLeft: false,
		});

		return new Uint8Array(docxBuffer);
	} catch (error) {
		throw new Error(`Failed to convert HTML to DOCX: ${error}`);
	}
}

export function sanitizeHtml(html: string): string {
	// Basic HTML sanitization for round-trip compatibility
	return html
		.replace(/<script[^>]*>.*?<\/script>/gi, '') // Remove scripts
		.replace(/<style[^>]*>.*?<\/style>/gi, '') // Remove styles
		.replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
		.replace(/javascript:/gi, '') // Remove javascript: URLs
		.replace(/<br\s*\/?>/gi, '\n') // Convert <br> to newlines for plain text compatibility
		.replace(/<\/p>/gi, '\n\n') // Convert </p> to double newlines
		.replace(/<p[^>]*>/gi, '') // Remove <p> tags
		.replace(/<div[^>]*>/gi, '') // Remove <div> tags
		.replace(/<\/div>/gi, '\n') // Convert </div> to newlines
		.trim();
}

export function normalizeHtmlForEditor(html: string): string {
	// Convert plain text newlines to HTML for editor display
	return html
		.replace(/\n\n/g, '</p><p>') // Double newlines to paragraph breaks
		.replace(/\n/g, '<br>') // Single newlines to line breaks
		.replace(/^/, '<p>') // Start with paragraph
		.replace(/$/, '</p>'); // End with paragraph
}

export function isWebEnvironment(): boolean {
	// Check if we're running in a web environment (no Node.js fs module)
	try {
		return typeof (globalThis as any).window !== 'undefined' && typeof (globalThis as any).require === 'undefined';
	} catch {
		return true;
	}
}

export async function readDocxFile(filePath: string): Promise<Uint8Array> {
	if (isWebEnvironment()) {
		throw new Error('File reading not available in web environment');
	}

	try {
		const buffer = fs.readFileSync(filePath);
		return new Uint8Array(buffer);
	} catch (error) {
		throw new Error(`Failed to read DOCX file: ${error}`);
	}
}

export async function writeDocxFile(filePath: string, buffer: Uint8Array): Promise<void> {
	if (isWebEnvironment()) {
		throw new Error('File writing not available in web environment');
	}

	try {
		fs.writeFileSync(filePath, buffer);
	} catch (error) {
		throw new Error(`Failed to write DOCX file: ${error}`);
	}
}

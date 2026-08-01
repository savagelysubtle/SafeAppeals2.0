/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import JSZip from 'jszip';

/**
 * Strip OOXML tags from document.xml and decode common entities into plain text.
 * Exported for unit tests.
 */
export function xmlToPlainText(xml: string): string {
	const withoutTags = xml
		.replace(/<w:tab\b[^/]*\/>/g, '\t')
		.replace(/<w:br\b[^/]*\/>/g, '\n')
		.replace(/<\/w:p>/g, '\n')
		.replace(/<[^>]+>/g, '');
	return decodeXmlEntities(withoutTags)
		.replace(/\r\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

function decodeXmlEntities(text: string): string {
	return text
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&apos;/g, '\'')
		.replace(/&amp;/g, '&');
}

/**
 * Extract plain text from a .docx zip (document.xml).
 */
export async function extractTextFromDocxBytes(bytes: Uint8Array): Promise<string> {
	const zip = await JSZip.loadAsync(bytes);
	const entry = zip.file('word/document.xml');
	if (!entry) {
		throw new Error('DOCX is missing word/document.xml');
	}
	const xml = await entry.async('string');
	return xmlToPlainText(xml);
}

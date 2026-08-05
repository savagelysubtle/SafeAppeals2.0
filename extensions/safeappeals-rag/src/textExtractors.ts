/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { CitationAnchor, IngestFidelity } from './types';

export interface TextExtractOk {
	readonly kind: 'ok';
	readonly markdown: string;
	readonly fidelity: IngestFidelity;
	readonly anchors: readonly CitationAnchor[];
}

export interface TextExtractUnsupported {
	readonly kind: 'unsupported';
	readonly reason: string;
}

export type TextExtractResult = TextExtractOk | TextExtractUnsupported;

function extensionOf(sourceUri: string): string {
	const pathPart = sourceUri.split(/[\\/]/).pop() ?? sourceUri;
	const dot = pathPart.lastIndexOf('.');
	return dot >= 0 ? pathPart.slice(dot + 1).toLowerCase() : '';
}

function decodeUtf8(bytes: Uint8Array): string {
	return Buffer.from(bytes).toString('utf8');
}

/** Minimal HTML → text/Markdown (tags stripped; entities left as-is for M1b). */
export function htmlToMarkdown(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<\/(p|div|h[1-6]|li|tr|br|hr)\s*>/gi, '\n')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<[^>]+>/g, ' ')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
}

/**
 * Non-PDF native extract: real simple readers for md/txt/html; docx stub.
 */
export function extractNonPdf(sourceUri: string, bytes: Uint8Array): TextExtractResult {
	const ext = extensionOf(sourceUri);
	const anchor: CitationAnchor = {
		sourceUri,
		charRange: { start: 0, end: 0 },
	};

	switch (ext) {
		case 'md':
		case 'markdown':
		case 'txt':
		case 'text': {
			const markdown = decodeUtf8(bytes);
			return {
				kind: 'ok',
				markdown,
				fidelity: 'native-text',
				anchors: [{ ...anchor, charRange: { start: 0, end: markdown.length } }],
			};
		}
		case 'html':
		case 'htm': {
			const markdown = htmlToMarkdown(decodeUtf8(bytes));
			return {
				kind: 'ok',
				markdown,
				fidelity: 'native-text',
				anchors: [{ ...anchor, charRange: { start: 0, end: markdown.length } }],
			};
		}
		case 'docx': {
			// TODO(M2): ZIP + word/document.xml reader without heavy deps, or converter lane.
			return {
				kind: 'unsupported',
				reason: 'DOCX extract is stubbed in M1b; wire a simple OOXML reader or converter path later.',
			};
		}
		default:
			return {
				kind: 'unsupported',
				reason: `Unsupported ingest format: .${ext || '(none)'}`,
			};
	}
}

export function isPdfUri(sourceUri: string): boolean {
	return extensionOf(sourceUri) === 'pdf';
}

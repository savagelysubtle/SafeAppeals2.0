/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { PageText } from './scannedDetect';

export interface DigitalPdfExtractOk {
	readonly kind: 'ok';
	readonly pages: readonly PageText[];
}

export interface DigitalPdfExtractUnavailable {
	readonly kind: 'unavailable';
	/** Clear TODO / reason — do not silently invent page text. */
	readonly reason: string;
}

export type DigitalPdfExtractResult = DigitalPdfExtractOk | DigitalPdfExtractUnavailable;

/**
 * Born-digital PDF text extract (pdfium / pdf-extract lane).
 * Injected so tests can fake pages without shipping PDFium in the EH.
 */
export interface IDigitalPdfExtractor {
	extract(sourceUri: string, bytes: Uint8Array): Promise<DigitalPdfExtractResult>;
}

/**
 * Default extractor until pdfium (or rag-core native extract) is wired.
 *
 * TODO(M1b-followup / M6): call pdfium or rag-core digital extract without adding
 * heavy EH deps. Converter’s Rust `pdf_extract` is sidecar-owned — do not pull it here.
 */
export class StubDigitalPdfExtractor implements IDigitalPdfExtractor {
	async extract(_sourceUri: string, _bytes: Uint8Array): Promise<DigitalPdfExtractResult> {
		return {
			kind: 'unavailable',
			reason:
				'TODO: wire pdfium / rag-core born-digital extract; digital extract unavailable in M1b stub',
		};
	}
}

/** Test / host helper: fixed page texts. */
export class FakeDigitalPdfExtractor implements IDigitalPdfExtractor {
	constructor(private readonly result: DigitalPdfExtractResult) { }

	async extract(_sourceUri: string, _bytes: Uint8Array): Promise<DigitalPdfExtractResult> {
		return this.result;
	}
}

/**
 * Join page texts into Markdown with page markers for citation anchors.
 */
export function pagesToMarkdown(sourceUri: string, pages: readonly PageText[]): {
	readonly markdown: string;
	readonly anchors: { sourceUri: string; page: number; charRange: { start: number; end: number } }[];
} {
	const parts: string[] = [];
	const anchors: { sourceUri: string; page: number; charRange: { start: number; end: number } }[] = [];
	let offset = 0;
	for (let i = 0; i < pages.length; i++) {
		const pageNum = i + 1;
		const heading = `<!-- page ${pageNum} -->\n`;
		const body = (pages[i]?.text ?? '').trimEnd();
		const chunk = `${heading}${body}${body.length ? '\n\n' : '\n'}`;
		const start = offset + heading.length;
		const end = start + body.length;
		parts.push(chunk);
		anchors.push({
			sourceUri,
			page: pageNum,
			charRange: { start, end },
		});
		offset += chunk.length;
	}
	return { markdown: parts.join('').trimEnd() + (parts.length ? '\n' : ''), anchors };
}

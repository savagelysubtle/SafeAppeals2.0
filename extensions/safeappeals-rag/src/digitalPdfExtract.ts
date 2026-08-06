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
 * Born-digital PDF text extract via sa-converter sidecar (pdf-extract lane).
 * Injected so tests can fake pages without shipping PDF libraries in the EH.
 */
export interface IDigitalPdfExtractor {
	extract(sourceUri: string, bytes: Uint8Array): Promise<DigitalPdfExtractResult>;
}

/**
 * Fallback when no {@link IDigitalPdfExtractor} is injected (unit tests only).
 */
export class StubDigitalPdfExtractor implements IDigitalPdfExtractor {
	async extract(_sourceUri: string, _bytes: Uint8Array): Promise<DigitalPdfExtractResult> {
		return {
			kind: 'unavailable',
			reason: 'Born-digital PDF extract is not configured (stub extractor).',
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

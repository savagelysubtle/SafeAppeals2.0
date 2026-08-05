/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { SCANNED_CHARS_PER_PAGE_THRESHOLD } from './types';

export interface PageText {
	readonly text: string;
}

export interface ScannedDetectResult {
	readonly scanned: boolean;
	readonly charsPerPage: number;
	readonly pageCount: number;
	readonly totalChars: number;
}

/**
 * Void-like scanned detection: average characters per page below ~50.
 * Empty or missing pages count as scanned (0 chars/page).
 */
export function detectScannedPdf(
	pages: readonly PageText[],
	threshold: number = SCANNED_CHARS_PER_PAGE_THRESHOLD,
): ScannedDetectResult {
	const pageCount = Math.max(pages.length, 1);
	const totalChars = pages.reduce((sum, page) => sum + (page.text?.length ?? 0), 0);
	const charsPerPage = totalChars / pageCount;
	return {
		scanned: charsPerPage < threshold,
		charsPerPage,
		pageCount,
		totalChars,
	};
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

export type PageRangeErrorCode = 'empty' | 'format' | 'order' | 'duplicate' | 'bounds';

const MAX_EXPANDED_PAGE_COUNT = 100_000;

export class PageRangeError extends Error {
	constructor(
		readonly code: PageRangeErrorCode,
		readonly value?: string,
		readonly pageCount?: number,
	) {
		super(code);
	}
}

/** Parse comma-separated pages and inclusive ranges into a normalized page list. */
export function parsePageRanges(input: string, pageCount?: number): number[] {
	const trimmed = input.trim();
	if (!trimmed) {
		throw new PageRangeError('empty');
	}

	const pages: number[] = [];
	for (const rawPart of trimmed.split(',')) {
		const part = rawPart.trim();
		const match = /^(?<start>[1-9]\d*)(?:\s*-\s*(?<end>[1-9]\d*))?$/.exec(part);
		if (!match?.groups) {
			throw new PageRangeError('format', part || rawPart);
		}
		const start = Number(match.groups.start);
		const end = match.groups.end === undefined ? start : Number(match.groups.end);
		if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
			throw new PageRangeError('format', part);
		}
		if (end < start) {
			throw new PageRangeError('order', part);
		}
		if (pageCount !== undefined && end > pageCount) {
			throw new PageRangeError('bounds', String(end), pageCount);
		}
		if (end - start + 1 > MAX_EXPANDED_PAGE_COUNT) {
			throw new PageRangeError('format', part);
		}
		for (let page = start; page <= end; page++) {
			pages.push(page);
		}
	}

	return normalizePageSelection(pages, pageCount);
}

/** Return no selection when an input prompt is cancelled; otherwise parse it strictly. */
export function parseOptionalPageRanges(input: string | undefined, pageCount?: number): number[] | undefined {
	return input === undefined ? undefined : parsePageRanges(input, pageCount);
}

/** Validate and normalize a page selection supplied by a non-text caller. */
export function normalizePageSelection(pages: readonly number[], pageCount?: number): number[] {
	if (pages.length === 0) {
		throw new PageRangeError('empty');
	}
	const seen = new Set<number>();
	for (const page of pages) {
		if (!Number.isSafeInteger(page) || page < 1) {
			throw new PageRangeError('format', String(page));
		}
		if (seen.has(page)) {
			throw new PageRangeError('duplicate', String(page));
		}
		if (pageCount !== undefined && page > pageCount) {
			throw new PageRangeError('bounds', String(page), pageCount);
		}
		seen.add(page);
	}
	return [...seen].sort((a, b) => a - b);
}

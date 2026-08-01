/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Approximate credit cost per search (mirrors void-cloud WEB_SEARCH_CREDIT_COST). */
export const WEB_SEARCH_CREDIT_COST = 250;

const MAX_QUERY_CHARS = 400;
const MIN_COUNT = 1;
const MAX_COUNT = 20;
const DEFAULT_COUNT = 10;
const MIN_OFFSET = 0;
const MAX_OFFSET = 9;
const MAX_QUERIES = 10;

/**
 * Single Brave web search hit (shared shape with Cloud API responses).
 */
export interface WebSearchResultItem {
	readonly title: string;
	readonly url: string;
	readonly description: string;
	readonly age?: string;
}

/**
 * Per-query block from multi web search.
 */
export interface MultiWebSearchQueryResult {
	readonly query: string;
	readonly results: readonly WebSearchResultItem[];
	readonly error?: string;
}

export interface SanitizedWebSearchInput {
	readonly query: string;
	readonly count: number;
	readonly offset: number;
}

export interface SanitizedMultiWebSearchInput {
	readonly queries: string[];
	readonly count: number;
}

/**
 * Clamps web-search args to SafeAppeals Cloud / Brave limits.
 */
export function sanitizeWebSearchInput(input: {
	readonly query?: unknown;
	readonly count?: unknown;
	readonly offset?: unknown;
}): SanitizedWebSearchInput | { readonly error: string } {
	if (typeof input.query !== 'string' || input.query.trim().length === 0) {
		return { error: 'query is required (non-empty string, max 400 characters).' };
	}
	const query = input.query.trim().slice(0, MAX_QUERY_CHARS);
	if (!query) {
		return { error: 'query is required (non-empty string, max 400 characters).' };
	}
	return {
		query,
		count: sanitizeCount(input.count),
		offset: sanitizeOffset(input.offset),
	};
}

/**
 * Clamps multi web-search args to SafeAppeals Cloud / Brave limits.
 */
export function sanitizeMultiWebSearchInput(input: {
	readonly queries?: unknown;
	readonly count?: unknown;
}): SanitizedMultiWebSearchInput | { readonly error: string } {
	if (!Array.isArray(input.queries)) {
		return { error: 'queries must be a non-empty array of 1–10 strings.' };
	}
	const queries = input.queries
		.filter((q): q is string => typeof q === 'string')
		.map(q => q.trim().slice(0, MAX_QUERY_CHARS))
		.filter(q => q.length > 0)
		.slice(0, MAX_QUERIES);
	if (queries.length === 0) {
		return { error: 'queries must be a non-empty array of 1–10 strings.' };
	}
	return {
		queries,
		count: sanitizeCount(input.count),
	};
}

function sanitizeCount(count: unknown): number {
	const n = typeof count === 'number' && Number.isFinite(count) ? Math.trunc(count) : DEFAULT_COUNT;
	return Math.max(MIN_COUNT, Math.min(MAX_COUNT, n || DEFAULT_COUNT));
}

function sanitizeOffset(offset: unknown): number {
	const n = typeof offset === 'number' && Number.isFinite(offset) ? Math.trunc(offset) : MIN_OFFSET;
	return Math.max(MIN_OFFSET, Math.min(MAX_OFFSET, n));
}

/**
 * Formats cloud web search results for LLM consumption (mirrors Void formatting).
 */
export function formatWebSearchResults(results: readonly WebSearchResultItem[]): string {
	if (results.length === 0) {
		return 'No results found.';
	}

	return results.map((result, index) => {
		const parts = [
			`${index + 1}. **${result.title}**`,
			`   URL: ${result.url}`,
			`   ${result.description}`,
		];
		if (result.age) {
			parts.push(`   Published: ${result.age}`);
		}
		return parts.join('\n');
	}).join('\n\n');
}

/**
 * Formats multi-link search results for LLM consumption (mirrors Void formatting).
 */
export function formatMultiWebSearchResults(searchResults: readonly MultiWebSearchQueryResult[]): string {
	return searchResults.map(search => {
		const header = `## Search: "${search.query}"`;
		if (search.error) {
			return `${header}\n\n❌ Error: ${search.error}`;
		}
		if (!search.results || search.results.length === 0) {
			return `${header}\n\nNo results found.`;
		}
		return `${header}\n\n${formatWebSearchResults(search.results)}`;
	}).join('\n\n---\n\n');
}

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
const MIN_AUTO_FETCH = 1;
const MAX_AUTO_FETCH = 5;

const SAFESEARCH_VALUES = new Set(['off', 'moderate', 'strict']);
const FRESHNESS_ALIASES: Readonly<Record<string, string>> = {
	pd: 'pd',
	pw: 'pw',
	pm: 'pm',
	py: 'py',
	past_day: 'pd',
	past_week: 'pw',
	past_month: 'pm',
	past_year: 'py',
};
const FRESHNESS_RANGE_RE = /^\d{4}-\d{2}-\d{2}to\d{4}-\d{2}-\d{2}$/i;
const COUNTRY_RE = /^(ALL|[A-Za-z]{2})$/;
const SEARCH_LANG_RE = /^[A-Za-z]{2,}$/;
const UI_LANG_RE = /^[A-Za-z]{2,}(-[A-Za-z]{2,})?$/;

/**
 * Single Brave web search hit (shared shape with Cloud API responses).
 * No AI summary fields — the agent reads snippets / fetched page text.
 */
export interface WebSearchResultItem {
	readonly title: string;
	readonly url: string;
	readonly description: string;
	readonly age?: string;
	readonly thumbnail?: string;
	readonly domain?: string;
	readonly extra_snippets?: readonly string[];
}

/**
 * Per-query block from multi web search.
 */
export interface MultiWebSearchQueryResult {
	readonly query: string;
	readonly results: readonly WebSearchResultItem[];
	readonly error?: string;
}

/** Optional Brave filters shared by single and multi search. */
export interface WebSearchFilterFields {
	readonly safesearch: 'off' | 'moderate' | 'strict';
	readonly freshness?: string;
	readonly country?: string;
	readonly search_lang?: string;
	readonly ui_lang?: string;
	readonly site?: string;
}

export interface SanitizedWebSearchInput extends WebSearchFilterFields {
	readonly query: string;
	readonly count: number;
	readonly offset: number;
	/** When set (1–5), tools fetch raw page text for the top N result URLs. */
	readonly autoFetch?: number;
}

export interface SanitizedMultiWebSearchInput extends WebSearchFilterFields {
	readonly queries: string[];
	readonly count: number;
}

/**
 * Maps freshness aliases (past_day → pd, etc.) and validates Brave-supported values.
 */
export function sanitizeFreshness(freshness: unknown): string | undefined {
	if (typeof freshness !== 'string') {
		return undefined;
	}
	const trimmed = freshness.trim();
	if (!trimmed) {
		return undefined;
	}
	const alias = FRESHNESS_ALIASES[trimmed.toLowerCase()];
	if (alias) {
		return alias;
	}
	if (FRESHNESS_RANGE_RE.test(trimmed)) {
		return trimmed;
	}
	return undefined;
}

/**
 * Returns a Brave safesearch value (default moderate).
 */
export function sanitizeSafesearch(safesearch: unknown): 'off' | 'moderate' | 'strict' {
	if (typeof safesearch === 'string') {
		const v = safesearch.trim().toLowerCase();
		if (SAFESEARCH_VALUES.has(v)) {
			return v as 'off' | 'moderate' | 'strict';
		}
	}
	return 'moderate';
}

/**
 * Appends `site:{domain}` when site is set and the query does not already contain site:.
 */
export function applySiteFilter(query: string, site: unknown): string {
	if (typeof site !== 'string') {
		return query;
	}
	let domain = site.trim();
	if (!domain) {
		return query;
	}
	domain = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '');
	if (!domain || /\s/.test(domain)) {
		return query;
	}
	if (/\bsite:/i.test(query)) {
		return query;
	}
	return `${query} site:${domain}`.slice(0, MAX_QUERY_CHARS);
}

function sanitizeCountry(country: unknown): string | undefined {
	if (typeof country !== 'string') {
		return undefined;
	}
	const v = country.trim();
	if (!COUNTRY_RE.test(v)) {
		return undefined;
	}
	return v.toUpperCase() === 'ALL' ? 'ALL' : v.toUpperCase();
}

function sanitizeSearchLang(lang: unknown): string | undefined {
	if (typeof lang !== 'string') {
		return undefined;
	}
	const v = lang.trim();
	if (!SEARCH_LANG_RE.test(v)) {
		return undefined;
	}
	return v.toLowerCase();
}

function sanitizeUiLang(lang: unknown): string | undefined {
	if (typeof lang !== 'string') {
		return undefined;
	}
	const v = lang.trim();
	if (!UI_LANG_RE.test(v)) {
		return undefined;
	}
	const parts = v.split('-');
	if (parts.length === 1) {
		return parts[0].toLowerCase();
	}
	return `${parts[0].toLowerCase()}-${parts[1].toUpperCase()}`;
}

function sanitizeAutoFetch(autoFetch: unknown): number | undefined {
	if (typeof autoFetch !== 'number' || !Number.isFinite(autoFetch)) {
		return undefined;
	}
	const n = Math.trunc(autoFetch);
	if (n < MIN_AUTO_FETCH) {
		return undefined;
	}
	return Math.min(MAX_AUTO_FETCH, n);
}

function sanitizeSite(site: unknown): string | undefined {
	if (typeof site !== 'string') {
		return undefined;
	}
	let domain = site.trim();
	if (!domain) {
		return undefined;
	}
	domain = domain.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').replace(/^www\./i, '');
	if (!domain || /\s/.test(domain)) {
		return undefined;
	}
	return domain;
}

function sanitizeFilters(input: {
	readonly safesearch?: unknown;
	readonly freshness?: unknown;
	readonly country?: unknown;
	readonly search_lang?: unknown;
	readonly ui_lang?: unknown;
	readonly site?: unknown;
}): WebSearchFilterFields {
	const freshness = sanitizeFreshness(input.freshness);
	const country = sanitizeCountry(input.country);
	const search_lang = sanitizeSearchLang(input.search_lang);
	const ui_lang = sanitizeUiLang(input.ui_lang);
	const site = sanitizeSite(input.site);
	return {
		safesearch: sanitizeSafesearch(input.safesearch),
		...(freshness ? { freshness } : {}),
		...(country ? { country } : {}),
		...(search_lang ? { search_lang } : {}),
		...(ui_lang ? { ui_lang } : {}),
		...(site ? { site } : {}),
	};
}

/**
 * Clamps web-search args to SafeAppeals Cloud / Brave limits.
 */
export function sanitizeWebSearchInput(input: {
	readonly query?: unknown;
	readonly count?: unknown;
	readonly offset?: unknown;
	readonly safesearch?: unknown;
	readonly freshness?: unknown;
	readonly country?: unknown;
	readonly search_lang?: unknown;
	readonly ui_lang?: unknown;
	readonly site?: unknown;
	readonly autoFetch?: unknown;
}): SanitizedWebSearchInput | { readonly error: string } {
	if (typeof input.query !== 'string' || input.query.trim().length === 0) {
		return { error: 'query is required (non-empty string, max 400 characters).' };
	}
	const filters = sanitizeFilters(input);
	let query = input.query.trim().slice(0, MAX_QUERY_CHARS);
	query = applySiteFilter(query, filters.site);
	if (!query) {
		return { error: 'query is required (non-empty string, max 400 characters).' };
	}
	const autoFetch = sanitizeAutoFetch(input.autoFetch);
	return {
		query,
		count: sanitizeCount(input.count),
		offset: sanitizeOffset(input.offset),
		...filters,
		...(autoFetch !== undefined ? { autoFetch } : {}),
	};
}

/**
 * Clamps multi web-search args to SafeAppeals Cloud / Brave limits.
 */
export function sanitizeMultiWebSearchInput(input: {
	readonly queries?: unknown;
	readonly count?: unknown;
	readonly safesearch?: unknown;
	readonly freshness?: unknown;
	readonly country?: unknown;
	readonly search_lang?: unknown;
	readonly ui_lang?: unknown;
	readonly site?: unknown;
}): SanitizedMultiWebSearchInput | { readonly error: string } {
	if (!Array.isArray(input.queries)) {
		return { error: 'queries must be a non-empty array of 1–10 strings.' };
	}
	const filters = sanitizeFilters(input);
	const queries = input.queries
		.filter((q): q is string => typeof q === 'string')
		.map(q => applySiteFilter(q.trim().slice(0, MAX_QUERY_CHARS), filters.site))
		.filter(q => q.length > 0)
		.slice(0, MAX_QUERIES);
	if (queries.length === 0) {
		return { error: 'queries must be a non-empty array of 1–10 strings.' };
	}
	return {
		queries,
		count: sanitizeCount(input.count),
		...filters,
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
 * Coerce a credit count from camelCase or snake_case API fields.
 */
export function coerceCreditCount(value: unknown): number | undefined {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}
	if (typeof value === 'string' && value.trim() !== '') {
		const n = Number(value);
		if (Number.isFinite(n)) {
			return n;
		}
	}
	return undefined;
}

/**
 * Credits footer always appended to web-search tool results.
 * Accepts camelCase or snake_case fields from cloud responses.
 */
export function formatCreditsFooter(
	creditsUsed: unknown,
	creditsRemaining: unknown,
): string {
	const used = coerceCreditCount(creditsUsed);
	const remaining = coerceCreditCount(creditsRemaining);
	const usedText = used !== undefined ? String(used) : '?';
	const remainingText = remaining !== undefined ? String(remaining) : '?';
	return `\n\n---\nCredits used: ${usedText}. Credits remaining: ${remainingText}.`;
}

/**
 * Normalize a raw cloud/Brave result item into the formatter shape.
 * Maps page_age → age and keeps thumbnail/domain/extra_snippets when present.
 */
export function normalizeWebSearchResultItem(raw: unknown): WebSearchResultItem {
	const r = (raw && typeof raw === 'object') ? raw as Record<string, unknown> : {};
	const age = typeof r.age === 'string' && r.age
		? r.age
		: (typeof r.page_age === 'string' && r.page_age ? r.page_age : undefined);
	const thumbnail = typeof r.thumbnail === 'string' && r.thumbnail ? r.thumbnail : undefined;
	const domain = typeof r.domain === 'string' && r.domain ? r.domain : undefined;
	const extra = Array.isArray(r.extra_snippets)
		? r.extra_snippets.filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
		: undefined;
	return {
		title: typeof r.title === 'string' ? r.title : 'No title',
		url: typeof r.url === 'string' ? r.url : '',
		description: typeof r.description === 'string' ? r.description : '',
		...(age ? { age } : {}),
		...(thumbnail ? { thumbnail } : {}),
		...(domain ? { domain } : {}),
		...(extra && extra.length > 0 ? { extra_snippets: extra } : {}),
	};
}

/**
 * Formats cloud web search results for LLM consumption (raw metadata only — no AI summary).
 */
export function formatWebSearchResults(results: readonly WebSearchResultItem[]): string {
	if (results.length === 0) {
		return 'No results found.';
	}

	return results.map((raw, index) => {
		const result = normalizeWebSearchResultItem(raw);
		const parts = [
			`${index + 1}. **${result.title}**`,
			`   URL: ${result.url}`,
			`   ${result.description}`,
		];
		if (result.age) {
			parts.push(`   Published: ${result.age}`);
		}
		if (result.domain) {
			parts.push(`   Domain: ${result.domain}`);
		}
		if (result.thumbnail) {
			parts.push(`   Thumbnail: ${result.thumbnail}`);
		}
		if (result.extra_snippets && result.extra_snippets.length > 0) {
			parts.push('   Extra snippets:');
			for (const snippet of result.extra_snippets) {
				parts.push(`   - ${snippet}`);
			}
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

/**
 * Full single-search tool body: results + credits footer (always).
 */
export function formatWebSearchToolBody(
	results: readonly WebSearchResultItem[] | undefined,
	creditsUsed: unknown,
	creditsRemaining: unknown,
	extraSections = '',
): string {
	const body = formatWebSearchResults(results ?? []);
	return `${body}${extraSections}${formatCreditsFooter(creditsUsed, creditsRemaining)}`;
}

/**
 * Full multi-search tool body: results + credits footer (always).
 */
export function formatMultiWebSearchToolBody(
	searchResults: readonly MultiWebSearchQueryResult[] | undefined,
	totalCreditsUsed: unknown,
	creditsRemaining: unknown,
): string {
	const body = formatMultiWebSearchResults(searchResults ?? []);
	return `${body}${formatCreditsFooter(totalCreditsUsed, creditsRemaining)}`;
}

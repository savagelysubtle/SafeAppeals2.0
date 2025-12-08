/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { WebSearchResult, MultiSearchResult } from '../../common/tools/toolsServiceTypes.js';

// Brave API configuration
const BRAVE_API_BASE_URL = 'https://api.search.brave.com/res/v1/web/search';

// Rate limiting for Brave Free Tier (1 req/sec, 2000/month)
const RATE_LIMIT = {
	perSecond: 1,
	minDelayMs: 1100, // Slightly over 1 second to be safe
};

let lastRequestTime = 0;

/**
 * Enforces rate limiting by waiting if necessary
 */
async function enforceRateLimit(): Promise<void> {
	const now = Date.now();
	const timeSinceLastRequest = now - lastRequestTime;

	if (timeSinceLastRequest < RATE_LIMIT.minDelayMs) {
		const waitTime = RATE_LIMIT.minDelayMs - timeSinceLastRequest;
		await new Promise(resolve => setTimeout(resolve, waitTime));
	}

	lastRequestTime = Date.now();
}

/**
 * Brave Search API response types
 */
interface BraveSearchResponse {
	query: { original: string };
	mixed?: { main?: Array<{ type: string; index?: number }> };
	web?: {
		results: Array<{
			title: string;
			url: string;
			description: string;
			age?: string;
			page_age?: string;
		}>;
	};
	news?: {
		results: Array<{
			title: string;
			url: string;
			description: string;
			age?: string;
		}>;
	};
}

/**
 * Performs a single Brave web search
 * @param apiKey Brave Search API key
 * @param query Search query (max 400 chars, 50 words)
 * @param count Number of results (1-20, default 10)
 * @param offset Pagination offset (0-9, default 0)
 */
export async function braveWebSearch(
	apiKey: string,
	query: string,
	count: number = 10,
	offset: number = 0
): Promise<{ results: WebSearchResult[], totalResults: number }> {
	if (!apiKey) {
		throw new Error('Brave Search API key is required. Configure it in Settings > Web Search.');
	}

	// Validate and sanitize inputs
	const sanitizedQuery = query.slice(0, 400).trim();
	const sanitizedCount = Math.max(1, Math.min(20, count || 10));
	const sanitizedOffset = Math.max(0, Math.min(9, offset || 0));

	// Enforce rate limit
	await enforceRateLimit();

	const url = new URL(BRAVE_API_BASE_URL);
	url.searchParams.set('q', sanitizedQuery);
	url.searchParams.set('count', sanitizedCount.toString());
	url.searchParams.set('offset', sanitizedOffset.toString());
	url.searchParams.set('safesearch', 'moderate');

	const response = await fetch(url.toString(), {
		method: 'GET',
		headers: {
			'Accept': 'application/json',
			'Accept-Encoding': 'gzip',
			'X-Subscription-Token': apiKey,
		},
	});

	if (!response.ok) {
		if (response.status === 401) {
			throw new Error('Invalid Brave Search API key. Please check your API key in Settings.');
		}
		if (response.status === 429) {
			throw new Error('Brave Search rate limit exceeded. Please try again later.');
		}
		throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
	}

	const data: BraveSearchResponse = await response.json();

	// Extract web results
	const webResults = data.web?.results || [];
	const results: WebSearchResult[] = webResults.map(result => ({
		title: result.title,
		url: result.url,
		description: result.description,
		age: result.age || result.page_age,
	}));

	return {
		results,
		totalResults: results.length,
	};
}

/**
 * Performs multiple sequential searches with rate limiting
 * @param apiKey Brave Search API key
 * @param queries Array of search queries (1-10 items)
 * @param count Number of results per query (1-20, default 10)
 */
export async function braveMultiLinkSearch(
	apiKey: string,
	queries: string[],
	count: number = 10
): Promise<{ searchResults: MultiSearchResult[] }> {
	if (!apiKey) {
		throw new Error('Brave Search API key is required. Configure it in Settings > Web Search.');
	}

	// Validate queries (max 10)
	const sanitizedQueries = queries.slice(0, 10);

	if (sanitizedQueries.length === 0) {
		throw new Error('At least one search query is required.');
	}

	const searchResults: MultiSearchResult[] = [];

	// Execute searches sequentially with rate limiting
	for (const query of sanitizedQueries) {
		try {
			const { results } = await braveWebSearch(apiKey, query, count, 0);
			searchResults.push({
				query,
				results,
			});
		} catch (error) {
			// Continue with other queries even if one fails
			searchResults.push({
				query,
				results: [],
				error: error instanceof Error ? error.message : 'Unknown error',
			});
		}
	}

	return { searchResults };
}

/**
 * Formats web search results as a readable string for LLM consumption
 */
export function formatWebSearchResults(results: WebSearchResult[]): string {
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
 * Formats multi-link search results as a readable string
 */
export function formatMultiSearchResults(searchResults: MultiSearchResult[]): string {
	return searchResults.map(search => {
		const header = `## Search: "${search.query}"`;
		if (search.error) {
			return `${header}\n\n❌ Error: ${search.error}`;
		}
		if (search.results.length === 0) {
			return `${header}\n\nNo results found.`;
		}
		return `${header}\n\n${formatWebSearchResults(search.results)}`;
	}).join('\n\n---\n\n');
}


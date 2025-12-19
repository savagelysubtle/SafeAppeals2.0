/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { WebSearchResult, MultiSearchResult } from '../../common/tools/toolsServiceTypes.js';

// Cloud Web Search configuration
const CLOUD_WEB_SEARCH_TIMEOUT_MS = 30000; // 30 second timeout

// Credit costs for web search (in credits)
const WEB_SEARCH_CREDIT_COST = 5; // 5 credits per web search request

/**
 * Cloud Web Search API response types
 */
interface CloudWebSearchResponse {
	results: WebSearchResult[];
	totalResults: number;
	creditsUsed: number;
	creditsRemaining: number;
}

interface CloudMultiSearchResponse {
	searchResults: MultiSearchResult[];
	totalCreditsUsed: number;
	creditsRemaining: number;
}

/**
 * Cloud Web Search Service
 *
 * Routes web search requests through SafeAppeals Cloud API instead of direct Brave Search calls.
 * Handles credit deduction and usage tracking.
 */
export class CloudWebSearchService {
	private cloudApiUrl: string;

	constructor(cloudApiUrl: string) {
		this.cloudApiUrl = cloudApiUrl;
	}

	/**
	 * Performs a single cloud web search
	 * @param userToken Cloud authentication token
	 * @param query Search query (max 400 chars, 50 words)
	 * @param count Number of results (1-20, default 10)
	 * @param offset Pagination offset (0-9, default 0)
	 */
	async cloudWebSearch(
		userToken: string,
		query: string,
		count: number = 10,
		offset: number = 0
	): Promise<{ results: WebSearchResult[], totalResults: number, creditsUsed: number, creditsRemaining: number }> {
		if (!userToken) {
			throw new Error('Cloud authentication required for web search. Please sign in to SafeAppeals Cloud.');
		}

		// Validate and sanitize inputs
		const sanitizedQuery = query.slice(0, 400).trim();
		const sanitizedCount = Math.max(1, Math.min(20, count || 10));
		const sanitizedOffset = Math.max(0, Math.min(9, offset || 0));

		const requestBody = {
			query: sanitizedQuery,
			count: sanitizedCount,
			offset: sanitizedOffset,
		};

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), CLOUD_WEB_SEARCH_TIMEOUT_MS);

		const response = await fetch(`${this.cloudApiUrl}/web-search`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${userToken}`,
			},
			body: JSON.stringify(requestBody),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Cloud authentication expired. Please sign in again.');
			}
			if (response.status === 402) {
				throw new Error('Insufficient credits for web search. Please purchase more credits.');
			}
			if (response.status === 429) {
				throw new Error('Web search rate limit exceeded. Please try again later.');
			}
			throw new Error(`Cloud web search failed: ${response.status} ${response.statusText}`);
		}

		const data: CloudWebSearchResponse = await response.json();

		return {
			results: data.results,
			totalResults: data.totalResults,
			creditsUsed: data.creditsUsed,
			creditsRemaining: data.creditsRemaining,
		};
	}

	/**
	 * Performs multiple sequential cloud web searches
	 * @param userToken Cloud authentication token
	 * @param queries Array of search queries (1-10 items)
	 * @param count Number of results per query (1-20, default 10)
	 */
	async cloudMultiWebSearch(
		userToken: string,
		queries: string[],
		count: number = 10
	): Promise<{ searchResults: MultiSearchResult[], totalCreditsUsed: number, creditsRemaining: number }> {
		if (!userToken) {
			throw new Error('Cloud authentication required for web search. Please sign in to SafeAppeals Cloud.');
		}

		// Validate queries (max 10)
		const sanitizedQueries = queries.slice(0, 10);

		if (sanitizedQueries.length === 0) {
			throw new Error('At least one search query is required.');
		}

		const requestBody = {
			queries: sanitizedQueries,
			count: Math.max(1, Math.min(20, count || 10)),
		};

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), CLOUD_WEB_SEARCH_TIMEOUT_MS);

		const response = await fetch(`${this.cloudApiUrl}/web-search/multi`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${userToken}`,
			},
			body: JSON.stringify(requestBody),
			signal: controller.signal,
		});

		clearTimeout(timeoutId);

		if (!response.ok) {
			if (response.status === 401) {
				throw new Error('Cloud authentication expired. Please sign in again.');
			}
			if (response.status === 402) {
				throw new Error('Insufficient credits for web search. Please purchase more credits.');
			}
			if (response.status === 429) {
				throw new Error('Web search rate limit exceeded. Please try again later.');
			}
			throw new Error(`Cloud multi web search failed: ${response.status} ${response.statusText}`);
		}

		const data: CloudMultiSearchResponse = await response.json();

		return {
			searchResults: data.searchResults,
			totalCreditsUsed: data.totalCreditsUsed,
			creditsRemaining: data.creditsRemaining,
		};
	}

	/**
	 * Get the credit cost for web search operations
	 */
	getCreditCost(): number {
		return WEB_SEARCH_CREDIT_COST;
	}

	/**
	 * Check if user has sufficient credits for a web search operation
	 */
	hasSufficientCredits(userCredits: number, operationCount: number = 1): boolean {
		return userCredits >= (WEB_SEARCH_CREDIT_COST * operationCount);
	}
}

/**
 * Formats cloud web search results as a readable string for LLM consumption
 */
export function formatCloudWebSearchResults(results: WebSearchResult[]): string {
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
 * Formats cloud multi-link search results as a readable string
 */
export function formatCloudMultiSearchResults(searchResults: MultiSearchResult[]): string {
	return searchResults.map(search => {
		const header = `## Search: "${search.query}"`;
		if (search.error) {
			return `${header}\n\n❌ Error: ${search.error}`;
		}
		if (search.results.length === 0) {
			return `${header}\n\nNo results found.`;
		}
		return `${header}\n\n${formatCloudWebSearchResults(search.results)}`;
	}).join('\n\n---\n\n');
}

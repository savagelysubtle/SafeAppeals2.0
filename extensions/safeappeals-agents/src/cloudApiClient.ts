/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Minimal interface for the SafeAppeals Cloud API client.
 * Used by agent tools that need to make authenticated API calls.
 */
export interface ICloudApiClient {
	/**
	 * Runs a single web search via SafeAppeals Cloud.
	 */
	webSearch(body: WebSearchRequestBody): Promise<WebSearchResponse>;

	/**
	 * Runs multiple web searches via SafeAppeals Cloud.
	 */
	multiWebSearch(body: MultiWebSearchRequestBody): Promise<MultiWebSearchResponse>;
}

/**
 * Request body for single web search.
 */
export interface WebSearchRequestBody {
	query: string;
	count?: number;
	offset?: number;
	safesearch?: 'off' | 'moderate' | 'strict';
	freshness?: string;
	country?: string;
	search_lang?: string;
	ui_lang?: string;
	site?: string;
	autoFetch?: number;
}

/**
 * Response from single web search.
 */
export interface WebSearchResponse {
	results: WebSearchResult[];
	query: string;
	creditsUsed?: number;
	creditsRemaining?: number;
}

/**
 * Individual web search result.
 */
export interface WebSearchResult {
	url: string;
	title: string;
	description: string;
	age?: string;
	pageAge?: string;
	language?: string;
	familyFriendly?: boolean;
}

/**
 * Request body for multi web search.
 */
export interface MultiWebSearchRequestBody {
	queries: string[];
	count?: number;
	safesearch?: 'off' | 'moderate' | 'strict';
	freshness?: string;
	country?: string;
	search_lang?: string;
	ui_lang?: string;
	site?: string;
}

/**
 * Response from multi web search.
 */
export interface MultiWebSearchResponse {
	results: MultiWebSearchResult[];
	creditsUsed?: number;
	creditsRemaining?: number;
	totalCreditsUsed?: number;
	searchResults?: MultiWebSearchResult[];
}

/**
 * Individual multi web search result.
 */
export interface MultiWebSearchResult {
	query: string;
	results: WebSearchResult[];
}

/**
 * Error thrown when Cloud API returns authentication error.
 */
export class CloudAuthError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'CloudAuthError';
	}
}

/**
 * Error thrown when Cloud API returns insufficient credits.
 */
export class InsufficientCreditsError extends Error {
	constructor(
		message: string,
		public readonly creditsRequired: number,
		public readonly creditsAvailable: number,
	) {
		super(message);
		this.name = 'InsufficientCreditsError';
	}
}
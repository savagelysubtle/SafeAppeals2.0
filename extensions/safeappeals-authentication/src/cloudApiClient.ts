/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type {
	WebSearchRequestBody,
	WebSearchResponse,
	MultiWebSearchRequestBody,
	MultiWebSearchResponse,
} from './api';

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
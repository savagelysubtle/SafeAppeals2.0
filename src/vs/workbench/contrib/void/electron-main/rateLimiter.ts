/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILogService } from '../../../../platform/log/common/log.js';

export interface RateLimitConfig {
	requestsPerMinute: number;
	tokensPerMinute?: number;
	maxRetries: number;
	retryDelayMs: number;
}

export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
	anthropic: {
		requestsPerMinute: 50,
		tokensPerMinute: 40000, // Conservative for free/build tier
		maxRetries: 3,
		retryDelayMs: 1000
	},
	openai: {
		requestsPerMinute: 500,
		tokensPerMinute: 150000, // Tier 1 default
		maxRetries: 3,
		retryDelayMs: 1000
	},
	gemini: {
		requestsPerMinute: 15,
		tokensPerMinute: 32000, // Free tier
		maxRetries: 3,
		retryDelayMs: 1000
	},
	openRouter: {
		requestsPerMinute: 200,
		tokensPerMinute: 100000,
		maxRetries: 3,
		retryDelayMs: 1000
	},
	default: {
		requestsPerMinute: 50,
		tokensPerMinute: 40000,
		maxRetries: 3,
		retryDelayMs: 1000
	}
};

interface RequestRecord {
	timestamp: number;
	tokens?: number;
}

/**
 * Rate limiter for LLM provider API calls
 * Tracks requests per minute and tokens per minute
 * Implements exponential backoff for retries
 */
export class RateLimiter {
	private requestHistory: Map<string, RequestRecord[]> = new Map();
	private lastRequestTime: Map<string, number> = new Map();

	constructor(
		private readonly logService: ILogService
	) { }

	/**
	 * Wait if necessary to respect rate limits, then record the request
	 */
	async checkRateLimit(provider: string, estimatedTokens?: number): Promise<void> {
		const config = DEFAULT_RATE_LIMITS[provider] || DEFAULT_RATE_LIMITS.default;
		const now = Date.now();
		const oneMinuteAgo = now - 60000;

		// Get or initialize request history for this provider
		let history = this.requestHistory.get(provider);
		if (!history) {
			history = [];
			this.requestHistory.set(provider, history);
		}

		// Remove requests older than 1 minute
		const recentRequests = history.filter(r => r.timestamp > oneMinuteAgo);
		this.requestHistory.set(provider, recentRequests);

		// Check request rate limit
		if (recentRequests.length >= config.requestsPerMinute) {
			const oldestRequest = recentRequests[0];
			const waitTime = 60000 - (now - oldestRequest.timestamp) + 100; // +100ms buffer

			this.logService.warn(`[RateLimiter] ${provider}: Request rate limit reached (${config.requestsPerMinute}/min). Waiting ${waitTime}ms...`);
			await this.sleep(waitTime);
			return this.checkRateLimit(provider, estimatedTokens); // Recheck after waiting
		}

		// Check token rate limit (if applicable)
		if (estimatedTokens && config.tokensPerMinute) {
			const tokenSum = recentRequests.reduce((sum, r) => sum + (r.tokens || 0), 0);

			if (tokenSum + estimatedTokens > config.tokensPerMinute) {
				const oldestRequest = recentRequests[0];
				const waitTime = 60000 - (now - oldestRequest.timestamp) + 100;

				this.logService.warn(`[RateLimiter] ${provider}: Token rate limit approaching (${tokenSum}/${config.tokensPerMinute} TPM). Waiting ${waitTime}ms...`);
				await this.sleep(waitTime);
				return this.checkRateLimit(provider, estimatedTokens);
			}
		}

		// Enforce minimum delay between requests (prevent burst)
		const lastRequest = this.lastRequestTime.get(provider) || 0;
		const minDelay = 60000 / config.requestsPerMinute; // Spread requests evenly
		const timeSinceLastRequest = now - lastRequest;

		if (timeSinceLastRequest < minDelay) {
			const delay = minDelay - timeSinceLastRequest;
			this.logService.info(`[RateLimiter] ${provider}: Spacing request (+${delay}ms delay)`);
			await this.sleep(delay);
		}

		// Record this request
		const newTimestamp = Date.now();
		recentRequests.push({
			timestamp: newTimestamp,
			tokens: estimatedTokens
		});
		this.lastRequestTime.set(provider, newTimestamp);

		this.logService.info(`[RateLimiter] ${provider}: Request allowed (${recentRequests.length}/${config.requestsPerMinute} requests in last minute)`);
	}

	/**
	 * Handle rate limit error with exponential backoff
	 */
	async handleRateLimitError(provider: string, retryCount: number): Promise<boolean> {
		const config = DEFAULT_RATE_LIMITS[provider] || DEFAULT_RATE_LIMITS.default;

		if (retryCount >= config.maxRetries) {
			this.logService.error(`[RateLimiter] ${provider}: Max retries (${config.maxRetries}) exceeded`);
			return false; // Don't retry
		}

		const backoffDelay = config.retryDelayMs * Math.pow(2, retryCount); // Exponential backoff
		this.logService.warn(`[RateLimiter] ${provider}: Rate limit hit, retrying in ${backoffDelay}ms (attempt ${retryCount + 1}/${config.maxRetries})...`);

		await this.sleep(backoffDelay);
		return true; // Retry
	}

	/**
	 * Clear history for a provider (useful for testing or reset)
	 */
	clearHistory(provider: string): void {
		this.requestHistory.delete(provider);
		this.lastRequestTime.delete(provider);
		this.logService.info(`[RateLimiter] ${provider}: History cleared`);
	}

	/**
	 * Get current rate limit status for a provider
	 */
	getStatus(provider: string): { recentRequests: number; limit: number; tokensUsed?: number; tokenLimit?: number } {
		const config = DEFAULT_RATE_LIMITS[provider] || DEFAULT_RATE_LIMITS.default;
		const now = Date.now();
		const oneMinuteAgo = now - 60000;

		const history = this.requestHistory.get(provider) || [];
		const recentRequests = history.filter(r => r.timestamp > oneMinuteAgo);
		const tokensUsed = recentRequests.reduce((sum, r) => sum + (r.tokens || 0), 0);

		return {
			recentRequests: recentRequests.length,
			limit: config.requestsPerMinute,
			tokensUsed,
			tokenLimit: config.tokensPerMinute
		};
	}

	private sleep(ms: number): Promise<void> {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

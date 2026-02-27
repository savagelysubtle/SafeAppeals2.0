/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	REDDIT_USER_AGENT,
	REDDIT_TOKEN_URL,
	REDDIT_API_BASE,
} from '../../common/growthWriter/growthWriterConfig.js';

interface RedditTokens {
	accessToken: string
	expiresAt: number
}

interface RedditCredentials {
	clientId: string
	clientSecret: string
	username: string
	password: string
}

export interface RedditListing<T> {
	kind: 'Listing'
	data: {
		after: string | null
		before: string | null
		children: Array<{ kind: string; data: T }>
		dist: number
	}
}

export interface RedditPostData {
	id: string
	name: string
	subreddit: string
	title: string
	selftext: string
	url: string
	score: number
	num_comments: number
	created_utc: number
	author: string
	permalink: string
}

export interface RedditCommentData {
	id: string
	name: string
	body: string
	author: string
	score: number
	created_utc: number
	parent_id: string
	link_id: string
	removed_by_category: string | null
}

export interface RedditMeData {
	name: string
	comment_karma: number
	link_karma: number
	total_karma: number
	created_utc: number
	has_verified_email: boolean
}

export class RedditClient {
	private tokens: RedditTokens | null = null
	private credentials: RedditCredentials | null = null
	private rateLimitRemaining: number = 60
	private rateLimitReset: number = 0

	constructor(
		private readonly logService: ILogService,
	) {}

	async authenticate(clientId: string, clientSecret: string, username: string, password: string): Promise<void> {
		this.credentials = { clientId, clientSecret, username, password }
		await this.fetchToken()
	}

	setCredentials(credentials: RedditCredentials): void {
		this.credentials = credentials
	}

	isAuthenticated(): boolean {
		return this.tokens !== null && Date.now() < this.tokens.expiresAt - 60_000
	}

	private async fetchToken(): Promise<void> {
		if (!this.credentials) {
			throw new Error('RedditClient: No credentials set. Call authenticate() first.')
		}

		const { clientId, clientSecret, username, password } = this.credentials
		const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

		this.logService.info('[RedditClient] Authenticating with Reddit API...')

		const response = await fetch(REDDIT_TOKEN_URL, {
			method: 'POST',
			headers: {
				'Authorization': `Basic ${basicAuth}`,
				'Content-Type': 'application/x-www-form-urlencoded',
				'User-Agent': REDDIT_USER_AGENT,
			},
			body: new URLSearchParams({
				grant_type: 'password',
				username,
				password,
			}).toString(),
		})

		if (!response.ok) {
			const body = await response.text().catch(() => '')
			throw new Error(`Reddit auth failed (${response.status}): ${body}`)
		}

		const data = await response.json() as { access_token: string; expires_in: number; error?: string }
		if (data.error) {
			throw new Error(`Reddit auth error: ${data.error}`)
		}

		this.tokens = {
			accessToken: data.access_token,
			expiresAt: Date.now() + data.expires_in * 1000,
		}
		this.logService.info('[RedditClient] Authenticated successfully')
	}

	private async ensureAuth(): Promise<void> {
		if (!this.tokens || Date.now() >= this.tokens.expiresAt - 60_000) {
			await this.fetchToken()
		}
	}

	private async request<T>(path: string, method: string = 'GET', body?: Record<string, string>): Promise<T> {
		await this.ensureAuth()

		if (this.rateLimitRemaining <= 1 && this.rateLimitReset > 0) {
			const waitMs = this.rateLimitReset * 1000
			this.logService.info(`[RedditClient] Rate limit near zero, waiting ${this.rateLimitReset}s`)
			await new Promise(r => setTimeout(r, waitMs))
		}

		const opts: RequestInit = {
			method,
			headers: {
				'Authorization': `Bearer ${this.tokens!.accessToken}`,
				'User-Agent': REDDIT_USER_AGENT,
			},
		}
		if (body) {
			(opts.headers as Record<string, string>)['Content-Type'] = 'application/x-www-form-urlencoded'
			opts.body = new URLSearchParams(body).toString()
		}

		const response = await fetch(`${REDDIT_API_BASE}${path}`, opts)

		const remaining = response.headers.get('X-Ratelimit-Remaining')
		const reset = response.headers.get('X-Ratelimit-Reset')
		if (remaining) this.rateLimitRemaining = Number(remaining)
		if (reset) this.rateLimitReset = Number(reset)

		if (response.status === 429) {
			const waitSec = this.rateLimitReset || 60
			this.logService.warn(`[RedditClient] Rate limited (429). Waiting ${waitSec}s`)
			await new Promise(r => setTimeout(r, waitSec * 1000))
			return this.request<T>(path, method, body)
		}

		if (response.status === 401) {
			this.logService.warn('[RedditClient] Token expired (401). Re-authenticating...')
			await this.fetchToken()
			return this.request<T>(path, method, body)
		}

		if (!response.ok) {
			const errBody = await response.text().catch(() => '')
			throw new Error(`Reddit API error ${response.status} on ${method} ${path}: ${errBody}`)
		}

		return response.json() as Promise<T>
	}

	// ========== READING ==========

	async getCombinedNew(subreddits: string[], limit: number = 100, after?: string): Promise<RedditListing<RedditPostData>> {
		const combined = subreddits.join('+')
		let path = `/r/${combined}/new?limit=${limit}`
		if (after) path += `&after=${after}`
		return this.request<RedditListing<RedditPostData>>(path)
	}

	async searchSubreddit(subreddit: string, query: string, time: string = 'week'): Promise<RedditListing<RedditPostData>> {
		const params = new URLSearchParams({
			q: query,
			restrict_sr: 'true',
			sort: 'new',
			t: time,
			limit: '25',
		})
		return this.request<RedditListing<RedditPostData>>(`/r/${subreddit}/search?${params}`)
	}

	async getComments(subreddit: string, articleId: string): Promise<unknown> {
		return this.request(`/r/${subreddit}/comments/${articleId}`)
	}

	async getMe(): Promise<RedditMeData> {
		return this.request<RedditMeData>('/api/v1/me')
	}

	// ========== WRITING ==========

	async submitComment(thingId: string, text: string): Promise<{ json: { errors: string[][]; data?: { things: unknown[] } } }> {
		return this.request('/api/comment', 'POST', {
			thing_id: thingId,
			text,
			api_type: 'json',
		})
	}

	async submitPost(subreddit: string, title: string, text: string, flairId?: string): Promise<{ json: { errors: string[][]; data?: { url: string; id: string; name: string } } }> {
		const body: Record<string, string> = {
			sr: subreddit,
			kind: 'self',
			title,
			text,
			api_type: 'json',
			sendreplies: 'true',
		}
		if (flairId) {
			body.flair_id = flairId
		}
		return this.request('/api/submit', 'POST', body)
	}

	// ========== UTILITIES ==========

	async getSubredditRules(subreddit: string): Promise<unknown> {
		return this.request(`/r/${subreddit}/about/rules`)
	}

	async getSubredditFlairs(subreddit: string): Promise<unknown> {
		return this.request(`/r/${subreddit}/api/link_flair_v2`)
	}

	async batchCheckItems(ids: string[]): Promise<RedditListing<RedditPostData | RedditCommentData>> {
		return this.request<RedditListing<RedditPostData | RedditCommentData>>(`/api/info?id=${ids.join(',')}`)
	}

	async checkShadowban(username: string): Promise<boolean> {
		try {
			const response = await fetch(`https://www.reddit.com/user/${username}/about.json`, {
				headers: { 'User-Agent': REDDIT_USER_AGENT },
			})
			return response.status === 404
		} catch {
			return false
		}
	}
}

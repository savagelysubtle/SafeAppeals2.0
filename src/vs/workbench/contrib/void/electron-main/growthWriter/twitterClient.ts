/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import * as crypto from 'crypto';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	TWITTER_API_BASE,
	TWITTER_TOKEN_URL,
	TWITTER_AUTH_URL,
} from '../../common/growthWriter/growthWriterConfig.js';

const TWITTER_REDIRECT_URI = 'https://safeappeals.com/auth/twitter/callback'

export interface TwitterTokens {
	accessToken: string
	refreshToken: string
	expiresAt: number
	clientId: string
	clientSecret?: string
}

export interface TweetResult {
	id: string
	text: string
}

export interface TweetMetrics {
	retweet_count: number
	reply_count: number
	like_count: number
	quote_count: number
	impression_count: number
	bookmark_count: number
}

export interface TwitterUser {
	id: string
	name: string
	username: string
}

interface PendingAuth {
	codeVerifier: string
	state: string
	redirectUri: string
	clientId: string
	clientSecret?: string
}

export class TwitterClient {
	private tokens: TwitterTokens | null = null
	private pendingAuth: PendingAuth | null = null
	private rateLimitRemaining: number = 100
	private rateLimitReset: number = 0

	constructor(
		private readonly logService: ILogService,
	) {}

	// ========== AUTH: TWO-STEP PKCE FLOW ==========

	/**
	 * Step 1: Generate PKCE params and return the auth URL.
	 * Also starts a local callback server to catch the redirect.
	 *
	 * Two modes:
	 * - Dev mode: callback server on 127.0.0.1 catches the redirect, shows
	 *   a success page with the code, and auto-returns it.
	 * - Production: custom URI scheme (safe-appeals-navigator://twitter/callback)
	 *   handled by VoidCloudUrlHandler, pass as redirectUri override.
	 */
	prepareAuth(clientId: string, clientSecret?: string, redirectUri?: string): { authUrl: string; state: string } {
		const codeVerifier = crypto.randomBytes(32).toString('base64url')
		const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url')
		const state = crypto.randomBytes(16).toString('hex')
		const finalRedirectUri = redirectUri || TWITTER_REDIRECT_URI

		this.pendingAuth = { codeVerifier, state, redirectUri: finalRedirectUri, clientId, clientSecret }

		const authUrl = new URL(TWITTER_AUTH_URL)
		authUrl.searchParams.set('response_type', 'code')
		authUrl.searchParams.set('client_id', clientId)
		authUrl.searchParams.set('redirect_uri', finalRedirectUri)
		authUrl.searchParams.set('scope', 'tweet.read tweet.write users.read offline.access')
		authUrl.searchParams.set('state', state)
		authUrl.searchParams.set('code_challenge', codeChallenge)
		authUrl.searchParams.set('code_challenge_method', 'S256')

		this.logService.info('[TwitterClient] Auth URL prepared, waiting for code...')
		return { authUrl: authUrl.toString(), state }
	}

	/**
	 * Step 2: Exchange the authorization code (from the callback) for tokens.
	 */
	async exchangeAuthCode(code: string, state: string): Promise<TwitterTokens> {
		if (!this.pendingAuth) {
			throw new Error('TwitterClient: No pending auth. Call prepareAuth() first.')
		}
		if (this.pendingAuth.state !== state) {
			this.pendingAuth = null
			throw new Error('TwitterClient: State mismatch. Possible CSRF attack.')
		}

		const { codeVerifier, redirectUri, clientId, clientSecret } = this.pendingAuth
		this.pendingAuth = null

		const headers: Record<string, string> = {
			'Content-Type': 'application/x-www-form-urlencoded',
		}
		if (clientSecret) {
			headers['Authorization'] = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
		}

		const body: Record<string, string> = {
			grant_type: 'authorization_code',
			code,
			redirect_uri: redirectUri,
			code_verifier: codeVerifier,
		}
		if (!clientSecret) {
			body.client_id = clientId
		}

		const response = await fetch(TWITTER_TOKEN_URL, {
			method: 'POST',
			headers,
			body: new URLSearchParams(body).toString(),
		})

		if (!response.ok) {
			const respBody = await response.text().catch(() => '')
			throw new Error(`Twitter token exchange failed (${response.status}): ${respBody}`)
		}

		const data = await response.json() as {
			access_token: string
			refresh_token: string
			expires_in: number
			error?: string
		}

		if (data.error) {
			throw new Error(`Twitter token error: ${data.error}`)
		}

		this.tokens = {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: Date.now() + data.expires_in * 1000,
			clientId,
			clientSecret,
		}

		this.logService.info('[TwitterClient] OAuth code exchanged successfully')
		return this.tokens
	}


	async refreshAccessToken(): Promise<TwitterTokens> {
		if (!this.tokens) {
			throw new Error('TwitterClient: No tokens to refresh. Call authenticate() first.')
		}

		this.logService.info('[TwitterClient] Refreshing access token...')

		const headers: Record<string, string> = {
			'Content-Type': 'application/x-www-form-urlencoded',
		}
		if (this.tokens.clientSecret) {
			headers['Authorization'] = `Basic ${Buffer.from(`${this.tokens.clientId}:${this.tokens.clientSecret}`).toString('base64')}`
		}

		const body: Record<string, string> = {
			grant_type: 'refresh_token',
			refresh_token: this.tokens.refreshToken,
		}
		if (!this.tokens.clientSecret) {
			body.client_id = this.tokens.clientId
		}

		const response = await fetch(TWITTER_TOKEN_URL, {
			method: 'POST',
			headers,
			body: new URLSearchParams(body).toString(),
		})

		if (!response.ok) {
			const respBody = await response.text().catch(() => '')
			throw new Error(`Twitter token refresh failed (${response.status}): ${respBody}`)
		}

		const data = await response.json() as {
			access_token: string
			refresh_token: string
			expires_in: number
		}

		this.tokens = {
			accessToken: data.access_token,
			refreshToken: data.refresh_token,
			expiresAt: Date.now() + data.expires_in * 1000,
			clientId: this.tokens.clientId,
			clientSecret: this.tokens.clientSecret,
		}

		this.logService.info('[TwitterClient] Token refreshed successfully')
		return this.tokens
	}

	setTokens(tokens: TwitterTokens): void {
		this.tokens = tokens
	}

	getTokens(): TwitterTokens | null {
		return this.tokens
	}

	isAuthenticated(): boolean {
		return this.tokens !== null && Date.now() < this.tokens.expiresAt - 60_000
	}

	private async ensureAuth(): Promise<void> {
		if (!this.tokens) {
			throw new Error('TwitterClient: Not authenticated. Call authenticate() first.')
		}
		// Refresh if token expires within 5 minutes
		if (Date.now() >= this.tokens.expiresAt - 5 * 60 * 1000) {
			await this.refreshAccessToken()
		}
	}

	// ========== GENERIC REQUEST ==========

	private async request<T>(path: string, method: string = 'GET', body?: Record<string, unknown>): Promise<T> {
		await this.ensureAuth()

		if (this.rateLimitRemaining <= 1 && this.rateLimitReset > 0) {
			const waitMs = (this.rateLimitReset - Math.floor(Date.now() / 1000)) * 1000
			if (waitMs > 0) {
				this.logService.info(`[TwitterClient] Rate limit near zero, waiting ${Math.ceil(waitMs / 1000)}s`)
				await new Promise(r => setTimeout(r, waitMs))
			}
		}

		const opts: RequestInit = {
			method,
			headers: {
				'Authorization': `Bearer ${this.tokens!.accessToken}`,
			},
		}

		if (body) {
			(opts.headers as Record<string, string>)['Content-Type'] = 'application/json'
			opts.body = JSON.stringify(body)
		}

		const response = await fetch(`${TWITTER_API_BASE}${path}`, opts)

		const remaining = response.headers.get('x-rate-limit-remaining')
		const reset = response.headers.get('x-rate-limit-reset')
		if (remaining) this.rateLimitRemaining = Number(remaining)
		if (reset) this.rateLimitReset = Number(reset)

		if (response.status === 429) {
			const waitSec = this.rateLimitReset > 0
				? this.rateLimitReset - Math.floor(Date.now() / 1000)
				: 60
			this.logService.warn(`[TwitterClient] Rate limited (429). Waiting ${waitSec}s`)
			await new Promise(r => setTimeout(r, Math.max(waitSec, 1) * 1000))
			return this.request<T>(path, method, body)
		}

		if (response.status === 401) {
			this.logService.warn('[TwitterClient] Token expired (401). Refreshing...')
			await this.refreshAccessToken()
			return this.request<T>(path, method, body)
		}

		if (!response.ok) {
			const errBody = await response.text().catch(() => '')
			throw new Error(`Twitter API error ${response.status} on ${method} ${path}: ${errBody}`)
		}

		return response.json() as Promise<T>
	}

	// ========== POSTING ==========

	async postTweet(text: string): Promise<TweetResult> {
		const result = await this.request<{ data: TweetResult }>('/tweets', 'POST', { text })
		this.logService.info(`[TwitterClient] Tweet posted: ${result.data.id}`)
		return result.data
	}

	async postThread(tweets: string[]): Promise<TweetResult[]> {
		const posted: TweetResult[] = []
		let previousId: string | undefined

		for (const text of tweets) {
			const body: Record<string, unknown> = { text }
			if (previousId) {
				body.reply = { in_reply_to_tweet_id: previousId }
			}

			const result = await this.request<{ data: TweetResult }>('/tweets', 'POST', body)
			previousId = result.data.id
			posted.push(result.data)

			// 1s delay between thread tweets
			if (tweets.indexOf(text) < tweets.length - 1) {
				await new Promise(r => setTimeout(r, 1000))
			}
		}

		this.logService.info(`[TwitterClient] Thread posted: ${posted.length} tweets`)
		return posted
	}

	// ========== READING ==========

	async getMe(): Promise<TwitterUser> {
		const result = await this.request<{ data: TwitterUser }>('/users/me')
		return result.data
	}

	async getTweetMetrics(tweetId: string): Promise<TweetMetrics> {
		const result = await this.request<{
			data: { public_metrics: TweetMetrics }
		}>(`/tweets/${tweetId}?tweet.fields=public_metrics,created_at`)
		return result.data.public_metrics
	}

	async getUserTweets(userId: string, maxResults: number = 10): Promise<TweetResult[]> {
		const result = await this.request<{
			data: TweetResult[]
		}>(`/users/${userId}/tweets?max_results=${maxResults}`)
		return result.data || []
	}

	async deleteTweet(tweetId: string): Promise<void> {
		await this.request(`/tweets/${tweetId}`, 'DELETE')
		this.logService.info(`[TwitterClient] Tweet deleted: ${tweetId}`)
	}
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { safeStorage } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Event } from '../../../../../base/common/event.js';
import { IServerChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { GrowthWriterDatabaseService } from './growthWriterDatabase.js';
import { ContentEmbeddingService } from './contentEmbeddingService.js';
import { BlogPublisher } from './blogPublisher.js';
import { RedditClient } from './redditClient.js';
import { TwitterClient } from './twitterClient.js';

const REDDIT_CREDENTIALS_FILE = 'reddit_credentials.enc';
const TWITTER_TOKENS_FILE = 'twitter_tokens.enc';

/**
 * IPC Channel for the Growth Writer extension.
 * Manages per-workspace SQLite databases for growth writer data.
 * Follows the ChatThreadStorageChannel / DocuSignChannel pattern.
 *
 * Phase 1: Database CRUD operations only.
 * Phase 2: Content embedding for semantic dedup.
 * Phase 3: Blog publishing.
 * Phase 4: Reddit API integration.
 * Phase 5: Twitter/X API integration.
 */
export class GrowthWriterChannel implements IServerChannel {
	private instanceOfWorkspaceId: Map<string, GrowthWriterDatabaseService> = new Map();
	private embeddingService: ContentEmbeddingService | null = null;
	private redditClient: RedditClient | null = null;
	private twitterClient: TwitterClient | null = null;

	constructor(
		private readonly appDataPath: string,
		private readonly logService: ILogService,
	) {
		this.logService.info('[GrowthWriterChannel] Channel created');
	}

	private getEmbeddingService(): ContentEmbeddingService {
		if (!this.embeddingService) {
			this.embeddingService = new ContentEmbeddingService(this.appDataPath, this.logService)
		}
		return this.embeddingService
	}

	private getRedditClient(): RedditClient {
		if (!this.redditClient) {
			this.redditClient = new RedditClient(this.logService)
		}
		return this.redditClient
	}

	private getTwitterClient(): TwitterClient {
		if (!this.twitterClient) {
			this.twitterClient = new TwitterClient(this.logService)
		}
		return this.twitterClient
	}

	private getCredentialsDir(): string {
		return path.join(this.appDataPath, 'growthWriter')
	}

	private getCredentialsPath(): string {
		return path.join(this.getCredentialsDir(), REDDIT_CREDENTIALS_FILE)
	}

	private getTwitterTokensPath(): string {
		return path.join(this.getCredentialsDir(), TWITTER_TOKENS_FILE)
	}

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`GrowthWriterChannel: Event not supported: ${event}`);
	}

	async call(_: unknown, command: string, arg?: any): Promise<any> {
		this.logService.info(`[GrowthWriterChannel] Command: ${command}, workspace: ${arg?.workspaceId}`);

		try {
			switch (command) {
				// ========== DATABASE LIFECYCLE ==========

				case 'initDatabase': {
					const { workspaceId } = arg;
					await this.getOrCreateInstance(workspaceId);
					return { success: true };
				}

				// ========== BLOG IDEAS ==========

				case 'getIdeas': {
					const { workspaceId, silo, status } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					return instance.getIdeas({ silo, status });
				}

				case 'createIdea': {
					const { workspaceId, ...idea } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					await instance.createIdea(idea);
					return { success: true };
				}

			case 'updateIdeaStatus': {
				const { workspaceId, id, ideaId, status } = arg;
				const instance = await this.getOrCreateInstance(workspaceId);
				await instance.updateIdeaStatus(id || ideaId, status);
					return { success: true };
				}

				// ========== CAMPAIGNS ==========

				case 'getCampaigns': {
					const { workspaceId, silo, status } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					return instance.getCampaigns({ silo, status });
				}

				case 'createCampaign': {
					const { workspaceId, ...campaign } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					await instance.createCampaign(campaign);
					return { success: true };
				}

			case 'updateCampaignStatus': {
				const { workspaceId, id, campaignId, status, error_message } = arg;
				const instance = await this.getOrCreateInstance(workspaceId);
				await instance.updateCampaignStatus(id || campaignId, status, error_message);
				return { success: true };
			}

				// ========== SOCIAL POSTS ==========

				case 'getSocialPosts': {
					const { workspaceId, campaign_id, platform, status } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					return instance.getSocialPosts({ campaign_id, platform, status });
				}

				case 'createSocialPost': {
					const { workspaceId, ...post } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					await instance.createSocialPost(post);
					return { success: true };
				}

				case 'updateSocialPostStatus': {
					const { workspaceId, id, status, post_url, error_message } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					await instance.updateSocialPostStatus(id, status, post_url, error_message);
					return { success: true };
				}

				// ========== SUBREDDIT CONFIG ==========

				case 'getSubredditConfig': {
					const { workspaceId, silo } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					return instance.getSubredditConfig({ silo });
				}

				case 'upsertSubredditConfig': {
					const { workspaceId, ...config } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					await instance.upsertSubredditConfig(config);
					return { success: true };
				}

				// ========== REDDIT OPPORTUNITIES ==========

				case 'getOpportunities': {
					const { workspaceId, silo, status } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					return instance.getOpportunities({ silo, status });
				}

				case 'createOpportunity': {
					const { workspaceId, ...opp } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					await instance.createOpportunity(opp);
					return { success: true };
				}

				case 'updateOpportunityStatus': {
					const { workspaceId, id, status, comment_body } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					await instance.updateOpportunityStatus(id, status, comment_body);
					return { success: true };
				}

				// ========== PLATFORM AUTH ==========

				case 'getPlatformAuth': {
					const { workspaceId, platform } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					return instance.getPlatformAuth(platform);
				}

			case 'upsertPlatformAuth': {
				const { workspaceId, ...auth } = arg;
				const instance = await this.getOrCreateInstance(workspaceId);
				await instance.upsertPlatformAuth(auth);
				return { success: true };
			}

			// ========== SEMANTIC DEDUP (Phase 2) ==========

			case 'getIdeaTitles': {
				const { workspaceId, silo } = arg;
				const instance = await this.getOrCreateInstance(workspaceId);
				return instance.getIdeaTitles(silo);
			}

		case 'checkSemanticDuplicate': {
			const { workspaceId, newTitle, silo } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			const existingTitles = await instance.getIdeaTitles(silo);
			const result = await this.getEmbeddingService().checkSemanticDuplicate(newTitle, existingTitles);
			return result;
		}

		// ========== BLOG GENERATION PIPELINE (Phase 3) ==========

		case 'getCampaignById': {
			const { workspaceId, id, campaignId } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			return instance.getCampaignById(id || campaignId);
		}

		case 'getCampaignByIdeaId': {
			const { workspaceId, ideaId } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			return instance.getCampaignByIdeaId(ideaId);
		}

		case 'updateCampaignContent': {
			const { workspaceId, id, campaignId, blog_title, title, blog_slug, blog_content, content, blog_url } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			await instance.updateCampaignContent(id || campaignId, blog_title || title || '', blog_slug || '', blog_content || content || '', blog_url || '');
			return { success: true };
		}

		case 'publishBlog': {
			const { workspaceId, campaignId } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			const campaign = await instance.getCampaignById(campaignId);
			if (!campaign) {
				throw new Error(`Campaign not found: ${campaignId}`);
			}
			if (campaign.status !== 'approved') {
				throw new Error(`Campaign must be approved before publishing. Current status: ${campaign.status}`);
			}
			if (!campaign.blog_content || !campaign.blog_title || !campaign.blog_slug) {
				throw new Error('Campaign is missing blog content, title, or slug');
			}

			await instance.updateCampaignStatus(campaignId, 'publishing');

			try {
				const publisher = new BlogPublisher(this.logService);
				const cmsResult = await publisher.publish({
					title: campaign.blog_title,
					content: campaign.blog_content,
					slug: campaign.blog_slug,
					excerpt: null,
					status: 'published',
					tags: [campaign.silo],
					meta_description: null,
				});

				await instance.updateCampaignPublished(campaignId, cmsResult.id, cmsResult.url);
				return cmsResult;
			} catch (error) {
				const msg = error instanceof Error ? error.message : String(error);
				await instance.updateCampaignStatus(campaignId, 'failed', msg);
				throw error;
			}
		}

		// ========== REDDIT INTEGRATION (Phase 4) ==========

		case 'storeRedditCredentials': {
			const { clientId, clientSecret, username, password } = arg;
			if (!safeStorage.isEncryptionAvailable()) {
				throw new Error('System encryption not available. Cannot store Reddit credentials securely.')
			}
			const credDir = this.getCredentialsDir()
			if (!fs.existsSync(credDir)) {
				fs.mkdirSync(credDir, { recursive: true })
			}
			const payload = JSON.stringify({ clientId, clientSecret, username, password })
			const encrypted = safeStorage.encryptString(payload)
			fs.writeFileSync(this.getCredentialsPath(), encrypted)
			this.logService.info('[GrowthWriterChannel] Reddit credentials stored securely')
			return { success: true }
		}

		case 'loadRedditCredentials': {
			if (!safeStorage.isEncryptionAvailable()) {
				return null
			}
			const credPath = this.getCredentialsPath()
			if (!fs.existsSync(credPath)) {
				return null
			}
			const encrypted = fs.readFileSync(credPath)
			const decrypted = safeStorage.decryptString(encrypted)
			return JSON.parse(decrypted) as { clientId: string; clientSecret: string; username: string; password: string }
		}

		case 'authenticateReddit': {
			let { clientId, clientSecret, username, password } = arg;
			if (!clientId || !clientSecret || !username || !password) {
				const stored = await this.call(_, 'loadRedditCredentials')
				if (!stored) {
					throw new Error('Reddit credentials not configured. Store credentials first via storeRedditCredentials.')
				}
				clientId = stored.clientId
				clientSecret = stored.clientSecret
				username = stored.username
				password = stored.password
			}
			const client = this.getRedditClient()
			await client.authenticate(clientId, clientSecret, username, password)
			return { success: true }
		}

		case 'monitorSubreddits': {
			const { subreddits, limit, after } = arg;
			const client = this.getRedditClient()
			if (!client.isAuthenticated()) {
				const creds = await this.call(_, 'loadRedditCredentials')
				if (!creds) {
					throw new Error('Reddit credentials not configured. Store credentials first.')
				}
				await client.authenticate(creds.clientId, creds.clientSecret, creds.username, creds.password)
			}
			const listing = await client.getCombinedNew(subreddits, limit ?? 100, after)
			return listing.data.children.map(c => c.data)
		}

		case 'searchSubreddit': {
			const { subreddit, query, time } = arg;
			const client = this.getRedditClient()
			if (!client.isAuthenticated()) {
				const creds = await this.call(_, 'loadRedditCredentials')
				if (!creds) {
					throw new Error('Reddit credentials not configured. Store credentials first.')
				}
				await client.authenticate(creds.clientId, creds.clientSecret, creds.username, creds.password)
			}
			const listing = await client.searchSubreddit(subreddit, query, time)
			return listing.data.children.map(c => c.data)
		}

		case 'postRedditComment': {
			const { thingId, text } = arg;
			const client = this.getRedditClient()
			if (!client.isAuthenticated()) {
				const creds = await this.call(_, 'loadRedditCredentials')
				if (!creds) {
					throw new Error('Reddit credentials not configured. Store credentials first.')
				}
				await client.authenticate(creds.clientId, creds.clientSecret, creds.username, creds.password)
			}
			const result = await client.submitComment(thingId, text)
			if (result.json.errors && result.json.errors.length > 0) {
				throw new Error(`Reddit comment failed: ${JSON.stringify(result.json.errors)}`)
			}
			return { success: true }
		}

		case 'getRedditAccountHealth': {
			const client = this.getRedditClient()
			if (!client.isAuthenticated()) {
				const creds = await this.call(_, 'loadRedditCredentials')
				if (!creds) {
					throw new Error('Reddit credentials not configured. Store credentials first.')
				}
				await client.authenticate(creds.clientId, creds.clientSecret, creds.username, creds.password)
			}
			const me = await client.getMe()
			const { workspaceId } = arg
			let warmupStartedAt: string | null = null
			let warmupComplete = false
			let removalCount = 0
			let lastRemovalAt: string | null = null
			if (workspaceId) {
				const instance = await this.getOrCreateInstance(workspaceId)
				const auth = await instance.getPlatformAuth('reddit')
				if (auth) {
					warmupStartedAt = auth.warmup_started_at
					warmupComplete = auth.warmup_complete === 1
					removalCount = auth.removal_count
					lastRemovalAt = auth.last_removal_at
				}
			}
			return {
				username: me.name,
				karma: me.total_karma,
				warmupStartedAt,
				warmupComplete,
				removalCount,
				lastRemovalAt,
			}
		}

		// ========== TWITTER INTEGRATION (Phase 5) ==========

		case 'storeTwitterTokens': {
			const { accessToken, refreshToken, expiresAt, clientId, clientSecret } = arg;
			if (!safeStorage.isEncryptionAvailable()) {
				throw new Error('System encryption not available. Cannot store Twitter tokens securely.')
			}
			const credDir = this.getCredentialsDir()
			if (!fs.existsSync(credDir)) {
				fs.mkdirSync(credDir, { recursive: true })
			}
			const payload = JSON.stringify({ accessToken, refreshToken, expiresAt, clientId, clientSecret })
			const encrypted = safeStorage.encryptString(payload)
			fs.writeFileSync(this.getTwitterTokensPath(), encrypted)
			this.logService.info('[GrowthWriterChannel] Twitter tokens stored securely')
			return { success: true }
		}

		case 'loadTwitterTokens': {
			if (!safeStorage.isEncryptionAvailable()) {
				return null
			}
			const tokensPath = this.getTwitterTokensPath()
			if (!fs.existsSync(tokensPath)) {
				return null
			}
			const encrypted = fs.readFileSync(tokensPath)
			const decrypted = safeStorage.decryptString(encrypted)
			return JSON.parse(decrypted) as { accessToken: string; refreshToken: string; expiresAt: number; clientId: string; clientSecret?: string }
		}

		case 'startTwitterAuth': {
			const { clientId, clientSecret } = arg;
			const client = this.getTwitterClient()
			const result = client.prepareAuth(clientId, clientSecret)
			return { authUrl: result.authUrl, state: result.state }
		}

		case 'exchangeTwitterCode': {
			const { code, state } = arg;
			const client = this.getTwitterClient()
			const tokens = await client.exchangeAuthCode(code, state)
			await this.call(_, 'storeTwitterTokens', tokens)
			return { success: true }
		}

		case 'refreshTwitterTokens': {
			const client = this.getTwitterClient()
			if (!client.isAuthenticated()) {
				const stored = await this.call(_, 'loadTwitterTokens')
				if (!stored) {
					throw new Error('No Twitter tokens stored. Authenticate first.')
				}
				client.setTokens(stored)
			}
			const newTokens = await client.refreshAccessToken()
			await this.call(_, 'storeTwitterTokens', newTokens)
			return { accessToken: newTokens.accessToken, refreshToken: newTokens.refreshToken, expiresAt: newTokens.expiresAt }
		}

		case 'postTweet': {
			const { text } = arg;
			const client = this.getTwitterClient()
			if (!client.isAuthenticated()) {
				const stored = await this.call(_, 'loadTwitterTokens')
				if (!stored) {
					throw new Error('No Twitter tokens stored. Authenticate first.')
				}
				client.setTokens(stored)
			}
			const result = await client.postTweet(text)
			return result
		}

		case 'postThread': {
			const { tweets } = arg;
			const client = this.getTwitterClient()
			if (!client.isAuthenticated()) {
				const stored = await this.call(_, 'loadTwitterTokens')
				if (!stored) {
					throw new Error('No Twitter tokens stored. Authenticate first.')
				}
				client.setTokens(stored)
			}
			const texts = (tweets as Array<{ socialPostId: string; text: string }>).map(t => t.text)
			const results = await client.postThread(texts)
			return results
		}

		case 'getTweetMetrics': {
			const { tweetId } = arg;
			const client = this.getTwitterClient()
			if (!client.isAuthenticated()) {
				const stored = await this.call(_, 'loadTwitterTokens')
				if (!stored) {
					throw new Error('No Twitter tokens stored. Authenticate first.')
				}
				client.setTokens(stored)
			}
			return client.getTweetMetrics(tweetId)
		}

		case 'getTwitterMe': {
			const client = this.getTwitterClient()
			if (!client.isAuthenticated()) {
				const stored = await this.call(_, 'loadTwitterTokens')
				if (!stored) {
					throw new Error('No Twitter tokens stored. Authenticate first.')
				}
				client.setTokens(stored)
			}
			return client.getMe()
		}

		// ========== ENV FILE READING ==========

		case 'readEnvCredentials': {
			const { envFilePath } = arg;
			try {
				// 1. Check process.env first (always available)
				const fromEnv = {
					twitter: {
						clientId: process.env['CLIENT_ID'] || null,
						clientSecret: process.env['CLIENT_SECRET'] || null,
						bearerToken: process.env['X_BEARER_TOKEN'] || null,
					},
					reddit: {
						clientId: process.env['REDDIT_CLIENT_ID'] || null,
						clientSecret: process.env['REDDIT_CLIENT_SECRET'] || null,
						username: process.env['REDDIT_USERNAME'] || null,
						password: process.env['REDDIT_PASSWORD'] || null,
					},
				}
				if (fromEnv.twitter.clientId || fromEnv.reddit.clientId) {
					this.logService.info('[GrowthWriterChannel] Loaded credentials from process.env')
					return fromEnv
				}

				// 2. Try reading .env files from common locations
				const candidates = [
					path.join(process.cwd(), '.env'),
					envFilePath,
				].filter((p): p is string => typeof p === 'string' && p.length > 0)

			for (const filePath of candidates) {
				if (!fs.existsSync(filePath)) continue
				const content = fs.readFileSync(filePath, 'utf-8')
				const vars: Record<string, string> = {}
				for (const line of content.split('\n')) {
					const trimmed = line.trim()
					if (!trimmed || trimmed.startsWith('#')) continue
					const eqIdx = trimmed.indexOf('=')
					if (eqIdx === -1) continue
					const key = trimmed.substring(0, eqIdx).trim()
					let value = trimmed.substring(eqIdx + 1).trim()
					if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
						value = value.slice(1, -1)
					}
					vars[key] = value
				}

				// Inject blog/growth env vars into process.env so services can use them
				const envKeys = ['BLOG_API_KEY', 'BLOG_CMS_API_URL', 'CLIENT_ID', 'CLIENT_SECRET', 'X_BEARER_TOKEN',
					'REDDIT_CLIENT_ID', 'REDDIT_CLIENT_SECRET', 'REDDIT_USERNAME', 'REDDIT_PASSWORD']
				for (const k of envKeys) {
					if (vars[k] && !process.env[k]) {
						process.env[k] = vars[k]
					}
				}

				const result = {
					twitter: {
						clientId: vars['CLIENT_ID'] || null,
						clientSecret: vars['CLIENT_SECRET'] || null,
						bearerToken: vars['X_BEARER_TOKEN'] || null,
					},
					reddit: {
						clientId: vars['REDDIT_CLIENT_ID'] || null,
						clientSecret: vars['REDDIT_CLIENT_SECRET'] || null,
						username: vars['REDDIT_USERNAME'] || null,
						password: vars['REDDIT_PASSWORD'] || null,
					},
				}
				if (result.twitter.clientId || result.reddit.clientId || vars['BLOG_API_KEY']) {
					this.logService.info(`[GrowthWriterChannel] Loaded credentials from ${filePath}`)
					return result
				}
			}

				return null
			} catch (err) {
				this.logService.warn('[GrowthWriterChannel] Failed to read credentials:', err)
				return null
			}
		}

		case 'deleteIdea': {
			const { workspaceId, ideaId } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			await instance.deleteIdea(ideaId);
			return;
		}

		case 'deleteCampaign': {
			const { workspaceId, campaignId } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			await instance.deleteCampaign(campaignId);
			return;
		}

		// ========== SCHEDULER QUERIES ==========

		case 'getPendingIdeaCount': {
			const { workspaceId, silo } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			return instance.getPendingIdeaCountBySilo(silo);
		}

		case 'getTopPendingIdea': {
			const { workspaceId, silo } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			return instance.getTopPendingIdea(silo);
		}

		case 'getCampaignsForSiloInWeek': {
			const { workspaceId, silo, startDate, endDate } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			return instance.getCampaignsForSiloInDateRange(silo, startDate, endDate);
		}

		case 'getApprovedReadyToPublish': {
			const { workspaceId } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			return instance.getApprovedCampaignsReadyToPublish(new Date().toISOString());
		}

		case 'scheduleCampaign': {
			const { workspaceId, campaignId, scheduledFor } = arg;
			const instance = await this.getOrCreateInstance(workspaceId);
			await instance.scheduleCampaign(campaignId, scheduledFor);
			return;
		}

		default:
				throw new Error(`GrowthWriterChannel: Unknown command: ${command}`);
			}
		} catch (error) {
			this.logService.error(`[GrowthWriterChannel] Error in ${command}:`, error);
			throw error;
		}
	}

	private async getOrCreateInstance(workspaceId: string): Promise<GrowthWriterDatabaseService> {
		if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null') {
			throw new Error('GrowthWriterChannel: workspaceId is REQUIRED');
		}

		let instance = this.instanceOfWorkspaceId.get(workspaceId);
		if (!instance) {
			this.logService.info(`[GrowthWriterChannel] Creating database for workspace: ${workspaceId}`);
			instance = new GrowthWriterDatabaseService(this.logService, this.appDataPath, workspaceId);
			await instance.initialize();
			this.instanceOfWorkspaceId.set(workspaceId, instance);
			this.logService.info(`[GrowthWriterChannel] Database ready for workspace: ${workspaceId}`);
		}

		return instance;
	}
}

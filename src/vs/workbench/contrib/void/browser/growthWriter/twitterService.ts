/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { generateUuid } from '../../../../../base/common/uuid.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';

import { ICloudLLMRouterService } from '../cloudLLMRouterService.js';
import { IConvertToLLMMessageService } from '../convertToLLMMessageService.js';
import { IRAGService } from '../../common/rag/ragService.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';

import {
	ICampaign,
	ISocialPost,
	ITwitterAuthResult,
	ITweetResult,
	ITweetMetrics,
	SocialPostStatus,
	Silo,
} from '../../common/growthWriter/growthWriterTypes.js';
import {
	SILO_CONFIGS,
	TWEET_SYSTEM_PROMPT,
	TWEET_USER_PROMPT_TEMPLATE,
	TWITTER_TWEET_CHAR_LIMIT,
	TWITTER_URL_CHAR_COUNT,
	queryTemplatesOfSilo,
	buildUtmUrl,
} from '../../common/growthWriter/growthWriterConfig.js';

// ============================================
// SERVICE INTERFACE
// ============================================

export interface ITwitterService {
	readonly _serviceBrand: undefined

	initializeForWorkspace(workspaceId: string): Promise<void>

	// Authentication
	authenticate(clientId: string): Promise<ITwitterAuthResult>
	isAuthenticated(): Promise<boolean>

	// Tweet generation
	generateTweetsForSilo(silo: Silo, count?: number): Promise<ISocialPost[]>
	generateTweetForBlog(campaignId: string): Promise<ISocialPost>

	// Tweet management
	getSocialPosts(filters?: { campaign_id?: string; status?: SocialPostStatus }): Promise<ISocialPost[]>
	approveTweet(socialPostId: string): Promise<void>
	postTweet(socialPostId: string): Promise<ITweetResult>
	postThread(socialPostIds: string[]): Promise<ITweetResult[]>

	// Metrics
	collectMetrics(socialPostId: string): Promise<ITweetMetrics>
}

export const ITwitterService = createDecorator<ITwitterService>('twitterService');

// ============================================
// CONTENT TYPE ROTATION
// ============================================

const CONTENT_TYPES = [
	'informational',
	'tip',
	'blog_promo',
	'feature_highlight',
	'engagement_question',
] as const

type ContentType = typeof CONTENT_TYPES[number]

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

class TwitterService extends Disposable implements ITwitterService {
	readonly _serviceBrand: undefined;

	private readonly _channel: IChannel;
	private workspaceId: string | null = null;
	private contentTypeIndex: number = 0;

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@ICloudLLMRouterService private readonly llmRouter: ICloudLLMRouterService,
		@IConvertToLLMMessageService private readonly convertService: IConvertToLLMMessageService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@IRAGService private readonly ragService: IRAGService,
		@ILogService private readonly logService: ILogService,
	) {
		super()
		this._channel = mainProcessService.getChannel('void-channel-growth-writer')
		this.logService.info('[TwitterService] Service created')
	}

	// ============================================
	// WORKSPACE LIFECYCLE
	// ============================================

	async initializeForWorkspace(workspaceId: string): Promise<void> {
		this.workspaceId = workspaceId
		await this._channel.call('initDatabase', { workspaceId })
		this.logService.info(`[TwitterService] Initialized for workspace: ${workspaceId}`)
	}

	private ensureWorkspace(): string {
		if (!this.workspaceId) {
			this.workspaceId = this.ragService.getWorkspaceId()
		}
		if (!this.workspaceId) {
			throw new Error('[TwitterService] No workspace initialized. Call initializeForWorkspace() first.')
		}
		return this.workspaceId
	}

	// ============================================
	// AUTHENTICATION
	// ============================================

	async authenticate(clientId: string): Promise<ITwitterAuthResult> {
		this.logService.info('[TwitterService] Starting Twitter authentication...')
		const result: ITwitterAuthResult = await this._channel.call('startTwitterAuth', { clientId })

		const workspaceId = this.ensureWorkspace()
		await this._channel.call('upsertPlatformAuth', {
			workspaceId,
			platform: 'twitter',
			account_name: null,
		})

		// Fetch the account name after auth
		try {
			const me: { id: string; name: string; username: string } = await this._channel.call('getTwitterMe')
			await this._channel.call('upsertPlatformAuth', {
				workspaceId,
				platform: 'twitter',
				account_name: me.username,
			})
			this.logService.info(`[TwitterService] Authenticated as @${me.username}`)
		} catch {
			this.logService.warn('[TwitterService] Could not fetch Twitter user info after auth')
		}

		return result
	}

	async isAuthenticated(): Promise<boolean> {
		const tokens = await this._channel.call('loadTwitterTokens')
		return tokens !== null
	}

	// ============================================
	// TWEET GENERATION
	// ============================================

	private nextContentType(): ContentType {
		const type = CONTENT_TYPES[this.contentTypeIndex % CONTENT_TYPES.length]
		this.contentTypeIndex++
		return type
	}

	async generateTweetsForSilo(silo: Silo, count: number = 5): Promise<ISocialPost[]> {
		const workspaceId = this.ensureWorkspace()
		const siloConfig = SILO_CONFIGS[silo]

		this.logService.info(`[TwitterService] Generating ${count} tweets for silo: ${silo}`)

		// Get most recent published blog for optional linking
		const campaigns: ICampaign[] = await this._channel.call('getCampaigns', {
			workspaceId,
			silo,
			status: 'published',
		})
		const latestBlog = campaigns.length > 0 ? campaigns[campaigns.length - 1] : null

		const ragContext = await this.gatherRAGContext(silo, siloConfig.contentAngle)
		const tweets: ISocialPost[] = []

		for (let i = 0; i < count; i++) {
			const contentType = this.nextContentType()

			const blogTitle = latestBlog?.blog_title ?? '(no blog available)'
			const blogUrl = latestBlog?.blog_slug
				? buildUtmUrl(latestBlog.blog_slug, 'twitter', 'social', silo, contentType)
				: '(no blog URL)'

			const userPrompt = TWEET_USER_PROMPT_TEMPLATE
				.replace('{silo}', silo)
				.replace('{blog_title}', contentType === 'blog_promo' ? blogTitle : '(not promoting a blog)')
				.replace('{blog_url}', contentType === 'blog_promo' ? blogUrl : '(not promoting a blog)')
				.replace('{content_type}', contentType)
				.replace('{rag_context}', ragContext)

			const tweetText = await this.generateContent(
				TWEET_SYSTEM_PROMPT,
				userPrompt,
				'growth-writer-tweet',
			)

			const cleaned = tweetText.trim().replace(/^["']|["']$/g, '')

			// Validate character limit (URLs count as 23 chars)
			const effectiveLength = this.calculateEffectiveLength(cleaned)
			if (effectiveLength > TWITTER_TWEET_CHAR_LIMIT) {
				this.logService.warn(`[TwitterService] Tweet exceeds ${TWITTER_TWEET_CHAR_LIMIT} chars (${effectiveLength}), truncating`)
			}

			const socialPostId = generateUuid()
			const utmUrl = latestBlog?.blog_slug
				? buildUtmUrl(latestBlog.blog_slug, 'twitter', 'social', silo, contentType)
				: null

			const post: Omit<ISocialPost, 'created_at'> = {
				id: socialPostId,
				campaign_id: latestBlog?.id ?? '',
				platform: 'twitter',
				channel: silo,
				post_type: 'tweet',
				title: null,
				body: cleaned,
				content_hash: null,
				utm_url: utmUrl,
				status: 'draft',
				scheduled_for: null,
				posted_at: null,
				post_url: null,
				reddit_parent_id: null,
				error_message: null,
				metrics: null,
				metrics_updated_at: null,
			}

			await this._channel.call('createSocialPost', { workspaceId, ...post })
			tweets.push({
				...post,
				created_at: new Date().toISOString(),
			})

			this.logService.info(`[TwitterService] Tweet ${i + 1}/${count} drafted (${contentType}): "${cleaned.substring(0, 60)}..."`)
		}

		this.logService.info(`[TwitterService] Generated ${tweets.length} tweets for silo: ${silo}`)
		return tweets
	}

	async generateTweetForBlog(campaignId: string): Promise<ISocialPost> {
		const workspaceId = this.ensureWorkspace()

		const campaigns: ICampaign[] = await this._channel.call('getCampaigns', { workspaceId })
		const campaign = campaigns.find(c => c.id === campaignId)
		if (!campaign) {
			throw new Error(`[TwitterService] Campaign not found: ${campaignId}`)
		}
		if (!campaign.blog_title || !campaign.blog_slug) {
			throw new Error('[TwitterService] Campaign has no blog title or slug')
		}

		const blogUrl = buildUtmUrl(campaign.blog_slug, 'twitter', 'social', campaign.silo, 'blog_promo')
		const ragContext = await this.gatherRAGContext(campaign.silo, campaign.blog_title)

		const userPrompt = TWEET_USER_PROMPT_TEMPLATE
			.replace('{silo}', campaign.silo)
			.replace('{blog_title}', campaign.blog_title)
			.replace('{blog_url}', blogUrl)
			.replace('{content_type}', 'blog_promo')
			.replace('{rag_context}', ragContext)

		const tweetText = await this.generateContent(
			TWEET_SYSTEM_PROMPT,
			userPrompt,
			'growth-writer-tweet',
		)

		const cleaned = tweetText.trim().replace(/^["']|["']$/g, '')
		const socialPostId = generateUuid()

		const post: Omit<ISocialPost, 'created_at'> = {
			id: socialPostId,
			campaign_id: campaignId,
			platform: 'twitter',
			channel: campaign.silo,
			post_type: 'tweet',
			title: null,
			body: cleaned,
			content_hash: null,
			utm_url: blogUrl,
			status: 'draft',
			scheduled_for: null,
			posted_at: null,
			post_url: null,
			reddit_parent_id: null,
			error_message: null,
			metrics: null,
			metrics_updated_at: null,
		}

		await this._channel.call('createSocialPost', { workspaceId, ...post })
		this.logService.info(`[TwitterService] Blog promo tweet drafted for: "${campaign.blog_title}"`)

		return {
			...post,
			created_at: new Date().toISOString(),
		}
	}

	// ============================================
	// TWEET MANAGEMENT
	// ============================================

	async getSocialPosts(filters?: { campaign_id?: string; status?: SocialPostStatus }): Promise<ISocialPost[]> {
		const workspaceId = this.ensureWorkspace()
		return this._channel.call('getSocialPosts', { workspaceId, platform: 'twitter', ...filters })
	}

	async approveTweet(socialPostId: string): Promise<void> {
		const workspaceId = this.ensureWorkspace()
		await this._channel.call('updateSocialPostStatus', {
			workspaceId,
			id: socialPostId,
			status: 'approved',
		})
		this.logService.info(`[TwitterService] Tweet approved: ${socialPostId}`)
	}

	async postTweet(socialPostId: string): Promise<ITweetResult> {
		const workspaceId = this.ensureWorkspace()

		const posts: ISocialPost[] = await this._channel.call('getSocialPosts', { workspaceId, platform: 'twitter' })
		const post = posts.find(p => p.id === socialPostId)
		if (!post) {
			throw new Error(`[TwitterService] Social post not found: ${socialPostId}`)
		}
		if (post.status !== 'approved') {
			throw new Error(`[TwitterService] Tweet must be approved before posting. Current status: ${post.status}`)
		}

		this.logService.info(`[TwitterService] Posting tweet: "${post.body.substring(0, 60)}..."`)

		await this._channel.call('updateSocialPostStatus', {
			workspaceId,
			id: socialPostId,
			status: 'posting',
		})

		try {
			const result: ITweetResult = await this._channel.call('postTweet', {
				socialPostId,
				text: post.body,
			})

			const tweetUrl = `https://x.com/i/status/${result.id}`
			await this._channel.call('updateSocialPostStatus', {
				workspaceId,
				id: socialPostId,
				status: 'posted',
				post_url: tweetUrl,
			})

			this.logService.info(`[TwitterService] Tweet posted: ${tweetUrl}`)
			return result
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			await this._channel.call('updateSocialPostStatus', {
				workspaceId,
				id: socialPostId,
				status: 'failed',
				error_message: msg,
			})
			throw error
		}
	}

	async postThread(socialPostIds: string[]): Promise<ITweetResult[]> {
		const workspaceId = this.ensureWorkspace()

		const allPosts: ISocialPost[] = await this._channel.call('getSocialPosts', { workspaceId, platform: 'twitter' })
		const threadPosts = socialPostIds.map(id => {
			const post = allPosts.find(p => p.id === id)
			if (!post) throw new Error(`[TwitterService] Social post not found: ${id}`)
			if (post.status !== 'approved') throw new Error(`[TwitterService] All thread tweets must be approved. "${id}" is: ${post.status}`)
			return post
		})

		this.logService.info(`[TwitterService] Posting thread of ${threadPosts.length} tweets`)

		// Mark all as posting
		for (const post of threadPosts) {
			await this._channel.call('updateSocialPostStatus', {
				workspaceId,
				id: post.id,
				status: 'posting',
			})
		}

		try {
			const tweets = threadPosts.map(p => ({ socialPostId: p.id, text: p.body }))
			const results: ITweetResult[] = await this._channel.call('postThread', { tweets })

			// Update each post with its URL
			for (let i = 0; i < results.length; i++) {
				const tweetUrl = `https://x.com/i/status/${results[i].id}`
				await this._channel.call('updateSocialPostStatus', {
					workspaceId,
					id: threadPosts[i].id,
					status: 'posted',
					post_url: tweetUrl,
				})
			}

			this.logService.info(`[TwitterService] Thread posted: ${results.length} tweets`)
			return results
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			for (const post of threadPosts) {
				await this._channel.call('updateSocialPostStatus', {
					workspaceId,
					id: post.id,
					status: 'failed',
					error_message: msg,
				})
			}
			throw error
		}
	}

	// ============================================
	// METRICS
	// ============================================

	async collectMetrics(socialPostId: string): Promise<ITweetMetrics> {
		const workspaceId = this.ensureWorkspace()

		const posts: ISocialPost[] = await this._channel.call('getSocialPosts', { workspaceId, platform: 'twitter' })
		const post = posts.find(p => p.id === socialPostId)
		if (!post) {
			throw new Error(`[TwitterService] Social post not found: ${socialPostId}`)
		}
		if (!post.post_url) {
			throw new Error('[TwitterService] Tweet has no post URL -- has it been posted?')
		}

		// Extract tweet ID from URL
		const tweetId = post.post_url.split('/').pop()
		if (!tweetId) {
			throw new Error('[TwitterService] Could not extract tweet ID from post URL')
		}

		const metrics: ITweetMetrics = await this._channel.call('getTweetMetrics', { tweetId })

		// Store metrics on the social post record
		await this._channel.call('updateSocialPostStatus', {
			workspaceId,
			id: socialPostId,
			status: post.status,
		})

		this.logService.info(`[TwitterService] Metrics collected for tweet ${tweetId}: ${metrics.like_count} likes, ${metrics.impression_count} impressions`)
		return metrics
	}

	// ============================================
	// UTILITIES
	// ============================================

	private calculateEffectiveLength(text: string): number {
		// URLs count as 23 characters regardless of actual length
		const urlPattern = /https?:\/\/\S+/g
		let effective = text
		const urls = text.match(urlPattern)
		if (urls) {
			for (const url of urls) {
				effective = effective.replace(url, 'x'.repeat(TWITTER_URL_CHAR_COUNT))
			}
		}
		return effective.length
	}

	// ============================================
	// RAG CONTEXT GATHERING
	// ============================================

	private async gatherRAGContext(silo: Silo, topic: string): Promise<string> {
		const workspaceId = this.ensureWorkspace()
		const queries = queryTemplatesOfSilo[silo](topic)

		try {
			const results = await Promise.all(
				Object.values(queries).map(q =>
					this.ragService.search({
						query: q,
						scope: 'core_references',
						limit: 3,
						workspaceId,
					})
				)
			)

			const seenChunks = new Set<string>()
			const contextParts: string[] = []

			for (const pack of results) {
				if (!pack.answerContext) continue
				for (const attr of pack.attributions) {
					const key = `${attr.docId}:${attr.chunkId}`
					if (seenChunks.has(key)) continue
					seenChunks.add(key)
				}
				contextParts.push(pack.answerContext)
			}

			const combined = contextParts.join('\n\n---\n\n')
			this.logService.info(`[TwitterService] RAG gathered ${seenChunks.size} unique chunks`)
			return combined || '(No RAG context available)'
		} catch (error) {
			this.logService.warn('[TwitterService] RAG query failed:', error)
			return '(RAG context unavailable)'
		}
	}

	// ============================================
	// PROGRAMMATIC LLM CALLS
	// ============================================

	private async generateContent(systemPrompt: string, userPrompt: string, loggingName: string = 'growth-writer-tweet'): Promise<string> {
		const modelSelection = this.settingsService.state.modelSelectionOfFeature['Chat'] ?? null
		if (!modelSelection) throw new Error('[TwitterService] No Chat model selected in settings')

		const modelSelectionOptions = this.settingsService.state.optionsOfModelSelection['Chat'][modelSelection.providerName]?.[modelSelection.modelName]
		const overridesOfModel = this.settingsService.state.overridesOfModel

		const { messages, separateSystemMessage } = this.convertService.prepareLLMSimpleMessages({
			simpleMessages: [{ role: 'user', content: userPrompt }],
			systemMessage: systemPrompt,
			modelSelection,
			featureName: 'Chat',
		})

		return new Promise((resolve, reject) => {
			this.llmRouter.sendLLMMessage({
				messagesType: 'chatMessages',
				messages,
				separateSystemMessage,
				chatMode: null,
				modelSelection,
				modelSelectionOptions,
				overridesOfModel,
				logging: { loggingName },
				onText: () => {},
				onFinalMessage: ({ fullText }) => resolve(fullText),
				onError: ({ message }) => reject(new Error(message)),
				onAbort: () => reject(new Error('Aborted')),
			})
		})
	}
}

registerSingleton(ITwitterService, TwitterService, InstantiationType.Delayed);

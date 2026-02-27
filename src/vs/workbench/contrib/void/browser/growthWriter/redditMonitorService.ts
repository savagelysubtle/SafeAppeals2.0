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
	IPlatformAuth,
	IRedditOpportunity,
	IRedditPost,
	IRedditAccountHealth,
	ISubredditConfig,
	OpportunityStatus,
	Silo,
} from '../../common/growthWriter/growthWriterTypes.js';
import {
	SILO_CONFIGS,
	REDDIT_COMMENT_SYSTEM_PROMPT,
	REDDIT_COMMENT_USER_PROMPT_TEMPLATE,
	REDDIT_COOLDOWN_DAYS,
	queryTemplatesOfSilo,
} from '../../common/growthWriter/growthWriterConfig.js';

// ============================================
// SERVICE INTERFACE
// ============================================

export interface IRedditMonitorService {
	readonly _serviceBrand: undefined

	initializeForWorkspace(workspaceId: string): Promise<void>

	// Reddit credential management
	storeCredentials(clientId: string, clientSecret: string, username: string, password: string): Promise<void>
	authenticate(): Promise<void>

	// Monitoring
	scanForOpportunities(silo?: Silo): Promise<IRedditOpportunity[]>
	getOpportunities(filters?: { silo?: Silo; status?: OpportunityStatus }): Promise<IRedditOpportunity[]>

	// Comment generation
	generateCommentForOpportunity(oppId: string): Promise<IRedditOpportunity>
	approveComment(oppId: string): Promise<void>
	postComment(oppId: string): Promise<void>

	// Account health
	getAccountHealth(): Promise<IRedditAccountHealth>

	// Subreddit config management
	seedSubredditConfigs(silo?: Silo): Promise<void>

	// Warm-up checks
	isWarmupComplete(): Promise<boolean>
	shouldIncludeLink(): Promise<boolean>
}

export const IRedditMonitorService = createDecorator<IRedditMonitorService>('redditMonitorService');

// ============================================
// WARM-UP CONSTANTS
// ============================================

const WARMUP_WEEKS_NO_LINKS = 2
const WARMUP_WEEKS_LIMITED_LINKS = 4
const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000
const MAX_REMOVAL_RATE = 0.10

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

class RedditMonitorService extends Disposable implements IRedditMonitorService {
	readonly _serviceBrand: undefined;

	private readonly _channel: IChannel;
	private workspaceId: string | null = null;

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
		this.logService.info('[RedditMonitorService] Service created')
	}

	// ============================================
	// WORKSPACE LIFECYCLE
	// ============================================

	async initializeForWorkspace(workspaceId: string): Promise<void> {
		this.workspaceId = workspaceId
		await this._channel.call('initDatabase', { workspaceId })
		this.logService.info(`[RedditMonitorService] Initialized for workspace: ${workspaceId}`)
	}

	private ensureWorkspace(): string {
		if (!this.workspaceId) {
			this.workspaceId = this.ragService.getWorkspaceId()
		}
		if (!this.workspaceId) {
			throw new Error('[RedditMonitorService] No workspace initialized. Call initializeForWorkspace() first.')
		}
		return this.workspaceId
	}

	// ============================================
	// CREDENTIAL MANAGEMENT
	// ============================================

	async storeCredentials(clientId: string, clientSecret: string, username: string, password: string): Promise<void> {
		await this._channel.call('storeRedditCredentials', { clientId, clientSecret, username, password })
		this.logService.info('[RedditMonitorService] Reddit credentials stored')
	}

	async authenticate(): Promise<void> {
		const creds: { clientId: string; clientSecret: string; username: string; password: string } | null =
			await this._channel.call('loadRedditCredentials')
		if (!creds) {
			throw new Error('[RedditMonitorService] No stored Reddit credentials. Call storeCredentials() first.')
		}
		await this._channel.call('authenticateReddit', creds)
		this.logService.info('[RedditMonitorService] Reddit authenticated')

		const workspaceId = this.ensureWorkspace()
		const existingAuth: IPlatformAuth | null = await this._channel.call('getPlatformAuth', { workspaceId, platform: 'reddit' })
		if (!existingAuth) {
			await this._channel.call('upsertPlatformAuth', {
				workspaceId,
				platform: 'reddit',
				account_name: creds.username,
				warmup_started_at: new Date().toISOString(),
				warmup_complete: 0,
				removal_count: 0,
			})
		}
	}

	// ============================================
	// MONITORING - SCAN FOR OPPORTUNITIES
	// ============================================

	async scanForOpportunities(silo?: Silo): Promise<IRedditOpportunity[]> {
		const workspaceId = this.ensureWorkspace()
		const silos = silo ? [silo] : (Object.keys(SILO_CONFIGS) as Silo[])
		const allOpps: IRedditOpportunity[] = []

		for (const s of silos) {
			const config = SILO_CONFIGS[s]
			const subreddits = config.subreddits
			const keywords = config.monitorKeywords

			this.logService.info(`[RedditMonitorService] Scanning ${subreddits.length} subreddits for silo: ${s}`)

			const posts: IRedditPost[] = await this._channel.call('monitorSubreddits', {
				subreddits,
				limit: 100,
			})

			// Keyword matching on browser side
			const matchedPosts = posts.filter(post => {
				const text = `${post.title} ${post.selftext}`.toLowerCase()
				return keywords.some(kw => text.includes(kw.toLowerCase()))
			})

			this.logService.info(`[RedditMonitorService] Found ${matchedPosts.length}/${posts.length} keyword matches for silo: ${s}`)

			// Check for existing opportunities to avoid duplicates
			const existingOpps: IRedditOpportunity[] = await this._channel.call('getOpportunities', {
				workspaceId,
				silo: s,
			})
			const existingPostIds = new Set(existingOpps.map(o => o.reddit_post_id))

			for (const post of matchedPosts) {
				if (existingPostIds.has(post.id)) continue

				const matchedKws = keywords.filter(kw =>
					`${post.title} ${post.selftext}`.toLowerCase().includes(kw.toLowerCase())
				)

				const opp: Omit<IRedditOpportunity, 'found_at'> = {
					id: generateUuid(),
					subreddit: post.subreddit,
					silo: s,
					reddit_post_id: post.id,
					reddit_post_title: post.title,
					reddit_post_url: `https://reddit.com${post.permalink}`,
					reddit_post_body: post.selftext?.substring(0, 2000) || null,
					matched_keywords: matchedKws.join(', '),
					relevance_score: null,
					status: 'found',
					comment_body: null,
					social_post_id: null,
					expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
				}

				await this._channel.call('createOpportunity', { workspaceId, ...opp })
				allOpps.push({
					...opp,
					found_at: new Date().toISOString(),
				})
			}
		}

		this.logService.info(`[RedditMonitorService] Scan complete: ${allOpps.length} new opportunities found`)
		return allOpps
	}

	// ============================================
	// OPPORTUNITY CRUD
	// ============================================

	async getOpportunities(filters?: { silo?: Silo; status?: OpportunityStatus }): Promise<IRedditOpportunity[]> {
		const workspaceId = this.ensureWorkspace()
		return this._channel.call('getOpportunities', { workspaceId, ...filters })
	}

	// ============================================
	// COMMENT GENERATION
	// ============================================

	async generateCommentForOpportunity(oppId: string): Promise<IRedditOpportunity> {
		const workspaceId = this.ensureWorkspace()

		const opps: IRedditOpportunity[] = await this._channel.call('getOpportunities', { workspaceId })
		const opp = opps.find(o => o.id === oppId)
		if (!opp) {
			throw new Error(`[RedditMonitorService] Opportunity not found: ${oppId}`)
		}

		this.logService.info(`[RedditMonitorService] Generating comment for: "${opp.reddit_post_title}"`)

		// Gather RAG context
		const ragContext = await this.gatherRAGContext(opp.silo, opp.reddit_post_title)

		// Find most recent blog for this silo to optionally link
		const campaigns: ICampaign[] = await this._channel.call('getCampaigns', {
			workspaceId,
			silo: opp.silo,
			status: 'published',
		})
		const latestBlog = campaigns.length > 0 ? campaigns[campaigns.length - 1] : null
		const blogUrl = latestBlog?.blog_url ?? '(no blog to link — skip any link mention)'

		// Warm-up aware prompt
		const includeLink = await this.shouldIncludeLink()

		let userPrompt = REDDIT_COMMENT_USER_PROMPT_TEMPLATE
			.replace('{subreddit}', opp.subreddit)
			.replace('{post_title}', opp.reddit_post_title)
			.replace('{post_body}', opp.reddit_post_body ?? '(no body text)')
			.replace('{rag_context}', ragContext)
			.replace('{blog_url}', includeLink ? blogUrl : '(DO NOT include any links — account is in warm-up period)')

		if (!includeLink) {
			userPrompt += '\n\nIMPORTANT: Do NOT include any links or URLs in this comment. The account is in warm-up mode.'
		}

		const commentBody = await this.generateContent(
			REDDIT_COMMENT_SYSTEM_PROMPT,
			userPrompt,
			'growth-writer-reddit',
		)

		// Update opportunity with draft
		await this._channel.call('updateOpportunityStatus', {
			workspaceId,
			id: oppId,
			status: 'drafted',
			comment_body: commentBody.trim(),
		})

		this.logService.info(`[RedditMonitorService] Comment drafted for: "${opp.reddit_post_title}" (${commentBody.length} chars)`)

		return {
			...opp,
			status: 'drafted',
			comment_body: commentBody.trim(),
		}
	}

	// ============================================
	// APPROVE + POST
	// ============================================

	async approveComment(oppId: string): Promise<void> {
		const workspaceId = this.ensureWorkspace()
		await this._channel.call('updateOpportunityStatus', {
			workspaceId,
			id: oppId,
			status: 'approved',
		})
		this.logService.info(`[RedditMonitorService] Comment approved: ${oppId}`)
	}

	async postComment(oppId: string): Promise<void> {
		const workspaceId = this.ensureWorkspace()

		const opps: IRedditOpportunity[] = await this._channel.call('getOpportunities', { workspaceId })
		const opp = opps.find(o => o.id === oppId)
		if (!opp) {
			throw new Error(`[RedditMonitorService] Opportunity not found: ${oppId}`)
		}
		if (opp.status !== 'approved') {
			throw new Error(`[RedditMonitorService] Comment must be approved before posting. Current status: ${opp.status}`)
		}
		if (!opp.comment_body) {
			throw new Error('[RedditMonitorService] No comment body to post')
		}

		this.logService.info(`[RedditMonitorService] Posting comment to r/${opp.subreddit} on: "${opp.reddit_post_title}"`)

		// thingId for comments on posts = t3_ prefix + post id
		const thingId = opp.reddit_post_id.startsWith('t3_') ? opp.reddit_post_id : `t3_${opp.reddit_post_id}`
		await this._channel.call('postRedditComment', {
			thingId,
			text: opp.comment_body,
		})

		await this._channel.call('updateOpportunityStatus', {
			workspaceId,
			id: oppId,
			status: 'commented',
		})

		// Update subreddit config for cooldown tracking
		const subConfigs: ISubredditConfig[] = await this._channel.call('getSubredditConfig', {
			workspaceId,
			silo: opp.silo,
		})
		const subConfig = subConfigs.find(sc => sc.subreddit_name === opp.subreddit)
		if (subConfig) {
			await this._channel.call('upsertSubredditConfig', {
				workspaceId,
				...subConfig,
				last_commented_at: new Date().toISOString(),
				total_comments: subConfig.total_comments + 1,
			})
		}

		this.logService.info(`[RedditMonitorService] Comment posted to r/${opp.subreddit}`)
	}

	// ============================================
	// ACCOUNT HEALTH
	// ============================================

	async getAccountHealth(): Promise<IRedditAccountHealth> {
		const workspaceId = this.ensureWorkspace()
		return this._channel.call('getRedditAccountHealth', { workspaceId })
	}

	// ============================================
	// SUBREDDIT CONFIG SEEDING
	// ============================================

	async seedSubredditConfigs(silo?: Silo): Promise<void> {
		const workspaceId = this.ensureWorkspace()
		const silos = silo ? [silo] : (Object.keys(SILO_CONFIGS) as Silo[])

		for (const s of silos) {
			const config = SILO_CONFIGS[s]
			for (const subreddit of config.subreddits) {
				const existing: ISubredditConfig[] = await this._channel.call('getSubredditConfig', {
					workspaceId,
					silo: s,
				})
				const already = existing.find(sc => sc.subreddit_name === subreddit)
				if (already) continue

				await this._channel.call('upsertSubredditConfig', {
					workspaceId,
					id: generateUuid(),
					silo: s,
					subreddit_name: subreddit,
					display_name: `r/${subreddit}`,
					rules_summary: null,
					monitor_keywords: config.monitorKeywords.join(', '),
					cooldown_days: REDDIT_COOLDOWN_DAYS,
					last_posted_at: null,
					last_commented_at: null,
					total_posts: 0,
					total_comments: 0,
					is_active: 1,
				})
			}
		}

		this.logService.info(`[RedditMonitorService] Subreddit configs seeded for: ${silos.join(', ')}`)
	}

	// ============================================
	// WARM-UP LOGIC
	// ============================================

	async isWarmupComplete(): Promise<boolean> {
		const workspaceId = this.ensureWorkspace()
		const auth: IPlatformAuth | null = await this._channel.call('getPlatformAuth', { workspaceId, platform: 'reddit' })
		if (!auth) return false
		return auth.warmup_complete === 1
	}

	async shouldIncludeLink(): Promise<boolean> {
		const workspaceId = this.ensureWorkspace()
		const auth: IPlatformAuth | null = await this._channel.call('getPlatformAuth', { workspaceId, platform: 'reddit' })
		if (!auth || !auth.warmup_started_at) return false

		const startedAt = new Date(auth.warmup_started_at).getTime()
		const weeksElapsed = (Date.now() - startedAt) / MS_PER_WEEK

		// Check removal rate — disable links if too many removals
		if (auth.removal_count > 0) {
			const totalComments = await this.getTotalCommentCount()
			if (totalComments > 0 && auth.removal_count / totalComments > MAX_REMOVAL_RATE) {
				this.logService.warn(`[RedditMonitorService] Removal rate too high (${auth.removal_count}/${totalComments}). No links.`)
				return false
			}
		}

		// Weeks 1-2: no links
		if (weeksElapsed < WARMUP_WEEKS_NO_LINKS) return false

		// Weeks 3-4: limited links (let caller handle frequency)
		if (weeksElapsed < WARMUP_WEEKS_LIMITED_LINKS) return true

		// Week 5+: full cadence, mark warm-up complete
		if (!auth.warmup_complete) {
			await this._channel.call('upsertPlatformAuth', {
				workspaceId,
				platform: 'reddit',
				warmup_complete: 1,
			})
		}

		return true
	}

	private async getTotalCommentCount(): Promise<number> {
		const workspaceId = this.ensureWorkspace()
		const allConfigs: ISubredditConfig[] = await this._channel.call('getSubredditConfig', { workspaceId })
		return allConfigs.reduce((sum, sc) => sum + sc.total_comments, 0)
	}

	// ============================================
	// RAG CONTEXT GATHERING (shared with GrowthWriterService)
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
			this.logService.info(`[RedditMonitorService] RAG gathered ${seenChunks.size} unique chunks`)
			return combined || '(No RAG context available)'
		} catch (error) {
			this.logService.warn('[RedditMonitorService] RAG query failed:', error)
			return '(RAG context unavailable)'
		}
	}

	// ============================================
	// PROGRAMMATIC LLM CALLS
	// ============================================

	private async generateContent(systemPrompt: string, userPrompt: string, loggingName: string = 'growth-writer-reddit'): Promise<string> {
		const modelSelection = this.settingsService.state.modelSelectionOfFeature['Chat'] ?? null
		if (!modelSelection) throw new Error('[RedditMonitorService] No Chat model selected in settings')

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

registerSingleton(IRedditMonitorService, RedditMonitorService, InstantiationType.Delayed);

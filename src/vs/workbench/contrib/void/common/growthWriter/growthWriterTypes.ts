/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// ============================================
// CORE UNION TYPES
// ============================================

export type Silo = 'lawyers' | 'workers_comp' | 'researchers' | 'students' | 'business'

export type ContentAngle = 'product' | 'educational' | 'problem_solving'

export type IdeaSource = 'ai' | 'manual'

export type IdeaStatus = 'pending' | 'used' | 'rejected'

export type CampaignStatus = 'generating' | 'draft' | 'approved' | 'publishing' | 'published' | 'failed'

export type SocialPostStatus = 'draft' | 'approved' | 'scheduled' | 'posting' | 'posted' | 'failed'

export type Platform = 'reddit' | 'twitter' | 'linkedin'

export type PostType = 'comment' | 'top_level' | 'tweet' | 'thread' | 'post'

export type OpportunityStatus = 'found' | 'drafted' | 'approved' | 'commented' | 'skipped' | 'expired'

// ============================================
// DATABASE ROW INTERFACES
// ============================================

export interface IBlogIdea {
	id: string
	silo: Silo
	title: string
	description: string | null
	keywords: string | null
	content_angle: ContentAngle | null
	source: IdeaSource
	status: IdeaStatus
	priority: number
	embedding_hash: string | null
	created_at: string
	used_at: string | null
}

export interface ICampaign {
	id: string
	silo: Silo
	blog_idea_id: string | null
	blog_title: string | null
	blog_slug: string | null
	blog_content: string | null
	blog_cms_id: string | null
	blog_url: string | null
	status: CampaignStatus
	scheduled_for: string | null
	generated_at: string | null
	approved_at: string | null
	published_at: string | null
	error_message: string | null
	created_at: string
}

export interface ISocialPost {
	id: string
	campaign_id: string
	platform: Platform
	channel: string | null
	post_type: PostType | null
	title: string | null
	body: string
	content_hash: string | null
	utm_url: string | null
	status: SocialPostStatus
	scheduled_for: string | null
	posted_at: string | null
	post_url: string | null
	reddit_parent_id: string | null
	error_message: string | null
	metrics: string | null
	metrics_updated_at: string | null
	created_at: string
}

export interface ISubredditConfig {
	id: string
	silo: Silo
	subreddit_name: string
	display_name: string | null
	rules_summary: string | null
	monitor_keywords: string | null
	cooldown_days: number
	last_posted_at: string | null
	last_commented_at: string | null
	total_posts: number
	total_comments: number
	is_active: number
	created_at: string
}

export interface IRedditOpportunity {
	id: string
	subreddit: string
	silo: Silo
	reddit_post_id: string
	reddit_post_title: string
	reddit_post_url: string
	reddit_post_body: string | null
	matched_keywords: string | null
	relevance_score: number | null
	status: OpportunityStatus
	comment_body: string | null
	social_post_id: string | null
	found_at: string
	expires_at: string | null
}

export interface IPlatformAuth {
	platform: Platform
	access_token_encrypted: string | null
	refresh_token_encrypted: string | null
	expires_at: string | null
	account_name: string | null
	account_karma: number | null
	warmup_started_at: string | null
	warmup_complete: number
	removal_count: number
	last_removal_at: string | null
	created_at: string
	updated_at: string | null
}

// ============================================
// SCHEDULE CONFIGURATION
// ============================================

export interface ISiloSchedule {
	preferredDay: 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday'
	priority: number
	platforms: Platform[]
}

export interface IScheduleConfig {
	siloScheduleOfSilo: Record<Silo, ISiloSchedule>
	allowOverride: boolean
	maxBlogsPerWeek: number
}

// ============================================
// SCHEDULER STATE
// ============================================

export interface ISchedulerState {
	enabled: boolean
	running: boolean
	lastRunAt: string | null
	nextRunAt: string | null
	pendingActions: string[]
}

// ============================================
// SILO CONFIGURATION
// ============================================

export interface ISiloConfig {
	name: Silo
	displayName: string
	audience: string
	contentAngle: string
	subreddits: string[]
	monitorKeywords: string[]
}

export interface ISiloExamples {
	blogExcerpt: string
	redditComment: string
	tweetThread: string[]
	linkedInPost?: string
}

// ============================================
// SOCIAL METRICS
// ============================================

export interface ISocialMetrics {
	upvotes?: number
	comments?: number
	likes?: number
	retweets?: number
	impressions?: number
	bookmark_count?: number
}

// ============================================
// IPC CHANNEL TYPES
// ============================================

export interface IGrowthWriterChannelCommand {
	// Database lifecycle
	initDatabase: { workspaceId: string }

	// Blog ideas CRUD
	getIdeas: { silo?: Silo; status?: IdeaStatus }
	createIdea: Omit<IBlogIdea, 'created_at' | 'used_at'>
	updateIdeaStatus: { id: string; status: IdeaStatus }

	// Campaigns CRUD
	getCampaigns: { silo?: Silo; status?: CampaignStatus }
	createCampaign: Omit<ICampaign, 'created_at'>
	updateCampaignStatus: { id: string; status: CampaignStatus; error_message?: string }

	// Social posts CRUD
	getSocialPosts: { campaign_id?: string; platform?: Platform; status?: SocialPostStatus }
	createSocialPost: Omit<ISocialPost, 'created_at'>
	updateSocialPostStatus: { id: string; status: SocialPostStatus; post_url?: string; error_message?: string }

	// Subreddit config
	getSubredditConfig: { silo?: Silo }
	upsertSubredditConfig: Omit<ISubredditConfig, 'created_at'>

	// Reddit opportunities
	getOpportunities: { silo?: Silo; status?: OpportunityStatus }
	createOpportunity: Omit<IRedditOpportunity, 'found_at'>
	updateOpportunityStatus: { id: string; status: OpportunityStatus; comment_body?: string }

	// Platform auth
	getPlatformAuth: { platform: Platform }
	upsertPlatformAuth: Partial<IPlatformAuth> & { platform: Platform }

	// Semantic dedup (Phase 2)
	checkSemanticDuplicate: { workspaceId: string; newTitle: string; silo: Silo }
	getIdeaTitles: { workspaceId: string; silo: Silo }

	// Blog generation pipeline (Phase 3)
	updateCampaignContent: { id: string; blog_title: string; blog_slug: string; blog_content: string; blog_url: string }
	publishBlog: { campaignId: string }

	// Reddit integration (Phase 4)
	authenticateReddit: { clientId: string; clientSecret: string; username: string; password: string }
	monitorSubreddits: { subreddits: string[]; limit?: number; after?: string }
	searchSubreddit: { subreddit: string; query: string; time?: string }
	postRedditComment: { thingId: string; text: string }
	getRedditAccountHealth: {}
	storeRedditCredentials: { clientId: string; clientSecret: string; username: string; password: string }
	loadRedditCredentials: {}

	// Twitter integration (Phase 5)
	startTwitterAuth: { clientId: string; clientSecret?: string; redirectUri?: string }
	exchangeTwitterCode: { code: string; state: string }
	postTweet: { socialPostId: string; text: string }
	postThread: { tweets: Array<{ socialPostId: string; text: string }> }
	getTweetMetrics: { tweetId: string }
	getTwitterMe: {}
	refreshTwitterTokens: {}
	storeTwitterTokens: { accessToken: string; refreshToken: string; expiresAt: number; clientId: string }
	loadTwitterTokens: {}
}

// ============================================
// REDDIT API TYPES (Phase 4)
// ============================================

export interface IRedditPost {
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

export interface IRedditAccountHealth {
	username: string
	karma: number
	warmupStartedAt: string | null
	warmupComplete: boolean
	removalCount: number
	lastRemovalAt: string | null
}

// ============================================
// CMS PUBLISH RESULT (Phase 3)
// ============================================

export interface ICMSPublishResult {
	id: string
	slug: string
	url: string
}

// ============================================
// RAG QUERY TYPES (Phase 2)
// ============================================

export interface ISiloQuerySet {
	featureQuery: string
	workflowQuery: string
	painPointQuery: string
	differentiatorQuery: string
}

// ============================================
// TWITTER API TYPES (Phase 5)
// ============================================

export interface ITwitterAuthResult {
	accessToken: string
	refreshToken: string
	expiresAt: number
}

export interface ITweetResult {
	id: string
	text: string
}

export interface ITweetMetrics {
	retweet_count: number
	reply_count: number
	like_count: number
	quote_count: number
	impression_count: number
	bookmark_count: number
}

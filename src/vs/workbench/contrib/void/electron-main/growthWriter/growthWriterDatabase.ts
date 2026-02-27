/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { Database } from '@vscode/sqlite3';
import { createRequire } from 'module';
import { ILogService } from '../../../../../platform/log/common/log.js';
import {
	GROWTH_DB_NAME,
	ALL_CREATE_STATEMENTS,
} from '../../common/growthWriter/growthWriterDatabase.js';
import type {
	IBlogIdea,
	ICampaign,
	ISocialPost,
	ISubredditConfig,
	IRedditOpportunity,
	IPlatformAuth,
	Silo,
	IdeaStatus,
	CampaignStatus,
	SocialPostStatus,
	Platform,
	OpportunityStatus,
} from '../../common/growthWriter/growthWriterTypes.js';

/**
 * Per-workspace SQLite storage for growth writer data.
 * Follows the same micro database pattern as ChatThreadStorageService.
 */
export class GrowthWriterDatabaseService {
	private db: Database | null = null;
	private readonly workspaceId: string;

	constructor(
		private readonly logService: ILogService,
		private readonly basePath: string,
		workspaceId: string,
	) {
		if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null' || workspaceId.trim() === '') {
			throw new Error('GrowthWriterDatabaseService: workspaceId is REQUIRED. Each workspace must have its own isolated growth writer storage.');
		}
		this.workspaceId = workspaceId;
	}

	async initialize(): Promise<void> {
		if (this.db) return;

		try {
			const fs = await import('fs');
			const path = await import('path');

			const dbDir = path.join(this.basePath, '.safe-appeals-navigator', 'databases', 'workspaces', this.workspaceId);
			const dbPath = path.join(dbDir, GROWTH_DB_NAME);

			this.logService.info(`[GrowthWriterDB] Initializing SQLite database for workspace: ${this.workspaceId}`);
			this.logService.info(`[GrowthWriterDB] Database path: ${dbPath}`);

			if (!fs.existsSync(dbDir)) {
				this.logService.info(`[GrowthWriterDB] Creating workspace database directory: ${dbDir}`);
				fs.mkdirSync(dbDir, { recursive: true });
			}

			const require = createRequire(import.meta.url);
			const sqlite3 = require('@vscode/sqlite3');

			this.db = new sqlite3.Database(dbPath);
			this.logService.info(`[GrowthWriterDB] Database opened for workspace ${this.workspaceId}`);

			await this.createTables();
			this.logService.info('[GrowthWriterDB] All tables created/verified');
		} catch (error) {
			this.logService.error('[GrowthWriterDB] Failed to initialize database:', error);
			throw error;
		}
	}

	private async createTables(): Promise<void> {
		if (!this.db) throw new Error('Database not initialized');

		for (const sql of ALL_CREATE_STATEMENTS) {
			await this.execAsync(sql);
		}
	}

	// ========== BLOG IDEAS CRUD ==========

	async getIdeas(filters?: { silo?: Silo; status?: IdeaStatus }): Promise<IBlogIdea[]> {
		if (!this.db) await this.initialize();

		let sql = 'SELECT * FROM growth_blog_ideas WHERE 1=1';
		const params: any[] = [];

		if (filters?.silo) {
			sql += ' AND silo = ?';
			params.push(filters.silo);
		}
		if (filters?.status) {
			sql += ' AND status = ?';
			params.push(filters.status);
		}

		sql += ' ORDER BY priority DESC, created_at DESC';
		return this.allAsync<IBlogIdea>(sql, params);
	}

	async createIdea(idea: Omit<IBlogIdea, 'created_at' | 'used_at'>): Promise<void> {
		if (!this.db) await this.initialize();

		await this.runAsync(
			`INSERT INTO growth_blog_ideas (id, silo, title, description, keywords, content_angle, source, status, priority, embedding_hash)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[idea.id, idea.silo, idea.title, idea.description, idea.keywords,
			idea.content_angle, idea.source, idea.status, idea.priority, idea.embedding_hash]
		);
	}

	async updateIdeaStatus(id: string, status: IdeaStatus): Promise<void> {
		if (!this.db) await this.initialize();

		const usedAt = status === 'used' ? new Date().toISOString() : null;
		await this.runAsync(
			'UPDATE growth_blog_ideas SET status = ?, used_at = ? WHERE id = ?',
			[status, usedAt, id]
		);
	}

	async getIdeaTitles(silo: Silo): Promise<string[]> {
		if (!this.db) await this.initialize();

		const rows = await this.allAsync<{ title: string }>(
			'SELECT title FROM growth_blog_ideas WHERE silo = ?',
			[silo]
		);
		return rows.map(r => r.title);
	}

	// ========== CAMPAIGNS CRUD ==========

	async getCampaigns(filters?: { silo?: Silo; status?: CampaignStatus }): Promise<ICampaign[]> {
		if (!this.db) await this.initialize();

		let sql = 'SELECT * FROM growth_campaigns WHERE 1=1';
		const params: any[] = [];

		if (filters?.silo) {
			sql += ' AND silo = ?';
			params.push(filters.silo);
		}
		if (filters?.status) {
			sql += ' AND status = ?';
			params.push(filters.status);
		}

		sql += ' ORDER BY created_at DESC';
		return this.allAsync<ICampaign>(sql, params);
	}

	async createCampaign(campaign: Omit<ICampaign, 'created_at'>): Promise<void> {
		if (!this.db) await this.initialize();

		await this.runAsync(
			`INSERT INTO growth_campaigns (id, silo, blog_idea_id, blog_title, blog_slug, blog_content, blog_cms_id, blog_url, status, scheduled_for, generated_at, approved_at, published_at, error_message)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[campaign.id, campaign.silo, campaign.blog_idea_id, campaign.blog_title, campaign.blog_slug,
			campaign.blog_content, campaign.blog_cms_id, campaign.blog_url, campaign.status,
			campaign.scheduled_for, campaign.generated_at, campaign.approved_at, campaign.published_at,
			campaign.error_message]
		);
	}

	async getCampaignById(id: string): Promise<ICampaign | undefined> {
		if (!this.db) await this.initialize();
		return this.getAsync<ICampaign>('SELECT * FROM growth_campaigns WHERE id = ?', [id]);
	}

	async getCampaignByIdeaId(ideaId: string): Promise<ICampaign | undefined> {
		if (!this.db) await this.initialize();
		return this.getAsync<ICampaign>('SELECT * FROM growth_campaigns WHERE blog_idea_id = ? ORDER BY created_at DESC LIMIT 1', [ideaId]);
	}

	async updateCampaignContent(id: string, blogTitle: string, blogSlug: string, blogContent: string, blogUrl: string): Promise<void> {
		if (!this.db) await this.initialize();
		await this.runAsync(
			`UPDATE growth_campaigns SET blog_title = ?, blog_slug = ?, blog_content = ?, blog_url = ?, status = 'draft', generated_at = ? WHERE id = ?`,
			[blogTitle, blogSlug, blogContent, blogUrl, new Date().toISOString(), id]
		);
	}

	async updateCampaignPublished(id: string, blogCmsId: string, blogUrl: string): Promise<void> {
		if (!this.db) await this.initialize();
		await this.runAsync(
			`UPDATE growth_campaigns SET blog_cms_id = ?, blog_url = ?, status = 'published', published_at = ? WHERE id = ?`,
			[blogCmsId, blogUrl, new Date().toISOString(), id]
		);
	}

	async updateCampaignStatus(id: string, status: CampaignStatus, errorMessage?: string): Promise<void> {
		if (!this.db) await this.initialize();

		const timestampField = status === 'approved' ? 'approved_at'
			: status === 'published' ? 'published_at'
				: status === 'draft' ? 'generated_at'
					: null;

		if (timestampField) {
			await this.runAsync(
				`UPDATE growth_campaigns SET status = ?, ${timestampField} = ?, error_message = ? WHERE id = ?`,
				[status, new Date().toISOString(), errorMessage ?? null, id]
			);
		} else {
			await this.runAsync(
				'UPDATE growth_campaigns SET status = ?, error_message = ? WHERE id = ?',
				[status, errorMessage ?? null, id]
			);
		}
	}

	// ========== SOCIAL POSTS CRUD ==========

	async getSocialPosts(filters?: { campaign_id?: string; platform?: Platform; status?: SocialPostStatus }): Promise<ISocialPost[]> {
		if (!this.db) await this.initialize();

		let sql = 'SELECT * FROM growth_social_posts WHERE 1=1';
		const params: any[] = [];

		if (filters?.campaign_id) {
			sql += ' AND campaign_id = ?';
			params.push(filters.campaign_id);
		}
		if (filters?.platform) {
			sql += ' AND platform = ?';
			params.push(filters.platform);
		}
		if (filters?.status) {
			sql += ' AND status = ?';
			params.push(filters.status);
		}

		sql += ' ORDER BY created_at DESC';
		return this.allAsync<ISocialPost>(sql, params);
	}

	async createSocialPost(post: Omit<ISocialPost, 'created_at'>): Promise<void> {
		if (!this.db) await this.initialize();

		await this.runAsync(
			`INSERT INTO growth_social_posts (id, campaign_id, platform, channel, post_type, title, body, content_hash, utm_url, status, scheduled_for, posted_at, post_url, reddit_parent_id, error_message, metrics, metrics_updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[post.id, post.campaign_id, post.platform, post.channel, post.post_type,
			post.title, post.body, post.content_hash, post.utm_url, post.status,
			post.scheduled_for, post.posted_at, post.post_url, post.reddit_parent_id,
			post.error_message, post.metrics, post.metrics_updated_at]
		);
	}

	async updateSocialPostStatus(id: string, status: SocialPostStatus, postUrl?: string, errorMessage?: string): Promise<void> {
		if (!this.db) await this.initialize();

		const postedAt = status === 'posted' ? new Date().toISOString() : null;
		await this.runAsync(
			'UPDATE growth_social_posts SET status = ?, posted_at = COALESCE(?, posted_at), post_url = COALESCE(?, post_url), error_message = ? WHERE id = ?',
			[status, postedAt, postUrl ?? null, errorMessage ?? null, id]
		);
	}

	// ========== SUBREDDIT CONFIG CRUD ==========

	async getSubredditConfig(filters?: { silo?: Silo }): Promise<ISubredditConfig[]> {
		if (!this.db) await this.initialize();

		let sql = 'SELECT * FROM growth_subreddit_config WHERE 1=1';
		const params: any[] = [];

		if (filters?.silo) {
			sql += ' AND silo = ?';
			params.push(filters.silo);
		}

		sql += ' ORDER BY silo, subreddit_name';
		return this.allAsync<ISubredditConfig>(sql, params);
	}

	async upsertSubredditConfig(config: Omit<ISubredditConfig, 'created_at'>): Promise<void> {
		if (!this.db) await this.initialize();

		await this.runAsync(
			`INSERT OR REPLACE INTO growth_subreddit_config (id, silo, subreddit_name, display_name, rules_summary, monitor_keywords, cooldown_days, last_posted_at, last_commented_at, total_posts, total_comments, is_active)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[config.id, config.silo, config.subreddit_name, config.display_name,
			config.rules_summary, config.monitor_keywords, config.cooldown_days,
			config.last_posted_at, config.last_commented_at, config.total_posts,
			config.total_comments, config.is_active]
		);
	}

	// ========== REDDIT OPPORTUNITIES CRUD ==========

	async getOpportunities(filters?: { silo?: Silo; status?: OpportunityStatus }): Promise<IRedditOpportunity[]> {
		if (!this.db) await this.initialize();

		let sql = 'SELECT * FROM growth_reddit_opportunities WHERE 1=1';
		const params: any[] = [];

		if (filters?.silo) {
			sql += ' AND silo = ?';
			params.push(filters.silo);
		}
		if (filters?.status) {
			sql += ' AND status = ?';
			params.push(filters.status);
		}

		sql += ' ORDER BY found_at DESC';
		return this.allAsync<IRedditOpportunity>(sql, params);
	}

	async createOpportunity(opp: Omit<IRedditOpportunity, 'found_at'>): Promise<void> {
		if (!this.db) await this.initialize();

		await this.runAsync(
			`INSERT OR IGNORE INTO growth_reddit_opportunities (id, subreddit, silo, reddit_post_id, reddit_post_title, reddit_post_url, reddit_post_body, matched_keywords, relevance_score, status, comment_body, social_post_id, expires_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[opp.id, opp.subreddit, opp.silo, opp.reddit_post_id, opp.reddit_post_title,
			opp.reddit_post_url, opp.reddit_post_body, opp.matched_keywords,
			opp.relevance_score, opp.status, opp.comment_body, opp.social_post_id, opp.expires_at]
		);
	}

	async updateOpportunityStatus(id: string, status: OpportunityStatus, commentBody?: string): Promise<void> {
		if (!this.db) await this.initialize();

		await this.runAsync(
			'UPDATE growth_reddit_opportunities SET status = ?, comment_body = COALESCE(?, comment_body) WHERE id = ?',
			[status, commentBody ?? null, id]
		);
	}

	// ========== PLATFORM AUTH CRUD ==========

	async getPlatformAuth(platform: Platform): Promise<IPlatformAuth | undefined> {
		if (!this.db) await this.initialize();

		return this.getAsync<IPlatformAuth>(
			'SELECT * FROM growth_platform_auth WHERE platform = ?',
			[platform]
		);
	}

	async upsertPlatformAuth(auth: Partial<IPlatformAuth> & { platform: Platform }): Promise<void> {
		if (!this.db) await this.initialize();

		const existing = await this.getPlatformAuth(auth.platform);
		if (existing) {
			const fields: string[] = [];
			const values: any[] = [];

			for (const [key, value] of Object.entries(auth)) {
				if (key !== 'platform' && key !== 'created_at' && value !== undefined) {
					fields.push(`${key} = ?`);
					values.push(value);
				}
			}

			fields.push('updated_at = ?');
			values.push(new Date().toISOString());
			values.push(auth.platform);

			await this.runAsync(
				`UPDATE growth_platform_auth SET ${fields.join(', ')} WHERE platform = ?`,
				values
			);
		} else {
			await this.runAsync(
				`INSERT INTO growth_platform_auth (platform, access_token_encrypted, refresh_token_encrypted, expires_at, account_name, account_karma, warmup_started_at, warmup_complete, removal_count, last_removal_at, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				[auth.platform, auth.access_token_encrypted ?? null, auth.refresh_token_encrypted ?? null,
				auth.expires_at ?? null, auth.account_name ?? null, auth.account_karma ?? null,
				auth.warmup_started_at ?? null, auth.warmup_complete ?? 0,
				auth.removal_count ?? 0, auth.last_removal_at ?? null, new Date().toISOString()]
			);
		}
	}

	// ========== LIFECYCLE ==========

	async dispose(): Promise<void> {
		if (!this.db) return;

		return new Promise((resolve, reject) => {
			this.db!.close((err) => {
				if (err) {
					this.logService.error('[GrowthWriterDB] Error closing database:', err);
					reject(err);
				} else {
					this.logService.info(`[GrowthWriterDB] Database closed for workspace ${this.workspaceId}`);
					this.db = null;
					resolve();
				}
			});
		});
	}

	// ========== SQLite Helper Methods ==========

	private execAsync(sql: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db!.exec(sql, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	private runAsync(sql: string, params: any[] = []): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db!.run(sql, params, (err) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	private getAsync<T>(sql: string, params: any[] = []): Promise<T | undefined> {
		return new Promise((resolve, reject) => {
			this.db!.get(sql, params, (err, row) => {
				if (err) reject(err);
				else resolve(row as T | undefined);
			});
		});
	}

	private allAsync<T>(sql: string, params: any[] = []): Promise<T[]> {
		return new Promise((resolve, reject) => {
			this.db!.all(sql, params, (err, rows) => {
				if (err) reject(err);
				else resolve(rows as T[]);
			});
		});
	}
}

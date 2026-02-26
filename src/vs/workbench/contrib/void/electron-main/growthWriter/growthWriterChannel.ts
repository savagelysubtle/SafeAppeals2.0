/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { IServerChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { GrowthWriterDatabaseService } from './growthWriterDatabase.js';

/**
 * IPC Channel for the Growth Writer extension.
 * Manages per-workspace SQLite databases for growth writer data.
 * Follows the ChatThreadStorageChannel / DocuSignChannel pattern.
 *
 * Phase 1: Database CRUD operations only.
 * Phase 2+: Blog publishing, Reddit/Twitter/LinkedIn API calls, content embedding.
 */
export class GrowthWriterChannel implements IServerChannel {
	private instanceOfWorkspaceId: Map<string, GrowthWriterDatabaseService> = new Map();

	constructor(
		private readonly appDataPath: string,
		private readonly logService: ILogService,
	) {
		this.logService.info('[GrowthWriterChannel] Channel created');
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
					const { workspaceId, id, status } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					await instance.updateIdeaStatus(id, status);
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
					const { workspaceId, id, status, error_message } = arg;
					const instance = await this.getOrCreateInstance(workspaceId);
					await instance.updateCampaignStatus(id, status, error_message);
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

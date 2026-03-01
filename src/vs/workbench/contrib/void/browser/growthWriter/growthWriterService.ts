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
import type { SemanticDuplicateResult } from '../../electron-main/growthWriter/contentEmbeddingService.js';

import {
	IBlogIdea,
	ICampaign,
	ICMSPublishResult,
	IdeaStatus,
	CampaignStatus,
	Silo,
	ContentAngle,
} from '../../common/growthWriter/growthWriterTypes.js';
import {
	SILO_CONFIGS,
	DEFAULT_SCHEDULE,
	queryTemplatesOfSilo,
	IDEA_GENERATION_SYSTEM_PROMPT,
	IDEA_GENERATION_USER_PROMPT_TEMPLATE,
	BLOG_SYSTEM_PROMPT,
	BLOG_USER_PROMPT_TEMPLATE,
	buildUtmUrl,
} from '../../common/growthWriter/growthWriterConfig.js';

// ============================================
// SERVICE INTERFACE
// ============================================

export interface IGrowthWriterService {
	readonly _serviceBrand: undefined

	initializeForWorkspace(workspaceId: string): Promise<void>

	// Blog Ideas (Phase 2)
	generateIdeasForSilo(silo: Silo, count?: number): Promise<IBlogIdea[]>
	getIdeas(filters?: { silo?: Silo; status?: IdeaStatus }): Promise<IBlogIdea[]>
	updateIdeaStatus(id: string, status: IdeaStatus): Promise<void>

	// Blog Generation Pipeline (Phase 3)
	generateBlogForIdea(ideaId: string): Promise<ICampaign>
	getCampaigns(filters?: { silo?: Silo; status?: CampaignStatus }): Promise<ICampaign[]>
	approveBlog(campaignId: string): Promise<void>
	publishBlog(campaignId: string): Promise<ICMSPublishResult>
}

export const IGrowthWriterService = createDecorator<IGrowthWriterService>('growthWriterService');

// ============================================
// LLM RESPONSE PARSING
// ============================================

interface RawIdeaFromLLM {
	title: string
	description: string
	keywords: string
	content_angle: ContentAngle
	priority: number
}

// ============================================
// UTILITIES
// ============================================

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/['']/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.substring(0, 100)
}

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

class GrowthWriterService extends Disposable implements IGrowthWriterService {
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
		this.logService.info('[GrowthWriterService] Service created')
	}

	// ============================================
	// WORKSPACE LIFECYCLE
	// ============================================

	async initializeForWorkspace(workspaceId: string): Promise<void> {
		this.workspaceId = workspaceId
		await this._channel.call('initDatabase', { workspaceId })
		this.logService.info(`[GrowthWriterService] Initialized for workspace: ${workspaceId}`)
	}

	private ensureWorkspace(): string {
		if (!this.workspaceId) {
			this.workspaceId = this.ragService.getWorkspaceId()
		}
		if (!this.workspaceId) {
			throw new Error('[GrowthWriterService] No workspace initialized. Call initializeForWorkspace() first or open a workspace.')
		}
		return this.workspaceId
	}

	// ============================================
	// BLOG IDEAS - DB OPERATIONS
	// ============================================

	async getIdeas(filters?: { silo?: Silo; status?: IdeaStatus }): Promise<IBlogIdea[]> {
		const workspaceId = this.ensureWorkspace()
		return this._channel.call('getIdeas', { workspaceId, ...filters })
	}

	async updateIdeaStatus(id: string, status: IdeaStatus): Promise<void> {
		const workspaceId = this.ensureWorkspace()
		await this._channel.call('updateIdeaStatus', { workspaceId, id, status })
	}

	// ============================================
	// CAMPAIGNS - DB OPERATIONS (Phase 3)
	// ============================================

	async getCampaigns(filters?: { silo?: Silo; status?: CampaignStatus }): Promise<ICampaign[]> {
		const workspaceId = this.ensureWorkspace()
		return this._channel.call('getCampaigns', { workspaceId, ...filters })
	}

	async approveBlog(campaignId: string): Promise<void> {
		const workspaceId = this.ensureWorkspace()
		await this._channel.call('updateCampaignStatus', { workspaceId, id: campaignId, status: 'approved' })
		this.logService.info(`[GrowthWriterService] Campaign approved: ${campaignId}`)
	}

	async publishBlog(campaignId: string): Promise<ICMSPublishResult> {
		const workspaceId = this.ensureWorkspace()
		this.logService.info(`[GrowthWriterService] Publishing campaign: ${campaignId}`)
		const result: ICMSPublishResult = await this._channel.call('publishBlog', { workspaceId, campaignId })
		this.logService.info(`[GrowthWriterService] Published: ${result.url} (CMS ID: ${result.id})`)
		return result
	}

	// ============================================
	// BLOG GENERATION PIPELINE (Phase 3 core)
	// ============================================

	async generateBlogForIdea(ideaId: string): Promise<ICampaign> {
		const workspaceId = this.ensureWorkspace()

		// 1. Fetch the idea
		const ideas: IBlogIdea[] = await this._channel.call('getIdeas', { workspaceId })
		const idea = ideas.find(i => i.id === ideaId)
		if (!idea) {
			throw new Error(`[GrowthWriterService] Idea not found: ${ideaId}`)
		}
		if (idea.status === 'used') {
			throw new Error(`[GrowthWriterService] Idea already used: "${idea.title}"`)
		}

		const siloConfig = SILO_CONFIGS[idea.silo]
		this.logService.info(`[GrowthWriterService] Generating blog for idea: "${idea.title}" (silo: ${idea.silo})`)

		// 2. Create campaign with status 'generating'
		const campaignId = generateUuid()
		const campaign: Omit<ICampaign, 'created_at'> = {
			id: campaignId,
			silo: idea.silo,
			blog_idea_id: ideaId,
			blog_title: null,
			blog_slug: null,
			blog_content: null,
			blog_cms_id: null,
			blog_url: null,
			status: 'generating',
			scheduled_for: null,
			generated_at: null,
			approved_at: null,
			published_at: null,
			error_message: null,
		}
		await this._channel.call('createCampaign', { workspaceId, ...campaign })

		try {
			// 3. Gather RAG context
			const ragContext = await this.gatherRAGContext(idea.silo, idea.title)

			// 4. Build the blog prompt
			const userPrompt = BLOG_USER_PROMPT_TEMPLATE
				.replace('{silo}', idea.silo)
				.replace('{audience}', siloConfig.audience)
				.replace('{title}', idea.title)
				.replace('{content_angle}', idea.content_angle ?? 'educational')
				.replace('{keywords}', idea.keywords ?? idea.title)
				.replace('{rag_context}', ragContext)

			// 5. Call LLM
			const htmlContent = await this.generateContent(
				BLOG_SYSTEM_PROMPT,
				userPrompt,
				'growth-writer-blog',
			)

			if (!htmlContent || htmlContent.trim().length < 100) {
				throw new Error('LLM returned empty or insufficient blog content')
			}

			// 6. Generate slug from title
			const blogTitle = idea.title
			const blogSlug = slugify(blogTitle)

			// 8. Build UTM base URL
			const blogUrl = buildUtmUrl(blogSlug, 'blog', 'organic', idea.silo)

			// 9. Update campaign with content
			await this._channel.call('updateCampaignContent', {
				workspaceId,
				id: campaignId,
				blog_title: blogTitle,
				blog_slug: blogSlug,
				blog_content: htmlContent,
				blog_url: blogUrl,
			})

			// 10. Mark idea as used
			await this.updateIdeaStatus(ideaId, 'used')

			// 11. Auto-schedule for the silo's preferred day
			const scheduledFor = this._getNextSiloDay(idea.silo)
			if (scheduledFor) {
				await this._channel.call('scheduleCampaign', {
					workspaceId,
					campaignId,
					scheduledFor,
				})
			}

			this.logService.info(`[GrowthWriterService] Blog draft generated: "${blogTitle}" (${htmlContent.length} chars), scheduled: ${scheduledFor}`)

			return {
				...campaign,
				blog_title: blogTitle,
				blog_slug: blogSlug,
				blog_content: htmlContent,
				blog_url: blogUrl,
				status: 'draft',
				scheduled_for: scheduledFor,
				generated_at: new Date().toISOString(),
				created_at: new Date().toISOString(),
			}
		} catch (error) {
			const msg = error instanceof Error ? error.message : String(error)
			this.logService.error(`[GrowthWriterService] Blog generation failed: ${msg}`)
			await this._channel.call('updateCampaignStatus', {
				workspaceId,
				id: campaignId,
				status: 'failed',
				error_message: msg,
			})
			throw error
		}
	}

	// ============================================
	// BLOG IDEAS - AI GENERATION (Phase 2 core)
	// ============================================

	async generateIdeasForSilo(silo: Silo, count: number = 10): Promise<IBlogIdea[]> {
		const workspaceId = this.ensureWorkspace()
		const siloConfig = SILO_CONFIGS[silo]

		this.logService.info(`[GrowthWriterService] Generating ${count} ideas for silo: ${silo}`)

		// 1. Gather RAG context about SafeAppeals features for this silo
		const ragContext = await this.gatherRAGContext(silo, siloConfig.contentAngle)

		// 2. Get existing titles to avoid duplicates in the prompt
		const existingTitles: string[] = await this._channel.call('getIdeaTitles', { workspaceId, silo })

		// 3. Build the user prompt
		const userPrompt = IDEA_GENERATION_USER_PROMPT_TEMPLATE
			.replace('{count}', String(count))
			.replace('{silo}', silo)
			.replace('{audience}', siloConfig.audience)
			.replace('{contentAngle}', siloConfig.contentAngle)
			.replace('{rag_context}', ragContext)
			.replace('{existing_titles}', existingTitles.length > 0
				? existingTitles.map(t => `- ${t}`).join('\n')
				: '(none yet — generate freely)')

		// 4. Call LLM to generate ideas
		const llmResponse = await this.generateContent(IDEA_GENERATION_SYSTEM_PROMPT, userPrompt)

		// 5. Parse the response
		const rawIdeas = this.parseIdeasFromLLM(llmResponse)
		this.logService.info(`[GrowthWriterService] LLM returned ${rawIdeas.length} ideas`)

		// 6. Semantic dedup check + store
		const storedIdeas: IBlogIdea[] = []
		for (const raw of rawIdeas) {
			const dupResult: SemanticDuplicateResult = await this._channel.call('checkSemanticDuplicate', {
				workspaceId,
				newTitle: raw.title,
				silo,
			})

			if (dupResult.isDuplicate) {
				this.logService.info(
					`[GrowthWriterService] Skipping duplicate idea: "${raw.title}" ` +
					`(similar to "${dupResult.mostSimilar?.title}" at ${dupResult.mostSimilar?.similarity.toFixed(3)})`
				)
				continue
			}

			const idea: Omit<IBlogIdea, 'created_at' | 'used_at'> = {
				id: generateUuid(),
				silo,
				title: raw.title,
				description: raw.description,
				keywords: raw.keywords,
				content_angle: raw.content_angle,
				source: 'ai',
				status: 'pending',
				priority: raw.priority,
				embedding_hash: null,
			}

			await this._channel.call('createIdea', { workspaceId, ...idea })
			storedIdeas.push({
				...idea,
				created_at: new Date().toISOString(),
				used_at: null,
			})
		}

		this.logService.info(`[GrowthWriterService] Stored ${storedIdeas.length}/${rawIdeas.length} ideas (${rawIdeas.length - storedIdeas.length} duplicates skipped)`)
		return storedIdeas
	}

	// ============================================
	// RAG CONTEXT GATHERING
	// ============================================

	private _getNextSiloDay(silo: Silo): string | null {
		const schedule = DEFAULT_SCHEDULE.siloScheduleOfSilo[silo]
		if (!schedule) return null

		const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const
		const targetDay = dayNames.indexOf(schedule.preferredDay as typeof dayNames[number])
		if (targetDay === -1) return null

		const now = new Date()
		const currentDay = now.getDay()
		let daysAhead = targetDay - currentDay
		if (daysAhead < 0) daysAhead += 7
		if (daysAhead === 0) daysAhead = 0

		const target = new Date(now)
		target.setDate(now.getDate() + daysAhead)
		target.setHours(9, 0, 0, 0)
		return target.toISOString()
	}

	private async gatherRAGContext(silo: Silo, topic: string): Promise<string> {
		const workspaceId = this.ensureWorkspace()
		const queries = queryTemplatesOfSilo[silo](topic)

		try {
			const results = await Promise.all(
				Object.values(queries).map(q =>
					this.ragService.search({
						query: q,
						scope: 'core_references',
						limit: 5,
						workspaceId,
					})
				)
			)

			// Deduplicate chunks by docId+chunkId and combine context
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
			this.logService.info(`[GrowthWriterService] RAG gathered ${seenChunks.size} unique chunks across ${results.length} queries`)
			return combined || '(No RAG context available — generate ideas based on general knowledge of document organization tools)'
		} catch (error) {
			this.logService.warn('[GrowthWriterService] RAG query failed, proceeding without context:', error)
			return '(RAG context unavailable — generate ideas based on general knowledge of document organization tools)'
		}
	}

	// ============================================
	// PROGRAMMATIC LLM CALLS
	// ============================================

	private async generateContent(systemPrompt: string, userPrompt: string, loggingName: string = 'growth-writer-ideas'): Promise<string> {
		const modelSelection = this.settingsService.state.modelSelectionOfFeature['Chat'] ?? null
		if (!modelSelection) throw new Error('[GrowthWriterService] No Chat model selected in settings')

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

	// ============================================
	// RESPONSE PARSING
	// ============================================

	private parseIdeasFromLLM(response: string): RawIdeaFromLLM[] {
		try {
			// Extract JSON array from the response (LLM may wrap it in markdown code blocks)
			let jsonStr = response.trim()

			const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
			if (jsonMatch) {
				jsonStr = jsonMatch[1].trim()
			}

			// Try to find a JSON array in the response
			const arrayMatch = jsonStr.match(/\[[\s\S]*\]/)
			if (arrayMatch) {
				jsonStr = arrayMatch[0]
			}

			const parsed = JSON.parse(jsonStr)
			if (!Array.isArray(parsed)) {
				this.logService.error('[GrowthWriterService] LLM response is not a JSON array')
				return []
			}

			const validAngles = ['product', 'educational', 'problem_solving']

			return parsed
				.filter((item: any) => item.title && typeof item.title === 'string')
				.map((item: any) => ({
					title: String(item.title).trim(),
					description: String(item.description || '').trim(),
					keywords: String(item.keywords || '').trim(),
					content_angle: validAngles.includes(item.content_angle) ? item.content_angle : 'educational',
					priority: typeof item.priority === 'number' ? Math.min(10, Math.max(1, item.priority)) : 5,
				}))
		} catch (error) {
			this.logService.error('[GrowthWriterService] Failed to parse LLM ideas response:', error)
			this.logService.error('[GrowthWriterService] Raw response:', response.substring(0, 500))
			return []
		}
	}
}

registerSingleton(IGrowthWriterService, GrowthWriterService, InstantiationType.Delayed);

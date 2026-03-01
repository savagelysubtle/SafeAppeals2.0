/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';

import { IGrowthWriterService } from './growthWriterService.js';
import { IRAGService } from '../../common/rag/ragService.js';

import type { IBlogIdea, ICampaign, ISchedulerState, Silo } from '../../common/growthWriter/growthWriterTypes.js';
import { DEFAULT_SCHEDULE, SILO_CONFIGS } from '../../common/growthWriter/growthWriterConfig.js';

const SCHEDULER_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const IDEA_LOW_THRESHOLD = 3;
const IDEA_GENERATE_COUNT = 5;
const SILOS: Silo[] = ['lawyers', 'workers_comp', 'researchers', 'students', 'business'];

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'] as const;

function getWeekBounds(date: Date): { start: string; end: string } {
	const d = new Date(date);
	const day = d.getDay();
	const diffToMonday = day === 0 ? -6 : 1 - day;
	const monday = new Date(d);
	monday.setDate(d.getDate() + diffToMonday);
	monday.setHours(0, 0, 0, 0);
	const sunday = new Date(monday);
	sunday.setDate(monday.getDate() + 6);
	sunday.setHours(23, 59, 59, 999);
	return { start: monday.toISOString(), end: sunday.toISOString() };
}

function getNextOccurrence(dayName: string): string {
	const targetDay = DAY_NAMES.indexOf(dayName as typeof DAY_NAMES[number]);
	if (targetDay === -1) return new Date().toISOString();
	const now = new Date();
	const currentDay = now.getDay();
	let daysAhead = targetDay - currentDay;
	if (daysAhead < 0) daysAhead += 7;
	if (daysAhead === 0) daysAhead = 0;
	const target = new Date(now);
	target.setDate(now.getDate() + daysAhead);
	target.setHours(9, 0, 0, 0);
	return target.toISOString();
}

// ============================================
// SERVICE INTERFACE
// ============================================

export interface IBlogSchedulerService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeState: Event<ISchedulerState>;
	readonly state: ISchedulerState;
	setEnabled(enabled: boolean): void;
	runNow(): Promise<void>;
}

export const IBlogSchedulerService = createDecorator<IBlogSchedulerService>('blogSchedulerService');

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

class BlogSchedulerService extends Disposable implements IBlogSchedulerService {
	readonly _serviceBrand: undefined;

	private readonly _channel: IChannel;
	private _state: ISchedulerState = {
		enabled: true,
		running: false,
		lastRunAt: null,
		nextRunAt: null,
		pendingActions: [],
	};
	private _intervalHandle: ReturnType<typeof setInterval> | null = null;
	private _workspaceId: string | null = null;

	private readonly _onDidChangeState = this._register(new Emitter<ISchedulerState>());
	readonly onDidChangeState: Event<ISchedulerState> = this._onDidChangeState.event;

	get state(): ISchedulerState {
		return { ...this._state };
	}

	constructor(
		@IMainProcessService mainProcessService: IMainProcessService,
		@IGrowthWriterService private readonly growthWriterService: IGrowthWriterService,
		@IRAGService private readonly ragService: IRAGService,
		@ILogService private readonly logService: ILogService,
	) {
		super();
		this._channel = mainProcessService.getChannel('void-channel-growth-writer');

		try {
			this._workspaceId = this.ragService.getWorkspaceId();
		} catch {
			this._workspaceId = null;
		}

		if (this._workspaceId) {
			this._startScheduler();
		}
	}

	setEnabled(enabled: boolean): void {
		this._state.enabled = enabled;
		if (enabled && !this._intervalHandle) {
			this._startScheduler();
		} else if (!enabled && this._intervalHandle) {
			clearInterval(this._intervalHandle);
			this._intervalHandle = null;
		}
		this._emitState();
	}

	async runNow(): Promise<void> {
		if (this._state.running) return;
		await this._tick();
	}

	private _startScheduler(): void {
		this.logService.info('[BlogScheduler] Starting scheduler');
		this._updateNextRun();
		this._emitState();

		setTimeout(() => this._tick(), 10_000);

		this._intervalHandle = setInterval(() => {
			if (this._state.enabled) {
				this._tick();
			}
		}, SCHEDULER_INTERVAL_MS);
	}

	private async _tick(): Promise<void> {
		if (!this._workspaceId || this._state.running) return;

		this._state.running = true;
		this._emitState();

		try {
			this.logService.info('[BlogScheduler] Running scheduled tick');

			const actions: string[] = [];

			await this._replenishIdeas(actions);

			await this._generateScheduledBlogs(actions);

			await this._autoPublishApproved(actions);

			this._state.pendingActions = actions;
			this._state.lastRunAt = new Date().toISOString();
			this._updateNextRun();
		} catch (err) {
			this.logService.error('[BlogScheduler] Tick failed:', err);
		} finally {
			this._state.running = false;
			this._emitState();
		}
	}

	private async _replenishIdeas(actions: string[]): Promise<void> {
		if (!this._workspaceId) return;

		for (const silo of SILOS) {
			try {
				const count = await this._channel.call<number>('getPendingIdeaCount', {
					workspaceId: this._workspaceId,
					silo,
				});

				if (count < IDEA_LOW_THRESHOLD) {
					this.logService.info(`[BlogScheduler] Silo "${silo}" has ${count} pending ideas (< ${IDEA_LOW_THRESHOLD}), generating more`);
					actions.push(`Generated ideas for ${SILO_CONFIGS[silo].displayName}`);
					try {
						await this.growthWriterService.generateIdeasForSilo(silo, IDEA_GENERATE_COUNT);
					} catch (err) {
						this.logService.warn(`[BlogScheduler] Failed to generate ideas for ${silo}:`, err);
					}
				}
			} catch (err) {
				this.logService.warn(`[BlogScheduler] Failed to check idea count for ${silo}:`, err);
			}
		}
	}

	private async _generateScheduledBlogs(actions: string[]): Promise<void> {
		if (!this._workspaceId) return;

		const now = new Date();
		const todayName = DAY_NAMES[now.getDay()];
		const { start, end } = getWeekBounds(now);

		for (const silo of SILOS) {
			const schedule = DEFAULT_SCHEDULE.siloScheduleOfSilo[silo];
			if (schedule.preferredDay !== todayName) continue;

			try {
				const existing = await this._channel.call<ICampaign[]>('getCampaignsForSiloInWeek', {
					workspaceId: this._workspaceId,
					silo,
					startDate: start,
					endDate: end,
				});

				if (existing && existing.length > 0) {
					continue;
				}

				const topIdea = await this._channel.call<IBlogIdea | null>('getTopPendingIdea', {
					workspaceId: this._workspaceId,
					silo,
				});

				if (!topIdea) {
					actions.push(`No pending ideas for ${SILO_CONFIGS[silo].displayName}`);
					continue;
				}

				this.logService.info(`[BlogScheduler] Generating blog for "${topIdea.title}" (silo: ${silo})`);
				actions.push(`Generated blog: ${topIdea.title}`);

				try {
					const campaign = await this.growthWriterService.generateBlogForIdea(topIdea.id);
					if (campaign?.id) {
						const scheduledFor = getNextOccurrence(schedule.preferredDay);
						await this._channel.call('scheduleCampaign', {
							workspaceId: this._workspaceId,
							campaignId: campaign.id,
							scheduledFor,
						});
					}
				} catch (err) {
					this.logService.warn(`[BlogScheduler] Failed to generate blog for ${silo}:`, err);
				}
			} catch (err) {
				this.logService.warn(`[BlogScheduler] Failed to check schedule for ${silo}:`, err);
			}
		}
	}

	private async _autoPublishApproved(actions: string[]): Promise<void> {
		if (!this._workspaceId) return;

		try {
			const ready = await this._channel.call<ICampaign[]>('getApprovedReadyToPublish', {
				workspaceId: this._workspaceId,
			});

			if (!ready || ready.length === 0) return;

			for (const campaign of ready) {
				this.logService.info(`[BlogScheduler] Auto-publishing: "${campaign.blog_title}"`);
				actions.push(`Published: ${campaign.blog_title}`);

				try {
					await this._channel.call('publishBlog', {
						workspaceId: this._workspaceId,
						campaignId: campaign.id,
					});
				} catch (err) {
					this.logService.warn(`[BlogScheduler] Failed to auto-publish campaign ${campaign.id}:`, err);
				}
			}
		} catch (err) {
			this.logService.warn('[BlogScheduler] Failed to check approved campaigns:', err);
		}
	}

	private _updateNextRun(): void {
		const nextMs = Date.now() + SCHEDULER_INTERVAL_MS;
		this._state.nextRunAt = new Date(nextMs).toISOString();
	}

	private _emitState(): void {
		this._onDidChangeState.fire({ ...this._state });
	}

	override dispose(): void {
		if (this._intervalHandle) {
			clearInterval(this._intervalHandle);
			this._intervalHandle = null;
		}
		super.dispose();
	}
}

registerSingleton(IBlogSchedulerService, BlogSchedulerService, InstantiationType.Delayed);

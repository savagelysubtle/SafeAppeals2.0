/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';

import {
	CaseTimeline,
	DEFAULT_CASE_TIMELINE,
	EventCategory,
	generateEventId,
	ITimelineService,
	isDeadlineOverdue,
	isDeadlineUpcoming,
	JurisdictionConfig,
	TimelineEvent
} from '../../common/timeline/timelineTypes.js';
import { DEFAULT_JURISDICTIONS, getJurisdictionById } from './jurisdictionConfig.js';

const TIMELINE_FILENAME = '.timeline.json';

export class TimelineService extends Disposable implements ITimelineService {
	declare readonly _serviceBrand: undefined;

	private _timeline: CaseTimeline | null = null;

	private readonly _onDidChangeTimeline = this._register(new Emitter<CaseTimeline | null>());
	readonly onDidChangeTimeline: Event<CaseTimeline | null> = this._onDidChangeTimeline.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@INotificationService private readonly notificationService: INotificationService
	) {
		super();

		// Auto-load timeline when workspace opens
		this.initializeTimeline();
	}

	private async initializeTimeline(): Promise<void> {
		try {
			await this.loadTimeline();
			// Schedule notifications after loading
			if (this._timeline?.notificationsEnabled) {
				this.scheduleDeadlineNotifications();
			}
		} catch (error) {
			console.error('[TimelineService] Failed to initialize timeline:', error);
		}
	}

	// ============================================================================
	// Workspace Helpers
	// ============================================================================

	private getWorkspaceFolder(): URI | null {
		const folders = this.contextService.getWorkspace().folders;
		if (folders.length === 0) {
			return null;
		}
		return folders[0].uri;
	}

	private getTimelineUri(): URI | null {
		const workspaceFolder = this.getWorkspaceFolder();
		if (!workspaceFolder) {
			return null;
		}
		return URI.joinPath(workspaceFolder, TIMELINE_FILENAME);
	}

	// ============================================================================
	// Lifecycle
	// ============================================================================

	async loadTimeline(): Promise<CaseTimeline | null> {
		const timelineUri = this.getTimelineUri();
		if (!timelineUri) {
			console.log('[TimelineService] No workspace folder found');
			return null;
		}

		try {
			const exists = await this.fileService.exists(timelineUri);
			if (!exists) {
				console.log('[TimelineService] No timeline file found at:', timelineUri.toString());
				return null;
			}

			const content = await this.fileService.readFile(timelineUri);
			const timeline = JSON.parse(content.value.toString()) as CaseTimeline;
			this._timeline = timeline;
			console.log('[TimelineService] Timeline loaded from:', timelineUri.toString());
			this._onDidChangeTimeline.fire(this._timeline);
			return this._timeline;
		} catch (error) {
			console.error('[TimelineService] Error loading timeline:', error);
			return null;
		}
	}

	async saveTimeline(timeline: CaseTimeline): Promise<void> {
		const timelineUri = this.getTimelineUri();
		if (!timelineUri) {
			throw new Error('No workspace folder available');
		}

		try {
			timeline.updatedAt = new Date().toISOString();
			const content = JSON.stringify(timeline, null, 2);
			await this.fileService.writeFile(timelineUri, VSBuffer.fromString(content));
			this._timeline = timeline;
			console.log('[TimelineService] Timeline saved to:', timelineUri.toString());
			this._onDidChangeTimeline.fire(this._timeline);
		} catch (error) {
			console.error('[TimelineService] Error saving timeline:', error);
			throw error;
		}
	}

	getTimeline(): CaseTimeline | null {
		return this._timeline;
	}

	// ============================================================================
	// Event CRUD
	// ============================================================================

	async addEvent(eventData: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<TimelineEvent> {
		if (!this._timeline) {
			// Create new timeline if none exists
			const workspaceFolder = this.getWorkspaceFolder();
			this._timeline = {
				...DEFAULT_CASE_TIMELINE,
				caseId: workspaceFolder?.path || 'unknown',
				createdAt: new Date().toISOString(),
				updatedAt: new Date().toISOString()
			};
		}

		const now = new Date().toISOString();
		const event: TimelineEvent = {
			...eventData,
			id: generateEventId(),
			createdAt: now,
			updatedAt: now
		};

		this._timeline.events.push(event);
		await this.saveTimeline(this._timeline);

		console.log('[TimelineService] Event added:', event.id, event.title);
		return event;
	}

	async updateEvent(id: string, updates: Partial<TimelineEvent>): Promise<void> {
		if (!this._timeline) {
			throw new Error('No timeline loaded');
		}

		const index = this._timeline.events.findIndex(e => e.id === id);
		if (index === -1) {
			throw new Error(`Event not found: ${id}`);
		}

		this._timeline.events[index] = {
			...this._timeline.events[index],
			...updates,
			updatedAt: new Date().toISOString()
		};

		await this.saveTimeline(this._timeline);
		console.log('[TimelineService] Event updated:', id);
	}

	async deleteEvent(id: string): Promise<void> {
		if (!this._timeline) {
			throw new Error('No timeline loaded');
		}

		const index = this._timeline.events.findIndex(e => e.id === id);
		if (index === -1) {
			throw new Error(`Event not found: ${id}`);
		}

		this._timeline.events.splice(index, 1);
		await this.saveTimeline(this._timeline);
		console.log('[TimelineService] Event deleted:', id);
	}

	getEventsSorted(ascending: boolean = true): TimelineEvent[] {
		if (!this._timeline) {
			return [];
		}

		return [...this._timeline.events].sort((a, b) => {
			const dateA = new Date(a.date).getTime();
			const dateB = new Date(b.date).getTime();
			return ascending ? dateA - dateB : dateB - dateA;
		});
	}

	getEventsByCategory(category: EventCategory): TimelineEvent[] {
		if (!this._timeline) {
			return [];
		}
		return this._timeline.events.filter(e => e.category === category);
	}

	// ============================================================================
	// Deadline & Statute Calculations
	// ============================================================================

	calculateStatuteDeadline(injuryDate: Date, jurisdictionId: string): Date {
		const jurisdiction = getJurisdictionById(jurisdictionId);
		if (!jurisdiction) {
			// Default to 90 days if jurisdiction not found
			const deadline = new Date(injuryDate);
			deadline.setDate(deadline.getDate() + 90);
			return deadline;
		}

		const deadline = new Date(injuryDate);
		deadline.setDate(deadline.getDate() + jurisdiction.statuteOfLimitationsDays);
		return deadline;
	}

	getUpcomingDeadlines(daysAhead: number = 30): TimelineEvent[] {
		if (!this._timeline) {
			return [];
		}
		return this._timeline.events.filter(e => isDeadlineUpcoming(e, daysAhead));
	}

	getOverdueDeadlines(): TimelineEvent[] {
		if (!this._timeline) {
			return [];
		}
		return this._timeline.events.filter(e => isDeadlineOverdue(e));
	}

	generateDeadlinesFromDecision(decisionEvent: TimelineEvent): TimelineEvent[] {
		if (!this._timeline) {
			return [];
		}

		const jurisdiction = getJurisdictionById(this._timeline.jurisdiction);
		if (!jurisdiction) {
			return [];
		}

		const decisionDate = new Date(decisionEvent.date);
		const deadlines: TimelineEvent[] = [];

		for (const rule of jurisdiction.deadlineRules) {
			if (rule.triggerEvent === 'decision') {
				const deadlineDate = new Date(decisionDate);
				deadlineDate.setDate(deadlineDate.getDate() + rule.daysFromTrigger);

				const now = new Date().toISOString();
				deadlines.push({
					id: generateEventId(),
					date: deadlineDate.toISOString(),
					title: rule.name,
					description: rule.description,
					category: 'deadline',
					linkedDocuments: [],
					isDeadline: true,
					reminderDays: [7, 3, 1],
					isComplete: false,
					createdAt: now,
					updatedAt: now
				});
			}
		}

		return deadlines;
	}

	// ============================================================================
	// Document Linking
	// ============================================================================

	async linkDocument(eventId: string, documentUri: URI): Promise<void> {
		if (!this._timeline) {
			throw new Error('No timeline loaded');
		}

		const event = this._timeline.events.find(e => e.id === eventId);
		if (!event) {
			throw new Error(`Event not found: ${eventId}`);
		}

		const uriString = documentUri.toString();
		if (!event.linkedDocuments.includes(uriString)) {
			event.linkedDocuments.push(uriString);
			event.updatedAt = new Date().toISOString();
			await this.saveTimeline(this._timeline);
			console.log('[TimelineService] Document linked to event:', eventId, uriString);
		}
	}

	async unlinkDocument(eventId: string, documentUri: URI): Promise<void> {
		if (!this._timeline) {
			throw new Error('No timeline loaded');
		}

		const event = this._timeline.events.find(e => e.id === eventId);
		if (!event) {
			throw new Error(`Event not found: ${eventId}`);
		}

		const uriString = documentUri.toString();
		const index = event.linkedDocuments.indexOf(uriString);
		if (index !== -1) {
			event.linkedDocuments.splice(index, 1);
			event.updatedAt = new Date().toISOString();
			await this.saveTimeline(this._timeline);
			console.log('[TimelineService] Document unlinked from event:', eventId, uriString);
		}
	}

	// ============================================================================
	// Notifications
	// ============================================================================

	scheduleDeadlineNotifications(): void {
		if (!this._timeline || !this._timeline.notificationsEnabled) {
			return;
		}

		// Check for overdue deadlines
		const overdueDeadlines = this.getOverdueDeadlines();
		for (const deadline of overdueDeadlines) {
			this.notificationService.notify({
				severity: Severity.Error,
				message: `⚠️ OVERDUE: ${deadline.title}`,
				source: 'Timeline'
			});
		}

		// Check for upcoming deadlines (7 days)
		const upcomingDeadlines = this.getUpcomingDeadlines(7);
		for (const deadline of upcomingDeadlines) {
			const daysUntil = Math.ceil(
				(new Date(deadline.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
			);

			if (daysUntil <= 1) {
				this.notificationService.notify({
					severity: Severity.Error,
					message: `🔴 TOMORROW: ${deadline.title}`,
					source: 'Timeline'
				});
			} else if (daysUntil <= 3) {
				this.notificationService.notify({
					severity: Severity.Warning,
					message: `🟠 ${daysUntil} days: ${deadline.title}`,
					source: 'Timeline'
				});
			} else {
				this.notificationService.notify({
					severity: Severity.Info,
					message: `📅 ${daysUntil} days: ${deadline.title}`,
					source: 'Timeline'
				});
			}
		}

		console.log('[TimelineService] Deadline notifications scheduled:',
			overdueDeadlines.length, 'overdue,',
			upcomingDeadlines.length, 'upcoming');
	}

	// ============================================================================
	// Export
	// ============================================================================

	async exportToPDF(): Promise<Uint8Array> {
		// TODO: Implement PDF export via electron-main IPC channel
		// This will be implemented in timelineExportChannel.ts
		throw new Error('PDF export not yet implemented - requires electron-main integration');
	}

	// ============================================================================
	// Jurisdictions
	// ============================================================================

	getJurisdictions(): JurisdictionConfig[] {
		return DEFAULT_JURISDICTIONS;
	}

	getJurisdiction(id: string): JurisdictionConfig | undefined {
		return getJurisdictionById(id);
	}
}

registerSingleton(ITimelineService, TimelineService, InstantiationType.Delayed);


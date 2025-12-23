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
	EVENT_CATEGORY_COLORS,
	EVENT_CATEGORY_LABELS,
	EventCategory,
	formatTimelineDate,
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
			// Create a new object reference so React detects the state change
			this._timeline = {
				...timeline,
				events: [...timeline.events]
			};
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
				updatedAt: new Date().toISOString(),
				events: [] // Initialize empty events array
			};
		}

		const now = new Date().toISOString();
		const event: TimelineEvent = {
			...eventData,
			id: generateEventId(),
			createdAt: now,
			updatedAt: now
		};

		// Create new array instead of mutating (for React state detection)
		const updatedTimeline: CaseTimeline = {
			...this._timeline,
			events: [...this._timeline.events, event]
		};
		await this.saveTimeline(updatedTimeline);

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

		// Create new array with updated event (immutable pattern for React)
		const updatedEvents = this._timeline.events.map((event, i) =>
			i === index
				? { ...event, ...updates, updatedAt: new Date().toISOString() }
				: event
		);

		const updatedTimeline: CaseTimeline = {
			...this._timeline,
			events: updatedEvents
		};

		await this.saveTimeline(updatedTimeline);
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

		// Create new array without the deleted event (immutable pattern for React)
		const updatedTimeline: CaseTimeline = {
			...this._timeline,
			events: this._timeline.events.filter(e => e.id !== id)
		};

		await this.saveTimeline(updatedTimeline);
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
		if (!this._timeline) {
			throw new Error('No timeline to export');
		}

		const jurisdiction = this.getJurisdiction(this._timeline.jurisdiction);
		const html = this.generateExportHTML(this._timeline, jurisdiction);

		// Return HTML as Uint8Array - caller can handle saving or opening
		return new TextEncoder().encode(html);
	}

	/**
	 * Generate export HTML for the timeline
	 */
	private generateExportHTML(timeline: CaseTimeline, jurisdiction?: JurisdictionConfig): string {
		const sortedEvents = [...timeline.events].sort(
			(a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
		);

		const eventsHTML = sortedEvents.map((event) => `
			<div class="event ${event.isDeadline ? 'deadline' : ''} ${event.isComplete ? 'complete' : ''}">
				<div class="event-dot" style="background-color: ${EVENT_CATEGORY_COLORS[event.category]};"></div>
				<div class="event-content">
					<div class="event-header">
						<span class="event-category" style="color: ${EVENT_CATEGORY_COLORS[event.category]};">${EVENT_CATEGORY_LABELS[event.category]}</span>
						${event.isDeadline ? '<span class="deadline-badge">Deadline</span>' : ''}
						${event.isComplete ? '<span class="complete-badge">Complete</span>' : ''}
					</div>
					<h3 class="event-title">${this.escapeHtml(event.title)}</h3>
					<p class="event-date">${formatTimelineDate(event.date)}${event.endDate ? ` → ${formatTimelineDate(event.endDate)}` : ''}</p>
					${event.description ? `<p class="event-description">${this.escapeHtml(event.description)}</p>` : ''}
					${event.linkedDocuments.length > 0 ? `
						<div class="linked-docs">
							<span class="docs-label">Documents:</span>
							${event.linkedDocuments.map(d => `<span class="doc">${d.split('/').pop()}</span>`).join('')}
						</div>
					` : ''}
				</div>
			</div>
		`).join('');

		return `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>Case Timeline - ${this.escapeHtml(timeline.caseName || timeline.caseId)}</title>
	<style>
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #fff; color: #1a1a1a; line-height: 1.5; padding: 40px; }
		.header { border-bottom: 3px solid #22c55e; padding-bottom: 24px; margin-bottom: 32px; }
		.header h1 { font-size: 28px; font-weight: 700; margin-bottom: 8px; }
		.header .meta { display: flex; gap: 24px; margin-top: 16px; font-size: 13px; color: #71717a; }
		.timeline { position: relative; padding-left: 24px; }
		.timeline::before { content: ''; position: absolute; left: 8px; top: 0; bottom: 0; width: 2px; background: linear-gradient(to bottom, #22c55e, #22c55e40); }
		.event { position: relative; margin-bottom: 24px; padding: 16px; background: #fafafa; border: 1px solid #e4e4e7; border-radius: 8px; }
		.event.deadline { border-left: 3px solid #ef4444; }
		.event.complete { opacity: 0.7; }
		.event-dot { position: absolute; left: -20px; top: 20px; width: 12px; height: 12px; border-radius: 50%; border: 2px solid #fff; }
		.event-header { display: flex; gap: 8px; margin-bottom: 8px; }
		.event-category { font-size: 11px; font-weight: 600; text-transform: uppercase; }
		.deadline-badge, .complete-badge { font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; }
		.deadline-badge { background: #fef2f2; color: #ef4444; }
		.complete-badge { background: #f0fdf4; color: #22c55e; }
		.event-title { font-size: 16px; font-weight: 600; margin-bottom: 4px; }
		.event-date { font-size: 13px; color: #71717a; margin-bottom: 8px; }
		.event-description { font-size: 14px; color: #52525b; white-space: pre-wrap; }
		.linked-docs { font-size: 12px; color: #71717a; margin-top: 12px; padding-top: 12px; border-top: 1px solid #e4e4e7; }
		.doc { display: inline-block; background: #f4f4f5; padding: 2px 8px; border-radius: 4px; margin-right: 4px; }
		.footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #e4e4e7; font-size: 12px; color: #a1a1aa; text-align: center; }
		@media print { body { padding: 20px; } .event { break-inside: avoid; } }
	</style>
</head>
<body>
	<div class="header">
		<h1>Case Timeline</h1>
		<div class="meta">
			${jurisdiction ? `<span>Jurisdiction: ${this.escapeHtml(jurisdiction.name)}</span>` : ''}
			${timeline.injuryDate ? `<span>Injury: ${formatTimelineDate(timeline.injuryDate)}</span>` : ''}
			<span>Events: ${timeline.events.length}</span>
		</div>
	</div>
	<div class="timeline">${eventsHTML}</div>
	<div class="footer">Generated by SafeAppeals on ${new Date().toLocaleDateString()}</div>
</body>
</html>`;
	}

	private escapeHtml(text: string): string {
		return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

	async setJurisdiction(jurisdictionId: string): Promise<void> {
		if (!this._timeline) {
			throw new Error('No timeline loaded');
		}

		const jurisdiction = getJurisdictionById(jurisdictionId);
		if (!jurisdiction) {
			throw new Error(`Unknown jurisdiction: ${jurisdictionId}`);
		}

		const updatedTimeline: CaseTimeline = {
			...this._timeline,
			jurisdiction: jurisdictionId,
			events: [...this._timeline.events]
		};

		await this.saveTimeline(updatedTimeline);
		console.log('[TimelineService] Jurisdiction changed to:', jurisdiction.name);
	}
}

registerSingleton(ITimelineService, TimelineService, InstantiationType.Delayed);


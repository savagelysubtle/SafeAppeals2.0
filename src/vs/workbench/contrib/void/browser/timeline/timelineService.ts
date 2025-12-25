/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { INotificationService, Severity } from '../../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';

import {
	CaseTimeline,
	DEFAULT_CASE_TIMELINE,
	DEFAULT_NOTIFICATION_PREFERENCES,
	EventCategory,
	generateEventId,
	isDeadlineOverdue,
	isDeadlineUpcoming,
	ITimelineService,
	JurisdictionConfig,
	NotificationPreferences,
	TimelineEvent,
	TimelineNotification
} from '../../common/timeline/timelineTypes.js';
import { CaseInfo } from '../fileOrganizer/caseConfig.js';
import { IFileOrganizerService } from '../fileOrganizer/fileOrganizerService.js';
import { DEFAULT_JURISDICTIONS, getJurisdictionById } from './jurisdictionConfig.js';

const TIMELINE_FILENAME = '.timeline.json';

export class TimelineService extends Disposable implements ITimelineService {
	declare readonly _serviceBrand: undefined;

	private _timeline: CaseTimeline | null = null;

	private readonly _onDidChangeTimeline = this._register(new Emitter<CaseTimeline | null>());
	readonly onDidChangeTimeline: Event<CaseTimeline | null> = this._onDidChangeTimeline.event;

	private readonly _onDidChangeNotifications = this._register(new Emitter<TimelineNotification[]>());
	readonly onDidChangeNotifications: Event<TimelineNotification[]> = this._onDidChangeNotifications.event;

	private readonly timelineExportChannel: IChannel;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@INotificationService private readonly notificationService: INotificationService,
		@IMainProcessService mainProcessService: IMainProcessService,
		@IFileOrganizerService private readonly fileOrganizerService: IFileOrganizerService
	) {
		super();

		// Get the timeline export IPC channel
		this.timelineExportChannel = mainProcessService.getChannel('void-channel-timeline-export');

		// Auto-load timeline when workspace opens
		this.initializeTimeline();
	}

	private async initializeTimeline(): Promise<void> {
		try {
			await this.loadTimeline();
			// Schedule notifications after loading
			if (this._timeline?.notificationsEnabled) {
				this.scheduleDeadlineNotifications();

				// Generate and persist new notifications
				const newNotifications = this.generateNotifications();
				if (newNotifications.length > 0) {
					this._timeline.notifications = [
						...(this._timeline.notifications || []),
						...newNotifications
					];
					await this.saveTimeline(this._timeline);
					this._onDidChangeNotifications.fire(this.getNotifications());
				}
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

	/**
	 * Generate a unique notification ID
	 */
	private generateNotificationId(): string {
		return `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
	}

	/**
	 * Generate all notifications based on current timeline state
	 */
	generateNotifications(): TimelineNotification[] {
		if (!this._timeline) {
			return [];
		}

		const prefs = this.getNotificationPreferences();
		if (!prefs.enabled) {
			return [];
		}

		const notifications: TimelineNotification[] = [];
		const now = new Date();

		// Existing notifications that shouldn't be regenerated
		const existingIds = new Set(
			(this._timeline.notifications || [])
				.filter(n => !n.isDismissed)
				.map(n => `${n.type}_${n.eventId}`)
		);

		// 1. Deadline notifications
		if (prefs.deadlineAlerts) {
			// Overdue deadlines
			const overdueDeadlines = this.getOverdueDeadlines();
			for (const deadline of overdueDeadlines) {
				const key = `deadline_overdue_${deadline.id}`;
				if (!existingIds.has(key)) {
					notifications.push({
						id: this.generateNotificationId(),
						type: 'deadline_overdue',
						title: 'Overdue Deadline',
						message: deadline.title,
						eventId: deadline.id,
						severity: 'error',
						isRead: false,
						isDismissed: false,
						createdAt: now.toISOString()
					});
				}
			}

			// Upcoming deadlines
			for (const days of prefs.deadlineReminderDays) {
				const upcomingDeadlines = this.getUpcomingDeadlines(days);
				for (const deadline of upcomingDeadlines) {
					const daysUntil = Math.ceil(
						(new Date(deadline.date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
					);
					// Only notify for the specific day thresholds
					if (prefs.deadlineReminderDays.includes(daysUntil)) {
						const key = `deadline_upcoming_${deadline.id}_${daysUntil}`;
						if (!existingIds.has(key)) {
							notifications.push({
								id: this.generateNotificationId(),
								type: 'deadline_upcoming',
								title: daysUntil === 1 ? 'Tomorrow' : `${daysUntil} Days Away`,
								message: deadline.title,
								eventId: deadline.id,
								severity: daysUntil <= 1 ? 'error' : daysUntil <= 3 ? 'warning' : 'info',
								isRead: false,
								isDismissed: false,
								createdAt: now.toISOString()
							});
						}
					}
				}
			}
		}

		// 2. Document expiration warnings (medical reports older than X months)
		if (prefs.documentExpirationMonths > 0) {
			const expirationThreshold = new Date();
			expirationThreshold.setMonth(expirationThreshold.getMonth() - prefs.documentExpirationMonths);

			const medicalEvents = this._timeline.events.filter(
				e => e.category === 'medical' && e.linkedDocuments.length > 0
			);

			for (const event of medicalEvents) {
				const eventDate = new Date(event.date);
				if (eventDate < expirationThreshold) {
					const key = `document_expiring_${event.id}`;
					if (!existingIds.has(key)) {
						const monthsOld = Math.floor(
							(now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24 * 30)
						);
						notifications.push({
							id: this.generateNotificationId(),
							type: 'document_expiring',
							title: 'Aging Medical Document',
							message: `${event.title} is ${monthsOld} months old - consider obtaining updated records`,
							eventId: event.id,
							severity: 'warning',
							isRead: false,
							isDismissed: false,
							createdAt: now.toISOString()
						});
					}
				}
			}
		}

		// 3. Missing document alerts (events without linked documents)
		if (prefs.documentMissingAlerts) {
			const eventsNeedingDocs = this._timeline.events.filter(
				e => ['medical', 'hearing', 'decision', 'filing'].includes(e.category) &&
					e.linkedDocuments.length === 0
			);

			for (const event of eventsNeedingDocs) {
				const key = `document_missing_${event.id}`;
				if (!existingIds.has(key)) {
					notifications.push({
						id: this.generateNotificationId(),
						type: 'document_missing',
						title: 'Missing Document',
						message: `${event.title} has no linked documents`,
						eventId: event.id,
						severity: 'info',
						isRead: false,
						isDismissed: false,
						createdAt: now.toISOString()
					});
				}
			}
		}

		// 4. Statute of limitations warning
		if (prefs.statuteWarningDays > 0 && this._timeline.injuryDate) {
			const statuteDeadline = this.calculateStatuteDeadline(
				new Date(this._timeline.injuryDate),
				this._timeline.jurisdiction
			);
			const daysUntilStatute = Math.ceil(
				(statuteDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
			);

			if (daysUntilStatute <= prefs.statuteWarningDays && daysUntilStatute > 0) {
				const key = `statute_warning_${daysUntilStatute}`;
				if (!existingIds.has(key)) {
					notifications.push({
						id: this.generateNotificationId(),
						type: 'statute_warning',
						title: 'Statute of Limitations',
						message: `Only ${daysUntilStatute} days remaining to file`,
						severity: daysUntilStatute <= 7 ? 'error' : 'warning',
						isRead: false,
						isDismissed: false,
						createdAt: now.toISOString()
					});
				}
			}
		}

		return notifications;
	}

	/**
	 * Get all notifications (filter snoozed, unread first, then by date)
	 */
	getNotifications(): TimelineNotification[] {
		if (!this._timeline?.notifications) {
			return [];
		}

		const now = new Date();

		// Filter out dismissed and currently snoozed notifications
		return this._timeline.notifications
			.filter(n => {
				if (n.isDismissed) return false;
				if (n.snoozedUntil && new Date(n.snoozedUntil) > now) return false;
				return true;
			})
			.sort((a, b) => {
				// Unread first
				if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
				// Then by severity (error > warning > info)
				const severityOrder = { error: 0, warning: 1, info: 2 };
				if (a.severity !== b.severity) {
					return severityOrder[a.severity] - severityOrder[b.severity];
				}
				// Then by date (newest first)
				return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
			});
	}

	/**
	 * Get unread notification count
	 */
	getUnreadCount(): number {
		return this.getNotifications().filter(n => !n.isRead).length;
	}

	/**
	 * Mark a notification as read
	 */
	async markAsRead(notificationId: string): Promise<void> {
		if (!this._timeline?.notifications) return;

		const notification = this._timeline.notifications.find(n => n.id === notificationId);
		if (notification) {
			notification.isRead = true;
			await this.saveTimeline(this._timeline);
			this._onDidChangeNotifications.fire(this.getNotifications());
		}
	}

	/**
	 * Mark all notifications as read
	 */
	async markAllAsRead(): Promise<void> {
		if (!this._timeline?.notifications) return;

		for (const notification of this._timeline.notifications) {
			notification.isRead = true;
		}
		await this.saveTimeline(this._timeline);
		this._onDidChangeNotifications.fire(this.getNotifications());
	}

	/**
	 * Dismiss a notification (hide permanently)
	 */
	async dismissNotification(notificationId: string): Promise<void> {
		if (!this._timeline?.notifications) return;

		const notification = this._timeline.notifications.find(n => n.id === notificationId);
		if (notification) {
			notification.isDismissed = true;
			await this.saveTimeline(this._timeline);
			this._onDidChangeNotifications.fire(this.getNotifications());
		}
	}

	/**
	 * Snooze a notification for X days
	 */
	async snoozeNotification(notificationId: string, days: number): Promise<void> {
		if (!this._timeline?.notifications) return;

		const notification = this._timeline.notifications.find(n => n.id === notificationId);
		if (notification) {
			const snoozeUntil = new Date();
			snoozeUntil.setDate(snoozeUntil.getDate() + days);
			notification.snoozedUntil = snoozeUntil.toISOString();
			notification.isRead = true;
			await this.saveTimeline(this._timeline);
			this._onDidChangeNotifications.fire(this.getNotifications());
		}
	}

	/**
	 * Update notification preferences
	 */
	async updateNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
		if (!this._timeline) return;

		const currentPrefs = this.getNotificationPreferences();
		const updatedTimeline: CaseTimeline = {
			...this._timeline,
			notificationPreferences: { ...currentPrefs, ...prefs },
			events: [...this._timeline.events]
		};
		await this.saveTimeline(updatedTimeline);

		// Regenerate notifications if preferences changed
		const newNotifications = this.generateNotifications();
		if (newNotifications.length > 0) {
			this._timeline.notifications = [
				...(this._timeline.notifications || []),
				...newNotifications
			];
			await this.saveTimeline(this._timeline);
			this._onDidChangeNotifications.fire(this.getNotifications());
		}
	}

	/**
	 * Get notification preferences
	 */
	getNotificationPreferences(): NotificationPreferences {
		return this._timeline?.notificationPreferences || DEFAULT_NOTIFICATION_PREFERENCES;
	}

	// ============================================================================
	// Export
	// ============================================================================

	async exportToPDF(): Promise<Uint8Array> {
		if (!this._timeline) {
			throw new Error('No timeline to export');
		}

		const jurisdiction = this.getJurisdiction(this._timeline.jurisdiction);

		// Call electron-main to generate PDF
		// Receives base64-encoded string from IPC (VSCode pattern for reliable binary transfer)
		const base64Pdf = await this.timelineExportChannel.call<string>('exportToPDF', {
			timeline: this._timeline,
			jurisdiction
		});

		// Decode base64 to Uint8Array
		// atob decodes base64 to binary string, then convert each char to byte
		const binaryString = atob(base64Pdf);
		const bytes = new Uint8Array(binaryString.length);
		for (let i = 0; i < binaryString.length; i++) {
			bytes[i] = binaryString.charCodeAt(i);
		}
		return bytes;
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

	// ============================================================================
	// Case Config Integration
	// ============================================================================

	/**
	 * Get case info from FileOrganizerService
	 */
	private async getCaseInfo(): Promise<CaseInfo | null> {
		try {
			const workspaceFolder = this.getWorkspaceFolder();
			if (!workspaceFolder) {
				return null;
			}

			const config = await this.fileOrganizerService.loadCaseConfig(workspaceFolder);
			return config?.caseInfo || null;
		} catch (error) {
			console.log('[TimelineService] No case config found:', error);
			return null;
		}
	}

	/**
	 * Sync timeline with case config data
	 * Updates timeline with case info (injuryDate, caseName, etc.)
	 */
	async syncFromCaseConfig(): Promise<boolean> {
		const caseInfo = await this.getCaseInfo();
		if (!caseInfo) {
			console.log('[TimelineService] No case config to sync from');
			return false;
		}

		const updates: Partial<CaseTimeline> = {};
		let hasUpdates = false;

		// Sync case name from claimant name or case number
		const caseName = caseInfo.claimantName || (caseInfo.caseNumber ? `Case ${caseInfo.caseNumber}` : undefined);
		if (caseName && this._timeline?.caseName !== caseName) {
			updates.caseName = caseName;
			hasUpdates = true;
		}

		// Sync case ID from case number
		if (caseInfo.caseNumber && this._timeline?.caseId !== caseInfo.caseNumber) {
			updates.caseId = caseInfo.caseNumber;
			hasUpdates = true;
		}

		// Sync injury date
		if (caseInfo.injuryDate && this._timeline?.injuryDate !== caseInfo.injuryDate) {
			updates.injuryDate = caseInfo.injuryDate;
			hasUpdates = true;
		}

		if (hasUpdates && this._timeline) {
			const updatedTimeline: CaseTimeline = {
				...this._timeline,
				...updates,
				events: [...this._timeline.events]
			};
			await this.saveTimeline(updatedTimeline);
			console.log('[TimelineService] Synced from case config:', updates);

			this.notificationService.info('Timeline synced with case information');
			return true;
		}

		return false;
	}

	/**
	 * Create initial injury event from case config
	 * Call this when creating a new timeline to auto-populate the first event
	 */
	async createInjuryEventFromCaseConfig(): Promise<TimelineEvent | null> {
		const caseInfo = await this.getCaseInfo();
		if (!caseInfo?.injuryDate) {
			return null;
		}

		// Check if we already have an injury event with this date
		if (this._timeline) {
			const existingInjury = this._timeline.events.find(
				e => e.category === 'injury' && e.date.startsWith(caseInfo.injuryDate!.split('T')[0])
			);
			if (existingInjury) {
				console.log('[TimelineService] Injury event already exists');
				return null;
			}
		}

		// Create injury event
		const eventData = {
			title: 'Injury Date',
			description: caseInfo.description || `Initial injury for ${caseInfo.claimantName || 'claimant'}`,
			date: new Date(caseInfo.injuryDate).toISOString(),
			category: 'injury' as EventCategory,
			isDeadline: false,
			linkedDocuments: [],
			tags: ['auto-imported']
		};

		const event = await this.addEvent(eventData);
		console.log('[TimelineService] Created injury event from case config:', event.id);

		this.notificationService.info('Created injury event from case information');
		return event;
	}

	/**
	 * Create a new timeline pre-populated with case config data
	 */
	async createTimelineWithCaseConfig(): Promise<CaseTimeline> {
		const caseInfo = await this.getCaseInfo();
		const workspaceFolder = this.getWorkspaceFolder();

		const now = new Date().toISOString();
		this._timeline = {
			...DEFAULT_CASE_TIMELINE,
			caseId: caseInfo?.caseNumber || workspaceFolder?.path || 'unknown',
			caseName: caseInfo?.claimantName || undefined,
			injuryDate: caseInfo?.injuryDate || undefined,
			createdAt: now,
			updatedAt: now,
			events: []
		};

		await this.saveTimeline(this._timeline);
		console.log('[TimelineService] Created new timeline with case config');

		// Auto-create injury event if we have an injury date
		if (caseInfo?.injuryDate) {
			await this.createInjuryEventFromCaseConfig();
		}

		return this._timeline;
	}
}

registerSingleton(ITimelineService, TimelineService, InstantiationType.Delayed);


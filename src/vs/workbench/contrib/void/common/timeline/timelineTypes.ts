/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { URI } from '../../../../../base/common/uri.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// ============================================================================
// Event Categories
// ============================================================================

export type EventCategory =
	| 'injury'
	| 'medical'
	| 'hearing'
	| 'decision'
	| 'deadline'
	| 'filing'
	| 'correspondence'
	| 'custom';

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
	injury: 'Injury',
	medical: 'Medical',
	hearing: 'Hearing',
	decision: 'Decision',
	deadline: 'Deadline',
	filing: 'Filing',
	correspondence: 'Correspondence',
	custom: 'Custom'
};

export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
	injury: '#ef4444',      // red
	medical: '#3b82f6',     // blue
	hearing: '#8b5cf6',     // purple
	decision: '#f59e0b',    // amber
	deadline: '#dc2626',    // dark red
	filing: '#10b981',      // emerald
	correspondence: '#6b7280', // gray
	custom: '#64748b'       // slate
};

// ============================================================================
// Timeline Event
// ============================================================================

export interface TimelineEvent {
	id: string;
	date: string;                    // ISO 8601 format
	endDate?: string;                // For date ranges (e.g., hospitalization)
	title: string;
	description?: string;
	category: EventCategory;
	linkedDocuments: string[];       // URI strings of linked documents
	isDeadline: boolean;
	reminderDays?: number[];         // Days before deadline to remind, e.g., [7, 3, 1]
	isComplete?: boolean;            // For deadlines/tasks
	tags?: string[];
	createdAt: string;
	updatedAt: string;
}

// ============================================================================
// Jurisdiction & Statute Configuration
// ============================================================================

export interface DeadlineRule {
	id: string;
	name: string;                    // e.g., 'Review Division Appeal'
	daysFromTrigger: number;         // Days allowed after trigger event
	triggerEvent: EventCategory;     // What event starts the clock
	description: string;
}

export interface JurisdictionConfig {
	id: string;                      // e.g., 'bc-wcb', 'ontario-wsib'
	name: string;                    // e.g., 'British Columbia WCB'
	region: string;                  // e.g., 'CA-BC'
	statuteOfLimitationsDays: number;
	deadlineRules: DeadlineRule[];
}

// ============================================================================
// Notifications
// ============================================================================

export type NotificationType =
	| 'deadline_upcoming'      // Deadline approaching (7, 3, 1 day)
	| 'deadline_overdue'       // Deadline passed
	| 'document_expiring'      // Medical report older than X months
	| 'document_missing'       // Event without linked documents
	| 'follow_up'              // Follow-up reminder
	| 'statute_warning';       // Statute of limitations approaching

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
	deadline_upcoming: 'Upcoming Deadline',
	deadline_overdue: 'Overdue Deadline',
	document_expiring: 'Expiring Document',
	document_missing: 'Missing Document',
	follow_up: 'Follow-up Reminder',
	statute_warning: 'Statute Warning'
};

export const NOTIFICATION_TYPE_ICONS: Record<NotificationType, string> = {
	deadline_upcoming: 'clock',
	deadline_overdue: 'warning',
	document_expiring: 'file',
	document_missing: 'file-add',
	follow_up: 'bell',
	statute_warning: 'law'
};

export interface TimelineNotification {
	id: string;
	type: NotificationType;
	title: string;
	message: string;
	eventId?: string;                // Related timeline event (if any)
	severity: 'info' | 'warning' | 'error';
	isRead: boolean;
	isDismissed: boolean;
	snoozedUntil?: string;           // ISO 8601 - snooze until this date
	createdAt: string;
}

export interface NotificationPreferences {
	enabled: boolean;
	deadlineAlerts: boolean;
	deadlineReminderDays: number[];  // e.g., [7, 3, 1]
	documentExpirationMonths: number; // Alert when medical docs older than X months
	documentMissingAlerts: boolean;  // Alert for events without docs
	followUpReminders: boolean;
	statuteWarningDays: number;      // Warn X days before statute expires
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
	enabled: true,
	deadlineAlerts: true,
	deadlineReminderDays: [7, 3, 1],
	documentExpirationMonths: 6,
	documentMissingAlerts: true,
	followUpReminders: true,
	statuteWarningDays: 30
};

// ============================================================================
// Case Timeline (File Storage Format)
// ============================================================================

export interface CaseTimeline {
	version: '1.0';
	caseId: string;
	caseName?: string;
	jurisdiction: string;            // References JurisdictionConfig.id
	injuryDate?: string;             // ISO 8601
	events: TimelineEvent[];
	customStatuteDays?: number;      // Override jurisdiction default per case
	notificationsEnabled: boolean;
	notificationPreferences?: NotificationPreferences;
	notifications?: TimelineNotification[];  // Notification history
	createdAt: string;
	updatedAt: string;
}

export const DEFAULT_CASE_TIMELINE: CaseTimeline = {
	version: '1.0',
	caseId: '',
	jurisdiction: 'bc-wcb',
	events: [],
	notificationsEnabled: true,
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString()
};

// ============================================================================
// Timeline Service Interface
// ============================================================================

export interface ITimelineService {
	readonly _serviceBrand: undefined;

	// ---- Lifecycle ----

	/**
	 * Load timeline from workspace storage
	 */
	loadTimeline(): Promise<CaseTimeline | null>;

	/**
	 * Save timeline to workspace storage
	 */
	saveTimeline(timeline: CaseTimeline): Promise<void>;

	/**
	 * Get the current timeline (cached)
	 */
	getTimeline(): CaseTimeline | null;

	// ---- Event CRUD ----

	/**
	 * Add a new event to the timeline
	 */
	addEvent(event: Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>): Promise<TimelineEvent>;

	/**
	 * Update an existing event
	 */
	updateEvent(id: string, updates: Partial<TimelineEvent>): Promise<void>;

	/**
	 * Delete an event
	 */
	deleteEvent(id: string): Promise<void>;

	/**
	 * Get events sorted by date
	 */
	getEventsSorted(ascending?: boolean): TimelineEvent[];

	/**
	 * Get events by category
	 */
	getEventsByCategory(category: EventCategory): TimelineEvent[];

	// ---- Deadline & Statute Calculations ----

	/**
	 * Calculate statute of limitations deadline based on injury date and jurisdiction
	 */
	calculateStatuteDeadline(injuryDate: Date, jurisdictionId: string): Date;

	/**
	 * Get upcoming deadlines within the specified number of days
	 */
	getUpcomingDeadlines(daysAhead: number): TimelineEvent[];

	/**
	 * Get overdue deadlines
	 */
	getOverdueDeadlines(): TimelineEvent[];

	/**
	 * Auto-generate deadline events from decision events using jurisdiction rules
	 */
	generateDeadlinesFromDecision(decisionEvent: TimelineEvent): TimelineEvent[];

	// ---- Document Linking ----

	/**
	 * Link a document to an event
	 */
	linkDocument(eventId: string, documentUri: URI): Promise<void>;

	/**
	 * Unlink a document from an event
	 */
	unlinkDocument(eventId: string, documentUri: URI): Promise<void>;

	// ---- Notifications ----

	/**
	 * Schedule deadline notifications based on current events
	 */
	scheduleDeadlineNotifications(): void;

	/**
	 * Generate all notifications based on current timeline state
	 */
	generateNotifications(): TimelineNotification[];

	/**
	 * Get all notifications (unread first, then by date)
	 */
	getNotifications(): TimelineNotification[];

	/**
	 * Get unread notification count
	 */
	getUnreadCount(): number;

	/**
	 * Mark a notification as read
	 */
	markAsRead(notificationId: string): Promise<void>;

	/**
	 * Mark all notifications as read
	 */
	markAllAsRead(): Promise<void>;

	/**
	 * Dismiss a notification
	 */
	dismissNotification(notificationId: string): Promise<void>;

	/**
	 * Snooze a notification for X days
	 */
	snoozeNotification(notificationId: string, days: number): Promise<void>;

	/**
	 * Update notification preferences
	 */
	updateNotificationPreferences(prefs: Partial<NotificationPreferences>): Promise<void>;

	/**
	 * Get notification preferences
	 */
	getNotificationPreferences(): NotificationPreferences;

	// ---- Export ----

	/**
	 * Export timeline to PDF
	 */
	exportToPDF(): Promise<Uint8Array>;

	// ---- Jurisdictions ----

	/**
	 * Get all available jurisdictions
	 */
	getJurisdictions(): JurisdictionConfig[];

	/**
	 * Get jurisdiction by ID
	 */
	getJurisdiction(id: string): JurisdictionConfig | undefined;

	/**
	 * Set the jurisdiction for the current timeline
	 */
	setJurisdiction(jurisdictionId: string): Promise<void>;

	// ---- Case Config Integration ----

	/**
	 * Sync timeline with case config data (injuryDate, caseName, etc.)
	 */
	syncFromCaseConfig(): Promise<boolean>;

	/**
	 * Create an injury event from case config if injury date exists
	 */
	createInjuryEventFromCaseConfig(): Promise<TimelineEvent | null>;

	/**
	 * Create a new timeline pre-populated with case config data
	 */
	createTimelineWithCaseConfig(): Promise<CaseTimeline>;

	// ---- Events ----

	/**
	 * Fired when the timeline changes
	 */
	readonly onDidChangeTimeline: Event<CaseTimeline | null>;

	/**
	 * Fired when notifications change
	 */
	readonly onDidChangeNotifications: Event<TimelineNotification[]>;
}

export const ITimelineService = createDecorator<ITimelineService>('timelineService');

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique ID for timeline events
 */
export function generateEventId(): string {
	return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Parse a date string safely
 */
export function parseTimelineDate(dateStr: string): Date | null {
	const date = new Date(dateStr);
	return isNaN(date.getTime()) ? null : date;
}

/**
 * Format a date for display
 */
export function formatTimelineDate(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1: Date, date2: Date): number {
	const oneDay = 24 * 60 * 60 * 1000;
	return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

/**
 * Check if a deadline is upcoming within the specified days
 */
export function isDeadlineUpcoming(event: TimelineEvent, daysAhead: number): boolean {
	if (!event.isDeadline || event.isComplete) {
		return false;
	}
	const deadline = parseTimelineDate(event.date);
	if (!deadline) {
		return false;
	}
	const now = new Date();
	const daysUntil = daysBetween(now, deadline);
	return daysUntil >= 0 && daysUntil <= daysAhead;
}

/**
 * Check if a deadline is overdue
 */
export function isDeadlineOverdue(event: TimelineEvent): boolean {
	if (!event.isDeadline || event.isComplete) {
		return false;
	}
	const deadline = parseTimelineDate(event.date);
	if (!deadline) {
		return false;
	}
	return deadline < new Date();
}


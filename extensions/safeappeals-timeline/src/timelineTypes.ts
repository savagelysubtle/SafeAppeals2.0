/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/** Timeline event categories (void-compatible). */
export type EventCategory =
	| 'injury'
	| 'medical'
	| 'hearing'
	| 'decision'
	| 'deadline'
	| 'filing'
	| 'correspondence'
	| 'custom';

export const EVENT_CATEGORIES: readonly EventCategory[] = [
	'injury',
	'medical',
	'hearing',
	'decision',
	'deadline',
	'filing',
	'correspondence',
	'custom',
] as const;

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
	injury: 'Injury',
	medical: 'Medical',
	hearing: 'Hearing',
	decision: 'Decision',
	deadline: 'Deadline',
	filing: 'Filing',
	correspondence: 'Correspondence',
	custom: 'Custom',
};

export const EVENT_CATEGORY_COLORS: Record<EventCategory, string> = {
	injury: '#ef4444',
	medical: '#3b82f6',
	hearing: '#8b5cf6',
	decision: '#f59e0b',
	deadline: '#dc2626',
	filing: '#10b981',
	correspondence: '#6b7280',
	custom: '#64748b',
};

/** One chronology / deadline entry in `.safeAppeals/timeline.json`. */
export interface TimelineEvent {
	id: string;
	/** ISO 8601 date or datetime. */
	date: string;
	endDate?: string;
	title: string;
	description?: string;
	category: EventCategory;
	isDeadline: boolean;
	isComplete?: boolean;
	linkedDocuments: string[];
	reminderDays?: number[];
	/** e.g. `statute`, `decision-rule`, `manual`. */
	source?: string;
	createdAt: string;
	updatedAt: string;
	syncToCalendar?: boolean;
	/** Optional deadline category (e.g., 'review', 'appeal', 'reconsideration', or custom). */
	deadlineCategory?: string;
}

/**
 * Patch for add/update. Empty string / null clears optional fields so webview
 * postMessage can round-trip "remove this value" (undefined is dropped).
 */
export type TimelineEventUpdates = Omit<
	Partial<Omit<TimelineEvent, 'id' | 'createdAt' | 'updatedAt'>>,
	'endDate' | 'description' | 'reminderDays' | 'isComplete' | 'syncToCalendar' | 'source' | 'deadlineCategory'
> & {
	endDate?: string | null;
	description?: string | null;
	reminderDays?: number[] | null;
	isComplete?: boolean | null;
	syncToCalendar?: boolean | null;
	source?: string | null;
	deadlineCategory?: string | null;
};

/**
 * Merge updates onto an event, deleting optional fields when cleared.
 */
export function applyTimelineEventUpdates(
	current: TimelineEvent,
	updates: TimelineEventUpdates,
): TimelineEvent {
	const next: TimelineEvent = {
		...current,
		id: current.id,
		createdAt: current.createdAt,
		updatedAt: new Date().toISOString(),
	};

	for (const [key, value] of Object.entries(updates) as Array<[keyof TimelineEventUpdates, unknown]>) {
		if (value === undefined) {
			continue;
		}
		(next as unknown as Record<string, unknown>)[key as string] = value;
	}

	if (updates.endDate === '' || updates.endDate === null) {
		delete next.endDate;
	}
	if (updates.description === '' || updates.description === null) {
		delete next.description;
	}
	if (updates.reminderDays === null) {
		delete next.reminderDays;
	}
	if (updates.isComplete === null) {
		delete next.isComplete;
	}
	if (updates.syncToCalendar === null) {
		delete next.syncToCalendar;
	}
	if (updates.source === null) {
		delete next.source;
	}
	if (updates.deadlineCategory === '' || updates.deadlineCategory === null) {
		delete next.deadlineCategory;
	}

	if (next.isDeadline === false) {
		delete next.reminderDays;
		delete next.isComplete;
	}

	return next;
}

export interface DeadlineRule {
	id: string;
	name: string;
	daysFromTrigger: number;
	triggerEvent: EventCategory;
	description: string;
}

export interface JurisdictionConfig {
	id: string;
	name: string;
	region: string;
	statuteOfLimitationsDays: number;
	deadlineRules: DeadlineRule[];
}

/** Workspace timeline store (plaintext under `.safeAppeals/timeline.json`). */
export interface CaseTimeline {
	version: 1;
	jurisdictionId: string;
	injuryDate?: string;
	events: TimelineEvent[];
	notificationsEnabled: boolean;
}

export const DEFAULT_CASE_TIMELINE: CaseTimeline = {
	version: 1,
	jurisdictionId: 'bc-wcb',
	events: [],
	notificationsEnabled: true,
};

export function generateEventId(): string {
	return `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function parseTimelineDate(dateStr: string): Date | null {
	const date = new Date(dateStr);
	return isNaN(date.getTime()) ? null : date;
}

export function formatTimelineDate(date: Date | string): string {
	const d = typeof date === 'string' ? new Date(date) : date;
	return d.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

export function daysBetween(date1: Date, date2: Date): number {
	const oneDay = 24 * 60 * 60 * 1000;
	return Math.round((date2.getTime() - date1.getTime()) / oneDay);
}

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

export function isEventCategory(value: string): value is EventCategory {
	return (EVENT_CATEGORIES as readonly string[]).includes(value);
}

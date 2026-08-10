/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

export type EventCategory =
	| 'injury'
	| 'medical'
	| 'hearing'
	| 'decision'
	| 'deadline'
	| 'filing'
	| 'correspondence'
	| 'custom';

export interface TimelineEvent {
	id: string;
	date: string;
	endDate?: string;
	title: string;
	description?: string;
	category: EventCategory;
	isDeadline: boolean;
	isComplete?: boolean;
	linkedDocuments: string[];
	reminderDays?: number[];
	source?: string;
	createdAt: string;
	updatedAt: string;
	syncToCalendar?: boolean;
	deadlineCategory?: string;
}

export interface JurisdictionOption {
	id: string;
	name: string;
	label: string;
	statuteOfLimitationsDays: number;
	isCustom?: boolean;
}

export interface CaseTimeline {
	version: 1;
	jurisdictionId: string;
	injuryDate?: string;
	events: TimelineEvent[];
	notificationsEnabled: boolean;
}

export interface TimelineBootstrap {
	timeline: CaseTimeline | null;
	jurisdictions: JurisdictionOption[];
	workspaceName: string;
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

export type HostToWebviewMessage =
	| { type: 'bootstrap'; payload: TimelineBootstrap }
	| { type: 'timelineUpdated'; timeline: CaseTimeline }
	| { type: 'selectEvent'; eventId: string }
	| { type: 'documentsPicked'; uris: string[] }
	| { type: 'error'; message: string };

export type WebviewToHostMessage =
	| { type: 'ready' }
	| { type: 'addEvent'; event: TimelineEventUpdates & Pick<TimelineEvent, 'date' | 'title' | 'category' | 'isDeadline' | 'linkedDocuments'> }
	| { type: 'updateEvent'; id: string; updates: TimelineEventUpdates }
	| { type: 'deleteEvent'; id: string }
	| { type: 'setJurisdiction'; jurisdictionId: string }
	| { type: 'setInjuryDate'; injuryDate: string }
	| { type: 'setNotificationsEnabled'; enabled: boolean }
	| { type: 'exportIcs' }
	| { type: 'toggleSyncToCalendar'; id: string }
	| { type: 'openDocument'; uri: string }
	| { type: 'pickDocuments' }
	| { type: 'attachActiveDocument' }
	| { type: 'openTimeline' }
	| { type: 'selectEvent'; eventId: string };

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

export const EVENT_CATEGORIES = Object.keys(EVENT_CATEGORY_LABELS) as EventCategory[];

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
	const deadline = new Date(event.date);
	if (isNaN(deadline.getTime())) {
		return false;
	}
	const daysUntil = daysBetween(new Date(), deadline);
	return daysUntil >= 0 && daysUntil <= daysAhead;
}

export function isDeadlineOverdue(event: TimelineEvent): boolean {
	if (!event.isDeadline || event.isComplete) {
		return false;
	}
	const deadline = new Date(event.date);
	if (isNaN(deadline.getTime())) {
		return false;
	}
	return deadline < new Date();
}

export function dateOnly(value: string): string {
	if (!value) {
		return '';
	}
	if (value.includes('T')) {
		return value.slice(0, 10);
	}
	return value;
}

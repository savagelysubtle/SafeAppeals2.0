/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { CaseTimeline, TimelineEvent } from './timelineTypes.js';

/**
 * Escape special characters for iCalendar format (RFC 5545)
 * Backslash, semicolon, and comma must be escaped
 * Newlines become literal \n
 */
function escapeIcsText(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\n/g, '\\n');
}

/**
 * Format a date to iCalendar format (YYYYMMDD or YYYYMMDDTHHMMSSZ)
 */
function formatIcsDate(dateStr: string, allDay: boolean = false): string {
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) {
		// Fallback for invalid dates
		return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
	}

	if (allDay) {
		// All-day event: YYYYMMDD (VALUE=DATE format)
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}${month}${day}`;
	}

	// Timed event: YYYYMMDDTHHMMSSZ (UTC format)
	return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

/**
 * Get current timestamp in iCalendar format
 */
function getIcsTimestamp(): string {
	return formatIcsDate(new Date().toISOString(), false);
}

/**
 * Check if an event should be treated as all-day
 * (no time component in the date, or time is midnight)
 */
function isAllDayEvent(dateStr: string): boolean {
	// If the date string doesn't contain a time indicator, it's all-day
	if (!dateStr.includes('T')) {
		return true;
	}
	// If time is exactly midnight, treat as all-day
	const date = new Date(dateStr);
	return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
}

/**
 * Generate VALARM components for reminders
 */
function generateAlarms(reminderDays: number[]): string {
	return reminderDays.map(days => {
		return [
			'BEGIN:VALARM',
			'ACTION:DISPLAY',
			`TRIGGER:-P${days}D`,
			`DESCRIPTION:Reminder: ${days} day${days !== 1 ? 's' : ''} until deadline`,
			'END:VALARM'
		].join('\r\n');
	}).join('\r\n');
}

/**
 * Determine if an event should be synced to calendar
 * Uses syncToCalendar if explicitly set, otherwise defaults to isDeadline
 */
export function shouldSyncToCalendar(event: TimelineEvent): boolean {
	if (event.syncToCalendar !== undefined) {
		return event.syncToCalendar;
	}
	return event.isDeadline;
}

/**
 * Generate a single VEVENT component
 */
function generateVEvent(
	event: TimelineEvent,
	caseName: string,
	workspaceId: string
): string {
	const uid = `safeappeals-${workspaceId}-${event.id}`;
	const dtstamp = getIcsTimestamp();
	const allDay = isAllDayEvent(event.date);

	// Build the summary with case name prefix
	const summary = caseName
		? `[${caseName}] ${event.title}`
		: event.title;

	// Build description with event details
	const descriptionParts: string[] = [];
	if (event.description) {
		descriptionParts.push(event.description);
	}
	if (event.linkedDocuments.length > 0) {
		const docNames = event.linkedDocuments.map(uri => {
			const parts = uri.split('/');
			return parts[parts.length - 1] || uri;
		});
		descriptionParts.push(`Linked documents: ${docNames.join(', ')}`);
	}
	if (event.tags && event.tags.length > 0) {
		descriptionParts.push(`Tags: ${event.tags.join(', ')}`);
	}

	const description = descriptionParts.length > 0
		? escapeIcsText(descriptionParts.join('\n\n'))
		: '';

	// Build categories
	const categories = [event.category.toUpperCase()];
	if (event.isDeadline) {
		categories.push('DEADLINE');
	}

	// Build the VEVENT lines
	const lines: string[] = [
		'BEGIN:VEVENT',
		`UID:${uid}`,
		`DTSTAMP:${dtstamp}`,
	];

	// Add date(s)
	if (allDay) {
		lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(event.date, true)}`);
		if (event.endDate) {
			// For all-day events, end date should be the day AFTER the last day
			const endDate = new Date(event.endDate);
			endDate.setDate(endDate.getDate() + 1);
			lines.push(`DTEND;VALUE=DATE:${formatIcsDate(endDate.toISOString(), true)}`);
		}
	} else {
		lines.push(`DTSTART:${formatIcsDate(event.date, false)}`);
		if (event.endDate) {
			lines.push(`DTEND:${formatIcsDate(event.endDate, false)}`);
		} else {
			// Default 1-hour duration for timed events without end time
			const endDate = new Date(event.date);
			endDate.setHours(endDate.getHours() + 1);
			lines.push(`DTEND:${formatIcsDate(endDate.toISOString(), false)}`);
		}
	}

	lines.push(`SUMMARY:${escapeIcsText(summary)}`);

	if (description) {
		lines.push(`DESCRIPTION:${description}`);
	}

	lines.push(`CATEGORIES:${categories.join(',')}`);

	// Add status
	if (event.isComplete) {
		lines.push('STATUS:COMPLETED');
	} else {
		lines.push('STATUS:CONFIRMED');
	}

	// Add alarms for deadlines with reminder days
	if (event.isDeadline && event.reminderDays && event.reminderDays.length > 0) {
		lines.push(generateAlarms(event.reminderDays));
	}

	lines.push('END:VEVENT');

	return lines.join('\r\n');
}

/**
 * Generate iCalendar (.ics) content from timeline events
 *
 * @param events - All timeline events (will be filtered to syncToCalendar only)
 * @param caseTimeline - The full case timeline for metadata
 * @param workspaceId - The workspace ID for unique event UIDs
 * @returns The .ics file content as a string
 */
export function generateIcsContent(
	events: TimelineEvent[],
	caseTimeline: CaseTimeline,
	workspaceId: string
): string {
	// Filter to only events that should sync to calendar
	const calendarEvents = events.filter(shouldSyncToCalendar);

	const caseName = caseTimeline.caseName || caseTimeline.caseId || 'Case';
	const calendarName = `${caseName} - Timeline`;

	// Build the VCALENDAR
	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//SafeAppeals//Timeline Export//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeIcsText(calendarName)}`,
	];

	// Add each event
	for (const event of calendarEvents) {
		lines.push(generateVEvent(event, caseName, workspaceId));
	}

	lines.push('END:VCALENDAR');

	// RFC 5545 requires CRLF line endings
	return lines.join('\r\n');
}

/**
 * Get the count of events that will be exported to calendar
 */
export function getCalendarEventCount(events: TimelineEvent[]): number {
	return events.filter(shouldSyncToCalendar).length;
}

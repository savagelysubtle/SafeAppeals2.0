/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type { CaseTimeline, TimelineEvent } from './timelineTypes';

function escapeIcsText(text: string): string {
	return text
		.replace(/\\/g, '\\\\')
		.replace(/;/g, '\\;')
		.replace(/,/g, '\\,')
		.replace(/\n/g, '\\n');
}

function formatIcsDate(dateStr: string, allDay: boolean = false): string {
	const date = new Date(dateStr);
	if (isNaN(date.getTime())) {
		return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
	}

	if (allDay) {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}${month}${day}`;
	}

	return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function getIcsTimestamp(): string {
	return formatIcsDate(new Date().toISOString(), false);
}

function isAllDayEvent(dateStr: string): boolean {
	if (!dateStr.includes('T')) {
		return true;
	}
	const date = new Date(dateStr);
	return date.getHours() === 0 && date.getMinutes() === 0 && date.getSeconds() === 0;
}

function generateAlarms(reminderDays: number[]): string {
	return reminderDays.map(days => {
		return [
			'BEGIN:VALARM',
			'ACTION:DISPLAY',
			`TRIGGER:-P${days}D`,
			`DESCRIPTION:Reminder: ${days} day${days !== 1 ? 's' : ''} until deadline`,
			'END:VALARM',
		].join('\r\n');
	}).join('\r\n');
}

export function shouldSyncToCalendar(event: TimelineEvent): boolean {
	if (event.syncToCalendar !== undefined) {
		return event.syncToCalendar;
	}
	return event.isDeadline;
}

function generateVEvent(
	event: TimelineEvent,
	calendarTitle: string,
	workspaceId: string,
): string {
	const uid = `safeappeals-${workspaceId}-${event.id}`;
	const dtstamp = getIcsTimestamp();
	const allDay = isAllDayEvent(event.date);
	const summary = calendarTitle
		? `[${calendarTitle}] ${event.title}`
		: event.title;

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

	const description = descriptionParts.length > 0
		? escapeIcsText(descriptionParts.join('\n\n'))
		: '';

	const categories = [event.category.toUpperCase()];
	if (event.isDeadline) {
		categories.push('DEADLINE');
	}

	const lines: string[] = [
		'BEGIN:VEVENT',
		`UID:${uid}`,
		`DTSTAMP:${dtstamp}`,
	];

	if (allDay) {
		lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(event.date, true)}`);
		if (event.endDate) {
			const endDate = new Date(event.endDate);
			endDate.setDate(endDate.getDate() + 1);
			lines.push(`DTEND;VALUE=DATE:${formatIcsDate(endDate.toISOString(), true)}`);
		}
	} else {
		lines.push(`DTSTART:${formatIcsDate(event.date, false)}`);
		if (event.endDate) {
			lines.push(`DTEND:${formatIcsDate(event.endDate, false)}`);
		} else {
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
	lines.push(event.isComplete ? 'STATUS:COMPLETED' : 'STATUS:CONFIRMED');

	if (event.isDeadline && event.reminderDays && event.reminderDays.length > 0) {
		lines.push(generateAlarms(event.reminderDays));
	}

	lines.push('END:VEVENT');
	return lines.join('\r\n');
}

export function generateIcsContent(
	events: TimelineEvent[],
	_timeline: CaseTimeline,
	workspaceId: string,
	calendarTitle = 'Case Timeline',
): string {
	const calendarEvents = events.filter(shouldSyncToCalendar);
	const lines: string[] = [
		'BEGIN:VCALENDAR',
		'VERSION:2.0',
		'PRODID:-//SafeAppeals//Timeline Export//EN',
		'CALSCALE:GREGORIAN',
		'METHOD:PUBLISH',
		`X-WR-CALNAME:${escapeIcsText(calendarTitle)}`,
	];

	for (const event of calendarEvents) {
		lines.push(generateVEvent(event, calendarTitle, workspaceId));
	}

	lines.push('END:VCALENDAR');
	return lines.join('\r\n');
}

export function getCalendarEventCount(events: TimelineEvent[]): number {
	return events.filter(shouldSyncToCalendar).length;
}

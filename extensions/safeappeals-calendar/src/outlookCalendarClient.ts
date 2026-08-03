/*--------------------------------------------------------------------------------------
 *  Outlook / Microsoft Graph — raw REST (no MSAL/Graph SDK) on service-connection tokens
 *--------------------------------------------------------------------------------------*/

import { CalendarTokenSource } from './calendarAuth';
import { getOutlookCalendarId } from './config';
import type { CalendarEvent, CalendarEventData, CalendarSyncResult } from './types';

export class OutlookCalendarClient {
	constructor(private readonly tokens: CalendarTokenSource) {}

	private async ensureAccessToken(): Promise<string> {
		return this.tokens.getAccessToken('outlook');
	}

	async listEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
		const accessToken = await this.ensureAccessToken();
		const calendarId = getOutlookCalendarId();
		const events: CalendarEvent[] = [];

		const select = 'id,subject,bodyPreview,body,start,end,isAllDay,reminderMinutesBeforeStart,isReminderOn,lastModifiedDateTime';
		let url: string | undefined;

		if (calendarId === 'primary') {
			url =
				`https://graph.microsoft.com/v1.0/me/calendarView` +
				`?startDateTime=${encodeURIComponent(timeMin)}` +
				`&endDateTime=${encodeURIComponent(timeMax)}` +
				`&$select=${select}` +
				`&$top=100` +
				`&$orderby=start/dateTime`;
		} else {
			url =
				`https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/calendarView` +
				`?startDateTime=${encodeURIComponent(timeMin)}` +
				`&endDateTime=${encodeURIComponent(timeMax)}` +
				`&$select=${select}` +
				`&$top=100` +
				`&$orderby=start/dateTime`;
		}

		while (url) {
			const res = await fetch(url, {
				headers: {
					Authorization: `Bearer ${accessToken}`,
					Prefer: 'outlook.timezone="UTC"',
				},
			});
			const json = await res.json() as {
				value?: GraphEvent[];
				'@odata.nextLink'?: string;
				error?: { message?: string };
			};

			if (!res.ok) {
				throw new Error(json.error?.message || `Graph calendarView failed (${res.status})`);
			}

			for (const item of json.value || []) {
				if (!item.id) {
					continue;
				}
				events.push(mapGraphEvent(item, calendarId));
			}
			url = json['@odata.nextLink'];
		}

		return events;
	}

	async createEvent(event: CalendarEventData, calendarId = getOutlookCalendarId()): Promise<CalendarSyncResult> {
		try {
			const accessToken = await this.ensureAccessToken();
			const uid = `safeappeals-${event.workspaceId}-${event.id}`;
			const body = buildGraphEventBody(event, uid);
			const apiPath = calendarId === 'primary'
				? 'https://graph.microsoft.com/v1.0/me/events'
				: `https://graph.microsoft.com/v1.0/me/calendars/${encodeURIComponent(calendarId)}/events`;

			const res = await fetch(apiPath, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(body),
			});
			const json = await res.json() as { id?: string; error?: { message?: string } };
			if (!res.ok || !json.id) {
				return { success: false, error: json.error?.message || `create failed (${res.status})` };
			}
			return { success: true, calendarEventId: json.id };
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	async updateEvent(
		event: CalendarEventData,
		calendarEventId: string,
		_calendarId = getOutlookCalendarId()
	): Promise<CalendarSyncResult> {
		try {
			const accessToken = await this.ensureAccessToken();
			const body = buildGraphEventBody(event);
			const res = await fetch(
				`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(calendarEventId)}`,
				{
					method: 'PATCH',
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(body),
				}
			);
			const json = await res.json() as { id?: string; error?: { message?: string } };
			if (!res.ok || !json.id) {
				return { success: false, error: json.error?.message || `update failed (${res.status})` };
			}
			return { success: true, calendarEventId: json.id };
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
	}

	async deleteEvent(calendarEventId: string): Promise<CalendarSyncResult> {
		try {
			const accessToken = await this.ensureAccessToken();
			const res = await fetch(
				`https://graph.microsoft.com/v1.0/me/events/${encodeURIComponent(calendarEventId)}`,
				{
					method: 'DELETE',
					headers: { Authorization: `Bearer ${accessToken}` },
				}
			);
			if (!res.ok && res.status !== 404) {
				return { success: false, error: `delete failed (${res.status})` };
			}
			return { success: true };
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
	}
}

interface GraphEvent {
	id?: string;
	subject?: string;
	bodyPreview?: string;
	body?: { content?: string };
	start?: { dateTime?: string; timeZone?: string };
	end?: { dateTime?: string; timeZone?: string };
	isAllDay?: boolean;
	reminderMinutesBeforeStart?: number;
	isReminderOn?: boolean;
	lastModifiedDateTime?: string;
}

function mapGraphEvent(item: GraphEvent, calendarId: string): CalendarEvent {
	const date = item.start?.dateTime || '';
	const endDate = item.end?.dateTime;
	return {
		id: item.id!,
		provider: 'outlook',
		calendarId,
		title: item.subject || '(untitled)',
		description: item.body?.content || item.bodyPreview,
		date,
		endDate,
		isAllDay: !!item.isAllDay,
		reminders: item.isReminderOn && item.reminderMinutesBeforeStart
			? [item.reminderMinutesBeforeStart]
			: undefined,
		updatedAt: item.lastModifiedDateTime,
	};
}

function buildGraphEventBody(event: CalendarEventData, uid?: string): Record<string, unknown> {
	const title = event.title || `Event ${event.id}`;
	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	const start = event.isAllDay ? event.date.split('T')[0] : event.date;

	const body: Record<string, unknown> = {
		subject: title,
		body: event.description
			? { contentType: 'HTML', content: event.description }
			: undefined,
		start: { dateTime: start, timeZone: tz },
		end: { dateTime: start, timeZone: tz },
		isAllDay: event.isAllDay,
	};

	if (event.reminders && event.reminders.length > 0) {
		body.reminderMinutesBeforeStart = event.reminders[0];
		body.isReminderOn = true;
	}

	if (uid) {
		body.singleValueExtendedProperties = [
			{
				id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name SafeAppealsUID',
				value: uid,
			},
		];
	}

	return body;
}

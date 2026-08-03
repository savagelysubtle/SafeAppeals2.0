/*--------------------------------------------------------------------------------------
 *  Google Calendar — raw REST (no googleapis SDK) on service-connection tokens
 *--------------------------------------------------------------------------------------*/

import { CalendarTokenSource } from './calendarAuth';
import { getGoogleCalendarId } from './config';
import type { CalendarEvent, CalendarEventData, CalendarSyncResult } from './types';

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export class GoogleCalendarClient {
	constructor(private readonly tokens: CalendarTokenSource) {}

	private async ensureAccessToken(): Promise<string> {
		return this.tokens.getAccessToken('google');
	}

	async listEvents(options: {
		timeMin: string;
		timeMax: string;
		syncToken?: string;
	}): Promise<{ events: CalendarEvent[]; deletedIds: string[]; nextSyncToken?: string }> {
		const calendarId = encodeURIComponent(getGoogleCalendarId());
		const accessToken = await this.ensureAccessToken();
		const events: CalendarEvent[] = [];
		const deletedIds: string[] = [];
		let pageToken: string | undefined;
		let nextSyncToken: string | undefined;

		do {
			const params = new URLSearchParams({
				singleEvents: 'true',
				maxResults: '250',
			});

			if (options.syncToken) {
				params.set('syncToken', options.syncToken);
			} else {
				params.set('timeMin', options.timeMin);
				params.set('timeMax', options.timeMax);
				params.set('orderBy', 'startTime');
			}
			if (pageToken) {
				params.set('pageToken', pageToken);
			}

			const url = `${CALENDAR_API}/calendars/${calendarId}/events?${params.toString()}`;
			const res = await fetch(url, {
				headers: { Authorization: `Bearer ${accessToken}` },
			});

			if (res.status === 410) {
				// Sync token invalidated — caller should full-sync
				throw new SyncTokenInvalidError();
			}

			const json = await res.json() as {
				items?: GoogleEvent[];
				nextPageToken?: string;
				nextSyncToken?: string;
				error?: { message?: string };
			};

			if (!res.ok) {
				throw new Error(json.error?.message || `Google events.list failed (${res.status})`);
			}

			for (const item of json.items || []) {
				if (!item.id) {
					continue;
				}
				if (item.status === 'cancelled') {
					deletedIds.push(item.id);
					continue;
				}
				events.push(mapGoogleEvent(item, getGoogleCalendarId()));
			}

			pageToken = json.nextPageToken;
			if (json.nextSyncToken) {
				nextSyncToken = json.nextSyncToken;
			}
		} while (pageToken);

		return { events, deletedIds, nextSyncToken };
	}

	async createEvent(event: CalendarEventData, calendarId = getGoogleCalendarId()): Promise<CalendarSyncResult> {
		try {
			const accessToken = await this.ensureAccessToken();
			const uid = `safeappeals-${event.workspaceId}-${event.id}@safeappeals.local`;
			const body = buildGoogleEventBody(event, uid);

			const res = await fetch(
				`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events`,
				{
					method: 'POST',
					headers: {
						Authorization: `Bearer ${accessToken}`,
						'Content-Type': 'application/json',
					},
					body: JSON.stringify(body),
				}
			);
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
		calendarId = getGoogleCalendarId()
	): Promise<CalendarSyncResult> {
		try {
			const accessToken = await this.ensureAccessToken();
			const body = buildGoogleEventBody(event);

			const res = await fetch(
				`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(calendarEventId)}`,
				{
					method: 'PUT',
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

	async deleteEvent(calendarEventId: string, calendarId = getGoogleCalendarId()): Promise<CalendarSyncResult> {
		try {
			const accessToken = await this.ensureAccessToken();
			const res = await fetch(
				`${CALENDAR_API}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(calendarEventId)}`,
				{
					method: 'DELETE',
					headers: { Authorization: `Bearer ${accessToken}` },
				}
			);
			if (!res.ok && res.status !== 404 && res.status !== 410) {
				return { success: false, error: `delete failed (${res.status})` };
			}
			return { success: true };
		} catch (err) {
			return { success: false, error: err instanceof Error ? err.message : String(err) };
		}
	}
}

export class SyncTokenInvalidError extends Error {
	constructor() {
		super('Google sync token invalid');
		this.name = 'SyncTokenInvalidError';
	}
}

interface GoogleEvent {
	id?: string;
	status?: string;
	summary?: string;
	description?: string;
	iCalUID?: string;
	etag?: string;
	updated?: string;
	start?: { date?: string; dateTime?: string };
	end?: { date?: string; dateTime?: string };
	reminders?: {
		overrides?: Array<{ minutes?: number }>;
	};
}

function mapGoogleEvent(item: GoogleEvent, calendarId: string): CalendarEvent {
	const isAllDay = !!item.start?.date && !item.start?.dateTime;
	const date = item.start?.dateTime || item.start?.date || '';
	const endDate = item.end?.dateTime || item.end?.date;
	return {
		id: item.id!,
		provider: 'google',
		calendarId,
		title: item.summary || '(untitled)',
		description: item.description,
		date,
		endDate,
		isAllDay,
		reminders: item.reminders?.overrides?.map((o) => o.minutes || 0).filter((m) => m > 0),
		iCalUID: item.iCalUID,
		etag: item.etag,
		updatedAt: item.updated,
	};
}

function buildGoogleEventBody(event: CalendarEventData, iCalUID?: string): Record<string, unknown> {
	const title = event.title || `Event ${event.id}`;
	const body: Record<string, unknown> = {
		summary: title,
		description: event.description,
	};
	if (iCalUID) {
		body.iCalUID = iCalUID;
	}

	const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
	if (event.isAllDay) {
		const d = event.date.split('T')[0];
		body.start = { date: d };
		body.end = { date: d };
	} else {
		body.start = { dateTime: event.date, timeZone: tz };
		body.end = { dateTime: event.date, timeZone: tz };
	}

	if (event.reminders && event.reminders.length > 0) {
		body.reminders = {
			useDefault: false,
			overrides: event.reminders.map((mins) => ({ method: 'popup', minutes: mins })),
		};
	}
	return body;
}

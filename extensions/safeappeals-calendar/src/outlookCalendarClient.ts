/*--------------------------------------------------------------------------------------
 *  Outlook / Microsoft Graph — OAuth2 auth-code + PKCE + raw REST (no MSAL/Graph SDK)
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	getOutlookCalendarId,
	getOutlookClientId,
	getOutlookTenantId,
	isOutlookConfigured,
} from './config';
import { createOAuthState, createPkcePair, startOAuthLoopback } from './oauthLoopback';
import { TokenStore } from './tokenStore';
import type { CalendarEvent, CalendarEventData, CalendarSyncResult, OAuthTokens } from './types';

const SCOPES = ['User.Read', 'Calendars.ReadWrite', 'offline_access', 'openid', 'profile'].join(' ');

export class OutlookCalendarClient {
	constructor(
		private readonly tokens: TokenStore,
		private readonly log: (msg: string) => void
	) {}

	isConfigured(): boolean {
		return isOutlookConfigured();
	}

	private authBase(): string {
		return `https://login.microsoftonline.com/${getOutlookTenantId()}/oauth2/v2.0`;
	}

	async connect(): Promise<OAuthTokens> {
		if (!this.isConfigured()) {
			throw new Error(
				'Outlook Calendar not configured. Set safeappealsCalendar.outlook.clientId or OUTLOOK_CLIENT_ID.'
			);
		}

		const clientId = getOutlookClientId();
		const state = createOAuthState();
		const pkce = createPkcePair();

		// Microsoft ignores port only for http://localhost (not 127.0.0.1).
		const loopback = await startOAuthLoopback({ expectedState: state, hostname: 'localhost' });
		try {
			const redirectUri = loopback.redirectUri;

			const params = new URLSearchParams({
				client_id: clientId,
				response_type: 'code',
				redirect_uri: redirectUri,
				response_mode: 'query',
				scope: SCOPES,
				state,
				code_challenge: pkce.challenge,
				code_challenge_method: 'S256',
			});

			const authUrl = `${this.authBase()}/authorize?${params.toString()}`;
			this.log('Starting Outlook OAuth (ephemeral loopback + PKCE)');

			await vscode.env.openExternal(vscode.Uri.parse(authUrl));
			const callback = await loopback.waitForCode;

			if (!callback.code) {
				throw new Error(callback.error || 'No authorization code received');
			}

			const body = new URLSearchParams({
				client_id: clientId,
				scope: SCOPES,
				code: callback.code,
				redirect_uri: redirectUri,
				grant_type: 'authorization_code',
				code_verifier: pkce.verifier,
			});

			const res = await fetch(`${this.authBase()}/token`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
				body: body.toString(),
			});
			const json = await res.json() as {
				access_token?: string;
				refresh_token?: string;
				expires_in?: number;
				error?: string;
				error_description?: string;
			};

			if (!res.ok || !json.access_token) {
				throw new Error(json.error_description || json.error || 'Outlook token exchange failed');
			}

			const tokens: OAuthTokens = {
				accessToken: json.access_token,
				refreshToken: json.refresh_token || '',
				expiresAt: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
			};

			await this.tokens.set('outlook', tokens);
			this.log('Outlook OAuth completed');
			return tokens;
		} finally {
			loopback.close();
		}
	}

	async disconnect(): Promise<void> {
		await this.tokens.clear('outlook');
		this.log('Outlook disconnected');
	}

	async ensureAccessToken(): Promise<string> {
		let tokens = await this.tokens.get('outlook');
		if (!tokens?.accessToken) {
			throw new Error('Outlook Calendar not connected');
		}

		const expiresAt = Date.parse(tokens.expiresAt);
		if (!Number.isNaN(expiresAt) && Date.now() < expiresAt - 5 * 60_000) {
			return tokens.accessToken;
		}

		if (!tokens.refreshToken) {
			throw new Error('Outlook access token expired and no refresh token is stored — reconnect');
		}

		this.log('Refreshing Outlook access token');
		const body = new URLSearchParams({
			client_id: getOutlookClientId(),
			scope: SCOPES,
			refresh_token: tokens.refreshToken,
			grant_type: 'refresh_token',
		});

		const res = await fetch(`${this.authBase()}/token`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: body.toString(),
		});
		const json = await res.json() as {
			access_token?: string;
			refresh_token?: string;
			expires_in?: number;
			error?: string;
			error_description?: string;
		};

		if (!res.ok || !json.access_token) {
			throw new Error(json.error_description || json.error || 'Outlook token refresh failed');
		}

		tokens = {
			accessToken: json.access_token,
			refreshToken: json.refresh_token || tokens.refreshToken,
			expiresAt: new Date(Date.now() + (json.expires_in || 3600) * 1000).toISOString(),
			accountId: tokens.accountId,
		};
		await this.tokens.set('outlook', tokens);
		return tokens.accessToken;
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

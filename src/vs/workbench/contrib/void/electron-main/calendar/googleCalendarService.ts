/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { shell } from 'electron';
import { Credentials, OAuth2Client } from 'google-auth-library';
import { calendar_v3, google } from 'googleapis';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IDevAuthServerService } from '../devAuthServer.js';

// OAuth configuration - these should be set via environment variables or settings
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '';

// Scopes required for calendar operations
const SCOPES = [
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/calendar.readonly'
];

export interface GoogleCalendarTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: string;  // ISO 8601
}

export interface CalendarEventData {
	id: string;
	title: string;
	description?: string;
	date: string;  // ISO 8601 date
	isAllDay: boolean;
	reminders?: number[];  // minutes before
	workspaceId: string;
}

export interface CalendarSyncResult {
	success: boolean;
	calendarEventId?: string;
	error?: string;
}

export class GoogleCalendarService {
	private oauth2Client: OAuth2Client;
	private calendar: calendar_v3.Calendar | null = null;

	constructor(
		private readonly logService: ILogService,
		private readonly devAuthServer: IDevAuthServerService
	) {
		this.oauth2Client = new google.auth.OAuth2(
			GOOGLE_CLIENT_ID,
			GOOGLE_CLIENT_SECRET,
			'http://127.0.0.1:47294/auth/callback'  // DevAuthServer callback
		);
	}

	/**
	 * Check if credentials are configured
	 */
	isConfigured(): boolean {
		return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
	}

	/**
	 * Start OAuth flow - opens browser for user authorization
	 */
	async startAuthFlow(): Promise<GoogleCalendarTokens> {
		if (!this.isConfigured()) {
			throw new Error('Google Calendar credentials not configured. Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET environment variables.');
		}

		this.logService.info('[GoogleCalendarService] Starting OAuth flow');

		// Start the dev auth server to receive callback
		const callbackUrl = await this.devAuthServer.startServer();
		this.logService.info(`[GoogleCalendarService] Auth callback URL: ${callbackUrl}`);

		// Generate auth URL
		const authUrl = this.oauth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: SCOPES,
			prompt: 'consent'  // Force consent to get refresh token
		});

		// Open browser for authorization
		await shell.openExternal(authUrl);
		this.logService.info('[GoogleCalendarService] Opened browser for authorization');

		// Wait for callback
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('OAuth timeout - no callback received within 5 minutes'));
			}, 5 * 60 * 1000);

			const subscription = this.devAuthServer.onCallback(async (event) => {
				clearTimeout(timeout);
				subscription.dispose();

				if (event.error) {
					reject(new Error(`OAuth error: ${event.error}`));
					return;
				}

				if (!event.code) {
					reject(new Error('No authorization code received'));
					return;
				}

				try {
					// Exchange code for tokens
					const { tokens } = await this.oauth2Client.getToken(event.code);
					this.oauth2Client.setCredentials(tokens);

					const googleTokens: GoogleCalendarTokens = {
						accessToken: tokens.access_token!,
						refreshToken: tokens.refresh_token!,
						expiresAt: new Date(tokens.expiry_date!).toISOString()
					};

					this.logService.info('[GoogleCalendarService] OAuth flow completed successfully');
					resolve(googleTokens);
				} catch (error) {
					this.logService.error('[GoogleCalendarService] Token exchange failed:', error);
					reject(error);
				}
			});
		});
	}

	/**
	 * Set credentials from stored tokens
	 */
	setCredentials(tokens: GoogleCalendarTokens): void {
		const credentials: Credentials = {
			access_token: tokens.accessToken,
			refresh_token: tokens.refreshToken,
			expiry_date: new Date(tokens.expiresAt).getTime()
		};
		this.oauth2Client.setCredentials(credentials);
		this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
		this.logService.info('[GoogleCalendarService] Credentials set');
	}

	/**
	 * Refresh access token if expired
	 */
	async refreshTokenIfNeeded(): Promise<GoogleCalendarTokens | null> {
		const credentials = this.oauth2Client.credentials;
		if (!credentials.expiry_date || Date.now() < credentials.expiry_date - 60000) {
			return null;  // Token still valid (with 1 min buffer)
		}

		this.logService.info('[GoogleCalendarService] Refreshing access token');
		const { credentials: newCredentials } = await this.oauth2Client.refreshAccessToken();
		this.oauth2Client.setCredentials(newCredentials);

		return {
			accessToken: newCredentials.access_token!,
			refreshToken: newCredentials.refresh_token || credentials.refresh_token as string,
			expiresAt: new Date(newCredentials.expiry_date!).toISOString()
		};
	}

	/**
	 * List user's calendars
	 */
	async listCalendars(): Promise<{ id: string; summary: string; primary: boolean }[]> {
		if (!this.calendar) {
			throw new Error('Not authenticated. Call setCredentials first.');
		}

		const response = await this.calendar.calendarList.list();
		return (response.data.items || []).map(cal => ({
			id: cal.id!,
			summary: cal.summary!,
			primary: cal.primary || false
		}));
	}

	/**
	 * Create a calendar event
	 */
	async createEvent(
		event: CalendarEventData,
		calendarId: string = 'primary'
	): Promise<CalendarSyncResult> {
		if (!this.calendar) {
			return { success: false, error: 'Not authenticated' };
		}

		// Log full event data for debugging
		this.logService.info(`[GoogleCalendarService] Creating event - raw data:`, JSON.stringify(event, null, 2));
		this.logService.info(`[GoogleCalendarService] Event title type: ${typeof event.title}, value: "${event.title}"`);

		// Use title or fallback to event ID
		const eventTitle = event.title || `Event ${event.id}`;
		if (!event.title) {
			this.logService.warn(`[GoogleCalendarService] Event has no title! Event ID: ${event.id}. Using fallback: "${eventTitle}"`);
		}

		try {
			// Build the UID with workspace ID for isolation
			const uid = `safeappeals-${event.workspaceId}-${event.id}@safeappeals.local`;

			// Build event body - Google Calendar uses 'summary' for the title
			// Note: Do NOT set 'id' - let Google generate it. We use iCalUID for our tracking.
			const eventBody: calendar_v3.Schema$Event = {
				summary: eventTitle,  // Use the validated title
				description: event.description,
				iCalUID: uid
			};

			this.logService.info(`[GoogleCalendarService] Built eventBody.summary: "${eventBody.summary}", iCalUID: "${uid}"`);

			// Set date/time
			if (event.isAllDay) {
				eventBody.start = { date: event.date.split('T')[0] };
				eventBody.end = { date: event.date.split('T')[0] };
			} else {
				eventBody.start = { dateTime: event.date, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
				eventBody.end = { dateTime: event.date, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
			}

			// Set reminders
			if (event.reminders && event.reminders.length > 0) {
				eventBody.reminders = {
					useDefault: false,
					overrides: event.reminders.map(mins => ({
						method: 'popup',
						minutes: mins
					}))
				};
			}

			const response = await this.calendar.events.insert({
				calendarId,
				requestBody: eventBody
			});

			this.logService.info(`[GoogleCalendarService] Created event: ${response.data.id}`);
			return { success: true, calendarEventId: response.data.id! };
		} catch (error: any) {
			this.logService.error('[GoogleCalendarService] Failed to create event:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Update an existing calendar event
	 */
	async updateEvent(
		event: CalendarEventData,
		calendarEventId: string,
		calendarId: string = 'primary'
	): Promise<CalendarSyncResult> {
		if (!this.calendar) {
			return { success: false, error: 'Not authenticated' };
		}

		try {
			const eventBody: calendar_v3.Schema$Event = {
				summary: event.title,
				description: event.description
			};

			if (event.isAllDay) {
				eventBody.start = { date: event.date.split('T')[0] };
				eventBody.end = { date: event.date.split('T')[0] };
			} else {
				eventBody.start = { dateTime: event.date, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
				eventBody.end = { dateTime: event.date, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
			}

			if (event.reminders && event.reminders.length > 0) {
				eventBody.reminders = {
					useDefault: false,
					overrides: event.reminders.map(mins => ({
						method: 'popup',
						minutes: mins
					}))
				};
			}

			const response = await this.calendar.events.update({
				calendarId,
				eventId: calendarEventId,
				requestBody: eventBody
			});

			this.logService.info(`[GoogleCalendarService] Updated event: ${response.data.id}`);
			return { success: true, calendarEventId: response.data.id! };
		} catch (error: any) {
			this.logService.error('[GoogleCalendarService] Failed to update event:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Delete a calendar event
	 */
	async deleteEvent(
		calendarEventId: string,
		calendarId: string = 'primary'
	): Promise<CalendarSyncResult> {
		if (!this.calendar) {
			return { success: false, error: 'Not authenticated' };
		}

		try {
			await this.calendar.events.delete({
				calendarId,
				eventId: calendarEventId
			});

			this.logService.info(`[GoogleCalendarService] Deleted event: ${calendarEventId}`);
			return { success: true };
		} catch (error: any) {
			this.logService.error('[GoogleCalendarService] Failed to delete event:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Find events by UID prefix (for workspace isolation)
	 */
	async findEventsByWorkspace(
		workspaceId: string,
		calendarId: string = 'primary'
	): Promise<{ id: string; iCalUID: string; summary: string }[]> {
		if (!this.calendar) {
			throw new Error('Not authenticated');
		}

		const prefix = `safeappeals-${workspaceId}`;

		// Google Calendar doesn't support UID search directly, so we need to list and filter
		// This could be slow for large calendars, but it's necessary for isolation
		const response = await this.calendar.events.list({
			calendarId,
			maxResults: 2500,
			singleEvents: true,
			orderBy: 'startTime'
		});

		return (response.data.items || [])
			.filter(event => event.iCalUID?.startsWith(prefix))
			.map(event => ({
				id: event.id!,
				iCalUID: event.iCalUID!,
				summary: event.summary!
			}));
	}

}

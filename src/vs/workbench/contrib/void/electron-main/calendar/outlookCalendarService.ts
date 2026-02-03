/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { AccountInfo, InteractionRequiredAuthError, LogLevel, PublicClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import { shell } from 'electron';
import 'isomorphic-fetch';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IDevAuthServerService } from '../devAuthServer.js';

// OAuth configuration - these should be set via environment variables or settings
const OUTLOOK_CLIENT_ID = process.env.OUTLOOK_CLIENT_ID || '';
const OUTLOOK_TENANT_ID = process.env.OUTLOOK_TENANT_ID || 'common';  // 'common' for multi-tenant

// Scopes required for calendar operations
const SCOPES = [
	'User.Read',
	'Calendars.ReadWrite'
];

export interface OutlookCalendarTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: string;  // ISO 8601
	accountId?: string;  // MSAL account identifier for silent token acquisition
}

export interface OutlookEventData {
	id: string;
	title: string;
	description?: string;
	date: string;  // ISO 8601 date
	isAllDay: boolean;
	reminders?: number[];  // minutes before
	workspaceId: string;
}

export interface OutlookSyncResult {
	success: boolean;
	calendarEventId?: string;
	error?: string;
}

// Microsoft Graph Event type (simplified)
interface GraphEvent {
	id?: string;
	subject: string;
	body?: {
		contentType: 'HTML' | 'Text';
		content: string;
	};
	start: {
		dateTime: string;
		timeZone: string;
	};
	end: {
		dateTime: string;
		timeZone: string;
	};
	isAllDay?: boolean;
	reminderMinutesBeforeStart?: number;
	isReminderOn?: boolean;
	// Custom property to store our UID (transactionId is not reliable, use extensions or description)
	singleValueExtendedProperties?: Array<{
		id: string;
		value: string;
	}>;
}

export class OutlookCalendarService {
	private pca: PublicClientApplication | null = null;
	private graphClient: Client | null = null;
	private account: AccountInfo | null = null;
	private currentTokens: OutlookCalendarTokens | null = null;

	constructor(
		private readonly logService: ILogService,
		_devAuthServer: IDevAuthServerService  // Not used - MSAL handles OAuth internally
	) {
		this.initializeMsal();
	}

	private initializeMsal(): void {
		if (!OUTLOOK_CLIENT_ID) {
			this.logService.warn('[OutlookCalendarService] OUTLOOK_CLIENT_ID not configured');
			return;
		}

		this.pca = new PublicClientApplication({
			auth: {
				clientId: OUTLOOK_CLIENT_ID,
				authority: `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}`,
			},
			system: {
				loggerOptions: {
					loggerCallback: (level, message) => {
						if (level === LogLevel.Error) {
							this.logService.error(`[MSAL] ${message}`);
						} else if (level === LogLevel.Warning) {
							this.logService.warn(`[MSAL] ${message}`);
						} else if (level === LogLevel.Info) {
							this.logService.info(`[MSAL] ${message}`);
						}
					},
					piiLoggingEnabled: false,
					logLevel: LogLevel.Warning,
				},
			},
		});
	}

	/**
	 * Check if credentials are configured
	 */
	isConfigured(): boolean {
		return !!OUTLOOK_CLIENT_ID;
	}

	/**
	 * Start OAuth flow - opens browser for user authorization
	 */
	async startAuthFlow(): Promise<OutlookCalendarTokens> {
		if (!this.isConfigured() || !this.pca) {
			throw new Error('Outlook Calendar credentials not configured. Set OUTLOOK_CLIENT_ID environment variable.');
		}

		this.logService.info('[OutlookCalendarService] Starting OAuth flow');

		try {
			// Use MSAL's interactive auth which handles the browser flow
			const response = await this.pca.acquireTokenInteractive({
				scopes: SCOPES,
				openBrowser: async (url) => {
					this.logService.info(`[OutlookCalendarService] Opening browser for auth: ${url}`);
					await shell.openExternal(url);
				},
				successTemplate: `
					<html>
						<head><title>SafeAppeals - Connected to Outlook</title></head>
						<body style="font-family: system-ui; text-align: center; padding: 50px;">
							<h1 style="color: #2ecc71;">Successfully connected to Outlook!</h1>
							<p>You can close this window and return to SafeAppeals.</p>
						</body>
					</html>
				`,
				errorTemplate: `
					<html>
						<head><title>SafeAppeals - Connection Failed</title></head>
						<body style="font-family: system-ui; text-align: center; padding: 50px;">
							<h1 style="color: #e74c3c;">Failed to connect to Outlook</h1>
							<p>Please try again. Error: {{error}}</p>
						</body>
					</html>
				`,
			});

			this.account = response.account;
			this.setupGraphClient(response.accessToken);

			const tokens: OutlookCalendarTokens = {
				accessToken: response.accessToken,
				refreshToken: '', // MSAL handles refresh tokens internally
				expiresAt: response.expiresOn?.toISOString() || new Date(Date.now() + 3600000).toISOString(),
				accountId: response.account?.homeAccountId,
			};

			this.currentTokens = tokens;
			this.logService.info('[OutlookCalendarService] OAuth flow completed successfully');
			return tokens;
		} catch (error: any) {
			this.logService.error('[OutlookCalendarService] OAuth flow failed:', error);
			throw error;
		}
	}

	/**
	 * Set credentials from stored tokens
	 */
	async setCredentials(tokens: OutlookCalendarTokens): Promise<void> {
		this.currentTokens = tokens;

		// If we have an account ID, try to get the account from cache
		if (tokens.accountId && this.pca) {
			const cache = this.pca.getTokenCache();
			const accounts = await cache.getAllAccounts();
			this.account = accounts.find(a => a.homeAccountId === tokens.accountId) || null;
		}

		this.setupGraphClient(tokens.accessToken);
		this.logService.info('[OutlookCalendarService] Credentials set');
	}

	private setupGraphClient(accessToken: string): void {
		this.graphClient = Client.init({
			authProvider: (done) => {
				done(null, accessToken);
			},
		});
	}

	/**
	 * Refresh access token if expired
	 */
	async refreshTokenIfNeeded(): Promise<OutlookCalendarTokens | null> {
		if (!this.pca || !this.account) {
			return null;
		}

		// Check if token is still valid (with 5 min buffer)
		if (this.currentTokens?.expiresAt) {
			const expiresAt = new Date(this.currentTokens.expiresAt).getTime();
			if (Date.now() < expiresAt - 5 * 60 * 1000) {
				return null;  // Token still valid
			}
		}

		this.logService.info('[OutlookCalendarService] Refreshing access token');

		try {
			const response = await this.pca.acquireTokenSilent({
				scopes: SCOPES,
				account: this.account,
			});

			this.setupGraphClient(response.accessToken);

			const tokens: OutlookCalendarTokens = {
				accessToken: response.accessToken,
				refreshToken: '',
				expiresAt: response.expiresOn?.toISOString() || new Date(Date.now() + 3600000).toISOString(),
				accountId: response.account?.homeAccountId,
			};

			this.currentTokens = tokens;
			return tokens;
		} catch (error) {
			if (error instanceof InteractionRequiredAuthError) {
				this.logService.warn('[OutlookCalendarService] Token refresh requires interaction');
				// Need to re-authenticate
				return null;
			}
			throw error;
		}
	}

	/**
	 * List user's calendars
	 */
	async listCalendars(): Promise<{ id: string; name: string; isDefault: boolean }[]> {
		if (!this.graphClient) {
			throw new Error('Not authenticated. Call setCredentials first.');
		}

		const response = await this.graphClient
			.api('/me/calendars')
			.select('id,name,isDefaultCalendar')
			.get();

		return (response.value || []).map((cal: any) => ({
			id: cal.id,
			name: cal.name,
			isDefault: cal.isDefaultCalendar || false,
		}));
	}

	/**
	 * Create a calendar event
	 */
	async createEvent(
		event: OutlookEventData,
		calendarId: string = 'primary'
	): Promise<OutlookSyncResult> {
		if (!this.graphClient) {
			return { success: false, error: 'Not authenticated' };
		}

		// Log event data for debugging
		this.logService.info(`[OutlookCalendarService] Creating event - raw data:`, JSON.stringify(event, null, 2));

		const eventTitle = event.title || `Event ${event.id}`;
		if (!event.title) {
			this.logService.warn(`[OutlookCalendarService] Event has no title! Event ID: ${event.id}`);
		}

		try {
			// Build the UID with workspace ID for isolation
			const uid = `safeappeals-${event.workspaceId}-${event.id}`;
			const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

			// Build event body
			const eventBody: GraphEvent = {
				subject: eventTitle,
				body: event.description ? {
					contentType: 'HTML',
					content: event.description,
				} : undefined,
				start: {
					dateTime: event.isAllDay ? event.date.split('T')[0] : event.date,
					timeZone,
				},
				end: {
					dateTime: event.isAllDay ? event.date.split('T')[0] : event.date,
					timeZone,
				},
				isAllDay: event.isAllDay,
				// Store our UID in the body for retrieval
				singleValueExtendedProperties: [
					{
						id: 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name SafeAppealsUID',
						value: uid,
					}
				],
			};

			// Set reminders (Outlook only supports one reminder)
			if (event.reminders && event.reminders.length > 0) {
				eventBody.reminderMinutesBeforeStart = event.reminders[0];
				eventBody.isReminderOn = true;
			}

			// Determine the API path
			const apiPath = calendarId === 'primary'
				? '/me/events'
				: `/me/calendars/${calendarId}/events`;

			const response = await this.graphClient
				.api(apiPath)
				.post(eventBody);

			this.logService.info(`[OutlookCalendarService] Created event: ${response.id}`);
			return { success: true, calendarEventId: response.id };
		} catch (error: any) {
			this.logService.error('[OutlookCalendarService] Failed to create event:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Update an existing calendar event
	 */
	async updateEvent(
		event: OutlookEventData,
		calendarEventId: string,
		calendarId: string = 'primary'
	): Promise<OutlookSyncResult> {
		if (!this.graphClient) {
			return { success: false, error: 'Not authenticated' };
		}

		try {
			const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

			const eventBody: Partial<GraphEvent> = {
				subject: event.title,
				body: event.description ? {
					contentType: 'HTML',
					content: event.description,
				} : undefined,
				start: {
					dateTime: event.isAllDay ? event.date.split('T')[0] : event.date,
					timeZone,
				},
				end: {
					dateTime: event.isAllDay ? event.date.split('T')[0] : event.date,
					timeZone,
				},
				isAllDay: event.isAllDay,
			};

			if (event.reminders && event.reminders.length > 0) {
				eventBody.reminderMinutesBeforeStart = event.reminders[0];
				eventBody.isReminderOn = true;
			}

			const response = await this.graphClient
				.api(`/me/events/${calendarEventId}`)
				.patch(eventBody);

			this.logService.info(`[OutlookCalendarService] Updated event: ${response.id}`);
			return { success: true, calendarEventId: response.id };
		} catch (error: any) {
			this.logService.error('[OutlookCalendarService] Failed to update event:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Delete a calendar event
	 */
	async deleteEvent(
		calendarEventId: string,
		_calendarId: string = 'primary'
	): Promise<OutlookSyncResult> {
		if (!this.graphClient) {
			return { success: false, error: 'Not authenticated' };
		}

		try {
			await this.graphClient
				.api(`/me/events/${calendarEventId}`)
				.delete();

			this.logService.info(`[OutlookCalendarService] Deleted event: ${calendarEventId}`);
			return { success: true };
		} catch (error: any) {
			this.logService.error('[OutlookCalendarService] Failed to delete event:', error);
			return { success: false, error: error.message };
		}
	}

	/**
	 * Find events by workspace (using extended property filter)
	 */
	async findEventsByWorkspace(
		workspaceId: string,
		calendarId: string = 'primary'
	): Promise<{ id: string; uid: string; subject: string }[]> {
		if (!this.graphClient) {
			throw new Error('Not authenticated');
		}

		const prefix = `safeappeals-${workspaceId}`;

		try {
			// Query events with our custom property
			const apiPath = calendarId === 'primary'
				? '/me/events'
				: `/me/calendars/${calendarId}/events`;

			const response = await this.graphClient
				.api(apiPath)
				.expand(`singleValueExtendedProperties($filter=id eq 'String {66f5a359-4659-4830-9070-00047ec6ac6e} Name SafeAppealsUID')`)
				.select('id,subject,singleValueExtendedProperties')
				.top(500)
				.get();

			// Filter events that have our UID property with the workspace prefix
			return (response.value || [])
				.filter((event: any) => {
					const uidProp = event.singleValueExtendedProperties?.find(
						(p: any) => p.id.includes('SafeAppealsUID')
					);
					return uidProp?.value?.startsWith(prefix);
				})
				.map((event: any) => {
					const uidProp = event.singleValueExtendedProperties?.find(
						(p: any) => p.id.includes('SafeAppealsUID')
					);
					return {
						id: event.id,
						uid: uidProp?.value || '',
						subject: event.subject,
					};
				});
		} catch (error: any) {
			this.logService.error('[OutlookCalendarService] Failed to find events:', error);
			return [];
		}
	}

	/**
	 * Disconnect and clear credentials
	 */
	async disconnect(): Promise<void> {
		if (this.pca && this.account) {
			try {
				const cache = this.pca.getTokenCache();
				await cache.removeAccount(this.account);
			} catch (error) {
				this.logService.warn('[OutlookCalendarService] Error clearing account:', error);
			}
		}

		this.account = null;
		this.graphClient = null;
		this.currentTokens = null;
		this.logService.info('[OutlookCalendarService] Disconnected');
	}
}

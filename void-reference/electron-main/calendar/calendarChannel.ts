/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { IServerChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IDevAuthServerService } from '../devAuthServer.js';
import { CalendarEventData, GoogleCalendarService, GoogleCalendarTokens } from './googleCalendarService.js';
import { OutlookCalendarService, OutlookCalendarTokens, OutlookEventData } from './outlookCalendarService.js';

export class CalendarChannel implements IServerChannel {
	private googleCalendarService: GoogleCalendarService;
	private outlookCalendarService: OutlookCalendarService;

	constructor(
		logService: ILogService,
		devAuthServer: IDevAuthServerService
	) {
		this.googleCalendarService = new GoogleCalendarService(logService, devAuthServer);
		this.outlookCalendarService = new OutlookCalendarService(logService, devAuthServer);
	}

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(_ctx: any, command: string, args?: any): Promise<any> {
		switch (command) {
			// ---- Configuration ----
			case 'isConfigured': {
				return this.googleCalendarService.isConfigured();
			}

			case 'isOutlookConfigured': {
				return this.outlookCalendarService.isConfigured();
			}

			// ---- OAuth Flow ----
			case 'startGoogleAuth': {
				return this.googleCalendarService.startAuthFlow();
			}

			case 'setGoogleCredentials': {
				const { tokens } = args as { tokens: GoogleCalendarTokens };
				this.googleCalendarService.setCredentials(tokens);
				return { success: true };
			}

			case 'refreshGoogleToken': {
				return this.googleCalendarService.refreshTokenIfNeeded();
			}

			// ---- Outlook OAuth Flow ----
			case 'startOutlookAuth': {
				return this.outlookCalendarService.startAuthFlow();
			}

			case 'setOutlookCredentials': {
				const { tokens } = args as { tokens: OutlookCalendarTokens };
				await this.outlookCalendarService.setCredentials(tokens);
				return { success: true };
			}

			case 'refreshOutlookToken': {
				return this.outlookCalendarService.refreshTokenIfNeeded();
			}

			case 'disconnectOutlook': {
				await this.outlookCalendarService.disconnect();
				return { success: true };
			}

			// ---- Outlook Calendar Operations ----
			case 'listOutlookCalendars': {
				return this.outlookCalendarService.listCalendars();
			}

			case 'createOutlookEvent': {
				const { event, calendarId } = args as { event: OutlookEventData; calendarId?: string };
				return this.outlookCalendarService.createEvent(event, calendarId);
			}

			case 'updateOutlookEvent': {
				const { event, calendarEventId, calendarId } = args as {
					event: OutlookEventData;
					calendarEventId: string;
					calendarId?: string;
				};
				return this.outlookCalendarService.updateEvent(event, calendarEventId, calendarId);
			}

			case 'deleteOutlookEvent': {
				const { calendarEventId, calendarId } = args as {
					calendarEventId: string;
					calendarId?: string;
				};
				return this.outlookCalendarService.deleteEvent(calendarEventId, calendarId);
			}

			case 'findOutlookEventsByWorkspace': {
				const { workspaceId, calendarId } = args as {
					workspaceId: string;
					calendarId?: string;
				};
				return this.outlookCalendarService.findEventsByWorkspace(workspaceId, calendarId);
			}

			case 'syncOutlookEvents': {
				const { events, calendarId } = args as {
					events: { create: OutlookEventData[]; update: { event: OutlookEventData; calendarEventId: string }[]; delete: string[] };
					calendarId?: string;
				};

				const results: {
					created: { eventId: string; calendarEventId: string }[];
					updated: { eventId: string; calendarEventId: string }[];
					deleted: string[];
					errors: { eventId: string; error: string }[];
				} = {
					created: [],
					updated: [],
					deleted: [],
					errors: []
				};

				// Process creates
				for (const event of events.create) {
					const result = await this.outlookCalendarService.createEvent(event, calendarId);
					if (result.success && result.calendarEventId) {
						results.created.push({ eventId: event.id, calendarEventId: result.calendarEventId });
					} else {
						results.errors.push({ eventId: event.id, error: result.error || 'Unknown error' });
					}
				}

				// Process updates
				for (const { event, calendarEventId } of events.update) {
					const result = await this.outlookCalendarService.updateEvent(event, calendarEventId, calendarId);
					if (result.success && result.calendarEventId) {
						results.updated.push({ eventId: event.id, calendarEventId: result.calendarEventId });
					} else {
						results.errors.push({ eventId: event.id, error: result.error || 'Unknown error' });
					}
				}

				// Process deletes
				for (const calendarEventId of events.delete) {
					const result = await this.outlookCalendarService.deleteEvent(calendarEventId, calendarId);
					if (result.success) {
						results.deleted.push(calendarEventId);
					} else {
						results.errors.push({ eventId: calendarEventId, error: result.error || 'Unknown error' });
					}
				}

				return results;
			}

			// ---- Google Calendar Operations ----
			case 'listCalendars': {
				return this.googleCalendarService.listCalendars();
			}

			case 'createEvent': {
				const { event, calendarId } = args as { event: CalendarEventData; calendarId?: string };
				return this.googleCalendarService.createEvent(event, calendarId);
			}

			case 'updateEvent': {
				const { event, calendarEventId, calendarId } = args as {
					event: CalendarEventData;
					calendarEventId: string;
					calendarId?: string;
				};
				return this.googleCalendarService.updateEvent(event, calendarEventId, calendarId);
			}

			case 'deleteEvent': {
				const { calendarEventId, calendarId } = args as {
					calendarEventId: string;
					calendarId?: string;
				};
				return this.googleCalendarService.deleteEvent(calendarEventId, calendarId);
			}

			case 'findEventsByWorkspace': {
				const { workspaceId, calendarId } = args as {
					workspaceId: string;
					calendarId?: string;
				};
				return this.googleCalendarService.findEventsByWorkspace(workspaceId, calendarId);
			}

			// ---- Batch Sync ----
			case 'syncEvents': {
				const { events, calendarId } = args as {
					events: { create: CalendarEventData[]; update: { event: CalendarEventData; calendarEventId: string }[]; delete: string[] };
					calendarId?: string;
					syncState: Record<string, { calendarEventId: string }>;
				};

				// Debug: log what we received from IPC
				console.log('[CalendarChannel] syncEvents received - create events:', JSON.stringify(events.create, null, 2));
				for (const evt of events.create) {
					console.log(`[CalendarChannel] Event ${evt.id}: title="${evt.title}" (type: ${typeof evt.title})`);
				}

				const results: {
					created: { eventId: string; calendarEventId: string }[];
					updated: { eventId: string; calendarEventId: string }[];
					deleted: string[];
					errors: { eventId: string; error: string }[];
				} = {
					created: [],
					updated: [],
					deleted: [],
					errors: []
				};

				// Process creates
				for (const event of events.create) {
					console.log(`[CalendarChannel] Processing create for event ${event.id}, title="${event.title}"`);
					const result = await this.googleCalendarService.createEvent(event, calendarId);
					if (result.success && result.calendarEventId) {
						results.created.push({ eventId: event.id, calendarEventId: result.calendarEventId });
					} else {
						results.errors.push({ eventId: event.id, error: result.error || 'Unknown error' });
					}
				}

				// Process updates
				for (const { event, calendarEventId } of events.update) {
					const result = await this.googleCalendarService.updateEvent(event, calendarEventId, calendarId);
					if (result.success && result.calendarEventId) {
						results.updated.push({ eventId: event.id, calendarEventId: result.calendarEventId });
					} else {
						results.errors.push({ eventId: event.id, error: result.error || 'Unknown error' });
					}
				}

				// Process deletes
				for (const calendarEventId of events.delete) {
					const result = await this.googleCalendarService.deleteEvent(calendarEventId, calendarId);
					if (result.success) {
						results.deleted.push(calendarEventId);
					} else {
						results.errors.push({ eventId: calendarEventId, error: result.error || 'Unknown error' });
					}
				}

				return results;
			}

			default:
				throw new Error(`Call not found: ${command}`);
		}
	}
}

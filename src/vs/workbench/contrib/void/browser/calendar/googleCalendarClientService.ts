/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';

// Types matching the main process
export interface GoogleCalendarTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: string;
}

export interface CalendarEventData {
	id: string;
	title: string;
	description?: string;
	date: string;
	isAllDay: boolean;
	reminders?: number[];
	workspaceId: string;
}

export interface CalendarSyncResult {
	success: boolean;
	calendarEventId?: string;
	error?: string;
}

export interface BatchSyncResults {
	created: { eventId: string; calendarEventId: string }[];
	updated: { eventId: string; calendarEventId: string }[];
	deleted: string[];
	errors: { eventId: string; error: string }[];
}

export interface IGoogleCalendarClientService {
	readonly _serviceBrand: undefined;

	// ---- Configuration ----

	/**
	 * Check if Google Calendar credentials are configured
	 */
	isConfigured(): Promise<boolean>;

	// ---- OAuth Flow ----

	/**
	 * Start Google OAuth flow
	 */
	startAuth(): Promise<GoogleCalendarTokens>;

	/**
	 * Set credentials from stored tokens
	 */
	setCredentials(tokens: GoogleCalendarTokens): Promise<void>;

	/**
	 * Refresh token if needed
	 */
	refreshTokenIfNeeded(): Promise<GoogleCalendarTokens | null>;

	// ---- Calendar Operations ----

	/**
	 * List user's calendars
	 */
	listCalendars(): Promise<{ id: string; summary: string; primary: boolean }[]>;

	/**
	 * Create a calendar event
	 */
	createEvent(event: CalendarEventData, calendarId?: string): Promise<CalendarSyncResult>;

	/**
	 * Update an existing event
	 */
	updateEvent(event: CalendarEventData, calendarEventId: string, calendarId?: string): Promise<CalendarSyncResult>;

	/**
	 * Delete an event
	 */
	deleteEvent(calendarEventId: string, calendarId?: string): Promise<CalendarSyncResult>;

	/**
	 * Find events by workspace
	 */
	findEventsByWorkspace(workspaceId: string, calendarId?: string): Promise<{ id: string; iCalUID: string; summary: string }[]>;

	/**
	 * Batch sync events
	 */
	syncEvents(
		events: {
			create: CalendarEventData[];
			update: { event: CalendarEventData; calendarEventId: string }[];
			delete: string[];
		},
		syncState: Record<string, { calendarEventId: string }>,
		calendarId?: string
	): Promise<BatchSyncResults>;

	// ---- Events ----

	/**
	 * Fired when connection status changes
	 */
	readonly onDidChangeConnectionStatus: Event<boolean>;
}

export const IGoogleCalendarClientService = createDecorator<IGoogleCalendarClientService>('googleCalendarClientService');

class GoogleCalendarClientService extends Disposable implements IGoogleCalendarClientService {
	declare readonly _serviceBrand: undefined;

	private readonly channel: ReturnType<IMainProcessService['getChannel']>;

	private readonly _onDidChangeConnectionStatus = this._register(new Emitter<boolean>());
	readonly onDidChangeConnectionStatus = this._onDidChangeConnectionStatus.event;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService
	) {
		super();
		this.channel = this.mainProcessService.getChannel('void-channel-calendar');
	}

	// ---- Configuration ----

	async isConfigured(): Promise<boolean> {
		return this.channel.call('isConfigured');
	}

	// ---- OAuth Flow ----

	async startAuth(): Promise<GoogleCalendarTokens> {
		const tokens = await this.channel.call<GoogleCalendarTokens>('startGoogleAuth');
		this._onDidChangeConnectionStatus.fire(true);
		return tokens;
	}

	async setCredentials(tokens: GoogleCalendarTokens): Promise<void> {
		await this.channel.call('setGoogleCredentials', { tokens });
		this._onDidChangeConnectionStatus.fire(true);
	}

	async refreshTokenIfNeeded(): Promise<GoogleCalendarTokens | null> {
		return this.channel.call<GoogleCalendarTokens | null>('refreshGoogleToken');
	}

	// ---- Calendar Operations ----

	async listCalendars(): Promise<{ id: string; summary: string; primary: boolean }[]> {
		return this.channel.call('listCalendars');
	}

	async createEvent(event: CalendarEventData, calendarId?: string): Promise<CalendarSyncResult> {
		return this.channel.call('createEvent', { event, calendarId });
	}

	async updateEvent(
		event: CalendarEventData,
		calendarEventId: string,
		calendarId?: string
	): Promise<CalendarSyncResult> {
		return this.channel.call('updateEvent', { event, calendarEventId, calendarId });
	}

	async deleteEvent(calendarEventId: string, calendarId?: string): Promise<CalendarSyncResult> {
		return this.channel.call('deleteEvent', { calendarEventId, calendarId });
	}

	async findEventsByWorkspace(
		workspaceId: string,
		calendarId?: string
	): Promise<{ id: string; iCalUID: string; summary: string }[]> {
		return this.channel.call('findEventsByWorkspace', { workspaceId, calendarId });
	}

	async syncEvents(
		events: {
			create: CalendarEventData[];
			update: { event: CalendarEventData; calendarEventId: string }[];
			delete: string[];
		},
		syncState: Record<string, { calendarEventId: string }>,
		calendarId?: string
	): Promise<BatchSyncResults> {
		return this.channel.call('syncEvents', { events, calendarId, syncState });
	}
}

registerSingleton(IGoogleCalendarClientService, GoogleCalendarClientService, InstantiationType.Delayed);

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
export interface OutlookCalendarTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: string;
	accountId?: string;
}

export interface OutlookEventData {
	id: string;
	title: string;
	description?: string;
	date: string;
	isAllDay: boolean;
	reminders?: number[];
	workspaceId: string;
}

export interface OutlookSyncResult {
	success: boolean;
	calendarEventId?: string;
	error?: string;
}

export interface OutlookBatchSyncResults {
	created: { eventId: string; calendarEventId: string }[];
	updated: { eventId: string; calendarEventId: string }[];
	deleted: string[];
	errors: { eventId: string; error: string }[];
}

export interface IOutlookCalendarClientService {
	readonly _serviceBrand: undefined;

	// ---- Configuration ----

	/**
	 * Check if Outlook Calendar credentials are configured
	 */
	isConfigured(): Promise<boolean>;

	// ---- OAuth Flow ----

	/**
	 * Start Outlook OAuth flow
	 */
	startAuth(): Promise<OutlookCalendarTokens>;

	/**
	 * Set credentials from stored tokens
	 */
	setCredentials(tokens: OutlookCalendarTokens): Promise<void>;

	/**
	 * Refresh token if needed
	 */
	refreshTokenIfNeeded(): Promise<OutlookCalendarTokens | null>;

	/**
	 * Disconnect from Outlook
	 */
	disconnect(): Promise<void>;

	// ---- Calendar Operations ----

	/**
	 * List user's calendars
	 */
	listCalendars(): Promise<{ id: string; name: string; isDefault: boolean }[]>;

	/**
	 * Create a calendar event
	 */
	createEvent(event: OutlookEventData, calendarId?: string): Promise<OutlookSyncResult>;

	/**
	 * Update an existing event
	 */
	updateEvent(event: OutlookEventData, calendarEventId: string, calendarId?: string): Promise<OutlookSyncResult>;

	/**
	 * Delete an event
	 */
	deleteEvent(calendarEventId: string, calendarId?: string): Promise<OutlookSyncResult>;

	/**
	 * Find events by workspace
	 */
	findEventsByWorkspace(workspaceId: string, calendarId?: string): Promise<{ id: string; uid: string; subject: string }[]>;

	/**
	 * Batch sync events
	 */
	syncEvents(
		events: {
			create: OutlookEventData[];
			update: { event: OutlookEventData; calendarEventId: string }[];
			delete: string[];
		},
		calendarId?: string
	): Promise<OutlookBatchSyncResults>;

	// ---- Events ----

	/**
	 * Fired when connection status changes
	 */
	readonly onDidChangeConnectionStatus: Event<boolean>;
}

export const IOutlookCalendarClientService = createDecorator<IOutlookCalendarClientService>('outlookCalendarClientService');

class OutlookCalendarClientService extends Disposable implements IOutlookCalendarClientService {
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
		return this.channel.call('isOutlookConfigured');
	}

	// ---- OAuth Flow ----

	async startAuth(): Promise<OutlookCalendarTokens> {
		const tokens = await this.channel.call<OutlookCalendarTokens>('startOutlookAuth');
		this._onDidChangeConnectionStatus.fire(true);
		return tokens;
	}

	async setCredentials(tokens: OutlookCalendarTokens): Promise<void> {
		await this.channel.call('setOutlookCredentials', { tokens });
		this._onDidChangeConnectionStatus.fire(true);
	}

	async refreshTokenIfNeeded(): Promise<OutlookCalendarTokens | null> {
		return this.channel.call<OutlookCalendarTokens | null>('refreshOutlookToken');
	}

	async disconnect(): Promise<void> {
		await this.channel.call('disconnectOutlook');
		this._onDidChangeConnectionStatus.fire(false);
	}

	// ---- Calendar Operations ----

	async listCalendars(): Promise<{ id: string; name: string; isDefault: boolean }[]> {
		return this.channel.call('listOutlookCalendars');
	}

	async createEvent(event: OutlookEventData, calendarId?: string): Promise<OutlookSyncResult> {
		return this.channel.call('createOutlookEvent', { event, calendarId });
	}

	async updateEvent(
		event: OutlookEventData,
		calendarEventId: string,
		calendarId?: string
	): Promise<OutlookSyncResult> {
		return this.channel.call('updateOutlookEvent', { event, calendarEventId, calendarId });
	}

	async deleteEvent(calendarEventId: string, calendarId?: string): Promise<OutlookSyncResult> {
		return this.channel.call('deleteOutlookEvent', { calendarEventId, calendarId });
	}

	async findEventsByWorkspace(
		workspaceId: string,
		calendarId?: string
	): Promise<{ id: string; uid: string; subject: string }[]> {
		return this.channel.call('findOutlookEventsByWorkspace', { workspaceId, calendarId });
	}

	async syncEvents(
		events: {
			create: OutlookEventData[];
			update: { event: OutlookEventData; calendarEventId: string }[];
			delete: string[];
		},
		calendarId?: string
	): Promise<OutlookBatchSyncResults> {
		return this.channel.call('syncOutlookEvents', { events, calendarId });
	}
}

registerSingleton(IOutlookCalendarClientService, OutlookCalendarClientService, InstantiationType.Delayed);

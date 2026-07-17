/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../../base/common/buffer.js';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import {
	CalendarProvider,
	CalendarSyncSettings,
	CalendarSyncState,
	DEFAULT_SYNC_STATE,
	ICalendarSyncStateService,
	SyncDiff,
	SyncedEventState
} from '../../common/timeline/calendarSyncTypes.js';
import { shouldSyncToCalendar } from '../../common/timeline/icsGenerator.js';
import { ITimelineService } from '../../common/timeline/timelineTypes.js';

const SYNC_STATE_FILENAME = '.calendar-sync.json';

export class CalendarSyncStateService extends Disposable implements ICalendarSyncStateService {
	declare readonly _serviceBrand: undefined;

	private _syncState: CalendarSyncState | null = null;

	private readonly _onDidChangeSyncState = this._register(new Emitter<CalendarSyncState>());
	readonly onDidChangeSyncState: Event<CalendarSyncState> = this._onDidChangeSyncState.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@ITimelineService private readonly timelineService: ITimelineService
	) {
		super();

		// Auto-load sync state when workspace opens
		this.initializeSyncState();
	}

	// ============================================================================
	// Workspace Helpers
	// ============================================================================

	private getWorkspaceFolder(): URI | null {
		const folders = this.contextService.getWorkspace().folders;
		if (folders.length === 0) {
			return null;
		}
		return folders[0].uri;
	}

	private getSyncStateUri(): URI | null {
		const workspaceFolder = this.getWorkspaceFolder();
		if (!workspaceFolder) {
			return null;
		}
		return URI.joinPath(workspaceFolder, SYNC_STATE_FILENAME);
	}

	private getWorkspaceId(): string {
		return this.contextService.getWorkspace().id;
	}

	// ============================================================================
	// State Management
	// ============================================================================

	async loadSyncState(): Promise<CalendarSyncState> {
		const syncStateUri = this.getSyncStateUri();
		if (!syncStateUri) {
			console.log('[CalendarSyncStateService] No workspace folder found');
			return this.createDefaultState();
		}

		try {
			const exists = await this.fileService.exists(syncStateUri);
			if (!exists) {
				console.log('[CalendarSyncStateService] No sync state file found, creating default');
				return this.createDefaultState();
			}

			const content = await this.fileService.readFile(syncStateUri);
			const state = JSON.parse(content.value.toString()) as CalendarSyncState;

			// Verify workspace ID matches
			if (state.workspaceId !== this.getWorkspaceId()) {
				console.warn('[CalendarSyncStateService] Workspace ID mismatch, resetting sync state');
				return this.createDefaultState();
			}

			this._syncState = state;
			console.log('[CalendarSyncStateService] Sync state loaded');
			return this._syncState;
		} catch (error) {
			console.error('[CalendarSyncStateService] Error loading sync state:', error);
			return this.createDefaultState();
		}
	}

	async saveSyncState(state: CalendarSyncState): Promise<void> {
		const syncStateUri = this.getSyncStateUri();
		if (!syncStateUri) {
			throw new Error('No workspace folder available');
		}

		try {
			const content = JSON.stringify(state, null, 2);
			await this.fileService.writeFile(syncStateUri, VSBuffer.fromString(content));
			this._syncState = state;
			console.log('[CalendarSyncStateService] Sync state saved');
			this._onDidChangeSyncState.fire(this._syncState);
		} catch (error) {
			console.error('[CalendarSyncStateService] Error saving sync state:', error);
			throw error;
		}
	}

	getSyncState(): CalendarSyncState | null {
		return this._syncState;
	}

	async initializeSyncState(): Promise<CalendarSyncState> {
		return this.loadSyncState();
	}

	private createDefaultState(): CalendarSyncState {
		const state: CalendarSyncState = {
			...DEFAULT_SYNC_STATE,
			workspaceId: this.getWorkspaceId()
		};
		this._syncState = state;
		return state;
	}

	// ============================================================================
	// Change Detection
	// ============================================================================

	/**
	 * Generate a hash for an event (for change detection)
	 * Uses a simple string hash - fast and sufficient for our needs
	 */
	hashEvent(event: {
		id: string;
		date: string;
		title: string;
		description?: string;
		linkedDocuments?: string[];
		reminderDays?: number[];
	}): string {
		// Create a deterministic string from relevant event properties
		const parts = [
			event.id,
			event.date,
			event.title,
			event.description || '',
			(event.linkedDocuments || []).sort().join(','),
			(event.reminderDays || []).sort((a, b) => a - b).join(',')
		];

		const str = parts.join('|');

		// Simple hash function (djb2)
		let hash = 5381;
		for (let i = 0; i < str.length; i++) {
			hash = ((hash << 5) + hash) + str.charCodeAt(i);
			hash = hash & hash; // Convert to 32-bit integer
		}

		// Convert to hex string
		return Math.abs(hash).toString(16);
	}

	/**
	 * Compare current timeline events to sync state and return diff
	 */
	calculateSyncDiff(): SyncDiff {
		const diff: SyncDiff = {
			toCreate: [],
			toUpdate: [],
			toDelete: [],
			unchanged: []
		};

		if (!this._syncState) {
			return diff;
		}

		const timeline = this.timelineService.getTimeline();
		if (!timeline) {
			return diff;
		}

		// Get events that should be synced
		const eventsToSync = timeline.events.filter(shouldSyncToCalendar);

		// Check each event that should be synced
		for (const event of eventsToSync) {
			const syncedState = this._syncState.syncedEvents[event.id];

			if (!syncedState) {
				// Event not in sync state - needs to be created
				diff.toCreate.push(event.id);
			} else {
				// Check if event has changed
				const currentHash = this.hashEvent(event);
				if (currentHash !== syncedState.lastSyncedHash) {
					diff.toUpdate.push(event.id);
				} else {
					diff.unchanged.push(event.id);
				}
			}
		}

		// Check for events that were synced but are no longer in timeline or no longer should sync
		for (const eventId of Object.keys(this._syncState.syncedEvents)) {
			const event = timeline.events.find(e => e.id === eventId);

			if (!event) {
				// Event was deleted from timeline
				diff.toDelete.push(eventId);
			} else if (!shouldSyncToCalendar(event)) {
				// Event no longer should sync (user turned off syncToCalendar)
				diff.toDelete.push(eventId);
			}
		}

		return diff;
	}

	/**
	 * Check if an event has changed since last sync
	 */
	hasEventChanged(eventId: string): boolean {
		if (!this._syncState) {
			return true;
		}

		const syncedState = this._syncState.syncedEvents[eventId];
		if (!syncedState) {
			return true;
		}

		const timeline = this.timelineService.getTimeline();
		const event = timeline?.events.find(e => e.id === eventId);
		if (!event) {
			return true;
		}

		const currentHash = this.hashEvent(event);
		return currentHash !== syncedState.lastSyncedHash;
	}

	// ============================================================================
	// Sync State Updates
	// ============================================================================

	/**
	 * Mark an event as synced
	 */
	async markEventSynced(eventId: string, calendarEventId: string): Promise<void> {
		if (!this._syncState) {
			await this.initializeSyncState();
		}

		const timeline = this.timelineService.getTimeline();
		const event = timeline?.events.find(e => e.id === eventId);
		if (!event) {
			throw new Error(`Event not found: ${eventId}`);
		}

		const syncedState: SyncedEventState = {
			calendarEventId,
			lastSyncedAt: new Date().toISOString(),
			lastSyncedHash: this.hashEvent(event)
		};

		const updatedState: CalendarSyncState = {
			...this._syncState!,
			lastSync: new Date().toISOString(),
			syncedEvents: {
				...this._syncState!.syncedEvents,
				[eventId]: syncedState
			}
		};

		await this.saveSyncState(updatedState);
		console.log('[CalendarSyncStateService] Event marked as synced:', eventId);
	}

	/**
	 * Mark an event as deleted from calendar
	 */
	async markEventDeleted(eventId: string): Promise<void> {
		if (!this._syncState) {
			return;
		}

		const { [eventId]: removed, ...remainingEvents } = this._syncState.syncedEvents;

		const updatedState: CalendarSyncState = {
			...this._syncState,
			syncedEvents: remainingEvents
		};

		await this.saveSyncState(updatedState);
		console.log('[CalendarSyncStateService] Event marked as deleted:', eventId);
	}

	/**
	 * Update sync settings
	 */
	async updateSettings(settings: Partial<CalendarSyncSettings>): Promise<void> {
		if (!this._syncState) {
			await this.initializeSyncState();
		}

		const updatedState: CalendarSyncState = {
			...this._syncState!,
			settings: {
				...this._syncState!.settings,
				...settings
			}
		};

		await this.saveSyncState(updatedState);
		console.log('[CalendarSyncStateService] Settings updated:', settings);
	}

	/**
	 * Set the connected provider
	 */
	async setProvider(
		provider: CalendarProvider | null,
		tokens?: CalendarSyncState['tokens']
	): Promise<void> {
		if (!this._syncState) {
			await this.initializeSyncState();
		}

		const updatedState: CalendarSyncState = {
			...this._syncState!,
			provider,
			connected: provider !== null,
			tokens: tokens || undefined
		};

		await this.saveSyncState(updatedState);
		console.log('[CalendarSyncStateService] Provider set:', provider);
	}

	/**
	 * Clear all sync state (disconnect)
	 */
	async clearSyncState(): Promise<void> {
		const freshState = this.createDefaultState();
		await this.saveSyncState(freshState);
		console.log('[CalendarSyncStateService] Sync state cleared');
	}
}

registerSingleton(ICalendarSyncStateService, CalendarSyncStateService, InstantiationType.Delayed);

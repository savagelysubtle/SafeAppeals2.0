/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Event } from '../../../../../base/common/event.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

// ============================================================================
// Calendar Provider Types
// ============================================================================

export type CalendarProvider = 'google' | 'outlook' | 'ics-export';

// ============================================================================
// Synced Event State
// ============================================================================

/**
 * Tracks the sync state of a single event
 */
export interface SyncedEventState {
	/** The calendar event ID (includes workspace ID for uniqueness) */
	calendarEventId: string;
	/** When this event was last synced */
	lastSyncedAt: string;  // ISO 8601
	/** Hash of event data at last sync (for change detection) */
	lastSyncedHash: string;
}

// ============================================================================
// Calendar Sync State (Per-Workspace)
// ============================================================================

/**
 * The full sync state for a workspace, stored in .calendar-sync.json
 */
export interface CalendarSyncState {
	/** Version for future schema migrations */
	version: '1.0';
	/** The workspace ID this sync state belongs to */
	workspaceId: string;
	/** Which calendar provider is connected (if any) */
	provider: CalendarProvider | null;
	/** Whether actively connected to a calendar */
	connected: boolean;
	/** Last successful sync timestamp */
	lastSync: string | null;  // ISO 8601
	/** OAuth tokens (for Google/Outlook) */
	tokens?: {
		accessToken: string;
		refreshToken: string;
		expiresAt: string;  // ISO 8601
	};
	/** Sync settings */
	settings: CalendarSyncSettings;
	/** Map of event ID -> sync state */
	syncedEvents: Record<string, SyncedEventState>;
}

/**
 * User-configurable sync settings
 */
export interface CalendarSyncSettings {
	/** Auto-sync when timeline changes */
	autoSync: boolean;
	/** Which calendar to sync to (e.g., 'primary' for Google) */
	calendarId: string;
	/** Prefix for event titles (from case name) */
	eventPrefix: string;
	/** Include linked document names in event description */
	includeLinkedDocs: boolean;
	/** Default reminder minutes before event */
	reminderMinutes: number;
}

/**
 * Default sync settings
 */
export const DEFAULT_SYNC_SETTINGS: CalendarSyncSettings = {
	autoSync: false,
	calendarId: 'primary',
	eventPrefix: '',
	includeLinkedDocs: true,
	reminderMinutes: 60
};

/**
 * Default sync state for a new workspace
 */
export const DEFAULT_SYNC_STATE: CalendarSyncState = {
	version: '1.0',
	workspaceId: '',
	provider: null,
	connected: false,
	lastSync: null,
	settings: DEFAULT_SYNC_SETTINGS,
	syncedEvents: {}
};

// ============================================================================
// Change Detection Types
// ============================================================================

/**
 * Represents a pending sync operation
 */
export interface SyncOperation {
	type: 'create' | 'update' | 'delete';
	eventId: string;
	calendarEventId?: string;  // For update/delete
}

/**
 * Result of comparing local events to sync state
 */
export interface SyncDiff {
	toCreate: string[];   // Event IDs to create in calendar
	toUpdate: string[];   // Event IDs to update in calendar
	toDelete: string[];   // Event IDs to delete from calendar
	unchanged: string[];  // Event IDs with no changes
}

// ============================================================================
// Service Interface
// ============================================================================

export interface ICalendarSyncStateService {
	readonly _serviceBrand: undefined;

	// ---- State Management ----

	/**
	 * Load sync state from workspace storage
	 */
	loadSyncState(): Promise<CalendarSyncState>;

	/**
	 * Save sync state to workspace storage
	 */
	saveSyncState(state: CalendarSyncState): Promise<void>;

	/**
	 * Get the current sync state (cached)
	 */
	getSyncState(): CalendarSyncState | null;

	/**
	 * Initialize sync state for current workspace
	 */
	initializeSyncState(): Promise<CalendarSyncState>;

	// ---- Change Detection ----

	/**
	 * Generate a hash for an event (for change detection)
	 */
	hashEvent(event: { id: string; date: string; title: string; description?: string; linkedDocuments?: string[]; reminderDays?: number[] }): string;

	/**
	 * Compare current timeline events to sync state and return diff
	 */
	calculateSyncDiff(): SyncDiff;

	/**
	 * Check if an event has changed since last sync
	 */
	hasEventChanged(eventId: string): boolean;

	// ---- Sync State Updates ----

	/**
	 * Mark an event as synced
	 */
	markEventSynced(eventId: string, calendarEventId: string): Promise<void>;

	/**
	 * Mark an event as deleted from calendar
	 */
	markEventDeleted(eventId: string): Promise<void>;

	/**
	 * Update sync settings
	 */
	updateSettings(settings: Partial<CalendarSyncSettings>): Promise<void>;

	/**
	 * Set the connected provider
	 */
	setProvider(provider: CalendarProvider | null, tokens?: CalendarSyncState['tokens']): Promise<void>;

	/**
	 * Clear all sync state (disconnect)
	 */
	clearSyncState(): Promise<void>;

	// ---- Events ----

	/**
	 * Fired when sync state changes
	 */
	readonly onDidChangeSyncState: Event<CalendarSyncState>;
}

export const ICalendarSyncStateService = createDecorator<ICalendarSyncStateService>('calendarSyncStateService');

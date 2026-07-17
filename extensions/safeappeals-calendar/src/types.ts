/*--------------------------------------------------------------------------------------
 *  Safe Appeals Calendar — shared types (compatible with calendarSyncTypes shapes)
 *--------------------------------------------------------------------------------------*/

export type CalendarProvider = 'google' | 'outlook';

export interface OAuthTokens {
	accessToken: string;
	refreshToken: string;
	expiresAt: string; // ISO 8601
	/** MSAL/home account id when available (Outlook) */
	accountId?: string;
}

export interface SyncedEventState {
	calendarEventId: string;
	lastSyncedAt: string;
	lastSyncedHash: string;
}

export interface CalendarSyncSettings {
	autoSync: boolean;
	calendarId: string;
	eventPrefix: string;
	includeLinkedDocs: boolean;
	reminderMinutes: number;
}

export const DEFAULT_SYNC_SETTINGS: CalendarSyncSettings = {
	autoSync: true,
	calendarId: 'primary',
	eventPrefix: '',
	includeLinkedDocs: true,
	reminderMinutes: 60,
};

/**
 * Per-provider connection/sync metadata (tokens live in SecretStorage, not here).
 */
export interface ProviderSyncMeta {
	provider: CalendarProvider;
	connected: boolean;
	lastSync: string | null;
	/** Google incremental sync token when available */
	syncToken?: string;
	settings: CalendarSyncSettings;
	syncedEvents: Record<string, SyncedEventState>;
}

export interface CalendarSyncState {
	version: '1.0';
	providers: {
		google?: ProviderSyncMeta;
		outlook?: ProviderSyncMeta;
	};
}

export const DEFAULT_SYNC_STATE: CalendarSyncState = {
	version: '1.0',
	providers: {},
};

export interface CalendarEvent {
	id: string;
	provider: CalendarProvider;
	calendarId: string;
	title: string;
	description?: string;
	/** ISO 8601 start */
	date: string;
	endDate?: string;
	isAllDay: boolean;
	reminders?: number[];
	/** Provider-native iCalUID / extended UID when present */
	iCalUID?: string;
	etag?: string;
	updatedAt?: string;
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

export interface GetEventsQuery {
	/** ISO 8601 range start (inclusive) */
	start: string;
	/** ISO 8601 range end (exclusive) */
	end: string;
	provider?: CalendarProvider | 'all';
}

export interface CalendarStatus {
	google: {
		configured: boolean;
		connected: boolean;
		lastSync: string | null;
		calendarId: string;
		cachedEventCount: number;
	};
	outlook: {
		configured: boolean;
		connected: boolean;
		lastSync: string | null;
		calendarId: string;
		cachedEventCount: number;
	};
	syncIntervalMinutes: number;
	lastBackgroundSync: string | null;
}

export interface SyncNowResult {
	success: boolean;
	providers: CalendarProvider[];
	fetched: number;
	errors: { provider: CalendarProvider; error: string }[];
	lastSync: string;
}

export function hashEvent(event: {
	id: string;
	date: string;
	title: string;
	description?: string;
	linkedDocuments?: string[];
	reminderDays?: number[];
}): string {
	const parts = [
		event.id,
		event.date,
		event.title,
		event.description || '',
		(event.linkedDocuments || []).sort().join(','),
		(event.reminderDays || []).sort((a, b) => a - b).join(','),
	];
	const str = parts.join('|');
	let hash = 5381;
	for (let i = 0; i < str.length; i++) {
		hash = ((hash << 5) + hash) + str.charCodeAt(i);
		hash = hash & hash;
	}
	return Math.abs(hash).toString(16);
}

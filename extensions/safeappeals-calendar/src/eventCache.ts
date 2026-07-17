/*--------------------------------------------------------------------------------------
 *  Cached calendar events — context.globalStorageUri JSON (old fork had no event cache)
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import {
	CalendarEvent,
	CalendarSyncState,
	DEFAULT_SYNC_SETTINGS,
	DEFAULT_SYNC_STATE,
	ProviderSyncMeta,
	CalendarProvider,
} from './types';

const EVENTS_FILE = 'events-cache.json';
const META_FILE = 'sync-meta.json';

interface EventsCacheFile {
	version: '1.0';
	events: CalendarEvent[];
	updatedAt: string | null;
}

export class EventCache {
	private events: CalendarEvent[] = [];
	private meta: CalendarSyncState = { ...DEFAULT_SYNC_STATE, providers: {} };
	private lastBackgroundSync: string | null = null;

	constructor(private readonly storageUri: vscode.Uri) {}

	async initialize(): Promise<void> {
		await fs.mkdir(this.storageUri.fsPath, { recursive: true });
		await this.load();
	}

	getLastBackgroundSync(): string | null {
		return this.lastBackgroundSync;
	}

	setLastBackgroundSync(iso: string): void {
		this.lastBackgroundSync = iso;
	}

	getMeta(): CalendarSyncState {
		return this.meta;
	}

	getProviderMeta(provider: CalendarProvider): ProviderSyncMeta | undefined {
		return this.meta.providers[provider];
	}

	async ensureProviderMeta(provider: CalendarProvider, calendarId: string): Promise<ProviderSyncMeta> {
		const existing = this.meta.providers[provider];
		if (existing) {
			return existing;
		}
		const created: ProviderSyncMeta = {
			provider,
			connected: false,
			lastSync: null,
			settings: { ...DEFAULT_SYNC_SETTINGS, calendarId },
			syncedEvents: {},
		};
		this.meta.providers[provider] = created;
		await this.saveMeta();
		return created;
	}

	async setConnected(provider: CalendarProvider, connected: boolean, calendarId: string): Promise<void> {
		const meta = await this.ensureProviderMeta(provider, calendarId);
		meta.connected = connected;
		meta.settings.calendarId = calendarId;
		if (!connected) {
			meta.lastSync = null;
			meta.syncToken = undefined;
			meta.syncedEvents = {};
		}
		await this.saveMeta();
	}

	async setSyncToken(provider: CalendarProvider, syncToken: string | undefined): Promise<void> {
		const meta = this.meta.providers[provider];
		if (!meta) {
			return;
		}
		meta.syncToken = syncToken;
		await this.saveMeta();
	}

	async markSynced(provider: CalendarProvider): Promise<void> {
		const meta = this.meta.providers[provider];
		if (!meta) {
			return;
		}
		meta.lastSync = new Date().toISOString();
		meta.connected = true;
		await this.saveMeta();
	}

	getAllEvents(): CalendarEvent[] {
		return [...this.events];
	}

	getEventsInRange(start: string, end: string, provider?: CalendarProvider | 'all'): CalendarEvent[] {
		const startMs = Date.parse(start);
		const endMs = Date.parse(end);
		return this.events.filter((e) => {
			if (provider && provider !== 'all' && e.provider !== provider) {
				return false;
			}
			const t = Date.parse(e.date);
			if (Number.isNaN(t)) {
				return false;
			}
			return t >= startMs && t < endMs;
		});
	}

	countForProvider(provider: CalendarProvider): number {
		return this.events.filter((e) => e.provider === provider).length;
	}

	/**
	 * Replace cached events for a provider (dedupe by id within provider).
	 */
	async replaceProviderEvents(provider: CalendarProvider, events: CalendarEvent[]): Promise<void> {
		const others = this.events.filter((e) => e.provider !== provider);
		const seen = new Set<string>();
		const deduped: CalendarEvent[] = [];
		for (const e of events) {
			const key = `${e.provider}:${e.id}`;
			if (seen.has(key)) {
				continue;
			}
			seen.add(key);
			deduped.push(e);
		}
		this.events = [...others, ...deduped];
		await this.saveEvents();
		await this.markSynced(provider);
	}

	async clearProvider(provider: CalendarProvider): Promise<void> {
		this.events = this.events.filter((e) => e.provider !== provider);
		delete this.meta.providers[provider];
		await this.saveEvents();
		await this.saveMeta();
	}

	private eventsPath(): string {
		return path.join(this.storageUri.fsPath, EVENTS_FILE);
	}

	private metaPath(): string {
		return path.join(this.storageUri.fsPath, META_FILE);
	}

	private async load(): Promise<void> {
		try {
			const raw = await fs.readFile(this.eventsPath(), 'utf8');
			const parsed = JSON.parse(raw) as EventsCacheFile;
			this.events = parsed.events || [];
			this.lastBackgroundSync = parsed.updatedAt;
		} catch {
			this.events = [];
		}
		try {
			const raw = await fs.readFile(this.metaPath(), 'utf8');
			this.meta = JSON.parse(raw) as CalendarSyncState;
			if (!this.meta.providers) {
				this.meta.providers = {};
			}
		} catch {
			this.meta = { ...DEFAULT_SYNC_STATE, providers: {} };
		}
	}

	private async saveEvents(): Promise<void> {
		const payload: EventsCacheFile = {
			version: '1.0',
			events: this.events,
			updatedAt: new Date().toISOString(),
		};
		this.lastBackgroundSync = payload.updatedAt;
		await fs.writeFile(this.eventsPath(), JSON.stringify(payload, null, 2), 'utf8');
	}

	private async saveMeta(): Promise<void> {
		await fs.writeFile(this.metaPath(), JSON.stringify(this.meta, null, 2), 'utf8');
	}
}

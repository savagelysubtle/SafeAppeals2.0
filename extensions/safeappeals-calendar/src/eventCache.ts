/*--------------------------------------------------------------------------------------
 *  Cached calendar events — encrypted JSON under context.globalStorageUri
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import {
	acquireDek,
	createMementoDekDurabilityMarker,
	type DekDurabilityMarker,
	loadJson,
	writeEncryptedJson,
} from './shared/encryptedStore';
import { deleteFileIfExists, ensureDir } from './shared/secureFs';
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
const DEK_KEY_ID = 'safeappeals-calendar.dek.eventCache';

interface EventsCacheFile {
	version: '1.0';
	events: CalendarEvent[];
	updatedAt: string | null;
}

export class EventCache {
	private events: CalendarEvent[] = [];
	private meta: CalendarSyncState = { ...DEFAULT_SYNC_STATE, providers: {} };
	private lastBackgroundSync: string | null = null;
	private dek: Buffer | undefined;
	private mode: 'encrypted' | 'memory' = 'memory';
	private hasWarnedUnavailable = false;
	private readonly marker: DekDurabilityMarker;

	constructor(
		private readonly storageUri: vscode.Uri,
		private readonly secrets: vscode.SecretStorage,
		globalState: vscode.Memento,
		private readonly log?: (msg: string) => void,
	) {
		this.marker = createMementoDekDurabilityMarker(globalState, DEK_KEY_ID);
	}

	async initialize(): Promise<void> {
		try {
			await ensureDir(this.storageUri.fsPath);
			await this.acquireEncryptionKey();
			if (this.mode === 'encrypted') {
				await this.load();
			}
		} catch (error) {
			this.mode = 'memory';
			this.dek = undefined;
			this.log?.(`EventCache.initialize failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	/**
	 * Delete on-disk cache files, reset in-memory state, and mint a fresh DEK.
	 * Connected accounts are not touched: their service connections are restored
	 * so the next sync refills the cache instead of asking the user to reconnect.
	 */
	async clearLocalCache(): Promise<void> {
		const connections = Object.values(this.meta.providers)
			.filter((meta): meta is ProviderSyncMeta => !!meta?.connectionId)
			.map((meta) => ({
				provider: meta.provider,
				connectionId: meta.connectionId!,
				calendarId: meta.settings.calendarId,
			}));

		await this.deleteCacheFiles();
		this.events = [];
		this.meta = { ...DEFAULT_SYNC_STATE, providers: {} };
		this.lastBackgroundSync = null;
		this.dek = undefined;
		this.mode = 'memory';
		this.hasWarnedUnavailable = false;
		try {
			await this.secrets.delete(DEK_KEY_ID);
		} catch (error) {
			this.log?.(`Failed to delete DEK ${DEK_KEY_ID}: ${error instanceof Error ? error.message : String(error)}`);
		}
		try {
			await this.marker.setStored(false);
		} catch (error) {
			this.log?.(
				`Failed to clear durability marker for ${DEK_KEY_ID}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		await this.acquireEncryptionKey();
		for (const connection of connections) {
			await this.setConnection(connection.provider, connection.connectionId, connection.calendarId);
		}
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

	/** Service connection a provider syncs against, when it is connected. */
	getConnectionId(provider: CalendarProvider): string | undefined {
		return this.meta.providers[provider]?.connectionId;
	}

	/**
	 * Binds a provider to a service connection. A different connection replaces
	 * the previous one, so its sync token and synced-event map are dropped.
	 */
	async setConnection(
		provider: CalendarProvider,
		connectionId: string,
		calendarId: string,
	): Promise<void> {
		const meta = await this.ensureProviderMeta(provider, calendarId);
		if (meta.connectionId && meta.connectionId !== connectionId) {
			meta.lastSync = null;
			meta.syncToken = undefined;
			meta.syncedEvents = {};
		}
		meta.connectionId = connectionId;
		meta.connected = true;
		meta.settings.calendarId = calendarId;
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

	private async acquireEncryptionKey(): Promise<void> {
		const result = await acquireDek({
			secrets: this.secrets,
			keyId: DEK_KEY_ID,
			existingDataPaths: [this.eventsPath(), this.metaPath()],
			log: this.log,
			marker: this.marker,
		});
		if (result.kind === 'ok') {
			this.dek = result.dek;
			this.mode = 'encrypted';
			return;
		}

		this.dek = undefined;
		this.mode = 'memory';
		this.log?.(`EventCache encryption unavailable (${result.reason})`);
		if (!this.hasWarnedUnavailable) {
			this.hasWarnedUnavailable = true;
			const keyUnusable =
				result.reason === 'key-lost-with-data' || result.reason === 'secret-storage-not-durable';
			const message = keyUnusable
				? 'Safe Appeals Calendar: the local calendar cache cannot be decrypted — run "Clear Local Calendar Cache" to reset it.'
				: 'Safe Appeals Calendar: calendar events will not be cached on disk because secure storage is unavailable.';
			void vscode.window.showWarningMessage(message);
		}
	}

	private async deleteCacheFiles(): Promise<void> {
		await deleteFileIfExists(this.eventsPath());
		await deleteFileIfExists(this.metaPath());
		try {
			const entries = await fs.readdir(this.storageUri.fsPath);
			for (const name of entries) {
				if (name.startsWith(`${EVENTS_FILE}.corrupt-`) || name.startsWith(`${META_FILE}.corrupt-`)) {
					await deleteFileIfExists(path.join(this.storageUri.fsPath, name));
				}
			}
		} catch (error) {
			this.log?.(`deleteCacheFiles readdir failed: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	private async load(): Promise<void> {
		if (this.mode !== 'encrypted' || !this.dek) {
			return;
		}

		const eventsFile = await loadJson<EventsCacheFile>(this.eventsPath(), this.dek, this.log);
		if (eventsFile.value) {
			this.events = eventsFile.value.events || [];
			this.lastBackgroundSync = eventsFile.value.updatedAt;
		} else {
			this.events = [];
		}

		const metaFile = await loadJson<CalendarSyncState>(this.metaPath(), this.dek, this.log);
		if (metaFile.value) {
			this.meta = metaFile.value;
			if (!this.meta.providers) {
				this.meta.providers = {};
			}
		} else {
			this.meta = { ...DEFAULT_SYNC_STATE, providers: {} };
		}
	}

	private async persist(filePath: string, payload: unknown): Promise<void> {
		if (this.mode !== 'encrypted' || !this.dek) {
			return;
		}
		await writeEncryptedJson(filePath, payload, this.dek);
	}

	private async saveEvents(): Promise<void> {
		const payload: EventsCacheFile = {
			version: '1.0',
			events: this.events,
			updatedAt: new Date().toISOString(),
		};
		this.lastBackgroundSync = payload.updatedAt;
		await this.persist(this.eventsPath(), payload);
	}

	private async saveMeta(): Promise<void> {
		await this.persist(this.metaPath(), this.meta);
	}
}

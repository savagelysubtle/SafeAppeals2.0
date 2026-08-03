/*--------------------------------------------------------------------------------------
 *  Background + manual sync — pull provider events into local cache
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	CalendarTokenSource,
	connectCalendarAccount,
	defaultCalendarSessionGetter,
	type CalendarSessionGetter,
} from './calendarAuth';
import {
	getEnabledProviders,
	getGoogleCalendarId,
	getOutlookCalendarId,
	getSyncIntervalMinutes,
} from './config';
import type { CalendarConnectionInfo, CalendarConnectionsBridge } from './connectionsBridge';
import { EventCache } from './eventCache';
import { GoogleCalendarClient, SyncTokenInvalidError } from './googleCalendarClient';
import { OutlookCalendarClient } from './outlookCalendarClient';
import type {
	CalendarProvider,
	CalendarStatus,
	GetEventsQuery,
	SyncNowResult,
} from './types';

/** Default pull window: 90 days back, 365 days forward */
const LOOKBACK_MS = 90 * 24 * 60 * 60 * 1000;
const LOOKAHEAD_MS = 365 * 24 * 60 * 60 * 1000;

/** Outcome of disconnecting: the grant is only gone when the server revoked it. */
export interface DisconnectResult {
	revoked: boolean;
	error?: string;
}

export class SyncEngine implements vscode.Disposable {
	private readonly google: GoogleCalendarClient;
	private readonly outlook: OutlookCalendarClient;
	private readonly getSession: CalendarSessionGetter;
	private timer: NodeJS.Timeout | undefined;
	private syncing = false;

	constructor(
		private readonly connections: CalendarConnectionsBridge,
		private readonly cache: EventCache,
		private readonly log: (msg: string) => void,
		private readonly onStatusChange: () => void,
		getSession: CalendarSessionGetter = defaultCalendarSessionGetter,
	) {
		this.getSession = getSession;
		const tokens = new CalendarTokenSource({
			connectionIdFor: (provider) => this.cache.getConnectionId(provider),
			getSession,
			log,
		});
		this.google = new GoogleCalendarClient(tokens);
		this.outlook = new OutlookCalendarClient(tokens);
	}

	startBackgroundSync(): void {
		this.stopBackgroundSync();
		const minutes = getSyncIntervalMinutes();
		this.log(`Background sync every ${minutes} minute(s)`);
		this.timer = setInterval(() => {
			void this.syncNow().catch((err) => {
				this.log(`Background sync error: ${err instanceof Error ? err.message : String(err)}`);
			});
		}, minutes * 60 * 1000);

		// Kick off once shortly after activation
		setTimeout(() => {
			void this.syncNow().catch((err) => {
				this.log(`Initial sync error: ${err instanceof Error ? err.message : String(err)}`);
			});
		}, 2000);
	}

	stopBackgroundSync(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	dispose(): void {
		this.stopBackgroundSync();
	}

	/** True when a service connection is stored for the provider. */
	isConnected(provider: CalendarProvider): boolean {
		return !!this.cache.getConnectionId(provider);
	}

	/**
	 * Connects a calendar through SafeAppeals service connections, stores the
	 * connection it syncs against, and pulls a first batch of events.
	 */
	async connect(provider: CalendarProvider): Promise<CalendarConnectionInfo> {
		const connection = await connectCalendarAccount(provider, {
			connect: (target, loginHint) => this.connections.connect(target, loginHint),
			getSession: this.getSession,
			log: this.log,
		});
		await this.cache.setConnection(provider, connection.id, calendarIdFor(provider));
		this.log(`${provider} calendar connected (connection ${connection.id})`);
		this.onStatusChange();
		await this.syncProvider(provider);
		this.onStatusChange();
		return connection;
	}

	/**
	 * Revokes the provider's connection and drops its cached events. Local state
	 * is cleared even when the server call fails, so a revoked or unknown grant
	 * cannot strand the provider — the caller reports what actually happened.
	 */
	async disconnect(provider: CalendarProvider): Promise<DisconnectResult> {
		const connectionId = this.cache.getConnectionId(provider);
		let result: DisconnectResult = { revoked: !!connectionId };
		if (connectionId) {
			try {
				await this.connections.disconnect(connectionId);
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				this.log(`Revoking ${provider} connection ${connectionId} failed: ${message}`);
				result = { revoked: false, error: message };
			}
		}
		await this.cache.clearProvider(provider);
		this.onStatusChange();
		return result;
	}

	async syncNow(providers?: CalendarProvider[]): Promise<SyncNowResult> {
		if (this.syncing) {
			return {
				success: false,
				providers: [],
				fetched: 0,
				errors: [],
				lastSync: new Date().toISOString(),
			};
		}

		this.syncing = true;
		const targets = providers?.length ? providers : this.connectedEnabledProviders();

		const errors: { provider: CalendarProvider; error: string }[] = [];
		let fetched = 0;

		try {
			for (const provider of targets) {
				try {
					fetched += await this.syncProvider(provider);
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					errors.push({ provider, error: message });
					this.log(`Sync failed for ${provider}: ${message}`);
				}
			}

			const lastSync = new Date().toISOString();
			this.cache.setLastBackgroundSync(lastSync);
			this.onStatusChange();

			return {
				success: errors.length === 0,
				providers: targets,
				fetched,
				errors,
				lastSync,
			};
		} finally {
			this.syncing = false;
		}
	}

	async getEvents(query: GetEventsQuery) {
		const provider = query.provider || 'all';
		// Prefer cache; if empty for a connected provider, sync first
		const cached = this.cache.getEventsInRange(query.start, query.end, provider);
		if (cached.length > 0) {
			return cached;
		}

		const toSync: CalendarProvider[] =
			provider === 'all' ? this.connectedEnabledProviders() : [provider];

		if (toSync.length > 0) {
			await this.syncNow(toSync);
		}

		return this.cache.getEventsInRange(query.start, query.end, provider);
	}

	async getStatus(): Promise<CalendarStatus> {
		const enabled = getEnabledProviders();
		const googleMeta = this.cache.getProviderMeta('google');
		const outlookMeta = this.cache.getProviderMeta('outlook');

		return {
			google: {
				enabled: enabled.includes('google'),
				connected: this.isConnected('google'),
				lastSync: googleMeta?.lastSync ?? null,
				calendarId: getGoogleCalendarId(),
				cachedEventCount: this.cache.countForProvider('google'),
			},
			outlook: {
				enabled: enabled.includes('outlook'),
				connected: this.isConnected('outlook'),
				lastSync: outlookMeta?.lastSync ?? null,
				calendarId: getOutlookCalendarId(),
				cachedEventCount: this.cache.countForProvider('outlook'),
			},
			syncIntervalMinutes: getSyncIntervalMinutes(),
			lastBackgroundSync: this.cache.getLastBackgroundSync(),
		};
	}

	private connectedEnabledProviders(): CalendarProvider[] {
		return getEnabledProviders().filter((provider) => this.isConnected(provider));
	}

	private async syncProvider(provider: CalendarProvider): Promise<number> {
		if (!this.isConnected(provider)) {
			this.log(`Skip sync — ${provider} not connected`);
			return 0;
		}

		const now = Date.now();
		const timeMin = new Date(now - LOOKBACK_MS).toISOString();
		const timeMax = new Date(now + LOOKAHEAD_MS).toISOString();

		if (provider === 'google') {
			return this.syncGoogle(timeMin, timeMax);
		}
		return this.syncOutlook(timeMin, timeMax);
	}

	private async syncGoogle(timeMin: string, timeMax: string): Promise<number> {
		await this.cache.ensureProviderMeta('google', getGoogleCalendarId());
		const meta = this.cache.getProviderMeta('google');
		let events;
		let nextSyncToken: string | undefined;

		try {
			const result = await this.google.listEvents({
				timeMin,
				timeMax,
				syncToken: meta?.syncToken,
			});
			events = result.events;
			nextSyncToken = result.nextSyncToken;

			// Incremental sync returns only changes — merge with existing cache
			if (meta?.syncToken) {
				const byId = new Map(
					this.cache.getAllEvents()
						.filter((e) => e.provider === 'google')
						.map((e) => [e.id, e])
				);
				for (const id of result.deletedIds) {
					byId.delete(id);
				}
				for (const e of events) {
					byId.set(e.id, e);
				}
				events = [...byId.values()];
			}
		} catch (err) {
			if (err instanceof SyncTokenInvalidError) {
				this.log('Google sync token invalidated — full sync');
				await this.cache.setSyncToken('google', undefined);
				const result = await this.google.listEvents({ timeMin, timeMax });
				events = result.events;
				nextSyncToken = result.nextSyncToken;
			} else {
				throw err;
			}
		}

		await this.cache.replaceProviderEvents('google', events);
		if (nextSyncToken) {
			await this.cache.setSyncToken('google', nextSyncToken);
		}
		this.log(`Google sync: ${events.length} event(s)`);
		return events.length;
	}

	private async syncOutlook(timeMin: string, timeMax: string): Promise<number> {
		await this.cache.ensureProviderMeta('outlook', getOutlookCalendarId());
		const events = await this.outlook.listEvents(timeMin, timeMax);
		await this.cache.replaceProviderEvents('outlook', events);
		this.log(`Outlook sync: ${events.length} event(s)`);
		return events.length;
	}
}

function calendarIdFor(provider: CalendarProvider): string {
	return provider === 'google' ? getGoogleCalendarId() : getOutlookCalendarId();
}

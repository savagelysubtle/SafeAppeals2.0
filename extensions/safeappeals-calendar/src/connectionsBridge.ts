/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*--------------------------------------------------------------------------------------
 *  Service connections (A1) consumed from the calendar extension
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { CalendarProvider } from './types';

/** Extension that owns SafeAppeals service connections. */
const AUTH_EXTENSION_ID = 'safeappeals.safeappeals-authentication';

/** Command fallbacks for hosts where the exported API is unavailable. */
const CONNECT_COMMAND_ID = 'safeappeals.connections.connect';
const LIST_COMMAND_ID = 'safeappeals.connections.list';
const DISCONNECT_COMMAND_ID = 'safeappeals.connections.disconnect';

/** Only calendar grants are of interest here; mailboxes belong to the email extension. */
const CALENDAR_CAPABILITIES = ['calendar'];

/** Provider id used by service connections — Outlook grants are Microsoft grants. */
export type ConnectionProviderKind = 'google' | 'microsoft';

interface ConnectRequest {
	provider: ConnectionProviderKind;
	capabilities: string[];
	loginHint?: string;
}

interface ListRequest {
	provider?: ConnectionProviderKind;
	capability?: string;
}

/** Shape of `safeappeals-authentication`'s exported `connections` façade. */
interface ConnectionsExports {
	connect(options: ConnectRequest): Promise<unknown>;
	list(filter?: ListRequest): Promise<unknown>;
	disconnect(connectionId: string): Promise<void>;
}

/**
 * Connection metadata as this extension consumes it. Structurally a subset of
 * `ConnectionInfo` in safeappeals-authentication, which crosses the extension-host
 * boundary as plain JSON (so it is re-validated here rather than imported).
 */
export interface CalendarConnectionInfo {
	readonly id: string;
	readonly provider: CalendarProvider;
	readonly accountEmail?: string | null;
	readonly accountLabel?: string | null;
	readonly providerAccountId?: string | null;
	readonly capabilities?: readonly string[];
	readonly status?: string;
}

/**
 * Calendar-shaped view of the service-connection surface: connect a calendar,
 * list the ones already connected, and revoke one.
 */
export interface CalendarConnectionsBridge {
	connect(provider: CalendarProvider, loginHint?: string): Promise<CalendarConnectionInfo>;
	list(provider: CalendarProvider): Promise<CalendarConnectionInfo[]>;
	disconnect(connectionId: string): Promise<void>;
}

/** Service-connection provider id behind a calendar provider. */
export function connectionProviderFor(provider: CalendarProvider): ConnectionProviderKind {
	return provider === 'outlook' ? 'microsoft' : 'google';
}

/** Calendar provider behind a service-connection provider id. */
export function calendarProviderFor(kind: unknown): CalendarProvider | undefined {
	if (kind === 'google') {
		return 'google';
	}
	return kind === 'microsoft' ? 'outlook' : undefined;
}

/**
 * Validates one connection record handed over by safeappeals-authentication.
 * Returns undefined for anything that is not a usable calendar connection.
 */
export function toCalendarConnectionInfo(raw: unknown): CalendarConnectionInfo | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	const record = raw as Record<string, unknown>;
	const id = typeof record.id === 'string' ? record.id.trim() : '';
	const provider = calendarProviderFor(record.provider);
	if (!id || !provider) {
		return undefined;
	}
	return {
		id,
		provider,
		accountEmail: typeof record.accountEmail === 'string' ? record.accountEmail : null,
		accountLabel: typeof record.accountLabel === 'string' ? record.accountLabel : null,
		providerAccountId:
			typeof record.providerAccountId === 'string' ? record.providerAccountId : null,
		capabilities: Array.isArray(record.capabilities)
			? record.capabilities.filter((entry): entry is string => typeof entry === 'string')
			: [],
		status: typeof record.status === 'string' ? record.status : undefined,
	};
}

/** True when a connection can still serve calendar tokens. */
export function connectionServesCalendar(connection: CalendarConnectionInfo): boolean {
	return connection.status !== 'revoked' && (connection.capabilities ?? []).includes('calendar');
}

/** Human-readable name for a connected calendar account. */
export function connectionAccountLabel(connection: CalendarConnectionInfo): string {
	return connection.accountEmail || connection.accountLabel || connection.id;
}

/**
 * Bridge to safeappeals-authentication, preferring its exported API and falling
 * back to the equivalent commands.
 */
export function createCalendarConnectionsBridge(): CalendarConnectionsBridge {
	return {
		async connect(provider, loginHint) {
			const request: ConnectRequest = {
				provider: connectionProviderFor(provider),
				capabilities: [...CALENDAR_CAPABILITIES],
				...(loginHint ? { loginHint } : {}),
			};
			const api = await connectionsApi();
			const raw = api
				? await api.connect(request)
				: await vscode.commands.executeCommand<unknown>(CONNECT_COMMAND_ID, request);
			const connection = toCalendarConnectionInfo(raw);
			if (!connection) {
				throw new Error(
					vscode.l10n.t('Safe Appeals did not return a connected calendar. Please try again.'),
				);
			}
			return connection;
		},

		async list(provider) {
			const request: ListRequest = {
				provider: connectionProviderFor(provider),
				capability: 'calendar',
			};
			const api = await connectionsApi();
			const raw = api
				? await api.list(request)
				: await vscode.commands.executeCommand<unknown>(LIST_COMMAND_ID, request);
			if (!Array.isArray(raw)) {
				return [];
			}
			const connections: CalendarConnectionInfo[] = [];
			for (const entry of raw) {
				const connection = toCalendarConnectionInfo(entry);
				if (connection) {
					connections.push(connection);
				}
			}
			return connections;
		},

		async disconnect(connectionId) {
			const api = await connectionsApi();
			if (api) {
				await api.disconnect(connectionId);
				return;
			}
			await vscode.commands.executeCommand<void>(DISCONNECT_COMMAND_ID, connectionId);
		},
	};
}

/**
 * The auth extension's `connections` façade once it is activated, or undefined
 * when the extension is missing or exports something unexpected.
 */
async function connectionsApi(): Promise<ConnectionsExports | undefined> {
	const extension = vscode.extensions.getExtension(AUTH_EXTENSION_ID);
	if (!extension) {
		return undefined;
	}
	const exports: unknown = extension.isActive ? extension.exports : await extension.activate();
	const connections = (exports as { connections?: unknown } | undefined)?.connections;
	if (!connections || typeof connections !== 'object') {
		return undefined;
	}
	const candidate = connections as Partial<ConnectionsExports>;
	if (
		typeof candidate.connect !== 'function'
		|| typeof candidate.list !== 'function'
		|| typeof candidate.disconnect !== 'function'
	) {
		return undefined;
	}
	return candidate as ConnectionsExports;
}

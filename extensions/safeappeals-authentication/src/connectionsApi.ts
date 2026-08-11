/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Client-side contract for void-cloud service connections (`/connections/*`).
 *
 * A connection is one mail/calendar grant owned by a Cloud user. The provider
 * refresh token is exchanged and stored server-side, so the desktop client only
 * ever sees metadata plus short-lived access tokens minted per capability.
 */

/** Identity provider behind a service connection. */
export type ProviderKind = 'google' | 'microsoft';

/**
 * What a connection is allowed to do. Mirrors void-cloud's `Capability`.
 *
 * - `mail` — IMAP/SMTP
 * - `calendar` — calendar events
 * - `files` — Google Drive or OneDrive / SharePoint / Teams libraries
 */
export type ConnectionCapability = 'mail' | 'calendar' | 'files';

/** Server-side health of a grant. `needs_reconsent` means reconnect, not retry. */
export type ConnectionStatus = 'active' | 'needs_reconsent' | 'revoked';

/** How the grant was created: the connect flow, or migrated from `provider_tokens`. */
export type ConnectionSource = 'connect' | 'migrated_v1';

/** Error code returned by POST /connections/claim while the browser leg is unfinished. */
export const CONNECTION_NOT_READY_CODE = 'CONNECTION_NOT_READY';

/**
 * Connection metadata as returned by the server. Never carries token material.
 */
export interface ConnectionInfo {
	readonly id: string;
	readonly provider: ProviderKind;
	readonly accountEmail: string | null;
	readonly accountLabel: string | null;
	readonly capabilities: readonly ConnectionCapability[];
	readonly status: ConnectionStatus;
	readonly source: ConnectionSource;
	readonly grantedScopes: string;
	/** Stable provider-side account id, when the server exposes it. */
	readonly providerAccountId?: string | null;
	readonly lastMintedAt?: string | null;
	readonly lastErrorCode?: string | null;
	readonly createdAt?: string;
	readonly updatedAt?: string;
}

/**
 * Body for POST /connections/start.
 */
export interface StartConnectionRequest {
	readonly provider: ProviderKind;
	readonly capabilities: readonly ConnectionCapability[];
	/** Preselects an account on the provider consent screen. */
	readonly loginHint?: string;
}

/**
 * Response from POST /connections/start. The browser must visit `authorizeUrl`;
 * `requestId` is what the desktop app claims afterwards.
 */
export interface StartConnectionResult {
	readonly requestId: string;
	readonly authorizeUrl: string;
}

/**
 * Short-lived provider access token from POST /connections/:id/token.
 */
export interface ConnectionTokenResult {
	readonly connectionId: string;
	readonly capability: ConnectionCapability;
	readonly accessToken: string;
	/** Unix seconds. */
	readonly expiresAt: number;
	/** Space-delimited scopes the provider granted, when reported. */
	readonly scope?: string;
	readonly accountEmail?: string;
}

/**
 * Server-side filter for GET /connections.
 */
export interface ConnectionFilter {
	readonly provider?: ProviderKind;
	readonly capability?: ConnectionCapability;
	readonly status?: ConnectionStatus;
}

/**
 * The `/connections/*` surface consumed by the connection manager and the
 * connection-minted authentication providers. Implemented by `CloudApiClient`.
 */
export interface ConnectionsApi {
	startConnection(request: StartConnectionRequest): Promise<StartConnectionResult>;
	claimConnection(requestId: string): Promise<ConnectionInfo>;
	/** Claim that resolves to `undefined` while the browser leg is unfinished. */
	tryClaimConnection(requestId: string): Promise<ConnectionInfo | undefined>;
	listConnections(filter?: ConnectionFilter): Promise<ConnectionInfo[]>;
	mintConnectionToken(connectionId: string, capability: ConnectionCapability): Promise<ConnectionTokenResult>;
	deleteConnection(connectionId: string): Promise<void>;
}

/**
 * True for a supported provider id.
 */
export function isProviderKind(value: unknown): value is ProviderKind {
	return value === 'google' || value === 'microsoft';
}

/**
 * True for a supported capability id.
 */
export function isConnectionCapability(value: unknown): value is ConnectionCapability {
	return value === 'mail' || value === 'calendar' || value === 'files';
}

/**
 * Normalizes and de-duplicates a capability list, preserving request order.
 * Unknown entries are dropped; callers must reject an empty result.
 */
export function normalizeCapabilities(
	capabilities: readonly string[] | undefined,
): ConnectionCapability[] {
	return [...new Set((capabilities ?? []).filter(isConnectionCapability))];
}

/** Microsoft capabilities that share the Graph resource audience. */
const MICROSOFT_GRAPH_CAPABILITIES: ReadonlySet<ConnectionCapability> = new Set(['calendar', 'files']);

/**
 * Whether one authorize request can carry every requested capability.
 *
 * Entra issues tokens for a single resource audience, so Microsoft mail
 * (Exchange Online) cannot share a grant with calendar/files (Graph).
 * Calendar + files may be requested together on Microsoft. Google allows any
 * non-empty mix of mail/calendar/files in one grant.
 */
export function providerSupportsCapabilityBundle(
	provider: ProviderKind,
	capabilities: readonly ConnectionCapability[],
): boolean {
	if (capabilities.length === 0) {
		return false;
	}
	if (provider === 'google') {
		return true;
	}
	// microsoft
	const hasMail = capabilities.includes('mail');
	const hasGraph = capabilities.some(cap => MICROSOFT_GRAPH_CAPABILITIES.has(cap));
	if (hasMail && hasGraph) {
		return false;
	}
	if (hasMail) {
		return capabilities.length === 1;
	}
	return capabilities.every(cap => MICROSOFT_GRAPH_CAPABILITIES.has(cap));
}

/**
 * True when a connection currently carries the capability.
 * Revoked grants never satisfy a capability, even while the row still lists it.
 */
export function connectionHasCapability(
	connection: ConnectionInfo,
	capability: ConnectionCapability,
): boolean {
	return connection.status !== 'revoked' && connection.capabilities.includes(capability);
}

/**
 * True when a connection carries every requested capability.
 */
export function connectionHasAllCapabilities(
	connection: ConnectionInfo,
	capabilities: Iterable<ConnectionCapability>,
): boolean {
	for (const capability of capabilities) {
		if (!connectionHasCapability(connection, capability)) {
			return false;
		}
	}
	return true;
}

/**
 * Query string (including `?`) for GET /connections, or `''` when unfiltered.
 */
export function buildConnectionListQuery(filter: ConnectionFilter | undefined): string {
	const params = new URLSearchParams();
	if (filter?.provider) {
		params.set('provider', filter.provider);
	}
	if (filter?.capability) {
		params.set('capability', filter.capability);
	}
	if (filter?.status) {
		params.set('status', filter.status);
	}
	const query = params.toString();
	return query ? `?${query}` : '';
}

/**
 * Validates and normalizes one connection record from the server.
 * Returns undefined for anything that is not a usable connection.
 */
export function parseConnectionInfo(raw: unknown): ConnectionInfo | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	const record = raw as Record<string, unknown>;
	if (typeof record.id !== 'string' || !record.id || !isProviderKind(record.provider)) {
		return undefined;
	}
	const capabilities = Array.isArray(record.capabilities)
		? [...new Set(record.capabilities.filter(isConnectionCapability))]
		: [];
	const status = record.status;
	return {
		id: record.id,
		provider: record.provider,
		accountEmail: typeof record.accountEmail === 'string' ? record.accountEmail : null,
		accountLabel: typeof record.accountLabel === 'string' ? record.accountLabel : null,
		capabilities,
		status: status === 'needs_reconsent' || status === 'revoked' ? status : 'active',
		source: record.source === 'migrated_v1' ? 'migrated_v1' : 'connect',
		grantedScopes: typeof record.grantedScopes === 'string' ? record.grantedScopes : '',
		providerAccountId: typeof record.providerAccountId === 'string' ? record.providerAccountId : null,
		lastMintedAt: typeof record.lastMintedAt === 'string' ? record.lastMintedAt : null,
		lastErrorCode: typeof record.lastErrorCode === 'string' ? record.lastErrorCode : null,
		createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
		updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : undefined,
	};
}

/**
 * Parses a `{ connections: [...] }` payload, dropping malformed rows.
 */
export function parseConnectionList(raw: unknown): ConnectionInfo[] {
	if (!raw || typeof raw !== 'object') {
		return [];
	}
	const list = (raw as { connections?: unknown }).connections;
	if (!Array.isArray(list)) {
		return [];
	}
	const parsed: ConnectionInfo[] = [];
	for (const entry of list) {
		const connection = parseConnectionInfo(entry);
		if (connection) {
			parsed.push(connection);
		}
	}
	return parsed;
}

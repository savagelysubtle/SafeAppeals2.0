/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ConnectionChangeEvent, ConnectOptions } from './connectionManager';
import {
	connectionHasAllCapabilities,
	type ConnectionCapability,
	type ConnectionFilter,
	type ConnectionInfo,
	type ConnectionTokenResult,
	type ProviderKind,
} from './connectionsApi';
import {
	capabilitiesFromGrantedScope,
	inferProviderCapabilities,
	missingCapabilities,
	ProviderTokenScopeError,
	scopesForCapabilities,
	sessionSatisfiesCapabilities,
	type ProviderCapability,
} from './providerCapabilities';

/** Refresh buffer before treating a cached access token as expired (seconds). */
const TOKEN_REFRESH_BUFFER_SECONDS = 60;

/** Window in which repeated `getSessions` calls reuse the last connection list. */
const CONNECTION_LIST_TTL_MS = 5_000;

/**
 * The slice of {@link import('./connectionManager').ConnectionManager} the
 * connection-backed auth providers depend on.
 */
export interface ConnectionsGateway {
	list(filter?: ConnectionFilter): Promise<ConnectionInfo[]>;
	connect(options: ConnectOptions): Promise<ConnectionInfo>;
	mintToken(connectionId: string, capability: ConnectionCapability): Promise<ConnectionTokenResult>;
	readonly onDidChangeConnections: vscode.Event<ConnectionChangeEvent>;
}

/**
 * Injectable seams shared by the Google and Microsoft connection-backed auth providers.
 */
export interface ConnectionAuthProviderDeps {
	readonly provider: ProviderKind;
	readonly providerId: string;
	readonly label: string;
	readonly connections: ConnectionsGateway;
	readonly onDidChangeCloudSessions: vscode.Event<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>;
	readonly output: Pick<vscode.OutputChannel, 'appendLine'>;
	/** Optional clock for expiry tests (unix seconds). */
	readonly nowSeconds?: () => number;
	/** When false, skips `registerAuthenticationProvider` (unit tests). Default true. */
	readonly register?: boolean;
}

interface CachedToken {
	readonly connection: ConnectionInfo;
	readonly accessToken: string;
	readonly expiresAt: number;
	/** Capabilities the minted token actually carries. */
	readonly capabilities: ReadonlySet<ProviderCapability>;
}

/**
 * AuthenticationProvider backed by void-cloud service connections.
 *
 * Each connection is one account, so the provider supports multiple accounts:
 * `session.id` is the connection id and `account.label` the connected mailbox.
 * Access tokens live in memory only; refresh tokens never leave the server.
 */
export class ConnectionAuthProvider implements vscode.AuthenticationProvider, vscode.Disposable {
	private readonly _sessionChangeEmitter = new vscode.EventEmitter<vscode.AuthenticationProviderAuthenticationSessionsChangeEvent>();
	private readonly _disposables: vscode.Disposable[] = [];
	/** Minted tokens keyed by `${connectionId}::${mintedCapability}`. */
	private readonly _tokens = new Map<string, CachedToken>();
	/** De-dupes concurrent mints for the same connection + capability. */
	private readonly _mintsInFlight = new Map<string, Promise<CachedToken>>();
	/** De-dupes concurrent browser connect flows for the same capability set. */
	private readonly _connectsInFlight = new Map<string, Promise<ConnectionInfo>>();
	private _connectionsCache: ConnectionInfo[] | undefined;
	private _connectionsCachedAt = 0;
	private _connectionsInFlight: Promise<ConnectionInfo[]> | undefined;

	readonly onDidChangeSessions = this._sessionChangeEmitter.event;

	constructor(protected readonly deps: ConnectionAuthProviderDeps) {
		if (deps.register !== false) {
			this._disposables.push(
				vscode.authentication.registerAuthenticationProvider(
					deps.providerId,
					deps.label,
					this,
					{ supportsMultipleAccounts: true },
				),
			);
		}
		this._disposables.push(
			this._sessionChangeEmitter,
			deps.onDidChangeCloudSessions(event => this.onCloudSessionsChanged(event)),
			deps.connections.onDidChangeConnections(event => this.onConnectionsChanged(event)),
		);
	}

	/**
	 * Returns one session per connection that already carries the requested
	 * capabilities, minting silently where the cached token expired.
	 *
	 * Never prompts: a connection that cannot mint is skipped so consumers see a
	 * reconnect path instead of a stale token.
	 */
	async getSessions(
		scopes?: readonly string[],
		options?: vscode.AuthenticationProviderSessionOptions,
	): Promise<vscode.AuthenticationSession[]> {
		const requested = inferProviderCapabilities(scopes);
		if (requested.size === 0) {
			return [];
		}

		const candidates = await this.candidateConnections(requested, options?.account);
		const sessions: vscode.AuthenticationSession[] = [];
		for (const connection of candidates) {
			try {
				const token = await this.ensureToken(connection, requested);
				sessions.push(this.toSession(token, requested));
			} catch (error) {
				this.log(`silent mint failed for ${connection.id}: ${messageOf(error)}`);
			}
		}
		return sessions;
	}

	/**
	 * Returns a session for the requested capabilities, connecting a new account
	 * in the browser when no existing connection can serve them.
	 */
	async createSession(
		scopes: readonly string[],
		options?: vscode.AuthenticationProviderSessionOptions,
	): Promise<vscode.AuthenticationSession> {
		const requested = inferProviderCapabilities(scopes);
		if (requested.size === 0) {
			throw new Error(
				vscode.l10n.t('Request mail and/or calendar scopes for {0}.', this.deps.label),
			);
		}

		const candidates = await this.candidateConnections(requested, options?.account);
		for (const connection of candidates) {
			try {
				const token = await this.ensureToken(connection, requested);
				return this.toSession(token, requested);
			} catch (error) {
				this.log(`mint failed for ${connection.id}; trying to connect instead: ${messageOf(error)}`);
			}
		}

		const connection = await this.connectAccount(requested, options?.account);
		this.invalidateConnections();
		const token = await this.ensureToken(connection, requested);
		return this.toSession(token, requested);
	}

	/**
	 * Drops the in-memory tokens for one connection. The connection itself stays
	 * on the server — disconnecting is `safeappeals.connections.disconnect`.
	 */
	async removeSession(sessionId: string): Promise<void> {
		const removed = this.dropTokens(token => token.connection.id === sessionId);
		if (removed.length === 0) {
			return;
		}
		this._sessionChangeEmitter.fire({ added: [], removed, changed: [] });
		this.log(`cleared cached tokens for connection ${sessionId}`);
	}

	/**
	 * Clears every cached provider token (Cloud sign-out cascade).
	 */
	clearCachedSessions(): void {
		const removed = this.dropTokens(() => true);
		this.invalidateConnections();
		if (removed.length > 0) {
			this._sessionChangeEmitter.fire({ added: [], removed, changed: [] });
		}
	}

	dispose(): void {
		for (const disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables.length = 0;
		this._tokens.clear();
		this._mintsInFlight.clear();
		this._connectsInFlight.clear();
		this.invalidateConnections();
	}

	private onCloudSessionsChanged(
		event: vscode.AuthenticationProviderAuthenticationSessionsChangeEvent,
	): void {
		if ((event.removed ?? []).length === 0) {
			return;
		}
		// Cloud sign-out: stop serving provider tokens. Connections stay server-side.
		this.log('clearing provider tokens after Cloud sign-out');
		this.clearCachedSessions();
	}

	private onConnectionsChanged(event: ConnectionChangeEvent): void {
		this.invalidateConnections();
		if (event.removed.length === 0) {
			return;
		}
		const removedIds = new Set(event.removed);
		const removed = this.dropTokens(token => removedIds.has(token.connection.id));
		if (removed.length > 0) {
			this._sessionChangeEmitter.fire({ added: [], removed, changed: [] });
		}
	}

	/**
	 * Connections that can serve every requested capability, newest last, filtered
	 * to one account when the caller named one.
	 */
	private async candidateConnections(
		requested: ReadonlySet<ProviderCapability>,
		account: vscode.AuthenticationSessionAccountInformation | undefined,
	): Promise<ConnectionInfo[]> {
		const connections = await this.listConnections();
		return connections.filter(connection =>
			connectionHasAllCapabilities(connection, requested)
			&& matchesAccount(connection, account),
		);
	}

	/**
	 * Lists this provider's connections, tolerating a signed-out Cloud session.
	 */
	private async listConnections(): Promise<ConnectionInfo[]> {
		const now = Date.now();
		if (this._connectionsCache && now - this._connectionsCachedAt < CONNECTION_LIST_TTL_MS) {
			return this._connectionsCache;
		}
		if (!this._connectionsInFlight) {
			this._connectionsInFlight = this.deps.connections
				.list({ provider: this.deps.provider })
				.then(connections => {
					this._connectionsCache = connections;
					this._connectionsCachedAt = Date.now();
					return connections;
				})
				.catch(error => {
					this.log(`could not list connections: ${messageOf(error)}`);
					return [] as ConnectionInfo[];
				})
				.finally(() => {
					this._connectionsInFlight = undefined;
				});
		}
		return this._connectionsInFlight;
	}

	private invalidateConnections(): void {
		this._connectionsCache = undefined;
		this._connectionsCachedAt = 0;
	}

	/**
	 * Returns a cached token that covers the requested capabilities, minting one
	 * when the cache is empty or close to expiry.
	 */
	private async ensureToken(
		connection: ConnectionInfo,
		requested: ReadonlySet<ProviderCapability>,
	): Promise<CachedToken> {
		const cached = this.findCachedToken(connection.id, requested);
		if (cached) {
			return cached;
		}

		const capability = mintCapabilityFor(connection, requested);
		const key = tokenKey(connection.id, capability);
		const inFlight = this._mintsInFlight.get(key);
		if (inFlight) {
			return inFlight;
		}

		const mint = this.mintToken(connection, capability, requested);
		this._mintsInFlight.set(key, mint);
		try {
			return await mint;
		} finally {
			this._mintsInFlight.delete(key);
		}
	}

	private async mintToken(
		connection: ConnectionInfo,
		capability: ProviderCapability,
		requested: ReadonlySet<ProviderCapability>,
	): Promise<CachedToken> {
		const minted = await this.deps.connections.mintToken(connection.id, capability);
		// Stamp capabilities from what the provider granted, never from what we
		// asked for: an identity-only grant mints fine but cannot talk to Gmail.
		const grantedFromScope = capabilitiesFromGrantedScope(this.deps.provider, minted.scope);
		const granted = grantedFromScope ?? new Set(connection.capabilities);
		if (!sessionSatisfiesCapabilities(granted, requested)) {
			const missing = missingCapabilities(granted, requested);
			this.log(
				`minted token for ${connection.id} lacks ${missing.join(', ')} scope (granted: ${minted.scope ?? 'unknown'})`,
			);
			this.dropTokens(token => token.connection.id === connection.id);
			throw new ProviderTokenScopeError(missing);
		}
		if (!grantedFromScope) {
			this.log(`mint response for ${connection.id} omitted scope; trusting recorded capabilities`);
		}

		const key = tokenKey(connection.id, capability);
		const hadToken = this.hasTokenFor(connection.id);
		const token: CachedToken = {
			connection: minted.accountEmail && minted.accountEmail !== connection.accountEmail
				? { ...connection, accountEmail: minted.accountEmail }
				: connection,
			accessToken: minted.accessToken,
			expiresAt: minted.expiresAt,
			capabilities: granted,
		};
		this._tokens.set(key, token);

		const session = this.toSession(token, requested);
		if (hadToken) {
			this._sessionChangeEmitter.fire({ added: [], removed: [], changed: [session] });
		} else {
			this._sessionChangeEmitter.fire({ added: [session], removed: [], changed: [] });
		}
		return token;
	}

	/**
	 * Runs the browser connect flow, de-duped so two consumers asking for the
	 * same capabilities cannot open two consent tabs.
	 */
	private connectAccount(
		requested: ReadonlySet<ProviderCapability>,
		account: vscode.AuthenticationSessionAccountInformation | undefined,
	): Promise<ConnectionInfo> {
		const capabilities = scopesForCapabilities(requested) as ProviderCapability[];
		const key = capabilities.join(',');
		const inFlight = this._connectsInFlight.get(key);
		if (inFlight) {
			return inFlight;
		}
		const work = this.deps.connections.connect({
			provider: this.deps.provider,
			capabilities,
			loginHint: account?.label,
		});
		this._connectsInFlight.set(key, work);
		void work.catch(() => { /* surfaced to the caller below */ }).finally(() => {
			this._connectsInFlight.delete(key);
		});
		return work;
	}

	private findCachedToken(
		connectionId: string,
		requested: ReadonlySet<ProviderCapability>,
	): CachedToken | undefined {
		const now = this.nowSeconds();
		for (const [key, token] of this._tokens) {
			if (token.connection.id !== connectionId) {
				continue;
			}
			if (token.expiresAt <= now + TOKEN_REFRESH_BUFFER_SECONDS) {
				this._tokens.delete(key);
				continue;
			}
			if (sessionSatisfiesCapabilities(token.capabilities, requested)) {
				return token;
			}
		}
		return undefined;
	}

	private hasTokenFor(connectionId: string): boolean {
		for (const token of this._tokens.values()) {
			if (token.connection.id === connectionId) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Removes matching cached tokens and returns the sessions they represented.
	 */
	private dropTokens(predicate: (token: CachedToken) => boolean): vscode.AuthenticationSession[] {
		const removed: vscode.AuthenticationSession[] = [];
		for (const [key, token] of [...this._tokens]) {
			if (!predicate(token)) {
				continue;
			}
			this._tokens.delete(key);
			removed.push(this.toSession(token, token.capabilities));
		}
		return removed;
	}

	private toSession(
		token: CachedToken,
		capabilities: ReadonlySet<ProviderCapability>,
	): vscode.AuthenticationSession {
		const connection = token.connection;
		return {
			id: connection.id,
			accessToken: token.accessToken,
			account: {
				id: connection.providerAccountId || connection.id,
				label: connection.accountEmail || connection.accountLabel || this.deps.label,
			},
			scopes: scopesForCapabilities(capabilities),
		};
	}

	private log(message: string): void {
		this.deps.output.appendLine(`[${this.deps.providerId}] ${message}`);
	}

	private nowSeconds(): number {
		return this.deps.nowSeconds?.() ?? Math.floor(Date.now() / 1000);
	}
}

/**
 * Capability to mint with: mail when it was asked for (its Google grant also
 * covers calendar), otherwise the first requested capability.
 */
function mintCapabilityFor(
	connection: ConnectionInfo,
	requested: ReadonlySet<ProviderCapability>,
): ProviderCapability {
	if (requested.has('mail') && connection.capabilities.includes('mail')) {
		return 'mail';
	}
	const [first] = scopesForCapabilities(requested) as ProviderCapability[];
	return first ?? 'mail';
}

/**
 * True when the connection is the account the caller asked about (or none was).
 */
function matchesAccount(
	connection: ConnectionInfo,
	account: vscode.AuthenticationSessionAccountInformation | undefined,
): boolean {
	if (!account) {
		return true;
	}
	return (
		account.id === connection.id
		|| account.id === connection.providerAccountId
		|| (!!connection.accountEmail && account.label === connection.accountEmail)
	);
}

function tokenKey(connectionId: string, capability: ProviderCapability): string {
	return `${connectionId}::${capability}`;
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}

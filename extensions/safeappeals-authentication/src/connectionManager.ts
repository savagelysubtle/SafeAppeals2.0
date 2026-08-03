/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import {
	connectionHasAllCapabilities,
	normalizeCapabilities,
	providerSupportsCapabilityBundle,
	type ConnectionCapability,
	type ConnectionFilter,
	type ConnectionInfo,
	type ConnectionsApi,
	type ConnectionTokenResult,
	type ProviderKind,
} from './connectionsApi';
import type { ConnectCallbackResult } from './uriHandler';

/** How long the browser leg of a connect flow may take before giving up. */
const CONNECT_TIMEOUT_MS = 5 * 60 * 1000;

/** Claim polling cadence while waiting for the browser leg (deep link short-circuits it). */
const CLAIM_POLL_INTERVAL_MS = 2_000;

/**
 * Options for {@link ConnectionManager.connect}.
 */
export interface ConnectOptions {
	readonly provider: ProviderKind;
	readonly capabilities: readonly string[];
	/** Preselects an account on the provider consent screen. */
	readonly loginHint?: string;
}

/**
 * Emitted after the local view of the user's connections changed.
 */
export interface ConnectionChangeEvent {
	readonly added: readonly ConnectionInfo[];
	readonly removed: readonly string[];
}

/**
 * Injectable seams for {@link ConnectionManager}.
 */
export interface ConnectionManagerDeps {
	readonly api: ConnectionsApi;
	/**
	 * Ensures a SafeAppeals Cloud session exists (may prompt). Connections are
	 * owned by the Cloud user, so there is nothing to start without one.
	 */
	readonly ensureCloudSession: () => Promise<void>;
	/** `/connect` deep links relayed from the extension's single URI handler. */
	readonly onConnectCallback: vscode.Event<ConnectCallbackResult>;
	readonly output: Pick<vscode.OutputChannel, 'appendLine'>;
	/** Opens the provider authorize URL. Defaults to `vscode.env.openExternal`. */
	readonly openExternal?: (url: string) => Promise<boolean>;
	/** Test seams for the claim polling loop. */
	readonly delay?: (ms: number) => Promise<void>;
	readonly now?: () => number;
	readonly pollIntervalMs?: number;
	readonly timeoutMs?: number;
}

/**
 * Drives the desktop half of the service-connection flow: start a request, send
 * the user to the provider, then claim the finished connection.
 *
 * No authorization code, refresh token, or client secret ever reaches this
 * process — the browser lands on void-cloud, which exchanges the code and hands
 * back only the request id.
 */
export class ConnectionManager implements vscode.Disposable {
	private readonly _changeEmitter = new vscode.EventEmitter<ConnectionChangeEvent>();
	private readonly _disposables: vscode.Disposable[] = [];

	/** Fires when a connection was added or removed by this window. */
	readonly onDidChangeConnections = this._changeEmitter.event;

	constructor(private readonly deps: ConnectionManagerDeps) {
		this._disposables.push(this._changeEmitter);
	}

	/**
	 * Connects a mail and/or calendar account and resolves with its metadata.
	 *
	 * Completion arrives either as a `/connect` deep link or from polling the
	 * claim endpoint, whichever lands first — browsers increasingly refuse to
	 * follow a private-use scheme, so polling is the load-bearing path.
	 */
	async connect(options: ConnectOptions): Promise<ConnectionInfo> {
		const capabilities = normalizeCapabilities(options.capabilities);
		if (capabilities.length === 0) {
			throw new Error(vscode.l10n.t('Request mail and/or calendar access to connect an account.'));
		}
		if (!providerSupportsCapabilityBundle(options.provider, capabilities)) {
			throw new Error(vscode.l10n.t('Microsoft mail and calendar must be connected separately.'));
		}

		await this.deps.ensureCloudSession();

		const started = await this.deps.api.startConnection({
			provider: options.provider,
			capabilities,
			loginHint: options.loginHint,
		});
		this.deps.output.appendLine(
			`[connections] started ${options.provider} connection (${capabilities.join(', ')}) request=${started.requestId}`,
		);

		const opened = await this.openExternal(started.authorizeUrl);
		if (!opened) {
			throw new Error(vscode.l10n.t('Could not open the system browser to connect your account.'));
		}

		const connection = await this.awaitConnection(started.requestId);
		this.deps.output.appendLine(
			`[connections] connected ${connection.provider} ${connection.accountEmail ?? connection.id}`,
		);
		this._changeEmitter.fire({ added: [connection], removed: [] });
		return connection;
	}

	/**
	 * Lists the signed-in user's connections, optionally filtered server-side.
	 */
	async list(filter?: ConnectionFilter): Promise<ConnectionInfo[]> {
		return this.deps.api.listConnections(filter);
	}

	/**
	 * Mints a short-lived provider access token for one capability of a connection.
	 */
	async mintToken(
		connectionId: string,
		capability: ConnectionCapability,
	): Promise<ConnectionTokenResult> {
		return this.deps.api.mintConnectionToken(connectionId, capability);
	}

	/**
	 * Revokes a connection at the provider and drops it server-side.
	 */
	async disconnect(connectionId: string): Promise<void> {
		await this.deps.api.deleteConnection(connectionId);
		this.deps.output.appendLine(`[connections] disconnected ${connectionId}`);
		this._changeEmitter.fire({ added: [], removed: [connectionId] });
	}

	/**
	 * First connection that carries every requested capability, if any.
	 */
	async findConnection(
		provider: ProviderKind,
		capabilities: readonly ConnectionCapability[],
	): Promise<ConnectionInfo | undefined> {
		const connections = await this.list({ provider });
		return connections.find(connection => connectionHasAllCapabilities(connection, capabilities));
	}

	dispose(): void {
		for (const disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables.length = 0;
	}

	/**
	 * Waits for the browser leg, claiming as soon as the server reports the
	 * request as finished.
	 */
	private async awaitConnection(requestId: string): Promise<ConnectionInfo> {
		const now = this.deps.now ?? (() => Date.now());
		const delay = this.deps.delay ?? defaultDelay;
		const pollIntervalMs = this.deps.pollIntervalMs ?? CLAIM_POLL_INTERVAL_MS;
		const deadline = now() + (this.deps.timeoutMs ?? CONNECT_TIMEOUT_MS);

		let failure: string | undefined;
		let wake: (() => void) | undefined;
		const subscription = this.deps.onConnectCallback(result => {
			if (result.requestId !== requestId) {
				return;
			}
			if (!result.ok) {
				failure = result.message;
			}
			wake?.();
		});

		try {
			for (;;) {
				const claimed = await this.deps.api.tryClaimConnection(requestId);
				if (claimed) {
					return claimed;
				}
				if (failure !== undefined) {
					throw new Error(vscode.l10n.t('Connecting your account failed: {0}', failure));
				}
				if (now() >= deadline) {
					throw new Error(vscode.l10n.t('Connecting your account timed out. Please try again.'));
				}
				await new Promise<void>(resolve => {
					wake = resolve;
					void delay(pollIntervalMs).then(resolve);
				});
				wake = undefined;
			}
		} finally {
			subscription.dispose();
		}
	}

	private async openExternal(url: string): Promise<boolean> {
		if (this.deps.openExternal) {
			return this.deps.openExternal(url);
		}
		// Pass the authorize URL as a string: Uri.parse percent-decodes the query
		// and openExternal re-encodes it poorly (same pattern as sign-in).
		return vscode.env.openExternal(url as unknown as vscode.Uri);
	}
}

function defaultDelay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

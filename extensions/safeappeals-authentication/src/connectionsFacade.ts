/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ConnectionChangeEvent, ConnectionManager, ConnectOptions } from './connectionManager';
import { isProviderKind, type ConnectionFilter, type ConnectionInfo } from './connectionsApi';
import type { ICloudApiClient } from './cloudApiClient';

/** Command id: connect a mail/calendar account. */
export const CONNECT_COMMAND_ID = 'safeappeals.connections.connect';

/** Command id: connect a Slack workspace (messaging + optional files). */
export const CONNECT_SLACK_COMMAND_ID = 'safeappeals.connections.connectSlack';

/** Command id: list the signed-in user's connections. */
export const LIST_COMMAND_ID = 'safeappeals.connections.list';

/** Command id: revoke and delete a connection. */
export const DISCONNECT_COMMAND_ID = 'safeappeals.connections.disconnect';

/**
 * Service-connection surface other SafeAppeals extensions consume, either via
 * `extensions.getExtension('safeappeals.safeappeals-authentication')?.exports`
 * or the equivalent `safeappeals.connections.*` commands.
 */
export interface SafeAppealsConnectionsApi {
	connect(options: ConnectOptions): Promise<ConnectionInfo>;
	list(filter?: ConnectionFilter): Promise<ConnectionInfo[]>;
	disconnect(connectionId: string): Promise<void>;
	readonly onDidChangeConnections: vscode.Event<ConnectionChangeEvent>;
}

/** Public shape of `activate()`'s return value. */
export interface SafeAppealsAuthenticationApi {
	readonly connections: SafeAppealsConnectionsApi;
	readonly cloudApiClient: ICloudApiClient;
}

/**
 * Wraps the manager in the narrow surface exported to other extensions.
 */
export function createConnectionsFacade(manager: ConnectionManager): SafeAppealsConnectionsApi {
	return {
		connect: options => manager.connect(options),
		list: filter => manager.list(filter),
		disconnect: connectionId => manager.disconnect(connectionId),
		onDidChangeConnections: manager.onDidChangeConnections,
	};
}

/**
 * Registers the command equivalents of {@link SafeAppealsConnectionsApi} for
 * callers that cannot hold a reference to the exported API (webviews, keybindings).
 */
export function registerConnectionCommands(facade: SafeAppealsConnectionsApi): vscode.Disposable {
	return vscode.Disposable.from(
		vscode.commands.registerCommand(CONNECT_COMMAND_ID, async (options?: unknown) => {
			const parsed = parseConnectOptions(options);
			if (!parsed) {
				throw new Error(
					vscode.l10n.t(`Connecting an account needs a provider and at least one of 'mail', 'calendar', 'files', or 'messaging'.`),
				);
			}
			return facade.connect(parsed);
		}),
		vscode.commands.registerCommand(CONNECT_SLACK_COMMAND_ID, async () => {
			// Title-case label per spec: Connect Slack Workspace...
			return facade.connect({ provider: 'slack', capabilities: ['messaging', 'files'] });
		}),
		vscode.commands.registerCommand(LIST_COMMAND_ID, async (filter?: ConnectionFilter) => {
			return facade.list(filter);
		}),
		vscode.commands.registerCommand(DISCONNECT_COMMAND_ID, async (connectionId?: string) => {
			if (typeof connectionId !== 'string' || !connectionId) {
				throw new Error(vscode.l10n.t('Disconnecting an account needs a connection id.'));
			}
			await facade.disconnect(connectionId);
		}),
	);
}

/**
 * Validates command arguments crossing the extension-host boundary.
 */
export function parseConnectOptions(raw: unknown): ConnectOptions | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	const record = raw as Record<string, unknown>;
	if (!isProviderKind(record.provider)) {
		return undefined;
	}
	const capabilities = Array.isArray(record.capabilities)
		? record.capabilities.filter((entry): entry is string => typeof entry === 'string')
		: [];
	if (capabilities.length === 0) {
		return undefined;
	}
	return {
		provider: record.provider,
		capabilities,
		loginHint: typeof record.loginHint === 'string' ? record.loginHint : undefined,
	};
}

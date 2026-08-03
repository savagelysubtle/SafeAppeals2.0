/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*--------------------------------------------------------------------------------------
 *  Service connections (A1) consumed from the email extension
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { toMailConnectionInfo, type MailConnectionInfo } from './oauthAccountFlow';
import type { EmailOAuthProvider } from './types';

/** Extension that owns SafeAppeals service connections. */
const AUTH_EXTENSION_ID = 'safeappeals.safeappeals-authentication';

/** Command fallbacks for hosts where the exported API is unavailable. */
const CONNECT_COMMAND_ID = 'safeappeals.connections.connect';
const LIST_COMMAND_ID = 'safeappeals.connections.list';

/** Only mailbox grants are of interest here; calendar belongs to the timeline extension. */
const MAIL_CAPABILITIES = ['mail'];

interface ConnectRequest {
	provider: EmailOAuthProvider;
	capabilities: string[];
	loginHint?: string;
}

interface ListRequest {
	provider?: EmailOAuthProvider;
	capability?: string;
}

/** Shape of `safeappeals-authentication`'s exported `connections` façade. */
interface ConnectionsExports {
	connect(options: ConnectRequest): Promise<unknown>;
	list(filter?: ListRequest): Promise<unknown>;
}

/**
 * Mail-shaped view of the service-connection surface: connect a mailbox and list
 * the ones already connected.
 */
export interface MailConnectionsBridge {
	connect(provider: EmailOAuthProvider, loginHint?: string): Promise<MailConnectionInfo>;
	list(provider: EmailOAuthProvider): Promise<MailConnectionInfo[]>;
}

/**
 * Bridge to safeappeals-authentication, preferring its exported API and falling
 * back to the equivalent commands.
 */
export function createMailConnectionsBridge(): MailConnectionsBridge {
	return {
		async connect(provider, loginHint) {
			const request: ConnectRequest = {
				provider,
				capabilities: [...MAIL_CAPABILITIES],
				...(loginHint ? { loginHint } : {}),
			};
			const api = await connectionsApi();
			const raw = api
				? await api.connect(request)
				: await vscode.commands.executeCommand<unknown>(CONNECT_COMMAND_ID, request);
			const connection = toMailConnectionInfo(raw);
			if (!connection) {
				throw new Error(
					vscode.l10n.t('Safe Appeals did not return a connected account. Please try again.'),
				);
			}
			return connection;
		},

		async list(provider) {
			const request: ListRequest = { provider, capability: 'mail' };
			const api = await connectionsApi();
			const raw = api
				? await api.list(request)
				: await vscode.commands.executeCommand<unknown>(LIST_COMMAND_ID, request);
			if (!Array.isArray(raw)) {
				return [];
			}
			const connections: MailConnectionInfo[] = [];
			for (const entry of raw) {
				const connection = toMailConnectionInfo(entry);
				if (connection) {
					connections.push(connection);
				}
			}
			return connections;
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
	if (typeof candidate.connect !== 'function' || typeof candidate.list !== 'function') {
		return undefined;
	}
	return candidate as ConnectionsExports;
}

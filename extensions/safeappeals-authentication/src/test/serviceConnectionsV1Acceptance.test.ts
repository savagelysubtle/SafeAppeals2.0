/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type {
	AuthenticationProviderAuthenticationSessionsChangeEvent,
	Disposable,
	Event,
} from 'vscode';
import { ConnectionManager, type ConnectionChangeEvent } from '../connectionManager';
import type { ConnectionsGateway } from '../connectionAuthProvider';
import {
	createConnectionsFacade,
	parseConnectOptions,
	type SafeAppealsConnectionsApi,
} from '../connectionsFacade';
import type {
	ConnectionCapability,
	ConnectionFilter,
	ConnectionInfo,
	ConnectionsApi,
	ConnectionTokenResult,
	StartConnectionRequest,
	StartConnectionResult,
} from '../connectionsApi';
import { GoogleAuthProvider } from '../googleAuthProvider';
import type { ConnectCallbackResult } from '../uriHandler';

/**
 * V1 acceptance coverage for Service Connections (mocked — no Electron UI / real OAuth).
 *
 * Automated walk (this suite):
 *   Cloud A → connect Gmail B (mail) → connect Calendar C → disconnect B →
 *   Cloud sign-out/in resumes remaining connection C (tokens cleared client-side;
 *   server connections remain; no DELETE on sign-out).
 *
 * Manual V1 smoke checklist (live browser after deploy):
 *   1. Sign in to SafeAppeals Cloud as identity A (e.g. work@firm.com).
 *   2. Connect Gmail as a *different* mailbox B (Cloud A ≠ Gmail B) for mail.
 *   3. Confirm email sync uses mailbox B; mint/list works without a second Cloud login.
 *   4. Connect Google Calendar (same or another Google account C) for calendar.
 *   5. Confirm calendar mint/sync works against that connection id.
 *   6. Disconnect mail connection B: it disappears from Connections list; mailbox shows
 *      needs-reconnect / disconnected; calendar C (if separate) still listed.
 *   7. Sign out of SafeAppeals Cloud: in-memory provider tokens clear; server must NOT
 *      delete remaining connections (no DELETE /connections/:id for C).
 *   8. Sign back into Cloud as A: list still shows remaining connections; remint mail/calendar
 *      works without re-consent when the grant is still active at Google/MS.
 *   9. Repeat a Microsoft mail-only connect (calendar must be a separate connect).
 */

const MAIL_GRANT =
	'openid https://www.googleapis.com/auth/userinfo.email https://mail.google.com/';
const CALENDAR_GRANT =
	'openid https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/calendar.events';
const NOW_SECONDS = 1_700_000_000;

type Listener<T> = (e: T) => unknown;

function createEmitter<T>(): { event: Event<T>; fire(data: T): void } {
	const listeners = new Set<Listener<T>>();
	const event = ((listener: Listener<T>): Disposable => {
		listeners.add(listener);
		return { dispose: () => { listeners.delete(listener); } };
	}) as Event<T>;
	return {
		event,
		fire(data: T): void {
			for (const listener of [...listeners]) {
				listener(data);
			}
		},
	};
}

function tick(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}

/** In-memory void-cloud `/connections/*` stand-in. */
class FakeConnectionsServer {
	readonly starts: StartConnectionRequest[] = [];
	readonly deletes: string[] = [];
	readonly mints: Array<{ connectionId: string; capability: ConnectionCapability }> = [];
	private readonly pending = new Map<string, ConnectionInfo>();
	private readonly ready = new Set<string>();
	private readonly connections = new Map<string, ConnectionInfo>();
	private requestSeq = 0;
	private connectionSeq = 0;
	cloudSignedIn = true;

	/** Marks the browser OAuth leg finished so claim/polling can succeed. */
	completeBrowserLeg(requestId: string): void {
		this.ready.add(requestId);
	}

	api(): ConnectionsApi {
		return {
			startConnection: async (request): Promise<StartConnectionResult> => {
				this.requireCloud();
				this.starts.push(request);
				this.requestSeq += 1;
				const requestId = `req-${this.requestSeq}`;
				this.connectionSeq += 1;
				const id = request.capabilities.includes('mail')
					? `conn-mail-${this.connectionSeq}`
					: `conn-cal-${this.connectionSeq}`;
				const connection: ConnectionInfo = {
					id,
					provider: request.provider,
					accountEmail: request.capabilities.includes('mail')
						? 'gmail-b@gmail.com'
						: 'calendar-c@gmail.com',
					accountLabel: null,
					capabilities: [...request.capabilities],
					status: 'active',
					source: 'connect',
					grantedScopes: request.capabilities.includes('mail') ? MAIL_GRANT : CALENDAR_GRANT,
					providerAccountId: `${request.provider}-${id}`,
				};
				this.pending.set(requestId, connection);
				return {
					requestId,
					authorizeUrl: `https://accounts.google.com/o/oauth2/v2/auth?state=${requestId}`,
				};
			},
			claimConnection: async (requestId) => {
				this.requireCloud();
				this.completeBrowserLeg(requestId);
				const claimed = this.finishClaim(requestId);
				if (!claimed) {
					throw new Error('Connection request not found');
				}
				return claimed;
			},
			tryClaimConnection: async (requestId) => {
				this.requireCloud();
				if (!this.ready.has(requestId)) {
					return undefined;
				}
				return this.finishClaim(requestId);
			},
			listConnections: async (filter?: ConnectionFilter) => {
				this.requireCloud();
				return [...this.connections.values()].filter(connection => {
					if (filter?.provider && connection.provider !== filter.provider) {
						return false;
					}
					if (filter?.capability && !connection.capabilities.includes(filter.capability)) {
						return false;
					}
					if (filter?.status && connection.status !== filter.status) {
						return false;
					}
					return true;
				});
			},
			mintConnectionToken: async (
				connectionId: string,
				capability: ConnectionCapability,
			): Promise<ConnectionTokenResult> => {
				this.requireCloud();
				const connection = this.connections.get(connectionId);
				if (!connection || !connection.capabilities.includes(capability)) {
					throw new Error('Connection not found');
				}
				this.mints.push({ connectionId, capability });
				return {
					connectionId,
					capability,
					accessToken: `token-${connectionId}-${capability}`,
					expiresAt: NOW_SECONDS + 3600,
					scope: capability === 'mail' ? MAIL_GRANT : CALENDAR_GRANT,
					accountEmail: connection.accountEmail ?? undefined,
				};
			},
			deleteConnection: async (connectionId: string) => {
				this.requireCloud();
				this.deletes.push(connectionId);
				this.connections.delete(connectionId);
			},
		};
	}

	private finishClaim(requestId: string): ConnectionInfo | undefined {
		const pending = this.pending.get(requestId);
		if (!pending) {
			return undefined;
		}
		this.pending.delete(requestId);
		this.ready.delete(requestId);
		this.connections.set(pending.id, pending);
		return pending;
	}

	private requireCloud(): void {
		if (!this.cloudSignedIn) {
			throw new Error('Session expired. Please sign in again.');
		}
	}
}

interface V1Harness {
	readonly server: FakeConnectionsServer;
	readonly manager: ConnectionManager;
	readonly facade: SafeAppealsConnectionsApi;
	readonly provider: GoogleAuthProvider;
	readonly cloudSessions: { fire(data: AuthenticationProviderAuthenticationSessionsChangeEvent): void };
	readonly connectCallbacks: { fire(data: ConnectCallbackResult): void };
	readonly changes: ConnectionChangeEvent[];
	readonly opened: string[];
}

function makeV1Harness(): V1Harness {
	const server = new FakeConnectionsServer();
	const connectCallbacks = createEmitter<ConnectCallbackResult>();
	const cloudSessions = createEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
	const changes: ConnectionChangeEvent[] = [];
	const opened: string[] = [];

	const manager = new ConnectionManager({
		api: server.api(),
		ensureCloudSession: async () => {
			if (!server.cloudSignedIn) {
				throw new Error('Sign in to SafeAppeals Cloud first.');
			}
		},
		onConnectCallback: connectCallbacks.event,
		output: { appendLine: () => { /* test stub */ } },
		openExternal: async url => {
			opened.push(url);
			return true;
		},
		// Yield so the test can mark the browser leg ready between polls.
		delay: () => new Promise<void>(resolve => setTimeout(resolve, 0)),
		pollIntervalMs: 0,
	});
	manager.onDidChangeConnections(event => changes.push(event));

	const gateway: ConnectionsGateway = {
		list: filter => manager.list(filter),
		connect: options => manager.connect(options),
		mintToken: (connectionId, capability) => manager.mintToken(connectionId, capability),
		onDidChangeConnections: manager.onDidChangeConnections,
	};

	const provider = new GoogleAuthProvider({
		register: false,
		connections: gateway,
		onDidChangeCloudSessions: cloudSessions.event,
		output: { appendLine: () => { /* test stub */ } },
		nowSeconds: () => NOW_SECONDS,
	});

	return {
		server,
		manager,
		facade: createConnectionsFacade(manager),
		provider,
		cloudSessions,
		connectCallbacks,
		changes,
		opened,
	};
}

/** Local stand-in for the email extension's OAuth credential row. */
interface EmailOauthRow {
	connectionId: string;
	authStatus?: 'ok' | 'needsReconnect';
}

suite('Service Connections V1 acceptance', () => {
	test('Cloud A → mail B → calendar C → disconnect B → sign-out/in resumes C without DELETE', async () => {
		const harness = makeV1Harness();
		const emailByAccount = new Map<string, EmailOauthRow>();
		const calendarConnectionIds = new Map<'google' | 'outlook', string>();

		// 1. Cloud session present
		assert.strictEqual(harness.server.cloudSignedIn, true);

		// 2. connections.connect google+mail → connectionId B
		const connectingMail = harness.facade.connect({ provider: 'google', capabilities: ['mail'] });
		await tick();
		const mailRequestId = harness.opened[0]?.match(/state=([^&]+)/)?.[1];
		assert.ok(mailRequestId);
		harness.server.completeBrowserLeg(mailRequestId!);
		harness.connectCallbacks.fire({ requestId: mailRequestId!, ok: true });
		const mailConnection = await connectingMail;
		assert.strictEqual(mailConnection.accountEmail, 'gmail-b@gmail.com');

		// 3. Email persists oauth creds with that connectionId; mint mail session succeeds
		emailByAccount.set('mailbox-1', { connectionId: mailConnection.id, authStatus: 'ok' });
		const mailSessions = await harness.provider.getSessions(['mail'], {
			account: { id: mailConnection.id, label: mailConnection.accountEmail! },
		});
		assert.deepStrictEqual(
			{
				mailId: mailConnection.id,
				emailCreds: emailByAccount.get('mailbox-1'),
				mailToken: mailSessions.map(session => ({
					id: session.id,
					accessToken: session.accessToken,
					scopes: session.scopes,
				})),
				mailMints: harness.server.mints.filter(mint => mint.capability === 'mail'),
			},
			{
				mailId: 'conn-mail-1',
				emailCreds: { connectionId: 'conn-mail-1', authStatus: 'ok' },
				mailToken: [{
					id: 'conn-mail-1',
					accessToken: 'token-conn-mail-1-mail',
					scopes: ['mail'],
				}],
				mailMints: [{ connectionId: 'conn-mail-1', capability: 'mail' }],
			},
		);

		// 4. connections.connect google+calendar → calendar stores connectionId; mint succeeds
		const connectingCal = harness.facade.connect({ provider: 'google', capabilities: ['calendar'] });
		await tick();
		const calRequestId = harness.opened[1]?.match(/state=([^&]+)/)?.[1];
		assert.ok(calRequestId);
		harness.server.completeBrowserLeg(calRequestId!);
		harness.connectCallbacks.fire({ requestId: calRequestId!, ok: true });
		const calConnection = await connectingCal;
		calendarConnectionIds.set('google', calConnection.id);
		const calSessions = await harness.provider.getSessions(['calendar'], {
			account: { id: calConnection.id, label: calConnection.accountEmail! },
		});
		assert.deepStrictEqual(
			{
				calId: calConnection.id,
				stored: calendarConnectionIds.get('google'),
				calToken: calSessions.map(session => ({
					id: session.id,
					accessToken: session.accessToken,
					scopes: session.scopes,
				})),
			},
			{
				calId: 'conn-cal-2',
				stored: 'conn-cal-2',
				calToken: [{
					id: 'conn-cal-2',
					accessToken: 'token-conn-cal-2-calendar',
					scopes: ['calendar'],
				}],
			},
		);

		// 5. Disconnect mail B → list no longer includes it; email marks needsReconnect; calendar stays
		await harness.facade.disconnect(mailConnection.id);
		const afterDisconnect = await harness.facade.list({ provider: 'google' });
		const mailAfterDisconnect = await harness.provider.getSessions(['mail'], {
			account: { id: mailConnection.id, label: mailConnection.accountEmail! },
		});
		if (mailAfterDisconnect.length === 0) {
			emailByAccount.set('mailbox-1', {
				connectionId: mailConnection.id,
				authStatus: 'needsReconnect',
			});
		}
		assert.deepStrictEqual(
			{
				listedIds: afterDisconnect.map(connection => connection.id),
				deletes: harness.server.deletes,
				emailStatus: emailByAccount.get('mailbox-1')?.authStatus,
				calendarStillStored: calendarConnectionIds.get('google'),
				mailSessions: mailAfterDisconnect.length,
			},
			{
				listedIds: ['conn-cal-2'],
				deletes: ['conn-mail-1'],
				emailStatus: 'needsReconnect',
				calendarStillStored: 'conn-cal-2',
				mailSessions: 0,
			},
		);

		// 6. Cloud sign-out clears in-memory tokens but does NOT DELETE remaining connections
		const deletesBeforeSignOut = harness.server.deletes.length;
		harness.server.cloudSignedIn = false;
		harness.cloudSessions.fire({
			added: [],
			removed: [{
				id: 'cloud-user-a',
				accessToken: 'cloud-jwt',
				account: { id: 'cloud-user-a', label: 'lawyer@firm.com' },
				scopes: [],
			}],
			changed: [],
		});
		const sessionsWhileSignedOut = await harness.provider.getSessions(['calendar']);
		assert.deepStrictEqual(
			{
				sessionsWhileSignedOut: sessionsWhileSignedOut.length,
				deletesDuringSignOut: harness.server.deletes.length - deletesBeforeSignOut,
			},
			{ sessionsWhileSignedOut: 0, deletesDuringSignOut: 0 },
		);

		// Sign-in again: remaining connection C is still on the server; remint works
		harness.server.cloudSignedIn = true;
		const listedAfterSignIn = await harness.facade.list({ provider: 'google' });
		const reminted = await harness.provider.getSessions(['calendar'], {
			account: { id: calConnection.id, label: calConnection.accountEmail! },
		});
		assert.deepStrictEqual(
			{
				listedAfterSignIn: listedAfterSignIn.map(connection => connection.id),
				reminted: reminted.map(session => ({
					id: session.id,
					accessToken: session.accessToken,
				})),
				totalDeletes: harness.server.deletes,
			},
			{
				listedAfterSignIn: ['conn-cal-2'],
				reminted: [{
					id: 'conn-cal-2',
					accessToken: 'token-conn-cal-2-calendar',
				}],
				totalDeletes: ['conn-mail-1'],
			},
		);

		harness.provider.dispose();
		harness.manager.dispose();
	});

	test('facade parseConnectOptions accepts mail/calendar connect args and rejects junk', () => {
		assert.deepStrictEqual(
			{
				mail: parseConnectOptions({ provider: 'google', capabilities: ['mail'] }),
				calendar: parseConnectOptions({
					provider: 'microsoft',
					capabilities: ['calendar'],
					loginHint: 'jane@outlook.com',
				}),
				noProvider: parseConnectOptions({ capabilities: ['mail'] }),
				noCaps: parseConnectOptions({ provider: 'google', capabilities: [] }),
				notObject: parseConnectOptions('google'),
			},
			{
				mail: { provider: 'google', capabilities: ['mail'], loginHint: undefined },
				calendar: {
					provider: 'microsoft',
					capabilities: ['calendar'],
					loginHint: 'jane@outlook.com',
				},
				noProvider: undefined,
				noCaps: undefined,
				notObject: undefined,
			},
		);
	});
});

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type {
	AuthenticationProviderAuthenticationSessionsChangeEvent,
	AuthenticationSession,
	Disposable,
	Event,
} from 'vscode';
import type { ConnectionsGateway } from '../connectionAuthProvider';
import type { ConnectionChangeEvent, ConnectOptions } from '../connectionManager';
import type {
	ConnectionCapability,
	ConnectionInfo,
	ConnectionTokenResult,
} from '../connectionsApi';
import { GoogleAuthProvider } from '../googleAuthProvider';
import { MicrosoftAuthProvider } from '../microsoftAuthProvider';
import {
	capabilitiesFromGrantedScope,
	inferProviderCapabilities,
	isReconnectRequiredError,
	ProviderTokenScopeError,
	scopesForCapabilities,
	sessionSatisfiesCapabilities,
} from '../providerCapabilities';

/** Google's granted scope for a full mailbox consent. */
const MAIL_GRANT = 'openid https://www.googleapis.com/auth/userinfo.email https://mail.google.com/';

/** Google's granted scope for an identity-only consent. */
const IDENTITY_ONLY_GRANT = 'openid https://www.googleapis.com/auth/userinfo.email';

const NOW_SECONDS = 1_700_000_000;
const EXPIRES_AT = NOW_SECONDS + 3600;

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

function connection(overrides: Partial<ConnectionInfo> & Pick<ConnectionInfo, 'id'>): ConnectionInfo {
	return {
		provider: 'google',
		accountEmail: `${overrides.id}@example.com`,
		accountLabel: null,
		capabilities: ['mail'],
		status: 'active',
		source: 'connect',
		grantedScopes: MAIL_GRANT,
		...overrides,
	};
}

interface GatewayHarness {
	readonly gateway: ConnectionsGateway;
	readonly mints: Array<{ connectionId: string; capability: ConnectionCapability }>;
	readonly connects: ConnectOptions[];
	readonly cloudSessions: { fire(data: AuthenticationProviderAuthenticationSessionsChangeEvent): void };
	readonly connectionChanges: { fire(data: ConnectionChangeEvent): void };
	readonly onDidChangeCloudSessions: Event<AuthenticationProviderAuthenticationSessionsChangeEvent>;
	setSignedOut(signedOut: boolean): void;
}

function makeGateway(options: {
	connections?: ConnectionInfo[];
	scope?: string | undefined;
	connected?: ConnectionInfo;
	expiresAt?: number;
	mintFails?: () => Error | undefined;
} = {}): GatewayHarness {
	const cloudSessions = createEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();
	const connectionChanges = createEmitter<ConnectionChangeEvent>();
	const mints: Array<{ connectionId: string; capability: ConnectionCapability }> = [];
	const connects: ConnectOptions[] = [];
	const connections = [...(options.connections ?? [])];
	let signedOut = false;

	const gateway: ConnectionsGateway = {
		list: async () => {
			if (signedOut) {
				throw new Error('Session expired. Please sign in again.');
			}
			return [...connections];
		},
		connect: async (connectOptions: ConnectOptions) => {
			connects.push(connectOptions);
			const created = options.connected ?? connection({ id: 'conn-new' });
			connections.push(created);
			return created;
		},
		mintToken: async (
			connectionId: string,
			capability: ConnectionCapability,
		): Promise<ConnectionTokenResult> => {
			mints.push({ connectionId, capability });
			const failure = options.mintFails?.();
			if (failure) {
				throw failure;
			}
			return {
				connectionId,
				capability,
				accessToken: `token-${connectionId}`,
				expiresAt: options.expiresAt ?? EXPIRES_AT,
				scope: 'scope' in options ? options.scope : MAIL_GRANT,
			};
		},
		onDidChangeConnections: connectionChanges.event,
	};

	return {
		gateway,
		mints,
		connects,
		cloudSessions,
		connectionChanges,
		onDidChangeCloudSessions: cloudSessions.event,
		setSignedOut(next) {
			signedOut = next;
		},
	};
}

function makeGoogleProvider(harness: GatewayHarness) {
	const sessionEvents: AuthenticationProviderAuthenticationSessionsChangeEvent[] = [];
	const provider = new GoogleAuthProvider({
		register: false,
		connections: harness.gateway,
		onDidChangeCloudSessions: harness.onDidChangeCloudSessions,
		output: { appendLine: () => { /* test stub */ } },
		nowSeconds: () => NOW_SECONDS,
	});
	provider.onDidChangeSessions(event => sessionEvents.push(event));
	return { provider, sessionEvents };
}

function describeSessions(sessions: readonly AuthenticationSession[]) {
	return sessions.map(session => ({
		id: session.id,
		accessToken: session.accessToken,
		account: session.account,
		scopes: session.scopes,
	}));
}

suite('provider capability helpers', () => {
	test('maps the mail/calendar convention across both providers', () => {
		assert.deepStrictEqual(
			{
				empty: [...inferProviderCapabilities([])],
				mail: [...inferProviderCapabilities(['mail'])],
				both: [...inferProviderCapabilities(['mail', 'calendar'])].sort(),
				gmailUri: [...inferProviderCapabilities(['https://mail.google.com/'])],
				exchangeUri: [...inferProviderCapabilities(['https://outlook.office.com/IMAP.AccessAsUser.All'])],
				unknown: [...inferProviderCapabilities(['openid', 'profile'])],
				scopes: scopesForCapabilities(new Set<ConnectionCapability>(['calendar', 'mail'])),
			},
			{
				empty: ['mail'],
				mail: ['mail'],
				both: ['calendar', 'mail'],
				gmailUri: ['mail'],
				exchangeUri: ['mail'],
				unknown: [],
				scopes: ['mail', 'calendar'],
			},
		);
	});

	test('reads granted scopes per provider and reports unknown when absent', () => {
		assert.deepStrictEqual(
			{
				googleMail: [...capabilitiesFromGrantedScope('google', MAIL_GRANT)!],
				googleIdentityOnly: [...capabilitiesFromGrantedScope('google', IDENTITY_ONLY_GRANT)!],
				microsoftMail: [...capabilitiesFromGrantedScope(
					'microsoft',
					'openid offline_access https://outlook.office.com/IMAP.AccessAsUser.All',
				)!],
				microsoftCalendar: [...capabilitiesFromGrantedScope(
					'microsoft',
					'openid https://graph.microsoft.com/Calendars.ReadWrite',
				)!],
				missing: capabilitiesFromGrantedScope('google', undefined),
				satisfied: sessionSatisfiesCapabilities(new Set(['mail', 'calendar']), new Set(['mail'])),
				unsatisfied: sessionSatisfiesCapabilities(new Set(['mail']), new Set(['calendar'])),
				reconnect: isReconnectRequiredError(new ProviderTokenScopeError(['mail'])),
				notReconnect: isReconnectRequiredError(new Error('network down')),
			},
			{
				googleMail: ['mail'],
				googleIdentityOnly: [],
				microsoftMail: ['mail'],
				microsoftCalendar: ['calendar'],
				missing: undefined,
				satisfied: true,
				unsatisfied: false,
				reconnect: true,
				notReconnect: false,
			},
		);
	});
});

suite('GoogleAuthProvider (service connections)', () => {
	test('serves one session per connected mailbox and reuses cached tokens', async () => {
		const harness = makeGateway({
			connections: [connection({ id: 'conn-1' }), connection({ id: 'conn-2' })],
		});
		const { provider } = makeGoogleProvider(harness);

		const first = await provider.getSessions(['mail']);
		const second = await provider.getSessions(['mail']);

		assert.deepStrictEqual(
			{ first: describeSessions(first), repeatMintCount: harness.mints.length, sameTokens: describeSessions(second) },
			{
				first: [
					{
						id: 'conn-1',
						accessToken: 'token-conn-1',
						account: { id: 'conn-1', label: 'conn-1@example.com' },
						scopes: ['mail'],
					},
					{
						id: 'conn-2',
						accessToken: 'token-conn-2',
						account: { id: 'conn-2', label: 'conn-2@example.com' },
						scopes: ['mail'],
					},
				],
				repeatMintCount: 2,
				sameTokens: describeSessions(first),
			},
		);
		provider.dispose();
	});

	test('account option selects which connection is served', async () => {
		const harness = makeGateway({
			connections: [
				connection({ id: 'conn-1', providerAccountId: 'google-1' }),
				connection({ id: 'conn-2', providerAccountId: 'google-2' }),
			],
		});
		const { provider } = makeGoogleProvider(harness);

		const sessions = await provider.getSessions(['mail'], {
			account: { id: 'google-2', label: 'conn-2@example.com' },
		});

		assert.deepStrictEqual(describeSessions(sessions), [{
			id: 'conn-2',
			accessToken: 'token-conn-2',
			account: { id: 'google-2', label: 'conn-2@example.com' },
			scopes: ['mail'],
		}]);
		provider.dispose();
	});

	test('a calendar request skips mail-only connections', async () => {
		const harness = makeGateway({ connections: [connection({ id: 'conn-1' })] });
		const { provider } = makeGoogleProvider(harness);
		assert.deepStrictEqual(
			{ sessions: await provider.getSessions(['calendar']), mints: harness.mints },
			{ sessions: [], mints: [] },
		);
		provider.dispose();
	});

	test('a token minted without the Gmail scope is refused, not cached', async () => {
		const harness = makeGateway({
			connections: [connection({ id: 'conn-1' })],
			scope: IDENTITY_ONLY_GRANT,
		});
		const { provider } = makeGoogleProvider(harness);
		assert.deepStrictEqual(
			{ sessions: await provider.getSessions(['mail']), mints: harness.mints.length },
			{ sessions: [], mints: 1 },
		);
		provider.dispose();
	});

	test('createSession connects a new account when none can serve the request', async () => {
		const harness = makeGateway({
			connections: [],
			connected: connection({ id: 'conn-new', capabilities: ['mail', 'calendar'] }),
		});
		const { provider } = makeGoogleProvider(harness);

		const session = await provider.createSession(['mail']);

		assert.deepStrictEqual(
			{
				session: describeSessions([session])[0],
				connects: harness.connects,
				mints: harness.mints,
			},
			{
				session: {
					id: 'conn-new',
					accessToken: 'token-conn-new',
					account: { id: 'conn-new', label: 'conn-new@example.com' },
					scopes: ['mail'],
				},
				connects: [{ provider: 'google', capabilities: ['mail'], loginHint: undefined }],
				mints: [{ connectionId: 'conn-new', capability: 'mail' }],
			},
		);
		provider.dispose();
	});

	test('createSession reuses an existing connection instead of prompting', async () => {
		const harness = makeGateway({ connections: [connection({ id: 'conn-1' })] });
		const { provider } = makeGoogleProvider(harness);
		const session = await provider.createSession(['mail']);
		assert.deepStrictEqual(
			{ id: session.id, connects: harness.connects },
			{ id: 'conn-1', connects: [] },
		);
		provider.dispose();
	});

	test('an expired cached token is re-minted', async () => {
		const harness = makeGateway({
			connections: [connection({ id: 'conn-1' })],
			expiresAt: NOW_SECONDS + 30,
		});
		const { provider } = makeGoogleProvider(harness);
		await provider.getSessions(['mail']);
		await provider.getSessions(['mail']);
		assert.strictEqual(harness.mints.length, 2);
		provider.dispose();
	});

	test('Cloud sign-out drops cached tokens and stops serving sessions', async () => {
		const harness = makeGateway({ connections: [connection({ id: 'conn-1' })] });
		const { provider, sessionEvents } = makeGoogleProvider(harness);
		await provider.getSessions(['mail']);

		harness.setSignedOut(true);
		harness.cloudSessions.fire({
			added: [],
			removed: [{
				id: 'user-1',
				accessToken: 'cloud-jwt',
				account: { id: 'user-1', label: 'lawyer@example.com' },
				scopes: [],
			}],
			changed: [],
		});

		assert.deepStrictEqual(
			{
				sessions: await provider.getSessions(['mail']),
				removedIds: sessionEvents.flatMap(event => (event.removed ?? []).map(s => s.id)),
			},
			{ sessions: [], removedIds: ['conn-1'] },
		);
		provider.dispose();
	});

	test('disconnecting a connection removes its session', async () => {
		const harness = makeGateway({ connections: [connection({ id: 'conn-1' })] });
		const { provider, sessionEvents } = makeGoogleProvider(harness);
		await provider.getSessions(['mail']);

		harness.connectionChanges.fire({ added: [], removed: ['conn-1'] });

		assert.deepStrictEqual(
			sessionEvents.flatMap(event => (event.removed ?? []).map(s => s.id)),
			['conn-1'],
		);
		provider.dispose();
	});
});

suite('MicrosoftAuthProvider (service connections)', () => {
	test('serves a mail connection and refuses a combined mail + calendar request', async () => {
		const harness = makeGateway({
			connections: [connection({
				id: 'ms-1',
				provider: 'microsoft',
				capabilities: ['mail'],
				grantedScopes: 'https://outlook.office.com/IMAP.AccessAsUser.All',
			})],
			scope: 'openid offline_access https://outlook.office.com/IMAP.AccessAsUser.All',
		});
		const provider = new MicrosoftAuthProvider({
			register: false,
			connections: harness.gateway,
			onDidChangeCloudSessions: harness.onDidChangeCloudSessions,
			output: { appendLine: () => { /* test stub */ } },
			nowSeconds: () => NOW_SECONDS,
		});

		assert.deepStrictEqual(
			{
				mail: describeSessions(await provider.getSessions(['mail'])),
				both: await provider.getSessions(['mail', 'calendar']),
			},
			{
				mail: [{
					id: 'ms-1',
					accessToken: 'token-ms-1',
					account: { id: 'ms-1', label: 'ms-1@example.com' },
					scopes: ['mail'],
				}],
				both: [],
			},
		);
		provider.dispose();
	});
});

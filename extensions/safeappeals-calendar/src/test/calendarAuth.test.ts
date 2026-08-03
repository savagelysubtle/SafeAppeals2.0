/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import {
	CalendarNotConnectedError,
	CalendarReconnectRequiredError,
	CalendarTokenSource,
	clearLegacyCalendarTokens,
	connectCalendarAccount,
	connectionIdFromSession,
	hasLegacyCalendarTokens,
	sessionGrantsCalendarScope,
	type CalendarAuthSession,
	type CalendarSessionGetter,
} from '../calendarAuth';
import type { CalendarConnectionInfo } from '../connectionsBridge';
import type { CalendarProvider } from '../types';

interface SessionCall {
	providerId: string;
	scopes: readonly string[];
	createIfNone: boolean;
	accountId: string | undefined;
	accountLabel: string | undefined;
}

function recordingGetSession(
	respond: (call: SessionCall) => CalendarAuthSession | undefined,
): { getSession: CalendarSessionGetter; calls: SessionCall[] } {
	const calls: SessionCall[] = [];
	const getSession: CalendarSessionGetter = async (providerId, scopes, options) => {
		const call: SessionCall = {
			providerId,
			scopes: [...scopes],
			createIfNone: options.createIfNone,
			accountId: options.account?.id,
			accountLabel: options.account?.label,
		};
		calls.push(call);
		return respond(call);
	};
	return { getSession, calls };
}

function tokenSource(
	connections: Partial<Record<CalendarProvider, string>>,
	getSession: CalendarSessionGetter,
): CalendarTokenSource {
	return new CalendarTokenSource({
		connectionIdFor: (provider) => connections[provider],
		getSession,
	});
}

/** In-memory SecretStorage for the legacy-token cleanup tests. */
class FakeSecretStorage implements vscode.SecretStorage {
	private readonly values = new Map<string, string>();
	private readonly emitter = new vscode.EventEmitter<vscode.SecretStorageChangeEvent>();
	readonly onDidChange = this.emitter.event;

	constructor(entries: Record<string, string> = {}) {
		for (const [key, value] of Object.entries(entries)) {
			this.values.set(key, value);
		}
	}

	async get(key: string): Promise<string | undefined> {
		return this.values.get(key);
	}

	async store(key: string, value: string): Promise<void> {
		this.values.set(key, value);
	}

	async delete(key: string): Promise<void> {
		this.values.delete(key);
	}

	async keys(): Promise<string[]> {
		return [...this.values.keys()];
	}
}

const GOOGLE_CONNECTION: CalendarConnectionInfo = {
	id: 'conn-1',
	provider: 'google',
	accountEmail: 'jane@gmail.com',
	capabilities: ['calendar'],
	status: 'active',
};

suite('calendar auth', () => {
	test('session scope and connection id are read from the A3 contract', () => {
		assert.deepStrictEqual(
			{
				sentinel: sessionGrantsCalendarScope(['calendar']),
				googleScopeUri: sessionGrantsCalendarScope([
					'https://www.googleapis.com/auth/calendar.events',
				]),
				graphScopeUri: sessionGrantsCalendarScope([
					'https://graph.microsoft.com/calendars.readwrite',
				]),
				mailOnly: sessionGrantsCalendarScope(['mail']),
				empty: sessionGrantsCalendarScope([]),
				connectionId: connectionIdFromSession({ id: 'conn-1' }),
				blankId: connectionIdFromSession({ id: '  ' }),
				noSession: connectionIdFromSession(undefined),
			},
			{
				sentinel: true,
				googleScopeUri: true,
				graphScopeUri: true,
				mailOnly: false,
				empty: false,
				connectionId: 'conn-1',
				blankId: undefined,
				noSession: undefined,
			},
		);
	});

	test('token source mints silently for the connection a provider syncs against', async () => {
		const { getSession, calls } = recordingGetSession((call) => ({
			id: call.accountId,
			accessToken: `token-for-${call.accountId}`,
			scopes: ['calendar'],
		}));
		const source = tokenSource({ google: 'conn-1', outlook: 'conn-2' }, getSession);

		assert.deepStrictEqual(
			{
				google: await source.getAccessToken('google'),
				outlook: await source.getAccessToken('outlook'),
				calls,
			},
			{
				google: 'token-for-conn-1',
				outlook: 'token-for-conn-2',
				calls: [
					{
						providerId: 'safeappeals-google',
						scopes: ['calendar'],
						createIfNone: false,
						accountId: 'conn-1',
						accountLabel: 'conn-1',
					},
					{
						providerId: 'safeappeals-microsoft',
						scopes: ['calendar'],
						createIfNone: false,
						accountId: 'conn-2',
						accountLabel: 'conn-2',
					},
				],
			},
		);
	});

	test('token source refuses to guess when no connection can serve the calendar', async () => {
		const notConnected = tokenSource({}, recordingGetSession(() => undefined).getSession);
		const noSession = tokenSource({ google: 'conn-1' }, recordingGetSession(() => undefined).getSession);
		const otherConnection = tokenSource(
			{ google: 'conn-1' },
			recordingGetSession(() => ({ id: 'conn-other', accessToken: 'ya29.token' })).getSession,
		);
		const throws = tokenSource({ google: 'conn-1' }, async () => {
			throw new Error('provider token unavailable');
		});

		await assert.rejects(notConnected.getAccessToken('google'), CalendarNotConnectedError);
		await assert.rejects(noSession.getAccessToken('google'), CalendarReconnectRequiredError);
		await assert.rejects(otherConnection.getAccessToken('google'), CalendarReconnectRequiredError);
		await assert.rejects(throws.getAccessToken('google'), CalendarReconnectRequiredError);
	});

	test('connecting proves the new connection mints a calendar token', async () => {
		const { getSession, calls } = recordingGetSession((call) => ({
			id: call.accountId,
			accessToken: 'ya29.calendar',
			scopes: ['calendar'],
		}));
		const connected = await connectCalendarAccount('google', {
			connect: async () => GOOGLE_CONNECTION,
			getSession,
		});

		assert.deepStrictEqual(
			{ connected, calls },
			{
				connected: GOOGLE_CONNECTION,
				calls: [
					{
						providerId: 'safeappeals-google',
						scopes: ['calendar'],
						createIfNone: true,
						accountId: 'conn-1',
						accountLabel: 'jane@gmail.com',
					},
				],
			},
		);
	});

	test('connecting fails on an identity-only grant or a token from another connection', async () => {
		const identityOnly = connectCalendarAccount('google', {
			connect: async () => GOOGLE_CONNECTION,
			getSession: async () => ({ id: 'conn-1', accessToken: 'ya29.token', scopes: ['mail'] }),
		});
		const wrongConnection = connectCalendarAccount('google', {
			connect: async () => GOOGLE_CONNECTION,
			getSession: async () => ({
				id: 'conn-other',
				accessToken: 'ya29.token',
				scopes: ['calendar'],
			}),
		});

		await assert.rejects(identityOnly, /calendar access/i);
		await assert.rejects(wrongConnection, /did not match/i);
	});

	test('V1 consumer: connect stores connectionId C, mint ok, disconnect leaves calendar disconnected', async () => {
		/**
		 * Manual smoke (calendar half of Service Connections V1):
		 * After Cloud A is signed in, connect Google Calendar C; mint; disconnect clears
		 * the local connectionId so sync refuses until reconnect (server DELETE is separate).
		 */
		const connectionIds: Partial<Record<CalendarProvider, string>> = {};
		const { getSession, calls } = recordingGetSession((call) => ({
			id: call.accountId,
			accessToken: `token-for-${call.accountId}`,
			scopes: ['calendar'],
		}));

		const connected = await connectCalendarAccount('google', {
			connect: async () => GOOGLE_CONNECTION,
			getSession,
		});
		connectionIds.google = connected.id;

		const source = tokenSource(connectionIds, getSession);
		const minted = await source.getAccessToken('google');

		// Disconnect locally (mirrors SyncEngine.disconnect clearing the cache binding).
		delete connectionIds.google;
		const disconnectedSource = tokenSource(connectionIds, getSession);

		await assert.rejects(disconnectedSource.getAccessToken('google'), CalendarNotConnectedError);

		assert.deepStrictEqual(
			{
				connectedId: connected.id,
				minted,
				createIfNone: calls[0]?.createIfNone,
				silentAccount: calls[1]?.accountId,
			},
			{
				connectedId: 'conn-1',
				minted: 'token-for-conn-1',
				createIfNone: true,
				silentAccount: 'conn-1',
			},
		);
	});

	test('legacy loopback tokens are detected and purged', async () => {
		const legacy = new FakeSecretStorage({
			'safeappeals-calendar.google.tokens': '{"accessToken":"ya29.old"}',
			'safeappeals-calendar.dek.eventCache': 'keep-me',
		});
		const clean = new FakeSecretStorage({ 'safeappeals-calendar.dek.eventCache': 'keep-me' });

		const foundLegacy = await hasLegacyCalendarTokens(legacy);
		await clearLegacyCalendarTokens(legacy);

		assert.deepStrictEqual(
			{
				foundLegacy,
				foundClean: await hasLegacyCalendarTokens(clean),
				remaining: await legacy.keys(),
			},
			{
				foundLegacy: true,
				foundClean: false,
				remaining: ['safeappeals-calendar.dek.eventCache'],
			},
		);
	});
});

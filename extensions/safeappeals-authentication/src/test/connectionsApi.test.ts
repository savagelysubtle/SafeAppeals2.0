/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { OutputChannel } from 'vscode';
import { CloudApiClient, DEFAULT_API_URL } from '../api';
import {
	buildConnectionListQuery,
	connectionHasCapability,
	normalizeCapabilities,
	parseConnectionInfo,
	parseConnectionList,
	providerSupportsCapabilityBundle,
} from '../connectionsApi';

/** One server-shaped connection record. */
const SERVER_CONNECTION = {
	id: 'conn-1',
	provider: 'google',
	accountEmail: 'lawyer@example.com',
	accountLabel: 'lawyer@example.com',
	capabilities: ['mail', 'calendar'],
	status: 'active',
	source: 'connect',
	grantedScopes: 'openid https://mail.google.com/',
	lastMintedAt: null,
	lastErrorCode: null,
	createdAt: '2026-08-01T00:00:00.000Z',
	updatedAt: '2026-08-02T00:00:00.000Z',
};

interface RecordedCall {
	readonly url: string;
	readonly method: string | undefined;
	readonly authorization: string | undefined;
	readonly body: string | undefined;
}

/**
 * Runs `work` with `fetch` replaced by a queue of canned responses.
 */
async function withFetch<T>(
	responses: ReadonlyArray<{ status?: number; body: unknown }>,
	work: (client: CloudApiClient, calls: RecordedCall[]) => Promise<T>,
): Promise<T> {
	const calls: RecordedCall[] = [];
	const originalFetch = globalThis.fetch;
	let index = 0;
	globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const headers = init?.headers as Record<string, string> | undefined;
		calls.push({
			url: String(input),
			method: init?.method,
			authorization: headers?.['Authorization'],
			body: typeof init?.body === 'string' ? init.body : undefined,
		});
		const canned = responses[Math.min(index, responses.length - 1)];
		index += 1;
		return new Response(JSON.stringify(canned.body), {
			status: canned.status ?? 200,
			headers: { 'Content-Type': 'application/json' },
		});
	}) as typeof fetch;

	const output = { appendLine: (_line: string) => { /* test stub */ } } as OutputChannel;
	const client = new CloudApiClient(output, () => 'cloud-access', async () => false);
	try {
		return await work(client, calls);
	} finally {
		globalThis.fetch = originalFetch;
	}
}

suite('connections API helpers', () => {
	test('normalizes capabilities, bundles, and list queries', () => {
		assert.deepStrictEqual(
			{
				normalized: normalizeCapabilities(['mail', 'mail', 'calendar', 'drive', 'files']),
				empty: normalizeCapabilities(['drive']),
				googleBundle: providerSupportsCapabilityBundle('google', ['mail', 'calendar']),
				googleFiles: providerSupportsCapabilityBundle('google', ['files']),
				googleMailFiles: providerSupportsCapabilityBundle('google', ['mail', 'files']),
				microsoftBundle: providerSupportsCapabilityBundle('microsoft', ['mail', 'calendar']),
				microsoftSingle: providerSupportsCapabilityBundle('microsoft', ['mail']),
				microsoftFiles: providerSupportsCapabilityBundle('microsoft', ['files']),
				microsoftGraphBundle: providerSupportsCapabilityBundle('microsoft', ['calendar', 'files']),
				slackMessaging: providerSupportsCapabilityBundle('slack', ['messaging']),
				slackFiles: providerSupportsCapabilityBundle('slack', ['files']),
				slackBundle: providerSupportsCapabilityBundle('slack', ['messaging', 'files']),
				slackMailRejected: providerSupportsCapabilityBundle('slack', ['mail']),
				slackCalendarRejected: providerSupportsCapabilityBundle('slack', ['calendar']),
				query: buildConnectionListQuery({ provider: 'google', capability: 'mail' }),
				noQuery: buildConnectionListQuery(undefined),
			},
			{
				normalized: ['mail', 'calendar', 'files'],
				empty: [],
				googleBundle: true,
				googleFiles: true,
				googleMailFiles: true,
				microsoftBundle: false,
				microsoftSingle: true,
				microsoftFiles: true,
				microsoftGraphBundle: true,
				slackMessaging: true,
				slackFiles: true,
				slackBundle: true,
				slackMailRejected: false,
				slackCalendarRejected: false,
				query: '?provider=google&capability=mail',
				noQuery: '',
			},
		);
	});

	test('parses server records and rejects unusable ones', () => {
		assert.deepStrictEqual(
			{
				parsed: parseConnectionInfo(SERVER_CONNECTION),
				noProvider: parseConnectionInfo({ ...SERVER_CONNECTION, provider: 'dropbox' }),
				noId: parseConnectionInfo({ ...SERVER_CONNECTION, id: '' }),
				list: parseConnectionList({ connections: [SERVER_CONNECTION, { id: 'bad' }] }).map(c => c.id),
				revokedHasNoCapability: connectionHasCapability(
					parseConnectionInfo({ ...SERVER_CONNECTION, status: 'revoked' })!,
					'mail',
				),
			},
			{
				parsed: {
					id: 'conn-1',
					provider: 'google',
					accountEmail: 'lawyer@example.com',
					accountLabel: 'lawyer@example.com',
					capabilities: ['mail', 'calendar'],
					status: 'active',
					source: 'connect',
					grantedScopes: 'openid https://mail.google.com/',
					providerAccountId: null,
					lastMintedAt: null,
					lastErrorCode: null,
					createdAt: '2026-08-01T00:00:00.000Z',
					updatedAt: '2026-08-02T00:00:00.000Z',
				},
				noProvider: undefined,
				noId: undefined,
				list: ['conn-1'],
				revokedHasNoCapability: false,
			},
		);
	});
});

suite('CloudApiClient connections', () => {
	test('startConnection POSTs provider + capabilities with the Cloud bearer', async () => {
		const result = await withFetch(
			[{ body: { requestId: 'req-1', authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' } }],
			async (client, calls) => ({
				started: await client.startConnection({ provider: 'google', capabilities: ['mail'] }),
				calls,
			}),
		);
		assert.deepStrictEqual(result, {
			started: {
				requestId: 'req-1',
				authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1',
			},
			calls: [{
				url: `${DEFAULT_API_URL}/connections/start`,
				method: 'POST',
				authorization: 'Bearer cloud-access',
				body: JSON.stringify({ provider: 'google', capabilities: ['mail'] }),
			}],
		});
	});

	test('tryClaimConnection returns undefined while the browser leg is open', async () => {
		const result = await withFetch(
			[{
				status: 409,
				body: { error: { code: 'CONNECTION_NOT_READY', message: 'This connection has not completed yet' } },
			}],
			async client => client.tryClaimConnection('req-1'),
		);
		assert.strictEqual(result, undefined);
	});

	test('tryClaimConnection rethrows a real failure', async () => {
		const message = await withFetch(
			[{ status: 404, body: { error: { code: 'CONNECTION_REQUEST_NOT_FOUND', message: 'Connection request not found' } } }],
			async client => client.tryClaimConnection('req-1').then(() => 'resolved', (error: Error) => error.message),
		);
		assert.strictEqual(message, 'Connection request not found');
	});

	test('claimConnection returns parsed metadata', async () => {
		const claimed = await withFetch(
			[{ body: { connection: SERVER_CONNECTION } }],
			async client => client.claimConnection('req-1'),
		);
		assert.deepStrictEqual(
			{ id: claimed.id, capabilities: claimed.capabilities, email: claimed.accountEmail },
			{ id: 'conn-1', capabilities: ['mail', 'calendar'], email: 'lawyer@example.com' },
		);
	});

	test('listConnections passes the filter as query params', async () => {
		const result = await withFetch(
			[{ body: { connections: [SERVER_CONNECTION] } }],
			async (client, calls) => ({
				ids: (await client.listConnections({ provider: 'google', capability: 'mail' })).map(c => c.id),
				url: calls[0].url,
				method: calls[0].method,
			}),
		);
		assert.deepStrictEqual(result, {
			ids: ['conn-1'],
			url: `${DEFAULT_API_URL}/connections?provider=google&capability=mail`,
			method: 'GET',
		});
	});

	test('mintConnectionToken posts the capability and returns the access token only', async () => {
		const result = await withFetch(
			[{
				body: {
					connectionId: 'conn-1',
					capability: 'mail',
					accessToken: 'provider-access',
					expiresAt: 1_700_003_600,
					scope: 'openid https://mail.google.com/',
					accountEmail: 'lawyer@example.com',
				},
			}],
			async (client, calls) => ({
				minted: await client.mintConnectionToken('conn-1', 'mail'),
				call: calls[0],
			}),
		);
		assert.deepStrictEqual(result, {
			minted: {
				connectionId: 'conn-1',
				capability: 'mail',
				accessToken: 'provider-access',
				expiresAt: 1_700_003_600,
				scope: 'openid https://mail.google.com/',
				accountEmail: 'lawyer@example.com',
			},
			call: {
				url: `${DEFAULT_API_URL}/connections/conn-1/token`,
				method: 'POST',
				authorization: 'Bearer cloud-access',
				body: JSON.stringify({ capability: 'mail' }),
			},
		});
	});

	test('deleteConnection issues DELETE on the encoded id', async () => {
		const call = await withFetch(
			[{ body: { deleted: true } }],
			async (client, calls) => {
				await client.deleteConnection('conn/1');
				return calls[0];
			},
		);
		assert.deepStrictEqual(call, {
			url: `${DEFAULT_API_URL}/connections/conn%2F1`,
			method: 'DELETE',
			authorization: 'Bearer cloud-access',
			body: undefined,
		});
	});
});

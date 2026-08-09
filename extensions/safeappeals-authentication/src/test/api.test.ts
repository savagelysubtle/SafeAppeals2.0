/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { OutputChannel } from 'vscode';
import {
	buildGoogleAuthorizeUrl,
	CloudApiClient,
	DEFAULT_API_URL,
} from '../api';

suite('buildGoogleAuthorizeUrl', () => {
	const baseParams = {
		codeChallenge: 'challenge',
		state: 'state-1',
		redirectUri: 'http://127.0.0.1:0/callback',
	};

	test('sign-in carries PKCE only — no capability scopes or login hint', () => {
		const url = new URL(buildGoogleAuthorizeUrl(baseParams));
		assert.deepStrictEqual(
			{
				originPath: `${url.origin}${url.pathname}`,
				params: [...url.searchParams.entries()].sort(),
			},
			{
				originPath: `${DEFAULT_API_URL}/auth/google`,
				params: [
					['code_challenge', 'challenge'],
					['code_challenge_method', 'S256'],
					['redirect_uri', 'http://127.0.0.1:0/callback'],
					['state', 'state-1'],
				],
			},
		);
	});
});

suite('CloudApiClient.exchangeCode / refreshSession', () => {
	test('exchangeCode never persists provider tokens from the server response', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (): Promise<Response> => {
			return new Response(JSON.stringify({
				accessToken: 'cloud-access',
				refreshToken: 'cloud-refresh',
				expiresAt: 1_700_000_3600,
				user: {
					id: 'user-1',
					email: 'lawyer@example.com',
					displayName: 'Lawyer',
					avatarUrl: null,
				},
				// Stale/unused fields a pre-WP2 server might still return — must be dropped.
				googleProviderToken: 'should-not-store',
				googleProviderRefreshToken: 'should-not-store-refresh',
			}), { status: 200, headers: { 'Content-Type': 'application/json' } });
		}) as typeof fetch;

		const output = { appendLine: (_line: string) => { /* test stub */ } } as OutputChannel;
		const client = new CloudApiClient(output, () => undefined, async () => false);

		try {
			const envelope = await client.exchangeCode('code', 'verifier');
			assert.deepStrictEqual(
				{
					accessToken: envelope.accessToken,
					refreshToken: envelope.refreshToken,
					googleProviderToken: envelope.googleProviderToken,
					googleProviderRefreshToken: envelope.googleProviderRefreshToken,
				},
				{
					accessToken: 'cloud-access',
					refreshToken: 'cloud-refresh',
					googleProviderToken: null,
					googleProviderRefreshToken: null,
				},
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('refreshSession returns cloud tokens only (no provider fields)', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (): Promise<Response> => {
			return new Response(JSON.stringify({
				accessToken: 'new-access',
				refreshToken: 'new-refresh',
				expiresAt: 1_700_000_7200,
				googleProviderToken: 'should-not-return',
				googleProviderRefreshToken: 'should-not-return-refresh',
			}), { status: 200, headers: { 'Content-Type': 'application/json' } });
		}) as typeof fetch;

		const output = { appendLine: (_line: string) => { /* test stub */ } } as OutputChannel;
		const client = new CloudApiClient(output, () => undefined, async () => false);

		try {
			const refreshed = await client.refreshSession('cloud-refresh');
			assert.deepStrictEqual(refreshed, {
				accessToken: 'new-access',
				refreshToken: 'new-refresh',
				expiresAt: 1_700_000_7200,
			});
			assert.strictEqual('googleProviderToken' in refreshed, false);
			assert.strictEqual('googleProviderRefreshToken' in refreshed, false);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

suite('CloudApiClient.signOut', () => {
	test('posts with the explicit session token', async () => {
		const originalFetch = globalThis.fetch;
		let request: { url: string; method: string | undefined; authorization: string | null } | undefined;
		globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			request = {
				url: String(input),
				method: init?.method,
				authorization: new Headers(init?.headers).get('Authorization'),
			};
			return new Response(JSON.stringify({ success: true }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}) as typeof fetch;
		const output = { appendLine: (_line: string) => { /* test stub */ } } as OutputChannel;
		const client = new CloudApiClient(output, () => 'wrong-token', async () => false);

		try {
			await client.signOut('session-token');
			assert.deepStrictEqual(request, {
				url: `${DEFAULT_API_URL}/auth/sign-out`,
				method: 'POST',
				authorization: 'Bearer session-token',
			});
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('surfaces server revocation failure without retrying', async () => {
		const originalFetch = globalThis.fetch;
		let calls = 0;
		globalThis.fetch = (async (): Promise<Response> => {
			calls++;
			return new Response(JSON.stringify({ error: { message: 'revocation failed' } }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			});
		}) as typeof fetch;
		const output = { appendLine: (_line: string) => { /* test stub */ } } as OutputChannel;
		const client = new CloudApiClient(output, () => undefined, async () => false);

		try {
			await assert.rejects(client.signOut('session-token'), /revocation failed/);
			assert.strictEqual(calls, 1);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

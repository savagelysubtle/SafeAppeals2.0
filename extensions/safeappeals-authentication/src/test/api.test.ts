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

	test('plain sign-in omits mail and calendar scope flags', () => {
		const url = new URL(buildGoogleAuthorizeUrl(baseParams));
		assert.deepStrictEqual(
			{
				originPath: `${url.origin}${url.pathname}`,
				mail: url.searchParams.get('include_mail_scopes'),
				calendar: url.searchParams.get('include_calendar_scopes'),
				challenge: url.searchParams.get('code_challenge'),
				method: url.searchParams.get('code_challenge_method'),
				state: url.searchParams.get('state'),
				redirect: url.searchParams.get('redirect_uri'),
			},
			{
				originPath: `${DEFAULT_API_URL}/auth/google`,
				mail: null,
				calendar: null,
				challenge: 'challenge',
				method: 'S256',
				state: 'state-1',
				redirect: 'http://127.0.0.1:0/callback',
			},
		);
	});

	test('opt-in flags append include_mail_scopes and include_calendar_scopes', () => {
		const url = new URL(buildGoogleAuthorizeUrl({
			...baseParams,
			includeMailScopes: true,
			includeCalendarScopes: true,
		}));
		assert.deepStrictEqual(
			{
				mail: url.searchParams.get('include_mail_scopes'),
				calendar: url.searchParams.get('include_calendar_scopes'),
			},
			{
				mail: 'true',
				calendar: 'true',
			},
		);
	});

	test('login_hint is appended only when a non-empty email is supplied', () => {
		const withHint = new URL(buildGoogleAuthorizeUrl({
			...baseParams,
			includeMailScopes: true,
			loginHint: 'lawyer@example.com',
		}));
		const blankHint = new URL(buildGoogleAuthorizeUrl({ ...baseParams, loginHint: '  ' }));
		assert.deepStrictEqual(
			{
				withHint: withHint.searchParams.get('login_hint'),
				blankHint: blankHint.searchParams.get('login_hint'),
				omitted: new URL(buildGoogleAuthorizeUrl(baseParams)).searchParams.get('login_hint'),
			},
			{
				withHint: 'lawyer@example.com',
				blankHint: null,
				omitted: null,
			},
		);
	});

	test('falsey opt-in flags do not append query params', () => {
		const url = new URL(buildGoogleAuthorizeUrl({
			...baseParams,
			includeMailScopes: false,
			includeCalendarScopes: false,
		}));
		assert.deepStrictEqual(
			{
				mail: url.searchParams.get('include_mail_scopes'),
				calendar: url.searchParams.get('include_calendar_scopes'),
			},
			{
				mail: null,
				calendar: null,
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

suite('CloudApiClient.refreshProviderToken', () => {
	test('POSTs /auth/provider-token with Bearer cloud access and returns access only', async () => {
		const calls: Array<{ url: string; method: string | undefined; authorization: string | undefined; body: string | undefined }> = [];
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			const headers = init?.headers as Record<string, string> | undefined;
			calls.push({
				url: String(input),
				method: init?.method,
				authorization: headers?.['Authorization'],
				body: typeof init?.body === 'string' ? init.body : undefined,
			});
			return new Response(JSON.stringify({
				provider: 'google',
				accessToken: 'provider-access',
				expiresAt: 1_700_000_3600,
				scope: 'openid https://mail.google.com/',
			}), { status: 200, headers: { 'Content-Type': 'application/json' } });
		}) as typeof fetch;

		const output = { appendLine: (_line: string) => { /* test stub */ } } as OutputChannel;
		const client = new CloudApiClient(output, () => 'cloud-access', async () => false);

		try {
			const result = await client.refreshProviderToken('google');
			assert.deepStrictEqual(
				{
					result,
					calls,
				},
				{
					result: {
						provider: 'google',
						accessToken: 'provider-access',
						expiresAt: 1_700_000_3600,
						scope: 'openid https://mail.google.com/',
					},
					calls: [{
						url: `${DEFAULT_API_URL}/auth/provider-token`,
						method: 'POST',
						authorization: 'Bearer cloud-access',
						body: JSON.stringify({ provider: 'google' }),
					}],
				},
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('fills provider from request when S2 omits provider in the body', async () => {
		const originalFetch = globalThis.fetch;
		globalThis.fetch = (async (): Promise<Response> => {
			return new Response(JSON.stringify({
				accessToken: 'provider-access',
				expiresAt: 1_700_000_3600,
			}), { status: 200, headers: { 'Content-Type': 'application/json' } });
		}) as typeof fetch;

		const output = { appendLine: (_line: string) => { /* test stub */ } } as OutputChannel;
		const client = new CloudApiClient(output, () => 'cloud-access', async () => false);

		try {
			const result = await client.refreshProviderToken('google');
			// Legacy Cloud deployments omit `scope` — surfaced as undefined, never
			// as an implied mail grant.
			assert.deepStrictEqual(result, {
				provider: 'google',
				accessToken: 'provider-access',
				expiresAt: 1_700_000_3600,
				scope: undefined,
			});
		} finally {
			globalThis.fetch = originalFetch;
		}
	});
});

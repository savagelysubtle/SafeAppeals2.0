/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { OutputChannel } from 'vscode';
import {
	buildCloudIdentityAuthorizeUrl,
	buildGoogleAuthorizeUrl,
	buildMicrosoftAuthorizeUrl,
	CloudApiClient,
	DEFAULT_API_URL,
} from '../api';

suite('buildCloudIdentityAuthorizeUrl', () => {
	const baseParams = {
		codeChallenge: 'challenge',
		state: 'state-1',
		redirectUri: 'http://127.0.0.1:0/callback',
	};

	test('google sign-in carries PKCE only — no capability scopes or login hint', () => {
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

	test('microsoft sign-in uses /auth/microsoft with the same PKCE params', () => {
		const url = new URL(buildMicrosoftAuthorizeUrl(baseParams));
		assert.deepStrictEqual(
			{
				originPath: `${url.origin}${url.pathname}`,
				params: [...url.searchParams.entries()].sort(),
			},
			{
				originPath: `${DEFAULT_API_URL}/auth/microsoft`,
				params: [
					['code_challenge', 'challenge'],
					['code_challenge_method', 'S256'],
					['redirect_uri', 'http://127.0.0.1:0/callback'],
					['state', 'state-1'],
				],
			},
		);
		assert.strictEqual(
			buildCloudIdentityAuthorizeUrl({ ...baseParams, provider: 'microsoft' }).includes('/auth/microsoft'),
			true,
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

suite('CloudApiClient stable chat billing', () => {
	const run1 = '01700000-0000-4000-8000-000000000001';
	const run2 = '01700000-0000-4000-8000-000000000002';
	const run3 = '01700000-0000-4000-8000-000000000003';
	const run4 = '01700000-0000-4000-8000-000000000004';
	const body = { model: 'model-1', messages: [{ role: 'user' as const, content: 'hello' }] };
	const output = { appendLine: (_line: string) => { /* test stub */ } } as OutputChannel;

	test('reuses one idempotency key across auth refresh and ACKs after delivering all parts', async () => {
		const originalFetch = globalThis.fetch;
		let token = 'old-token';
		const requests: Array<{ path: string; key: string | null; authorization: string | null }> = [];
		const delivered: string[] = [];
		globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			const path = new URL(String(input)).pathname;
			const headers = new Headers(init?.headers);
			requests.push({ path, key: headers.get('Idempotency-Key'), authorization: headers.get('Authorization') });
			if (path.endsWith('/chat') && requests.filter(request => request.path.endsWith('/chat')).length === 1) {
				return new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } });
			}
			if (path.endsWith('/chat')) {
				return new Response(
					'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n'
					+ 'event: safeappeals.run.result_ready\n'
					+ `data: {"run_id":"${run1}","state":"result_ready","requires_ack":true}\n\n`
					+ 'data: [DONE]\n\n',
					{ status: 200, headers: { 'Content-Type': 'text/event-stream', 'x-safeappeals-run-id': run1 } },
				);
			}
			delivered.push('ack');
			return new Response(`{"status":"settled","run_id":"${run1}"}`, { status: 200, headers: { 'Content-Type': 'application/json' } });
		}) as typeof fetch;
		const client = new CloudApiClient(output, () => token, async () => { token = 'new-token'; return true; });
		try {
			await client.streamChat(body, part => delivered.push(part.kind === 'text' ? part.text : part.name));
			const chatRequests = requests.filter(request => request.path.endsWith('/chat'));
			assert.deepStrictEqual(
				{
					stableKey: chatRequests[0].key === chatRequests[1].key && !!chatRequests[0].key,
					authorizations: chatRequests.map(request => request.authorization),
					delivered,
				},
				{ stableKey: true, authorizations: ['Bearer old-token', 'Bearer new-token'], delivered: ['answer', 'ack'] },
			);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('recovers a pre-header network loss through same-key replay and run status without ACK', async () => {
		const originalFetch = globalThis.fetch;
		const keys: Array<string | null> = [];
		let chatCalls = 0;
		globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			const path = new URL(String(input)).pathname;
			if (path.endsWith('/chat')) {
				keys.push(new Headers(init?.headers).get('Idempotency-Key'));
				if (++chatCalls === 1) {
					throw new TypeError('headers lost');
				}
				return new Response(`{"run_id":"${run2}","state":"result_ready","replay":true}`, {
					status: 202,
					headers: { 'Content-Type': 'application/json', 'x-safeappeals-run-id': run2 },
				});
			}
			return new Response(`{"run_id":"${run2}","state":"result_ready"}`, {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}) as typeof fetch;
		const client = new CloudApiClient(output, () => 'token', async () => false);
		try {
			await assert.rejects(
				client.streamChat(body, () => assert.fail('a replay must not emit response parts')),
				/The model completed, but its response could not be recovered/,
			);
			assert.deepStrictEqual({ calls: chatCalls, stableKey: keys[0] === keys[1] && !!keys[0] }, { calls: 2, stableKey: true });
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('checks status after a lost ACK response and accepts an already settled run', async () => {
		const originalFetch = globalThis.fetch;
		const paths: string[] = [];
		globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
			const path = new URL(String(input)).pathname;
			paths.push(path);
			if (path.endsWith('/ack')) {
				throw new TypeError('response lost');
			}
			return new Response(`{"run_id":"${run2}","state":"settled"}`, {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}) as typeof fetch;
		const client = new CloudApiClient(output, () => 'token', async () => false);
		try {
			await client.acknowledgeLlmRun(run2);
			assert.deepStrictEqual(paths, [`/llm/runs/${run2}/ack`, `/llm/runs/${run2}`]);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('retries a lost ACK only after status confirms the same run is result-ready', async () => {
		const originalFetch = globalThis.fetch;
		const paths: string[] = [];
		let ackCalls = 0;
		globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
			const path = new URL(String(input)).pathname;
			paths.push(path);
			if (path.endsWith('/ack') && ++ackCalls === 1) {
				throw new TypeError('response lost');
			}
			return new Response(path.endsWith('/ack')
				? `{"status":"settled","run_id":"${run2}"}`
				: `{"run_id":"${run2}","state":"result_ready"}`, {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			});
		}) as typeof fetch;
		const client = new CloudApiClient(output, () => 'token', async () => false);
		try {
			await client.acknowledgeLlmRun(run2);
			assert.deepStrictEqual(paths, [`/llm/runs/${run2}/ack`, `/llm/runs/${run2}`, `/llm/runs/${run2}/ack`]);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('does not ACK a cancelled stream even when result-ready arrived in the same chunk', async () => {
		const originalFetch = globalThis.fetch;
		const controller = new AbortController();
		const paths: string[] = [];
		globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
			paths.push(new URL(String(input)).pathname);
			return new Response(
				'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n'
				+ 'event: safeappeals.run.result_ready\n'
				+ `data: {"run_id":"${run3}","state":"result_ready","requires_ack":true}\n\n`
				+ 'data: [DONE]\n\n',
				{ status: 200, headers: { 'Content-Type': 'text/event-stream', 'x-safeappeals-run-id': run3 } },
			);
		}) as typeof fetch;
		const client = new CloudApiClient(output, () => 'token', async () => false);
		try {
			await client.streamChat(body, () => controller.abort(), controller.signal);
			assert.deepStrictEqual(paths, ['/llm/chat']);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('does not ACK a partial stream that ends after result-ready but before DONE', async () => {
		const originalFetch = globalThis.fetch;
		const paths: string[] = [];
		globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
			paths.push(new URL(String(input)).pathname);
			return new Response(
				'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n'
				+ 'event: safeappeals.run.result_ready\n'
				+ `data: {"run_id":"${run4}","state":"result_ready","requires_ack":true}\n\n`,
				{ status: 200, headers: { 'Content-Type': 'text/event-stream', 'x-safeappeals-run-id': run4 } },
			);
		}) as typeof fetch;
		const client = new CloudApiClient(output, () => 'token', async () => false);
		try {
			await assert.rejects(
				client.streamChat(body, () => { /* consume */ }),
				/stream ended before completion/,
			);
			assert.deepStrictEqual(paths, ['/llm/chat']);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('ACKs a non-stream JSON result only when header and body UUID agree', async () => {
		const originalFetch = globalThis.fetch;
		const paths: string[] = [];
		globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
			const path = new URL(String(input)).pathname;
			paths.push(path);
			if (path.endsWith('/chat')) {
				return new Response(JSON.stringify({
					choices: [{ message: { content: 'json answer' } }],
					void_usage: { run_id: run1, state: 'result_ready', requires_ack: true },
				}), { status: 200, headers: { 'Content-Type': 'application/json', 'x-safeappeals-run-id': run1 } });
			}
			return new Response(`{"status":"settled","run_id":"${run1}"}`, { status: 200, headers: { 'Content-Type': 'application/json' } });
		}) as typeof fetch;
		const client = new CloudApiClient(output, () => 'token', async () => false);
		const parts: string[] = [];
		try {
			await client.streamChat(body, part => parts.push(part.kind === 'text' ? part.text : part.name));
			assert.deepStrictEqual({ parts, paths }, { parts: ['json answer'], paths: ['/llm/chat', `/llm/runs/${run1}/ack`] });
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('rejects missing, malformed, or mismatched stream identities without ACK', async () => {
		const originalFetch = globalThis.fetch;
		const cases = [
			{ header: undefined, event: run1 },
			{ header: 'not-a-uuid', event: run1 },
			{ header: run1, event: run2 },
			{ header: run1, event: 'not-a-uuid' },
		];
		try {
			for (const identity of cases) {
				const paths: string[] = [];
				globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
					paths.push(new URL(String(input)).pathname);
					const headers: Record<string, string> = { 'Content-Type': 'text/event-stream' };
					if (identity.header) {
						headers['x-safeappeals-run-id'] = identity.header;
					}
					return new Response(
						`event: safeappeals.run.result_ready\ndata: {"run_id":"${identity.event}","state":"result_ready","requires_ack":true}\n\ndata: [DONE]\n\n`,
						{ status: 200, headers },
					);
				}) as typeof fetch;
				const client = new CloudApiClient(output, () => 'token', async () => false);
				await assert.rejects(client.streamChat(body, () => { /* consume */ }), /run identity/);
				assert.deepStrictEqual(paths, ['/llm/chat']);
			}
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('rejects multiple result-ready events and a later stream error without ACK', async () => {
		const originalFetch = globalThis.fetch;
		for (const suffix of [
			`event: safeappeals.run.result_ready\ndata: {"run_id":"${run1}","state":"result_ready","requires_ack":true}\n\ndata: [DONE]\n\n`,
			'data: {"error":{"message":"late failure"}}\n\n',
		]) {
			let calls = 0;
			globalThis.fetch = (async (): Promise<Response> => {
				calls++;
				return new Response(
					`event: safeappeals.run.result_ready\ndata: {"run_id":"${run1}","state":"result_ready","requires_ack":true}\n\n${suffix}`,
					{ status: 200, headers: { 'Content-Type': 'text/event-stream', 'x-safeappeals-run-id': run1 } },
				);
			}) as typeof fetch;
			const client = new CloudApiClient(output, () => 'token', async () => false);
			await assert.rejects(client.streamChat(body, () => { /* consume */ }));
			assert.strictEqual(calls, 1);
		}
		globalThis.fetch = originalFetch;
	});

	test('rejects replay header/body mismatch before status recovery', async () => {
		const originalFetch = globalThis.fetch;
		const paths: string[] = [];
		globalThis.fetch = (async (input: string | URL | Request): Promise<Response> => {
			paths.push(new URL(String(input)).pathname);
			return new Response(`{"run_id":"${run1}","state":"result_ready","replay":true}`, {
				status: 202,
				headers: { 'Content-Type': 'application/json', 'x-safeappeals-run-id': run2 },
			});
		}) as typeof fetch;
		const client = new CloudApiClient(output, () => 'token', async () => false);
		try {
			await assert.rejects(client.streamChat(body, () => { /* consume */ }), /inconsistent model run identity/);
			assert.deepStrictEqual(paths, ['/llm/chat']);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('does not ACK when the progress consumer throws', async () => {
		const originalFetch = globalThis.fetch;
		let calls = 0;
		globalThis.fetch = (async (): Promise<Response> => {
			calls++;
			return new Response(
				'data: {"choices":[{"delta":{"content":"answer"}}]}\n\n'
				+ `event: safeappeals.run.result_ready\ndata: {"run_id":"${run1}","state":"result_ready","requires_ack":true}\n\n`
				+ 'data: [DONE]\n\n',
				{ status: 200, headers: { 'Content-Type': 'text/event-stream', 'x-safeappeals-run-id': run1 } },
			);
		}) as typeof fetch;
		const client = new CloudApiClient(output, () => 'token', async () => false);
		try {
			await assert.rejects(client.streamChat(body, () => { throw new Error('consumer failed'); }), /consumer failed/);
			assert.strictEqual(calls, 1);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('reuses the ACK run across auth refresh and surfaces status lookup failure after lost ACK', async () => {
		const originalFetch = globalThis.fetch;
		let token = 'old';
		const authorizations: Array<string | null> = [];
		let calls = 0;
		globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			authorizations.push(new Headers(init?.headers).get('Authorization'));
			calls++;
			if (calls === 1) {
				return new Response('{}', { status: 401, headers: { 'Content-Type': 'application/json' } });
			}
			if (calls === 2) {
				return new Response(`{"status":"settled","run_id":"${run1}"}`, { status: 200, headers: { 'Content-Type': 'application/json' } });
			}
			throw new TypeError('ack response lost');
		}) as typeof fetch;
		const client = new CloudApiClient(output, () => token, async () => { token = 'new'; return true; });
		try {
			await client.acknowledgeLlmRun(run1);
			assert.deepStrictEqual(authorizations, ['Bearer old', 'Bearer new']);
			await assert.rejects(client.acknowledgeLlmRun(run2), /ack response lost/);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('idle timeout aborts before any ACK dispatch', async () => {
		const originalFetch = globalThis.fetch;
		let calls = 0;
		globalThis.fetch = (async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
			calls++;
			return new Promise<Response>((_resolve, reject) => init?.signal?.addEventListener('abort', () => {
				const error = new Error('Aborted');
				error.name = 'AbortError';
				reject(error);
			}, { once: true }));
		}) as typeof fetch;
		const client = new CloudApiClient(output, () => 'token', async () => false, 1);
		try {
			await assert.rejects(client.streamChat(body, () => { /* consume */ }), /timed out/);
			assert.strictEqual(calls, 1);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('cancellation at the DONE-to-ACK boundary prevents ACK dispatch', async () => {
		const originalFetch = globalThis.fetch;
		let calls = 0;
		globalThis.fetch = (async (): Promise<Response> => {
			calls++;
			return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
		}) as typeof fetch;
		const controller = new AbortController();
		controller.abort();
		const client = new CloudApiClient(output, () => 'token', async () => false);
		try {
			await assert.rejects(client.acknowledgeLlmRun(run1, controller.signal), error => {
				return error instanceof Error && error.name === 'AbortError';
			});
			assert.strictEqual(calls, 0);
		} finally {
			globalThis.fetch = originalFetch;
		}
	});

	test('rejects non-stream JSON with missing, malformed, or mismatched body identity without ACK', async () => {
		const originalFetch = globalThis.fetch;
		for (const bodyRunId of [undefined, 'not-a-uuid', run2]) {
			let calls = 0;
			globalThis.fetch = (async (): Promise<Response> => {
				calls++;
				return new Response(JSON.stringify({
					choices: [{ message: { content: 'answer' } }],
					void_usage: { run_id: bodyRunId, state: 'result_ready', requires_ack: true },
				}), { status: 200, headers: { 'Content-Type': 'application/json', 'x-safeappeals-run-id': run1 } });
			}) as typeof fetch;
			const client = new CloudApiClient(output, () => 'token', async () => false);
			await assert.rejects(client.streamChat(body, () => { /* consume */ }), /inconsistent model run identity/);
			assert.strictEqual(calls, 1);
		}
		globalThis.fetch = originalFetch;
	});

	test('rejects mismatched or malformed status identity and closed state', async () => {
		const originalFetch = globalThis.fetch;
		for (const payload of [
			{ run_id: run2, state: 'settled' },
			{ run_id: 'not-a-uuid', state: 'settled' },
			{ run_id: run1, state: 'mystery' },
			{ state: 'settled' },
		]) {
			globalThis.fetch = (async (): Promise<Response> => new Response(JSON.stringify(payload), {
				status: 200,
				headers: { 'Content-Type': 'application/json' },
			})) as typeof fetch;
			const client = new CloudApiClient(output, () => 'token', async () => false);
			await assert.rejects(client.getLlmRunStatus(run1), /invalid model run status/);
		}
		globalThis.fetch = originalFetch;
	});

	test('a lost or invalid ACK cannot use mismatched status as settlement proof', async () => {
		const originalFetch = globalThis.fetch;
		for (const ackPayload of [undefined, { run_id: run2, status: 'settled' }, { run_id: run1, status: 'unexpected' }]) {
			let calls = 0;
			globalThis.fetch = (async (): Promise<Response> => {
				calls++;
				if (calls === 1 && ackPayload === undefined) {
					throw new TypeError('ACK response lost');
				}
				if (calls === 1) {
					return new Response(JSON.stringify(ackPayload), { status: 200, headers: { 'Content-Type': 'application/json' } });
				}
				return new Response(JSON.stringify({ run_id: run2, state: 'settled' }), {
					status: 200,
					headers: { 'Content-Type': 'application/json' },
				});
			}) as typeof fetch;
			const client = new CloudApiClient(output, () => 'token', async () => false);
			await assert.rejects(client.acknowledgeLlmRun(run1), /invalid model run status/);
			assert.strictEqual(calls, 2);
		}
		globalThis.fetch = originalFetch;
	});
});

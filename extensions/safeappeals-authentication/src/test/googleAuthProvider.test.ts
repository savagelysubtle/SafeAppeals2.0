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
	EventEmitter,
} from 'vscode';
import {
	GoogleAuthProvider,
	inferProviderCapabilities,
	sessionSatisfiesCapabilities,
	scopesForCapabilities,
	isProviderTokenReauthError,
	googleScopeOptionsFromCapabilities,
} from '../googleAuthProvider';

type Listener<T> = (e: T) => unknown;

function createEventEmitter<T>(): EventEmitter<T> & { fire(data: T): void } {
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
		dispose(): void {
			listeners.clear();
		},
	} as EventEmitter<T> & { fire(data: T): void };
}

const cloudSessionEmitter = createEventEmitter<AuthenticationProviderAuthenticationSessionsChangeEvent>();

suite('inferProviderCapabilities', () => {
	test('maps mail/calendar convention and empty default', () => {
		assert.deepStrictEqual(
			{
				empty: [...inferProviderCapabilities([])].sort(),
				undefinedScopes: [...inferProviderCapabilities(undefined)].sort(),
				mail: [...inferProviderCapabilities(['mail'])].sort(),
				calendar: [...inferProviderCapabilities(['calendar'])].sort(),
				both: [...inferProviderCapabilities(['mail', 'calendar'])].sort(),
				gmailUri: [...inferProviderCapabilities(['https://mail.google.com/'])].sort(),
				calendarUri: [...inferProviderCapabilities(['https://www.googleapis.com/auth/calendar'])].sort(),
			},
			{
				empty: ['mail'],
				undefinedScopes: ['mail'],
				mail: ['mail'],
				calendar: ['calendar'],
				both: ['calendar', 'mail'],
				gmailUri: ['mail'],
				calendarUri: ['calendar'],
			},
		);
	});

	test('unknown scopes alone yield empty capabilities', () => {
		assert.deepStrictEqual([...inferProviderCapabilities(['openid', 'profile'])], []);
	});
});

suite('sessionSatisfiesCapabilities / scopesForCapabilities', () => {
	test('partitioning and scope strings', () => {
		const mailOnly = new Set(inferProviderCapabilities(['mail']));
		const both = new Set(inferProviderCapabilities(['mail', 'calendar']));
		assert.deepStrictEqual(
			{
				mailOk: sessionSatisfiesCapabilities(mailOnly, mailOnly),
				calendarDenied: sessionSatisfiesCapabilities(mailOnly, new Set(['calendar'])),
				bothCoversMail: sessionSatisfiesCapabilities(both, mailOnly),
				scopes: {
					mail: scopesForCapabilities(mailOnly),
					both: scopesForCapabilities(both),
				},
				options: googleScopeOptionsFromCapabilities(both),
			},
			{
				mailOk: true,
				calendarDenied: false,
				bothCoversMail: true,
				scopes: {
					mail: ['mail'],
					both: ['mail', 'calendar'],
				},
				options: { mail: true, calendar: true },
			},
		);
	});
});

suite('isProviderTokenReauthError', () => {
	test('detects 404 / reconnect style mint failures', () => {
		assert.deepStrictEqual(
			{
				status: isProviderTokenReauthError(new Error('API request failed (404).')),
				notFound: isProviderTokenReauthError(new Error('Provider token not found')),
				other: isProviderTokenReauthError(new Error('network down')),
			},
			{ status: true, notFound: true, other: false },
		);
	});
});

suite('GoogleAuthProvider', () => {
	function makeProvider(overrides: {
		refresh?: () => Promise<{ provider: 'google'; accessToken: string; expiresAt: number }>;
		requestScopes?: (options: { mail?: boolean; calendar?: boolean }) => Promise<void>;
		nowSeconds?: () => number;
		cloudSignedIn?: boolean;
	} = {}) {
		const reconsentCalls: Array<{ mail?: boolean; calendar?: boolean }> = [];
		const refreshCalls: string[] = [];
		const sessionEvents: AuthenticationProviderAuthenticationSessionsChangeEvent[] = [];
		const state = { cloudSignedIn: overrides.cloudSignedIn !== false };
		const account = { id: 'user-1', label: 'lawyer@example.com' };
		const provider = new GoogleAuthProvider({
			register: false,
			ensureCloudSession: async () => {
				if (!state.cloudSignedIn) {
					throw new Error('Sign in to SafeAppeals Cloud first.');
				}
				return account;
			},
			tryGetCloudAccount: async () => state.cloudSignedIn ? account : undefined,
			requestGoogleProviderScopes: async options => {
				reconsentCalls.push(options);
				await overrides.requestScopes?.(options);
			},
			refreshProviderToken: async () => {
				refreshCalls.push('google');
				if (overrides.refresh) {
					return overrides.refresh();
				}
				return {
					provider: 'google',
					accessToken: 'google-access',
					expiresAt: 1_700_000_3600,
				};
			},
			onDidChangeCloudSessions: cloudSessionEmitter.event,
			output: { appendLine: () => { /* test stub */ } },
			nowSeconds: overrides.nowSeconds ?? (() => 1_700_000_000),
		});
		provider.onDidChangeSessions(e => sessionEvents.push(e));
		return { provider, reconsentCalls, refreshCalls, sessionEvents, state };
	}

	test('empty cache + successful mint skips reconsent (server already has refresh)', async () => {
		const { provider, reconsentCalls, refreshCalls } = makeProvider();
		const session = await provider.createSession(['mail']);
		assert.deepStrictEqual(
			{
				session: {
					accessToken: session.accessToken,
					scopes: session.scopes,
					account: session.account,
				},
				reconsentCalls,
				refreshCalls,
				getSessionsMail: (await provider.getSessions(['mail'])).map(s => ({
					accessToken: s.accessToken,
					scopes: s.scopes,
				})),
				getSessionsCalendar: await provider.getSessions(['calendar']),
			},
			{
				session: {
					accessToken: 'google-access',
					scopes: ['mail'],
					account: { id: 'user-1', label: 'lawyer@example.com' },
				},
				reconsentCalls: [],
				refreshCalls: ['google'],
				getSessionsMail: [{ accessToken: 'google-access', scopes: ['mail'] }],
				getSessionsCalendar: [],
			},
		);
		await provider.dispose();
	});

	test('calendar expansion after mail reconsents calendar only', async () => {
		const { provider, reconsentCalls } = makeProvider();
		await provider.createSession(['mail']);
		assert.deepStrictEqual(reconsentCalls, []);
		const calendarSession = await provider.createSession(['calendar']);
		assert.deepStrictEqual(
			{
				scopes: calendarSession.scopes,
				reconsentCalls,
				getSessionsCalendar: (await provider.getSessions(['calendar'])).map(s => s.scopes),
				getSessionsMail: (await provider.getSessions(['mail'])).map(s => s.scopes),
			},
			{
				scopes: ['calendar'],
				reconsentCalls: [{ mail: undefined, calendar: true }],
				getSessionsCalendar: [['calendar']],
				getSessionsMail: [['mail']],
			},
		);
		await provider.dispose();
	});

	test('getSessions empty cache silently mints without reconsent', async () => {
		const { provider, reconsentCalls, refreshCalls } = makeProvider();
		const sessions = await provider.getSessions(['mail']);
		assert.deepStrictEqual(
			{
				sessions: sessions.map(s => ({
					accessToken: s.accessToken,
					scopes: s.scopes,
					account: s.account,
				})),
				reconsentCalls,
				refreshCalls,
			},
			{
				sessions: [{
					accessToken: 'google-access',
					scopes: ['mail'],
					account: { id: 'user-1', label: 'lawyer@example.com' },
				}],
				reconsentCalls: [],
				refreshCalls: ['google'],
			},
		);
		await provider.dispose();
	});

	test('getSessions returns empty when silent mint fails (reconnect path)', async () => {
		const { provider, reconsentCalls } = makeProvider({
			refresh: async () => {
				throw new Error('API request failed (404).');
			},
		});
		assert.deepStrictEqual(
			{
				sessions: await provider.getSessions(['mail']),
				reconsentCalls,
			},
			{
				sessions: [],
				reconsentCalls: [],
			},
		);
		await provider.dispose();
	});

	test('removeSession clears cache and fires removed', async () => {
		const { provider, sessionEvents, refreshCalls } = makeProvider();
		const session = await provider.createSession(['mail']);
		const refreshBeforeRemove = refreshCalls.length;
		await provider.removeSession(session.id);
		assert.deepStrictEqual(
			{
				removedCount: sessionEvents.filter(e => (e.removed ?? []).length > 0).length,
				// Silent remint after remove is OK — server still holds refresh (DoD #4).
				afterRemove: (await provider.getSessions(['mail'])).map(s => s.accessToken),
				reminted: refreshCalls.length > refreshBeforeRemove,
			},
			{
				removedCount: 1,
				afterRemove: ['google-access'],
				reminted: true,
			},
		);
		await provider.dispose();
	});

	test('cloud sign-out clears in-memory provider sessions', async () => {
		const { provider, state } = makeProvider();
		await provider.createSession(['mail']);
		state.cloudSignedIn = false;
		const cloudSession: AuthenticationSession = {
			id: 'user-1',
			accessToken: 'cloud-jwt',
			account: { id: 'user-1', label: 'lawyer@example.com' },
			scopes: [],
		};
		cloudSessionEmitter.fire({ added: [], removed: [cloudSession], changed: [] });
		assert.deepStrictEqual(await provider.getSessions(['mail']), []);
		await provider.dispose();
	});

	test('createSession retries reconsent when mint returns 404', async () => {
		let mintAttempts = 0;
		const { provider, reconsentCalls } = makeProvider({
			refresh: async () => {
				mintAttempts += 1;
				if (mintAttempts === 1) {
					throw new Error('API request failed (404).');
				}
				return {
					provider: 'google',
					accessToken: 'google-access-2',
					expiresAt: 1_700_000_3600,
				};
			},
		});
		const session = await provider.createSession(['mail']);
		assert.deepStrictEqual(
			{
				accessToken: session.accessToken,
				reconsentCalls,
				mintAttempts,
			},
			{
				accessToken: 'google-access-2',
				reconsentCalls: [{ mail: true, calendar: undefined }],
				mintAttempts: 2,
			},
		);
		await provider.dispose();
	});
});

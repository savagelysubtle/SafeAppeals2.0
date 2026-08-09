/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import { CloudApiClient, type CloudSessionEnvelope } from '../api';
import {
	CloudAuthProvider,
	sessionHasPersistedProviderTokens,
	shouldReturnExistingCloudSession,
	validatePastedAuthInput,
	withoutPersistedProviderTokens,
} from '../cloudAuthProvider';
import type { OAuthLoopbackServer } from '../oauthLoopback';

const sessionSecretKey = 'safeappeals-cloud.session';
const pendingSecretKey = 'safeappeals-cloud.pendingSignIn';
const orphanedCodeKey = 'safeappeals-cloud.orphanedAuthCode';

class MemorySecrets implements vscode.SecretStorage {
	readonly values = new Map<string, string>();
	storeError: Error | undefined;
	deleteError: Error | undefined;
	readonly onDidChange: vscode.Event<vscode.SecretStorageChangeEvent> = () => ({ dispose() { } });

	keys(): Thenable<string[]> {
		return Promise.resolve([...this.values.keys()]);
	}

	get(key: string): Thenable<string | undefined> {
		return Promise.resolve(this.values.get(key));
	}

	store(key: string, value: string): Thenable<void> {
		if (this.storeError) {
			return Promise.reject(this.storeError);
		}
		this.values.set(key, value);
		return Promise.resolve();
	}

	delete(key: string): Thenable<void> {
		if (this.deleteError) {
			return Promise.reject(this.deleteError);
		}
		this.values.delete(key);
		return Promise.resolve();
	}
}

class MemoryMemento implements vscode.Memento {
	readonly values = new Map<string, object>();
	readonly updates: string[] = [];
	failKey: string | undefined;

	keys(): readonly string[] {
		return [...this.values.keys()];
	}

	get<T>(key: string): T | undefined;
	get<T>(key: string, defaultValue: T): T;
	get<T>(key: string, defaultValue?: T): T | undefined {
		return this.values.has(key) ? this.values.get(key) as T : defaultValue;
	}

	update(key: string, value: object | undefined): Thenable<void> {
		this.updates.push(key);
		if (key === this.failKey) {
			return Promise.reject(new Error('update failed'));
		}
		if (value === undefined) {
			this.values.delete(key);
		} else {
			this.values.set(key, value);
		}
		return Promise.resolve();
	}

	setKeysForSync(_keys: readonly string[]): void { }
}

class FakeCloudApiClient extends CloudApiClient {
	readonly signOutTokens: string[] = [];
	signOutError: Error | undefined;

	constructor(output: vscode.OutputChannel) {
		super(output, () => undefined, async () => false);
	}

	override async signOut(accessToken: string): Promise<void> {
		this.signOutTokens.push(accessToken);
		if (this.signOutError) {
			throw this.signOutError;
		}
	}
}

function makeProvider(options: {
	readonly session?: CloudSessionEnvelope;
	readonly secrets?: MemorySecrets;
	readonly globalState?: MemoryMemento;
	readonly api?: FakeCloudApiClient;
	readonly startLoopback?: () => Promise<OAuthLoopbackServer>;
} = {}) {
	const lines: string[] = [];
	const warnings: string[] = [];
	const output = { appendLine: (line: string) => { lines.push(line); } } as vscode.OutputChannel;
	const secrets = options.secrets ?? new MemorySecrets();
	const globalState = options.globalState ?? new MemoryMemento();
	if (options.session) {
		secrets.values.set(sessionSecretKey, JSON.stringify(options.session));
	}
	const api = options.api ?? new FakeCloudApiClient(output);
	const context = {
		secrets,
		globalState,
		extension: { id: 'safeappeals.safeappeals-authentication' },
	};
	const provider = new CloudAuthProvider(context, output, {
		api,
		openExternal: async () => true,
		startLoopback: options.startLoopback,
		registerUriHandler: false,
		showWarning: async message => { warnings.push(message); return undefined; },
	});
	return { provider, api, secrets, globalState, lines, warnings };
}

function makeEnvelope(overrides: Partial<CloudSessionEnvelope> & { userId?: string } = {}): CloudSessionEnvelope {
	const userId = overrides.userId ?? overrides.user?.id ?? 'user-1';
	const { userId: _omitUserId, user: userOverride, ...rest } = overrides;
	return {
		accessToken: 'access',
		refreshToken: 'refresh',
		expiresAt: 1_700_000_3600,
		...rest,
		user: userOverride ?? {
			id: userId,
			email: 'lawyer@example.com',
			displayName: 'Lawyer',
			avatarUrl: null,
		},
	};
}

suite('shouldReturnExistingCloudSession', () => {
	test('createSession reuses existing session and ignores scopes', () => {
		const session = makeEnvelope();
		assert.deepStrictEqual(
			{
				withSession: shouldReturnExistingCloudSession(session, ['openid', 'https://mail.google.com/']),
				withoutSession: shouldReturnExistingCloudSession(undefined, ['openid']),
			},
			{ withSession: true, withoutSession: false },
		);
	});
});

suite('withoutPersistedProviderTokens', () => {
	test('nulls both legacy provider token fields', () => {
		const envelope = makeEnvelope({
			googleProviderToken: 'provider-access',
			googleProviderRefreshToken: 'provider-refresh',
		});
		assert.deepStrictEqual(withoutPersistedProviderTokens(envelope), {
			...envelope,
			googleProviderToken: null,
			googleProviderRefreshToken: null,
		});
		assert.strictEqual(sessionHasPersistedProviderTokens(envelope), true);
		assert.strictEqual(sessionHasPersistedProviderTokens(withoutPersistedProviderTokens(envelope)), false);
	});
});

suite('validatePastedAuthInput', () => {
	test('accepts only full callback URLs with exact state', () => {
		assert.deepStrictEqual(
			validatePastedAuthInput(
				'http://127.0.0.1:47294/auth/callback?code=authorization-code&state=expected-state',
				'expected-state',
			),
			{ code: 'authorization-code', state: 'expected-state' },
		);
	});

	test('rejects bare codes and missing or mismatched state', () => {
		assert.throws(() => validatePastedAuthInput('authorization-code', 'expected-state'));
		assert.throws(() => validatePastedAuthInput(
			'http://127.0.0.1:47294/auth/callback?code=authorization-code',
			'expected-state',
		));
		assert.throws(() => validatePastedAuthInput(
			'http://127.0.0.1:47294/auth/callback?code=authorization-code&state=wrong-state',
			'expected-state',
		));
	});
});

suite('CloudAuthProvider security behavior', () => {
	test('remote sign-out uses current token and fires removal after local purge', async () => {
		const session = makeEnvelope({ expiresAt: Math.floor(Date.now() / 1000) + 3600 });
		const { provider, api, secrets } = makeProvider({ session });
		await provider.initialize();
		const removed: string[] = [];
		provider.onDidChangeSessions(event => removed.push(...(event.removed ?? []).map(item => item.id)));

		await provider.removeSession(session.user.id);

		assert.deepStrictEqual({
			tokens: api.signOutTokens,
			stored: secrets.values.get(sessionSecretKey),
			sessions: await provider.getSessions(),
			removed,
		}, { tokens: ['access'], stored: undefined, sessions: [], removed: ['user-1'] });
		provider.dispose();
	});

	test('remote revoke failure still purges and fires removal while surfacing failure', async () => {
		const session = makeEnvelope({ expiresAt: Math.floor(Date.now() / 1000) + 3600 });
		const { provider, api, secrets, warnings } = makeProvider({ session });
		api.signOutError = new Error('offline');
		await provider.initialize();
		const removed: string[] = [];
		provider.onDidChangeSessions(event => removed.push(...(event.removed ?? []).map(item => item.id)));

		await assert.rejects(provider.removeSession(session.user.id), /Local sign-out completed/);

		assert.deepStrictEqual({
			stored: secrets.values.get(sessionSecretKey),
			sessions: await provider.getSessions(),
			removed,
			warnings,
		}, {
			stored: undefined,
			sessions: [],
			removed: ['user-1'],
			warnings: ['The server could not revoke this session. Local sign-out completed.'],
		});
		provider.dispose();
	});

	test('migration rewrite failure deletes unsafe secret and restores sanitized memory only', async () => {
		const secrets = new MemorySecrets();
		const session = makeEnvelope({
			expiresAt: Math.floor(Date.now() / 1000) + 3600,
			googleProviderToken: 'unsafe-provider-token',
		});
		secrets.values.set(sessionSecretKey, JSON.stringify(session));
		secrets.storeError = new Error('rewrite failed');
		const { provider } = makeProvider({ secrets });

		await provider.initialize();

		assert.deepStrictEqual({
			stored: secrets.values.get(sessionSecretKey),
			memoryOnly: provider.isSessionMemoryOnly(),
			sessionCount: (await provider.getSessions()).length,
		}, { stored: undefined, memoryOnly: true, sessionCount: 1 });
		provider.dispose();
	});

	test('migration rewrite and delete failure refuses restoration', async () => {
		const secrets = new MemorySecrets();
		const session = makeEnvelope({ googleProviderToken: 'unsafe-provider-token' });
		secrets.values.set(sessionSecretKey, JSON.stringify(session));
		secrets.storeError = new Error('rewrite failed');
		secrets.deleteError = new Error('delete failed');
		const { provider } = makeProvider({ secrets });

		await provider.initialize();

		assert.deepStrictEqual({
			stored: secrets.values.has(sessionSecretKey),
			sessions: await provider.getSessions(),
		}, { stored: true, sessions: [] });
		provider.dispose();
	});

	test('pending PKCE uses SecretStorage while legacy plaintext keys are purge-only', async () => {
		const globalState = new MemoryMemento();
		globalState.values.set(pendingSecretKey, { legacy: true });
		globalState.values.set(orphanedCodeKey, { legacy: true });
		const loopback: OAuthLoopbackServer = {
			redirectUri: 'http://127.0.0.1:47294/auth/callback',
			code: new Promise(() => { /* live attempt */ }),
			dispose: () => { /* test handle */ },
		};
		const { provider, secrets } = makeProvider({
			globalState,
			startLoopback: async () => loopback,
		});
		const create = provider.createSession([]);
		void create.catch(() => { /* disposed below */ });
		await new Promise<void>(resolve => setTimeout(resolve, 10));

		assert.deepStrictEqual({
			secretPending: typeof secrets.values.get(pendingSecretKey),
			globalPending: globalState.values.get(pendingSecretKey),
			globalOrphan: globalState.values.get(orphanedCodeKey),
		}, { secretPending: 'string', globalPending: undefined, globalOrphan: undefined });
		provider.dispose();
	});

	test('legacy key purge attempts orphan cleanup even when pending cleanup fails', async () => {
		const globalState = new MemoryMemento();
		globalState.values.set(orphanedCodeKey, { legacy: true });
		globalState.failKey = pendingSecretKey;
		const { provider } = makeProvider({ globalState });

		await provider.initialize();

		assert.deepStrictEqual({
			updates: globalState.updates.slice(0, 2),
			orphan: globalState.values.get(orphanedCodeKey),
		}, { updates: [pendingSecretKey, orphanedCodeKey], orphan: undefined });
		provider.dispose();
	});
});

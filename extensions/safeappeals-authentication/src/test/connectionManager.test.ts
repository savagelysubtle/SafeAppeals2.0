/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import 'mocha';
import * as assert from 'assert';
import type { Disposable, Event } from 'vscode';
import { ConnectionManager, type ConnectionChangeEvent } from '../connectionManager';
import type {
	ConnectionCapability,
	ConnectionInfo,
	ConnectionsApi,
	ConnectionTokenResult,
	StartConnectionRequest,
	StartConnectionResult,
} from '../connectionsApi';
import type { ConnectCallbackResult } from '../uriHandler';

const GOOGLE_MAIL_CONNECTION: ConnectionInfo = {
	id: 'conn-1',
	provider: 'google',
	accountEmail: 'lawyer@example.com',
	accountLabel: 'lawyer@example.com',
	capabilities: ['mail'],
	status: 'active',
	source: 'connect',
	grantedScopes: 'openid https://mail.google.com/',
};

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

/** Lets pending microtasks (and the manager's first claim attempt) run. */
function tick(): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, 0));
}

interface ManagerHarness {
	readonly manager: ConnectionManager;
	readonly connectCallbacks: { fire(data: ConnectCallbackResult): void };
	readonly starts: StartConnectionRequest[];
	readonly opened: string[];
	readonly deleted: string[];
	readonly changes: ConnectionChangeEvent[];
	setClaimResult(connection: ConnectionInfo | undefined): void;
}

function makeManager(overrides: {
	claimResults?: Array<ConnectionInfo | undefined>;
	/** When false, the manager's wait can only be woken by a `/connect` deep link. */
	delayResolves?: boolean;
	openExternal?: () => Promise<boolean>;
	deleteConnection?: () => Promise<void>;
} = {}): ManagerHarness {
	const connectCallbacks = createEmitter<ConnectCallbackResult>();
	const starts: StartConnectionRequest[] = [];
	const opened: string[] = [];
	const deleted: string[] = [];
	const changes: ConnectionChangeEvent[] = [];
	const claimResults = [...(overrides.claimResults ?? [])];
	let claimResult: ConnectionInfo | undefined;

	const api: ConnectionsApi = {
		startConnection: async (request: StartConnectionRequest): Promise<StartConnectionResult> => {
			starts.push(request);
			return { requestId: 'req-1', authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth?x=1' };
		},
		claimConnection: async () => GOOGLE_MAIL_CONNECTION,
		tryClaimConnection: async () => (claimResults.length > 0 ? claimResults.shift() : claimResult),
		listConnections: async () => [GOOGLE_MAIL_CONNECTION],
		mintConnectionToken: async (
			connectionId: string,
			capability: ConnectionCapability,
		): Promise<ConnectionTokenResult> => ({
			connectionId,
			capability,
			accessToken: 'provider-access',
			expiresAt: 1_700_003_600,
		}),
		deleteConnection: async (connectionId: string) => {
			deleted.push(connectionId);
			await overrides.deleteConnection?.();
		},
	};

	const manager = new ConnectionManager({
		api,
		ensureCloudSession: async () => { /* signed in */ },
		onConnectCallback: connectCallbacks.event,
		output: { appendLine: () => { /* test stub */ } },
		openExternal: overrides.openExternal ?? (async url => {
			opened.push(url);
			return true;
		}),
		delay: overrides.delayResolves === false
			? () => new Promise<void>(() => { /* only a deep link wakes the wait */ })
			: async () => { /* poll immediately */ },
		pollIntervalMs: 0,
	});
	manager.onDidChangeConnections(event => changes.push(event));

	return {
		manager,
		connectCallbacks,
		starts,
		opened,
		deleted,
		changes,
		setClaimResult(connection) {
			claimResult = connection;
		},
	};
}

suite('ConnectionManager.connect', () => {
	test('deep link wakes the wait and the claimed connection is announced', async () => {
		const harness = makeManager({ delayResolves: false });
		const connecting = harness.manager.connect({ provider: 'google', capabilities: ['mail'] });
		await tick();
		harness.setClaimResult(GOOGLE_MAIL_CONNECTION);
		harness.connectCallbacks.fire({ requestId: 'req-1', ok: true });
		const connection = await connecting;

		assert.deepStrictEqual(
			{
				id: connection.id,
				starts: harness.starts,
				opened: harness.opened,
				changes: harness.changes.map(change => ({
					added: change.added.map(c => c.id),
					removed: change.removed,
				})),
			},
			{
				id: 'conn-1',
				starts: [{ provider: 'google', capabilities: ['mail'], loginHint: undefined }],
				opened: ['https://accounts.google.com/o/oauth2/v2/auth?x=1'],
				changes: [{ added: ['conn-1'], removed: [] }],
			},
		);
		harness.manager.dispose();
	});

	test('polls the claim endpoint when no deep link arrives', async () => {
		const harness = makeManager({ claimResults: [undefined, undefined, GOOGLE_MAIL_CONNECTION] });
		const connection = await harness.manager.connect({ provider: 'google', capabilities: ['mail'] });
		assert.strictEqual(connection.id, 'conn-1');
		harness.manager.dispose();
	});

	test('a failed deep link ends the wait with an error', async () => {
		const harness = makeManager({ delayResolves: false });
		const connecting = harness.manager.connect({ provider: 'google', capabilities: ['mail'] });
		await tick();
		harness.connectCallbacks.fire({ requestId: 'req-1', ok: false, message: 'access_denied' });
		const failure = await connecting.then(() => 'resolved', (error: Error) => error.message);
		assert.match(failure, /access_denied/);
		harness.manager.dispose();
	});

	test('an unrelated requestId does not settle the wait', async () => {
		const harness = makeManager({ delayResolves: false });
		const connecting = harness.manager.connect({ provider: 'google', capabilities: ['mail'] });
		await tick();
		harness.connectCallbacks.fire({ requestId: 'other-request', ok: false, message: 'access_denied' });
		const settled = await Promise.race([
			connecting.then(() => 'resolved', () => 'rejected'),
			tick().then(() => 'pending'),
		]);
		assert.strictEqual(settled, 'pending');
		harness.manager.dispose();
	});

	test('Microsoft mail + calendar is rejected before starting a request', async () => {
		const harness = makeManager();
		const failure = await harness.manager
			.connect({ provider: 'microsoft', capabilities: ['mail', 'calendar'] })
			.then(() => 'resolved', (error: Error) => error.message);
		assert.deepStrictEqual(
			{ mentionsSeparately: /separately/i.test(failure), starts: harness.starts },
			{ mentionsSeparately: true, starts: [] },
		);
		harness.manager.dispose();
	});

	test('unknown capabilities are rejected before starting a request', async () => {
		const harness = makeManager();
		const failure = await harness.manager
			.connect({ provider: 'google', capabilities: ['drive'] })
			.then(() => 'resolved', (error: Error) => error.message);
		assert.deepStrictEqual(
			{ failed: failure !== 'resolved', starts: harness.starts },
			{ failed: true, starts: [] },
		);
		harness.manager.dispose();
	});

	test('a browser that will not open fails the connect', async () => {
		const harness = makeManager({ openExternal: async () => false });
		const failure = await harness.manager
			.connect({ provider: 'google', capabilities: ['mail'] })
			.then(() => 'resolved', (error: Error) => error.message);
		assert.match(failure, /browser/i);
		harness.manager.dispose();
	});
});

suite('ConnectionManager.disconnect', () => {
	test('deletes server-side and announces the removal', async () => {
		const harness = makeManager();
		await harness.manager.disconnect('conn-1');
		assert.deepStrictEqual(
			{
				deleted: harness.deleted,
				changes: harness.changes.map(change => ({
					added: change.added.map(c => c.id),
					removed: change.removed,
				})),
			},
			{ deleted: ['conn-1'], changes: [{ added: [], removed: ['conn-1'] }] },
		);
		harness.manager.dispose();
	});
});

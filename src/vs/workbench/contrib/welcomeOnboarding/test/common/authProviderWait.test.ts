/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter, Event } from '../../../../../base/common/event.js';
import { Disposable, DisposableStore, IDisposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { runWithFakedTimers } from '../../../../../base/test/common/timeTravelScheduler.js';
import { IAuthProviderWaitService, waitForAuthenticationProvider } from '../../common/authProviderWait.js';

/**
 * Fake auth registration source that implements the wait helper's contract.
 * Tracks live listeners so tests can assert disposal.
 */
class FakeAuthProviderWaitService extends Disposable implements IAuthProviderWaitService {
	private readonly _onDidRegister = this._register(new Emitter<{ readonly id: string }>());
	private readonly registered = new Set<string>();
	private _listenerCount = 0;

	get listenerCount(): number {
		return this._listenerCount;
	}

	readonly onDidRegisterAuthenticationProvider: Event<{ readonly id: string }> = (
		listener: (e: { readonly id: string }) => unknown,
		thisArgs?: unknown,
		disposables?: DisposableStore | IDisposable[],
	): IDisposable => {
		this._listenerCount++;
		const sub = this._onDidRegister.event(listener, thisArgs);
		const tracked = toDisposable(() => {
			this._listenerCount--;
			sub.dispose();
		});
		if (disposables instanceof DisposableStore) {
			disposables.add(tracked);
		} else if (Array.isArray(disposables)) {
			disposables.push(tracked);
		}
		return tracked;
	};

	isAuthenticationProviderRegistered(id: string): boolean {
		return this.registered.has(id);
	}

	register(id: string): void {
		this.registered.add(id);
		this._onDidRegister.fire({ id });
	}
}

suite('onboardingAuthProviderWait', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('provider already registered resolves immediately without a listener', async () => {
		const auth = store.add(new FakeAuthProviderWaitService());
		auth.register('safeappeals-cloud');

		const result = await waitForAuthenticationProvider(auth, 'safeappeals-cloud', 1_000);

		assert.deepStrictEqual(
			{ result, listenerCount: auth.listenerCount },
			{ result: true, listenerCount: 0 },
		);
	});

	test('provider registers during wait resolves and disposes the listener', async () => {
		const auth = store.add(new FakeAuthProviderWaitService());
		const waitStore = store.add(new DisposableStore());

		const pending = waitForAuthenticationProvider(auth, 'safeappeals-cloud', 5_000, waitStore);
		assert.strictEqual(auth.listenerCount, 1);

		auth.register('safeappeals-cloud');
		const result = await pending;

		assert.deepStrictEqual(
			{ result, listenerCount: auth.listenerCount },
			{ result: true, listenerCount: 0 },
		);
	});

	test('a different provider registering does not resolve early', async () => {
		await runWithFakedTimers({ useFakeTimers: true }, async () => {
			const auth = store.add(new FakeAuthProviderWaitService());
			const waitStore = store.add(new DisposableStore());

			const pending = waitForAuthenticationProvider(auth, 'safeappeals-cloud', 100, waitStore);
			auth.register('some-other-provider');
			assert.strictEqual(auth.listenerCount, 1);

			const result = await pending;

			assert.deepStrictEqual(
				{ result, listenerCount: auth.listenerCount },
				{ result: false, listenerCount: 0 },
			);
		});
	});

	test('timeout expires resolves false and disposes the listener', async () => {
		await runWithFakedTimers({ useFakeTimers: true }, async () => {
			const auth = store.add(new FakeAuthProviderWaitService());
			const waitStore = store.add(new DisposableStore());

			const pending = waitForAuthenticationProvider(auth, 'safeappeals-cloud', 50, waitStore);
			assert.strictEqual(auth.listenerCount, 1);

			const result = await pending;

			assert.deepStrictEqual(
				{ result, listenerCount: auth.listenerCount },
				{ result: false, listenerCount: 0 },
			);
		});
	});
});

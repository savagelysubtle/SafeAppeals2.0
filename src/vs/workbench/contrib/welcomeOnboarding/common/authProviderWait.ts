/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Event } from '../../../../base/common/event.js';
import { DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';

/**
 * Minimal auth-provider registration surface used by onboarding sign-in.
 * {@link IAuthenticationService} satisfies this without dragging the full
 * service into the common layer.
 */
export interface IAuthProviderWaitService {
	isAuthenticationProviderRegistered(id: string): boolean;
	readonly onDidRegisterAuthenticationProvider: Event<{ readonly id: string }>;
}

/**
 * Waits until `providerId` is registered on `authenticationService`, or until
 * `timeoutMs` elapses. Resolves `true` when the provider is available and
 * `false` on timeout (or if `parentStore` is disposed mid-wait).
 *
 * The registration listener is always disposed before the promise settles so
 * callers cannot leak it.
 */
export async function waitForAuthenticationProvider(
	authenticationService: IAuthProviderWaitService,
	providerId: string,
	timeoutMs: number,
	parentStore?: DisposableStore,
): Promise<boolean> {
	if (authenticationService.isAuthenticationProviderRegistered(providerId)) {
		return true;
	}

	const waitStore = new DisposableStore();
	parentStore?.add(waitStore);

	try {
		return await new Promise<boolean>(resolve => {
			let settled = false;
			const finish = (ok: boolean) => {
				if (settled) {
					return;
				}
				settled = true;
				resolve(ok);
			};

			waitStore.add(authenticationService.onDidRegisterAuthenticationProvider(e => {
				if (e.id === providerId) {
					finish(true);
				}
			}));

			const timer = setTimeout(() => finish(false), timeoutMs);
			waitStore.add(toDisposable(() => {
				clearTimeout(timer);
				finish(false);
			}));
		});
	} finally {
		waitStore.dispose();
	}
}

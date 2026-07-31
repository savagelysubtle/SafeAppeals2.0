/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IURLHandler, IURLService } from '../../../../platform/url/common/url.js';
import { URI, UriComponents } from '../../../../base/common/uri.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { AbstractURLService } from '../../../../platform/url/common/urlService.js';
import { Event } from '../../../../base/common/event.js';
import { IDisposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { IBrowserWorkbenchEnvironmentService } from '../../environment/browser/environmentService.js';
import { IOpenerService, IOpener, OpenExternalOptions, OpenInternalOptions } from '../../../../platform/opener/common/opener.js';
import { matchesScheme } from '../../../../base/common/network.js';
import { IProductService } from '../../../../platform/product/common/productService.js';

export interface IURLCallbackProvider {

	/**
	 * Indicates that a Uri has been opened outside of VSCode. The Uri
	 * will be forwarded to all installed Uri handlers in the system.
	 */
	readonly onCallback: Event<URI>;

	/**
	 * Creates a Uri that - if opened in a browser - must result in
	 * the `onCallback` to fire.
	 *
	 * The optional `Partial<UriComponents>` must be properly restored for
	 * the Uri passed to the `onCallback` handler.
	 *
	 * For example: if a Uri is to be created with `scheme:"vscode"`,
	 * `authority:"foo"` and `path:"bar"` the `onCallback` should fire
	 * with a Uri `vscode://foo/bar`.
	 *
	 * If there are additional `query` values in the Uri, they should
	 * be added to the list of provided `query` arguments from the
	 * `Partial<UriComponents>`.
	 */
	create(options?: Partial<UriComponents>): URI;

	/**
	 * Optional: open any OAuth callback persisted across a workbench reload
	 * (e.g. SafeAppeals `safeappeals-cloud.oauthCallback` in localStorage).
	 * Called once a URL handler is registered and {@link onCallback} has listeners.
	 *
	 * Fires the URI without removing the durable key. The auth extension clears
	 * the durable key only after a successful code exchange — do not clear when
	 * `open` returns true (ExtensionUrlHandler returns true after buffer+activate
	 * before exchange finishes).
	 *
	 * @returns `true` when a URI was fired (or expired/invalid and cleared);
	 * `false` when nothing was found / debounce blocked so a later retry may still succeed.
	 */
	recoverOrphanedCallbacks?(): boolean;

	/**
	 * Optional: remove the SafeAppeals durable OAuth callback key after a successful
	 * code exchange. Not invoked by BrowserURLService on open-handled — that races
	 * ahead of exchange. Prefer the `_safeappeals.cloud.clearDurableOAuthCallback`
	 * workbench command from the auth extension.
	 *
	 * @returns `true` when the durable key was actually removed; `false` otherwise.
	 */
	clearDurableOAuthCallback?(uri: URI): boolean;
}

class BrowserURLOpener implements IOpener {

	constructor(
		private urlService: IURLService,
		private productService: IProductService
	) { }

	async open(resource: string | URI, options?: OpenInternalOptions | OpenExternalOptions): Promise<boolean> {
		if ((options as OpenExternalOptions | undefined)?.openExternal) {
			return false;
		}

		if (!matchesScheme(resource, this.productService.urlProtocol)) {
			return false;
		}

		if (typeof resource === 'string') {
			resource = URI.parse(resource);
		}

		return this.urlService.open(resource, { trusted: true });
	}
}

export class BrowserURLService extends AbstractURLService {

	private provider: IURLCallbackProvider | undefined;
	/** Tracks registered handlers so recover never runs while open() would drop the URI. */
	private urlHandlerCount = 0;

	constructor(
		@IBrowserWorkbenchEnvironmentService environmentService: IBrowserWorkbenchEnvironmentService,
		@IOpenerService openerService: IOpenerService,
		@IProductService productService: IProductService
	) {
		super();

		this.provider = environmentService.options?.urlCallbackProvider;

		if (this.provider) {
			this._register(this.provider.onCallback(uri => {
				// Do NOT clear durable OAuth keys when open() returns true.
				// ExtensionUrlHandler.handleURL returns true after buffer+activateByEvent
				// even when the URI was only buffered / drain not awaited — clearing then
				// burns the code before exchange. Auth extension clears after success;
				// recover retries + TTL cover the rest. Ephemeral url-callbacks[*] still
				// clear in LocalStorageURLCallbackProvider.checkCallbacks as before.
				void this.open(uri, { trusted: true });
			}));
			// Belt-and-suspenders: primary recover is on first registerHandler.
			// Retries stay safe while durable remains until successful exchange.
			const timeout = setTimeout(() => this.tryRecoverOrphanedCallbacks(), 0);
			this._register(toDisposable(() => clearTimeout(timeout)));
			// Extensions (auth provider) may activate after the first empty recover — retry.
			const retryTimeout = setTimeout(() => this.tryRecoverOrphanedCallbacks(), 2000);
			this._register(toDisposable(() => clearTimeout(retryTimeout)));
			const lateRetryTimeout = setTimeout(() => this.tryRecoverOrphanedCallbacks(), 5000);
			this._register(toDisposable(() => clearTimeout(lateRetryTimeout)));
		}

		this._register(openerService.registerOpener(new BrowserURLOpener(this, productService)));
	}

	/**
	 * Recover orphaned OAuth after the first URL handler is registered so open()
	 * has someone to receive the URI (Eager ExtensionUrlHandler registers here).
	 */
	override registerHandler(handler: IURLHandler): IDisposable {
		const disposable = super.registerHandler(handler);
		this.urlHandlerCount++;
		this.tryRecoverOrphanedCallbacks();
		return toDisposable(() => {
			disposable.dispose();
			this.urlHandlerCount = Math.max(0, this.urlHandlerCount - 1);
		});
	}

	create(options?: Partial<UriComponents>): URI {
		if (this.provider) {
			return this.provider.create(options);
		}

		return URI.parse('unsupported://');
	}

	private tryRecoverOrphanedCallbacks(): void {
		if (!this.provider || this.urlHandlerCount === 0) {
			return;
		}
		// Fire only — durable key stays until auth exchange succeeds (debounce + TTL).
		this.provider.recoverOrphanedCallbacks?.();
	}
}

registerSingleton(IURLService, BrowserURLService, InstantiationType.Delayed);

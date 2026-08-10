/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { isStandalone } from '../../../base/browser/browser.js';
import { addDisposableListener } from '../../../base/browser/dom.js';
import { mainWindow } from '../../../base/browser/window.js';
import { VSBuffer, decodeBase64, encodeBase64 } from '../../../base/common/buffer.js';
import { Emitter } from '../../../base/common/event.js';
import { Disposable, IDisposable } from '../../../base/common/lifecycle.js';
import { parse } from '../../../base/common/marshalling.js';
import { Schemas } from '../../../base/common/network.js';
import { posix } from '../../../base/common/path.js';
import { isEqual } from '../../../base/common/resources.js';
import { ltrim } from '../../../base/common/strings.js';
import { URI, UriComponents } from '../../../base/common/uri.js';
import { CommandsRegistry } from '../../../platform/commands/common/commands.js';
import product from '../../../platform/product/common/product.js';
import { ISecretStorageProvider } from '../../../platform/secrets/common/secrets.js';
import { isFolderToOpen, isWorkspaceToOpen } from '../../../platform/window/common/window.js';
import type { IWorkbenchConstructionOptions, IWorkspace, IWorkspaceProvider } from '../../../workbench/browser/web.api.js';
import { AuthenticationSessionInfo } from '../../../workbench/services/authentication/browser/authenticationService.js';
import type { IURLCallbackProvider } from '../../../workbench/services/url/browser/urlService.js';
import { create } from '../../../workbench/workbench.web.main.internal.js';

/** Origin-shared key for in-flight PKCE (same semantic as extension PENDING_SIGN_IN_KEY). */
const PENDING_PKCE_LOCAL_STORAGE_KEY = 'safeappeals-cloud.pendingSignIn';
const PENDING_PKCE_MAX_AGE_MS = 5 * 60 * 1000;

/** Written by callback.html; survives workbench reload when pendingCallbacks is empty. */
const DURABLE_OAUTH_CALLBACK_KEY = 'safeappeals-cloud.oauthCallback';
const DURABLE_OAUTH_CALLBACK_MAX_AGE_MS = 5 * 60 * 1000;
/** Extension id / path used by CloudUriHandler for asExternalUri OAuth callbacks. */
const SAFEAPPEALS_AUTH_AUTHORITY = 'safeappeals.safeappeals-authentication';
const SAFEAPPEALS_AUTH_CALLBACK_PATH = '/auth/callback';

interface PendingPkcePayload {
	readonly codeVerifier: string;
	readonly state: string;
	readonly startedAt: number;
}

interface DurableOAuthCodeState {
	readonly code: string;
	readonly state: string;
}

function isPendingPkcePayload(value: unknown): value is PendingPkcePayload {
	if (!value || typeof value !== 'object') {
		return false;
	}
	const candidate = value as { codeVerifier?: unknown; state?: unknown; startedAt?: unknown };
	return typeof candidate.codeVerifier === 'string'
		&& !!candidate.codeVerifier
		&& typeof candidate.state === 'string'
		&& !!candidate.state
		&& typeof candidate.startedAt === 'number'
		&& Number.isFinite(candidate.startedAt);
}

/**
 * Bridge for SafeAppeals Cloud web OAuth: persist PKCE pending in origin-shared
 * localStorage so empty-window vs workspace / reload can restore it when
 * SecretStorage and profile-scoped globalState cannot.
 * Plaintext localStorage is a deliberate web-OAuth exception to SecretStorage-only,
 * mitigated by a 5-minute TTL and clear-on-consume.
 */
CommandsRegistry.registerCommand('_safeappeals.cloud.storePendingPkce', (_accessor, arg: unknown) => {
	if (!isPendingPkcePayload(arg)) {
		return;
	}
	localStorage.setItem(PENDING_PKCE_LOCAL_STORAGE_KEY, JSON.stringify({
		codeVerifier: arg.codeVerifier,
		state: arg.state,
		startedAt: arg.startedAt,
	}));
});

CommandsRegistry.registerCommand('_safeappeals.cloud.readPendingPkce', (): PendingPkcePayload | undefined => {
	const raw = localStorage.getItem(PENDING_PKCE_LOCAL_STORAGE_KEY);
	if (!raw) {
		return undefined;
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (!isPendingPkcePayload(parsed)) {
			return undefined;
		}
		if (Date.now() - parsed.startedAt > PENDING_PKCE_MAX_AGE_MS) {
			localStorage.removeItem(PENDING_PKCE_LOCAL_STORAGE_KEY);
			return undefined;
		}
		return {
			codeVerifier: parsed.codeVerifier,
			state: parsed.state,
			startedAt: parsed.startedAt,
		};
	} catch {
		return undefined;
	}
});

CommandsRegistry.registerCommand('_safeappeals.cloud.clearPendingPkce', () => {
	localStorage.removeItem(PENDING_PKCE_LOCAL_STORAGE_KEY);
});

/**
 * Read a valid SafeAppeals durable OAuth callback (code+state) without removing it.
 * Cleared after successful exchange / pending settle via
 * `_safeappeals.cloud.clearDurableOAuthCallback`, or immediately on
 * TTL/malformed/wrong-authority/code-less payloads (aligns with recoverOrphanedCallbacks).
 */
CommandsRegistry.registerCommand('_safeappeals.cloud.peekDurableOAuthCallback', (): DurableOAuthCodeState | undefined => {
	const raw = localStorage.getItem(DURABLE_OAUTH_CALLBACK_KEY);
	if (!raw) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(raw) as UriComponents & { ts?: number };
		const ts = typeof parsed.ts === 'number' ? parsed.ts : 0;
		if (Date.now() - ts > DURABLE_OAUTH_CALLBACK_MAX_AGE_MS) {
			localStorage.removeItem(DURABLE_OAUTH_CALLBACK_KEY);
			return undefined;
		}
		const { ts: _ts, ...uriComponents } = parsed;
		const uri = URI.revive(uriComponents);
		if (uri.authority !== SAFEAPPEALS_AUTH_AUTHORITY || uri.path !== SAFEAPPEALS_AUTH_CALLBACK_PATH) {
			localStorage.removeItem(DURABLE_OAUTH_CALLBACK_KEY);
			return undefined;
		}
		const params = new URLSearchParams(uri.query ?? '');
		const code = params.get('code');
		const state = params.get('state');
		if (!code || !state) {
			localStorage.removeItem(DURABLE_OAUTH_CALLBACK_KEY);
			return undefined;
		}
		return { code, state };
	} catch {
		localStorage.removeItem(DURABLE_OAUTH_CALLBACK_KEY);
		return undefined;
	}
});

/**
 * Removes the durable SafeAppeals OAuth callback key after exchange success or
 * when pending sign-in settles unsuccessfully.
 */
CommandsRegistry.registerCommand('_safeappeals.cloud.clearDurableOAuthCallback', () => {
	localStorage.removeItem(DURABLE_OAUTH_CALLBACK_KEY);
});

/**
 * Safety net when the durable key was already burned but an ephemeral
 * `vscode-web.url-callbacks[*]` SafeAppeals callback remains (e.g. after reload).
 * Finds the newest matching entry, removes that key, and returns code+state.
 */
CommandsRegistry.registerCommand('_safeappeals.cloud.takeOrphanedUrlCallback', (): DurableOAuthCodeState | undefined => {
	let best: { readonly key: string; readonly id: number; readonly code: string; readonly state: string } | undefined;

	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (!key || !key.startsWith('vscode-web.url-callbacks[')) {
			continue;
		}
		const match = /^vscode-web\.url-callbacks\[(\d+)\]$/.exec(key);
		if (!match) {
			continue;
		}
		const id = Number(match[1]);
		const result = localStorage.getItem(key);
		if (result === null) {
			continue;
		}
		try {
			const uri = URI.revive(JSON.parse(result));
			if (uri.authority !== SAFEAPPEALS_AUTH_AUTHORITY || uri.path !== SAFEAPPEALS_AUTH_CALLBACK_PATH) {
				continue;
			}
			const params = new URLSearchParams(uri.query ?? '');
			const code = params.get('code');
			const state = params.get('state');
			if (!code || !state) {
				continue;
			}
			if (!best || id > best.id) {
				best = { key, id, code, state };
			}
		} catch {
			// Ignore malformed ephemeral entries.
		}
	}

	if (!best) {
		return undefined;
	}
	localStorage.removeItem(best.key);
	return { code: best.code, state: best.state };
});

interface ISecretStorageCrypto {
	seal(data: string): Promise<string>;
	unseal(data: string): Promise<string>;
}

class TransparentCrypto implements ISecretStorageCrypto {

	async seal(data: string): Promise<string> {
		return data;
	}

	async unseal(data: string): Promise<string> {
		return data;
	}
}

const enum AESConstants {
	ALGORITHM = 'AES-GCM',
	KEY_LENGTH = 256,
	IV_LENGTH = 12,
}

class NetworkError extends Error {

	constructor(inner: Error) {
		super(inner.message);
		this.name = inner.name;
		this.stack = inner.stack;
	}
}

class ServerKeyedAESCrypto implements ISecretStorageCrypto {

	private serverKey: Uint8Array | undefined;

	/**
	 * Gets whether the algorithm is supported; requires a secure context
	 */
	static supported() {
		return !!crypto.subtle;
	}

	constructor(private readonly authEndpoint: string) { }

	async seal(data: string): Promise<string> {
		// Get a new key and IV on every change, to avoid the risk of reusing the same key and IV pair with AES-GCM
		// (see also: https://developer.mozilla.org/en-US/docs/Web/API/AesGcmParams#properties)
		const iv = mainWindow.crypto.getRandomValues(new Uint8Array(AESConstants.IV_LENGTH));
		// crypto.getRandomValues isn't a good-enough PRNG to generate crypto keys, so we need to use crypto.subtle.generateKey and export the key instead
		const clientKeyObj = await mainWindow.crypto.subtle.generateKey(
			{ name: AESConstants.ALGORITHM as const, length: AESConstants.KEY_LENGTH as const },
			true,
			['encrypt', 'decrypt']
		);

		const clientKey = new Uint8Array(await mainWindow.crypto.subtle.exportKey('raw', clientKeyObj));
		const key = await this.getKey(clientKey);
		const dataUint8Array = new TextEncoder().encode(data);
		const cipherText: ArrayBuffer = await mainWindow.crypto.subtle.encrypt(
			{ name: AESConstants.ALGORITHM as const, iv },
			key,
			dataUint8Array
		);

		// Base64 encode the result and store the ciphertext, the key, and the IV in localStorage
		// Note that the clientKey and IV don't need to be secret
		const result = new Uint8Array([...clientKey, ...iv, ...new Uint8Array(cipherText)]);
		return encodeBase64(VSBuffer.wrap(result));
	}

	async unseal(data: string): Promise<string> {
		// encrypted should contain, in order: the key (32-byte), the IV for AES-GCM (12-byte) and the ciphertext (which has the GCM auth tag at the end)
		// Minimum length must be 44 (key+IV length) + 16 bytes (1 block encrypted with AES - regardless of key size)
		const dataUint8Array = decodeBase64(data);

		if (dataUint8Array.byteLength < 60) {
			throw Error('Invalid length for the value for credentials.crypto');
		}

		const keyLength = AESConstants.KEY_LENGTH / 8;
		const clientKey = dataUint8Array.slice(0, keyLength);
		const iv = dataUint8Array.slice(keyLength, keyLength + AESConstants.IV_LENGTH);
		const cipherText = dataUint8Array.slice(keyLength + AESConstants.IV_LENGTH);

		// Do the decryption and parse the result as JSON
		const key = await this.getKey(clientKey.buffer);
		const decrypted = await mainWindow.crypto.subtle.decrypt(
			{ name: AESConstants.ALGORITHM as const, iv: iv.buffer as Uint8Array<ArrayBuffer> },
			key,
			cipherText.buffer as Uint8Array<ArrayBuffer>
		);

		return new TextDecoder().decode(new Uint8Array(decrypted));
	}

	/**
	 * Given a clientKey, returns the CryptoKey object that is used to encrypt/decrypt the data.
	 * The actual key is (clientKey XOR serverKey)
	 */
	private async getKey(clientKey: Uint8Array): Promise<CryptoKey> {
		if (!clientKey || clientKey.byteLength !== AESConstants.KEY_LENGTH / 8) {
			throw Error('Invalid length for clientKey');
		}

		const serverKey = await this.getServerKeyPart();
		const keyData = new Uint8Array(AESConstants.KEY_LENGTH / 8);

		for (let i = 0; i < keyData.byteLength; i++) {
			keyData[i] = clientKey[i] ^ serverKey[i];
		}

		return mainWindow.crypto.subtle.importKey(
			'raw',
			keyData,
			{
				name: AESConstants.ALGORITHM as const,
				length: AESConstants.KEY_LENGTH as const,
			},
			true,
			['encrypt', 'decrypt']
		);
	}

	private async getServerKeyPart(): Promise<Uint8Array> {
		if (this.serverKey) {
			return this.serverKey;
		}

		let attempt = 0;
		let lastError: Error | undefined;

		while (attempt <= 3) {
			try {
				const res = await fetch(this.authEndpoint, { credentials: 'include', method: 'POST' });
				if (!res.ok) {
					throw new Error(res.statusText);
				}

				const serverKey = new Uint8Array(await res.arrayBuffer());
				if (serverKey.byteLength !== AESConstants.KEY_LENGTH / 8) {
					throw Error(`The key retrieved by the server is not ${AESConstants.KEY_LENGTH} bit long.`);
				}

				this.serverKey = serverKey;

				return this.serverKey;
			} catch (e) {
				lastError = e instanceof Error ? e : new Error(String(e));
				attempt++;

				// exponential backoff
				await new Promise(resolve => setTimeout(resolve, attempt * attempt * 100));
			}
		}

		if (lastError) {
			throw new NetworkError(lastError);
		}

		throw new Error('Unknown error');
	}
}

export class LocalStorageSecretStorageProvider implements ISecretStorageProvider {

	private readonly storageKey = 'secrets.provider';

	private secretsPromise: Promise<Record<string, string>>;

	type: 'in-memory' | 'persisted' | 'unknown' = 'persisted';

	constructor(
		private readonly crypto: ISecretStorageCrypto,
	) {
		this.secretsPromise = this.load();
	}

	private async load(): Promise<Record<string, string>> {
		const record = this.loadAuthSessionFromElement();

		const encrypted = localStorage.getItem(this.storageKey);
		if (encrypted) {
			try {
				const decrypted = JSON.parse(await this.crypto.unseal(encrypted));

				return { ...record, ...decrypted };
			} catch (err) {
				// TODO: send telemetry
				console.error('Failed to decrypt secrets from localStorage', err);
				if (!(err instanceof NetworkError)) {
					localStorage.removeItem(this.storageKey);
				}
			}
		}

		return record;
	}

	private loadAuthSessionFromElement(): Record<string, string> {
		let authSessionInfo: (AuthenticationSessionInfo & { scopes: string[][] }) | undefined;
		// eslint-disable-next-line no-restricted-syntax
		const authSessionElement = mainWindow.document.getElementById('vscode-workbench-auth-session');
		const authSessionElementAttribute = authSessionElement ? authSessionElement.getAttribute('data-settings') : undefined;
		if (authSessionElementAttribute) {
			try {
				authSessionInfo = JSON.parse(authSessionElementAttribute);
			} catch (error) { /* Invalid session is passed. Ignore. */ }
		}

		if (!authSessionInfo) {
			return {};
		}

		const record: Record<string, string> = {};

		// Settings Sync Entry
		record[`${product.urlProtocol}.loginAccount`] = JSON.stringify(authSessionInfo);

		return record;
	}

	async get(key: string): Promise<string | undefined> {
		const secrets = await this.secretsPromise;

		return secrets[key];
	}

	async set(key: string, value: string): Promise<void> {
		const secrets = await this.secretsPromise;
		secrets[key] = value;
		this.secretsPromise = Promise.resolve(secrets);
		this.save();
	}

	async delete(key: string): Promise<void> {
		const secrets = await this.secretsPromise;
		delete secrets[key];
		this.secretsPromise = Promise.resolve(secrets);
		this.save();
	}

	async keys(): Promise<string[]> {
		const secrets = await this.secretsPromise;
		return Object.keys(secrets) || [];
	}

	private async save(): Promise<void> {
		try {
			const encrypted = await this.crypto.seal(JSON.stringify(await this.secretsPromise));
			localStorage.setItem(this.storageKey, encrypted);
		} catch (err) {
			console.error(err);
		}
	}
}

class LocalStorageURLCallbackProvider extends Disposable implements IURLCallbackProvider {

	private static REQUEST_ID = 0;

	private static QUERY_KEYS: ('scheme' | 'authority' | 'path' | 'query' | 'fragment')[] = [
		'scheme',
		'authority',
		'path',
		'query',
		'fragment'
	];

	/** Debounce recover fires so an unhandled open does not spin-fire forever. */
	private static readonly RECOVER_FIRE_DEBOUNCE_MS = 1000;

	private readonly _onCallback = this._register(new Emitter<URI>());
	readonly onCallback = this._onCallback.event;

	private pendingCallbacks = new Set<number>();
	private lastTimeChecked = Date.now();
	private checkCallbacksTimeout: Timeout | undefined = undefined;
	private onDidChangeLocalStorageDisposable: IDisposable | undefined;
	/** Timestamp of last recover/orphan fire for the durable SafeAppeals key. */
	private lastDurableFireTs = 0;

	constructor(private readonly _callbackRoute: string) {
		super();
		// Always listen: after a workbench reload, pendingCallbacks is empty but a
		// popup may still write safeappeals-cloud.oauthCallback a moment later.
		this.startListening();
	}

	create(options: Partial<UriComponents> = {}): URI {
		const id = ++LocalStorageURLCallbackProvider.REQUEST_ID;
		const queryParams: string[] = [`vscode-reqid=${id}`];

		for (const key of LocalStorageURLCallbackProvider.QUERY_KEYS) {
			const value = options[key];

			if (value) {
				queryParams.push(`vscode-${key}=${encodeURIComponent(value)}`);
			}
		}

		const key = `vscode-web.url-callbacks[${id}]`;
		localStorage.removeItem(key);

		this.pendingCallbacks.add(id);
		this.startListening();

		return URI.parse(mainWindow.location.href).with({ path: this._callbackRoute, query: queryParams.join('&') });
	}

	/**
	 * Opens a SafeAppeals OAuth callback persisted in localStorage across reload.
	 * Must run only after a listener is attached to {@link onCallback}.
	 * Fires without removing the durable key — the auth extension clears it only
	 * after a successful code exchange (open()===true is not enough: ExtensionUrlHandler
	 * returns true after buffer+activate before exchange finishes).
	 *
	 * @returns `true` when a URI was fired (or expired/invalid and cleared);
	 * `false` when nothing to recover / no listeners / debounce blocked (retry later).
	 */
	recoverOrphanedCallbacks(): boolean {
		if (!this._onCallback.hasListeners()) {
			return false;
		}

		const raw = localStorage.getItem(DURABLE_OAUTH_CALLBACK_KEY);
		if (raw === null) {
			return false;
		}

		try {
			const parsed = JSON.parse(raw) as UriComponents & { ts?: number };
			const ts = typeof parsed.ts === 'number' ? parsed.ts : 0;
			if (Date.now() - ts > DURABLE_OAUTH_CALLBACK_MAX_AGE_MS) {
				localStorage.removeItem(DURABLE_OAUTH_CALLBACK_KEY);
				return true;
			}

			const now = Date.now();
			if (now - this.lastDurableFireTs < LocalStorageURLCallbackProvider.RECOVER_FIRE_DEBOUNCE_MS) {
				return false;
			}

			const { ts: _ts, ...uriComponents } = parsed;
			const durableUri = URI.revive(uriComponents);
			// Authority guard: never replay GitHub / other provider URIs from the durable key.
			if (!this.isSafeAppealsOAuthCallbackUri(durableUri)) {
				localStorage.removeItem(DURABLE_OAUTH_CALLBACK_KEY);
				return true;
			}
			// Drop matching orphaned vscode-web copies; leave durable key until open succeeds.
			this.sweepOrphanedSafeAppealsUrlCallbackKeys(durableUri);
			this.lastDurableFireTs = now;
			this._onCallback.fire(durableUri);
			return true;
		} catch (error) {
			localStorage.removeItem(DURABLE_OAUTH_CALLBACK_KEY);
			console.error(error);
			return true;
		}
	}

	/**
	 * Removes the durable SafeAppeals OAuth key after a successful code exchange.
	 * Prefer the `_safeappeals.cloud.clearDurableOAuthCallback` command from the
	 * auth extension; this remains for direct provider callers.
	 * When {@link uri} is provided, removes only if it matches the stored payload.
	 * When omitted, clears any valid SafeAppeals durable callback.
	 *
	 * @returns `true` when the durable key was actually removed; `false` otherwise.
	 */
	clearDurableOAuthCallback(uri?: URI): boolean {
		if (uri !== undefined) {
			if (!this.matchesDurableOAuthCallback(uri)) {
				return false;
			}
			localStorage.removeItem(DURABLE_OAUTH_CALLBACK_KEY);
			return true;
		}

		const raw = localStorage.getItem(DURABLE_OAUTH_CALLBACK_KEY);
		if (raw === null) {
			return false;
		}
		try {
			const parsed = JSON.parse(raw) as UriComponents & { ts?: number };
			const { ts: _ts, ...uriComponents } = parsed;
			const durableUri = URI.revive(uriComponents);
			if (!this.isSafeAppealsOAuthCallbackUri(durableUri)) {
				return false;
			}
			localStorage.removeItem(DURABLE_OAUTH_CALLBACK_KEY);
			return true;
		} catch {
			localStorage.removeItem(DURABLE_OAUTH_CALLBACK_KEY);
			return true;
		}
	}

	/**
	 * Removes orphaned vscode-web.url-callbacks[*] entries that are SafeAppeals OAuth
	 * callbacks matching {@link durableUri} and are not in this window's pendingCallbacks.
	 * Called when {@link recoverOrphanedCallbacks} fires a durable URI.
	 */
	private sweepOrphanedSafeAppealsUrlCallbackKeys(durableUri: URI): void {
		if (!this.isSafeAppealsOAuthCallbackUri(durableUri)) {
			return;
		}

		const keysToRemove: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (!key || !key.startsWith('vscode-web.url-callbacks[')) {
				continue;
			}
			const match = /^vscode-web\.url-callbacks\[(\d+)\]$/.exec(key);
			if (!match) {
				continue;
			}
			const id = Number(match[1]);
			if (this.pendingCallbacks.has(id)) {
				continue;
			}
			const result = localStorage.getItem(key);
			if (result === null) {
				continue;
			}
			try {
				const uri = URI.revive(JSON.parse(result));
				if (this.isSafeAppealsOAuthCallbackUri(uri) && isEqual(uri, durableUri)) {
					keysToRemove.push(key);
				}
			} catch {
				// Ignore malformed entries; do not delete unknown payloads.
			}
		}
		for (const key of keysToRemove) {
			localStorage.removeItem(key);
		}
	}

	/**
	 * True for SafeAppeals Cloud asExternalUri OAuth callbacks
	 * (`…://safeappeals.safeappeals-authentication/auth/callback`).
	 */
	private isSafeAppealsOAuthCallbackUri(uri: URI): boolean {
		return uri.authority === SAFEAPPEALS_AUTH_AUTHORITY
			&& uri.path === SAFEAPPEALS_AUTH_CALLBACK_PATH;
	}

	/**
	 * True when {@link uri} matches the durable SafeAppeals OAuth callback in localStorage.
	 */
	private matchesDurableOAuthCallback(uri: URI): boolean {
		const raw = localStorage.getItem(DURABLE_OAUTH_CALLBACK_KEY);
		if (raw === null) {
			return false;
		}
		try {
			const parsed = JSON.parse(raw) as UriComponents & { ts?: number };
			const { ts: _ts, ...uriComponents } = parsed;
			return isEqual(uri, URI.revive(uriComponents));
		} catch {
			return false;
		}
	}

	private startListening(): void {
		if (this.onDidChangeLocalStorageDisposable) {
			return;
		}

		this.onDidChangeLocalStorageDisposable = addDisposableListener(mainWindow, 'storage', () => this.onDidChangeLocalStorage());
	}

	private stopListening(): void {
		this.onDidChangeLocalStorageDisposable?.dispose();
		this.onDidChangeLocalStorageDisposable = undefined;
	}

	// this fires every time local storage changes, but we
	// don't want to check more often than once a second
	private async onDidChangeLocalStorage(): Promise<void> {
		const ellapsed = Date.now() - this.lastTimeChecked;

		if (ellapsed > 1000) {
			this.checkCallbacks();
		} else if (this.checkCallbacksTimeout === undefined) {
			this.checkCallbacksTimeout = setTimeout(() => {
				this.checkCallbacksTimeout = undefined;
				this.checkCallbacks();
			}, 1000 - ellapsed);
		}
	}

	private checkCallbacks(): void {
		let pendingCallbacks: Set<number> | undefined;
		let deliveredSafeAppealsOAuth = false;

		for (const id of this.pendingCallbacks) {
			const key = `vscode-web.url-callbacks[${id}]`;
			const result = localStorage.getItem(key);

			if (result !== null) {
				try {
					const uri = URI.revive(JSON.parse(result));
					// Mark SafeAppeals durable delivery so recover does not double-fire.
					// Do NOT clear durable here — auth extension clears after successful exchange.
					if (this.matchesDurableOAuthCallback(uri)) {
						deliveredSafeAppealsOAuth = true;
						this.lastDurableFireTs = Date.now();
					}
					this._onCallback.fire(uri);
				} catch (error) {
					console.error(error);
				}

				pendingCallbacks = pendingCallbacks ?? new Set(this.pendingCallbacks);
				pendingCallbacks.delete(id);
				// Ephemeral pending-id key can clear immediately after fire.
				localStorage.removeItem(key);
			}
		}

		if (pendingCallbacks) {
			this.pendingCallbacks = pendingCallbacks;
			// Keep listening for durable late-completion after reload (do not stopListening).
		}

		// Popup finished after a workbench reload: no in-session pending id, use durable key.
		if (!deliveredSafeAppealsOAuth) {
			this.recoverOrphanedCallbacks();
		}

		this.lastTimeChecked = Date.now();
	}

	override dispose(): void {
		clearTimeout(this.checkCallbacksTimeout);
		this.stopListening();
		super.dispose();
	}
}

class WorkspaceProvider implements IWorkspaceProvider {

	private static QUERY_PARAM_EMPTY_WINDOW = 'ew';
	private static QUERY_PARAM_FOLDER = 'folder';
	private static QUERY_PARAM_WORKSPACE = 'workspace';

	private static QUERY_PARAM_PAYLOAD = 'payload';

	static create(config: IWorkbenchConstructionOptions & { folderUri?: UriComponents; workspaceUri?: UriComponents }) {
		let foundWorkspace = false;
		let workspace: IWorkspace;
		let payload = Object.create(null);

		const query = new URL(document.location.href).searchParams;
		query.forEach((value, key) => {
			switch (key) {

				// Folder
				case WorkspaceProvider.QUERY_PARAM_FOLDER:
					if (config.remoteAuthority && value.startsWith(posix.sep)) {
						// when connected to a remote and having a value
						// that is a path (begins with a `/`), assume this
						// is a vscode-remote resource as simplified URL.
						workspace = { folderUri: URI.from({ scheme: Schemas.vscodeRemote, path: value, authority: config.remoteAuthority }) };
					} else {
						workspace = { folderUri: URI.parse(value) };
					}
					foundWorkspace = true;
					break;

				// Workspace
				case WorkspaceProvider.QUERY_PARAM_WORKSPACE:
					if (config.remoteAuthority && value.startsWith(posix.sep)) {
						// when connected to a remote and having a value
						// that is a path (begins with a `/`), assume this
						// is a vscode-remote resource as simplified URL.
						workspace = { workspaceUri: URI.from({ scheme: Schemas.vscodeRemote, path: value, authority: config.remoteAuthority }) };
					} else {
						workspace = { workspaceUri: URI.parse(value) };
					}
					foundWorkspace = true;
					break;

				// Empty
				case WorkspaceProvider.QUERY_PARAM_EMPTY_WINDOW:
					workspace = undefined;
					foundWorkspace = true;
					break;

				// Payload
				case WorkspaceProvider.QUERY_PARAM_PAYLOAD:
					try {
						payload = parse(value); // use marshalling#parse() to revive potential URIs
					} catch (error) {
						console.error(error); // possible invalid JSON
					}
					break;
			}
		});

		// If no workspace is provided through the URL, check for config
		// attribute from server
		if (!foundWorkspace) {
			if (config.folderUri) {
				workspace = { folderUri: URI.revive(config.folderUri) };
			} else if (config.workspaceUri) {
				workspace = { workspaceUri: URI.revive(config.workspaceUri) };
			}
		}

		return new WorkspaceProvider(workspace, payload, config);
	}

	readonly trusted = true;

	private constructor(
		readonly workspace: IWorkspace,
		readonly payload: object,
		private readonly config: IWorkbenchConstructionOptions
	) {
	}

	async open(workspace: IWorkspace, options?: { reuse?: boolean; payload?: object }): Promise<boolean> {
		if (options?.reuse && !options.payload && this.isSame(this.workspace, workspace)) {
			return true; // return early if workspace and environment is not changing and we are reusing window
		}

		const targetHref = this.createTargetUrl(workspace, options);
		if (targetHref) {
			if (options?.reuse) {
				mainWindow.location.href = targetHref;
				return true;
			} else {
				let result;
				if (isStandalone()) {
					result = mainWindow.open(targetHref, '_blank', 'toolbar=no'); // ensures to open another 'standalone' window!
				} else {
					result = mainWindow.open(targetHref);
				}

				return !!result;
			}
		}

		return false;
	}

	private createTargetUrl(workspace: IWorkspace, options?: { reuse?: boolean; payload?: object }): string | undefined {

		// Empty
		let targetHref: string | undefined = undefined;
		if (!workspace) {
			targetHref = `${document.location.origin}${document.location.pathname}?${WorkspaceProvider.QUERY_PARAM_EMPTY_WINDOW}=true`;
		}

		// Folder
		else if (isFolderToOpen(workspace)) {
			const queryParamFolder = this.encodeWorkspacePath(workspace.folderUri);
			targetHref = `${document.location.origin}${document.location.pathname}?${WorkspaceProvider.QUERY_PARAM_FOLDER}=${queryParamFolder}`;
		}

		// Workspace
		else if (isWorkspaceToOpen(workspace)) {
			const queryParamWorkspace = this.encodeWorkspacePath(workspace.workspaceUri);
			targetHref = `${document.location.origin}${document.location.pathname}?${WorkspaceProvider.QUERY_PARAM_WORKSPACE}=${queryParamWorkspace}`;
		}

		// Append payload if any
		if (options?.payload) {
			targetHref += `&${WorkspaceProvider.QUERY_PARAM_PAYLOAD}=${encodeURIComponent(JSON.stringify(options.payload))}`;
		}

		return targetHref;
	}

	private encodeWorkspacePath(uri: URI): string {
		if (this.config.remoteAuthority && uri.scheme === Schemas.vscodeRemote) {

			// when connected to a remote and having a folder
			// or workspace for that remote, only use the path
			// as query value to form shorter, nicer URLs.
			// however, we still need to `encodeURIComponent`
			// to ensure to preserve special characters, such
			// as `+` in the path.

			return encodeURIComponent(`${posix.sep}${ltrim(uri.path, posix.sep)}`).replaceAll('%2F', '/');
		}

		return encodeURIComponent(uri.toString(true));
	}

	private isSame(workspaceA: IWorkspace, workspaceB: IWorkspace): boolean {
		if (!workspaceA || !workspaceB) {
			return workspaceA === workspaceB; // both empty
		}

		if (isFolderToOpen(workspaceA) && isFolderToOpen(workspaceB)) {
			return isEqual(workspaceA.folderUri, workspaceB.folderUri); // same workspace
		}

		if (isWorkspaceToOpen(workspaceA) && isWorkspaceToOpen(workspaceB)) {
			return isEqual(workspaceA.workspaceUri, workspaceB.workspaceUri); // same workspace
		}

		return false;
	}

	hasRemote(): boolean {
		if (this.workspace) {
			if (isFolderToOpen(this.workspace)) {
				return this.workspace.folderUri.scheme === Schemas.vscodeRemote;
			}

			if (isWorkspaceToOpen(this.workspace)) {
				return this.workspace.workspaceUri.scheme === Schemas.vscodeRemote;
			}
		}

		return true;
	}
}

function readCookie(name: string): string | undefined {
	const cookies = document.cookie.split('; ');
	for (const cookie of cookies) {
		if (cookie.startsWith(name + '=')) {
			return cookie.substring(name.length + 1);
		}
	}

	return undefined;
}

(function () {

	// Find config by checking for DOM
	// eslint-disable-next-line no-restricted-syntax
	const configElement = mainWindow.document.getElementById('vscode-workbench-web-configuration');
	const configElementAttribute = configElement ? configElement.getAttribute('data-settings') : undefined;
	if (!configElement || !configElementAttribute) {
		throw new Error('Missing web configuration element');
	}
	const config: IWorkbenchConstructionOptions & { folderUri?: UriComponents; workspaceUri?: UriComponents; callbackRoute: string } = JSON.parse(configElementAttribute);
	const secretStorageKeyPath = readCookie('vscode-secret-key-path');
	const secretStorageCrypto = secretStorageKeyPath && ServerKeyedAESCrypto.supported()
		? new ServerKeyedAESCrypto(secretStorageKeyPath) : new TransparentCrypto();

	// Create workbench
	create(mainWindow.document.body, {
		...config,
		windowIndicator: config.windowIndicator ?? { label: '$(remote)', tooltip: `${product.nameShort} Web` },
		settingsSyncOptions: config.settingsSyncOptions ? { enabled: config.settingsSyncOptions.enabled, } : undefined,
		workspaceProvider: WorkspaceProvider.create(config),
		urlCallbackProvider: new LocalStorageURLCallbackProvider(config.callbackRoute),
		secretStorageProvider: config.remoteAuthority && !secretStorageKeyPath
			? undefined /* with a remote without embedder-preferred storage, store on the remote */
			: new LocalStorageSecretStorageProvider(secretStorageCrypto),
	});
})();

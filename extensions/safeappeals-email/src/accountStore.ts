/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*--------------------------------------------------------------------------------------
 *  Account credentials in SecretStorage; metadata in settings / globalStorage
 *--------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import type { SecretStorage } from 'vscode';
import {
	credentialsForStorage,
	isOAuthCredentials,
	normalizeCredentials,
	type EmailAccountAuthStatus,
	type EmailAccountConfig,
	type EmailAccountCredentials,
	type EmailAccountCredentialsInput,
	type EmailOAuthProvider,
} from './types';

function secretKey(accountId: string): string {
	return `safeappeals-email.account.${accountId}`;
}

/** Injectable account-metadata persistence (defaults to settings via config.ts). */
export interface AccountConfigPersistence {
	list(): EmailAccountConfig[];
	save(accounts: EmailAccountConfig[]): Promise<void>;
	initialize?(): Promise<void>;
}

function defaultPersistence(secrets: SecretStorage): AccountConfigPersistence {
	// Lazy require keeps unit tests that inject persistence off the vscode/config path.
	const config = require('./config') as typeof import('./config');
	const metadataKey = 'safeappeals-email.accountMetadata';
	let cached = config.getConfiguredAccounts();
	return {
		list: () => cached,
		save: async accounts => {
			await secrets.store(metadataKey, JSON.stringify(accounts));
			cached = accounts;
			await config.setConfiguredAccounts([]);
		},
		initialize: async () => {
			const encrypted = await secrets.get(metadataKey);
			if (encrypted) {
				const parsed = JSON.parse(encrypted) as EmailAccountConfig[];
				cached = Array.isArray(parsed) ? parsed : [];
				await config.setConfiguredAccounts([]);
			} else if (cached.length > 0) {
				await secrets.store(metadataKey, JSON.stringify(cached));
				await config.setConfiguredAccounts([]);
			}
		},
	};
}

function defaultShowError(message: string): void {
	try {
		const vscode = require('vscode') as typeof import('vscode');
		void vscode.window.showErrorMessage(message);
	} catch {
		// Tests / environments without vscode — ignore.
	}
}

export class AccountStore {
	private readonly persistence: AccountConfigPersistence;
	private readonly showError: (message: string) => void;

	constructor(
		private readonly secrets: SecretStorage,
		private readonly log?: (msg: string) => void,
		persistence?: AccountConfigPersistence,
		showError?: (message: string) => void,
	) {
		this.persistence = persistence ?? defaultPersistence(secrets);
		this.showError = showError ?? defaultShowError;
	}

	async initialize(): Promise<void> {
		await this.persistence.initialize?.();
	}

	listAccounts(): EmailAccountConfig[] {
		return this.persistence.list();
	}

	getAccount(accountId: string): EmailAccountConfig | undefined {
		return this.persistence.list().find((a) => a.id === accountId);
	}

	async getCredentials(accountId: string): Promise<EmailAccountCredentials | undefined> {
		const raw = await this.secrets.get(secretKey(accountId));
		if (!raw) {
			return undefined;
		}
		try {
			const parsed: unknown = JSON.parse(raw);
			return normalizeCredentials(parsed);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.log?.(
				`getCredentials: JSON parse failed for account ${accountId}: ${message} (rawLength=${raw.length})`,
			);
			return undefined;
		}
	}

	/**
	 * Persist account metadata + credentials.
	 *
	 * Binding rule (E4 enforces at UX): do **not** call this with `{ type: 'oauth' }`
	 * until a mail-scoped access token has been minted **and** server refresh
	 * persistence is ACK'd. The store itself accepts oauth credentials when given.
	 */
	async addAccount(
		config: Omit<EmailAccountConfig, 'id'> & { id?: string },
		credentials: EmailAccountCredentialsInput,
	): Promise<EmailAccountConfig> {
		const normalized = normalizeCredentials(credentials);
		if (!normalized) {
			throw new Error('Invalid email account credentials');
		}
		const toStore = credentialsForStorage(normalized);

		const id = config.id || randomUUID();
		const account: EmailAccountConfig = {
			id,
			label: config.label || config.email || config.username,
			email: config.email,
			imapHost: config.imapHost,
			imapPort: config.imapPort,
			imapSecure: config.imapSecure,
			smtpHost: config.smtpHost,
			smtpPort: config.smtpPort,
			smtpSecure: config.smtpSecure,
			username: config.username,
			...(config.authStatus ? { authStatus: config.authStatus } : {}),
		};

		// Store secret FIRST so a failed SecretStorage write never leaves a ghost
		// account in settings (and concurrent sync cannot observe metadata-without-creds).
		try {
			await this.secrets.store(secretKey(id), JSON.stringify(toStore));
			const accounts = this.persistence.list().filter((a) => a.id !== id);
			accounts.push(account);
			await this.persistence.save(accounts);
			return account;
		} catch (err) {
			try {
				await this.secrets.delete(secretKey(id));
			} catch {
				// best-effort cleanup of orphaned secret
			}
			const message = err instanceof Error ? err.message : String(err);
			this.log?.(`addAccount failed for ${account.label}: ${message}`);
			this.showError(`Failed to save email account credentials: ${message}`);
			throw err;
		}
	}

	async removeAccount(accountId: string): Promise<boolean> {
		const before = this.persistence.list();
		const accounts = before.filter((a) => a.id !== accountId);
		if (accounts.length === before.length) {
			return false;
		}
		await this.persistence.save(accounts);
		await this.secrets.delete(secretKey(accountId));
		return true;
	}

	async updateCredentials(
		accountId: string,
		credentials: EmailAccountCredentialsInput,
	): Promise<void> {
		if (!this.getAccount(accountId)) {
			throw new Error(`Unknown account: ${accountId}`);
		}
		const normalized = normalizeCredentials(credentials);
		if (!normalized) {
			throw new Error('Invalid email account credentials');
		}
		await this.secrets.store(
			secretKey(accountId),
			JSON.stringify(credentialsForStorage(normalized)),
		);
	}

	/** Mark an account as needing mailbox reconnect (sidebar / toast). */
	async markAccountNeedsReconnect(accountId: string): Promise<void> {
		await this.setAuthStatus(accountId, 'needsReconnect');
	}

	/** Clear reconnect flag after a successful mint / reconnect. */
	async clearNeedsReconnect(accountId: string): Promise<void> {
		await this.setAuthStatus(accountId, 'ok');
	}

	/**
	 * OAuth mailbox accounts for cloud sign-out cascade (E3/E4).
	 * Optionally filter by provider.
	 */
	async listOAuthAccounts(provider?: EmailOAuthProvider): Promise<EmailAccountConfig[]> {
		const accounts = this.persistence.list();
		const matched: EmailAccountConfig[] = [];
		for (const account of accounts) {
			const creds = await this.getCredentials(account.id);
			if (!creds || !isOAuthCredentials(creds)) {
				continue;
			}
			if (provider && creds.provider !== provider) {
				continue;
			}
			matched.push(account);
		}
		return matched;
	}

	private async setAuthStatus(
		accountId: string,
		authStatus: EmailAccountAuthStatus,
	): Promise<void> {
		const accounts = this.persistence.list();
		const index = accounts.findIndex((a) => a.id === accountId);
		if (index < 0) {
			throw new Error(`Unknown account: ${accountId}`);
		}
		const current = accounts[index]!;
		if (current.authStatus === authStatus) {
			return;
		}
		const next = [...accounts];
		next[index] = { ...current, authStatus };
		await this.persistence.save(next);
	}
}

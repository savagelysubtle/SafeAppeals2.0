/*--------------------------------------------------------------------------------------
 *  Account credentials in SecretStorage; metadata in settings / globalStorage
 *--------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import { getConfiguredAccounts, setConfiguredAccounts } from './config';
import type { EmailAccountConfig, EmailAccountCredentials } from './types';

function secretKey(accountId: string): string {
	return `safeappeals-email.account.${accountId}`;
}

export class AccountStore {
	constructor(
		private readonly secrets: vscode.SecretStorage,
		private readonly log?: (msg: string) => void,
	) {}

	listAccounts(): EmailAccountConfig[] {
		return getConfiguredAccounts();
	}

	getAccount(accountId: string): EmailAccountConfig | undefined {
		return getConfiguredAccounts().find((a) => a.id === accountId);
	}

	async getCredentials(accountId: string): Promise<EmailAccountCredentials | undefined> {
		const raw = await this.secrets.get(secretKey(accountId));
		if (!raw) {
			return undefined;
		}
		try {
			return JSON.parse(raw) as EmailAccountCredentials;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.log?.(
				`getCredentials: JSON parse failed for account ${accountId}: ${message} (rawLength=${raw.length})`,
			);
			return undefined;
		}
	}

	async addAccount(
		config: Omit<EmailAccountConfig, 'id'> & { id?: string },
		credentials: EmailAccountCredentials,
	): Promise<EmailAccountConfig> {
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
		};

		// Store secret FIRST so a failed SecretStorage write never leaves a ghost
		// account in settings (and concurrent sync cannot observe metadata-without-creds).
		try {
			await this.secrets.store(secretKey(id), JSON.stringify(credentials));
			const accounts = getConfiguredAccounts().filter((a) => a.id !== id);
			accounts.push(account);
			await setConfiguredAccounts(accounts);
			return account;
		} catch (err) {
			try {
				await this.secrets.delete(secretKey(id));
			} catch {
				// best-effort cleanup of orphaned secret
			}
			const message = err instanceof Error ? err.message : String(err);
			this.log?.(`addAccount failed for ${account.label}: ${message}`);
			void vscode.window.showErrorMessage(
				`Failed to save email account credentials: ${message}`,
			);
			throw err;
		}
	}

	async removeAccount(accountId: string): Promise<boolean> {
		const accounts = getConfiguredAccounts().filter((a) => a.id !== accountId);
		if (accounts.length === getConfiguredAccounts().length) {
			return false;
		}
		await setConfiguredAccounts(accounts);
		await this.secrets.delete(secretKey(accountId));
		return true;
	}

	async updateCredentials(accountId: string, credentials: EmailAccountCredentials): Promise<void> {
		if (!this.getAccount(accountId)) {
			throw new Error(`Unknown account: ${accountId}`);
		}
		await this.secrets.store(secretKey(accountId), JSON.stringify(credentials));
	}
}

/*--------------------------------------------------------------------------------------
 *  Background IMAP sync — calendar-style interval + manual sync
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AccountStore } from './accountStore';
import { runClassifierOnNewMessages, type ClassifierHook, noopClassifierHook } from './classifierSeam';
import { getDefaultFolder, getMaxMessagesPerSync, getSyncIntervalMinutes } from './config';
import { EmailIndex, toSummary } from './emailIndex';
import {
	describeImapError,
	diagnoseConnection,
	fetchHeaders,
	fetchMessageBody,
	listFolders,
	logImapErrorDetails,
	type DiagnoseConnectionResult,
} from './imapClient';
import { sendMail } from './smtpClient';
import type {
	EmailAccountConfig,
	ListThreadsQuery,
	SendMailRequest,
	SyncStatus,
} from './types';

export class SyncEngine implements vscode.Disposable {
	private timer: ReturnType<typeof setInterval> | undefined;
	private syncing = false;
	private readonly classifier: ClassifierHook;

	constructor(
		private readonly accounts: AccountStore,
		private readonly index: EmailIndex,
		private readonly log: (msg: string) => void,
		private readonly onStatusChange: () => void,
		classifier: ClassifierHook = noopClassifierHook,
	) {
		this.classifier = classifier;
	}

	startBackgroundSync(): void {
		this.stopBackgroundSync();
		const minutes = getSyncIntervalMinutes();
		const ms = minutes * 60 * 1000;
		this.log(`Background sync every ${minutes} min`);
		this.timer = setInterval(() => {
			void this.syncAll().catch((err) => {
				this.log(`Background sync error: ${err instanceof Error ? err.message : String(err)}`);
			});
		}, ms);
		// Kick once shortly after start
		setTimeout(() => {
			void this.syncAll().catch(() => undefined);
		}, 5_000);
	}

	stopBackgroundSync(): void {
		if (this.timer) {
			clearInterval(this.timer);
			this.timer = undefined;
		}
	}

	dispose(): void {
		this.stopBackgroundSync();
	}

	async getStatus(): Promise<SyncStatus> {
		const list = this.accounts.listAccounts();
		return {
			accounts: list.map((a) => {
				const meta = this.index.getAccountSyncMeta(a.id);
				return {
					accountId: a.id,
					label: a.label,
					email: a.email,
					lastSync: meta.lastSync,
					messageCount: this.index.countForAccount(a.id),
					error: meta.error,
				};
			}),
			lastBackgroundSync: this.index.getLastBackgroundSync(),
			syncIntervalMinutes: getSyncIntervalMinutes(),
			syncing: this.syncing,
		};
	}

	async syncAll(accountId?: string): Promise<SyncStatus> {
		if (this.syncing) {
			this.log('Sync already in progress');
			return this.getStatus();
		}
		this.syncing = true;
		this.onStatusChange();
		try {
			const targets = accountId
				? this.accounts.listAccounts().filter((a) => a.id === accountId)
				: this.accounts.listAccounts();

			if (targets.length === 0) {
				this.log('No accounts configured');
				return this.getStatus();
			}

			const folder = getDefaultFolder();
			const max = getMaxMessagesPerSync();

			for (const account of targets) {
				await this.syncAccount(account, folder, max);
			}
			return this.getStatus();
		} finally {
			this.syncing = false;
			this.onStatusChange();
		}
	}

	private async syncAccount(account: EmailAccountConfig, folder: string, max: number): Promise<void> {
		const creds = await this.accounts.getCredentials(account.id);
		if (!creds) {
			const missingMsg =
				'Credentials missing — use Account… → Update password to re-enter it.';
			this.log(`Skip ${account.label}: no credentials in SecretStorage`);
			await this.index.markAccountSynced(account.id, missingMsg);
			return;
		}
		try {
			this.log(
				`Syncing ${account.label} (${account.email}) folder=${folder} max=${max} host=${account.imapHost}:${account.imapPort}`,
			);
			const headers = await fetchHeaders(account, creds, folder, max, this.log);
			await this.index.upsertSummaries(headers);
			await this.index.markAccountSynced(account.id);
			const totalForAccount = this.index.countForAccount(account.id);
			this.log(
				`Synced ${account.label}: fetched=${headers.length} headers, upserted into index, accountTotal=${totalForAccount}`,
			);

			// TODO(rung12): classifier will process unclassified here
			await runClassifierOnNewMessages(headers.map(toSummary), this.classifier);
		} catch (err) {
			const message = describeImapError(err, account.imapHost);
			const stack = err instanceof Error ? err.stack : undefined;
			this.log(`Sync failed for ${account.label}: ${message}`);
			logImapErrorDetails(err, this.log);
			if (stack) {
				this.log(stack);
			}
			await this.index.markAccountSynced(account.id, message);
		}
	}

	async diagnoseAccount(accountId?: string, folder?: string): Promise<DiagnoseConnectionResult> {
		const account = accountId
			? this.accounts.getAccount(accountId)
			: this.accounts.listAccounts()[0];
		if (!account) {
			throw new Error('No email account configured');
		}
		const creds = await this.accounts.getCredentials(account.id);
		if (!creds) {
			throw new Error(`Missing credentials for ${account.label}`);
		}
		const targetFolder = folder || getDefaultFolder();
		this.log(`--- diagnoseConnection start: ${account.label} / ${targetFolder} ---`);
		const result = await diagnoseConnection(account, creds, targetFolder, this.log);
		this.log(`--- diagnoseConnection end: ok=${result.ok} exists=${result.exists} fetched=${result.fetched} ---`);
		return result;
	}

	async listFolders(accountId: string) {
		const account = this.accounts.getAccount(accountId);
		if (!account) {
			throw new Error(`Unknown account: ${accountId}`);
		}
		const creds = await this.accounts.getCredentials(accountId);
		if (!creds) {
			throw new Error('Missing credentials');
		}
		return listFolders(account, creds);
	}

	listThreads(query: ListThreadsQuery) {
		return this.index.listThreads({
			accountId: query.accountId,
			folder: query.folder || getDefaultFolder(),
			offset: query.offset,
			limit: query.limit,
		});
	}

	getThread(threadId: string) {
		return this.index.getThread(threadId);
	}

	async getMessage(messageId: string, forceReload = false) {
		const existing = this.index.getMessage(messageId);
		if (!existing) {
			throw new Error(`Message not found: ${messageId}`);
		}
		if (existing.bodyLoaded && !forceReload) {
			return existing;
		}
		if (existing.fileType === 'eml' && existing.filePath) {
			return existing;
		}
		if (existing.uid === undefined) {
			return existing;
		}
		const account = this.accounts.getAccount(existing.accountId);
		const creds = await this.accounts.getCredentials(existing.accountId);
		if (!account || !creds) {
			throw new Error('Account credentials unavailable');
		}
		this.log(`Lazy-loading body for ${messageId} uid=${existing.uid}`);
		const full = await fetchMessageBody(account, creds, existing.folder, existing.uid, existing.id);
		await this.index.setMessageBody(existing.id, {
			bodyText: full.bodyText,
			bodyHtml: full.bodyHtml,
			attachments: full.attachments,
		});
		// Update threading fields from full parse when available
		const updated = this.index.getMessage(existing.id)!;
		if (full.messageId) {
			updated.messageId = full.messageId;
		}
		if (full.inReplyTo) {
			updated.inReplyTo = full.inReplyTo;
		}
		if (full.references) {
			updated.references = full.references;
			updated.threadId = full.threadId;
		}
		await this.index.upsertMessage(updated);
		return this.index.getMessage(existing.id)!;
	}

	async send(request: SendMailRequest) {
		const account = this.accounts.getAccount(request.accountId);
		if (!account) {
			throw new Error(`Unknown account: ${request.accountId}`);
		}
		const creds = await this.accounts.getCredentials(request.accountId);
		if (!creds) {
			throw new Error('Missing credentials');
		}
		this.log(`Sending via ${account.label} → ${request.to}`);
		return sendMail(account, creds, request);
	}
}

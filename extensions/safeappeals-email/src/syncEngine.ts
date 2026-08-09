/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*--------------------------------------------------------------------------------------
 *  Background IMAP sync — calendar-style interval + manual sync
 *--------------------------------------------------------------------------------------*/

import type { Disposable } from 'vscode';
import { AccountStore } from './accountStore';
import { runClassifierOnNewMessages, type ClassifierHook, noopClassifierHook } from './classifierSeam';
import { getDefaultFolder, getMaxMessagesPerSync, getSyncIntervalMinutes, isWebClient } from './config';
import type { DraftAttachmentStore } from './draftAttachmentStore';
import { syncDraftToImap, type SyncDraftToImapResult } from './draftImapSync';
import { EmailIndex, toSummary } from './emailIndex';
import { runRetryableEmailIndexingTasks } from './emailRagCommands';
import {
	describeImapError,
	diagnoseConnection,
	fetchHeaders,
	fetchMessageBody,
	listFolders,
	logImapErrorDetails,
	type DiagnoseConnectionResult,
	type MailboxAuth,
} from './imapClient';
import { chooseSendAttachments } from './sendAttachments';
import { sendMail } from './smtpClient';
import {
	isOAuthCredentials,
	isPasswordCredentials,
	type EmailAccountConfig,
	type EmailAccountCredentials,
	type EmailDraft,
	type EmailMessage,
	type EmailOAuthProvider,
	type ListThreadsQuery,
	type OutboundAttachment,
	type SendMailRequest,
	type SyncStatus,
} from './types';

export type { SyncDraftToImapResult } from './draftImapSync';
export { syncDraftToImap } from './draftImapSync';
export { chooseSendAttachments } from './sendAttachments';

/** Auth provider ids from safeappeals-authentication (A3 contract). */
export const GOOGLE_MAIL_AUTH_PROVIDER_ID = 'safeappeals-google';
export const MICROSOFT_MAIL_AUTH_PROVIDER_ID = 'safeappeals-microsoft';

/** Mail capability scope convention shared with A3 providers. */
export const MAIL_AUTH_SCOPES = ['mail'] as const;

/**
 * Credentials ready for IMAP/SMTP transport (= E2 {@link MailboxAuth}).
 * Password: app password. OAuth: short-lived accessToken from getSession (never persisted).
 */
export type ResolvedTransportCredentials = MailboxAuth;

/**
 * Session as this extension consumes it. `id` is the service-connection id the
 * token was minted from (A3 contract), used to prove the token belongs to this
 * mailbox rather than another connected account.
 */
export interface MailAuthSession {
	readonly id?: string;
	readonly accessToken: string;
}

/** Narrows a session request to one connected account. */
export interface MailAuthAccountFilter {
	readonly id: string;
	readonly label: string;
}

export type MailAuthSessionGetter = (
	providerId: string,
	scopes: readonly string[],
	options: { createIfNone: boolean; account?: MailAuthAccountFilter },
) => Promise<MailAuthSession | undefined>;

export interface ResolveTransportCredentialsDeps {
	getSession: MailAuthSessionGetter;
	markNeedsReconnect: (accountId: string) => Promise<void>;
	clearNeedsReconnect: (accountId: string) => Promise<void>;
	/** Visible toast — must not be log-only. */
	showReconnectWarning: (message: string) => void;
	log?: (msg: string) => void;
}

export interface SyncEngineAuthDeps {
	getSession?: MailAuthSessionGetter;
	showReconnectWarning?: (message: string) => void;
}

const RECONNECT_MAILBOX_MESSAGE =
	'Reconnect mailbox — Sign in with Safe Appeals again for this account (Email → Account…).';

export function authProviderIdFor(provider: EmailOAuthProvider): string {
	return provider === 'google' ? GOOGLE_MAIL_AUTH_PROVIDER_ID : MICROSOFT_MAIL_AUTH_PROVIDER_ID;
}

const defaultGetSession: MailAuthSessionGetter = async (providerId, scopes, options) => {
	const vscode = require('vscode') as typeof import('vscode');
	const session = await vscode.authentication.getSession(providerId, [...scopes], {
		createIfNone: options.createIfNone,
		...(options.account ? { account: options.account } : {}),
	});
	return session ? { id: session.id, accessToken: session.accessToken } : undefined;
};

function defaultShowReconnectWarning(message: string): void {
	try {
		const vscode = require('vscode') as typeof import('vscode');
		const reconnect = vscode.l10n.t('Reconnect Mailbox');
		void vscode.window.showWarningMessage(message, reconnect).then((choice) => {
			if (choice === reconnect) {
				void vscode.commands.executeCommand('safeappeals-email.reconnectMailbox');
			}
		});
	} catch {
		// Tests / environments without vscode — ignore.
	}
}

/**
 * Resolve SecretStorage credentials into transport-ready creds.
 * OAuth: mints a token for the mailbox's service connection via getSession
 * (createIfNone: false) — never stores the token.
 * On mint failure: marks needsReconnect + visible warning; returns undefined.
 * On success: clears needsReconnect.
 */
export async function resolveTransportCredentials(
	account: EmailAccountConfig,
	creds: EmailAccountCredentials,
	deps: ResolveTransportCredentialsDeps,
): Promise<ResolvedTransportCredentials | undefined> {
	if (isPasswordCredentials(creds)) {
		return { type: 'password', password: creds.password };
	}
	if (!isOAuthCredentials(creds)) {
		return undefined;
	}

	const providerId = authProviderIdFor(creds.provider);
	const connectionId = creds.connectionId;
	if (!connectionId) {
		await failReconnect(
			account,
			deps,
			`${account.email} is not linked to a Safe Appeals connection — ${RECONNECT_MAILBOX_MESSAGE}`,
		);
		return undefined;
	}
	try {
		const session = await deps.getSession(providerId, MAIL_AUTH_SCOPES, {
			createIfNone: false,
			account: { id: connectionId, label: account.email },
		});
		if (!session?.accessToken) {
			await failReconnect(
				account,
				deps,
				`No ${creds.provider} mail session — ${RECONNECT_MAILBOX_MESSAGE}`,
			);
			return undefined;
		}
		// A token minted for another connected account would authenticate the
		// wrong mailbox, so refuse it instead of failing later at IMAP.
		if (session.id && session.id !== connectionId) {
			deps.log?.(
				`Mail session for ${account.label} came from connection ${session.id}, expected ${connectionId}`,
			);
			await failReconnect(
				account,
				deps,
				`Mail token belongs to a different connected account — ${RECONNECT_MAILBOX_MESSAGE}`,
			);
			return undefined;
		}
		await deps.clearNeedsReconnect(account.id);
		return {
			type: 'oauth',
			accessToken: session.accessToken,
		};
	} catch (err) {
		const detail = err instanceof Error ? err.message : String(err);
		deps.log?.(
			`OAuth getSession failed for ${account.label} (${creds.provider}): ${detail}`,
		);
		await failReconnect(account, deps, RECONNECT_MAILBOX_MESSAGE);
		return undefined;
	}
}

async function failReconnect(
	account: EmailAccountConfig,
	deps: ResolveTransportCredentialsDeps,
	message: string,
): Promise<void> {
	const alreadyNeeds = account.authStatus === 'needsReconnect';
	await deps.markNeedsReconnect(account.id);
	deps.log?.(`Mailbox needs reconnect: ${account.label} — ${message}`);
	// Avoid toast spam on background sync when already flagged.
	if (!alreadyNeeds) {
		deps.showReconnectWarning(message);
	}
}

/**
 * Cloud sign-out cascade (E4 wires session-removal → this).
 * Marks every oauth mailbox account needsReconnect; does not delete accounts or secrets.
 */
export async function handleCloudSignOutCascade(accounts: AccountStore): Promise<number> {
	const oauthAccounts = await accounts.listOAuthAccounts();
	for (const account of oauthAccounts) {
		await accounts.markAccountNeedsReconnect(account.id);
	}
	return oauthAccounts.length;
}

export class SyncEngine implements Disposable {
	private timer: ReturnType<typeof setInterval> | undefined;
	private syncing = false;
	private readonly classifier: ClassifierHook;
	private readonly getSession: MailAuthSessionGetter;
	private readonly showReconnectWarning: (message: string) => void;
	private attachmentStore: DraftAttachmentStore | undefined;
	private emailIndexer: { indexThread: (accountId: string, threadId: string, messages: EmailMessage[], caseFolderPath: string) => Promise<void>; unindexThread: (accountId: string, threadId: string, messages?: readonly Pick<EmailMessage, 'id'>[], caseFolderPath?: string) => Promise<void>; reindexThread: (accountId: string, threadId: string, messages: EmailMessage[], caseFolderPath: string) => Promise<void> } | undefined;

	constructor(
		private readonly accounts: AccountStore,
		private readonly index: EmailIndex,
		private readonly log: (msg: string) => void,
		private readonly onStatusChange: () => void,
		classifier: ClassifierHook = noopClassifierHook,
		authDeps: SyncEngineAuthDeps = {},
	) {
		this.classifier = classifier;
		this.getSession = authDeps.getSession ?? defaultGetSession;
		this.showReconnectWarning = authDeps.showReconnectWarning ?? defaultShowReconnectWarning;
	}

	setEmailIndexer(indexer: { indexThread: (accountId: string, threadId: string, messages: EmailMessage[], caseFolderPath: string) => Promise<void>; unindexThread: (accountId: string, threadId: string, messages?: readonly Pick<EmailMessage, 'id'>[], caseFolderPath?: string) => Promise<void>; reindexThread: (accountId: string, threadId: string, messages: EmailMessage[], caseFolderPath: string) => Promise<void> } | undefined): void {
		this.emailIndexer = indexer;
	}

	getEmailIndexer(): { indexThread: (accountId: string, threadId: string, messages: EmailMessage[], caseFolderPath: string) => Promise<void>; unindexThread: (accountId: string, threadId: string, messages?: readonly Pick<EmailMessage, 'id'>[], caseFolderPath?: string) => Promise<void>; reindexThread: (accountId: string, threadId: string, messages: EmailMessage[], caseFolderPath: string) => Promise<void> } | undefined {
		return this.emailIndexer;
	}

	setAttachmentStore(store: DraftAttachmentStore): void {
		this.attachmentStore = store;
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

	private resolveDeps(): ResolveTransportCredentialsDeps {
		return {
			getSession: this.getSession,
			markNeedsReconnect: (id) => this.accounts.markAccountNeedsReconnect(id),
			clearNeedsReconnect: (id) => this.accounts.clearNeedsReconnect(id),
			showReconnectWarning: this.showReconnectWarning,
			log: this.log,
		};
	}

	/**
	 * Load SecretStorage creds and resolve oauth → accessToken for transport.
	 * Returns undefined when missing or mint failed (caller surfaces error).
	 */
	private async resolveForAccount(
		account: EmailAccountConfig,
	): Promise<ResolvedTransportCredentials | undefined> {
		const creds = await this.accounts.getCredentials(account.id);
		if (!creds) {
			return undefined;
		}
		// Refresh authStatus from store (may have changed since list snapshot).
		const fresh = this.accounts.getAccount(account.id) ?? account;
		return resolveTransportCredentials(fresh, creds, this.resolveDeps());
	}

	private async syncAccount(account: EmailAccountConfig, folder: string, max: number): Promise<void> {
		const stored = await this.accounts.getCredentials(account.id);
		if (!stored) {
			const missingMsg =
				'Credentials missing — use Account… → Update password to re-enter it.';
			this.log(`Skip ${account.label}: no credentials in SecretStorage`);
			await this.index.markAccountSynced(account.id, missingMsg);
			return;
		}
		const fresh = this.accounts.getAccount(account.id) ?? account;
		const transport = await resolveTransportCredentials(fresh, stored, this.resolveDeps());
		if (!transport) {
			this.log(`Skip ${account.label}: ${RECONNECT_MAILBOX_MESSAGE}`);
			await this.index.markAccountSynced(account.id, RECONNECT_MAILBOX_MESSAGE);
			return;
		}
		try {
			this.log(
				`Syncing ${account.label} (${account.email}) folder=${folder} max=${max} host=${account.imapHost}:${account.imapPort} auth=${transport.type}`,
			);
			const headers = await fetchHeaders(account, transport, folder, max, this.log);
			await this.index.upsertSummaries(headers);
			await this.index.markAccountSynced(account.id);
			const totalForAccount = this.index.countForAccount(account.id);
			this.log(
				`Synced ${account.label}: fetched=${headers.length} headers, upserted into index, accountTotal=${totalForAccount}`,
			);

			// Reindex linked threads if they have new/updated messages
			if (this.emailIndexer) {
				const emailIndexer = this.emailIndexer;
				const linkedThreads = this.index.getLinkedThreads?.() ?? [];
				const tasks: Array<readonly [string, () => Promise<void>]> = [];
				for (const thread of linkedThreads) {
					if (!thread.caseFolderPath) continue;
					const caseFolderPath = thread.caseFolderPath;
					const hasUpdatedMessage = headers.some(header => header.threadId === thread.threadId);
					if (hasUpdatedMessage) {
						tasks.push([thread.threadId, async () => {
								const completeThread: EmailMessage[] = [];
								for (const reference of thread.messages) {
									completeThread.push(await this.getMessage(reference.id));
								}
								await emailIndexer.reindexThread(account.id, thread.threadId, completeThread, caseFolderPath);
							},
						]);
					}
				}
				await runRetryableEmailIndexingTasks(tasks, (threadId, error) => this.log(
					`Mailbox sync succeeded, but Private Search email indexing for thread ${threadId} will retry: ${error}`,
				));
			}

			// TODO(rung12): classifier will process unclassified here
			await runClassifierOnNewMessages(headers.map(toSummary), this.classifier);
		} catch (err) {
			const message = describeImapError(err, account.imapHost, transport.type);
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
		const transport = await this.resolveForAccount(account);
		if (!transport) {
			throw new Error(
				(await this.accounts.getCredentials(account.id))?.type === 'oauth'
					? RECONNECT_MAILBOX_MESSAGE
					: `Missing credentials for ${account.label}`,
			);
		}
		const targetFolder = folder || getDefaultFolder();
		this.log(`--- diagnoseConnection start: ${account.label} / ${targetFolder} ---`);
		const result = await diagnoseConnection(account, transport, targetFolder, this.log);
		this.log(`--- diagnoseConnection end: ok=${result.ok} exists=${result.exists} fetched=${result.fetched} ---`);
		return result;
	}

	async listFolders(accountId: string) {
		const account = this.accounts.getAccount(accountId);
		if (!account) {
			throw new Error(`Unknown account: ${accountId}`);
		}
		const transport = await this.resolveForAccount(account);
		if (!transport) {
			throw new Error(
				(await this.accounts.getCredentials(accountId))?.type === 'oauth'
					? RECONNECT_MAILBOX_MESSAGE
					: 'Missing credentials',
			);
		}
		return listFolders(account, transport);
	}

	listThreads(query: ListThreadsQuery) {
		return this.index.listThreads({
			accountId: query.accountId,
			folder: query.folder || getDefaultFolder(),
			offset: query.offset,
			limit: query.limit,
			sort: query.sort,
			caseFolderPath: query.caseFolderPath,
			tag: query.tag,
		});
	}

	getThread(accountId: string, threadId: string) {
		return this.index.getThread(accountId, threadId);
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
		if (!account) {
			throw new Error('Account credentials unavailable');
		}
		const transport = await this.resolveForAccount(account);
		if (!transport) {
			throw new Error(
				(await this.accounts.getCredentials(account.id))?.type === 'oauth'
					? RECONNECT_MAILBOX_MESSAGE
					: 'Account credentials unavailable',
			);
		}
		this.log(`Lazy-loading body for ${messageId} uid=${existing.uid}`);
		const full = await fetchMessageBody(
			account,
			transport,
			existing.folder,
			existing.uid,
			existing.id,
		);
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
		const transport = await this.resolveForAccount(account);
		if (!transport) {
			throw new Error(
				(await this.accounts.getCredentials(request.accountId))?.type === 'oauth'
					? RECONNECT_MAILBOX_MESSAGE
					: 'Missing credentials',
			);
		}
		const draftId = request.draftId?.trim() || undefined;
		let loadedFromStore: OutboundAttachment[] | undefined;
		if (draftId) {
			const draft = this.index.getDraft(draftId);
			if (!draft) {
				throw new Error(`Draft not found: ${draftId}`);
			}
			// Always load from the sidecar store — never trust webview-supplied bytes.
			loadedFromStore = await this.loadOutboundAttachments(draft);
		}
		const attachments = chooseSendAttachments(draftId, request.attachments, loadedFromStore);
		this.log(
			`Sending via ${account.label} → ${request.to} auth=${transport.type}`
			+ (attachments?.length ? ` attachments=${attachments.length}` : ''),
		);
		const result = await sendMail(account, transport, {
			...request,
			attachments,
		});
		if (draftId) {
			try {
				await this.index.updateDraftStatus(draftId, 'sent');
			} catch (error) {
				this.log(
					`Post-send draft purge failed for ${draftId}: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}
		return result;
	}

	/**
	 * Save a draft locally first, then best-effort APPEND to the account's IMAP Drafts.
	 * IMAP failure never rolls back the local draft — see {@link SyncDraftToImapResult.remoteError}.
	 */
	async saveDraft(input: {
		accountId: string;
		emailId: string;
		to: string;
		cc?: string;
		bcc?: string;
		subject: string;
		content: string;
		draftId?: string;
		/** Workspace/local file paths to attach after the draft row is saved */
		attachmentPaths?: string[];
	}): Promise<SyncDraftToImapResult> {
		const account = this.accounts.getAccount(input.accountId);
		if (!account) {
			throw new Error(`Unknown account: ${input.accountId}`);
		}

		let draft: EmailDraft = await this.index.saveDraft(input);
		const paths = input.attachmentPaths || [];
		if (paths.length > 0) {
			draft = await this.attachFilesToDraft(draft.id, paths);
		}
		const skipRemote = isWebClient();
		if (skipRemote) {
			this.log(`Draft ${draft.id} saved locally (skip IMAP on web client)`);
			return { draft };
		}

		const transport = await this.resolveForAccount(account);
		return syncDraftToImap(draft, account, transport, {
			skipRemote: false,
			updateDraftRemote: (draftId, remote) => this.index.updateDraftRemote(draftId, remote),
			loadAttachments: (d) => this.loadOutboundAttachments(d),
			log: this.log,
		});
	}

	/** Attach one file to an existing draft (creates sidecar + metadata). */
	async attachFileToDraft(draftId: string, filePath: string): Promise<EmailDraft> {
		return this.attachFilesToDraft(draftId, [filePath]);
	}

	async attachFilesToDraft(draftId: string, filePaths: readonly string[]): Promise<EmailDraft> {
		const store = this.attachmentStore ?? this.index.getAttachmentStore();
		if (!store) {
			throw new Error('Draft attachment store is not initialized');
		}
		const draft = this.index.getDraft(draftId);
		if (!draft) {
			throw new Error(`Draft not found: ${draftId}`);
		}
		let attachments = [...(draft.attachments || [])];
		for (const filePath of filePaths) {
			const meta = await store.addFromFile(draftId, attachments, filePath);
			attachments = [...attachments, meta];
		}
		const updated = await this.index.setDraftAttachments(draftId, attachments);
		if (!updated) {
			throw new Error(`Draft not found: ${draftId}`);
		}
		return updated;
	}

	async removeAttachmentFromDraft(draftId: string, attachmentId: string): Promise<EmailDraft> {
		const store = this.attachmentStore ?? this.index.getAttachmentStore();
		if (!store) {
			throw new Error('Draft attachment store is not initialized');
		}
		const draft = this.index.getDraft(draftId);
		if (!draft) {
			throw new Error(`Draft not found: ${draftId}`);
		}
		const existing = draft.attachments || [];
		if (!existing.some(a => a.id === attachmentId)) {
			throw new Error(`Attachment not found on draft: ${attachmentId}`);
		}
		await store.remove(draftId, attachmentId);
		const next = existing.filter(a => a.id !== attachmentId);
		const updated = await this.index.setDraftAttachments(draftId, next);
		if (!updated) {
			throw new Error(`Draft not found: ${draftId}`);
		}
		return updated;
	}

	private async loadOutboundAttachments(draft: EmailDraft): Promise<OutboundAttachment[]> {
		const metas = draft.attachments || [];
		if (metas.length === 0) {
			return [];
		}
		const store = this.attachmentStore ?? this.index.getAttachmentStore();
		if (!store) {
			return [];
		}
		const out: OutboundAttachment[] = [];
		for (const meta of metas) {
			const content = await store.readBytes(draft.id, meta.id);
			if (!content) {
				throw new Error(`Missing attachment bytes for ${meta.filename}`);
			}
			out.push({
				filename: meta.filename,
				contentType: meta.contentType,
				content,
			});
		}
		return out;
	}

	/** Convenience wrapper for E4 / extension wiring. */
	async handleCloudSignOutCascade(): Promise<number> {
		const count = await handleCloudSignOutCascade(this.accounts);
		if (count > 0) {
			this.log(`Cloud sign-out cascade: marked ${count} oauth mailbox account(s) needsReconnect`);
			this.showReconnectWarning(
				count === 1
					? RECONNECT_MAILBOX_MESSAGE
					: `Reconnect mailbox — ${count} Safe Appeals mail accounts need sign-in again.`,
			);
			this.onStatusChange();
		}
		return count;
	}
}

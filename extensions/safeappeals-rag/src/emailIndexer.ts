/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import { createHash, randomUUID } from 'node:crypto';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { IndexPipeline, IndexFileRequest } from './indexPipeline';
import type { RagCoreHost } from './ragCoreHost';

/** Minimal email message shape needed for indexing (subset of safeappeals-email EmailMessage). */
export interface EmailMessage {
	readonly id: string;
	readonly accountId: string;
	readonly threadId: string;
	readonly subject: string | undefined;
	readonly from: string;
	readonly to: string;
	readonly cc: string | undefined;
	readonly date: string;
	readonly bodyText: string | undefined;
	readonly bodyLoaded: boolean;
	readonly snippet: string | undefined;
	readonly category: string | undefined;
	readonly priority: string | undefined;
}

/** Minimal email thread shape needed for indexing (subset of safeappeals-email EmailThread). */
export interface EmailThread {
	readonly accountId: string;
	readonly threadId: string;
	readonly caseFolderPath: string | undefined;
	readonly messages: Array<{ readonly id: string; readonly threadId?: string }>;
}

export function emailThreadKey(accountId: string, threadId: string): string {
	return `${accountId}\0${threadId}`;
}

export function mapLinkedEmailThreads(threads: readonly EmailThread[]): Map<string, EmailThread> {
	return new Map(threads.map(thread => [emailThreadKey(thread.accountId, thread.threadId), thread]));
}

export interface EmailIndexApi {
	getMessage(id: string): EmailMessage | undefined;
	isDurableStorageReady(): boolean;
	getRagManifestEntry(accountId: string, threadId: string): EmailRagManifestEntry | undefined;
	setRagManifestEntry(accountId: string, threadId: string, entry: EmailRagManifestEntry | undefined): Promise<void>;
}

export interface EmailRagManifestEntry {
	readonly accountId: string;
	readonly caseFolderPath: string;
	readonly docIds: readonly string[];
	readonly retryDocIds: readonly string[];
}

export interface EmailExtensionApi {
	getEmailIndex(): EmailIndexApi;
	getEmailMessage(id: string): Promise<EmailMessage>;
}

export interface EmailIndexerDeps {
	readonly indexPipeline: Pick<IndexPipeline, 'indexFile'>;
	readonly ragCoreHost: Pick<RagCoreHost, 'removeDoc' | 'getDocument'>;
	readonly log?: (message: string) => void;
	readonly resolveEmailApi?: () => EmailExtensionApi | undefined;
}

function hashIdentifier(value: string): string {
	return createHash('sha256').update(value).digest('hex');
}

function docIdForSourceUri(sourceUri: string): string {
	return hashIdentifier(sourceUri).slice(0, 32);
}

function emailSourceUri(caseFolderPath: string, accountId: string, threadId: string, messageId: string, generation?: string): string {
	const virtualPath = path.join(
		caseFolderPath,
		'.safeappeals-private-index',
		'email',
		hashIdentifier(`${accountId}\0${threadId}`),
		`${hashIdentifier(messageId)}${generation ? `-${generation}` : ''}.md`,
	);
	return pathToFileURL(virtualPath).toString();
}

function formatDateForFrontmatter(dateStr: string): string {
	try {
		return new Date(dateStr).toISOString();
	} catch {
		return dateStr;
	}
}

function escapeYamlString(str: string): string {
	return str
		.replace(/\\/g, '\\\\')
		.replace(/"/g, '\\"')
		.replace(/\n/g, '\\n')
		.replace(/\r/g, '\\r')
		.replace(/\t/g, '\\t');
}

function messageToMarkdown(msg: EmailMessage, caseFolderPath: string): string {
	const frontmatter = [
		'---',
		'source: email',
		`threadId: "${escapeYamlString(msg.threadId)}"`,
		`messageId: "${escapeYamlString(msg.id)}"`,
		`subject: "${escapeYamlString(msg.subject || '(No Subject)')}"`,
		`from: "${escapeYamlString(msg.from)}"`,
		`to: "${escapeYamlString(msg.to)}"`,
		`cc: "${escapeYamlString(msg.cc || '')}"`,
		`date: "${formatDateForFrontmatter(msg.date)}"`,
		`category: "${msg.category || 'general'}"`,
		`priority: "${msg.priority || 'normal'}"`,
		`caseFolderPath: "${escapeYamlString(caseFolderPath)}"`,
		'---',
		'',
	].join('\n');

	const body = msg.bodyText || msg.snippet || '(empty)';
	return `${frontmatter}${body}\n`;
}

export class EmailIndexer {
	private readonly indexPipeline: Pick<IndexPipeline, 'indexFile'>;
	private readonly ragCoreHost: Pick<RagCoreHost, 'removeDoc' | 'getDocument'>;
	private readonly log?: (message: string) => void;
	private readonly resolveEmailApi: () => EmailExtensionApi | undefined;
	private readonly threadDocIds = new Map<string, Set<string>>();

	private threadKey(accountId: string, threadId: string): string {
		return emailThreadKey(accountId, threadId);
	}

	constructor(deps: EmailIndexerDeps) {
		this.indexPipeline = deps.indexPipeline;
		this.ragCoreHost = deps.ragCoreHost;
		this.log = deps.log;
		this.resolveEmailApi = deps.resolveEmailApi ?? (() => {
			const vscode = require('vscode') as typeof import('vscode');
			const extension = vscode.extensions.getExtension('safeappeals.safeappeals-email');
			return extension?.isActive ? extension.exports as EmailExtensionApi | undefined : undefined;
		});
	}

	async indexThread(accountId: string, threadId: string, messages: EmailMessage[], caseFolderPath: string): Promise<void> {
		await this.reindexThread(accountId, threadId, messages, caseFolderPath);
	}

	private async indexMessages(
		accountId: string,
		threadId: string,
		messages: EmailMessage[],
		caseFolderPath: string,
		generation: string,
		docIds = new Set<string>(),
	): Promise<Set<string>> {
		for (const msg of messages) {
			if (!msg.bodyLoaded && !msg.bodyText) {
				this.log?.(`Skipping message ${msg.id} - body not loaded`);
				continue;
			}
			const sourceUri = emailSourceUri(caseFolderPath, accountId, threadId, msg.id, generation);
			const expectedDocId = docIdForSourceUri(sourceUri);
			// indexFile can throw after rag-core has committed. Register the deterministic
			// identity first so transaction rollback cannot lose the committed document.
			docIds.add(expectedDocId);
			const markdown = messageToMarkdown(msg, caseFolderPath);
			const bytes = new TextEncoder().encode(markdown);

			const request: IndexFileRequest = {
				sourceUri,
				bytes,
				scope: 'case_index',
			};

			const result = await this.indexPipeline.indexFile(request);
			if (result.kind === 'ok') {
				docIds.delete(expectedDocId);
				docIds.add(result.docId);
				this.log?.(`Indexed email ${msg.id} in thread ${threadId} (docId: ${result.docId})`);
			} else if (result.kind !== 'skipped') {
				this.log?.(`Failed to index email ${msg.id}: ${result.message}`);
				throw new Error(`Failed to index email ${msg.id}: ${result.message}`);
			}
		}

		return docIds;
	}

	async unindexThread(
		accountId: string,
		threadId: string,
		messages: readonly Pick<EmailMessage, 'id'>[] = [],
		caseFolderPath?: string,
	): Promise<void> {
		const emailIndex = this.getEmailIndex();
		const threadKey = this.threadKey(accountId, threadId);
		const manifest = emailIndex?.getRagManifestEntry(accountId, threadId);
		const docIds = new Set([...(manifest?.docIds ?? []), ...(manifest?.retryDocIds ?? []), ...(this.threadDocIds.get(threadKey) ?? [])]);
		if (caseFolderPath) {
			for (const message of messages) {
				docIds.add(docIdForSourceUri(emailSourceUri(caseFolderPath, accountId, threadId, message.id)));
			}
		}
		if (docIds.size === 0 || !emailIndex) {
			throw new Error(`Cannot prove indexed email documents were purged for thread ${threadId}`);
		}

		const failedIds = new Set<string>();
		for (const docId of docIds) {
			const result = this.ragCoreHost.removeDoc(docId);
			if (result.ok) {
				this.log?.(`Removed email document ${docId} for thread ${threadId}`);
			} else {
				failedIds.add(docId);
				this.log?.(`Failed to remove email document ${docId}: ${result.error}`);
			}
		}
		if (failedIds.size > 0) {
			this.threadDocIds.set(threadKey, failedIds);
			await emailIndex.setRagManifestEntry(accountId, threadId, {
				accountId,
				caseFolderPath: manifest?.caseFolderPath ?? caseFolderPath ?? '',
				docIds: [],
				retryDocIds: [...failedIds],
			});
			throw new Error(`Failed to purge ${failedIds.size} indexed email document(s) for thread ${threadId}`);
		}
		this.threadDocIds.delete(threadKey);
		await emailIndex.setRagManifestEntry(accountId, threadId, undefined);
	}

	async reindexThread(accountId: string, threadId: string, messages: EmailMessage[], caseFolderPath: string): Promise<void> {
		const emailIndex = this.getEmailIndex();
		if (!emailIndex?.isDurableStorageReady() || messages.length === 0) {
			throw new Error(`Cannot persist encrypted RAG purge manifest for thread ${threadId}`);
		}
		if (messages.some(message => message.accountId !== accountId)) {
			throw new Error(`Email thread ${threadId} contains messages from another account`);
		}
		const threadKey = this.threadKey(accountId, threadId);
		const previous = emailIndex.getRagManifestEntry(accountId, threadId);
		const previousIds = new Set([...(previous?.docIds ?? []), ...(previous?.retryDocIds ?? []), ...(this.threadDocIds.get(threadKey) ?? [])]);
		const generation = randomUUID().replace(/-/g, '');
		const replacementIds = new Set<string>();
		try {
			for (const message of messages) {
				const indexed = await this.indexMessages(accountId, threadId, [message], caseFolderPath, generation, replacementIds);
				for (const docId of indexed) {
					replacementIds.add(docId);
				}
			}
		} catch (error) {
			await this.rollbackReplacement(accountId, threadId, caseFolderPath, previous, replacementIds);
			throw error;
		}
		if (replacementIds.size !== messages.length) {
			await this.rollbackReplacement(accountId, threadId, caseFolderPath, previous, replacementIds);
			throw new Error(`Email thread ${threadId} replacement did not index every complete message`);
		}
		try {
			await emailIndex.setRagManifestEntry(accountId, threadId, {
				accountId,
				caseFolderPath,
				docIds: [...replacementIds],
				retryDocIds: [...previousIds],
			});
		} catch (error) {
			await this.rollbackReplacement(accountId, threadId, caseFolderPath, previous, replacementIds);
			throw error;
		}
		const retryDocIds = new Set<string>();
		for (const previousId of previousIds) {
			const removed = this.ragCoreHost.removeDoc(previousId);
			if (!removed.ok) {
				retryDocIds.add(previousId);
			}
		}
		await emailIndex.setRagManifestEntry(accountId, threadId, {
			accountId,
			caseFolderPath,
			docIds: [...replacementIds],
			retryDocIds: [...retryDocIds],
		});
		this.threadDocIds.set(threadKey, new Set([...replacementIds, ...retryDocIds]));
	}

	private async rollbackReplacement(
		accountId: string,
		threadId: string,
		caseFolderPath: string,
		previous: EmailRagManifestEntry | undefined,
		replacementIds: ReadonlySet<string>,
	): Promise<void> {
		const emailIndex = this.getEmailIndex();
		if (!emailIndex) {
			throw new Error(`Cannot durably record rollback for email thread ${threadId}`);
		}
		const rollbackRetryIds = new Set(previous?.retryDocIds ?? []);
		for (const docId of replacementIds) {
			if (!this.ragCoreHost.removeDoc(docId).ok) {
				rollbackRetryIds.add(docId);
			}
		}
		if (rollbackRetryIds.size > 0 || previous) {
			await emailIndex.setRagManifestEntry(accountId, threadId, {
				accountId,
				caseFolderPath: previous?.caseFolderPath ?? caseFolderPath,
				docIds: previous?.docIds ?? [],
				retryDocIds: [...rollbackRetryIds],
			});
		} else {
			await emailIndex.setRagManifestEntry(accountId, threadId, undefined);
		}
	}

	private getEmailIndex(): EmailIndexApi | undefined {
		return this.resolveEmailApi()?.getEmailIndex?.();
	}

	async indexAllLinkedThreads(threads: Map<string, EmailThread>): Promise<void> {
		const emailApi = this.resolveEmailApi();
		if (!emailApi?.getEmailIndex || !emailApi.getEmailMessage) {
			this.log?.('Retroactive email indexing skipped: complete email index is unavailable');
			return;
		}
		let totalIndexed = 0;
		for (const [key, thread] of threads) {
			if (key !== emailThreadKey(thread.accountId, thread.threadId)) {
				throw new Error(`Invalid account-qualified email thread map key for ${thread.threadId}`);
			}
			if (!thread.caseFolderPath) {
				continue;
			}
			const messages: EmailMessage[] = [];
			for (const reference of thread.messages) {
				try {
					const message = await emailApi.getEmailMessage(reference.id);
					if (message.bodyLoaded) {
						messages.push(message);
					}
				} catch (error) {
					this.log?.(`Failed to load email ${reference.id} for retroactive indexing: ${error instanceof Error ? error.message : String(error)}`);
				}
			}
			if (messages.length > 0) {
				await this.indexThread(thread.accountId, thread.threadId, messages, thread.caseFolderPath);
				totalIndexed += messages.length;
			}
		}
		this.log?.(`Retroactive indexing complete: ${totalIndexed} emails indexed across ${threads.size} threads`);
	}

	getThreadDocIds(accountId: string, threadId: string): readonly string[] {
		return [...(this.threadDocIds.get(this.threadKey(accountId, threadId)) || [])];
	}

	hasThread(accountId: string, threadId: string): boolean {
		return this.threadDocIds.has(this.threadKey(accountId, threadId));
	}
}

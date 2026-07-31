/*--------------------------------------------------------------------------------------
 *  Local email index — encrypted JSON under globalStorageUri (replaces old @vscode/sqlite3)
 *--------------------------------------------------------------------------------------*/

import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import {
	acquireDek,
	createMementoDekDurabilityMarker,
	type DekDurabilityMarker,
	loadJson,
	writeEncryptedJson,
} from './shared/encryptedStore';
import { deleteFileIfExists, ensureDir } from './shared/secureFs';
import type {
	DraftStatus,
	EmailDraft,
	EmailMessage,
	EmailMessageSummary,
	EmailStats,
	EmailThread,
	ThreadSort,
	ThreadStatus,
} from './types';

const INDEX_FILE = 'email-index.json';
const DRAFTS_FILE = 'email-drafts.json';
const META_FILE = 'email-sync-meta.json';
const CASE_LINKS_FILE = 'email-case-links.json';
const TAGS_FILE = 'email-tags.json';
const DEK_KEY_ID = 'safeappeals-email.dek.emailIndex';
const STORE_FILES = [INDEX_FILE, DRAFTS_FILE, META_FILE, CASE_LINKS_FILE, TAGS_FILE] as const;

interface IndexFile {
	version: '1.0';
	messages: EmailMessage[];
	threadStatus: Record<string, ThreadStatus>;
}

interface DraftsFile {
	version: '1.0';
	drafts: EmailDraft[];
}

interface SyncMetaFile {
	version: '1.0';
	lastBackgroundSync: string | null;
	perAccount: Record<string, { lastSync: string | null; error?: string }>;
}

interface CaseLinksFile {
	version: '1.0';
	/** threadId → absolute fsPath of the linked case folder */
	links: Record<string, string>;
}

interface TagsFile {
	version: '1.0';
	/** Every tag ever created, even if currently unused */
	knownTags: string[];
	threadTags: Record<string, string[]>;
	hiddenThreads: string[];
}

function toSummary(m: EmailMessage): EmailMessageSummary {
	return {
		id: m.id,
		accountId: m.accountId,
		folder: m.folder,
		uid: m.uid,
		from: m.from,
		to: m.to,
		cc: m.cc,
		subject: m.subject,
		date: m.date,
		snippet: m.snippet || (m.bodyText || '').slice(0, 160),
		messageId: m.messageId,
		inReplyTo: m.inReplyTo,
		references: m.references,
		threadId: m.threadId,
		isStarred: m.isStarred,
		hasAttachments: (m.attachments?.length ?? 0) > 0 || m.hasAttachments,
		category: m.category,
		priority: m.priority,
		extractedDeadline: m.extractedDeadline,
		classifiedAt: m.classifiedAt,
		bodyLoaded: m.bodyLoaded,
	};
}

function computeThreadId(msg: Pick<EmailMessage, 'references' | 'inReplyTo' | 'messageId' | 'id'>): string {
	if (msg.references && msg.references.length > 0) {
		return msg.references[0];
	}
	if (msg.inReplyTo) {
		return msg.inReplyTo;
	}
	return msg.messageId || msg.id;
}

export class EmailIndex {
	private messages: EmailMessage[] = [];
	private threadStatus: Record<string, ThreadStatus> = {};
	private drafts: EmailDraft[] = [];
	private caseLinks: Record<string, string> = {};
	private knownTags: string[] = [];
	private threadTags: Record<string, string[]> = {};
	private hiddenThreads = new Set<string>();
	private meta: SyncMetaFile = { version: '1.0', lastBackgroundSync: null, perAccount: {} };
	private dek: Buffer | undefined;
	private mode: 'encrypted' | 'memory' = 'memory';
	private warnedUnavailable = false;
	private warnedMemoryDraft = false;
	private readonly marker: DekDurabilityMarker;

	constructor(
		private readonly storageUri: vscode.Uri,
		private readonly secrets: vscode.SecretStorage,
		globalState: vscode.Memento,
		private readonly log?: (msg: string) => void,
	) {
		this.marker = createMementoDekDurabilityMarker(globalState, DEK_KEY_ID);
	}

	/**
	 * Open the store: ensure the storage dir, acquire a DEK, and load encrypted files.
	 * Never throws — falls back to in-memory mode on any failure.
	 */
	async initialize(): Promise<void> {
		try {
			await ensureDir(this.storageUri.fsPath);
			await this.acquireEncryptionKey();
			if (this.mode === 'encrypted') {
				await this.load();
			}
		} catch (error) {
			this.dek = undefined;
			this.mode = 'memory';
			this.log?.(
				`EmailIndex.initialize failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Delete the on-disk email cache (and quarantine siblings), reset in-memory state,
	 * drop the DEK, and mint a fresh key when SecretStorage is usable.
	 */
	async clearLocalCache(): Promise<void> {
		const dir = this.storageUri.fsPath;
		for (const name of STORE_FILES) {
			await deleteFileIfExists(path.join(dir, name));
		}
		try {
			const entries = await fs.readdir(dir);
			for (const entry of entries) {
				if (STORE_FILES.some((name) => entry.startsWith(`${name}.corrupt-`))) {
					await deleteFileIfExists(path.join(dir, entry));
				}
			}
		} catch (error) {
			this.log?.(
				`clearLocalCache readdir failed: ${error instanceof Error ? error.message : String(error)}`,
			);
		}

		this.messages = [];
		this.threadStatus = {};
		this.drafts = [];
		this.caseLinks = {};
		this.knownTags = [];
		this.threadTags = {};
		this.hiddenThreads = new Set();
		this.meta = { version: '1.0', lastBackgroundSync: null, perAccount: {} };
		this.dek = undefined;
		this.mode = 'memory';
		this.warnedMemoryDraft = false;

		try {
			await this.secrets.delete(DEK_KEY_ID);
		} catch (error) {
			this.log?.(
				`Failed to delete DEK ${DEK_KEY_ID}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		try {
			await this.marker.setStored(false);
		} catch (error) {
			this.log?.(
				`Failed to clear durability marker for ${DEK_KEY_ID}: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
		await this.acquireEncryptionKey();
	}

	generateEmailId(seed: string): string {
		return createHash('sha256').update(seed).digest('hex').slice(0, 32);
	}

	getLastBackgroundSync(): string | null {
		return this.meta.lastBackgroundSync;
	}

	getAccountSyncMeta(accountId: string): { lastSync: string | null; error?: string } {
		return this.meta.perAccount[accountId] || { lastSync: null };
	}

	async markAccountSynced(accountId: string, error?: string): Promise<void> {
		this.meta.perAccount[accountId] = {
			lastSync: error ? this.meta.perAccount[accountId]?.lastSync ?? null : new Date().toISOString(),
			error,
		};
		this.meta.lastBackgroundSync = new Date().toISOString();
		await this.saveMeta();
	}

	countForAccount(accountId: string): number {
		return this.messages.filter((m) => m.accountId === accountId).length;
	}

	getMessage(id: string): EmailMessage | undefined {
		return this.messages.find((m) => m.id === id);
	}

	getStats(): EmailStats {
		const threadIds = new Set(this.messages.map((m) => m.threadId));
		const accounts = new Set(this.messages.map((m) => m.accountId));
		return {
			totalEmails: this.messages.length,
			draftCount: this.drafts.filter((d) => d.status !== 'sent').length,
			accountCount: accounts.size,
			threadCount: threadIds.size,
		};
	}

	search(query: string, accountId?: string): EmailMessageSummary[] {
		const q = query.trim().toLowerCase();
		if (!q) {
			return [];
		}
		return this.messages
			.filter((m) => {
				if (accountId && m.accountId !== accountId) {
					return false;
				}
				return (
					m.subject.toLowerCase().includes(q) ||
					m.from.toLowerCase().includes(q) ||
					m.to.toLowerCase().includes(q) ||
					(m.bodyText || '').toLowerCase().includes(q) ||
					(m.snippet || '').toLowerCase().includes(q)
				);
			})
			.map(toSummary);
	}

	listThreads(opts: {
		accountId?: string;
		folder?: string;
		offset?: number;
		limit?: number;
		sort?: ThreadSort;
		caseFolderPath?: string;
		tag?: string;
	}): { threads: EmailThread[]; total: number } {
		const folder = opts.folder || 'INBOX';
		const filtered = this.messages.filter((m) => {
			if (opts.accountId && m.accountId !== opts.accountId) {
				return false;
			}
			return m.folder === folder;
		});

		const byThread = new Map<string, EmailMessage[]>();
		for (const m of filtered) {
			const list = byThread.get(m.threadId) || [];
			list.push(m);
			byThread.set(m.threadId, list);
		}

		let threads: EmailThread[] = [];
		for (const [threadId, msgs] of byThread) {
			msgs.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
			const latest = msgs[msgs.length - 1];
			const participants = new Set(msgs.map((m) => m.from));
			threads.push({
				threadId,
				accountId: latest.accountId,
				folder: latest.folder,
				subject: msgs[0].subject || '(No Subject)',
				latestDate: latest.date,
				emailCount: msgs.length,
				participantCount: participants.size,
				status: this.threadStatus[threadId] || 'active',
				caseFolderPath: this.caseLinks[threadId],
				tags: this.threadTags[threadId],
				hidden: this.hiddenThreads.has(threadId),
				messages: msgs.map(toSummary),
			});
		}

		if (opts.caseFolderPath) {
			threads = threads.filter((t) => t.caseFolderPath === opts.caseFolderPath);
		}
		if (opts.tag) {
			const tagLc = opts.tag.toLowerCase();
			threads = threads.filter((t) => (t.tags || []).some((x) => x.toLowerCase() === tagLc));
		}

		const sort = opts.sort || 'newest';
		switch (sort) {
			case 'oldest':
				threads.sort((a, b) => Date.parse(a.latestDate) - Date.parse(b.latestDate));
				break;
			case 'sender':
				threads.sort((a, b) => {
					const af = (a.messages[a.messages.length - 1]?.from || '').toLowerCase();
					const bf = (b.messages[b.messages.length - 1]?.from || '').toLowerCase();
					return af.localeCompare(bf);
				});
				break;
			case 'subject':
				threads.sort((a, b) => a.subject.toLowerCase().localeCompare(b.subject.toLowerCase()));
				break;
			case 'newest':
			default:
				threads.sort((a, b) => Date.parse(b.latestDate) - Date.parse(a.latestDate));
				break;
		}
		// Hidden threads sink to the bottom, keeping the active sort among themselves
		threads = [...threads.filter((t) => !t.hidden), ...threads.filter((t) => t.hidden)];
		const offset = opts.offset ?? 0;
		const limit = opts.limit ?? 50;
		return {
			threads: threads.slice(offset, offset + limit),
			total: threads.length,
		};
	}

	getThread(threadId: string): EmailThread | undefined {
		const msgs = this.messages.filter((m) => m.threadId === threadId);
		if (msgs.length === 0) {
			return undefined;
		}
		msgs.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
		const latest = msgs[msgs.length - 1];
		return {
			threadId,
			accountId: latest.accountId,
			folder: latest.folder,
			subject: msgs[0].subject || '(No Subject)',
			latestDate: latest.date,
			emailCount: msgs.length,
			participantCount: new Set(msgs.map((m) => m.from)).size,
			status: this.threadStatus[threadId] || 'active',
			caseFolderPath: this.caseLinks[threadId],
			tags: this.threadTags[threadId],
			hidden: this.hiddenThreads.has(threadId),
			messages: msgs.map(toSummary),
		};
	}

	async updateThreadStatus(threadId: string, status: ThreadStatus): Promise<void> {
		this.threadStatus[threadId] = status;
		await this.saveIndex();
	}

	async linkThreadToCase(threadId: string, caseFolderPath: string): Promise<void> {
		this.caseLinks[threadId] = caseFolderPath;
		await this.saveCaseLinks();
	}

	async unlinkThread(threadId: string): Promise<void> {
		delete this.caseLinks[threadId];
		await this.saveCaseLinks();
	}

	getThreadCase(threadId: string): string | undefined {
		return this.caseLinks[threadId];
	}

	/** Returns the first-use casing when the tag is already known. */
	private canonicalTag(tag: string): string {
		const lc = tag.toLowerCase();
		return this.knownTags.find((t) => t.toLowerCase() === lc) || tag;
	}

	async tagThread(threadId: string, tag: string): Promise<void> {
		const trimmed = tag.trim();
		if (!trimmed) {
			throw new Error('Tag must not be empty');
		}
		const canonical = this.canonicalTag(trimmed);
		const lc = canonical.toLowerCase();
		const existing = this.threadTags[threadId] || [];
		if (!existing.some((t) => t.toLowerCase() === lc)) {
			this.threadTags[threadId] = [...existing, canonical];
		}
		if (!this.knownTags.some((t) => t.toLowerCase() === lc)) {
			this.knownTags.push(canonical);
		}
		await this.saveTags();
	}

	async untagThread(threadId: string, tag: string): Promise<void> {
		const lc = tag.trim().toLowerCase();
		const existing = this.threadTags[threadId];
		if (!existing) {
			return;
		}
		const next = existing.filter((t) => t.toLowerCase() !== lc);
		if (next.length > 0) {
			this.threadTags[threadId] = next;
		} else {
			delete this.threadTags[threadId];
		}
		await this.saveTags();
	}

	/**
	 * Removes a tag from the vocabulary and strips it from every thread.
	 * Never deletes messages — only the tag association.
	 */
	async deleteTag(tag: string): Promise<void> {
		const lc = tag.trim().toLowerCase();
		if (!lc) {
			return;
		}
		this.knownTags = this.knownTags.filter((t) => t.toLowerCase() !== lc);
		for (const threadId of Object.keys(this.threadTags)) {
			const next = this.threadTags[threadId].filter((t) => t.toLowerCase() !== lc);
			if (next.length > 0) {
				this.threadTags[threadId] = next;
			} else {
				delete this.threadTags[threadId];
			}
		}
		await this.saveTags();
	}

	getThreadTags(threadId: string): string[] {
		return [...(this.threadTags[threadId] || [])];
	}

	listTags(): { name: string; count: number }[] {
		const byKey = new Map<string, { name: string; count: number }>();
		for (const tag of this.knownTags) {
			byKey.set(tag.toLowerCase(), { name: tag, count: 0 });
		}
		for (const tags of Object.values(this.threadTags)) {
			for (const tag of tags) {
				const entry = byKey.get(tag.toLowerCase());
				if (entry) {
					entry.count += 1;
				} else {
					byKey.set(tag.toLowerCase(), { name: tag, count: 1 });
				}
			}
		}
		return [...byKey.values()].sort(
			(a, b) =>
				b.count - a.count || a.name.toLowerCase().localeCompare(b.name.toLowerCase()),
		);
	}

	async hideThread(threadId: string): Promise<void> {
		this.hiddenThreads.add(threadId);
		await this.saveTags();
	}

	async unhideThread(threadId: string): Promise<void> {
		this.hiddenThreads.delete(threadId);
		await this.saveTags();
	}

	isThreadHidden(threadId: string): boolean {
		return this.hiddenThreads.has(threadId);
	}

	async upsertMessage(msg: EmailMessage): Promise<EmailMessage> {
		const threadId = msg.threadId || computeThreadId(msg);
		const next: EmailMessage = { ...msg, threadId };
		const idx = this.messages.findIndex((m) => m.id === next.id);
		if (idx >= 0) {
			const prev = this.messages[idx];
			// Preserve loaded body if new upsert is header-only
			if (!next.bodyLoaded && prev.bodyLoaded) {
				next.bodyText = prev.bodyText;
				next.bodyHtml = prev.bodyHtml;
				next.attachments = prev.attachments;
				next.bodyLoaded = true;
			}
			this.messages[idx] = next;
		} else {
			this.messages.push(next);
		}
		await this.saveIndex();
		return next;
	}

	async upsertSummaries(msgs: EmailMessage[]): Promise<number> {
		let n = 0;
		for (const msg of msgs) {
			await this.upsertMessage(msg);
			n++;
		}
		return n;
	}

	async setMessageBody(
		id: string,
		body: { bodyText: string; bodyHtml?: string; attachments?: EmailMessage['attachments'] },
	): Promise<EmailMessage | undefined> {
		const msg = this.getMessage(id);
		if (!msg) {
			return undefined;
		}
		msg.bodyText = body.bodyText;
		msg.bodyHtml = body.bodyHtml;
		msg.attachments = body.attachments || msg.attachments || [];
		msg.bodyLoaded = true;
		msg.snippet = body.bodyText.slice(0, 160);
		await this.saveIndex();
		return msg;
	}

	async toggleStar(id: string): Promise<boolean> {
		const msg = this.getMessage(id);
		if (!msg) {
			throw new Error(`Message not found: ${id}`);
		}
		msg.isStarred = !msg.isStarred;
		await this.saveIndex();
		return !!msg.isStarred;
	}

	async updateClassification(
		id: string,
		classification: { category: EmailMessage['category']; priority: EmailMessage['priority']; extractedDeadline?: string },
	): Promise<void> {
		const msg = this.getMessage(id);
		if (!msg) {
			throw new Error(`Message not found: ${id}`);
		}
		msg.category = classification.category;
		msg.priority = classification.priority;
		msg.extractedDeadline = classification.extractedDeadline;
		msg.classifiedAt = new Date().toISOString();
		await this.saveIndex();
	}

	getUnclassified(limit = 20): EmailMessageSummary[] {
		return this.messages
			.filter((m) => !m.classifiedAt)
			.slice(0, limit)
			.map(toSummary);
	}

	async clearAccount(accountId: string): Promise<void> {
		this.messages = this.messages.filter((m) => m.accountId !== accountId);
		delete this.meta.perAccount[accountId];
		await this.saveIndex();
		await this.saveMeta();
	}

	// --- Drafts ---

	listDrafts(accountId?: string): EmailDraft[] {
		return this.drafts
			.filter((d) => (!accountId || d.accountId === accountId) && d.status !== 'sent')
			.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
	}

	getDraft(draftId: string): EmailDraft | undefined {
		return this.drafts.find((d) => d.id === draftId);
	}

	getLatestDraftForEmail(emailId: string): EmailDraft | undefined {
		return this.drafts
			.filter((d) => d.emailId === emailId)
			.sort((a, b) => b.version - a.version)[0];
	}

	getDraftVersions(emailId: string): EmailDraft[] {
		return this.drafts
			.filter((d) => d.emailId === emailId)
			.sort((a, b) => b.version - a.version);
	}

	async saveDraft(input: {
		accountId: string;
		emailId: string;
		to: string;
		cc?: string;
		bcc?: string;
		subject: string;
		content: string;
		draftId?: string;
	}): Promise<EmailDraft> {
		if (this.mode === 'memory' && !this.warnedMemoryDraft) {
			this.warnedMemoryDraft = true;
			void vscode.window.showWarningMessage(
				'Drafts will not survive a restart because secure storage is unavailable.',
			);
		}

		const now = new Date().toISOString();
		if (input.draftId) {
			const existing = this.getDraft(input.draftId);
			if (existing) {
				existing.to = input.to;
				existing.cc = input.cc;
				existing.bcc = input.bcc;
				existing.subject = input.subject;
				existing.content = input.content;
				existing.updatedAt = now;
				existing.version += 1;
				await this.saveDrafts();
				return existing;
			}
		}

		const versions = this.getDraftVersions(input.emailId || '__compose__');
		const draft: EmailDraft = {
			id: randomUUID(),
			accountId: input.accountId,
			emailId: input.emailId || '',
			to: input.to,
			cc: input.cc,
			bcc: input.bcc,
			subject: input.subject,
			content: input.content,
			version: (versions[0]?.version ?? 0) + 1,
			status: 'draft',
			createdAt: now,
			updatedAt: now,
		};
		this.drafts.push(draft);
		await this.saveDrafts();
		return draft;
	}

	async updateDraftStatus(draftId: string, status: DraftStatus): Promise<void> {
		const draft = this.getDraft(draftId);
		if (!draft) {
			throw new Error(`Draft not found: ${draftId}`);
		}
		draft.status = status;
		draft.updatedAt = new Date().toISOString();
		await this.saveDrafts();
	}

	private indexPath(): string {
		return path.join(this.storageUri.fsPath, INDEX_FILE);
	}

	private draftsPath(): string {
		return path.join(this.storageUri.fsPath, DRAFTS_FILE);
	}

	private metaPath(): string {
		return path.join(this.storageUri.fsPath, META_FILE);
	}

	private caseLinksPath(): string {
		return path.join(this.storageUri.fsPath, CASE_LINKS_FILE);
	}

	private tagsPath(): string {
		return path.join(this.storageUri.fsPath, TAGS_FILE);
	}

	private dataPaths(): string[] {
		return [
			this.indexPath(),
			this.draftsPath(),
			this.metaPath(),
			this.caseLinksPath(),
			this.tagsPath(),
		];
	}

	/**
	 * Acquire or mint the DEK. Sets mode to encrypted on success; otherwise memory.
	 */
	private async acquireEncryptionKey(): Promise<void> {
		const result = await acquireDek({
			secrets: this.secrets,
			keyId: DEK_KEY_ID,
			existingDataPaths: this.dataPaths(),
			log: this.log,
			marker: this.marker,
		});
		if (result.kind === 'ok') {
			this.dek = result.dek;
			this.mode = 'encrypted';
			return;
		}

		this.dek = undefined;
		this.mode = 'memory';
		this.log?.(`EmailIndex encryption unavailable (${result.reason})`);
		if (this.warnedUnavailable) {
			return;
		}
		this.warnedUnavailable = true;
		if (result.reason === 'secret-storage-unusable') {
			void vscode.window.showWarningMessage(
				'Emails will not be saved to disk because secure storage is unavailable.',
			);
		} else {
			// key-lost-with-data and secret-storage-not-durable
			void vscode.window.showWarningMessage(
				'The local email cache cannot be decrypted (key missing). Run "Clear Local Email Cache" to reset it.',
			);
		}
	}

	private async load(): Promise<void> {
		if (this.mode === 'memory' || !this.dek) {
			return;
		}
		const dek = this.dek;

		const indexResult = await loadJson<IndexFile>(this.indexPath(), dek, this.log);
		if (indexResult.value) {
			this.messages = indexResult.value.messages || [];
			this.threadStatus = indexResult.value.threadStatus || {};
		} else {
			this.messages = [];
			this.threadStatus = {};
		}

		const draftsResult = await loadJson<DraftsFile>(this.draftsPath(), dek, this.log);
		this.drafts = draftsResult.value?.drafts || [];

		const metaResult = await loadJson<SyncMetaFile>(this.metaPath(), dek, this.log);
		if (metaResult.value) {
			this.meta = metaResult.value;
			if (!this.meta.perAccount) {
				this.meta.perAccount = {};
			}
		} else {
			this.meta = { version: '1.0', lastBackgroundSync: null, perAccount: {} };
		}

		const linksResult = await loadJson<CaseLinksFile>(this.caseLinksPath(), dek, this.log);
		this.caseLinks = linksResult.value?.links || {};

		const tagsResult = await loadJson<TagsFile>(this.tagsPath(), dek, this.log);
		if (tagsResult.value) {
			this.knownTags = tagsResult.value.knownTags || [];
			this.threadTags = tagsResult.value.threadTags || {};
			this.hiddenThreads = new Set(tagsResult.value.hiddenThreads || []);
		} else {
			this.knownTags = [];
			this.threadTags = {};
			this.hiddenThreads = new Set();
		}
	}

	private async persist(filePath: string, payload: unknown): Promise<void> {
		if (this.mode === 'memory' || !this.dek) {
			return;
		}
		await writeEncryptedJson(filePath, payload, this.dek);
	}

	private async saveIndex(): Promise<void> {
		const payload: IndexFile = {
			version: '1.0',
			messages: this.messages,
			threadStatus: this.threadStatus,
		};
		await this.persist(this.indexPath(), payload);
	}

	private async saveDrafts(): Promise<void> {
		const payload: DraftsFile = { version: '1.0', drafts: this.drafts };
		await this.persist(this.draftsPath(), payload);
	}

	private async saveMeta(): Promise<void> {
		await this.persist(this.metaPath(), this.meta);
	}

	private async saveCaseLinks(): Promise<void> {
		const payload: CaseLinksFile = { version: '1.0', links: this.caseLinks };
		await this.persist(this.caseLinksPath(), payload);
	}

	private async saveTags(): Promise<void> {
		const payload: TagsFile = {
			version: '1.0',
			knownTags: this.knownTags,
			threadTags: this.threadTags,
			hiddenThreads: [...this.hiddenThreads],
		};
		await this.persist(this.tagsPath(), payload);
	}
}

export { computeThreadId, toSummary };

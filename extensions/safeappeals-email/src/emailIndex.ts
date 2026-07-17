/*--------------------------------------------------------------------------------------
 *  Local email index — JSON under globalStorageUri (replaces old @vscode/sqlite3)
 *--------------------------------------------------------------------------------------*/

import { createHash, randomUUID } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';
import type {
	DraftStatus,
	EmailDraft,
	EmailMessage,
	EmailMessageSummary,
	EmailStats,
	EmailThread,
	ThreadStatus,
} from './types';

const INDEX_FILE = 'email-index.json';
const DRAFTS_FILE = 'email-drafts.json';
const META_FILE = 'email-sync-meta.json';

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
	private meta: SyncMetaFile = { version: '1.0', lastBackgroundSync: null, perAccount: {} };

	constructor(private readonly storageUri: vscode.Uri) {}

	async initialize(): Promise<void> {
		await fs.mkdir(this.storageUri.fsPath, { recursive: true });
		await this.load();
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

		const threads: EmailThread[] = [];
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
				messages: msgs.map(toSummary),
			});
		}

		threads.sort((a, b) => Date.parse(b.latestDate) - Date.parse(a.latestDate));
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
			messages: msgs.map(toSummary),
		};
	}

	async updateThreadStatus(threadId: string, status: ThreadStatus): Promise<void> {
		this.threadStatus[threadId] = status;
		await this.saveIndex();
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

	private async load(): Promise<void> {
		try {
			const raw = await fs.readFile(this.indexPath(), 'utf8');
			const parsed = JSON.parse(raw) as IndexFile;
			this.messages = parsed.messages || [];
			this.threadStatus = parsed.threadStatus || {};
		} catch {
			this.messages = [];
			this.threadStatus = {};
		}
		try {
			const raw = await fs.readFile(this.draftsPath(), 'utf8');
			const parsed = JSON.parse(raw) as DraftsFile;
			this.drafts = parsed.drafts || [];
		} catch {
			this.drafts = [];
		}
		try {
			const raw = await fs.readFile(this.metaPath(), 'utf8');
			this.meta = JSON.parse(raw) as SyncMetaFile;
			if (!this.meta.perAccount) {
				this.meta.perAccount = {};
			}
		} catch {
			this.meta = { version: '1.0', lastBackgroundSync: null, perAccount: {} };
		}
	}

	private async saveIndex(): Promise<void> {
		const payload: IndexFile = {
			version: '1.0',
			messages: this.messages,
			threadStatus: this.threadStatus,
		};
		await fs.writeFile(this.indexPath(), JSON.stringify(payload, null, 2), 'utf8');
	}

	private async saveDrafts(): Promise<void> {
		const payload: DraftsFile = { version: '1.0', drafts: this.drafts };
		await fs.writeFile(this.draftsPath(), JSON.stringify(payload, null, 2), 'utf8');
	}

	private async saveMeta(): Promise<void> {
		await fs.writeFile(this.metaPath(), JSON.stringify(this.meta, null, 2), 'utf8');
	}
}

export { computeThreadId, toSummary };

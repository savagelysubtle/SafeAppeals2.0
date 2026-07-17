/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRAGPathService } from '../../common/rag/ragPathService.js';
import { Email, EmailAttachment, EmailCategory, EmailClassification, EmailPriority, EmailDraft, DraftStatus } from '../../common/emailService.js';
import { EmailIndexService } from './emailIndexService.js';

// Use createRequire for mailparser (CommonJS module)
const require = createRequire(import.meta.url);

interface ParsedMail {
	from?: { text: string; value: Array<{ address: string; name: string }> };
	to?: { text: string; value: Array<{ address: string; name: string }> };
	cc?: { text: string; value: Array<{ address: string; name: string }> };
	bcc?: { text: string; value: Array<{ address: string; name: string }> };
	subject?: string;
	text?: string;
	html?: string | false;
	date?: Date;
	attachments?: Array<{
		filename?: string;
		contentType: string;
		content: Buffer;
		size: number;
	}>;
	messageId?: string;
	inReplyTo?: string;
	references?: string | string[];
}

/**
 * Manages per-workspace email index instances
 */
class WorkspaceEmailManager {
	private instanceOfWorkspaceId: Map<string, EmailIndexService> = new Map();

	constructor(
		private readonly logService: ILogService,
		private readonly pathService: IRAGPathService
	) {}

	async getOrCreateWorkspace(workspaceId: string): Promise<EmailIndexService> {
		let instance = this.instanceOfWorkspaceId.get(workspaceId);
		if (!instance) {
			this.logService.info(`Email: Creating new workspace instance for ${workspaceId}`);
			instance = new EmailIndexService(this.logService, this.pathService, workspaceId);
			await instance.initialize();
			this.instanceOfWorkspaceId.set(workspaceId, instance);
		}
		return instance;
	}

	async closeAll(): Promise<void> {
		for (const [workspaceId, instance] of this.instanceOfWorkspaceId) {
			this.logService.info(`Email: Closing workspace instance ${workspaceId}`);
			await instance.close();
		}
		this.instanceOfWorkspaceId.clear();
	}
}

export class EmailMainService {
	private workspaceManager: WorkspaceEmailManager;
	private initialized = false;

	constructor(
		private readonly logService: ILogService,
		pathService: IRAGPathService
	) {
		this.workspaceManager = new WorkspaceEmailManager(logService, pathService);
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;
		this.logService.info('Email: Main service initialized');
	}

	/**
	 * Parse an .eml file and return the Email object
	 */
	async parseEmlFile(filePath: string, caseFolderPath: string, workspaceId: string): Promise<Email> {
		this.logService.info(`Email: Parsing .eml file: ${filePath}`);

		const { simpleParser } = require('mailparser');
		const emlContent = fs.readFileSync(filePath);
		const parsed: ParsedMail = await simpleParser(emlContent);

		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		const emailId = indexService.generateEmailId(filePath);

		const attachments: EmailAttachment[] = (parsed.attachments || []).map(att => ({
			filename: att.filename || 'unnamed',
			contentType: att.contentType,
			size: att.size
		}));

		// Parse References header (can be string or array)
		let references: string[] | undefined;
		if (parsed.references) {
			if (Array.isArray(parsed.references)) {
				references = parsed.references.filter(ref => ref && ref.trim().length > 0);
			} else if (typeof parsed.references === 'string') {
				// References is space-separated list of Message-IDs
				references = parsed.references
					.split(/\s+/)
					.map(ref => ref.trim())
					.filter(ref => ref.length > 0);
			}
		}

		// Compute threadId: use the first message ID in the chain
		// Priority: 1) First ID in References, 2) In-Reply-To, 3) Current Message-ID
		let threadId: string | undefined;
		if (references && references.length > 0) {
			threadId = references[0];
		} else if (parsed.inReplyTo) {
			threadId = parsed.inReplyTo;
		} else if (parsed.messageId) {
			threadId = parsed.messageId;
		}

		const email: Email = {
			id: emailId,
			from: parsed.from?.text || '',
			to: parsed.to?.text || '',
			cc: parsed.cc?.text,
			bcc: parsed.bcc?.text,
			subject: parsed.subject || '(No Subject)',
			bodyText: parsed.text || '',
			bodyHtml: typeof parsed.html === 'string' ? parsed.html : undefined,
			date: parsed.date || new Date(),
			caseFolderPath,
			filePath,
			fileType: 'eml',
			attachments,
			// Threading fields
			messageId: parsed.messageId,
			inReplyTo: parsed.inReplyTo,
			references,
			threadId
		};

		// Store in database
		await indexService.storeEmail(email);

		return email;
	}

	/**
	 * Parse a PDF that contains an email (usually a printed/exported email)
	 * Uses the existing PDF text extraction
	 */
	async parsePdfEmail(filePath: string, caseFolderPath: string, workspaceId: string): Promise<Email> {
		this.logService.info(`Email: Parsing PDF email: ${filePath}`);

		let fullText = '';

		try {
			// Dynamic import for pdfjs-dist (ESM version, same as RAG service)
			// @ts-ignore - pdfjs-dist mjs build doesn't have type definitions
			const pdfjsLib = await import('pdfjs-dist/build/pdf.mjs');

			const pdf = await pdfjsLib.getDocument({
				url: filePath,
				useSystemFonts: true,
				verbosity: 0
			}).promise;

			for (let i = 1; i <= pdf.numPages; i++) {
				const page = await pdf.getPage(i);
				const textContent = await page.getTextContent();
				const pageText = textContent.items.map((item: { str?: string }) => item.str || '').join(' ');
				fullText += pageText + '\n';
			}
		} catch (error) {
			this.logService.warn(`Email: PDF parsing failed, using filename as fallback: ${error}`);
			// Fallback: use filename as subject, empty body
			fullText = `[PDF content could not be extracted from: ${path.basename(filePath)}]`;
		}

		// Attempt to parse email headers from the text
		const fromMatch = fullText.match(/^From:\s*(.+?)(?:\r?\n|$)/im);
		const toMatch = fullText.match(/^To:\s*(.+?)(?:\r?\n|$)/im);
		const subjectMatch = fullText.match(/^Subject:\s*(.+?)(?:\r?\n|$)/im);
		const dateMatch = fullText.match(/^Date:\s*(.+?)(?:\r?\n|$)/im);

		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		const emailId = indexService.generateEmailId(filePath);

		const email: Email = {
			id: emailId,
			from: fromMatch?.[1]?.trim() || 'Unknown',
			to: toMatch?.[1]?.trim() || 'Unknown',
			subject: subjectMatch?.[1]?.trim() || path.basename(filePath, '.pdf'),
			bodyText: fullText,
			date: dateMatch?.[1] ? new Date(dateMatch[1]) : new Date(),
			caseFolderPath,
			filePath,
			fileType: 'pdf',
			attachments: []
		};

		// Store in database
		await indexService.storeEmail(email);

		return email;
	}

	/**
	 * Parse an email file (auto-detect type)
	 */
	async parseEmailFile(filePath: string, caseFolderPath: string, workspaceId: string): Promise<Email> {
		const ext = path.extname(filePath).toLowerCase();

		if (ext === '.eml') {
			return this.parseEmlFile(filePath, caseFolderPath, workspaceId);
		} else if (ext === '.pdf') {
			return this.parsePdfEmail(filePath, caseFolderPath, workspaceId);
		} else {
			throw new Error(`Unsupported email file type: ${ext}`);
		}
	}

	/**
	 * Get all emails for a workspace, optionally filtered by case folder
	 */
	async getEmails(workspaceId: string, caseFolderPath?: string): Promise<Email[]> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.getEmails(caseFolderPath);
	}

	/**
	 * Get a specific email by ID
	 */
	async getEmailById(workspaceId: string, emailId: string): Promise<Email | null> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.getEmailById(emailId);
	}

	/**
	 * Search emails
	 */
	async searchEmails(workspaceId: string, query: string, caseFolderPath?: string): Promise<Email[]> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.searchEmails(query, caseFolderPath);
	}

	/**
	 * Delete an email
	 */
	async deleteEmail(workspaceId: string, emailId: string): Promise<void> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		await indexService.deleteEmail(emailId);
	}

	/**
	 * Get email statistics for a workspace
	 */
	async getStats(workspaceId: string): Promise<{ totalEmails: number; draftCount: number; caseFolders: string[] }> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.getStats();
	}

	/**
	 * Toggle the starred state of an email
	 * Returns the new starred state
	 */
	async toggleStar(workspaceId: string, emailId: string): Promise<boolean> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.toggleStar(emailId);
	}

	/**
	 * Create a DOCX reply document for an email
	 */
	async createReplyDocument(
		workspaceId: string,
		emailId: string,
		draftContent: string,
		replyFolderPath: string
	): Promise<string> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		const originalEmail = await indexService.getEmailById(emailId);

		if (!originalEmail) {
			throw new Error(`Email not found: ${emailId}`);
		}

		// Create the reply folder if it doesn't exist
		if (!fs.existsSync(replyFolderPath)) {
			fs.mkdirSync(replyFolderPath, { recursive: true });
		}

		// Generate a unique filename for the reply (with time to avoid caching issues)
		const sanitizedSubject = originalEmail.subject
			.replace(/[<>:"/\\|?*]/g, '_')
			.replace(/\s+/g, '_')
			.substring(0, 50);
		const now = new Date();
		const timestamp = `${now.toISOString().split('T')[0]}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`;
		const replyFilename = `Re-${sanitizedSubject}-${timestamp}.docx`;
		const replyFilePath = path.join(replyFolderPath, replyFilename);

		// Create DOCX using docx library
		// The draftContent already includes all headers, body, and original email info
		// from formatDraftWithHeaders/generateTemplateFallback, so we just convert it to paragraphs
		const { Document, Packer, Paragraph } = require('docx');

		const doc = new Document({
			sections: [{
				children: draftContent.split('\n').map((line: string) =>
					new Paragraph({ text: line })
				)
			}]
		});

		const buffer = await Packer.toBuffer(doc);
		fs.writeFileSync(replyFilePath, buffer);

		// Store the draft in the database
		const draftEmail: Email = {
			id: indexService.generateEmailId(replyFilePath),
			from: '[Your Name]',
			to: originalEmail.from,
			subject: `Re: ${originalEmail.subject}`,
			bodyText: draftContent,
			date: new Date(),
			caseFolderPath: originalEmail.caseFolderPath,
			filePath: replyFilePath,
			fileType: 'eml', // Stored as reference
			attachments: [],
			isDraft: true,
			replyToId: originalEmail.id
		};
		await indexService.storeEmail(draftEmail);

		this.logService.info(`Email: Created reply document at ${replyFilePath}`);
		return replyFilePath;
	}

	/**
	 * Update email classification (category, priority, extracted deadline)
	 */
	async updateClassification(workspaceId: string, emailId: string, classification: EmailClassification): Promise<void> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		await indexService.updateClassification(emailId, classification);
	}

	/**
	 * Get emails filtered by category
	 */
	async getEmailsByCategory(workspaceId: string, category: EmailCategory): Promise<Email[]> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.getEmailsByCategory(category);
	}

	/**
	 * Get emails filtered by priority
	 */
	async getEmailsByPriority(workspaceId: string, priority: EmailPriority): Promise<Email[]> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.getEmailsByPriority(priority);
	}

	/**
	 * Set a reminder date for an email
	 * Pass null to clear the reminder
	 */
	async setReminder(workspaceId: string, emailId: string, reminderDate: Date | null): Promise<void> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		await indexService.setReminder(emailId, reminderDate);
	}

	/**
	 * Get emails that haven't been classified yet
	 * Used by background classifier to process missed emails
	 */
	async getUnclassifiedEmails(workspaceId: string, limit: number = 10): Promise<Email[]> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.getUnclassifiedEmails(limit);
	}

	// ========== DRAFT MANAGEMENT METHODS ==========

	/**
	 * Save a draft for an email, creating a new version
	 */
	async saveDraft(workspaceId: string, emailId: string, content: string): Promise<EmailDraft> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.saveDraft(emailId, content);
	}

	/**
	 * Get the latest draft for an email
	 */
	async getDraft(workspaceId: string, emailId: string): Promise<EmailDraft | null> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.getDraft(emailId);
	}

	/**
	 * Get all versions of drafts for an email
	 */
	async getDraftVersions(workspaceId: string, emailId: string): Promise<EmailDraft[]> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.getDraftVersions(emailId);
	}

	/**
	 * Update the status of a draft
	 */
	async updateDraftStatus(workspaceId: string, draftId: string, status: DraftStatus): Promise<void> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		await indexService.updateDraftStatus(draftId, status);
	}

	// ========== THREADING METHODS ==========

	/**
	 * Get all conversation threads in a workspace
	 */
	async getThreads(workspaceId: string): Promise<Array<{
		threadId: string;
		subject: string;
		emails: Email[];
		latestEmail: Email;
		participantCount: number;
		emailCount: number;
		hasUnread: boolean;
		latestDate: Date;
		status: 'needs-reply' | 'awaiting-response' | 'resolved' | 'active';
	}>> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		const threadIds = await indexService.getDistinctThreadIds();

		const threads = await Promise.all(
			threadIds.map(async (threadId) => {
				const emails = await indexService.getEmailsByThreadId(threadId);
				if (emails.length === 0) return null;

				// Sort emails by date (oldest first)
				emails.sort((a, b) => a.date.getTime() - b.date.getTime());

				// Get unique participants (senders)
				const uniqueSenders = new Set(emails.map(e => e.from));
				const participantCount = uniqueSenders.size;

				// Latest email is the last one after sorting
				const latestEmail = emails[emails.length - 1];

				// Subject from the first email (root of thread)
				const subject = emails[0].subject;

				// Determine thread status
				const status = await this.determineThreadStatus(threadId, latestEmail, emails, indexService);

				return {
					threadId,
					subject,
					emails,
					latestEmail,
					participantCount,
					emailCount: emails.length,
					hasUnread: false, // Placeholder for future unread tracking
					latestDate: latestEmail.date,
					status
				};
			})
		);

		// Filter out nulls and sort by latest date (most recent first)
		return threads
			.filter((t): t is NonNullable<typeof t> => t !== null)
			.sort((a, b) => b.latestDate.getTime() - a.latestDate.getTime());
	}

	/**
	 * Get a specific thread by ID
	 */
	async getThreadById(workspaceId: string, threadId: string): Promise<{
		threadId: string;
		subject: string;
		emails: Email[];
		latestEmail: Email;
		participantCount: number;
		emailCount: number;
		hasUnread: boolean;
		latestDate: Date;
		status: 'needs-reply' | 'awaiting-response' | 'resolved' | 'active';
	} | null> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		const emails = await indexService.getEmailsByThreadId(threadId);

		if (emails.length === 0) return null;

		// Sort emails by date (oldest first)
		emails.sort((a, b) => a.date.getTime() - b.date.getTime());

		// Get unique participants
		const uniqueSenders = new Set(emails.map(e => e.from));
		const participantCount = uniqueSenders.size;

		// Latest email
		const latestEmail = emails[emails.length - 1];

		// Subject from first email
		const subject = emails[0].subject;

		// Determine thread status
		const status = await this.determineThreadStatus(threadId, latestEmail, emails, indexService);

		return {
			threadId,
			subject,
			emails,
			latestEmail,
			participantCount,
			emailCount: emails.length,
			hasUnread: false,
			latestDate: latestEmail.date,
			status
		};
	}

	/**
	 * Get all emails in a thread, sorted by date (oldest first)
	 */
	async getEmailsInThread(workspaceId: string, threadId: string): Promise<Email[]> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		return indexService.getEmailsByThreadId(threadId);
	}

	/**
	 * Determine thread status based on latest email and manual status
	 */
	private async determineThreadStatus(
		threadId: string,
		latestEmail: Email,
		allEmails: Email[],
		indexService: EmailIndexService
	): Promise<'needs-reply' | 'awaiting-response' | 'resolved' | 'active'> {
		// Check for manually set thread status first
		const manualStatus = await indexService.getThreadStatus(threadId);
		if (manualStatus) {
			return manualStatus as 'needs-reply' | 'awaiting-response' | 'resolved' | 'active';
		}

		// Auto-determine based on latest email sender
		// Need to identify "our" emails vs external emails
		// Heuristic: Check if latest email is a draft (isDraft flag)
		// OR if it's from us (we need better logic here - for now use simple heuristic)

		if (latestEmail.isDraft) {
			// If latest is a draft, we're working on a reply
			return 'awaiting-response';
		}

		// Simple heuristic: if email count is 1, it's just active
		if (allEmails.length === 1) {
			return 'needs-reply';
		}

		// For multi-email threads, check if we sent the latest one
		// Heuristic: check if the latest email's "from" matches any earlier "to" addresses
		// This is imperfect but works for basic case
		const ourAddresses = new Set<string>();
		allEmails.forEach(email => {
			// Collect addresses we've sent TO (these are likely external)
			// Our own address would be in FROM when we reply
			if (email.to) {
				email.to.split(',').forEach(addr => {
					ourAddresses.add(addr.trim().toLowerCase());
				});
			}
		});

		const latestFromLower = latestEmail.from.toLowerCase();
		const isLatestFromUs = !Array.from(ourAddresses).some(addr => latestFromLower.includes(addr));

		if (isLatestFromUs) {
			// Latest email is from someone else, we need to reply
			return 'needs-reply';
		} else {
			// Latest email is from us, waiting for response
			return 'awaiting-response';
		}
	}

	/**
	 * Update thread status manually
	 */
	async updateThreadStatus(
		workspaceId: string,
		threadId: string,
		status: 'needs-reply' | 'awaiting-response' | 'resolved' | 'active'
	): Promise<void> {
		const indexService = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
		await indexService.updateThreadStatus(threadId, status);
		this.logService.info(`Email: Updated thread ${threadId} status to ${status}`);
	}

	/**
	 * Close all workspace instances
	 */
	async closeAll(): Promise<void> {
		await this.workspaceManager.closeAll();
		this.logService.info('Email: Closed all workspace instances');
	}
}


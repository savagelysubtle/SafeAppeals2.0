/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IRAGPathService } from '../../common/rag/ragPathService.js';
import { Email, EmailAttachment } from '../../common/emailService.js';
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
			attachments
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
}


/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Email, IEmailService } from '../common/emailService.js';
import { IRAGService } from '../common/rag/ragService.js';

export interface DraftContext {
	email: Email;
	ragChunks: Array<{ text: string; source: string; score: number }>;
	tone: 'professional' | 'friendly' | 'formal';
}

export interface DraftResult {
	content: string;
	sources: string[];
}

export interface IEmailDraftService {
	readonly _serviceBrand: undefined;

	/**
	 * Event fired when a draft is being generated
	 */
	readonly onDraftProgress: Event<{ emailId: string; progress: number; status: string }>;

	/**
	 * Generate a draft reply for an email using RAG context
	 */
	generateDraftReply(emailId: string, customPrompt?: string): Promise<DraftResult>;

	/**
	 * Get RAG context relevant to an email
	 */
	getRelevantContext(email: Email): Promise<Array<{ text: string; source: string; score: number }>>;

	/**
	 * Create a DOCX document from the draft
	 */
	saveDraftAsDocx(emailId: string, draftContent: string): Promise<URI>;
}

export const IEmailDraftService = createDecorator<IEmailDraftService>('emailDraftService');

export class EmailDraftService extends Disposable implements IEmailDraftService {
	readonly _serviceBrand: undefined;

	private readonly _onDraftProgress = this._register(new Emitter<{ emailId: string; progress: number; status: string }>());
	readonly onDraftProgress: Event<{ emailId: string; progress: number; status: string }> = this._onDraftProgress.event;

	constructor(
		@IEmailService private readonly emailService: IEmailService,
		@IRAGService private readonly ragService: IRAGService,
		@ILogService private readonly logService: ILogService
	) {
		super();
	}

	async generateDraftReply(emailId: string, customPrompt?: string): Promise<DraftResult> {
		this.logService.info(`[EmailDraftService] Generating draft reply for email: ${emailId}`);

		// Get the email
		const email = await this.emailService.getEmailById(emailId);
		if (!email) {
			throw new Error(`Email not found: ${emailId}`);
		}

		this._onDraftProgress.fire({ emailId, progress: 10, status: 'Retrieving email context...' });

		// Get relevant RAG context
		const ragChunks = await this.getRelevantContext(email);

		this._onDraftProgress.fire({ emailId, progress: 40, status: 'Building draft context...' });

		// Build the prompt (will be used for LLM integration later)
		const tone = 'professional'; // Could be made configurable via settings
		// Note: buildDraftContext is used for future LLM integration
		// For now we use the simpler template generation
		void this.buildDraftContext(email, ragChunks, tone, customPrompt);

		this._onDraftProgress.fire({ emailId, progress: 60, status: 'Generating draft...' });

		// Generate the draft content (template for now, LLM integration in future)
		const draftContent = this.generateDraftContent(email, ragChunks, tone);

		this._onDraftProgress.fire({ emailId, progress: 100, status: 'Draft complete' });

		return {
			content: draftContent,
			sources: ragChunks.map(c => c.source)
		};
	}

	async getRelevantContext(email: Email): Promise<Array<{ text: string; source: string; score: number }>> {
		try {
			// Build search query from email content
			const searchQuery = this.buildSearchQuery(email);

			// Search RAG for relevant documents
			const results = await this.ragService.search({
				query: searchQuery,
				limit: 5,
				scope: 'case_index' // Search case-specific documents
			});

			// Extract relevant chunks from attributions
			return results.attributions.map(attribution => ({
				text: results.answerContext, // The combined context
				source: attribution.filename || 'Unknown',
				score: attribution.score || 0
			}));
		} catch (error) {
			this.logService.warn('[EmailDraftService] Failed to retrieve RAG context:', error);
			return [];
		}
	}

	async saveDraftAsDocx(emailId: string, draftContent: string): Promise<URI> {
		const replyPath = await this.emailService.createReplyDocument(emailId, draftContent);
		return replyPath;
	}

	/**
	 * Build a search query from email content
	 */
	private buildSearchQuery(email: Email): string {
		// Extract key terms from subject and body
		const subjectTerms = email.subject
			.replace(/^(Re:|Fwd:|Fw:)\s*/gi, '')
			.trim();

		// Get first few sentences of body
		const bodyPreview = email.bodyText
			.split(/[.!?]\s+/)
			.slice(0, 3)
			.join('. ')
			.substring(0, 300);

		return `${subjectTerms} ${bodyPreview}`.trim();
	}

	/**
	 * Build context for draft generation
	 */
	private buildDraftContext(
		email: Email,
		ragChunks: Array<{ text: string; source: string; score: number }>,
		tone: 'professional' | 'friendly' | 'formal',
		customPrompt?: string
	): string {
		const toneDescriptions = {
			professional: 'professional and courteous',
			friendly: 'warm and approachable',
			formal: 'formal and official'
		};

		let context = `
You are drafting a reply to an email in a workers' compensation case context.

ORIGINAL EMAIL:
From: ${email.from}
Subject: ${email.subject}
Date: ${new Date(email.date).toLocaleDateString()}

${email.bodyText.substring(0, 2000)}

---

RELEVANT CASE DOCUMENTS:
${ragChunks.map((chunk, i) => `
[${i + 1}] From "${chunk.source}":
${chunk.text.substring(0, 500)}...
`).join('\n')}

---

INSTRUCTIONS:
- Write a ${toneDescriptions[tone]} reply
- Address the key points raised in the original email
- Reference relevant information from the case documents where applicable
- Be clear and concise
- Do not make up facts; only use information from the provided documents
${customPrompt ? `\nAdditional instructions: ${customPrompt}` : ''}
`.trim();

		return context;
	}

	/**
	 * Generate draft content (placeholder for LLM integration)
	 * In production, this would call the LLM service
	 */
	private generateDraftContent(
		email: Email,
		ragChunks: Array<{ text: string; source: string; score: number }>,
		tone: 'professional' | 'friendly' | 'formal'
	): string {
		// This is a template placeholder
		// In production, this would integrate with the LLM service
		const greeting = tone === 'formal' ? 'Dear Sir/Madam,' : 'Hello,';
		const closing = tone === 'formal' ? 'Yours faithfully,' : (tone === 'professional' ? 'Best regards,' : 'Kind regards,');

		const referencedDocs = ragChunks.length > 0
			? `\n\nBased on my review of the case documents${ragChunks.length > 0 ? `, including "${ragChunks[0].source}"` : ''}, I would like to address your concerns.\n`
			: '';

		const template = `
${greeting}

Thank you for your email regarding "${email.subject}".
${referencedDocs}
[Draft your response here - the AI will generate this content based on the email context and case documents]

Please let me know if you require any further information.

${closing}
[Your Name]
`.trim();

		return template;
	}
}

registerSingleton(IEmailDraftService, EmailDraftService, InstantiationType.Delayed);


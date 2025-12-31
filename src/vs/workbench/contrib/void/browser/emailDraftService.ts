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
import { ILLMMessageService } from '../common/sendLLMMessageService.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { FileOrgConfig } from './fileOrganizer/caseConfig.js';
import { IFileOrganizerService } from './fileOrganizer/fileOrganizerService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';

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
		@ILogService private readonly logService: ILogService,
		@ILLMMessageService private readonly llmMessageService: ILLMMessageService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService,
		@IFileOrganizerService private readonly fileOrganizerService: IFileOrganizerService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService
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

		// Load case config for user info
		const caseConfig = await this.loadCaseConfig();
		this.logService.info(`[EmailDraftService] Case config loaded: ${caseConfig ? 'yes' : 'no'}, claimant: ${caseConfig?.caseInfo?.claimantName || 'none'}`);

		this._onDraftProgress.fire({ emailId, progress: 40, status: 'Building draft context...' });

		// Build the prompt for LLM
		const tone = 'professional'; // Could be made configurable via settings
		const systemPrompt = this.buildDraftContext(email, ragChunks, tone, customPrompt, caseConfig);

		this._onDraftProgress.fire({ emailId, progress: 60, status: 'Generating AI draft...' });

		// Generate the draft content using LLM
		const draftContent = await this.callLLMForDraft(emailId, systemPrompt, email, caseConfig);

		this._onDraftProgress.fire({ emailId, progress: 100, status: 'Draft complete' });

		return {
			content: draftContent,
			sources: ragChunks.map(c => c.source)
		};
	}

	/**
	 * Load case configuration from .fileorg.json (same source as Case Info dashboard)
	 */
	private async loadCaseConfig(): Promise<FileOrgConfig | null> {
		try {
			const folders = this.workspaceContextService.getWorkspace().folders;
			if (folders.length === 0) {
				return null;
			}
			const workspaceFolder = folders[0].uri;
			return await this.fileOrganizerService.loadCaseConfig(workspaceFolder);
		} catch (error) {
			this.logService.warn('[EmailDraftService] Failed to load case config:', error);
		}
		return null;
	}

	/**
	 * Get the user's name from case config (advocate/lawyer for claimant, or claimant name for self-represented)
	 */
	private getUserNameFromConfig(caseConfig: FileOrgConfig | null): string {
		if (!caseConfig?.caseInfo) {
			return '[Your Name]';
		}

		const caseInfo = caseConfig.caseInfo;
		const claimant = caseInfo.parties?.claimant;

		// Priority: advocate > lawyers > claimant name (self-represented) > fallback
		if (claimant?.advocate?.length) {
			return claimant.advocate[0];
		}
		if (claimant?.lawyers?.length) {
			return claimant.lawyers[0];
		}
		// For self-represented cases, use claimant name
		if (caseInfo.claimantName) {
			return caseInfo.claimantName;
		}
		if (claimant?.name) {
			return claimant.name;
		}

		return '[Your Name]';
	}

	/**
	 * Call the LLM to generate the draft reply
	 */
	private async callLLMForDraft(emailId: string, systemPrompt: string, email: Email, caseConfig: FileOrgConfig | null): Promise<string> {
		return new Promise((resolve, reject) => {
			let fullResponse = '';

			const modelSelection = this.voidSettingsService.state.modelSelectionOfFeature['Chat'];
			this.logService.info(`[EmailDraftService] Model selection: ${modelSelection ? `${modelSelection.providerName}/${modelSelection.modelName}` : 'none'}`);

			if (!modelSelection) {
				// Fall back to template if no model configured
				this.logService.warn('[EmailDraftService] No Chat model configured, using template fallback');
				resolve(this.generateTemplateFallback(email, caseConfig));
				return;
			}

			const modelSelectionOptions = this.voidSettingsService.state.optionsOfModelSelection['Chat'][modelSelection.providerName]?.[modelSelection.modelName];
			const overridesOfModel = this.voidSettingsService.state.overridesOfModel;

		// Combine system prompt and user request into a single user message for better provider compatibility
		const combinedPrompt = `${systemPrompt}

---

Now write the complete email reply. Output only the email body text, no JSON or explanations.`;

		this.logService.info(`[EmailDraftService] Sending prompt to LLM (${combinedPrompt.length} chars)`);

		this.llmMessageService.sendLLMMessage({
			messagesType: 'chatMessages',
			messages: [
				{
					role: 'user',
					content: combinedPrompt
				}
			],
			separateSystemMessage: undefined,
			chatMode: null,
			modelSelection,
			modelSelectionOptions,
			overridesOfModel,
			logging: { loggingName: 'email-draft-reply' },
			onText: ({ fullText }) => {
				fullResponse = fullText;
				this.logService.trace(`[EmailDraftService] Streaming: ${fullText.length} chars`);
				// Update progress while streaming
				this._onDraftProgress.fire({
					emailId,
					progress: 60 + Math.min(35, fullResponse.length / 50),
					status: 'Writing draft...'
				});
			},
			onFinalMessage: () => {
				this.logService.info(`[EmailDraftService] LLM response complete: ${fullResponse.length} chars`);

				// If response is empty or too short, fall back to template
				if (!fullResponse || fullResponse.trim().length < 20) {
					this.logService.warn('[EmailDraftService] Empty or too short LLM response, using template fallback');
					resolve(this.generateTemplateFallback(email, caseConfig));
					return;
				}

				// Format the response with email headers
				const formattedDraft = this.formatDraftWithHeaders(email, fullResponse, caseConfig);
				resolve(formattedDraft);
			},
			onError: ({ message }) => {
				this.logService.error('[EmailDraftService] LLM error:', message);
				// Fall back to template on error
				resolve(this.generateTemplateFallback(email, caseConfig));
			},
			onAbort: () => {
				reject(new Error('Draft generation was cancelled'));
			}
		});
		});
	}

	/**
	 * Format the LLM response - just append original email reference
	 * The LLM now generates complete email with headers
	 */
	private formatDraftWithHeaders(email: Email, draftBody: string, _caseConfig: FileOrgConfig | null): string {
		// The AI already generates the full email with headers
		// Just append the original email reference for context
		return `${draftBody.trim()}

──────────────────────────────────────────────────

Original Email:

From: ${email.from || 'Unknown'}
Date: ${new Date(email.date).toLocaleString('en-AU')}
Subject: ${email.subject}

${email.bodyText.substring(0, 1000)}${email.bodyText.length > 1000 ? '...' : ''}
`;
	}

	/**
	 * Generate a template fallback when LLM is unavailable
	 */
	private generateTemplateFallback(email: Email, caseConfig: FileOrgConfig | null): string {
		const dateStr = new Date().toLocaleDateString('en-AU', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric'
		});

		const userName = this.getUserNameFromConfig(caseConfig);
		const caseNumber = caseConfig?.caseInfo?.caseNumber;
		const claimantName = caseConfig?.caseInfo?.claimantName;

		// Build from line
		const fromLine = claimantName && userName !== claimantName
			? `${userName} (on behalf of ${claimantName})`
			: userName;

		// Build subject line
		const subjectLine = caseNumber
			? `${email.subject} [Case #${caseNumber}]`
			: email.subject;

		return `To: ${email.from || 'Unknown'}
From: ${fromLine}
Re: ${subjectLine}
Date: ${dateStr}

──────────────────────────────────────────────────

Hello,

Thank you for your email regarding "${email.subject}".

[No AI model configured - please write your response here]

Please let me know if you require any further information.

Best regards,
${userName}

──────────────────────────────────────────────────

Original Email:

From: ${email.from || 'Unknown'}
Date: ${new Date(email.date).toLocaleString('en-AU')}
Subject: ${email.subject}

${email.bodyText.substring(0, 1000)}${email.bodyText.length > 1000 ? '...' : ''}
`;
	}

	async getRelevantContext(email: Email): Promise<Array<{ text: string; source: string; score: number }>> {
		try {
			// Build search query from email content
			const searchQuery = this.buildSearchQuery(email);

			// Search RAG for relevant documents
			const results = await this.ragService.search({
				query: searchQuery,
				limit: 5,
				scope: 'case_index', // Search case-specific documents
				workspaceId: this.ragService.getWorkspaceId()
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
		customPrompt?: string,
		caseConfig?: FileOrgConfig | null
	): string {
		const toneDescriptions = {
			professional: 'professional and courteous',
			friendly: 'warm and approachable',
			formal: 'formal and official'
		};

		const userName = this.getUserNameFromConfig(caseConfig ?? null);
		const caseInfo = caseConfig?.caseInfo;

		// Build case context lines (only non-empty values)
		const caseLines: string[] = [];
		if (caseInfo) {
			if (caseInfo.caseNumber) caseLines.push(`Case Number: ${caseInfo.caseNumber}`);
			if (caseInfo.claimantName) caseLines.push(`Claimant: ${caseInfo.claimantName}`);
			if (caseInfo.injuryDate) caseLines.push(`Injury Date: ${caseInfo.injuryDate}`);
			if (caseInfo.caseType) caseLines.push(`Case Type: ${caseInfo.caseType}`);
			if (caseInfo.description) caseLines.push(`Description: ${caseInfo.description}`);
		}

		const caseContextSection = caseLines.length > 0
			? `CASE INFORMATION:\n${caseLines.join('\n')}\n\nYOUR IDENTITY: You are ${userName}, writing on behalf of ${caseInfo?.claimantName || 'the claimant'}.\n\n`
			: '';

		// Build RAG documents section
		const ragSection = ragChunks.length > 0
			? ragChunks.map((chunk, i) => `[${i + 1}] From "${chunk.source}": ${chunk.text.substring(0, 500)}`).join('\n')
			: 'No relevant case documents found.';

		// Build the prompt as a single clean string
		const dateStr = new Date().toLocaleDateString('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' });

		const context = [
			'You are drafting a reply to an email in a workers compensation case context.',
			'',
			caseContextSection,
			'ORIGINAL EMAIL TO REPLY TO:',
			`From: ${email.from || 'Unknown'}`,
			`Subject: ${email.subject || 'No subject'}`,
			`Date: ${new Date(email.date).toLocaleDateString()}`,
			'',
			email.bodyText.substring(0, 2000) || '(No email body)',
			'',
			'RELEVANT CASE DOCUMENTS:',
			ragSection,
			'',
			'INSTRUCTIONS:',
			'Write a COMPLETE email reply with proper headers. Use this exact format:',
			'',
			`To: ${email.from || 'Unknown'}`,
			`From: ${userName}${caseInfo?.claimantName && userName !== caseInfo.claimantName ? ` (on behalf of ${caseInfo.claimantName})` : ''}`,
			`Re: ${email.subject}${caseInfo?.caseNumber ? ` [Case #${caseInfo.caseNumber}]` : ''}`,
			`Date: ${dateStr}`,
			'',
			'[Then write a horizontal line using ─ characters]',
			'',
			'[Then write the email body here - be ' + toneDescriptions[tone] + ']',
			'',
			`[Sign off with: ${userName}]`,
			'',
			'RULES:',
			'- Address key points from the original email',
			'- Reference case documents where applicable',
			'- Be clear and concise',
			'- Do not make up facts',
			'- Output the complete formatted email ready to send',
			customPrompt ? `- Additional: ${customPrompt}` : ''
		].filter(line => line !== undefined).join('\n');

		return context;
	}

}

registerSingleton(IEmailDraftService, EmailDraftService, InstantiationType.Delayed);


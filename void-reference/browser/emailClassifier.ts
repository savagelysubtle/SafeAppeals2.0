/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { Email, EmailCategory, EmailClassification, EmailPriority, IEmailService } from '../common/emailService.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { ICloudLLMRouterService } from './cloudLLMRouterService.js';

export const IEmailClassifierService = createDecorator<IEmailClassifierService>('emailClassifierService');

export interface IEmailClassifierService {
	readonly _serviceBrand: undefined;

	/**
	 * Classify an email based on its subject and body content.
	 * Returns classification with category, priority, and optionally extracted deadline.
	 */
	classifyEmail(subject: string, bodyText: string, from: string): Promise<EmailClassification>;

	/**
	 * Check if LLM classification is available (model configured)
	 */
	isClassificationAvailable(): boolean;

	/**
	 * Start background polling for unclassified emails
	 */
	startBackgroundPolling(): void;

	/**
	 * Stop background polling
	 */
	stopBackgroundPolling(): void;
}

// Valid categories for validation
const VALID_CATEGORIES: EmailCategory[] = ['deadline', 'info-request', 'decision', 'scheduling', 'evidence', 'general'];
const VALID_PRIORITIES: EmailPriority[] = ['urgent', 'normal', 'low'];

// Background polling interval (5 minutes)
const POLLING_INTERVAL_MS = 5 * 60 * 1000;

// Initial delay before first poll (30 seconds to let services initialize)
const INITIAL_POLL_DELAY_MS = 30 * 1000;

// Maximum emails to process per poll cycle
const MAX_EMAILS_PER_CYCLE = 5;

export class EmailClassifierService extends Disposable implements IEmailClassifierService {
	readonly _serviceBrand: undefined;

	private pollIntervalHandle: ReturnType<typeof setInterval> | undefined;
	private initialPollTimeout: ReturnType<typeof setTimeout> | undefined;
	private isPolling = false;
	private emailService: IEmailService | undefined;

	constructor(
		@ILogService private readonly logService: ILogService,
		@ICloudLLMRouterService private readonly cloudLLMRouterService: ICloudLLMRouterService,
		@IVoidSettingsService private readonly voidSettingsService: IVoidSettingsService
	) {
		super();

		// Start background polling after a short delay
		this.initialPollTimeout = setTimeout(() => {
			this.startBackgroundPolling();
		}, INITIAL_POLL_DELAY_MS);

		this._register({ dispose: () => this.stopBackgroundPolling() });
	}

	/**
	 * Set the email service reference (called by wiring contribution to avoid circular dependency)
	 */
	setEmailService(emailService: IEmailService): void {
		this.emailService = emailService;
		this.logService.info('[EmailClassifier] Email service connected for background polling');
	}

	/**
	 * Start background polling for unclassified emails
	 */
	startBackgroundPolling(): void {
		if (this.pollIntervalHandle) {
			this.logService.debug('[EmailClassifier] Background polling already running');
			return;
		}

		this.logService.info(`[EmailClassifier] Starting background polling (every ${POLLING_INTERVAL_MS / 1000 / 60} minutes)`);

		// Run immediately, then on interval
		this.pollForUnclassifiedEmails();

		this.pollIntervalHandle = setInterval(() => {
			this.pollForUnclassifiedEmails();
		}, POLLING_INTERVAL_MS);
	}

	/**
	 * Stop background polling
	 */
	stopBackgroundPolling(): void {
		if (this.initialPollTimeout) {
			clearTimeout(this.initialPollTimeout);
			this.initialPollTimeout = undefined;
		}

		if (this.pollIntervalHandle) {
			clearInterval(this.pollIntervalHandle);
			this.pollIntervalHandle = undefined;
			this.logService.info('[EmailClassifier] Background polling stopped');
		}
	}

	/**
	 * Poll for unclassified emails and classify them
	 */
	private async pollForUnclassifiedEmails(): Promise<void> {
		// Prevent overlapping polls
		if (this.isPolling) {
			this.logService.debug('[EmailClassifier] Poll skipped - previous poll still in progress');
			return;
		}

		// Check if email service is available
		if (!this.emailService) {
			this.logService.debug('[EmailClassifier] Poll skipped - email service not connected');
			return;
		}

		// Check if LLM is available
		if (!this.isClassificationAvailable()) {
			this.logService.debug('[EmailClassifier] Poll skipped - no LLM model configured');
			return;
		}

		this.isPolling = true;

		try {
			const unclassifiedEmails = await this.emailService.getUnclassifiedEmails(MAX_EMAILS_PER_CYCLE);

			if (unclassifiedEmails.length === 0) {
				this.logService.debug('[EmailClassifier] No unclassified emails found');
				return;
			}

			this.logService.info(`[EmailClassifier] Found ${unclassifiedEmails.length} unclassified email(s), processing...`);

			for (const email of unclassifiedEmails) {
				await this.classifyAndUpdateEmail(email);
			}

			this.logService.info(`[EmailClassifier] Background classification complete for ${unclassifiedEmails.length} email(s)`);
		} catch (error) {
			this.logService.error('[EmailClassifier] Background polling error:', error);
		} finally {
			this.isPolling = false;
		}
	}

	/**
	 * Classify an email and update it in the database
	 */
	private async classifyAndUpdateEmail(email: Email): Promise<void> {
		if (!this.emailService) return;

		// Safety check: Skip emails that are already classified (shouldn't happen but prevents wasting credits)
		if (email.category && email.classifiedAt) {
			this.logService.debug(`[EmailClassifier] Skipping already classified email ${email.id} (${email.category})`);
			return;
		}

		try {
			const classification = await this.classifyEmail(email.subject, email.bodyText, email.from);

			await this.emailService.updateClassification(email.id, classification);

			this.logService.info(`[EmailClassifier] Classified email "${email.subject.substring(0, 30)}..." as ${classification.category}/${classification.priority}`);
		} catch (error) {
			this.logService.warn(`[EmailClassifier] Failed to classify email ${email.id}:`, error);
		}
	}

	/**
	 * Check if LLM classification is available
	 * Returns true if either:
	 * 1. Cloud is available (signed in with credits), OR
	 * 2. A BYOK model is configured for Chat
	 */
	isClassificationAvailable(): boolean {
		// First check if cloud is available - this is preferred
		if (this.cloudLLMRouterService.canUseCloud()) {
			return true;
		}
		// Fall back to BYOK model check
		const modelSelection = this.voidSettingsService.state.modelSelectionOfFeature['Chat'];
		return !!modelSelection;
	}

	/**
	 * Classify an email using LLM
	 */
	async classifyEmail(subject: string, bodyText: string, from: string): Promise<EmailClassification> {
		this.logService.info(`[EmailClassifier] Classifying email: "${subject.substring(0, 50)}..."`);

		// Check if any LLM is available (cloud or BYOK)
		if (!this.isClassificationAvailable()) {
			this.logService.warn('[EmailClassifier] No LLM available (no cloud access and no BYOK model configured), using default classification');
			return this.getDefaultClassification();
		}

		try {
			const classification = await this.callLLMForClassification(subject, bodyText, from);
			this.logService.info(`[EmailClassifier] Classification result: category=${classification.category}, priority=${classification.priority}, deadline=${classification.extractedDeadline || 'none'}`);
			return classification;
		} catch (error) {
			this.logService.error('[EmailClassifier] Classification failed:', error);
			return this.getDefaultClassification();
		}
	}

	/**
	 * Build the classification prompt
	 */
	private buildClassificationPrompt(subject: string, bodyText: string, from: string): string {
		// Truncate body to first 1000 chars for efficiency
		const truncatedBody = bodyText.length > 1000
			? bodyText.substring(0, 1000) + '...'
			: bodyText;

		return `Classify this email for a workers compensation case management system.

From: ${from}
Subject: ${subject}
Body: ${truncatedBody}

Respond with ONLY valid JSON (no markdown, no explanation):
{
  "category": "deadline" | "info-request" | "decision" | "scheduling" | "evidence" | "general",
  "priority": "urgent" | "normal" | "low",
  "extractedDeadline": "YYYY-MM-DD" or null
}

Category guidelines:
- "deadline": Contains explicit due dates, filing deadlines, response deadlines, time limits
- "info-request": Requests for documents, medical records, information, or clarification
- "decision": Official decisions, determinations, rulings, orders from tribunals/insurers
- "scheduling": Hearings, appointments, conference calls, meetings, IME scheduling
- "evidence": Document submissions, medical reports, witness statements, evidence received
- "general": General correspondence not fitting above categories

Priority guidelines:
- "urgent": Contains words like "urgent", "immediate", "ASAP", or deadlines within 7 days
- "normal": Standard correspondence requiring attention
- "low": FYI, newsletters, acknowledgements, non-actionable items

If a specific date is mentioned as a deadline, extract it in YYYY-MM-DD format.
If no clear deadline date is mentioned, set extractedDeadline to null.`;
	}

	/**
	 * Call LLM to classify the email
	 * Uses CloudLLMRouterService which automatically routes to:
	 * 1. SafeAppeals Cloud (if signed in and has credits) - PREFERRED
	 * 2. BYOK providers (if configured)
	 */
	private async callLLMForClassification(subject: string, bodyText: string, from: string): Promise<EmailClassification> {
		return new Promise((resolve) => {
			let fullResponse = '';

			// Get model selection - but cloudLLMRouterService will handle cloud routing automatically
			const modelSelection = this.voidSettingsService.state.modelSelectionOfFeature['Chat'];

			// If no BYOK model configured and cloud not available, return default
			if (!modelSelection && !this.cloudLLMRouterService.canUseCloud()) {
				this.logService.warn('[EmailClassifier] No LLM available (no cloud access and no BYOK model configured)');
				resolve(this.getDefaultClassification());
				return;
			}

			// Use a default model selection for cloud if no BYOK configured
			// CloudLLMRouterService will handle this appropriately
			const effectiveModelSelection = modelSelection || {
				providerName: 'anthropic' as const,
				modelName: 'claude-sonnet-4'
			};

			const modelSelectionOptions = modelSelection
				? this.voidSettingsService.state.optionsOfModelSelection['Chat'][modelSelection.providerName]?.[modelSelection.modelName]
				: undefined;
			const overridesOfModel = this.voidSettingsService.state.overridesOfModel;

			const prompt = this.buildClassificationPrompt(subject, bodyText, from);

			const usingCloud = this.cloudLLMRouterService.canUseCloud();
			this.logService.info(`[EmailClassifier] Sending classification prompt (${prompt.length} chars) via ${usingCloud ? 'Cloud' : 'BYOK'}`);

			this.cloudLLMRouterService.sendLLMMessage({
				messagesType: 'chatMessages',
				messages: [
					{
						role: 'user',
						content: prompt
					}
				],
				separateSystemMessage: undefined,
				chatMode: null,
				modelSelection: effectiveModelSelection,
				modelSelectionOptions,
				overridesOfModel,
				logging: { loggingName: 'email-classification' },
				onText: ({ fullText }) => {
					// Accumulate for streaming (BYOK mode)
					fullResponse = fullText;
				},
				onFinalMessage: ({ fullText }) => {
					// Use fullText from params (works for both cloud and BYOK)
					// Cloud sends complete response directly to onFinalMessage
					// BYOK streams via onText, but also passes final text here
					const responseText = fullText || fullResponse;
					this.logService.trace(`[EmailClassifier] LLM response: ${responseText}`);
					const classification = this.parseClassificationResponse(responseText);
					resolve(classification);
				},
				onError: ({ message }) => {
					this.logService.error('[EmailClassifier] LLM error:', message);
					resolve(this.getDefaultClassification());
				},
				onAbort: () => {
					this.logService.warn('[EmailClassifier] Classification aborted');
					resolve(this.getDefaultClassification());
				}
			});
		});
	}

	/**
	 * Parse the LLM response and extract classification
	 */
	private parseClassificationResponse(response: string): EmailClassification {
		try {
			// Clean the response - remove markdown code blocks if present
			let cleanedResponse = response.trim();

			// Remove markdown code block wrappers
			if (cleanedResponse.startsWith('```json')) {
				cleanedResponse = cleanedResponse.substring(7);
			} else if (cleanedResponse.startsWith('```')) {
				cleanedResponse = cleanedResponse.substring(3);
			}
			if (cleanedResponse.endsWith('```')) {
				cleanedResponse = cleanedResponse.substring(0, cleanedResponse.length - 3);
			}
			cleanedResponse = cleanedResponse.trim();

			// Parse JSON
			const parsed = JSON.parse(cleanedResponse);

			// Validate and extract fields
			const category = this.validateCategory(parsed.category);
			const priority = this.validatePriority(parsed.priority);
			const extractedDeadline = this.parseDeadline(parsed.extractedDeadline);

			return {
				category,
				priority,
				extractedDeadline
			};
		} catch (error) {
			this.logService.warn('[EmailClassifier] Failed to parse classification response:', error, 'Response:', response);
			return this.getDefaultClassification();
		}
	}

	/**
	 * Validate category value
	 */
	private validateCategory(value: unknown): EmailCategory {
		if (typeof value === 'string' && VALID_CATEGORIES.includes(value as EmailCategory)) {
			return value as EmailCategory;
		}
		return 'general';
	}

	/**
	 * Validate priority value
	 */
	private validatePriority(value: unknown): EmailPriority {
		if (typeof value === 'string' && VALID_PRIORITIES.includes(value as EmailPriority)) {
			return value as EmailPriority;
		}
		return 'normal';
	}

	/**
	 * Parse deadline date from string
	 */
	private parseDeadline(value: unknown): Date | undefined {
		if (!value || value === 'null' || typeof value !== 'string') {
			return undefined;
		}

		try {
			// Parse YYYY-MM-DD format
			const date = new Date(value);
			if (!isNaN(date.getTime())) {
				return date;
			}
		} catch {
			// Invalid date
		}
		return undefined;
	}

	/**
	 * Get default classification when LLM is unavailable
	 */
	private getDefaultClassification(): EmailClassification {
		return {
			category: 'general',
			priority: 'normal',
			extractedDeadline: undefined
		};
	}
}

registerSingleton(IEmailClassifierService, EmailClassifierService, InstantiationType.Delayed);

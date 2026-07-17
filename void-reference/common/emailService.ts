/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

// Classification types for email categorization
export type EmailCategory =
	| 'deadline'        // Contains deadline/due date
	| 'info-request'    // Asking for information or documents
	| 'decision'        // Formal decisions or rulings
	| 'scheduling'      // Hearings, meetings, appointments
	| 'evidence'        // Evidence or document submissions
	| 'general';        // General correspondence

export type EmailPriority = 'urgent' | 'normal' | 'low';

export interface EmailClassification {
	category: EmailCategory;
	priority: EmailPriority;
	extractedDeadline?: Date;
}

export interface EmailAttachment {
	filename: string;
	contentType: string;
	content?: Uint8Array; // Optional content for smaller attachments or when explicitly requested
	size?: number;
}

export interface Email {
	id: string;
	from: string;
	to: string;
	cc?: string;
	bcc?: string;
	subject: string;
	bodyText: string;
	bodyHtml?: string;
	date: Date;
	caseFolderPath: string; // The root folder of the case this email belongs to
	filePath: string;       // Full path to the .eml or .pdf file
	fileType: 'eml' | 'pdf';
	attachments: EmailAttachment[];
	isDraft?: boolean;      // If it's a drafted reply
	replyToId?: string;     // ID of the email this is a reply to
	isStarred?: boolean;    // If the email is starred/flagged for importance
	reminderDate?: Date;    // When to be reminded about this email
	// Classification fields
	category?: EmailCategory;
	priority?: EmailPriority;
	extractedDeadline?: Date;  // If a deadline was detected
	classifiedAt?: Date;       // When classification occurred
	// Threading fields for conversation grouping
	messageId?: string;        // Unique Message-ID header from email
	inReplyTo?: string;        // Message-ID this email is replying to
	references?: string[];     // Array of Message-IDs in the conversation thread
	threadId?: string;         // Computed thread identifier for grouping
}

// Draft status workflow: draft → reviewed → ready → sent
export type DraftStatus = 'draft' | 'reviewed' | 'ready' | 'sent';

export interface EmailDraft {
	id: string;              // Unique draft ID
	emailId: string;         // Foreign key to parent email
	content: string;         // HTML content from Tiptap editor
	version: number;         // Auto-incrementing version number
	status: DraftStatus;     // Draft workflow status
	createdAt: Date;         // When draft was created
	updatedAt: Date;         // When draft was last modified
}

export const IEmailService = createDecorator<IEmailService>('voidEmailService');

export interface IEmailService {
	readonly _serviceBrand: undefined;

	/**
	 * Parse an email file (.eml or .pdf) and return the Email object.
	 * Automatically stores in the workspace-scoped database.
	 */
	parseEmail(filePath: URI): Promise<Email>;

	/**
	 * Get all emails, optionally filtered by case folder path.
	 */
	getEmails(caseFolderPath?: URI): Promise<Email[]>;

	/**
	 * Get a specific email by ID.
	 */
	getEmailById(id: string): Promise<Email | null>;

	/**
	 * Search emails using full-text search.
	 */
	searchEmails(query: string, caseFolderPath?: URI): Promise<Email[]>;

	/**
	 * Delete an email by ID.
	 */
	deleteEmail(emailId: string): Promise<void>;

	/**
	 * Get email statistics for the current workspace.
	 */
	getStats(): Promise<{ totalEmails: number; draftCount: number; caseFolders: string[] }>;

	/**
	 * Get the current workspace ID.
	 */
	getWorkspaceId(): string;

	/**
	 * Create a DOCX draft reply for an email.
	 * Returns the URI of the created draft file.
	 */
	createReplyDocument(emailId: string, draftContent: string): Promise<URI>;

	/**
	 * Toggle the starred state of an email.
	 * Returns the new starred state.
	 */
	toggleStar(emailId: string): Promise<boolean>;

	/**
	 * Update email classification (category, priority, extracted deadline).
	 */
	updateClassification(emailId: string, classification: EmailClassification): Promise<void>;

	/**
	 * Get emails filtered by category.
	 */
	getEmailsByCategory(category: EmailCategory): Promise<Email[]>;

	/**
	 * Get emails filtered by priority.
	 */
	getEmailsByPriority(priority: EmailPriority): Promise<Email[]>;

	/**
	 * Set a reminder date for an email.
	 * Pass null to clear the reminder.
	 */
	setReminder(emailId: string, reminderDate: Date | null): Promise<void>;

	/**
	 * Get emails that haven't been classified yet.
	 * Used by background classifier to process missed emails.
	 */
	getUnclassifiedEmails(limit?: number): Promise<Email[]>;
}

export const IEmailDraftService = createDecorator<IEmailDraftService>('voidEmailDraftService');

export interface IEmailDraftService {
	readonly _serviceBrand: undefined;

	/**
	 * Save a draft for an email, creating a new version.
	 * Returns the created draft with version number.
	 */
	saveDraft(emailId: string, content: string): Promise<EmailDraft>;

	/**
	 * Get the latest draft for an email.
	 */
	getDraft(emailId: string): Promise<EmailDraft | null>;

	/**
	 * Get all versions of drafts for an email, ordered by version descending.
	 */
	getDraftVersions(emailId: string): Promise<EmailDraft[]>;

	/**
	 * Update the status of a draft (draft → reviewed → ready → sent).
	 */
	updateDraftStatus(draftId: string, status: DraftStatus): Promise<void>;
}


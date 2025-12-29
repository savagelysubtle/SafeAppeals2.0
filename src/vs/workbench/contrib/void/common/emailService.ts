/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';

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
}


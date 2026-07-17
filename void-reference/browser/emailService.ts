/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Email, EmailCategory, EmailClassification, EmailPriority, IEmailService } from '../common/emailService.js';
import { IEmailClassifierService } from './emailClassifier.js';

// Helper type for date conversion from IPC (dates come as strings, enums as string|null)
type EmailWithStringDates = Omit<Email, 'date' | 'extractedDeadline' | 'classifiedAt' | 'reminderDate' | 'category' | 'priority' | 'references'> & {
	date: string;
	extractedDeadline?: string | null;
	classifiedAt?: string | null;
	reminderDate?: string | null;
	category?: string | null;
	priority?: string | null;
	references?: string[] | null;
};

/**
 * Convert email with string dates to proper Date objects
 */
function convertEmailDates(email: EmailWithStringDates): Email {
	return {
		...email,
		date: new Date(email.date),
		extractedDeadline: email.extractedDeadline ? new Date(email.extractedDeadline) : undefined,
		classifiedAt: email.classifiedAt ? new Date(email.classifiedAt) : undefined,
		reminderDate: email.reminderDate ? new Date(email.reminderDate) : undefined,
		category: email.category as EmailCategory | undefined,
		priority: (email.priority || 'normal') as EmailPriority,
		references: email.references || undefined
	};
}

export class EmailService implements IEmailService {
	readonly _serviceBrand: undefined;

	private readonly channel: IChannel;
	private readonly workspaceId: string;
	private classifierService: IEmailClassifierService | undefined;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService
	) {
		this.channel = this.mainProcessService.getChannel('void-channel-email');
		this.workspaceId = this.computeWorkspaceId();
	}

	/**
	 * Set the classifier service (called by contribution to avoid circular dependency)
	 */
	setClassifierService(classifier: IEmailClassifierService): void {
		this.classifierService = classifier;
	}

	/**
	 * Compute a stable workspace ID from the workspace folder path
	 * Uses a hash to create a unique identifier (same pattern as RAGService)
	 */
	private computeWorkspaceId(): string {
		const folders = this.workspaceContextService.getWorkspace().folders;
		if (folders.length === 0) {
			return 'default';
		}

		const folderPath = folders[0].uri.fsPath;
		// Create a simple hash from the folder path
		// We use a simple string hash since crypto module isn't available in browser
		let hash = 0;
		for (let i = 0; i < folderPath.length; i++) {
			const char = folderPath.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		// Convert to hex string and take first 16 chars
		const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
		return hexHash.substring(0, 16);
	}

	/**
	 * Get the current workspace ID
	 */
	getWorkspaceId(): string {
		return this.workspaceId;
	}

	async parseEmail(filePath: URI): Promise<Email> {
		// Infer case folder path from file path
		// Assumes structure like: workspace/cases/case-name/correspondence/email.eml
		const caseFolderPath = this.inferCaseFolderPath(filePath.fsPath);

		const result = await this.channel.call<EmailWithStringDates>('parseEmailFile', {
			filePath: filePath.toJSON(),
			caseFolderPath,
			workspaceId: this.workspaceId
		});

		const email = convertEmailDates(result);

		// Auto-classify the email if classifier is available and email isn't already classified
		if (this.classifierService && !email.category) {
			try {
				await this.classifyEmailAsync(email);
			} catch {
				// Classification failure shouldn't block email import
				// Email imported without classification
			}
		}

		return email;
	}

	/**
	 * Classify email asynchronously and update the database
	 */
	private async classifyEmailAsync(email: Email): Promise<void> {
		if (!this.classifierService) {
			return;
		}

		if (!this.classifierService.isClassificationAvailable()) {
			// Skipping classification - no LLM model configured
			return;
		}

		const classification = await this.classifierService.classifyEmail(
			email.subject,
			email.bodyText,
			email.from
		);

		// Update the email in database with classification
		await this.updateClassification(email.id, classification);

		// Update the local email object
		email.category = classification.category;
		email.priority = classification.priority;
		email.extractedDeadline = classification.extractedDeadline;
		email.classifiedAt = new Date();
	}

	async getEmails(caseFolderPath?: URI): Promise<Email[]> {
		const results = await this.channel.call<EmailWithStringDates[]>('getEmails', {
			workspaceId: this.workspaceId,
			caseFolderPath: caseFolderPath?.fsPath
		});

		return results.map(convertEmailDates);
	}

	async getEmailById(id: string): Promise<Email | null> {
		const result = await this.channel.call<EmailWithStringDates | null>('getEmailById', {
			workspaceId: this.workspaceId,
			emailId: id
		});

		if (!result) {
			return null;
		}

		return convertEmailDates(result);
	}

	async createReplyDocument(emailId: string, draftContent: string): Promise<URI> {
		// Get the email (for metadata used in filename)
		const email = await this.getEmailById(emailId);
		if (!email) {
			throw new Error(`Email not found: ${emailId}`);
		}

		// Use centralized email-replies folder at workspace root
		const folders = this.workspaceContextService.getWorkspace().folders;
		if (folders.length === 0) {
			throw new Error('No workspace folder open');
		}
		const workspaceRoot = folders[0].uri.fsPath.replace(/\\/g, '/');
		const replyFolderPath = `${workspaceRoot}/email-replies`;

		const resultPath = await this.channel.call<string>('createReplyDocument', {
			workspaceId: this.workspaceId,
			emailId,
			draftContent,
			replyFolderPath
		});

		return URI.file(resultPath);
	}

	/**
	 * Search emails using full-text search
	 */
	async searchEmails(query: string, caseFolderPath?: URI): Promise<Email[]> {
		const results = await this.channel.call<EmailWithStringDates[]>('searchEmails', {
			workspaceId: this.workspaceId,
			query,
			caseFolderPath: caseFolderPath?.fsPath
		});

		return results.map(convertEmailDates);
	}

	/**
	 * Delete an email
	 */
	async deleteEmail(emailId: string): Promise<void> {
		await this.channel.call('deleteEmail', {
			workspaceId: this.workspaceId,
			emailId
		});
	}

	/**
	 * Get email statistics
	 */
	async getStats(): Promise<{ totalEmails: number; draftCount: number; caseFolders: string[] }> {
		return this.channel.call<{ totalEmails: number; draftCount: number; caseFolders: string[] }>('getStats', {
			workspaceId: this.workspaceId
		});
	}

	/**
	 * Toggle the starred state of an email
	 * Returns the new starred state
	 */
	async toggleStar(emailId: string): Promise<boolean> {
		return this.channel.call<boolean>('toggleStar', {
			workspaceId: this.workspaceId,
			emailId
		});
	}

	/**
	 * Update email classification (category, priority, extracted deadline)
	 */
	async updateClassification(emailId: string, classification: EmailClassification): Promise<void> {
		await this.channel.call('updateClassification', {
			workspaceId: this.workspaceId,
			emailId,
			category: classification.category,
			priority: classification.priority,
			extractedDeadline: classification.extractedDeadline?.toISOString()
		});
	}

	/**
	 * Get emails filtered by category
	 */
	async getEmailsByCategory(category: EmailCategory): Promise<Email[]> {
		const results = await this.channel.call<EmailWithStringDates[]>('getEmailsByCategory', {
			workspaceId: this.workspaceId,
			category
		});

		return results.map(convertEmailDates);
	}

	/**
	 * Get emails filtered by priority
	 */
	async getEmailsByPriority(priority: EmailPriority): Promise<Email[]> {
		const results = await this.channel.call<EmailWithStringDates[]>('getEmailsByPriority', {
			workspaceId: this.workspaceId,
			priority
		});

		return results.map(convertEmailDates);
	}

	/**
	 * Set a reminder date for an email
	 * Pass null to clear the reminder
	 */
	async setReminder(emailId: string, reminderDate: Date | null): Promise<void> {
		await this.channel.call('setReminder', {
			workspaceId: this.workspaceId,
			emailId,
			reminderDate: reminderDate?.toISOString() ?? null
		});
	}

	/**
	 * Get emails that haven't been classified yet
	 * Used by background classifier to process missed emails
	 */
	async getUnclassifiedEmails(limit: number = 10): Promise<Email[]> {
		const results = await this.channel.call<EmailWithStringDates[]>('getUnclassifiedEmails', {
			workspaceId: this.workspaceId,
			limit
		});

		return results.map(convertEmailDates);
	}

	/**
	 * Infer the case folder path from a file path
	 * Assumes structure like: workspace/cases/case-name/correspondence/email.eml
	 * Returns the case-name folder path
	 */
	private inferCaseFolderPath(filePath: string): string {
		const folders = this.workspaceContextService.getWorkspace().folders;
		if (folders.length === 0) {
			return filePath;
		}

		const workspaceRoot = folders[0].uri.fsPath;

		// Remove workspace root from file path
		let relativePath = filePath;
		if (filePath.startsWith(workspaceRoot)) {
			relativePath = filePath.substring(workspaceRoot.length);
		}

		// Normalize path separators
		relativePath = relativePath.replace(/\\/g, '/');

		// Split into parts and look for the case folder
		const parts = relativePath.split('/').filter(p => p.length > 0);

		// If path contains "cases" folder, return path up to the case name
		const casesIndex = parts.findIndex(p => p.toLowerCase() === 'cases');
		if (casesIndex !== -1 && casesIndex + 1 < parts.length) {
			// Return workspace/cases/case-name
			return `${workspaceRoot}/${parts.slice(0, casesIndex + 2).join('/')}`;
		}

		// Otherwise, return the parent directory of the file
		// Normalize path separators for cross-platform compatibility
		const normalizedFilePath = filePath.replace(/\\/g, '/');
		const lastSlash = normalizedFilePath.lastIndexOf('/');
		if (lastSlash !== -1) {
			return normalizedFilePath.substring(0, lastSlash);
		}

		return filePath;
	}
}

registerSingleton(IEmailService, EmailService, InstantiationType.Delayed);


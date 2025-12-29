/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { Email, IEmailService } from '../common/emailService.js';

export class EmailService implements IEmailService {
	readonly _serviceBrand: undefined;

	private readonly channel: IChannel;
	private readonly workspaceId: string;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService
	) {
		this.channel = this.mainProcessService.getChannel('void-channel-email');
		this.workspaceId = this.computeWorkspaceId();
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

		const result = await this.channel.call<Email & { date: string }>('parseEmailFile', {
			filePath: filePath.toJSON(),
			caseFolderPath,
			workspaceId: this.workspaceId
		});

		// Convert date string back to Date object
		return {
			...result,
			date: new Date(result.date)
		};
	}

	async getEmails(caseFolderPath?: URI): Promise<Email[]> {
		const results = await this.channel.call<Array<Email & { date: string }>>('getEmails', {
			workspaceId: this.workspaceId,
			caseFolderPath: caseFolderPath?.fsPath
		});

		// Convert date strings back to Date objects
		return results.map((email) => ({
			...email,
			date: new Date(email.date)
		}));
	}

	async getEmailById(id: string): Promise<Email | null> {
		const result = await this.channel.call<(Email & { date: string }) | null>('getEmailById', {
			workspaceId: this.workspaceId,
			emailId: id
		});

		if (!result) {
			return null;
		}

		return {
			...result,
			date: new Date(result.date)
		};
	}

	async createReplyDocument(emailId: string, draftContent: string): Promise<URI> {
		// Get the email to determine the reply folder path
		const email = await this.getEmailById(emailId);
		if (!email) {
			throw new Error(`Email not found: ${emailId}`);
		}

		// Create reply folder path: caseFolderPath/replies
		const replyFolderPath = `${email.caseFolderPath}/replies`;

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
		const results = await this.channel.call<Array<Email & { date: string }>>('searchEmails', {
			workspaceId: this.workspaceId,
			query,
			caseFolderPath: caseFolderPath?.fsPath
		});

		return results.map((email) => ({
			...email,
			date: new Date(email.date)
		}));
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
		const lastSlash = filePath.lastIndexOf('/');
		if (lastSlash !== -1) {
			return filePath.substring(0, lastSlash);
		}

		return filePath;
	}
}

registerSingleton(IEmailService, EmailService, InstantiationType.Delayed);


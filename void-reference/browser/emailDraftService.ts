/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { DraftStatus, EmailDraft, IEmailDraftService } from '../common/emailService.js';

// Helper type for date conversion from IPC (dates come as strings)
type EmailDraftWithStringDates = Omit<EmailDraft, 'createdAt' | 'updatedAt'> & {
	createdAt: string;
	updatedAt: string;
};

/**
 * Convert draft with string dates to proper Date objects
 */
function convertDraftDates(draft: EmailDraftWithStringDates): EmailDraft {
	return {
		...draft,
		createdAt: new Date(draft.createdAt),
		updatedAt: new Date(draft.updatedAt)
	};
}

export class EmailDraftService implements IEmailDraftService {
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
	 * Uses the same pattern as EmailService
	 */
	private computeWorkspaceId(): string {
		const folders = this.workspaceContextService.getWorkspace().folders;
		if (folders.length === 0) {
			return 'default';
		}

		const folderPath = folders[0].uri.fsPath;
		// Create a simple hash from the folder path
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
	 * Save a draft for an email, creating a new version
	 */
	async saveDraft(emailId: string, content: string): Promise<EmailDraft> {
		const result = await this.channel.call<EmailDraftWithStringDates>('saveDraft', {
			workspaceId: this.workspaceId,
			emailId,
			content
		});

		return convertDraftDates(result);
	}

	/**
	 * Get the latest draft for an email
	 */
	async getDraft(emailId: string): Promise<EmailDraft | null> {
		const result = await this.channel.call<EmailDraftWithStringDates | null>('getDraft', {
			workspaceId: this.workspaceId,
			emailId
		});

		if (!result) {
			return null;
		}

		return convertDraftDates(result);
	}

	/**
	 * Get all versions of drafts for an email
	 */
	async getDraftVersions(emailId: string): Promise<EmailDraft[]> {
		const results = await this.channel.call<EmailDraftWithStringDates[]>('getDraftVersions', {
			workspaceId: this.workspaceId,
			emailId
		});

		return results.map(convertDraftDates);
	}

	/**
	 * Update the status of a draft
	 */
	async updateDraftStatus(draftId: string, status: DraftStatus): Promise<void> {
		await this.channel.call('updateDraftStatus', {
			workspaceId: this.workspaceId,
			draftId,
			status
		});
	}
}

registerSingleton(IEmailDraftService, EmailDraftService, InstantiationType.Delayed);

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { IServerChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { Event } from '../../../../base/common/event.js';
import { URI, UriComponents } from '../../../../base/common/uri.js';
import { EmailMainService } from './email/emailMainService.js';

export class EmailMainChannel implements IServerChannel {
	constructor(
		private readonly emailMainService: EmailMainService
	) {}

	listen(_: unknown, event: string): Event<any> {
		throw new Error(`Event not found: ${event}`);
	}

	async call(ctx: any, command: string, args?: any): Promise<any> {
		switch (command) {
			case 'parseEmailFile': {
				const { filePath, caseFolderPath, workspaceId } = args;
				const uri = URI.revive(filePath as UriComponents);
				return this.emailMainService.parseEmailFile(uri.fsPath, caseFolderPath, workspaceId);
			}

			case 'getEmails': {
				const { workspaceId, caseFolderPath } = args;
				return this.emailMainService.getEmails(workspaceId, caseFolderPath);
			}

			case 'getEmailById': {
				const { workspaceId, emailId } = args;
				return this.emailMainService.getEmailById(workspaceId, emailId);
			}

			case 'searchEmails': {
				const { workspaceId, query, caseFolderPath } = args;
				return this.emailMainService.searchEmails(workspaceId, query, caseFolderPath);
			}

			case 'deleteEmail': {
				const { workspaceId, emailId } = args;
				return this.emailMainService.deleteEmail(workspaceId, emailId);
			}

			case 'getStats': {
				const { workspaceId } = args;
				return this.emailMainService.getStats(workspaceId);
			}

			case 'createReplyDocument': {
				const { workspaceId, emailId, draftContent, replyFolderPath } = args;
				return this.emailMainService.createReplyDocument(workspaceId, emailId, draftContent, replyFolderPath);
			}

			case 'toggleStar': {
				const { workspaceId, emailId } = args;
				return this.emailMainService.toggleStar(workspaceId, emailId);
			}

			case 'updateClassification': {
				const { workspaceId, emailId, category, priority, extractedDeadline } = args;
				return this.emailMainService.updateClassification(workspaceId, emailId, {
					category,
					priority,
					extractedDeadline: extractedDeadline ? new Date(extractedDeadline) : undefined
				});
			}

			case 'getEmailsByCategory': {
				const { workspaceId, category } = args;
				return this.emailMainService.getEmailsByCategory(workspaceId, category);
			}

			case 'getEmailsByPriority': {
				const { workspaceId, priority } = args;
				return this.emailMainService.getEmailsByPriority(workspaceId, priority);
			}

			case 'setReminder': {
				const { workspaceId, emailId, reminderDate } = args;
				return this.emailMainService.setReminder(
					workspaceId,
					emailId,
					reminderDate ? new Date(reminderDate) : null
				);
			}

			case 'getUnclassifiedEmails': {
				const { workspaceId, limit } = args;
				return this.emailMainService.getUnclassifiedEmails(workspaceId, limit);
			}

			// Draft management handlers
			case 'saveDraft': {
				const { workspaceId, emailId, content } = args;
				return this.emailMainService.saveDraft(workspaceId, emailId, content);
			}

			case 'getDraft': {
				const { workspaceId, emailId } = args;
				return this.emailMainService.getDraft(workspaceId, emailId);
			}

			case 'getDraftVersions': {
				const { workspaceId, emailId } = args;
				return this.emailMainService.getDraftVersions(workspaceId, emailId);
			}

			case 'updateDraftStatus': {
				const { workspaceId, draftId, status } = args;
				return this.emailMainService.updateDraftStatus(workspaceId, draftId, status);
			}

			// Threading handlers
			case 'getThreads': {
				const { workspaceId } = args;
				return this.emailMainService.getThreads(workspaceId);
			}

			case 'getThreadById': {
				const { workspaceId, threadId } = args;
				return this.emailMainService.getThreadById(workspaceId, threadId);
			}

			case 'getEmailsInThread': {
				const { workspaceId, threadId } = args;
				return this.emailMainService.getEmailsInThread(workspaceId, threadId);
			}

			case 'updateThreadStatus': {
				const { workspaceId, threadId, status } = args;
				return this.emailMainService.updateThreadStatus(workspaceId, threadId, status);
			}

			default:
				throw new Error(`Call not found: ${command}`);
		}
	}
}


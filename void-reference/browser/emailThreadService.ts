/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { Email } from '../common/emailService.js';
import { IEmailService } from '../common/emailService.js';

/**
 * Thread status based on conversation state
 */
export type ThreadStatus = 'needs-reply' | 'awaiting-response' | 'resolved' | 'active';

/**
 * Represents a conversation thread of emails
 */
export interface EmailThread {
	threadId: string;
	subject: string;           // Subject from the first email in thread
	emails: Email[];           // All emails in the thread, sorted by date
	latestEmail: Email;        // Most recent email in thread
	participantCount: number;  // Number of unique senders
	emailCount: number;        // Total emails in thread
	hasUnread: boolean;        // If any email is unread (placeholder for future)
	latestDate: Date;          // Date of latest email
	status: ThreadStatus;      // Current status of the thread
}

// Helper type for date conversion from IPC
type EmailThreadWithStringDates = Omit<EmailThread, 'latestDate' | 'emails' | 'latestEmail'> & {
	latestDate: string;
	status: ThreadStatus;
	emails: Array<Omit<Email, 'date' | 'extractedDeadline' | 'classifiedAt' | 'reminderDate'> & {
		date: string;
		extractedDeadline?: string | null;
		classifiedAt?: string | null;
		reminderDate?: string | null;
	}>;
	latestEmail: Omit<Email, 'date' | 'extractedDeadline' | 'classifiedAt' | 'reminderDate'> & {
		date: string;
		extractedDeadline?: string | null;
		classifiedAt?: string | null;
		reminderDate?: string | null;
	};
};

/**
 * Convert email thread with string dates to proper Date objects
 */
function convertThreadDates(thread: EmailThreadWithStringDates): EmailThread {
	const convertEmail = (email: EmailThreadWithStringDates['emails'][0]): Email => ({
		...email,
		date: new Date(email.date),
		extractedDeadline: email.extractedDeadline ? new Date(email.extractedDeadline) : undefined,
		classifiedAt: email.classifiedAt ? new Date(email.classifiedAt) : undefined,
		reminderDate: email.reminderDate ? new Date(email.reminderDate) : undefined,
		category: email.category || undefined,
		priority: email.priority || 'normal',
		references: email.references || undefined
	});

	return {
		...thread,
		latestDate: new Date(thread.latestDate),
		emails: thread.emails.map(convertEmail),
		latestEmail: convertEmail(thread.latestEmail),
		status: thread.status
	};
}

export const IEmailThreadService = createDecorator<IEmailThreadService>('emailThreadService');

export interface IEmailThreadService {
	readonly _serviceBrand: undefined;

	/**
	 * Get all conversation threads in the current workspace
	 */
	getThreads(): Promise<EmailThread[]>;

	/**
	 * Get a specific thread by its thread ID
	 */
	getThreadById(threadId: string): Promise<EmailThread | null>;

	/**
	 * Get all emails in a thread, sorted by date (oldest first)
	 */
	getEmailsInThread(threadId: string): Promise<Email[]>;

	/**
	 * Update the status of a thread (resolved, needs-reply, etc.)
	 */
	updateThreadStatus(threadId: string, status: ThreadStatus): Promise<void>;
}

export class EmailThreadService implements IEmailThreadService {
	readonly _serviceBrand: undefined;

	private readonly channel: IChannel;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@IEmailService private readonly emailService: IEmailService
	) {
		this.channel = this.mainProcessService.getChannel('void-channel-email');
	}

	async getThreads(): Promise<EmailThread[]> {
		const workspaceId = this.emailService.getWorkspaceId();
		const result = await this.channel.call<EmailThreadWithStringDates[]>('getThreads', { workspaceId });
		return result.map(convertThreadDates);
	}

	async getThreadById(threadId: string): Promise<EmailThread | null> {
		const workspaceId = this.emailService.getWorkspaceId();
		const result = await this.channel.call<EmailThreadWithStringDates | null>('getThreadById', {
			workspaceId,
			threadId
		});
		return result ? convertThreadDates(result) : null;
	}

	async getEmailsInThread(threadId: string): Promise<Email[]> {
		const workspaceId = this.emailService.getWorkspaceId();
		const result = await this.channel.call<Array<Omit<Email, 'date' | 'extractedDeadline' | 'classifiedAt' | 'reminderDate'> & {
			date: string;
			extractedDeadline?: string | null;
			classifiedAt?: string | null;
			reminderDate?: string | null;
		}>>('getEmailsInThread', {
			workspaceId,
			threadId
		});

		return result.map(email => ({
			...email,
			date: new Date(email.date),
			extractedDeadline: email.extractedDeadline ? new Date(email.extractedDeadline) : undefined,
			classifiedAt: email.classifiedAt ? new Date(email.classifiedAt) : undefined,
			reminderDate: email.reminderDate ? new Date(email.reminderDate) : undefined,
			category: email.category || undefined,
			priority: email.priority || 'normal',
			references: email.references || undefined
		}));
	}

	async updateThreadStatus(threadId: string, status: ThreadStatus): Promise<void> {
		const workspaceId = this.emailService.getWorkspaceId();
		await this.channel.call('updateThreadStatus', {
			workspaceId,
			threadId,
			status
		});
	}
}

registerSingleton(IEmailThreadService, EmailThreadService, InstantiationType.Delayed);

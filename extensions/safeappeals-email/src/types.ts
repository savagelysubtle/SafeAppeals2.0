/*--------------------------------------------------------------------------------------
 *  Safe Appeals Email — shared types (ported from void-reference/common/emailService)
 *--------------------------------------------------------------------------------------*/

export type EmailCategory =
	| 'deadline'
	| 'info-request'
	| 'decision'
	| 'scheduling'
	| 'evidence'
	| 'general';

export type EmailPriority = 'urgent' | 'normal' | 'low';

export type ThreadStatus = 'needs-reply' | 'awaiting-response' | 'resolved' | 'active';

export type DraftStatus = 'draft' | 'reviewed' | 'ready' | 'sent';

export interface EmailClassification {
	category: EmailCategory;
	priority: EmailPriority;
	extractedDeadline?: string; // ISO
}

export interface EmailAttachment {
	filename: string;
	contentType: string;
	size?: number;
}

/** Lightweight header/row used in lists (no full body). */
export interface EmailMessageSummary {
	id: string;
	accountId: string;
	folder: string;
	uid?: number;
	from: string;
	to: string;
	cc?: string;
	subject: string;
	date: string; // ISO
	snippet?: string;
	messageId?: string;
	inReplyTo?: string;
	references?: string[];
	threadId: string;
	isStarred?: boolean;
	hasAttachments?: boolean;
	/** Classification (filled by rung 12 classifier; optional now) */
	category?: EmailCategory;
	priority?: EmailPriority;
	extractedDeadline?: string;
	classifiedAt?: string;
	/** Body not loaded until getMessage */
	bodyLoaded: boolean;
}

/** Full message including body (lazy-loaded). */
export interface EmailMessage extends EmailMessageSummary {
	bodyText: string;
	bodyHtml?: string;
	bcc?: string;
	attachments: EmailAttachment[];
	/** Local .eml path when imported from disk */
	filePath?: string;
	fileType?: 'eml' | 'imap';
	caseFolderPath?: string;
	reminderDate?: string;
}

export interface EmailThread {
	threadId: string;
	accountId: string;
	folder: string;
	subject: string;
	latestDate: string;
	emailCount: number;
	participantCount: number;
	status: ThreadStatus;
	/** Summaries only — bodies loaded on demand */
	messages: EmailMessageSummary[];
}

export interface EmailDraft {
	id: string;
	accountId: string;
	/** Parent message id when replying; empty for compose */
	emailId: string;
	to: string;
	cc?: string;
	bcc?: string;
	subject: string;
	content: string;
	version: number;
	status: DraftStatus;
	createdAt: string;
	updatedAt: string;
}

/** Non-secret account config (also mirrored in settings for discoverability). */
export interface EmailAccountConfig {
	id: string;
	label: string;
	email: string;
	imapHost: string;
	imapPort: number;
	imapSecure: boolean;
	smtpHost: string;
	smtpPort: number;
	smtpSecure: boolean;
	username: string;
}

export interface EmailAccountCredentials {
	password: string;
}

export interface SendMailRequest {
	accountId: string;
	to: string;
	cc?: string;
	bcc?: string;
	subject: string;
	text?: string;
	html?: string;
	inReplyTo?: string;
	references?: string[];
}

export interface ListThreadsQuery {
	accountId?: string;
	folder?: string;
	offset?: number;
	limit?: number;
}

export interface SyncStatus {
	accounts: Array<{
		accountId: string;
		label: string;
		email: string;
		lastSync: string | null;
		messageCount: number;
		error?: string;
	}>;
	lastBackgroundSync: string | null;
	syncIntervalMinutes: number;
	syncing: boolean;
}

export interface EmailStats {
	totalEmails: number;
	draftCount: number;
	accountCount: number;
	threadCount: number;
}

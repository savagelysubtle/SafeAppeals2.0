/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
	/** Absolute fsPath of the linked case folder, when linked */
	caseFolderPath?: string;
	/** User-applied tags */
	tags?: string[];
	/** Hidden threads sort to the bottom of listings and render greyed out */
	hidden?: boolean;
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

/** OAuth identity provider for mailbox XOAUTH2 (tokens live in auth extension, not here). */
export type EmailOAuthProvider = 'google' | 'microsoft';

/**
 * Visible reconnect state for OAuth (and optionally password) accounts.
 * Stored on account config — never inside SecretStorage credentials.
 */
export type EmailAccountAuthStatus = 'ok' | 'needsReconnect';

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
	/**
	 * Mailbox auth health. OAuth accounts set `needsReconnect` when getSession /
	 * connection token mint fails; cleared after a successful reconnect.
	 */
	authStatus?: EmailAccountAuthStatus;
}

/**
 * Mailbox credentials backed by a SafeAppeals service connection.
 *
 * Stores only the connection id — the provider refresh token lives in void-cloud
 * and short-lived access tokens are minted through the authentication extension
 * (`session.id` === {@link connectionId}).
 *
 * `connectionId` is absent on rows written before service connections; those are
 * legacy and get adopted or flagged for reconnect on activate.
 */
export interface EmailOAuthCredentials {
	type: 'oauth';
	provider: EmailOAuthProvider;
	connectionId?: string;
}

/**
 * Discriminated credential union for email SecretStorage.
 * OAuth rows store only `{ type, provider, connectionId }` — never access/refresh tokens.
 * Legacy SecretStorage blobs `{ password }` (no `type`) are accepted at the
 * store boundary via {@link EmailAccountCredentialsInput} / {@link normalizeCredentials}.
 */
export type EmailAccountCredentials =
	| { type: 'password'; password: string }
	| EmailOAuthCredentials;

/** Legacy SecretStorage / callers that omit `type` (pre-OAuth shape). */
export type LegacyPasswordCredentials = { password: string };

/** Accepted by addAccount / updateCredentials before normalize. */
export type EmailAccountCredentialsInput = EmailAccountCredentials | LegacyPasswordCredentials;

export function isOAuthCredentials(
	creds: EmailAccountCredentials,
): creds is EmailOAuthCredentials {
	return creds.type === 'oauth';
}

/**
 * True for an OAuth row written before service connections: it names a provider
 * but no connection, so no token can be minted for it until it is migrated.
 */
export function isLegacyOAuthCredentials(creds: EmailAccountCredentials): boolean {
	return isOAuthCredentials(creds) && !creds.connectionId;
}

export function isPasswordCredentials(
	creds: EmailAccountCredentials,
): creds is Extract<EmailAccountCredentials, { type: 'password' }> {
	return creds.type === 'password';
}

/**
 * Normalize raw SecretStorage / caller payloads into the discriminated union.
 * Legacy `{ password }` (no `type`) → `{ type: 'password', password }`.
 * Returns undefined when the payload is missing or malformed.
 */
export function normalizeCredentials(raw: unknown): EmailAccountCredentials | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	const obj = raw as Record<string, unknown>;
	if (obj.type === 'oauth') {
		if (obj.provider === 'google' || obj.provider === 'microsoft') {
			const connectionId = typeof obj.connectionId === 'string' ? obj.connectionId.trim() : '';
			return connectionId
				? { type: 'oauth', provider: obj.provider, connectionId }
				: { type: 'oauth', provider: obj.provider };
		}
		return undefined;
	}
	if (obj.type === 'password' || obj.type === undefined) {
		if (typeof obj.password === 'string') {
			return { type: 'password', password: obj.password };
		}
		return undefined;
	}
	return undefined;
}

/**
 * JSON-safe shape persisted to SecretStorage.
 * Password: `{ type, password }`. OAuth: `{ type, provider, connectionId }` only (strips tokens).
 */
export function credentialsForStorage(creds: EmailAccountCredentials): EmailAccountCredentials {
	if (creds.type === 'oauth') {
		return creds.connectionId
			? { type: 'oauth', provider: creds.provider, connectionId: creds.connectionId }
			: { type: 'oauth', provider: creds.provider };
	}
	return { type: 'password', password: creds.password };
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

export type ThreadSort = 'newest' | 'oldest' | 'sender' | 'subject';

export interface ListThreadsQuery {
	accountId?: string;
	folder?: string;
	offset?: number;
	limit?: number;
	sort?: ThreadSort;
	/** Only threads linked to this case folder (absolute fsPath) */
	caseFolderPath?: string;
	/** Only threads carrying this tag (case-insensitive) */
	tag?: string;
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

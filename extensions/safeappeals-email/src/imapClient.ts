/*--------------------------------------------------------------------------------------
 *  IMAP via imapflow (pure JS — no native modules)
 *--------------------------------------------------------------------------------------*/

import { ImapFlow } from 'imapflow';
import { computeThreadId } from './emailIndex';
import { parseRawSource } from './emlParser';
import type { EmailAccountConfig, EmailAccountCredentials, EmailMessage } from './types';

export interface FolderInfo {
	path: string;
	name: string;
	specialUse?: string;
}

function createClient(account: EmailAccountConfig, creds: EmailAccountCredentials): ImapFlow {
	return new ImapFlow({
		host: account.imapHost,
		port: account.imapPort,
		secure: account.imapSecure,
		auth: {
			user: account.username,
			pass: creds.password,
		},
		logger: false,
	});
}

export async function listFolders(
	account: EmailAccountConfig,
	creds: EmailAccountCredentials,
): Promise<FolderInfo[]> {
	const client = createClient(account, creds);
	await client.connect();
	try {
		const boxes = await client.list();
		return boxes.map((b) => ({
			path: b.path,
			name: b.name,
			specialUse: b.specialUse || undefined,
		}));
	} finally {
		await client.logout().catch(() => undefined);
	}
}

/**
 * Fetch recent message headers (no bodies) for a folder.
 */
export async function fetchHeaders(
	account: EmailAccountConfig,
	creds: EmailAccountCredentials,
	folder: string,
	maxMessages: number,
): Promise<EmailMessage[]> {
	const client = createClient(account, creds);
	await client.connect();
	try {
		const lock = await client.getMailboxLock(folder);
		try {
			const mailbox = client.mailbox as { exists?: number } | false | null | undefined;
			const exists = mailbox && typeof mailbox === 'object' ? (mailbox.exists ?? 0) : 0;
			if (exists === 0) {
				return [];
			}
			const start = Math.max(1, exists - maxMessages + 1);
			const range = `${start}:${exists}`;
			const results: EmailMessage[] = [];

			for await (const msg of client.fetch(range, {
				uid: true,
				envelope: true,
				flags: true,
				bodyStructure: true,
			})) {
				const env = msg.envelope;
				if (!env) {
					continue;
				}
				const from = (env.from || []).map((a) => a.address || a.name || '').filter(Boolean).join(', ');
				const to = (env.to || []).map((a) => a.address || a.name || '').filter(Boolean).join(', ');
				const cc = (env.cc || []).map((a) => a.address || a.name || '').filter(Boolean).join(', ') || undefined;
				const messageId = env.messageId || undefined;
				const inReplyTo = Array.isArray(env.inReplyTo)
					? env.inReplyTo[0]
					: env.inReplyTo || undefined;
				const references = env.replyTo ? undefined : undefined; // envelope lacks References; filled on body fetch
				const id = `${account.id}:${folder}:${msg.uid}`;
				const threadId = computeThreadId({
					id,
					messageId,
					inReplyTo,
					references,
				});
				const hasAttachments = !!(msg.bodyStructure && JSON.stringify(msg.bodyStructure).includes('"disposition":"attachment"'));

				results.push({
					id,
					accountId: account.id,
					folder,
					uid: msg.uid,
					from,
					to,
					cc,
					subject: env.subject || '(No Subject)',
					date: (env.date || new Date()).toISOString(),
					snippet: undefined,
					messageId,
					inReplyTo,
					references,
					threadId,
					isStarred: msg.flags?.has('\\Flagged'),
					hasAttachments,
					bodyText: '',
					attachments: [],
					bodyLoaded: false,
					fileType: 'imap',
				});
			}
			return results;
		} finally {
			lock.release();
		}
	} finally {
		await client.logout().catch(() => undefined);
	}
}

/**
 * Fetch a single message source and parse body (lazy load).
 */
export async function fetchMessageBody(
	account: EmailAccountConfig,
	creds: EmailAccountCredentials,
	folder: string,
	uid: number,
	messageIdHint: string,
): Promise<EmailMessage> {
	const client = createClient(account, creds);
	await client.connect();
	try {
		const lock = await client.getMailboxLock(folder);
		try {
			const downloaded = await client.download(uid);
			const chunks: Buffer[] = [];
			for await (const chunk of downloaded.content) {
				chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
			}
			const source = Buffer.concat(chunks);
			return parseRawSource(source, {
				id: messageIdHint,
				accountId: account.id,
				folder,
				uid,
			});
		} finally {
			lock.release();
		}
	} finally {
		await client.logout().catch(() => undefined);
	}
}

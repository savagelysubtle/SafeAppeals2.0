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

export type ImapLog = (msg: string) => void;

export interface DiagnoseConnectionResult {
	ok: boolean;
	folder: string;
	exists: number;
	fetched: number;
	sampleSubject?: string;
	sampleUid?: number;
	error?: string;
	stack?: string;
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

function mailboxExists(client: ImapFlow): number {
	const mailbox = client.mailbox;
	if (!mailbox || typeof mailbox !== 'object') {
		return 0;
	}
	return typeof mailbox.exists === 'number' ? mailbox.exists : 0;
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
 *
 * Range semantics (imapflow): string ranges like "start:end" are SEQUENCE numbers
 * unless the third options arg is `{ uid: true }`. Query `{ uid: true }` only
 * requests that the UID field be included in each FetchMessageObject.
 * `client.mailbox.exists` is the message count after getMailboxLock.
 */
export async function fetchHeaders(
	account: EmailAccountConfig,
	creds: EmailAccountCredentials,
	folder: string,
	maxMessages: number,
	log?: ImapLog,
): Promise<EmailMessage[]> {
	const client = createClient(account, creds);
	await client.connect();
	try {
		const lock = await client.getMailboxLock(folder);
		try {
			const exists = mailboxExists(client);
			const start = exists === 0 ? 0 : Math.max(1, exists - maxMessages + 1);
			const range = exists === 0 ? '(empty)' : `${start}:${exists}`;
			log?.(
				`fetchHeaders ${account.label} folder=${folder} exists=${exists} range=${range} (sequence; uid in query = include UID field)`,
			);

			if (exists === 0) {
				log?.(`fetchHeaders ${account.label}: mailbox empty, returning 0 headers`);
				return [];
			}

			const results: EmailMessage[] = [];
			let envelopesSeen = 0;
			let skippedNoEnvelope = 0;

			// Sequence range (no third-arg uid). Query.uid includes UID on each message.
			for await (const msg of client.fetch(range, {
				uid: true,
				envelope: true,
				flags: true,
				bodyStructure: true,
			})) {
				const env = msg.envelope;
				if (!env) {
					skippedNoEnvelope++;
					continue;
				}
				envelopesSeen++;
				const from = (env.from || []).map((a) => a.address || a.name || '').filter(Boolean).join(', ');
				const to = (env.to || []).map((a) => a.address || a.name || '').filter(Boolean).join(', ');
				const cc = (env.cc || []).map((a) => a.address || a.name || '').filter(Boolean).join(', ') || undefined;
				const messageId = env.messageId || undefined;
				const inReplyTo = Array.isArray(env.inReplyTo)
					? env.inReplyTo[0]
					: env.inReplyTo || undefined;
				// IMAP ENVELOPE has no References header; threading refines on body fetch.
				const references: string[] | undefined = undefined;
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

			log?.(
				`fetchHeaders ${account.label}: envelopes=${envelopesSeen} skippedNoEnvelope=${skippedNoEnvelope} upsertCandidates=${results.length}`,
			);
			return results;
		} finally {
			lock.release();
		}
	} finally {
		await client.logout().catch(() => undefined);
	}
}

/**
 * Connect, open folder, report exists, fetch the newest 1 header — for user diagnosis.
 */
export async function diagnoseConnection(
	account: EmailAccountConfig,
	creds: EmailAccountCredentials,
	folder: string,
	log?: ImapLog,
): Promise<DiagnoseConnectionResult> {
	const client = createClient(account, creds);
	log?.(
		`diagnoseConnection: connecting ${account.label} ${account.username}@${account.imapHost}:${account.imapPort} secure=${account.imapSecure} folder=${folder}`,
	);
	try {
		await client.connect();
		log?.('diagnoseConnection: connected');
		const lock = await client.getMailboxLock(folder);
		try {
			const exists = mailboxExists(client);
			const path = client.mailbox && typeof client.mailbox === 'object' ? client.mailbox.path : folder;
			log?.(`diagnoseConnection: mailbox locked path=${path} exists=${exists}`);

			if (exists === 0) {
				const result: DiagnoseConnectionResult = {
					ok: true,
					folder: path || folder,
					exists: 0,
					fetched: 0,
				};
				log?.('diagnoseConnection: SUCCESS — mailbox is empty (exists=0)');
				return result;
			}

			// Newest message by sequence number
			const range = `${exists}:${exists}`;
			let fetched = 0;
			let sampleSubject: string | undefined;
			let sampleUid: number | undefined;

			for await (const msg of client.fetch(range, {
				uid: true,
				envelope: true,
			})) {
				fetched++;
				sampleUid = msg.uid;
				sampleSubject = msg.envelope?.subject || '(No Subject)';
				log?.(
					`diagnoseConnection: fetched seq=${exists} uid=${msg.uid} subject=${JSON.stringify(sampleSubject)}`,
				);
			}

			const result: DiagnoseConnectionResult = {
				ok: fetched > 0,
				folder: path || folder,
				exists,
				fetched,
				sampleSubject,
				sampleUid,
				error: fetched === 0 ? `exists=${exists} but fetch(${range}) returned 0 messages` : undefined,
			};
			log?.(
				result.ok
					? `diagnoseConnection: SUCCESS — exists=${exists} fetched=${fetched} uid=${sampleUid}`
					: `diagnoseConnection: FAILED — ${result.error}`,
			);
			return result;
		} finally {
			lock.release();
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		const stack = err instanceof Error ? err.stack : undefined;
		log?.(`diagnoseConnection: FAILED — ${message}`);
		if (stack) {
			log?.(stack);
		}
		return {
			ok: false,
			folder,
			exists: 0,
			fetched: 0,
			error: message,
			stack,
		};
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
			// Third-arg uid:true — `uid` is a UID, not a sequence number
			const downloaded = await client.download(uid, undefined, { uid: true });
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

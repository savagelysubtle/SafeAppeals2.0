/*--------------------------------------------------------------------------------------
 *  IMAP via imapflow (pure JS — no native modules)
 *--------------------------------------------------------------------------------------*/

import { ImapFlow } from 'imapflow';
import { computeThreadId } from './emailIndex';
import { parseRawSource } from './emlParser';
import type { EmailAccountConfig, EmailMessage } from './types';

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

/**
 * Resolved mailbox auth for IMAP connect.
 * Password: app-password / IMAP password. OAuth: access token from caller (E3 getSession) —
 * this module never calls getSession.
 */
export type MailboxAuth =
	| { type: 'password'; password: string }
	| { type: 'oauth'; accessToken: string };

/** imapflow auth object (password or XOAUTH2 via accessToken). */
export type ImapFlowAuth =
	| { user: string; pass: string }
	| { user: string; accessToken: string };

/** Gmail rejects normal passwords for IMAP; surface a clear next step. */
const GMAIL_APP_PASSWORD_HINT =
	'Gmail requires an App Password (myaccount.google.com/apppasswords) — regular passwords are rejected.';

/**
 * The access token was accepted as a token but carries no Gmail scope — the Google
 * consent was identity-only, so reconnecting and granting mail access is the fix.
 */
function gmailMissingScopeHint(scope: string): string {
	return `the access token is missing Gmail access (${scope}) — reconnect the mailbox and allow Gmail access when Google asks.`;
}

interface ImapErrorLike {
	message?: string;
	responseText?: string;
	response?: unknown;
	serverResponseCode?: string;
	authenticationFailed?: boolean;
	code?: string;
	responseStatus?: string;
	/** imapflow surfaces the SASL error payload from Gmail (status/scope/schemes). */
	oauthError?: { status?: string; scope?: string; schemes?: string } | string;
}

/** Scope Gmail says the token needs, from imapflow's parsed `oauthError`. */
function oauthMissingScope(err: ImapErrorLike): string | undefined {
	const payload = err.oauthError;
	if (!payload) {
		return undefined;
	}
	if (typeof payload === 'string') {
		const match = payload.match(/"scope"\s*:\s*"(?<scope>[^"]+)"/);
		return match?.groups?.scope;
	}
	const scope = payload.scope?.trim();
	return scope || undefined;
}

function isGmailHost(host: string): boolean {
	const h = host.toLowerCase();
	return h.includes('gmail') || h.includes('googlemail');
}

function isAuthFailure(err: ImapErrorLike, text: string): boolean {
	if (err.authenticationFailed === true) {
		return true;
	}
	const hay = `${err.serverResponseCode || ''} ${text}`.toLowerCase();
	return (
		hay.includes('authenticationfailed') ||
		hay.includes('invalid credentials') ||
		hay.includes('application-specific')
	);
}

/**
 * Prefer imapflow's rich server fields over the generic Error.message ("Command failed").
 *
 * Confirmed fields (imapflow source + docs):
 * - responseText: human text from NO/BAD (set when command fails)
 * - response: parsed object, then often rewritten to a string via enhanceCommandError/login
 * - serverResponseCode: e.g. AUTHENTICATIONFAILED
 * - authenticationFailed: true on login/auth failures
 * - code: e.g. ETHROTTLE
 *
 * @param authType When `'oauth'`, skip the Gmail app-password hint (XOAUTH2 failures
 * are reconnect/token issues, not app-password issues). Defaults to `'password'` so
 * legacy callers keep the hint.
 */
export function describeImapError(
	err: unknown,
	imapHost?: string,
	authType: MailboxAuth['type'] = 'password',
): string {
	const e = (err && typeof err === 'object' ? err : {}) as ImapErrorLike;
	const responseText = typeof e.responseText === 'string' ? e.responseText.trim() : '';
	const responseStr = typeof e.response === 'string' ? e.response.trim() : '';
	const serverCode = typeof e.serverResponseCode === 'string' ? e.serverResponseCode.trim() : '';
	const generic = err instanceof Error ? err.message : String(err);
	const isGenericCommandFailed = !generic || generic === 'Command failed';

	let detail: string;
	if (responseText) {
		detail = responseText;
	} else if (responseStr) {
		detail = responseStr;
	} else if (serverCode && isGenericCommandFailed) {
		detail = serverCode;
	} else {
		detail = generic || 'unknown error';
	}

	if (serverCode && !detail.toUpperCase().includes(serverCode.toUpperCase())) {
		detail = `[${serverCode}] ${detail}`;
	} else if (typeof e.code === 'string' && e.code && !detail.includes(e.code)) {
		detail = `[${e.code}] ${detail}`;
	}

	if (
		authType === 'password'
		&& imapHost
		&& isGmailHost(imapHost)
		&& isAuthFailure(e, detail)
	) {
		detail = `${detail} — ${GMAIL_APP_PASSWORD_HINT}`;
	}

	if (authType === 'oauth') {
		const missingScope = oauthMissingScope(e);
		if (missingScope) {
			detail = `${detail} — ${gmailMissingScopeHint(missingScope)}`;
		}
	}

	return detail;
}

/** Log enumerable + own error keys for debugging (truncated). */
export function logImapErrorDetails(err: unknown, log: ImapLog, maxLen = 2000): void {
	try {
		const data: Record<string, unknown> = {};
		if (err && typeof err === 'object') {
			for (const key of Object.getOwnPropertyNames(err)) {
				data[key] = (err as Record<string, unknown>)[key];
			}
		} else {
			log(`imap error (non-object): ${String(err)}`);
			return;
		}
		let json = JSON.stringify(data, (_key, value) => {
			if (typeof value === 'string' && value.length > 400) {
				return `${value.slice(0, 400)}…`;
			}
			return value;
		});
		if (json.length > maxLen) {
			json = `${json.slice(0, maxLen)}…`;
		}
		log(`imap error details: ${json}`);
	} catch (serializeErr) {
		log(
			`imap error details: (serialize failed) ${err instanceof Error ? err.message : String(err)}; ${serializeErr instanceof Error ? serializeErr.message : String(serializeErr)}`,
		);
	}
}

/**
 * Map resolved {@link MailboxAuth} to imapflow `auth`.
 * Password → `{ user, pass }`. OAuth → `{ user, accessToken }` (XOAUTH2).
 */
export function toImapFlowAuth(user: string, auth: MailboxAuth): ImapFlowAuth {
	if (auth.type === 'oauth') {
		return { user, accessToken: auth.accessToken };
	}
	return { user, pass: auth.password };
}

function createClient(account: EmailAccountConfig, auth: MailboxAuth): ImapFlow {
	return new ImapFlow({
		host: account.imapHost,
		port: account.imapPort,
		secure: account.imapSecure,
		auth: toImapFlowAuth(account.username, auth),
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
	auth: MailboxAuth,
): Promise<FolderInfo[]> {
	const client = createClient(account, auth);
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
 * Locate the Drafts mailbox: SPECIAL-USE `\Drafts` first, then common path names.
 */
export function resolveDraftsFolderPath(folders: FolderInfo[]): string | undefined {
	const bySpecial = folders.find((f) => f.specialUse === '\\Drafts');
	if (bySpecial) {
		return bySpecial.path;
	}

	const preferred = ['[gmail]/drafts', 'drafts', 'inbox.drafts'];
	for (const key of preferred) {
		const match = folders.find((f) => {
			const path = f.path.toLowerCase();
			const name = f.name.toLowerCase();
			return path === key || name === key;
		});
		if (match) {
			return match.path;
		}
	}

	const loose = folders.find((f) => {
		const path = f.path.toLowerCase();
		const name = f.name.toLowerCase();
		return (
			name === 'drafts'
			|| path === 'drafts'
			|| path.endsWith('/drafts')
			|| path.endsWith('.drafts')
		);
	});
	return loose?.path;
}

export interface AppendDraftOptions {
	/** Previous remote draft UID to delete after a successful APPEND (best-effort). */
	replaceUid?: number;
	/** Mailbox path of the previous remote draft. */
	replaceFolder?: string;
}

export interface AppendDraftResult {
	folder: string;
	uid?: number;
}

/**
 * APPEND an RFC822 draft into the account's Drafts folder (`\Draft` + `\Seen`).
 * Optionally deletes a prior remote UID so updates do not accumulate duplicates.
 */
export async function appendDraftMessage(
	account: EmailAccountConfig,
	auth: MailboxAuth,
	raw: Buffer | string,
	options?: AppendDraftOptions,
): Promise<AppendDraftResult> {
	const client = createClient(account, auth);
	await client.connect();
	try {
		const boxes = await client.list();
		const folders: FolderInfo[] = boxes.map((b) => ({
			path: b.path,
			name: b.name,
			specialUse: b.specialUse || undefined,
		}));
		const folder = resolveDraftsFolderPath(folders);
		if (!folder) {
			throw new Error('Drafts folder not found on this account');
		}

		const appended = await client.append(folder, raw, ['\\Draft', '\\Seen']);
		if (!appended) {
			throw new Error('IMAP APPEND to Drafts returned no result');
		}
		const uid = typeof appended.uid === 'number' ? appended.uid : undefined;

		const replaceUid = options?.replaceUid;
		const replaceFolder = options?.replaceFolder;
		if (
			replaceUid !== undefined
			&& replaceFolder
			&& !(replaceFolder === folder && replaceUid === uid)
		) {
			try {
				const lock = await client.getMailboxLock(replaceFolder);
				try {
					await client.messageDelete(replaceUid, { uid: true });
				} finally {
					lock.release();
				}
			} catch {
				// Best-effort cleanup — new draft already appended.
			}
		}

		return { folder, uid };
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
	auth: MailboxAuth,
	folder: string,
	maxMessages: number,
	log?: ImapLog,
): Promise<EmailMessage[]> {
	const client = createClient(account, auth);
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
	auth: MailboxAuth,
	folder: string,
	log?: ImapLog,
): Promise<DiagnoseConnectionResult> {
	const client = createClient(account, auth);
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
		const message = describeImapError(err, account.imapHost, auth.type);
		const stack = err instanceof Error ? err.stack : undefined;
		log?.(`diagnoseConnection: FAILED — ${message}`);
		if (log) {
			logImapErrorDetails(err, log);
		}
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
	auth: MailboxAuth,
	folder: string,
	uid: number,
	messageIdHint: string,
): Promise<EmailMessage> {
	const client = createClient(account, auth);
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

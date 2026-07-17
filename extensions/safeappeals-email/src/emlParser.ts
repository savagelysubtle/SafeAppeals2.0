/*--------------------------------------------------------------------------------------
 *  .eml parsing via mailparser (same library as the old fork)
 *--------------------------------------------------------------------------------------*/

import * as fs from 'fs/promises';
import { simpleParser, type ParsedMail, type Attachment } from 'mailparser';
import { computeThreadId } from './emailIndex';
import type { EmailAttachment, EmailMessage } from './types';

function addrText(field: ParsedMail['from'] | ParsedMail['to']): string {
	if (!field) {
		return '';
	}
	if ('text' in field && field.text) {
		return field.text;
	}
	return '';
}

function normalizeReferences(refs: ParsedMail['references']): string[] | undefined {
	if (!refs) {
		return undefined;
	}
	if (Array.isArray(refs)) {
		return refs.filter((r) => r && r.trim().length > 0);
	}
	return refs
		.split(/\s+/)
		.map((r) => r.trim())
		.filter((r) => r.length > 0);
}

function mapAttachments(atts: Attachment[] | undefined): EmailAttachment[] {
	return (atts || []).map((att) => ({
		filename: att.filename || 'unnamed',
		contentType: att.contentType || 'application/octet-stream',
		size: att.size,
	}));
}

export async function parseEmlBuffer(
	content: Buffer,
	opts: {
		id: string;
		accountId: string;
		folder?: string;
		filePath?: string;
		caseFolderPath?: string;
	},
): Promise<EmailMessage> {
	const parsed = await simpleParser(content);
	const references = normalizeReferences(parsed.references);
	const messageId = parsed.messageId;
	const inReplyTo = parsed.inReplyTo;
	const threadId = computeThreadId({
		id: opts.id,
		messageId,
		inReplyTo,
		references,
	});

	const bodyText = parsed.text || '';
	const bodyHtml = typeof parsed.html === 'string' ? parsed.html : undefined;

	return {
		id: opts.id,
		accountId: opts.accountId,
		folder: opts.folder || 'local',
		from: addrText(parsed.from),
		to: addrText(parsed.to),
		cc: addrText(parsed.cc) || undefined,
		bcc: addrText(parsed.bcc) || undefined,
		subject: parsed.subject || '(No Subject)',
		date: (parsed.date || new Date()).toISOString(),
		snippet: bodyText.slice(0, 160),
		messageId,
		inReplyTo,
		references,
		threadId,
		bodyText,
		bodyHtml,
		attachments: mapAttachments(parsed.attachments),
		hasAttachments: (parsed.attachments?.length ?? 0) > 0,
		bodyLoaded: true,
		filePath: opts.filePath,
		fileType: 'eml',
		caseFolderPath: opts.caseFolderPath,
	};
}

export async function parseEmlFile(
	filePath: string,
	opts: { id: string; accountId: string; caseFolderPath?: string },
): Promise<EmailMessage> {
	const buf = await fs.readFile(filePath);
	return parseEmlBuffer(buf, {
		id: opts.id,
		accountId: opts.accountId,
		folder: 'local',
		filePath,
		caseFolderPath: opts.caseFolderPath,
	});
}

export async function parseRawSource(
	source: Buffer | string,
	opts: { id: string; accountId: string; folder: string; uid?: number },
): Promise<EmailMessage> {
	const buf = typeof source === 'string' ? Buffer.from(source) : source;
	const msg = await parseEmlBuffer(buf, {
		id: opts.id,
		accountId: opts.accountId,
		folder: opts.folder,
	});
	msg.uid = opts.uid;
	msg.fileType = 'imap';
	return msg;
}

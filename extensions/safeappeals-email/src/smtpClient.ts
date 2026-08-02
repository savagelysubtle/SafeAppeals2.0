/*--------------------------------------------------------------------------------------
 *  SMTP via nodemailer (pure JS)
 *--------------------------------------------------------------------------------------*/

import nodemailer from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';
import type { EmailAccountConfig, SendMailRequest } from './types';

/**
 * Resolved mailbox auth for SMTP.
 * Password: app-password path. OAuth: access token from caller (E3 getSession) —
 * this module never calls getSession.
 * Same shape as {@link import('./imapClient').MailboxAuth}.
 */
export type MailboxAuth =
	| { type: 'password'; password: string }
	| { type: 'oauth'; accessToken: string };

/** nodemailer transport `auth` (login or OAuth2 / XOAUTH2). */
export type NodemailerAuth = NonNullable<SMTPTransport.Options['auth']>;

/**
 * Map resolved {@link MailboxAuth} to nodemailer `auth`.
 * Password → `{ user, pass }`. OAuth → `{ type: 'OAuth2', user, accessToken }`.
 */
export function toNodemailerAuth(user: string, auth: MailboxAuth): NodemailerAuth {
	if (auth.type === 'oauth') {
		return {
			type: 'OAuth2',
			user,
			accessToken: auth.accessToken,
		};
	}
	return {
		user,
		pass: auth.password,
	};
}

function createTransport(account: EmailAccountConfig, auth: MailboxAuth) {
	return nodemailer.createTransport({
		host: account.smtpHost,
		port: account.smtpPort,
		secure: account.smtpSecure,
		auth: toNodemailerAuth(account.username, auth),
	});
}

export async function sendMail(
	account: EmailAccountConfig,
	auth: MailboxAuth,
	request: SendMailRequest,
): Promise<{ messageId: string }> {
	const transport = createTransport(account, auth);

	try {
		const info = await transport.sendMail({
			from: account.email || account.username,
			to: request.to,
			cc: request.cc,
			bcc: request.bcc,
			subject: request.subject,
			text: request.text,
			html: request.html,
			inReplyTo: request.inReplyTo,
			references: request.references,
		});
		return { messageId: info.messageId || '' };
	} finally {
		transport.close();
	}
}

export async function verifySmtp(
	account: EmailAccountConfig,
	auth: MailboxAuth,
): Promise<boolean> {
	const transport = createTransport(account, auth);
	try {
		await transport.verify();
		return true;
	} finally {
		transport.close();
	}
}

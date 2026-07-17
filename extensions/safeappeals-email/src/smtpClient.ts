/*--------------------------------------------------------------------------------------
 *  SMTP via nodemailer (pure JS)
 *--------------------------------------------------------------------------------------*/

import nodemailer from 'nodemailer';
import type { EmailAccountConfig, EmailAccountCredentials, SendMailRequest } from './types';

export async function sendMail(
	account: EmailAccountConfig,
	creds: EmailAccountCredentials,
	request: SendMailRequest,
): Promise<{ messageId: string }> {
	const transport = nodemailer.createTransport({
		host: account.smtpHost,
		port: account.smtpPort,
		secure: account.smtpSecure,
		auth: {
			user: account.username,
			pass: creds.password,
		},
	});

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
	creds: EmailAccountCredentials,
): Promise<boolean> {
	const transport = nodemailer.createTransport({
		host: account.smtpHost,
		port: account.smtpPort,
		secure: account.smtpSecure,
		auth: {
			user: account.username,
			pass: creds.password,
		},
	});
	try {
		await transport.verify();
		return true;
	} finally {
		transport.close();
	}
}

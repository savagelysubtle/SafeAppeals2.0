/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import MailComposer = require('nodemailer/lib/mail-composer');
import type { EmailAccountConfig } from './types';

export interface Rfc822MessageInput {
	to: string;
	cc?: string;
	bcc?: string;
	subject: string;
	text: string;
	html?: string;
}

/**
 * Build an RFC822 raw message buffer (for IMAP APPEND drafts, etc.).
 * Reuses nodemailer's MailComposer — same MIME shaping as SMTP send.
 */
export async function buildRfc822Message(
	account: EmailAccountConfig,
	input: Rfc822MessageInput,
): Promise<Buffer> {
	const composer = new MailComposer({
		from: account.email || account.username,
		to: input.to,
		cc: input.cc,
		bcc: input.bcc,
		subject: input.subject,
		text: input.text,
		html: input.html,
	});
	const message = composer.compile();
	const built = await message.build();
	return Buffer.isBuffer(built) ? built : Buffer.from(built);
}

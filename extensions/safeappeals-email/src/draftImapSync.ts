/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import {
	appendDraftMessage,
	describeImapError,
	type AppendDraftResult,
	type MailboxAuth,
} from './imapClient';
import { buildRfc822Message } from './mimeBuilder';
import type { EmailAccountConfig, EmailDraft, OutboundAttachment } from './types';

export interface SyncDraftToImapResult {
	draft: EmailDraft;
	remote?: { folder: string; uid?: number };
	remoteError?: string;
}

export interface SyncDraftToImapDeps {
	buildMime?: typeof buildRfc822Message;
	appendDraft?: typeof appendDraftMessage;
	updateDraftRemote: (
		draftId: string,
		remote: { remoteFolder: string; remoteUid?: number },
	) => Promise<EmailDraft | undefined>;
	/** Load attachment bytes for IMAP APPEND (metadata is on the draft). */
	loadAttachments?: (draft: EmailDraft) => Promise<OutboundAttachment[]>;
	log?: (msg: string) => void;
}

/**
 * Best-effort IMAP Drafts APPEND after a local draft is already saved.
 * Never throws for IMAP failures — returns `remoteError` instead.
 */
export async function syncDraftToImap(
	draft: EmailDraft,
	account: EmailAccountConfig,
	auth: MailboxAuth | undefined,
	options: {
		skipRemote?: boolean;
	} & SyncDraftToImapDeps,
): Promise<SyncDraftToImapResult> {
	if (options.skipRemote) {
		return { draft };
	}
	if (!auth) {
		return {
			draft,
			remoteError: 'Missing credentials for IMAP Drafts sync',
		};
	}

	const buildMime = options.buildMime ?? buildRfc822Message;
	const appendDraft = options.appendDraft ?? appendDraftMessage;

	try {
		const attachments = options.loadAttachments
			? await options.loadAttachments(draft)
			: [];
		const raw = await buildMime(account, {
			to: draft.to,
			cc: draft.cc,
			bcc: draft.bcc,
			subject: draft.subject,
			text: draft.content,
			attachments,
		});
		const remote: AppendDraftResult = await appendDraft(account, auth, raw, {
			replaceUid: draft.remoteUid,
			replaceFolder: draft.remoteFolder,
		});
		const updated = await options.updateDraftRemote(draft.id, {
			remoteFolder: remote.folder,
			remoteUid: remote.uid,
		});
		options.log?.(
			`Draft ${draft.id} appended to IMAP ${remote.folder}`
			+ (remote.uid !== undefined ? ` uid=${remote.uid}` : ''),
		);
		return {
			draft: updated ?? { ...draft, remoteFolder: remote.folder, remoteUid: remote.uid },
			remote: { folder: remote.folder, uid: remote.uid },
		};
	} catch (err) {
		const remoteError = describeImapError(err, account.imapHost, auth.type);
		options.log?.(`IMAP Drafts sync failed for ${draft.id}: ${remoteError}`);
		return { draft, remoteError };
	}
}

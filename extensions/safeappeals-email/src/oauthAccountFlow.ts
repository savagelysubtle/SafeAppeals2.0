/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { AccountStore } from './accountStore';
import { isOAuthCredentials, type EmailAccountConfig, type EmailOAuthProvider } from './types';

/** Product identity provider (SafeAppeals Cloud). */
export const CLOUD_AUTH_PROVIDER_ID = 'safeappeals-cloud';

/** Google mailbox connection sessions (`accessToken` = Google XOAUTH2). */
export const GOOGLE_AUTH_PROVIDER_ID = 'safeappeals-google';

/** Microsoft mailbox connection sessions (not yet enabled in add-account UX). */
export const MICROSOFT_AUTH_PROVIDER_ID = 'safeappeals-microsoft';

const EMAIL_IN_LABEL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;

/**
 * Derive a mailbox address from an authentication account label
 * (e.g. `"Jane Doe (jane@gmail.com)"` or bare `"jane@gmail.com"`).
 */
export function emailFromAuthAccountLabel(label: string | undefined): string | undefined {
	if (!label) {
		return undefined;
	}
	const trimmed = label.trim();
	if (!trimmed) {
		return undefined;
	}
	if (EMAIL_IN_LABEL.test(trimmed) && !trimmed.includes(' ') && trimmed.includes('@')) {
		return trimmed.toLowerCase();
	}
	const match = trimmed.match(EMAIL_IN_LABEL);
	return match?.[0]?.toLowerCase();
}

/** Prefill Gmail IMAP/SMTP hosts for Safe Appeals Google OAuth accounts. */
export function gmailOAuthAccountDefaults(email: string): Omit<EmailAccountConfig, 'id' | 'authStatus'> {
	return {
		label: email,
		email,
		imapHost: 'imap.gmail.com',
		imapPort: 993,
		imapSecure: true,
		smtpHost: 'smtp.gmail.com',
		smtpPort: 465,
		smtpSecure: true,
		username: email,
	};
}

/** Prefill Outlook/Exchange Online hosts for Safe Appeals Microsoft OAuth accounts. */
export function outlookOAuthAccountDefaults(email: string): Omit<EmailAccountConfig, 'id' | 'authStatus'> {
	return {
		label: email,
		email,
		imapHost: 'outlook.office365.com',
		imapPort: 993,
		imapSecure: true,
		smtpHost: 'smtp.office365.com',
		smtpPort: 587,
		smtpSecure: false,
		username: email,
	};
}

/** Host/port defaults for a connected mailbox of either provider. */
export function oauthAccountDefaults(
	provider: EmailOAuthProvider,
	email: string,
): Omit<EmailAccountConfig, 'id' | 'authStatus'> {
	return provider === 'microsoft'
		? outlookOAuthAccountDefaults(email)
		: gmailOAuthAccountDefaults(email);
}

export function providerAuthIdForOAuth(provider: EmailOAuthProvider): string {
	return provider === 'microsoft' ? MICROSOFT_AUTH_PROVIDER_ID : GOOGLE_AUTH_PROVIDER_ID;
}

/**
 * Session scope strings that grant Gmail/IMAP access. `safeappeals-google` reports
 * the `'mail'` sentinel; full Google scope URIs are accepted for robustness.
 */
const MAIL_SCOPE_MARKERS = /^(mail|https:\/\/mail\.google\.com\/?|https:\/\/www\.googleapis\.com\/auth\/gmail\.[a-z]+)$/i;

/**
 * True when an authentication session actually carries mailbox scope.
 * Empty scopes count as "no mail" — a token minted from an identity-only Google
 * grant cannot authenticate IMAP and must not look like a mailbox session.
 */
export function sessionGrantsMailScope(scopes: readonly string[] | undefined): boolean {
	return (scopes ?? []).some(scope => MAIL_SCOPE_MARKERS.test(scope.trim()));
}

/**
 * Gate for persisting an OAuth mailbox row: only after a mail-scoped access token
 * was actually minted for a known service connection. Never store `{type:'oauth'}`
 * on an empty mint, on a token whose grant lacks mailbox access, or without the
 * connection the mailbox mints from.
 */
export function shouldPersistOAuthAccount({
	accessToken,
	scopes,
	connectionId,
}: {
	accessToken?: string;
	scopes?: readonly string[];
	connectionId?: string;
}): boolean {
	return Boolean(accessToken) && sessionGrantsMailScope(scopes) && Boolean(connectionId?.trim());
}

/**
 * Connection id behind an authentication session.
 *
 * The `safeappeals-google` / `safeappeals-microsoft` providers are multi-account
 * and set `session.id` to the service-connection id (A3 contract).
 */
export function connectionIdFromSession(
	session: { id?: string } | undefined,
): string | undefined {
	const id = session?.id?.trim();
	return id || undefined;
}

/**
 * Connection metadata as this extension consumes it. Structurally a subset of
 * `ConnectionInfo` in safeappeals-authentication, which crosses the extension-host
 * boundary as plain JSON (so it is re-validated here rather than imported).
 */
export interface MailConnectionInfo {
	readonly id: string;
	readonly provider: EmailOAuthProvider;
	readonly accountEmail?: string | null;
	readonly accountLabel?: string | null;
	readonly providerAccountId?: string | null;
	readonly capabilities?: readonly string[];
	readonly status?: string;
}

/**
 * Validates one connection record handed over by safeappeals-authentication.
 * Returns undefined for anything that is not a usable connection.
 */
export function toMailConnectionInfo(raw: unknown): MailConnectionInfo | undefined {
	if (!raw || typeof raw !== 'object') {
		return undefined;
	}
	const record = raw as Record<string, unknown>;
	const id = typeof record.id === 'string' ? record.id.trim() : '';
	if (!id || (record.provider !== 'google' && record.provider !== 'microsoft')) {
		return undefined;
	}
	return {
		id,
		provider: record.provider,
		accountEmail: typeof record.accountEmail === 'string' ? record.accountEmail : null,
		accountLabel: typeof record.accountLabel === 'string' ? record.accountLabel : null,
		providerAccountId:
			typeof record.providerAccountId === 'string' ? record.providerAccountId : null,
		capabilities: Array.isArray(record.capabilities)
			? record.capabilities.filter((entry): entry is string => typeof entry === 'string')
			: [],
		status: typeof record.status === 'string' ? record.status : undefined,
	};
}

/** Mailbox address of a connected account, from its email or its label. */
export function connectionMailboxEmail(connection: MailConnectionInfo): string | undefined {
	return (
		emailFromAuthAccountLabel(connection.accountEmail ?? undefined)
		?? emailFromAuthAccountLabel(connection.accountLabel ?? undefined)
	);
}

/** True when a connection can still serve mailbox tokens. */
export function connectionServesMail(connection: MailConnectionInfo): boolean {
	return connection.status !== 'revoked' && (connection.capabilities ?? []).includes('mail');
}

/**
 * Connection a legacy OAuth row (no connection id) should adopt.
 *
 * Adopts only an unambiguous match: the one connection whose mailbox address is
 * the account's, or — when no connection reports an address — the single mail
 * connection of that provider. Anything else is ambiguous and the caller must
 * ask the user to reconnect rather than guess a mailbox.
 */
export function matchConnectionForLegacyAccount(
	mailboxEmail: string,
	connections: readonly MailConnectionInfo[],
): MailConnectionInfo | undefined {
	const usable = connections.filter(connectionServesMail);
	const target = mailboxEmail.trim().toLowerCase();
	const byEmail = usable.filter(connection => connectionMailboxEmail(connection) === target);
	if (byEmail.length === 1) {
		return byEmail[0];
	}
	if (byEmail.length > 1) {
		return undefined;
	}
	const unaddressed = usable.filter(connection => !connectionMailboxEmail(connection));
	return unaddressed.length === 1 && usable.length === 1 ? unaddressed[0] : undefined;
}

/** The connection lookup the migration needs (implemented by the connections bridge). */
export interface MailConnectionLister {
	list(provider: EmailOAuthProvider): Promise<MailConnectionInfo[]>;
}

/** What the migration did, for logging and tests. */
export interface LegacyConnectionMigrationResult {
	readonly adopted: number;
	readonly needsReconnect: number;
}

/**
 * Adopts service connections for OAuth mailboxes stored before connections
 * existed. An unambiguous match is written silently; anything else is flagged
 * for reconnect, since guessing would bind a mailbox to the wrong grant.
 *
 * Listing failures propagate: leaving a row legacy is recoverable, wrongly
 * flagging every mailbox on a transient error is not.
 */
export async function adoptConnectionIdsForLegacyAccounts(
	store: AccountStore,
	connections: MailConnectionLister,
	log: (msg: string) => void,
): Promise<LegacyConnectionMigrationResult> {
	const legacy: Array<{ account: EmailAccountConfig; provider: EmailOAuthProvider }> = [];
	for (const account of await store.listOAuthAccounts()) {
		const creds = await store.getCredentials(account.id);
		if (creds && isOAuthCredentials(creds) && !creds.connectionId) {
			legacy.push({ account, provider: creds.provider });
		}
	}
	if (legacy.length === 0) {
		return { adopted: 0, needsReconnect: 0 };
	}

	const listed = new Map<EmailOAuthProvider, MailConnectionInfo[]>();
	let adopted = 0;
	let needsReconnect = 0;
	for (const { account, provider } of legacy) {
		let candidates = listed.get(provider);
		if (!candidates) {
			candidates = await connections.list(provider);
			listed.set(provider, candidates);
		}
		const match = matchConnectionForLegacyAccount(account.email, candidates);
		if (!match) {
			log(`No unambiguous ${provider} connection for ${account.label} — needs reconnect`);
			await store.markAccountNeedsReconnect(account.id);
			needsReconnect++;
			continue;
		}
		await store.updateCredentials(account.id, {
			type: 'oauth',
			provider,
			connectionId: match.id,
		});
		log(`Adopted ${provider} connection ${match.id} for ${account.label}`);
		adopted++;
	}
	return { adopted, needsReconnect };
}

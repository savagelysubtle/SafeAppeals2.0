/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { EmailAccountConfig, EmailOAuthProvider } from './types';

/** Product identity provider (SafeAppeals Cloud). */
export const CLOUD_AUTH_PROVIDER_ID = 'safeappeals-cloud';

/** Google mailbox provider-token sessions (`accessToken` = Google XOAUTH2). */
export const GOOGLE_AUTH_PROVIDER_ID = 'safeappeals-google';

/** Microsoft mailbox provider-token sessions (not yet enabled in add-account UX). */
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

export function providerAuthIdForOAuth(provider: EmailOAuthProvider): string {
	return provider === 'microsoft' ? MICROSOFT_AUTH_PROVIDER_ID : GOOGLE_AUTH_PROVIDER_ID;
}

/**
 * True when a failed mail-scope mint was a wrong-Google-account reconsent.
 *
 * safeappeals-authentication already toasts this case, and the error crosses the
 * extension-host boundary as a plain object (so `instanceof` and `name` are unreliable);
 * match on the message instead and stay silent to avoid a duplicate toast.
 *
 * Cross-extension contract: the phrase below is the un-localized message thrown by
 * `ProviderScopeUserMismatchError` in safeappeals-authentication. Both sides must change
 * together, and neither may be localized.
 */
export function isProviderScopeUserMismatch(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error ?? '');
	return /did not match your SafeAppeals Cloud account/i.test(message);
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
 * was actually minted (binding amendment — do not store `{type:'oauth'}` on empty
 * mint, and never on a token whose grant lacks Gmail access).
 */
export function shouldPersistOAuthAccount({
	accessToken,
	scopes,
}: {
	accessToken?: string;
	scopes?: readonly string[];
}): boolean {
	return Boolean(accessToken) && sessionGrantsMailScope(scopes);
}

/**
 * The single mailbox address a Google OAuth account may use: the SafeAppeals Cloud
 * identity the provider token is minted for. Connecting a different Gmail is not
 * supported — the minted token only ever authenticates the Cloud Google account.
 */
export function boundMailboxEmail(
	cloudAccountLabel: string | undefined,
	googleAccountLabel?: string | undefined,
): string | undefined {
	return emailFromAuthAccountLabel(cloudAccountLabel)
		?? emailFromAuthAccountLabel(googleAccountLabel);
}

/**
 * True when the entered mailbox address matches the bound Cloud identity.
 * Unknown binding (no email in either label) cannot be enforced — allow it.
 */
export function isMailboxEmailBound(
	candidate: string,
	boundEmail: string | undefined,
): boolean {
	if (!boundEmail) {
		return true;
	}
	return candidate.trim().toLowerCase() === boundEmail.toLowerCase();
}

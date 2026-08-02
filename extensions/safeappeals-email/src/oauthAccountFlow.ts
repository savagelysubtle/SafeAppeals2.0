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
 * Gate for persisting an OAuth mailbox row: only after a mail-scoped access token
 * was actually minted (binding amendment — do not store `{type:'oauth'}` on empty mint).
 */
export function shouldPersistOAuthAccount({ accessToken }: { accessToken?: string }): boolean {
	return Boolean(accessToken);
}

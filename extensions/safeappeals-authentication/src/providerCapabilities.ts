/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { ConnectionCapability, ProviderKind } from './connectionsApi';

/**
 * Capability flags carried by a connection-minted provider session.
 *
 * Scope convention for `getSession` consumers:
 * - `['mail']` — Gmail / Exchange IMAP-SMTP XOAUTH2
 * - `['calendar']` — Google Calendar / Microsoft Graph calendars
 * - `['files']` — Google Drive or OneDrive / SharePoint / Teams libraries
 * - `['mail', 'calendar']` — both (Google only in one grant; Microsoft needs two)
 * - `['calendar', 'files']` — Microsoft Graph bundle
 * - `['messaging']` — Slack messaging (chat:write, channels, groups, im, etc.)
 * - `['messaging', 'files']` — Slack messaging + files
 * - `[]` (empty) — treated as mail for email-dashboard consumers
 *
 * Full provider scope URIs (e.g. `https://mail.google.com/`) are also recognized.
 */
export type ProviderCapability = ConnectionCapability;

const MAIL_SCOPE_MARKERS = new Set([
	'mail',
	'https://mail.google.com/',
	'https://mail.google.com',
	'https://www.googleapis.com/auth/gmail.modify',
	'https://www.googleapis.com/auth/gmail.readonly',
	'https://outlook.office.com/imap.accessasuser.all',
	'https://outlook.office.com/smtp.send',
]);

const CALENDAR_SCOPE_MARKERS = new Set([
	'calendar',
	'https://www.googleapis.com/auth/calendar',
	'https://www.googleapis.com/auth/calendar.events',
	'https://www.googleapis.com/auth/calendar.readonly',
	'https://graph.microsoft.com/calendars.readwrite',
]);

const FILES_SCOPE_MARKERS = new Set([
	'files',
	'https://www.googleapis.com/auth/drive',
	'https://www.googleapis.com/auth/drive.file',
	'https://www.googleapis.com/auth/drive.readonly',
	'https://graph.microsoft.com/files.readwrite.all',
	'https://graph.microsoft.com/files.read.all',
	'https://graph.microsoft.com/files.readwrite',
	'https://graph.microsoft.com/sites.readwrite.all',
	'https://graph.microsoft.com/sites.read.all',
	'https://graph.microsoft.com/team.readbasic.all',
	'https://graph.microsoft.com/channel.readbasic.all',
]);

const SLACK_MESSAGING_SCOPE_MARKERS = new Set([
	'messaging',
	'chat:write',
	'channels:',
	'groups:',
	'im:',
	'mpim:',
	'reactions:',
	'search:read',
]);

const SLACK_FILES_SCOPE_MARKERS = new Set([
	'files:read',
	'files:write',
	'remote_files',
]);

/**
 * Infers mail/calendar/files capabilities from VS Code authentication scopes.
 * Empty scopes default to mail (email consumers).
 */
export function inferProviderCapabilities(
	scopes: readonly string[] | undefined,
): ReadonlySet<ProviderCapability> {
	const capabilities = new Set<ProviderCapability>();
	if (!scopes || scopes.length === 0) {
		capabilities.add('mail');
		return capabilities;
	}
	for (const scope of scopes) {
		const normalized = scope.trim().toLowerCase();
		if (
			MAIL_SCOPE_MARKERS.has(normalized)
			|| normalized.includes('mail.google')
			|| normalized.includes('imap.accessasuser')
			|| normalized.includes('smtp.send')
		) {
			capabilities.add('mail');
		}
		if (CALENDAR_SCOPE_MARKERS.has(normalized) || normalized.includes('calendar')) {
			capabilities.add('calendar');
		}
		if (
			FILES_SCOPE_MARKERS.has(normalized)
			|| normalized.includes('/auth/drive')
			|| normalized.includes('files.read')
			|| normalized.includes('files.readwrite')
			|| normalized.includes('sites.read')
			|| normalized.includes('sites.readwrite')
			|| normalized.includes('team.readbasic')
			|| normalized.includes('channel.readbasic')
		) {
			capabilities.add('files');
		}
		if (
			SLACK_MESSAGING_SCOPE_MARKERS.has(normalized)
			|| normalized.includes('chat:write')
			|| normalized.includes('channels:')
			|| normalized.includes('groups:')
			|| normalized.includes('im:')
			|| normalized.includes('mpim:')
			|| normalized.includes('reactions:')
			|| normalized.includes('search:read')
		) {
			capabilities.add('messaging');
		}
		if (
			SLACK_FILES_SCOPE_MARKERS.has(normalized)
			|| normalized.includes('files:read')
			|| normalized.includes('files:write')
			|| normalized.includes('remote_files')
		) {
			capabilities.add('files');
		}
	}
	// Unknown scopes alone: do not invent capabilities (caller should fail createSession).
	return capabilities;
}

/**
 * Capabilities a minted token actually carries, parsed from the provider's
 * space-delimited `scope` grant.
 *
 * Returns `undefined` when the server reported no scope at all — callers then
 * have no evidence either way and fall back to the requested capabilities.
 */
export function capabilitiesFromGrantedScope(
	provider: ProviderKind,
	scope: string | undefined,
): ReadonlySet<ProviderCapability> | undefined {
	const granted = (scope ?? '').trim().toLowerCase();
	if (!granted) {
		return undefined;
	}
	const capabilities = new Set<ProviderCapability>();
	if (provider === 'google') {
		if (granted.includes('https://mail.google.com/') || granted.includes('mail.google')) {
			capabilities.add('mail');
		}
		if (granted.includes('/auth/calendar')) {
			capabilities.add('calendar');
		}
		if (granted.includes('/auth/drive') || granted.includes('googleapis.com/auth/drive')) {
			capabilities.add('files');
		}
		return capabilities;
	}
	if (granted.includes('imap.accessasuser.all') || granted.includes('smtp.send')) {
		capabilities.add('mail');
	}
	if (granted.includes('calendars.')) {
		capabilities.add('calendar');
	}
	if (
		granted.includes('files.read')
		|| granted.includes('files.readwrite')
		|| granted.includes('sites.read')
		|| granted.includes('sites.readwrite')
		|| granted.includes('team.readbasic')
		|| granted.includes('channel.readbasic')
	) {
		capabilities.add('files');
	}
	// Slack: messaging + files
	if (
		granted.includes('chat:write')
		|| granted.includes('channels:')
		|| granted.includes('groups:')
		|| granted.includes('im:')
		|| granted.includes('mpim:')
		|| granted.includes('reactions:')
		|| granted.includes('search:read')
	) {
		capabilities.add('messaging');
	}
	if (
		granted.includes('files:read')
		|| granted.includes('files:write')
		|| granted.includes('remote_files')
	) {
		capabilities.add('files');
	}
	return capabilities;
}

/**
 * Canonical `session.scopes` strings for a capability set.
 */
export function scopesForCapabilities(capabilities: Iterable<ProviderCapability>): string[] {
	const set = new Set(capabilities);
	const scopes: string[] = [];
	if (set.has('mail')) {
		scopes.push('mail');
	}
	if (set.has('calendar')) {
		scopes.push('calendar');
	}
	if (set.has('files')) {
		scopes.push('files');
	}
	if (set.has('messaging')) {
		scopes.push('messaging');
	}
	return scopes;
}

/**
 * Requested capabilities that the granted set does not cover.
 */
export function missingCapabilities(
	granted: ReadonlySet<ProviderCapability>,
	requested: Iterable<ProviderCapability>,
): ProviderCapability[] {
	const missing: ProviderCapability[] = [];
	for (const capability of requested) {
		if (!granted.has(capability)) {
			missing.push(capability);
		}
	}
	return missing;
}

/**
 * True when every requested capability is present in the granted set.
 * An empty request is never satisfied — the caller asked for nothing usable.
 */
export function sessionSatisfiesCapabilities(
	granted: ReadonlySet<ProviderCapability>,
	requested: ReadonlySet<ProviderCapability>,
): boolean {
	if (requested.size === 0) {
		return false;
	}
	return missingCapabilities(granted, requested).length === 0;
}

/**
 * A minted token lacks a capability the caller asked for — the grant is
 * identity-only (or calendar-only), so Gmail/IMAP would later fail with
 * `AUTHENTICATIONFAILED`.
 *
 * The message is intentionally un-localized: it is a control-flow signal, not
 * user-facing copy.
 */
export class ProviderTokenScopeError extends Error {
	constructor(readonly missing: readonly ProviderCapability[]) {
		super(`Provider token is missing ${missing.join(', ')} scope — reconnect to grant access.`);
		this.name = 'ProviderTokenScopeError';
	}
}

/**
 * Detects mint failures that require reconnecting the account rather than a retry.
 */
export function isReconnectRequiredError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}
	if (error instanceof ProviderTokenScopeError) {
		return true;
	}
	const message = error.message.toLowerCase();
	return (
		message.includes('(404)')
		|| message.includes(' 404')
		|| message.includes('not found')
		|| message.includes('reauth')
		|| message.includes('re-auth')
		|| message.includes('reconnect')
		|| message.includes('reconsent')
		|| message.includes('no provider')
		|| message.includes('provider token')
	);
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/*--------------------------------------------------------------------------------------
 *  Calendar access tokens — minted per service connection by safeappeals-authentication
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { connectionAccountLabel, type CalendarConnectionInfo } from './connectionsBridge';
import type { CalendarProvider } from './types';

/** Product identity provider (SafeAppeals Cloud) — owns the service connections. */
export const CLOUD_AUTH_PROVIDER_ID = 'safeappeals-cloud';

/** Google connection-mint sessions (`accessToken` = Google Calendar access token). */
export const GOOGLE_AUTH_PROVIDER_ID = 'safeappeals-google';

/** Microsoft connection-mint sessions (`accessToken` = Microsoft Graph access token). */
export const MICROSOFT_AUTH_PROVIDER_ID = 'safeappeals-microsoft';

/** Capability scope convention shared with the A3 providers. */
export const CALENDAR_AUTH_SCOPES = ['calendar'] as const;

/** Localize with a plain-string fallback so unit tests without `vscode.l10n` still run. */
function localize(message: string, ...args: Array<string | number | boolean>): string {
	const l10n = (vscode as { l10n?: { t: (m: string, ...a: Array<string | number | boolean>) => string } }).l10n;
	if (typeof l10n?.t === 'function') {
		return l10n.t(message, ...args);
	}
	return args.reduce<string>((acc, arg, index) => acc.replace(`{${index}}`, String(arg)), message);
}

/**
 * Session scope strings that grant calendar access. The A3 providers report the
 * `'calendar'` sentinel; full provider scope URIs are accepted for robustness.
 */
const CALENDAR_SCOPE_MARKERS =
	/^(calendar|https:\/\/www\.googleapis\.com\/auth\/calendar(\.[a-z]+)?|https:\/\/graph\.microsoft\.com\/calendars\.[a-z]+)$/i;

/** Secret keys written by the pre-connections loopback flow. */
const LEGACY_TOKEN_SECRET_KEYS: Record<CalendarProvider, string> = {
	google: 'safeappeals-calendar.google.tokens',
	outlook: 'safeappeals-calendar.outlook.tokens',
};

/**
 * Session as this extension consumes it. `id` is the service-connection id the
 * token was minted from (A3 contract), used to prove the token belongs to the
 * calendar this provider is synced against.
 */
export interface CalendarAuthSession {
	readonly id?: string;
	readonly accessToken?: string;
	readonly scopes?: readonly string[];
}

export interface CalendarAuthAccountFilter {
	readonly id: string;
	readonly label: string;
}

export type CalendarSessionGetter = (
	providerId: string,
	scopes: readonly string[],
	options: { createIfNone: boolean; account?: CalendarAuthAccountFilter },
) => Promise<CalendarAuthSession | undefined>;

/** Authentication provider that mints tokens for a calendar provider. */
export function authProviderIdFor(provider: CalendarProvider): string {
	return provider === 'outlook' ? MICROSOFT_AUTH_PROVIDER_ID : GOOGLE_AUTH_PROVIDER_ID;
}

/**
 * Connection id behind an authentication session.
 *
 * The `safeappeals-google` / `safeappeals-microsoft` providers are multi-account
 * and set `session.id` to the service-connection id (A3 contract).
 */
export function connectionIdFromSession(session: CalendarAuthSession | undefined): string | undefined {
	const id = session?.id?.trim();
	return id || undefined;
}

/**
 * True when a session actually carries calendar scope. Empty scopes count as
 * "no calendar" — the A3 providers treat those as mail-only.
 */
export function sessionGrantsCalendarScope(scopes: readonly string[] | undefined): boolean {
	return (scopes ?? []).some(scope => CALENDAR_SCOPE_MARKERS.test(scope.trim()));
}

/** The calendar is not linked to a service connection yet. */
export class CalendarNotConnectedError extends Error {
	constructor(readonly provider: CalendarProvider) {
		super(`${provider} calendar is not connected`);
		this.name = 'CalendarNotConnectedError';
	}
}

/** The connection exists but can no longer mint a calendar token. */
export class CalendarReconnectRequiredError extends Error {
	constructor(readonly provider: CalendarProvider) {
		super(`${provider} calendar needs to be reconnected`);
		this.name = 'CalendarReconnectRequiredError';
	}
}

export const defaultCalendarSessionGetter: CalendarSessionGetter = async (
	providerId,
	scopes,
	options,
) => {
	return vscode.authentication.getSession(providerId, [...scopes], {
		createIfNone: options.createIfNone,
		...(options.account ? { account: options.account } : {}),
	});
};

export interface CalendarTokenSourceDeps {
	/** Service connection a provider is currently synced against. */
	readonly connectionIdFor: (provider: CalendarProvider) => string | undefined;
	readonly getSession?: CalendarSessionGetter;
	readonly log?: (msg: string) => void;
}

/**
 * Mints short-lived calendar access tokens for the connected account of a
 * provider. Tokens are never persisted — the refresh token lives on void-cloud.
 */
export class CalendarTokenSource {
	private readonly getSession: CalendarSessionGetter;

	constructor(private readonly deps: CalendarTokenSourceDeps) {
		this.getSession = deps.getSession ?? defaultCalendarSessionGetter;
	}

	/**
	 * Access token for the provider's connected calendar.
	 *
	 * @throws {CalendarNotConnectedError} when no connection is stored.
	 * @throws {CalendarReconnectRequiredError} when the connection cannot mint.
	 */
	async getAccessToken(provider: CalendarProvider): Promise<string> {
		const connectionId = this.deps.connectionIdFor(provider);
		if (!connectionId) {
			throw new CalendarNotConnectedError(provider);
		}

		let session: CalendarAuthSession | undefined;
		try {
			session = await this.getSession(authProviderIdFor(provider), CALENDAR_AUTH_SCOPES, {
				createIfNone: false,
				account: { id: connectionId, label: connectionId },
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.deps.log?.(`${provider} calendar token mint failed: ${message}`);
			throw new CalendarReconnectRequiredError(provider);
		}

		if (!session?.accessToken) {
			this.deps.log?.(`${provider} calendar has no usable session for connection ${connectionId}`);
			throw new CalendarReconnectRequiredError(provider);
		}
		if (connectionIdFromSession(session) !== connectionId) {
			this.deps.log?.(
				`${provider} calendar token came from connection ${connectionIdFromSession(session)} but ${connectionId} is synced`,
			);
			throw new CalendarReconnectRequiredError(provider);
		}
		return session.accessToken;
	}
}

export interface ConnectCalendarDeps {
	/** Runs the browser connect flow (the connections bridge). */
	readonly connect: (provider: CalendarProvider, loginHint?: string) => Promise<CalendarConnectionInfo>;
	readonly getSession: CalendarSessionGetter;
	readonly log?: (msg: string) => void;
}

/**
 * Connects a calendar account and proves the connection can mint calendar
 * tokens before the caller stores it. A grant that only serves identity or mail
 * would otherwise look connected and fail on every sync.
 */
export async function connectCalendarAccount(
	provider: CalendarProvider,
	deps: ConnectCalendarDeps,
): Promise<CalendarConnectionInfo> {
	const connection = await deps.connect(provider);
	const session = await deps.getSession(authProviderIdFor(provider), CALENDAR_AUTH_SCOPES, {
		createIfNone: true,
		account: { id: connection.id, label: connectionAccountLabel(connection) },
	});

	if (!session?.accessToken || !sessionGrantsCalendarScope(session.scopes)) {
		deps.log?.(
			`${provider} calendar session unusable (token=${Boolean(session?.accessToken)}, scopes=${session?.scopes?.join(' ') || 'none'})`,
		);
		throw new Error(
			localize('Safe Appeals did not get calendar access for this account. Please try again.'),
		);
	}
	if (connectionIdFromSession(session) !== connection.id) {
		deps.log?.(
			`Calendar token came from connection ${connectionIdFromSession(session)} but ${connection.id} was connected`,
		);
		throw new Error(
			localize('The calendar token did not match the account you connected. Please try again.'),
		);
	}
	return connection;
}

/**
 * Signs in to SafeAppeals Cloud, which owns the service connections.
 */
export async function ensureCloudSession(log: (msg: string) => void): Promise<boolean> {
	try {
		const session = await vscode.authentication.getSession(CLOUD_AUTH_PROVIDER_ID, [], {
			createIfNone: true,
		});
		if (!session) {
			void vscode.window.showErrorMessage(
				localize('Sign in to SafeAppeals Cloud was cancelled.'),
			);
			return false;
		}
		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`Cloud session for calendar connect failed: ${message}`);
		void vscode.window.showErrorMessage(
			localize('Could not sign in to SafeAppeals Cloud: {0}', message),
		);
		return false;
	}
}

/**
 * True when this machine still holds OAuth tokens from the retired loopback
 * flow. They are never migrated — the grants they came from are unknown to
 * void-cloud, so the user has to reconnect.
 */
export async function hasLegacyCalendarTokens(secrets: vscode.SecretStorage): Promise<boolean> {
	for (const key of Object.values(LEGACY_TOKEN_SECRET_KEYS)) {
		if (await secrets.get(key)) {
			return true;
		}
	}
	return false;
}

/**
 * Deletes the retired loopback tokens. Called once the calendar is served by a
 * service connection, so the stale refresh tokens stop sitting in the keyring.
 */
export async function clearLegacyCalendarTokens(
	secrets: vscode.SecretStorage,
	log?: (msg: string) => void,
): Promise<void> {
	for (const key of Object.values(LEGACY_TOKEN_SECRET_KEYS)) {
		try {
			await secrets.delete(key);
		} catch (err) {
			log?.(`Failed to delete legacy secret ${key}: ${err instanceof Error ? err.message : String(err)}`);
		}
	}
}

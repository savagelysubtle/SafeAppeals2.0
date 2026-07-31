/*--------------------------------------------------------------------------------------
 *  Configuration helpers — settings + env (same surface as the old fork)
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { CalendarProvider } from './types';

function cfg(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration('safeappealsCalendar');
}

export function getEnabledProviders(): CalendarProvider[] {
	const raw = cfg().get<string[]>('enabledProviders', ['google', 'outlook']);
	return raw.filter((p): p is CalendarProvider => p === 'google' || p === 'outlook');
}

export function getSyncIntervalMinutes(): number {
	const n = cfg().get<number>('syncIntervalMinutes', 15);
	return Math.max(1, n || 15);
}

export function getGoogleClientId(): string {
	return (
		cfg().get<string>('google.clientId', '') ||
		process.env.GOOGLE_CALENDAR_CLIENT_ID ||
		''
	).trim();
}

/**
 * Optional — Desktop OAuth clients use PKCE and do not require a secret.
 * Kept for backward compatibility with older Web/Installed clients.
 */
export function getGoogleClientSecret(): string {
	return (
		cfg().get<string>('google.clientSecret', '') ||
		process.env.GOOGLE_CALENDAR_CLIENT_SECRET ||
		''
	).trim();
}

export function getGoogleCalendarId(): string {
	return (cfg().get<string>('google.calendarId', 'primary') || 'primary').trim();
}

export function getOutlookClientId(): string {
	return (
		cfg().get<string>('outlook.clientId', '') ||
		process.env.OUTLOOK_CLIENT_ID ||
		''
	).trim();
}

export function getOutlookTenantId(): string {
	return (
		cfg().get<string>('outlook.tenantId', 'common') ||
		process.env.OUTLOOK_TENANT_ID ||
		'common'
	).trim();
}

export function getOutlookCalendarId(): string {
	return (cfg().get<string>('outlook.calendarId', 'primary') || 'primary').trim();
}

export function isGoogleConfigured(): boolean {
	return !!getGoogleClientId();
}

export function isOutlookConfigured(): boolean {
	return !!getOutlookClientId();
}

export function isProviderConfigured(provider: CalendarProvider): boolean {
	return provider === 'google' ? isGoogleConfigured() : isOutlookConfigured();
}

/**
 * True when the workbench UI is a browser client (serve-web / vscode.dev).
 * Browser SecretStorage is in-memory only — credentials cannot be stored securely,
 * so connect flows must be gated even though this workspace extension still runs
 * in a Node extension host.
 */
export function isWebClient(): boolean {
	return vscode.env.uiKind === vscode.UIKind.Web;
}

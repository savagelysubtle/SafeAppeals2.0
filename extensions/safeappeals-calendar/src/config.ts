/*--------------------------------------------------------------------------------------
 *  Configuration helpers — settings + env (same surface as the old fork)
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { CalendarProvider } from './types';

const AUTH_CALLBACK_PORT = 47294;
const AUTH_CALLBACK_PATH = '/auth/callback';

export function getLoopbackRedirectUri(): string {
	return `http://127.0.0.1:${AUTH_CALLBACK_PORT}${AUTH_CALLBACK_PATH}`;
}

export function getAuthCallbackPort(): number {
	return AUTH_CALLBACK_PORT;
}

export function getAuthCallbackPath(): string {
	return AUTH_CALLBACK_PATH;
}

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
	return !!(getGoogleClientId() && getGoogleClientSecret());
}

export function isOutlookConfigured(): boolean {
	return !!getOutlookClientId();
}

export function isProviderConfigured(provider: CalendarProvider): boolean {
	return provider === 'google' ? isGoogleConfigured() : isOutlookConfigured();
}

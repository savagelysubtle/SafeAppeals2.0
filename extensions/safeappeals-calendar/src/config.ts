/*--------------------------------------------------------------------------------------
 *  Configuration helpers — sync behaviour settings (OAuth client config is server-side)
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

export function getGoogleCalendarId(): string {
	return (cfg().get<string>('google.calendarId', 'primary') || 'primary').trim();
}

export function getOutlookCalendarId(): string {
	return (cfg().get<string>('outlook.calendarId', 'primary') || 'primary').trim();
}

/**
 * True when the workbench UI is a browser client (serve-web / vscode.dev).
 * Browser SecretStorage is in-memory only, so the local event cache cannot be
 * encrypted at rest and connecting a calendar there would sync into nothing.
 */
export function isWebClient(): boolean {
	return vscode.env.uiKind === vscode.UIKind.Web;
}

/*--------------------------------------------------------------------------------------
 *  Configuration helpers — safeappealsEmail.* settings
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { EmailAccountConfig } from './types';

function cfg(): vscode.WorkspaceConfiguration {
	return vscode.workspace.getConfiguration('safeappealsEmail');
}

export function getSyncIntervalMinutes(): number {
	const n = cfg().get<number>('syncIntervalMinutes', 15);
	return Math.max(1, n || 15);
}

export function getDefaultFolder(): string {
	return (cfg().get<string>('defaultFolder', 'INBOX') || 'INBOX').trim();
}

export function getMaxMessagesPerSync(): number {
	const n = cfg().get<number>('maxMessagesPerSync', 100);
	return Math.min(500, Math.max(10, n || 100));
}

export function getConfiguredAccounts(): EmailAccountConfig[] {
	const raw = cfg().get<EmailAccountConfig[]>('accounts', []) || [];
	return raw.filter((a) => a && typeof a.id === 'string' && a.imapHost && a.username);
}

export async function setConfiguredAccounts(accounts: EmailAccountConfig[]): Promise<void> {
	await cfg().update('accounts', accounts, vscode.ConfigurationTarget.Global);
}

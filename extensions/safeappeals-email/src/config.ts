/*--------------------------------------------------------------------------------------
 *  Configuration helpers — safeappealsEmail.* settings
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { EmailAccountConfig } from './types';

export interface ComposeSettings {
	header: string;
	signature: string;
	/** Per-case (workspace-scoped); empty when no case is open */
	autoCc: string;
	/** Per-case (workspace-scoped); empty when no case is open */
	autoBcc: string;
	/** True when a workspace folder is open (case-scoped fields are writable) */
	hasCase: boolean;
}

export interface SyncSettings {
	syncIntervalMinutes: number;
	defaultFolder: string;
	maxMessagesPerSync: number;
}

export interface EmailSettingsPayload {
	compose: ComposeSettings;
	sync: SyncSettings;
}

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

/** First workspace folder = the open case; undefined when no workspace is open. */
export function getCurrentCase(): { caseFolderPath: string; caseName: string } | undefined {
	const folder = vscode.workspace.workspaceFolders?.[0];
	if (!folder) {
		return undefined;
	}
	return { caseFolderPath: folder.uri.fsPath, caseName: folder.name };
}

export function getConfiguredAccounts(): EmailAccountConfig[] {
	const raw = cfg().get<EmailAccountConfig[]>('accounts', []) || [];
	return raw.filter((a) => a && typeof a.id === 'string' && a.imapHost && a.username);
}

export async function setConfiguredAccounts(accounts: EmailAccountConfig[]): Promise<void> {
	await cfg().update('accounts', accounts, vscode.ConfigurationTarget.Global);
}

export function getComposeSettings(): ComposeSettings {
	const hasCase = !!vscode.workspace.workspaceFolders?.[0];
	return {
		header: (cfg().get<string>('compose.header', '') || '').trimEnd(),
		signature: (cfg().get<string>('compose.signature', '') || '').trimEnd(),
		autoCc: hasCase ? (cfg().get<string>('compose.autoCc', '') || '').trim() : '',
		autoBcc: hasCase ? (cfg().get<string>('compose.autoBcc', '') || '').trim() : '',
		hasCase,
	};
}

export function getSyncSettings(): SyncSettings {
	return {
		syncIntervalMinutes: getSyncIntervalMinutes(),
		defaultFolder: getDefaultFolder(),
		maxMessagesPerSync: getMaxMessagesPerSync(),
	};
}

export function getEmailSettings(): EmailSettingsPayload {
	return { compose: getComposeSettings(), sync: getSyncSettings() };
}

export interface UpdateEmailSettingsInput {
	header?: string;
	signature?: string;
	autoCc?: string;
	autoBcc?: string;
	syncIntervalMinutes?: number;
	defaultFolder?: string;
	maxMessagesPerSync?: number;
}

/**
 * Writes settings to the correct ConfigurationTarget.
 * Header/signature/sync → Global. autoCc/autoBcc → Workspace (skipped if no case).
 */
export async function updateEmailSettings(input: UpdateEmailSettingsInput): Promise<void> {
	const c = cfg();
	const hasCase = !!vscode.workspace.workspaceFolders?.[0];
	const writes: Thenable<void>[] = [];

	if (typeof input.header === 'string') {
		writes.push(c.update('compose.header', input.header, vscode.ConfigurationTarget.Global));
	}
	if (typeof input.signature === 'string') {
		writes.push(c.update('compose.signature', input.signature, vscode.ConfigurationTarget.Global));
	}
	if (hasCase) {
		if (typeof input.autoCc === 'string') {
			writes.push(c.update('compose.autoCc', input.autoCc, vscode.ConfigurationTarget.Workspace));
		}
		if (typeof input.autoBcc === 'string') {
			writes.push(c.update('compose.autoBcc', input.autoBcc, vscode.ConfigurationTarget.Workspace));
		}
	}
	if (typeof input.syncIntervalMinutes === 'number') {
		writes.push(
			c.update(
				'syncIntervalMinutes',
				Math.max(1, Math.round(input.syncIntervalMinutes) || 15),
				vscode.ConfigurationTarget.Global,
			),
		);
	}
	if (typeof input.defaultFolder === 'string') {
		writes.push(
			c.update(
				'defaultFolder',
				input.defaultFolder.trim() || 'INBOX',
				vscode.ConfigurationTarget.Global,
			),
		);
	}
	if (typeof input.maxMessagesPerSync === 'number') {
		writes.push(
			c.update(
				'maxMessagesPerSync',
				Math.min(500, Math.max(10, Math.round(input.maxMessagesPerSync) || 100)),
				vscode.ConfigurationTarget.Global,
			),
		);
	}

	await Promise.all(writes);
}

/** Build compose body with optional header/signature around an optional body. */
export function applyComposeDefaults(
	body: string,
	compose: ComposeSettings,
): { content: string; cc: string; bcc: string } {
	const parts: string[] = [];
	if (compose.header.trim()) {
		parts.push(compose.header.trim());
	}
	if (body.trim()) {
		parts.push(body.trim());
	} else if (compose.header.trim() || compose.signature.trim()) {
		parts.push('');
	}
	if (compose.signature.trim()) {
		parts.push(compose.signature.trim());
	}
	return {
		content: parts.join('\n\n'),
		cc: compose.autoCc,
		bcc: compose.autoBcc,
	};
}

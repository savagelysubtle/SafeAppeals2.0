/*--------------------------------------------------------------------------------------
 *  Configuration helpers — safeappealsEmail.* settings
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { EmailAccountConfig } from './types';
import { clearLegacySettingAtAllScopes, legacyString, legacyValue } from './legacyConfigMigration';

const COMPOSE_SECRET_KEY = 'safeappeals-email.composeSettings';
let composeSecrets: Pick<ComposeSettings, 'header' | 'signature' | 'autoCc' | 'autoBcc'> = {
	header: '', signature: '', autoCc: '', autoBcc: '',
};
let composeSecretStorage: vscode.SecretStorage | undefined;

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
	const raw = legacyValue<EmailAccountConfig[]>(cfg(), 'accounts') || [];
	return raw.filter((a) => a && typeof a.id === 'string' && a.imapHost && a.username);
}

export async function setConfiguredAccounts(accounts: EmailAccountConfig[]): Promise<void> {
	if (accounts.length > 0) {
		throw new Error('Account metadata must be stored in encrypted storage.');
	}
	const failures = await clearLegacySettingAtAllScopes(cfg(), 'accounts');
	if (failures.length > 0) {
		void vscode.window.showWarningMessage(vscode.l10n.t(
			'Some legacy email account settings could not be removed. Safe Appeals will retry when Email starts again.',
		));
	}
}

/** Migrate confidential compose defaults out of plaintext settings into SecretStorage. */
export async function initializeSecureEmailConfig(secrets: vscode.SecretStorage): Promise<void> {
	composeSecretStorage = secrets;
	const stored = await secrets.get(COMPOSE_SECRET_KEY);
	if (stored) {
		const parsed = JSON.parse(stored) as Partial<typeof composeSecrets>;
		composeSecrets = {
			header: typeof parsed.header === 'string' ? parsed.header : '',
			signature: typeof parsed.signature === 'string' ? parsed.signature : '',
			autoCc: typeof parsed.autoCc === 'string' ? parsed.autoCc : '',
			autoBcc: typeof parsed.autoBcc === 'string' ? parsed.autoBcc : '',
		};
	} else {
		composeSecrets = {
			header: legacyString(cfg(), 'compose.header'),
			signature: legacyString(cfg(), 'compose.signature'),
			autoCc: legacyString(cfg(), 'compose.autoCc'),
			autoBcc: legacyString(cfg(), 'compose.autoBcc'),
		};
		if (Object.values(composeSecrets).some(Boolean)) {
			await secrets.store(COMPOSE_SECRET_KEY, JSON.stringify(composeSecrets));
		}
	}
	const cleanupResults = await Promise.all([
		clearLegacySettingAtAllScopes(cfg(), 'compose.header'),
		clearLegacySettingAtAllScopes(cfg(), 'compose.signature'),
		clearLegacySettingAtAllScopes(cfg(), 'compose.autoCc'),
		clearLegacySettingAtAllScopes(cfg(), 'compose.autoBcc'),
	]);
	if (cleanupResults.some(failures => failures.length > 0)) {
		void vscode.window.showWarningMessage(vscode.l10n.t(
			'Some legacy email compose settings could not be removed. Safe Appeals will retry when Email starts again.',
		));
	}
}

/**
 * True when the workbench UI is a browser client (serve-web / vscode.dev).
 * Browser SecretStorage is in-memory only — credentials cannot be stored securely,
 * so account-creation flows must be gated even though this workspace extension
 * still runs in a Node extension host.
 */
export function isWebClient(): boolean {
	return vscode.env.uiKind === vscode.UIKind.Web;
}

export function getComposeSettings(): ComposeSettings {
	const hasCase = !!vscode.workspace.workspaceFolders?.[0];
	return {
		header: composeSecrets.header.trimEnd(),
		signature: composeSecrets.signature.trimEnd(),
		autoCc: hasCase ? composeSecrets.autoCc.trim() : '',
		autoBcc: hasCase ? composeSecrets.autoBcc.trim() : '',
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

	if (typeof input.header === 'string') composeSecrets.header = input.header;
	if (typeof input.signature === 'string') composeSecrets.signature = input.signature;
	if (hasCase) {
		if (typeof input.autoCc === 'string') composeSecrets.autoCc = input.autoCc;
		if (typeof input.autoBcc === 'string') composeSecrets.autoBcc = input.autoBcc;
	}
	if (composeSecretStorage) writes.push(composeSecretStorage.store(COMPOSE_SECRET_KEY, JSON.stringify(composeSecrets)));
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

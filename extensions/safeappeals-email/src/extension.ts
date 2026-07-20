/*--------------------------------------------------------------------------------------
 *  Safe Appeals Email — IMAP/SMTP + dashboard + .eml viewer in the extension host
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { AccountStore } from './accountStore';
import { getDefaultFolder, getSyncIntervalMinutes } from './config';
import { DashboardPanel, EmailSidebarProvider } from './dashboardPanel';
import { EmailIndex } from './emailIndex';
import { EmlEditorProvider } from './emlEditorProvider';
import { parseEmlFile } from './emlParser';
import { diagnoseConnection } from './imapClient';
import { SyncEngine } from './syncEngine';
import type {
	DraftStatus,
	EmailAccountConfig,
	EmailAccountCredentials,
	EmailClassification,
	ListThreadsQuery,
	SendMailRequest,
	ThreadStatus,
} from './types';

let output: vscode.OutputChannel;
let statusBar: vscode.StatusBarItem;
let engine: SyncEngine;
let index: EmailIndex;
let accounts: AccountStore;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	output = vscode.window.createOutputChannel('Safe Appeals Email');
	const log = (msg: string) => {
		const line = `[${new Date().toISOString()}] ${msg}`;
		output.appendLine(line);
		console.log(`[safeappeals-email] ${msg}`);
	};

	log('Activating…');

	accounts = new AccountStore(context.secrets, log);
	index = new EmailIndex(context.globalStorageUri);
	await index.initialize();

	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 49);
	statusBar.command = 'safeappeals-email.syncStatus';
	statusBar.tooltip = 'Safe Appeals Email';
	statusBar.show();

	const refreshStatusBar = async () => {
		try {
			const status = await engine.getStatus();
			if (status.syncing) {
				statusBar.text = '$(sync~spin) Email';
				return;
			}
			const n = status.accounts.reduce((sum, a) => sum + a.messageCount, 0);
			statusBar.text = status.accounts.length
				? `$(mail) ${status.accounts.length} acct · ${n}`
				: '$(mail) Email';
		} catch {
			statusBar.text = '$(mail) Email';
		}
	};

	engine = new SyncEngine(accounts, index, log, () => {
		void refreshStatusBar();
	});

	const refreshUi = () => {
		void refreshStatusBar();
		void DashboardPanel.refreshIfOpen();
	};

	const openDashboard = () => {
		DashboardPanel.show(context.extensionUri, engine, accounts, index, log, refreshUi);
	};

	context.subscriptions.push(
		output,
		statusBar,
		engine,
		EmlEditorProvider.register(context, index, log),
		vscode.window.registerWebviewViewProvider(
			EmailSidebarProvider.viewType,
			new EmailSidebarProvider(openDashboard),
		),

		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('safeappealsEmail.syncIntervalMinutes')) {
				log(`Sync interval → ${getSyncIntervalMinutes()} min; restarting timer`);
				engine.startBackgroundSync();
			}
		}),
	);

	registerCommands(context, log, openDashboard, refreshUi);
	await refreshStatusBar();
	engine.startBackgroundSync();
	log('Activated');
}

export function deactivate(): void {
	engine?.dispose();
}

function registerCommands(
	context: vscode.ExtensionContext,
	log: (msg: string) => void,
	openDashboard: () => void,
	refreshUi: () => void,
): void {
	const regs: vscode.Disposable[] = [
		vscode.commands.registerCommand('safeappeals-email.openDashboard', () => {
			openDashboard();
		}),

		vscode.commands.registerCommand('safeappeals-email.addAccount', async () => {
			const account = await promptAddAccount(log);
			if (!account) {
				return undefined;
			}
			log(`Account added: ${account.label}`);
			refreshUi();
			await engine.syncAll(account.id);
			return account;
		}),

		vscode.commands.registerCommand('safeappeals-email.removeAccount', async (accountIdArg?: string) => {
			const accountId = accountIdArg || (await pickAccountId('Remove which account?'));
			if (!accountId) {
				return { success: false };
			}
			const account = accounts.getAccount(accountId);
			const label = account?.label || accountId;
			const confirm = await vscode.window.showWarningMessage(
				`Remove email account “${label}”? Cached messages for this account will be deleted.`,
				{ modal: true },
				'Remove',
			);
			if (confirm !== 'Remove') {
				return { success: false };
			}
			await index.clearAccount(accountId);
			const ok = await accounts.removeAccount(accountId);
			log(`Account removed: ${accountId}`);
			refreshUi();
			return { success: ok };
		}),

		vscode.commands.registerCommand(
			'safeappeals-email.updatePassword',
			async (accountIdArg?: string) => {
				const accountId = accountIdArg || (await pickAccountId('Update password for which account?'));
				if (!accountId) {
					return { success: false };
				}
				const account = accounts.getAccount(accountId);
				if (!account) {
					void vscode.window.showErrorMessage('Account not found.');
					return { success: false };
				}
				const ok = await promptUpdatePassword(account, log);
				if (ok) {
					refreshUi();
					await engine.syncAll(account.id);
				}
				return { success: ok };
			},
		),

		vscode.commands.registerCommand('safeappeals-email.listAccounts', () => {
			return accounts.listAccounts();
		}),

		vscode.commands.registerCommand('safeappeals-email.syncNow', async (accountId?: string) => {
			return vscode.window.withProgress(
				{
					location: vscode.ProgressLocation.Notification,
					title: 'Syncing email…',
					cancellable: false,
				},
				async () => engine.syncAll(accountId),
			);
		}),

		vscode.commands.registerCommand('safeappeals-email.syncStatus', async () => {
			const status = await engine.getStatus();
			const lines = status.accounts.map(
				(a) =>
					`${a.label}: ${a.messageCount} msgs, last sync ${a.lastSync || 'never'}${a.error ? ` (${a.error})` : ''}`,
			);
			const summary = lines.length
				? lines.join('\n')
				: 'No accounts. Run “Safe Appeals Email: Add Email Account”.';
			output.show(true);
			log(`Status:\n${summary}`);
			void vscode.window.showInformationMessage(
				status.accounts.length
					? `Email: ${status.accounts.length} account(s), interval ${status.syncIntervalMinutes}m`
					: 'Email: no accounts configured',
			);
			return status;
		}),

		vscode.commands.registerCommand(
			'safeappeals-email.diagnoseConnection',
			async (accountIdArg?: string) => {
				const accountId = accountIdArg || (await pickAccountId('Diagnose which account?'));
				if (!accountId) {
					return undefined;
				}
				output.show(true);
				try {
					const result = await engine.diagnoseAccount(accountId);
					if (result.ok) {
						const detail =
							result.exists === 0
								? 'Mailbox empty (exists=0).'
								: `exists=${result.exists}, fetched newest header uid=${result.sampleUid}, subject=${result.sampleSubject}`;
						void vscode.window.showInformationMessage(
							`Email diagnose OK: ${detail} (see Output: Safe Appeals Email)`,
						);
					} else {
						void vscode.window.showErrorMessage(
							`Email diagnose FAILED: ${result.error || 'unknown error'} (see Output: Safe Appeals Email)`,
						);
					}
					return result;
				} catch (err) {
					const message = err instanceof Error ? err.message : String(err);
					const stack = err instanceof Error ? err.stack : undefined;
					log(`diagnoseConnection command error: ${message}`);
					if (stack) {
						log(stack);
					}
					void vscode.window.showErrorMessage(
						`Email diagnose FAILED: ${message} (see Output: Safe Appeals Email)`,
					);
					return { ok: false, error: message, stack };
				}
			},
		),

		vscode.commands.registerCommand('safeappeals-email.listFolders', async (accountId?: string) => {
			const id = accountId || (await pickAccountId('List folders for which account?'));
			if (!id) {
				return [];
			}
			return engine.listFolders(id);
		}),

		vscode.commands.registerCommand(
			'safeappeals-email.listThreads',
			(query?: ListThreadsQuery) => engine.listThreads(query || {}),
		),

		vscode.commands.registerCommand('safeappeals-email.getThread', (threadId: string) => {
			if (!threadId) {
				throw new Error('threadId required');
			}
			return engine.getThread(threadId);
		}),

		vscode.commands.registerCommand(
			'safeappeals-email.getMessage',
			async (messageId: string) => {
				if (!messageId) {
					throw new Error('messageId required');
				}
				return engine.getMessage(messageId);
			},
		),

		vscode.commands.registerCommand(
			'safeappeals-email.send',
			async (request?: SendMailRequest) => {
				const req = request || (await promptSend());
				if (!req) {
					return undefined;
				}
				return engine.send(req);
			},
		),

		vscode.commands.registerCommand(
			'safeappeals-email.saveDraft',
			async (draft?: Parameters<EmailIndex['saveDraft']>[0]) => {
				if (!draft) {
					throw new Error('draft payload required');
				}
				return index.saveDraft(draft);
			},
		),

		vscode.commands.registerCommand(
			'safeappeals-email.listDrafts',
			(accountId?: string) => index.listDrafts(accountId),
		),

		vscode.commands.registerCommand('safeappeals-email.getDraft', (draftId: string) => {
			return index.getDraft(draftId) ?? index.getLatestDraftForEmail(draftId) ?? null;
		}),

		vscode.commands.registerCommand(
			'safeappeals-email.updateDraftStatus',
			async (draftId: string, status: DraftStatus) => {
				await index.updateDraftStatus(draftId, status);
				return { success: true };
			},
		),

		vscode.commands.registerCommand(
			'safeappeals-email.parseEml',
			async (filePath?: string, caseFolderPath?: string) => {
				let path = filePath;
				if (!path) {
					const uris = await vscode.window.showOpenDialog({
						canSelectMany: false,
						filters: { Email: ['eml'] },
					});
					path = uris?.[0]?.fsPath;
				}
				if (!path) {
					return undefined;
				}
				const id = index.generateEmailId(path);
				const msg = await parseEmlFile(path, {
					id,
					accountId: 'local',
					caseFolderPath,
				});
				await index.upsertMessage(msg);
				return msg;
			},
		),

		vscode.commands.registerCommand(
			'safeappeals-email.searchEmails',
			(query: string, accountId?: string) => index.search(query || '', accountId),
		),

		vscode.commands.registerCommand(
			'safeappeals-email.toggleStar',
			async (messageId: string) => index.toggleStar(messageId),
		),

		vscode.commands.registerCommand(
			'safeappeals-email.updateClassification',
			async (messageId: string, classification: EmailClassification) => {
				// Seam for rung 12 classifier + manual overrides
				await index.updateClassification(messageId, classification);
				return { success: true };
			},
		),

		vscode.commands.registerCommand(
			'safeappeals-email.getUnclassifiedEmails',
			(limit?: number) => index.getUnclassified(limit),
		),

		vscode.commands.registerCommand('safeappeals-email.getStats', () => index.getStats()),

		vscode.commands.registerCommand(
			'safeappeals-email.updateThreadStatus',
			async (threadId: string, status: ThreadStatus) => {
				await index.updateThreadStatus(threadId, status);
				return { success: true };
			},
		),
	];

	context.subscriptions.push(...regs);
}

async function pickAccountId(placeHolder: string): Promise<string | undefined> {
	const list = accounts.listAccounts();
	if (list.length === 0) {
		void vscode.window.showWarningMessage('No email accounts configured.');
		return undefined;
	}
	const pick = await vscode.window.showQuickPick(
		list.map((a) => ({ label: a.label, description: a.email, id: a.id })),
		{ placeHolder },
	);
	return pick?.id;
}

async function promptAddAccount(
	log: (msg: string) => void,
): Promise<EmailAccountConfig | undefined> {
	const email = await vscode.window.showInputBox({
		prompt: 'Email address',
		placeHolder: 'you@example.com',
		ignoreFocusOut: true,
	});
	if (!email) {
		return undefined;
	}

	const imapHost = await vscode.window.showInputBox({
		prompt: 'IMAP host',
		placeHolder: 'imap.example.com',
		value: guessImapHost(email),
		ignoreFocusOut: true,
	});
	if (!imapHost) {
		return undefined;
	}

	const imapPortStr = await vscode.window.showInputBox({
		prompt: 'IMAP port',
		value: '993',
		ignoreFocusOut: true,
	});
	if (!imapPortStr) {
		return undefined;
	}

	const smtpHost = await vscode.window.showInputBox({
		prompt: 'SMTP host',
		placeHolder: 'smtp.example.com',
		value: guessSmtpHost(email),
		ignoreFocusOut: true,
	});
	if (!smtpHost) {
		return undefined;
	}

	const smtpPortStr = await vscode.window.showInputBox({
		prompt: 'SMTP port (465 SSL / 587 STARTTLS)',
		value: '465',
		ignoreFocusOut: true,
	});
	if (!smtpPortStr) {
		return undefined;
	}

	const username = await vscode.window.showInputBox({
		prompt: 'Username (usually full email)',
		value: email,
		ignoreFocusOut: true,
	});
	if (!username) {
		return undefined;
	}

	let password = await vscode.window.showInputBox({
		prompt: 'Password / app password (stored in SecretStorage, not settings)',
		password: true,
		ignoreFocusOut: true,
	});
	if (password === undefined) {
		return undefined;
	}

	const imapPort = Number(imapPortStr) || 993;
	const smtpPort = Number(smtpPortStr) || 465;
	const config = {
		label: email,
		email,
		imapHost,
		imapPort,
		imapSecure: imapPort === 993,
		smtpHost,
		smtpPort,
		smtpSecure: smtpPort === 465,
		username,
	};
	const candidate: EmailAccountConfig = { id: 'pending', ...config };
	const folder = getDefaultFolder();

	for (;;) {
		const creds: EmailAccountCredentials = { password };
		const result = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Verifying IMAP connection…',
				cancellable: false,
			},
			async () => diagnoseConnection(candidate, creds, folder, log),
		);

		if (result.ok) {
			const account = await accounts.addAccount(config, creds);
			void vscode.window.showInformationMessage(
				`Connected — ${result.exists} messages in ${result.folder || folder}`,
			);
			return account;
		}

		const choice = await vscode.window.showErrorMessage(
			`IMAP connection failed: ${result.error || 'unknown error'}`,
			'Retry password',
			'Save anyway',
		);
		if (choice === 'Retry password') {
			const retry = await vscode.window.showInputBox({
				prompt: 'Password / app password',
				password: true,
				ignoreFocusOut: true,
			});
			if (retry === undefined) {
				return undefined;
			}
			password = retry;
			continue;
		}
		if (choice === 'Save anyway') {
			const account = await accounts.addAccount(config, creds);
			void vscode.window.showWarningMessage(
				`Account saved without a successful IMAP check: ${account.label}`,
			);
			return account;
		}
		return undefined;
	}
}

async function promptUpdatePassword(
	account: EmailAccountConfig,
	log: (msg: string) => void,
): Promise<boolean> {
	const folder = getDefaultFolder();
	let password = await vscode.window.showInputBox({
		prompt: `New password for ${account.label}`,
		password: true,
		ignoreFocusOut: true,
	});
	if (password === undefined) {
		return false;
	}

	for (;;) {
		const creds: EmailAccountCredentials = { password };
		const result = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: 'Verifying IMAP connection…',
				cancellable: false,
			},
			async () => diagnoseConnection(account, creds, folder, log),
		);

		if (result.ok) {
			await accounts.updateCredentials(account.id, creds);
			void vscode.window.showInformationMessage(
				`Password updated — ${result.exists} messages in ${result.folder || folder}`,
			);
			log(`Password updated for ${account.label}`);
			return true;
		}

		const choice = await vscode.window.showErrorMessage(
			`IMAP connection failed: ${result.error || 'unknown error'}`,
			'Retry password',
		);
		if (choice !== 'Retry password') {
			return false;
		}
		const retry = await vscode.window.showInputBox({
			prompt: `New password for ${account.label}`,
			password: true,
			ignoreFocusOut: true,
		});
		if (retry === undefined) {
			return false;
		}
		password = retry;
	}
}

async function promptSend(): Promise<SendMailRequest | undefined> {
	const accountId = await pickAccountId('Send from which account?');
	if (!accountId) {
		return undefined;
	}
	const to = await vscode.window.showInputBox({ prompt: 'To', ignoreFocusOut: true });
	if (!to) {
		return undefined;
	}
	const subject = await vscode.window.showInputBox({ prompt: 'Subject', ignoreFocusOut: true });
	if (subject === undefined) {
		return undefined;
	}
	const text = await vscode.window.showInputBox({ prompt: 'Body', ignoreFocusOut: true });
	if (text === undefined) {
		return undefined;
	}
	return { accountId, to, subject, text };
}

function guessImapHost(email: string): string {
	const domain = email.split('@')[1]?.toLowerCase() || '';
	if (domain.includes('gmail')) {
		return 'imap.gmail.com';
	}
	if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live')) {
		return 'outlook.office365.com';
	}
	return `imap.${domain}`;
}

function guessSmtpHost(email: string): string {
	const domain = email.split('@')[1]?.toLowerCase() || '';
	if (domain.includes('gmail')) {
		return 'smtp.gmail.com';
	}
	if (domain.includes('outlook') || domain.includes('hotmail') || domain.includes('live')) {
		return 'smtp.office365.com';
	}
	return `smtp.${domain}`;
}

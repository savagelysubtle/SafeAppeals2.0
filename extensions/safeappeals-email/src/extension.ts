/*--------------------------------------------------------------------------------------
 *  Safe Appeals Email — IMAP/SMTP + dashboard + .eml viewer in the extension host
 *--------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { registerAgentTools } from './agentTools';
import { AccountStore } from './accountStore';
import { getCurrentCase, getDefaultFolder, getSyncIntervalMinutes, isWebClient } from './config';
import { DashboardPanel, EmailSidebarProvider } from './dashboardPanel';
import { EmailIndex } from './emailIndex';
import { EmlEditorProvider } from './emlEditorProvider';
import { parseEmlFile } from './emlParser';
import { diagnoseConnection } from './imapClient';
import {
	boundMailboxEmail,
	CLOUD_AUTH_PROVIDER_ID,
	gmailOAuthAccountDefaults,
	GOOGLE_AUTH_PROVIDER_ID,
	isMailboxEmailBound,
	isProviderScopeUserMismatch,
	providerAuthIdForOAuth,
	shouldPersistOAuthAccount,
} from './oauthAccountFlow';
import { handleCloudSignOutCascade, SyncEngine } from './syncEngine';
import {
	isOAuthCredentials,
	type DraftStatus,
	type EmailAccountConfig,
	type EmailAccountCredentials,
	type EmailClassification,
	type ListThreadsQuery,
	type SendMailRequest,
	type ThreadStatus,
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
	index = new EmailIndex(context.globalStorageUri, context.secrets, context.globalState, log);
	await index.initialize();

	statusBar = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 49);
	statusBar.command = 'safeappeals-email.syncStatus';
	statusBar.tooltip = 'Safe Appeals Email';
	statusBar.show();

	let sidebarProvider: EmailSidebarProvider;

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

	const refreshUi = () => {
		void refreshStatusBar();
		void DashboardPanel.refreshIfOpen();
		EmailSidebarProvider.refreshIfResolved();
	};

	engine = new SyncEngine(accounts, index, log, () => {
		refreshUi();
	});

	const openDashboard = () => {
		DashboardPanel.show(context.extensionUri, engine, accounts, index, log, refreshUi);
	};

	const openThread = (threadId: string) => {
		DashboardPanel.showAndSelectThread(
			context.extensionUri,
			engine,
			accounts,
			index,
			log,
			threadId,
			refreshUi,
		);
	};

	const openCompose = () => {
		DashboardPanel.showCompose(context.extensionUri, engine, accounts, index, log, refreshUi);
	};

	const openDrafts = () => {
		DashboardPanel.showDrafts(context.extensionUri, engine, accounts, index, log, refreshUi);
	};

	const openSettings = () => {
		DashboardPanel.showSettings(context.extensionUri, engine, accounts, index, log, refreshUi);
	};

	sidebarProvider = new EmailSidebarProvider(
		context.extensionUri,
		engine,
		accounts,
		index,
		log,
		openDashboard,
		openThread,
		openCompose,
		openDrafts,
		openSettings,
		refreshUi,
	);

	context.subscriptions.push(
		output,
		statusBar,
		engine,
		EmlEditorProvider.register(context, index, log),
		vscode.window.registerWebviewViewProvider(
			EmailSidebarProvider.viewType,
			sidebarProvider,
		),

		vscode.workspace.onDidChangeConfiguration((e) => {
			if (e.affectsConfiguration('safeappealsEmail.syncIntervalMinutes')) {
				log(`Sync interval → ${getSyncIntervalMinutes()} min; restarting timer`);
				engine.startBackgroundSync();
			}
		}),
	);

	registerCommands(context, log, openDashboard, refreshUi);
	registerCloudSignOutCascade(context, log, refreshUi);
	registerAgentTools(context, () => index, () => accounts);
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
			if (isWebClient()) {
				void vscode.window.showWarningMessage(
					vscode.l10n.t(
						'Adding accounts is not available in the browser because credentials cannot be stored securely. Use the desktop app.',
					),
				);
				return undefined;
			}
			const account = await promptAddAccount(log);
			if (!account) {
				return undefined;
			}
			log(`Account added: ${account.label}`);
			refreshUi();
			await engine.syncAll(account.id);
			return account;
		}),

		vscode.commands.registerCommand(
			'safeappeals-email.reconnectMailbox',
			async (accountIdArg?: string) => {
				if (isWebClient()) {
					void vscode.window.showWarningMessage(
						vscode.l10n.t('Reconnect Mailbox is only available in the desktop app.'),
					);
					return { success: false };
				}
				const ok = await promptReconnectMailbox(accountIdArg, log);
				if (ok) {
					refreshUi();
				}
				return { success: ok };
			},
		),

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

		vscode.commands.registerCommand(
			'safeappeals-email.linkThreadToCase',
			async (threadId: string, caseFolderPath?: string) => {
				if (!threadId) {
					throw new Error('threadId required');
				}
				const target = caseFolderPath || getCurrentCase()?.caseFolderPath;
				if (!target) {
					void vscode.window.showWarningMessage(
						'Open a case folder to link email threads to a case.',
					);
					return { success: false };
				}
				await index.linkThreadToCase(threadId, target);
				log(`Thread ${threadId} linked to case ${target}`);
				refreshUi();
				return { success: true };
			},
		),

		vscode.commands.registerCommand(
			'safeappeals-email.unlinkThreadFromCase',
			async (threadId: string) => {
				if (!threadId) {
					throw new Error('threadId required');
				}
				await index.unlinkThread(threadId);
				log(`Thread ${threadId} unlinked from case`);
				refreshUi();
				return { success: true };
			},
		),

		vscode.commands.registerCommand(
			'safeappeals-email.tagThread',
			async (threadId: string, tag: string) => {
				if (!threadId) {
					throw new Error('threadId required');
				}
				if (!tag || !tag.trim()) {
					throw new Error('tag required');
				}
				await index.tagThread(threadId, tag);
				refreshUi();
				return { success: true };
			},
		),

		vscode.commands.registerCommand(
			'safeappeals-email.untagThread',
			async (threadId: string, tag: string) => {
				if (!threadId) {
					throw new Error('threadId required');
				}
				if (!tag || !tag.trim()) {
					throw new Error('tag required');
				}
				await index.untagThread(threadId, tag);
				refreshUi();
				return { success: true };
			},
		),

		vscode.commands.registerCommand('safeappeals-email.listTags', () => index.listTags()),

		vscode.commands.registerCommand(
			'safeappeals-email.deleteTag',
			async (tag: string) => {
				if (!tag || !tag.trim()) {
					throw new Error('tag required');
				}
				await index.deleteTag(tag);
				log(`Tag deleted: ${tag.trim()} (emails unchanged)`);
				refreshUi();
				return { success: true };
			},
		),

		vscode.commands.registerCommand(
			'safeappeals-email.hideThread',
			async (threadId: string) => {
				if (!threadId) {
					throw new Error('threadId required');
				}
				await index.hideThread(threadId);
				refreshUi();
				return { success: true };
			},
		),

		vscode.commands.registerCommand(
			'safeappeals-email.unhideThread',
			async (threadId: string) => {
				if (!threadId) {
					throw new Error('threadId required');
				}
				await index.unhideThread(threadId);
				refreshUi();
				return { success: true };
			},
		),

		vscode.commands.registerCommand('safeappeals-email.clearLocalCache', async () => {
			const confirm = await vscode.window.showWarningMessage(
				'Delete the local email cache? Synced messages, drafts, tags, and case links stored on this machine will be removed. Accounts and passwords are not affected.',
				{ modal: true },
				'Clear Cache',
			);
			if (confirm !== 'Clear Cache') {
				return { success: false };
			}
			await index.clearLocalCache();
			refreshUi();
			return { success: true };
		}),
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

type AddAccountMethod = 'google' | 'password';

function registerCloudSignOutCascade(
	context: vscode.ExtensionContext,
	log: (msg: string) => void,
	refreshUi: () => void,
): void {
	context.subscriptions.push(
		vscode.authentication.onDidChangeSessions(async (e) => {
			if (e.provider.id !== CLOUD_AUTH_PROVIDER_ID) {
				return;
			}
			// Global event only exposes provider id — confirm Cloud session is gone.
			const remaining = await vscode.authentication.getSession(CLOUD_AUTH_PROVIDER_ID, [], {
				silent: true,
			});
			if (remaining) {
				return;
			}
			try {
				const marked = await handleCloudSignOutCascade(accounts);
				if (marked === 0) {
					return;
				}
				log(`Cloud sign-out: marked ${marked} OAuth mailbox account(s) needsReconnect`);
				refreshUi();
				const reconnect = vscode.l10n.t('Reconnect Mailbox');
				const choice = await vscode.window.showWarningMessage(
					vscode.l10n.t(
						'Signed out of SafeAppeals Cloud. Reconnect your mailbox to resume email sync.',
					),
					reconnect,
				);
				if (choice === reconnect) {
					await vscode.commands.executeCommand('safeappeals-email.reconnectMailbox');
				}
			} catch (err) {
				const message = err instanceof Error ? err.message : String(err);
				log(`Cloud sign-out cascade failed: ${message}`);
			}
		}),
	);
}

async function promptAddAccount(
	log: (msg: string) => void,
): Promise<EmailAccountConfig | undefined> {
	const googleLabel = vscode.l10n.t('Sign in with Safe Appeals (Google)');
	const passwordLabel = vscode.l10n.t('Advanced: App Password / IMAP');
	const method = await vscode.window.showQuickPick(
		[
			{
				label: googleLabel,
				description: vscode.l10n.t('Connect Gmail with Safe Appeals'),
				id: 'google' as AddAccountMethod,
			},
			{
				label: passwordLabel,
				description: vscode.l10n.t('Manual IMAP/SMTP with an app password'),
				id: 'password' as AddAccountMethod,
			},
		],
		{
			placeHolder: vscode.l10n.t('How do you want to add a mailbox?'),
			ignoreFocusOut: true,
		},
	);
	if (!method) {
		return undefined;
	}
	if (method.id === 'google') {
		return promptAddGoogleOAuthAccount(log);
	}
	return promptAddPasswordAccount(log);
}

async function promptAddGoogleOAuthAccount(
	log: (msg: string) => void,
): Promise<EmailAccountConfig | undefined> {
	let cloudSession: vscode.AuthenticationSession;
	try {
		const session = await vscode.authentication.getSession(CLOUD_AUTH_PROVIDER_ID, [], {
			createIfNone: true,
		});
		if (!session) {
			void vscode.window.showErrorMessage(
				vscode.l10n.t('Sign in to SafeAppeals Cloud was cancelled.'),
			);
			return undefined;
		}
		cloudSession = session;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`Cloud session for mailbox connect failed: ${message}`);
		void vscode.window.showErrorMessage(
			vscode.l10n.t('Could not sign in to SafeAppeals Cloud: {0}', message),
		);
		return undefined;
	}

	let googleSession: vscode.AuthenticationSession;
	try {
		const session = await vscode.authentication.getSession(GOOGLE_AUTH_PROVIDER_ID, ['mail'], {
			createIfNone: true,
		});
		if (!session || !shouldPersistOAuthAccount(session)) {
			log(
				`Google mail session unusable (token=${Boolean(session?.accessToken)}, scopes=${session?.scopes?.join(' ') ?? 'none'}) — aborting OAuth account create`,
			);
			void vscode.window.showErrorMessage(
				vscode.l10n.t(
					'Could not get a Gmail access token. Mailbox was not added. Try again or use Advanced: App Password / IMAP.',
				),
			);
			return undefined;
		}
		googleSession = session;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`Google mail session mint failed: ${message}`);
		// Wrong-account reconsent is already surfaced by safeappeals-authentication.
		if (!isProviderScopeUserMismatch(err)) {
			void vscode.window.showErrorMessage(
				vscode.l10n.t(
					'Could not connect Gmail ({0}). Mailbox was not added.',
					message,
				),
			);
		}
		return undefined;
	}

	// The minted token only authenticates the Cloud Google account, so the mailbox
	// address is bound to it — a different Gmail would fail IMAP later.
	const boundEmail = boundMailboxEmail(
		cloudSession.account.label,
		googleSession.account.label,
	);
	const mismatchMessage = vscode.l10n.t(
		'This mailbox must be {0} — the Google account you signed in to SafeAppeals with.',
		boundEmail ?? '',
	);
	const email = await vscode.window.showInputBox({
		prompt: boundEmail
			? vscode.l10n.t('Gmail address for this mailbox (must be {0})', boundEmail)
			: vscode.l10n.t('Gmail address for this mailbox'),
		placeHolder: 'you@gmail.com',
		value: boundEmail || '',
		ignoreFocusOut: true,
		validateInput: (value) => {
			const trimmed = value.trim();
			if (!trimmed || !trimmed.includes('@')) {
				return vscode.l10n.t('Enter a valid email address');
			}
			if (!isMailboxEmailBound(trimmed, boundEmail)) {
				return mismatchMessage;
			}
			return undefined;
		},
	});
	if (!email?.trim()) {
		return undefined;
	}

	if (!isMailboxEmailBound(email, boundEmail)) {
		log(`Mailbox address ${email.trim()} does not match Cloud identity ${boundEmail}`);
		void vscode.window.showErrorMessage(mismatchMessage);
		return undefined;
	}

	const normalizedEmail = email.trim().toLowerCase();
	const config = gmailOAuthAccountDefaults(normalizedEmail);
	try {
		const account = await accounts.addAccount(config, { type: 'oauth', provider: 'google' });
		await accounts.clearNeedsReconnect(account.id);
		log(`OAuth Gmail account added: ${account.label}`);
		void vscode.window.showInformationMessage(
			vscode.l10n.t('Mailbox connected: {0}', account.label),
		);
		return account;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`OAuth account persist failed: ${message}`);
		void vscode.window.showErrorMessage(
			vscode.l10n.t('Could not save mailbox account: {0}', message),
		);
		return undefined;
	}
}

async function promptAddPasswordAccount(
	log: (msg: string) => void,
): Promise<EmailAccountConfig | undefined> {
	const email = await vscode.window.showInputBox({
		prompt: vscode.l10n.t('Email address'),
		placeHolder: 'you@example.com',
		ignoreFocusOut: true,
	});
	if (!email) {
		return undefined;
	}

	const imapHost = await vscode.window.showInputBox({
		prompt: vscode.l10n.t('IMAP host'),
		placeHolder: 'imap.example.com',
		value: guessImapHost(email),
		ignoreFocusOut: true,
	});
	if (!imapHost) {
		return undefined;
	}

	const imapPortStr = await vscode.window.showInputBox({
		prompt: vscode.l10n.t('IMAP port'),
		value: '993',
		ignoreFocusOut: true,
	});
	if (!imapPortStr) {
		return undefined;
	}

	const smtpHost = await vscode.window.showInputBox({
		prompt: vscode.l10n.t('SMTP host'),
		placeHolder: 'smtp.example.com',
		value: guessSmtpHost(email),
		ignoreFocusOut: true,
	});
	if (!smtpHost) {
		return undefined;
	}

	const smtpPortStr = await vscode.window.showInputBox({
		prompt: vscode.l10n.t('SMTP port (465 SSL / 587 STARTTLS)'),
		value: '465',
		ignoreFocusOut: true,
	});
	if (!smtpPortStr) {
		return undefined;
	}

	const username = await vscode.window.showInputBox({
		prompt: vscode.l10n.t('Username (usually full email)'),
		value: email,
		ignoreFocusOut: true,
	});
	if (!username) {
		return undefined;
	}

	let password = await vscode.window.showInputBox({
		prompt: vscode.l10n.t('Password / app password (stored in SecretStorage, not settings)'),
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
	const retryPassword = vscode.l10n.t('Retry Password');
	const saveAnyway = vscode.l10n.t('Save Anyway');

	for (;;) {
		const creds: EmailAccountCredentials = { type: 'password', password };
		const result = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: vscode.l10n.t('Verifying IMAP connection…'),
				cancellable: false,
			},
			async () => diagnoseConnection(candidate, creds, folder, log),
		);

		if (result.ok) {
			const account = await accounts.addAccount(config, creds);
			void vscode.window.showInformationMessage(
				vscode.l10n.t(
					'Connected — {0} messages in {1}',
					String(result.exists),
					result.folder || folder,
				),
			);
			return account;
		}

		const choice = await vscode.window.showErrorMessage(
			vscode.l10n.t('IMAP connection failed: {0}', result.error || vscode.l10n.t('unknown error')),
			retryPassword,
			saveAnyway,
		);
		if (choice === retryPassword) {
			const retry = await vscode.window.showInputBox({
				prompt: vscode.l10n.t('Password / app password'),
				password: true,
				ignoreFocusOut: true,
			});
			if (retry === undefined) {
				return undefined;
			}
			password = retry;
			continue;
		}
		if (choice === saveAnyway) {
			const account = await accounts.addAccount(config, creds);
			void vscode.window.showWarningMessage(
				vscode.l10n.t(
					'Account saved without a successful IMAP check: {0}',
					account.label,
				),
			);
			return account;
		}
		return undefined;
	}
}

async function promptReconnectMailbox(
	accountIdArg: string | undefined,
	log: (msg: string) => void,
): Promise<boolean> {
	const accountId =
		accountIdArg
		|| (await pickReconnectAccountId());
	if (!accountId) {
		return false;
	}
	const account = accounts.getAccount(accountId);
	if (!account) {
		void vscode.window.showErrorMessage(vscode.l10n.t('Account not found.'));
		return false;
	}
	const creds = await accounts.getCredentials(accountId);
	if (!creds || !isOAuthCredentials(creds)) {
		void vscode.window.showWarningMessage(
			vscode.l10n.t(
				'This mailbox uses an app password. Use Update Account Password instead.',
			),
		);
		return false;
	}

	const providerId = providerAuthIdForOAuth(creds.provider);
	try {
		const cloudSession = await vscode.authentication.getSession(CLOUD_AUTH_PROVIDER_ID, [], {
			createIfNone: true,
		});
		if (!cloudSession) {
			void vscode.window.showErrorMessage(
				vscode.l10n.t('Sign in to SafeAppeals Cloud was cancelled.'),
			);
			return false;
		}
		const mailSession = await vscode.authentication.getSession(providerId, ['mail'], {
			createIfNone: true,
		});
		if (!mailSession || !shouldPersistOAuthAccount(mailSession)) {
			log(
				`Reconnect for ${account.label} produced no mail-scoped token (scopes=${mailSession?.scopes?.join(' ') ?? 'none'})`,
			);
			void vscode.window.showErrorMessage(
				vscode.l10n.t(
					'Could not get a mail access token for {0}. Try again.',
					account.label,
				),
			);
			return false;
		}
		await accounts.clearNeedsReconnect(account.id);
		log(`Mailbox reconnected: ${account.label}`);
		void vscode.window.showInformationMessage(
			vscode.l10n.t('Mailbox reconnected: {0}', account.label),
		);
		await engine.syncAll(account.id);
		return true;
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log(`Reconnect mailbox failed for ${account.label}: ${message}`);
		// Wrong-account reconsent is already surfaced by safeappeals-authentication.
		if (!isProviderScopeUserMismatch(err)) {
			void vscode.window.showErrorMessage(
				vscode.l10n.t('Could not reconnect mailbox: {0}', message),
			);
		}
		return false;
	}
}

async function pickReconnectAccountId(): Promise<string | undefined> {
	const oauthAccounts = await accounts.listOAuthAccounts();
	const needsReconnect = oauthAccounts.filter((a) => a.authStatus === 'needsReconnect');
	const candidates = needsReconnect.length > 0 ? needsReconnect : oauthAccounts;
	if (candidates.length === 0) {
		void vscode.window.showInformationMessage(
			vscode.l10n.t('No OAuth mailboxes need reconnect.'),
		);
		return undefined;
	}
	if (candidates.length === 1) {
		return candidates[0]!.id;
	}
	const pick = await vscode.window.showQuickPick(
		candidates.map((a) => ({
			label: a.label,
			description:
				a.authStatus === 'needsReconnect'
					? vscode.l10n.t('Needs reconnect')
					: a.email,
			id: a.id,
		})),
		{ placeHolder: vscode.l10n.t('Reconnect which mailbox?') },
	);
	return pick?.id;
}

async function promptUpdatePassword(
	account: EmailAccountConfig,
	log: (msg: string) => void,
): Promise<boolean> {
	const oauthCreds = await accounts.getCredentials(account.id);
	if (oauthCreds && isOAuthCredentials(oauthCreds)) {
		return promptReconnectMailbox(account.id, log);
	}

	const folder = getDefaultFolder();
	let password = await vscode.window.showInputBox({
		prompt: vscode.l10n.t('New password for {0}', account.label),
		password: true,
		ignoreFocusOut: true,
	});
	if (password === undefined) {
		return false;
	}

	const retryPassword = vscode.l10n.t('Retry Password');
	for (;;) {
		const creds: EmailAccountCredentials = { type: 'password', password };
		const result = await vscode.window.withProgress(
			{
				location: vscode.ProgressLocation.Notification,
				title: vscode.l10n.t('Verifying IMAP connection…'),
				cancellable: false,
			},
			async () => diagnoseConnection(account, creds, folder, log),
		);

		if (result.ok) {
			await accounts.updateCredentials(account.id, creds);
			void vscode.window.showInformationMessage(
				vscode.l10n.t(
					'Password updated — {0} messages in {1}',
					String(result.exists),
					result.folder || folder,
				),
			);
			log(`Password updated for ${account.label}`);
			return true;
		}

		const choice = await vscode.window.showErrorMessage(
			vscode.l10n.t('IMAP connection failed: {0}', result.error || vscode.l10n.t('unknown error')),
			retryPassword,
		);
		if (choice !== retryPassword) {
			return false;
		}
		const retry = await vscode.window.showInputBox({
			prompt: vscode.l10n.t('New password for {0}', account.label),
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

/*--------------------------------------------------------------------------------------
 *  Email dashboard webview panel + sidebar inbox (React bundles in media/)
 *--------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import type { AccountStore } from './accountStore';
import type { EmailIndex } from './emailIndex';
import type { SyncEngine } from './syncEngine';
import { getCurrentCase, getDefaultFolder, getEmailSettings, updateEmailSettings } from './config';
import type { DraftAttachment, EmailDraft, ThreadSort } from './types';

/** Draft fields posted to the webview compose pane (no secrets / no bytes). */
export interface ComposeDraftPayload {
	id: string;
	accountId: string;
	emailId: string;
	to: string;
	cc?: string;
	bcc?: string;
	subject: string;
	content: string;
	attachments?: DraftAttachment[];
}

function toComposeDraftPayload(draft: EmailDraft): ComposeDraftPayload {
	return {
		id: draft.id,
		accountId: draft.accountId,
		emailId: draft.emailId,
		to: draft.to,
		cc: draft.cc,
		bcc: draft.bcc,
		subject: draft.subject,
		content: draft.content,
		attachments: draft.attachments,
	};
}

export class DashboardPanel {
	public static current: DashboardPanel | undefined;
	public static readonly viewType = 'safeappeals-email.dashboard';

	private readonly panel: vscode.WebviewPanel;
	private disposables: vscode.Disposable[] = [];
	private onAccountsChanged?: () => void;
	private pendingSelectThreadId: string | undefined;
	private pendingOpenCompose = false;
	private pendingLoadDraft: ComposeDraftPayload | undefined;
	private pendingOpenDrafts = false;
	private pendingOpenSettings = false;

	private constructor(
		panel: vscode.WebviewPanel,
		private readonly extensionUri: vscode.Uri,
		private readonly engine: SyncEngine,
		private readonly accounts: AccountStore,
		private readonly index: EmailIndex,
		private readonly log: (msg: string) => void,
		onAccountsChanged?: () => void,
	) {
		this.panel = panel;
		this.onAccountsChanged = onAccountsChanged;
		this.panel.webview.html = this.getHtml(this.panel.webview);
		this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
		this.panel.webview.onDidReceiveMessage(
			(msg) => void this.onMessage(msg),
			null,
			this.disposables,
		);
	}

	static show(
		extensionUri: vscode.Uri,
		engine: SyncEngine,
		accounts: AccountStore,
		index: EmailIndex,
		log: (msg: string) => void,
		onAccountsChanged?: () => void,
	): DashboardPanel {
		const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
		if (DashboardPanel.current) {
			DashboardPanel.current.onAccountsChanged = onAccountsChanged;
			DashboardPanel.current.panel.reveal(column);
			void DashboardPanel.current.postBootstrap();
			return DashboardPanel.current;
		}
		const panel = vscode.window.createWebviewPanel(
			DashboardPanel.viewType,
			'Email Dashboard',
			column,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [
					vscode.Uri.joinPath(extensionUri, 'media', 'dashboard'),
					extensionUri,
				],
			},
		);
		DashboardPanel.current = new DashboardPanel(
			panel,
			extensionUri,
			engine,
			accounts,
			index,
			log,
			onAccountsChanged,
		);
		void DashboardPanel.current.postBootstrap();
		return DashboardPanel.current;
	}

	/** Reveal the dashboard and focus a thread in the reading pane. */
	static showAndSelectThread(
		extensionUri: vscode.Uri,
		engine: SyncEngine,
		accounts: AccountStore,
		index: EmailIndex,
		log: (msg: string) => void,
		threadId: string,
		onAccountsChanged?: () => void,
	): DashboardPanel {
		const panel = DashboardPanel.show(extensionUri, engine, accounts, index, log, onAccountsChanged);
		panel.selectThread(threadId);
		return panel;
	}

	/** Reveal the dashboard and show the compose pane. */
	static showCompose(
		extensionUri: vscode.Uri,
		engine: SyncEngine,
		accounts: AccountStore,
		index: EmailIndex,
		log: (msg: string) => void,
		onAccountsChanged?: () => void,
	): DashboardPanel {
		const panel = DashboardPanel.show(extensionUri, engine, accounts, index, log, onAccountsChanged);
		panel.openCompose();
		return panel;
	}

	/** Reveal the dashboard and open compose prefilled with a saved draft. */
	static showComposeWithDraft(
		extensionUri: vscode.Uri,
		engine: SyncEngine,
		accounts: AccountStore,
		index: EmailIndex,
		log: (msg: string) => void,
		draft: EmailDraft,
		onAccountsChanged?: () => void,
	): DashboardPanel {
		const panel = DashboardPanel.show(extensionUri, engine, accounts, index, log, onAccountsChanged);
		panel.openComposeWithDraft(draft);
		return panel;
	}

	/** Reveal the dashboard and show the drafts pane. */
	static showDrafts(
		extensionUri: vscode.Uri,
		engine: SyncEngine,
		accounts: AccountStore,
		index: EmailIndex,
		log: (msg: string) => void,
		onAccountsChanged?: () => void,
	): DashboardPanel {
		const panel = DashboardPanel.show(extensionUri, engine, accounts, index, log, onAccountsChanged);
		panel.openDrafts();
		return panel;
	}

	/** Reveal the dashboard and show the settings pane. */
	static showSettings(
		extensionUri: vscode.Uri,
		engine: SyncEngine,
		accounts: AccountStore,
		index: EmailIndex,
		log: (msg: string) => void,
		onAccountsChanged?: () => void,
	): DashboardPanel {
		const panel = DashboardPanel.show(extensionUri, engine, accounts, index, log, onAccountsChanged);
		panel.openSettings();
		return panel;
	}

	static async refreshIfOpen(): Promise<void> {
		if (DashboardPanel.current) {
			await DashboardPanel.current.postBootstrap();
		}
	}

	selectThread(threadId: string): void {
		this.pendingSelectThreadId = threadId;
		this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.One);
		// Immediate delivery when the webview is already live; also kept as pending for `ready`.
		this.panel.webview.postMessage({ type: 'selectThread', threadId });
	}

	openCompose(): void {
		this.pendingOpenCompose = true;
		this.pendingLoadDraft = undefined;
		this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.One);
		this.panel.webview.postMessage({ type: 'openCompose' });
	}

	/** Open compose with a saved draft (host → webview `loadDraft`). */
	openComposeWithDraft(draft: EmailDraft): void {
		const payload = toComposeDraftPayload(draft);
		this.pendingOpenCompose = false;
		this.pendingLoadDraft = payload;
		this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.One);
		this.panel.webview.postMessage({ type: 'loadDraft', draft: payload });
	}

	openDrafts(): void {
		this.pendingOpenDrafts = true;
		this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.One);
		this.panel.webview.postMessage({ type: 'openDrafts' });
	}

	openSettings(): void {
		this.pendingOpenSettings = true;
		this.panel.reveal(this.panel.viewColumn ?? vscode.ViewColumn.One);
		this.panel.webview.postMessage({ type: 'openSettings' });
	}

	dispose(): void {
		DashboardPanel.current = undefined;
		this.panel.dispose();
		while (this.disposables.length) {
			this.disposables.pop()?.dispose();
		}
	}

	/**
	 * Host-side file picker (timeline pickDocuments pattern). Never posts bytes — metadata only.
	 * Allocates a draft id via saveDraft when compose has not saved yet.
	 */
	private async pickAttachments(msg: { type: string; [key: string]: unknown }): Promise<void> {
		const accountId = typeof msg.accountId === 'string' ? msg.accountId.trim() : '';
		if (!accountId) {
			this.panel.webview.postMessage({ type: 'error', message: 'Add an account before attaching files.' });
			return;
		}
		let draftId = typeof msg.draftId === 'string' ? msg.draftId.trim() : '';
		if (!draftId) {
			const saved = await this.engine.saveDraft({
				accountId,
				emailId: typeof msg.emailId === 'string' ? msg.emailId : '',
				to: typeof msg.to === 'string' ? msg.to : '',
				cc: typeof msg.cc === 'string' && msg.cc ? msg.cc : undefined,
				bcc: typeof msg.bcc === 'string' && msg.bcc ? msg.bcc : undefined,
				subject: typeof msg.subject === 'string' ? msg.subject : '',
				content: typeof msg.content === 'string' ? msg.content : '',
			});
			draftId = saved.draft.id;
			this.panel.webview.postMessage({
				type: 'draftSaved',
				draft: saved.draft,
				drafts: this.index.listDrafts(),
				stats: this.index.getStats(),
				remoteError: saved.remoteError,
			});
		}

		const folder = vscode.workspace.workspaceFolders?.[0];
		const uris = await vscode.window.showOpenDialog({
			canSelectMany: true,
			canSelectFiles: true,
			canSelectFolders: false,
			defaultUri: folder?.uri,
			openLabel: 'Attach',
		});
		if (!uris?.length) {
			const draft = this.index.getDraft(draftId);
			this.panel.webview.postMessage({
				type: 'attachmentsUpdated',
				draftId,
				attachments: draft?.attachments || [],
			});
			return;
		}

		try {
			const updated = await this.engine.attachFilesToDraft(
				draftId,
				uris.map(u => u.fsPath),
			);
			this.panel.webview.postMessage({
				type: 'attachmentsUpdated',
				draftId: updated.id,
				attachments: updated.attachments || [],
				drafts: this.index.listDrafts(),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.panel.webview.postMessage({ type: 'error', message });
			void vscode.window.showErrorMessage(`Could not attach file: ${message}`);
		}
	}

	private async removeAttachment(msg: { type: string; [key: string]: unknown }): Promise<void> {
		const draftId = typeof msg.draftId === 'string' ? msg.draftId.trim() : '';
		const attachmentId = typeof msg.attachmentId === 'string' ? msg.attachmentId.trim() : '';
		if (!draftId || !attachmentId) {
			this.panel.webview.postMessage({
				type: 'error',
				message: 'draftId and attachmentId are required to remove an attachment.',
			});
			return;
		}
		try {
			const updated = await this.engine.removeAttachmentFromDraft(draftId, attachmentId);
			this.panel.webview.postMessage({
				type: 'attachmentsUpdated',
				draftId: updated.id,
				attachments: updated.attachments || [],
				drafts: this.index.listDrafts(),
			});
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			this.panel.webview.postMessage({ type: 'error', message });
		}
	}

	private async postBootstrap(): Promise<void> {
		const accounts = this.accounts.listAccounts();
		const status = await this.engine.getStatus();
		const folder = getDefaultFolder();
		const { threads, total } = this.engine.listThreads({
			accountId: accounts[0]?.id,
			folder,
			offset: 0,
			limit: 50,
		});
		const stats = this.index.getStats();
		this.panel.webview.postMessage({
			type: 'bootstrap',
			accounts,
			status,
			folder,
			threads,
			total,
			stats,
			caseName: getCurrentCase()?.caseName ?? null,
			drafts: this.index.listDrafts(),
			settings: getEmailSettings(),
		});
	}

	private async onMessage(msg: { type: string; [key: string]: unknown }): Promise<void> {
		try {
			switch (msg.type) {
				case 'ready':
					await this.postBootstrap();
					if (this.pendingSelectThreadId) {
						const threadId = this.pendingSelectThreadId;
						this.pendingSelectThreadId = undefined;
						this.panel.webview.postMessage({ type: 'selectThread', threadId });
					}
					if (this.pendingLoadDraft) {
						const draft = this.pendingLoadDraft;
						this.pendingLoadDraft = undefined;
						this.pendingOpenCompose = false;
						this.panel.webview.postMessage({ type: 'loadDraft', draft });
					} else if (this.pendingOpenCompose) {
						this.pendingOpenCompose = false;
						this.panel.webview.postMessage({ type: 'openCompose' });
					}
					if (this.pendingOpenDrafts) {
						this.pendingOpenDrafts = false;
						this.panel.webview.postMessage({ type: 'openDrafts' });
					}
					if (this.pendingOpenSettings) {
						this.pendingOpenSettings = false;
						this.panel.webview.postMessage({ type: 'openSettings' });
					}
					break;
				case 'listThreads': {
					const result = this.engine.listThreads({
						accountId: msg.accountId as string | undefined,
						folder: (msg.folder as string) || getDefaultFolder(),
						offset: (msg.offset as number) || 0,
						limit: (msg.limit as number) || 50,
					});
					this.panel.webview.postMessage({ type: 'threads', ...result, folder: msg.folder });
					break;
				}
				case 'getThread': {
					const thread = this.engine.getThread(msg.threadId as string);
					this.panel.webview.postMessage({ type: 'thread', thread });
					break;
				}
				case 'getMessage': {
					const message = await this.engine.getMessage(msg.messageId as string);
					this.panel.webview.postMessage({ type: 'message', message });
					break;
				}
				case 'syncNow': {
					const status = await this.engine.syncAll(msg.accountId as string | undefined);
					await this.postBootstrap();
					this.panel.webview.postMessage({ type: 'syncStatus', status });
					break;
				}
				case 'send': {
					const result = await this.engine.send(msg.request as Parameters<SyncEngine['send']>[0]);
					this.panel.webview.postMessage({
						type: 'sent',
						result,
						drafts: this.index.listDrafts(),
						stats: this.index.getStats(),
					});
					void vscode.window.showInformationMessage('Email sent');
					break;
				}
				case 'saveDraft': {
					const result = await this.engine.saveDraft(
						msg.draft as Parameters<SyncEngine['saveDraft']>[0],
					);
					this.panel.webview.postMessage({
						type: 'draftSaved',
						draft: result.draft,
						drafts: this.index.listDrafts(),
						stats: this.index.getStats(),
						remoteError: result.remoteError,
					});
					if (result.remoteError) {
						void vscode.window.showWarningMessage(
							`Draft saved locally, but server Drafts failed: ${result.remoteError}`,
						);
					} else if (result.remote) {
						void vscode.window.showInformationMessage('Draft saved to Drafts');
					} else {
						void vscode.window.showInformationMessage(
							result.draft.subject
								? `Draft saved: ${result.draft.subject}`
								: 'Draft saved',
						);
					}
					break;
				}
				case 'pickAttachments': {
					await this.pickAttachments(msg);
					break;
				}
				case 'removeAttachment': {
					await this.removeAttachment(msg);
					break;
				}
				case 'updateSettings': {
					const raw = (msg.settings || {}) as Record<string, unknown>;
					await updateEmailSettings({
						header: typeof raw.header === 'string' ? raw.header : undefined,
						signature: typeof raw.signature === 'string' ? raw.signature : undefined,
						autoCc: typeof raw.autoCc === 'string' ? raw.autoCc : undefined,
						autoBcc: typeof raw.autoBcc === 'string' ? raw.autoBcc : undefined,
						syncIntervalMinutes:
							typeof raw.syncIntervalMinutes === 'number' ? raw.syncIntervalMinutes : undefined,
						defaultFolder: typeof raw.defaultFolder === 'string' ? raw.defaultFolder : undefined,
						maxMessagesPerSync:
							typeof raw.maxMessagesPerSync === 'number' ? raw.maxMessagesPerSync : undefined,
					});
					this.log('Email settings updated');
					this.panel.webview.postMessage({
						type: 'settingsSaved',
						settings: getEmailSettings(),
					});
					break;
				}
				case 'listDrafts': {
					this.panel.webview.postMessage({
						type: 'drafts',
						drafts: this.index.listDrafts(msg.accountId as string | undefined),
					});
					break;
				}
				case 'addAccount':
					await vscode.commands.executeCommand('safeappeals-email.addAccount');
					await this.postBootstrap();
					break;
				case 'removeAccount': {
					const accountId = msg.accountId as string | undefined;
					if (!accountId) {
						break;
					}
					const account = this.accounts.getAccount(accountId);
					const label = account?.label || accountId;
					const confirm = await vscode.window.showWarningMessage(
						`Remove email account “${label}”? Cached messages for this account will be deleted.`,
						{ modal: true },
						'Remove',
					);
					if (confirm !== 'Remove') {
						break;
					}
					await this.index.clearAccount(accountId);
					await this.accounts.removeAccount(accountId);
					this.log(`Account removed (dashboard): ${accountId}`);
					this.onAccountsChanged?.();
					await this.postBootstrap();
					break;
				}
				case 'updatePassword':
					await vscode.commands.executeCommand(
						'safeappeals-email.updatePassword',
						msg.accountId as string | undefined,
					);
					await this.postBootstrap();
					break;
				case 'linkThreadToCase': {
					const threadId = msg.threadId as string | undefined;
					if (!threadId) {
						break;
					}
					await vscode.commands.executeCommand('safeappeals-email.linkThreadToCase', threadId);
					await this.postBootstrap();
					this.panel.webview.postMessage({ type: 'thread', thread: this.engine.getThread(threadId) });
					break;
				}
				case 'unlinkThreadFromCase': {
					const threadId = msg.threadId as string | undefined;
					if (!threadId) {
						break;
					}
					await vscode.commands.executeCommand('safeappeals-email.unlinkThreadFromCase', threadId);
					await this.postBootstrap();
					this.panel.webview.postMessage({ type: 'thread', thread: this.engine.getThread(threadId) });
					break;
				}
				case 'openEml': {
					const message = this.index.getMessage(msg.messageId as string);
					if (message?.filePath) {
						await vscode.commands.executeCommand(
							'vscode.openWith',
							vscode.Uri.file(message.filePath),
							'safeappeals.emlViewer',
						);
					}
					break;
				}
				case 'focusSidebar':
					await vscode.commands.executeCommand('workbench.view.extension.safeappeals-email');
					break;
				default:
					this.log(`Unknown dashboard message: ${msg.type}`);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.log(`Dashboard error: ${message}`);
			this.panel.webview.postMessage({ type: 'error', message });
		}
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = randomUUID();
		const mediaRoot = vscode.Uri.joinPath(this.extensionUri, 'media', 'dashboard');
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'dashboard.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'dashboard.css'));
		const csp = webview.cspSource;

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none';
			img-src ${csp} https: data:;
			style-src ${csp} 'unsafe-inline';
			script-src 'nonce-${nonce}' ${csp};" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<link rel="stylesheet" href="${styleUri}" />
	<title>Email Dashboard</title>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

/** Sidebar webview view — primary email inbox. */
export class EmailSidebarProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'safeappeals-email.sidebar';
	private static current: EmailSidebarProvider | undefined;

	private view: vscode.WebviewView | undefined;
	private accountId: string | undefined;
	private folder: string = getDefaultFolder();
	private sort: ThreadSort = 'newest';
	private scope: 'all' | 'case' = 'all';
	private tagFilter: string | null = null;
	private messageDisposable: vscode.Disposable | undefined;

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly engine: SyncEngine,
		private readonly accounts: AccountStore,
		private readonly index: EmailIndex,
		private readonly log: (msg: string) => void,
		private readonly openDashboard: () => void,
		private readonly openThread: (threadId: string) => void,
		private readonly openCompose: () => void,
		private readonly openDrafts: () => void,
		private readonly openSettings: () => void,
		private readonly onAccountsChanged?: () => void,
	) {
		EmailSidebarProvider.current = this;
	}

	static refreshIfResolved(): void {
		void EmailSidebarProvider.current?.refresh();
	}

	async refresh(): Promise<void> {
		if (this.view) {
			await this.postBootstrap();
		}
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.view = webviewView;
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar'),
				this.extensionUri,
			],
		};
		webviewView.webview.html = this.getHtml(webviewView.webview);

		this.messageDisposable?.dispose();
		this.messageDisposable = webviewView.webview.onDidReceiveMessage((msg) => {
			void this.onMessage(msg);
		});

		webviewView.onDidDispose(() => {
			if (this.view === webviewView) {
				this.view = undefined;
			}
			this.messageDisposable?.dispose();
			this.messageDisposable = undefined;
		});

		void this.postBootstrap();
	}

	private async postBootstrap(): Promise<void> {
		if (!this.view) {
			return;
		}
		const accounts = this.accounts.listAccounts();
		const accountId = this.accountId && accounts.some((a) => a.id === this.accountId)
			? this.accountId
			: accounts[0]?.id;
		this.accountId = accountId;
		const folder = this.folder || getDefaultFolder();
		const status = await this.engine.getStatus();
		const currentCase = getCurrentCase();
		const { threads, total } = this.engine.listThreads({
			accountId,
			folder,
			offset: 0,
			limit: 50,
			sort: this.sort,
			caseFolderPath: this.scope === 'case' ? currentCase?.caseFolderPath : undefined,
			tag: this.tagFilter ?? undefined,
		});
		this.view.webview.postMessage({
			type: 'bootstrap',
			accounts,
			status,
			folder,
			sort: this.sort,
			scope: this.scope,
			tag: this.tagFilter,
			allTags: this.index.listTags(),
			caseName: currentCase?.caseName ?? null,
			caseFolderPath: currentCase?.caseFolderPath ?? null,
			threads,
			total,
			stats: this.index.getStats(),
		});
	}

	private async onMessage(msg: { type: string; [key: string]: unknown }): Promise<void> {
		if (!this.view) {
			return;
		}
		try {
			switch (msg.type) {
				case 'ready':
					await this.postBootstrap();
					break;
				case 'listThreads': {
					const accountId = msg.accountId as string | undefined;
					const folder = (msg.folder as string) || getDefaultFolder();
					const offset = (msg.offset as number) || 0;
					const sort = (msg.sort as ThreadSort | undefined) || this.sort || 'newest';
					const scope = msg.scope === 'case' || msg.scope === 'all' ? msg.scope : this.scope;
					const tag = typeof msg.tag === 'string' && msg.tag ? msg.tag : null;
					this.accountId = accountId;
					this.folder = folder;
					this.sort = sort;
					this.scope = scope;
					this.tagFilter = tag;
					const result = this.engine.listThreads({
						accountId,
						folder,
						offset,
						limit: (msg.limit as number) || 50,
						sort,
						caseFolderPath: scope === 'case' ? getCurrentCase()?.caseFolderPath : undefined,
						tag: tag ?? undefined,
					});
					this.view.webview.postMessage({
						type: 'threads',
						...result,
						folder,
						offset,
						sort,
						scope,
						tag,
						allTags: this.index.listTags(),
					});
					break;
				}
				case 'search': {
					const query = typeof msg.query === 'string' ? msg.query : '';
					const accountId = msg.accountId as string | undefined;
					const results = this.index.search(query, accountId).slice(0, 100);
					this.view.webview.postMessage({ type: 'searchResults', query, results });
					break;
				}
				case 'syncNow': {
					const status = await this.engine.syncAll(msg.accountId as string | undefined);
					await this.postBootstrap();
					this.view.webview.postMessage({ type: 'syncStatus', status });
					break;
				}
				case 'openDashboard':
					this.openDashboard();
					break;
				case 'openThread': {
					const threadId = msg.threadId as string | undefined;
					if (threadId) {
						this.openThread(threadId);
					}
					break;
				}
				case 'compose':
					this.openCompose();
					break;
				case 'openDrafts':
					this.openDrafts();
					break;
				case 'openSettings':
					this.openSettings();
					break;
				case 'addAccount':
					await vscode.commands.executeCommand('safeappeals-email.addAccount');
					await this.postBootstrap();
					break;
				case 'reconnectMailbox':
					await vscode.commands.executeCommand(
						'safeappeals-email.reconnectMailbox',
						msg.accountId as string | undefined,
					);
					await this.postBootstrap();
					break;
				case 'updatePassword':
					await vscode.commands.executeCommand(
						'safeappeals-email.updatePassword',
						msg.accountId as string | undefined,
					);
					await this.postBootstrap();
					break;
				case 'removeAccount': {
					const accountId = msg.accountId as string | undefined;
					if (!accountId) {
						break;
					}
					const account = this.accounts.getAccount(accountId);
					const label = account?.label || accountId;
					const confirm = await vscode.window.showWarningMessage(
						`Remove email account “${label}”? Cached messages for this account will be deleted.`,
						{ modal: true },
						'Remove',
					);
					if (confirm !== 'Remove') {
						break;
					}
					await this.index.clearAccount(accountId);
					await this.accounts.removeAccount(accountId);
					this.log(`Account removed (sidebar): ${accountId}`);
					this.onAccountsChanged?.();
					await this.postBootstrap();
					break;
				}
				case 'tagThread':
				case 'untagThread': {
					const threadId = msg.threadId as string | undefined;
					const tag = msg.tag as string | undefined;
					if (!threadId || !tag) {
						break;
					}
					await vscode.commands.executeCommand(`safeappeals-email.${msg.type}`, threadId, tag);
					await this.postBootstrap();
					break;
				}
				case 'deleteTag': {
					const tag = typeof msg.tag === 'string' ? msg.tag.trim() : '';
					if (!tag) {
						break;
					}
					const count =
						this.index.listTags().find((t) => t.name.toLowerCase() === tag.toLowerCase())
							?.count ?? 0;
					const confirm = await vscode.window.showWarningMessage(
						count > 0
							? `Remove tag “${tag}” from ${count} thread${count === 1 ? '' : 's'}? Emails are not deleted.`
							: `Remove unused tag “${tag}”?`,
						{ modal: true },
						'Remove Tag',
					);
					if (confirm !== 'Remove Tag') {
						break;
					}
					if (this.tagFilter && this.tagFilter.toLowerCase() === tag.toLowerCase()) {
						this.tagFilter = null;
					}
					await vscode.commands.executeCommand('safeappeals-email.deleteTag', tag);
					await this.postBootstrap();
					break;
				}
				case 'hideThread':
				case 'unhideThread': {
					const threadId = msg.threadId as string | undefined;
					if (!threadId) {
						break;
					}
					await vscode.commands.executeCommand(`safeappeals-email.${msg.type}`, threadId);
					await this.postBootstrap();
					break;
				}
				case 'linkThreadToCase':
				case 'unlinkThreadFromCase': {
					const threadId = msg.threadId as string | undefined;
					if (!threadId) {
						break;
					}
					await vscode.commands.executeCommand(`safeappeals-email.${msg.type}`, threadId);
					await this.postBootstrap();
					break;
				}
				default:
					this.log(`Unknown sidebar message: ${msg.type}`);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.log(`Sidebar error: ${message}`);
			this.view.webview.postMessage({ type: 'error', message });
		}
	}

	private getHtml(webview: vscode.Webview): string {
		const nonce = randomUUID();
		const mediaRoot = vscode.Uri.joinPath(this.extensionUri, 'media', 'sidebar');
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'sidebar.js'));
		const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'sidebar.css'));
		const csp = webview.cspSource;

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8" />
	<meta http-equiv="Content-Security-Policy"
		content="default-src 'none';
			img-src ${csp} https: data:;
			style-src ${csp} 'unsafe-inline';
			script-src 'nonce-${nonce}' ${csp};" />
	<meta name="viewport" content="width=device-width, initial-scale=1.0" />
	<link rel="stylesheet" href="${styleUri}" />
	<title>Email</title>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

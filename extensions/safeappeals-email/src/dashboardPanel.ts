/*--------------------------------------------------------------------------------------
 *  Email dashboard webview panel (React bundle in media/dashboard)
 *--------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import type { AccountStore } from './accountStore';
import type { EmailIndex } from './emailIndex';
import type { SyncEngine } from './syncEngine';
import { getDefaultFolder } from './config';

export class DashboardPanel {
	public static current: DashboardPanel | undefined;
	public static readonly viewType = 'safeappeals-email.dashboard';

	private readonly panel: vscode.WebviewPanel;
	private disposables: vscode.Disposable[] = [];

	private constructor(
		panel: vscode.WebviewPanel,
		private readonly extensionUri: vscode.Uri,
		private readonly engine: SyncEngine,
		private readonly accounts: AccountStore,
		private readonly index: EmailIndex,
		private readonly log: (msg: string) => void,
	) {
		this.panel = panel;
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
	): DashboardPanel {
		const column = vscode.window.activeTextEditor?.viewColumn ?? vscode.ViewColumn.One;
		if (DashboardPanel.current) {
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
		DashboardPanel.current = new DashboardPanel(panel, extensionUri, engine, accounts, index, log);
		void DashboardPanel.current.postBootstrap();
		return DashboardPanel.current;
	}

	dispose(): void {
		DashboardPanel.current = undefined;
		this.panel.dispose();
		while (this.disposables.length) {
			this.disposables.pop()?.dispose();
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
			drafts: this.index.listDrafts(),
		});
	}

	private async onMessage(msg: { type: string; [key: string]: unknown }): Promise<void> {
		try {
			switch (msg.type) {
				case 'ready':
					await this.postBootstrap();
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
					this.panel.webview.postMessage({ type: 'sent', result });
					void vscode.window.showInformationMessage('Email sent');
					break;
				}
				case 'saveDraft': {
					const draft = await this.index.saveDraft(msg.draft as Parameters<EmailIndex['saveDraft']>[0]);
					this.panel.webview.postMessage({ type: 'draftSaved', draft, drafts: this.index.listDrafts() });
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

/** Sidebar webview view that opens the full dashboard panel. */
export class EmailSidebarProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'safeappeals-email.sidebar';

	constructor(private readonly openDashboard: () => void) {}


	resolveWebviewView(webviewView: vscode.WebviewView): void {
		const nonce = randomUUID();
		webviewView.webview.options = { enableScripts: true };
		webviewView.webview.html = `<!DOCTYPE html>
<html><body style="padding:12px;font-family:var(--vscode-font-family);color:var(--vscode-foreground);background:var(--vscode-sideBar-background);">
	<p style="margin:0 0 12px;">Safe Appeals Email</p>
	<button id="open" style="background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;padding:8px 12px;border-radius:2px;cursor:pointer;width:100%;">
		Open Email Dashboard
	</button>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		document.getElementById('open').addEventListener('click', () => vscode.postMessage({ type: 'open' }));
	</script>
</body></html>`;
		webviewView.webview.onDidReceiveMessage((msg) => {
			if (msg?.type === 'open') {
				this.openDashboard();
			}
		});
	}
}

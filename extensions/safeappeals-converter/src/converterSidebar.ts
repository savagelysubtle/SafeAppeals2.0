/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { ConverterService } from './converterService';

/**
 * Compact activity-bar sidebar for converter status and quick access to the dashboard.
 */
export class ConverterSidebarProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'safeappeals-converter.sidebar';
	private static current: ConverterSidebarProvider | undefined;

	private view: vscode.WebviewView | undefined;
	private readonly viewDisposables: vscode.Disposable[] = [];

	constructor(
		private readonly extensionUri: vscode.Uri,
		private readonly getService: () => ConverterService | undefined,
		private readonly openDashboard: () => void,
	) {
		ConverterSidebarProvider.current = this;
	}

	static refreshIfResolved(): void {
		void ConverterSidebarProvider.current?.refresh();
	}

	async refresh(): Promise<void> {
		await this.postBootstrap();
	}

	resolveWebviewView(webviewView: vscode.WebviewView): void {
		this.disposeViewState();
		this.view = webviewView;

		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.joinPath(this.extensionUri, 'media', 'dashboard'),
				this.extensionUri,
			],
		};
		webviewView.webview.html = getSidebarHtml(webviewView.webview, this.extensionUri);

		const service = this.getService();
		if (service) {
			this.viewDisposables.push(
				service.onConversionsChanged(() => {
					void this.postBootstrap();
				}),
			);
		}

		this.viewDisposables.push(
			webviewView.webview.onDidReceiveMessage(msg => {
				void this.onMessage(msg as SidebarToHostMessage);
			}),
		);

		webviewView.onDidDispose(() => {
			if (this.view === webviewView) {
				this.disposeViewState();
			}
		});

		void this.postBootstrap();
	}

	private async onMessage(message: SidebarToHostMessage): Promise<void> {
		switch (message.type) {
			case 'ready':
				await this.postBootstrap();
				return;
			case 'openDashboard':
				this.openDashboard();
				return;
		}
	}

	private async postBootstrap(): Promise<void> {
		if (!this.view) {
			return;
		}

		const service = this.getService();
		let sidecarReady = false;
		let sidecarError: string | undefined;
		let availableCount = 0;
		let totalCount = 0;

		if (!service) {
			sidecarError = vscode.l10n.t('Converter service is not available.');
		} else if (!service.isSidecarAvailable) {
			sidecarError = vscode.l10n.t(
				'sa-converter not found. Build rust/converter or set SAFEAPPEALS_CONVERTER_PATH.',
			);
		} else {
			try {
				const conversions = await service.refreshAvailableConversions();
				totalCount = Object.keys(conversions.conversions).length;
				availableCount = Object.values(conversions.conversions).filter(c => c.available).length;
				sidecarReady = true;
			} catch (err) {
				sidecarError = err instanceof Error ? err.message : String(err);
			}
		}

		this.view.webview.postMessage({
			type: 'bootstrap',
			sidecarReady,
			sidecarError,
			conversionSummary: sidecarReady && totalCount > 0
				? vscode.l10n.t('{0} of {1} conversions available', String(availableCount), String(totalCount))
				: undefined,
		});
	}

	private disposeViewState(): void {
		while (this.viewDisposables.length) {
			this.viewDisposables.pop()?.dispose();
		}
		this.view = undefined;
	}
}

type SidebarToHostMessage =
	| { type: 'ready' }
	| { type: 'openDashboard' };

function getSidebarHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
	const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'dashboard', 'dashboard.css'));
	const cspSource = webview.cspSource;
	const nonce = getNonce();

	const title = vscode.l10n.t('File Converter');
	const readyLabel = vscode.l10n.t('Sidecar ready');
	const missingLabel = vscode.l10n.t('Sidecar not available');
	const openDashboardLabel = vscode.l10n.t('Open Converter');
	const hintLabel = vscode.l10n.t(
		'Build the sa-converter binary from rust/converter, or set SAFEAPPEALS_CONVERTER_PATH to an existing binary.',
	);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<link href="${styleUri}" rel="stylesheet">
	<title>${escapeHtml(title)}</title>
	<style>
		body { padding: 12px; }
		.sidebar-header { margin-bottom: 12px; }
		.sidebar-header h1 { margin: 0 0 4px; font-size: 1.1rem; font-weight: 600; }
		.sidebar-header p { margin: 0; color: var(--muted); font-size: 0.85rem; }
		.status-banner.ok {
			background: rgba(115, 201, 145, 0.12);
			border: 1px solid var(--success);
			color: var(--success);
		}
		.conversion-count { margin: 0 0 12px; font-size: 0.85rem; color: var(--muted); }
		.actions { display: flex; flex-direction: column; gap: 8px; }
		.actions button { width: 100%; }
	</style>
</head>
<body>
	<div class="sidebar-header">
		<h1>${escapeHtml(title)}</h1>
		<p>${escapeHtml(vscode.l10n.t('Convert case documents within your workspace.'))}</p>
	</div>
	<div id="status-banner" class="status-banner hidden"></div>
	<p id="conversion-count" class="conversion-count hidden"></p>
	<div id="install-hint" class="guidance hidden"></div>
	<div class="actions">
		<button id="open-dashboard" type="button" class="primary">${escapeHtml(openDashboardLabel)}</button>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const readyLabel = ${JSON.stringify(readyLabel)};
		const missingLabel = ${JSON.stringify(missingLabel)};

		const statusBanner = document.getElementById('status-banner');
		const conversionCount = document.getElementById('conversion-count');
		const installHint = document.getElementById('install-hint');
		const openDashboardBtn = document.getElementById('open-dashboard');

		openDashboardBtn.addEventListener('click', () => {
			vscode.postMessage({ type: 'openDashboard' });
		});

		window.addEventListener('message', (event) => {
			const msg = event.data;
			if (msg.type !== 'bootstrap') {
				return;
			}

			statusBanner.classList.remove('hidden', 'ok', 'error');
			installHint.classList.add('hidden');
			conversionCount.classList.add('hidden');

			if (msg.sidecarReady) {
				statusBanner.textContent = readyLabel;
				statusBanner.classList.add('ok');
				if (msg.conversionSummary) {
					conversionCount.textContent = msg.conversionSummary;
					conversionCount.classList.remove('hidden');
				}
			} else {
				statusBanner.textContent = msg.sidecarError || missingLabel;
				statusBanner.classList.add('error');
				installHint.textContent = ${JSON.stringify(hintLabel)};
				installHint.classList.remove('hidden');
			}
		});

		vscode.postMessage({ type: 'ready' });
	</script>
</body>
</html>`;
}

function getNonce(): string {
	const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let nonce = '';
	for (let i = 0; i < 32; i++) {
		nonce += alphabet.charAt(Math.floor(Math.random() * alphabet.length));
	}
	return nonce;
}

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

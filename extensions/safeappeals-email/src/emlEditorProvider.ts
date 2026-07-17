/*--------------------------------------------------------------------------------------
 *  Custom editor for *.eml — minimum viable port of emailViewer*
 *--------------------------------------------------------------------------------------*/

import { randomUUID } from 'crypto';
import * as vscode from 'vscode';
import type { EmailIndex } from './emailIndex';
import { parseEmlFile } from './emlParser';

class EmlDocument implements vscode.CustomDocument {
	constructor(
		public readonly uri: vscode.Uri,
		public readonly messageId: string,
	) {}

	dispose(): void {
		// no-op
	}
}

export class EmlEditorProvider implements vscode.CustomReadonlyEditorProvider<EmlDocument> {
	public static readonly viewType = 'safeappeals.emlViewer';

	public static register(
		context: vscode.ExtensionContext,
		index: EmailIndex,
		log: (msg: string) => void,
	): vscode.Disposable {
		const provider = new EmlEditorProvider(context, index, log);
		return vscode.window.registerCustomEditorProvider(
			EmlEditorProvider.viewType,
			provider,
			{
				webviewOptions: { retainContextWhenHidden: true },
				supportsMultipleEditorsPerDocument: false,
			},
		);
	}

	private constructor(
		private readonly context: vscode.ExtensionContext,
		private readonly index: EmailIndex,
		private readonly log: (msg: string) => void,
	) {}

	async openCustomDocument(
		uri: vscode.Uri,
		_openContext: vscode.CustomDocumentOpenContext,
		_token: vscode.CancellationToken,
	): Promise<EmlDocument> {
		const id = this.index.generateEmailId(uri.fsPath);
		try {
			const parsed = await parseEmlFile(uri.fsPath, {
				id,
				accountId: 'local',
				caseFolderPath: vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath,
			});
			await this.index.upsertMessage(parsed);
			// TODO(rung12): classify on import via classifierSeam
			this.log(`Parsed .eml ${uri.fsPath}`);
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			this.log(`Failed to parse .eml: ${message}`);
			void vscode.window.showErrorMessage(`Failed to parse email: ${message}`);
		}
		return new EmlDocument(uri, id);
	}

	async resolveCustomEditor(
		document: EmlDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		const mediaRoot = vscode.Uri.joinPath(this.context.extensionUri, 'media', 'eml');
		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [mediaRoot, this.context.extensionUri],
		};
		webviewPanel.webview.html = this.getHtml(webviewPanel.webview, mediaRoot);

		const message = this.index.getMessage(document.messageId);
		const send = () => {
			webviewPanel.webview.postMessage({
				type: 'loadEmail',
				message: message || {
					id: document.messageId,
					subject: document.uri.fsPath,
					from: '',
					to: '',
					bodyText: 'Unable to load message.',
					bodyHtml: undefined,
					date: new Date().toISOString(),
					attachments: [],
				},
			});
		};

		webviewPanel.webview.onDidReceiveMessage((msg) => {
			if (msg?.type === 'ready') {
				send();
			}
		});
		// Also push after a tick in case ready already fired
		setTimeout(send, 50);
	}

	private getHtml(webview: vscode.Webview, mediaRoot: vscode.Uri): string {
		const nonce = randomUUID();
		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, 'emlViewer.js'));
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
	<title>Email Viewer</title>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
	}
}

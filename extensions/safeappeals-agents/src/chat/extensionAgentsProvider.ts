/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { EXTENSION_AGENT_FILES } from './extensionAgents';

/**
 * Provides SafeAppeals extension agents via the proposed ChatCustomAgentProvider API.
 * These agents appear in the agent picker and can be invoked by users, but are not
 * editable in the AI Customization editor (since they come from an extension).
 */
export class ExtensionAgentsProvider implements vscode.ChatCustomAgentProvider, vscode.Disposable {
	private readonly _disposables: vscode.Disposable[] = [];
	private readonly _onDidChangeCustomAgents = new vscode.EventEmitter<void>();
	readonly onDidChangeCustomAgents = this._onDidChangeCustomAgents.event;

	constructor(private readonly context: vscode.ExtensionContext) {
		this._disposables.push(this._onDidChangeCustomAgents);
	}

	async provideCustomAgents(
		_context: unknown,
		_token: vscode.CancellationToken,
	): Promise<vscode.ChatResource[]> {
		const agents: vscode.ChatResource[] = [];

		for (const file of EXTENSION_AGENT_FILES) {
			// Create a virtual file URI under the extension's path
			const fileUri = vscode.Uri.joinPath(
				this.context.extensionUri,
				'agents',
				file.fileName
			);

			// Write the agent file to the extension's output directory
			await this.writeAgentFile(fileUri, file.content);

			agents.push({
				uri: fileUri,
				sessionTypes: ['local', 'remote']
			});
		}

		return agents;
	}

	private async writeAgentFile(fileUri: vscode.Uri, content: string): Promise<void> {
		try {
			await vscode.workspace.fs.writeFile(fileUri, Buffer.from(content, 'utf8'));
		} catch (error) {
			// File might already exist, that's fine
			console.debug(`[SafeAppeals Agents] Could not write ${fileUri.fsPath}:`, error);
		}
	}

	dispose(): void {
		for (const disposable of this._disposables) {
			disposable.dispose();
		}
		this._disposables.length = 0;
	}
}

/**
 * Registers the extension agents provider when the proposed API is available.
 */
export function registerExtensionAgentsProvider(context: vscode.ExtensionContext): vscode.Disposable {
	if (!('registerCustomAgentProvider' in vscode.chat)) {
		return new vscode.Disposable(() => { });
	}

	const provider = new ExtensionAgentsProvider(context);
	const registration = (vscode.chat as any).registerCustomAgentProvider(provider);

	return vscode.Disposable.from(provider, registration);
}
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { resolveModeId } from './switchModeHelpers';
import { SAFEAPPEALS_SWITCH_MODE_TOOL } from './toolAllowlist';

type SwitchMode = 'Plan' | 'Agent';

interface SwitchModeInput {
	mode: SwitchMode;
}

function textResult(message: string): vscode.LanguageModelToolResult {
	return new vscode.LanguageModelToolResult([
		new vscode.LanguageModelTextPart(message),
	]);
}

function isSwitchModeEnabled(): boolean {
	const enabled = vscode.workspace.getConfiguration('safeappeals.chat.switchMode').get<boolean>('enabled');
	return enabled !== false;
}

class SwitchModeTool implements vscode.LanguageModelTool<SwitchModeInput> {
	async prepareInvocation(
		options: vscode.LanguageModelToolInvocationPrepareOptions<SwitchModeInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.PreparedToolInvocation> {
		const mode = options.input?.mode;
		if (mode === 'Plan' || mode === 'Agent') {
			return {
				invocationMessage: `Switching to ${mode}`,
			};
		}
		return {
			invocationMessage: 'Switching mode',
		};
	}

	async invoke(
		options: vscode.LanguageModelToolInvocationOptions<SwitchModeInput>,
		_token: vscode.CancellationToken,
	): Promise<vscode.LanguageModelToolResult> {
		if (!isSwitchModeEnabled()) {
			return textResult('Error: Mode switching is disabled (safeappeals.chat.switchMode.enabled).');
		}

		const mode = options.input?.mode;
		const modeId = typeof mode === 'string' ? resolveModeId(mode) : undefined;
		if (!modeId) {
			return textResult('Error: mode must be "Plan" or "Agent".');
		}

		try {
			const result = await vscode.commands.executeCommand<ToggleAgentModeResult>(
				'workbench.action.chat.toggleAgentMode',
				{
					modeId,
					sessionResource: options.chatSessionResource,
				},
			);
			if (!result || typeof result !== 'object' || result.ok !== true) {
				if (result && typeof result === 'object' && result.reason === 'modeNotFound') {
					return textResult(
						`Error: Could not switch to ${mode} mode — that mode is not available in this chat session ` +
						`(Plan requires the Plan custom agent to be registered). Stayed in the current mode.`,
					);
				}
				return textResult(`Error: Mode switch to ${mode} failed or was cancelled. Stayed in the current mode.`);
			}
			return textResult(`Switched to ${mode} mode.`);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return textResult(`Error switching to ${mode}: ${message}`);
		}
	}
}

interface ToggleAgentModeResult {
	readonly ok: boolean;
	readonly reason?: 'modeNotFound' | 'cancelled' | 'noWidget';
	readonly modeId?: string;
}

/**
 * Registers the bidirectional Agent↔Plan mode switch tool.
 */
export function registerSwitchModeTool(): vscode.Disposable {
	return vscode.lm.registerTool<SwitchModeInput>(SAFEAPPEALS_SWITCH_MODE_TOOL, new SwitchModeTool());
}

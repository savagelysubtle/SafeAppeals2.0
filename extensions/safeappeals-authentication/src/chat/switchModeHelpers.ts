/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Maps tool input mode to `toggleAgentMode` modeId (`Plan` by name, `agent` by builtin kind).
 */
export function resolveModeId(mode: string): string | undefined {
	if (mode === 'Plan') {
		return 'Plan';
	}
	if (mode === 'Agent') {
		return 'agent';
	}
	return undefined;
}

export interface ModeReminderOptions {
	readonly modeName?: string;
	readonly modeContent?: string;
}

/**
 * Builds the per-turn mode banner + switch rules for the SafeAppeals agent loop.
 * Pure helper (no vscode import) for unit tests.
 */
export function buildModeReminderMessage(options: ModeReminderOptions = {}): string {
	const modeName = options.modeName?.trim() || 'Agent';
	const lines = [
		`You are currently running in "${modeName}" mode.`,
		'',
		'Mode switching rules (mandatory):',
		'- You already know your current mode from this message. NEVER ask the user which mode to use.',
		'- When the task needs research, architecture, or a multi-step plan, call safeappeals_switchMode with mode "Plan" yourself before planning.',
		'- When planning is done and you should implement or edit files, call safeappeals_switchMode with mode "Agent" yourself.',
		'- When the user asks to implement/edit or needs planning while you are in Ask (or any mode without tools for that work), call safeappeals_switchMode with "Agent" or "Plan" yourself.',
		'- Do not narrate mode choices to the user; just call the tool when a switch is required.',
	];
	const content = options.modeContent?.trim();
	if (content) {
		lines.push('', 'Mode-specific instructions (take precedence over general guidance):', content);
	}
	return lines.join('\n');
}

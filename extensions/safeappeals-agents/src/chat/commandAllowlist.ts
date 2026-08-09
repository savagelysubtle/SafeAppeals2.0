/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Command id prefixes considered safe enough to run without an extra confirmation prompt.
 *
 * Note: `git.` includes remote-facing commands (e.g. push). Agents must still follow
 * git privacy rules — never push legal/client matter workspaces without explicit user
 * confirmation after a confidentiality warning. Do not block local `git.commit`.
 */
const SAFE_COMMAND_PREFIXES: readonly string[] = [
	'editor.',
	'workbench.action.files.',
	'workbench.action.navigate',
	'workbench.action.close',
	'workbench.action.split',
	'workbench.action.focus',
	'workbench.action.toggle',
	'workbench.files.',
	'workbench.view.',
	'workbench.action.show',
	'workbench.action.open',
	'explorer.',
	'search.',
	'git.',
	'markdown.',
	'references-',
	'editor.action.',
	'vscode.open',
	'vscode.openWith',
	'vscode.diff',
	'safeappeals.',
];

/** Command ids / prefixes that are never executed. */
const BLOCKED_COMMAND_PREFIXES: readonly string[] = [
	'workbench.action.quit',
	'workbench.action.reloadWindow',
	'workbench.action.terminal.sendSequence',
	'workbench.action.terminal.kill',
	'workbench.extensions.install',
	'workbench.extensions.uninstall',
	'workbench.action.scripts.',
];

export function isBlockedVscodeCommand(commandId: string): boolean {
	const id = commandId.trim();
	return BLOCKED_COMMAND_PREFIXES.some(prefix => id === prefix || id.startsWith(prefix));
}

export function isSafeVscodeCommand(commandId: string): boolean {
	const id = commandId.trim();
	if (!id || isBlockedVscodeCommand(id)) {
		return false;
	}
	return SAFE_COMMAND_PREFIXES.some(prefix => id === prefix || id.startsWith(prefix));
}

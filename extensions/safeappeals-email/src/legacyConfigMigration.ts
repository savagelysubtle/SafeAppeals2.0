/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';

export async function clearLegacySetting(
	configuration: Pick<vscode.WorkspaceConfiguration, 'inspect' | 'update'>,
	key: string,
	target: vscode.ConfigurationTarget,
): Promise<boolean> {
	if (!configuration.inspect(key)) {
		return true;
	}
	try {
		await configuration.update(key, undefined, target);
		return true;
	} catch {
		return false;
	}
}

export async function clearLegacySettingAtAllScopes(
	configuration: Pick<vscode.WorkspaceConfiguration, 'inspect' | 'update'>,
	key: string,
): Promise<readonly vscode.ConfigurationTarget[]> {
	const inspected = configuration.inspect(key);
	if (!inspected) {
		return [];
	}
	const targets: vscode.ConfigurationTarget[] = [];
	if (inspected.globalValue !== undefined) targets.push(1 as vscode.ConfigurationTarget);
	if (inspected.workspaceValue !== undefined) targets.push(2 as vscode.ConfigurationTarget);
	if (inspected.workspaceFolderValue !== undefined) targets.push(3 as vscode.ConfigurationTarget);
	const failed: vscode.ConfigurationTarget[] = [];
	for (const target of targets) {
		if (!await clearLegacySetting(configuration, key, target)) {
			failed.push(target);
		}
	}
	return failed;
}

export function legacyString(
	configuration: Pick<vscode.WorkspaceConfiguration, 'inspect'>,
	key: string,
): string {
	const inspected = configuration.inspect<string>(key);
	return inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue ?? '';
}

export function legacyValue<T>(
	configuration: Pick<vscode.WorkspaceConfiguration, 'inspect'>,
	key: string,
): T | undefined {
	const inspected = configuration.inspect<T>(key);
	return inspected?.workspaceFolderValue ?? inspected?.workspaceValue ?? inspected?.globalValue;
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { editCaseInfo, initCase, openCaseBrief } from './caseFiles';
import { runProfileSetup } from './profile';

export function activate(context: vscode.ExtensionContext): void {
	context.subscriptions.push(
		vscode.commands.registerCommand('safeappeals-case.setupProfile', () => runProfileSetup()),
		vscode.commands.registerCommand('safeappeals-case.initCase', () => initCase()),
		vscode.commands.registerCommand('safeappeals-case.editCaseInfo', () => editCaseInfo()),
		vscode.commands.registerCommand('safeappeals-case.openCaseBrief', () => openCaseBrief()),
	);
}

export function deactivate(): void {
	// nothing to clean up
}

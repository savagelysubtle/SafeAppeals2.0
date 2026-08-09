/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import type * as vscode from 'vscode';

let channel: vscode.OutputChannel | undefined;

export function initializeLogger(context: vscode.ExtensionContext, outputChannel: vscode.OutputChannel): void {
	channel = outputChannel;
	context.subscriptions.push(channel);
}

export function logInfo(message: string): void {
	channel?.appendLine(`[info] ${message}`);
}

export function logWarning(message: string): void {
	channel?.appendLine(`[warning] ${message}`);
}

export function logError(message: string): void {
	channel?.appendLine(`[error] ${message}`);
}

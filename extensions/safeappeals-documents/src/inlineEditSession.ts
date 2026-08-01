/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';

/** Active Ctrl+K requests keyed by document URI — cancelled when the popup closes. */
const activeInlineEditTokens = new Map<string, vscode.CancellationTokenSource>();

/**
 * Begin a cancellable inline-edit session for `uriString`.
 * Cancels any prior session for the same URI.
 */
export function beginInlineEditSession(uriString: string): vscode.CancellationTokenSource {
	const previous = activeInlineEditTokens.get(uriString);
	if (previous) {
		previous.cancel();
		previous.dispose();
	}
	const cts = new vscode.CancellationTokenSource();
	activeInlineEditTokens.set(uriString, cts);
	return cts;
}

/**
 * End the session if `cts` is still the active one for `uriString`.
 */
export function endInlineEditSession(uriString: string, cts: vscode.CancellationTokenSource): void {
	const current = activeInlineEditTokens.get(uriString);
	if (current === cts) {
		activeInlineEditTokens.delete(uriString);
	}
	cts.dispose();
}

/**
 * Cancel an in-flight inline edit for `uriString`, or all active edits when omitted.
 */
export function cancelDocumentInlineEdit(uriString?: string): void {
	if (uriString) {
		const cts = activeInlineEditTokens.get(uriString);
		if (cts) {
			cts.cancel();
			activeInlineEditTokens.delete(uriString);
			cts.dispose();
		}
		return;
	}
	for (const [key, cts] of activeInlineEditTokens) {
		cts.cancel();
		cts.dispose();
		activeInlineEditTokens.delete(key);
	}
}

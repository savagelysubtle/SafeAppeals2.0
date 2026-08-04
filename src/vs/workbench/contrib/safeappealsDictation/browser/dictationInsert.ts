/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Minimal chat-input surface used by `_chat.dictation.insertText`.
 * Intentionally omits `acceptInput` — dictation must never send.
 */
export interface IDictationInsertTarget {
	getInput(): string;
	setInput(query?: string): void;
}

/**
 * Appends dictation transcript text to an existing chat input value.
 * Inserts a single spacer space when the existing input is non-empty and
 * does not already end with whitespace.
 */
export function appendDictationText(existing: string, text: string): string {
	if (!text) {
		return existing;
	}
	const spacer = existing.length > 0 && !/\s$/.test(existing) ? ' ' : '';
	return existing + spacer + text;
}

/**
 * Insert transcript into chat input via setInput only — never acceptInput.
 */
export function insertDictationIntoChat(widget: IDictationInsertTarget, text: string): void {
	if (!text) {
		return;
	}
	widget.setInput(appendDictationText(widget.getInput(), text));
}

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/**
 * Kind of agent document operation used for open/closed routing.
 * - `selection`: replaceSelection / useLastSelection — open + ready only (fail closed).
 * - `structured`: ops that work in the webview or headlessly.
 * - `overwrite`: full buffer rewrite (e.g. DOCX title/blocks).
 * - `read`: prefer live webview text when ready; otherwise disk/headless when safe.
 */
export type DocumentEditOpKind = 'selection' | 'structured' | 'overwrite' | 'read';

export type DocumentEditPath = 'open' | 'headless' | 'error';

export interface ChooseDocumentEditPathArgs {
	isOpen: boolean;
	isReady: boolean;
	isDirty: boolean;
	opKind: DocumentEditOpKind;
}

/**
 * Pure routing decision for agent document tools.
 *
 * Call after optionally awaiting readiness when the editor is open but not yet ready.
 * When still not ready: headless is allowed only if the document is not dirty
 * (dirty + not ready must not clobber TipTap/WASM state).
 */
export function chooseDocumentEditPath(args: ChooseDocumentEditPathArgs): DocumentEditPath {
	const { isOpen, isReady, isDirty, opKind } = args;

	if (opKind === 'selection') {
		return isOpen && isReady ? 'open' : 'error';
	}

	if (!isOpen) {
		return 'headless';
	}

	if (isReady) {
		// Overwrite uses headless write + reload; refuse while dirty so we never
		// clobber unsaved TipTap/WASM edits (same guard as dirty+not-ready).
		if (opKind === 'overwrite') {
			return isDirty ? 'error' : 'headless';
		}
		return 'open';
	}

	// Open but not ready (after await timeout or without waiting).
	if (isDirty) {
		return 'error';
	}
	return 'headless';
}

/** Clear error when dirty open-editor state blocks headless overwrite/fallthrough. */
export const DOCUMENT_NOT_READY_DIRTY_ERROR =
	'The open editor has unsaved changes. Save or discard them, then retry. ' +
	'Headless overwrite/reload cannot run while the document is dirty.';

/** Clear error for selection ops when the editor is closed or not ready. */
export const SELECTION_REQUIRES_OPEN_READY_ERROR =
	'Selection edits require the Safe Appeals editor to be open, ready, and to have a selection.';

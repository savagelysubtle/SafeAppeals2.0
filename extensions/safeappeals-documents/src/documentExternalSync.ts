/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

/** TipTap/WASM often fires dirty/update right after setContent — ignore briefly after load. */
export const EXTERNAL_RELOAD_SETTLE_MS = 1500;

/**
 * After `reloadFromBytes`, the next save must write synced host bytes and must not
 * re-serialize the pre-reload TipTap/WASM model.
 */
export function shouldSkipWebviewSerialize(args: {
	freshFromWebview: boolean;
	freshFromExternalSync: boolean;
}): boolean {
	return args.freshFromWebview || args.freshFromExternalSync;
}

/**
 * While host bytes are authoritative after an external/headless reload, ignore
 * webview contentChanged / saveRequested / saveData payloads so they cannot
 * poison `documentData` before a skipped-serialize save writes host bytes.
 *
 * Flag lifetime (`_freshFromExternalSync`):
 * - Set on `reloadFromBytes` / external reload.
 * - Cleared only after successful `saveAs` / `saveCustomDocumentAs`, or on dispose.
 * - The load-settle timer clears dirty-ignore only — never this authority flag.
 */
export function shouldApplyWebviewDocumentBytes(args: {
	freshFromExternalSync: boolean;
}): boolean {
	return !args.freshFromExternalSync;
}

/**
 * Settle timer must not clear host-byte authority. Documented for tests/callers.
 */
export function settleTimerClearsExternalSyncAuthority(): boolean {
	return false;
}

export function nextIgnoreDirtyUntil(
	nowMs: number,
	settleMs: number = EXTERNAL_RELOAD_SETTLE_MS,
): number {
	return nowMs + settleMs;
}

export function isWithinLoadSettleWindow(ignoreDirtyUntilMs: number, nowMs: number): boolean {
	return nowMs < ignoreDirtyUntilMs;
}

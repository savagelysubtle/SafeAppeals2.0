/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Default max age for a persisted PKCE pending (matches sign-in timeout). */
export const PENDING_SIGN_IN_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Pending PKCE sign-in fields persisted to SecretStorage and APPLICATION globalState
 * for web reload recovery.
 */
export interface PendingSignIn {
	readonly codeVerifier: string;
	readonly state: string;
	readonly startedAt: number;
}

/**
 * Whether an exchange failure should settle (clear) the pending sign-in.
 * Matching-state failures and timeouts settle; mismatched-state exchange
 * failures must keep pending so the real callback can still land (GoTrue may
 * rewrite state; the PKCE verifier binds the code).
 */
export function shouldSettlePendingOnExchangeFailure(stateMatched: boolean): boolean {
	return stateMatched;
}

/**
 * True when GoTrue rejected a replay of a single-use PKCE auth code
 * (`flow_state_not_found` / expired / "invalid flow state"). Callers should
 * try adopting a session already written to SecretStorage before toasting.
 */
export function isPkceFlowStateReplayError(message: string): boolean {
	const normalized = message.toLowerCase();
	return (
		normalized.includes('invalid flow state')
		|| normalized.includes('flow_state_not_found')
		|| normalized.includes('flow_state_expired')
	);
}

/**
 * Parses a persisted pending-sign-in payload, returning undefined when missing,
 * malformed, or older than {@link maxAgeMs}.
 */
export function parseRestoredPendingSignIn(
	raw: string | undefined,
	nowMs: number = Date.now(),
	maxAgeMs: number = PENDING_SIGN_IN_MAX_AGE_MS,
): PendingSignIn | undefined {
	if (!raw) {
		return undefined;
	}
	try {
		const parsed = JSON.parse(raw) as Partial<PendingSignIn>;
		if (
			typeof parsed.codeVerifier !== 'string'
			|| !parsed.codeVerifier
			|| typeof parsed.state !== 'string'
			|| !parsed.state
			|| typeof parsed.startedAt !== 'number'
			|| !Number.isFinite(parsed.startedAt)
		) {
			return undefined;
		}
		if (nowMs - parsed.startedAt > maxAgeMs) {
			return undefined;
		}
		return {
			codeVerifier: parsed.codeVerifier,
			state: parsed.state,
			startedAt: parsed.startedAt,
		};
	} catch {
		return undefined;
	}
}

/** Where a restored pending PKCE payload was loaded from. */
export type PendingSignInSource = 'secrets' | 'globalState' | 'localStorage';

/**
 * A pending sign-in paired with the store it was restored from.
 */
export interface PendingSignInWithSource {
	readonly pending: PendingSignIn;
	readonly source: PendingSignInSource;
}

/**
 * Picks the newest pending among candidates by {@link PendingSignIn.startedAt}.
 * On ties, prefers `localStorage` when {@link preferLocalStorageOnTie} is true
 * so a fresh web createSession wins over a stale secrets/globalState copy.
 */
export function pickNewestPending(
	candidates: readonly (PendingSignInWithSource | undefined)[],
	preferLocalStorageOnTie: boolean = true,
): PendingSignInWithSource | undefined {
	let winner: PendingSignInWithSource | undefined;
	for (const candidate of candidates) {
		if (!candidate) {
			continue;
		}
		if (!winner) {
			winner = candidate;
			continue;
		}
		if (candidate.pending.startedAt > winner.pending.startedAt) {
			winner = candidate;
			continue;
		}
		if (
			preferLocalStorageOnTie
			&& candidate.pending.startedAt === winner.pending.startedAt
			&& candidate.source === 'localStorage'
			&& winner.source !== 'localStorage'
		) {
			winner = candidate;
		}
	}
	return winner;
}

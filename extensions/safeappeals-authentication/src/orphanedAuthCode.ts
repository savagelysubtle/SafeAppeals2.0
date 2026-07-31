/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** globalState key for an auth code that arrived before pending PKCE was ready. */
export const ORPHANED_AUTH_CODE_KEY = 'safeappeals-cloud.orphanedAuthCode';

/** Default max age for a stashed orphaned auth code (matches sign-in timeout). */
export const ORPHANED_AUTH_CODE_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * Auth code stashed when the OAuth callback arrived with no pending PKCE yet.
 */
export interface OrphanedAuthCode {
	readonly code: string;
	readonly state: string;
	readonly ts: number;
}

/**
 * Parses a stashed orphaned auth code, returning undefined when missing, malformed,
 * or older than {@link maxAgeMs}.
 */
export function parseOrphanedAuthCode(
	raw: unknown,
	nowMs: number = Date.now(),
	maxAgeMs: number = ORPHANED_AUTH_CODE_MAX_AGE_MS,
): OrphanedAuthCode | undefined {
	if (raw === undefined || raw === null) {
		return undefined;
	}
	let parsed: Partial<OrphanedAuthCode>;
	try {
		parsed = (typeof raw === 'string' ? JSON.parse(raw) : raw) as Partial<OrphanedAuthCode>;
	} catch {
		return undefined;
	}
	if (
		typeof parsed.code !== 'string'
		|| !parsed.code
		|| typeof parsed.state !== 'string'
		|| !parsed.state
		|| typeof parsed.ts !== 'number'
		|| !Number.isFinite(parsed.ts)
	) {
		return undefined;
	}
	if (nowMs - parsed.ts > maxAgeMs) {
		return undefined;
	}
	return {
		code: parsed.code,
		state: parsed.state,
		ts: parsed.ts,
	};
}

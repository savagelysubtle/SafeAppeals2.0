/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createHash, randomBytes } from 'crypto';

/** RFC 7636 unreserved charset for code_verifier. */
const VERIFIER_CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';

/**
 * PKCE pair plus CSRF state for the SafeAppeals Cloud authorize redirect.
 */
export interface PkceChallenge {
	readonly codeVerifier: string;
	readonly codeChallenge: string;
	readonly state: string;
}

/**
 * Generates a crypto-random PKCE verifier (43–128 chars), S256 challenge, and state.
 */
export function generatePkceChallenge(): PkceChallenge {
	const codeVerifier = randomString(64, VERIFIER_CHARSET);
	const codeChallenge = base64UrlEncode(createHash('sha256').update(codeVerifier).digest());
	const state = randomString(32, VERIFIER_CHARSET);
	return { codeVerifier, codeChallenge, state };
}

/**
 * Builds a crypto-random string of `length` characters from `charset`.
 */
function randomString(length: number, charset: string): string {
	const bytes = randomBytes(length);
	let result = '';
	for (let i = 0; i < length; i++) {
		result += charset[bytes[i] % charset.length];
	}
	return result;
}

/**
 * Base64url-encodes a buffer without padding (RFC 7636).
 */
function base64UrlEncode(buffer: Buffer): string {
	return buffer.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

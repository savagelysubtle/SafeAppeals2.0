/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Exact hostnames permitted for checkout / pricing openExternal targets.
 * Server-returned URLs are untrusted and must pass this allow-list.
 */
const ALLOWED_EXTERNAL_HOSTS = new Set([
	'safeappeals.com',
	'www.safeappeals.com',
	'api.safeappeals.com',
	'checkout.stripe.com',
]);

/**
 * Returns true when `url` is https, has no userinfo, and the hostname is
 * allow-listed (exact match or a subdomain of safeappeals.com).
 */
export function isAllowedExternalHttpsUrl(url: string): boolean {
	if (typeof url !== 'string' || url.length === 0 || url.length > 2048) {
		return false;
	}
	let parsed: URL;
	try {
		parsed = new URL(url);
	} catch {
		return false;
	}
	if (parsed.protocol !== 'https:') {
		return false;
	}
	if (parsed.username || parsed.password) {
		return false;
	}
	const host = parsed.hostname.toLowerCase();
	if (ALLOWED_EXTERNAL_HOSTS.has(host)) {
		return true;
	}
	return host.endsWith('.safeappeals.com') && host.length > '.safeappeals.com'.length;
}

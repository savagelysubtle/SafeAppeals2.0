/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Default production SafeAppeals Cloud API origin. */
export const DEFAULT_API_URL = 'https://api.safeappeals.com';

/**
 * Inputs for resolving the Cloud API base URL (pure; no vscode / process).
 */
export interface ResolveApiUrlOptions {
	readonly isDev: boolean;
	readonly envUrl?: string;
	readonly debugSettingUrl?: string;
}

/**
 * Strips whitespace and trailing slashes from an API origin override.
 */
function normalizeApiUrl(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	if (!trimmed) {
		return undefined;
	}
	return trimmed.replace(/\/+$/, '');
}

/**
 * Resolves the Cloud API origin.
 *
 * Production always returns {@link DEFAULT_API_URL}. Dev builds may override via
 * `SAFEAPPEALS_CLOUD_API_URL` (preferred) or the machine-scoped debug setting.
 */
export function resolveApiUrl(options: ResolveApiUrlOptions): string {
	if (!options.isDev) {
		return DEFAULT_API_URL;
	}
	return normalizeApiUrl(options.envUrl)
		?? normalizeApiUrl(options.debugSettingUrl)
		?? DEFAULT_API_URL;
}

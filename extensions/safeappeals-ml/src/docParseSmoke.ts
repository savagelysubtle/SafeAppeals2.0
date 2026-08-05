/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Post-install smoke for Unlimited-OCR: ping the localhost DocParse sidecar `/health`.
 * Kept in safeappeals-ml so ConsentInstall can run without importing the RAG extension.
 * Fail-closed: only loopback hosts are contacted.
 */

export const DEFAULT_DOCPARSE_SMOKE_URL = 'http://127.0.0.1:8742';
export const DOCPARSE_SMOKE_URL_ENV = 'SAFEAPPEALS_DOCPARSE_URL';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export type SmokeFetch = (
	url: string,
	init?: { method?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;

/**
 * Reject non-loopback URLs so install smoke never phones home.
 */
export function assertLoopbackSmokeUrl(baseUrl: string): string {
	const trimmed = baseUrl?.trim();
	if (!trimmed) {
		throw new Error('DocParse smoke URL is empty; only localhost is allowed.');
	}
	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		throw new Error(`DocParse smoke URL is invalid: ${baseUrl}`);
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error(`DocParse smoke URL must use http(s) on loopback.`);
	}
	const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
	if (!LOOPBACK_HOSTS.has(host)) {
		throw new Error(
			`DocParse smoke URL must be localhost-only; refused host "${parsed.hostname}".`,
		);
	}
	return trimmed.replace(/\/+$/, '');
}

export function resolveDocParseSmokeBaseUrl(
	env: NodeJS.ProcessEnv = process.env,
	fallback: string = DEFAULT_DOCPARSE_SMOKE_URL,
): string {
	const fromEnv = env[DOCPARSE_SMOKE_URL_ENV]?.trim();
	return assertLoopbackSmokeUrl(fromEnv || fallback);
}

/**
 * GET `{base}/health` and require `{ ok: true }`. Throws on any failure.
 */
export async function smokeDocParseHealth(options: {
	readonly baseUrl?: string;
	readonly fetchImpl?: SmokeFetch;
	readonly env?: NodeJS.ProcessEnv;
} = {}): Promise<void> {
	const baseUrl = assertLoopbackSmokeUrl(
		options.baseUrl ?? resolveDocParseSmokeBaseUrl(options.env),
	);
	const fetchImpl = options.fetchImpl ?? defaultSmokeFetch;
	const healthUrl = `${baseUrl}/health`;
	assertLoopbackSmokeUrl(healthUrl);

	const response = await fetchImpl(healthUrl, { method: 'GET' });
	if (!response.ok) {
		throw new Error(`DocParse /health returned HTTP ${response.status}`);
	}
	const body = (await response.json()) as { ok?: boolean };
	if (body.ok !== true) {
		throw new Error('DocParse /health did not report ok: true');
	}
}

const defaultSmokeFetch: SmokeFetch = async (url, init) => {
	assertLoopbackSmokeUrl(url);
	const response = await fetch(url, { method: init?.method ?? 'GET' });
	return {
		ok: response.ok,
		status: response.status,
		json: () => response.json(),
	};
};

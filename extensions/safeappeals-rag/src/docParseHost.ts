/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import type { CitationAnchor } from './types';

/**
 * SPIKE / production bridge notes (Unlimited-OCR CUDA/vLLM runner):
 *
 * Inference MUST stay out of the extension host. Point this client at a localhost
 * sidecar that loads Unlimited-OCR (or a compatible PDF→Markdown VLM):
 *
 * 1. Setting (machine-scoped): `safeappeals.rag.docParseSidecarUrl`
 *    Default: `http://127.0.0.1:8742`
 * 2. Env override (wins over setting): `SAFEAPPEALS_DOCPARSE_URL`
 *
 * Expected HTTP protocol (JSON):
 * - `GET  {base}/health` → `{ "ok": true, "model"?: string }`
 * - `POST {base}/parse`  body:
 *     `{ "sourceUri", "pdfBase64", "pageFrom"?: number, "pageTo"?: number }`
 *   → `{ "markdown", "pageCount", "anchors"?: CitationAnchor[] }`
 *
 * Fail-closed: only loopback hosts (`127.0.0.1`, `localhost`, `::1`) are allowed.
 * A real vLLM/CUDA runner is not required for unit tests — inject `httpFetch`.
 */

export const DEFAULT_DOCPARSE_SIDECAR_URL = 'http://127.0.0.1:8742';
export const DOCPARSE_URL_SETTING = 'safeappeals.rag.docParseSidecarUrl';
export const DOCPARSE_URL_ENV = 'SAFEAPPEALS_DOCPARSE_URL';

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);

export interface DocParseHealth {
	readonly ok: boolean;
	readonly model?: string;
	readonly detail?: string;
}

export interface DocParseHostParseRequest {
	readonly sourceUri: string;
	readonly pdfBytes: Uint8Array;
	readonly pageFrom?: number;
	readonly pageTo?: number;
}

export interface DocParseHostParseResponse {
	readonly markdown: string;
	readonly pageCount: number;
	readonly anchors: readonly CitationAnchor[];
}

export type DocParseHttpFetch = (
	url: string,
	init?: { method?: string; headers?: Record<string, string>; body?: string },
) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown>; text: () => Promise<string> }>;

export interface DocParseHostOptions {
	readonly baseUrl: string;
	readonly httpFetch?: DocParseHttpFetch;
	readonly log?: (message: string) => void;
}

/**
 * Normalize and reject non-loopback DocParse URLs. Fail closed — never fetch remote.
 */
export function assertLoopbackDocParseUrl(baseUrl: string): string {
	const trimmed = baseUrl?.trim();
	if (!trimmed) {
		throw new Error('DocParse URL is empty; only localhost sidecars are allowed.');
	}

	let parsed: URL;
	try {
		parsed = new URL(trimmed);
	} catch {
		throw new Error(`DocParse URL is invalid: ${baseUrl}`);
	}

	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
		throw new Error(
			`DocParse URL must use http(s) on loopback (got protocol ${parsed.protocol}).`,
		);
	}

	const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
	if (!LOOPBACK_HOSTS.has(host)) {
		throw new Error(
			`DocParse URL must be localhost-only (127.0.0.1, localhost, or ::1); refused host "${parsed.hostname}".`,
		);
	}

	return trimTrailingSlash(trimmed);
}

/**
 * Localhost HTTP client for the Unlimited-OCR docparse sidecar (never loads VLM in EH).
 */
export class DocParseHost {
	private readonly baseUrl: string;
	private readonly httpFetch: DocParseHttpFetch;
	private readonly log?: (message: string) => void;
	private lastHealthy = false;

	constructor(options: DocParseHostOptions) {
		this.baseUrl = assertLoopbackDocParseUrl(options.baseUrl);
		this.httpFetch = options.httpFetch ?? defaultFetch;
		this.log = options.log;
	}

	/**
	 * Resolve URL from env → setting → default, then enforce loopback.
	 * Throws on remote / invalid URLs (fail closed).
	 */
	static resolveBaseUrl(
		getSetting: (key: string, defaultValue: string) => string = (key, def) =>
			vscode.workspace.getConfiguration().get<string>(key, def) ?? def,
		env: NodeJS.ProcessEnv = process.env,
	): string {
		const fromEnv = env[DOCPARSE_URL_ENV]?.trim();
		const raw = fromEnv || getSetting(DOCPARSE_URL_SETTING, DEFAULT_DOCPARSE_SIDECAR_URL);
		return assertLoopbackDocParseUrl(raw);
	}

	static fromWorkspaceSettings(log?: (message: string) => void, httpFetch?: DocParseHttpFetch): DocParseHost {
		return new DocParseHost({
			baseUrl: DocParseHost.resolveBaseUrl(),
			httpFetch,
			log,
		});
	}

	/** Last successful health probe (sync cache for {@link IDocParseBackend.isReady}). */
	get isHealthyCached(): boolean {
		return this.lastHealthy;
	}

	get baseUrlValue(): string {
		return this.baseUrl;
	}

	async health(): Promise<DocParseHealth> {
		try {
			const url = this.endpointUrl('/health');
			const response = await this.httpFetch(url, { method: 'GET' });
			if (!response.ok) {
				this.lastHealthy = false;
				return { ok: false, detail: `HTTP ${response.status}` };
			}
			const body = (await response.json()) as { ok?: boolean; model?: string };
			const ok = body.ok === true;
			this.lastHealthy = ok;
			return { ok, model: typeof body.model === 'string' ? body.model : undefined };
		} catch (err) {
			this.lastHealthy = false;
			const detail = err instanceof Error ? err.message : String(err);
			this.log?.(`DocParse health failed: ${detail}`);
			return { ok: false, detail };
		}
	}

	async parse(request: DocParseHostParseRequest): Promise<DocParseHostParseResponse> {
		const url = this.endpointUrl('/parse');
		const body = {
			sourceUri: request.sourceUri,
			pdfBase64: Buffer.from(request.pdfBytes).toString('base64'),
			pageFrom: request.pageFrom,
			pageTo: request.pageTo,
		};
		const response = await this.httpFetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body),
		});
		if (!response.ok) {
			const text = await response.text().catch(() => '');
			throw new Error(`DocParse /parse failed (HTTP ${response.status}): ${text}`);
		}
		const parsed = (await response.json()) as {
			markdown?: string;
			pageCount?: number;
			anchors?: CitationAnchor[];
		};
		if (typeof parsed.markdown !== 'string') {
			throw new Error('DocParse /parse response missing markdown');
		}
		const pageCount = typeof parsed.pageCount === 'number' && parsed.pageCount > 0
			? parsed.pageCount
			: 1;
		const anchors = Array.isArray(parsed.anchors) ? parsed.anchors : [];
		return { markdown: parsed.markdown, pageCount, anchors };
	}

	/** Mark unhealthy (e.g. after a crash / failed parse). */
	markUnhealthy(): void {
		this.lastHealthy = false;
	}

	/** Build an endpoint URL and re-assert loopback before every network call. */
	private endpointUrl(pathSuffix: string): string {
		const full = `${assertLoopbackDocParseUrl(this.baseUrl)}${pathSuffix.startsWith('/') ? pathSuffix : `/${pathSuffix}`}`;
		assertLoopbackDocParseUrl(full);
		return full;
	}
}

function trimTrailingSlash(url: string): string {
	return url.replace(/\/+$/, '');
}

const defaultFetch: DocParseHttpFetch = async (url, init) => {
	// Defense in depth: refuse even if a caller bypassed DocParseHost helpers.
	assertLoopbackDocParseUrl(url);
	const response = await fetch(url, {
		method: init?.method ?? 'GET',
		headers: init?.headers,
		body: init?.body,
	});
	return {
		ok: response.ok,
		status: response.status,
		json: () => response.json(),
		text: () => response.text(),
	};
};

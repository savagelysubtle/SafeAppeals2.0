/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Frozen agent tool contracts for Safe Appeals Private Search.
 *
 * Names + I/O helpers are shared by `agentTools.ts` handlers and
 * `contributes.languageModelTools` in package.json. Void short aliases are
 * substituted in authentication `AGENT_TOOL_NAME_SUBSTITUTIONS`
 * (`safeappeals_*` is already auto-allowed).
 *
 * Retrieval pipeline (honest): hybrid BM25 + vector → RRF (k=20) → optional
 * ms-marco MiniLM cross-encoder. Candidate pool = 4× finalK, then CE trims.
 * Do **not** claim MMR (Void's stale post-filter); diversity is not applied here.
 */

import type { CitationAnchor, HardDisableCode, RagIndexScope } from './types';
import type { RagStats } from './ragCoreHost';

/** Re-export the shared citation shape so tool consumers cannot drift from types.ts. */
export type { CitationAnchor } from './types';

// ── Tool names (shipping prefix) ─────────────────────────────────────────────

export const RAG_INDEX_DOCUMENT_TOOL = 'safeappeals_rag_index_document';
export const RAG_SEARCH_REFERENCE_TOOL = 'safeappeals_rag_search_reference';
export const RAG_SEARCH_WORKSPACE_TOOL = 'safeappeals_rag_search_workspace';
export const RAG_SEARCH_ALL_TOOL = 'safeappeals_rag_search_all';
export const RAG_GET_STATS_TOOL = 'safeappeals_rag_get_stats';

/** All five frozen Safe Appeals RAG LM tool names. */
export const RAG_TOOL_NAMES = [
	RAG_INDEX_DOCUMENT_TOOL,
	RAG_SEARCH_REFERENCE_TOOL,
	RAG_SEARCH_WORKSPACE_TOOL,
	RAG_SEARCH_ALL_TOOL,
	RAG_GET_STATS_TOOL,
] as const;

export type RagToolName = (typeof RAG_TOOL_NAMES)[number];

// ── Scopes ───────────────────────────────────────────────────────────────────

/**
 * Canonical search / index scopes for rag-core `SearchOptions.scope`.
 *
 * Void aliases (comments / migration only — never send these to rag-core):
 * - `core_references` / `policy_manual` → `core_reference`
 * - `workspace_all` → `all`
 * Folder name on disk remains `core_references/` (`CORE_REFERENCES_FOLDER` in types.ts).
 */
export type RagToolSearchScope = RagIndexScope | 'all';

/** Maps each search tool to the host/native scope string. */
export const RAG_TOOL_SCOPE_BY_NAME: Readonly<Record<
	typeof RAG_SEARCH_REFERENCE_TOOL | typeof RAG_SEARCH_WORKSPACE_TOOL | typeof RAG_SEARCH_ALL_TOOL,
	RagToolSearchScope
>> = {
	[RAG_SEARCH_REFERENCE_TOOL]: 'core_reference',
	[RAG_SEARCH_WORKSPACE_TOOL]: 'case_index',
	[RAG_SEARCH_ALL_TOOL]: 'all',
};

/**
 * Void → SafeAppeals scope alias map (documentation / migration helpers).
 * Callers must normalize before invoking rag-core.
 */
export const VOID_SCOPE_ALIASES: Readonly<Record<string, RagToolSearchScope>> = {
	core_references: 'core_reference',
	policy_manual: 'core_reference',
	workspace_all: 'all',
	core_reference: 'core_reference',
	case_index: 'case_index',
	all: 'all',
};

// ── Agent limit ↔ host finalK ────────────────────────────────────────────────

/**
 * Agent-facing search param is `limit` (Void-compatible).
 * Host / rag-core search option is `finalK`. Default **8**.
 */
export const RAG_SEARCH_LIMIT_DEFAULT = 8;

/** Clamp and map agent `limit` → host `finalK`. */
export function mapAgentLimitToFinalK(limit: number | undefined | null): number {
	if (limit === undefined || limit === null || !Number.isFinite(limit)) {
		return RAG_SEARCH_LIMIT_DEFAULT;
	}
	const n = Math.floor(limit);
	if (n < 1) {
		return 1;
	}
	// Soft upper bound — keeps token budgets sane for agent context.
	if (n > 32) {
		return 32;
	}
	return n;
}

// ── Tool I/O shapes ──────────────────────────────────────────────────────────

/** `safeappeals_rag_index_document` input. */
export interface RagIndexDocumentToolInput {
	readonly uri: string;
	/**
	 * When true → index as `core_reference`; false/omit → `case_index`.
	 * Path under workspace `core_references/` may also imply core (host policy).
	 */
	readonly isCoreReference?: boolean;
}

/**
 * `safeappeals_rag_index_document` output.
 *
 * - Skipped (already indexed / unsupported soft skip) → `success: true` + skip message
 * - Hard-disable → `success: false` with {@link HardDisableCode} in `message`
 */
export interface RagIndexDocumentToolResult {
	readonly success: boolean;
	readonly message: string;
}

/** Shared search tool input (`limit` maps to host `finalK`). */
export interface RagSearchToolInput {
	readonly query: string;
	/** Max hits after CE (or hybrid degrade). Default {@link RAG_SEARCH_LIMIT_DEFAULT}. */
	readonly limit?: number;
}

/**
 * Search tool output (all three search tools).
 *
 * Failures also return this shape with `contextPack` prefixed by
 * {@link SEARCH_FAILED_PREFIX} (Void-compatible).
 */
export interface RagSearchToolResult {
	readonly contextPack: string;
}

/** `safeappeals_rag_get_stats` has no parameters. */
export type RagGetStatsToolInput = Record<string, never>;

/**
 * Stats tool output — a single human-readable string built from
 * {@link RagStats} fields: documents, chunks, vectors, textDocs.
 */
export interface RagGetStatsToolResult {
	readonly stats: string;
}

/** Prefix for failed search `contextPack` strings (Void-compatible). */
export const SEARCH_FAILED_PREFIX = 'Search failed:';

// ── Result helpers (pure; used by agentTools handlers + unit tests) ───────────

/**
 * Build a hard-disable index failure message that includes the code for agents.
 */
export function formatIndexHardDisableMessage(code: HardDisableCode, detail: string): string {
	const trimmed = detail.trim();
	return trimmed.length > 0
		? `Hard-disable [${code}]: ${trimmed}`
		: `Hard-disable [${code}]`;
}

/** Map a soft skip into the frozen index result shape. */
export function indexSkippedResult(reason: string): RagIndexDocumentToolResult {
	return {
		success: true,
		message: reason.startsWith('Skipped') || reason.startsWith('Document already')
			? reason
			: `Skipped: ${reason}`,
	};
}

/** Map a hard-disable into the frozen index result shape. */
export function indexHardDisableResult(
	code: HardDisableCode,
	detail: string,
): RagIndexDocumentToolResult {
	return {
		success: false,
		message: formatIndexHardDisableMessage(code, detail),
	};
}

/** Map a successful index into the frozen result shape. */
export function indexOkResult(message: string): RagIndexDocumentToolResult {
	return { success: true, message };
}

/** Void-compatible search failure payload. */
export function searchFailedResult(errorMessage: string): RagSearchToolResult {
	const detail = errorMessage.trim() || 'unknown error';
	const prefixed = detail.startsWith(SEARCH_FAILED_PREFIX)
		? detail
		: `${SEARCH_FAILED_PREFIX}${detail}`;
	return { contextPack: prefixed };
}

/**
 * Format {@link RagStats} for the stats tool.
 * Fields: documents, chunks, vectors, textDocs.
 */
export function formatRagStatsString(stats: RagStats): string {
	const lines = [
		'Private Search index stats:',
		`• Documents: ${stats.documents}`,
		`• Chunks: ${stats.chunks}`,
		`• Vectors: ${stats.vectors}`,
		`• Text docs (BM25): ${stats.textDocs}`,
		'',
		'Retrieval: hybrid BM25 + vector → RRF (k=20) → optional cross-encoder (not MMR).',
		'Tips:',
		`- ${RAG_SEARCH_REFERENCE_TOOL} — core_reference (workspace core_references/)`,
		`- ${RAG_SEARCH_WORKSPACE_TOOL} — case_index`,
		`- ${RAG_SEARCH_ALL_TOOL} — all scopes`,
		`- Default search limit=${RAG_SEARCH_LIMIT_DEFAULT} (maps to host finalK)`,
	];
	return lines.join('\n');
}

export function statsToolResult(stats: RagStats): RagGetStatsToolResult {
	return { stats: formatRagStatsString(stats) };
}

/**
 * Map rag-core `charStart`/`charEnd` onto {@link CitationAnchor.charRange}.
 * Returns undefined when `sourceUri` is missing (cannot cite).
 */
export function citationAnchorFromSearchHit(hit: {
	readonly sourceUri?: string | null;
	readonly page?: number | null;
	readonly heading?: string | null;
	readonly charStart?: number | null;
	readonly charEnd?: number | null;
}): CitationAnchor | undefined {
	const sourceUri = hit.sourceUri?.trim();
	if (!sourceUri) {
		return undefined;
	}

	const anchor: {
		sourceUri: string;
		page?: number;
		heading?: string;
		charRange?: { start: number; end: number };
	} = { sourceUri };

	if (typeof hit.page === 'number' && Number.isFinite(hit.page)) {
		anchor.page = hit.page;
	}
	const heading = hit.heading?.trim();
	if (heading) {
		anchor.heading = heading;
	}
	if (
		typeof hit.charStart === 'number' &&
		typeof hit.charEnd === 'number' &&
		Number.isFinite(hit.charStart) &&
		Number.isFinite(hit.charEnd)
	) {
		anchor.charRange = { start: hit.charStart, end: hit.charEnd };
	}

	return anchor;
}

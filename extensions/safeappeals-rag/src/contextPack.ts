/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

/**
 * Assemble agent-facing `contextPack` strings from hybrid search hits.
 *
 * Hits are assumed already ranked by rag-core (hybrid BM25+vector → RRF → CE).
 * This module does **not** apply MMR or re-rank.
 */

import type { CitationAnchor } from './types';
import {
	RAG_GET_STATS_TOOL,
	RAG_INDEX_DOCUMENT_TOOL,
	RAG_SEARCH_LIMIT_DEFAULT,
	citationAnchorFromSearchHit,
	searchFailedResult,
} from './toolContracts';

/** Minimal hit shape accepted from rag-core / RagCoreHost. */
export interface ContextPackHit {
	readonly text: string;
	readonly sourceUri?: string | null;
	readonly page?: number | null;
	readonly heading?: string | null;
	readonly charStart?: number | null;
	readonly charEnd?: number | null;
	readonly fusedScore?: number | null;
	readonly scope?: string | null;
	readonly docId?: string | null;
	readonly chunkId?: string | null;
	readonly sectionTitle?: string | null;
	readonly breadcrumbPath?: string | null;
}

export interface AssembleContextPackOptions {
	/** Soft cap on assembled body length (characters). Default 4000. */
	readonly maxContextLength?: number;
	/** Cap characters per chunk body. Default 900. */
	readonly maxChunkChars?: number;
}

export interface BuildSearchContextPackOptions extends AssembleContextPackOptions {
	readonly query: string;
	readonly hits: readonly ContextPackHit[];
	/** Human label for the scope, e.g. `core_reference` / `case_index` / `all`. */
	readonly scope?: string;
}

const DEFAULT_MAX_CONTEXT = 4000;
const DEFAULT_MAX_CHUNK = 900;

/**
 * Format a {@link CitationAnchor} as a one-line citation header.
 */
export function formatCitationHeader(anchor: CitationAnchor, index: number): string {
	const parts: string[] = [`[${index}] ${anchor.sourceUri}`];
	if (typeof anchor.page === 'number') {
		parts.push(`page ${anchor.page}`);
	}
	if (anchor.heading) {
		parts.push(`heading "${anchor.heading}"`);
	}
	if (anchor.charRange) {
		parts.push(`chars ${anchor.charRange.start}-${anchor.charRange.end}`);
	}
	return parts.join(' | ');
}

function fallbackHeader(hit: ContextPackHit, index: number): string {
	const label = hit.docId?.trim() || hit.chunkId?.trim() || 'unknown source';
	return `[${index}] ${label}`;
}

function formatHitBody(text: string, maxChunkChars: number): string {
	const normalized = text.replace(/\r\n/g, '\n').trim();
	if (normalized.length <= maxChunkChars) {
		return normalized;
	}
	return `${normalized.slice(0, Math.max(0, maxChunkChars - 3))}...`;
}

/**
 * Format a single search hit with citation metadata.
 */
export function formatSearchHit(
	hit: ContextPackHit,
	index: number,
	maxChunkChars: number = DEFAULT_MAX_CHUNK,
): string {
	const anchor = citationAnchorFromSearchHit(hit);
	const header = anchor ? formatCitationHeader(anchor, index) : fallbackHeader(hit, index);
	const meta: string[] = [];
	if (hit.scope) {
		meta.push(`scope=${hit.scope}`);
	}
	if (typeof hit.fusedScore === 'number' && Number.isFinite(hit.fusedScore)) {
		meta.push(`score=${hit.fusedScore.toFixed(4)}`);
	}
	if (hit.breadcrumbPath?.trim()) {
		meta.push(`path=${hit.breadcrumbPath.trim()}`);
	} else if (hit.sectionTitle?.trim()) {
		meta.push(`section=${hit.sectionTitle.trim()}`);
	}

	const metaLine = meta.length > 0 ? `\n${meta.join(' | ')}` : '';
	const body = formatHitBody(hit.text, maxChunkChars);
	return `${header}${metaLine}\n\n${body}`;
}

/**
 * Assemble the citation-aware body from ranked hits (no MMR, no re-sort).
 * Preserves input order (rag-core already ranked).
 */
export function assembleContextPack(
	hits: readonly ContextPackHit[],
	options?: AssembleContextPackOptions,
): string {
	const maxContextLength = options?.maxContextLength ?? DEFAULT_MAX_CONTEXT;
	const maxChunkChars = options?.maxChunkChars ?? DEFAULT_MAX_CHUNK;

	if (hits.length === 0) {
		return '';
	}

	let contextText = '';
	for (let i = 0; i < hits.length; i++) {
		const section = formatSearchHit(hits[i]!, i + 1, maxChunkChars);
		const separator = contextText ? '\n\n---\n\n' : '';
		const next = separator + section;
		if (contextText.length + next.length > maxContextLength) {
			const remaining = maxContextLength - contextText.length - separator.length;
			if (remaining > 120) {
				contextText += separator + section.slice(0, remaining - 3) + '...';
			}
			break;
		}
		contextText += next;
	}
	return contextText;
}

/**
 * Empty-result guidance (Void-compatible tone; no MMR claims).
 */
export function formatEmptySearchContextPack(query: string, scope?: string): string {
	const scopeHint = scope ? ` (scope: ${scope})` : '';
	return [
		`No relevant documents found for query: "${query}"${scopeHint}`,
		'',
		'Try:',
		'- Using different search terms',
		`- Checking what is indexed with ${RAG_GET_STATS_TOOL}`,
		`- Indexing documents first (core_references/ or ${RAG_INDEX_DOCUMENT_TOOL})`,
		`- Adjusting limit (default ${RAG_SEARCH_LIMIT_DEFAULT})`,
	].join('\n');
}

/**
 * Full agent-facing search `contextPack` string (success or empty).
 * Does **not** handle thrown failures — use {@link buildSearchFailureContextPack}.
 */
export function buildSearchContextPack(options: BuildSearchContextPackOptions): string {
	const body = assembleContextPack(options.hits, options);
	if (!body) {
		return formatEmptySearchContextPack(options.query, options.scope);
	}

	const n = options.hits.length;
	const scopePart = options.scope ? ` [scope=${options.scope}]` : '';
	const header =
		`Found ${n} relevant chunk(s)${scopePart} ` +
		`(hybrid BM25+vector → RRF → optional cross-encoder; not MMR):\n\n`;
	return header + body;
}

/** Void-compatible failure `contextPack`. */
export function buildSearchFailureContextPack(errorMessage: string): string {
	return searchFailedResult(errorMessage).contextPack;
}

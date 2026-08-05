/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import {
	ADDON_FILENAME,
	loadRagCore,
	expectedNativeBindingPath,
	resolveNativeBindingPath,
	type Capabilities,
	type RagStats,
	type OpResult,
	type EmbedBatchResult,
	type IndexDocumentInput,
	type IndexChunkInput,
	type ChunkDocumentInput,
	type ChunkDocumentOutput,
	type SearchOptions,
	type SearchResult,
	type SearchResultItem,
	type LoadResult,
	type RagCoreNative,
} from './nativeLoader';

export {
	ADDON_FILENAME,
	loadRagCore,
	expectedNativeBindingPath,
	resolveNativeBindingPath,
	type Capabilities,
	type RagStats,
	type OpResult,
	type EmbedBatchResult,
	type IndexDocumentInput,
	type IndexChunkInput,
	type ChunkDocumentInput,
	type ChunkDocumentOutput,
	type SearchOptions,
	type SearchResult,
	type SearchResultItem,
	type LoadResult,
	type RagCoreNative,
};

/**
 * Soft-load helpers used by the future safeappeals-rag host (M6).
 * When the `.node` is missing, callers get a clear error — never a throw from import.
 */
const loaded = loadRagCore(__dirname);

export const isNativeAvailable = loaded.ok;

export function getLoadError(): string | undefined {
	return loaded.ok ? undefined : loaded.error;
}

export function getNative(): RagCoreNative | undefined {
	return loaded.ok ? loaded.native : undefined;
}

function requireNative(): RagCoreNative {
	if (!loaded.ok) {
		throw new Error(loaded.error);
	}
	return loaded.native;
}

export function ping(): string {
	return requireNative().ping();
}

export function version(): string {
	return requireNative().version();
}

export function capabilities(): Capabilities {
	return requireNative().capabilities();
}

/** Pass-through `OpResult` from native (check `ok`; do not assume throw). */
export function openWorkspace(rootDir: string, dekBytes: Buffer | Uint8Array): OpResult {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error };
	}
	return loaded.native.openWorkspace(rootDir, dekBytes);
}

export function closeWorkspace(): OpResult {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error };
	}
	return loaded.native.closeWorkspace();
}

export function stats(): RagStats {
	return requireNative().stats();
}

export function chunkDocument(input: ChunkDocumentInput): ChunkDocumentOutput[] {
	return requireNative().chunkDocument(input);
}

export function embedBatch(texts: string[]): EmbedBatchResult {
	return requireNative().embedBatch(texts);
}

/** Fail-closed when model missing: returns `{ ok: false, error }` (no throw for ModelMissing). */
export function indexChunks(doc: IndexDocumentInput, chunks: IndexChunkInput[]): OpResult {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error };
	}
	return loaded.native.indexChunks(doc, chunks);
}

export function removeDoc(docId: string): OpResult {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error };
	}
	return loaded.native.removeDoc(docId);
}

/** Hybrid BM25+vector+RRF search. Fail-closed when embed model missing. */
export function search(query: string, opts: SearchOptions): SearchResult {
	if (!loaded.ok) {
		return { ok: false, error: loaded.error, results: [] };
	}
	return loaded.native.search(query, opts);
}

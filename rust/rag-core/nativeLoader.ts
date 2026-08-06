/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';

/**
 * Dual-ABI prebuild layout (mirrors extensions/time-tracker):
 * - Desktop (Electron 42.x): NODE_MODULE_VERSION 146 → prebuilds/<platform>-<arch>/electron-146/
 * - Plain Node 24 (tests / code-web): NODE_MODULE_VERSION 137 → prebuilds/<platform>-<arch>/node-137/
 *
 * Path: `prebuilds/${platform}-${arch}/${runtime}-${abi}/rag_core.node`
 */

export const ADDON_FILENAME = 'rag_core.node';

export type IndexWriteRole = 'primary' | 'secondary';

export type Capabilities = {
	hybrid: boolean;
	rerank: boolean;
	queryProcessor: boolean;
	modelsPresent: boolean;
	/** True when the native build linked SQLCipher and can open encrypted DBs. */
	storageReady: boolean;
	dims: number;
	indexWriteRole?: IndexWriteRole;
	indexWriteCapable: boolean;
};

export type RagStats = {
	documents: number;
	chunks: number;
	vectors: number;
	/** Tantivy live document count when a workspace is open. */
	textDocs: number;
};

export type SearchOptions = {
	/**
	 * Final result count after CE (or hybrid degrade).
	 * Hybrid/RRF candidate pool = finalK × 4; CE trims to finalK when loaded.
	 */
	finalK: number;
	/**
	 * `core_reference` | `case_index` | `all` (omit / `all` = no filter).
	 * Explicit scopes win over QP routing for every sub-search.
	 */
	scope?: string | null;
};

export type SearchResultItem = {
	chunkId: string;
	docId: string;
	text: string;
	fusedScore: number;
	bm25Rank?: number | null;
	vectorRank?: number | null;
	sourceUri?: string | null;
	page?: number | null;
	heading?: string | null;
	charStart?: number | null;
	charEnd?: number | null;
	sectionTitle?: string | null;
	breadcrumbPath?: string | null;
	chunkType?: string | null;
	scope: string;
};

export type SearchResult = {
	ok: boolean;
	error?: string | null;
	results: SearchResultItem[];
};

export type OpResult = {
	ok: boolean;
	error?: string | null;
	/** Chunks indexed / removed when relevant. */
	count?: number | null;
};

export type EnsureEmbedderResult = {
	ok: boolean;
	error?: string | null;
	loaded: boolean;
};

export type EmbedBatchResult = {
	ok: boolean;
	error?: string | null;
	embeddings?: number[][] | null;
	dims: number;
};

export type IndexDocumentInput = {
	id: string;
	path: string;
	filename: string;
	filetype: string;
	filesize: number;
	checksum: string;
	scope: string;
	isCoreReference: boolean;
	metadataJson?: string | null;
	createdAt: string;
	lastIndexedAt: string;
};

export type IndexChunkInput = {
	chunkId: string;
	text: string;
	chunkIndex: number;
	tokenCount?: number | null;
	parentChunkId?: string | null;
	chunkType?: string | null;
	sectionId?: string | null;
	sectionNumber?: string | null;
	sectionTitle?: string | null;
	breadcrumbPath?: string | null;
	metadataJson?: string | null;
	sourceUri?: string | null;
	page?: number | null;
	heading?: string | null;
	charStart?: number | null;
	charEnd?: number | null;
};

export type ChunkDocumentInput = {
	docId: string;
	text: string;
	sourceUri: string;
	page?: number | null;
};

export type ChunkDocumentOutput = {
	chunkId: string;
	docId: string;
	text: string;
	chunkIndex: number;
	tokenCount: number;
	parentChunkId?: string | null;
	chunkType: string;
	sectionId?: string | null;
	sectionNumber?: string | null;
	sectionTitle?: string | null;
	breadcrumbPath?: string | null;
	sourceUri: string;
	page?: number | null;
	heading?: string | null;
	charStart?: number | null;
	charEnd?: number | null;
};

export type RagCoreNative = {
	ping(): string;
	version(): string;
	capabilities(): Capabilities;
	openWorkspace(rootDir: string, dekBytes: Buffer | Uint8Array, preferSecondary?: boolean): OpResult;
	closeWorkspace(): OpResult;
	stats(): RagStats;
	getDocument(docId: string): IndexDocumentInput | null | undefined;
	chunkDocument(input: ChunkDocumentInput): ChunkDocumentOutput[];
	embedBatch(texts: string[]): EmbedBatchResult;
	indexChunks(doc: IndexDocumentInput, chunks: IndexChunkInput[]): OpResult;
	removeDoc(docId: string): OpResult;
	search(query: string, opts: SearchOptions): SearchResult;
	ensureEmbedderLoaded(): EnsureEmbedderResult;
	clearEmbedder(): OpResult;
	clearReranker(): OpResult;
};

export type LoadResult =
	| { ok: true; native: RagCoreNative; bindingPath: string }
	| { ok: false; error: string; expectedPath: string };

function resolveRuntimeAbi(): { runtime: string; abi: string } {
	const abi = process.versions.modules;
	const runtime = process.versions.electron ? 'electron' : 'node';
	return { runtime, abi };
}

/**
 * Absolute path to the dual-ABI prebuild for the current process.
 * @param packageRoot Root of `@safeappeals/rag-core` (directory containing `prebuilds/`).
 */
export function expectedNativeBindingPath(packageRoot: string): string {
	const { runtime, abi } = resolveRuntimeAbi();
	return path.join(
		packageRoot,
		'prebuilds',
		`${process.platform}-${process.arch}`,
		`${runtime}-${abi}`,
		ADDON_FILENAME,
	);
}

/**
 * Resolve a committed dual-ABI prebuild if present on disk.
 */
export function resolveNativeBindingPath(packageRoot: string): string | undefined {
	const candidate = expectedNativeBindingPath(packageRoot);
	return fs.existsSync(candidate) ? candidate : undefined;
}

/**
 * Load the native addon from dual-ABI prebuilds. Fail soft when missing or unloadable —
 * host must hard-disable RAG features rather than crash the extension host.
 */
export function loadRagCore(packageRoot: string = __dirname): LoadResult {
	const expectedPath = expectedNativeBindingPath(packageRoot);
	const bindingPath = resolveNativeBindingPath(packageRoot);
	if (!bindingPath) {
		const { runtime, abi } = resolveRuntimeAbi();
		return {
			ok: false,
			error:
				`rag-core native addon not found for ${runtime}-${abi} ` +
				`(${process.platform}-${process.arch}). Expected: ${expectedPath}. ` +
				`Private search is unavailable until the matching dual-ABI prebuild is installed.`,
			expectedPath,
		};
	}

	try {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const native = require(bindingPath) as RagCoreNative;
		if (typeof native.ping !== 'function' || typeof native.version !== 'function' || typeof native.capabilities !== 'function') {
			return {
				ok: false,
				error: `rag-core binding at ${bindingPath} is missing required exports (ping/version/capabilities).`,
				expectedPath,
			};
		}
		return { ok: true, native, bindingPath };
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		return {
			ok: false,
			error: `Failed to load rag-core native addon at ${bindingPath}: ${message}`,
			expectedPath,
		};
	}
}

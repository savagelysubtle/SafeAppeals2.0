/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *--------------------------------------------------------------------------------------------*/

export declare const ADDON_FILENAME: string;

export type Capabilities = {
	hybrid: boolean;
	rerank: boolean;
	queryProcessor: boolean;
	modelsPresent: boolean;
	storageReady: boolean;
	dims: number;
};

export type RagStats = {
	documents: number;
	chunks: number;
	vectors: number;
	textDocs: number;
};

export type SearchOptions = {
	/** Final result count after CE (or hybrid degrade). Pool = finalK × 4 before CE. */
	finalK: number;
	/** Explicit `core_reference` / `case_index` wins over QP routing. */
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
	openWorkspace(rootDir: string, dekBytes: Buffer | Uint8Array): OpResult;
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

export declare function expectedNativeBindingPath(packageRoot: string): string;
export declare function resolveNativeBindingPath(packageRoot: string): string | undefined;
export declare function loadRagCore(packageRoot?: string): LoadResult;

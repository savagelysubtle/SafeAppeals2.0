---
name: RAG Performance Overhaul
overview: Comprehensive performance optimization of the RAG system covering vector search, SQLite operations, indexing pipeline, reranker, and file I/O -- all in TypeScript with no new dependencies.
todos:
  - id: persistent-db-connection
    content: "P0: Keep a persistent SQLite connection for embeddings.db instead of opening/closing per save. Add batch insert with BEGIN/COMMIT transaction in ragVectorAdapter.ts"
    status: completed
  - id: chunk-insert-transaction
    content: "P0: Wrap insertChunks in ragIndexService.ts in a BEGIN/COMMIT transaction (currently 200+ individual autocommit inserts per document)"
    status: completed
  - id: float32-storage
    content: "P0: Change in-memory vector storage from number[] to Float32Array in ChromaPersistentAdapter.embeddings map and update all read/write paths"
    status: completed
  - id: dot-similarity
    content: "P0: Replace cosineSimilarity with dotSimilarity (dot product only, since vectors are pre-normalized) and update all call sites"
    status: completed
  - id: binary-sqlite
    content: "P0: Switch SQLite vector storage from JSON text to binary BLOB, with backwards-compatible migration on load"
    status: completed
  - id: embeddings-return-type
    content: "P1: Change LocalEmbeddingService.generateEmbeddings to return Float32Array[] and convert Transformers.js output"
    status: completed
  - id: remove-duplicate-reranker
    content: "P1: Remove the unused reranker from ChromaPersistentAdapter (saves ~90MB RAM and ~2s startup per workspace)"
    status: completed
  - id: bulk-indexed-check
    content: "P1: Add getIndexedDocumentIds() bulk method to replace per-file isDocumentIndexed (3 DB queries x N files -> 1 query)"
    status: completed
  - id: async-file-io
    content: "P1: Replace readFileSync/statSync with async equivalents in ragIndexService.ts and ragFileService.ts"
    status: completed
  - id: remove-duplicate-mmr
    content: "P2: Remove MMR from ragVectorAdapter.query() -- keep only the one in ragContextService.ts"
    status: completed
  - id: cache-workspace-instance
    content: "P2: Cache last resolved workspace instance in ragMainService.getWorkspaceInstance() to skip re-resolution"
    status: completed
  - id: breadcrumb-map-lookup
    content: "P2: Build Map<id, section> for breadcrumb path resolution instead of O(n^2) sections.find() loop in ragIndexService.ts"
    status: completed
  - id: reranker-short-circuit
    content: "P2: Short-circuit reranker when candidates <= topN in ragReranker.ts"
    status: completed
  - id: doc-id-secondary-index
    content: "P2: Add countOfDocId Map for O(1) hasDocumentEmbeddings lookup instead of full linear scan"
    status: completed
  - id: context-assembly-map
    content: "P3: Replace .find() with Map lookup in ragMainService.ts context assembly"
    status: completed
  - id: cleanup-minor
    content: "P3: Fix redundant dynamic imports, double routeQuery call, unconditional debug queries, regex injection in highlightQuery"
    status: completed
isProject: false
---

# RAG System Performance Overhaul

## Summary of Findings

A deep investigation of the entire RAG pipeline uncovered **16 optimization opportunities** across 8 files. The bottlenecks span four categories: SQLite misuse, wasteful computation, blocking I/O, and redundant work. All changes stay within `src/vs/workbench/contrib/void/`.

---

## P0 -- Critical (10-100x impact on affected operation)

### 1. Persistent SQLite Connection for Embeddings

**File:** [ragVectorAdapter.ts](src/vs/workbench/contrib/void/common/rag/ragVectorAdapter.ts) lines 164-206

**Problem:** `saveEmbeddingToDisk()` opens a new SQLite connection, runs `CREATE TABLE IF NOT EXISTS`, inserts one row, and closes the connection -- **for every single embedding**. For a 100-page PDF producing 200 chunks, that is 200 connection opens, 200 DDL statements, and 200 connection closes. Each connection open involves filesystem locking, WAL setup, and schema parsing.

**Fix:** Open the connection once in `initialize()`, store as `this.db`. Add a `saveBatchToDisk()` method that wraps all inserts in a single `BEGIN TRANSACTION` / `COMMIT`:

```typescript
private db: any = null;

async initialize(): Promise<void> {
    // ... existing init ...
    const require = createRequire(import.meta.url);
    const sqlite3 = require('@vscode/sqlite3');
    this.db = new sqlite3.Database(this.embeddingsDbPath);
    // CREATE TABLE IF NOT EXISTS once here
}

private async saveBatchToDisk(items: Array<{id: string; vector: Float32Array; metadata: Record<string, any>}>): Promise<void> {
    await this.runSql('BEGIN TRANSACTION');
    const stmt = this.db.prepare('INSERT OR REPLACE INTO embeddings (id, vector, metadata) VALUES (?, ?, ?)');
    for (const item of items) {
        const vectorBlob = Buffer.from(item.vector.buffer, item.vector.byteOffset, item.vector.byteLength);
        stmt.run([item.id, vectorBlob, JSON.stringify(item.metadata)]);
    }
    stmt.finalize();
    await this.runSql('COMMIT');
}
```

Apply the same fix to `deleteEmbeddingFromDisk` (lines 209-229) and `deleteByDocId` (lines 446-462) which also open/close connections per operation.

**Expected impact:** 10-50x faster indexing.

### 2. Transaction-Wrap Chunk Insertion

**File:** [ragIndexService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragIndexService.ts) lines 625-659

**Problem:** `insertChunks()` uses a prepared statement (good) but each `stmt.run()` is individually `await`ed with no wrapping transaction. SQLite autocommit mode fsyncs after every row. For 200 chunks, that is 200 disk syncs (~50 inserts/sec without transaction vs ~100,000/sec within one).

**Fix:**

```typescript
private async insertChunks(chunks: ChunkRecord[]): Promise<void> {
    if (!this.db || chunks.length === 0) return;
    await this.runSQL('BEGIN TRANSACTION');
    const stmt = this.db.prepare(`INSERT INTO chunks (...) VALUES (...)`);
    for (const chunk of chunks) {
        stmt.run([...params...]);
    }
    stmt.finalize();
    await this.runSQL('COMMIT');
}
```

**Expected impact:** 10-100x faster chunk insertion.

### 3. Float32Array for In-Memory Vectors

**File:** [ragVectorAdapter.ts](src/vs/workbench/contrib/void/common/rag/ragVectorAdapter.ts) line 55

**Problem:** Each vector is a `number[]` of 384 boxed 64-bit floats (~6KB). V8 cannot apply SIMD optimizations to heap-allocated object arrays.

**Fix:** Change the Map value type:

```typescript
// BEFORE
private embeddings: Map<string, { vector: number[]; metadata: Record<string, any> }> = new Map();
// AFTER
private embeddings: Map<string, { vector: Float32Array; metadata: Record<string, any> }> = new Map();
```

This also aligns with the existing `ChunkRecord.embedding?: Float32Array` type in [ragServiceTypes.ts line 28](src/vs/workbench/contrib/void/common/rag/ragServiceTypes.ts) which is already declared but unused.

**Expected impact:** ~4x less memory per vector, faster iteration due to contiguous memory.

### 4. Dot Product Instead of Full Cosine Similarity

**File:** [ragVectorAdapter.ts](src/vs/workbench/contrib/void/common/rag/ragVectorAdapter.ts) lines 504-519

**Problem:** `cosineSimilarity()` computes 3 accumulators, 2 `Math.sqrt` calls, and 1 division per pair. But the Transformers.js pipeline already normalizes embeddings (`normalize: true` at [ragLocalEmbeddings.ts line 113](src/vs/workbench/contrib/void/common/rag/ragLocalEmbeddings.ts)). For unit vectors, cosine similarity = dot product.

**Fix:**

```typescript
private dotSimilarity(a: Float32Array, b: Float32Array): number {
    let dot = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
    }
    return dot;
}
```

Update all call sites in `query()` and `applyMMR()`.

**Expected impact:** ~3x faster per comparison (1 accumulator vs 3 + sqrt + div).

### 5. Binary BLOB Storage for Vectors in SQLite

**File:** [ragVectorAdapter.ts](src/vs/workbench/contrib/void/common/rag/ragVectorAdapter.ts) lines 142-146, 185-189

**Problem:** Vectors are stored as JSON text (`JSON.stringify` of 384 numbers = ~3KB per vector). Loading 10k vectors means parsing ~30MB of JSON strings on startup.

**Fix -- Saving:**

```typescript
const vectorBlob = Buffer.from(
	vector.buffer,
	vector.byteOffset,
	vector.byteLength,
);
```

**Fix -- Loading with backwards-compatible migration:**

```typescript
const vector =
	typeof row.vector === "string"
		? new Float32Array(JSON.parse(row.vector)) // old JSON format
		: new Float32Array(
				row.vector.buffer,
				row.vector.byteOffset,
				row.vector.byteLength / 4,
			);
```

**Expected impact:** ~10x faster startup load, ~2x smaller database.

---

## P1 -- High (eliminates significant waste)

### 6. Return Float32Array from Embedding Service

**File:** [ragLocalEmbeddings.ts](src/vs/workbench/contrib/void/common/rag/ragLocalEmbeddings.ts) line 85

Change `generateEmbeddings()` return type from `number[][]` to `Float32Array[]`. Convert Transformers.js output:

```typescript
async generateEmbeddings(texts: string[]): Promise<Float32Array[]> {
    const embeddings: Float32Array[] = [];
    // ... batch loop ...
    const batchEmbeddings = output.tolist();
    for (const embedding of batchEmbeddings) {
        embeddings.push(new Float32Array(embedding));
    }
}
```

Also update `generateEmbedding()` (line 160) to return `Float32Array`.

### 7. Remove Duplicate Reranker from Vector Adapter

**Files:** [ragVectorAdapter.ts](src/vs/workbench/contrib/void/common/rag/ragVectorAdapter.ts) lines 51, 84-88 and [ragWorkspaceManager.ts](src/vs/workbench/contrib/void/electron-main/rag/ragWorkspaceManager.ts) lines 118-123

**Problem:** `ChromaPersistentAdapter` creates its own `LocalCrossEncoderReranker` and **eagerly initializes it** (loading ~90MB model) during `initialize()`. But this reranker is never used in the search path -- only the workspace manager's lazy reranker is used (via `ragMainService.ts` line 377). This wastes ~90MB RAM and ~2 seconds per workspace initialization.

**Fix:** Remove the `reranker` field and its initialization from `ChromaPersistentAdapter`. Remove `useReranking` config. The reranker in `ragWorkspaceManager.ts` (which uses lazy init) is the one actually used.

### 8. Bulk Document Index Check

**File:** [ragMainService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragMainService.ts) lines 474-531

**Problem:** `isDocumentIndexed()` makes **3 separate DB queries** per file (getDocumentById, getChunksByDocId, hasDocumentEmbeddings). During workspace scans, this is called for every single file. For 50 files, that's 150 DB queries + 50 IPC round-trips.

**Fix:** Add a `getIndexedDocumentIds(workspaceId: string): Promise<Set<string>>` method that returns all indexed doc IDs in a single SQL query. Use this during scan operations:

```typescript
async getIndexedDocumentIds(workspaceId: string): Promise<Set<string>> {
    const instance = await this.getWorkspaceInstance(workspaceId);
    const docs = await instance.indexService.getAllDocumentIds();
    return new Set(docs);
}
```

Then in scan methods, check `indexedIds.has(docId)` instead of calling `isDocumentIndexed()` per file.

### 9. Async File I/O (Unblock Main Process)

**Files:**

- [ragIndexService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragIndexService.ts) lines 504-512 -- `readFileSync` for checksum
- [ragMainService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragMainService.ts) line 178 -- `fs.statSync`
- [ragFileService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragFileService.ts) line 78 -- `readFileSync` for hash

**Problem:** Synchronous file reads block the Electron main process event loop. For a 50MB PDF, `readFileSync` freezes all IPC communication for hundreds of milliseconds.

**Fix:** Replace with `fs.promises.readFile()` and `fs.promises.stat()`. For checksum/hash computation, use streaming:

```typescript
private async calculateChecksum(uri: URI): Promise<string> {
    const stream = createReadStream(uri.fsPath);
    const hash = createHash('sha256');
    stream.pipe(hash);
    return new Promise((resolve, reject) => {
        hash.on('finish', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}
```

Also remove the redundant `Uint8Array.from(content)` copy in `ragIndexService.ts` line 507 -- `Buffer` is already a `Uint8Array` subclass.

---

## P2 -- Medium (architectural cleanups with measurable effect)

### 10. Remove Duplicate MMR Pass

**Files:** [ragVectorAdapter.ts](src/vs/workbench/contrib/void/common/rag/ragVectorAdapter.ts) line 341 and [ragContextService.ts](src/vs/workbench/contrib/void/common/rag/ragContextService.ts) line 41

**Problem:** MMR diversity is applied **twice**: once in the vector adapter's `query()` (using cosine similarity on embedding vectors) and again in context assembly (using Jaccard word-overlap). The cross-encoder reranker in Stage 2 already handles relevance quality. Running MMR twice is redundant.

**Fix:** Remove `applyMMR()` from `ragVectorAdapter.query()`. Just sort by score and return top-k. The single MMR pass in `ragContextService.ts` provides the diversity guarantee after reranking.

### 11. Cache Workspace Instance

**File:** [ragMainService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragMainService.ts) lines 118-149

**Problem:** `getWorkspaceInstance()` is called on every public method (search, index, isDocumentIndexed, etc.). Each call re-resolves the workspace, re-logs, and re-wires `fileService.setIndexService()`.

**Fix:** Cache the last resolved instance:

```typescript
private lastWorkspaceId: string | null = null;
private lastInstance: { vectorAdapter: VectorAdapter; ... } | null = null;

private async getWorkspaceInstance(workspaceId: string) {
    if (workspaceId === this.lastWorkspaceId && this.lastInstance) {
        return this.lastInstance;
    }
    // ... full resolution ...
    this.lastWorkspaceId = workspaceId;
    this.lastInstance = result;
    return result;
}
```

### 12. O(1) Breadcrumb Path Resolution

**File:** [ragIndexService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragIndexService.ts) lines 751-761

**Problem:** For each section, parent lookup uses `sections.find()` -- O(n) per section, O(n^2) total. A 500-section legal document would do ~250,000 array scans.

**Fix:** Build a lookup map:

```typescript
const sectionOfId = new Map(sections.map((s) => [s.id, s]));
for (const section of sections) {
	const path: string[] = [];
	let current: DocumentSection | undefined = section;
	while (current) {
		path.unshift(current.title);
		current = current.parentId ? sectionOfId.get(current.parentId) : undefined;
	}
	breadcrumbs.set(section.id, path);
}
```

### 13. Reranker Short-Circuit

**File:** [ragReranker.ts](src/vs/workbench/contrib/void/common/rag/ragReranker.ts) lines 100-117

**Problem:** The reranker always runs full cross-encoder inference even when `documents.length <= topN` (no filtering needed). With the 90MB model, this adds 100-500ms of wasted latency.

**Fix:** Add early return:

```typescript
if (documents.length <= 1) {
    return documents.map(d => ({ chunkId: d.id, relevanceScore: d.score, ... }));
}
```

### 14. Secondary Index for hasDocumentEmbeddings

**File:** [ragVectorAdapter.ts](src/vs/workbench/contrib/void/common/rag/ragVectorAdapter.ts) lines 469-485

**Problem:** Iterates every embedding in memory to check if a document has any. O(n) per call, called per-file during scans.

**Fix:** Maintain a `countOfDocId: Map<string, number>` updated during `add()` and `deleteByDocId()`:

```typescript
private countOfDocId: Map<string, number> = new Map();

async hasDocumentEmbeddings(docId: string): Promise<{ hasEmbeddings: boolean; count: number }> {
    const count = this.countOfDocId.get(docId) ?? 0;
    return { hasEmbeddings: count > 0, count };
}
```

---

## P3 -- Low (correctness fixes and minor cleanups)

### 15. Map Lookup in Context Assembly

**File:** [ragMainService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragMainService.ts) lines 386-401

Replace two `.find()` loops with a single Map:

```typescript
const searchResultOfChunkId = new Map(searchResults.map((s) => [s.chunkId, s]));
```

### 16. Minor Cleanups (batch together)

- **Redundant dynamic imports:** Remove `await import('fs')` in files that already have `import * as fs from 'fs'` at the top ([ragMainService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragMainService.ts) line 176, [ragFileService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragFileService.ts) lines 143/263, [ragVectorAdapter.ts](src/vs/workbench/contrib/void/common/rag/ragVectorAdapter.ts) lines 73/112/493)
- **Double routeQuery call:** [ragQueryProcessor.ts](src/vs/workbench/contrib/void/common/rag/ragQueryProcessor.ts) lines 60+63 -- cache result in a local variable
- **Unconditional debug queries:** [ragIndexService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragIndexService.ts) lines 1155-1166 -- gate behind debug flag or remove
- **Regex injection in highlightQuery:** [ragIndexService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragIndexService.ts) lines 1190-1203 -- escape user input before creating RegExp, or use string replacement
- **Consolidate DDL statements:** [ragIndexService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragIndexService.ts) lines 165-232 -- combine 8 sequential `db.exec()` awaits into one

---

## Files Changed Summary

- [ragVectorAdapter.ts](src/vs/workbench/contrib/void/common/rag/ragVectorAdapter.ts) -- P0 items 1,3,4,5 + P1 item 7 + P2 items 10,14
- [ragLocalEmbeddings.ts](src/vs/workbench/contrib/void/common/rag/ragLocalEmbeddings.ts) -- P1 item 6
- [ragIndexService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragIndexService.ts) -- P0 item 2 + P1 item 9 + P2 item 12 + P3 items
- [ragMainService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragMainService.ts) -- P1 items 8,9 + P2 item 11 + P3 item 15
- [ragReranker.ts](src/vs/workbench/contrib/void/common/rag/ragReranker.ts) -- P2 item 13
- [ragFileService.ts](src/vs/workbench/contrib/void/electron-main/rag/ragFileService.ts) -- P1 item 9 + P3 cleanup
- [ragQueryProcessor.ts](src/vs/workbench/contrib/void/common/rag/ragQueryProcessor.ts) -- P3 cleanup
- [ragContextService.ts](src/vs/workbench/contrib/void/common/rag/ragContextService.ts) -- No changes (keep its MMR pass)

All files within `src/vs/workbench/contrib/void/`.

---

## Expected Combined Impact

- **Indexing a 100-page PDF:** ~10-50x faster (transaction batching + persistent DB + async I/O)
- **Query similarity search (10k embeddings):** ~3-5x faster (Float32Array + dot product)
- **Startup load:** ~10x faster (binary BLOB instead of JSON parse)
- **Memory per workspace:** ~90MB less (removing duplicate reranker) + ~4x less per vector
- **Workspace scan (50 files):** ~50x fewer DB queries (bulk check instead of per-file)

---

## Future Considerations (Not in This Plan)

- **ANN index (HNSW):** O(log n) search instead of O(n). Worth it if corpus regularly exceeds 50k chunks.
- **SQLite WAL mode:** `PRAGMA journal_mode=WAL` would allow concurrent reads during writes.
- **Concurrent OCR pages:** `ragFileService.ts` processes OCR pages sequentially. Bounded concurrency (4 at a time) would cut OCR time proportionally.
- **File watcher debouncing:** `ragWorkspaceService.ts` re-indexes on every file change event with no debounce. Worth adding a 500ms debounce + coalescing.

---

## Testing

After implementation, reload the window (`Ctrl+Shift+P` -> "Developer: Reload Window") and:

1. Verify existing indexed documents still load (migration from JSON to binary).
2. Index a new document and confirm embeddings are stored correctly.
3. Run a search query and verify results are returned with correct scores.
4. Index a large document (50+ pages) and observe indexing speed improvement.
5. Check DevTools console for any new errors during search or indexing.

# `@safeappeals/rag-core`

SafeAppeals Advanced RAG native core (napi-rs). Workspace member of `rust/`.

## Surface (M0–M5)

| Export | Behavior |
|--------|----------|
| `ping()` | `"pong"` |
| `version()` | crate / package version string |
| `capabilities()` | `{ hybrid, rerank, queryProcessor, modelsPresent, storageReady, dims }` — `dims=512` (BGE-small); **`hybrid=true`** (M3); **`queryProcessor=true`** (M4); **`rerank=true`** when ms-marco CE is loaded (M5), else `false` |
| `openWorkspace(rootDir, dekBytes)` | Open/create SQLCipher DB + usearch + tantivy; returns `OpResult` |
| `closeWorkspace()` | Persist vectors; commit text index; close DB; returns `OpResult` |
| `stats()` | `{ documents, chunks, vectors, textDocs }` |
| `chunkDocument({ docId, text, sourceUri, page? })` | Hierarchical citation-aware chunks (parent ≤ 480 tokens for BGE) |
| `embedBatch(texts)` | `{ ok, error?, embeddings?, dims }` — **fail-soft** if model missing |
| `indexChunks(doc, chunks)` | Embed + store SQL/usearch/tantivy; **fail-closed** if model missing. Indexes **all** chunks (parents+children). |
| `removeDoc(docId)` | Delete doc/chunks/vectors/BM25 docs; returns `OpResult` |
| `search(query, { finalK, scope? })` | Hybrid BM25+vector **RRF** + QP + optional CE — see below |

## Hybrid search + QueryProcessor + CE (M3–M5)

```ts
const r = native.search('medical treatment and rating reduction and flare-ups', {
  finalK: 8,
  scope: 'case_index', // or 'core_reference' | 'all' | omit
});
// r: { ok, error?, results: [{ chunkId, docId, text, fusedScore, bm25Rank?, vectorRank?, …citation }] }
```

**Search path (M4 + M5)**

1. Rule-based QueryProcessor (`processQuery` / `isComplexQuery` / `decompose` / `routeQuery`)
2. Sub-searches (each = hybrid BM25 + vector + RRF)
3. Multi-list RRF merge when the query decomposes into ≥2 parts → **retrieval_k = 4× finalK**
4. ms-marco MiniLM cross-encoder rerank → trim to `finalK` (when CE loaded)

**Locked decisions**

| Constant | Value | Notes |
|----------|------:|-------|
| BM25 `k1` | **0.8** | Void legal/medical default |
| BM25 `b` | **0.5** | Void legal/medical default |
| RRF `k` | **20** | Fused inside Rust `search()` |
| CE candidate pool | **4×** `finalK` | Void `ragMainService` pattern; then CE trims to `finalK` |
| QP merge budget | **4×** `finalK` per sub-query | Fuse to pool, then CE |
| Sub-search parallelism | **Sequential** (v1) | `with_session` mutex; true parallel deferred |
| Scope | DB field `core_reference` / `case_index` | Folders are `core_references` / `case_index`; `all` = no filter within the open workspace root |
| Explicit scope | Wins | If caller passes `core_reference` or `case_index`, every sub-search uses it; QP `suggestedScope` / routing only when scope is `all` / omitted |
| Void scope names | Mapped | `workspace_all`→`all`, `core_references`→`core_reference` |
| LLM decomp | **Out of v1** | Llama-3.2-1B not used; rule-based only |
| Indexing | All chunks passed to `indexChunks` | Parents + children (same as M2) |
| CE missing | **Degrade** | Return hybrid+QP top-`finalK` (no error). Embed missing still **fail-closed**. |
| BGE-reranker | **Deferred** | Later quality mode / rung-14; not in M5 |

Fail-closed if the embed model is missing (hybrid needs both legs).

Tantivy 0.22 hardcodes BM25 k1/b in its built-in scorers; rag-core scores BM25 itself from postings + fieldnorms using **k1=0.8 / b=0.5**.

## Layout

- Rust crate: `Cargo.toml` + `src/` (cdylib + rlib)
- Storage: `src/storage/` (SQLCipher)
- Chunker: `src/chunker/` (char-safe budgets / truncation)
- Embed: `src/embed/` (`FakeEmbedder` + optional `fastembed`)
- Rerank: `src/rerank/` (`FakeReranker` + optional ort CE)
- Vectors: `src/vector/` (usearch HNSW → `vectors.usearch`)
- Text: `src/text/` (tantivy BM25 → `text.tantivy`)
- Fusion: `src/rrf.rs` (RRF k=20; multi-list fuse for M4)
- Query processor: `src/query_processor.rs` (rule-based; port of Void QP)
- npm package: this directory (`@safeappeals/rag-core`)
- Dual-ABI loader: `nativeLoader.ts` / `nativeLoader.js`
- Prebuild + SQLCipher docs: [PREBUILDS.md](./PREBUILDS.md)

## Build

```bash
cd rust/rag-core
bun install
cargo test -p rag-core
bun run build:prebuild
```

## Real embeddings (BYO — no silent download)

1. Build with the `fastembed` feature (pins `ort = "=2.0.0-rc.13"`):

```bash
cargo test -p rag-core --features fastembed
```

2. Place BGE-small ONNX + tokenizer files in a directory (`model.onnx`, `tokenizer.json`, …).

3. Export `SA_RAG_EMBED_MODEL_DIR=/path/to/bge-small-en-v1.5`.

`capabilities().modelsPresent` becomes true after a successful load. Unit tests use `FakeEmbedder` and **never** download weights.

### MiniLM light — deferred (stub)

`EmbedModelKind::MiniLmL6V2Light` is a **stub only** (dims=384 documented for later). It is **not** production-ready: loading it returns an error. Do not wire host UX or Search-pack install to MiniLM until a dedicated milestone lands. Default and only supported embedder path is **BGE-small-en-v1.5**.

## Real cross-encoder (BYO — no silent download)

ms-marco MiniLM-L-6-v2 CE via ort (mirrors embed BYO). Host Search-pack wiring lands in M6.

1. Build with the `cross-encoder` feature (reuses the same ort pin):

```bash
cargo test -p rag-core --features cross-encoder
# or both: --features "fastembed,cross-encoder"
```

2. Place CE ONNX + tokenizer in a directory (`model.onnx`, `tokenizer.json`).

3. Export `SA_RAG_CE_MODEL_DIR=/path/to/ms-marco-minilm-l6-v2`.

`capabilities().rerank` becomes **true** after a successful load. When unset/missing, `search` **degrades** to hybrid+QP top-`finalK` (no error). Unit/golden tests use `FakeReranker` and **never** download CE weights. Smoke (`bun run test:native`) expects `rerank: false` without a CE model — the field must still be present.

### BGE-reranker — deferred

BGE-reranker quality mode is **out of M5** (later / rung-14 bundling). Do not implement or wire it here.

## Work files (M2–M5 → M6)

`{root}/vectors.usearch` and `{root}/text.tantivy` are **work files** while the workspace is open. M6 seals indexes when cold. Do not treat them as sealed encryption yet. SQLCipher remains the only encrypted store; no FTS5 in SQLite.

## Host usage (M6)

```ts
import { loadRagCore } from '@safeappeals/rag-core';

const loaded = loadRagCore(/* package root */);
if (!loaded.ok || !loaded.native.capabilities().storageReady) {
	// hard-disable Private Search
} else {
	const open = loaded.native.openWorkspace(rootDir, dekBytes);
	if (!open.ok) { /* handle */ }
	const caps = loaded.native.capabilities();
	if (!caps.modelsPresent) {
		// prompt Search pack / BYO — indexChunks/search return { ok: false } until model loads
	}
	const hits = loaded.native.search(query, { finalK: 8, scope: 'case_index' });
}
```

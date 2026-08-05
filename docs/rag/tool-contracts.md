# SafeAppeals RAG — Frozen Tool Contracts

Types live in `extensions/safeappeals-rag/src/toolContracts.ts` and
`contextPack.ts`. Handlers live in `agentTools.ts`. This document is the
human-readable mirror.

**Status:** tools pass **landed**. All five names are registered via
`contributes.languageModelTools` in `extensions/safeappeals-rag/package.json`
and `vscode.lm.registerTool` in `agentTools.ts` (wired from `extension.ts`
after host/pipeline init). Void short aliases (`rag_*`) map through
authentication `AGENT_TOOL_NAME_SUBSTITUTIONS`; `safeappeals_*` is auto-allowed.

## Tool names

| Tool | Purpose | Host scope |
|------|---------|------------|
| `safeappeals_rag_index_document` | Index one workspace document | `core_reference` or `case_index` |
| `safeappeals_rag_search_reference` | Search core references | `core_reference` |
| `safeappeals_rag_search_workspace` | Search case files | `case_index` |
| `safeappeals_rag_search_all` | Search both | `all` |
| `safeappeals_rag_get_stats` | Index statistics | — |

## Scopes

Canonical values sent to rag-core:

- `core_reference`
- `case_index`
- `all`

Void aliases (normalize before calling the host; never send raw aliases to
rag-core):

| Void / legacy | Canonical |
|---------------|-----------|
| `core_references` | `core_reference` |
| `policy_manual` | `core_reference` |
| `workspace_all` | `all` |

Workspace folder name on disk remains `core_references/`.

## Retrieval (honest claims)

Pipeline inside `rag-core` `search()`:

1. Hybrid BM25 + vector retrieval
2. RRF fusion (`k=20`)
3. Optional ms-marco MiniLM cross-encoder rerank
4. Trim to `finalK`

Candidate pool ≈ `4 × finalK`, then CE trims. When CE is missing, degrade to
hybrid+RRF top-`finalK` (no error).

**Do not claim MMR.** Void's post-filter MMR is not ported.

## Agent `limit` ↔ host `finalK`

- Agent parameter name: **`limit`**
- Host / native option: **`finalK`**
- Default: **`8`**
- Soft clamp in helpers: `1…32`

## Citation shape

Shared type `CitationAnchor` in `extensions/safeappeals-rag/src/types.ts`
(re-exported from `toolContracts.ts`):

```ts
interface CitationAnchor {
  sourceUri: string;
  page?: number;
  heading?: string;
  charRange?: { start: number; end: number };
}
```

rag-core hits expose `charStart` / `charEnd`; map them to `charRange` via
`citationAnchorFromSearchHit`. Every contextPack chunk header is citation-aware.

## I/O contracts

### `safeappeals_rag_index_document`

**Input**

```ts
{ uri: string; isCoreReference?: boolean }
```

**Output**

```ts
{ success: boolean; message: string }
```

| Outcome | `success` | `message` |
|---------|-----------|-----------|
| Indexed | `true` | Success detail |
| Soft skip (already indexed, etc.) | `true` | Skip message |
| Hard-disable | `false` | Includes code, e.g. `Hard-disable [scanned-ocr-not-installed]: …` |

### Search tools (`*_search_reference` / `*_search_workspace` / `*_search_all`)

**Input**

```ts
{ query: string; limit?: number }  // default limit = 8 → finalK
```

**Output**

```ts
{ contextPack: string }
```

- Success: preamble mentioning hybrid → RRF → optional cross-encoder (**not** MMR), then
  citation-formatted chunks from `assembleContextPack` /
  `buildSearchContextPack`.
- Empty: guidance to try different terms / `safeappeals_rag_get_stats` /
  `safeappeals_rag_index_document`.
- Failure: still `{ contextPack }` with prefix **`Search failed: `**
  (Void-compatible).

### `safeappeals_rag_get_stats`

**Input:** none (`{}`)

**Output**

```ts
{ stats: string }
```

String is built from `RagStats`: `documents`, `chunks`, `vectors`, `textDocs`.

## Context pack assembly

Module: `extensions/safeappeals-rag/src/contextPack.ts`

- Input order preserved (already ranked by rag-core)
- Per-hit header: `[n] sourceUri | page | heading | chars start-end`
- Optional meta: `scope`, `score`, breadcrumb/section
- Soft length caps (~4000 total, ~900 per chunk)
- No MMR / no local re-rank

## Registration (landed)

Handlers in `extensions/safeappeals-rag/src/agentTools.ts`:

1. Exact frozen names above (`RAG_TOOL_NAMES`)
2. Map `limit` → `{ finalK: mapAgentLimitToFinalK(limit) }`
3. Map tool → `RAG_TOOL_SCOPE_BY_NAME`
4. Return frozen result shapes (`indexOk` / skip / hard-disable; search `contextPack`; stats string)
5. `contributes.languageModelTools` + `registerAgentTools` after host/pipeline init
6. No `prepareInvocation` / approval (read/search tools)

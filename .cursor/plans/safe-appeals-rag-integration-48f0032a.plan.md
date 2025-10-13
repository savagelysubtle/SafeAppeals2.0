<!-- 48f0032a-63b4-4079-adce-d6fd6fb9b600 e5a42961-56fd-4402-8dfe-39cbdc3317b2 -->
# Safe Appeals RAG Integration

## Overview

Hybrid integration: native Void IDE services with an extensibility surface. Phase 1 delivers core document indexing and search (no reorg UI yet). Policy dashboard and advanced tools are scheduled for Phase 2.

## Reference Document

`.cursor/plans/safe-appeals-nav-rag-implementation.md`

- 273–729: DB schema + IndexService
- 730–920: FileService (MIME extraction)
- 921–1399: AgentService/tools
- 1400–1624: Policy dashboard
- 2082–2327: Entry point/commands

## Architecture

- **Hybrid approach**: core services built-in; optional tool API for future extensions.
- **Storage base (Windows example)**: `IEnvironmentService.userRoamingDataHome/.appealsnavigator/databases/`
- `.../chroma/` (vector backend cache/persistence as applicable)
- `.../workspace.db` (SQLite metadata)
- Both per-workspace and global collections supported via settings.
- **Electron-main RAG service**: heavy I/O and native modules run in `electron-main`; browser invokes via channel.

## Phase 1 Scope (you chose 2.a)

- Index documents (PDF/DOCX/TXT/MD), store metadata in SQLite.
- Vector search over chunks with configurable chunk size/overlap.
- Basic search surfaced via existing Void tools/chat (no dashboard yet).

## Key Additions vs prior plan

- Electron-main service + channel for RAG
- Vector adapter abstraction (Chroma HTTP and future SQLite-vec)
- Context pack assembly for better depth and chunk traceability
- File system watchers for incremental indexing
- Settings surface aligned to both global and workspace storage
- Guardrails: CSP, path validation, error handling, logging

## Implementation Steps

### 0) Service contracts and settings

- Create `common/ragServiceTypes.ts` with:
- `DocumentRecord`, `ChunkRecord`, `PolicySection`, `WorkspaceConfig` (ref 274–318)
- `SearchResult` with `docId`, `chunkId`, `score`, `snippet`, `source`
- `ContextPack` (assembled context with deduped chunks + attributions)
- Extend `common/voidSettingsTypes.ts`:
- `ragEnabled: boolean`
- `ragChunkSize: number` (default 500)
- `ragChunkOverlap: number` (default 50)
- `ragSearchLimit: number` (default 5)
- `ragStorageScope: 'global' | 'workspace' | 'both'`
- `ragVectorBackend: 'chroma-http' | 'sqlite-vec'`
- `ragOpenAIModel: 'text-embedding-3-small' | 'text-embedding-3-large'`
- `ragChromaUrl?: string` (ref props 2418–2445)

### 1) Path resolution (global + workspace)

- Create `common/ragPathService.ts` using `IEnvironmentService.userRoamingDataHome`:
- `getGlobalChromaDir()`, `getGlobalSqlitePath()`
- `getWorkspaceChromaDir(workspaceId)`, `getWorkspaceSqlitePath(workspaceId)`
- `ensureDirectories()`; normalize separators on Windows
- Reference doc 217–270 for structure; adapt to VS Code/VOID env

### 2) Electron-main RAG service + channel

- Create `electron-main/ragMainService.ts` and `electron-main/ragMainChannel.ts`:
- Responsible for: DB init/migrations, vector backend init, indexing, search
- Expose methods: `indexDocument(URI,isPolicyManual)`, `search(query, scope, limit)`, `getStats()`
- Use `better-sqlite3` in main process only
- Register channel (pattern like `sendLLMMessageChannel.ts`)

### 3) Vector backend abstraction

- Create `common/ragVectorAdapter.ts` with interface:
- `ensureCollections(scope)`, `add(chunks, metadatas)`, `query({text, n})`
- Implement `chromaHttpAdapter` (Phase 1 default):
- Use `ChromaClient` + `OpenAIEmbeddingFunction`
- Reads `ragChromaUrl` (ref 2421–2424) and API key from settings/env
- Stub `sqliteVecAdapter` for future (Phase 2), keeping adapter boundary intact

### 4) Index service (main-side)

- Create `electron-main/ragIndexService.ts` and wire into main service:
- Schema from 363–427
- Implement `indexDocument` (430–554) with robust ID/checksum generation, prepared statements
- Implement `chunkText` (556–581) with sentence splitter + overlap; expose configurable size/overlap from settings
- Store chunks in SQLite; push to vector adapter collections (`policy_manual` vs `workspace_docs`)
- Optional section extraction (588–667) kept behind flag for Phase 2

### 5) File extraction (main-side)

- Create `electron-main/ragFileService.ts` (PDF/DOCX/TXT/MD), using `pdfjs-dist`, `mammoth` (730–920)
- Normalize metadata fields, add language heuristic as in doc
- Surface unsupported formats with clear errors; log warnings

### 6) Context pack assembly (browser-side)

- Create `common/ragContextService.ts`:
- Query main for top-N results across selected scopes
- MMR-style re-rank and dedup per doc
- Assemble `ContextPack` with:
- `answerContext`: merged, length-capped text
- `attributions`: `[ {docId, chunkId, filename, rangeHint, score} ]`
- This gives agents deeper, traceable context

### 7) Tool integration (chat + commands, no dashboard in Phase 1)

- Update `common/toolsServiceTypes.ts`:
- Add tools: `'rag_index_document' | 'rag_search_policy' | 'rag_search_workspace' | 'rag_get_stats'`
- Update `browser/toolsService.ts`:
- Validate params, call into main via channel
- Result-to-string includes annotated attributions from `ContextPack`
- Add commands (palette only in Phase 1):
- `void.rag.indexDocument`, `void.rag.searchPolicy`, `void.rag.searchWorkspace`

### 8) Settings UI and defaults

- Extend existing Void settings pane to surface RAG options
- Respect 3.c (both UI panel + chat) by deferring panel to Phase 2; chat works via tools now

### 9) Watchers and incremental indexing

- Add workspace watcher (browser) to send events to main for:
- New/changed supported files → re-index if checksum changed
- Deleted files → cascade delete in SQLite and vector index

### 10) Logging, errors, CSP

- Use Void logging service; route main logs to file under `.appealsnavigator/logs`
- Guard file paths via URI validation pattern in `toolsService.ts`
- Webview CSP stays strict; Phase 1 has no webview UI

### 11) Dependencies and build

- Packages to add (align with doc 106–117):
- `chromadb`, `better-sqlite3`, `pdfjs-dist`, `mammoth`, `@langchain/core`, `@langchain/openai`
- Note: native module (`better-sqlite3`) build/packaging—wire into existing build. Discuss before changing root configs (follows workspace rule).

### 12) Tests (Phase 1)

- Unit test main-side index/search with temp files (ref test 2690–2727)
- Smoke test: index a sample TXT, search term returns top chunk

## Phase 2 (next)

- Policy Dashboard pane (1400–1624), React UI
- Policy section extraction + tree view
- Organize workspace files with AI classification (1174–1309)
- Summarization tool
- Vector backend: `sqlite-vec` implementation to remove external dependency on Chroma

## Acceptance Checklist (Phase 1)

- Index supported files into SQLite; vectors stored via adapter
- Search returns `ContextPack` with attributions
- Tools callable from chat and palette
- Global/workspace storage honored per setting
- Watchers re-index on change

## To-dos

- [ ] Define RAG types in `common/ragServiceTypes.ts`
- [ ] Implement `common/ragPathService.ts`
- [ ] Implement electron-main `ragMainService` + channel
- [ ] Implement `ragVectorAdapter` (chroma-http)
- [ ] Implement main `ragIndexService` (SQLite + vector)
- [ ] Implement main `ragFileService` (PDF/DOCX/TXT/MD)
- [ ] Implement `ragContextService` (context packs)
- [ ] Integrate tools in `toolsService.ts` + commands
- [ ] Surface settings in Void settings pane
- [ ] Add tests for index/search

### To-dos

- [ ] Create RAG type definitions in common/ragServiceTypes.ts
- [ ] Implement path resolution service using IEnvironmentService
- [ ] Build RAG index service with Chroma and SQLite integration
- [ ] Create file extraction service for PDF/DOCX/TXT/MD
- [ ] Integrate RAG tools into existing toolsService
- [ ] Create Policy Dashboard pane with ViewPane pattern
- [ ] Build React UI for RAG dashboard
- [ ] Register all services in void.contribution.ts
- [ ] Add RAG configuration to Void settings
- [ ] Add required packages to package.json
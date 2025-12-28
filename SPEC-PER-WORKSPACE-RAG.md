# Per-Workspace RAG System Specification

## Overview

This specification describes the implementation of a per-workspace RAG (Retrieval-Augmented Generation) indexing system for SafeAppeals Navigator. Each workspace will have its own isolated document index, enabling users to work on multiple cases without data cross-contamination.

## Goals

1. **Workspace Isolation**: Each VS Code workspace has its own RAG databases
2. **Dual Index System**: Separate indexes for Policy Manuals vs Case Files
3. **Auto-Indexing**: Documents dropped into chat are automatically indexed
4. **Seamless Switching**: Changing workspaces automatically switches RAG context
5. **Persistence**: Indexes survive application restarts

## Current State Analysis

### What Already Exists

| Component | Status | Notes |
|-----------|--------|-------|
| `workspaceId` in types | ✅ Exists | `RAGIndexParams`, `RAGSearchParams`, `DocumentRecord` |
| `RAGPathService` workspace methods | ✅ Exists | `getWorkspaceChromaDir()`, `getWorkspaceSqlitePath()` |
| `RAGWorkspaceService` passes workspaceId | ✅ Exists | Uses `workspaceService.getWorkspace().id` |
| `RAGStorageScope` types | ✅ Exists | `'policy_manual' \| 'workspace_docs' \| 'both'` |
| Per-workspace database usage | ❌ Not implemented | Main service uses global database |
| Auto-index on drag-drop | ❌ Not implemented | Files dropped are not indexed |

### Current File Locations

```
src/vs/workbench/contrib/void/
├── common/rag/
│   ├── ragService.ts              # Browser-side IPC proxy
│   ├── ragServiceTypes.ts         # Type definitions
│   ├── ragPathService.ts          # Path management (has workspace methods!)
│   ├── ragVectorAdapter.ts        # Vector storage adapters
│   ├── ragHybridRetriever.ts      # Hybrid BM25 + vector search
│   ├── ragQueryProcessor.ts       # Query routing
│   ├── ragReranker.ts             # Cross-encoder reranking
│   └── ragContextService.ts       # Context formatting
├── browser/rag/
│   ├── ragWorkspaceService.ts     # Workspace file watching & auto-index
│   └── ragActions.ts              # UI actions for RAG
└── electron-main/rag/
    ├── ragMainService.ts          # Main process RAG implementation
    ├── ragMainChannel.ts          # IPC channel handler
    ├── ragIndexService.ts         # Document chunking & SQLite
    └── ragFileService.ts          # File content extraction
```

## Proposed Architecture

### Database Structure

```
~/.safe-appeals-navigator/
└── databases/
    └── workspaces/
        └── <workspace-id>/           # Hash of workspace folder path
            ├── chroma/               # Persistent vector embeddings
            │   ├── policy_manual/    # Collection: policy documents
            │   └── case_index/       # Collection: case files
            └── workspace.db          # SQLite: chunks, documents metadata
```

### Workspace ID Generation

```typescript
// Use workspace folder path hash for stability
function getWorkspaceId(workspaceContextService: IWorkspaceContextService): string {
  const folder = workspaceContextService.getWorkspace().folders[0];
  if (!folder) return 'default';

  // Create stable hash from folder path
  const crypto = require('crypto');
  return crypto.createHash('sha256')
    .update(folder.uri.fsPath)
    .digest('hex')
    .substring(0, 16);
}
```

### Index Types

| Index | Scope | Auto-Indexed From | Use Case |
|-------|-------|-------------------|----------|
| **Policy Manual** | `policy_manual` | `policy-manuals/` folder | Legal references, regulations, WCB policies |
| **Case Index** | `case_index` | Drag-drop to chat, explicit add | Case-specific documents, medical records, correspondence |

## Implementation Plan

### Phase 1: Per-Workspace Database Routing

**Files to modify:**
- `electron-main/rag/ragMainService.ts`
- `electron-main/rag/ragIndexService.ts`

**Changes:**

1. **Create `WorkspaceRAGManager` class** (new file: `electron-main/rag/ragWorkspaceManager.ts`)

```typescript
// Manages per-workspace RAG instances
export class WorkspaceRAGManager {
  private workspaceAdapters: Map<string, {
    vectorAdapter: VectorAdapter;
    indexService: RAGIndexService;
    hybridRetriever: HybridRetriever;
    reranker: LocalCrossEncoderReranker;
  }> = new Map();

  async getOrCreateWorkspace(workspaceId: string): Promise<WorkspaceRAGInstance>;
  async switchWorkspace(workspaceId: string): Promise<void>;
  async disposeWorkspace(workspaceId: string): Promise<void>;
}
```

2. **Update `RAGMainService.initialize()`**
   - Accept `workspaceId` parameter
   - Use `pathService.getWorkspaceChromaDir(workspaceId)`
   - Use `pathService.getWorkspaceSqlitePath(workspaceId)`

3. **Update all RAG operations** to use workspace-specific instances:
   - `indexDocument()` → route to workspace's indexer
   - `search()` → route to workspace's retriever
   - `deleteDocument()` → route to workspace's storage

### Phase 2: Browser-Side Workspace Integration

**Files to modify:**
- `common/rag/ragService.ts`
- `browser/rag/ragWorkspaceService.ts`

**Changes:**

1. **Update `RAGService`** to always include workspaceId:

```typescript
export class RAGService implements IRAGService {
  constructor(
    @IMainProcessService mainProcessService: IMainProcessService,
    @IVoidSettingsService settingsService: IVoidSettingsService,
    @IWorkspaceContextService workspaceContextService: IWorkspaceContextService // ADD
  ) {
    this.channel = mainProcessService.getChannel('void-channel-rag');
    this.workspaceId = this.computeWorkspaceId();
  }

  private computeWorkspaceId(): string {
    // Hash of workspace folder path
  }

  async indexDocument(params: RAGIndexParams): Promise<...> {
    return this.channel.call('indexDocument', {
      ...params,
      uri: params.uri.toJSON(),
      workspaceId: params.workspaceId || this.workspaceId // Always include
    });
  }

  async search(params: RAGSearchParams): Promise<ContextPack> {
    return this.channel.call('search', {
      ...params,
      workspaceId: params.workspaceId || this.workspaceId // Always include
    });
  }
}
```

2. **Add workspace change listener**:

```typescript
// In RAGWorkspaceService
this._register(this.workspaceService.onDidChangeWorkspaceFolders(async () => {
  // Notify main process to switch workspace context
  await this.ragService.switchWorkspace(this.computeWorkspaceId());
}));
```

### Phase 3: Auto-Index on Drag-Drop

**Files to modify:**
- `browser/react/src/sidebar-tsx/SidebarChat.tsx`
- `browser/chatThreadService.ts` (or create new service)

**Changes:**

1. **Create `RAGAutoIndexService`** (new service):

```typescript
export interface IRAGAutoIndexService {
  indexSelectionIfNeeded(selection: StagingSelectionItem): Promise<void>;
  isDocumentIndexed(uri: URI): Promise<boolean>;
}

export class RAGAutoIndexService implements IRAGAutoIndexService {
  async indexSelectionIfNeeded(selection: StagingSelectionItem): Promise<void> {
    if (selection.type !== 'File') return;

    // Skip if already indexed
    if (await this.ragService.isDocumentIndexed(selection.uri)) return;

    // Skip non-document files
    const ext = selection.uri.path.split('.').pop()?.toLowerCase();
    if (!['pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt', 'md'].includes(ext || '')) return;

    // Determine if it's a policy manual or case file
    const isPolicyManual = this.isInPolicyFolder(selection.uri);

    // Index in background
    await this.ragService.indexDocument({
      uri: selection.uri,
      isPolicyManual,
      workspaceId: this.workspaceId
    });
  }
}
```

2. **Hook into drag-drop handler** in `SidebarChat.tsx`:

```typescript
// In handleDrop, after adding to newSelections:
for (const selection of newSelections) {
  if (selection.type === 'File') {
    // Trigger background indexing
    ragAutoIndexService.indexSelectionIfNeeded(selection).catch(err => {
      console.error('Auto-index failed:', err);
    });
  }
}
```

3. **Also hook into `addNewStagingSelection`** in `chatThreadService.ts`:

```typescript
addNewStagingSelection(selection: StagingSelectionItem) {
  // ... existing code ...

  // Auto-index if it's a document
  this.ragAutoIndexService?.indexSelectionIfNeeded(selection);
}
```

### Phase 4: Search Scope Updates

**Files to modify:**
- `common/rag/ragServiceTypes.ts`
- `common/rag/ragQueryProcessor.ts`
- `electron-main/rag/ragMainService.ts`

**Changes:**

1. **Update `RAGStorageScope`**:

```typescript
// Old
export type RAGStorageScope = 'policy_manual' | 'workspace_docs' | 'both';

// New (more explicit, all scoped to current workspace)
export type RAGStorageScope =
  | 'policy_manual'   // Only policy manuals for THIS workspace
  | 'case_index'      // Only case files for THIS workspace
  | 'workspace_all';  // Both policy + case for THIS workspace

// NOTE: No cross-workspace search. Each workspace is fully isolated.
// This allows different policy manuals per workspace (e.g., WA vs CA policies)
```

2. **Update query routing** in `ragQueryProcessor.ts`:
   - Policy-related queries → `policy_manual`
   - Case-specific queries → `case_index`
   - General queries → `workspace_all`

### Phase 5: UI Enhancements (Optional)

1. **Show indexing status** in chat sidebar
2. **"Re-index workspace" action** in command palette
3. **Index statistics** in settings panel (per-workspace)
4. **Manual "Add to Case Index" context menu** in file explorer

## Type Changes Summary

### `ragServiceTypes.ts`

```typescript
// Add to RAGIndexParams
export interface RAGIndexParams {
  uri: URI;
  isPolicyManual: boolean;
  workspaceId: string;  // Make required (was optional)
  indexScope?: 'policy_manual' | 'case_index';  // NEW: explicit index target
}

// Add to RAGSearchParams
export interface RAGSearchParams {
  query: string;
  scope: RAGStorageScope;
  limit: number;
  workspaceId: string;  // Make required (was optional)
}

// Update scope type
export type RAGStorageScope =
  | 'policy_manual'
  | 'case_index'
  | 'workspace_all';
```

## IPC Channel Updates

### `ragMainChannel.ts`

All channel methods must handle `workspaceId`:

```typescript
case 'indexDocument': {
  const { uri, isPolicyManual, workspaceId } = args;
  // Route to correct workspace instance
  const instance = await this.workspaceManager.getOrCreate(workspaceId);
  return instance.indexDocument({ uri: URI.revive(uri), isPolicyManual });
}

case 'search': {
  const { query, scope, limit, workspaceId } = args;
  const instance = await this.workspaceManager.getOrCreate(workspaceId);
  return instance.search({ query, scope, limit });
}
```

## Migration Strategy

For users with existing RAG data in global database:

1. **Detect legacy database** on first run after update
2. **Offer migration prompt**: "Migrate existing index to current workspace?"
3. **If yes**: Copy embeddings and chunks to workspace-specific database
4. **If no**: Start fresh, legacy data remains but unused

## Testing Checklist

- [ ] Create workspace A, add documents, verify indexing
- [ ] Create workspace B, add different documents, verify isolation
- [ ] Switch between workspaces, verify search returns correct results
- [ ] Drag-drop PDF to chat, verify auto-indexing
- [ ] Restart application, verify indexes persist
- [ ] Search policy manual, verify only policy docs returned
- [ ] Search case files, verify only case docs returned
- [ ] Delete document, verify removal from index

## File Change Summary

| File | Change Type | Effort |
|------|-------------|--------|
| `electron-main/rag/ragWorkspaceManager.ts` | **NEW** | Medium |
| `electron-main/rag/ragMainService.ts` | Modify | Medium |
| `electron-main/rag/ragMainChannel.ts` | Modify | Low |
| `common/rag/ragService.ts` | Modify | Low |
| `common/rag/ragServiceTypes.ts` | Modify | Low |
| `browser/rag/ragWorkspaceService.ts` | Modify | Low |
| `browser/rag/ragAutoIndexService.ts` | **NEW** | Medium |
| `browser/react/src/sidebar-tsx/SidebarChat.tsx` | Modify | Low |
| `browser/chatThreadService.ts` | Modify | Low |

**Total Estimated Effort**: 2-3 hours of focused work

## Design Decisions

1. **Memory management**: Keep workspace instances loaded (no unloading on inactivity)
   - Simpler implementation, faster workspace switching

2. **Policy Manual Isolation**: Each workspace has its OWN policy manual index
   - No cross-workspace policy search
   - Users can add same document to multiple workspaces if needed
   - Keeps things clean when policy manuals differ between cases/jurisdictions
   - Example: WA state policies in one workspace, CA policies in another

3. **Index size limits**: No warnings or limits
   - Let users manage their own workspace sizes

4. **Export/Import**: ✅ Support exporting/importing workspace indexes (Phase 6 - Future)
   - Useful for backup, sharing case templates, moving between machines

## Future Enhancement: Export/Import (Phase 6)

```typescript
// Future API
interface IRAGExportService {
  exportWorkspaceIndex(workspaceId: string, targetPath: string): Promise<void>;
  importWorkspaceIndex(sourcePath: string, workspaceId: string): Promise<void>;
}
```

Export format could be:
- ZIP containing `workspace.db` + `chroma/` folder
- Or JSON export of chunks + regenerate embeddings on import

## Next Steps

1. Review this spec and provide feedback
2. Start with Phase 1 (per-workspace database routing)
3. Test with two workspaces
4. Proceed to Phase 2-4
5. Add UI enhancements as needed


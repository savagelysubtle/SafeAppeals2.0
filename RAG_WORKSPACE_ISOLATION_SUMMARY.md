# RAG Micro Database Isolation - Implementation Summary

**Version**: 2.1 (Micro Database Architecture)
**Date**: December 30, 2025
**Status**: ✅ COMPLETE - Global database fully removed

---

## Architecture Overview

### MICRO DATABASE ARCHITECTURE

Each workspace (case folder) gets its own **completely isolated micro database**:

```
%APPDATA%\Safe Appeals Navigator\User\.safe-appeals-navigator\
├── databases/
│   └── workspaces/
│       ├── [hash-A]/           # Case A's micro database
│       │   ├── workspace.db    # SQLite: metadata, chunks, FTS5
│       │   ├── chroma/
│       │   │   └── embeddings.db  # Vector embeddings
│       │   └── emails.db       # Email data
│       │
│       ├── [hash-B]/           # Case B's micro database
│       │   ├── workspace.db
│       │   ├── chroma/
│       │   │   └── embeddings.db
│       │   └── emails.db
│       │
│       └── [hash-N]/           # Case N's micro database
│           └── ...
│
├── models/                     # Shared ML models (not case-specific)
└── logs/                       # Debug logs
```

### What "Micro Database" Means

1. **Per-Workspace SQLite** (`workspace.db`)

   - Document metadata (filename, filepath, checksum, etc.)
   - Text chunks with hierarchical structure
   - FTS5 full-text search index

2. **Per-Workspace Vector Store** (`chroma/embeddings.db`)

   - 384-dimensional embeddings (all-MiniLM-L6-v2)
   - In-memory cache + SQLite persistence

3. **Per-Workspace Email Store** (`emails.db`)
   - Email metadata and content
   - Attachment references

---

## Key Changes Made (v2.1)

### 1. RAGIndexService - workspaceId Now REQUIRED

**File**: `src/vs/workbench/contrib/void/electron-main/rag/ragIndexService.ts`

```typescript
// BEFORE (v2.0) - had global fallback
constructor(workspaceId?: string) {
    this.workspaceId = workspaceId;
}

// AFTER (v2.1) - workspaceId REQUIRED, no fallback
constructor(workspaceId: string) {
    if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null') {
        throw new Error('RAGIndexService: workspaceId is REQUIRED. No global database allowed.');
    }
    this.workspaceId = workspaceId;
}
```

### 2. RAGPathService - Global Methods REMOVED

**File**: `src/vs/workbench/contrib/void/common/rag/ragPathService.ts`

```typescript
// REMOVED - no more global database paths
// getGlobalChromaDir(): string;
// getGlobalSqlitePath(): string;

// KEPT - per-workspace paths with validation
getWorkspaceChromaDir(workspaceId: string): string {
    if (!workspaceId) throw new Error('workspaceId is REQUIRED');
    return join(this.getBaseDir(), 'databases', 'workspaces', workspaceId, 'chroma');
}

getWorkspaceSqlitePath(workspaceId: string): string {
    if (!workspaceId) throw new Error('workspaceId is REQUIRED');
    return join(this.getBaseDir(), 'databases', 'workspaces', workspaceId, 'workspace.db');
}
```

### 3. RAGService (Browser) - No Default Fallback

**File**: `src/vs/workbench/contrib/void/common/rag/ragService.ts`

```typescript
// BEFORE - used "default" when no workspace
if (folders.length === 0) {
	return "default"; // DANGER: shared database!
}

// AFTER - throws error, requires workspace
if (folders.length === 0) {
	throw new Error(
		"RAG requires a workspace folder. Please open a case folder first."
	);
}
```

### 4. RAGMainChannel - IPC Validation

**File**: `src/vs/workbench/contrib/void/electron-main/rag/ragMainChannel.ts`

```typescript
// ADDED - strict validation at IPC layer
const requiresWorkspaceId = ['indexDocument', 'search', 'getStats', ...];
if (requiresWorkspaceId.includes(command) && !workspaceId) {
    return Promise.reject(new Error('workspaceId is REQUIRED. No global database allowed.'));
}
```

### 5. Type Definitions Updated

**File**: `src/vs/workbench/contrib/void/common/rag/ragServiceTypes.ts`

```typescript
// DocumentRecord - workspaceId now required
export interface DocumentRecord {
	workspaceId: string; // REQUIRED - was optional
	// ...
}

// IndexDocumentParams - workspaceId now required
export interface IndexDocumentParams {
	workspaceId: string; // REQUIRED - was optional
	// ...
}
```

---

## Data Flow (After Changes)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User opens case folder: D:\Cases\Smith-v-Acme                           │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ RAGService.computeWorkspaceId()                                          │
│   → hash("D:\Cases\Smith-v-Acme") → "a7f3b2c1"                          │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ IPC Call: indexDocument({ uri, workspaceId: "a7f3b2c1" })               │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ RAGMainChannel validates workspaceId is present                          │
│   ✓ "a7f3b2c1" is valid                                                 │
│   ✗ undefined/null → REJECT with error                                  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ WorkspaceRAGManager.getOrCreateWorkspace("a7f3b2c1")                     │
│   → Creates micro database at:                                           │
│     %APPDATA%/.../databases/workspaces/a7f3b2c1/                        │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ RAGIndexService (workspaceId: "a7f3b2c1")                                │
│   → workspace.db created/opened                                          │
│   → Documents, chunks, FTS5 stored                                       │
│                                                                          │
│ ChromaPersistentAdapter                                                  │
│   → chroma/embeddings.db created/opened                                  │
│   → Vector embeddings stored                                             │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Validation Layers

The system now has **5 layers of validation** to prevent global database access:

| Layer | Component             | Validation                                     |
| ----- | --------------------- | ---------------------------------------------- |
| 1     | Browser `RAGService`  | Throws error if no workspace folder open       |
| 2     | IPC `RAGMainChannel`  | Rejects calls without valid workspaceId        |
| 3     | `RAGMainService`      | Validates workspaceId before getting instance  |
| 4     | `WorkspaceRAGManager` | Validates workspaceId before creating instance |
| 5     | `RAGIndexService`     | Constructor throws if workspaceId missing      |

---

## Benefits of Micro Database Architecture

### 1. **Complete Data Isolation**

- Documents from Case A can NEVER leak into Case B
- Each case has physically separate database files

### 2. **Legal/HIPAA Compliance**

- Confidential data is isolated by design
- Easy to demonstrate data segregation in audits

### 3. **Easy Case Management**

- Backup: Copy entire workspace folder
- Delete: Delete workspace folder
- Migrate: Move workspace folder to new machine

### 4. **Performance**

- Smaller databases = faster queries
- Each case only indexes its own documents

### 5. **Debugging**

- Easy to inspect which documents are in which case
- Clear folder structure for troubleshooting

---

## Verification Steps

1. **Build and run**:

   ```bash
   bun run buildreact
   bun run compile
   .\scripts\code.bat
   ```

2. **Open Case A** (e.g., `D:\Cases\Smith-v-Acme`)

3. **Index a document** via the sidebar

4. **Verify micro database created**:

   ```
   %APPDATA%\Safe Appeals Navigator\User\.safe-appeals-navigator\
   └── databases\workspaces\[hash-A]\
       ├── workspace.db         # Should contain the document
       └── chroma\embeddings.db # Should contain embeddings
   ```

5. **Open Case B** (e.g., `D:\Cases\Johnson-v-MegaCorp`)

6. **Verify Case A documents NOT visible** in Case B's RAG stats

7. **Index a document in Case B**

8. **Verify separate database created**:

   ```
   databases\workspaces\[hash-B]\
   ├── workspace.db         # Different hash, different database
   └── chroma\embeddings.db
   ```

9. **Confirm isolation**:
   - Open `[hash-A]\workspace.db` with SQLite browser
   - Open `[hash-B]\workspace.db` with SQLite browser
   - Verify documents are in correct databases only

---

## Files Modified

| File                     | Changes                                                                      |
| ------------------------ | ---------------------------------------------------------------------------- |
| `ragIndexService.ts`     | workspaceId now required in constructor; removed global fallback             |
| `ragPathService.ts`      | Removed `getGlobalChromaDir()` and `getGlobalSqlitePath()`; added validation |
| `ragService.ts`          | Throws error if no workspace folder instead of using "default"               |
| `ragServiceTypes.ts`     | `workspaceId` now required in `DocumentRecord` and `IndexDocumentParams`     |
| `ragMainService.ts`      | Updated logging to show micro database architecture                          |
| `ragWorkspaceManager.ts` | Added validation; updated documentation                                      |
| `ragMainChannel.ts`      | Added IPC-level validation for workspaceId                                   |

---

## Summary

✅ **Global database completely removed**
✅ **Each workspace has isolated micro database**
✅ **5 layers of validation prevent global access**
✅ **Type system enforces workspaceId requirement**
✅ **Clear error messages if workspace not open**

**The RAG system now guarantees that documents from different cases can NEVER be mixed or accessed across workspaces.**

---

## Documentation Updates (December 30, 2025)

All RAG system documentation has been updated to reflect the micro database architecture:

| Document                                     | Changes                                            |
| -------------------------------------------- | -------------------------------------------------- |
| `docs/ragSystem/architecture.md`             | Updated deployment structure, removed global paths |
| `docs/ragSystem/README.md`                   | Updated file paths, made workspaceId required      |
| `docs/ragSystem/configuration.md`            | Removed global path methods, added validation      |
| `docs/ragSystem/quickstart.md`               | Updated examples with auto-injected workspaceId    |
| `docs/ragSystem/api-reference.md`            | Made workspaceId required in all interfaces        |
| `docs/ragSystem/troubleshooting.md`          | Updated database recovery for micro architecture   |
| `docs/ragSystem/migration.md`                | Added legacy cleanup instructions                  |
| `docs/ragSystem/index.md`                    | Updated system status table                        |
| `docs/ragSystem/RAG_SYSTEM_DOCUMENTATION.md` | Updated file paths and type definitions            |

Legacy global databases have been deleted from the system.

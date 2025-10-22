# Added Features Tracker

This document tracks all new features added to SafeAppeals2.0 (Void fork).

---

## 🔍 RAG (Retrieval Augmented Generation) System

**Status**: ✅ Implemented
**Branch**: `feat-safe-appeals-rag-integration`
**Date Added**: October 2025

### Core Features

#### 1. **Document Indexing & Search**

- ✅ PDF, DOCX, TXT, MD file support
- ✅ Hybrid SQLite (metadata) + ChromaDB (vector embeddings) storage
- ✅ Chunking with configurable size and overlap
- ✅ **Local embeddings** via Transformers.js (all-MiniLM-L6-v2)
- ✅ Semantic search with relevance scoring
- ✅ **No API costs** - free, offline embeddings

**Embedding Model Details**:

- Model: `all-MiniLM-L6-v2` (Hugging Face)
- Size: ~23 MB (auto-downloaded and cached)
- Dimension: 384 (optimized for speed/quality balance)
- Performance: ~50-100 embeddings/second on CPU
- Cost: $0 (vs. ~$0.02 per 1M tokens with OpenAI)
- Offline: Works without internet after first download

#### 2. **Workspace Integration**

**Auto-Detection & Indexing**

- ✅ Auto-creates `policy-manuals/` folder in workspace root
- ✅ Customizable folder name via settings (`ragPolicyFolderName`)
- ✅ File system watcher for automatic re-indexing on changes
- ✅ Detects PDF, DOCX, TXT, MD file additions/updates/deletions
- ✅ Background indexing without blocking UI

**Manual Controls**

- ✅ Explorer context menu: "Index as Policy Manual"
- ✅ F1 Command: "RAG: Create Policy Manuals Folder"
- ✅ Visual notifications for indexing status
- ✅ Error handling with user-friendly messages

#### 3. **Storage Architecture**

**Local Persistent Mode (No Server Required)**

- ✅ ChromaDB in embedded/persistent mode
- ✅ SQLite database for document metadata
- ✅ Global app data directory for RAG databases
- ✅ Workspace-specific isolation support
- ✅ Automatic directory creation and management

**Paths**:

- Global: `%APPDATA%/SafeAppealNavigator/User/rag/`
- Chroma: `<global>/chroma/`
- SQLite: `<global>/workspace.db`
- Model Cache: `<global>/models/` (Transformers.js model storage)

#### 4. **Settings**

**Configuration Options** (`Void Settings` panel)

- ✅ `ragEnabled` - Enable/disable RAG system (default: true)
- ✅ `ragChunkSize` - Token size per chunk (default: 500)
- ✅ `ragChunkOverlap` - Overlap between chunks (default: 50)
- ✅ `ragSearchLimit` - Max results per search (default: 5)
- ✅ `ragStorageScope` - 'policy_manual' | 'workspace_docs' | 'both'
- ✅ `ragVectorBackend` - 'chroma-http' | 'sqlite-vec'
- ~~❌ `ragOpenAIModel` - **Removed** (using local embeddings)~~
- ✅ `ragAutoIndexPolicyFolder` - Auto-index policy folder (default: true)
- ✅ `ragPolicyFolderName` - Custom folder name (default: 'policy-manuals')
- ✅ `ragWatchPolicyFolder` - Watch for file changes (default: true)
- ✅ `ragShowIndexedBadge` - Show decoration in Explorer (default: true)

#### 5. **Tools Integration**

**Available RAG Tools** (callable from chat)

- ✅ `rag_index_document` - Index a document for search
- ✅ `rag_search_policy` - Search policy manuals
- ✅ `rag_search_workspace` - Search workspace documents
- ✅ `rag_get_stats` - Get index statistics

**Tool Capabilities**

- ✅ Streaming results support
- ✅ Context pack assembly with attributions
- ✅ Relevance scoring and ranking
- ✅ Metadata preservation (filename, filepath, upload date)

#### 6. **Services Architecture**

**Browser Process**

- ✅ `RAGService` - Main browser-side API
- ✅ `RAGWorkspaceService` - Workspace folder management
- ✅ `RAGContextService` - Context pack formatting

**Electron Main Process**

- ✅ `RAGMainService` - Core indexing and search logic
- ✅ `RAGIndexService` - SQLite metadata management
- ✅ `RAGFileService` - Document extraction (PDF/DOCX)
- ✅ `RAGPathService` - Path resolution and directory management
- ✅ `RAGMainChannel` - IPC communication bridge

**Common (Shared)**

- ✅ Type definitions and interfaces
- ✅ Vector adapter abstraction
- ✅ ChromaPersistentAdapter implementation
- ✅ SQLiteVecAdapter stub (future)

#### 7. **Commands**

**Command Palette (F1)**

- ✅ `RAG: Index Document for RAG` - Manual indexing prompt
- ✅ `RAG: Search Policy Manual` - Search prompt
- ✅ `RAG: Search Workspace Documents` - Workspace search
- ✅ `RAG: Get RAG Statistics` - Show index stats
- ✅ `RAG: Create Policy Manuals Folder` - Manual folder creation
- ✅ `RAG: Clear All RAG Embeddings` - Reset vector store and metadata

#### 8. **Cost & Performance Optimizations**

**Rate Limiting** (Added Oct 2025)

- ✅ Automatic rate limiting for OpenAI embeddings API (10 requests/second max)
- ✅ Exponential backoff retry logic for 429 errors (3 retries max)
- ✅ Configurable delay between embedding requests (100ms default)
- ✅ Per-batch memory logging to track resource usage

**Duplicate Prevention** (Added Oct 2025)

- ✅ Agent system prompt updated with RAG awareness guidelines
- ✅ Automatic duplicate check before indexing documents
- ✅ Tool handler checks `isDocumentIndexed()` before processing
- ✅ Clear user feedback when skipping already-indexed documents
- ✅ Prevents double-embedding and double-cost for same document

**Rate Limiting Configuration**:

```typescript
EMBEDDING_DELAY_MS: 100 // 10 requests/second
MAX_RETRIES: 3
RETRY_DELAY_MS: 1000 // Base delay, exponential backoff
```

**Agent Prompt Guidance**:

- Agent instructed to check RAG stats before indexing
- Must verify document not already indexed to avoid duplicate costs
- Encourages using `rag_get_stats` and context awareness
- Tool description emphasizes checking before indexing

**Explorer Context Menu**

- ✅ "Index as Policy Manual" (PDF, DOCX, TXT, MD files only)

#### 8. **Dependencies Added**

- ✅ `chromadb@^1.8.1` - Vector database
- ✅ `pdfjs-dist@^4.7.67` - PDF parsing
- ✅ `mammoth@^1.6.0` - DOCX extraction

---

## 📁 Case Organizer Feature

**Status**: ✅ Implemented
**Date Added**: January 2025

### Core Features

#### 1. **Agent Workflow**

- ✅ Command: "Void: Initialize Case Organizer" (`void.organizer.init`)
- ✅ Auto-opens Void sidebar in Agent mode
- ✅ Pre-fills specialized prompt for case organization
- ✅ Three organization modes: Full Auto, Interactive, Manual

#### 2. **Folder Structure**

**Automatic Folder Creation**:

- ✅ `tosort/` folder auto-created when opening new workspace
- ✅ Customizable via `caseOrganizerTosortFolderName` setting (default: 'tosort')
- ✅ Can be disabled via `caseOrganizerAutoCreateTosort` setting
- ✅ Same auto-creation logic as `policy-manuals/` folder

**Case Organization Structure**:

- ✅ Auto-creates structured case folders:
  - `Medical_Reports/`
  - `Correspondence/`
  - `Decisions_and_Orders/`
  - `Evidence/`
  - `Personal_Notes/`
  - `Uncategorized/`

#### 3. **Safety Features**

- ✅ Dry-run preview before any file operations
- ✅ Automatic backups to `tosort/_originals/`
- ✅ Conflict resolution with auto-rename
- ✅ Operation logging (`organization_log.json`)
- ✅ Undo plans (`undo_plan.json`)
- ✅ No deletions by default

#### 4. **Categorization**

- ✅ Filename pattern matching heuristics
- ✅ Confidence scoring (high/medium/low)
- ✅ Custom category support via `.voidrules`
- ✅ Interactive confirmation for uncertain files

#### 5. **Tools Used**

- ✅ `run_command` - Execute PowerShell/bash
- ✅ `get_dir_tree` - Analyze folder structure
- ✅ `read_file` - Sample file content
- ✅ `ls_dir` - List directory contents

#### 6. **OS Support**

- ✅ Windows (PowerShell commands)
- ✅ macOS/Linux (bash commands)
- ✅ OS-specific command generation

---

## 🔄 Integration Points

### RAG + Case Organizer Synergy

- 🔄 **Planned**: Auto-index case documents as they're organized
- 🔄 **Planned**: RAG search within case folders
- 🔄 **Planned**: Policy manual reference during case organization

### Shared Infrastructure

- ✅ Void sidebar for both features
- ✅ Agent mode for workflow automation
- ✅ Terminal tools for file operations
- ✅ Settings service for configuration

---

## 📊 Technical Architecture

### Services Hierarchy

```
Browser Process:
├── RAGService (IPC client)
├── RAGWorkspaceService (file watching)
├── RAGContextService (formatting)
└── VoidSettingsService (config)

Electron Main:
├── RAGMainService (orchestrator)
├── RAGIndexService (SQLite)
├── RAGFileService (extraction)
├── RAGPathService (paths)
└── ChromaPersistentAdapter (vectors)

IPC Communication:
└── RAGMainChannel (browser ↔ main)
```

### Data Flow

```
User Action (right-click, drag file, chat command)
    ↓
Browser Process (RAGService)
    ↓
IPC Channel (RAGMainChannel)
    ↓
Main Process (RAGMainService)
    ↓
├─→ RAGFileService (extract text)
├─→ RAGIndexService (store metadata)
└─→ ChromaDB (store embeddings)
```

---

## 🚧 Known Limitations & Future Work

### RAG System

- ✅ **Resolved**: Rate limiting prevents API throttling (added Oct 2025)
- ✅ **Resolved**: Duplicate indexing prevented with auto-check (added Oct 2025)
- ⚠️ **Issue**: Auto-indexing doesn't trigger on file copy (watcher limitation)
  - **Workaround**: Use right-click "Index as Policy Manual"
  - **Fix Planned**: Polling fallback for file system events
- ⚠️ **Issue**: OpenAI embeddings cost money (paid API)
  - **Workaround**: Use sparingly, rate-limited to 10/sec
  - **Fix Planned**: Local embeddings with Transformers.js (see rag-ux-complete.plan.md)
- 🔄 **Planned**: SQLite-vec backend as Chroma alternative
- 🔄 **Planned**: File decorations in Explorer for indexed files
- 🔄 **Planned**: Settings UI panel for RAG configuration
- 🔄 **Planned**: ViewPane sidebar for RAG management
- 🔄 **Planned**: Global upload via settings (non-workspace files)

### Case Organizer

- 🔄 **Planned**: MCP server for richer file operations
- 🔄 **Planned**: Template-based categorization rules
- 🔄 **Planned**: OCR for scanned documents
- 🔄 **Planned**: Auto-tagging with metadata

---

## 📝 Documentation Files

### Created

- ✅ `CASE_ORGANIZER_README.md` - Case Organizer usage guide
- ✅ `ADDED_FEATURES_TRACKER.md` - This file

### Updated

- ✅ `CLAUDE.md` - Added RAG architecture notes
- ✅ `VOID_CODEBASE_GUIDE.md` - Architecture diagrams

### Plan Files

- ✅ `.cursor/plans/safe-appeals-rag-integration-48f0032a.plan.md`
- ✅ `.cursor/plans/rag-ux-complete-561ae376.plan.md`

---

## 🎯 Next Steps

### Immediate (High Priority)

1. ✅ Fix RAGPathService registration
2. ⏳ Debug auto-indexing file watcher
3. ⏳ Add file decorations for indexed documents
4. ⏳ Test end-to-end indexing + search workflow

### Short Term (This Sprint)

1. ⏳ Create RAG Settings panel in Void Settings
2. ⏳ Add ViewPane for RAG management
3. ⏳ Implement global upload via settings
4. ⏳ Add progress indicators for indexing

### Medium Term (Next Sprint)

1. ⏳ SQLite-vec backend implementation
2. ⏳ Integration tests for RAG system
3. ⏳ Performance optimization (chunking, caching)
4. ⏳ Documentation and examples

### Long Term (Future)

1. ⏳ Multi-modal RAG (images, tables, charts)
2. ⏳ RAG analytics dashboard
3. ⏳ Case Organizer + RAG integration
4. ⏳ Cloud sync for RAG databases

---

## 📞 Contacts & Resources

- **GitHub**: <https://github.com/savagelysubtle/SafeAppeals2.0>
- **Developer**: @savagelysubtle (<simpleflowworks@gmail.com>)
- **Base Fork**: Void (VSCode fork)
- **Branch**: `feat-safe-appeals-rag-integration`

---

**Last Updated**: October 18, 2025
**Version**: 1.99.3

## Recent Updates (October 18, 2025)

### Memory Leak Fixes

- Fixed critical memory leaks during large PDF indexing
- Implemented batch processing for PDF pages (10 pages at a time)
- Added batch processing for embeddings (50 chunks at a time)
- Explicit resource cleanup (PDF pages, loading tasks)
- Garbage collection hints after each batch
- File size validation (100 MB hard limit, 50 MB soft limit)
- Memory usage monitoring and logging
- Increased Node.js heap size to 4GB
- Enabled explicit garbage collection (`--expose-gc`)

See `RAG_MEMORY_OPTIMIZATION.md` for detailed documentation.

# Added Features Tracker

This document tracks all new features added to SafeAppeals2.0 (Void fork).

---

## 📄 Document Viewers System

**Status**: ✅ Implemented
**Date Added**: November 2025

### Overview

A comprehensive document viewing and editing system integrated into the VS Code editor pane. Supports multiple document formats with content extraction for RAG/AI context.

### 1. **PDF Viewer**

**Status**: ✅ Fully Implemented

#### Core Features

- ✅ Native PDF rendering using pdf.js library
- ✅ Multi-page navigation with scroll support
- ✅ Zoom controls (fit-to-width, fit-to-page, custom zoom)
- ✅ Text selection and copy
- ✅ Content extraction for RAG indexing
- ✅ Keyboard shortcuts (Ctrl+K for quick edit actions)
- ✅ Annotation service integration
- ✅ Annotation persistence to workspace storage
- ✅ Highlight toolbar with color options
- ✅ Bookmarks tab in sidebar

#### Files

- `pdfViewerEditor.ts` - Main editor pane component
- `pdfViewerInput.ts` - Editor input handling
- `pdfContentExtractor.ts` - Text extraction for AI/RAG
- `pdfQuickEditActions.ts` - Ctrl+K quick actions
- `pdfAnnotationService.ts` - Annotation management with persistence
- `pdfContextGathering.ts` - Context for AI features
- `media/pdfViewer.js` - Webview script with annotation rendering
- `media/pdfViewer.css` - Styles including annotation UI

#### Libraries

- pdf.js (pdf.min.js, pdf.worker.min.js)

---

### 2. **DOCX Viewer**

**Status**: ✅ Fully Implemented

#### Core Features

- ✅ Native DOCX rendering using docx-preview library
- ✅ Rich text display with formatting preservation
- ✅ Content extraction for RAG indexing
- ✅ Live editing support via Tiptap editor
- ✅ Edit operations via IPC (insert_text, replace_text)
- ✅ Working copy management for unsaved changes

#### Edit Operations (Open Document)

- ✅ `format_text` - Bold, italic, underline, font size, color
- ✅ `insert_text` - Insert at position
- ✅ `insert_table` - Create tables
- ✅ `insert_page_break` - Page breaks
- ✅ `set_margins` - Document margins
- ✅ `replace_text` - Find and replace

#### Edit Operations (Closed Document via IPC)

- ✅ `insert_text` - Insert text at position
- ✅ `replace_text` - Find and replace (single or all)

#### Files

- `docxViewerEditor.ts` - Main editor pane component
- `docxViewerInput.ts` - Editor input handling
- `docxContentExtractor.ts` - Text extraction for AI/RAG
- `docxWorkingCopy.ts` - Unsaved changes management
- `tiptapDocxEditor.ts` - Rich text editing integration

#### Libraries

- docx-preview.min.js
- Tiptap editor bundle (tiptapBundle.js, tiptapDocxBundle.js)

---

### 3. **XLSX Viewer**

**Status**: ✅ Fully Implemented

#### Core Features

- ✅ Native spreadsheet rendering using SheetJS
- ✅ Multi-sheet support with tab navigation
- ✅ Cell selection and editing
- ✅ Formula display and evaluation
- ✅ Content extraction for RAG indexing
- ✅ x-spreadsheet UI for interactive editing
- ✅ Working copy management for unsaved changes

#### Edit Operations (Open Document)

- ✅ `set_cell_value` - Set cell value by sheet/cell reference
- ✅ `set_cell_formula` - Set cell formula
- ✅ `format_cell` - Bold, italic, background color, font size
- ✅ `insert_row` - Insert row at index
- ✅ `insert_column` - Insert column at index
- ✅ `delete_row` - Delete row by index
- ✅ `delete_column` - Delete column by index

#### Edit Operations (Closed Document via IPC)

- ✅ `set_cell_value` - Set cell value
- ✅ `set_cell_formula` - Set formula

#### Files

- `xlsxViewerEditor.ts` - Main editor pane component
- `xlsxViewerInput.ts` - Editor input handling
- `xlsxContentExtractor.ts` - Text extraction for AI/RAG
- `xlsxWorkingCopy.ts` - Unsaved changes management

#### Libraries

- xlsx.full.min.js (SheetJS)
- x-spreadsheet (xspreadsheet.js, xspreadsheet.css)

---

### 4. **Image Viewer**

**Status**: ✅ Fully Implemented (KAN-17 Complete)

#### Core Features

- ✅ **Format Support**: JPG, JPEG, PNG, GIF, WEBP, SVG
- ✅ **Secure Implementation**: Uses VS Code's `localResourceRoots` and CSP
- ✅ **Integrated Editor**: Opens directly within the VS Code editor pane
- ✅ **Error Handling**: User-friendly error messages for load failures

#### Zoom & Pan Controls (KAN-17)

- ✅ **Zoom Controls**:
  - Fit to Window button (keyboard: `F`)
  - Actual Size (100%) button (keyboard: `1`)
  - Zoom in/out buttons (+/−) (keyboard: `+`/`-`)
  - Zoom slider (10% - 500% range)
  - Zoom percentage display with live updates
- ✅ **Pan/Drag Navigation**:
  - Click and drag to pan when zoomed
  - Cursor changes to grab/grabbing during drag
- ✅ **Mouse Wheel Zoom**:
  - Zoom at cursor position (smart zoom-at-point)
  - 10% increment per scroll
- ✅ **Rotate Controls**:
  - Rotate left (↺) button (keyboard: `L`)
  - Rotate right (↻) button (keyboard: `R`)
- ✅ **Additional Features**:
  - Reset view button (keyboard: `0`)
  - Double-click toggles between fit and 100%
  - Image dimensions info display (e.g., "1920 × 1080 px")
  - Checkerboard background for transparency support

#### Files

- `imageViewerEditor.ts` - Main editor pane component with toolbar and webview
- `imageViewerInput.ts` - Editor input handling
- `imageViewerInputSerializer.ts` - Serialization for restore

---

### 5. **Document Editor Service**

**Status**: ✅ Implemented

A unified service for programmatic document editing across all supported formats.

#### Service Interface

```typescript
interface IDocumentEditorService {
	isDocumentOpen(uri: URI): boolean;
	editDOCX(params: {
		uri: URI;
		operations: DOCXEditOperation[];
	}): Promise<Result>;
	editXLSX(params: {
		uri: URI;
		operations: XLSXEditOperation[];
	}): Promise<Result>;
}
```

#### Features

- ✅ Automatic detection of open vs closed documents
- ✅ Live editing via webview messages for open documents
- ✅ Backend editing via IPC for closed documents
- ✅ Operation validation and error handling
- ✅ Logging for debugging

---

## 📋 Case Info Sidebar

**Status**: ✅ Implemented
**Date Added**: November 2025

### Overview

A dedicated sidebar panel for managing case information in workers' compensation and legal cases.

### Core Features

- ✅ **Sidebar Integration**: Dedicated view container in VS Code activity bar
- ✅ **React Dashboard**: Modern React-based UI component
- ✅ **Briefcase Icon**: Codicon.briefcase in activity bar (position 3)
- ✅ **Persistent State**: State storage for view configuration

### Registration

- **Container ID**: `workbench.view.caseInfo`
- **View ID**: `workbench.view.caseInfo.main`
- **Location**: Sidebar (ViewContainerLocation.Sidebar)

### Files

- `caseInfo.contribution.ts` - View container and view registration
- `caseInfoPane.ts` - ViewPane implementation with React mounting

### React Component

- Dynamically loaded from `../react/out/case-info-dashboard-tsx/index.js`
- Uses `mountCaseInfo(container, accessor)` for initialization
- Proper disposal handling via DisposableStore

---

## 📁 File Organizer

**Status**: ✅ Implemented
**Date Added**: November 2025

### Overview

A comprehensive file organization system for workers' compensation cases with AI-assisted classification, rule-based renaming, and smart destination routing.

### Core Features

#### 1. **Sidebar Dashboard**

- ✅ Dedicated view container in VS Code activity bar
- ✅ React-based wizard UI with multi-step workflow
- ✅ **Keybinding**: `Ctrl+Shift+O` to open dashboard
- ✅ **Command**: "Open File Organizer Dashboard" (F1 palette)
- ✅ Explorer context menu integration

**Registration**:

- **Container ID**: `workbench.view.fileOrganizer`
- **Icon**: Codicon.fileSymlinkDirectory
- **Position**: Activity bar position 5

#### 2. **File Selection & Analysis**

- ✅ Native file dialog for file selection
- ✅ Multi-file selection support
- ✅ Automatic metadata extraction:
  - File name, extension, size
  - MIME type detection
  - Preview generation (images)
- ✅ Directory filtering (files only to avoid Windows dialog issues)

#### 3. **Classification System**

##### Manual Classification

- ✅ "Your Side" / "Their Side" / "Unknown" categories
- ✅ Visual feedback for classification status
- ✅ Classification method tracking (manual, keyword, folder)

##### Keyword-Based Auto-Classification

- ✅ Configurable keyword lists via `.caseinfo` or `.fileorg.json`
- ✅ Default keywords:
  - **Your Side**: claimant, treating, personal, my
  - **Their Side**: employer, wcb, ime, defense, review officer
  - **Medical**: medical, doctor, physician, diagnosis, treatment
  - **Legal**: legal, court, decision, appeal, ruling
  - **Evidence**: evidence, study, research, expert, report

##### AI-Powered Classification

- ✅ LLM integration via `ILLMMessageService`
- ✅ Automatic naming suggestions
- ✅ Tag recommendations (3-5 tags per file)
- ✅ Confidence scoring
- ✅ Fallback classification when AI unavailable

#### 4. **Rule Engine**

##### Rule Types

- ✅ `rename` - Apply naming patterns
- ✅ `tag` - Add tags and set target paths
- ✅ `move` - Move to destination folders
- ✅ `classify` - Categorize files

##### Conditions

- ✅ `equals` - Exact match
- ✅ `contains` - Substring match
- ✅ `startsWith` / `endsWith` - Prefix/suffix match
- ✅ `greaterThan` / `lessThan` - Numeric comparisons

##### Naming Patterns

Supported placeholders:

- `{Side}` - YourSide/TheirSide/Unknown
- `{Category}` - Detected file type
- `{ProjectName}` - Extracted project name
- `{FileType}` - Wireframe/Mockup/Medical/Legal/etc.
- `{Version}` - Version number (v1, v2, etc.)
- `{Date}` / `{YYYY-MM-DD}` - Current date
- `{Description}` / `{Name}` - Original base name

#### 5. **Smart Destination Routing**

- ✅ Auto-detection of "Your Side" / "Their Side" folders
- ✅ Classification-based folder routing
- ✅ Workspace root integration
- ✅ Fallback to parent directory when workspace unavailable

#### 6. **Safety Features**

- ✅ Preview changes before applying
- ✅ Duplicate name detection with auto-suffix
- ✅ Target file existence check (NO overwrites)
- ✅ Automatic folder creation
- ✅ Metadata storage in `.meta` companion files
- ✅ Detailed error reporting per file

#### 7. **Configuration Files**

##### `.fileorg.json` - Organization Config

```typescript
interface FileOrgConfig {
	version: "1.0";
	caseInfo: {
		caseNumber?: string;
		claimantName?: string;
		injuryDate?: string;
		caseType: string;
		description?: string;
		parties?: CaseParties;
		keywords: CaseKeywords;
	};
	organizationSettings: {
		selectedTemplate: string;
		preserveOriginalNames: boolean;
		createBackup: boolean;
		targetFolder: string;
	};
	createdAt: string;
	updatedAt: string;
}
```

##### `.caseinfo` - Case Information

- JSON file at workspace root
- Contains case details and keyword configuration
- Dynamically read by File Organizer service

#### 8. **Manual Renaming**

- ✅ Users can manually modify proposed filenames during review
- ✅ Visual feedback for modified names
- ✅ Support for empty names (skips renaming)

### Service Architecture

```typescript
interface IFileOrganizerService {
	selectFiles(): Promise<URI[]>;
	analyzeFiles(files: URI[]): Promise<FileMetadata[]>;
	previewChanges(files: FileMetadata[], rules: Rule[]): Promise<FileChange[]>;
	applyChanges(changes: FileChange[]): Promise<ProcessResult[]>;
	saveCaseConfig(workspaceFolder: URI, config: FileOrgConfig): Promise<void>;
	loadCaseConfig(workspaceFolder: URI): Promise<FileOrgConfig | null>;
	caseConfigExists(workspaceFolder: URI): Promise<boolean>;
	loadCaseInfo(workspaceFolder: URI): Promise<any | null>;
}
```

### Files

- `fileOrganizerService.ts` - Core service implementation
- `fileOrganizerContribution.ts` - View registration and commands
- `fileOrganizerDashboardPane.ts` - ViewPane with React mounting
- `types.ts` - TypeScript interfaces and types
- `caseConfig.ts` - Configuration utilities and AI context generation
- `aiClassifier.ts` - AI-powered file classification

### Templates

- Located in `templates/` subdirectory
- Pre-configured organization rules for common case types

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
EMBEDDING_DELAY_MS: 100; // 10 requests/second
MAX_RETRIES: 3;
RETRY_DELAY_MS: 1000; // Base delay, exponential backoff
```

**Explorer Context Menu**

- ✅ "Index as Policy Manual" (PDF, DOCX, TXT, MD files only)

#### 9. **Memory Optimizations** (Added Oct 2025)

- ✅ Fixed critical memory leaks during large PDF indexing
- ✅ Implemented batch processing for PDF pages (10 pages at a time)
- ✅ Added batch processing for embeddings (50 chunks at a time)
- ✅ Explicit resource cleanup (PDF pages, loading tasks)
- ✅ Garbage collection hints after each batch
- ✅ File size validation (100 MB hard limit, 50 MB soft limit)
- ✅ Memory usage monitoring and logging
- ✅ Increased Node.js heap size to 4GB
- ✅ Enabled explicit garbage collection (`--expose-gc`)

#### 10. **Dependencies Added**

- ✅ `chromadb@^1.8.1` - Vector database
- ✅ `pdfjs-dist@^4.7.67` - PDF parsing
- ✅ `mammoth@^1.6.0` - DOCX extraction

---

## 📂 Case Organizer Feature (Agent Workflow)

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

### Document Viewers + RAG

- ✅ PDF content extractor feeds into RAG indexing
- ✅ DOCX content extractor feeds into RAG indexing
- ✅ XLSX content extractor feeds into RAG indexing
- ✅ Unified `IDocumentViewerService` for content extraction

### File Organizer + Case Info

- ✅ File Organizer reads `.caseinfo` from workspace
- ✅ Uses configured keywords for classification
- ✅ Smart destination routing based on case configuration

### RAG + Case Organizer Synergy

- 🔄 **Planned**: Auto-index case documents as they're organized
- 🔄 **Planned**: RAG search within case folders
- 🔄 **Planned**: Policy manual reference during case organization

### Shared Infrastructure

- ✅ Void sidebar for multiple features
- ✅ Agent mode for workflow automation
- ✅ Terminal tools for file operations
- ✅ Settings service for configuration
- ✅ IPC communication for main process operations

---

## 📊 Technical Architecture

### Services Hierarchy

```
Browser Process:
├── DocumentEditorService (document editing)
├── FileOrganizerService (file organization)
├── RAGService (IPC client)
├── RAGWorkspaceService (file watching)
├── RAGContextService (formatting)
└── VoidSettingsService (config)

Electron Main:
├── RAGMainService (orchestrator)
├── RAGIndexService (SQLite)
├── RAGFileService (extraction)
├── RAGPathService (paths)
├── DocumentCreatorService (backend editing)
└── ChromaPersistentAdapter (vectors)

IPC Communication:
├── RAGMainChannel (browser ↔ main)
└── DocumentCreatorChannel (browser ↔ main)
```

### Data Flow

```
Document Viewing:
User opens file → Editor Resolver → Viewer Editor → Webview/Renderer

Document Editing (Open):
Edit request → DocumentEditorService → Find Viewer → Webview postMessage

Document Editing (Closed):
Edit request → DocumentEditorService → IPC → DocumentCreatorService (main)

File Organization:
Select files → Analyze → Apply rules → Preview → Apply changes

RAG Indexing:
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

### Document Viewers

- ✅ **Implemented**: PDF annotation persistence (KAN-16)
  - Highlights with color options (yellow, green, blue, pink)
  - Bookmarks tab in sidebar
  - Annotations saved to workspace storage
  - Notes support on highlights
- ✅ **Implemented**: Image zoom/pan controls (KAN-17)
  - Full zoom controls (fit, 100%, slider, +/-)
  - Pan/drag navigation
  - Mouse wheel zoom at cursor
  - Rotate controls
  - Keyboard shortcuts
- 🔄 **Planned**: DOCX collaborative editing
- 🔄 **Planned**: XLSX formula bar improvements

### File Organizer

- 🔄 **Planned**: Drag-and-drop support
- 🔄 **Planned**: Batch operations progress indicator
- 🔄 **Planned**: Undo/redo support
- 🔄 **Planned**: Template editor UI

### RAG System

- ✅ **Fixed (KAN-25)**: Auto-indexing file copy detection via polling fallback
  - **Solution**: Added `ragPollIntervalSeconds` setting (default: 30s)
  - **Behavior**: Polls `policy-manuals/` folder to catch files missed by file watcher
  - **Workaround still available**: Right-click "Index as Policy Manual" for immediate indexing
- 🔄 **Planned**: SQLite-vec backend as Chroma alternative
- 🔄 **Planned**: File decorations in Explorer for indexed files
- 🔄 **Planned**: Settings UI panel for RAG configuration
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
- ✅ `RAG_MEMORY_OPTIMIZATION.md` - Memory optimization details

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
2. ✅ Fix auto-indexing file watcher (KAN-25 - added polling fallback)
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

## ☁️ Void Cloud Integration

**Status**: ✅ Implemented (Desktop Client Complete)
**Date Added**: December 2025

### Overview

Cloud-based LLM access system allowing users to access AI models without managing API keys. Includes authentication, credit management, and per-provider routing.

### Desktop Client Features

#### 1. **Cloud Authentication**

- ✅ Google OAuth via Supabase integration
- ✅ `VoidCloudService` - Central auth and API client
- ✅ `VoidCloudAuthProvider` - VS Code authentication provider
- ✅ `VoidCloudUrlHandler` - Custom URL protocol handler (`void://auth/callback`)
- ✅ Session persistence in storage service
- ✅ Token refresh handling

#### 2. **Cloud LLM Routing**

- ✅ `CloudLLMRouterService` - Routes requests to cloud API
- ✅ Per-provider mode toggle (BYOK vs Cloud)
- ✅ Credit balance checking before requests
- ✅ Streaming response support
- ✅ Error handling for insufficient credits (402)

#### 3. **Cloud Types**

```typescript
interface CloudAuthState {
	status: CloudAuthStatus;
	user: CloudUser | null;
	session: CloudSession | null;
}

interface CreditBalance {
	payg: number;
	subscription: number;
	bonus: number;
	total: number;
}
```

### Backend Services (void-cloud/)

#### 1. **API Service** (Node.js/Fastify)

- ✅ Auth routes (`/auth/me`, OAuth callback)
- ✅ Credits routes (`/credits/balance`, `/credits/checkout`)
- ✅ LLM routes (`/llm/chat`) - proxies to LiteLLM
- ✅ Webhook routes (`/webhooks/stripe`)
- ✅ Health check endpoints
- ✅ Rate limiting middleware
- ✅ Security headers middleware
- ✅ Input validation

**Deployed**: `void-cloud-production.up.railway.app`

#### 2. **LiteLLM Proxy**

- ✅ Unified OpenAI-compatible API
- ✅ Routes to: Anthropic, OpenAI, Google, DeepSeek
- ✅ Model cost tracking
- ✅ Docker configuration

**Deployed**: `void-cloudlitellm-production.up.railway.app`

#### 3. **Web Dashboard** (Next.js)

- ✅ Landing page with pricing
- ✅ Google OAuth sign-in
- ✅ User dashboard with balance
- ✅ Usage statistics
- ✅ Stripe checkout integration
- ✅ Tailwind CSS dark theme

**Location**: `void-cloud/dashboard/`

### Files

**Desktop Client**:
- `browser/voidCloudService.ts` - Main cloud service
- `browser/voidCloudAuthProvider.ts` - Auth provider integration
- `browser/voidCloudUrlHandler.ts` - URL handler for OAuth
- `browser/cloudLLMRouterService.ts` - LLM request routing
- `common/voidCloudTypes.ts` - Type definitions

**Backend** (void-cloud/):
- `api/src/` - Fastify API service
- `litellm/` - LiteLLM proxy configuration
- `dashboard/` - Next.js web dashboard
- `supabase/migrations/` - Database schema

---

## 🔄 Auto-Update System

**Status**: ✅ Implemented
**Date Added**: December 2025

### Overview

Automatic update checking and notification system for the desktop application.

### Features

- ✅ `VoidUpdateService` - Browser-side update service
- ✅ `VoidUpdateMainService` - Main process update logic
- ✅ IPC channel for update communication
- ✅ Version checking against releases
- ✅ Update notification UI
- ✅ Manual and automatic update checks

### Files

- `common/voidUpdateService.ts` - Browser service
- `common/voidUpdateServiceTypes.ts` - Type definitions
- `electron-main/voidUpdateMainService.ts` - Main process service
- `browser/voidUpdateActions.ts` - UI actions

---

## 🔀 SCM Integration (Git)

**Status**: ✅ Implemented
**Date Added**: December 2025

### Overview

Git integration service providing source control context for AI interactions.

### Features

- ✅ `gitStat()` - Get git diff --stat
- ✅ `gitSampledDiffs()` - Top 10 most changed files
- ✅ `gitBranch()` - Current branch name
- ✅ `gitLog()` - Last 5 commits (excluding merges)
- ✅ IPC channel for main process git operations

### Files

- `common/voidSCMTypes.ts` - Interface definitions
- `browser/voidSCMService.ts` - Browser service
- `electron-main/voidSCMMainService.ts` - Main process implementation

---

## 🔍 Advanced RAG Features

**Status**: ✅ Implemented
**Date Added**: December 2025

### Overview

Enhanced RAG capabilities beyond basic vector search, including hybrid retrieval, query processing, and reranking.

### Features

#### 1. **Hybrid Retriever**

- ✅ Combines BM25 keyword search with vector semantic search
- ✅ Reciprocal Rank Fusion (RRF) for result merging
- ✅ Configurable RRF constant (k=20 for medical/legal precision)
- ✅ Parallel search execution for performance

#### 2. **Query Processor**

- ✅ Query preprocessing and normalization
- ✅ Query expansion capabilities
- ✅ Domain-specific query handling

#### 3. **Reranker**

- ✅ Cross-encoder reranking for precision
- ✅ Score normalization
- ✅ Configurable reranking depth

### Files

- `common/ragHybridRetriever.ts` - Hybrid search implementation
- `common/ragQueryProcessor.ts` - Query preprocessing
- `common/ragReranker.ts` - Result reranking

---

## 📧 Email Dashboard

**Status**: ✅ Implemented
**Date Added**: December 2025

### Overview

React component for email management integration.

### Files

- `browser/react/src2/email-dashboard-tsx/EmailDashboard.tsx` - Main component
- `browser/react/src2/email-dashboard-tsx/index.tsx` - Entry point

---

## 📞 Contacts & Resources

- **GitHub**: <https://github.com/savagelysubtle/SafeAppeals2.0>
- **Developer**: @savagelysubtle (<simpleflowworks@gmail.com>)
- **Base Fork**: Void (VSCode fork)
- **Branch**: `main`
- **Cloud Backend**: <https://github.com/savagelysubtle/void-cloud>

---

**Last Updated**: December 8, 2025
**Version**: 1.99.3

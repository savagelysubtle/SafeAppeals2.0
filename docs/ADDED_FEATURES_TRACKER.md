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

- ✅ Auto-index case documents as they're organized
- ✅ RAG search within case folders
- ✅ Policy manual reference during case organization

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
- ✅ **Implemented**: DOCX content extraction for RAG indexing
  - Content extracted and saved to workspace storage
  - insert pictures and hyperlinks
  - formatting text, tables, and paragraphs
- 🔄 **Planned**: DOCX collaborative editing
- 🔄 **Planned**: XLSX formula bar improvements
- ✅ **Implemented**: Theming support for DOCX and XLSX
  - Dark and light mode support
  - ✅ **Implemented**: Customizable themes
  - ✅ **Implemented**: Dark and light mode support
  - ✅ **Implemented**: Customizable themes
  - ✅ **Implemented**: Dark and light mode support
  - Theme synchronization with VS Code

### File Organizer

- ✅ **Implemented**: Drag-and-drop support
  - Drag-and-drop support for files and folders
  - Drag-and-drop support for files and folders within the workspace
  - Drag-and-drop support for files and folders outside the workspace
- ✅ **Implemented**: Batch operations progress indicator
  - Progress indicator for batch operations
  - Progress indicator for batch operations within the workspace
  - Progress indicator for batch operations outside the workspace
- ✅ **Implemented**: Undo/redo support
  - Undo/redo support for batch operations
  - Undo/redo support for batch operations within the workspace
  - Undo/redo support for batch operations outside the workspace

### RAG System

- ✅ **Fixed (KAN-25)**: Auto-indexing file copy detection via polling fallback
  - **Solution**: Added `ragPollIntervalSeconds` setting (default: 30s)
  - **Behavior**: Polls `policy-manuals/` folder to catch files missed by file watcher
  - **Workaround still available**: Right-click "Index as Policy Manual" for immediate indexing
- ✅ **Implemented**: SQLite-vec backend as Chroma alternative
- 🔄 **Planned**: File decorations in Explorer for indexed files
- 🔄 **Planned**: Settings UI panel for RAG configuration
- 🔄 **Planned**: Global upload via settings (non-workspace files)

### Case Organizer

- ✅ **Implemented**: MCP server for richer file operations
  - MCP server for richer file operations
  - MCP server for richer file operations within the workspace
  - MCP server for richer file operations outside the workspace
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

A workspace-scoped email management system for importing, viewing, searching, and managing case-related correspondence with AI-assisted draft replies. Integrates with the RAG system for contextual email drafting.

### Core Features

#### 1. **Email Import & Parsing**

- ✅ Import `.eml` files (standard email format) via `mailparser`
- ✅ Import `.pdf` files (printed/exported emails) via `pdfjs-dist`
- ✅ Automatic metadata extraction (from, to, cc, bcc, subject, date)
- ✅ HTML and plain text body support
- ✅ Attachment metadata extraction (filename, contentType, size)

#### 2. **Workspace-Scoped Database**

- ✅ SQLite database per workspace (same pattern as RAG)
- ✅ Workspace ID from `getWorkspaceId()` service method
- ✅ FTS5 (Full-Text Search 5) for fast email search
- ✅ Complete data isolation between workspaces

#### 3. **Email Dashboard UI**

- ✅ Sidebar panel with React-based dashboard
- ✅ View Container: `workbench.view.emailDashboard` (Activity Bar position 7)
- ✅ Icon: `Codicon.mail` in activity bar
- ✅ Dark mode optimized with brand green accent (#22c55e)

**React Components**:

- ✅ `EmailDashboard.tsx` - Main container with empty state
- ✅ `EmailToolbar.tsx` - Search, sort, filter, view mode controls
- ✅ `EmailCard.tsx` - Email list items with avatar, preview, actions
- ✅ `EmailFilters.tsx` - Case folder filter panel (collapsible)

**Features**:

- ✅ Search across subject, body, and sender
- ✅ Sort by date, from, or subject (asc/desc)
- ✅ Filter by case folder
- ✅ List/grid view modes
- ✅ Two-click delete confirmation
- ✅ Color-coded avatars from sender email
- ✅ Draft and attachment badges
- ✅ File type indicators (EML blue, PDF red)

#### 4. **Email Viewer Editor**

- ✅ Custom `EditorPane` (`void.emailViewer`) for viewing emails
- ✅ Webview-based HTML rendering with dark theme styling
- ✅ Complete email headers display (From, To, CC, Date)
- ✅ HTML body rendering with fallback to plain text (`<pre>` wrapped)
- ✅ Attachment list display with paperclip icons
- ✅ "Draft Reply" button with envelope icon (brand green)
- ✅ Editor input serialization for session restore
- ✅ **Exclusive registration** for `.eml` files (`RegisteredEditorPriority.exclusive`)
- ✅ Loading spinner animation while parsing
- ✅ Error state handling with user-friendly message

**Editor Input Features**:

- ✅ `EmailViewerInput` with TYPE_ID `void.emailViewerInput`
- ✅ Email subject as tab name, sender as description
- ✅ Read-only capabilities (no save/revert)
- ✅ JSON serialization/deserialization for session persistence

#### 5. **AI-Assisted Draft Replies**

- ✅ `IEmailDraftService` for draft generation
- ✅ RAG integration for case document context
- ✅ DOCX output via `createReplyDocument()` IPC call
- ✅ Automatic editor opening after draft creation
- ✅ Success notification with source attribution
- ✅ Error handling with user-friendly messages

#### 6. **Commands & Keybindings**

- ✅ **Keybinding**: `Ctrl+Cmd+Shift+E` to open Email Dashboard
- ✅ **Command**: "Open Email Dashboard" (F1 palette, category: SafeAppeals)
- ✅ **Activity Bar**: Mail icon (Codicon.mail) in sidebar (position 7)
- ✅ **Explorer Context Menu**: Group `8_void`, order 3

### Architecture

```
Browser Process:
├── IEmailService (browser/emailService.ts - IPC client)
├── IEmailDraftService (browser/emailDraftService.ts - RAG + LLM)
├── EmailDashboardPane (emailDashboard/emailDashboardPane.ts)
├── EmailViewerEditor (emailViewers/emailViewerEditor.ts)
├── EmailViewerInput (emailViewers/emailViewerInput.ts)
├── EmailViewerInputSerializer (emailViewers/emailViewerInputSerializer.ts)
└── React Components (react/src/email-dashboard-tsx/)

IPC Channel (void-channel-email):
├── parseEmail(filePath) → Email
├── getEmails(caseFolderPath?) → Email[]
├── getEmailById(id) → Email | null
├── searchEmails(query, caseFolderPath?) → Email[]
├── deleteEmail(emailId) → void
├── getStats() → { totalEmails, draftCount, caseFolders }
├── getWorkspaceId() → string
└── createReplyDocument(emailId, draftContent) → URI

Electron Main:
├── emailMainChannel.ts (IPC handler)
├── email/emailMainService.ts (orchestrator)
└── email/emailIndexService.ts (SQLite + FTS5)
```

### Files

**Common**:

- `common/emailService.ts` - `IEmailService` interface, `Email` and `EmailAttachment` types

**Browser**:

- `browser/emailService.ts` - IPC client implementation
- `browser/emailDraftService.ts` - AI draft generation with RAG context
- `browser/emailDashboard/emailDashboard.contribution.ts` - View container & action registration
- `browser/emailDashboard/emailDashboardPane.ts` - ViewPane with React mount
- `browser/emailViewers/emailViewer.contribution.ts` - EditorPane & EML resolver registration
- `browser/emailViewers/emailViewerEditor.ts` - Custom editor pane with webview
- `browser/emailViewers/emailViewerInput.ts` - Editor input with email data
- `browser/emailViewers/emailViewerInputSerializer.ts` - JSON serialization

**React Components**:

- `browser/react/src/email-dashboard-tsx/index.tsx` - `mountEmailDashboard()` function
- `browser/react/src/email-dashboard-tsx/EmailDashboard.tsx` - Main container
- `browser/react/src/email-dashboard-tsx/EmailToolbar.tsx` - Toolbar controls
- `browser/react/src/email-dashboard-tsx/EmailCard.tsx` - Email cards
- `browser/react/src/email-dashboard-tsx/EmailFilters.tsx` - Filter panel

**Electron Main**:

- `electron-main/emailMainChannel.ts` - IPC channel handler
- `electron-main/email/emailMainService.ts` - Main service orchestration
- `electron-main/email/emailIndexService.ts` - SQLite database operations

### Service Interface

```typescript
interface IEmailService {
	parseEmail(filePath: URI): Promise<Email>;
	getEmails(caseFolderPath?: URI): Promise<Email[]>;
	getEmailById(id: string): Promise<Email | null>;
	searchEmails(query: string, caseFolderPath?: URI): Promise<Email[]>;
	deleteEmail(emailId: string): Promise<void>;
	getStats(): Promise<{
		totalEmails: number;
		draftCount: number;
		caseFolders: string[];
	}>;
	getWorkspaceId(): string;
	createReplyDocument(emailId: string, draftContent: string): Promise<URI>;
}
```

### Dependencies

- `mailparser` - EML file parsing
- `pdfjs-dist` - PDF text extraction (shared with RAG)
- `docx` - DOCX draft reply generation
- `@vscode/sqlite3` - Database operations

---

## 📅 Timeline & Event Tracker

**Status**: ✅ Phase 1 Complete
**Date Added**: December 2025
**Jira**: KAN-51 (Epic), KAN-57 (Feature)
**Branch**: `feature/kan-57-timeline-event-tracker`

### Overview

A visual timeline of case events for tracking injury progression, medical visits, hearings, and decisions. Part of the SafeAppeals workers' compensation case management system with jurisdiction-specific statute of limitations and deadline tracking.

### Core Features

#### 1. **Event Management**

- ✅ Add/edit/delete events with date, title, description, category
- ✅ 8 event categories with color coding:
  - Injury (red), Medical (blue), Hearing (purple), Decision (amber)
  - Deadline (dark red), Filing (emerald), Correspondence (gray), Custom (slate)
- ✅ Date ranges for multi-day events (hospitalization, etc.)
- ✅ Tags and custom labels

#### 2. **Timeline Visualization**

- ✅ Chronological event display with visual timeline line
- ✅ Category badges with color indicators
- ✅ Deadline status indicators (overdue/upcoming/complete)
- ✅ Filter by category
- ✅ Show deadlines only toggle

#### 3. **Deadline Management**

- ✅ Mark events as deadlines
- ✅ Configurable reminder days (default: 7, 3, 1)
- ✅ Mark deadlines as complete
- ✅ Overdue/upcoming warnings banner
- ✅ Notifications on app startup

#### 4. **Jurisdiction Support**

12 pre-configured jurisdictions with statute of limitations:

**Canada**:

- BC WCB (90 days), Ontario WSIB (30 days), Alberta WCB (60 days)
- Quebec CNESST (30 days), Manitoba WCB (30 days), Saskatchewan WCB (60 days)
- Nova Scotia WCB (30 days)

**United States**:

- California DWC (365 days), Texas DWC (365 days)
- New York WCB (730 days), Florida DWC (730 days)
- Washington L&I (60 days)

**Features**:

- ✅ Auto-calculate statute deadline from injury date
- ✅ Auto-generate deadline events from decision events
- ✅ Custom statute days per case

#### 5. **Commands & Actions**

- ✅ **Keybinding**: `Ctrl+Shift+T` to open timeline
- ✅ **Command**: "Open Case Timeline" (F1 palette)
- ✅ **Command**: "Add Timeline Event"
- ✅ **Explorer Context Menu**: "Link to Timeline Event..."

### Storage

Timeline data stored in `.timeline.json` at workspace root:

```typescript
interface CaseTimeline {
	version: "1.0";
	caseId: string;
	caseName?: string;
	jurisdiction: string;
	injuryDate?: string;
	events: TimelineEvent[];
	customStatuteDays?: number;
	notificationsEnabled: boolean;
	createdAt: string;
	updatedAt: string;
}
```

### Service Interface

```typescript
interface ITimelineService {
	loadTimeline(): Promise<CaseTimeline | null>;
	saveTimeline(timeline: CaseTimeline): Promise<void>;
	addEvent(
		event: Omit<TimelineEvent, "id" | "createdAt" | "updatedAt">,
	): Promise<TimelineEvent>;
	updateEvent(id: string, updates: Partial<TimelineEvent>): Promise<void>;
	deleteEvent(id: string): Promise<void>;
	calculateStatuteDeadline(injuryDate: Date, jurisdictionId: string): Date;
	getUpcomingDeadlines(daysAhead: number): TimelineEvent[];
	getOverdueDeadlines(): TimelineEvent[];
	generateDeadlinesFromDecision(decisionEvent: TimelineEvent): TimelineEvent[];
	linkDocument(eventId: string, documentUri: URI): Promise<void>;
	scheduleDeadlineNotifications(): void;
	exportToPDF(): Promise<string>; // Returns base64-encoded PDF
}
```

### Files (Modular Structure)

**Browser Module** (`browser/timeline/`):

- `timeline.contribution.ts` - View registration, commands, actions
- `timelineService.ts` - Core CRUD, deadline calculations, notifications, PDF export orchestration
- `timelinePane.ts` - Sidebar panel with React mount
- `jurisdictionConfig.ts` - 12 jurisdiction configurations

**Electron Main** (`electron-main/`):

- `timelineExportChannel.ts` - PDF generation via BrowserWindow.printToPDF(), HTML templating, base64 IPC transfer

**Common Types** (`common/timeline/`):

- `timelineTypes.ts` - Interfaces, types, helper functions

**React Components** (`browser/react/src/timeline-tsx/`):

- `TimelineDashboard.tsx` - Main container with two-panel layout, PDF export button, smart filename generation
- `TimelineEventCard.tsx` - Individual event cards with actions
- `TimelineToolbar.tsx` - Add button, filters, jurisdiction badge
- `EventEditor.tsx` - Modal for creating/editing events
- `DeadlineWarnings.tsx` - Overdue/upcoming deadline banners
- `CaseSummary.tsx` - Case KPI cards (left panel)
- `CalendarView.tsx` - Calendar visualization (right panel)

#### 5. **PDF Export**

- ✅ Export timeline to PDF with event cards layout
- ✅ Base64 IPC transfer for reliable binary data handling
- ✅ Hidden BrowserWindow for HTML-to-PDF rendering
- ✅ Smart filename generation (extracts folder name from path)
- ✅ Filename sanitization for cross-platform compatibility
- ✅ Format: `Timeline_{CaseName}_{YYYY-MM-DD}.pdf`

#### 6. **Two-Panel Dashboard Layout**

- ✅ Left panel: Case Summary + Deadline Warnings (fixed width)
- ✅ Right panel: Timeline/Calendar view + Toolbar (flexible width)
- ✅ Improved visibility for timeline events

#### 7. **Calendar View**

- ✅ Interactive calendar visualization within Timeline dashboard
- ✅ Month/week navigation with event display
- ✅ Click-to-view event details
- ✅ Visual indicators for deadlines and appointments
- ✅ Integrated with external calendar sync (Google/Outlook)
- ✅ Push events to connected external calendars

### Plan Document

See `TIMELINE_FEATURE_PLAN.md` at project root for detailed implementation plan.

---

## 🤖 Timeline Agent Tools

**Status**: ✅ Implemented
**Date Added**: December 2025
**Jira**: KAN-58 (under Epic KAN-51)
**Branch**: `feature/kan-58-timeline-agent-tools`

### Overview

AI agent tools that allow the LLM to programmatically create, update, query, and manage timeline events. Enables the agent to extract dates from documents and add them to the timeline with linked files.

### Tools Implemented

| Tool                     | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| `timeline_add_event`     | Create new timeline event with optional document linking          |
| `timeline_update_event`  | Modify existing event details or mark deadlines complete          |
| `timeline_delete_event`  | Remove event from timeline                                        |
| `timeline_get_events`    | Query events with filters (category, date range, deadline status) |
| `timeline_link_document` | Attach a document to an existing event                            |
| `timeline_get_deadlines` | Get upcoming and overdue deadlines                                |

### Features

#### 1. **Event Creation with Document Linking**

- ✅ Agent can extract dates from documents and add to timeline
- ✅ Automatic document linking when creating events
- ✅ All 8 event categories supported (injury, medical, hearing, decision, deadline, filing, correspondence, custom)
- ✅ Deadline flag with reminder support

#### 2. **Event Querying**

- ✅ Filter by category
- ✅ Filter by date range (start_date, end_date)
- ✅ Filter by deadline status
- ✅ Configurable result limit
- ✅ Chronological sorting

#### 3. **Deadline Management**

- ✅ Get upcoming deadlines within N days
- ✅ Get overdue deadlines
- ✅ Mark deadlines as complete via update tool

#### 4. **Integration with Chat Modes**

- ✅ Available in `drafting` mode
- ✅ Available in `case_manager` mode
- ✅ Available in `research` mode (read-only tools)

### Files Modified

- `common/tools/toolsServiceTypes.ts` - Tool parameter and result types
- `common/prompt/prompts.ts` - Tool definitions with LLM descriptions
- `browser/tools/toolsService.ts` - Tool implementations

### Example Agent Workflow

When user asks: "Add the medical appointment from this report to my timeline"

1. Agent reads document with `read_file`
2. Agent extracts date (e.g., "January 15, 2025")
3. Agent calls `timeline_add_event` with:
   - date: "2025-01-15"
   - title: "Medical Evaluation - Dr. Smith"
   - category: "medical"
   - linkedDocuments: ["/path/to/dr_smith_report.pdf"]

---

## ✍️ DocuSign E-Signature Integration

**Status**: ✅ Implemented
**Date Added**: December 2025

### Overview

Full DocuSign integration for sending documents for electronic signature directly from the document viewers. Uses JWT Grant authentication with RSA keypair for secure server-to-server authentication.

### Core Features

#### 1. **Authentication**

- ✅ JWT Grant authentication with RSA keypair
- ✅ Automatic PKCS#1 to PKCS#8 key conversion
- ✅ Secure private key storage via Electron safeStorage
- ✅ Bundled integration key support (no user config needed)
- ✅ Custom integration key option for self-hosting
- ✅ Consent flow handling with browser redirect
- ✅ Demo and production environment support

#### 2. **Envelope Management**

- ✅ Create envelopes with documents and recipients
- ✅ Send envelopes for signature
- ✅ Get envelope status (sent, delivered, signed, completed, declined, voided)
- ✅ List recent envelopes with summaries
- ✅ Void envelopes with reason
- ✅ Download signed documents (combined or individual)

#### 3. **Document Integration**

- ✅ Send documents directly from DOCX/PDF viewers
- ✅ "Send for Signature" button in document ribbon
- ✅ Anchor-based signature placement (`/sig/` anchor string)
- ✅ Document-to-envelope mapping for in-app tracking
- ✅ Automatic file type detection (DOCX, PDF, DOC)

#### 4. **Recipient Management**

- ✅ Add signers with email and name
- ✅ Add CC recipients (receive copies)
- ✅ Routing order for sequential signing
- ✅ Role-based recipient types

#### 5. **Status Tracking**

- ✅ Automatic status polling (30-second intervals)
- ✅ Real-time notifications on status changes
- ✅ Completion notifications with download prompt
- ✅ Decline notifications with warning
- ✅ Envelope cache persistence (workspace-scoped)

#### 6. **Settings Integration**

- ✅ Integration key configuration
- ✅ User ID configuration
- ✅ Private key import
- ✅ Environment toggle (demo/production)
- ✅ Consent status tracking

### Commands

| Command                          | Title                        |
| -------------------------------- | ---------------------------- |
| `void.docusign.signIn`           | DocuSign: Sign In            |
| `void.docusign.signOut`          | DocuSign: Sign Out           |
| `void.docusign.sendForSignature` | DocuSign: Send for Signature |

### Architecture

```
Browser Process:
├── IDocuSignService (browser/docuSign/docuSignService.ts)
│   ├── Auth state management
│   ├── Envelope CRUD via IPC
│   ├── Document tracking
│   └── Status polling
└── DocuSign Actions (browser/docuSign/docuSignActions.ts)
    └── Command registrations

IPC Channel (void-channel-docusign):
├── getConfig() → bundled config
├── getAccessToken() → JWT token exchange
├── checkConsent() → consent status
├── getConsentUrl() → OAuth consent URL
├── storePrivateKey() → secure storage
├── hasPrivateKey() → key check
├── createEnvelope() → envelope creation
├── sendEnvelope() → envelope send
├── getEnvelope() → envelope details
├── getEnvelopeStatus() → status check
├── listEnvelopes() → recent envelopes
├── downloadSignedDocument() → PDF bytes
├── voidEnvelope() → void with reason
└── signOut() → clear session

Electron Main:
├── docuSignChannel.ts - IPC handler
└── DocuSign eSignature SDK integration
```

### Files

**Common** (`common/docuSign/`):

- `docuSignTypes.ts` - Interfaces (IDocuSignEnvelope, IDocuSignUser, etc.)

**Browser** (`browser/docuSign/`):

- `docuSignService.ts` - Main service with auth, envelopes, tracking
- `docuSignActions.ts` - F1 commands registration

**Electron Main** (`electron-main/`):

- `docuSignChannel.ts` - IPC channel handler
- `docusign-esign.d.ts` - TypeScript declarations for SDK

### Service Interface

```typescript
interface IDocuSignService {
	// Auth
	signIn(): Promise<void>;
	signOut(): Promise<void>;
	isSignedIn(): boolean;
	checkConsent(): Promise<DocuSignConsentStatus>;
	openConsentPage(): Promise<void>;
	storePrivateKey(privateKey: string): Promise<{ success: boolean }>;

	// Envelopes
	createEnvelope(
		request: IDocuSignEnvelopeCreateRequest,
	): Promise<IDocuSignEnvelopeCreateResponse>;
	sendEnvelope(envelopeId: string): Promise<void>;
	getEnvelope(envelopeId: string): Promise<IDocuSignEnvelope>;
	getEnvelopeStatus(envelopeId: string): Promise<DocuSignEnvelopeStatus>;
	listEnvelopes(fromDate?: Date): Promise<IDocuSignEnvelopeSummary[]>;
	downloadSignedDocument(envelopeId: string): Promise<Uint8Array>;
	voidEnvelope(envelopeId: string, reason: string): Promise<void>;

	// Document integration
	sendDocumentForSignature(
		documentUri: URI,
		documentBase64: string,
		recipients: IDocuSignRecipientInput[],
		emailSubject: string,
		emailBlurb?: string,
	): Promise<string>;
	getEnvelopeForDocument(documentUri: URI): Promise<IDocuSignEnvelope | null>;

	// Events
	readonly onAuthStateChange: Event<DocuSignAuthChangeEvent>;
	readonly onEnvelopeStatusChange: Event<DocuSignEnvelopeStatusChangeEvent>;
}
```

### Dependencies

- `docusign-esign` - Official DocuSign eSignature Node.js SDK

---

## ⏱️ Time Tracker Extension

**Status**: ✅ Implemented
**Date Added**: February 2026
**Location**: `extensions/time-tracker/`

### Overview

A professional legal time tracking extension with UTBMS codes, 6-minute billing increments, and LEDES 1998B export format. Designed for workers' compensation attorneys with per-workspace isolation.

### Core Features

#### 1. **Timer Controls**

- ✅ Real-time timer with start/stop/toggle
- ✅ Live elapsed time display (HH:MM:SS format)
- ✅ 6-minute billing increments (0.1 hour rounding, industry standard)
- ✅ Configurable rounding modes (up, down, nearest)
- ✅ Minimum increment enforcement (0.1 hours default)
- ✅ Auto-save timer on window/app close

#### 2. **Matter/Case Management**

- ✅ Create and manage client matters
- ✅ Matter fields: client name, matter name, matter number
- ✅ Default billing rate per matter
- ✅ Active/inactive matter status
- ✅ Quick matter selection from sidebar dropdown

#### 3. **Billing Rates**

- ✅ Multiple billing rate tiers
- ✅ Default rate designation
- ✅ Hourly rate configuration
- ✅ Rate selection per time entry

#### 4. **UTBMS Code Support**

- ✅ Standard UTBMS Task codes (L100-L500 series)
- ✅ Standard UTBMS Activity codes (A101-A118)
- ✅ Task/Activity code dropdowns in sidebar
- ✅ Codes stored with each time entry

#### 5. **Time Entry Management**

- ✅ Manual entry creation
- ✅ Entry editing (description, codes, billable status)
- ✅ Entry deletion with confirmation dialog
- ✅ Billable/non-billable toggle
- ✅ Description field (500 char limit)
- ✅ Today's entries list with totals

#### 6. **Entry Display**

- ✅ Date display (e.g., "Feb 2")
- ✅ Time range display (e.g., "04:07 PM → 04:13 PM")
- ✅ Duration in hours (0.1 increments)
- ✅ Matter name display
- ✅ UTBMS code badges
- ✅ Billable status indicator
- ✅ Delete button (hover reveal)

#### 7. **Export Formats**

- ✅ **CSV** - Standard spreadsheet format
- ✅ **JSON** - Structured data export
- ✅ **LEDES 1998B** - Legal billing standard format
- ✅ Date range filtering for exports
- ✅ File save dialog with suggested filenames

#### 8. **UI Components**

**Status Bar**:

- ✅ Live timer display
- ✅ Current matter indicator
- ✅ Today's total hours
- ✅ Click to toggle timer

**Sidebar Panel**:

- ✅ View Container: `timeTracker` (Activity Bar)
- ✅ WebviewViewProvider implementation
- ✅ VSCode CSS variable theming
- ✅ Card-based UI matching Timeline/CaseInfo style
- ✅ Unicode emoji icons (no codicon dependency issues)

#### 9. **Storage**

- ✅ Per-workspace SQLite database
- ✅ Database path: `~/.safe-appeals-navigator/databases/workspaces/{workspaceId}/timetracker.db`
- ✅ Tables: `matters`, `billing_rates`, `time_entries`
- ✅ Workspace ID from folder path hash
- ✅ Uses root `better-sqlite3` (shared with RAG)

### Commands

| Command                    | Title                 | Keybinding     |
| -------------------------- | --------------------- | -------------- |
| `timeTracker.start`        | Start Timer           | -              |
| `timeTracker.stop`         | Stop Timer            | -              |
| `timeTracker.toggle`       | Toggle Timer          | `Ctrl+Shift+T` |
| `timeTracker.addEntry`     | Add Manual Entry      | `Ctrl+Shift+E` |
| `timeTracker.manageMatter` | Manage Matters        | -              |
| `timeTracker.manageRates`  | Manage Billing Rates  | -              |
| `timeTracker.exportCSV`    | Export to CSV         | -              |
| `timeTracker.exportJSON`   | Export to JSON        | -              |
| `timeTracker.exportLEDES`  | Export to LEDES 1998B | -              |

### Settings

| Setting                        | Default | Description                                 |
| ------------------------------ | ------- | ------------------------------------------- |
| `timeTracker.roundingMode`     | `up`    | How to round time (up/down/nearest)         |
| `timeTracker.minimumIncrement` | `0.1`   | Minimum billable increment in hours         |
| `timeTracker.autoStopOnClose`  | `true`  | Auto-stop timer when app closes             |
| `timeTracker.defaultBillable`  | `true`  | Default billable status for new entries     |
| `timeTracker.reminderInterval` | `30`    | Reminder interval in minutes (0 = disabled) |

### Files

**Extension Root** (`extensions/time-tracker/`):

- `package.json` - Extension manifest with commands, views, settings
- `tsconfig.json` - TypeScript configuration (uses root @types)

**Source** (`extensions/time-tracker/src/`):

- `extension.ts` - Entry point, service initialization, command registration
- `types.ts` - TypeScript interfaces (Matter, BillingRate, TimeEntry, etc.)
- `storageService.ts` - SQLite database operations
- `timeTrackerService.ts` - Timer logic with 6-min rounding
- `matterService.ts` - Matter CRUD via quick picks
- `rateService.ts` - Rate CRUD via quick picks
- `exportService.ts` - CSV, JSON, LEDES export
- `ledesFormatter.ts` - LEDES 1998B format generation
- `statusBarController.ts` - Status bar item management
- `sidebarProvider.ts` - WebviewViewProvider with HTML/JS/CSS
- `utbmsCodes.ts` - UTBMS code definitions and helpers

**Data** (`extensions/time-tracker/data/`):

- `utbms-codes.json` - Standard UTBMS task and activity codes

**Media** (`extensions/time-tracker/media/`):

- `sidebar.css` - Webview styles (VSCode CSS variables, card patterns)

### Service Architecture

```
Extension Host:
├── TimeTrackerService (timer logic, state management)
├── StorageService (SQLite operations)
├── MatterService (matter CRUD)
├── RateService (rate CRUD)
├── ExportService (file exports)
├── StatusBarController (status bar UI)
└── SidebarProvider (webview panel)

Webview:
├── Timer display and controls
├── Entry details form
├── Today's entries list
├── Export buttons
└── Manage buttons (trigger VSCode commands)

IPC Communication:
└── postMessage/onDidReceiveMessage for webview ↔ extension host
```

### Dependencies

- `better-sqlite3` (from root node_modules, rebuilt for Electron)
- VSCode Extension API

---

## 📞 Contacts & Resources

- **GitHub**: <https://github.com/savagelysubtle/SafeAppeals2.0>
- **Developer**: @savagelysubtle (<simpleflowworks@gmail.com>)
- **Base Fork**: Void (VSCode fork)
- **Branch**: `main`
- **Cloud Backend**: <https://github.com/savagelysubtle/void-cloud>

---

## 🎙️ Audio Recorder & Transcriber (Native Contribution)

**Status**: ✅ Implemented (Migrated to Native)
**Date Added**: February 2026
**Migrated**: February 2026 (Extension → Native Contribution)
**Location**: `src/vs/workbench/contrib/void/` (browser/audioRecorder, common/audioRecorder, electron-main/audioRecorder)

### Overview

An integrated audio recording, playback, and transcription system for capturing client calls, depositions, interviews, and meetings. Uses distil-whisper-large-v3.5 for high-accuracy local transcription with no API costs.

**Migration Note**: Originally implemented as a VS Code extension (`extensions/audio-recorder/`), this feature was migrated to a native contribution for improved performance. Native contributions run in-process rather than via Extension Host IPC, resulting in faster startup and response times.

### Core Features

#### 1. **Audio Recording**

- ✅ In-app audio recording via WebRTC MediaRecorder API
- ✅ Start/stop/pause controls with visual feedback
- ✅ Real-time recording duration display with millisecond precision
- ✅ Pulsing status indicator during recording
- ✅ WAV format output (16-bit PCM, 16kHz)
- ✅ Per-workspace recording storage (SQLite + file system)

#### 2. **Audio Playback**

- ✅ Inline playback controls on each recording card
- ✅ Play/pause toggle with visual state
- ✅ Seek bar with click-to-seek functionality
- ✅ Current time / total duration display
- ✅ Volume control with mute toggle
- ✅ Lazy loading of audio (loads on first play)
- ✅ Blob URL management with automatic cleanup

#### 3. **Whisper Transcription**

- ✅ **Model**: distil-whisper-large-v3.5-ONNX (~1.5GB, ~7% WER)
- ✅ Local transcription via @huggingface/transformers
- ✅ No API costs - fully offline after model download
- ✅ Progress notifications (loading model, processing, finalizing)
- ✅ Timestamped segments for subtitle export
- ✅ Language detection

#### 4. **Audio Import**

- ✅ Import existing audio files (WAV, MP3, M4A, OGG, WEBM, FLAC)
- ✅ Drag-and-drop support
- ✅ File picker dialog integration
- ✅ Format validation with user-friendly error messages

#### 5. **Export Options**

- ✅ Word Document (.docx) - Formatted transcript
- ✅ Plain Text (.txt) - Raw transcript
- ✅ Subtitles (.srt) - Timestamped for video editing
- ✅ JSON (.json) - Structured data with metadata

#### 6. **Recording Management**

- ✅ Recording list with metadata (date, duration, status)
- ✅ Status badges (Pending, Transcribing, Completed, Failed)
- ✅ Delete with confirmation dialog
- ✅ Transcript preview with expansion
- ✅ Per-workspace isolation (recordings stored per case)

#### 7. **UI/UX**

- ✅ Activity Bar icon (microphone) for quick access
- ✅ React-based UI matching SafeAppeals design system
- ✅ VSCode CSS variables for theme consistency
- ✅ Tailwind CSS for layout (scoped via void-scope)
- ✅ Card-based layout for recordings
- ✅ Empty state with helpful instructions

### Commands

| Command ID              | Title                    | Keyboard Shortcut |
| ----------------------- | ------------------------ | ----------------- |
| `void.openAudioRecorder`| Open Audio Recorder      | Ctrl+Shift+R      |
| `void.startRecording`   | Start Audio Recording    | -                 |
| `void.stopRecording`    | Stop Audio Recording     | -                 |
| `void.importAudio`      | Import Audio File        | -                 |

### Architecture

```
Native Contribution Architecture:
├── common/audioRecorder/
│   ├── audioRecorderTypes.ts     # Shared types and constants
│   ├── IAudioRecorderService.ts  # Service interface
│   └── index.ts                  # Exports
├── electron-main/audioRecorder/
│   ├── audioRecorderMainService.ts  # SQLite + file operations
│   ├── audioRecorderChannel.ts      # IPC channel (main ↔ browser)
│   └── index.ts                     # Exports
├── browser/audioRecorder/
│   ├── audioRecorderService.ts      # Browser service (MediaRecorder, transcription)
│   ├── audioRecorderPane.ts         # ViewPane wrapper
│   ├── audioRecorder.contribution.ts # Registration
│   └── index.ts                     # Exports
└── browser/react/src/audio-recorder-tsx/
    ├── index.tsx              # Mount function
    ├── AudioRecorder.tsx      # Main container
    ├── RecordingControls.tsx  # Start/stop/pause UI
    ├── RecordingsList.tsx     # List of recordings
    ├── RecordingCard.tsx      # Individual recording with playback
    ├── AudioPlaybackBar.tsx   # Seek bar + controls
    └── AudioImporter.tsx      # Import UI with drag-drop

Audio Pipeline:
├── MediaRecorder API (browser) → WebM capture
├── Web Audio API → WAV conversion (16kHz mono)
├── IPC → Main process for file storage
├── SQLite database for metadata
├── @huggingface/transformers → Whisper transcription
└── Export services (docx, srt, txt, json)
```

### Files

**Common** (`src/vs/workbench/contrib/void/common/audioRecorder/`):

- `audioRecorderTypes.ts` - Recording, RecorderState, TranscriptionResult types
- `IAudioRecorderService.ts` - Service interface with events
- `index.ts` - Module exports

**Main Process** (`src/vs/workbench/contrib/void/electron-main/audioRecorder/`):

- `audioRecorderMainService.ts` - SQLite database, file I/O, export
- `audioRecorderChannel.ts` - IPC channel implementation
- `index.ts` - Module exports

**Browser** (`src/vs/workbench/contrib/void/browser/audioRecorder/`):

- `audioRecorderService.ts` - Recording, playback, transcription logic
- `audioRecorderPane.ts` - ViewPane for sidebar
- `audioRecorder.contribution.ts` - View container and action registration
- `index.ts` - Module exports

**React UI** (`src/vs/workbench/contrib/void/browser/react/src/audio-recorder-tsx/`):

- `AudioRecorder.tsx` - Main container with state management
- `RecordingControls.tsx` - Timer, record/pause/stop buttons
- `RecordingsList.tsx` - Scrollable list of recordings
- `RecordingCard.tsx` - Card with playback, transcript, actions
- `AudioPlaybackBar.tsx` - HTML5 audio controls with seek
- `AudioImporter.tsx` - Drag-drop and file picker

### Storage

**Database**: `~/.safe-appeals-navigator/databases/workspaces/{workspaceId}/audio_recordings.db`

```sql
CREATE TABLE recordings (
    id TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    duration_seconds REAL,
    file_size_bytes INTEGER,
    sample_rate INTEGER DEFAULT 16000,
    channels INTEGER DEFAULT 1,
    created_at INTEGER,
    transcription_status TEXT,
    transcription_text TEXT,
    transcription_segments TEXT,  -- JSON array
    transcription_language TEXT,
    is_imported INTEGER DEFAULT 0,
    original_filename TEXT
);
```

**Audio Files**: `~/.safe-appeals-navigator/databases/workspaces/{workspaceId}/recordings/`

### Whisper Model Details

- **Model**: `distil-whisper/distil-large-v3.5-ONNX`
- **Size**: ~1.5GB (downloaded on first use)
- **Accuracy**: ~7% Word Error Rate (WER)
- **Speed**: ~1.5x faster than Whisper-Large-v3-Turbo
- **Cache**: `~/.cache/huggingface/` (default transformers.js location)
- **Cost**: $0 (fully local, no API calls)

### Dependencies

- `@huggingface/transformers` - ONNX runtime for Whisper
- `better-sqlite3` - Native SQLite for recording metadata
- `docx` - Word document generation for export

### Performance Benefits (Native vs Extension)

| Aspect              | Extension Host          | Native Contribution     |
| ------------------- | ----------------------- | ----------------------- |
| Startup             | Delayed (IPC init)      | Immediate               |
| UI Response         | ~50-100ms IPC overhead  | <10ms direct calls      |
| Memory              | Separate process        | Shared with main        |
| Service Access      | Limited VSCode API      | Full internal services  |
| React Integration   | Webview bridge          | Direct mount            |

---

## 🌐 Embedded Web Browser

**Status**: ✅ Implemented
**Date Added**: February 2026
**Location**: `src/vs/workbench/contrib/void/` (browser/browserPanel, common, electron-main)

### Overview

A fully functional web browser embedded directly into the IDE, built on Electron's `WebContentsView` API. Renders pages using a real Chromium renderer (not an iframe or webview), providing full website compatibility including Google Search, sign-in flows, and modern JavaScript applications. Accessible via a globe icon in the top-right title bar or the command palette.

### Core Features

#### 1. **Full Chromium Browsing**

- ✅ Native `WebContentsView` with full web standards support
- ✅ Google Search, sign-in, and all interactive features work without degradation
- ✅ Dedicated persistent session (`persist:void-browser-v2`) with cookies/storage across restarts
- ✅ Clean User-Agent (Electron/app identifiers stripped for site compatibility)
- ✅ Sandboxed rendering (`sandbox: true`, `contextIsolation: true`)

#### 2. **URL Bar with Smart Navigation**

- ✅ Type a URL, domain, or plain text to search Google automatically
- ✅ Domain detection (contains `.` and no spaces → prepend `https://`)
- ✅ Search fallback (anything else → Google search query)
- ✅ Scheme detection (existing `https://`, `http://`, etc. used as-is)

#### 3. **Navigation Controls**

- ✅ Back / Forward / Reload / Home buttons
- ✅ Keyboard shortcut `Ctrl+L` to focus and select URL bar
- ✅ History-aware back/forward (disabled when no history)

#### 4. **Bookmarks Bar**

- ✅ Star icon to bookmark current page (turns gold when bookmarked)
- ✅ Persistent bookmarks bar below the toolbar with clickable chips
- ✅ Right-click bookmark → native OS context menu (Open, Open in New Tab, Copy URL, Remove)
- ✅ Bookmarks persist in VS Code profile storage across restarts
- ✅ Notification feedback on bookmark add/remove

#### 5. **Browsing History**

- ✅ Up to 200 entries, most recent first
- ✅ Accessible from URL bar dropdown on focus
- ✅ Persisted in VS Code profile storage

#### 6. **Find in Page**

- ✅ `Ctrl+F` opens inline find bar
- ✅ Real-time highlighting, forward/reverse search
- ✅ `Escape` to close

#### 7. **Downloads**

- ✅ Native save dialog on download link click
- ✅ Progress tracking with completion notification

#### 8. **DevTools**

- ✅ One-click Chromium DevTools access (detached window)

#### 9. **Editor Integration**

- ✅ Opens as a standard editor tab (close, split, drag, pin)
- ✅ Multiple browser tabs via New Tab button
- ✅ Session restore (remembers URL per tab across restarts)
- ✅ Proper cleanup: closing the tab removes the native view immediately
- ✅ Focus management: keyboard input works in embedded pages

### Commands

| Command ID           | Title                      | Access                                |
| -------------------- | -------------------------- | ------------------------------------- |
| `void.openBrowser`   | SafeAppeals: Open Browser  | Globe icon (top-right), `Ctrl+Shift+P` |

### Architecture

```
Browser Process:
├── IBrowserPanelService (browser/browserService.ts - IPC client)
│   ├── History management (IStorageService)
│   ├── Bookmark management (IStorageService)
│   └── IPC relay for navigation/loading/download events
├── BrowserEditor (browser/browserEditor.ts - EditorPane)
│   ├── Toolbar UI (back/fwd/reload/home, URL bar, bookmarks, DevTools)
│   ├── Bookmarks bar with clickable chips
│   ├── Find-in-page bar
│   ├── Content area bounds computation (CSS→DIP coordinate conversion)
│   └── ResizeObserver for responsive layout
├── BrowserInput (browser/browserInput.ts - EditorInput)
└── BrowserInputSerializer (browser/browserInputSerializer.ts)

IPC Channel (void-channel-browser-panel):
├── createView(viewId, url, bounds)
├── destroyView(viewId)
├── navigateTo(viewId, url)
├── goBack/goForward/reload(viewId)
├── setBounds(viewId, bounds)
├── setVisible(viewId, visible)
├── openDevTools(viewId)
├── findInPage/stopFindInPage(viewId, text)
├── focusView(viewId)
└── showContextMenu(items) → selected item ID

Electron Main:
├── BrowserPanelChannel (electron-main/browserPanelChannel.ts)
│   ├── WebContentsView lifecycle management
│   ├── Session setup (persist:void-browser-v2)
│   ├── Navigation event forwarding
│   ├── Download handling (will-download)
│   └── Native context menu (Electron Menu.popup)
└── app.ts security exemptions
    ├── will-navigate: allows navigation for browser session
    └── setWindowOpenHandler: skips for browser session
```

### Files

**Common** (`common/`):

- `browserPanelTypes.ts` - `BrowserViewBounds`, `BrowserViewNavigationEvent`, `BrowserViewLoadingEvent`

**Browser** (`browser/browserPanel/`):

- `browserEditor.ts` - EditorPane with toolbar, bookmarks bar, find bar, bounds computation
- `browserInput.ts` - EditorInput with URL, tabId, serialization
- `browserInputSerializer.ts` - Session restore serializer
- `browserService.ts` - `IBrowserPanelService` (IPC client + history/bookmarks)

**Electron Main** (`electron-main/`):

- `browserPanelChannel.ts` - IServerChannel managing `WebContentsView` instances

**Registration**:

- `documentViewer.contribution.ts` - EditorPane, EditorInput, Serializer registration
- `sidebarActions.ts` - `void.openBrowser` action (globe icon in title bar)

### Key Technical Decisions

1. **`WebContentsView` over Webview/iframe**: Full Chromium renderer with no CSP restrictions, enabling Google sign-in and complex JS apps
2. **Session isolation**: Dedicated `persist:void-browser-v2` partition prevents cookie/cache contamination with VS Code's own session
3. **Minimal UA modification**: Only strip Electron/app identifiers from User-Agent; no header interception, no CSP stripping, no consent cookie hacks — tested extensively and the minimal approach works best
4. **Security exemptions in `app.ts`**: Session-identity-based checks (`===` on `Session` object) to exempt the browser from VS Code's global navigation blockers while keeping all other webContents protected
5. **Native context menus**: Use `Electron.Menu.popup()` for bookmark context menus since DOM elements render behind the native `WebContentsView`

### Documentation

See `docs/browser-panel/` for comprehensive documentation:

- [README](../browser-panel/README.md) - Overview and quick start
- [Architecture](../browser-panel/architecture.md) - Process model, IPC, security
- [User Guide](../browser-panel/user-guide.md) - Feature walkthrough
- [Developer Guide](../browser-panel/developer-guide.md) - Extension points, testing
- [API Reference](../browser-panel/api-reference.md) - Service API, types
- [Troubleshooting](../browser-panel/troubleshooting.md) - Common issues and fixes

---

## 📞 Contacts & Resources

- **GitHub**: <https://github.com/savagelysubtle/SafeAppeals2.0>
- **Developer**: @savagelysubtle (<simpleflowworks@gmail.com>)
- **Base Fork**: Void (VSCode fork)
- **Branch**: `main`
- **Cloud Backend**: <https://github.com/savagelysubtle/void-cloud>

---

**Last Updated**: February 18, 2026
**Version**: 1.99.7

# RAG System Architecture

## 🏗️ System Overview

The RAG (Retrieval-Augmented Generation) system is a sophisticated document indexing and semantic search platform designed specifically for legal and medical document analysis. It combines traditional keyword search with modern vector embeddings to provide highly accurate document retrieval.

## 📊 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Void Application                         │
├─────────────────────────────────────────────────────────────┤
│  Browser Process           │ Common Layer │ Electron Main   │
│  ┌─────────────────┐       │              │                 │
│  │   React UI      │       │              │  ┌────────────┐ │
│  │ • File Upload   │◄─────►│ IRAGService  │◄►│RAGMainSvc  │ │
│  │ • Search UI     │       │              │  │• IndexSvc  │ │
│  └─────────────────┘       │              │  │• FileSvc   │ │
│                            │              │  └────────────┘ │
└────────────────────────────┴──────────────┴─────────────────┘
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────┐
│                Data Layer & Storage                         │
├─────────────────────────────────────────────────────────────┤
│  SQLite Database        │ Vector Store     │ File System    │
│  ┌─────────────────┐    │                  │                │
│  │ • documents     │    │ Chroma DB       │ • Documents     │
│  │ • chunks        │    │ • Embeddings    │ • Models        │
│  │ • chunks_fts    │    │ • Metadata      │ • Logs          │
│  └─────────────────┘    │                  │                │
└─────────────────────────────┴────────────────┴────────────────┘
```

## 🔧 Component Architecture

### 1. Service Layer

#### IRAGService (Common Layer)
- **Purpose**: Browser-accessible interface
- **Location**: `src/vs/workbench/contrib/void/common/ragService.ts`
- **Responsibilities**:
  - IPC communication with main process
  - URI serialization/deserialization
  - Error handling and user feedback
- **Dependencies**: IMainProcessService, IVoidSettingsService

#### RAGMainService (Electron Main)
- **Purpose**: Core business logic implementation
- **Location**: `src/vs/workbench/contrib/void/electron-main/ragMainService.ts`
- **Responsibilities**:
  - Document processing orchestration
  - Search pipeline management
  - System initialization and cleanup
  - Memory management and performance monitoring
- **Dependencies**: ILogService, IRAGPathService

### 2. Processing Components

#### RAGIndexService
- **Purpose**: Document indexing and database management
- **Location**: `src/vs/workbench/contrib/void/electron-main/ragIndexService.ts`
- **Responsibilities**:
  - Document chunking (hierarchical)
  - SQLite database operations
  - FTS5 search index management
  - Schema migrations
  - Chunk retrieval for integrity verification
- **Key Features**:
  - Hierarchical chunking with parent/child relationships
  - Automatic document deduplication via checksums
  - Full-text search with BM25 ranking
  - Public `getChunksByDocId()` for integrity checks

#### RAGFileService
- **Purpose**: Document content extraction
- **Location**: `src/vs/workbench/contrib/void/electron-main/ragFileService.ts`
- **Responsibilities**:
  - Multi-format document parsing
  - PDF extraction (PDF.js + Docling hybrid)
  - Office document processing
  - Content metadata extraction
- **Supported Formats**: PDF, DOCX, XLSX, TXT, MD, RTF, ODT

#### HybridRetriever
- **Purpose**: Multi-stage search orchestration
- **Location**: `src/vs/workbench/contrib/void/common/ragHybridRetriever.ts`
- **Responsibilities**:
  - BM25 keyword search execution
  - Vector similarity search
  - Reciprocal Rank Fusion (RRF)
  - Result ranking and filtering
- **Algorithm**: BM25 + Cosine Similarity → RRF → Cross-encoder reranking

### 3. Storage Components

#### VectorAdapter (ChromaPersistentAdapter)
- **Purpose**: Vector embeddings storage and retrieval
- **Location**: `src/vs/workbench/contrib/void/common/ragVectorAdapter.ts`
- **Responsibilities**:
  - Local embedding model management
  - SQLite-based vector persistence
  - Cosine similarity calculations
  - Memory/disk caching
  - Embedding existence verification
- **Features**:
  - Offline embeddings (no API required)
  - Persistent storage across restarts
  - Batch processing for performance
  - MMR (Maximal Marginal Relevance) diversity
  - `hasDocumentEmbeddings()` for integrity verification

#### LocalEmbeddingService
- **Purpose**: Text-to-vector conversion
- **Location**: `src/vs/workbench/contrib/void/common/ragLocalEmbeddings.ts`
- **Responsibilities**:
  - Xenova/transformers.js pipeline management
  - Batch embedding generation
  - Model caching and memory management
- **Model**: all-MiniLM-L6-v2 (384D, ~23MB)

#### LocalCrossEncoderReranker
- **Purpose**: Query-chunk relevance scoring
- **Location**: `src/vs/workbench/contrib/void/common/ragReranker.ts`
- **Responsibilities**:
  - Cross-encoder inference
  - Relevance score calculation
  - Result reranking
- **Model**: MS MARCO MiniLM (local, offline)

## 📈 Data Flow Architecture

### Document Indexing Pipeline

```
Document Upload
       ↓
Content Extraction (RAGFileService)
       ↓
Hierarchical Chunking (RAGIndexService)
       ↓
Embedding Generation (LocalEmbeddingService)
       ↓
Vector Storage (ChromaPersistentAdapter)
       ↓
SQLite Metadata (RAGIndexService)
       ↓
FTS5 Index Update
```

**Detailed Flow:**

1. **File Reception**: URI passed to `indexDocument()`
2. **Content Extraction**:
   - File type detection
   - Appropriate extractor selection
   - Text and metadata extraction
3. **Document Chunking**:
   - Structure parsing (legal document patterns)
   - Hierarchical chunk creation (child + parent)
   - Metadata enrichment (sections, breadcrumbs)
4. **Embedding Generation**:
   - Batch processing (25 texts/batch)
   - Mean pooling + normalization
   - Memory monitoring and GC hints
5. **Storage**:
   - SQLite document/chunk records
   - Vector embeddings persistence
   - FTS5 keyword index updates

### Search Pipeline

```
User Query
       ↓
Query Processing (QueryProcessor)
       ↓
Hybrid Retrieval (HybridRetriever)
       ↓
Cross-Encoder Reranking (LocalCrossEncoderReranker)
       ↓
Context Assembly
       ↓
Result Presentation
```

**Detailed Flow:**

1. **Query Processing**:
   - Complexity detection
   - Query decomposition (if complex)
   - Scope routing (policy vs case docs)
   - Legal terminology expansion

2. **Hybrid Retrieval**:
   - **BM25 Search**: Keyword matching via FTS5
   - **Vector Search**: Semantic similarity via embeddings
   - **RRF Fusion**: Rank combination (k=20 for legal precision)
   - **MMR Diversity**: λ=0.7 balance of relevance/diversity

3. **Reranking**:
   - Cross-encoder scoring of top candidates
   - Query-chunk relevance assessment
   - Final ranking by semantic relevance

4. **Context Assembly**:
   - Attribution metadata collection
   - Context text concatenation
   - Response time tracking

## 💾 Database Schema Architecture

### SQLite Tables

```sql
-- Document registry
CREATE TABLE documents (
    id TEXT PRIMARY KEY,                    -- SHA256 hash of filepath
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    filetype TEXT NOT NULL,
    filesize INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL,
    last_indexed TEXT NOT NULL,
    checksum TEXT,                          -- SHA256 of file content
    metadata TEXT,                          -- JSON metadata
    is_policy_manual BOOLEAN NOT NULL DEFAULT 0,
    workspace_id TEXT
);

-- Chunk storage with hierarchical metadata
CREATE TABLE chunks (
    chunk_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    tokens INTEGER,
    -- Hierarchical chunking fields
    section_id TEXT,
    parent_section TEXT,
    section_number TEXT,
    section_title TEXT,
    breadcrumb_path TEXT,                   -- JSON array
    chunk_type TEXT CHECK(chunk_type IN ('child', 'parent')),
    parent_chunk_id TEXT,
    FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE,
    FOREIGN KEY (parent_chunk_id) REFERENCES chunks (chunk_id) ON DELETE SET NULL
);

-- Full-text search index
CREATE VIRTUAL TABLE chunks_fts USING fts5(
    chunk_id UNINDEXED,
    text,
    content='chunks',
    content_rowid='rowid'
);

-- Schema version tracking
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY
);
```

### Indexes and Performance

```sql
-- Document queries
CREATE INDEX idx_documents_workspace ON documents(workspace_id);
CREATE INDEX idx_documents_policy ON documents(is_policy_manual);

-- Chunk queries
CREATE INDEX idx_chunks_doc ON chunks(doc_id);
CREATE INDEX idx_chunks_section ON chunks(section_id);
CREATE INDEX idx_chunks_type ON chunks(chunk_type);
CREATE INDEX idx_chunks_parent ON chunks(parent_chunk_id);
```

### Vector Storage Schema

**SQLite Embeddings Table:**
```sql
CREATE TABLE embeddings (
    id TEXT PRIMARY KEY,      -- Chunk ID
    vector TEXT NOT NULL,     -- JSON array of floats
    metadata TEXT NOT NULL    -- JSON metadata
);
```

**In-Memory Cache:**
```typescript
private embeddings: Map<string, {
    vector: number[];
    metadata: Record<string, any>;
}> = new Map();
```

### RAG Storage Scopes

The system supports multiple search scopes for targeted retrieval:

```typescript
type RAGStorageScope =
    | 'policy_manual'   // Only policy manuals for THIS workspace
    | 'case_index'      // Only case files for THIS workspace
    | 'workspace_all'   // Both policy + case for THIS workspace
    | 'workspace_docs'  // Legacy alias for 'case_index'
    | 'both';           // Legacy alias for 'workspace_all'
```

**Agent Tool → Scope Routing:**
| Agent Tool | Scope |
|------------|-------|
| `rag_search_policy` | `'policy_manual'` |
| `rag_search_workspace` | `'case_index'` |
| `rag_search_all` | `'workspace_all'` |

## 🔄 Process Communication Architecture

### IPC Channels

**RAG Service Communication:**
```
Browser Process ←IPC→ Electron Main Process
       ↓                    ↓
IRAGService    ←IPC→   RAGMainService
                        ↓
                  [void-channel-rag]
```

**Channel Messages:**
- `indexDocument`: Document indexing requests
- `search`: Search query execution
- `getStats`: System statistics retrieval
- `deleteDocument`: Document removal
- `isDocumentIndexed`: Indexing status checks
- `getDocumentsByType`: Type-based document queries
- `switchWorkspace`: Workspace context switching (per-workspace RAG)
- `initialize`: Service initialization
- `clearAllEmbeddings`: Data clearing operations
- `testDoclingExtraction`: Extraction testing

### Data Serialization

**URI Handling:**
```typescript
// Browser to Main: Serialize URI
const params = {
  ...otherParams,
  uri: uri.toJSON()  // URI → JSON
};

// Main to Browser: Deserialize URI
const uri = URI.revive(params.uri);  // JSON → URI
```

**Large Data Handling:**
- Text content: Direct string transfer (reasonable sizes)
- Embeddings: Stored locally, only metadata transferred
- Search results: Serialized ContextPack with attributions

## 🧠 AI/ML Architecture

### Model Pipeline

```
Input Text
    ↓
Tokenization (Xenova/transformers)
    ↓
all-MiniLM-L6-v2 Encoder
    ↓
Mean Pooling + Normalization
    ↓
384D Vector Output
    ↓
SQLite Persistence
```

### Cross-Encoder Pipeline

```
Query + Chunk Text
        ↓
MS MARCO MiniLM Encoder
        ↓
Concatenation + Classification
        ↓
Relevance Score (0-1)
        ↓
Result Reranking
```

### Model Management

**Caching Strategy:**
- Models stored in: `~/.safe-appeals-navigator/models/`
- Automatic download on first use
- Persistent across application restarts
- Shared between embedding and reranking models

**Memory Management:**
- Batch processing to control memory usage
- Explicit garbage collection hints
- Model unloading on service disposal
- Process monitoring and warnings

## 🗂️ Micro Database Architecture (v2.0)

The RAG system uses a **MICRO DATABASE ARCHITECTURE** with **complete isolation** between workspaces. There is **NO global database** - each workspace has its own dedicated micro databases.

### Workspace-Specific Micro Databases
Each workspace gets its own isolated set of:
- **SQLite Database** (`workspace.db`): Document metadata, chunks, FTS5 index
- **Vector Database** (`chroma/embeddings.db`): Local vector embeddings
- **Email Database** (`emails.db`): Email-specific data (if applicable)
- **RAG Instance**: Independent `WorkspaceRAGInstance` with all components

### Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────┐
│                   WorkspaceRAGManager                           │
│            (NO global database - workspaceId REQUIRED)          │
├─────────────────────────────────────────────────────────────────┤
│  Workspace A (hash: a1b2c3d4)   │  Workspace B (hash: e5f6g7h8) │
│  ┌───────────────────────────┐  │  ┌───────────────────────────┐│
│  │ MICRO DATABASE            │  │  │ MICRO DATABASE            ││
│  │ • VectorAdapter           │  │  │ • VectorAdapter           ││
│  │ • RAGIndexService         │  │  │ • RAGIndexService         ││
│  │ • HybridRetriever         │  │  │ • HybridRetriever         ││
│  │ • CrossEncoderReranker    │  │  │ • CrossEncoderReranker    ││
│  └───────────────────────────┘  │  └───────────────────────────┘│
│            ↓                    │            ↓                  │
│  databases/workspaces/a1b2c3d4/ │  databases/workspaces/e5f6g7h8/│
│  ├── workspace.db               │  ├── workspace.db              │
│  ├── emails.db                  │  ├── emails.db                 │
│  └── chroma/embeddings.db       │  └── chroma/embeddings.db      │
└─────────────────────────────────────────────────────────────────┘
```

### Workspace ID Generation & Validation
```typescript
// Browser-side (RAGService) - THROWS if no workspace open
private computeWorkspaceId(): string {
    const folders = this.workspaceContextService.getWorkspace().folders;
    if (folders.length === 0) {
        throw new Error('RAG requires an open workspace folder');
    }
    const folder = folders[0];
    return crypto.createHash('sha256')
        .update(folder.uri.fsPath)
        .digest('hex')
        .substring(0, 8); // 8-char stable hash
}
```

### Workspace ID Validation Layers
The system validates `workspaceId` at **5 layers** to prevent any global database access:
1. **Browser-side**: `RAGService.computeWorkspaceId()` throws if no workspace
2. **IPC Channel**: `RAGMainChannel` rejects calls without `workspaceId`
3. **Main Service**: `RAGMainService` validates before delegating
4. **Workspace Manager**: `WorkspaceRAGManager` validates before creating instances
5. **Index Service**: `RAGIndexService` requires `workspaceId` in constructor

### Automatic Workspace Switching
When the user switches workspaces:
1. `RAGService` detects workspace change via `onDidChangeWorkspaceFolders`
2. Calls `switchWorkspace(newWorkspaceId)` to main process
3. `WorkspaceRAGManager` creates or retrieves the correct micro database
4. All subsequent RAG operations use the new workspace's isolated database

### Auto-Indexing on Startup
When a workspace is opened:
1. `RAGWorkspaceService` scans all folders (except policy-manuals/)
2. New/unindexed files are automatically indexed as case files
3. Policy manual folder is indexed separately with `isPolicyManual: true`

### Indexing Integrity Verification

The system performs a **3-layer integrity check** before considering a document "indexed":

```
isDocumentIndexed(uri)
        ↓
┌───────────────────────────────────────────────────────────────┐
│ Step 1: SQLite Document Check                                  │
│ • Does document record exist in documents table?               │
│ • If NO → Document NOT indexed                                 │
└───────────────────────────────────────────────────────────────┘
        ↓ (if YES)
┌───────────────────────────────────────────────────────────────┐
│ Step 2: SQLite Chunk Count                                     │
│ • How many chunks exist in chunks table for this docId?       │
└───────────────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────────────┐
│ Step 3: Embedding Verification                                 │
│ • Call vectorAdapter.hasDocumentEmbeddings(docId)             │
│ • Count embeddings matching this docId                        │
│ • Compare with SQLite chunk count (within 10% tolerance)      │
└───────────────────────────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────────────────────────┐
│ Result:                                                        │
│ • FULLY INDEXED: SQLite + Embeddings match                    │
│ • INTEGRITY MISMATCH: Counts don't match → Re-index           │
│ • PARTIAL INDEX: SQLite exists, no embeddings → Re-index      │
│ • NOT INDEXED: No SQLite record                               │
└───────────────────────────────────────────────────────────────┘
```

**Why This Matters:**
- Prevents documents from appearing "indexed" when embeddings failed to save
- Detects partial index failures (e.g., process crash during embedding generation)
- Ensures search actually works for all indexed documents
- Automatically repairs integrity mismatches by triggering re-indexing

**Log Messages:**
- `INTEGRITY MISMATCH`: SQLite has N chunks but only M embeddings
- `PARTIAL INDEX`: Document exists in SQLite but has no embeddings
- These conditions automatically trigger re-indexing to repair the data

## 🔒 Security Architecture

### Data Isolation
- **Workspace Separation**: Documents isolated by workspace ID (cryptographic hash)
- **Scope Enforcement**: Policy vs case document access control
- **File System Security**: Restricted to user data directories

### Process Boundaries
- **Main Process Execution**: Node.js for file system access
- **Browser Process Isolation**: No direct file system access
- **IPC Validation**: All messages validated before processing

### Privacy Considerations
- **Local Processing**: All embeddings generated locally
- **No External APIs**: Default configuration uses no cloud services
- **Data Persistence**: Controlled by user in local directories

## 📊 Performance Architecture

### Optimization Strategies

**Indexing Performance:**
- File size validation (<100MB)
- Memory monitoring during processing
- Batch embedding generation (25 texts/batch)
- Parallel processing where possible

**Search Performance:**
- In-memory embedding cache
- FTS5 for fast keyword search
- Vector similarity with early termination
- Cross-encoder reranking of top candidates only

**Storage Performance:**
- SQLite WAL mode for concurrent access
- Indexes on frequently queried columns
- FTS5 for full-text search acceleration
- Vector storage with efficient serialization

### Monitoring and Metrics

**Performance Metrics:**
- Indexing time per document
- Search response time
- Memory usage during operations
- Embedding generation throughput

**Health Checks:**
- Model loading status
- Database connectivity
- File system permissions
- Memory pressure monitoring

## 🔧 Extension Architecture

### Plugin Interfaces

**Custom Extractors:**
```typescript
interface DocumentExtractor {
  canExtract(filetype: string): boolean;
  extractContent(uri: URI): Promise<ExtractedContent>;
}
```

**Custom Chunkers:**
```typescript
interface DocumentChunker {
  chunkText(text: string, docId: string): ChunkRecord[];
}
```

**Custom Retrievers:**
```typescript
interface VectorRetriever {
  query(text: string, n: number, scope: RAGStorageScope): Promise<SearchResult[]>;
}
```

### Configuration Extension Points

**Settings Integration:**
- Model selection per feature
- Performance tuning parameters
- Scope and routing rules
- Memory management settings

**Workspace Customization:**
- Per-workspace embedding models
- Custom document classifiers
- Specialized search pipelines

## 🚀 Deployment Architecture

### Directory Structure (Micro Database Architecture v2.0)

The RAG system uses **per-workspace micro databases** for complete data isolation. Each workspace has its own dedicated SQLite and vector databases - **no global database exists**.

```
~/.safe-appeals-navigator/
├── databases/
│   └── workspaces/                    # Per-workspace micro databases
│       ├── a1b2c3d4/                  # Workspace 1 (8-char hash of folder path)
│       │   ├── workspace.db           # SQLite: documents, chunks, FTS5
│       │   ├── emails.db              # Email data (if applicable)
│       │   └── chroma/
│       │       └── embeddings.db      # Vector embeddings
│       ├── e5f6g7h8/                  # Workspace 2
│       │   ├── workspace.db
│       │   └── chroma/
│       │       └── embeddings.db
│       └── [more workspaces...]
├── models/                            # ML model cache (shared)
│   └── Xenova/
│       ├── all-MiniLM-L6-v2/         # Embedding model
│       └── ms-marco-MiniLM-L-6-v2/   # Reranker model
└── logs/                              # System logs
    └── rag-debug.log
```

**Key Points:**
- ✅ **No global database** - all data is isolated per workspace
- ✅ **workspaceId is REQUIRED** for all RAG operations
- ✅ Documents from Workspace A cannot leak into Workspace B
- ✅ Each workspace can be independently backed up or deleted

### Environment Setup

**Required Environment Variables:**
```bash
# For Docling PDF extraction
HF_TOKEN=hf_...
HUGGING_FACE_HUB_TOKEN=hf_...

# Optional: Custom paths
RAG_DATA_DIR=/custom/path
RAG_MODEL_CACHE=/custom/models
```

### Service Lifecycle

**Initialization Sequence:**
1. Directory creation and validation
2. SQLite database setup and migration
3. Docling service startup (background)
4. Embedding model download and loading
5. Vector store initialization
6. Service ready for operations

**Shutdown Sequence:**
1. Docling service termination
2. Model cleanup
3. Database connection closure
4. IPC channel cleanup

## 🔮 Future Architecture

### Planned Enhancements

**Multi-Modal Support:**
- Image and diagram understanding
- Table structure recognition
- Document layout analysis

**Advanced Reasoning:**
- Multi-hop question answering
- Temporal reasoning for legal deadlines
- Citation and precedent analysis

**Scalability Improvements:**
- Distributed vector storage
- Parallel processing pipelines
- Caching layer optimization

**Integration Enhancements:**
- Case management system integration
- Chat system context injection
- File organizer automation

---

*Architecture documentation last updated: January 2026*



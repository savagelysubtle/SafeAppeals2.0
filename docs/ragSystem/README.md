# RAG (Retrieval-Augmented Generation) System Documentation

## Overview

The Void RAG system is a sophisticated document indexing and retrieval system designed specifically for legal and medical document analysis. It combines traditional keyword search with modern vector embeddings to provide highly accurate document retrieval for workers' compensation appeals and legal research.

## Architecture

### Core Components

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Browser UI    │    │   Common Layer   │    │ Electron Main   │
│                 │    │                  │    │                 │
│ • File Upload   │◄──►│ • IRAGService    │◄──►│ • RAGMainService│
│ • Search UI     │    │ • VectorAdapter  │    │ • IndexService  │
│ • Results Display│   │ • HybridRetriever│   │ • FileService    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Data Flow

```
Document Upload → Content Extraction → Hierarchical Chunking → Embedding Generation → Vector Storage
                                                                                   ↓
User Query → Query Processing → Hybrid Search (BM25 + Vector) → Reranking → Results
```

## Data Ingestion Pipeline

### 1. Document Processing

The system supports multiple document formats:

#### PDF Files
- **Primary**: Docling SDK for advanced ML-based extraction
- **Fallback**: PDF.js for standard text extraction
- **Hybrid Mode**: Combines PDF.js metadata with Docling content

#### Office Documents
- **DOCX**: Uses mammoth.js for rich text and formatting preservation
- **XLSX**: Extracts tabular data with sheet structure
- **RTF/ODT**: Converted to supported formats

### 2. Hierarchical Chunking

The system implements research-backed document chunking optimized for legal/medical content:

#### Chunk Types
- **Child Chunks**: 300 tokens (~1200 characters)
  - Purpose: Precise retrieval of specific information
  - Storage: Optimized for exact matches

- **Parent Chunks**: 800 tokens (~3200 characters)
  - Purpose: Contextual understanding
  - Storage: Linked to child chunks for broader context

#### Document Structure Recognition
Automatically detects legal document patterns:
- `Section 3.2.1 Title`
- `Article IV: Title`
- `Rule 12: Description`
- `Chapter 5: Content`

#### Metadata Enrichment
Each chunk includes:
- Section hierarchy (breadcrumb path)
- Document type (policy manual vs case document)
- Token count estimates
- Section numbering and titles

### 3. Embedding Generation

#### Local Embedding Model
- **Model**: Xenova/all-MiniLM-L6-v2
- **Dimensions**: 384
- **Size**: ~23MB
- **Features**: Offline processing, no API costs

#### Processing Pipeline
```
Input Text → Tokenization → Mean Pooling → Normalization → Vector Output
```

#### Batching Strategy
- Batch size: 25 texts per processing batch
- Memory monitoring during embedding generation
- Automatic garbage collection hints

### 4. Storage Architecture

#### SQLite Database Schema

**Documents Table**
```sql
CREATE TABLE documents (
    id TEXT PRIMARY KEY,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    filetype TEXT NOT NULL,
    filesize INTEGER NOT NULL,
    uploaded_at TEXT NOT NULL,
    last_indexed TEXT NOT NULL,
    checksum TEXT,
    metadata TEXT,
    is_policy_manual BOOLEAN NOT NULL DEFAULT 0,
    workspace_id TEXT
)
```

**Chunks Table**
```sql
CREATE TABLE chunks (
    chunk_id TEXT PRIMARY KEY,
    doc_id TEXT NOT NULL,
    text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    tokens INTEGER,
    section_id TEXT,
    parent_section TEXT,
    section_number TEXT,
    section_title TEXT,
    breadcrumb_path TEXT,
    chunk_type TEXT CHECK(chunk_type IN ('child', 'parent')),
    parent_chunk_id TEXT,
    FOREIGN KEY (doc_id) REFERENCES documents (id) ON DELETE CASCADE,
    FOREIGN KEY (parent_chunk_id) REFERENCES chunks (chunk_id) ON DELETE SET NULL
)
```

**FTS5 Search Index**
```sql
CREATE VIRTUAL TABLE chunks_fts USING fts5(
    chunk_id UNINDEXED,
    text,
    content='chunks',
    content_rowid='rowid'
)
```

#### Vector Storage
- **Backend**: Persistent Chroma adapter using SQLite
- **Scope Separation**: Policy manuals vs workspace documents
- **Persistence**: Embeddings survive application restarts
- **Memory Cache**: Fast search with disk backup

## Search and Retrieval

### 1. Query Processing

#### Query Classification
- **Simple Queries**: Direct routing to appropriate scope
- **Complex Queries**: Decomposition using conjunction analysis
- **Multi-part Questions**: Split into sub-queries with priorities

#### Scope Routing
**Policy Manual Keywords:**
- policy, rule, regulation, guideline, procedure
- requirement, compliance, statute, code, law
- eligibility, coverage, benefit, deadline, timeframe

**Case Document Keywords:**
- client, claimant, case, appeal, injury
- medical, treatment, diagnosis, report, investigation
- claim, incident, accident, worker, employee

### 2. Hybrid Search Algorithm

#### BM25 Keyword Search
- **Implementation**: SQLite FTS5 with BM25 ranking
- **Parameters**: k1=0.8, b=0.5 (optimized for legal documents)
- **Features**: Full-text search with relevance scoring

#### Vector Semantic Search
- **Similarity**: Cosine similarity with preprocessing
- **Threshold**: Dynamic threshold (0.07-0.15) for retrieval
- **Diversity**: Maximal Marginal Relevance (MMR) with λ=0.7

#### Reciprocal Rank Fusion (RRF)
```
RRF Score = (1/(k+r)) where:
- k = 20 (constant for legal/medical precision)
- r = rank position in individual result lists
```

### 3. Reranking Stage

#### Cross-Encoder Model
- **Model**: Local MS MARCO MiniLM
- **Purpose**: Query-chunk relevance scoring
- **Input**: Query + chunk text pairs
- **Output**: Refined relevance scores

#### Processing Flow
```
Raw Results (4x limit) → Cross-Encoder Scoring → Top-K Selection
```

## API Reference

### IRAGService Interface

#### Document Management
```typescript
indexDocument(params: RAGIndexParams): Promise<{ success: boolean; message: string }>
deleteDocument(uriOrDocId: URI | string): Promise<void>
isDocumentIndexed(uri: URI): Promise<boolean>
getDocumentsByType(isPolicyManual: boolean): Promise<any[]>
```

#### Search Operations
```typescript
search(params: RAGSearchParams): Promise<ContextPack>
getStats(): Promise<RAGStats>
clearAllEmbeddings(): Promise<{ success: boolean; message: string }>
```

#### Testing and Diagnostics
```typescript
testDoclingExtraction(uri: URI): Promise<{ standard: any; docling: any; doclingError?: any }>
```

### Data Types

#### RAGIndexParams
```typescript
interface RAGIndexParams {
    uri: URI;
    isPolicyManual: boolean;
    workspaceId: string;    // REQUIRED - identifies the micro database
}
```

#### RAGSearchParams
```typescript
interface RAGSearchParams {
    query: string;
    scope: RAGStorageScope; // See below
    limit: number;
    workspaceId: string;    // REQUIRED - auto-injected by RAGService
}

// Search scope options
type RAGStorageScope =
    | 'policy_manual'   // Only policy manuals for THIS workspace
    | 'case_index'      // Only case files for THIS workspace
    | 'workspace_all'   // Both policy + case for THIS workspace
    | 'workspace_docs'  // Legacy alias for 'case_index'
    | 'both';           // Legacy alias for 'workspace_all'
```

#### ContextPack
```typescript
interface ContextPack {
    answerContext: string;
    attributions: Array<{
        docId: string;
        chunkId: string;
        filename: string;
        rangeHint: string;
        score: number;
    }>;
    totalResults: number;
    responseTime: number;
}
```

## Configuration

### File Paths (Micro Database Architecture v2.0)

The RAG system uses a **MICRO DATABASE ARCHITECTURE** with **NO global database**. Each workspace has its own completely isolated databases:

```
~/.safe-appeals-navigator/
├── databases/
│   └── workspaces/                    # Per-workspace micro databases ONLY
│       ├── a1b2c3d4/                  # Workspace 1 (8-char hash)
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
│       ├── all-MiniLM-L6-v2/         # Embedding model (~23MB)
│       └── ms-marco-MiniLM-L-6-v2/   # Reranker model (~22MB)
└── logs/                              # System logs
```

**Key Architecture Points:**
- ✅ **NO global database** - `workspaceId` is **REQUIRED** for all operations
- ✅ **Workspace ID**: 8-character SHA256 hash of workspace folder path
- ✅ **Complete isolation**: Documents from one case cannot leak to another
- ✅ **Independent cleanup**: Each workspace can be backed up/deleted independently

### Environment Variables

#### Docling Service
```bash
HF_TOKEN=hf_...              # HuggingFace token for gated models
HUGGING_FACE_HUB_TOKEN=hf_... # Alternative token variable
```

### Settings Integration

The RAG system integrates with Void settings:
- **API Keys**: OpenAI key (currently unused, kept for future)
- **Model Selection**: Per-feature model configuration
- **Performance**: Reranking enable/disable
- **Scope**: Default search scope preferences

## Performance and Optimization

### Memory Management

#### Ingestion Optimizations
- **File Size Limits**: 100MB maximum per document
- **Batch Processing**: 50 chunks per embedding batch
- **Memory Monitoring**: Heap usage tracking during processing
- **Garbage Collection**: Explicit GC hints after large operations

#### Search Optimizations
- **Parallel Processing**: BM25 and vector search run concurrently
- **Caching Strategy**: In-memory embeddings with disk persistence
- **Result Limiting**: 4x over-retrieval for reranking efficiency

### Database Optimizations

#### Indexing Strategy
- **Compound Indexes**: Optimized for common query patterns
- **FTS5 Triggers**: Automatic synchronization between chunks and search index
- **Foreign Keys**: Cascading deletes maintain data integrity

#### Query Performance
- **Prepared Statements**: SQL injection prevention and performance
- **Scope Filtering**: SQL-level filtering reduces result sets
- **Pagination Ready**: Support for large result set handling

### Model Optimizations

#### Embedding Model
- **Quantization**: Automatic model quantization for smaller footprint
- **Batch Processing**: Optimal batch sizes for GPU/CPU utilization
- **Cache Management**: Model files cached locally for fast loading

## Troubleshooting

### Common Issues

#### "Failed to initialize embedding model"
**Symptoms**: RAG search unavailable, model download failures
**Solutions**:
1. Check internet connection for first-time download
2. Verify disk space (23MB required)
3. Check write permissions in model cache directory

#### "Document indexing failed"
**Symptoms**: Large files fail to process, memory errors
**Solutions**:
1. Split large documents into smaller files (<50MB recommended)
2. Restart application to clear memory
3. Check available RAM (2GB+ recommended)

#### "Search returns no results"
**Symptoms**: Queries return empty result sets
**Solutions**:
1. Verify documents are indexed (check RAG stats)
2. Confirm search scope matches document types
3. Check for embedding generation failures in logs

#### "Docling extraction errors"
**Symptoms**: PDF processing fails with Docling-specific errors
**Solutions**:
1. Ensure HF_TOKEN environment variable is set
2. Check virtual environment activation
3. Verify docling-serve is running on localhost:5001

### Debug Tools

#### Statistics Endpoint
```typescript
const stats = await ragService.getStats();
// Returns document counts, chunk statistics, and system health
```

#### Extraction Testing
```typescript
const testResults = await ragService.testDoclingExtraction(uri);
// Compare standard vs Docling extraction methods
```

#### Logging
Enable verbose logging in development:
```bash
# Logs include memory usage, processing times, and detailed errors
tail -f ~/.safe-appeals-navigator/logs/rag.log
```

## Future Enhancements

### Planned Features
1. **LLM-based Query Decomposition**: Use Llama-3.2-1B for complex query analysis
2. **Multi-modal Support**: Image and diagram understanding in documents
3. **Advanced Reranking**: Integration with larger cross-encoder models
4. **Workspace-specific Models**: Fine-tuned embeddings per legal domain
5. **Real-time Indexing**: Incremental updates without full re-indexing

### Research Areas
1. **Domain-specific Embeddings**: Legal/medical fine-tuned models
2. **Temporal Reasoning**: Date-based query understanding
3. **Citation Analysis**: Automatic precedent and case law linking
4. **Multi-hop Reasoning**: Complex legal argument reconstruction

## Agent RAG Tools

The AI agent has access to three RAG search tools:

### Tool Overview

| Tool | Searches | Use Case |
|------|----------|----------|
| `rag_search_policy` | Policy manuals only | WC rules, procedures, regulations, eligibility |
| `rag_search_workspace` | Case files only | Medical reports, IME evals, correspondence |
| `rag_search_all` | **Both sources** | Comprehensive research, unsure where info is |

### rag_search_policy
Search indexed policy manuals for workers' compensation rules, eligibility criteria, procedural requirements, benefit calculations, and appeal processes.

**When to use:**
- Answering questions about WC rules or procedures
- Drafting correspondence requiring policy citations
- Researching appeal procedures or disability ratings

### rag_search_workspace
Search indexed case-specific documents (medical reports, IME evaluations, appeals board decisions, claim correspondence).

**When to use:**
- Finding medical opinions or diagnoses
- Locating claim events or procedural history
- Extracting information from IME/QME reports

### rag_search_all
Search BOTH policy manuals AND case files simultaneously.

**When to use:**
- Unsure if answer is in policy or case documents
- Comprehensive research spanning both sources
- Comparing policy requirements against case facts
- Initial broad search before narrowing down

### Auto-Indexing

**On Drag-and-Drop:**
When files are dropped into the chat, they are automatically indexed:
- Files in `policy-manuals/` folder → indexed as policy manuals
- All other files → indexed as case files

**On Workspace Open:**
When a workspace opens (if `ragAutoIndexCaseFiles` setting is true):
- All folders except `policy-manuals/` are scanned
- Unindexed documents are automatically indexed as case files

## Integration with Void Platform

### Case Organizer Integration
- **Case Profiles**: Link documents to specific cases
- **Timeline Context**: Date-based document relevance
- **Research Modes**: Specialized search for legal research vs case analysis

### Chat System Integration
- **Context Gathering**: Automatic document context injection
- **Citation Support**: Direct document chunk references in responses
- **Follow-up Queries**: Conversational document exploration

### File Organizer Integration
- **Automatic Classification**: Policy manuals vs case documents
- **Metadata Enrichment**: Automatic tagging and categorization
- **Batch Processing**: Workspace-wide document indexing

---

*This documentation covers the RAG system implementation as of December 2025. For the latest changes, refer to the codebase and commit history.*

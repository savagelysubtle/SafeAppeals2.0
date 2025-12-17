# RAG System API Reference

## 📚 Table of Contents

- [Core Interfaces](#core-interfaces)
- [Document Management](#document-management)
- [Search Operations](#search-operations)
- [System Management](#system-management)
- [Data Types](#data-types)
- [Error Handling](#error-handling)
- [Examples](#examples)

## 🔌 Core Interfaces

### IRAGService

The main service interface for RAG operations, available in the browser process.

```typescript
interface IRAGService {
  // Document operations
  indexDocument(params: RAGIndexParams): Promise<IndexResult>;
  deleteDocument(uriOrDocId: URI | string): Promise<void>;
  isDocumentIndexed(uri: URI): Promise<boolean>;
  getDocumentsByType(isPolicyManual: boolean): Promise<DocumentRecord[]>;

  // Search operations
  search(params: RAGSearchParams): Promise<ContextPack>;

  // System operations
  getStats(): Promise<RAGStats>;
  initialize(): Promise<void>;
  clearAllEmbeddings(): Promise<ClearResult>;
  testDoclingExtraction(uri: URI): Promise<ExtractionTestResult>;
}
```

### IRAGMainService

The main process implementation with additional capabilities.

```typescript
interface IRAGMainService extends IRAGService {
  // Document creation (delegates to fileService)
  createEmptyDOCX(uri: URI): Promise<void>;
  createEmptyXLSX(uri: URI): Promise<void>;
  editDOCX(uri: URI, operations: DOCXOperations[]): Promise<EditResult>;
  editXLSX(uri: URI, operations: XLSXOperations[]): Promise<EditResult>;
}
```

## 📄 Document Management

### indexDocument

Indexes a document for search and retrieval.

```typescript
async indexDocument(params: RAGIndexParams): Promise<IndexResult>
```

**Parameters:**
- `params.uri: URI` - File path to the document
- `params.isPolicyManual: boolean` - Whether this is a policy/guideline document
- `params.workspaceId?: string` - Optional workspace association

**Returns:**
```typescript
interface IndexResult {
  success: boolean;
  message: string;
}
```

**Example:**
```typescript
const result = await ragService.indexDocument({
  uri: URI.file('/docs/policy-manual.pdf'),
  isPolicyManual: true,
  workspaceId: 'legal-workspace'
});

if (result.success) {
  console.log('Indexed successfully:', result.message);
}
```

**Supported File Types:**
- PDF (with Docling or PDF.js extraction)
- DOCX (Microsoft Word)
- XLSX (Excel spreadsheets)
- TXT, MD (plain text)
- RTF, ODT (with conversion)

**File Size Limits:**
- Maximum: 100MB per document
- Warning threshold: 50MB
- Recommended: <25MB for optimal performance

### deleteDocument

Removes a document and all its chunks from the system.

```typescript
async deleteDocument(uriOrDocId: URI | string): Promise<void>
```

**Parameters:**
- `uriOrDocId: URI | string` - Either a file URI or document ID

**Example:**
```typescript
// Delete by URI
await ragService.deleteDocument(URI.file('/docs/old-policy.pdf'));

// Delete by document ID
await ragService.deleteDocument('abc123_sha256_prefix');
```

### isDocumentIndexed

Checks if a document has been indexed.

```typescript
async isDocumentIndexed(uri: URI): Promise<boolean>
```

**Example:**
```typescript
const indexed = await ragService.isDocumentIndexed(
  URI.file('/docs/current-policy.pdf')
);

if (!indexed) {
  console.log('Document needs indexing');
}
```

### getDocumentsByType

Retrieves all documents of a specific type.

```typescript
async getDocumentsByType(isPolicyManual: boolean): Promise<DocumentRecord[]>
```

**Parameters:**
- `isPolicyManual: boolean` - true for policy documents, false for case documents

**Returns:** Array of `DocumentRecord` objects

**Example:**
```typescript
const policies = await ragService.getDocumentsByType(true);
const caseDocs = await ragService.getDocumentsByType(false);

console.log(`${policies.length} policy documents, ${caseDocs.length} case documents`);
```

## 🔍 Search Operations

### search

Performs a semantic search across indexed documents.

```typescript
async search(params: RAGSearchParams): Promise<ContextPack>
```

**Parameters:**
- `params.query: string` - Search query
- `params.scope: RAGStorageScope` - Search scope ('policy_manual', 'workspace_docs', or 'both')
- `params.limit: number` - Maximum results to return
- `params.workspaceId?: string` - Optional workspace filter

**Returns:**
```typescript
interface ContextPack {
  answerContext: string;        // Combined text of top chunks
  attributions: Attribution[];  // Source information for each chunk
  totalResults: number;         // Total chunks found
  responseTime: number;         // Search time in milliseconds
}

interface Attribution {
  docId: string;        // Document ID
  chunkId: string;      // Chunk ID
  filename: string;     // Source filename
  rangeHint: string;    // Chunk location hint
  score: number;        // Relevance score
}
```

**Example:**
```typescript
const results = await ragService.search({
  query: 'worker eligibility requirements',
  scope: 'policy_manual',
  limit: 5
});

console.log(`Found ${results.totalResults} results in ${results.responseTime}ms`);
results.attributions.forEach(attr => {
  console.log(`- ${attr.filename}: ${attr.rangeHint} (score: ${attr.score.toFixed(3)})`);
});
```

**Search Scope Options:**
- `'policy_manual'` - Search only policy/guideline documents
- `'workspace_docs'` - Search only case and workspace documents
- `'both'` - Search all documents

## ⚙️ System Management

### getStats

Returns comprehensive system statistics.

```typescript
async getStats(): Promise<RAGStats>
```

**Returns:**
```typescript
interface RAGStats {
  documents: DocumentTypeStats[];  // Per-filetype statistics
  chunks: ChunkStats;             // Chunk-level statistics
  totalDocuments: number;         // Total documents indexed
  totalSize: number;              // Total size in bytes
}

interface DocumentTypeStats {
  filetype: string;      // File extension (pdf, docx, etc.)
  typeCount: number;     // Number of documents of this type
  totalSize: number;     // Total size for this type
}

interface ChunkStats {
  totalChunks: number;   // Total chunks across all documents
  avgTokens: number;     // Average tokens per chunk
}
```

**Example:**
```typescript
const stats = await ragService.getStats();

console.log('System Statistics:');
console.log(`Total Documents: ${stats.totalDocuments}`);
console.log(`Total Chunks: ${stats.chunks.totalChunks}`);
console.log(`Average Tokens/Chunk: ${stats.chunks.avgTokens}`);
console.log(`Total Size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`);

stats.documents.forEach(docType => {
  console.log(`${docType.filetype}: ${docType.typeCount} files, ${(docType.totalSize / 1024 / 1024).toFixed(2)} MB`);
});
```

### initialize

Initializes the RAG system and loads models.

```typescript
async initialize(): Promise<void>
```

**Note:** Called automatically on service instantiation. Only call manually if reinitializing.

### clearAllEmbeddings

Clears all embeddings and document data. **Destructive operation.**

```typescript
async clearAllEmbeddings(): Promise<ClearResult>
```

**Returns:**
```typescript
interface ClearResult {
  success: boolean;
  message: string;
}
```

**Warning:** This operation:
- Deletes all vector embeddings
- Removes all document metadata
- Clears the search index
- Cannot be undone

**Example:**
```typescript
const result = await ragService.clearAllEmbeddings();
if (result.success) {
  console.log('System cleared:', result.message);
  // Re-index documents as needed
} else {
  console.error('Clear failed:', result.message);
}
```

### testDoclingExtraction

Compares standard vs Docling PDF extraction methods.

```typescript
async testDoclingExtraction(uri: URI): Promise<ExtractionTestResult>
```

**Returns:**
```typescript
interface ExtractionTestResult {
  standard: ExtractedContent;     // PDF.js extraction result
  docling: ExtractedContent;      // Docling extraction result
  doclingError?: any;            // Error if Docling failed
}
```

**Example:**
```typescript
const test = await ragService.testDoclingExtraction(
  URI.file('/docs/test-document.pdf')
);

console.log('Standard extraction:');
console.log('- Pages:', test.standard.metadata.pageCount);
console.log('- Words:', test.standard.metadata.wordCount);

if (test.docling) {
  console.log('Docling extraction:');
  console.log('- Pages:', test.docling.metadata.pageCount);
  console.log('- Words:', test.docling.metadata.wordCount);
} else if (test.doclingError) {
  console.error('Docling failed:', test.doclingError);
}
```

## 📊 Data Types

### DocumentRecord

Represents a document in the system.

```typescript
interface DocumentRecord {
  id: string;                    // Unique document ID (SHA256 hash)
  filename: string;              // Original filename
  filepath: string;              // Full file path
  filetype: string;              // File extension
  filesize: number;              // Size in bytes
  uploadedAt: string;            // ISO timestamp
  lastIndexed: string;           // ISO timestamp
  checksum?: string;             // SHA256 checksum
  metadata?: string;             // JSON metadata string
  isPolicyManual?: boolean;      // Document classification
  workspaceId?: string;          // Workspace association
}
```

### ChunkRecord

Represents a document chunk with metadata.

```typescript
interface ChunkRecord {
  chunkId: string;               // Unique chunk ID
  docId: string;                 // Parent document ID
  text: string;                  // Chunk text content
  chunkIndex: number;            // Sequential index
  tokens?: number;               // Token count estimate
  sectionId?: string;            // Hierarchical section ID
  parentSection?: string;        // Parent section ID
  sectionNumber?: string;        // Section number (e.g., "3.2.1")
  sectionTitle?: string;         // Section title
  breadcrumbPath?: string[];     // Navigation breadcrumbs
  chunkType?: 'child' | 'parent'; // Chunk hierarchy level
  parentChunkId?: string;        // Parent chunk reference
}
```

### ExtractedContent

Result of document content extraction.

```typescript
interface ExtractedContent {
  text: string;                  // Extracted text content
  metadata: {
    pageCount?: number;          // PDF page count
    wordCount?: number;          // Word count
    language?: string;           // Detected language
    author?: string;             // Document author
    title?: string;              // Document title
    createdDate?: Date;          // Creation date
    modifiedDate?: Date;         // Modification date
  };
}
```

## 🚨 Error Handling

### Common Error Patterns

```typescript
try {
  const result = await ragService.indexDocument(params);
  if (!result.success) {
    // Handle indexing failure
    console.error('Indexing failed:', result.message);
    return;
  }
} catch (error) {
  // Handle unexpected errors
  if (error.message.includes('File too large')) {
    console.error('Document exceeds size limit');
  } else if (error.message.includes('Unsupported file format')) {
    console.error('Unsupported file type');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### Error Types

| Error Pattern | Cause | Solution |
|---------------|-------|----------|
| `File too large` | Document > 100MB | Split document or use smaller files |
| `Unsupported file format` | Unknown file type | Convert to supported format (PDF, DOCX, XLSX, TXT) |
| `Failed to initialize embedding model` | Model download failed | Check internet, disk space, permissions |
| `Out of memory` | Large document processing | Reduce batch size, restart application |
| `Docling extraction failed` | Docling service issues | Check HF_TOKEN, restart Docling service |

## 💡 Examples

### Complete Indexing Workflow

```typescript
class DocumentIndexer {
  constructor(
    @IRAGService private readonly ragService: IRAGService,
    @ILogService private readonly logService: ILogService
  ) {}

  async indexWorkspaceDocuments(workspacePath: string) {
    const files = await this.scanDirectory(workspacePath);
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      try {
        const uri = URI.file(file.path);
        const result = await this.ragService.indexDocument({
          uri,
          isPolicyManual: this.isPolicyDocument(file.name),
          workspaceId: workspacePath
        });

        if (result.success) {
          successCount++;
          this.logService.info(`✓ Indexed ${file.name}`);
        } else {
          errorCount++;
          this.logService.warn(`✗ Failed ${file.name}: ${result.message}`);
        }
      } catch (error) {
        errorCount++;
        this.logService.error(`✗ Error indexing ${file.name}:`, error);
      }
    }

    this.logService.info(`Indexing complete: ${successCount} success, ${errorCount} errors`);
    return { successCount, errorCount };
  }

  private isPolicyDocument(filename: string): boolean {
    const policyPatterns = /policy|guideline|regulation|procedure|manual/i;
    return policyPatterns.test(filename);
  }
}
```

### Advanced Search with Filtering

```typescript
class LegalSearchService {
  constructor(@IRAGService private readonly ragService: IRAGService) {}

  async searchLegalQuery(query: string, options: {
    includePolicies: boolean;
    includeCases: boolean;
    maxResults: number;
    minScore: number;
  }) {
    // Determine search scope
    let scope: RAGStorageScope;
    if (options.includePolicies && options.includeCases) {
      scope = 'both';
    } else if (options.includePolicies) {
      scope = 'policy_manual';
    } else if (options.includeCases) {
      scope = 'workspace_docs';
    } else {
      throw new Error('Must include at least one document type');
    }

    // Enhance query with legal terminology
    const enhancedQuery = this.enhanceLegalQuery(query);

    // Perform search
    const results = await this.ragService.search({
      query: enhancedQuery,
      scope,
      limit: options.maxResults * 2 // Retrieve more for filtering
    });

    // Filter and sort results
    const filteredResults = {
      ...results,
      attributions: results.attributions
        .filter(attr => attr.score >= options.minScore)
        .sort((a, b) => b.score - a.score)
        .slice(0, options.maxResults)
    };

    // Rebuild context from filtered attributions
    filteredResults.answerContext = await this.rebuildContext(filteredResults.attributions);
    filteredResults.totalResults = filteredResults.attributions.length;

    return filteredResults;
  }

  private enhanceLegalQuery(query: string): string {
    // Expand common legal abbreviations and synonyms
    return query
      .replace(/\bpre-existing\b/gi, 'pre-existing preexisting prior existing previous')
      .replace(/\bworkers comp\b/gi, 'workers comp workers compensation work comp')
      .replace(/\bWC\b/g, 'workers compensation WC')
      .replace(/\bP&T\b/g, 'Permanent Total P&T')
      .replace(/\bTD\b/g, 'Temporary Disability TD');
  }

  private async rebuildContext(attributions: Attribution[]): Promise<string> {
    // Reconstruct context from attributions (simplified)
    // In practice, you'd fetch full chunk text from the database
    return attributions
      .map(attr => `[${attr.filename} - ${attr.rangeHint}]\n${attr.score}`)
      .join('\n\n');
  }
}
```

---

*API Reference last updated: December 2025*

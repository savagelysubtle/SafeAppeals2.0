<!-- e25b6c5e-070f-4618-ba3c-ebab30f73d0f ec674543-10be-4d78-9721-0da2ce33a3e2 -->
# ChromaDB RAG Pipeline Enhancement Plan

## Current State Analysis

### What's Already Implemented

- **Local embeddings** via Transformers.js (all-MiniLM-L6-v2, 384D)
- **Persistent ChromaDB** with SQLite storage (`ChromaPersistentAdapter`)
- **Document chunking** with heading/paragraph/sentence strategies
- **MMR (Maximal Marginal Relevance)** for diversity (lambda=0.7)
- **Query preprocessing** with terminology expansion
- **In-memory vector search** with cosine similarity
- **Batch processing** for memory efficiency (50 chunks per batch)
- **SQLite index service** with document metadata tracking

### Critical Gaps to Address

1. **No reranking**: Initial retrieval uses only semantic similarity without cross-encoder reranking
2. **No hybrid search**: Missing BM25 keyword retrieval to complement semantic search
3. **Non-agentic**: Static single-pass retrieval without query decomposition
4. **No FTS in SQLite**: Full-text search capability not utilized
5. **Limited context in chunks**: Chunks lack document-level context metadata

## Phase 1: Hybrid Search Foundation

### 1.1 Add FTS5 to SQLite Index

**File**: `src/vs/workbench/contrib/void/electron-main/ragIndexService.ts`

**Changes**:

- Add FTS5 virtual table for full-text search on chunks
- Implement `keywordSearch()` method using FTS5
- Create indexes for efficient keyword matching
```typescript
private async createTables(): Promise<void> {
  // ... existing tables ...
  
  // Add FTS5 virtual table for keyword search
  const createFTSTable = `
    CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
      chunk_id UNINDEXED,
      text,
      content='chunks',
      content_rowid='rowid'
    )
  `;
  
  // Trigger to sync FTS table with chunks table
  const createFTSTriggers = `
    CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
      INSERT INTO chunks_fts(rowid, chunk_id, text) 
      VALUES (new.rowid, new.chunk_id, new.text);
    END;
    
    CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
      DELETE FROM chunks_fts WHERE rowid = old.rowid;
    END;
  `;
}

async keywordSearch(query: string, n: number, scope: RAGStorageScope): Promise<Array<{ id: string; score: number }>> {
  // Use FTS5 BM25 ranking
  const sql = `
    SELECT 
      c.chunk_id as id,
      bm25(chunks_fts) as score
    FROM chunks_fts
    JOIN chunks c ON chunks_fts.chunk_id = c.chunk_id
    JOIN documents d ON c.doc_id = d.id
    WHERE chunks_fts MATCH ? ${this.getScopeFilter(scope)}
    ORDER BY bm25(chunks_fts)
    LIMIT ?
  `;
  // Implementation...
}
```


### 1.2 Create Hybrid Retriever

**File**: `src/vs/workbench/contrib/void/common/ragHybridRetriever.ts` (NEW)

**Purpose**: Combine BM25 keyword search with vector semantic search using Reciprocal Rank Fusion

```typescript
export interface HybridSearchResult {
  chunkId: string;
  bm25Score: number;
  semanticScore: number;
  fusedScore: number;
  metadata: Record<string, any>;
}

export class HybridRetriever {
  constructor(
    private vectorAdapter: VectorAdapter,
    private indexService: RAGIndexService,
    private logService: ILogService
  ) {}

  async search(
    query: string, 
    k: number, 
    scope: RAGStorageScope
  ): Promise<HybridSearchResult[]> {
    // Retrieve 3x desired results from each method
    const retrievalK = k * 3;
    
    // Run searches in parallel
    const [bm25Results, vectorResults] = await Promise.all([
      this.indexService.keywordSearch(query, retrievalK, scope),
      this.vectorAdapter.query(query, retrievalK, scope)
    ]);
    
    // Apply Reciprocal Rank Fusion (RRF)
    return this.fuseResults(bm25Results, vectorResults, k);
  }
  
  private fuseResults(
    bm25Results: Array<{id: string; score: number}>,
    vectorResults: Array<{id: string; score: number}>,
    k: number
  ): HybridSearchResult[] {
    const RRF_K = 60; // Standard RRF constant
    const fusedScores = new Map<string, HybridSearchResult>();
    
    // Score from BM25
    bm25Results.forEach((result, rank) => {
      const rrfScore = 1 / (RRF_K + rank + 1);
      fusedScores.set(result.id, {
        chunkId: result.id,
        bm25Score: rrfScore,
        semanticScore: 0,
        fusedScore: rrfScore,
        metadata: {}
      });
    });
    
    // Add/update with vector scores
    vectorResults.forEach((result, rank) => {
      const rrfScore = 1 / (RRF_K + rank + 1);
      const existing = fusedScores.get(result.id);
      
      if (existing) {
        existing.semanticScore = rrfScore;
        existing.fusedScore = existing.bm25Score + rrfScore;
        existing.metadata = result.metadata;
      } else {
        fusedScores.set(result.id, {
          chunkId: result.id,
          bm25Score: 0,
          semanticScore: rrfScore,
          fusedScore: rrfScore,
          metadata: result.metadata
        });
      }
    });
    
    // Sort by fused score and return top k
    return Array.from(fusedScores.values())
      .sort((a, b) => b.fusedScore - a.fusedScore)
      .slice(0, k);
  }
}
```

## Phase 2: Cross-Encoder Reranking

### 2.1 Create Local Reranker Service

**File**: `src/vs/workbench/contrib/void/common/ragReranker.ts` (NEW)

**Purpose**: Rerank results using cross-encoder model via Transformers.js

**Research Finding**: ms-marco-MiniLM-L-6-v2 is optimal for medical/legal English documents:

- Speed: ~1800 docs/sec on V100 GPU
- Accuracy: NDCG@10: 74.30, MRR@10: 39.01
- Size: Small (6 layers, ~90MB), fast inference
- Best for production environments where latency matters
```typescript
export interface RerankedResult {
  chunkId: string;
  relevanceScore: number;
  originalScore: number;
  text: string;
}

export class LocalCrossEncoderReranker {
  private model: any;
  private initialized = false;
  private readonly MODEL_NAME = 'Xenova/ms-marco-MiniLM-L-6-v2';
  private readonly BATCH_SIZE = 10; // Process 10 pairs at a time for memory efficiency
  
  constructor(private logService: ILogService) {}
  
  async initialize(cachePath: string): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.logService.info('Initializing cross-encoder reranker (ms-marco-MiniLM-L-6-v2)...');
      this.logService.info('First-time initialization may take 1-2 minutes to download ~90 MB model');
      
      const transformers = await import('@xenova/transformers');
      transformers.env.cacheDir = cachePath;
      
      // Use text-classification pipeline for cross-encoding
      this.model = await transformers.pipeline(
        'text-classification',
        this.MODEL_NAME
      );
      
      this.initialized = true;
      this.logService.info('Cross-encoder reranker initialized successfully');
    } catch (error) {
      this.logService.error('Failed to initialize reranker:', error);
      throw error;
    }
  }
  
  async rerank(
    query: string,
    documents: Array<{id: string; text: string; score: number}>,
    topN: number
  ): Promise<RerankedResult[]> {
    if (!this.initialized) {
      throw new Error('Reranker not initialized');
    }
    
    this.logService.info(`Reranking ${documents.length} documents to top ${topN}`);
    
    // Create query-document pairs
    const pairs = documents.map(doc => `${query} [SEP] ${doc.text}`);
    
    // Score each pair (process in batches for memory)
    const BATCH_SIZE = 10;
    const scores: number[] = [];
    
    for (let i = 0; i < pairs.length; i += BATCH_SIZE) {
      const batch = pairs.slice(i, i + BATCH_SIZE);
      const batchScores = await this.model(batch);
      
      // Extract relevance scores
      for (const result of batchScores) {
        // Cross-encoder outputs relevance probability
        scores.push(result.score || 0);
      }
    }
    
    // Combine with original results and sort by relevance
    const reranked = documents.map((doc, idx) => ({
      chunkId: doc.id,
      relevanceScore: scores[idx],
      originalScore: doc.score,
      text: doc.text
    }));
    
    return reranked
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, topN);
  }
}
```


### 2.2 Integrate Reranker into ChromaPersistentAdapter

**File**: `src/vs/workbench/contrib/void/common/ragVectorAdapter.ts`

**Changes**:

- Add reranker instance to `ChromaPersistentAdapter`
- Initialize reranker alongside embeddings
- Optionally apply reranking in `query()` method
```typescript
export class ChromaPersistentAdapter implements VectorAdapter {
  private embeddingService: LocalEmbeddingService;
  private reranker: LocalCrossEncoderReranker;
  private useReranking = true; // Configurable
  
  constructor(
    private config: PersistentVectorAdapterConfig & { useReranking?: boolean },
    private logService: ILogService
  ) {
    this.embeddingService = new LocalEmbeddingService(logService);
    this.reranker = new LocalCrossEncoderReranker(logService);
    this.useReranking = config.useReranking ?? true;
  }
  
  async initialize(): Promise<void> {
    // ... existing initialization ...
    
    // Initialize reranker
    if (this.useReranking) {
      const modelCachePath = this.config.persistPath + '/models';
      await this.reranker.initialize(modelCachePath);
    }
  }
}
```


## Phase 3: Agentic Query Processing

### 3.1 Query Decomposition Service

**File**: `src/vs/workbench/contrib/void/common/ragQueryProcessor.ts` (NEW)

**Purpose**: Decompose complex queries and route them appropriately

```typescript
export interface SubQuery {
  id: string;
  query: string;
  scope: RAGStorageScope;
  priority: number;
}

export class QueryProcessor {
  constructor(private logService: ILogService) {}
  
  /**
   * Analyze query complexity and decompose if needed
   */
  async processQuery(query: string): Promise<{
    isComplex: boolean;
    subQueries: SubQuery[];
    suggestedScope: RAGStorageScope;
  }> {
    // Detect multi-part questions
    const isComplex = this.isComplexQuery(query);
    
    if (isComplex) {
      return {
        isComplex: true,
        subQueries: this.decompose(query),
        suggestedScope: this.routeQuery(query)
      };
    }
    
    return {
      isComplex: false,
      subQueries: [{
        id: 'main',
        query,
        scope: this.routeQuery(query),
        priority: 1
      }],
      suggestedScope: this.routeQuery(query)
    };
  }
  
  private isComplexQuery(query: string): boolean {
    // Detect conjunctions, multiple questions
    const complexityIndicators = [
      /\band\b/i,
      /\bor\b/i,
      /\?.*\?/, // Multiple question marks
      /first.*then/i,
      /what.*and.*how/i,
      /\d+\./  // Numbered lists
    ];
    
    return complexityIndicators.some(pattern => pattern.test(query));
  }
  
  private decompose(query: string): SubQuery[] {
    // Simple rule-based decomposition
    const parts = query
      .split(/\band\b|\bor\b/i)
      .map(part => part.trim())
      .filter(part => part.length > 10);
    
    return parts.map((part, idx) => ({
      id: `sub_${idx}`,
      query: part,
      scope: this.routeQuery(part),
      priority: idx + 1
    }));
  }
  
  private routeQuery(query: string): RAGStorageScope {
    // Route based on keywords
    const policyKeywords = ['policy', 'rule', 'regulation', 'guideline', 'procedure'];
    const caseKeywords = ['client', 'claimant', 'case', 'appeal', 'injury'];
    
    const lowerQuery = query.toLowerCase();
    const hasPolicyKeyword = policyKeywords.some(kw => lowerQuery.includes(kw));
    const hasCaseKeyword = caseKeywords.some(kw => lowerQuery.includes(kw));
    
    if (hasPolicyKeyword && !hasCaseKeyword) return 'policy_manual';
    if (hasCaseKeyword && !hasPolicyKeyword) return 'workspace_docs';
    return 'both';
  }
}
```

## Phase 4: Enhanced Chunking with Context

### 4.1 Add Document Context to Chunks

**File**: `src/vs/workbench/contrib/void/electron-main/ragIndexService.ts`

**Changes**:

- Extract document title/metadata
- Prepend context to chunks during indexing
- Store raw chunks separately for reranking
```typescript
private chunkText(
  text: string, 
  docId: string, 
  metadata: ExtractedContent['metadata']
): ChunkRecord[] {
  // Extract document title from metadata or content
  const documentTitle = this.extractTitle(text, metadata);
  const documentType = metadata.filetype || 'unknown';
  
  // Generate base chunks using existing logic
  const baseChunks = this.chunkByHeadings(text, docId, 1200);
  
  // Add contextual prefix to each chunk
  return baseChunks.map(chunk => ({
    ...chunk,
    text: `Document: ${documentTitle} (${documentType})\n\n${chunk.text}`,
    rawText: chunk.text // Store original for reranking
  }));
}

private extractTitle(
  text: string, 
  metadata: ExtractedContent['metadata']
): string {
  // Try metadata first
  if (metadata.title) return metadata.title;
  
  // Try to extract from first heading
  const firstHeading = text.match(/^#\s+(.+)$/m);
  if (firstHeading) return firstHeading[1];
  
  // Try first line
  const firstLine = text.split('\n')[0].trim();
  if (firstLine.length > 0 && firstLine.length < 100) {
    return firstLine;
  }
  
  return 'Untitled Document';
}
```


## Phase 5: Two-Stage Retrieval Integration

### 5.1 Update RAGMainService Search Method

**File**: `src/vs/workbench/contrib/void/electron-main/ragMainService.ts`

**Changes**:

- Integrate hybrid retriever
- Add reranking stage
- Support query decomposition
```typescript
async search(params: RAGSearchParams): Promise<ContextPack> {
  if (!this.initialized) {
    await this.initialize();
  }

  try {
    this.logService.info(`RAG search: "${params.query}"`);
    
    // Stage 0: Query processing
    const processed = await this.queryProcessor.processQuery(params.query);
    const effectiveScope = params.scope === 'both' 
      ? processed.suggestedScope 
      : params.scope;
    
    // Stage 1: Hybrid retrieval (high recall)
    const initialK = params.limit * 4; // Get 4x desired results
    const hybridResults = await this.hybridRetriever.search(
      params.query,
      initialK,
      effectiveScope
    );
    
    this.logService.info(`Hybrid search returned ${hybridResults.length} candidates`);
    
    // Get full chunk text from SQLite
    const chunkIds = hybridResults.map(r => r.chunkId);
    const searchResults = await this.indexService.searchChunks(
      chunkIds,
      params.query
    );
    
    // Stage 2: Reranking (high precision)
    const documentsForReranking = searchResults.map(result => ({
      id: result.chunkId,
      text: result.snippet,
      score: result.score
    }));
    
    const reranked = await this.reranker.rerank(
      params.query,
      documentsForReranking,
      params.limit
    );
    
    this.logService.info(`Reranked to top ${reranked.length} results`);
    
    // Assemble context pack
    const answerContext = reranked
      .map(r => {
        const original = searchResults.find(s => s.chunkId === r.chunkId);
        return original?.snippet || r.text;
      })
      .join('\n\n');
    
    const attributions = reranked.map(r => {
      const original = searchResults.find(s => s.chunkId === r.chunkId);
      return {
        docId: original?.docId || '',
        chunkId: r.chunkId,
        filename: original?.source.filename || '',
        rangeHint: `Chunk ${(original?.source.chunkIndex || 0) + 1}`,
        score: r.relevanceScore
      };
    });
    
    return {
      answerContext,
      attributions,
      totalResults: reranked.length,
      responseTime: Date.now()
    };
  } catch (error) {
    this.logService.error('RAG search failed:', error);
    return {
      answerContext: '',
      attributions: [],
      totalResults: 0,
      responseTime: 0
    };
  }
}
```


## Phase 6: Configuration and Settings

### 6.1 Add RAG Configuration Options

**File**: `src/vs/workbench/contrib/void/common/voidSettingsTypes.ts`

**Changes**:

- Add settings for hybrid search, reranking, and agentic features
```typescript
export type GlobalSettings = {
  // ... existing settings ...
  
  // RAG Hybrid Search
  ragUseHybridSearch: boolean;           // Default: true
  ragHybridAlpha: number;                // BM25 weight 0-1, default: 0.3
  
  // RAG Reranking
  ragUseReranking: boolean;              // Default: true
  ragRerankTopK: number;                 // Default: 5
  ragRerankModel: 'ms-marco-MiniLM' | 'bge-reranker-base'; // Default: ms-marco
  
  // RAG Agentic Features
  ragEnableQueryDecomposition: boolean;  // Default: true
  ragEnableQueryRouting: boolean;        // Default: true
  
  // RAG Chunking
  ragUseContextualChunking: boolean;     // Default: true
};

export const defaultGlobalSettings: GlobalSettings = {
  // ... existing defaults ...
  
  ragUseHybridSearch: true,
  ragHybridAlpha: 0.3,
  ragUseReranking: true,
  ragRerankTopK: 5,
  ragRerankModel: 'ms-marco-MiniLM',
  ragEnableQueryDecomposition: true,
  ragEnableQueryRouting: true,
  ragUseContextualChunking: true,
};
```


## Implementation Sequence

### Week 1: Hybrid Search Foundation

- Add FTS5 to SQLite (`ragIndexService.ts`)
- Implement keyword search method
- Create `HybridRetriever` class
- Test hybrid search accuracy vs. pure vector

### Week 2: Reranking Integration

- Create `LocalCrossEncoderReranker` class
- Integrate reranker into vector adapter
- Update `RAGMainService.search()` with two-stage retrieval
- Benchmark accuracy improvements

### Week 3: Agentic Features

- Create `QueryProcessor` class
- Implement query decomposition
- Add query routing logic
- Test complex multi-part queries

### Week 4: Enhanced Chunking & Polish

- Add document context to chunks
- Update chunking strategies
- Add configuration settings
- Create test suite for all features

## Success Metrics

- **Accuracy**: Top-1 accuracy improves from ~60% to >85%
- **Latency**: p95 latency remains <500ms
- **Recall**: Recall@5 improves from ~75% to >95%
- **Precision**: Precision@5 improves from ~65% to >95%
- **Zero Breaking Changes**: All existing APIs remain compatible
- **Local-First**: No mandatory API costs, all processing offline

## Key Files to Modify

1. `ragIndexService.ts` - Add FTS5 and keyword search
2. `ragMainService.ts` - Update search() with two-stage retrieval
3. `ragVectorAdapter.ts` - Integrate reranker
4. `voidSettingsTypes.ts` - Add configuration options

## New Files to Create

1. `ragHybridRetriever.ts` - Hybrid search with RRF fusion
2. `ragReranker.ts` - Cross-encoder reranking service
3. `ragQueryProcessor.ts` - Query decomposition and routing

## Dependencies

No new npm dependencies needed - all features use existing packages:

- `@vscode/sqlite3` (already installed) for FTS5
- `@xenova/transformers` (already installed) for cross-encoder
- All other logic is pure TypeScript

### To-dos

- [ ] Add FTS5 virtual table and keyword search to ragIndexService.ts
- [ ] Create ragHybridRetriever.ts with RRF fusion logic
- [ ] Create ragReranker.ts with local cross-encoder using Transformers.js
- [ ] Integrate reranker into ChromaPersistentAdapter and initialize with embeddings
- [ ] Update RAGMainService.search() to use hybrid retrieval + reranking
- [ ] Create ragQueryProcessor.ts for query decomposition and routing
- [ ] Enhance chunking in ragIndexService.ts with document metadata context
- [ ] Add RAG configuration settings to voidSettingsTypes.ts
- [ ] Create test suite to validate accuracy improvements and benchmark performance
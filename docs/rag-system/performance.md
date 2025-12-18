# RAG System Performance Guide

## 📊 Performance Overview

The RAG system is optimized for legal and medical document processing with performance characteristics designed for both interactive search and batch document indexing. This guide covers performance monitoring, optimization strategies, and troubleshooting.

## 🎯 Performance Metrics

### Key Performance Indicators (KPIs)

| Metric | Target | Current | Unit |
|--------|--------|---------|------|
| Document Indexing Time | <30s | ~15-45s | seconds |
| Search Response Time | <500ms | ~200-800ms | milliseconds |
| Memory Usage (Indexing) | <1GB | ~500-800MB | heap size |
| Memory Usage (Search) | <200MB | ~50-150MB | heap size |
| Embedding Throughput | >100 | ~150-200 | texts/second |
| Storage Efficiency | >80% | ~85% | compression ratio |

### Benchmark Results

**Test Environment:**
- CPU: Intel i7-9750H (6 cores, 12 threads)
- RAM: 16GB DDR4
- Storage: NVMe SSD
- Documents: 100 legal PDFs (avg 25MB each)

**Performance Benchmarks:**

| Operation | Min | Avg | Max | P95 | P99 |
|-----------|-----|-----|-----|-----|-----|
| Document Indexing | 8.2s | 22.4s | 67.1s | 45.2s | 58.9s |
| Single Query Search | 89ms | 234ms | 1.2s | 678ms | 892ms |
| Batch Search (10) | 345ms | 892ms | 3.4s | 2.1s | 2.8s |
| Embedding Generation | 45ms | 67ms | 234ms | 156ms | 189ms |
| Memory Peak (Indexing) | 423MB | 678MB | 1.2GB | 945MB | 1.1GB |

## 🔍 Performance Monitoring

### Built-in Monitoring

#### Memory Monitoring
```typescript
// Automatic memory tracking during operations
const memStart = process.memoryUsage();
this.logService.info(`Memory at start: ${(memStart.heapUsed / 1024 / 1024).toFixed(2)} MB`);

// During processing
const memAfterBatch = process.memoryUsage();
this.logService.info(`Memory after batch: ${(memAfterBatch.heapUsed / 1024 / 1024).toFixed(2)} MB`);

// Memory warnings
if (memAfterBatch.heapUsed > 500 * 1024 * 1024) { // 500MB
  this.logService.warn('High memory usage detected');
}
```

#### Performance Logging
```typescript
// Operation timing
const startTime = Date.now();
// ... operation ...
const duration = Date.now() - startTime;
this.logService.info(`Operation completed in ${duration}ms`);

// Throughput calculation
const throughput = processedItems / (duration / 1000);
this.logService.info(`Throughput: ${throughput.toFixed(2)} items/second`);
```

#### Search Performance Tracking
```typescript
interface SearchPerformanceMetrics {
  totalTime: number;
  hybridRetrievalTime: number;
  rerankingTime: number;
  contextAssemblyTime: number;
  resultsCount: number;
  scope: RAGStorageScope;
}

const metrics: SearchPerformanceMetrics = {
  totalTime: Date.now() - startTime,
  hybridRetrievalTime: hybridEnd - startTime,
  rerankingTime: rerankEnd - hybridEnd,
  contextAssemblyTime: Date.now() - rerankEnd,
  resultsCount: results.totalResults,
  scope: params.scope
};
```

### External Monitoring

#### System Resource Monitoring
```bash
# Monitor system resources during RAG operations
watch -n 1 'ps aux | grep -E "(void|node)" | head -5'

# Memory and CPU usage
top -p $(pgrep -f "void")

# Disk I/O monitoring
iostat -x 1

# Network monitoring (for Docling)
netstat -tlnp | grep 5001
```

#### Database Performance
```sql
-- Query performance analysis
EXPLAIN QUERY PLAN
SELECT * FROM chunks WHERE doc_id = ?;

-- Index usage statistics
SELECT name, sql FROM sqlite_master WHERE type='index';

-- Table statistics
SELECT
  name,
  type,
  sql
FROM sqlite_master
WHERE type IN ('table', 'index');
```

## ⚡ Performance Optimization

### 1. Indexing Optimizations

#### Batch Processing
```typescript
// Optimal batch sizes for different operations
const BATCH_SIZES = {
  embedding: 25,      // Texts per embedding batch
  indexing: 50,       // Chunks per database batch
  search: 16,         // Queries per search batch
  reranking: 8        // Candidates per reranking batch
};

// Memory-aware batching
function calculateOptimalBatchSize(memoryPressure: number): number {
  const baseBatchSize = 25;
  const memoryFactor = Math.max(0.1, 1 - (memoryPressure / 100));
  return Math.floor(baseBatchSize * memoryFactor);
}
```

#### File Size Optimization
```typescript
// File size validation and warnings
function validateFileSize(filepath: string): {
  valid: boolean;
  warning: boolean;
  recommendation?: string;
} {
  const stats = fs.statSync(filepath);
  const sizeMB = stats.size / (1024 * 1024);

  if (sizeMB > 100) {
    return {
      valid: false,
      warning: false,
      recommendation: 'Split document into smaller files (<50MB each)'
    };
  }

  if (sizeMB > 50) {
    return {
      valid: true,
      warning: true,
      recommendation: 'Large file may take several minutes to process'
    };
  }

  return { valid: true, warning: false };
}
```

#### Memory Management
```typescript
// Explicit garbage collection hints
function manageMemoryDuringIndexing(): void {
  const memUsage = process.memoryUsage();

  // Force GC when memory usage is high
  if (memUsage.heapUsed > 400 * 1024 * 1024) { // 400MB
    if (global.gc) {
      global.gc();
      console.log('GC triggered due to high memory usage');
    }
  }

  // Monitor memory growth
  if (memUsage.heapUsed > 600 * 1024 * 1024) { // 600MB
    console.warn('Memory usage approaching critical levels');
  }
}
```

### 2. Search Optimizations

#### Query Optimization
```typescript
// Preprocess queries for better performance
function optimizeQuery(query: string): string {
  // Remove unnecessary whitespace
  let optimized = query.trim();

  // Limit query length
  if (optimized.length > 500) {
    optimized = optimized.substring(0, 500);
    console.warn('Query truncated to 500 characters');
  }

  // Simple stop word removal for very common words
  const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at'];
  optimized = optimized.split(' ')
    .filter(word => !stopWords.includes(word.toLowerCase()))
    .join(' ');

  return optimized;
}
```

#### Caching Strategies
```typescript
class QueryResultCache {
  private cache = new Map<string, {
    result: ContextPack;
    timestamp: number;
    ttl: number;
  }>();

  private readonly DEFAULT_TTL = 3600000; // 1 hour

  get(cacheKey: string): ContextPack | null {
    const cached = this.cache.get(cacheKey);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(cacheKey);
      return null;
    }

    return cached.result;
  }

  set(cacheKey: string, result: ContextPack, ttl = this.DEFAULT_TTL): void {
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl
    });

    // Evict old entries if cache is too large
    if (this.cache.size > 1000) {
      this.evictOldEntries();
    }
  }

  private evictOldEntries(): void {
    const entries = Array.from(this.cache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    // Remove oldest 10% of entries
    const toRemove = Math.floor(entries.length * 0.1);
    for (let i = 0; i < toRemove; i++) {
      this.cache.delete(entries[i][0]);
    }
  }
}
```

#### Parallel Processing
```typescript
// Parallel search execution
async function parallelHybridSearch(
  query: string,
  scope: RAGStorageScope,
  limit: number
): Promise<HybridSearchResult[]> {
  // Run BM25 and vector search in parallel
  const [bm25Results, vectorResults] = await Promise.all([
    this.indexService.keywordSearch(query, limit * 2, scope),
    this.vectorAdapter.query(query, limit * 2, scope)
  ]);

  // Combine results with RRF
  return this.fuseResults(bm25Results, vectorResults, limit);
}
```

### 3. Storage Optimizations

#### Database Optimization
```sql
-- Optimize SQLite for performance
PRAGMA journal_mode = WAL;        -- Write-Ahead Logging
PRAGMA synchronous = NORMAL;      -- Balanced safety/performance
PRAGMA cache_size = -64000;       -- 64MB cache
PRAGMA temp_store = memory;       -- Temp tables in memory
PRAGMA mmap_size = 268435456;     -- 256MB memory mapping

-- Index optimization
CREATE INDEX idx_chunks_doc_type ON chunks(doc_id, chunk_type);
CREATE INDEX idx_chunks_section_breadcrumb ON chunks(section_id, breadcrumb_path);

-- FTS5 optimization
INSERT INTO chunks_fts(chunks_fts) VALUES('optimize');
```

#### Vector Storage Optimization
```typescript
// Efficient vector storage
class OptimizedVectorStorage {
  // Use Float32Array for memory efficiency
  private storeEmbeddings(embeddings: number[][]): void {
    for (const embedding of embeddings) {
      const float32Array = new Float32Array(embedding);
      // Store as compressed binary data
      this.compressAndStore(float32Array);
    }
  }

  // Batch database operations
  private async batchInsertEmbeddings(
    embeddings: Array<{ id: string; vector: number[]; metadata: any }>
  ): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO embeddings (id, vector, metadata)
      VALUES (?, ?, ?)
    `);

    for (const embedding of embeddings) {
      const vectorJson = JSON.stringify(embedding.vector);
      const metadataJson = JSON.stringify(embedding.metadata);

      stmt.run(embedding.id, vectorJson, metadataJson);
    }

    stmt.finalize();
  }
}
```

## 🔧 Performance Troubleshooting

### Common Performance Issues

#### Slow Document Indexing

**Symptoms:**
- Indexing takes >60 seconds per document
- High memory usage (>1GB)
- Process appears stuck

**Diagnosis:**
```typescript
// Check file size
const stats = fs.statSync(filepath);
console.log(`File size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

// Check document type
const fileType = this.getFileType(uri);
console.log(`File type: ${fileType}`);

// Monitor memory during processing
const memMonitor = setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`Memory: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);
}, 5000);
```

**Solutions:**
1. **Large Files**: Split documents >50MB into smaller files
2. **Memory Issues**: Increase Node.js memory limit: `node --max-old-space-size=2048`
3. **Slow Extraction**: Disable Docling for problematic PDFs
4. **Batch Size**: Reduce embedding batch size from 25 to 10

#### Slow Search Responses

**Symptoms:**
- Search takes >1 second
- High CPU usage during search
- Memory spikes during queries

**Diagnosis:**
```typescript
// Profile search performance
const searchProfile = {
  startTime: Date.now(),
  queryProcessing: 0,
  bm25Search: 0,
  vectorSearch: 0,
  reranking: 0,
  totalTime: 0
};

// Add timing checkpoints
searchProfile.bm25Search = Date.now() - searchProfile.startTime;
searchProfile.vectorSearch = Date.now() - searchProfile.bm25Search;
// ... etc
```

**Solutions:**
1. **Disable Reranking**: Set `useReranking: false` for faster searches
2. **Reduce Limits**: Lower search limits from 10 to 5
3. **Cache Results**: Implement query result caching
4. **Database Tuning**: Run `PRAGMA optimize;` on SQLite

#### High Memory Usage

**Symptoms:**
- Memory usage >1GB during indexing
- Out of memory errors
- System slowdown

**Diagnosis:**
```typescript
// Memory profiling
const memUsage = process.memoryUsage();
console.log('Memory Profile:');
console.log(`  RSS: ${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Heap Used: ${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`);
console.log(`  Heap Total: ${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`);
console.log(`  External: ${(memUsage.external / 1024 / 1024).toFixed(2)} MB`);

// Check for memory leaks
if (global.gc) {
  const beforeGC = memUsage.heapUsed;
  global.gc();
  const afterGC = process.memoryUsage().heapUsed;
  console.log(`GC freed: ${((beforeGC - afterGC) / 1024 / 1024).toFixed(2)} MB`);
}
```

**Solutions:**
1. **Batch Size**: Reduce from 25 to 10-15
2. **File Limits**: Set maximum file size to 25MB
3. **GC Tuning**: Enable `--optimize-for-size` flag
4. **Memory Limits**: Set `--max-old-space-size=1024`

### Model Performance Issues

#### Embedding Model Problems

**Symptoms:**
- First-time startup takes >5 minutes
- Embedding generation is slow
- Model download failures

**Solutions:**
1. **Pre-download Models**: Run indexing once to cache models
2. **Model Path**: Ensure write access to model cache directory
3. **Network**: Stable internet for initial model download
4. **Disk Space**: Ensure 25MB+ free space for models

#### Cross-Encoder Issues

**Symptoms:**
- Reranking is slow or fails
- Search quality degradation

**Solutions:**
1. **Disable Reranking**: Set `useReranking: false` temporarily
2. **Batch Size**: Reduce reranking batch size
3. **Model Cache**: Clear and redownload reranking model

## 📈 Performance Tuning

### Production Configuration

```typescript
// High-performance production settings
const productionConfig = {
  // Optimize for speed
  embeddingBatchSize: 50,        // Larger batches
  useReranking: false,           // Disable reranking for speed
  searchLimit: 5,               // Fewer results

  // Memory optimization
  maxFileSizeMB: 25,            // Smaller files
  enableGCHints: true,          // Aggressive GC

  // Database optimization
  sqliteCacheSize: -131072,     // 128MB cache
  enableWAL: true,              // WAL mode

  // Monitoring
  enablePerformanceLogging: false, // Reduce log volume
  memoryWarningThresholdMB: 750   // Higher threshold
};
```

### Development Configuration

```typescript
// Development-optimized settings
const developmentConfig = {
  // Debug-friendly
  embeddingBatchSize: 10,        // Smaller batches for debugging
  useReranking: true,            // Full features for testing
  searchLimit: 10,               // More results for evaluation

  // Verbose monitoring
  enablePerformanceLogging: true,
  enableMemoryLogging: true,
  logLevel: 'DEBUG',

  // Relaxed limits
  maxFileSizeMB: 50,            // Allow larger test files
  memoryWarningThresholdMB: 400  // Lower threshold for warnings
};
```

## 🔍 Performance Analysis Tools

### Built-in Performance Dashboard

```typescript
class PerformanceDashboard {
  private metrics: Map<string, number[]> = new Map();

  recordMetric(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, []);
    }

    const operationMetrics = this.metrics.get(operation)!;
    operationMetrics.push(duration);

    // Keep only last 1000 measurements
    if (operationMetrics.length > 1000) {
      operationMetrics.shift();
    }
  }

  getStats(operation: string): {
    count: number;
    avg: number;
    min: number;
    max: number;
    p95: number;
    p99: number;
  } {
    const metrics = this.metrics.get(operation) || [];
    if (metrics.length === 0) {
      return { count: 0, avg: 0, min: 0, max: 0, p95: 0, p99: 0 };
    }

    const sorted = metrics.sort((a, b) => a - b);
    return {
      count: metrics.length,
      avg: metrics.reduce((a, b) => a + b) / metrics.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }

  logPerformanceReport(): void {
    console.log('=== Performance Report ===');
    for (const [operation, metrics] of this.metrics.entries()) {
      const stats = this.getStats(operation);
      console.log(`${operation}:`);
      console.log(`  Count: ${stats.count}`);
      console.log(`  Avg: ${stats.avg.toFixed(2)}ms`);
      console.log(`  P95: ${stats.p95.toFixed(2)}ms`);
      console.log(`  P99: ${stats.p99.toFixed(2)}ms`);
    }
  }
}
```

### Automated Performance Testing

```typescript
class PerformanceTestRunner {
  async runIndexingBenchmark(
    testFiles: string[],
    options: { iterations: number; parallel: boolean }
  ): Promise<PerformanceReport> {
    const results: number[] = [];

    for (let i = 0; i < options.iterations; i++) {
      const startTime = Date.now();

      if (options.parallel) {
        await Promise.all(testFiles.map(file =>
          this.ragService.indexDocument({
            uri: URI.file(file),
            isPolicyManual: false
          })
        ));
      } else {
        for (const file of testFiles) {
          await this.ragService.indexDocument({
            uri: URI.file(file),
            isPolicyManual: false
          });
        }
      }

      results.push(Date.now() - startTime);
    }

    return this.calculateStats(results);
  }

  async runSearchBenchmark(
    queries: string[],
    options: { iterations: number; scope: RAGStorageScope }
  ): Promise<PerformanceReport> {
    const results: number[] = [];

    for (let i = 0; i < options.iterations; i++) {
      for (const query of queries) {
        const startTime = Date.now();
        await this.ragService.search({
          query,
          scope: options.scope,
          limit: 5
        });
        results.push(Date.now() - startTime);
      }
    }

    return this.calculateStats(results);
  }

  private calculateStats(durations: number[]): PerformanceReport {
    const sorted = durations.sort((a, b) => a - b);
    return {
      count: durations.length,
      average: durations.reduce((a, b) => a + b) / durations.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)]
    };
  }
}
```

---

*Performance guide last updated: December 2025*



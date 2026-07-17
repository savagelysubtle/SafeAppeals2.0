# RAG System Troubleshooting Guide

## 🚨 Quick Issue Resolution

### System Won't Start
**Error:** `Cannot find module '@vscode/sqlite3'`

**Solution:**
```bash
# Rebuild native dependencies
npm rebuild @vscode/sqlite3
# or
bun install --rebuild
```

### Documents Not Indexing
**Error:** `Document indexing failed`

**Quick Check:**
```typescript
// Test basic functionality
const stats = await ragService.getStats();
console.log('Documents in system:', stats.totalDocuments);

// Check if document is already indexed
const isIndexed = await ragService.isDocumentIndexed(uri);
console.log('Document indexed:', isIndexed);
```

### Searches Return No Results
**Quick Diagnosis:**
```typescript
// Check system status
const stats = await ragService.getStats();
console.log('Total chunks:', stats.chunks.totalChunks);

// Test with simple query
const results = await ragService.search({
  query: 'test',
  scope: 'both',
  limit: 5
});
console.log('Search results:', results.totalResults);
```

## 🔍 Detailed Troubleshooting

### 1. Installation and Setup Issues

#### Node Modules Not Found
**Symptoms:**
- `Cannot find module` errors
- Import failures for `@vscode/sqlite3`, `@xenova/transformers`

**Solutions:**
```bash
# Clean install
rm -rf node_modules package-lock.json
bun install

# Rebuild native modules
cd node_modules/@vscode/sqlite3
npm run install

# Check Node.js version compatibility
node --version  # Should be 18+
bun --version   # Should be 1.0+
```

#### Python/Docling Issues
**Symptoms:**
- `Docling extraction failed`
- `python` command not found

**Diagnosis:**
```bash
# Check Python installation
python --version || python3 --version

# Check virtual environment
ls -la .venv/

# Check Docling installation
.venv/Scripts/python -c "import docling; print('Docling OK')"
```

**Solutions:**
```bash
# Set up Python environment
uv venv
uv pip install docling-serve

# Alternative: Disable Docling
# In your config, set useDoclingForPdf: false
```

#### Model Download Failures
**Symptoms:**
- `Failed to initialize local embedding model`
- `NetworkError` during model download

**Solutions:**
```bash
# Check internet connection
curl -I https://huggingface.co/

# Pre-download models
mkdir -p ~/.safe-appeals-navigator/models
cd ~/.safe-appeals-navigator/models

# Manual download (if automated fails)
wget https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/...
# (Complete model files would need to be downloaded)
```

### 2. Document Processing Issues

#### PDF Extraction Problems
**Symptoms:**
- Empty text from PDF files
- `PDF extraction failed`
- Memory spikes during PDF processing

**Diagnosis:**
```typescript
// Test extraction methods
const test = await ragService.testDoclingExtraction(uri);
console.log('Standard extraction pages:', test.standard?.metadata?.pageCount);
console.log('Docling extraction pages:', test.docling?.metadata?.pageCount);
console.log('Docling error:', test.doclingError);
```

**Solutions:**
1. **Try alternative extraction:**
   ```typescript
   // Temporarily disable Docling
   this.useDoclingForPdf = false;
   ```

2. **Check PDF validity:**
   ```bash
   # Use pdfinfo to check PDF
   pdfinfo document.pdf
   ```

3. **Memory issues with large PDFs:**
   ```typescript
   // Reduce batch size
   const BATCH_SIZE = 10; // Instead of 25
   ```

#### DOCX Processing Issues
**Symptoms:**
- `Failed to extract DOCX content`
- Empty or corrupted text from Word documents

**Solutions:**
```bash
# Check file integrity
file document.docx  # Should show: Microsoft Word 2007+

# Try with different file
# Some DOCX files may be corrupted or use unsupported features
```

#### File Size Issues
**Symptoms:**
- `File too large` error
- Out of memory during processing

**Solutions:**
1. **Split large documents:**
   ```bash
   # For PDFs, split into smaller files
   pdftk large.pdf burst  # Creates page-wise PDFs
   ```

2. **Increase memory limits:**
   ```bash
   # Run with higher memory limit
   node --max-old-space-size=2048 main.js
   ```

3. **Adjust file size limits:**
   ```typescript
   // Temporarily increase limits (not recommended for production)
   const MAX_FILE_SIZE_MB = 200; // Instead of 100
   ```

### 3. Search and Retrieval Issues

#### No Search Results
**Symptoms:**
- Queries return 0 results
- System shows documents indexed but searches fail

**Diagnosis:**
```typescript
// Comprehensive diagnostic
async function diagnoseSearchIssues() {
  // Check basic stats
  const stats = await ragService.getStats();
  console.log('System stats:', stats);

  // Test different scopes
  const scopes: RAGStorageScope[] = ['policy_manual', 'workspace_docs', 'both'];
  for (const scope of scopes) {
    const result = await ragService.search({
      query: 'test',
      scope,
      limit: 1
    });
    console.log(`${scope} scope: ${result.totalResults} results`);
  }

  // Check database directly
  const docs = await ragService.getDocumentsByType(true);
  console.log('Policy documents in DB:', docs.length);

  // Test with known content
  const knownContentResult = await ragService.search({
    query: 'the',  // Very common word
    scope: 'both',
    limit: 5
  });
  console.log('Known content search:', knownContentResult.totalResults);
}
```

**Common Causes:**
1. **Wrong scope:** Documents indexed as policy but searching workspace
2. **Empty database:** No documents actually indexed
3. **Query routing:** Query not matching scope detection rules
4. **Index corruption:** FTS5 index out of sync

**Solutions:**
```typescript
// Force reindexing
await ragService.clearAllEmbeddings();
// Then re-index documents

// Check scope manually
const policyDocs = await ragService.getDocumentsByType(true);
const caseDocs = await ragService.getDocumentsByType(false);
console.log(`Policies: ${policyDocs.length}, Cases: ${caseDocs.length}`);
```

#### Poor Search Quality
**Symptoms:**
- Irrelevant results
- Missing expected results
- Low relevance scores

**Diagnosis:**
```typescript
// Analyze search results
const results = await ragService.search({
  query: 'worker compensation eligibility',
  scope: 'policy_manual',
  limit: 10
});

console.log('Results analysis:');
results.attributions.forEach((attr, i) => {
  console.log(`${i + 1}. ${attr.filename} (score: ${attr.score.toFixed(3)})`);
  console.log(`   Range: ${attr.rangeHint}`);
});
```

**Solutions:**
1. **Enable reranking:**
   ```typescript
   // Ensure reranking is enabled
   const config = { useReranking: true };
   ```

2. **Check query preprocessing:**
   ```typescript
   // Test query expansion
   const expandedQuery = 'worker compensation eligibility injured employee claimant';
   ```

3. **Verify document content:**
   ```typescript
   // Check if expected terms exist in indexed documents
   const searchTerm = await ragService.search({
     query: 'eligibility',
     scope: 'policy_manual',
     limit: 1
   });
   ```

#### Slow Search Performance
**Symptoms:**
- Search takes >1 second
- High CPU usage
- Memory spikes during search

**Solutions:**
```typescript
// Performance optimizations
const fastConfig = {
  useReranking: false,    // Disable for speed
  searchLimit: 5,         // Fewer results
  embeddingBatchSize: 10  // Smaller batches
};
```

### 4. Indexing Integrity Issues

#### Integrity Mismatch Errors
**Symptoms:**
- Log shows `INTEGRITY MISMATCH: Document X has N chunks in SQLite but only M embeddings`
- Documents appear indexed but search doesn't find them
- Re-indexing happens unexpectedly on startup

**Causes:**
- Application crash during embedding generation
- Memory overflow during large document indexing
- Disk full during embedding persistence
- Interrupted indexing operation

**Diagnosis:**
```typescript
// Check a specific document's integrity manually
const uri = URI.file('/docs/suspect-document.pdf');
const isIndexed = await ragService.isDocumentIndexed(uri);

// This now checks BOTH SQLite AND embeddings
// If false, check logs for specific integrity issue
console.log('Document fully indexed:', isIndexed);

// Check system-wide stats
const stats = await ragService.getStats();
console.log('Total documents:', stats.totalDocuments);
console.log('Total chunks:', stats.chunks.totalChunks);
```

**Solutions:**

1. **Automatic repair:** The system automatically re-indexes documents with integrity issues on next startup or when `isDocumentIndexed()` is called.

2. **Manual re-index single document:**
   ```typescript
   // Delete and re-index the problematic document
   await ragService.deleteDocument(uri);
   await ragService.indexDocument({
     uri,
     isPolicyManual: false,
     workspaceId: ragService.getWorkspaceId()
   });
   ```

3. **Force full re-index (workspace):**
   ```typescript
   // Clear all data for this workspace
   await ragService.clearAllEmbeddings();
   // Documents will be re-indexed on next startup
   ```

#### Partial Index (No Embeddings)
**Symptoms:**
- Log shows `PARTIAL INDEX: Document X exists in SQLite but has no embeddings`
- Document metadata exists but search never finds it

**Causes:**
- Embedding model failed to load
- Out of memory during embedding generation
- Network timeout downloading model (first run)

**Solutions:**
1. Check embedding model is loaded correctly
2. Verify sufficient memory (8GB+ recommended)
3. The document will be automatically re-indexed

#### Chunk/Embedding Count Mismatch
**Symptoms:**
- Log shows chunk count differs from embedding count by >10%

**Note:** A small variance (up to 10%) is normal due to parent chunks in hierarchical chunking. Larger variances indicate an issue.

**Solutions:**
```bash
# Check the embedding database directly
sqlite3 ~/.safe-appeals-navigator/databases/workspaces/[hash]/chroma/embeddings.db \
  "SELECT COUNT(*) FROM embeddings WHERE metadata LIKE '%docId%'"

# Compare with chunks table
sqlite3 ~/.safe-appeals-navigator/databases/workspaces/[hash]/workspace.db \
  "SELECT COUNT(*) FROM chunks WHERE doc_id = 'target_doc_id'"
```

### 5. SQLite Database Issues

#### SQLite Corruption
**Symptoms:**
- `SQLITE_CORRUPT` errors
- Database operations fail
- System becomes unresponsive

**Recovery (Micro Database Architecture):**
```bash
# Each workspace has its own isolated database
# First, identify the workspace hash from logs or by listing:
ls ~/.safe-appeals-navigator/databases/workspaces/

# Backup the corrupted workspace database
cp ~/.safe-appeals-navigator/databases/workspaces/[hash]/workspace.db workspace.db.backup

# Remove the corrupted workspace database (only affects this workspace)
rm ~/.safe-appeals-navigator/databases/workspaces/[hash]/workspace.db
rm ~/.safe-appeals-navigator/databases/workspaces/[hash]/chroma/embeddings.db

# Restart application - will recreate the micro database for this workspace
# Other workspaces are unaffected

# Alternative: Repair attempt
sqlite3 ~/.safe-appeals-navigator/databases/workspaces/[hash]/workspace.db ".recover" > recovered.sql
sqlite3 new.db < recovered.sql
```

**Note:** With micro database architecture, database corruption in one workspace does NOT affect other workspaces.

#### Index Synchronization Issues
**Symptoms:**
- FTS5 search not finding documents
- Vector search works but keyword search fails

**Fix:**
```sql
-- Rebuild FTS5 index
INSERT INTO chunks_fts(chunks_fts) VALUES('rebuild');

-- Verify synchronization
SELECT count(*) FROM chunks;
SELECT count(*) FROM chunks_fts;
```

#### Database Lock Issues
**Symptoms:**
- `SQLITE_BUSY` errors
- Operations timeout
- Multiple processes accessing database

**Solutions:**
1. **Enable WAL mode:**
   ```sql
   PRAGMA journal_mode = WAL;
   ```

2. **Increase timeout:**
   ```typescript
   // Set longer timeout for operations
   this.db.configure('busyTimeout', 30000); // 30 seconds
   ```

### 6. Memory and Performance Issues

#### Out of Memory Errors
**Symptoms:**
- `JavaScript heap out of memory`
- Application crashes during indexing
- System becomes unresponsive

**Solutions:**
```bash
# Increase Node.js memory limit
node --max-old-space-size=2048 main.js

# Alternative: Use system with more RAM
# Minimum recommended: 8GB RAM
# Recommended: 16GB+ RAM for large document sets
```

#### Memory Leaks
**Symptoms:**
- Memory usage grows over time
- Performance degrades during long sessions
- GC doesn't free memory

**Diagnosis:**
```typescript
// Memory profiling
setInterval(() => {
  const mem = process.memoryUsage();
  console.log(`Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(2)} MB`);

  // Force GC if available
  if (global.gc) {
    global.gc();
  }
}, 30000);
```

**Solutions:**
```typescript
// Explicit cleanup
function cleanupResources() {
  // Clear caches
  this.embeddingCache.clear();
  this.queryCache.clear();

  // Force garbage collection
  if (global.gc) {
    global.gc();
  }
}
```

### 7. Model and AI Issues

#### Embedding Model Failures
**Symptoms:**
- `Failed to generate embeddings`
- Model initialization errors
- All-MiniLM-L6-v2 download issues

**Solutions:**
```bash
# Clear model cache and retry
rm -rf ~/.safe-appeals-navigator/models/Xenova/

# Check disk space
df -h ~/.safe-appeals-navigator/models/

# Manual model download
cd ~/.safe-appeals-navigator/models/
git clone https://huggingface.co/Xenova/all-MiniLM-L6-v2
```

#### Cross-Encoder Issues
**Symptoms:**
- Reranking fails
- `LocalCrossEncoderReranker` errors
- Search quality degrades when reranking enabled

**Solutions:**
```typescript
// Disable reranking temporarily
const config = {
  useReranking: false,  // Fall back to BM25 + vector fusion only
  rerankingBatchSize: 4  // Smaller batches if reranking enabled
};
```

### 8. Network and External Service Issues

#### Docling Service Problems
**Symptoms:**
- `Connection refused` on port 5001
- Docling extraction fails
- `python` process not running

**Diagnosis:**
```bash
# Check if Docling is running
ps aux | grep docling

# Check port availability
netstat -tlnp | grep 5001

# Test Docling API
curl http://localhost:5001/health
```

**Solutions:**
```bash
# Restart Docling service
pkill -f docling
# Service will auto-restart on next RAG operation

# Manual start
cd project-root
.venv/Scripts/python -m docling_serve run &
```

#### HuggingFace API Issues
**Symptoms:**
- Model download fails
- `HTTP 403` or `HTTP 429` errors

**Solutions:**
1. **Check token:**
   ```bash
   # Verify HF_TOKEN is set
   echo $HF_TOKEN
   ```

2. **Rate limiting:**
   ```bash
   # Wait and retry
   sleep 60
   ```

3. **Network issues:**
   ```bash
   # Test connectivity
   curl -I https://huggingface.co/
   ```

## 🛠️ Advanced Debugging Tools

### System Diagnostic Script

```typescript
class RAGDiagnostician {
  async runFullDiagnostic(): Promise<DiagnosticReport> {
    const report: DiagnosticReport = {
      system: await this.checkSystemHealth(),
      database: await this.checkDatabaseHealth(),
      models: await this.checkModelHealth(),
      services: await this.checkServiceHealth(),
      performance: await this.runPerformanceTests()
    };

    return report;
  }

  private async checkSystemHealth() {
    return {
      platform: process.platform,
      arch: process.arch,
      nodeVersion: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }

  private async checkDatabaseHealth() {
    try {
      const stats = await this.ragService.getStats();
      const dbSize = await this.getDatabaseSize();

      return {
        status: 'healthy',
        stats,
        size: dbSize,
        tables: await this.getTableInfo()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  private async checkModelHealth() {
    try {
      // Test embedding generation
      const testEmbedding = await this.embeddingService.generateEmbedding('test');
      return {
        status: 'healthy',
        embeddingDimension: testEmbedding.length,
        modelName: this.embeddingService.getModelName()
      };
    } catch (error) {
      return {
        status: 'error',
        error: error.message
      };
    }
  }

  private async checkServiceHealth() {
    const services = {
      docling: await this.checkDoclingHealth(),
      vectorStore: await this.checkVectorStoreHealth(),
      searchIndex: await this.checkSearchIndexHealth()
    };

    return services;
  }

  private async runPerformanceTests() {
    const tests = {
      indexingSpeed: await this.testIndexingSpeed(),
      searchSpeed: await this.testSearchSpeed(),
      memoryUsage: await this.testMemoryUsage()
    };

    return tests;
  }
}
```

### Log Analysis Tools

```typescript
class LogAnalyzer {
  analyzeRAGLogs(logContent: string): LogAnalysis {
    const analysis = {
      errors: [],
      warnings: [],
      performance: {
        avgSearchTime: 0,
        avgIndexingTime: 0,
        memoryPeaks: []
      },
      operations: {
        totalSearches: 0,
        totalIndexing: 0,
        failedOperations: 0
      }
    };

    const lines = logContent.split('\n');
    let searchTimes: number[] = [];
    let indexingTimes: number[] = [];

    for (const line of lines) {
      // Error detection
      if (line.includes('ERROR') || line.includes('Failed')) {
        analysis.errors.push(line);
      }

      // Warning detection
      if (line.includes('WARN') || line.includes('Warning')) {
        analysis.warnings.push(line);
      }

      // Performance extraction
      const searchMatch = line.match(/Search completed in (\d+)ms/);
      if (searchMatch) {
        searchTimes.push(parseInt(searchMatch[1]));
        analysis.operations.totalSearches++;
      }

      const indexingMatch = line.match(/Indexed document.*in (\d+)ms/);
      if (indexingMatch) {
        indexingTimes.push(parseInt(indexingMatch[1]));
        analysis.operations.totalIndexing++;
      }

      const memoryMatch = line.match(/Memory.*(\d+\.\d+) MB/);
      if (memoryMatch) {
        analysis.performance.memoryPeaks.push(parseFloat(memoryMatch[1]));
      }
    }

    // Calculate averages
    if (searchTimes.length > 0) {
      analysis.performance.avgSearchTime =
        searchTimes.reduce((a, b) => a + b) / searchTimes.length;
    }

    if (indexingTimes.length > 0) {
      analysis.performance.avgIndexingTime =
        indexingTimes.reduce((a, b) => a + b) / indexingTimes.length;
    }

    analysis.operations.failedOperations = analysis.errors.length;

    return analysis;
  }
}
```

## 📞 Getting Help

### Support Information to Provide

When reporting issues, include:

```typescript
const supportInfo = {
  // System information
  platform: process.platform,
  nodeVersion: process.version,
  voidVersion: 'get from package.json',

  // RAG system status
  ragStats: await ragService.getStats(),
  systemHealth: await runFullDiagnostic(),

  // Error details
  error: {
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  },

  // Configuration
  config: {
    useDocling: this.useDoclingForPdf,
    useReranking: this.useReranking,
    embeddingBatchSize: this.embeddingBatchSize,
    maxFileSizeMB: this.maxFileSizeMB
  },

  // Recent logs (last 100 lines)
  recentLogs: getRecentLogLines(100)
};
```

### Common Support Scenarios

#### Complete System Reset
**When to use:** Corrupted database, persistent errors, clean slate needed

```bash
# Stop application
pkill -f "void"

# Backup existing data (optional)
cp -r ~/.safe-appeals-navigator ~/.safe-appeals-navigator.backup

# Clean reset - removes ALL workspace micro databases
rm -rf ~/.safe-appeals-navigator/databases/workspaces/
mkdir -p ~/.safe-appeals-navigator/databases/workspaces/

# Or reset a specific workspace only (safer)
rm -rf ~/.safe-appeals-navigator/databases/workspaces/[workspace-hash]/

# Restart application - will recreate micro databases as needed
```

**Note:** With the micro database architecture, you can reset individual workspaces without affecting others. Each workspace's data is completely isolated.

#### Partial Data Recovery
**When to use:** Some data corrupted, most documents still accessible

```bash
# Identify working documents
# Use diagnostic script to find healthy data

# Export healthy data
# (Implementation depends on specific corruption)

# Clean reinstall
# Import recovered data
```

## 🚀 Prevention Best Practices

### Regular Maintenance

```typescript
// Weekly maintenance script
class MaintenanceRunner {
  async weeklyMaintenance() {
    // Check database integrity
    await this.checkDatabaseIntegrity();

    // Optimize database
    await this.optimizeDatabase();

    // Clear old caches
    await this.clearOldCaches();

    // Verify model integrity
    await this.verifyModels();

    // Performance test
    await this.runPerformanceTest();
  }

  async monthlyMaintenance() {
    // Full system backup
    await this.createSystemBackup();

    // Update dependencies
    await this.updateDependencies();

    // Security scan
    await this.runSecurityScan();
  }
}
```

### Monitoring Setup

```typescript
// Production monitoring
class ProductionMonitor {
  constructor(private ragService: IRAGService) {
    this.setupMonitoring();
  }

  private setupMonitoring() {
    // Health checks every 5 minutes
    setInterval(() => this.healthCheck(), 5 * 60 * 1000);

    // Performance monitoring
    setInterval(() => this.performanceCheck(), 15 * 60 * 1000);

    // Error alerting
    this.setupErrorAlerting();
  }

  private async healthCheck() {
    try {
      const stats = await this.ragService.getStats();
      const isHealthy = stats.totalDocuments >= 0;

      if (!isHealthy) {
        this.alert('RAG system unhealthy', { stats });
      }
    } catch (error) {
      this.alert('RAG health check failed', { error });
    }
  }

  private async performanceCheck() {
    const startTime = Date.now();
    await this.ragService.search({
      query: 'test query',
      scope: 'policy_manual',
      limit: 1
    });
    const responseTime = Date.now() - startTime;

    if (responseTime > 1000) { // 1 second threshold
      this.alert('Slow RAG search performance', { responseTime });
    }
  }
}
```

---

*Troubleshooting guide last updated: January 2026*



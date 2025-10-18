<!-- 561ae376-56f4-42f5-962e-31437d132580 8b4c609e-5b49-4182-b25a-f468cf61f8a5 -->
# Local Embedding Model Integration Plan

## Overview

Replace paid OpenAI embeddings with free local model using Transformers.js. The `all-MiniLM-L6-v2` model (~23 MB) will be bundled with the app for offline, cost-free embeddings.

## Implementation Steps

### 1. Install Dependencies

Add Transformers.js to package.json:

```bash
npm install @xenova/transformers
```

The model will be automatically downloaded to a cache directory on first use, but we'll configure it to use a bundled version.

### 2. Create Local Embedding Adapter

**File**: `src/vs/workbench/contrib/void/common/ragLocalEmbeddings.ts`

Create new service that:

- Uses `@xenova/transformers` pipeline for feature extraction
- Initializes `Xenova/all-MiniLM-L6-v2` model (384-dimensional embeddings)
- Batches embedding generation (25 texts at a time for memory efficiency)
- Caches model in application data directory
- Provides same interface as OpenAI adapter for drop-in replacement

Key implementation:

```typescript
import { pipeline, env } from '@xenova/transformers';

export class LocalEmbeddingService {
    private pipe: any;
    
    async initialize(cachePath: string) {
        env.cacheDir = cachePath; // Use app data dir
        env.allowLocalModels = true;
        this.pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    }
    
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        const BATCH_SIZE = 25;
        const embeddings: number[][] = [];
        
        for (let i = 0; i < texts.length; i += BATCH_SIZE) {
            const batch = texts.slice(i, i + BATCH_SIZE);
            const output = await this.pipe(batch, { pooling: 'mean', normalize: true });
            embeddings.push(...output.tolist());
        }
        
        return embeddings;
    }
}
```

### 3. Update Vector Adapter

**File**: `src/vs/workbench/contrib/void/common/ragVectorAdapter.ts`

Modify `ChromaPersistentAdapter`:

- Remove OpenAI client initialization
- Import and use `LocalEmbeddingService` instead
- Update `add()` method to use local embeddings
- Update `query()` method to use local embeddings for search
- Remove `openAIApiKey` from config (breaking change, but necessary)

Changes:

```typescript
// Before
import { OpenAI } from 'openai';
private openai: any;

// After
import { LocalEmbeddingService } from './ragLocalEmbeddings.js';
private embeddingService: LocalEmbeddingService;

async initialize(): Promise<void> {
    this.embeddingService = new LocalEmbeddingService();
    await this.embeddingService.initialize(this.config.persistPath + '/models');
}

async add(chunks: ChunkRecord[], metadatas: Record<string, any>[]): Promise<void> {
    const texts = chunks.map(c => c.text);
    const embeddings = await this.embeddingService.generateEmbeddings(texts);
    // Store embeddings...
}
```

### 4. Update RAG Main Service

**File**: `src/vs/workbench/contrib/void/electron-main/ragMainService.ts`

Remove OpenAI API key dependency:

```typescript
// Before
const config: PersistentVectorAdapterConfig = {
    persistPath: chromaPath,
    openAIApiKey: process.env.OPENAI_API_KEY || '',
    openAIModel: 'text-embedding-3-small'
};

// After
const config: PersistentVectorAdapterConfig = {
    persistPath: chromaPath
};
```

Add first-time model download notification:

```typescript
this.logService.info('Initializing local embedding model (first time may take 1-2 minutes to download ~23 MB model)...');
await this.vectorAdapter.initialize();
this.logService.info('Local embedding model ready');
```

### 5. Update Type Definitions

**File**: `src/vs/workbench/contrib/void/common/ragServiceTypes.ts`

Update config interfaces:

```typescript
export interface PersistentVectorAdapterConfig {
    persistPath: string;
    // Remove openAIApiKey and openAIModel
}
```

### 6. Update Settings

**File**: `src/vs/workbench/contrib/void/common/voidSettingsTypes.ts`

Remove/deprecate OpenAI-related RAG settings if any exist. Add new setting for model cache location if needed.

### 7. Handle Model Caching

**File**: `src/vs/workbench/contrib/void/common/ragPathService.ts`

Add method to get model cache directory:

```typescript
getModelCacheDir(): string {
    const cacheDir = join(this.getGlobalRagDir(), 'models');
    return cacheDir;
}
```

Ensure directory is created during initialization.

### 8. Update Documentation

**Files**:

- `src/vs/workbench/contrib/void/ADDED_FEATURES_TRACKER.md`
- `src/vs/workbench/contrib/void/RAG_MEMORY_OPTIMIZATION.md`

Add section about local embeddings:

- No API costs
- ~23 MB model size
- First-time download (automatic)
- Offline capability
- Performance: ~50-100 embeddings/second on CPU

### 9. Error Handling & Fallbacks

Add robust error handling in `ragLocalEmbeddings.ts`:

- Network errors during model download
- Insufficient disk space
- Model corruption
- Out of memory during embedding generation

Provide clear error messages to user via notifications.

### 10. Memory Management

Apply same batching and GC strategies as PDF processing:

- Batch embeddings (25 at a time)
- Force GC after each batch
- Log memory usage
- Limit concurrent embedding operations

## Testing Checklist

1. Fresh install - verify model downloads automatically
2. Index small PDF (< 10 MB) - verify embeddings generated
3. Index large PDF (50-100 MB) - verify memory stays reasonable
4. Search indexed documents - verify results are relevant
5. Offline mode - verify works without internet (after first download)
6. Check app size increase (~50 MB with dependencies + model cache)

## Migration Notes

**Breaking Change**: Existing indexed documents with OpenAI embeddings will need to be re-indexed with local model. Consider:

- Auto-detect old embeddings (dimension check: 1536 vs 384)
- Prompt user to re-index
- Or: Clear vector store on first run with new version

## Performance Expectations

- **Embedding Speed**: ~50-100 texts/second on average laptop CPU
- **Memory**: ~200-300 MB during embedding generation
- **Quality**: Slightly lower than OpenAI (0.85x), but sufficient for semantic search
- **Cost**: $0 (vs ~$0.02 per 1M tokens with OpenAI)

## Files to Modify

1. `package.json` - Add @xenova/transformers
2. `src/vs/workbench/contrib/void/common/ragLocalEmbeddings.ts` - NEW FILE
3. `src/vs/workbench/contrib/void/common/ragVectorAdapter.ts` - Replace OpenAI with local
4. `src/vs/workbench/contrib/void/electron-main/ragMainService.ts` - Remove API key
5. `src/vs/workbench/contrib/void/common/ragServiceTypes.ts` - Update types
6. `src/vs/workbench/contrib/void/common/ragPathService.ts` - Add model cache path
7. `src/vs/workbench/contrib/void/ADDED_FEATURES_TRACKER.md` - Document changes

## Rollout Strategy

1. Implement local embeddings
2. Test thoroughly with various document sizes
3. Update user documentation
4. Consider migration path for existing users
5. Monitor performance and user feedback

### To-dos

- [ ] Install @xenova/transformers package
- [ ] Create ragLocalEmbeddings.ts service with Transformers.js pipeline
- [ ] Replace OpenAI embeddings with local embeddings in ragVectorAdapter.ts
- [ ] Remove OpenAI API key dependency from ragMainService.ts
- [ ] Update type definitions to remove OpenAI config
- [ ] Implement model cache directory management in ragPathService.ts
- [ ] Add robust error handling for model download and embedding generation
- [ ] Update documentation with local embedding details
- [ ] Test with various PDF sizes and verify memory usage
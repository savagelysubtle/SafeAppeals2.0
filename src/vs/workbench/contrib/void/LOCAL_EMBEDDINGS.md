# Local Embedding Model Integration

## Overview

SafeAppeals2.0 uses free, offline embeddings via **Transformers.js** instead of paid OpenAI API embeddings. This eliminates API costs and enables offline functionality.

## Model Details

- **Model**: `all-MiniLM-L6-v2` (from Hugging Face)
- **Provider**: Transformers.js (ONNX runtime in browser/Node.js)
- **Size**: ~23 MB
- **Embedding Dimension**: 384
- **License**: Apache 2.0

## Performance

### Speed

- **CPU**: ~50-100 embeddings/second on modern laptop
- **Batch Processing**: 25 texts at a time for memory efficiency
- **First Run**: 1-2 minute download (only once)
- **Subsequent Runs**: Instant (model cached locally)

### Quality

- **Semantic Search**: Good quality for document retrieval
- **Comparison to OpenAI**: ~85% of OpenAI text-embedding-3-small quality
- **Use Case**: Excellent for policy manual search and document retrieval

### Cost

- **API Calls**: $0 (no external API)
- **OpenAI Equivalent**: Saves ~$0.02 per 1M tokens
- **Typical Document**: 100-page PDF = ~$0.10-0.20 saved

## Architecture

### File Structure

```
src/vs/workbench/contrib/void/
├── common/
│   ├── ragLocalEmbeddings.ts      ← Local embedding service
│   ├── ragVectorAdapter.ts        ← Uses local embeddings
│   └── ragPathService.ts          ← Model cache directory
├── electron-main/
│   └── ragMainService.ts          ← Initialization logic
```

### Flow

1. **Initialization**:
   - RAG service starts
   - Checks for model in cache directory
   - Downloads model if not present (~23 MB)
   - Loads model into memory

2. **Indexing**:
   - Document chunked into 500-token pieces
   - Chunks batched (25 at a time)
   - Local model generates 384D embeddings
   - Embeddings stored in vector store

3. **Search**:
   - Query text converted to embedding
   - Cosine similarity with stored embeddings
   - Top-N results returned by relevance score

## Model Cache

### Location

- **Windows**: `%APPDATA%\.appealsnavigator\models\`
- **macOS**: `~/Library/Application Support/.appealsnavigator/models/`
- **Linux**: `~/.config/.appealsnavigator/models/`

### Contents

- `onnx/` - ONNX model files
- `tokenizer.json` - Tokenizer configuration
- `config.json` - Model configuration

### Management

- **Auto-Download**: First run only
- **Cached**: Persistent across sessions
- **Size**: ~23 MB total
- **Cleanup**: Safe to delete (will re-download)

## Configuration

### Constants (in `ragLocalEmbeddings.ts`)

```typescript
const BATCH_SIZE = 25;              // Embeddings per batch
const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
const EMBEDDING_DIMENSION = 384;
```

### Memory Usage

- **Model Loading**: ~50 MB
- **Per Batch (25 texts)**: ~20-30 MB
- **Total Peak**: ~100-150 MB during embedding generation

## Error Handling

### Network Errors

**Scenario**: No internet on first run

```
Failed to download embedding model.
Please check your internet connection and try again.
```

**Resolution**:

1. Connect to internet
2. Restart application
3. Model will download automatically

### Disk Space Errors

**Scenario**: Insufficient disk space (~23 MB required)

```
Insufficient disk space to download embedding model (~23 MB required).
```

**Resolution**:

1. Free up disk space
2. Restart application

### Initialization Errors

**Scenario**: Model corruption or loading failure

```
Embedding model initialization failed: [error details]
```

**Resolution**:

1. Delete model cache directory
2. Restart application
3. Model will re-download

## Migration from OpenAI

### Breaking Changes

**Old Embeddings** (OpenAI text-embedding-3-small):

- Dimension: 1536
- Cost: ~$0.02 per 1M tokens
- Online only

**New Embeddings** (all-MiniLM-L6-v2):

- Dimension: 384
- Cost: $0
- Works offline

### Re-indexing Required

Existing documents indexed with OpenAI embeddings **must be re-indexed** with the local model.

**Command**: `RAG: Clear All Embeddings` (F1 → search command)

This will:

1. Clear vector store
2. Clear SQLite metadata
3. Allow re-indexing with local embeddings

### Settings Changes

**Removed**:

- ~~`ragOpenAIModel`~~ - No longer needed
- ~~OpenAI API key in RAG config~~ - Not used

**No Action Needed**:

- Old settings ignored gracefully
- No user intervention required

## Offline Usage

### Requirements

1. **First Run**: Internet required to download model
2. **Subsequent Runs**: Fully offline

### Capabilities

- ✅ Index documents offline
- ✅ Search documents offline
- ✅ Generate embeddings offline
- ❌ Cannot download model without internet

### Travel/Disconnected Scenarios

If you need to use RAG offline:

1. Run application once while connected
2. Index a test document (triggers model download)
3. After successful download, fully offline capable

## Performance Tuning

### Slower Machines

**Reduce batch size** in `ragLocalEmbeddings.ts`:

```typescript
private readonly BATCH_SIZE = 10; // Default: 25
```

**Trade-off**: Slower indexing, lower memory usage

### Faster Machines

**Increase batch size**:

```typescript
private readonly BATCH_SIZE = 50; // Default: 25
```

**Trade-off**: Faster indexing, higher memory usage

### Memory Constraints

**Systems with <4 GB RAM**:

- Reduce PDF batch size to 5 (in `ragFileService.ts`)
- Reduce embedding batch size to 10
- Index smaller documents (<10 MB)

## Troubleshooting

### "Model not initialized" Error

**Cause**: Initialization failed or not completed

**Solution**:

1. Check logs for initialization errors
2. Verify internet connection (first run)
3. Delete model cache and restart

### Slow Embedding Generation

**Cause**: CPU-bound operation on slower hardware

**Expected**:

- 500 chunks = ~5-10 seconds on modern CPU
- 2000 chunks = ~20-40 seconds

**If Much Slower**:

- Check CPU usage (should be high during embedding)
- Close other applications
- Consider reducing batch size

### High Memory Usage

**Cause**: Large batches or many concurrent operations

**Solution**:

- Reduce `BATCH_SIZE` to 10-15
- Index one document at a time
- Increase Node.js heap size: `--max-old-space-size=4096`

## Comparison with OpenAI

| Feature | Local (Transformers.js) | OpenAI API |
|---------|-------------------------|------------|
| **Cost** | $0 | ~$0.02 per 1M tokens |
| **Speed** | 50-100 emb/sec | 100-500 emb/sec |
| **Quality** | 85% of OpenAI | 100% (baseline) |
| **Offline** | ✅ Yes | ❌ No |
| **Privacy** | ✅ Local only | ❌ Sent to API |
| **Setup** | Auto (one-time download) | API key required |
| **Dimension** | 384 | 1536 |

## Future Improvements

1. **GPU Acceleration**: Use ONNX Runtime GPU for 10-100x speedup
2. **Larger Models**: Support for larger models (e.g. `all-mpnet-base-v2`)
3. **Model Selection**: Allow users to choose embedding model
4. **Quantization**: Smaller model sizes with int8 quantization
5. **Worker Threads**: Parallel embedding generation

## Related Files

- `src/vs/workbench/contrib/void/common/ragLocalEmbeddings.ts` - Core implementation
- `src/vs/workbench/contrib/void/common/ragVectorAdapter.ts` - Integration
- `src/vs/workbench/contrib/void/electron-main/ragMainService.ts` - Initialization
- `src/vs/workbench/contrib/void/common/ragPathService.ts` - Cache paths

## References

- [Transformers.js Documentation](https://huggingface.co/docs/transformers.js)
- [all-MiniLM-L6-v2 Model Card](https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2)
- [ONNX Runtime](https://onnxruntime.ai/)
- [Sentence Transformers](https://www.sbert.net/)

---

**Last Updated**: October 2025

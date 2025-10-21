# In-Memory Embeddings Issue & Solution

## Problem

You're seeing:

```
Searching RAG with query: ...
No embeddings available for search
```

Even though documents are indexed (show in database).

## Root Cause

The `ChromaPersistentAdapter` stores embeddings **in memory** (RAM), not on disk. When you:

- Restart the application
- Reload the window
- Close and reopen

**All embeddings are lost**, even though document metadata stays in SQLite.

## Why This Happens

```typescript
// In ragVectorAdapter.ts
export class ChromaPersistentAdapter implements VectorAdapter {
    // This Map is in memory only! ⚠️
    private embeddings: Map<string, { vector: number[]; metadata: Record<string, any> }> = new Map();
}
```

When the process restarts, this `Map` is empty.

## The Solution

You need to **clear and re-index** your documents after installing the new local embeddings:

### Steps to Fix

1. **Clear all embeddings**:

   ```
   F1 → Type: "RAG: Clear All Embeddings" → Enter
   ```

   You'll see:

   ```
   ✓ All RAG embeddings and metadata cleared successfully
   ```

2. **Re-index your documents**:

   ```
   Right-click PDF → "Index as Policy Manual"
   ```

   With the new local embedding model, this will:
   - Extract content
   - Generate chunks
   - Create embeddings (FREE, no API costs)
   - Store embeddings in memory
   - Store metadata in SQLite

3. **Search should now work**:

   ```
   @policy search for something
   ```

## Why You Need to Re-Index

Your documents were previously indexed with OpenAI embeddings (1536 dimensions), but now we're using local embeddings (384 dimensions). The dimensions don't match, so we need to regenerate all embeddings with the new model.

## Understanding the Architecture

### What's Persisted (Survives Restart)

- ✅ Document metadata (SQLite database)
- ✅ Chunk text (SQLite database)
- ✅ File paths, checksums, timestamps

### What's Not Persisted (Lost on Restart)

- ❌ Embeddings (in-memory Map)
- ❌ Vector similarities

### Future Improvement

We plan to add one of these solutions:

1. **Store embeddings in SQLite** - Persist vectors to disk
2. **Auto-regenerate on startup** - Detect missing embeddings and regenerate
3. **Use persistent vector database** - Switch to a disk-based vector store

For now, the workaround is to keep the app running or re-index after restart.

## How to Avoid This

### Option 1: Keep App Running

Don't restart the app unnecessarily. The embeddings stay in memory as long as the process runs.

### Option 2: Re-index After Restart

If you restart, run:

```
F1 → "RAG: Clear All Embeddings"
Then re-index your PDFs
```

### Option 3: Wait for Persistent Storage (Coming Soon)

We're working on storing embeddings in SQLite so they persist across restarts.

## Checking If You Have This Issue

Run a search query:

```
@policy search for something
```

If you see:

```
No embeddings available for search
```

But documents show as indexed when you try to re-index:

```
Document already indexed: filename.pdf
```

Then you have this issue. Follow the steps above to fix it.

## Performance Note

Re-indexing with local embeddings:

- **Cost**: $0 (free!)
- **Speed**: ~50-100 embeddings/second on CPU
- **Time for 500 pages**: ~2-5 minutes

So while re-indexing is inconvenient, it's at least free now with the local model!

---

**Last Updated**: October 2025

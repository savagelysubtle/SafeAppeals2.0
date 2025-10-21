# Duplicate Document Indexing Fix

## Problem

Documents were being indexed multiple times despite duplicate prevention checks, wasting resources and creating duplicate embeddings.

## Root Cause

**Bug Found**: In `ragMainChannel.ts`, the IPC channel handler was passing the entire `args` object instead of just `args.uri` to the `isDocumentIndexed` method.

```typescript
// BEFORE (BROKEN)
case 'isDocumentIndexed':
    if (args && args.uri) {
        args.uri = URI.revive(args.uri as UriComponents);
    }
    return this.service.isDocumentIndexed(args);  // ❌ Passing entire args object

// AFTER (FIXED)
case 'isDocumentIndexed':
    if (args && args.uri) {
        args.uri = URI.revive(args.uri as UriComponents);
    }
    return this.service.isDocumentIndexed(args.uri);  // ✅ Passing URI only
```

## Changes Made

### 1. Fixed IPC Channel Handler

**File**: `src/vs/workbench/contrib/void/electron-main/ragMainChannel.ts`

- Changed `return this.service.isDocumentIndexed(args);`
- To: `return this.service.isDocumentIndexed(args.uri);`

### 2. Added Duplicate Check in Action

**File**: `src/vs/workbench/contrib/void/browser/ragActions.ts`

- Added `isDocumentIndexed` check before starting indexing process
- Shows warning notification if document already indexed
- Prevents wasted resources

### 3. Enhanced Logging for Debugging

**Files Modified**:

- `ragMainService.ts`: Added logging for isDocumentIndexed checks
- `ragIndexService.ts`: Added logging for document ID generation and database queries
- `ragActions.ts`: Added console logs for debugging

## How It Works Now

1. **User clicks "Index as Policy Manual"**
2. **Check if already indexed**:

   ```typescript
   const isAlreadyIndexed = await ragService.isDocumentIndexed(uri);
   ```

3. **If already indexed**:
   - Show warning: "Document already indexed: filename.pdf"
   - Show instruction: "Use 'RAG: Clear All Embeddings' if you need to re-index"
   - Return early (no indexing)
4. **If not indexed**:
   - Proceed with normal indexing flow
   - Show progress notification
   - Show success notification

## Log Output (for debugging)

When checking if a document is indexed, you'll now see:

```
[RAG] Checking if document is already indexed: d:\path\to\document.pdf
[RAG] Generating document ID for: d:\path\to\document.pdf
[RAG] Generated document ID: a1b2c3d4e5f6g7h8
[RAG] Querying database for document ID: a1b2c3d4e5f6g7h8
[RAG] Document query result: FOUND
[RAG] Found document: document.pdf (uploaded: 2025-10-19T...)
[RAG] Document d:\path\to\document.pdf is already indexed
[RAG] isAlreadyIndexed result: true
```

Or if not found:

```
[RAG] Checking if document is already indexed: d:\path\to\document.pdf
[RAG] Generating document ID for: d:\path\to\document.pdf
[RAG] Generated document ID: a1b2c3d4e5f6g7h8
[RAG] Querying database for document ID: a1b2c3d4e5f6g7h8
[RAG] Document query result: NOT FOUND
[RAG] Document d:\path\to\document.pdf is not indexed
[RAG] isAlreadyIndexed result: false
```

## Testing

1. **First Index** (should work):

   ```
   - Right-click PDF → "Index as Policy Manual"
   - Should see progress notification
   - Should see success notification
   ```

2. **Second Index** (should be prevented):

   ```
   - Right-click same PDF → "Index as Policy Manual"
   - Should see warning: "Document already indexed: filename.pdf"
   - Should NOT start indexing process
   - Check console logs for "isAlreadyIndexed result: true"
   ```

3. **Re-index After Clear**:

   ```
   - F1 → "RAG: Clear All Embeddings"
   - Right-click PDF → "Index as Policy Manual"
   - Should work (document no longer in database)
   ```

## User Experience

### Scenario 1: New Document

✅ "Indexing: document.pdf"
✅ "Extracting content from PDF..."
✅ "Generated embeddings for 127 chunks"
✅ "Successfully indexed: document.pdf"

### Scenario 2: Already Indexed

⚠️ "Document already indexed: document.pdf
    Use 'RAG: Clear All Embeddings' if you need to re-index."

### Scenario 3: Want to Re-index

🔧 F1 → "RAG: Clear All Embeddings"
ℹ️ "All RAG embeddings and metadata cleared successfully"
✅ Can now index the document again

## Benefits

- ✅ **No duplicate embeddings**: Each document indexed once
- ✅ **Saves resources**: No wasted CPU/memory on re-indexing
- ✅ **Cleaner search results**: No duplicate entries
- ✅ **Better UX**: Clear feedback to users
- ✅ **Cost savings**: Even though embeddings are now free with local model, still saves computational resources

## Related Files

- `src/vs/workbench/contrib/void/electron-main/ragMainChannel.ts` - IPC channel handler (main fix)
- `src/vs/workbench/contrib/void/browser/ragActions.ts` - User action handler
- `src/vs/workbench/contrib/void/electron-main/ragMainService.ts` - Main service logic
- `src/vs/workbench/contrib/void/electron-main/ragIndexService.ts` - Database operations
- `src/vs/workbench/contrib/void/browser/toolsService.ts` - Tool handler (already had this check)

## Notes

- The tool handler (`rag_index_document`) already had this check, so LLM agents weren't affected
- The bug only affected manual indexing via Explorer context menu
- The fix ensures both manual and automated indexing respect duplicate prevention

---

**Fixed**: October 2025

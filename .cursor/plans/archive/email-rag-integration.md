# Email ↔ RAG Integration Plan

**Date:** 2025-01-15  
**Status:** ✅ Completed & Compiling  
**Extensions:** `safeappeals-email`, `safeappeals-rag`

---

## Goal
Index case-linked emails from the email dashboard into the RAG system so they become searchable via Private Search. When a thread is linked to a case, its emails are indexed; when unlinked, they're removed. Sync updates reindex automatically. Retroactive indexing handles pre-existing links on startup.

---

## Architecture

```
User clicks "Link to Case" in Email Dashboard
       │
       ▼
EmailIndex.linkThreadToCase(threadId, casePath)  ──► Updates caseLinks map
       │
       ▼
SyncEngine (via engine.getEmailIndexer()) ──► EmailIndexer.indexThread()
       │
       ├──► For each message: create markdown with metadata frontmatter
       ├──► Generate sourceUri: `safeappeals:email:{threadId}:{messageId}`
       ├──► IndexPipeline.indexFile({ sourceUri, scope: 'case_index', bytes: markdown })
       └──► Store mapping: threadId → Set<docId>

User clicks "Unlink from Case"
       │
       ▼
EmailIndexer.unindexThread(threadId)
       │
       ├──► Look up docIds for threadId
       ├──► For each docId: ragCoreHost.removeDoc(docId)
       └──► Clear mapping
```

---

## Files Created

### `safeappeals-rag/src/emailIndexer.ts` (NEW)
Core service for indexing/unindexing email threads.

**Key API:**
```typescript
interface EmailIndexer {
  indexThread(threadId: string, messages: EmailMessage[], caseFolderPath: string): Promise<void>;
  unindexThread(threadId: string): Promise<void>;
  reindexThread(threadId: string, messages: EmailMessage[], caseFolderPath: string): Promise<void>;
  indexAllLinkedThreads(threads: Map<string, EmailThread>): Promise<void>;
}
```

**DocId scheme:** `safeappeals:email:{threadId}:{messageId}` (stable via `docIdForSourceUri`)

**Markdown format:**
```markdown
---
source: email
threadId: "abc123"
messageId: "msg456"
subject: "Re: Appeal Deadline"
from: "opposing@counsel.com"
to: "me@firm.com"
cc: ""
date: "2025-01-15T10:30:00Z"
category: "deadline"
priority: "urgent"
caseFolderPath: "/cases/smith-v-jones"
---
# Re: Appeal Deadline

Email body text here...
```

---

## Files Modified

### `safeappeals-rag/src/extension.ts`
- Added `EmailIndexer` import
- Created `emailIndexer` instance after `IndexPipeline` ready
- Exported `getEmailIndexer()` for cross-extension access
- Added retroactive indexing in `warmThenIndex()` — scans email extension's `getLinkedThreads()` on startup

### `safeappeals-email/src/emailIndex.ts`
- Added `getLinkedThreads(): EmailThread[]` — returns all threads with `caseFolderPath` set

### `safeappeals-email/src/extension.ts`
- Added `"extensionDependencies": ["safeappeals.safeappeals-rag"]` to `package.json`
- Exported `getEmailIndex()` for RAG extension to access linked threads
- Added `trySetRagEmailIndexer()` with try/catch + `onDidChange` listener for resilient connection
- Modified `linkThreadToCase` command → calls `engine.getEmailIndexer()?.indexThread()`
- Modified `unlinkThreadFromCase` command → calls `engine.getEmailIndexer()?.unindexThread()`

### `safeappeals-email/src/syncEngine.ts`
- Added `emailIndexer` field + `setEmailIndexer()` / `getEmailIndexer()`
- In `syncAccount()`: after upserting new headers, reindexes linked threads that have new/updated messages via `emailIndexer.reindexThread()`

---

## Data Flow Summary

| Trigger | Action | RAG Operation |
|---------|--------|---------------|
| Link thread to case | `linkThreadToCase` command | `indexThread()` — indexes all loaded messages |
| Unlink thread | `unlinkThreadFromCase` command | `unindexThread()` — removes all docIds for thread |
| IMAP sync fetches new mail | `SyncEngine.syncAccount()` | `reindexThread()` for linked threads with new messages |
| Extension startup | `warmThenIndex()` in RAG | `indexAllLinkedThreads()` for all pre-linked threads |

---

## Security & Encryption

- Emails contain confidential legal data
- RAG already uses encrypted storage (`SealedMarkdownStore` + `rag-core` SQLCipher)
- Email content flows through existing RAG encryption pipeline
- No additional encryption needed in `EmailIndexer`

---

## Testing Checklist

- [x] TypeScript compilation: `bun run transpile-client` ✅
- [x] RAG extension compile: `bun run gulp compile-extension:safeappeals-rag` ✅
- [x] Email extension compile: `bun run gulp compile-extension:safeappeals-email` ✅
- [ ] Manual test: Link thread → verify appears in Private Search
- [ ] Manual test: Unlink thread → verify removed from Private Search
- [ ] Manual test: Sync new mail on linked thread → verify reindexed
- [ ] Manual test: Restart with pre-linked threads → verify retroactive indexing

---

## Rollout Notes

- Feature flag: `safeappeals.rag.indexCaseEmails` (default `true` — add if needed)
- Graceful degradation if RAG extension not installed/active
- Background indexing with progress for large retroactive batches
- Cross-extension dependency declared so VS Code loads RAG first
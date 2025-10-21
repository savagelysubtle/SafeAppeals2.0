# Rate Limiting & Duplicate Prevention Implementation

## Overview

This document describes the rate limiting system for all LLM providers and the duplicate document indexing prevention in the RAG system.

## 1. Rate Limiting

### Purpose

Prevent API rate limit errors (429 errors) for all LLM providers by:

- Tracking requests per minute
- Tracking tokens per minute (where applicable)
- Implementing exponential backoff for retries
- Spreading requests evenly to avoid burst patterns

### Implementation

**File**: `src/vs/workbench/contrib/void/electron-main/rateLimiter.ts`

The `RateLimiter` class provides:

- Pre-request rate limit checking
- Automatic delay insertion when limits are approaching
- Exponential backoff for rate limit errors
- Provider-specific configuration

### Provider Limits

**Anthropic (Claude)**:

- Requests/minute: 50
- Tokens/minute: 40,000 (Build tier)
- Retries: 3
- Base retry delay: 1 second

**OpenAI (GPT)**:

- Requests/minute: 500
- Tokens/minute: 150,000 (Tier 1)
- Retries: 3
- Base retry delay: 1 second

**Gemini (Google)**:

- Requests/minute: 15
- Tokens/minute: 32,000 (Free tier)
- Retries: 3
- Base retry delay: 1 second

**OpenRouter**:

- Requests/minute: 200
- Tokens/minute: 100,000
- Retries: 3
- Base retry delay: 1 second

### Usage Example

```typescript
import { RateLimiter } from './rateLimiter.js';

// Initialize (singleton instance recommended)
const rateLimiter = new RateLimiter(logService);

// Before making an LLM API request
await rateLimiter.checkRateLimit('anthropic', estimatedTokens);

try {
    // Make API request
    const response = await anthropic.messages.create(...);
} catch (error) {
    if (error.status === 429) {
        // Handle rate limit error with exponential backoff
        const shouldRetry = await rateLimiter.handleRateLimitError('anthropic', retryCount);
        if (shouldRetry) {
            // Retry the request
        }
    }
}

// Check current status
const status = rateLimiter.getStatus('anthropic');
console.log(`Requests: ${status.recentRequests}/${status.limit}`);
console.log(`Tokens: ${status.tokensUsed}/${status.tokenLimit}`);
```

### Integration Points

**Primary Integration**: `src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts`

1. **Import the rate limiter**:

```typescript
import { RateLimiter } from '../rateLimiter.js';
```

2. **Create singleton instance** (at file level):

```typescript
let rateLimiter: RateLimiter | null = null;

function getRateLimiter(logService: ILogService): RateLimiter {
    if (!rateLimiter) {
        rateLimiter = new RateLimiter(logService);
    }
    return rateLimiter;
}
```

3. **Add rate limit check before API calls**:

```typescript
// For Anthropic
case 'anthropic':
    await getRateLimiter(logService).checkRateLimit('anthropic', estimatedTokens);
    // Make API call

// For OpenAI-compatible
case 'openAI':
    await getRateLimiter(logService).checkRateLimit('openai', estimatedTokens);
    // Make API call

// For Gemini
case 'gemini':
    await getRateLimiter(logService).checkRateLimit('gemini', estimatedTokens);
    // Make API call
```

4. **Handle rate limit errors** in error handlers:

```typescript
catch (error) {
    if (error.status === 429 || error.message?.includes('rate limit')) {
        const shouldRetry = await getRateLimiter(logService).handleRateLimitError(providerName, retryCount);
        if (shouldRetry && retryCount < 3) {
            return sendLLMMessage({ ...params, retryCount: retryCount + 1 });
        }
    }
    // Handle other errors
}
```

### Token Estimation

For better rate limiting, estimate tokens before requests:

```typescript
function estimateTokens(messages: Message[]): number {
    let total = 0;
    for (const msg of messages) {
        if (typeof msg.content === 'string') {
            // Rough estimate: 1 token ≈ 4 characters
            total += Math.ceil(msg.content.length / 4);
        }
    }
    return total;
}
```

## 2. Duplicate Document Indexing Prevention

### Purpose

Prevent users from accidentally re-indexing the same document multiple times, which:

- Wastes computational resources
- Creates duplicate embeddings
- Confuses search results
- In the past, would have cost money (now free with local embeddings)

### Implementation

**File**: `src/vs/workbench/contrib/void/browser/ragActions.ts`

Before indexing a document, check if it's already indexed:

```typescript
// Check if document is already indexed
const isAlreadyIndexed = await ragService.isDocumentIndexed(uri);

if (isAlreadyIndexed) {
    notificationService.warn(
        `Document already indexed: ${filename}\n` +
        `Use "RAG: Clear All Embeddings" if you need to re-index.`
    );
    return;
}
```

### How It Works

1. **Document ID Generation**: Each document gets a unique ID based on its file path (SHA-256 hash)
2. **Index Lookup**: Check SQLite database for existing document ID
3. **Early Return**: If found, show warning and skip indexing
4. **User Override**: Users can clear all embeddings via F1 command to force re-indexing

### User Experience

**Scenario 1**: User tries to index a new document

- ✅ Document is indexed normally
- ✅ Success notification shown

**Scenario 2**: User tries to index an already-indexed document

- ⚠️ Warning notification: "Document already indexed: filename.pdf"
- ℹ️ Instruction: "Use 'RAG: Clear All Embeddings' if you need to re-index"
- ✅ No wasted resources

**Scenario 3**: User needs to re-index (after settings change, etc.)

- 🔧 F1 → "RAG: Clear All Embeddings"
- ✅ All documents cleared
- ✅ Can re-index any document

### Tool Integration

The `rag_index_document` tool (used by LLM agents) already includes this check:

**File**: `src/vs/workbench/contrib/void/browser/toolsService.ts`

```typescript
rag_index_document: async ({ uri, isPolicyManual }) => {
    // CRITICAL: Check if document is already indexed
    const isAlreadyIndexed = await this.ragService.isDocumentIndexed(uri);

    if (isAlreadyIndexed) {
        return {
            result: {
                success: true,
                message: `Document already indexed (skipped): ${uri.fsPath}`
            }
        };
    }

    // Proceed with indexing
    const result = await this.ragService.indexDocument({ uri, isPolicyManual });
    return { result };
}
```

This prevents LLM agents from repeatedly trying to index the same document.

## 3. Benefits

### Rate Limiting Benefits

- ✅ No more 429 errors from API providers
- ✅ Predictable, consistent API usage
- ✅ Automatic retry with exponential backoff
- ✅ Prevents burst patterns that trigger limits
- ✅ Provider-specific configuration
- ✅ Token-aware rate limiting

### Duplicate Prevention Benefits

- ✅ No wasted computational resources
- ✅ No duplicate embeddings in vector store
- ✅ Cleaner search results
- ✅ Better user experience
- ✅ Cost savings (historically, now always free with local embeddings)
- ✅ Prevents LLM agents from getting stuck in retry loops

## 4. Testing

### Rate Limiting Tests

1. **Normal Usage**:
   - Make several chat requests
   - Verify requests are spaced out
   - Check logs for rate limit status

2. **Burst Test**:
   - Make many requests simultaneously
   - Verify automatic delays are inserted
   - Confirm no 429 errors

3. **Limit Exceeded Test**:
   - Trigger rate limit error (make >50 requests/min to Anthropic)
   - Verify exponential backoff
   - Confirm automatic retry

### Duplicate Prevention Tests

1. **First Index**:
   - Index a new document
   - Verify success

2. **Duplicate Attempt**:
   - Try to index the same document again
   - Verify warning notification
   - Confirm no re-indexing

3. **After Clear**:
   - Clear all embeddings
   - Index previously indexed document
   - Verify it works

## 5. Configuration

### Adjusting Rate Limits

Edit `src/vs/workbench/contrib/void/electron-main/rateLimiter.ts`:

```typescript
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
    anthropic: {
        requestsPerMinute: 50,  // ← Adjust based on your tier
        tokensPerMinute: 40000, // ← Adjust based on your tier
        maxRetries: 3,
        retryDelayMs: 1000
    },
    // ...
};
```

### Common Tier Limits

**Anthropic**:

- Free: 5 RPM, 10k TPM
- Build: 50 RPM, 40k TPM
- Scale: 1000 RPM, 400k TPM

**OpenAI**:

- Tier 1: 500 RPM, 150k TPM
- Tier 2: 5000 RPM, 450k TPM

Check provider documentation for your specific limits.

## 6. Troubleshooting

### Still Getting 429 Errors?

1. **Verify your tier**: Check your API plan limits
2. **Lower the limits**: Set more conservative values
3. **Check logs**: Look for rate limit status messages
4. **Wait longer**: Increase `retryDelayMs`

### Documents Still Re-Indexing?

1. **Check console**: Look for "already indexed" messages
2. **Verify file path**: Different paths = different document IDs
3. **Clear and restart**: Use "Clear All Embeddings" command

## 7. Future Enhancements

- [ ] Dynamic rate limit adjustment based on API response headers
- [ ] Per-user rate limit tracking (multi-user setups)
- [ ] Rate limit persistence across application restarts
- [ ] Configurable rate limits via settings UI
- [ ] Rate limit status indicator in UI
- [ ] Smart retry strategies based on error types

---

**Last Updated**: October 2025

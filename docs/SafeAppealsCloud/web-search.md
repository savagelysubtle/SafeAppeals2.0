# Web Search Pricing

This document covers Brave Search integration, pricing, and configuration in SafeAppeals Cloud.

## Overview

SafeAppeals uses Brave Search API for web search capabilities. Search requests are routed through a dedicated microservice and charged to users in tokens.

## Brave Search API Tiers

| Tier | Monthly Cost | Rate Limit | Monthly Limit | Features |
|------|--------------|------------|---------------|----------|
| **Free** | $0 | 1 req/sec | 2,000 | Basic web search |
| **Base** | $5/1000 req | 20 req/sec | 20M | + Infobox, FAQ, Locations |
| **Pro** | $9/1000 req | 50 req/sec | Unlimited | + Schema-enriched, Summarizer |

### Current Status

- **Active**: Free tier (for development/low volume)
- **Future**: Pro tier ($9/month when scaling)

## Pricing Model

### Your Costs (Provider)

| Tier | Cost per Search |
|------|-----------------|
| Free | $0.00 |
| Base | $0.005 |
| Pro | $0.009 |

### User Charges

Users pay in tokens based on the token pack rate:

```
Token Pack Rate: $30 / 700,000 tokens = $0.0000428/token
```

To charge ~1 penny ($0.01) per search:

```
$0.01 / $0.0000428 = 233 tokens
Rounded to: 250 tokens per search
```

### Economics Summary

| Item | Value |
|------|-------|
| User pays | 250 tokens = ~$0.0107 |
| Your cost (Pro) | $0.009 |
| Your profit | $0.0017 (19% margin) |

### Break-Even Analysis

With Brave Pro ($9/month):
- Break-even: 900 searches/month
- Per $30 token pack: ~2,800 searches possible
- Per $65 token pack: ~8,000 searches possible
- Per $130 token pack: ~20,000 searches possible

## Architecture

```
┌─────────────────────┐
│  SafeAppeals App    │
│  (Desktop Client)   │
└──────────┬──────────┘
           │ cloudWebSearch()
           ▼
┌─────────────────────┐
│  Cloud API Gateway  │
│  /web-search        │
│  - Auth check       │
│  - Credit check     │
│  - Credit deduction │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Brave Search       │
│  Microservice       │
│  - Rate limiting    │
│  - API key mgmt     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Brave Search API   │
│  api.search.brave.com
└─────────────────────┘
```

## Configuration

### Credit Cost

**In Cloud API** (`void-cloud/api/src/routes/web-search.ts`):

```typescript
// Token pack pricing: $30 = 700K tokens, $65 = 2M tokens, $130 = 5M tokens
// Therefore: 1 token = $0.0000428
// To charge ~1 penny ($0.01) per search: $0.01 / $0.0000428 = 233 tokens
// We round to 250 tokens for clean math + margin
const WEB_SEARCH_CREDIT_COST = 250;
```

**In Desktop App** (`src/vs/workbench/contrib/void/electron-main/tools/cloudWebSearchService.ts`):

```typescript
const WEB_SEARCH_CREDIT_COST = 250; // 250 tokens per web search (~1 penny)
```

### Brave API Key

Set in environment:

```bash
# In brave-search-service
BRAVE_SEARCH_API_KEY=BSAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Service URLs

```bash
# In cloud API
BRAVE_SEARCH_URL=https://brave-search-service.up.railway.app

# For local development
BRAVE_SEARCH_URL=http://localhost:3001
```

## API Endpoints

### Single Search

**Endpoint:** `POST /web-search`

**Request:**
```json
{
  "query": "workers compensation appeal deadline california",
  "count": 10,
  "offset": 0
}
```

**Response:**
```json
{
  "results": [
    {
      "title": "California Workers' Comp Appeals Board",
      "url": "https://example.com/...",
      "description": "...",
      "age": "2 days ago"
    }
  ],
  "totalResults": 10,
  "creditsUsed": 250,
  "creditsRemaining": 449750
}
```

### Multi-Search (Batch)

**Endpoint:** `POST /web-search/multi`

**Request:**
```json
{
  "queries": [
    "california workers comp deadline",
    "WCAB appeal process",
    "permanent disability rating"
  ],
  "count": 10
}
```

**Response:**
```json
{
  "searchResults": [
    {
      "query": "california workers comp deadline",
      "results": [...],
      "totalResults": 10
    },
    ...
  ],
  "totalCreditsUsed": 750,
  "creditsRemaining": 449000
}
```

## Database Tracking

### Model Pricing Entry

```sql
-- brave_search entries in model_pricing
SELECT * FROM model_pricing WHERE provider = 'brave_search';

-- Results:
-- model_name         | input_cost_per_million | is_active
-- brave_search_free  | 0.00                   | true
-- brave_search_base  | 5000.00                | false
-- brave_search_pro   | 9000.00                | false
```

Note: For web search, `input_cost_per_million` represents cost per million **requests**, not tokens.

### Usage Logging

Each search is logged with:

```sql
INSERT INTO usage_logs (
    user_id,
    model,              -- 'brave_search_pro' or 'brave_search_free'
    input_tokens,       -- 1 (represents 1 request)
    output_tokens,      -- 0
    total_tokens,       -- 1
    credits_charged,    -- 250
    request_id          -- 'ws_1703350000_abc123'
) VALUES (...);
```

## Changing the Credit Cost

### To Increase/Decrease Price Per Search

1. **Calculate new token amount:**
   ```
   New tokens = Desired price / $0.0000428

   For $0.02 (2 pennies):
   $0.02 / $0.0000428 = 467 tokens
   ```

2. **Update Cloud API:**
   ```typescript
   // void-cloud/api/src/routes/web-search.ts
   const WEB_SEARCH_CREDIT_COST = 467;
   ```

3. **Update Desktop App:**
   ```typescript
   // src/vs/workbench/contrib/void/electron-main/tools/cloudWebSearchService.ts
   const WEB_SEARCH_CREDIT_COST = 467;
   ```

4. **Deploy:**
   ```bash
   # Cloud API
   cd void-cloud && git push

   # Desktop App
   bun run compile
   ```

## Upgrading Brave Tier

### When to Upgrade

- When you exceed 2,000 searches/month (free tier limit)
- When you need faster rate limits (>1 req/sec)
- When you need premium features (Summarizer, etc.)

### How to Upgrade

1. **Get Pro API key** from [Brave Search API Dashboard](https://api-dashboard.search.brave.com)

2. **Update environment variable:**
   ```bash
   BRAVE_SEARCH_API_KEY=your_new_pro_key
   ```

3. **Update database to track Pro pricing:**
   ```sql
   UPDATE model_pricing
   SET is_active = false
   WHERE model_name = 'brave_search_free';

   UPDATE model_pricing
   SET is_active = true
   WHERE model_name = 'brave_search_pro';
   ```

4. **Redeploy Brave Search Service**

## Rate Limiting

### Brave API Limits

| Tier | Requests/Second |
|------|-----------------|
| Free | 1 |
| Base | 20 |
| Pro | 50 |

### Service Implementation

The Brave Search Service handles rate limiting:

```javascript
// In multi-search, delay between requests
if (i > 0) {
    await new Promise(resolve => setTimeout(resolve, 1100)); // 1.1 seconds
}
```

### API Gateway Rate Limits

Additional rate limiting in the Cloud API:

```typescript
const rateLimitResult = await rateLimit(request, reply, "web-search:user");
```

## Error Handling

### Insufficient Credits

```json
{
  "status": 402,
  "error": "Insufficient credits"
}
```

### Rate Limit Exceeded

```json
{
  "status": 429,
  "error": "Web search rate limit exceeded. Please try again later."
}
```

### Brave API Error

```json
{
  "status": 500,
  "error": "Search service temporarily unavailable"
}
```

### Credit Refund on Failure

If the search fails after credits are deducted, they are refunded:

```typescript
if (!searchResponse.ok) {
    // Refund credits on search failure
    await supabase
        .from('profiles')
        .update({ credits_balance: currentBalance + WEB_SEARCH_CREDIT_COST })
        .eq('id', user.id);
    throw new Error(`Brave Search service error: ${searchResponse.status}`);
}
```

## Monitoring

### Search Volume

```sql
SELECT
    DATE_TRUNC('day', created_at) AS day,
    COUNT(*) AS searches
FROM usage_logs
WHERE model LIKE 'brave_search%'
GROUP BY 1
ORDER BY 1 DESC;
```

### Search Costs

```sql
SELECT
    DATE_TRUNC('month', created_at) AS month,
    COUNT(*) AS total_searches,
    COUNT(*) * 0.009 AS estimated_cost_usd  -- Assuming Pro tier
FROM usage_logs
WHERE model LIKE 'brave_search%'
GROUP BY 1;
```

### User Search Usage

```sql
SELECT
    user_id,
    COUNT(*) AS search_count,
    SUM(credits_charged) AS total_credits_used
FROM usage_logs
WHERE model LIKE 'brave_search%'
AND created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY search_count DESC;
```

---

**See Also:**
- [Credit System](./credit-system.md)
- [Model Pricing](./model-pricing.md)
- [Configuration Guide](./configuration.md)


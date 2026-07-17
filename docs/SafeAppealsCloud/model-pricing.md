# Model Pricing

This document covers all AI model pricing in SafeAppeals Cloud, including how to update pricing and the relationship between provider costs and user charges.

## Pricing Overview

SafeAppeals uses a **pass-through pricing model** with markup:

```
User Charge = Provider Cost + Margin
```

| Component | Description |
|-----------|-------------|
| **Provider Cost** | What we pay OpenAI, Anthropic, Google, etc. |
| **User Charge** | What the user pays (in tokens/credits) |
| **Margin** | Our profit per request |

## Current Model Pricing

### Active Models (December 2024)

Synced with `void-cloud/litellm/config.yaml`:

| Model | Provider | Input $/MTok | Output $/MTok | Use Case |
|-------|----------|--------------|---------------|----------|
| `gpt-5.2` | OpenAI | $1.75 | $14.00 | General coding, agents |
| `gpt-5.2-pro` | OpenAI | $21.00 | $168.00 | Complex reasoning, 400K context |
| `claude-opus-4-5` | Anthropic | $5.00 | $25.00 | Premium flagship |
| `claude-sonnet-4-5` | Anthropic | $3.00 | $15.00 | Best balance quality/speed |
| `gemini-3-pro-preview` | Google | $2.00 | $12.00 | Latest Google flagship |
| `gemini-2.5-pro` | Google | $1.25 | $10.00 | Production ready |
| `gemini-2.5-flash` | Google | $0.15 | $0.60 | High-volume, fast |

### Web Search Pricing

| Tier | Cost per 1,000 Requests | Monthly Limit | Status |
|------|-------------------------|---------------|--------|
| `brave_search_free` | $0 | 2,000 | ✅ Active |
| `brave_search_base` | $5 | 20M | ⚫ Inactive |
| `brave_search_pro` | $9 | Unlimited | ⚫ Inactive |

### Inactive/Legacy Models

Kept for historical usage logs:

| Model | Provider | Status | Replaced By |
|-------|----------|--------|-------------|
| `gpt-5` | OpenAI | ⚫ Inactive | `gpt-5.2` |
| `gpt-5-mini` | OpenAI | ⚫ Inactive | - |
| `gpt-5-nano` | OpenAI | ⚫ Inactive | - |
| `gemini-3-pro` | Google | ⚫ Inactive | `gemini-3-pro-preview` |
| `claude-opus-4-1` | Anthropic | ⚫ Inactive | `claude-opus-4-5` |

## How Pricing Works

### 1. LiteLLM Config (Source of Truth)

The `void-cloud/litellm/config.yaml` file defines model routing and **actual provider costs**:

```yaml
model_list:
  - model_name: gpt-5.2
    litellm_params:
      model: openai/gpt-5.2
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      input_cost_per_token: 0.00000175   # $1.75/MTok
      output_cost_per_token: 0.000014    # $14/MTok
```

### 2. Supabase `model_pricing` Table

The database table stores pricing for **cost tracking and analytics**:

```sql
SELECT model_name, provider, input_cost_per_million, output_cost_per_million, is_active
FROM model_pricing
WHERE is_active = true;
```

### 3. App Model Definitions

The app has model definitions in `src/vs/workbench/contrib/void/common/models/`:

```typescript
// src/vs/workbench/contrib/void/common/models/openai/index.ts
export const openAIModelOptions = {
  'gpt-5.2': {
    contextWindow: 128_000,
    cost: { input: 1.75, output: 14.00 },
    // ...
  },
}
```

## Updating Pricing

### Step 1: Update LiteLLM Config

Edit `void-cloud/litellm/config.yaml`:

```yaml
- model_name: gpt-5.2
  litellm_params:
    model: openai/gpt-5.2
    api_key: os.environ/OPENAI_API_KEY
  model_info:
    input_cost_per_token: 0.00000175   # $1.75/MTok - UPDATE THIS
    output_cost_per_token: 0.000014    # $14/MTok - UPDATE THIS
```

### Step 2: Update Supabase

Run SQL migration or use Supabase MCP:

```sql
UPDATE model_pricing
SET
    input_cost_per_million = 1.75,    -- New input price
    output_cost_per_million = 14.00,  -- New output price
    updated_at = NOW()
WHERE model_name = 'gpt-5.2';
```

Or create a migration file:

```sql
-- void-cloud/supabase/migrations/007_update_pricing.sql
UPDATE model_pricing
SET input_cost_per_million = 1.75, output_cost_per_million = 14.00
WHERE model_name = 'gpt-5.2';
```

### Step 3: Update App Model Definitions

Edit the provider file in `src/vs/workbench/contrib/void/common/models/`:

```typescript
'gpt-5.2': {
  cost: { input: 1.75, output: 14.00 },  // Update here
}
```

### Step 4: Deploy Changes

```bash
# Rebuild app
bun run compile

# Deploy LiteLLM (if on Railway)
cd void-cloud
git add -A && git commit -m "Update model pricing"
git push  # Railway auto-deploys
```

## Adding New Models

### 1. Add to LiteLLM Config

```yaml
- model_name: new-model-name
  litellm_params:
    model: provider/actual-model-id
    api_key: os.environ/PROVIDER_API_KEY
  model_info:
    input_cost_per_token: 0.000001    # $/token
    output_cost_per_token: 0.000005   # $/token
```

### 2. Add to Supabase

```sql
INSERT INTO model_pricing (model_name, provider, input_cost_per_million, output_cost_per_million, is_active)
VALUES ('new-model-name', 'provider', 1.00, 5.00, true);
```

### 3. Add to App

Create or update provider file:

```typescript
// src/vs/workbench/contrib/void/common/models/provider/index.ts
export const providerModelOptions = {
  'new-model-name': {
    contextWindow: 128_000,
    reservedOutputTokenSpace: 8_192,
    cost: { input: 1.00, output: 5.00 },
    downloadable: false,
    supportsFIM: false,
    specialToolFormat: 'openai-style',
    supportsSystemMessage: 'separated',
  },
}
```

## Cost Calculation

### Formula

```
Input Cost = (input_tokens / 1,000,000) × input_cost_per_million
Output Cost = (output_tokens / 1,000,000) × output_cost_per_million
Total Cost = Input Cost + Output Cost
```

### Example

For a request with 5,000 input tokens and 1,000 output tokens using `gpt-5.2`:

```
Input Cost  = (5,000 / 1,000,000) × $1.75 = $0.00875
Output Cost = (1,000 / 1,000,000) × $14.00 = $0.014
Total Cost  = $0.00875 + $0.014 = $0.02275
```

### Database Function

The `calculate_request_cost` function does this automatically:

```sql
SELECT * FROM calculate_request_cost('gpt-5.2', 5000, 1000);
-- Returns: input_cost: 0.00875, output_cost: 0.014, total_cost: 0.02275
```

## Price Monitoring

### Check Current Pricing

```sql
SELECT
    model_name,
    provider,
    input_cost_per_million as "Input $/MTok",
    output_cost_per_million as "Output $/MTok",
    is_active
FROM model_pricing
ORDER BY provider, model_name;
```

### Compare with Provider Pricing

Regularly check provider pricing pages:

- **OpenAI**: https://openai.com/api/pricing
- **Anthropic**: https://www.anthropic.com/pricing
- **Google**: https://ai.google.dev/gemini-api/docs/models

### Usage Analytics

```sql
-- Cost by model (last 30 days)
SELECT * FROM cost_by_model;

-- Daily costs
SELECT * FROM daily_cost_summary;

-- User costs
SELECT * FROM user_cost_summary;
```

## Pricing Strategy

### Current Markup

Based on token pack pricing (rate varies by tier):
- **$30** = 700,000 tokens (Starter: $42.86/MTok)
- **$65** = 2,000,000 tokens (Pro: $32.50/MTok)
- **$130** = 5,000,000 tokens (Power: $26.00/MTok)

### Margin Calculation

For `gpt-5.2` (most used model), provider cost ~$5.50/MTok average:
```
Starter ($42.86/MTok): Margin ~87%
Pro ($32.50/MTok):     Margin ~83%
Power ($26.00/MTok):   Margin ~79%
```

For `gemini-2.5-flash` (cheapest), provider cost ~$0.30/MTok average:
```
Starter ($42.86/MTok): Margin ~99%
Pro ($32.50/MTok):     Margin ~99%
Power ($26.00/MTok):   Margin ~99%
```

### Break-Even Analysis

If you want to break even on a specific model:

```
Break-even tokens = Pack Price / Provider Cost per Token

For gpt-5.2-pro ($21 input, $168 output), assuming 80% input, 20% output:
Avg cost = (0.8 × $21) + (0.2 × $168) = $50.40/MTok

Starter ($30): Break-even = $30 / $0.0000504 = 595,238 tokens
Pro ($65):     Break-even = $65 / $0.0000504 = 1,289,683 tokens
Power ($130):  Break-even = $130 / $0.0000504 = 2,579,365 tokens
```

## Troubleshooting

### Model Not Found

If `calculate_request_cost` returns 0:

```sql
-- Check if model exists
SELECT * FROM model_pricing WHERE model_name = 'your-model-name';

-- Check if active
SELECT * FROM model_pricing WHERE model_name = 'your-model-name' AND is_active = true;
```

### Pricing Mismatch

If LiteLLM and Supabase have different prices:

```bash
# Check LiteLLM config
cat void-cloud/litellm/config.yaml | grep -A5 "model_name: your-model"

# Check Supabase
# Use MCP or run SQL
```

---

**See Also:**
- [Credit System](./credit-system.md)
- [Web Search Pricing](./web-search.md)
- [Configuration Guide](./configuration.md)


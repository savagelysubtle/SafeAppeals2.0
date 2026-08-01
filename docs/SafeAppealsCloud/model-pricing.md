# Model Pricing

This document covers AI model pricing in SafeAppeals Cloud, how to update it, and how provider costs relate to user charges.

## Pricing Overview

SafeAppeals uses a **pass-through pricing model** with markup:

```
User Charge = Provider Cost + Margin
```

| Component | Description |
|-----------|-------------|
| **Provider Cost** | What we pay OpenAI, Anthropic, xAI, Google, etc. |
| **User Charge** | What the user pays (in tokens/credits) |
| **Margin** | Our profit per request |

## Current Model Pricing

### Active Models (July 2026)

Synced with `void-cloud/litellm/config.yaml` and `GET /models` in `void-cloud/api/src/routes/llm.ts`:

| Model | Provider | Input $/MTok | Output $/MTok | Tier |
|-------|----------|--------------|---------------|------|
| `gpt-5.6-sol` | OpenAI | $5.00 | $30.00 | premium |
| `gpt-5.6` | OpenAI | $5.00 | $30.00 | premium (alias → sol) |
| `gpt-5.6-terra` | OpenAI | $2.00 | $12.00 | standard |
| `gpt-5.6-luna` | OpenAI | $0.20 | $1.20 | economy |
| `gpt-5.4` | OpenAI | $2.50 | $15.00 | premium |
| `gpt-5.2` | OpenAI | $1.75 | $14.00 | standard |
| `claude-opus-5` | Anthropic | $5.00 | $25.00 | premium |
| `claude-sonnet-5` | Anthropic | $2.00* | $10.00* | standard |
| `claude-fable-5` | Anthropic | $10.00 | $50.00 | premium |
| `claude-haiku-4-5` | Anthropic | $1.00 | $5.00 | economy |
| `claude-opus-4-6` | Anthropic | $5.00 | $25.00 | premium |
| `claude-sonnet-4-6` | Anthropic | $3.00 | $15.00 | standard |
| `grok-4.5` | xAI | $2.00 | $6.00 | standard |
| `grok-4.3` | xAI | $1.25 | $2.50 | economy |
| `gemini-3-pro` | Google | $2.00 | $12.00 | premium |
| `gemini-3.6-flash` | Google | ~$0.30† | ~$2.50† | economy |
| `gemini-2.5-pro` | Google | $1.25 | $10.00 | premium |
| `gemini-2.5-flash` | Google | $0.15 | $0.60 | standard |

\* Sonnet 5 intro pricing thru Aug 31 2026; then $3/$15.  
† Estimated pending Google publish.

### Web Search Pricing

| Tier | Cost per 1,000 Requests | Monthly Limit | Status |
|------|-------------------------|---------------|--------|
| `brave_search_free` | $0 | 2,000 | ✅ Active |
| `brave_search_base` | $5 | 20M | ⚫ Inactive |
| `brave_search_pro` | $9 | Unlimited | ⚫ Inactive |

### Inactive / Legacy Models

Kept for historical usage logs (soft-deactivated in migration `008_model_pricing_jul2026.sql`):

| Model | Provider | Replaced By |
|-------|----------|-------------|
| `gpt-5`, `gpt-5.1`, `gpt-5.1-codex-max` | OpenAI | GPT-5.6 family |
| `gpt-5.2-pro`, `gpt-5-mini`, `gpt-5-nano` | OpenAI | `gpt-5.6-sol` / `gpt-5.6-luna` |
| Dated Claude 4.5 / 4.1 ids | Anthropic | Claude 5 + 4.6 |
| `claude-opus-4.6` / `claude-sonnet-4.6` (dot form) | Anthropic | hyphenated `claude-*-4-6` |
| `gemini-3-pro-preview` | Google | `gemini-3-pro` |

## How Pricing Works

### 1. LiteLLM Config (Source of Truth for Routing + Provider Cost)

`void-cloud/litellm/config.yaml`:

```yaml
- model_name: gpt-5.6-sol
  litellm_params:
    model: openai/gpt-5.6-sol
    api_key: os.environ/OPENAI_API_KEY
  model_info:
    input_cost_per_token: 0.000005     # $5/MTok
    output_cost_per_token: 0.00003     # $30/MTok
```

### 2. Supabase `model_pricing` Table

Used for cost tracking and analytics:

```sql
SELECT model_name, provider, input_cost_per_million, output_cost_per_million, is_active
FROM model_pricing
WHERE is_active = true
ORDER BY provider, model_name;
```

Latest sync migration: `void-cloud/supabase/migrations/008_model_pricing_jul2026.sql`.

### 3. API Model Catalog

`void-cloud/api/src/routes/llm.ts` — `GET /models` returns ids that **must** match LiteLLM `model_name` exactly (the chat handler forwards `body.model` to LiteLLM).

## Updating Pricing

### Step 1: Update LiteLLM Config

Edit `void-cloud/litellm/config.yaml` costs (`input_cost_per_token` / `output_cost_per_token` = $/MTok ÷ 1e6).

### Step 2: Update Supabase

Prefer a new migration (do not edit old ones):

```sql
-- void-cloud/supabase/migrations/00N_update_pricing.sql
UPDATE model_pricing
SET
    input_cost_per_million = 5.00,
    output_cost_per_million = 30.00,
    updated_at = NOW()
WHERE model_name = 'gpt-5.6-sol';
```

### Step 3: Update API Catalog

Keep `inputCost` / `outputCost` in `GET /models` aligned ($/MTok numbers).

### Step 4: Deploy

Redeploy LiteLLM and the API service after config/catalog changes.

## Adding New Models

1. Add to `void-cloud/litellm/config.yaml`.
2. Add matching `id` to `GET /models` in `llm.ts`.
3. Insert into `model_pricing` via migration.
4. Add provider env key if needed (`XAI_API_KEY`, etc.).

```sql
INSERT INTO model_pricing (model_name, provider, input_cost_per_million, output_cost_per_million, is_active)
VALUES ('new-model-name', 'provider', 1.00, 5.00, true);
```

## Cost Calculation

```
Input Cost = (input_tokens / 1,000,000) × input_cost_per_million
Output Cost = (output_tokens / 1,000,000) × output_cost_per_million
Total Cost = Input Cost + Output Cost
```

Example — 5,000 in / 1,000 out on `gpt-5.6-terra` ($2 / $12):

```
Input Cost  = (5,000 / 1,000,000) × $2.00  = $0.01
Output Cost = (1,000 / 1,000,000) × $12.00 = $0.012
Total Cost  = $0.022
```

```sql
SELECT * FROM calculate_request_cost('gpt-5.6-terra', 5000, 1000);
```

## Price Monitoring

Provider pricing pages:

- **OpenAI**: https://developers.openai.com/api/docs/models
- **Anthropic**: https://platform.claude.com/docs/en/about-claude/models/overview
- **xAI**: https://docs.x.ai/developers/models
- **Google**: https://ai.google.dev/gemini-api/docs/models

```sql
SELECT * FROM cost_by_model;
SELECT * FROM daily_cost_summary;
```

## Pricing Strategy

Token pack sell rates (approx.):

- **$30** = 700,000 tokens (Starter: $42.86/MTok)
- **$65** = 2,000,000 tokens (Pro: $32.50/MTok)
- **$130** = 5,000,000 tokens (Power: $26.00/MTok)

Margins stay healthy on economy models (`gpt-5.6-luna`, `gemini-2.5-flash`, `grok-4.3`) and thinner on premium flagships (`claude-fable-5`, `gpt-5.6-sol`).

## Troubleshooting

### Model Not Found / Zero Cost

```sql
SELECT * FROM model_pricing WHERE model_name = 'your-model-name' AND is_active = true;
```

Confirm the id matches LiteLLM `model_name` and the API catalog id.

### Pricing Mismatch

```bash
rg "model_name:" void-cloud/litellm/config.yaml
# Compare with GET /models ids and model_pricing rows
```

---

**See Also:**
- [LiteLLM Configuration](./litellm-config.md)
- [Credit System](./credit-system.md)
- [Web Search Pricing](./web-search.md)
- [Configuration Guide](./configuration.md)

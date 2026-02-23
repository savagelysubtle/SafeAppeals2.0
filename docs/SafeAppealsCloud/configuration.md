# Configuration Guide

This document covers all configuration options for SafeAppeals Cloud.

## Quick Reference

| What to Configure | File/Location |
|-------------------|---------------|
| AI Model routing | `void-cloud/litellm/config.yaml` |
| Model pricing (DB) | Supabase `model_pricing` table |
| Model definitions (App) | `src/vs/workbench/contrib/void/common/models/` |
| Token pack pricing | `void-cloud/api/src/routes/credits.ts` |
| Web search credit cost | `void-cloud/api/src/routes/web-search.ts` |
| Environment variables | Railway dashboard / `.env` files |

## LiteLLM Configuration

### File Location

```
void-cloud/litellm/config.yaml
```

### Structure

```yaml
model_list:
  - model_name: <shorthand-name>
    litellm_params:
      model: <provider>/<actual-model-id>
      api_key: os.environ/<ENV_VAR_NAME>
    model_info:
      input_cost_per_token: <cost>
      output_cost_per_token: <cost>

litellm_settings:
  set_verbose: true
  return_usage: true
  cache: false
  request_timeout: 600

general_settings:
  master_key: os.environ/LITELLM_MASTER_KEY
  disable_spend_logs: true
  allow_requests_on_db_unavailable: true
```

### Adding a New Model

```yaml
- model_name: my-new-model
  litellm_params:
    model: openai/gpt-4-turbo
    api_key: os.environ/OPENAI_API_KEY
  model_info:
    input_cost_per_token: 0.00001    # $10/MTok
    output_cost_per_token: 0.00003   # $30/MTok
```

### Supported Providers

| Provider | Prefix | Example |
|----------|--------|---------|
| OpenAI | `openai/` | `openai/gpt-4o` |
| Anthropic | `anthropic/` | `anthropic/claude-3-opus-20240229` |
| Google | `gemini/` | `gemini/gemini-1.5-pro` |
| Azure OpenAI | `azure/` | `azure/gpt-4` |
| Ollama | `ollama/` | `ollama/llama3` |
| vLLM | `openai/` | (with custom base URL) |

## Supabase Configuration

### Model Pricing Table

```sql
-- View current pricing
SELECT * FROM model_pricing ORDER BY provider, model_name;

-- Add new model
INSERT INTO model_pricing (model_name, provider, input_cost_per_million, output_cost_per_million, is_active)
VALUES ('new-model', 'provider', 1.00, 5.00, true);

-- Update pricing
UPDATE model_pricing
SET input_cost_per_million = 2.00, output_cost_per_million = 10.00
WHERE model_name = 'existing-model';

-- Deactivate model
UPDATE model_pricing SET is_active = false WHERE model_name = 'old-model';
```

### RLS Policies

The `model_pricing` table has RLS enabled:
- **Read**: Authenticated users can read all pricing
- **Write**: Only `service_role` can modify

```sql
-- Check policies
SELECT * FROM pg_policy WHERE polrelid = 'public.model_pricing'::regclass;
```

## Token Pack Configuration

### File Location

```
void-cloud/api/src/routes/credits.ts
```

### Current Configuration

```typescript
const CREDIT_PACKS = {
    starter: {
        priceId: process.env.STRIPE_PRICE_STARTER!,
        credits: 700_000,
        amount: 3000, // $30.00 in cents
    },
    pro: {
        priceId: process.env.STRIPE_PRICE_PRO!,
        credits: 1_400_000,
        amount: 6000, // $60.00 in cents
    },
};
```

### Adding a New Pack

1. **Create Stripe Price** in Stripe Dashboard

2. **Add environment variable:**
   ```bash
   STRIPE_PRICE_ENTERPRISE=price_xxxxx
   ```

3. **Update code:**
   ```typescript
   const CREDIT_PACKS = {
       // ... existing packs
       enterprise: {
           priceId: process.env.STRIPE_PRICE_ENTERPRISE!,
           credits: 5_000_000,
           amount: 15000, // $150.00 in cents
       },
   };
   ```

4. **Update packs endpoint:**
   ```typescript
   app.get("/packs", async () => {
       return {
           packs: [
               // ... existing packs
               {
                   id: "enterprise",
                   name: "Enterprise Pack",
                   credits: 5_000_000,
                   price: 150.0,
                   currency: "USD",
                   description: "5,000,000 tokens",
               },
           ],
       };
   });
   ```

## Web Search Configuration

### Credit Cost

**Cloud API** (`void-cloud/api/src/routes/web-search.ts`):

```typescript
const WEB_SEARCH_CREDIT_COST = 250; // tokens per search
```

**Desktop App** (`src/vs/workbench/contrib/void/electron-main/tools/cloudWebSearchService.ts`):

```typescript
const WEB_SEARCH_CREDIT_COST = 250;
```

### Timeout

```typescript
const WEB_SEARCH_TIMEOUT_MS = 30000; // 30 seconds
```

### Service URL

```bash
# Production
BRAVE_SEARCH_URL=https://brave-search-service.up.railway.app

# Development
BRAVE_SEARCH_URL=http://localhost:3001
```

## Environment Variables

### API Gateway (`void-cloud/api/`)

```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...
STRIPE_PRICE_POWER=price_...

# Services
BRAVE_SEARCH_URL=https://brave-search-service.up.railway.app
LITELLM_URL=https://litellm-proxy.up.railway.app

# App
FRONTEND_URL=https://safeappeals.com
NODE_ENV=production
PORT=3000
```

### LiteLLM Proxy (`void-cloud/litellm/`)

```bash
LITELLM_MASTER_KEY=sk-litellm-...

# AI Providers
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
XAI_API_KEY=xai-...
```

### Brave Search Service (`void-cloud/brave-search-service/`)

```bash
BRAVE_SEARCH_API_KEY=BSA...
PORT=3001
NODE_ENV=production
```

### Desktop App

```bash
# In .env or environment
VOID_CLOUD_API_URL=https://void-cloud-production.up.railway.app
```

## App Model Definitions

### File Structure

```
src/vs/workbench/contrib/void/common/models/
├── index.ts              # Exports all providers
├── types.ts              # Type definitions
├── anthropic/
│   └── index.ts          # Claude models
├── openai/
│   └── index.ts          # GPT models
├── google/
│   └── index.ts          # Gemini models
└── ...
```

### Model Definition Structure

```typescript
export const providerModelOptions = {
    'model-name': {
        contextWindow: 128_000,
        reservedOutputTokenSpace: 8_192,
        cost: {
            input: 1.75,      // $/MTok
            output: 14.00,    // $/MTok
            cache_read: 0.175 // Optional
        },
        downloadable: false,
        supportsFIM: false,
        specialToolFormat: 'openai-style',
        supportsSystemMessage: 'separated',
        reasoningCapabilities: {
            supportsReasoning: true,
            canIOReasoning: true,
        },
    },
} as const satisfies { [s: string]: VoidStaticModelInfo };
```

### Adding a New Provider

1. **Create provider directory:**
   ```
   src/vs/workbench/contrib/void/common/models/newprovider/index.ts
   ```

2. **Define models:**
   ```typescript
   import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

   export const newProviderModelOptions = {
       'model-1': { ... },
       'model-2': { ... },
   } as const satisfies { [s: string]: VoidStaticModelInfo };

   export const newProviderSettings: VoidStaticProviderInfo = {
       modelOptions: newProviderModelOptions,
       modelOptionsFallback: (modelName) => { ... },
   };
   ```

3. **Export from index:**
   ```typescript
   // src/vs/workbench/contrib/void/common/models/index.ts
   export * from './newprovider/index.js';
   ```

## Railway Deployment

### Service Configuration

Each service has a `railway.toml`:

```toml
[build]
builder = "dockerfile"
dockerfilePath = "./Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "always"
```

### Environment Variables in Railway

1. Go to Railway Dashboard
2. Select your project
3. Click on the service
4. Go to "Variables" tab
5. Add/edit variables

### Redeploying

```bash
# Push changes
cd void-cloud
git add -A
git commit -m "Configuration update"
git push

# Railway auto-deploys on push
```

## Local Development

### Running Services Locally

**API Gateway:**
```bash
cd void-cloud/api
npm install
npm run dev
# Runs on http://localhost:3000
```

**Brave Search Service:**
```bash
cd void-cloud/brave-search-service
npm install
node server.js
# Runs on http://localhost:3001
```

**LiteLLM Proxy:**
```bash
cd void-cloud/litellm
pip install litellm
litellm --config config.yaml --port 4000
# Runs on http://localhost:4000
```

### Local Environment Files

Create `.env` files for each service:

```bash
# void-cloud/api/.env
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
BRAVE_SEARCH_URL=http://localhost:3001
# ... etc
```

## Syncing Configuration

When updating pricing, ensure these are all in sync:

| Source | What to Update |
|--------|----------------|
| LiteLLM config | `model_info.input_cost_per_token` |
| Supabase | `model_pricing` table |
| App models | `cost: { input, output }` |

### Sync Checklist

- [ ] Update `void-cloud/litellm/config.yaml`
- [ ] Run Supabase migration or update via MCP
- [ ] Update app model files in `src/.../common/models/`
- [ ] Rebuild app: `bun run compile`
- [ ] Deploy cloud: `git push` (Railway auto-deploys)
- [ ] Verify pricing: Check logs and test requests

---

**See Also:**
- [Model Pricing](./model-pricing.md)
- [Credit System](./credit-system.md)
- [Deployment Guide](./deployment.md)


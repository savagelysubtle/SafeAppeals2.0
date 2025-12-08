# Void Cloud Credits System - Implementation Specification

> **Document Version:** 1.8
> **Created:** November 30, 2025
> **Last Updated:** December 5, 2025
> **Status:** 🚀 **DEPLOYED** - Full cloud integration complete (needs Anthropic credits)

## 📊 Progress Summary

| Phase                        | Status           | Notes                                      |
| ---------------------------- | ---------------- | ------------------------------------------ |
| Phase 1: Infrastructure      | ✅ Complete      | Railway + Supabase + Stripe all configured |
| Phase 2: API Backend         | ✅ Deployed      | Live at void-cloud-production.up.railway.app |
| Phase 3: LLM Proxy           | ✅ Deployed      | LiteLLM at void-cloudlitellm-production.up.railway.app |
| Phase 4: Desktop Auth        | ✅ Complete      | OAuth flow + URL handler + UI implemented  |
| Phase 5: Desktop Integration | ✅ Complete      | CloudLLMRouterService + per-provider toggle |
| Phase 6: Polish & Testing    | 🔄 In Progress   | Dashboard deployed, testing ongoing        |
| Phase 7: Auto-Update         | ✅ Complete      | VoidUpdateService + MainService implemented |

**Code Location:** `void-cloud/` folder in this workspace

## 🔗 Live Resources

| Resource | URL/Value |
|----------|-----------|
| **Railway API** | `https://void-cloud-production.up.railway.app` |
| **Railway LiteLLM** | `https://void-cloudlitellm-production.up.railway.app` |
| **GitHub Repo** | `https://github.com/savagelysubtle/void-cloud` |
| **Supabase Project** | `totnbmqhkonnqgqhimsy.supabase.co` |
| **Stripe Webhook** | `charismatic-radiance` (ID: `we_1SZJz0AhXjZrIkPTGMbE6oOP`) |
| **Webhook Signing Secret** | *(stored in `.env` and Railway vars)* |

### ⚠️ Action Required
- [x] Fix Stripe webhook URL to include `/webhooks/stripe` path
- [x] Add `STRIPE_WEBHOOK_SECRET` to Railway environment variables
- [x] Deploy LiteLLM proxy to Railway
- [x] Add Anthropic API key to LiteLLM service
- [ ] Add credits to Anthropic account (your API key has $0 balance)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Architecture Overview](#2-architecture-overview)
3. [Design Decisions](#3-design-decisions)
4. [Infrastructure Setup](#4-infrastructure-setup)
5. [Database Schema](#5-database-schema)
6. [API Specification](#6-api-specification)
7. [LiteLLM Configuration](#7-litellm-configuration)
8. [Void Desktop Integration](#8-void-desktop-integration)
9. [Payment Integration](#9-payment-integration)
10. [Implementation Phases](#10-implementation-phases)
11. [Cost Analysis](#11-cost-analysis)
12. [Auto-Update System](#12-auto-update-system)
13. [Legal & Compliance](#13-legal--compliance)
14. [Security Checklist](#14-security-checklist)
15. [Monitoring & Observability](#15-monitoring--observability)
16. [Production Readiness Checklist](#16-production-readiness-checklist)

---

## 1. Executive Summary

### What We're Building

Void Cloud is a **credit-based LLM access service** that allows Void users to access AI models (Claude, GPT, Gemini, etc.) without managing their own API keys. Users purchase credits, and each LLM request deducts credits based on token usage.

### Business Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     VOID PRICING MODEL                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  🆓 BYOK MODE (Always Free)                                    │
│  ─────────────────────────                                     │
│  • Users bring their own API keys                              │
│  • All features available                                       │
│  • No limits, no tracking                                       │
│  • Perfect for: developers, privacy-focused, low-income         │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ☁️ VOID CLOUD (Pay-As-You-Go)                                 │
│  ─────────────────────────────                                 │
│  • No API keys needed                                          │
│  • Purchase credit packs:                                       │
│    • $10 → 250,000 tokens                                      │
│    • $25 → 750,000 tokens (25% bonus)                          │
│  • Credits never expire                                         │
│  • Perfect for: convenience seekers, teams, enterprises         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Key Decisions Summary

| Decision                 | Choice                                                          |
| ------------------------ | --------------------------------------------------------------- |
| Credit Unit              | 1 credit = 1 token                                              |
| Pricing Model            | Pay-As-You-Go only (no subscriptions for MVP)                   |
| Margin                   | 25-30% markup on provider costs                                 |
| Credit Packs             | $10 (250K tokens), $25 (750K tokens)                            |
| LLM Proxy                | Self-hosted LiteLLM                                             |
| Database                 | Supabase (PostgreSQL)                                           |
| Auth                     | Supabase Auth with Google SSO                                   |
| Payments                 | Stripe Checkout                                                 |
| API Hosting              | Railway                                                         |
| Dashboard Hosting        | Vercel                                                          |
| Mode Selection           | Per-provider toggle in Void settings                            |
| **Repository Structure** | **Separate monorepo (`void-cloud`) with 2 deployable services** |

---

## 1.5 Repository Architecture Decision

### Why Separate Repo from SafeAppeals2.0?

| Concern                    | Impact                                                             |
| -------------------------- | ------------------------------------------------------------------ |
| **VSCode build system**    | Complex webpack/gulp setup - adding Node.js backend would be messy |
| **Build times**            | VSCode already takes minutes to build, don't make it worse         |
| **Separation of concerns** | Desktop app ≠ cloud backend, different deployment cycles           |
| **Team scaling**           | Easier to onboard backend devs to a clean repo                     |

### Why Monorepo (Not Microservices)?

| Approach                      | Overhead   | When to Use                        |
| ----------------------------- | ---------- | ---------------------------------- |
| **1 repo, 1 service**         | Minimal ✅ | Startups, MVPs                     |
| **1 repo, 2-3 services**      | Low ✅     | Growing products ← **We are here** |
| **Many repos, many services** | High ❌    | Large teams, complex domains       |

### Final Repository Structure

```
TWO REPOSITORIES:
═══════════════════════════════════════════════════════════════════

REPO 1: SafeAppeals2.0 (existing - this repo)
────────────────────────────────────────────
Your VSCode fork - contains Void desktop app
Only add cloud CLIENT code here:
  • src/vs/workbench/contrib/void/common/voidCloudTypes.ts
  • src/vs/workbench/contrib/void/browser/voidCloudService.ts
  • React components for auth/credits UI

═══════════════════════════════════════════════════════════════════

REPO 2: void-cloud (NEW - create on GitHub)
────────────────────────────────────────────
Simple monorepo with 2 deployable services:

void-cloud/
├── api/                        # Service 1: Node.js API
│   ├── src/
│   │   ├── index.ts           # Fastify/Hono entry point
│   │   ├── routes/
│   │   │   ├── auth.ts        # /auth/* endpoints
│   │   │   ├── credits.ts     # /credits/* endpoints
│   │   │   ├── llm.ts         # /llm/* endpoints
│   │   │   └── webhooks.ts    # /webhooks/* endpoints
│   │   ├── services/
│   │   │   ├── credit.service.ts
│   │   │   ├── llm-proxy.service.ts
│   │   │   └── stripe.service.ts
│   │   └── middleware/
│   │       ├── auth.ts
│   │       └── rate-limit.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── Dockerfile
│
├── litellm/                    # Service 2: LiteLLM Proxy
│   ├── config.yaml            # Model definitions + pricing
│   └── Dockerfile
│
├── supabase/                   # Database migrations
│   └── migrations/
│       ├── 001_profiles.sql
│       ├── 002_credits.sql
│       └── 003_usage.sql
│
├── docker-compose.yml          # Local development
├── .env.example                # Environment template
├── railway.json                # Railway deployment config
└── README.md

═══════════════════════════════════════════════════════════════════

DEPLOYMENT (Railway):
─────────────────────
Railway Project: "void-cloud"
├── Service 1: api         → Deploys from /api
├── Service 2: litellm     → Deploys from /litellm
└── (Supabase is external, not on Railway)

═══════════════════════════════════════════════════════════════════
```

### Communication Between Repos

```
┌─────────────────────────┐          ┌─────────────────────────┐
│    SafeAppeals2.0       │          │      void-cloud         │
│    (Void Desktop)       │          │      (Backend)          │
├─────────────────────────┤          ├─────────────────────────┤
│                         │          │                         │
│  voidCloudService.ts    │─────────▶│  api/src/routes/*.ts    │
│  - signInWithGoogle()   │  HTTPS   │  - POST /auth/google    │
│  - getCredits()         │  calls   │  - GET /credits/balance │
│  - sendCloudMessage()   │─────────▶│  - POST /llm/chat       │
│                         │          │                         │
└─────────────────────────┘          └─────────────────────────┘

Shared contract: API types can be copy/pasted or published as npm package later
For MVP: Just duplicate the TypeScript interfaces in both repos
```

---

## 2. Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           USER'S MACHINE                                │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                      VOID DESKTOP APP                             │  │
│  │                                                                   │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │                    SETTINGS                                 │  │  │
│  │  │                                                             │  │  │
│  │  │  Anthropic:  ○ BYOK  ● Cloud                               │  │  │
│  │  │  OpenAI:     ● BYOK  ○ Cloud                               │  │  │
│  │  │  Ollama:     ● Local (always)                              │  │  │
│  │  │                                                             │  │  │
│  │  │  Cloud Balance: 125,432 credits                            │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                              │                                    │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │              sendLLMMessage Service                         │  │  │
│  │  │                                                             │  │  │
│  │  │  if (provider.mode === 'byok')                             │  │  │
│  │  │    → Use user's API key, direct to provider                │  │  │
│  │  │                                                             │  │  │
│  │  │  if (provider.mode === 'cloud')                            │  │  │
│  │  │    → Use Void Cloud auth token                             │  │  │
│  │  │    → Route through Void Cloud API                          │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ (if cloud mode)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          VOID CLOUD BACKEND                             │
│                          (Railway - $5-20/mo)                           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                      API SERVICE (Node.js)                      │   │
│  │                      api.voidcloud.dev                          │   │
│  │                                                                 │   │
│  │  POST /auth/google        - Google OAuth callback               │   │
│  │  GET  /auth/me            - Get current user                    │   │
│  │  GET  /credits/balance    - Get credit balance                  │   │
│  │  POST /credits/checkout   - Create Stripe checkout              │   │
│  │  POST /llm/chat           - Proxied LLM request                 │   │
│  │  POST /webhooks/stripe    - Handle Stripe events                │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
│                                    ▼                                    │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                    LITELLM PROXY (Python)                       │   │
│  │                    Internal service                             │   │
│  │                                                                 │   │
│  │  • Unified OpenAI-compatible API                                │   │
│  │  • Routes to: Anthropic, OpenAI, Google, etc.                  │   │
│  │  • Handles provider-specific quirks                             │   │
│  │  • Returns token usage in response                              │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                    │                                    │
└────────────────────────────────────│────────────────────────────────────┘
                                     │
        ┌────────────────────────────┼────────────────────────────┐
        │                            │                            │
        ▼                            ▼                            ▼
┌───────────────┐          ┌───────────────┐          ┌───────────────┐
│   SUPABASE    │          │    STRIPE     │          │ LLM PROVIDERS │
│               │          │               │          │               │
│ • PostgreSQL  │          │ • Payments    │          │ • Anthropic   │
│ • Auth        │          │ • Webhooks    │          │ • OpenAI      │
│ • Realtime    │          │ • Invoices    │          │ • Google      │
└───────────────┘          └───────────────┘          └───────────────┘
```

### Request Flow (Cloud Mode)

```
1. User sends chat message in Void
          │
          ▼
2. sendLLMMessage checks provider mode
   provider.mode === 'cloud' ?
          │
          ▼
3. Check local auth token exists
   if (!authToken) → Show login prompt
          │
          ▼
4. Send request to Void Cloud API
   POST https://api.voidcloud.dev/llm/chat
   Headers: { Authorization: Bearer <token> }
   Body: { model, messages, stream: true }
          │
          ▼
5. API validates token, checks credit balance
   if (balance < estimated_cost) → 402 Insufficient Credits
          │
          ▼
6. API forwards to LiteLLM proxy
   POST http://litellm:4000/chat/completions
          │
          ▼
7. LiteLLM routes to appropriate provider
   (Anthropic, OpenAI, Google, etc.)
          │
          ▼
8. Stream response back through chain
   LiteLLM → API → Void Desktop
          │
          ▼
9. After stream completes:
   - Count actual tokens used
   - Deduct credits from balance
   - Log usage record
          │
          ▼
10. Update credit display in Void UI
```

---

## 3. Design Decisions

### 3.1 Credit System

```typescript
// Credit Economics

// 1 credit = 1 token (simple, transparent)

// Provider costs (per 1M tokens) - as of Nov 2025
const PROVIDER_COSTS = {
	"claude-sonnet-4": { input: 3.0, output: 15.0 },
	"claude-3.5-haiku": { input: 0.8, output: 4.0 },
	"gpt-4o": { input: 2.5, output: 10.0 },
	"gpt-4o-mini": { input: 0.15, output: 0.6 },
	"gemini-1.5-pro": { input: 1.25, output: 5.0 },
};

// Our pricing (25% margin on weighted average)
// Assuming 1:3 input:output ratio (typical for chat)
//
// Claude Sonnet 4:
//   1K input + 3K output = $0.003 + $0.045 = $0.048 per 4K tokens
//   With 25% margin: $0.060 per 4K tokens = $15/M tokens
//
// We charge: $0.015 per 1K tokens = $15 per 1M tokens (blended)

// Credit Pack Pricing
const CREDIT_PACKS = {
	starter: {
		price_usd: 10.0,
		credits: 250_000, // $0.04 per 1K tokens
		value_usd: 7.5, // At $15/M blended cost
		margin: "33%",
	},
	pro: {
		price_usd: 25.0,
		credits: 750_000, // $0.033 per 1K tokens (17% discount)
		value_usd: 18.75,
		margin: "33%",
		bonus: "25% more tokens",
	},
};
```

### 3.2 Pricing Tiers (Future Expansion)

```
MVP (Now):
  - BYOK: Free forever
  - Cloud PAYG: $10 / $25 packs

Future:
  - Cloud Subscription: $15/mo for 500K tokens + rollover
  - Team Plans: Per-seat pricing
  - Enterprise: Custom volume pricing
```

### 3.3 Provider Selection in Void

```typescript
// Per-provider mode selection
type ProviderMode = "byok" | "cloud" | "local";

type CloudProviderConfig = {
	providerName: ProviderName;
	mode: ProviderMode;
	// If mode === 'byok', use existing apiKey from settingsOfProvider
	// If mode === 'cloud', use cloudAuthState.accessToken
	// If mode === 'local', always direct (ollama, lmstudio, vllm)
};

// Local-only providers (never available via cloud)
const LOCAL_ONLY_PROVIDERS = ["ollama", "vLLM", "lmStudio"];

// Cloud-available providers
const CLOUD_PROVIDERS = [
	"anthropic",
	"openAI",
	"gemini",
	"deepseek",
	"mistral",
	// More can be added to LiteLLM config
];
```

---

## 4. Infrastructure Setup

### 4.0 Create the void-cloud Repository

**Step 1: Create GitHub repo**

```bash
# On GitHub: Create new repo "void-cloud" (private recommended)
# Clone locally:
git clone https://github.com/YOUR_USERNAME/void-cloud.git
cd void-cloud
```

**Step 2: Initialize project structure**

```bash
# Create directory structure
mkdir -p api/src/{routes,services,middleware}
mkdir -p litellm
mkdir -p supabase/migrations

# Initialize API package
cd api
npm init -y
npm install fastify @fastify/cors @supabase/supabase-js stripe openai
npm install -D typescript @types/node tsx

# Create tsconfig
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true,
    "strict": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src/**/*"]
}
EOF

cd ..
```

**Step 3: Create docker-compose for local dev**

```yaml
# docker-compose.yml
version: "3.8"

services:
  api:
    build: ./api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - LITELLM_URL=http://litellm:4000
    env_file:
      - .env
    depends_on:
      - litellm

  litellm:
    build: ./litellm
    ports:
      - "4000:4000"
    env_file:
      - .env
```

### 4.1 Railway Project Structure

```
void-cloud (Railway Project)
├── api/                  # Service 1: Node.js API
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│
└── litellm/              # Service 2: LiteLLM Proxy
    ├── Dockerfile
    └── config.yaml
```

### 4.1.1 Railway Deployment Configuration

```json
// railway.json (in repo root)
{
	"$schema": "https://railway.app/railway.schema.json",
	"build": {
		"builder": "NIXPACKS"
	},
	"deploy": {
		"numReplicas": 1,
		"restartPolicyType": "ON_FAILURE"
	}
}
```

**Railway Setup Steps:**

1. Create Railway account at https://railway.app
2. Create new project: "void-cloud"
3. Add service from GitHub repo → select `/api` folder
4. Add another service from GitHub repo → select `/litellm` folder
5. Add environment variables to each service
6. Set up internal networking (litellm accessible only from api)

### 4.2 Environment Variables

```bash
# API Service (.env)
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGc...
SUPABASE_ANON_KEY=eyJhbGc...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...

# LiteLLM (internal)
LITELLM_URL=http://litellm-service:4000

# LiteLLM Service (.env)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIza...
DEEPSEEK_API_KEY=sk-...
```

### 4.3 Supabase Project Setup

```bash
# 1. Create Supabase project at https://supabase.com

# 2. Enable Google OAuth
#    Dashboard → Authentication → Providers → Google
#    Add your Google OAuth credentials

# 3. Run database migrations (see Section 5)

# 4. Set up Row Level Security (RLS)

# 5. Create database functions for atomic operations
```

### 4.4 Stripe Setup

```bash
# 1. Create Stripe account at https://stripe.com

# 2. Create Products:
#    - "Void Cloud Starter" - $10 one-time
#    - "Void Cloud Pro" - $25 one-time

# 3. Get Price IDs for each product

# 4. Set up webhook endpoint:
#    https://api.voidcloud.dev/webhooks/stripe
#    Events: checkout.session.completed, payment_intent.succeeded

# 5. Get webhook signing secret
```

---

## 5. Database Schema

### 5.1 SQL Migrations

```sql
-- Migration: 001_initial_schema.sql
-- Run this in Supabase SQL Editor

-- ============================================
-- PROFILES TABLE
-- Extends Supabase auth.users with app-specific data
-- ============================================
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    display_name TEXT,
    avatar_url TEXT,

    -- Stripe integration
    stripe_customer_id TEXT UNIQUE,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, display_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        NEW.raw_user_meta_data->>'avatar_url'
    );

    -- Also create initial credit balance
    INSERT INTO public.credit_balances (user_id, payg_credits)
    VALUES (NEW.id, 0);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================
-- CREDIT BALANCES TABLE
-- Tracks user's current credit balance
-- ============================================
CREATE TABLE public.credit_balances (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Pay-as-you-go credits (never expire)
    payg_credits BIGINT DEFAULT 0 NOT NULL,

    -- Reserved for future subscription credits
    subscription_credits BIGINT DEFAULT 0,
    subscription_resets_at TIMESTAMPTZ,

    -- Reserved for promotional credits
    bonus_credits BIGINT DEFAULT 0,
    bonus_expires_at TIMESTAMPTZ,

    -- Timestamps
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,

    -- Constraints
    CONSTRAINT payg_credits_non_negative CHECK (payg_credits >= 0),
    CONSTRAINT subscription_credits_non_negative CHECK (subscription_credits >= 0),
    CONSTRAINT bonus_credits_non_negative CHECK (bonus_credits >= 0)
);


-- ============================================
-- CREDIT TRANSACTIONS TABLE
-- Audit log of all credit changes
-- ============================================
CREATE TABLE public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,

    -- Transaction type
    type TEXT NOT NULL CHECK (type IN (
        'purchase',           -- Bought credits
        'usage',              -- Used credits for LLM request
        'refund',             -- Refunded credits
        'bonus',              -- Promotional credits
        'adjustment'          -- Manual adjustment
    )),

    -- Amount (positive = add, negative = deduct)
    amount BIGINT NOT NULL,

    -- Balance after transaction
    balance_after BIGINT NOT NULL,

    -- For purchases
    stripe_payment_intent_id TEXT,
    pack_name TEXT,
    price_usd INTEGER, -- in cents

    -- For usage
    request_id TEXT,
    model TEXT,
    provider TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,

    -- Description
    description TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_credit_transactions_user
    ON public.credit_transactions(user_id, created_at DESC);
CREATE INDEX idx_credit_transactions_request
    ON public.credit_transactions(request_id) WHERE request_id IS NOT NULL;


-- ============================================
-- USAGE RECORDS TABLE
-- Detailed LLM usage logging for analytics
-- ============================================
CREATE TABLE public.usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_id TEXT UNIQUE NOT NULL,

    -- Request details
    provider TEXT NOT NULL,
    model TEXT NOT NULL,
    feature TEXT, -- 'chat', 'autocomplete', 'quick_edit', 'apply', 'scm'

    -- Token counts
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER GENERATED ALWAYS AS (input_tokens + output_tokens) STORED,

    -- Cost tracking
    credits_charged BIGINT NOT NULL,
    provider_cost_micros BIGINT, -- Cost in microdollars ($1 = 1,000,000)

    -- Performance metrics
    latency_ms INTEGER,
    time_to_first_token_ms INTEGER,

    -- Status
    status TEXT DEFAULT 'completed' CHECK (status IN ('completed', 'failed', 'timeout')),
    error_message TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_usage_records_user_date
    ON public.usage_records(user_id, created_at DESC);
CREATE INDEX idx_usage_records_model
    ON public.usage_records(model, created_at DESC);


-- ============================================
-- ATOMIC CREDIT DEDUCTION FUNCTION
-- Safely deducts credits with proper ordering
-- ============================================
CREATE OR REPLACE FUNCTION public.deduct_credits(
    p_user_id UUID,
    p_amount BIGINT,
    p_request_id TEXT,
    p_model TEXT,
    p_provider TEXT,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER
) RETURNS TABLE (
    success BOOLEAN,
    new_balance BIGINT,
    error_message TEXT
) AS $$
DECLARE
    v_balance RECORD;
    v_total_available BIGINT;
    v_deducted BIGINT := 0;
    v_from_bonus BIGINT := 0;
    v_from_subscription BIGINT := 0;
    v_from_payg BIGINT := 0;
    v_remaining BIGINT;
BEGIN
    -- Lock the balance row
    SELECT * INTO v_balance
    FROM public.credit_balances
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::BIGINT, 'User balance not found'::TEXT;
        RETURN;
    END IF;

    -- Calculate total available (excluding expired bonus)
    v_total_available := v_balance.payg_credits +
        v_balance.subscription_credits +
        CASE
            WHEN v_balance.bonus_expires_at IS NULL OR v_balance.bonus_expires_at > NOW()
            THEN v_balance.bonus_credits
            ELSE 0
        END;

    -- Check sufficient balance
    IF v_total_available < p_amount THEN
        RETURN QUERY SELECT FALSE, v_total_available, 'Insufficient credits'::TEXT;
        RETURN;
    END IF;

    v_remaining := p_amount;

    -- Deduct from bonus first (use or lose)
    IF v_remaining > 0 AND v_balance.bonus_credits > 0 AND
       (v_balance.bonus_expires_at IS NULL OR v_balance.bonus_expires_at > NOW()) THEN
        v_from_bonus := LEAST(v_remaining, v_balance.bonus_credits);
        v_remaining := v_remaining - v_from_bonus;
    END IF;

    -- Then from subscription (monthly allocation)
    IF v_remaining > 0 AND v_balance.subscription_credits > 0 THEN
        v_from_subscription := LEAST(v_remaining, v_balance.subscription_credits);
        v_remaining := v_remaining - v_from_subscription;
    END IF;

    -- Finally from PAYG (never expires)
    IF v_remaining > 0 AND v_balance.payg_credits > 0 THEN
        v_from_payg := LEAST(v_remaining, v_balance.payg_credits);
        v_remaining := v_remaining - v_from_payg;
    END IF;

    -- Update balance
    UPDATE public.credit_balances SET
        bonus_credits = bonus_credits - v_from_bonus,
        subscription_credits = subscription_credits - v_from_subscription,
        payg_credits = payg_credits - v_from_payg,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- Calculate new total
    v_total_available := v_total_available - p_amount;

    -- Log transaction
    INSERT INTO public.credit_transactions (
        user_id, type, amount, balance_after,
        request_id, model, provider, input_tokens, output_tokens,
        description
    ) VALUES (
        p_user_id, 'usage', -p_amount, v_total_available,
        p_request_id, p_model, p_provider, p_input_tokens, p_output_tokens,
        format('LLM request: %s tokens (%s in, %s out)',
               p_input_tokens + p_output_tokens, p_input_tokens, p_output_tokens)
    );

    RETURN QUERY SELECT TRUE, v_total_available, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- ADD CREDITS FUNCTION
-- Adds purchased credits to user balance
-- ============================================
CREATE OR REPLACE FUNCTION public.add_credits(
    p_user_id UUID,
    p_amount BIGINT,
    p_stripe_payment_intent_id TEXT,
    p_pack_name TEXT,
    p_price_cents INTEGER
) RETURNS BIGINT AS $$
DECLARE
    v_new_balance BIGINT;
BEGIN
    -- Add to PAYG credits
    UPDATE public.credit_balances
    SET
        payg_credits = payg_credits + p_amount,
        updated_at = NOW()
    WHERE user_id = p_user_id
    RETURNING payg_credits INTO v_new_balance;

    -- Log transaction
    INSERT INTO public.credit_transactions (
        user_id, type, amount, balance_after,
        stripe_payment_intent_id, pack_name, price_usd, description
    ) VALUES (
        p_user_id, 'purchase', p_amount, v_new_balance,
        p_stripe_payment_intent_id, p_pack_name, p_price_cents,
        format('Purchased %s credits (%s pack)', p_amount, p_pack_name)
    );

    RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;

-- Profiles: Users can read/update their own profile
CREATE POLICY "Users can view own profile"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Credit balances: Users can read their own balance
CREATE POLICY "Users can view own balance"
    ON public.credit_balances FOR SELECT
    USING (auth.uid() = user_id);

-- Credit transactions: Users can read their own transactions
CREATE POLICY "Users can view own transactions"
    ON public.credit_transactions FOR SELECT
    USING (auth.uid() = user_id);

-- Usage records: Users can read their own usage
CREATE POLICY "Users can view own usage"
    ON public.usage_records FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can do everything (for backend API)
-- The service_role key bypasses RLS automatically
```

### 5.2 Type Definitions (TypeScript)

```typescript
// packages/shared/src/database.types.ts

export interface Database {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					email: string;
					display_name: string | null;
					avatar_url: string | null;
					stripe_customer_id: string | null;
					created_at: string;
					updated_at: string;
				};
				Insert: Omit<
					Database["public"]["Tables"]["profiles"]["Row"],
					"created_at" | "updated_at"
				>;
				Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>;
			};
			credit_balances: {
				Row: {
					user_id: string;
					payg_credits: number;
					subscription_credits: number;
					subscription_resets_at: string | null;
					bonus_credits: number;
					bonus_expires_at: string | null;
					updated_at: string;
				};
				Insert: Omit<
					Database["public"]["Tables"]["credit_balances"]["Row"],
					"updated_at"
				>;
				Update: Partial<
					Database["public"]["Tables"]["credit_balances"]["Insert"]
				>;
			};
			credit_transactions: {
				Row: {
					id: string;
					user_id: string;
					type: "purchase" | "usage" | "refund" | "bonus" | "adjustment";
					amount: number;
					balance_after: number;
					stripe_payment_intent_id: string | null;
					pack_name: string | null;
					price_usd: number | null;
					request_id: string | null;
					model: string | null;
					provider: string | null;
					input_tokens: number | null;
					output_tokens: number | null;
					description: string | null;
					created_at: string;
				};
				Insert: Omit<
					Database["public"]["Tables"]["credit_transactions"]["Row"],
					"id" | "created_at"
				>;
				Update: Partial<
					Database["public"]["Tables"]["credit_transactions"]["Insert"]
				>;
			};
			usage_records: {
				Row: {
					id: string;
					user_id: string;
					request_id: string;
					provider: string;
					model: string;
					feature: string | null;
					input_tokens: number;
					output_tokens: number;
					total_tokens: number;
					credits_charged: number;
					provider_cost_micros: number | null;
					latency_ms: number | null;
					time_to_first_token_ms: number | null;
					status: "completed" | "failed" | "timeout";
					error_message: string | null;
					created_at: string;
				};
				Insert: Omit<
					Database["public"]["Tables"]["usage_records"]["Row"],
					"id" | "total_tokens" | "created_at"
				>;
				Update: Partial<
					Database["public"]["Tables"]["usage_records"]["Insert"]
				>;
			};
		};
		Functions: {
			deduct_credits: {
				Args: {
					p_user_id: string;
					p_amount: number;
					p_request_id: string;
					p_model: string;
					p_provider: string;
					p_input_tokens: number;
					p_output_tokens: number;
				};
				Returns: {
					success: boolean;
					new_balance: number;
					error_message: string | null;
				}[];
			};
			add_credits: {
				Args: {
					p_user_id: string;
					p_amount: number;
					p_stripe_payment_intent_id: string;
					p_pack_name: string;
					p_price_cents: number;
				};
				Returns: number;
			};
		};
	};
}
```

---

## 6. API Specification

### 6.1 Base Configuration

```typescript
// Base URL: https://api.voidcloud.dev
// All endpoints require Authorization header except /auth/* and /webhooks/*

// Headers:
// Authorization: Bearer <supabase_access_token>
// Content-Type: application/json
```

### 6.2 Authentication Endpoints

```typescript
// ============================================
// POST /auth/google/callback
// Handle Google OAuth callback from Supabase
// ============================================
// This is handled by Supabase Auth directly
// Client uses supabase.auth.signInWithOAuth({ provider: 'google' })

// ============================================
// GET /auth/me
// Get current authenticated user
// ============================================
interface GetMeResponse {
	user: {
		id: string;
		email: string;
		display_name: string | null;
		avatar_url: string | null;
	};
	credits: {
		payg: number;
		subscription: number;
		bonus: number;
		total: number;
		subscription_resets_at: string | null;
	};
}

// ============================================
// POST /auth/refresh
// Refresh access token
// ============================================
// Handled by Supabase client: supabase.auth.refreshSession()
```

### 6.3 Credit Endpoints

```typescript
// ============================================
// GET /credits/balance
// Get user's credit balance
// ============================================
interface GetBalanceResponse {
	payg: number;
	subscription: number;
	bonus: number;
	total: number;
	subscription_resets_at: string | null;
	bonus_expires_at: string | null;
}

// ============================================
// GET /credits/history
// Get credit transaction history
// ============================================
interface GetHistoryParams {
	limit?: number; // Default: 50, Max: 100
	offset?: number; // Default: 0
	type?: "purchase" | "usage" | "refund" | "bonus";
}

interface GetHistoryResponse {
	transactions: Array<{
		id: string;
		type: string;
		amount: number;
		balance_after: number;
		description: string;
		model?: string;
		input_tokens?: number;
		output_tokens?: number;
		created_at: string;
	}>;
	total: number;
	has_more: boolean;
}

// ============================================
// POST /credits/checkout
// Create Stripe checkout session for credit purchase
// ============================================
interface CreateCheckoutRequest {
	pack: "starter" | "pro";
	success_url?: string; // Default: void://credits/success
	cancel_url?: string; // Default: void://credits/cancel
}

interface CreateCheckoutResponse {
	checkout_url: string;
	session_id: string;
}

// ============================================
// GET /credits/packs
// Get available credit packs
// ============================================
interface GetPacksResponse {
	packs: Array<{
		id: "starter" | "pro";
		name: string;
		price_usd: number;
		credits: number;
		description: string;
		bonus_percent?: number;
	}>;
}
```

### 6.4 LLM Endpoints

```typescript
// ============================================
// POST /llm/chat
// Create chat completion (proxied through LiteLLM)
// ============================================
interface ChatRequest {
	model: string; // e.g., 'claude-sonnet-4', 'gpt-4o'
	messages: Array<{
		role: "system" | "user" | "assistant";
		content: string;
	}>;
	stream?: boolean; // Default: true
	max_tokens?: number; // Default: 4096
	temperature?: number; // Default: 0.7

	// Void-specific metadata
	feature?: "chat" | "autocomplete" | "quick_edit" | "apply" | "scm";
}

interface ChatResponse {
	// If stream: false
	id: string;
	model: string;
	content: string;
	usage: {
		input_tokens: number;
		output_tokens: number;
		credits_charged: number;
	};
	finish_reason: "stop" | "length" | "tool_calls";
}

// If stream: true, returns Server-Sent Events:
// data: {"type":"content","content":"Hello"}
// data: {"type":"content","content":" world"}
// data: {"type":"done","usage":{"input_tokens":10,"output_tokens":5,"credits_charged":15}}

// ============================================
// Error Responses
// ============================================
interface ErrorResponse {
	error: {
		code: string;
		message: string;
		details?: any;
	};
}

// Error codes:
// - 'UNAUTHORIZED': Invalid or missing auth token
// - 'INSUFFICIENT_CREDITS': Not enough credits (HTTP 402)
// - 'RATE_LIMITED': Too many requests (HTTP 429)
// - 'MODEL_NOT_FOUND': Unknown model
// - 'PROVIDER_ERROR': Upstream provider error
// - 'INTERNAL_ERROR': Server error
```

### 6.5 Webhook Endpoints

```typescript
// ============================================
// POST /webhooks/stripe
// Handle Stripe webhook events
// ============================================
// Stripe signature verification required
// Events handled:
// - checkout.session.completed
// - payment_intent.succeeded
// - payment_intent.failed

// No response body needed, just HTTP 200
```

---

## 7. LiteLLM Configuration

### 7.1 Docker Setup

```dockerfile
# litellm-service/Dockerfile
FROM ghcr.io/berriai/litellm:main-latest

# Copy config
COPY litellm_config.yaml /app/config.yaml

# Expose port
EXPOSE 4000

# Run LiteLLM
CMD ["--config", "/app/config.yaml", "--port", "4000"]
```

### 7.2 LiteLLM Config

```yaml
# litellm-service/litellm_config.yaml

model_list:
  # ==========================================
  # ANTHROPIC MODELS
  # ==========================================
  - model_name: claude-sonnet-4
    litellm_params:
      model: anthropic/claude-sonnet-4-20250514
      api_key: os.environ/ANTHROPIC_API_KEY
      max_tokens: 8192
    model_info:
      input_cost_per_token: 0.000003 # $3/1M
      output_cost_per_token: 0.000015 # $15/1M

  - model_name: claude-3.5-sonnet
    litellm_params:
      model: anthropic/claude-3-5-sonnet-20241022
      api_key: os.environ/ANTHROPIC_API_KEY
      max_tokens: 8192
    model_info:
      input_cost_per_token: 0.000003
      output_cost_per_token: 0.000015

  - model_name: claude-3.5-haiku
    litellm_params:
      model: anthropic/claude-3-5-haiku-20241022
      api_key: os.environ/ANTHROPIC_API_KEY
      max_tokens: 8192
    model_info:
      input_cost_per_token: 0.0000008 # $0.80/1M
      output_cost_per_token: 0.000004 # $4/1M

  # ==========================================
  # OPENAI MODELS
  # ==========================================
  - model_name: gpt-4o
    litellm_params:
      model: openai/gpt-4o
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      input_cost_per_token: 0.0000025 # $2.50/1M
      output_cost_per_token: 0.00001 # $10/1M

  - model_name: gpt-4o-mini
    litellm_params:
      model: openai/gpt-4o-mini
      api_key: os.environ/OPENAI_API_KEY
    model_info:
      input_cost_per_token: 0.00000015 # $0.15/1M
      output_cost_per_token: 0.0000006 # $0.60/1M

  # ==========================================
  # GOOGLE MODELS
  # ==========================================
  - model_name: gemini-1.5-pro
    litellm_params:
      model: gemini/gemini-1.5-pro
      api_key: os.environ/GEMINI_API_KEY
    model_info:
      input_cost_per_token: 0.00000125 # $1.25/1M
      output_cost_per_token: 0.000005 # $5/1M

  - model_name: gemini-1.5-flash
    litellm_params:
      model: gemini/gemini-1.5-flash
      api_key: os.environ/GEMINI_API_KEY
    model_info:
      input_cost_per_token: 0.000000075 # $0.075/1M
      output_cost_per_token: 0.0000003 # $0.30/1M

  # ==========================================
  # DEEPSEEK MODELS
  # ==========================================
  - model_name: deepseek-chat
    litellm_params:
      model: deepseek/deepseek-chat
      api_key: os.environ/DEEPSEEK_API_KEY
    model_info:
      input_cost_per_token: 0.00000014 # $0.14/1M
      output_cost_per_token: 0.00000028 # $0.28/1M

litellm_settings:
  # Enable streaming
  stream: true

  # Return usage in response
  return_usage: true

  # Timeout settings
  request_timeout: 300

  # Retry settings
  num_retries: 2
  retry_after: 5

# Disable LiteLLM's built-in auth (we handle auth in our API)
general_settings:
  master_key: null
```

### 7.3 Railway Deployment

```yaml
# railway.toml for litellm-service
[build]
  builder = "dockerfile"
  dockerfilePath = "Dockerfile"

[deploy]
  startCommand = "litellm --config /app/config.yaml --port 4000"
  healthcheckPath = "/health"
  healthcheckTimeout = 30
```

---

## 8. Void Desktop Integration

### 8.1 New Types

```typescript
// src/vs/workbench/contrib/void/common/voidCloudTypes.ts

/**
 * Cloud authentication state stored in settings
 */
export interface CloudAuthState {
	isAuthenticated: boolean;
	accessToken: string | null;
	refreshToken: string | null;
	expiresAt: number | null; // Unix timestamp
	user: CloudUser | null;
}

export interface CloudUser {
	id: string;
	email: string;
	displayName: string | null;
	avatarUrl: string | null;
}

export interface CloudCredits {
	payg: number;
	subscription: number;
	bonus: number;
	total: number;
	subscriptionResetsAt: string | null;
}

/**
 * Per-provider cloud mode configuration
 */
export type ProviderCloudMode = "byok" | "cloud";

export interface CloudModeOfProvider {
	[providerName: string]: ProviderCloudMode;
}

// Providers that support cloud mode
export const CLOUD_ENABLED_PROVIDERS = [
	"anthropic",
	"openAI",
	"gemini",
	"deepseek",
	"mistral",
] as const;

// Providers that are always local (no cloud option)
export const LOCAL_ONLY_PROVIDERS = ["ollama", "vLLM", "lmStudio"] as const;

export type CloudEnabledProvider = (typeof CLOUD_ENABLED_PROVIDERS)[number];
```

### 8.2 Settings Updates

```typescript
// src/vs/workbench/contrib/void/common/voidSettingsTypes.ts
// ADD to existing GlobalSettings type:

export type GlobalSettings = {
	// ... existing settings ...

	// Cloud settings
	cloudAuthState: CloudAuthState | null;
	cloudModeOfProvider: CloudModeOfProvider;
	cloudCredits: CloudCredits | null;
	lastCreditRefresh: number | null; // Unix timestamp
};

export const defaultGlobalSettings: GlobalSettings = {
	// ... existing defaults ...

	// Cloud defaults
	cloudAuthState: null,
	cloudModeOfProvider: {
		anthropic: "byok",
		openAI: "byok",
		gemini: "byok",
		deepseek: "byok",
		mistral: "byok",
	},
	cloudCredits: null,
	lastCreditRefresh: null,
};
```

### 8.3 Cloud Service

```typescript
// src/vs/workbench/contrib/void/browser/voidCloudService.ts

import { createClient, SupabaseClient, User } from "@supabase/supabase-js";
import { IVoidSettingsService } from "../common/voidSettingsService.js";
import { CloudAuthState, CloudCredits } from "../common/voidCloudTypes.js";

const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_KEY";
const VOID_CLOUD_API = "https://api.voidcloud.dev";

export interface IVoidCloudService {
	// Auth
	signInWithGoogle(): Promise<void>;
	signOut(): Promise<void>;
	getSession(): Promise<CloudAuthState | null>;

	// Credits
	getCredits(): Promise<CloudCredits>;
	refreshCredits(): Promise<void>;

	// Purchases
	createCheckoutSession(pack: "starter" | "pro"): Promise<string>;
}

export const IVoidCloudService =
	createDecorator<IVoidCloudService>("voidCloudService");

export class VoidCloudService implements IVoidCloudService {
	private supabase: SupabaseClient;

	constructor(
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService
	) {
		this.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
			auth: {
				autoRefreshToken: true,
				persistSession: false, // We manage session in Void settings
			},
		});

		// Listen for auth changes
		this.supabase.auth.onAuthStateChange((event, session) => {
			this.handleAuthChange(event, session);
		});

		// Restore session from settings on init
		this.restoreSession();
	}

	private async restoreSession(): Promise<void> {
		const authState = this.settingsService.state.globalSettings.cloudAuthState;
		if (authState?.refreshToken) {
			try {
				const { data, error } = await this.supabase.auth.setSession({
					access_token: authState.accessToken!,
					refresh_token: authState.refreshToken,
				});
				if (error) {
					// Clear invalid session
					this.settingsService.setGlobalSetting("cloudAuthState", null);
				}
			} catch (e) {
				console.error("Failed to restore cloud session:", e);
			}
		}
	}

	private handleAuthChange(event: string, session: any): void {
		if (event === "SIGNED_IN" && session) {
			const authState: CloudAuthState = {
				isAuthenticated: true,
				accessToken: session.access_token,
				refreshToken: session.refresh_token,
				expiresAt: session.expires_at,
				user: {
					id: session.user.id,
					email: session.user.email!,
					displayName: session.user.user_metadata?.full_name || null,
					avatarUrl: session.user.user_metadata?.avatar_url || null,
				},
			};
			this.settingsService.setGlobalSetting("cloudAuthState", authState);

			// Fetch initial credits
			this.refreshCredits();
		} else if (event === "SIGNED_OUT") {
			this.settingsService.setGlobalSetting("cloudAuthState", null);
			this.settingsService.setGlobalSetting("cloudCredits", null);
		}
	}

	async signInWithGoogle(): Promise<void> {
		const { error } = await this.supabase.auth.signInWithOAuth({
			provider: "google",
			options: {
				redirectTo: "void://auth/callback", // Custom protocol handler
			},
		});
		if (error) throw error;
	}

	async signOut(): Promise<void> {
		await this.supabase.auth.signOut();
	}

	async getSession(): Promise<CloudAuthState | null> {
		return this.settingsService.state.globalSettings.cloudAuthState;
	}

	async getCredits(): Promise<CloudCredits> {
		const authState = this.settingsService.state.globalSettings.cloudAuthState;
		if (!authState?.accessToken) {
			throw new Error("Not authenticated");
		}

		const response = await fetch(`${VOID_CLOUD_API}/credits/balance`, {
			headers: {
				Authorization: `Bearer ${authState.accessToken}`,
			},
		});

		if (!response.ok) {
			throw new Error("Failed to fetch credits");
		}

		return response.json();
	}

	async refreshCredits(): Promise<void> {
		try {
			const credits = await this.getCredits();
			this.settingsService.setGlobalSetting("cloudCredits", credits);
			this.settingsService.setGlobalSetting("lastCreditRefresh", Date.now());
		} catch (e) {
			console.error("Failed to refresh credits:", e);
		}
	}

	async createCheckoutSession(pack: "starter" | "pro"): Promise<string> {
		const authState = this.settingsService.state.globalSettings.cloudAuthState;
		if (!authState?.accessToken) {
			throw new Error("Not authenticated");
		}

		const response = await fetch(`${VOID_CLOUD_API}/credits/checkout`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authState.accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ pack }),
		});

		if (!response.ok) {
			throw new Error("Failed to create checkout session");
		}

		const { checkout_url } = await response.json();
		return checkout_url;
	}
}
```

### 8.4 LLM Message Routing Changes

```typescript
// src/vs/workbench/contrib/void/electron-main/llmMessage/sendLLMMessage.impl.ts
// MODIFY the main sendLLMMessage function:

import {
	CLOUD_ENABLED_PROVIDERS,
	LOCAL_ONLY_PROVIDERS,
} from "../../common/voidCloudTypes.js";

export async function sendLLMMessage(
	params: SendLLMMessageParams
): Promise<void> {
	const {
		modelSelection,
		settingsOfProvider,
		globalSettings,
		// ... other params
	} = params;

	const { providerName, modelName } = modelSelection;

	// Determine if this request should use cloud
	const useCloud = shouldUseCloud(providerName, globalSettings);

	if (useCloud) {
		return sendViaVoidCloud(params);
	}

	// Existing BYOK logic continues below...
	// ... rest of current implementation
}

function shouldUseCloud(
	providerName: ProviderName,
	globalSettings: GlobalSettings
): boolean {
	// Local-only providers never use cloud
	if ((LOCAL_ONLY_PROVIDERS as readonly string[]).includes(providerName)) {
		return false;
	}

	// Check if user is authenticated with cloud
	if (!globalSettings.cloudAuthState?.isAuthenticated) {
		return false;
	}

	// Check provider-specific cloud mode setting
	const cloudMode = globalSettings.cloudModeOfProvider[providerName];
	return cloudMode === "cloud";
}

async function sendViaVoidCloud(params: SendLLMMessageParams): Promise<void> {
	const {
		modelSelection,
		messages,
		separateSystemMessage,
		onText,
		onFinalMessage,
		onError,
		abortRef,
		globalSettings,
		logging,
	} = params;

	const authState = globalSettings?.cloudAuthState;

	if (!authState?.accessToken) {
		onError({
			message:
				"Not signed in to Void Cloud. Please sign in or switch to BYOK mode.",
			fullError: null,
		});
		return;
	}

	// Map internal model name to cloud model name
	const cloudModel = mapToCloudModel(
		modelSelection.providerName,
		modelSelection.modelName
	);

	try {
		const response = await fetch("https://api.voidcloud.dev/llm/chat", {
			method: "POST",
			headers: {
				Authorization: `Bearer ${authState.accessToken}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: cloudModel,
				messages: formatMessagesForCloud(messages, separateSystemMessage),
				stream: true,
				feature: logging.loggingName,
			}),
		});

		if (response.status === 401) {
			onError({
				message: "Cloud session expired. Please sign in again.",
				fullError: null,
			});
			return;
		}

		if (response.status === 402) {
			onError({
				message:
					"Insufficient credits. Please purchase more credits or switch to BYOK mode.",
				fullError: null,
			});
			return;
		}

		if (!response.ok) {
			const error = await response.json();
			onError({
				message: error.error?.message || "Cloud request failed",
				fullError: error,
			});
			return;
		}

		// Handle streaming response
		const reader = response.body?.getReader();
		if (!reader) {
			onError({ message: "No response body", fullError: null });
			return;
		}

		const decoder = new TextDecoder();
		let fullText = "";
		let usage: {
			input_tokens: number;
			output_tokens: number;
			credits_charged: number;
		} | null = null;

		// Set up abort
		abortRef.current = () => reader.cancel();

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			const chunk = decoder.decode(value, { stream: true });
			const lines = chunk
				.split("\n")
				.filter((line) => line.startsWith("data: "));

			for (const line of lines) {
				const data = JSON.parse(line.slice(6));

				if (data.type === "content") {
					fullText += data.content;
					onText({ fullText, fullReasoning: "" });
				} else if (data.type === "done") {
					usage = data.usage;
				}
			}
		}

		onFinalMessage({
			fullText,
			fullReasoning: "",
			anthropicReasoning: null,
		});

		// TODO: Update credit display in UI
		// Could emit an event here that the sidebar listens to
	} catch (error) {
		onError({
			message: `Cloud request failed: ${
				error instanceof Error ? error.message : "Unknown error"
			}`,
			fullError: error instanceof Error ? error : null,
		});
	}
}

function mapToCloudModel(providerName: string, modelName: string): string {
	// Map Void's internal model names to LiteLLM model names
	const modelMap: Record<string, Record<string, string>> = {
		anthropic: {
			"claude-sonnet-4-20250514": "claude-sonnet-4",
			"claude-3-5-sonnet-20241022": "claude-3.5-sonnet",
			"claude-3-5-haiku-20241022": "claude-3.5-haiku",
		},
		openAI: {
			"gpt-4o": "gpt-4o",
			"gpt-4o-mini": "gpt-4o-mini",
		},
		gemini: {
			"gemini-1.5-pro": "gemini-1.5-pro",
			"gemini-1.5-flash": "gemini-1.5-flash",
		},
		deepseek: {
			"deepseek-chat": "deepseek-chat",
		},
	};

	return modelMap[providerName]?.[modelName] || modelName;
}
```

### 8.5 UI Components (React)

```tsx
// src/vs/workbench/contrib/void/browser/react/src/void-settings/CloudSettings.tsx

import React, { useState } from "react";
import { useVoidSettings, useVoidCloudService } from "../hooks";
import { CLOUD_ENABLED_PROVIDERS } from "../../../common/voidCloudTypes";

export const CloudSettings: React.FC = () => {
	const { globalSettings, setGlobalSetting } = useVoidSettings();
	const cloudService = useVoidCloudService();
	const [loading, setLoading] = useState(false);

	const authState = globalSettings.cloudAuthState;
	const credits = globalSettings.cloudCredits;

	const handleSignIn = async () => {
		setLoading(true);
		try {
			await cloudService.signInWithGoogle();
		} catch (e) {
			console.error("Sign in failed:", e);
		} finally {
			setLoading(false);
		}
	};

	const handleSignOut = async () => {
		await cloudService.signOut();
	};

	const handleBuyCredits = async (pack: "starter" | "pro") => {
		try {
			const url = await cloudService.createCheckoutSession(pack);
			// Open in default browser
			window.open(url, "_blank");
		} catch (e) {
			console.error("Failed to create checkout:", e);
		}
	};

	const toggleProviderMode = (provider: string) => {
		const currentMode = globalSettings.cloudModeOfProvider[provider];
		const newMode = currentMode === "byok" ? "cloud" : "byok";
		setGlobalSetting("cloudModeOfProvider", {
			...globalSettings.cloudModeOfProvider,
			[provider]: newMode,
		});
	};

	return (
		<div className="cloud-settings">
			<h3>Void Cloud</h3>
			<p className="description">
				Use AI models without managing your own API keys. Purchase credits and
				access Claude, GPT-4o, Gemini, and more.
			</p>

			{/* Auth Section */}
			<div className="auth-section">
				{authState?.isAuthenticated ? (
					<div className="user-info">
						<img
							src={authState.user?.avatarUrl || ""}
							alt=""
							className="avatar"
						/>
						<div className="user-details">
							<span className="name">{authState.user?.displayName}</span>
							<span className="email">{authState.user?.email}</span>
						</div>
						<button onClick={handleSignOut} className="sign-out-btn">
							Sign Out
						</button>
					</div>
				) : (
					<button
						onClick={handleSignIn}
						disabled={loading}
						className="google-sign-in-btn"
					>
						<GoogleIcon />
						{loading ? "Signing in..." : "Sign in with Google"}
					</button>
				)}
			</div>

			{/* Credits Section */}
			{authState?.isAuthenticated && (
				<div className="credits-section">
					<h4>Credits</h4>
					<div className="credit-balance">
						<span className="amount">
							{credits?.total?.toLocaleString() || "0"}
						</span>
						<span className="label">credits available</span>
					</div>

					<div className="credit-packs">
						<button
							onClick={() => handleBuyCredits("starter")}
							className="pack-btn"
						>
							<span className="pack-name">Starter</span>
							<span className="pack-credits">250,000 credits</span>
							<span className="pack-price">$10</span>
						</button>
						<button
							onClick={() => handleBuyCredits("pro")}
							className="pack-btn featured"
						>
							<span className="pack-badge">25% bonus</span>
							<span className="pack-name">Pro</span>
							<span className="pack-credits">750,000 credits</span>
							<span className="pack-price">$25</span>
						</button>
					</div>
				</div>
			)}

			{/* Provider Mode Selection */}
			{authState?.isAuthenticated && (
				<div className="provider-modes">
					<h4>Provider Settings</h4>
					<p className="help-text">
						Choose whether each provider uses your own API key (BYOK) or Void
						Cloud credits.
					</p>

					{CLOUD_ENABLED_PROVIDERS.map((provider) => (
						<div key={provider} className="provider-row">
							<span className="provider-name">
								{getProviderDisplayName(provider)}
							</span>
							<div className="mode-toggle">
								<button
									className={`mode-btn ${
										globalSettings.cloudModeOfProvider[provider] === "byok"
											? "active"
											: ""
									}`}
									onClick={() => toggleProviderMode(provider)}
								>
									BYOK
								</button>
								<button
									className={`mode-btn ${
										globalSettings.cloudModeOfProvider[provider] === "cloud"
											? "active"
											: ""
									}`}
									onClick={() => toggleProviderMode(provider)}
								>
									Cloud
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
};
```

```tsx
// src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/CreditBalance.tsx

import React from "react";
import { useVoidSettings, useVoidCloudService } from "../hooks";

export const CreditBalance: React.FC = () => {
	const { globalSettings } = useVoidSettings();
	const cloudService = useVoidCloudService();

	const authState = globalSettings.cloudAuthState;
	const credits = globalSettings.cloudCredits;

	// Don't show if not authenticated
	if (!authState?.isAuthenticated) {
		return null;
	}

	// Check if any provider is using cloud mode
	const anyCloudMode = Object.values(globalSettings.cloudModeOfProvider).some(
		(mode) => mode === "cloud"
	);

	if (!anyCloudMode) {
		return null;
	}

	return (
		<div className="credit-balance-widget">
			<span className="credit-icon">⚡</span>
			<span className="credit-amount">
				{credits?.total?.toLocaleString() || "0"}
			</span>
			<span className="credit-label">credits</span>
		</div>
	);
};
```

---

## 9. Payment Integration

### 9.1 Stripe Products Setup

Create these products in Stripe Dashboard:

```
Product 1: Void Cloud Starter
- One-time payment: $10.00
- Metadata: { pack: "starter", credits: "250000" }
- Price ID: price_starter_xxx

Product 2: Void Cloud Pro
- One-time payment: $25.00
- Metadata: { pack: "pro", credits: "750000" }
- Price ID: price_pro_xxx
```

### 9.2 Webhook Handler

```typescript
// api-service/src/routes/webhooks.ts

import Stripe from "stripe";
import { FastifyInstance } from "fastify";
import { supabase } from "../db/client";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function webhookRoutes(app: FastifyInstance) {
	app.post(
		"/webhooks/stripe",
		{
			config: {
				rawBody: true, // Need raw body for signature verification
			},
		},
		async (request, reply) => {
			const signature = request.headers["stripe-signature"] as string;

			let event: Stripe.Event;

			try {
				event = stripe.webhooks.constructEvent(
					request.rawBody as Buffer,
					signature,
					process.env.STRIPE_WEBHOOK_SECRET!
				);
			} catch (err) {
				return reply
					.status(400)
					.send({ error: "Webhook signature verification failed" });
			}

			switch (event.type) {
				case "checkout.session.completed":
					await handleCheckoutComplete(
						event.data.object as Stripe.Checkout.Session
					);
					break;

				case "payment_intent.succeeded":
					// Could use this as backup, but checkout.session.completed is primary
					break;

				default:
					console.log(`Unhandled event type: ${event.type}`);
			}

			return reply.status(200).send({ received: true });
		}
	);
}

async function handleCheckoutComplete(session: Stripe.Checkout.Session) {
	const userId = session.metadata?.user_id;
	const pack = session.metadata?.pack as "starter" | "pro";
	const credits = parseInt(session.metadata?.credits || "0");

	if (!userId || !pack || !credits) {
		console.error("Missing metadata in checkout session:", session.id);
		return;
	}

	// Check for duplicate processing (idempotency)
	const { data: existing } = await supabase
		.from("credit_transactions")
		.select("id")
		.eq("stripe_payment_intent_id", session.payment_intent)
		.single();

	if (existing) {
		console.log("Payment already processed:", session.payment_intent);
		return;
	}

	// Add credits using our database function
	const { error } = await supabase.rpc("add_credits", {
		p_user_id: userId,
		p_amount: credits,
		p_stripe_payment_intent_id: session.payment_intent as string,
		p_pack_name: pack,
		p_price_cents: session.amount_total || 0,
	});

	if (error) {
		console.error("Failed to add credits:", error);
		// Could implement retry logic or alert here
		return;
	}

	console.log(`Added ${credits} credits to user ${userId}`);
}
```

---

## 10. Implementation Phases

### Phase 1: Infrastructure Setup (Week 1) ✅ COMPLETE

- [x] Create Supabase project _(URL: totnbmqhkonnqgqhimsy.supabase.co)_
- [x] Configure Google OAuth in Supabase ✅
- [x] Apply database migrations (profiles, credits, usage_logs)
- [x] Create GitHub repo (`savagelysubtle/void-cloud`)
- [x] Deploy API to Railway (`void-cloud-production.up.railway.app`)
- [x] Configure Railway environment variables
- [x] Create Stripe products and prices:
  - Starter Pack: $10 / 250K tokens (`price_1SZIiVAhXjZrIkPTysEXhuIT`)
  - Pro Pack: $25 / 750K tokens (`price_1SZIiWAhXjZrIkPTJjdQpU2D`)
- [x] Create Stripe webhook (`charismatic-radiance`)
- [x] Install Stripe CLI and authenticate
- [x] Get webhook signing secret *(stored in `void-cloud/.env`)*
- [x] Write database migrations _(code in `void-cloud/supabase/migrations/`)_
- [x] Run database migrations in Supabase _(4 migrations applied)_
- [x] Add Service Role Key to `.env` ✅
- [ ] Create Railway project
- [x] Write LiteLLM config _(code in `void-cloud/litellm/config.yaml`)_
- [ ] Deploy LiteLLM with initial config (Claude + GPT-4o-mini)
- [x] Create `.env.example` template _(in `void-cloud/.env.example`)_
- [x] Set up Supabase environment variables ✅
- [x] Create Stripe products _(Starter: prod_TWLPQHArrEbTk8, Pro: prod_TWLPkmGZrxnFGV)_
- [x] Create Stripe prices _(Starter: price_1SZIiVAhXjZrIkPTysEXhuIT, Pro: price_1SZIiWAhXjZrIkPTJjdQpU2D)_
- [x] Add Stripe Secret Key to `.env` ✅
- [ ] Add Stripe Webhook Secret _(after deployment)_
- [ ] Add LLM provider API keys to `.env`

### Phase 2: API Backend (Week 2) ✅ DEPLOYED

- [x] Initialize Node.js/Fastify project _(code in `void-cloud/api/`)_
- [x] Implement auth middleware (Supabase JWT validation) _(in `middleware/auth.ts`)_
- [x] Deploy to Railway _(live at `void-cloud-production.up.railway.app`)_
- [x] Implement `/auth/me` endpoint _(in `routes/auth.ts`)_
- [x] Implement `/credits/balance` endpoint _(in `routes/credits.ts`)_
- [x] Implement `/credits/checkout` endpoint _(in `routes/credits.ts`)_
- [x] Implement `/webhooks/stripe` endpoint _(in `routes/webhooks.ts`)_
- [x] Implement rate limiting middleware _(in `middleware/rate-limit.ts`)_
- [x] Implement input validation middleware _(in `middleware/validation.ts`)_
- [x] Implement security headers _(in `middleware/security-headers.ts`)_
- [x] Create Dockerfile _(in `api/Dockerfile`)_
- [ ] Deploy to Railway

### Phase 3: LLM Proxy Integration (Week 3)

- [x] Implement `/llm/chat` endpoint _(in `routes/llm.ts`)_
- [x] Connect to LiteLLM service _(configured in `llm.ts`)_
- [x] Implement token counting (pre-request estimation)
- [x] Implement credit deduction (post-request)
- [x] Implement streaming response forwarding _(basic implementation)_
- [x] Add error handling for insufficient credits _(402 response)_
- [x] Implement `/llm/models` endpoint
- [ ] Test with all configured models

### Phase 4: Void Desktop - Auth (Week 4) ✅ COMPLETE

- [x] Add cloud types to `voidCloudTypes.ts` _(in `common/voidCloudTypes.ts`)_
- [x] Update `voidSettingsTypes.ts` with cloud settings _(added voidCloud\* settings)_
- [x] Implement `VoidCloudService` _(in `browser/voidCloudService.ts`)_
- [x] Add API client methods (auth, credits, LLM)
- [x] ~~Add Supabase client to Void~~ _(using direct API calls instead)_
- [x] Implement Google OAuth flow _(VoidCloudAuthProvider.ts)_
- [x] Handle `void://auth/callback` protocol _(VoidCloudUrlHandler.ts)_
- [x] Test sign in / sign out

### Phase 5: Void Desktop - Integration (Week 5) ✅ COMPLETE

- [x] Modify `sendLLMMessage` for cloud routing _(cloudLLMRouterService.ts)_
- [x] Implement per-provider mode toggle _(in voidCloudTypes.ts)_
- [x] Add `CloudSettings` component _(in void-settings-tsx)_
- [x] Add `CreditBalance` widget _(in sidebar-tsx)_
- [x] Handle 402 insufficient credits error
- [x] Add "Buy Credits" button _(creates Stripe checkout)_
- [x] Test full flow: sign in → send message → credits deducted

### Phase 6: Polish & Testing (Week 6)

- [ ] Add Sentry error tracking
- [ ] Load test LLM proxy
- [ ] Test Stripe webhook handling
- [ ] Test session refresh/expiry
- [ ] Test edge cases (no credits, invalid token, etc.)
- [ ] Documentation
- [ ] Onboarding flow for new users

### Phase 6.5: Pre-Launch Checklist (Week 6-7)

**Legal (BLOCKING):**

- [ ] Terms of Service published
- [ ] Privacy Policy published
- [ ] Refund Policy published
- [ ] Legal links added to checkout flow

**Security:**

- [ ] Rate limiting implemented and tested
- [ ] Input validation on all endpoints
- [ ] CORS configured for production domains only
- [ ] Security headers added (CSP, X-Frame-Options, etc.)
- [ ] Secrets rotation procedure documented

**Operations:**

- [ ] Uptime monitoring configured (Better Uptime / UptimeRobot)
- [ ] Alerting rules set up (error rate, latency)
- [ ] Logging aggregation working (Axiom / Railway logs)
- [ ] Support email configured
- [ ] Incident runbook written

**Quality:**

- [ ] All critical paths manually tested
- [ ] Stripe test mode checkout verified
- [ ] Real payment test ($1 charge, then refund)
- [ ] Update notification tested
- [ ] Error messages are user-friendly

### Phase 7: Auto-Update System (Week 7)

- [ ] Create `void-releases` repository on GitHub
- [ ] Configure electron-builder publish settings in SafeAppeals2.0
- [ ] Set up GitHub Actions release workflow (`.github/workflows/release.yml`)
- [ ] Implement `VoidAutoUpdaterService` in electron-main
- [ ] Add `UpdateNotification` React component
- [ ] Set up code signing:
  - [ ] (Optional) Windows: Purchase code signing certificate
  - [ ] (Required for macOS) Apple Developer account + certificates
  - [ ] Configure GitHub Secrets for signing credentials
- [ ] Test full release cycle: tag → build → publish → auto-update
- [ ] Document release process in README

---

## 11. Cost Analysis

### Infrastructure Costs (Monthly)

| Service      | Free Tier              | Growth (~1000 users) |
| ------------ | ---------------------- | -------------------- |
| **Supabase** | 500MB DB, 50K MAU      | $25/mo (Pro)         |
| **Railway**  | $5 trial credit        | $20-40/mo            |
| **Vercel**   | Generous free          | $0-20/mo             |
| **Stripe**   | 2.9% + $0.30/tx        | Per transaction      |
| **Sentry**   | 5K errors/mo free      | $0                   |
| **Domain**   | N/A                    | ~$1/mo               |
| **GitHub**   | Free (public releases) | $0                   |
| **Total**    | **~$5/mo**             | **~$50-100/mo**      |

### One-Time / Annual Costs

| Item                                | Cost          | Required?                                 |
| ----------------------------------- | ------------- | ----------------------------------------- |
| **Apple Developer Account**         | $99/year      | Required for macOS distribution           |
| **Windows Code Signing (Standard)** | $200-400/year | Recommended (avoids SmartScreen warnings) |
| **Windows Code Signing (EV)**       | $400-600/year | Optional (instant SmartScreen trust)      |
| **Domain**                          | ~$12/year     | Required                                  |

### Unit Economics

```
Example: User buys $25 Pro Pack (750,000 credits)

Revenue: $25.00
- Stripe fees: $1.03 (2.9% + $0.30)
= Net revenue: $23.97

Assuming user uses all credits on Claude Sonnet 4:
- 750K tokens @ $9/M (blended cost) = $6.75 provider cost
- Gross margin: $23.97 - $6.75 = $17.22 (72%)

Assuming user uses all credits on GPT-4o-mini:
- 750K tokens @ $0.375/M (blended cost) = $0.28 provider cost
- Gross margin: $23.97 - $0.28 = $23.69 (99%)

Realistic blend (60% expensive, 40% cheap models):
- Estimated provider cost: ~$4.50
- Gross margin: ~$19.50 (~80%)
```

### Break-even Analysis

```
Fixed costs: ~$50/mo infrastructure
Break-even: 3 x $25 purchases = $75 revenue → ~$60 margin

Target: 10 paying users/month = ~$200 margin
Growth: 50 paying users/month = ~$1,000 margin
```

---

## 12. Auto-Update System

### Overview

Void uses **GitHub Releases + electron-updater** for automatic updates. This approach:

- Hosts builds for free on GitHub Releases
- Automatically notifies users of new versions
- Downloads updates in the background
- Installs on app restart

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUTO-UPDATE FLOW                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. Developer pushes tag (e.g., v1.2.0)                        │
│                    │                                            │
│                    ▼                                            │
│  2. GitHub Actions triggers build workflow                      │
│     - Builds for Windows (NSIS installer)                       │
│     - Builds for macOS (DMG + ZIP, code signed + notarized)    │
│     - Builds for Linux (AppImage + DEB)                        │
│                    │                                            │
│                    ▼                                            │
│  3. Uploads artifacts to GitHub Releases                        │
│     - void-setup-1.2.0.exe                                     │
│     - void-1.2.0.dmg                                           │
│     - void-1.2.0-arm64.dmg (Apple Silicon)                     │
│     - void-1.2.0.AppImage                                      │
│     - latest.yml / latest-mac.yml / latest-linux.yml           │
│                    │                                            │
│                    ▼                                            │
│  4. User's Void app checks for updates (every 4 hours)         │
│     GET github.com/YOUR_ORG/void-releases/releases/latest      │
│                    │                                            │
│                    ▼                                            │
│  5. If newer version available:                                 │
│     - Show notification in app                                  │
│     - Download in background                                    │
│     - Prompt to restart when ready                             │
│     - Install on restart                                        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Repository Setup

Create a **separate repository** for releases (recommended for cleaner release management):

```
GitHub Repositories:
├── SafeAppeals2.0          # Source code (private or public)
└── void-releases           # Release artifacts only (public for auto-update)
```

### 12.1 electron-builder Configuration

Add to your build configuration:

```json
// electron-builder.json or in package.json under "build"
{
	"appId": "com.void.app",
	"productName": "Void",
	"artifactName": "${productName}-${version}-${os}-${arch}.${ext}",

	"publish": {
		"provider": "github",
		"owner": "YOUR_GITHUB_USERNAME",
		"repo": "void-releases",
		"releaseType": "release"
	},

	"win": {
		"target": [
			{
				"target": "nsis",
				"arch": ["x64"]
			}
		],
		"publisherName": "Your Company Name",
		"icon": "resources/icons/win/icon.ico"
	},

	"nsis": {
		"oneClick": false,
		"allowToChangeInstallationDirectory": true,
		"createDesktopShortcut": true,
		"createStartMenuShortcut": true
	},

	"mac": {
		"target": [
			{
				"target": "dmg",
				"arch": ["x64", "arm64"]
			},
			{
				"target": "zip",
				"arch": ["x64", "arm64"]
			}
		],
		"category": "public.app-category.developer-tools",
		"icon": "resources/icons/mac/icon.icns",
		"hardenedRuntime": true,
		"gatekeeperAssess": false,
		"entitlements": "build/entitlements.mac.plist",
		"entitlementsInherit": "build/entitlements.mac.plist"
	},

	"dmg": {
		"sign": false
	},

	"linux": {
		"target": [
			{
				"target": "AppImage",
				"arch": ["x64"]
			},
			{
				"target": "deb",
				"arch": ["x64"]
			}
		],
		"category": "Development",
		"icon": "resources/icons/png"
	},

	"directories": {
		"output": "dist",
		"buildResources": "build"
	}
}
```

### 12.2 macOS Entitlements

```xml
<!-- build/entitlements.mac.plist -->
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.cs.allow-jit</key>
    <true/>
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
    <key>com.apple.security.network.client</key>
    <true/>
    <key>com.apple.security.network.server</key>
    <true/>
    <key>com.apple.security.files.user-selected.read-write</key>
    <true/>
</dict>
</plist>
```

### 12.3 GitHub Actions Release Workflow

```yaml
# .github/workflows/release.yml
name: Build and Release

on:
  push:
    tags:
      - "v*" # Triggers on v1.0.0, v1.2.3, etc.

env:
  GH_TOKEN: ${{ secrets.GH_TOKEN }} # PAT with repo access to void-releases

jobs:
  # ============================================
  # Build for Windows
  # ============================================
  build-windows:
    runs-on: windows-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Build & Publish (Windows)
        env:
          # Optional: Windows code signing
          WIN_CSC_LINK: ${{ secrets.WIN_CSC_LINK }}
          WIN_CSC_KEY_PASSWORD: ${{ secrets.WIN_CSC_KEY_PASSWORD }}
        run: npm run publish -- --win

  # ============================================
  # Build for macOS
  # ============================================
  build-macos:
    runs-on: macos-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      # Import code signing certificate
      - name: Import Code Signing Certificate
        env:
          MAC_CERTS: ${{ secrets.MAC_CERTS }}
          MAC_CERTS_PASSWORD: ${{ secrets.MAC_CERTS_PASSWORD }}
        run: |
          echo $MAC_CERTS | base64 --decode > certificate.p12
          security create-keychain -p actions build.keychain
          security default-keychain -s build.keychain
          security unlock-keychain -p actions build.keychain
          security import certificate.p12 -k build.keychain -P $MAC_CERTS_PASSWORD -T /usr/bin/codesign
          security set-key-partition-list -S apple-tool:,apple:,codesign: -s -k actions build.keychain

      - name: Build & Publish (macOS)
        env:
          # Notarization credentials
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: npm run publish -- --mac

  # ============================================
  # Build for Linux
  # ============================================
  build-linux:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Build & Publish (Linux)
        run: npm run publish -- --linux
```

### 12.4 Auto-Updater Service (Void Desktop)

```typescript
// src/vs/workbench/contrib/void/electron-main/voidAutoUpdater.ts

import { autoUpdater, UpdateCheckResult, UpdateInfo } from "electron-updater";
import { BrowserWindow, dialog, ipcMain } from "electron";
import { ILogService } from "vs/platform/log/common/log";

export interface IVoidAutoUpdaterService {
	initialize(mainWindow: BrowserWindow): void;
	checkForUpdates(): Promise<UpdateCheckResult | null>;
	quitAndInstall(): void;
}

export class VoidAutoUpdaterService implements IVoidAutoUpdaterService {
	private mainWindow: BrowserWindow | null = null;
	private updateDownloaded = false;

	constructor(@ILogService private readonly logService: ILogService) {
		this.configureAutoUpdater();
		this.setupEventHandlers();
		this.setupIpcHandlers();
	}

	private configureAutoUpdater(): void {
		// Configure update source
		autoUpdater.setFeedURL({
			provider: "github",
			owner: "YOUR_GITHUB_USERNAME",
			repo: "void-releases",
		});

		// Don't auto-download, let user decide
		autoUpdater.autoDownload = false;

		// Don't auto-install on quit
		autoUpdater.autoInstallOnAppQuit = false;

		// Allow pre-release updates (optional)
		autoUpdater.allowPrerelease = false;

		// Full changelog
		autoUpdater.fullChangelog = true;
	}

	initialize(mainWindow: BrowserWindow): void {
		this.mainWindow = mainWindow;

		// Check for updates on startup (delayed)
		setTimeout(() => {
			this.checkForUpdates();
		}, 10000); // 10 seconds after launch

		// Check for updates periodically (every 4 hours)
		setInterval(() => {
			this.checkForUpdates();
		}, 4 * 60 * 60 * 1000);
	}

	async checkForUpdates(): Promise<UpdateCheckResult | null> {
		try {
			this.logService.info("[AutoUpdater] Checking for updates...");
			const result = await autoUpdater.checkForUpdates();
			return result;
		} catch (error) {
			this.logService.error("[AutoUpdater] Update check failed:", error);
			return null;
		}
	}

	quitAndInstall(): void {
		if (this.updateDownloaded) {
			autoUpdater.quitAndInstall(false, true);
		}
	}

	private setupEventHandlers(): void {
		autoUpdater.on("checking-for-update", () => {
			this.logService.info("[AutoUpdater] Checking for update...");
			this.sendToRenderer("update-checking");
		});

		autoUpdater.on("update-available", (info: UpdateInfo) => {
			this.logService.info("[AutoUpdater] Update available:", info.version);
			this.sendToRenderer("update-available", {
				version: info.version,
				releaseDate: info.releaseDate,
				releaseNotes: info.releaseNotes,
			});

			// Prompt user to download
			if (this.mainWindow) {
				dialog
					.showMessageBox(this.mainWindow, {
						type: "info",
						title: "Update Available",
						message: `A new version of Void is available (v${info.version})`,
						detail: "Would you like to download it now?",
						buttons: ["Download", "Later"],
						defaultId: 0,
					})
					.then((result) => {
						if (result.response === 0) {
							autoUpdater.downloadUpdate();
						}
					});
			}
		});

		autoUpdater.on("update-not-available", () => {
			this.logService.info("[AutoUpdater] No updates available");
			this.sendToRenderer("update-not-available");
		});

		autoUpdater.on("download-progress", (progress) => {
			this.logService.info(
				`[AutoUpdater] Download progress: ${progress.percent.toFixed(1)}%`
			);
			this.sendToRenderer("update-download-progress", {
				percent: progress.percent,
				bytesPerSecond: progress.bytesPerSecond,
				total: progress.total,
				transferred: progress.transferred,
			});
		});

		autoUpdater.on("update-downloaded", (info: UpdateInfo) => {
			this.logService.info("[AutoUpdater] Update downloaded:", info.version);
			this.updateDownloaded = true;
			this.sendToRenderer("update-downloaded", {
				version: info.version,
			});

			// Prompt user to install
			if (this.mainWindow) {
				dialog
					.showMessageBox(this.mainWindow, {
						type: "info",
						title: "Update Ready",
						message: `Void v${info.version} has been downloaded`,
						detail:
							"The update will be installed when you restart. Restart now?",
						buttons: ["Restart Now", "Later"],
						defaultId: 0,
					})
					.then((result) => {
						if (result.response === 0) {
							this.quitAndInstall();
						}
					});
			}
		});

		autoUpdater.on("error", (error) => {
			this.logService.error("[AutoUpdater] Error:", error);
			this.sendToRenderer("update-error", {
				message: error.message,
			});
		});
	}

	private setupIpcHandlers(): void {
		ipcMain.handle("updater:check", async () => {
			return this.checkForUpdates();
		});

		ipcMain.handle("updater:download", async () => {
			return autoUpdater.downloadUpdate();
		});

		ipcMain.handle("updater:install", () => {
			this.quitAndInstall();
		});
	}

	private sendToRenderer(channel: string, data?: any): void {
		if (this.mainWindow && !this.mainWindow.isDestroyed()) {
			this.mainWindow.webContents.send(channel, data);
		}
	}
}
```

### 12.5 Update UI Component (React)

```tsx
// src/vs/workbench/contrib/void/browser/react/src/components/UpdateNotification.tsx

import React, { useState, useEffect } from "react";

interface UpdateInfo {
	version: string;
	releaseDate?: string;
	releaseNotes?: string;
}

interface DownloadProgress {
	percent: number;
	bytesPerSecond: number;
	total: number;
	transferred: number;
}

export const UpdateNotification: React.FC = () => {
	const [status, setStatus] = useState<
		"idle" | "checking" | "available" | "downloading" | "ready"
	>("idle");
	const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
	const [progress, setProgress] = useState<DownloadProgress | null>(null);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		// Listen for update events from main process
		const listeners = [
			window.electronAPI?.on("update-checking", () => {
				setStatus("checking");
			}),

			window.electronAPI?.on("update-available", (info: UpdateInfo) => {
				setStatus("available");
				setUpdateInfo(info);
			}),

			window.electronAPI?.on("update-not-available", () => {
				setStatus("idle");
			}),

			window.electronAPI?.on(
				"update-download-progress",
				(prog: DownloadProgress) => {
					setStatus("downloading");
					setProgress(prog);
				}
			),

			window.electronAPI?.on("update-downloaded", (info: UpdateInfo) => {
				setStatus("ready");
				setUpdateInfo(info);
				setProgress(null);
			}),

			window.electronAPI?.on(
				"update-error",
				({ message }: { message: string }) => {
					setError(message);
					setStatus("idle");
				}
			),
		];

		return () => {
			listeners.forEach((unsubscribe) => unsubscribe?.());
		};
	}, []);

	const handleDownload = () => {
		window.electronAPI?.invoke("updater:download");
	};

	const handleInstall = () => {
		window.electronAPI?.invoke("updater:install");
	};

	const handleDismiss = () => {
		setStatus("idle");
		setUpdateInfo(null);
		setError(null);
	};

	// Don't show anything if idle or just checking
	if (status === "idle" || status === "checking") {
		return null;
	}

	return (
		<div className="update-notification">
			{status === "available" && updateInfo && (
				<div className="update-available">
					<div className="update-icon">🎉</div>
					<div className="update-content">
						<strong>Update Available</strong>
						<span>Version {updateInfo.version} is ready to download</span>
					</div>
					<div className="update-actions">
						<button onClick={handleDownload} className="primary">
							Download
						</button>
						<button onClick={handleDismiss} className="secondary">
							Later
						</button>
					</div>
				</div>
			)}

			{status === "downloading" && progress && (
				<div className="update-downloading">
					<div className="update-icon">⬇️</div>
					<div className="update-content">
						<strong>Downloading Update</strong>
						<div className="progress-bar">
							<div
								className="progress-fill"
								style={{ width: `${progress.percent}%` }}
							/>
						</div>
						<span>
							{Math.round(progress.percent)}% •
							{formatBytes(progress.transferred)} /{" "}
							{formatBytes(progress.total)}
						</span>
					</div>
				</div>
			)}

			{status === "ready" && updateInfo && (
				<div className="update-ready">
					<div className="update-icon">✅</div>
					<div className="update-content">
						<strong>Update Ready</strong>
						<span>Version {updateInfo.version} will install on restart</span>
					</div>
					<div className="update-actions">
						<button onClick={handleInstall} className="primary">
							Restart Now
						</button>
						<button onClick={handleDismiss} className="secondary">
							Later
						</button>
					</div>
				</div>
			)}

			{error && (
				<div className="update-error">
					<span>Update error: {error}</span>
					<button onClick={handleDismiss}>Dismiss</button>
				</div>
			)}
		</div>
	);
};

function formatBytes(bytes: number): string {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

### 12.6 Styles for Update Notification

```css
/* src/vs/workbench/contrib/void/browser/react/src/components/UpdateNotification.css */

.update-notification {
	position: fixed;
	bottom: 20px;
	right: 20px;
	background: var(--vscode-notifications-background);
	border: 1px solid var(--vscode-notifications-border);
	border-radius: 8px;
	padding: 16px;
	max-width: 360px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
	z-index: 10000;
	animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
	from {
		transform: translateY(20px);
		opacity: 0;
	}
	to {
		transform: translateY(0);
		opacity: 1;
	}
}

.update-available,
.update-downloading,
.update-ready {
	display: flex;
	align-items: flex-start;
	gap: 12px;
}

.update-icon {
	font-size: 24px;
	line-height: 1;
}

.update-content {
	flex: 1;
	display: flex;
	flex-direction: column;
	gap: 4px;
}

.update-content strong {
	color: var(--vscode-foreground);
}

.update-content span {
	color: var(--vscode-descriptionForeground);
	font-size: 12px;
}

.update-actions {
	display: flex;
	gap: 8px;
	margin-top: 8px;
}

.update-actions button {
	padding: 6px 12px;
	border-radius: 4px;
	border: none;
	cursor: pointer;
	font-size: 12px;
}

.update-actions button.primary {
	background: var(--vscode-button-background);
	color: var(--vscode-button-foreground);
}

.update-actions button.primary:hover {
	background: var(--vscode-button-hoverBackground);
}

.update-actions button.secondary {
	background: transparent;
	color: var(--vscode-foreground);
	border: 1px solid var(--vscode-button-border);
}

.progress-bar {
	height: 4px;
	background: var(--vscode-progressBar-background);
	border-radius: 2px;
	overflow: hidden;
	margin: 8px 0;
}

.progress-fill {
	height: 100%;
	background: var(--vscode-progressBar-background);
	background: #0078d4;
	transition: width 0.2s ease;
}

.update-error {
	color: var(--vscode-errorForeground);
	display: flex;
	justify-content: space-between;
	align-items: center;
}
```

### 12.7 Code Signing Requirements

For users to install updates without security warnings:

**Windows:**

```
□ Purchase code signing certificate (~$200-400/year)
  - Providers: DigiCert, Sectigo, SSL.com
  - EV certificates provide SmartScreen reputation instantly
  - Standard certificates need reputation build-up

□ Store certificate as base64 in GitHub Secrets:
  - WIN_CSC_LINK: base64-encoded .pfx file
  - WIN_CSC_KEY_PASSWORD: certificate password
```

**macOS:**

```
□ Apple Developer account ($99/year)

□ Create signing certificate:
  - Developer ID Application certificate
  - Developer ID Installer certificate (for pkg)

□ Export and store in GitHub Secrets:
  - MAC_CERTS: base64-encoded .p12 file
  - MAC_CERTS_PASSWORD: certificate password

□ Notarization credentials:
  - APPLE_ID: your Apple ID email
  - APPLE_APP_SPECIFIC_PASSWORD: app-specific password
  - APPLE_TEAM_ID: your team ID
```

**Linux:**

```
□ No code signing required
□ AppImage is self-contained, works everywhere
```

### 12.8 Releasing a New Version

```bash
# 1. Update version in package.json
npm version patch  # or minor, major

# 2. Commit the version bump
git add package.json
git commit -m "chore: bump version to X.Y.Z"

# 3. Create and push tag
git tag v1.2.3
git push origin main --tags

# 4. GitHub Actions automatically:
#    - Builds for all platforms
#    - Signs and notarizes
#    - Uploads to GitHub Releases
#    - Creates release with changelog

# 5. Users automatically receive update notification
```

### 12.9 Implementation Phase Addition

Add to Phase 6 or create Phase 7:

```
### Phase 7: Auto-Update System (Week 7)
- [ ] Create void-releases repository on GitHub
- [ ] Configure electron-builder publish settings
- [ ] Set up GitHub Actions release workflow
- [ ] Implement VoidAutoUpdaterService
- [ ] Add UpdateNotification component
- [ ] (Optional) Purchase Windows code signing certificate
- [ ] (Required for macOS) Set up Apple Developer account
- [ ] Test full release cycle: tag → build → publish → update
```

---

## 13. Legal & Compliance

### 13.1 Required Legal Documents

**Terms of Service (ToS)** - Required before accepting payments

```
Must include:
□ Description of service
□ User responsibilities
□ Acceptable use policy (no illegal content, spam, abuse)
□ Payment terms and refund policy
□ Limitation of liability
□ Disclaimer of warranties
□ Termination conditions
□ Governing law and jurisdiction
□ Dispute resolution process
□ Changes to terms (notification process)
```

**Privacy Policy** - Required by law in most jurisdictions

```
Must include:
□ What data you collect
  - Account info (email, name from Google)
  - Usage data (requests, tokens, models used)
  - Payment info (handled by Stripe)

□ How you use the data
  - Provide service
  - Billing
  - Analytics (aggregated)
  - Support

□ Third parties who receive data
  - Supabase (database, auth)
  - Stripe (payments)
  - LLM providers (Anthropic, OpenAI, Google)
  - Sentry (error tracking)

□ Data retention periods
  - Account data: Until deletion requested
  - Usage logs: 90 days
  - Payment records: 7 years (legal requirement)

□ User rights
  - Access their data
  - Delete their account
  - Export their data
  - Opt-out of marketing

□ Cookie policy (if dashboard uses cookies)

□ Contact information for privacy inquiries
```

**Refund Policy**

```
Recommended policy:
□ Full refund within 7 days if <10% of credits used
□ Pro-rata refund for unused credits (minus processing fees)
□ No refund for used credits
□ Chargebacks may result in account suspension
□ Process: Email support@yourdomain.com
```

### 13.2 Where to Host Legal Documents

```
Options:
1. Dashboard pages (recommended)
   - yourdomain.com/terms
   - yourdomain.com/privacy
   - yourdomain.com/refunds

2. GitHub Pages (free, easy)
   - docs.yourdomain.com/legal/terms

3. Notion (quick to set up)
   - notion.so/yourcompany/terms
```

### 13.3 Legal Document Templates

**Recommended Services (generate + customize):**

- **Termly** - Free tier, GDPR compliant
- **iubenda** - €27/year, comprehensive
- **Rocket Lawyer** - Templates + legal review
- **Legal Templates** - One-time purchase

**Cost estimate:** $50-200 for templates

**Lawyer review (recommended):** $300-1000 depending on jurisdiction

### 13.4 GDPR Compliance (If EU Users)

```
Required if you have EU users:

□ Lawful basis for processing
  - Contract (providing the service)
  - Legitimate interest (fraud prevention)
  - Consent (marketing emails)

□ Right to be forgotten
  - Implement account deletion endpoint
  - Delete from: Supabase, Stripe customer (anonymize), logs

□ Data portability
  - Export endpoint for user data
  - Format: JSON or CSV

□ Data Processing Agreement (DPA)
  - Supabase has one: supabase.com/legal/dpa
  - Stripe has one: stripe.com/legal/dpa

□ Cookie consent banner (if using cookies)
```

### 13.5 Checkout Flow Legal Requirements

```
Before payment, user must:
□ See total price clearly
□ Acknowledge Terms of Service (checkbox or link)
□ Acknowledge Privacy Policy
□ See refund policy or "no refunds" notice

Stripe Checkout handles most of this, but add:
- Link to ToS in checkout metadata
- Email receipt with links to policies
```

---

## 14. Security Checklist

### 14.1 Rate Limiting Implementation

```typescript
// api/src/middleware/rate-limit.ts
import { FastifyRequest, FastifyReply } from "fastify";
import { Redis } from "ioredis";

// Use Redis for distributed rate limiting
const redis = new Redis(process.env.REDIS_URL);

interface RateLimitConfig {
	windowMs: number; // Time window in ms
	maxRequests: number; // Max requests per window
	keyPrefix: string; // Redis key prefix
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
	// Authenticated users
	"llm:user": {
		windowMs: 60 * 1000, // 1 minute
		maxRequests: 60, // 60 requests/minute
		keyPrefix: "rl:llm:user:",
	},
	// Per-IP for unauthenticated
	"auth:ip": {
		windowMs: 60 * 1000,
		maxRequests: 20,
		keyPrefix: "rl:auth:ip:",
	},
	// Webhook (high limit, but protect from abuse)
	"webhook:ip": {
		windowMs: 60 * 1000,
		maxRequests: 100,
		keyPrefix: "rl:webhook:ip:",
	},
};

export async function rateLimit(
	request: FastifyRequest,
	reply: FastifyReply,
	limitType: keyof typeof RATE_LIMITS
) {
	const config = RATE_LIMITS[limitType];
	const key = config.keyPrefix + (request.user?.id || request.ip);

	const current = await redis.incr(key);
	if (current === 1) {
		await redis.pexpire(key, config.windowMs);
	}

	// Set headers
	reply.header("X-RateLimit-Limit", config.maxRequests);
	reply.header(
		"X-RateLimit-Remaining",
		Math.max(0, config.maxRequests - current)
	);
	reply.header(
		"X-RateLimit-Reset",
		Math.ceil(Date.now() / 1000) + Math.ceil(config.windowMs / 1000)
	);

	if (current > config.maxRequests) {
		reply.header("Retry-After", Math.ceil(config.windowMs / 1000));
		return reply.status(429).send({
			error: {
				code: "RATE_LIMITED",
				message: "Too many requests. Please slow down.",
				retryAfter: Math.ceil(config.windowMs / 1000),
			},
		});
	}
}
```

**Alternative (no Redis):** Use in-memory with `@fastify/rate-limit` plugin

```typescript
// Simple in-memory rate limiting (single instance only)
import rateLimit from "@fastify/rate-limit";

await app.register(rateLimit, {
	max: 60,
	timeWindow: "1 minute",
	keyGenerator: (request) => request.user?.id || request.ip,
});
```

### 14.2 Input Validation

```typescript
// api/src/middleware/validation.ts
import { FastifyRequest, FastifyReply } from "fastify";

// Request size limits
export const REQUEST_LIMITS = {
	maxBodySize: 1 * 1024 * 1024, // 1MB max body
	maxMessageLength: 100 * 1024, // 100KB per message
	maxMessages: 100, // 100 messages per request
	maxTokensRequested: 100_000, // 100K tokens max
};

// Validation for /llm/chat
export function validateChatRequest(
	request: FastifyRequest,
	reply: FastifyReply
) {
	const body = request.body as any;

	// Validate messages exist
	if (!Array.isArray(body.messages) || body.messages.length === 0) {
		return reply.status(400).send({
			error: { code: "INVALID_REQUEST", message: "messages array is required" },
		});
	}

	// Check message count
	if (body.messages.length > REQUEST_LIMITS.maxMessages) {
		return reply.status(400).send({
			error: {
				code: "INVALID_REQUEST",
				message: `Maximum ${REQUEST_LIMITS.maxMessages} messages allowed`,
			},
		});
	}

	// Check each message
	for (const msg of body.messages) {
		if (
			typeof msg.content === "string" &&
			msg.content.length > REQUEST_LIMITS.maxMessageLength
		) {
			return reply.status(400).send({
				error: {
					code: "INVALID_REQUEST",
					message: `Message content exceeds ${REQUEST_LIMITS.maxMessageLength} characters`,
				},
			});
		}
	}

	// Validate max_tokens if provided
	if (body.max_tokens && body.max_tokens > REQUEST_LIMITS.maxTokensRequested) {
		return reply.status(400).send({
			error: {
				code: "INVALID_REQUEST",
				message: `max_tokens cannot exceed ${REQUEST_LIMITS.maxTokensRequested}`,
			},
		});
	}
}
```

### 14.3 Security Headers

```typescript
// api/src/middleware/security-headers.ts
import { FastifyInstance } from "fastify";

export function addSecurityHeaders(app: FastifyInstance) {
	app.addHook("onSend", async (request, reply) => {
		// Prevent MIME type sniffing
		reply.header("X-Content-Type-Options", "nosniff");

		// Prevent clickjacking
		reply.header("X-Frame-Options", "DENY");

		// XSS protection (legacy browsers)
		reply.header("X-XSS-Protection", "1; mode=block");

		// HTTPS only (after you have SSL)
		reply.header(
			"Strict-Transport-Security",
			"max-age=31536000; includeSubDomains"
		);

		// Don't leak referrer to other sites
		reply.header("Referrer-Policy", "strict-origin-when-cross-origin");

		// Permissions policy
		reply.header(
			"Permissions-Policy",
			"camera=(), microphone=(), geolocation=()"
		);
	});
}
```

### 14.4 CORS Configuration

```typescript
// api/src/config/cors.ts
import cors from "@fastify/cors";

// Production CORS - only allow your domains
const ALLOWED_ORIGINS = [
	"https://yourdomain.com",
	"https://dashboard.yourdomain.com",
	"https://app.yourdomain.com",
	// Void desktop app (Electron)
	"file://",
	"void://",
];

// Development: also allow localhost
if (process.env.NODE_ENV === "development") {
	ALLOWED_ORIGINS.push("http://localhost:3000");
	ALLOWED_ORIGINS.push("http://localhost:5173");
}

export const corsConfig = {
	origin: (origin: string, callback: Function) => {
		// Allow requests with no origin (mobile apps, Electron, curl)
		if (!origin) {
			return callback(null, true);
		}

		if (ALLOWED_ORIGINS.includes(origin)) {
			return callback(null, true);
		}

		return callback(new Error("Not allowed by CORS"), false);
	},
	credentials: true,
	methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
	allowedHeaders: ["Content-Type", "Authorization"],
};
```

### 14.5 Secrets Management

```
Secrets Checklist:
─────────────────────────────────────────────────────────

□ All secrets in environment variables (never in code)

□ Different secrets for dev/staging/prod

□ Documented in .env.example (without actual values)

□ Rotation procedure documented:
  1. Generate new key
  2. Add new key to env vars
  3. Deploy with new key
  4. Revoke old key

□ Access control:
  - Railway: Only project admins can see env vars
  - GitHub: Secrets only accessible to Actions

□ Regular rotation schedule:
  - API keys: Every 90 days (or on employee departure)
  - Webhook secrets: Every 6 months
  - Signing certificates: Before expiry
```

### 14.6 Dependency Security

```bash
# Check for vulnerabilities regularly
npm audit

# Fix automatically where possible
npm audit fix

# For unfixable issues, document accepted risks

# Set up automated scanning:
# - Dependabot (GitHub native)
# - Snyk (more comprehensive)
```

### 14.7 Security Checklist Summary

```
Before Launch:
□ Rate limiting on all endpoints
□ Input validation on /llm/chat
□ Request body size limit (1MB)
□ CORS whitelist (not origin: *)
□ Security headers added
□ npm audit shows no critical vulnerabilities
□ Secrets not in code
□ Stripe webhook signature verification
□ SQL injection prevented (use parameterized queries)

Ongoing:
□ Weekly npm audit
□ Monitor for unusual activity
□ Rotate secrets on schedule
□ Review access logs
```

---

## 15. Monitoring & Observability

### 15.1 Health Check Endpoints

```typescript
// api/src/routes/health.ts
import { FastifyInstance } from "fastify";
import { supabase } from "../services/supabase";

export async function healthRoutes(app: FastifyInstance) {
	// Basic health check (for load balancers)
	app.get("/health", async () => {
		return { status: "ok", timestamp: new Date().toISOString() };
	});

	// Detailed health check (for monitoring)
	app.get("/health/detailed", async () => {
		const checks = {
			api: "ok",
			database: "unknown",
			litellm: "unknown",
			stripe: "unknown",
		};

		// Check database
		try {
			const { error } = await supabase.from("profiles").select("id").limit(1);
			checks.database = error ? "error" : "ok";
		} catch {
			checks.database = "error";
		}

		// Check LiteLLM
		try {
			const res = await fetch(`${process.env.LITELLM_URL}/health`);
			checks.litellm = res.ok ? "ok" : "error";
		} catch {
			checks.litellm = "error";
		}

		// Overall status
		const allOk = Object.values(checks).every((v) => v === "ok");

		return {
			status: allOk ? "healthy" : "degraded",
			checks,
			timestamp: new Date().toISOString(),
		};
	});
}
```

### 15.2 Uptime Monitoring Setup

**Better Uptime (Recommended - Free Tier)**

```
1. Create account at betteruptime.com
2. Add monitors:
   - API: https://api.yourdomain.com/health
     Check interval: 1 minute
     Alert after: 2 failures

   - LiteLLM (if public): https://llm.yourdomain.com/health
     Check interval: 1 minute

3. Configure alerts:
   - Email (immediate)
   - SMS (after 5 min down)
   - Slack webhook (optional)

4. Create status page:
   - status.yourdomain.com
   - Shows uptime history
   - Incident updates
```

**UptimeRobot (Alternative - Free Tier)**

```
1. Create account at uptimerobot.com
2. Add monitors (same as above)
3. 50 monitors free, 5-minute intervals
```

### 15.3 Error Tracking (Sentry)

```typescript
// api/src/config/sentry.ts
import * as Sentry from "@sentry/node";

Sentry.init({
	dsn: process.env.SENTRY_DSN,
	environment: process.env.NODE_ENV,

	// Capture 100% of errors
	sampleRate: 1.0,

	// Capture 10% of transactions for performance
	tracesSampleRate: 0.1,

	// Filter out sensitive data
	beforeSend(event) {
		// Remove user messages from error context
		if (event.extra?.messages) {
			event.extra.messages = "[REDACTED]";
		}
		return event;
	},

	// Ignore common non-errors
	ignoreErrors: [
		"Network request failed",
		"ResizeObserver loop limit exceeded",
	],
});

// Usage in routes
app.setErrorHandler((error, request, reply) => {
	// Capture to Sentry
	Sentry.captureException(error, {
		extra: {
			requestId: request.id,
			userId: request.user?.id,
			path: request.url,
		},
	});

	// Return generic error to user
	reply.status(500).send({
		error: {
			code: "INTERNAL_ERROR",
			message: "An unexpected error occurred",
			requestId: request.id,
		},
	});
});
```

### 15.4 Logging Strategy

```typescript
// api/src/config/logger.ts
import pino from "pino";

export const logger = pino({
	level: process.env.LOG_LEVEL || "info",

	// JSON format for production
	...(process.env.NODE_ENV === "production"
		? {}
		: {
				transport: {
					target: "pino-pretty",
					options: { colorize: true },
				},
		  }),

	// Standard fields
	base: {
		service: "void-cloud-api",
		env: process.env.NODE_ENV,
	},

	// Redact sensitive fields
	redact: [
		"req.headers.authorization",
		"req.body.password",
		"req.body.messages[*].content", // Don't log user messages!
	],
});

// Request logging
app.addHook("onRequest", async (request) => {
	request.log = logger.child({
		requestId: request.id,
		userId: request.user?.id,
	});
});

// Example usage in routes
app.post("/llm/chat", async (request, reply) => {
	request.log.info(
		{
			action: "llm_request",
			model: request.body.model,
			messageCount: request.body.messages.length,
		},
		"LLM request started"
	);

	// ... handle request

	request.log.info(
		{
			action: "llm_response",
			model: request.body.model,
			inputTokens: usage.input,
			outputTokens: usage.output,
			latencyMs: Date.now() - startTime,
		},
		"LLM request completed"
	);
});
```

### 15.5 Metrics & Dashboards

**Option 1: Railway Built-in Metrics**

```
- CPU usage
- Memory usage
- Request count
- Basic for free tier
```

**Option 2: Grafana Cloud (Free Tier)**

```
1. Create account at grafana.com
2. Set up Prometheus metrics endpoint
3. Import Node.js dashboard
4. Add custom panels:
   - Requests per minute
   - Error rate
   - P95 latency
   - Credits consumed
```

**Option 3: Custom Dashboard with Supabase**

```sql
-- Create a simple metrics view
CREATE VIEW usage_metrics AS
SELECT
  date_trunc('hour', created_at) as hour,
  count(*) as request_count,
  sum(total_tokens) as total_tokens,
  sum(credits_charged) as credits_charged,
  avg(latency_ms) as avg_latency_ms,
  count(*) filter (where status = 'failed') as error_count
FROM usage_records
WHERE created_at > now() - interval '7 days'
GROUP BY 1
ORDER BY 1 DESC;
```

### 15.6 Alerting Rules

```
Critical Alerts (SMS/Call):
─────────────────────────────────────────────────────────
□ API down for > 2 minutes
□ LiteLLM down for > 2 minutes
□ Error rate > 20% for 5 minutes
□ Database connection failures

High Priority Alerts (Email/Slack):
─────────────────────────────────────────────────────────
□ Error rate > 5% for 5 minutes
□ P95 latency > 30 seconds
□ Provider API errors > 10%
□ Low provider API balance
□ Stripe webhook failures

Informational (Daily Digest):
─────────────────────────────────────────────────────────
□ Daily active users
□ Revenue summary
□ Most used models
□ Error summary
```

### 15.7 Incident Response Runbook

```markdown
# Incident Response Runbook

## When API is Down

1. Check Railway dashboard for deployment status
2. Check Sentry for recent errors
3. Check database connectivity (Supabase status)
4. Check LiteLLM service logs
5. If deploying, rollback to previous version
6. If database, check Supabase status page
7. Post update to status page

## When Error Rate Spikes

1. Check Sentry for error patterns
2. Check if specific endpoint or all endpoints
3. Check if specific model or all models
4. Check provider status pages (status.anthropic.com, status.openai.com)
5. If provider issue, consider disabling that model temporarily
6. If our issue, check recent deployments for regression

## When Latency is High

1. Check if specific model or all models
2. Check LiteLLM queue depth
3. Check database query performance
4. Check for traffic spike (rate limiting helping?)
5. Consider scaling up Railway instance

## Contact Information

- On-call: [your phone]
- Escalation: [backup phone]
- Supabase support: support@supabase.com
- Stripe support: support@stripe.com
- Railway support: support@railway.app
```

---

## 16. Production Readiness Checklist

### 16.1 Pre-Launch Verification

**Legal & Compliance ✓**

```
□ Terms of Service published and linked
□ Privacy Policy published and linked
□ Refund Policy published and linked
□ Legal links in Stripe checkout flow
□ Cookie consent (if applicable)
```

**Security ✓**

```
□ Rate limiting on all public endpoints
□ Input validation on /llm/chat
□ Request body size limits configured
□ CORS whitelist (no wildcards)
□ Security headers (CSP, X-Frame-Options, etc.)
□ No secrets in code or logs
□ npm audit - no critical vulnerabilities
□ Stripe webhook signature verification working
□ Database RLS policies active
```

**Infrastructure ✓**

```
□ Health check endpoints responding
□ Uptime monitoring configured
□ Error tracking (Sentry) working
□ Logging working and not leaking PII
□ Environment variables documented
□ Database backups enabled (Supabase Pro)
□ SSL certificates valid
□ Custom domain configured
```

**Payments ✓**

```
□ Stripe products created correctly
□ Stripe webhook receiving events
□ Test checkout flow (test mode)
□ Test real payment (small amount, then refund)
□ Credits added after successful payment
□ Receipt emails sending
```

**Application ✓**

```
□ All critical user flows tested:
  □ Sign up with Google
  □ View credit balance
  □ Purchase credits
  □ Send LLM request (credits deducted)
  □ See usage in history
  □ Sign out
□ Error messages are user-friendly
□ Loading states shown during async operations
□ Mobile-friendly (if web dashboard)
```

**Desktop App (Void) ✓**

```
□ Cloud mode toggle working
□ Sign in with Google working
□ Credit balance displayed
□ Requests route through cloud correctly
□ Insufficient credits error handled
□ Auto-update working
□ Builds for Win/Mac/Linux working
```

### 16.2 Launch Day Checklist

```
Morning:
□ Check all monitoring is green
□ Check Stripe dashboard for any pending issues
□ Check provider API balances
□ Notify support channel of launch

During Launch:
□ Monitor error rates closely
□ Monitor Stripe for first payments
□ Check first few users can complete flow
□ Be ready to hotfix

After Launch:
□ Check first 10 user signups succeeded
□ Check first payments processed correctly
□ Monitor social/support for feedback
□ Send thank you to first users (optional)
```

### 16.3 Post-Launch Week 1

```
□ Address critical bugs same-day
□ Respond to support emails within 24h
□ Review error patterns in Sentry
□ Review user feedback
□ Check revenue vs projections
□ Plan Week 2 improvements
```

### 16.4 Ongoing Operations

**Daily:**

```
□ Check error rate dashboard
□ Check uptime monitoring
□ Respond to support emails
```

**Weekly:**

```
□ Review Sentry error trends
□ Review revenue dashboard
□ npm audit for vulnerabilities
□ Check provider API usage/costs
□ Review usage patterns
```

**Monthly:**

```
□ Review and pay provider invoices
□ Review and optimize costs
□ Security review (access, secrets)
□ Backup restore test
□ Review and update documentation
```

---

## Appendix A: File Changes Summary

### New Files to Create

```
src/vs/workbench/contrib/void/
├── common/
│   └── voidCloudTypes.ts           # NEW: Cloud-related types
│
├── browser/
│   ├── voidCloudService.ts         # NEW: Cloud service implementation
│   │
│   └── react/src/
│       ├── void-settings/
│       │   └── CloudSettings.tsx   # NEW: Cloud settings UI
│       │
│       └── sidebar-tsx/
│           └── CreditBalance.tsx   # NEW: Credit display widget
```

### Files to Modify

```
src/vs/workbench/contrib/void/
├── common/
│   └── voidSettingsTypes.ts        # ADD: cloudAuthState, cloudModeOfProvider, etc.
│
├── browser/
│   └── void.contribution.ts        # ADD: Register VoidCloudService
│
└── electron-main/
    └── llmMessage/
        └── sendLLMMessage.impl.ts  # ADD: Cloud routing logic
```

---

## Appendix B: Environment Variables Reference

```bash
# ===========================================
# VOID CLOUD API SERVICE
# ===========================================

# Server
NODE_ENV=production
PORT=3000
API_URL=https://api.voidcloud.dev

# Supabase (get from Supabase Dashboard → Settings → API)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_KEY=eyJhbGc...  # Server-side only, never expose

# Stripe (get from Stripe Dashboard → Developers → API keys)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...

# LiteLLM (internal Railway service URL)
LITELLM_URL=http://litellm-service.railway.internal:4000

# ===========================================
# LITELLM SERVICE
# ===========================================

# Provider API Keys (get from each provider)
ANTHROPIC_API_KEY=sk-ant-api03-...
OPENAI_API_KEY=sk-proj-...
GEMINI_API_KEY=AIzaSy...
DEEPSEEK_API_KEY=sk-...

# ===========================================
# VOID DESKTOP (embedded in build)
# ===========================================

# Public Supabase keys (safe to embed)
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
VITE_VOID_CLOUD_API=https://api.voidcloud.dev
```

---

## Appendix C: void-cloud Repository Template

### Complete File Structure

```
void-cloud/
│
├── api/                              # Service 1: Node.js API
│   ├── src/
│   │   ├── index.ts                 # Entry point
│   │   ├── config.ts                # Environment config
│   │   │
│   │   ├── routes/
│   │   │   ├── index.ts             # Route registration
│   │   │   ├── auth.ts              # GET /auth/me
│   │   │   ├── credits.ts           # GET/POST /credits/*
│   │   │   ├── llm.ts               # POST /llm/chat
│   │   │   └── webhooks.ts          # POST /webhooks/stripe
│   │   │
│   │   ├── services/
│   │   │   ├── supabase.ts          # Supabase client
│   │   │   ├── credit.service.ts    # Credit operations
│   │   │   ├── llm-proxy.service.ts # LiteLLM communication
│   │   │   └── stripe.service.ts    # Stripe operations
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.ts              # JWT validation
│   │   │   └── rate-limit.ts        # Rate limiting
│   │   │
│   │   └── types/
│   │       └── index.ts             # Shared types
│   │
│   ├── package.json
│   ├── tsconfig.json
│   ├── Dockerfile
│   └── .dockerignore
│
├── litellm/                          # Service 2: LiteLLM Proxy
│   ├── config.yaml                  # Model definitions
│   ├── Dockerfile
│   └── README.md
│
├── supabase/                         # Database
│   └── migrations/
│       ├── 001_profiles.sql
│       ├── 002_credit_balances.sql
│       ├── 003_credit_transactions.sql
│       ├── 004_usage_records.sql
│       └── 005_functions.sql
│
├── .github/
│   └── workflows/
│       └── deploy.yml               # CI/CD (optional)
│
├── docker-compose.yml               # Local development
├── docker-compose.prod.yml          # Production compose (optional)
├── .env.example                     # Environment template
├── .gitignore
├── railway.json                     # Railway config
└── README.md
```

### Starter Files

**api/src/index.ts**

```typescript
import Fastify from "fastify";
import cors from "@fastify/cors";
import { authRoutes } from "./routes/auth";
import { creditRoutes } from "./routes/credits";
import { llmRoutes } from "./routes/llm";
import { webhookRoutes } from "./routes/webhooks";

const app = Fastify({ logger: true });

// Plugins
await app.register(cors, {
	origin: true, // Configure for production
});

// Routes
await app.register(authRoutes, { prefix: "/auth" });
await app.register(creditRoutes, { prefix: "/credits" });
await app.register(llmRoutes, { prefix: "/llm" });
await app.register(webhookRoutes, { prefix: "/webhooks" });

// Health check
app.get("/health", async () => ({ status: "ok" }));

// Start
const port = parseInt(process.env.PORT || "3000");
await app.listen({ port, host: "0.0.0.0" });
console.log(`Server running on port ${port}`);
```

**api/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**litellm/Dockerfile**

```dockerfile
FROM ghcr.io/berriai/litellm:main-latest
COPY config.yaml /app/config.yaml
EXPOSE 4000
CMD ["--config", "/app/config.yaml", "--port", "4000"]
```

**.env.example**

```bash
# API Service
NODE_ENV=development
PORT=3000

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# Stripe
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_STARTER_PRICE_ID=price_xxx
STRIPE_PRO_PRICE_ID=price_xxx

# LiteLLM
LITELLM_URL=http://localhost:4000

# Provider API Keys (for LiteLLM)
ANTHROPIC_API_KEY=sk-ant-xxx
OPENAI_API_KEY=sk-xxx
GEMINI_API_KEY=AIxxx
```

**docker-compose.yml**

```yaml
version: "3.8"

services:
  api:
    build: ./api
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - LITELLM_URL=http://litellm:4000
    env_file:
      - .env
    depends_on:
      - litellm
    volumes:
      - ./api/src:/app/src # Hot reload for dev

  litellm:
    build: ./litellm
    ports:
      - "4000:4000"
    env_file:
      - .env
```

**.gitignore**

```
node_modules/
dist/
.env
.env.local
*.log
.DS_Store
```

---

## Appendix D: Quick Start Checklist

### Day 1: Accounts Setup

```
□ Create GitHub repo: void-cloud (private)
□ Create Supabase project: void-cloud-prod
□ Create Stripe account (or use existing)
□ Create Railway account
□ Get API keys from 1-2 LLM providers (start with Anthropic + OpenAI)
```

### Day 2: Database Setup

```
□ In Supabase: Enable Google OAuth provider
□ In Supabase: Run SQL migrations from Section 5
□ In Supabase: Verify RLS policies are active
□ Test: Can create user via Supabase Auth UI
```

### Day 3: Stripe Setup

```
□ Create Product: "Void Cloud Starter" ($10, one-time)
□ Create Product: "Void Cloud Pro" ($25, one-time)
□ Note the Price IDs for both products
□ Set up webhook endpoint (will configure URL after deploy)
```

### Day 4: Local Development

```
□ Clone void-cloud repo locally
□ Copy .env.example to .env, fill in values
□ Run: docker-compose up
□ Test: curl http://localhost:3000/health
□ Test: curl http://localhost:4000/health (LiteLLM)
```

### Day 5: Deploy to Railway

```
□ Create Railway project from GitHub repo
□ Add service: api (from /api folder)
□ Add service: litellm (from /litellm folder)
□ Configure environment variables for both
□ Set up internal networking (litellm not public)
□ Get public URL for api service
□ Update Stripe webhook URL
```

### Day 6: Integration Testing

```
□ Test Google OAuth via Supabase
□ Test credit balance endpoint
□ Test Stripe checkout flow
□ Test LLM chat endpoint
□ Verify credits deducted correctly
```

### Day 7: Void Desktop Integration

```
□ Add voidCloudTypes.ts to SafeAppeals2.0
□ Update voidSettingsTypes.ts
□ Implement basic voidCloudService.ts
□ Test sign-in from Void desktop
```

---

## Appendix E: Useful Commands

```bash
# Local development
cd void-cloud
docker-compose up              # Start all services
docker-compose up -d           # Start in background
docker-compose logs -f api     # Follow API logs
docker-compose down            # Stop all services

# Database
# (Run in Supabase SQL Editor or via CLI)
supabase db reset              # Reset local DB
supabase db push               # Push migrations

# Railway
railway login                  # Login to Railway CLI
railway link                   # Link to project
railway logs                   # View logs
railway variables              # Manage env vars

# Testing
curl http://localhost:3000/health
curl http://localhost:4000/health
curl -X POST http://localhost:4000/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Hi"}]}'
```

---

**Document Status:** Ready for Implementation
**Document Status:** Production-Ready Specification
**Next Step:** Create void-cloud GitHub repo, then begin Phase 1
**Questions?** Add to this document or create GitHub issues

---

### Version History

| Version | Date             | Changes                                                                  |
| ------- | ---------------- | ------------------------------------------------------------------------ |
| 1.0     | Nov 30, 2025     | Initial specification                                                    |
| 1.1     | Nov 30, 2025     | Added repository architecture decision                                   |
| 1.2     | Nov 30, 2025     | Added auto-update system (Section 12)                                    |
| 1.3     | Nov 30, 2025     | Added Legal, Security, Monitoring, Production Readiness (Sections 13-16) |
| 1.4     | Nov 30, 2025     | Created `void-cloud/` folder with all API code, migrations, configs      |
| 1.5     | Nov 30, 2025     | Phase 4: Added voidCloudTypes.ts, updated settings, VoidCloudService     |
| 1.6     | Nov 30, 2025     | 🚀 DEPLOYED: Railway API live, Stripe webhook configured, GitHub repo created |
| 1.7     | Dec 2, 2025      | Phase 4-5 Complete: Desktop auth and cloud routing fully implemented     |
| **1.8** | **Dec 5, 2025**  | **Next.js Dashboard deployed, Phase 7 Auto-Update complete, full sync**  |

---

_This document is now a complete production playbook for Void Cloud._

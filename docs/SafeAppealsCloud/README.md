# SafeAppeals Cloud

SafeAppeals Cloud is the backend infrastructure that powers AI features, web search, and billing for the SafeAppeals application.

## Overview

SafeAppeals Cloud consists of several interconnected services:

| Service                  | Purpose                             | Technology      |
| ------------------------ | ----------------------------------- | --------------- |
| **LiteLLM Proxy**        | AI model routing and load balancing | Python/LiteLLM  |
| **API Gateway**          | Authentication, credits, web search | Node.js/Fastify |
| **Brave Search Service** | Web search API wrapper              | Node.js/Express |
| **Supabase**             | Database, auth, real-time           | PostgreSQL      |
| **Stripe**               | Payment processing                  | Stripe API      |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     SafeAppeals Desktop App                      │
│                    (Electron + VSCode Fork)                      │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SafeAppeals Cloud API                       │
│                        (Fastify/Node.js)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │   /auth     │  │  /credits   │  │     /web-search         │  │
│  │   /llm      │  │  /webhooks  │  │     /web-search/multi   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
         │                  │                      │
         ▼                  ▼                      ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐
│  LiteLLM    │    │  Supabase   │    │   Brave Search Service  │
│   Proxy     │    │  Database   │    │                         │
└─────────────┘    └─────────────┘    └─────────────────────────┘
         │                                         │
         ▼                                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                        AI Providers                              │
│   OpenAI  │  Anthropic  │  Google  │  xAI  │  Local Models      │
└─────────────────────────────────────────────────────────────────┘
```

## Documentation Index

### Pricing & Billing

| Document                              | Description                          |
| ------------------------------------- | ------------------------------------ |
| [Model Pricing](./model-pricing.md)   | Complete AI model pricing reference  |
| [Credit System](./credit-system.md)   | How tokens/credits work              |
| [Web Search Pricing](./web-search.md) | Brave Search costs and configuration |

### Configuration

| Document                                  | Description                   |
| ----------------------------------------- | ----------------------------- |
| [Configuration Guide](./configuration.md) | How to configure all settings |
| [LiteLLM Config](./litellm-config.md)     | LiteLLM proxy configuration   |

### Operations

| Document                                | Description                     |
| --------------------------------------- | ------------------------------- |
| [Deployment Guide](./deployment.md)     | Railway deployment instructions |
| [Database Schema](./database-schema.md) | Supabase tables and migrations  |
| [Security](./security.md)               | Security best practices         |

## Quick Links

- **Repository**: `void-cloud/` directory in SafeAppeals2.0
- **Supabase Dashboard**: [supabase.com/dashboard](https://supabase.com/dashboard)
- **Railway Dashboard**: [railway.app](https://railway.app)
- **Stripe Dashboard**: [dashboard.stripe.com](https://dashboard.stripe.com)

## Key Files

```
void-cloud/
├── api/                      # Main API Gateway
│   ├── src/
│   │   ├── routes/
│   │   │   ├── credits.ts    # Credit balance & checkout
│   │   │   ├── web-search.ts # Web search with credit deduction
│   │   │   ├── llm.ts        # LLM proxy routes
│   │   │   └── webhooks.ts   # Stripe webhooks
│   │   └── services/
│   │       ├── supabase.ts   # Database client
│   │       └── stripe.ts     # Payment client
│   └── package.json
├── brave-search-service/     # Brave Search wrapper
│   └── server.js
├── litellm/                  # LiteLLM configuration
│   └── config.yaml           # Model definitions & pricing
├── supabase/                 # Database migrations
│   └── migrations/
└── dashboard/                # Admin dashboard (future)
```

## Environment Variables

### Required for API Gateway

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_xxx    # $30 pack
STRIPE_PRICE_PRO=price_xxx        # $65 pack
STRIPE_PRICE_POWER=price_xxx     # $130 pack

# Services
BRAVE_SEARCH_URL=https://brave-search-service.up.railway.app
LITELLM_URL=https://litellm-proxy.up.railway.app

# App
FRONTEND_URL=https://safeappeals.com
```

### Required for LiteLLM

```bash
LITELLM_MASTER_KEY=sk-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
```

### Required for Brave Search

```bash
BRAVE_SEARCH_API_KEY=BSA...
```

## Getting Started

1. **Read the pricing docs**: [Model Pricing](./model-pricing.md)
2. **Understand credits**: [Credit System](./credit-system.md)
3. **Configure your instance**: [Configuration Guide](./configuration.md)
4. **Deploy**: [Deployment Guide](./deployment.md)

---

**Last Updated**: December 2024
**Maintained by**: SafeAppeals Development Team

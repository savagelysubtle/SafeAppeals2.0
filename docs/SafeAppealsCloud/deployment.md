# Deployment Guide

This document covers deploying SafeAppeals Cloud to Railway.

## Overview

SafeAppeals Cloud consists of three services deployed to Railway:

| Service | Purpose | Port |
|---------|---------|------|
| **API Gateway** | Auth, credits, web search routing | 3000 |
| **LiteLLM Proxy** | AI model routing | 4000 |
| **Brave Search Service** | Brave API wrapper | 3001 |

## Prerequisites

- Railway account: https://railway.app
- Supabase project: https://supabase.com
- Stripe account: https://stripe.com
- API keys for AI providers (OpenAI, Anthropic, Google)
- Brave Search API key: https://api-dashboard.search.brave.com

## Initial Setup

### 1. Create Railway Project

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init
```

### 2. Create Services

Create three services in Railway dashboard or via CLI:

```bash
railway service create api-gateway
railway service create litellm-proxy
railway service create brave-search-service
```

### 3. Configure Environment Variables

For each service, set the required environment variables in Railway dashboard.

## Service Deployment

### API Gateway

**Directory:** `void-cloud/api/`

**Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

**railway.toml:**
```toml
[build]
builder = "dockerfile"
dockerfilePath = "./Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "always"
```

**Environment Variables:**
```bash
# Supabase
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_SERVICE_KEY=eyJ...

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_STARTER=price_...
STRIPE_PRICE_PRO=price_...

# Services
BRAVE_SEARCH_URL=https://${{brave-search-service.RAILWAY_PUBLIC_DOMAIN}}
LITELLM_URL=https://${{litellm-proxy.RAILWAY_PUBLIC_DOMAIN}}

# App
FRONTEND_URL=https://safeappeals.com
NODE_ENV=production
PORT=3000
```

### LiteLLM Proxy

**Directory:** `void-cloud/litellm/`

**Dockerfile:**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
RUN pip install litellm[proxy]
COPY config.yaml .
EXPOSE 4000
CMD ["litellm", "--config", "config.yaml", "--host", "0.0.0.0", "--port", "4000"]
```

**railway.toml:**
```toml
[build]
builder = "dockerfile"
dockerfilePath = "./Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "always"
```

**Environment Variables:**
```bash
LITELLM_MASTER_KEY=sk-litellm-...
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=AIza...
PORT=4000
```

### Brave Search Service

**Directory:** `void-cloud/brave-search-service/`

**Dockerfile:**
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3001
CMD ["node", "server.js"]
```

**railway.toml:**
```toml
[build]
builder = "dockerfile"
dockerfilePath = "./Dockerfile"

[deploy]
healthcheckPath = "/health"
healthcheckTimeout = 300
restartPolicyType = "always"
```

**Environment Variables:**
```bash
BRAVE_SEARCH_API_KEY=BSA...
PORT=3001
NODE_ENV=production
```

## Deploying Updates

### Automatic Deployment

Railway auto-deploys on git push:

```bash
git add -A
git commit -m "Update description"
git push
```

### Manual Deployment

```bash
railway up
```

### Deploy Specific Service

```bash
cd void-cloud/api
railway up --service api-gateway
```

## Stripe Webhook Setup

### 1. Create Webhook Endpoint

In Stripe Dashboard:
1. Go to Developers → Webhooks
2. Click "Add endpoint"
3. URL: `https://your-api.up.railway.app/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`

### 2. Get Webhook Secret

Copy the signing secret (starts with `whsec_`)

### 3. Configure Environment Variable

```bash
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Monitoring

### Railway Dashboard

View logs and metrics in Railway dashboard:
- https://railway.app/project/your-project

### Health Checks

Each service exposes `/health`:

```bash
curl https://api-gateway.up.railway.app/health
curl https://litellm-proxy.up.railway.app/health
curl https://brave-search-service.up.railway.app/health
```

### Logs

```bash
# View logs
railway logs

# Follow logs
railway logs --follow

# Filter by service
railway logs --service api-gateway
```

## Scaling

### Horizontal Scaling

In Railway dashboard, adjust replica count per service.

### Resource Allocation

Adjust memory and CPU in service settings.

### Recommended Resources

| Service | Memory | CPU |
|---------|--------|-----|
| API Gateway | 512MB | 0.5 |
| LiteLLM Proxy | 1GB | 1.0 |
| Brave Search | 256MB | 0.25 |

## Rollback

### Via Dashboard

1. Go to service in Railway
2. Click "Deployments"
3. Find previous deployment
4. Click "Rollback"

### Via CLI

```bash
railway rollback
```

## Troubleshooting

### Service Won't Start

1. Check logs: `railway logs`
2. Verify environment variables are set
3. Check Dockerfile syntax
4. Verify health check endpoint exists

### Connection Refused Between Services

1. Verify service URLs use Railway domains
2. Check Railway's internal networking
3. Ensure ports are exposed in Dockerfile

### Stripe Webhooks Failing

1. Check webhook logs in Stripe dashboard
2. Verify `STRIPE_WEBHOOK_SECRET` is correct
3. Check API logs for webhook processing errors

### Database Connection Issues

1. Verify `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`
2. Check Supabase project is running
3. Verify IP allowlisting (if configured)

## Production Checklist

- [ ] All environment variables set
- [ ] Health checks configured
- [ ] Stripe webhook endpoint created
- [ ] Custom domain configured (optional)
- [ ] Monitoring/alerts set up
- [ ] Backup strategy documented
- [ ] Security audit completed

---

**See Also:**
- [Configuration Guide](./configuration.md)
- [Security](./security.md)
- [Railway Docs](https://docs.railway.app)


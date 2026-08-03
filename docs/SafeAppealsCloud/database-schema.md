# Database Schema

This document covers the Supabase database schema for SafeAppeals Cloud.

## Overview

SafeAppeals Cloud uses Supabase (PostgreSQL) for:
- User profiles and authentication
- Credit/token balances
- Usage logging and analytics
- Model pricing data
- Encrypted OAuth provider refresh tokens (mailbox / calendar)

## Tables

### profiles

Stores user profile information and credit balance.

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    display_name TEXT,
    avatar_url TEXT,
    credits_balance BIGINT NOT NULL DEFAULT 0,
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_stripe ON profiles(stripe_customer_id);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON profiles
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = id);

CREATE POLICY "Users can update own profile" ON profiles
    FOR UPDATE TO authenticated
    USING ((SELECT auth.uid()) = id);
```

### credit_transactions

Tracks all credit purchases and usage.

```sql
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,           -- 'purchase', 'usage', 'refund', 'bonus'
    amount BIGINT NOT NULL,       -- Positive = add, Negative = deduct
    balance_after BIGINT,

    -- Purchase details
    stripe_session_id TEXT,
    stripe_payment_intent TEXT,
    pack_type TEXT,               -- 'starter', 'pro', 'power'
    amount_paid INTEGER,          -- Cents
    currency TEXT DEFAULT 'usd',

    -- Usage details
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,

    -- Admin
    reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_credit_tx_user ON credit_transactions(user_id);
CREATE INDEX idx_credit_tx_type ON credit_transactions(type);
CREATE INDEX idx_credit_tx_created ON credit_transactions(created_at);

-- RLS
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions" ON credit_transactions
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
```

### usage_logs

Records each AI/search request with costs.

```sql
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id),
    model TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_tokens INTEGER NOT NULL,

    -- Cost tracking
    input_cost_usd NUMERIC(12,8),
    output_cost_usd NUMERIC(12,8),
    total_cost_usd NUMERIC(12,8),
    credits_charged BIGINT,
    profit_usd NUMERIC(12,8),

    -- Metadata
    latency_ms INTEGER,
    request_id TEXT,
    error_code TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_usage_user ON usage_logs(user_id);
CREATE INDEX idx_usage_model ON usage_logs(model);
CREATE INDEX idx_usage_created ON usage_logs(created_at);
CREATE INDEX idx_usage_cost ON usage_logs(total_cost_usd);

-- RLS
ALTER TABLE usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage" ON usage_logs
    FOR SELECT TO authenticated
    USING ((SELECT auth.uid()) = user_id);
```

### model_pricing

Stores pricing for each AI model.

```sql
CREATE TABLE model_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL UNIQUE,
    provider TEXT NOT NULL,
    input_cost_per_million NUMERIC(10,4) NOT NULL,
    output_cost_per_million NUMERIC(10,4) NOT NULL,
    effective_from TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_pricing_provider ON model_pricing(provider);
CREATE INDEX idx_pricing_active ON model_pricing(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE model_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read pricing" ON model_pricing
    FOR SELECT TO authenticated
    USING (true);
```

### service_connections

N mail/calendar OAuth grants per Cloud user. Replaces the retired single-row `provider_tokens` table. Clients mint short-lived provider access tokens with `POST /connections/:id/token`. The encryption key (`PROVIDER_TOKEN_ENCRYPTION_KEY`) lives outside the database.

See `void-cloud/supabase/migrations/010_service_connections.sql` for the full DDL (`service_connections` + `connection_requests`). Migration `011_drop_provider_tokens.sql` drops the legacy table after the 010 backfill is verified.

## Functions

### calculate_request_cost

Calculates cost based on model pricing.

```sql
CREATE OR REPLACE FUNCTION calculate_request_cost(
    p_model TEXT,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER
)
RETURNS TABLE (
    input_cost NUMERIC,
    output_cost NUMERIC,
    total_cost NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_input_rate NUMERIC;
    v_output_rate NUMERIC;
BEGIN
    SELECT
        input_cost_per_million / 1000000,
        output_cost_per_million / 1000000
    INTO v_input_rate, v_output_rate
    FROM model_pricing
    WHERE model_name = p_model AND is_active = true
    LIMIT 1;

    IF v_input_rate IS NULL THEN
        v_input_rate := 0;
        v_output_rate := 0;
    END IF;

    RETURN QUERY SELECT
        (p_input_tokens * v_input_rate)::NUMERIC,
        (p_output_tokens * v_output_rate)::NUMERIC,
        (p_input_tokens * v_input_rate + p_output_tokens * v_output_rate)::NUMERIC;
END;
$$;
```

### log_usage_with_cost

Logs usage and calculates costs/profit.

```sql
CREATE OR REPLACE FUNCTION log_usage_with_cost(
    p_user_id UUID,
    p_model TEXT,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_latency_ms INTEGER DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_credits_charged BIGINT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_cost RECORD;
    v_log_id UUID;
    v_credits BIGINT;
    v_profit NUMERIC;
BEGIN
    SELECT * INTO v_cost FROM calculate_request_cost(p_model, p_input_tokens, p_output_tokens);
    v_credits := COALESCE(p_credits_charged, p_input_tokens + p_output_tokens);

    -- Profit = Revenue - Cost; reads pack_rate from profiles (Starter $42.86/MTok, Pro $32.50/MTok, Power $26/MTok)
    v_profit := (v_credits * 0.00004286) - v_cost.total_cost;

    INSERT INTO usage_logs (
        user_id, model, input_tokens, output_tokens, total_tokens,
        latency_ms, request_id,
        input_cost_usd, output_cost_usd, total_cost_usd,
        credits_charged, profit_usd
    ) VALUES (
        p_user_id, p_model, p_input_tokens, p_output_tokens, p_input_tokens + p_output_tokens,
        p_latency_ms, p_request_id,
        v_cost.input_cost, v_cost.output_cost, v_cost.total_cost,
        v_credits, v_profit
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$;
```

### Credit Management Functions

```sql
-- Add credits
CREATE OR REPLACE FUNCTION add_credits(p_user_id UUID, p_amount BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_new_balance BIGINT;
BEGIN
    UPDATE public.profiles
    SET credits_balance = credits_balance + p_amount
    WHERE id = p_user_id
    RETURNING credits_balance INTO v_new_balance;

    RETURN v_new_balance;
END;
$$;

-- Deduct credits
CREATE OR REPLACE FUNCTION deduct_credits(p_user_id UUID, p_amount BIGINT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_new_balance BIGINT;
BEGIN
    UPDATE public.profiles
    SET credits_balance = credits_balance - p_amount
    WHERE id = p_user_id AND credits_balance >= p_amount
    RETURNING credits_balance INTO v_new_balance;

    IF v_new_balance IS NULL THEN
        RAISE EXCEPTION 'Insufficient credits';
    END IF;

    RETURN v_new_balance;
END;
$$;

-- Check credits
CREATE OR REPLACE FUNCTION check_credits(p_user_id UUID, p_amount BIGINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    v_balance BIGINT;
BEGIN
    SELECT credits_balance INTO v_balance
    FROM public.profiles
    WHERE id = p_user_id;

    RETURN COALESCE(v_balance, 0) >= p_amount;
END;
$$;
```

## Views

### daily_cost_summary

Daily aggregate of costs and usage.

```sql
CREATE VIEW daily_cost_summary AS
SELECT
    date_trunc('day', created_at) AS day,
    COUNT(*) AS request_count,
    SUM(input_tokens) AS total_input_tokens,
    SUM(output_tokens) AS total_output_tokens,
    SUM(total_tokens) AS total_tokens,
    SUM(total_cost_usd)::NUMERIC(12,4) AS total_cost_usd,
    SUM(credits_charged) AS total_credits_charged,
    SUM(profit_usd)::NUMERIC(12,4) AS total_profit_usd,
    AVG(latency_ms)::INTEGER AS avg_latency_ms
FROM usage_logs
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY date_trunc('day', created_at)
ORDER BY day DESC;
```

### cost_by_model

Cost breakdown by model.

```sql
CREATE VIEW cost_by_model AS
SELECT
    model,
    COUNT(*) AS request_count,
    SUM(input_tokens) AS total_input_tokens,
    SUM(output_tokens) AS total_output_tokens,
    SUM(total_cost_usd)::NUMERIC(12,4) AS total_cost_usd,
    SUM(profit_usd)::NUMERIC(12,4) AS total_profit_usd,
    AVG(total_cost_usd)::NUMERIC(12,6) AS avg_cost_per_request,
    (SUM(profit_usd) / NULLIF(SUM(total_cost_usd), 0) * 100)::NUMERIC(5,2) AS profit_margin_pct
FROM usage_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY model
ORDER BY total_cost_usd DESC;
```

### user_cost_summary

Per-user cost summary.

```sql
CREATE VIEW user_cost_summary AS
SELECT
    user_id,
    COUNT(*) AS request_count,
    SUM(total_tokens) AS total_tokens_used,
    SUM(total_cost_usd)::NUMERIC(12,4) AS total_cost_usd,
    SUM(credits_charged) AS total_credits_used,
    SUM(profit_usd)::NUMERIC(12,4) AS total_profit_usd
FROM usage_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id
ORDER BY total_cost_usd DESC;
```

## Migrations

Migrations are stored in `void-cloud/supabase/migrations/`:

| File | Description |
|------|-------------|
| `001_profiles.sql` | Create profiles table |
| `002_credits.sql` | Credit transaction tracking |
| `003_usage_logs.sql` | Usage logging |
| `004_cost_tracking.sql` | Cost columns and functions |
| `005_update_model_pricing.sql` | Initial model pricing |
| `006_sync_model_pricing_dec2024.sql` | Sync with LiteLLM config |
| `009_provider_tokens.sql` | Legacy single-row encrypted provider refresh (`provider_tokens`; superseded) |
| `010_service_connections.sql` | N service connections + connection_requests; backfill from 009 |
| `011_drop_provider_tokens.sql` | Drop `provider_tokens` after 010 backfill is verified |

### Running Migrations

**Via Supabase CLI:**
```bash
supabase db push
```

**Via MCP:**
```
Use mcp_supabase_apply_migration tool
```

**Direct SQL:**
```bash
psql $DATABASE_URL -f migrations/006_sync_model_pricing_dec2024.sql
```

## Security Notes

### RLS Policies

All tables have Row Level Security enabled:
- Users can only read/update their own data
- `service_role` bypasses RLS for admin operations
- Functions use `SECURITY DEFINER` with `SET search_path`

### Function Security

All `SECURITY DEFINER` functions:
- Set explicit `search_path` to prevent injection
- Are only granted to appropriate roles
- Validate inputs before operations

### Sensitive Functions

These functions are restricted from `anon` role:
- `add_credits`
- `deduct_credits`
- `check_credits`
- `log_usage_with_cost`

---

**See Also:**
- [Credit System](./credit-system.md)
- [Security](./security.md)
- [Configuration Guide](./configuration.md)


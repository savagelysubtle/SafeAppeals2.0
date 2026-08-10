# Credit System

This document explains how the token/credit system works in SafeAppeals Cloud.

## Overview

SafeAppeals uses a **token-based credit system**:

| Concept | Description |
|---------|-------------|
| **Token** | Unit of measurement (same as AI tokens) |
| **Credit** | Same as token (1 credit = 1 token) |
| **Balance** | User's remaining tokens in `profiles.credits_balance` |

## Token Packs

Users purchase tokens through Stripe. Self-serve packs use one-time Checkout (`mode: "payment"`), never subscriptions; credits never expire. Every model is available on every pack — pack tier does not gate model access, it only affects the effective $/token rate used for margin tracking.

| Pack | Tokens | Price | $/Token | Stripe Price ID | Self-serve |
|------|--------|-------|---------|-----------------|------------|
| **Starter** | 500,000 | $20 | $0.0000400 | `STRIPE_PRICE_STARTER` | Yes |
| **Essential** | 1,100,000 | $40 | $0.0000364 | `STRIPE_PRICE_ESSENTIAL` | Yes |
| **Pro** | 2,300,000 | $75 | $0.0000326 | `STRIPE_PRICE_PRO` | Yes |
| **Power** | 5,200,000 | $150 | $0.0000288 | `STRIPE_PRICE_POWER` | Yes |
| **Firm** | 13,000,000 | $350 | $0.0000269 | `STRIPE_PRICE_FIRM` | Yes |
| **Practice** | 30,000,000 | $750 | $0.0000250 | `STRIPE_PRICE_PRACTICE` | Yes |
| **Enterprise 1K** | 42,000,000 | $1,000 | $0.0000238 | `STRIPE_PRICE_ENTERPRISE_1K` | Yes |
| **Enterprise 5K** | 225,000,000 | $5,000 | $0.0000222 | *(contact-only — no env var, not wired into checkout)* | No |
| **Enterprise 10K** | 480,000,000 | $10,000 | $0.0000208 | *(contact-only — no env var, not wired into checkout)* | No |

Canonical definitions live in `void-cloud/api/src/lib/creditPacks.ts` (`CREDIT_PACKS` for the 7 self-serve keys, `ENTERPRISE_INVOICE_PACKS` for the 2 contact-only tiers) and are mirrored on the frontend in `void-cloud/dashboard/lib/pricingTiers.ts`. Public pricing page: `void-cloud/dashboard/app/pricing/page.tsx` (`/pricing`).

### Value Calculation

Rate varies by tier, from $40.00/MTok (Starter) down to $23.80/MTok (Enterprise 1K). Example (Starter):
```
1 token = $20 / 500,000 = $0.00004
1 penny ($0.01) = 250 tokens
$1.00 = 25,000 tokens
```

## How Credits Are Charged

### AI Usage

For AI requests, credits are charged based on **total tokens used**:

```
Credits Charged = Input Tokens + Output Tokens
```

Example:
- User sends 5,000 tokens of context
- AI responds with 1,000 tokens
- **Total charged**: 6,000 credits (tokens)

### Web Search

Web search has a **flat fee per search**:

```
Credits per Search = 250 tokens (~$0.01 / 1 penny)
```

This covers:
- Your cost: $0.009 (Brave Pro @ $9/1000 requests)
- User pays: ~$0.0107 (250 × $0.0000428)
- Margin: ~19%

## Database Schema

### Profiles Table

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    credits_balance BIGINT NOT NULL DEFAULT 0,  -- Token balance
    stripe_customer_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Credit Transactions Table

```sql
CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES profiles(id),
    type TEXT NOT NULL,           -- 'purchase', 'usage', 'refund', 'bonus'
    amount BIGINT NOT NULL,       -- Positive for credits added, negative for used
    balance_after BIGINT,

    -- Purchase details
    purchase_source TEXT NOT NULL DEFAULT 'checkout',  -- 'checkout' | 'auto_reload'
    stripe_session_id TEXT,
    stripe_payment_intent TEXT,
    pack_type TEXT,               -- 'starter', 'pro', 'power'
    amount_paid INTEGER,          -- In cents
    currency TEXT,

    -- Usage details
    model TEXT,
    input_tokens INTEGER,
    output_tokens INTEGER,

    -- Admin
    reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Usage Logs Table

```sql
CREATE TABLE usage_logs (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
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
```

## Credit Operations

### Check Balance

**API Endpoint:**
```
GET /credits/balance
Authorization: Bearer <supabase_token>
```

**Response:**
```json
{
  "balance": 450000,
  "unit": "tokens"
}
```

**SQL:**
```sql
SELECT credits_balance FROM profiles WHERE id = 'user-id';
```

### Deduct Credits

**Atomic Function (Preferred):**
```sql
SELECT deduct_credits('user-id', 1000);
-- Returns new balance or raises exception if insufficient
```

**Direct Update:**
```sql
UPDATE profiles
SET credits_balance = credits_balance - 1000
WHERE id = 'user-id'
AND credits_balance >= 1000
RETURNING credits_balance;
```

### Add Credits

**Function:**
```sql
SELECT add_credits('user-id', 700000);
-- Returns new balance
```

**Direct Update:**
```sql
UPDATE profiles
SET credits_balance = credits_balance + 700000
WHERE id = 'user-id'
RETURNING credits_balance;
```

### Check Sufficient Credits

**Function:**
```sql
SELECT check_credits('user-id', 1000);
-- Returns TRUE if user has >= 1000 credits
```

## Auto-Reload (Prepaid Top-Up)

Individual accounts can enable **auto-reload** on the dashboard **Billing** page. This is a prepaid auto top-up (OpenAI/Anthropic-style)—**not a subscription**. Each reload is a one-time credit-pack charge when your balance drops after usage settles.

| Setting | Description |
|---------|-------------|
| **Balance threshold** | Reload when balance falls at or below this level (minimum 10,000 tokens; default 100,000) |
| **Reload pack** | Any of the 7 self-serve packs (Starter through Enterprise 1K)—same packs as manual checkout. Enterprise 5K/10K are contact-only and never auto-reload-eligible. |
| **Monthly cap** | Optional limit on auto-reload spend per calendar month (defaults to **$1,000** when first enabled; server maximum **$3,000**) |

**Card on file:** Users add a card via Stripe Checkout `mode: setup` (`POST /credits/auto-reload/setup-card`). The SetupIntent uses off-session usage so saved cards can be charged without the user present.

**When it fires:** After credits are settled (AI or web-search usage), the API checks whether auto-reload is enabled and balance ≤ threshold. If so, it acquires a reload slot and creates an off-session `PaymentIntent` for the selected pack. Fulfillment uses the same `fulfill_credit_purchase` RPC as manual checkout, with `purchase_source: 'auto_reload'`.

**Consent:** Enabling auto-reload or changing the reload pack while enabled requires explicit consent (`consent: true` on `PUT /credits/auto-reload`). Team and Enterprise office plans remain **Contact Sales**—they are not self-serve subscriptions and do not use this individual auto-reload flow.

**Safeguards:** 15-minute cooldown between attempts, max 3 reloads per day, monthly cap enforcement, consecutive failure disable, and in-flight PaymentIntent reconciliation via webhooks.

### API Endpoints

```
GET  /credits/auto-reload              — current settings (sanitized; no Stripe PM id)
PUT  /credits/auto-reload              — update threshold, pack, cap, enabled; consent when required
POST /credits/auto-reload/setup-card   — Stripe Checkout URL to save/update card
```

### Configuration Constants

Defined in `void-cloud/api/src/lib/creditPacks.ts`:

```typescript
AUTO_RELOAD_MIN_THRESHOLD = 10_000
AUTO_RELOAD_DEFAULT_THRESHOLD = 100_000
AUTO_RELOAD_DEFAULT_MONTHLY_CAP_CENTS = 100_000   // $1,000
AUTO_RELOAD_SERVER_MONTHLY_MAX_CENTS = 300_000    // $3,000
AUTO_RELOAD_MAX_RELOADS_PER_DAY = 3
AUTO_RELOAD_COOLDOWN_MS = 15 * 60 * 1000
AUTO_RELOAD_CONSENT_VERSION = "auto_reload_v1"
```

Database migrations: `014_auto_reload.sql`, `015_auto_reload_harden.sql`, `016_auto_reload_cap_period.sql`.

## Purchase Flow

### 1. User Initiates Purchase

```
POST /credits/checkout
Body: { "pack": "starter" }
```

### 2. Create Stripe Session

```typescript
const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "payment",
    line_items: [{ price: selectedPack.priceId, quantity: 1 }],
    metadata: {
        userId: user.id,
        packageKey: pack,       // e.g. "pro"
        credits: "2300000",
    },
    success_url: `${FRONTEND_URL}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${FRONTEND_URL}/credits/cancelled`,
});
```

The server's own `CREDIT_PACKS` config is always the source of truth for the granted credit amount — session metadata is never trusted for the actual grant, only for identifying which user/pack a webhook event belongs to.

### 3. Stripe Webhook Fulfillment

When payment succeeds, the webhook grants credits via the `fulfill_credit_purchase` RPC (idempotent on `stripe_session_id`), not a raw balance update:

```typescript
// POST /webhooks/stripe
if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const pack = CREDIT_PACKS[session.metadata.packageKey]; // server-authoritative amount

    await supabase.rpc('fulfill_credit_purchase', {
        p_user_id: userId,
        p_pack: session.metadata.packageKey,
        p_credits: pack.credits,
        p_pack_tier: session.metadata.packageKey,
        p_pack_rate: pack.amount / pack.credits,
        p_stripe_session_id: session.id,
        p_purchase_source: 'checkout',
    });
}
```

Refunds are handled separately via the `charge.refunded` webhook event and the `fulfill_credit_refund` RPC (migration `025_credit_refunds.sql`), which deducts credits proportionally to the refunded amount, clamped so a balance never goes negative.

## Usage Tracking

### Log Usage with Cost

```sql
SELECT log_usage_with_cost(
    'user-uuid',           -- user_id
    'gpt-5.2',            -- model
    5000,                  -- input_tokens
    1000,                  -- output_tokens
    250,                   -- latency_ms
    'req_abc123',          -- request_id
    6000                   -- credits_charged (optional, defaults to total_tokens)
);
```

### Web Search Usage

```sql
INSERT INTO usage_logs (
    user_id,
    model,
    input_tokens,
    output_tokens,
    total_tokens,
    credits_charged,
    request_id
) VALUES (
    'user-uuid',
    'brave_search_pro',
    1,                    -- 1 "request" as input
    0,
    1,
    250,                  -- Fixed cost per search
    'ws_1703350000_abc'
);
```

## Analytics Views

### User Cost Summary

```sql
SELECT * FROM user_cost_summary;
```

Returns:
- `user_id`
- `request_count`
- `total_tokens_used`
- `total_cost_usd` (your actual cost)
- `total_credits_used`
- `total_profit_usd`

### Daily Cost Summary

```sql
SELECT * FROM daily_cost_summary;
```

### Cost by Model

```sql
SELECT * FROM cost_by_model;
```

## Configuration

### Token Pack Pricing

Edit `void-cloud/api/src/lib/creditPacks.ts` (not `credits.ts` — the route imports the pack config from here):

```typescript
export const CREDIT_PACKS = {
    starter:       { priceId: process.env.STRIPE_PRICE_STARTER!,       credits: 500_000,    amount: 2_000 },   // $20.00
    essential:     { priceId: process.env.STRIPE_PRICE_ESSENTIAL!,     credits: 1_100_000,  amount: 4_000 },   // $40.00
    pro:           { priceId: process.env.STRIPE_PRICE_PRO!,           credits: 2_300_000,  amount: 7_500 },   // $75.00
    power:         { priceId: process.env.STRIPE_PRICE_POWER!,        credits: 5_200_000,  amount: 15_000 },  // $150.00
    firm:          { priceId: process.env.STRIPE_PRICE_FIRM!,          credits: 13_000_000, amount: 35_000 },  // $350.00
    practice:      { priceId: process.env.STRIPE_PRICE_PRACTICE!,      credits: 30_000_000, amount: 75_000 },  // $750.00
    enterprise_1k: { priceId: process.env.STRIPE_PRICE_ENTERPRISE_1K!, credits: 42_000_000, amount: 100_000 }, // $1,000.00
    // amounts are in cents
};

// Contact-only — not read by /credits/checkout, no Stripe price env var required.
export const ENTERPRISE_INVOICE_PACKS = {
    enterprise_5k:  { credits: 225_000_000, amount: 500_000 },   // $5,000.00
    enterprise_10k: { credits: 480_000_000, amount: 1_000_000 }, // $10,000.00
};
```

### Web Search Credit Cost

Edit `void-cloud/api/src/routes/web-search.ts`:

```typescript
// To charge ~1 penny per search at current pack pricing:
// $0.01 / $0.0000428 = 233 tokens (rounded to 250)
const WEB_SEARCH_CREDIT_COST = 250;
```

Also update in app:
`src/vs/workbench/contrib/void/electron-main/tools/cloudWebSearchService.ts`

## Error Handling

### Insufficient Credits

API returns 402 Payment Required:

```json
{
  "error": "Insufficient credits"
}
```

### Credit Check in Code

```typescript
// In web-search.ts
if (userProfile.credits_balance < WEB_SEARCH_CREDIT_COST) {
    return reply.status(402).send({ error: 'Insufficient credits' });
}
```

### Atomic Deduction

To prevent race conditions, use atomic operations:

```typescript
// Deduct BEFORE making the request
const { data: updated, error } = await supabase
    .from('profiles')
    .update({ credits_balance: balance - cost })
    .eq('id', user.id)
    .gte('credits_balance', cost)  // Only update if sufficient
    .select('credits_balance')
    .single();

if (error || !updated) {
    return reply.status(402).send({ error: 'Insufficient credits' });
}

// Make the API request...

// If request fails, refund
if (requestFailed) {
    await supabase
        .from('profiles')
        .update({ credits_balance: updated.credits_balance + cost })
        .eq('id', user.id);
}
```

## Profit Calculation

### Formula

```
Revenue = Credits Charged × Token Pack Rate
Cost = Actual Provider Cost (from model_pricing)
Profit = Revenue - Cost
```

### In Database

The `log_usage_with_cost` function calculates profit. It uses per-user `pack_rate` from the `profiles` table (set at purchase time from the pack's own $/token rate — see the pack table above, from $40.00/MTok on Starter down to $23.80/MTok on Enterprise 1K) instead of a hardcoded rate:

```sql
-- Uses profiles.pack_rate for user's tier
v_profit := (v_credits * pack_rate) - v_cost.total_cost;
```

### Example

Request: 5,000 input + 1,000 output tokens on `gpt-5.2` (Starter tier @ $40.00/MTok)

```
Credits charged: 6,000 tokens
Revenue: 6,000 × $0.00004 = $0.240

Provider cost:
  Input: 5,000 × $0.00000175 = $0.00875
  Output: 1,000 × $0.000014 = $0.014
  Total: $0.02275

Profit: $0.240 - $0.02275 = $0.217 (90% margin)
```

(Pro tier @ $32.60/MTok: Revenue = 6,000 × $0.0000326 = $0.196, margin ~88%. Enterprise 1K tier @ $23.80/MTok: Revenue = 6,000 × $0.0000238 = $0.143, margin ~84%.)

---

**See Also:**
- [Model Pricing](./model-pricing.md)
- [Web Search Pricing](./web-search.md)
- [Configuration Guide](./configuration.md)


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

Users purchase tokens through Stripe:

| Pack | Tokens | Price | $/Token | Stripe Price ID |
|------|--------|-------|---------|-----------------|
| **Starter** | 700,000 | $30 | $0.0000428 | `STRIPE_PRICE_STARTER` |
| **Pro** | 2,000,000 | $65 | $0.0000325 | `STRIPE_PRICE_PRO` |
| **Power** | 5,000,000 | $130 | $0.0000260 | `STRIPE_PRICE_POWER` |

### Value Calculation

Rates vary by tier: Starter $42.86/MTok, Pro $32.50/MTok, Power $26.00/MTok. Example (Starter):
```
1 token = $30 / 700,000 = $0.0000428
1 penny ($0.01) = 233 tokens
$1.00 = 23,333 tokens
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
        void_user_id: user.id,
        credit_pack: pack,
        credits_amount: "700000",
    },
    success_url: `${FRONTEND_URL}/credits/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${FRONTEND_URL}/credits/cancelled`,
});
```

### 3. Stripe Webhook Fulfillment

When payment succeeds, webhook adds credits:

```typescript
// POST /webhooks/stripe
if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.void_user_id;
    const credits = parseInt(session.metadata.credits_amount);

    await supabase.rpc('add_credits', {
        p_user_id: userId,
        p_amount: credits
    });
}
```

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

Edit `void-cloud/api/src/routes/credits.ts`:

```typescript
const CREDIT_PACKS = {
    starter: {
        priceId: process.env.STRIPE_PRICE_STARTER!,
        credits: 700_000,
        amount: 3000, // $30.00 in cents
    },
    pro: {
        priceId: process.env.STRIPE_PRICE_PRO!,
        credits: 2_000_000,
        amount: 6500, // $65.00 in cents
    },
    power: {
        priceId: process.env.STRIPE_PRICE_POWER!,
        credits: 5_000_000,
        amount: 13000, // $130.00 in cents
    },
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

The `log_usage_with_cost` function calculates profit. It now uses per-user `pack_rate` from `profiles` table (Starter $42.86/MTok, Pro $32.50/MTok, Power $26.00/MTok) instead of a hardcoded rate:

```sql
-- Uses profiles.pack_rate for user's tier
v_profit := (v_credits * pack_rate) - v_cost.total_cost;
```

### Example

Request: 5,000 input + 1,000 output tokens on `gpt-5.2` (Starter tier @ $42.86/MTok)

```
Credits charged: 6,000 tokens
Revenue: 6,000 × $0.0000428 = $0.257

Provider cost:
  Input: 5,000 × $0.00000175 = $0.00875
  Output: 1,000 × $0.000014 = $0.014
  Total: $0.02275

Profit: $0.257 - $0.02275 = $0.234 (91% margin)
```

(Pro tier @ $32.50/MTok: Revenue = 6,000 × $0.0000325 = $0.195, margin ~88%. Power tier @ $26/MTok: Revenue = $0.156, margin ~86%.)

---

**See Also:**
- [Model Pricing](./model-pricing.md)
- [Web Search Pricing](./web-search.md)
- [Configuration Guide](./configuration.md)


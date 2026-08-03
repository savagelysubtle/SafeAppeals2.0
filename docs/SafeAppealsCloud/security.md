# Security

This document covers security best practices and implemented security measures for SafeAppeals Cloud.

## Security Measures

### Authentication

**Supabase Auth Integration:**
- All API endpoints (except health checks) require valid Supabase JWT
- Tokens are verified on every request
- Service role key is used only for admin operations

```typescript
// Middleware verifies JWT
app.addHook('preHandler', verifySupabaseToken);
```

**Provider tokens (mailbox / calendar OAuth):**
- Identity login (`GET /auth/google`) is identity-only: it never requests mail/calendar scopes, never asks for offline access, and never stores a provider refresh token. Mailbox and calendar consent is a separate grant via `/connections/*`
- Provider refresh tokens are encrypted at rest (`PROVIDER_TOKEN_ENCRYPTION_KEY`, AES-256-GCM) in `service_connections` and never returned from `/auth/callback`, `/auth/exchange`, or `/auth/refresh`
- Clients mint short-lived provider access tokens with `POST /connections/:id/token` only (Bearer cloud JWT)
- Fail closed if encryption or Google client env vars are missing — plaintext provider refresh is never stored

### Row Level Security (RLS)

All database tables have RLS enabled:

| Table | Policy |
|-------|--------|
| `profiles` | Users can only read/update own profile |
| `credit_transactions` | Users can only read own transactions |
| `usage_logs` | Users can only read own usage |
| `model_pricing` | Authenticated users can read (write restricted) |
| `service_connections` | RLS on, zero client policies; `service_role` only (API) |
| `connection_requests` | RLS on, zero client policies; `service_role` only (API) |

### Function Security

**SECURITY DEFINER functions:**
- Set explicit `search_path` to prevent SQL injection
- Granted only to appropriate roles
- `anon` role cannot execute sensitive functions

```sql
CREATE FUNCTION my_function()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'  -- Prevents injection
AS $$ ... $$;

-- Restrict access
REVOKE EXECUTE ON FUNCTION my_function FROM anon;
REVOKE EXECUTE ON FUNCTION my_function FROM public;
GRANT EXECUTE ON FUNCTION my_function TO authenticated;
GRANT EXECUTE ON FUNCTION my_function TO service_role;
```

### Rate Limiting

**API Rate Limits:**
- Per-user limits on API endpoints
- Configurable limits for different operations

```typescript
const rateLimitResult = await rateLimit(request, reply, "web-search:user");
```

### Input Validation

All inputs are validated and sanitized:

```typescript
// Query validation
const sanitizedQuery = query.slice(0, 400).trim();
const sanitizedCount = Math.max(1, Math.min(20, count || 10));
const sanitizedOffset = Math.max(0, Math.min(9, offset || 0));

// Reject invalid input
if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return reply.status(400).send({ error: 'Query is required' });
}
```

### CORS Configuration

Restricted to allowed origins:

```typescript
app.register(cors, {
    origin: [
        'https://safeappeals.com',
        'https://app.safeappeals.com',
        /\.safeappeals\.com$/,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
});
```

### Security Headers

Helmet middleware adds security headers:

```typescript
app.register(helmet, {
    contentSecurityPolicy: { ... },
    hsts: { maxAge: 31536000, includeSubDomains: true },
});
```

## Security Fixes Applied

### December 2024 Audit

| Issue | Severity | Fix |
|-------|----------|-----|
| SECURITY DEFINER views bypassing RLS | Critical | Recreated views without SECURITY DEFINER |
| Sensitive functions exposed to anon | Critical | Revoked execute from anon/public |
| Mutable search_path in functions | Medium | Added `SET search_path` |
| Missing RLS on model_pricing | Low | Enabled RLS with read-only policy |
| RLS policies re-evaluating auth.uid() | Performance | Wrapped in subquery |

### Views Fixed

```sql
-- Removed SECURITY DEFINER, restricted access
DROP VIEW daily_cost_summary;
DROP VIEW cost_by_model;
DROP VIEW user_cost_summary;

CREATE VIEW user_cost_summary AS ...;  -- No SECURITY DEFINER
GRANT SELECT ON user_cost_summary TO authenticated;

CREATE VIEW daily_cost_summary AS ...;
REVOKE ALL ON daily_cost_summary FROM authenticated;
GRANT SELECT ON daily_cost_summary TO service_role;  -- Admin only
```

### Functions Secured

```sql
-- Revoke from anonymous users
REVOKE EXECUTE ON FUNCTION add_credits FROM anon;
REVOKE EXECUTE ON FUNCTION deduct_credits FROM anon;
REVOKE EXECUTE ON FUNCTION check_credits FROM anon;
REVOKE EXECUTE ON FUNCTION log_usage_with_cost FROM anon;

-- Also from public
REVOKE EXECUTE ON FUNCTION add_credits FROM public;
-- ... etc
```

### Optimized RLS Policies

```sql
-- Before (slow - re-evaluates per row)
USING (auth.uid() = user_id)

-- After (fast - evaluated once)
USING ((SELECT auth.uid()) = user_id)
```

## Environment Variable Security

### Never Commit Secrets

```gitignore
# .gitignore
.env
.env.local
.env.*.local
*.pem
*.key
```

### Use Environment Variables

```typescript
// Good
const apiKey = process.env.STRIPE_SECRET_KEY;

// Bad - never hardcode
const apiKey = 'sk_live_xxx';  // DON'T DO THIS
```

### Railway Variable Management

- Use Railway's encrypted variable storage
- Reference other service variables with `${{service.VAR}}`
- Rotate keys periodically

## API Key Security

### Rotation Schedule

| Key | Rotation Frequency |
|-----|-------------------|
| LITELLM_MASTER_KEY | Quarterly |
| STRIPE_SECRET_KEY | Yearly (or if compromised) |
| AI Provider Keys | Yearly |
| SUPABASE_SERVICE_KEY | On compromise only |

### Key Compromise Response

1. **Immediately:**
   - Rotate the compromised key
   - Update environment variables
   - Redeploy affected services

2. **Investigation:**
   - Review logs for unauthorized access
   - Check usage spikes
   - Notify affected users if necessary

3. **Prevention:**
   - Review how key was exposed
   - Update security practices

## Stripe Security

### Webhook Signature Verification

Always verify webhook signatures:

```typescript
const sig = request.headers['stripe-signature'];
let event: Stripe.Event;

try {
    event = stripe.webhooks.constructEvent(
        request.rawBody,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET!
    );
} catch (err) {
    return reply.status(400).send({ error: 'Invalid signature' });
}
```

### Idempotency

Handle duplicate webhooks:

```typescript
// Check if already processed
const existing = await supabase
    .from('credit_transactions')
    .select('id')
    .eq('stripe_session_id', session.id)
    .single();

if (existing.data) {
    console.log('Already processed, skipping');
    return reply.send({ received: true });
}
```

## Supabase Security

### Service Key Usage

The service key bypasses RLS. Use only for:
- Admin operations
- Webhook handlers
- Background jobs

Never expose to client-side code.

### RLS Best Practices

1. **Always enable RLS** on new tables
2. **Test policies** as different roles
3. **Use subqueries** for auth functions
4. **Restrict service_role** operations

### Audit Logging

Enable Supabase audit logging for sensitive tables:

```sql
ALTER TABLE profiles REPLICA IDENTITY FULL;
-- Configure pgaudit or Supabase logging
```

## Security Checklist

### Pre-Deployment

- [ ] All secrets in environment variables
- [ ] RLS enabled on all tables
- [ ] Sensitive functions restricted
- [ ] CORS configured correctly
- [ ] Rate limiting enabled
- [ ] Input validation implemented

### Regular Audits

- [ ] Run Supabase security advisor monthly
- [ ] Review API logs for anomalies
- [ ] Check for unauthorized access attempts
- [ ] Verify key rotation schedule
- [ ] Test RLS policies

### Incident Response

- [ ] Key rotation procedures documented
- [ ] Incident response contacts listed
- [ ] Backup restoration tested
- [ ] User notification templates ready

## Monitoring for Security

### Suspicious Activity

Monitor for:
- Multiple failed auth attempts
- Unusual API usage patterns
- Credit manipulation attempts
- Excessive rate limit hits

### Supabase Advisors

Run regularly:

```sql
-- Check security advisors
SELECT * FROM mcp_supabase_get_advisors('security');
```

### Log Analysis

```sql
-- Failed requests
SELECT
    user_id,
    error_code,
    COUNT(*)
FROM usage_logs
WHERE error_code IS NOT NULL
GROUP BY user_id, error_code;

-- Unusual usage
SELECT
    user_id,
    COUNT(*) as requests,
    SUM(credits_charged) as credits
FROM usage_logs
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY user_id
ORDER BY requests DESC
LIMIT 10;
```

---

**See Also:**
- [Database Schema](./database-schema.md)
- [Configuration Guide](./configuration.md)
- [Supabase Security Docs](https://supabase.com/docs/guides/platform/security)


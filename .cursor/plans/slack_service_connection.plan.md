---
name: Slack service connection (stepping stone)
overview: |
  Add Slack as a SafeAppeals Cloud **service connection** (same limb as Google /
  Microsoft mail-calendar), not as Cloud identity. Ship OAuth + token mint +
  "Connect Slack" UI on the same surfaces used for Google/Outlook connect and
  post-sign-in onboarding — foundation for a later full `safeappeals-slack`
  extension (notifications, channel mapping, bidirectional). Do not build the
  full Slack product in this plan.

  Date: 2026-08-11. Depends on: service connections (`/connections/*`), Cloud
  identity (Google + Outlook) already shipped. Supersedes the vague "design only"
  todo in safeappeals_2.1_rebrand_and_slack.plan.md for the **connection** slice
  only; full extension remains a later plan.

todos:
  - id: slack-conn-0-product-boundaries
    content: |
      Lock product boundaries before code:
      - Slack is NEVER a Supabase / Cloud identity provider (no /auth/slack, no
        "Continue with Slack" replacing Google/Outlook for SafeAppeals account).
      - Slack IS a service connection: user must already be signed in to
        SafeAppeals Cloud; refresh tokens stay on safeappeals-cloud; desktop only
        mints short-lived tokens.
      - Capabilities for v1 (pick one bundle only — Slack allows multi-scope):
        recommended minimal: `channels:read`, `chat:write`, `users:read`,
        `team:read` (+ `offline` / bot vs user token decision below).
      - v1 success = user can Connect Slack from UI, see connection in list,
        mint a token, Disconnect. No timeline fan-out, no Events API, no extension
        package yet.
      - Document bot token vs user token: prefer **user token** with refresh for
        parity with Google/Microsoft connections; bot install can be phase 1.5.
    status: pending

  - id: slack-conn-1-slack-app-ops
    content: |
      Ops (Steve / Entra-equivalent for Slack):
      1. Create Slack App at https://api.slack.com/apps (workspace SafeAppeals or personal).
      2. OAuth & Permissions → Redirect URLs (exact):
         - `{API_PUBLIC_URL}/connections/callback` (prod: https://api.safeappeals.com/connections/callback)
         - local API if used: e.g. http://localhost:3000/connections/callback
      3. Scopes: start with user token scopes matching chosen capability bundle
         (e.g. channels:read, chat:write, users:read, team:read). Avoid admin.* .
      4. Copy Client ID + Client Secret → Railway API:
         SLACK_CLIENT_ID, SLACK_CLIENT_SECRET
         (mirror MICROSOFT_* pattern in railway-env-example + api/.env.example).
      5. Optional: SLACK_SIGNING_SECRET only when Events API lands (out of scope).
    status: pending

  - id: slack-conn-2-cloud-provider
    content: |
      safeappeals-cloud — extend connections limb for provider `slack`:
      Files (exact):
      - api/src/services/connections.ts — ProviderKind += 'slack'; credentials
        from SLACK_*; token URL https://slack.com/api/oauth.v2.access (or
        oauth.access if user-token classic — verify current Slack OAuth v2).
      - api/src/lib/connectionAuthorizeUrl.ts — buildSlackConnectionAuthorizeUrl
        (https://slack.com/oauth/v2/authorize, client_id, scope, redirect_uri,
        state, code_challenge if PKCE supported — Slack OAuth v2 supports state;
        confirm PKCE; if no PKCE, keep server-held state only like today).
      - api/src/routes/connections.ts — accept provider=slack on start/list.
      - supabase/migrations/0xx_service_connections_slack.sql — widen CHECK
        (provider IN ('google','microsoft','slack')); connection_requests same.
      - api/test/connections.test.ts — authorize URL + start/callback happy path
        with mocked Slack token exchange.
      - railway-env-example.txt + api/.env.example — SLACK_CLIENT_ID/SECRET.
      Gotchas:
      - Callback stays shared: GET /connections/callback (same as Google/MS).
      - Do not request mail/calendar capabilities for slack; add ConnectionCapability
        values e.g. 'messaging' | 'channels' OR a single 'slack' capability for v1
        to avoid Microsoft-style multi-resource pain.
      Recommendation: v1 capability = `messaging` only (one grant, one mint path).
    status: pending

  - id: slack-conn-3-desktop-connection-surface
    content: |
      extensions/safeappeals-authentication — client mirror of cloud:
      - connectionsApi.ts / connectionsApi on cloud client: ProviderKind += 'slack';
        ConnectionCapability += 'messaging' (or chosen name).
      - providerCapabilities.ts — scopesForCapabilities / capabilitiesFromGrantedScope
        for slack (map Slack scope strings ↔ messaging).
      - providerSupportsCapabilityBundle — slack only supports ['messaging'].
      - New SlackAuthProvider (thin ConnectionAuthProvider) id `safeappeals-slack`
        OR skip AuthenticationProvider until extension needs getSession; minimum
        is ConnectionManager.connect({ provider: 'slack', capabilities: ['messaging'] }).
      - package.json: contribute authentication id safeappeals-slack if provider
        class ships; onAuthenticationRequest:safeappeals-slack.
      - extension.ts: register SlackAuthProvider next to Google/Microsoft if used.
      - product.json trustedExtensionAuthAccess: "safeappeals-slack": [future
        safeappeals-slack extension id]; for v1 can trust authentication only.
      - Commands: safeappeals.connections.connectSlack (or extend existing
        connections.connect quick pick with Slack).
      Follow openExternal STRING pattern (no Uri.parse on authorize URL) —
        cloudAuthProvider + connectionManager already fixed.
      Tests: connectionsApi + connectionManager + capability bundle unit tests.
    status: pending

  - id: slack-conn-4-connect-ui-buttons
    content: |
      UI: "Connect Slack" where users already learn to connect — NOT on the
      Cloud identity Google/Outlook pair (identity stays Google|Outlook only).

      A) Chat setup dialog (chatSetupRunner getButtons) — after signed-in path
         only: if forceSignInDialog is false and user is signed in with no Slack
         connection, optional secondary button is OUT OF SCOPE for identity
         dialog. Instead:
         - Keep identity dialog = Google + Outlook only.
         - Add a small post-sign-in or Accounts entry: "Connect Slack workspace..."

      B) Onboarding walkthrough (onboardingVariationA):
         - Do NOT add Slack to the Sign In step (identity).
         - Add optional action on a later step (Profile or Credits/First Steps)
           OR a dedicated lightweight "Connect tools" strip:
           button "Connect Slack" → runs connections.connect slack after
           ensureCloudSession. Skip-able (Continue without Slack).
         - Copy: "Connect Slack to your SafeAppeals account (optional). You can
           do this later from Accounts."

      C) Accounts menu (chatSetupContributions):
         - New action: "Connect Slack workspace..." when Cloud signed in and no
           active slack connection (when-clause on safeappeals.cloud.signedIn).
         - Opens connect flow (ConnectionManager), not createSession identity.

      D) Models picker: no Slack button (models = Cloud identity only).

      E) Dashboard (safeappeals.com): optional later "Connected apps" page —
         not required for v1 desktop stepping stone.

      F) Email Add Account quick pick: no Slack (email is mail capability).

      Exact strings (title case UI labels):
      - "Connect Slack"
      - "Connect Slack Workspace..."
      - "Slack Connected" / "Reconnect Slack"
      - Footer: "Slack is a workspace connection, not your SafeAppeals sign-in."

      Icons: simple Slack mark CSS (data-URI) beside continue-button.slack like
      outlook/google marks in chatSetup.css / variationA.css.
    status: pending

  - id: slack-conn-5-security-and-docs
    content: |
      Security (AGENTS.md local data security):
      - Refresh tokens only in cloud encrypted store (PROVIDER_TOKEN_ENCRYPTION_KEY).
      - Desktop: no Slack tokens on disk; mint via POST /connections/:id/token.
      - Disconnect revokes via Slack auth.revoke if available + delete connection row.
      - Account deletion (accountDeletion.ts) must revoke slack connections too.
      - Minimal scopes; no channels:history broad scrape in v1 scopes list.
      - Machine-scoped settings only if any Slack client id ever appears client-side
        (prefer server-only client secret).

      Docs closeout when v1 works:
      - ROADMAP.md — under Auth/connections note "Slack connection (OAuth) ✅"
        while full Slack integration stays Planned.
      - docs/ADDED_FEATURES_TRACKER.md — row "Slack service connection" Partial/Shipped.
      - Cross-link from safeappeals_2.1_rebrand_and_slack.plan.md todo
        slack-integration-design → this plan for connection slice; keep full
        extension as separate phase.
    status: pending

  - id: slack-conn-6-smoke
    content: |
      Smoke (Run Dev CDP preferred for desktop; web stable-dev if testing web):
      1. Sign in Cloud (Google or Outlook).
      2. Accounts → Connect Slack → browser Slack consent → return → connection listed.
      3. Mint token (debug command or unit against API) succeeds.
      4. Disconnect → mint fails; reconnect works.
      5. Sign-out Cloud → connect Slack prompts Cloud sign-in first (Google/Outlook dialog).
      6. Regression: Google/Outlook identity and Gmail/Outlook mail connect still work;
         authorize URLs still not Uri.parse-mangled on web.
    status: pending

notes:
  - Full product Slack (notifications, channel↔case mapping, Events API, approval
    buttons) = later plan / safeappeals-slack extension — depends on this connection.
  - ROADMAP "Slack integration" under Planned next remains until full extension ships.
  - Reuse connection callback page and deep-link /connect path; do not invent a
    second OAuth loopback for Slack.
  - Budget: one todo per session when possible; cloud + desktop registration can
    pair if same agent holds both trees.
  - Gotcha from Outlook ship: always openExternal(authorizeUrl as string); always
    request identity-ish fields (team id, user id) so connection label is human.
  - Slack OAuth v2 response shape differs (authed_user vs bot); map carefully in
    completeConnectionCallback before encrypting refresh.

created: 2026-08-11
status: active
---

# Slack service connection — stepping stone plan

## Goal

Ship **Connect Slack** as a SafeAppeals Cloud **service connection**, reusing the Google/Microsoft connections architecture and the same class of UI entry points we used for Outlook (buttons / connect actions), without building the full Slack product extension yet.

## Non-goals (this plan)

- Slack as SafeAppeals Cloud **identity** (no Supabase `provider=slack`, no replacing Google/Outlook on the identity dialog).
- `extensions/safeappeals-slack` full feature set (notifications, Events API, case channel mapping, approval buttons).
- Background indexing of all workspace channels.
- Admin/user-management scopes.

## Architecture (locked)

```
Desktop / web workbench
  → ensure SafeAppeals Cloud session (identity: Google | Outlook)
  → POST /connections/start { provider: "slack", capabilities: ["messaging"] }
  → openExternal(authorizeUrl)  // string, never Uri.parse
  → Slack consent → redirect {API_PUBLIC_URL}/connections/callback
  → server exchanges code, encrypts refresh, upserts service_connections
  → deep link / poll claim → ConnectionInfo (no secrets on client)
  → later: POST /connections/:id/token { capability: "messaging" }
```

| Concern | Owner |
| -------- | ----- |
| Client ID/secret | Railway / API env only |
| Refresh token | Cloud AES store |
| Access token | Minted short-lived to desktop |
| Identity login | Unchanged: Google + Outlook only |

### Capability model (v1)

| Provider | Capability | Slack scopes (starting set) |
| -------- | ---------- | --------------------------- |
| `slack` | `messaging` | `channels:read`, `chat:write`, `users:read`, `team:read` |

Do **not** overload `mail` / `calendar`. Slack is a third provider with its own capability.

## UI placement (match “where we put buttons”)

### Keep separate from identity

| Surface | Today (identity) | This plan |
| ------- | ---------------- | --------- |
| Chat setup dialog | Continue with Google / Outlook | **No Slack** on this dialog |
| Onboarding Sign In step | Google / Outlook | **No Slack** |
| Models → Sign in | forceSignInDialog Google/Outlook | **No Slack** |
| Dashboard `/login` | Google / Outlook | **No Slack** |

### Add Connect Slack here

| Surface | File(s) | Behavior |
| ------- | ------- | -------- |
| Onboarding (post-identity) | `src/vs/workbench/contrib/welcomeOnboarding/browser/onboardingVariationA.ts` (+ CSS) | Optional **Connect Slack** button on First Steps / tools strip; skip allowed |
| Accounts menu | `chatSetupContributions.ts` | **Connect Slack Workspace...** when Cloud signed in |
| Command palette | `safeappeals-authentication` package.json | `safeappeals.connections.connectSlack` |
| Connections facade / existing connect UX | `connectionsFacade.ts` / commands | Include Slack in connect quick pick if one exists |
| Status / settings (optional v1.1) | TBD | Show connected workspace name |

Copy rules: title-style labels; clarify Slack is a **workspace connection**, not SafeAppeals sign-in.

## Implementation order

1. **slack-conn-0** boundaries + capability name  
2. **slack-conn-1** Slack app + Railway secrets  
3. **slack-conn-2** cloud provider + migration + tests  
4. **slack-conn-3** desktop API + manager + optional `safeappeals-slack` auth provider id  
5. **slack-conn-4** UI buttons/commands  
6. **slack-conn-5** revoke on delete + docs  
7. **slack-conn-6** smoke  

## File checklist (v1)

### Cloud (`safeappeals-cloud/`)

- [ ] `api/src/lib/connectionAuthorizeUrl.ts` — Slack authorize builder  
- [ ] `api/src/services/connections.ts` — provider branch, token exchange, mint refresh  
- [ ] `api/src/routes/connections.ts` — parse provider slack  
- [ ] `api/src/services/accountDeletion.ts` — revoke slack rows  
- [ ] `supabase/migrations/*_slack_provider.sql` — CHECK constraint  
- [ ] `api/test/connections.test.ts`  
- [ ] `api/.env.example`, `railway-env-example.txt`  

### Desktop (`SafeAppeals2.0/`)

- [ ] `extensions/safeappeals-authentication/src/connectionsApi.ts`  
- [ ] `extensions/safeappeals-authentication/src/providerCapabilities.ts`  
- [ ] `extensions/safeappeals-authentication/src/slackAuthProvider.ts` (optional if getSession needed)  
- [ ] `extensions/safeappeals-authentication/src/extension.ts` + `package.json` + nls  
- [ ] `product.json` trustedExtensionAuthAccess if provider id ships  
- [ ] `src/vs/workbench/contrib/welcomeOnboarding/browser/onboardingVariationA.ts` + `media/variationA.css`  
- [ ] `src/vs/workbench/contrib/chat/browser/chatSetup/chatSetupContributions.ts`  
- [ ] Tests under `extensions/safeappeals-authentication/src/test/`  

### Docs (after smoke green)

- [ ] `ROADMAP.md` — Slack **connection** note under Auth; full integration stays Planned  
- [ ] `docs/ADDED_FEATURES_TRACKER.md` — new row  
- [ ] Point `safeappeals_2.1_rebrand_and_slack.plan.md` connection design at this file  

## Security checklist

- [ ] No Slack tokens in SecretStorage except if a future extension caches access tokens in memory only (prefer mint each time).  
- [ ] Encrypted refresh on server only.  
- [ ] Disconnect + account delete revoke paths.  
- [ ] Minimal scopes; document justification for Slack app review if distribution expands.  
- [ ] `openExternal(authorizeUrl: string)` only.  

## Acceptance criteria (v1 done)

1. Signed-in user can complete Slack OAuth and see an active `slack` connection.  
2. `POST /connections/:id/token` returns a usable access token for `messaging`.  
3. Disconnect clears server grant; UI offers reconnect.  
4. Identity Google/Outlook dialogs unchanged (two buttons only).  
5. Onboarding + Accounts expose Connect Slack without forcing it.  
6. Unit tests for authorize URL + provider parse; smoke steps in todo 6 pass.  

## Follow-on (not this plan)

Full `extensions/safeappeals-slack`: outbound case notifications, channel mapping, Events API, approval buttons — see ROADMAP Integrations & Data Import and `safeappeals_2.1_rebrand_and_slack.plan.md` phases 1–2 after this connection ships.

## Session guidance

- Read this file first.  
- Prefer one todo per session.  
- After ship: ROADMAP + tracker per “How we update this file”; conventional commit; no commit unless asked (or user already asked for plan only here).  
- Attach to Run Dev (CDP) for UI smoke, not web-only unless testing web callback origins.  

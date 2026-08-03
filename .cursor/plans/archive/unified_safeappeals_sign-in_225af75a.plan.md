---
name: Unified SafeAppeals sign-in
overview:
  "DONE Aug 3, 2026 (engineering). Identity + Service Connections shipped.
  Cloud identity-only; mail/calendar via /connections/* multi-account providers.
  Calendar loopback deleted; piggyback/provider-token removed. Verify closed via
  mocked V1 + prod GET /connections → 401 (route live) + onboarding free/AI
  copy. Business leftovers (WP0 Google verification, site marketing, interactive
  Electron smoke) live on the master plan — not this limb."
todos:
  - id: rung65-server-brief
    content:
      'Write server work brief: Supabase scopes (Gmail/Calendar/Azure),
      provider-token refresh endpoint, verification checklist'
    status: completed
  - id: rung65-auth-ext
    content:
      'COMPLETED Aug 2 via onboarding T0/T1: safeappeals-authentication
      extension shell, safeappeals-cloud provider, PKCE client, SecretStorage
      session envelope, build wiring, trustedExtensionAuthAccess. Cloud LM
      (Ask) also consumes this session.'
    status: completed
  - id: rung65-provider-tokens
    content:
      'SUPERSEDED Aug 3 by Service Connections: safeappeals-google/microsoft are
      multi-account ConnectionAuthProviders minting via /connections/:id/token.
      POST /auth/provider-token + identity mail piggyback removed (C4/C5).'
    status: completed
  - id: rung65-calendar
    content:
      'COMPLETED Aug 3: calendar uses connections + getSession([calendar]);
      oauthLoopback/tokenStore/client-secret settings deleted (L1/T1).'
    status: completed
  - id: rung65-email
    content:
      'COMPLETED Aug 2–3: OAuth XOAUTH2; connectionId credentials; Sign in with
      Safe Appeals (Google/Microsoft) via connections.connect; app-password
      fallback; reconnect + cloud sign-out cascade; IMAP Drafts APPEND.'
    status: completed
  - id: rung65-verify
    content:
      'COMPLETED Aug 3 (engineering DoD): serviceConnectionsV1Acceptance mocked
      path; prod api.safeappeals.com GET /connections → 401 (deployed);
      /auth/provider-token → 404 (removed); onboarding CreditsHandoff copy
      covers free email/calendar vs paid AI. Interactive smoke + WP0 + site
      marketing → master business checklist.'
    status: completed
isProject: false
---

# Unified SafeAppeals Sign-In (new Rung 6.5)

## Status (Aug 3, 2026) — **LIMB DONE** (engineering)

| Slice | Status |
| --- | --- |
| Server work brief | **Done** |
| Auth extension + `safeappeals-cloud` | **Done** |
| Cloud LM / Ask | **Done** |
| Multi-account google/microsoft (connections) | **Done** |
| Calendar `getSession` + loopback deleted | **Done** |
| Email XOAUTH2 + connectionId | **Done** |
| void-cloud `/connections/*` + drop piggyback | **Done** (prod live) |
| Engineering verify | **Done** (`rung65-verify`) |
| WP0 / site marketing / interactive smoke | **Master business** (not this limb) |

Canonical connections plan (all todos completed):
`~/.cursor/plans/service_connections_auth_3fbdccee.plan.md`

Piggyback history: `archive/email_oauth_piggyback_e435d610.plan.md` (superseded).

## Decisions (Jul 20, user-confirmed)

- **Route: brokered via SafeAppeals Cloud.** One free account is the identity
  for everything; mail/calendar grants are **Service Connections** (Aug 3
  model) — not a second GoTrue login.
- **Positioning:** free account unlocks calendar, email, documents; pay for AI.
  In-app onboarding covers this; safeappeals.com site copy is master/business.
- **Sequencing:** Rung 6.5 before rung 7; rung 13 slims to credits/LLM only.

## Model (current)

```mermaid
flowchart LR
    subgraph app [Safe Appeals app]
        authExt[safeappeals-authentication<br/>cloud + google + microsoft]
        email[safeappeals-email]
        cal[safeappeals-calendar]
        credits[rung 13: credits + cloud LLM]
    end
    cloudApi[SafeAppeals Cloud API]
    google[Google mail/calendar]
    ms[Microsoft mail/calendar]

    email -->|"getSession google/ms mail"| authExt
    cal -->|"getSession calendar"| authExt
    credits -->|getSession cloud| authExt
    authExt -->|identity + /connections| cloudApi
    authExt --> google
    authExt --> ms
```

## Ladder impact

- **Rung 6.5 engineering closed.** Continue master ladder (rung 7 timeline, etc.).
- Business gates on master: Google restricted-scope verification (WP0),
  interactive Electron smoke (Cloud A ≠ Gmail B ≠ Calendar C), site marketing.

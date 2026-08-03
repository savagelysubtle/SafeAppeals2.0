---
name: Email OAuth Piggyback
overview: "ARCHIVED / SUPERSEDED Aug 3 — limb closed. Service Connections replaced piggyback. WP1–WP8 done or replaced. WP0 Google verification moved to master business checklist (not blocked on this archived plan)."
todos:
  - id: confirm-design
    content: "Steve confirms identity-vs-mailbox model + stop-and-ask items (server refresh storage, verification, callback audit)"
    status: completed
  - id: wp0-google-verification
    content: "MOVED to master plan business checklist (r65-business-ops) — Google restricted-scope verification for mail.google.com"
    status: cancelled
  - id: wp1-mail-scopes
    content: "WP1 void-cloud: include_mail_scopes incremental flag + tests — historical; identity URL no longer carries mail scopes (C4)"
    status: completed
  - id: wp2-provider-refresh
    content: "WP2 void-cloud: POST /auth/provider-token — historical; removed in C5; mint is /connections/:id/token"
    status: completed
  - id: wp3-api-flags
    content: "WP3 auth api.ts flags — historical; identity authorize is identity-only (C4)"
    status: completed
  - id: wp4-reconsent
    content: "WP4 requestGoogleProviderScopes — historical; removed in C4; connect uses connections.start"
    status: completed
  - id: wp5-providers
    content: "WP5 providers — DONE then upgraded Aug 3 to multi-account ConnectionAuthProviders"
    status: completed
  - id: wp6-email-xoauth
    content: "WP6 email XOAUTH2 — DONE; Aug 3 also connectionId + connections.connect UX"
    status: completed
  - id: wp6b-connect-hotfix
    content: "WP6b Gmail connect hotfix — DONE (then superseded by connections allow different mailbox)"
    status: completed
  - id: wp6b-deploy
    content: "Deploy WP6b — DONE; later connections deploy void-cloud 3e08c60 / 1bbaa0c"
    status: completed
  - id: wp7-calendar
    content: "WP7 calendar: getSession + delete oauthLoopback/tokenStore — COMPLETED Aug 3 (connections L1)"
    status: completed
  - id: wp8-microsoft
    content: "WP8 Microsoft symmetry — COMPLETED Aug 3 via connections (MS mail + calendar separate grants)"
    status: completed
isProject: false
---

# Email Dashboard Login via SafeAppeals Google/Microsoft OAuth

## Status (Aug 3, 2026) — ARCHIVED / LIMB CLOSED (superseded by Service Connections)

This plan delivered the **same-account piggyback** path (WP1–WP6). Production
model is now **Identity once + Service Connections** (Cloud A can connect Gmail B
and Calendar C). Canonical plan:

`~/.cursor/plans/service_connections_auth_3fbdccee.plan.md` — **all todos completed**.

| WP | Piggyback outcome | Connections replacement |
| --- | --- | --- |
| WP0 | Still open (Google verification) | Same gate |
| WP1–WP4 | Shipped then stripped (C4) | Identity OAuth is identity-only |
| WP2 `/auth/provider-token` | Shipped then dropped (C5) | `POST /connections/:id/token` |
| WP5–WP6 | Shipped | Multi-account providers + `connectionId` on oauth accounts |
| WP7 | **Done Aug 3** | Calendar connections + loopback deleted |
| WP8 | **Done Aug 3** | Microsoft ConnectionAuthProvider |

## Verdict (historical)

**Yes** — email consumes Cloud identity via provider-token providers (rung 6.5).
**Aug 3 amendment:** mailbox tokens come from **service connections**, not a
second GoTrue login. Email Dashboard is never the product login surface.

## Critical nuance (current)

| Layer | Provider |
| --- | --- |
| Product identity | `safeappeals-cloud` |
| Mailbox / calendar tokens | `safeappeals-google` / `safeappeals-microsoft` with `session.id = connectionId`; mint via `/connections/:id/token` |

## Credential model (email) — current

```typescript
type EmailAccountCredentials =
	| { type: 'password'; password: string }
	| { type: 'oauth'; provider: 'google' | 'microsoft'; connectionId: string };
```

## Still open → master business (not this limb)

1. **WP0** Google restricted-scope verification / CASA.
2. Interactive Electron smoke: Cloud A → Gmail B → Calendar C → disconnect → sign-out/in.
3. safeappeals.com site marketing (in-app onboarding already covers free vs AI).

## Definition of done (desktop) — email GA under connections

1. Cloud sign-in without Gmail consent. **Done**
2. Connect Gmail (possibly ≠ Cloud email) via `connections.connect`. **Done**
3. IMAP/SMTP XOAUTH2 via `getSession('safeappeals-google', ['mail'], { account })`. **Done**
4. Token mint via `/connections/:id/token`. **Done**
5. Reconnect mailbox UX. **Done**
6. Cloud sign-out clears client tokens; connections remain server-side. **Done**
7. App-password path still works. **Done**
8. Calendar on connections; loopback gone. **Done** (WP7)
9. IMAP Drafts APPEND on save draft. **Done** (Aug 3 follow-on)

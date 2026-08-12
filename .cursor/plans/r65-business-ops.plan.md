---
name: r65-business-ops.plan.md — Google Verification, Smoke Tests & Dashboard Deploy
overview: |
  Parallel business/ops tasks for rung 6.5 / service connections (not blocking
  technical rungs). Owner: Steve (founder@safeappeals.com). All technical auth
  work (Service Connections limb, onboarding, etc.) is complete per
  unified_safeappeals_sign-in_225af75a.plan.md and service_connections_auth_3fbdccee.plan.md.

  Current date: 2026-08-10. Budget note: ~$6 remaining per safeappeals_2.1_rebrand_and_slack.plan.md — keep sessions cheap.

todos:
  - id: google-wp0-verification
    content: |
      WP0: Submit Google restricted-scope verification / CASA for mail.google.com
      (Gmail + Calendar scopes). Lead time: weeks. Track status in Google Cloud
      Console. Coordinate with Steve on test-user cap (100 users until approved).
      Reference: risks section in safeappeals_master_plan.plan.md.
    status: pending

  - id: electron-smoke-tests
    content: |
      Interactive Electron smoke tests for Cloud A (SafeAppeals), Gmail B,
      Calendar C accounts. Cover: sign-in, disconnect, sign-out/in cycles,
      multi-account switching. Use Run Dev (CDP) + pilot subagent or manual.
      Verify error surfacing, status bar, dashboard panels, calendar loopback
      (now deleted). Record results here or in vault.
    status: pending

  - id: void-cloud-dashboard-deploy
    content: |
      Deploy updated void-cloud dashboard copy (local strip updated Aug 3).
      Free account unlocks email/calendar/docs; paid unlocks AI + $30 credits.
      Update any remaining "void-cloud" references if present (rebrand to
      safeappeals-cloud already in progress per 2.1 plan). Verify marketing copy,
      onboarding links, credit flow.
    status: pending

  - id: final-nls-and-docs
    content: |
      Any remaining in-app onboarding/auth nls strings or docs updates.
      Update docs/ADDED_FEATURES_TRACKER.md and master plan if needed after tests.
    status: pending

notes:
  - These are non-blocking parallel items. Prioritize Google verification first
    (long lead time).
  - Use safeappeals_2.1_rebrand_and_slack.plan.md for rebrand cleanup tasks
    that overlap (e.g. docs updates).
  - After completion, mark r65-business-ops todo completed in master plan and
    log to scribe.
---

# r65 Business/Ops Micro Plan

**Status (2026-08-10):** Pending. All engineering for unified sign-in and Service Connections is complete. These tasks are business-facing and require Steve coordination.

## Execution Guidance

1. **Start with Google WP0** — it has the longest lead time. Prepare submission package with scope justification for legal-workflow app (workers' compensation appeals).
2. **Smoke tests** — Prefer attaching pilot subagent to live Run Dev (CDP) on port 9222. Test all three account types end-to-end.
3. **Dashboard** — The local strip in void-cloud/ (or safeappeals-cloud) was updated Aug 3. Deploy and verify free/paid tiers align with onboarding copy.
4. **Closeout** — Update master plan todo to completed, refresh tracker, scribe session note.

Follow AGENTS.md, local data security rules, and coding guidelines strictly if any code changes arise. No core edits without architect review.

This micro-plan keeps the master plan executable in one session per task.

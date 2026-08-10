---
name: SafeAppeals 2.1 Rebrand + Slack Integration Master Plan
overview: |
  This plan consolidates all remaining work after the successful 2.1 rebrand
  (name shortened to "SafeAppeals", void-cloud → safeappeals-cloud rename,
  appealsIcons → safeappeals-icons). Goal is to keep future sessions short
  and cheap by providing **exact files to touch**, **what to change**, and
  **exact strings** so each new session can read this plan and execute
  without heavy exploration.

  Current budget reality (as of 2026-08-10): ~$6 left. Plan is broken into
  small, independent tasks that can be done in separate fresh sessions.

todos:
  - id: rebrand-final-cleanup
    content: |
      Final rebrand cleanup (very cheap, do this first).
      Files to touch:
      1. docs/ADDED_FEATURES_TRACKER.md — replace all remaining "void-reference" and "Void chat/agent stack" entries with "superseded by upstream / safeappeals-*" language. Update the "void-reference cleanup" row to "Completed as part of 2.1 rebrand".
      2. docs/storage/README.md and docs/storage/per-workspace-storage.md — remove all mentions of "code-oss-dev", "Void", and old paths. Update to use ".safeappeals" consistently.
      3. .cursor/plans/safeappeals_master_plan.plan.md — add a new completed todo noting the 2.1 rebrand (name shortening to SafeAppeals, void-cloud → safeappeals-cloud, appealsIcons → safeappeals-icons, Navigator dropped from name).
      4. SEARCH entire codebase for any remaining "Navigator" in UI strings, comments, or CSS (should be none after previous changes). Update docs/ and plans/ aggressively to reflect current branding and that void-reference/ is read-only/superseded.
      Expected output: All user-visible and doc references say "SafeAppeals" only. Cloud directory is consistently "safeappeals-cloud".
    status: completed

  - id: slack-integration-design
    content: |
      Create detailed Slack integration plan before any code.
      Create new file: .cursor/plans/safeappeals_slack_integration.plan.md
      Content must include:
      - Architecture decision (Slack Bolt app vs Incoming Webhooks + Events API)
      - OAuth flow (use existing safeappeals-authentication pattern)
      - New extension: extensions/safeappeals-slack/
      - Exact files to create/edit:
        - extensions/safeappeals-slack/package.json
        - extensions/safeappeals-slack/src/extension.ts (contribution point)
        - extensions/safeappeals-slack/src/slackClient.ts
        - product.json — add to builtInExtensions, trustedExtensionAuthAccess, extensionEnabledApiProposals
        - src/vs/workbench/contrib/safeappeals-slack/* (if needed for workbench integration)
        - Update docs/ADDED_FEATURES_TRACKER.md and ROADMAP.md
      - Notification types (case updates, timeline events, approvals, file shares)
      - Security considerations (encrypted tokens in SecretStorage, per-case channel mapping)
      - Phased rollout (Phase 1: outbound notifications only, Phase 2: bidirectional)
      - Exact strings for settings, commands, menu items.
      Use the existing safeappeals-email and safeappeals-timeline patterns as templates.
    status: pending

  - id: slack-implementation-phase1
    content: |
      Implement Phase 1 (outbound notifications + channel mapping).
      Read the plan file first. Files to create/edit (exact list):
      - extensions/safeappeals-slack/package.json (copy pattern from safeappeals-email)
      - extensions/safeappeals-slack/src/extension.ts
      - extensions/safeappeals-slack/src/slackService.ts (use encryptedStore pattern)
      - Update product.json (add to builtInExtensions + trustedExtensionAuthAccess for safeappeals-cloud)
      - Add setting in extensions/safeappeals-authentication/package.json for Slack connection
      - Update docs/ADDED_FEATURES_TRACKER.md (mark as "In progress")
      Must follow all coding guidelines (encrypted storage, disposables, localization, no `any`).
      Run `bun run transpile-client` and `bun run gulp compile-extension:safeappeals-slack` after changes.
    status: pending

  - id: slack-implementation-phase2
    content: |
      Implement Phase 2 (bidirectional, rich messages, approval buttons, commands from Slack).
      Only start after Phase 1 is reviewed and working.
      Will likely need:
      - Slack Events API listener (probably in cloud or new MCP)
      - Rich message templates with buttons (approve, request changes, add note)
      - Thread linking between Slack and SafeAppeals cases
      - Update timeline and email extensions to emit events to Slack service
    status: pending

  - id: final-cleanup-and-docs
    content: |
      After Slack is complete:
      - Update ROADMAP.md to move Slack from "Planned next" to "Shipped"
      - Update docs/ADDED_FEATURES_TRACKER.md with final status and plan link
      - Run the icon generation script (safeappeals-icons/generate_app_icons.py) if any logo changes
      - Final `bun run transpile-client` + full build test
      - Update safeappeals_master_plan.plan.md with completion note
    status: pending

notes:
  - All tasks must follow AGENTS.md rules (encryptedStore for any credentials, no plaintext on disk, proper disposables, localization, camelCase, etc.).
  - Every session must start by reading this plan file first.
  - Budget discipline: each session should be one todo item maximum.
  - Data folder change (.safe-appeals-navigator → .safeappeals) will require a migration note in final docs.
  - Cloud rename is complete and verified working.
  - Do not delete void-reference/ until master plan explicitly marks rung 15 complete.

created: 2026-08-10
status: active
---

This plan is the single source of truth for the remainder of the 2.1 work. Every new session should begin by reading this file.
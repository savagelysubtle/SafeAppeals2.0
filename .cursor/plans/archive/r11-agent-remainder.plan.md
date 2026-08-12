---
name: r11-agent-remainder.plan.md — SafeAppeals Agent Rebrand + BYOK Wiring
overview: |
  CLOSED — LAUNCH 2026-08-11. Complete rung 11: rebrand the vendored extensions/copilot as the SafeAppeals
  agent and wire BYOK providers through upstream's Manage Models UI
  (chatLanguageModels.json + chat.lm.secret.* secrets).

  Deps: M2 (product.json swap already done). References: upstream_vs_code_merge_spike_2245beba.plan.md (rung 11 + section C.1), safeappeals_master_plan.plan.md §Rung 11 remainder, onboarding_redesign_newcomer.plan.md (T14 notes on defaultChatAgent).

  Current date: 2026-08-10. Small, self-contained. Use coder + reviewer + verifier.

todos:
  - id: copilot-rebrand
    content: |
      Rebrand vendored extensions/copilot:
      - Update all display strings, icons, product references from "Copilot"/"GitHub" to "SafeAppeals".
      - Change extension ID, name, publisher in package.json.
      - Update contributes, commands, menus, nls strings.
      - Ensure defaultChatAgent string rebrand (deferred from M2).
      - Remove any remaining GitHub.copilot-* references.
    status: completed
  - id: byok-provider-wiring
    content: |
      Wire BYOK providers via upstream Manage Models UI:
      - Populate chatLanguageModels.json with SafeAppeals BYOK groups.
      - Use chat.lm.secret.* SecretStorage keys.
      - Integrate with hasByokModels / chatEntitlementService (already partially done in M2).
      - Update any settings/React UI remnants (per D2 decision: use upstream UI).
      - Test model picker shows SafeAppeals Cloud + BYOK options.
    status: completed
  - id: gates-and-verify
    content: |
      Full gates: typecheck-client, compile-extensions (safeappeals + copilot rebrand), valid-layers-check, agent smoke tests.
      Pilot for Manage Models UI flow. Update docs/ADDED_FEATURES_TRACKER.md and master plan.
    status: completed
notes:
  - Follow exact patterns from onboarding_redesign_newcomer.plan.md and agent tools plan.
  - No new contrib hub; everything via extension or upstream.
  - Record any deviations in master plan "Implementation deviations" section.
  - After completion, flip r11-agent-remainder todo to completed in master plan.
---

> **CLOSED — LAUNCH (2026-08-11).** Migration ladder complete. Steve confirmed product features and agent work in production use. Historical only — new work is post-launch (see `ROADMAP.md`). Archived from active `.cursor/plans/`.

# Rung 11 Agent Remainder Micro Plan (2026-08-10)

This is the executable micro-plan for the last technical agent integration step. The vendored copilot extension is the vehicle for the SafeAppeals agent experience. BYOK uses the upstream "Manage Models" surface so we avoid maintaining a settings pane (D2 decision confirmed Jul 29).

**Approach:** One small PR per todo above. Start with rebrand (strings first to avoid nls churn), then BYOK wiring. Use explorer first to map all copilot references in the vendored extension.

Read the full context in safeappeals_master_plan.plan.md before starting (especially decisions D1–D4 and the "contrib hub is dead" resolution). Dispatch architect if scope creeps.

This plan replaces the vague pointer in the master plan.

---
name: r13-cloud-remainder.plan.md — Cloud Credits, /models, SSE & Decisions
overview: |
  Complete rung 13 remainder (T13 LLM provider already landed in M2/onboarding).

  Scope: credits/balance/checkout UI polish beyond wizard, /models endpoint as
  single source of truth for model list, server SSE (if not landed), final
  metrics/update service decisions (keep/slim/drop).

  Deps: M2, rung 6.5 (connections). References: safeappeals_master_plan.plan.md,
  upstream_vs_code_merge_spike_2245beba.plan.md (rung 13 + C.1 server prerequisite).

  Current date: 2026-08-10.

todos:
  - id: credits-ui-polish
    content: |
      Polish credits/balance/checkout UI (beyond T7 wizard step). Ensure
      free-vs-AI copy accurate, balance visible in status/onboarding, checkout
      flow works with void-cloud / safeappeals-cloud.
    status: pending

  - id: models-endpoint
    content: |
      Make /models the single source of truth. Wire into model picker, hasByokModels,
      chatLanguageModels. Remove any hardcoded lists.
    status: pending

  - id: server-sse-and-tools
    content: |
      Ensure server supports SSE for streaming and native tool_calls if not already
      complete with T13. Test with agent loop.
    status: pending

  - id: metrics-update-decision
    content: |
      Final verdict on metrics + update services (slim or drop per merge plan).
      Implement any remaining upstream-compatible changes. Update docs if kept.
    status: pending

  - id: gates-and-docs
    content: |
      Full verification gates, web/code-server parity, update tracker and master plan.
      Scribe session.
    status: pending

notes:
  - Budget tight (~$6); keep implementation minimal and verifiable.
  - Coordinate with r11 (BYOK) and r12 (classifier uses cloud LM).
  - Use sentinel for any auth/credits surface.
---

# Rung 13 Cloud Remainder Micro Plan (2026-08-10)

This wraps the cloud side after onboarding Phase B. Focus on polish and decisions rather than new surface. The /models endpoint should drive everything downstream (model list, entitlements, pricing).

Read the relevant sections of the upstream merge spike plan (section C.1) and master plan before starting. Any server changes likely require supabase-safeAppeals MCP (auth may be needed).

After completion, update r13-cloud-remainder todo in master plan to completed.

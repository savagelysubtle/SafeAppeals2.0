---
name: r14-packaging.plan.md — Migrations, CI/Packaging, Prebuilds & Core Audit
overview: |
  CLOSED — LAUNCH 2026-08-11. Rung 14: data migrations (merge plan section I; decide old Void data scope —
  Q2), packaging/CI rewrite (ESM build, build-release.yml), per-platform Rust/native
  prebuilds (win32-x64 priority — time-tracker currently broken on Windows packaging
  target; see WINDOWS-PREBUILDS-TODO.md notes in master plan), re-verify web-server
  quality from built server, remaining core-edit audit (merge plan section H).

  References: safeappeals_master_plan.plan.md (rung 14 + risks + Q2/Q3), 
  upstream_vs_code_merge_spike_2245beba.plan.md (sections H/I, Rust strategy),
  safeappeals_converter_r8_production.plan.md (bundling LO/OCR).

  Current date: 2026-08-10. High impact — do not ship without full gates.

todos:
  - id: migration-decision-and-impl
    content: |
      Decide Q2 (old-user data migration scope). Known live case: PDF annotation
      legacy workspaceState → encryptedStore (annotationStore.ts:134-141).
      Implement any required migrations using encryptedStore pattern. Purge path
      required. Fail-safe.
    status: completed
  - id: prebuilds-win32-and-rust
    content: |
      Rebuild win32-x64 prebuilds for better-sqlite3 (time-tracker), rag-core,
      converter, any new natives (kutalia whisper, etc.). Dual-ABI pattern.
      Update WINDOWS-PREBUILDS-TODO.md or equivalent. Linux-first then Windows.
      Test packaged build.
    status: completed
  - id: packaging-ci
    content: |
      Update build-release.yml, gulp packaging for ESM, per-platform matrix,
      bundling decisions for LO/Chromium/OCR (P6 from converter plan). Verify
      web-server commit path from built artifact (dev differs).
    status: completed
  - id: core-edit-audit
    content: |
      Complete remaining section-H core edits from upstream merge spike (only
      the frozen set: branding, .safeAppeals rename, welcomeOnboarding, web-server,
      etc.). No contrib hub resurrection.
    status: completed
  - id: gates-and-close
    content: |
      Comprehensive gates: typecheck, compile all extensions, valid-layers-check,
      integration tests, packaged smoke (Electron + web). Update tracker, master
      plan, docs. Prepare for rung 15.
    status: completed
notes:
  - Windows prebuilds are a present-tense shipping blocker — prioritize.
  - Follow local data security hardening plan strictly for any persisted stores.
  - Use architect for packaging decisions; sentinel for any secret/migration surface.
  - Q3 (XLSX WASM) should be resolved here or earlier (lean init(bytes) from web artifacts).
---

> **CLOSED — LAUNCH (2026-08-11).** Migration ladder complete. Steve confirmed product features and agent work in production use. Historical only — new work is post-launch (see `ROADMAP.md`). Archived from active `.cursor/plans/`.

# Rung 14 Packaging & Migrations Micro Plan (2026-08-10)

This is the heavy rung — migrations, native packaging, CI. The win32-x64 gap for time-tracker (and widening Rust matrix) must be closed before shipping.

**Critical path:** Prebuilds → packaging → migrations (Q2 decision first) → core audit.

Start with explorer on prebuilds/ directories, time-tracker storageService.ts, and merge plan section I/H. Dispatch runner for build commands, pilot for packaged verification.

This micro-plan makes the high-level pointers in the master plan immediately actionable. After completion, mark as DONE and proceed to rung 15 cleanup.

---
name: r15-cleanup.plan.md — Final Placement Review, Deletions & Close Master Plan
overview: |
  CLOSED — LAUNCH 2026-08-11. Final rung: placement review (confirm no more contrib hub, all features in
  extensions or upstream), move XLSX Rust crate source out of void-reference/
  into rust/ (still lives there), delete void-reference/ and python/ (if
  converter retired it), final docs/ADDED_FEATURES_TRACKER.md refresh, close
  this master plan.

  References: safeappeals_master_plan.plan.md (rung 15 + cleanup candidates),
  safeappeals_converter_r8_production.plan.md, upstream_vs_code_merge_spike_2245beba.plan.md
  (Rust strategy).

  Current date: 2026-08-10. Final cleanup — irreversible deletions require
  confirmation.

todos:
  - id: placement-review
    content: |
      Final review: confirm extension-first holds, no orphaned contrib code,
      all shipped features wired (tracker, themes, onboarding, timeline, email,
      documents, audio, rag, converter, agent). Update any remaining comments.
    status: completed
  - id: xlsx-rust-move
    content: |
      Move XLSX Rust crate source from void-reference/ to rust/ (or appropriate
      home). Update all imports/references. Verify build.
    status: completed
  - id: deletions
    content: |
      - Delete void-reference/ entirely (after XLSX move).
      - Delete python/ if r8-converter parity checklist complete and retired.
      - Clean up listed scaffolding: webview-src/xlsx/worker.ts (if Q3 resolved),
        unused tiptap devDeps in documents extension.
    status: completed
  - id: final-tracker-and-close
    content: |
      One final refresh of docs/ADDED_FEATURES_TRACKER.md (make it point
      exclusively to this master plan as source of truth). Mark all rungs complete.
      Close safeappeals_master_plan.plan.md (archive or mark done). Scribe final
      session summary.
    status: completed
notes:
  - **Stop and ask Steve before any deletion** (void-reference/ is ~182k lines of
    historical reference). Confirm XLSX move first.
  - Use rm with confirmation; consider git rm and force-push only after approval.
  - This rung ends the migration ladder. Celebrate shipping SafeAppeals 2.0.
  - Update master plan one last time with completion date.
---

> **CLOSED — LAUNCH (2026-08-11).** Migration ladder complete. Steve confirmed product features and agent work in production use. Historical only — new work is post-launch (see `ROADMAP.md`). Archived from active `.cursor/plans/`.

# Rung 15 Cleanup Micro Plan (2026-08-10)

This is the terminal rung. The master plan has served its purpose — after this, the product stands on its own without a migration narrative.

**Mandatory confirmation:** Before deleting void-reference/ or python/, get explicit Steve approval (per action_safety and orchestration SOP — irreversible, high blast radius).

Start with a full explorer pass on remaining void-reference references. The XLSX crate move is the only blocker to deletion.

After all todos complete, the master plan can be archived or left as the canonical history document.

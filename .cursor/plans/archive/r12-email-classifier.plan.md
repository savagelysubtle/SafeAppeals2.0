---
name: r12-email-classifier.plan.md — Email AI Classifier using vscode.lm
overview: |
  CLOSED — LAUNCH 2026-08-11. Implement rung 12: fill the noopClassifierHook seam in safeappeals-email
  using vscode.lm against the SafeAppeals Cloud provider (now live post-M2).

  Scope (confirmed D4, Jul 29): ONLY the email seam. Auto-tag, auto-link-to-case,
  hide suggestions via existing rung 6.6/6.7 command seam (non-destructive).
  Also formally decide/drop PDF-printed-email import (recommend DROP — .eml
  covers workflow).

  The three inert AI seams audit in master plan confirms DOCX/XLSX belong to
  tools-pass (already completed). Deps: M2 (live LM).

  Current date: 2026-08-10. Small self-contained feature. Reference:
  void-reference/browser/emailClassifier.ts (rewrite, not copy).

todos:
  - id: classifier-implementation
    content: |
      - Implement vscode.lm.registerTool or direct classify hook in safeappeals-email.
      - Replace noopClassifierHook (classifierSeam.ts).
      - Wire classify-on-import in emlEditorProvider.ts (remove TODO(rung12)).
      - Auto-tag/auto-link/hide logic using existing commands (email_tagThread,
        email_linkThreadToCase, etc.).
      - getUnclassified() should no longer return everything.
      - Provenance UI for suggestions.
    status: completed
  - id: pdf-import-decision
    content: |
      Formally decide and implement (or drop) PDF-printed-email import gap.
      Recommendation: DROP (per master plan D4). If dropped, remove any related
      seams/UI and document decision.
    status: completed
  - id: tests-and-gates
    content: |
      Unit tests for classifier, update agent smoke QA, full gates (typecheck,
      compile-extensions, valid-layers-check). Pilot for end-to-end email flow.
      Update docs/ADDED_FEATURES_TRACKER.md + master plan.
    status: completed
notes:
  - Suggestions never destructive. Use existing command seam for consistency.
  - Follow local data security (encrypted index already in place).
  - Dispatch sentinel if any auth/input surface touched.
  - After completion, mark r12-email-classifier completed in master plan.
---

> **CLOSED — LAUNCH (2026-08-11).** Migration ladder complete. Steve confirmed product features and agent work in production use. Historical only — new work is post-launch (see `ROADMAP.md`). Archived from active `.cursor/plans/`.

# Rung 12 Email Classifier Micro Plan (2026-08-10)

This micro-plan makes the TODO(rung12) live. The classifier is the last gap in the safeappeals-email extension (sidebar = inbox, dashboard, .eml editor, tagging, case linking all shipped).

**Key constraint:** Non-destructive only. Leverage the existing 6.6/6.7 command surface built deliberately for the agent.

Start by reading classifierSeam.ts, emlEditorProvider.ts, emailIndex.ts (getUnclassified), and the void-reference classifier for intent only (do not copy logic — rewrite against vscode.lm).

This completes the "three inert AI seams" from the Jul 29 audit.

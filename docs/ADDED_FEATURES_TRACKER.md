# SafeAppeals Feature Tracker

> **Public roadmap:** [../ROADMAP.md](../ROADMAP.md)  
> **Migration history (closed):** [`.cursor/plans/archive/safeappeals_master_plan.plan.md`](../.cursor/plans/archive/safeappeals_master_plan.plan.md) · [upstream merge spike](../.cursor/plans/archive/upstream_vs_code_merge_spike_2245beba.plan.md)  
> This file is a derived status INDEX only — update one row when a feature ships. Do not expand into narrative.
>
> **LAUNCH (2026-08-11):** Migration ladder complete. Product surface below is ship-ready. New work is post-launch only (see ROADMAP).
> Product: SafeAppeals (built on Code - OSS **1.129**, branch `update-vscode`).

| Feature | Status | Location | Wired? | Plan link |
| ------- | ------ | -------- | ------ | --------- |
| Time tracker | ✅ Shipped (Linux + Windows SQLCipher prebuilds) | `extensions/safeappeals-time-tracker` | Yes | archive master plan M0 / rung 1 |
| Theme packs (43 × `theme-safeappeals-*`) | ✅ Shipped | `extensions/theme-safeappeals-*` | Yes (runtime scan) | archive master plan foundation / rung 2 |
| Branding / product overlay | ✅ Shipped | product / branding core edits | Yes | archive merge plan rung 3 |
| Calendar sync | ✅ Shipped | `extensions/safeappeals-calendar` | Yes | archive master plan rung 4 |
| Timeline + deadlines + calendar UI | ✅ Shipped | `extensions/safeappeals-timeline` | Yes | archive timeline rung 7 |
| PDF viewer (read-only + annotations) | ✅ Shipped | `extensions/safeappeals-documents` | Yes | archive master plan rung 5a |
| DOCX editor | ✅ Shipped | `extensions/safeappeals-documents` | Yes | archive master plan rung 5b |
| XLSX editor | ✅ Shipped | `extensions/safeappeals-documents` | Yes | archive master plan rung 5c |
| Image viewer | ❌ Dropped (use upstream `media-preview`) | dropped | N/A | archive master plan “Explicitly dropped” |
| Email (IMAP/SMTP, sidebar, dashboard, tags, case links; Google + Outlook XOAUTH2) | ✅ Shipped | `extensions/safeappeals-email` | Yes | archive master plan rung 6 / 6.5–6.8 |
| Email AI classifier | 📋 Post-launch optional | seam in `extensions/safeappeals-email` | Seam | archive r12 (closed; not launch-blocking) |
| Tutorials + sample case | ✅ Shipped | `extensions/safeappeals-timeline` | Yes | archive timeline walkthrough |
| Timeline extension (profile / sample / walkthrough / skills) | ✅ Shipped | `extensions/safeappeals-timeline` | Yes | archive timeline + r8-organizer |
| Case-info dashboard | ❌ Dropped (D1) | superseded by onboarding + AGENTS.md | No | archive master plan D1–D3 |
| Encrypted-store helpers (`safeappeals-shared`) | ✅ Shipped | `extensions/safeappeals-shared` + per-ext `src/shared/` | Yes | archive master plan |
| Welcome onboarding wizard | ✅ Shipped | `src/vs/workbench/contrib/welcomeOnboarding/` | Yes | archive onboarding redesign |
| Unified SafeAppeals sign-in / cloud auth | ✅ Shipped | `extensions/safeappeals-authentication` + `safeappeals-cloud` | Yes | archive unified sign-in |
| File organizer / docket | ✅ Shipped (skill) | `extensions/safeappeals-timeline/skills/organize-files` | Yes | archive r8-organizer |
| File converter | ✅ Shipped | `extensions/safeappeals-converter` + `rust/converter` | Yes | archive r8-converter |
| Audio recorder + transcription | ✅ Shipped | `extensions/safeappeals-audio` | Yes | archive r9 |
| Private Search (RAG) | ✅ Shipped | `extensions/safeappeals-rag` + `rust/rag-core` | Yes | archive r10 |
| Agent / chat (SafeAppeals) | ✅ Shipped (launch-verified) | `extensions/safeappeals-agents` + upstream chat | Yes | archive r11 / M2 |
| Void chat / agent stack | ❌ Dropped | superseded | No | archive master plan “Explicitly dropped” |
| DocuSign / e-signature | ❌ Dropped (no partnership) | dropped | N/A | archive master plan “Explicitly dropped” |
| Unified settings pane | ❌ Dropped (D2) | historical only | No | archive master plan D1–D3 |
| Extension transfer service | ❌ Dropped (D3) | historical only | No | archive master plan D1–D3 |
| Cloud LLM / credits UI | ✅ Shipped | `extensions/safeappeals-authentication` + cloud backend | Yes | archive r13 / M2 T13 |
| Agent LM tools | ✅ Shipped | docs / email / time-tracker / auth tools | Yes | archive agent tools plan |
| Integrated browser Agent tools + `browser_cdp` | ✅ Shipped | `src/vs/workbench/contrib/browserView/.../tools` | Yes | Browser CDP agent tools |
| Contrib hub (`contrib/safeappeals`) | ❌ Deleted (extension-first) | dropped | N/A | archive master plan M0 |
| Packaging / prebuilds / migrations | ✅ Shipped (launch) | build / CI / prebuilds | Yes | archive r14 |
| void-reference cleanup / ladder close | ✅ Closed at launch | archive | N/A | archive r15 + master plan |
| Slack integration | 📋 Post-launch | planned | No | `ROADMAP.md` + active slack plans |

**Status legend:** ✅ Shipped · 📋 Post-launch · ❌ Dropped

**Wired?** means the feature is imported/registered in the active 1.129 product.

---

## Planning rule (post-launch)

1. Do **not** reopen `.cursor/plans/archive/safeappeals_master_plan.plan.md` or the upstream merge spike as active work.
2. New features → new plan under `.cursor/plans/` and a row (or ROADMAP post-launch line) here when scoped.
3. When something ships, flip status to ✅ Shipped and point at the closing plan/commit.

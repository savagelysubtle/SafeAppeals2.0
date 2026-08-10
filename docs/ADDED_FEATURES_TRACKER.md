# SafeAppeals Feature Tracker

> **Public roadmap:** [../ROADMAP.md](../ROADMAP.md)  
> **Source of truth:** [`.cursor/plans/safeappeals_master_plan.plan.md`](../.cursor/plans/safeappeals_master_plan.plan.md).  
> This file is a derived status INDEX only — update one row when a rung ships. Do not expand into narrative.
>
> Derived from the master plan’s **Ground truth (audited Jul 29 2026)** section; statuses below refreshed against shipping extensions (Aug 2026).
> Product: SafeAppeals (built on Code - OSS **1.129**, branch `update-vscode`).

| Feature | Status | Location | Wired? | Plan link |
| ------- | ------ | -------- | ------ | --------- |
| Time tracker | Shipped (Linux); broken on Windows pending prebuilds | `extensions/time-tracker` | Yes | master plan M0 / rung 1; `WINDOWS-PREBUILDS-TODO.md` |
| Theme packs (43 × `theme-safeappeals-*`) | Shipped | `extensions/theme-safeappeals-*` | Yes (runtime scan) | master plan foundation / rung 2 |
| Branding / product overlay | Shipped | product / branding core edits | Yes | merge plan rung 3 |
| Calendar sync (pull-only backend) | Partial — backend only, no UI, no write-back | `extensions/safeappeals-calendar` | Yes (commands / status bar) | master plan rung 4; Q5 write-back |
| Timeline + deadlines + calendar UI | Shipped (timeline UI + deadlines; calendar write-back still separate) | `extensions/safeappeals-timeline` (stores `.safeAppeals/timeline.json`) | Yes | `safeappeals_timeline_rung7_5ce1bf30.plan.md` |
| PDF viewer (read-only + annotations) | Shipped | `extensions/safeappeals-documents` | Yes | master plan rung 5a |
| DOCX editor | Shipped | `extensions/safeappeals-documents` | Yes | master plan rung 5b |
| XLSX editor | Shipped (WASM crate source still in void-reference) | `extensions/safeappeals-documents` | Yes | master plan rung 5c |
| Image viewer | Dropped (use upstream `media-preview`) | dropped | N/A | master plan “Explicitly dropped” |
| Email (IMAP/SMTP, sidebar, dashboard, tags, case links; Google XOAUTH2 + app-password) | Shipped except AI classifier | `extensions/safeappeals-email` | Yes | master plan rung 6 / 6.5 / 6.6 / 6.7 / 6.8; `email_oauth_piggyback_e435d610.plan.md` |
| Email AI classifier | Not built (noop seam) | seam in `extensions/safeappeals-email`; ref: `void-reference/browser/emailClassifier.ts` | Seam only | master plan rung 12 |
| Tutorials + sample case | Shipped | `extensions/safeappeals-timeline` (`safeappeals-timeline.openTutorials`, sample `file://` workspace, walkthroughs) | Yes | timeline walkthrough + feature walkthroughs |
| Timeline extension (profile / sample / walkthrough / project-setup + organize-files skills; case.json retired) | Shipped | `extensions/safeappeals-timeline` | Yes | `safeappeals_timeline_rung7_5ce1bf30.plan.md`; master `r8-organizer` |
| Case-info dashboard | Dropped (D1) | `void-reference/` only | No | master plan D1–D3 |
| Encrypted-store helpers (`safeappeals-shared`) | Shipped (source-only; synced copies) | `extensions/safeappeals-shared` + per-ext `src/shared/` | Yes (hygiene check) | master plan ground truth |
| Welcome onboarding wizard | In progress (M1 rewrite) | `src/vs/workbench/contrib/welcomeOnboarding/` | Yes | `onboarding_redesign_newcomer.plan.md` |
| Unified SafeAppeals sign-in / cloud auth | Partial — `safeappeals-cloud` identity + service connections (`safeappeals-google` / `safeappeals-microsoft`); mail/calendar via `/connections/*` only (never at cloud onboarding) | `extensions/safeappeals-authentication` | Yes | `unified_safeappeals_sign-in_225af75a.plan.md`; service connections plan; onboarding T0/T1 |
| File organizer / docket | Shipped (skill); docket UI dropped | `extensions/safeappeals-timeline/skills/organize-files`; ref: `void-reference/` | Yes (chatSkills) | master plan rung 8; `r8-organizer` |
| File converter | Partial | `extensions/safeappeals-converter` + `rust/converter` | Yes | master plan `r8-converter`; `safeappeals_converter_r8_production.plan.md` |
| Audio recorder + transcription | In progress (P0–P5); Hearings Audio walkthrough shipped | `extensions/safeappeals-audio`; ref: `void-reference/` | Partial | `.cursor/plans/safeappeals_audio_r9_production.plan.md`; master plan rung 9 |
| Private Search (RAG) | Shipped | `extensions/safeappeals-rag` + `rust/rag-core`; status bar `$(search) Private Search`; tools in `docs/rag/tool-contracts.md` | Yes | master plan rung 10; packaging `docs/rag/packaging-rung-14.md` |
| Agent / chat (SafeAppeals) | Upstream chat + vendored Copilot (rebrand pending) | `extensions/copilot` + upstream chat | Partial | master plan rung 11; M2 T14 |
| Void chat / agent stack (sidebar, tools, MCP, quick edit, autocomplete, …) | Dropped (superseded by upstream) | `void-reference/` only | No | master plan “Explicitly dropped” |
| DocuSign / e-signature | Dropped (no partnership) | dropped | N/A | master plan “Explicitly dropped” |
| Unified settings pane | Dropped (D2) | `void-reference/` only | No | master plan D1–D3 |
| Extension transfer service | Dropped (D3) | `void-reference/` only | No | master plan D1–D3 |
| Cloud LLM / credits UI | Shipped (balance + Add Credits / `safeappeals.cloud.openCheckout` + insufficient-credits UX) | `extensions/safeappeals-authentication` + cloud backend | Yes | onboarding M2 T13; master plan rung 13 |
| Agent LM tools (docs / email / time-tracker / workspace+web; pattern docs) | Shipped (plan closed Aug 3 2026; `bab332f6`) | `extensions/safeappeals-documents`, `safeappeals-email`, `time-tracker`, `safeappeals-authentication`; see `docs/agent-tools-pattern.md` | Yes | archive `safeappeals_agent_tools_da04f06e.plan.md` |
| Integrated browser Agent tools + page `browser_cdp` | Shipped (CORE; Plan-stripped; deny-list on Agent CDP only) | `src/vs/workbench/contrib/browserView/.../tools` + auth `CORE_AGENT_TOOL_NAMES` / `PLAN_MODE_BROWSER_DENYLIST` | Yes | Browser CDP agent tools plan (Aug 2026) |
| Contrib hub (`contrib/safeappeals`) | Deleted (dead stub; extension-first) | dropped | N/A | master plan “Resolution: the contrib hub is dead” / M0 |
| Packaging / prebuilds / migrations | Pending | build / CI | Partial | master plan rung 14 |
| Slack integration (notifications, bidirectional sync, rich embeds) | Not built | `extensions/safeappeals-slack` (planned) | No | ROADMAP.md (Planned next) |
| void-reference cleanup | Pending | `void-reference/` | N/A | master plan rung 15 |

**Status legend:** Shipped · Partial · In progress · Not built · reference / not migrated · Dropped

**Wired?** means the feature is imported/registered in the active 1.129 product (extension gulped, contrib imported from `workbench.common.main.ts`, or equivalent). Code that lives only under `void-reference/` is never “Wired.”

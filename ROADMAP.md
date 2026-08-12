# SafeAppeals Roadmap

Public tracker of **features SafeAppeals has added** on top of the Code - OSS foundation, plus what's next **after launch**.

> **Detailed status index (engineers):** [docs/ADDED_FEATURES_TRACKER.md](docs/ADDED_FEATURES_TRACKER.md)
> **Competitive planning notes:** [docs/COMPETITIVE_ROADMAP.md](docs/COMPETITIVE_ROADMAP.md)

Last refreshed: **2026-08-11** · Product: **SafeAppeals 2.1** (`2.1.0`)

---

## ★ Launch — SafeAppeals 2.1 (2026-08-11)

**SafeAppeals 2.1 is the launch line.** The VS Code migration ladder is closed.

**Why 2.1 (not 3.0):** Same product line as 2.0 for users and installers, with a **major platform refresh** under the hood — jumped from the old VS Code/Void-era base to current Code - OSS, rebuilt the legal surface, and landed upgraded Rust natives (RAG, converter, tracker, docs). That is a 3.0-sized engineering change; the **shipped product version stays 2.1** so the story is “big refresh of SafeAppeals 2,” not a new product number. Git tags: historical `v2.0.0` remains the prior line; cut **`v2.1.0`** on the release commit when installers go out.

| What | Where (historical only) |
| ---- | ----------------------- |
| Master plan (ordered rungs → ship) | [`.cursor/plans/archive/safeappeals_master_plan.plan.md`](.cursor/plans/archive/safeappeals_master_plan.plan.md) |
| Upstream merge / disposition inventory | [`.cursor/plans/archive/upstream_vs_code_merge_spike_2245beba.plan.md`](.cursor/plans/archive/upstream_vs_code_merge_spike_2245beba.plan.md) |
| Final micro-plans (r11–r15, r65) | [`.cursor/plans/archive/`](.cursor/plans/archive/) |

**Implications for planning:**

- Product features on the migration ladder are **done and working** (agent, auth, email, docs, timeline, tracker, RAG, cloud credits, tools).
- **All new features and plans are post-launch.** Do not reopen the master plan or merge spike as active workstreams.
- Business/ops that are not product code (e.g. Google restricted-scope verification) may still run in parallel; they do not reopen the ladder.
- New work gets a **new** plan under `.cursor/plans/` (or an issue), then ships into **Shipped** below when done.

---

## Legend

| Status | Meaning |
| ------ | ------- |
| ✅ Shipped | Available in current builds |
| 🚧 In progress | Actively being built or polished (**post-launch only**) |
| 🧩 Partial | Core path works; gaps remain |
| 📋 Planned | On the roadmap, not started (**post-launch**) |
| ❌ Dropped | Explicitly out of scope |

---

## Shipped — launch surface

Features SafeAppeals owns beyond a plain code editor:

### Workspace & case workflow

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Multi-workspace case isolation | ✅ | Folder / workspace = case boundary |
| Timeline + deadlines + jurisdictions | ✅ | Categories, reminders, calendar view, PDF/HTML export |
| File organizer (AI + rules) | ✅ | Side classification, naming patterns, preview/apply |
| Tutorials + sample case | ✅ | In-app walkthroughs |
| Theme packs (SafeAppeals) | ✅ | Dozens of branded themes |
| Welcome onboarding | ✅ | First-run for legal users new to agentic AI |

### Documents

| Feature | Status | Notes |
| ------- | ------ | ----- |
| PDF viewer (annotations, highlights) | ✅ | Rust/WASM path |
| DOCX editor | ✅ | Full editing in-app |
| XLSX editor | ✅ | Rust/WASM rewrite |
| Document converter + PDF merge | ✅ | Extension + Rust sidecar |
| OCR (Tesseract) / Poppler helpers | ✅ | Scanned PDF / image text |

### Email & communications

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Email dashboard (IMAP/SMTP, tags, case links) | ✅ | Google + Outlook XOAUTH2 via service connections; app password fallback |
| AI draft replies | ✅ | Context from project documents |

### AI, RAG & agents

| Feature | Status | Notes |
| ------- | ------ | ----- |
| SafeAppeals Agent | ✅ | Launch-ready; works end-to-end |
| Private Search (local RAG) | ✅ | Hybrid search, per-workspace isolation, offline embeddings |
| Chat modes (Drafting / Research / Case Manager) | ✅ | Project-aware assistant |
| BYOK providers + SafeAppeals Cloud credits | ✅ | Claude, GPT, Gemini, and more |
| Agent LM tools (docs, email, time, browser, web) | ✅ | Extension + workbench tools |
| Integrated browser + Agent CDP tools | ✅ | Research without leaving the app |
| Create / persist plans (`.safeAppeals/plans`) | ✅ | Agent planning surface |

### Calendar, billing & audio

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Google Calendar sync | ✅ | Per-event, workspace-isolated |
| Outlook Calendar sync | ✅ | Microsoft Graph |
| Time tracker (UTBMS, 6-min billing, LEDES) | ✅ | Encrypted local storage; Linux + Windows prebuilds |
| Audio record + Whisper transcription | ✅ | Local/offline speech-to-text; case notes or voice input to agent |

### Auth, cloud & security

| Feature | Status | Notes |
| ------- | ------ | ----- |
| SafeAppeals Cloud sign-in | ✅ | Google + Outlook/Microsoft identity; chat setup, onboarding, Models, Accounts, and dashboard login |
| Encrypted local stores | ✅ | AES-GCM + SecretStorage pattern for legal data |
| Service connections (Google / Microsoft) | ✅ | Mail/calendar via `/connections/*`; short-lived provider tokens only |
| Packaging / native prebuilds | ✅ | Installer path and dual-ABI natives for desktop targets |

---

## Post-launch — planned next

Everything below is **after launch**. Priorities can shift; open an issue if something is blocking your workflow.

| Area | Candidates |
| ---- | ---------- |
| **Integrations & Data Import** | **Slack integration** (selected-channel/file import into a workspace, reviewed share-back, OAuth with minimal scopes — no background indexing of all channels); **Microsoft 365 / OneDrive / SharePoint import** (Graph API + MSAL, pull Word/Excel/PDF into a workspace through the existing conversion pipeline); **Obsidian vault import** (local `.md` parsing — wikilinks, tags, frontmatter — no OAuth required, feeds the knowledge graph below) |
| Deadlines | Statute-of-limitations tracker; richer jurisdiction rules |
| Documents | Court form auto-fill — both a native-file-generation path and a browser-driven portal-fill path, with a required field-level preview and human approval gate before any submission; DOCX merge templates; redline / document comparison |
| Evidence & Citations | Built-in Citation & Evidence system — link every drafted claim to a source document/page, verification status indicators, and a pre-export audit that flags unsupported claims |
| Case Intelligence | Medical chronology extraction (provider/date/treatment/diagnosis pulled from records with exact page links); case health/readiness panel (deadlines, missing evidence, unresolved citations in one view) |
| Agent & Automation | Agent Action Center (single queue to review/approve/reject every proposed agent action); explicit Agent Modes (Ask / Plan / Act / Submission) with visible current mode; living Case Brief UI over `AGENTS.md` with agent-proposed diffs instead of silent rewrites; local Case History (Git-backed checkpoints with plain-language labels, compare/restore, no Git vocabulary required); multi-model handoff packet so switching AI providers mid-task doesn't lose case context |
| Knowledge & Search | Knowledge graph view — 2D force-directed graph by default (lighter weight, better for daily use), with an optional 3D toggle for exploratory sessions |
| Model Transparency | Clear labeling of local vs. hosted vs. hybrid model processing per run, so it's obvious what stays on-device versus what leaves it |
| Presentations | Visual Case Story generator — evidence-backed hearing decks, medical chronologies, and client-update decks generated from workspace data, exported to PPTX/PDF with source-linked speaker notes |
| Platform / Extensibility | Extension SDK and marketplace groundwork — permission-scoped extensions, static + sandboxed review before publishing, clear separation from general VS Code extension compatibility |
| Agent Skills | Expand built-in agent skill library (e.g., PDF operations: merge/split/rotate/watermark/OCR/form-fill) as a pattern for future skills |
| Billing | Invoice generation; AI-assisted time entry; expenses |
| Client | Secure sharing / light client portal |
| Email | AI classification of incoming mail (optional enhancement) |

Active post-launch plan files (if any) live under [`.cursor/plans/`](.cursor/plans/) — currently Slack-related only. Migration plans stay in **archive**.

---

## Explicitly dropped (for now)

Kept here so we don't re-litigate settled calls:

- Standalone case-info dashboard (superseded by timeline / workspace model)
- DocuSign partnership path (no partnership; may revisit generic e-sign later)
- Void-era chat stack (superseded by current agent/chat surface)
- Contrib hub stub (extension-first architecture)

---

## How we update this file

1. **Launch is closed.** Do not add migration-ladder work here.
2. When a **post-launch** feature ships, move it to **Shipped** (or flip 🚧 → ✅) and update [docs/ADDED_FEATURES_TRACKER.md](docs/ADDED_FEATURES_TRACKER.md).
3. When scope **changes**, note it under Post-launch or Dropped with a one-line reason.
4. Prefer short, user-facing names here; put paths and plan links in the docs tracker.
5. New engineering plans go in `.cursor/plans/`; closed migration history stays in `.cursor/plans/archive/`.

---

## Feedback

- Issues: https://github.com/savagelysubtle/SafeAppeals2.0/issues
- Website: https://safeappeals.com
- Email: support@safeappeals.com

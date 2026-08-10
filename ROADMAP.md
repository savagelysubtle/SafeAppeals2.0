# SafeAppeals Roadmap

Public tracker of **features SafeAppeals has added** on top of the Code - OSS foundation, plus what’s in flight and what’s next.

> **Detailed status index (engineers):** [docs/ADDED_FEATURES_TRACKER.md](docs/ADDED_FEATURES_TRACKER.md)  
> **Competitive planning notes:** [docs/COMPETITIVE_ROADMAP.md](docs/COMPETITIVE_ROADMAP.md)

Last refreshed: **August 2026** · Product: SafeAppeals 2.x

---

## Legend

| Status | Meaning |
| ------ | ------- |
| ✅ Shipped | Available in current builds |
| 🚧 In progress | Actively being built or polished |
| 🧩 Partial | Core path works; gaps remain |
| 📋 Planned | On the roadmap, not started |
| ❌ Dropped | Explicitly out of scope |

---

## Shipped — what we’ve added

Features SafeAppeals owns beyond a plain code editor:

### Workspace & case workflow

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Multi-workspace case isolation | ✅ | Folder / workspace = case boundary |
| Timeline + deadlines + jurisdictions | ✅ | Categories, reminders, calendar view, PDF/HTML export |
| File organizer (AI + rules) | ✅ | Side classification, naming patterns, preview/apply |
| Tutorials + sample case | ✅ | In-app walkthroughs |
| Theme packs (SafeAppeals) | ✅ | Dozens of branded themes |

### Documents

| Feature | Status | Notes |
| ------- | ------ | ----- |
| PDF viewer (annotations, highlights) | ✅ | Rust/WASM path |
| DOCX editor | ✅ | Full editing in-app |
| XLSX editor | ✅ | Rust/WASM rewrite |
| Document converter + PDF merge | 🧩 | Extension + Rust sidecar |
| OCR (Tesseract) / Poppler helpers | ✅ | Scanned PDF / image text |

### Email & communications

| Feature | Status | Notes |
| ------- | ------ | ----- |
| Email dashboard (IMAP/SMTP, tags, case links) | ✅ | Google XOAUTH2 + app password |
| AI draft replies | ✅ | Context from project documents |
| Email AI classifier | 📋 | Seam only today |

### AI, RAG & agents

| Feature | Status | Notes |
| ------- | ------ | ----- |
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
| Time tracker (UTBMS, 6-min billing, LEDES) | ✅ | Encrypted local storage; Windows prebuilds still hardening |
| Audio record + Whisper transcription | 🚧 | Local/offline path; walkthroughs shipping |

### Auth, cloud & security

| Feature | Status | Notes |
| ------- | ------ | ----- |
| SafeAppeals Cloud sign-in | 🧩 | Replaces GitHub sign-in; Agents window parity in progress |
| Encrypted local stores | ✅ | AES-GCM + SecretStorage pattern for legal data |
| Service connections (Google / Microsoft) | 🧩 | Mail/calendar via connections API |

---

## In progress

| Item | Focus |
| ---- | ----- |
| Welcome onboarding rewrite | First-run experience for newcomers |
| Audio production polish | Reliability across platforms |
| Converter production hardening | Smart convert + selective merge |
| Cloud / Agents window parity | Consistent SafeAppeals identity |
| Packaging & prebuilds | Windows native deps, installers, migrations |

---

## Planned next

Priorities can shift; open an issue if something is blocking your workflow.

| Area | Candidates |
| ---- | ---------- |
| **Integrations & Notifications** | **Slack integration** (real-time case notifications, bidirectional updates, rich embeds, approval buttons, secure file sharing, channel mapping, notification rules) |
| Deadlines | Statute-of-limitations tracker; richer jurisdiction rules |
| Documents | Court form auto-fill; DOCX merge templates; redline compare |
| Billing | Invoice generation; AI-assisted time entry; expenses |
| Client | Secure sharing / light client portal |
| Email | AI classification of incoming mail |
| Platform | Finish Windows prebuilds; void-reference cleanup |

---

## Explicitly dropped (for now)

Kept here so we don’t re-litigate settled calls:

- Standalone case-info dashboard (superseded by timeline / workspace model)
- DocuSign partnership path (no partnership; may revisit generic e-sign later)
- Void-era chat stack (superseded by current agent/chat surface)
- Contrib hub stub (extension-first architecture)

---

## How we update this file

1. When a feature **ships**, move it to **Shipped** (or flip 🚧 → ✅) and update [docs/ADDED_FEATURES_TRACKER.md](docs/ADDED_FEATURES_TRACKER.md).
2. When scope **changes**, note it under Planned or Dropped with a one-line reason.
3. Prefer short, user-facing names here; put paths and plan links in the docs tracker.

---

## Feedback

- Issues: https://github.com/savagelysubtle/SafeAppeals2.0/issues  
- Website: https://safeappeals.com  
- Email: support@safeappeals.com

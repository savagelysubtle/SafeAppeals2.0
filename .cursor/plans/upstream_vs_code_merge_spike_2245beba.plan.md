---
name: Upstream VS Code Merge — Bolt-On Migration
overview:
  "Migration to upstream VS Code 1.129 on branch update-vscode (import commit
  65015a05, byte-identical to tag). Strategy: adopt upstream agent
  infrastructure (chat, chat editing, inline chat, inline completions, tools,
  MCP, browserView) and register SafeAppeals providers into it; rewrite the
  legal-domain product into contrib/safeappeals or as new built-in extensions
  (documents/calendar/email — see D.2; DocuSign dropped), each written once in
  its final home using void-reference/ as the logic source. This file is
  the full disposition inventory: every fork asset classified as
  replace / bolt-on / rewrite-in-contrib / extension / retire / defer."
todos:
  - id: import-upstream
    content: Import 1.129.0 tree on update-vscode (65015a05, diff vs tag = 0)
    status: completed
  - id: survey-upstream-agents
    content: Survey 1.129 agent stack vs Void systems; write decision matrix
    status: completed
  - id: phase0-prep
    content: "Phase 0: overlay from main; move old code to void-reference/;
      scaffold contrib/safeappeals hub"
    status: completed
  - id: rung1-time-tracker
    content: "Rung 1: time-tracker extension builds + loads on 1.129"
    status: completed
  - id: rung2-themes
    content: "Rung 2: theme-safeappeals packs + product.json entries + default theme"
    status: completed
  - id: rung3-branding
    content: "Rung 3: branding pass — product.json identity + appealsIcons only
      (defaultChatAgent kept: we tap Copilot's agent infra ourselves, decided Jul 17)"
    status: completed
  - id: rung4-calendar-ext
    content: "Rung 4: NEW safeappeals-calendar extension (from-scratch template)"
    status: completed
  - id: rung5-documents-ext
    content: "Rung 5: NEW safeappeals-documents extension — split (Jul 17):
      5a scaffold+PDF viewer, 5b DOCX editor, 5c XLSX viewer; each user-tested
      before the next. Image viewer: SKIPPED (upstream media preview suffices)."
    status: completed
  - id: rung6-email-ext
    content: "Rung 6: NEW safeappeals-email extension (classifier deferred to rung 12)"
    status: completed
  - id: rung6-polish-dashboard
    content: "Rung 6 polish: email dashboard — sidebar became THE inbox
      (account menu, search, sort, compose/drafts/sync); dashboard is
      reader/compose/drafts with Reply+Forward (a9fe6b6c, 9e1652fe)"
    status: completed
  - id: rung66-email-case-links
    content: "Rung 6.6 (before oauth): email↔case linking — global IMAP index
      + thread→caseFolder links, sidebar 'All mail / This case' scope,
      reader Link/Unlink actions, classifier seam for rung 12"
    status: completed
  - id: rung67-email-tags
    content: "Rung 6.7 (before oauth): manual email tagging — thread tag store
      (email-tags.json) + tagThread/untagThread/listTags/hideThread/
      unhideThread commands (AI seam), per-row always-visible dropdown menu
      (This case / Hide / tags / New tag), hide = grey + sink to bottom,
      auto-populating tag filter dropdown"
    status: completed
  - id: rung68-email-settings
    content: "Rung 6.8: email settings pane (header/signature global,
      auto-CC/BCC per-case) + compose CC/BCC + product-wide .vscode →
      .safeAppeals workspace config folder rename (core constant + ~13
      literals + copilot + configuration-editing)"
    status: completed
  - id: rung65-unified-auth
    content: "DEFERRED (user decision Jul 21), then SPLIT (Jul 29): unified
      sign-in was to be built in ONE shot right before rung 13. The onboarding
      redesign now carves out the safeappeals-cloud provider + the
      safeappeals-authentication extension shell and builds them EARLY (its
      T1). What remains here: safeappeals-google/-microsoft provider-token
      providers, calendar+email conversion to getSession(), and the server
      scopes/Azure/provider-token-refresh workstream. Detailed plan:
      unified_safeappeals_sign-in_225af75a.plan.md"
    status: pending
  - id: onboarding-redesign
    content: "ACTIVE WORKSTREAM (user decision Jul 29): rebuild the first-run
      wizard for legal users new to agentic AI — 4 steps (SafeAppeals Cloud
      sign-in → Who You Are → Meet Your AI Assistant → Credits & First Steps),
      backed by a new extensions/safeappeals-authentication built-in with PKCE
      + SecretStorage. Cuts across the ladder: pulls the cloud provider out of
      rung 6.5, the walkthrough/sample-case work out of rung 7, the cloud LLM
      provider out of rung 13, and the product.json Copilot swap out of rung
      11. Plan: onboarding_redesign_newcomer.plan.md"
    status: in_progress
  - id: rung7-case-ext
    content: "Rung 7 (RESHAPED Jul 21, extension-first; PARTLY SUPERSEDED Jul
      29): NEW safeappeals-case extension — case scaffold (AGENTS.md at case
      root + .safeAppeals/case.json), case-info editing, case-setup chat skill.
      Slices 1 + 1b SHIPPED (567beff7). Slice 1b (onboarding profile step) and
      the walkthrough now belong to the onboarding redesign (its T4/T10/T12).
      Slice 2 (timeline + deadlines) DEFERRED until that ships. Replaces old
      contrib foundation + rung 9 case info; agent-native via AGENTS.md."
    status: pending
  - id: rung8-organizer-ext
    content: "Rung 8: NEW safeappeals-organizer extension — file organizer +
      converter (explorer context menus + FileDecorationProvider + webview
      wizard; NO explorerViewer.ts core hook). Converter is a Rust sidecar
      (rust/converter, bin sa-converter) written in Rust from the start,
      retiring python/ — see the 'Rust strategy' section."
    status: pending
  - id: rung9-audio-ext
    content: "Rung 9: NEW safeappeals-audio extension — recorder + whisper
      transcription (was originally an extension in old fork)"
    status: pending
  - id: rung10-rag-ext
    content: "Rung 10: NEW safeappeals-rag extension — indexing/search, reuse
      time-tracker dual-ABI better-sqlite3 pattern; hybrid BM25+RRF retriever.
      WRITTEN IN RUST FROM THE START (user decision Jul 29): rust/rag-core
      napi-rs module — fastembed embeddings, usearch HNSW, tantivy BM25. No
      TS-first-then-port. See the 'Rust strategy' section."
    status: pending
  - id: rung11-agent-update
    content: "Rung 11: copilot → SafeAppeals agent update — rebrand vendored
      extensions/copilot, wire BYOK providers; replaces old rung 12 contrib
      integration layer"
    status: pending
  - id: rung13-cloud
    content: "Rung 13: cloud — auth/credits + server SSE/tool_calls/models + cloud vendor"
    status: pending
  - id: rung14-migrations-packaging
    content: "Rung 14: data migrations + packaging/CI + remaining core edits"
    status: pending
  - id: rung15-placement-review
    content: "Rung 15: placement review; delete void-reference/"
    status: pending
isProject: false
---

# Upstream VS Code Merge — Bolt-On Migration (full disposition plan)

## Status (Jul 29, 2026) — ONBOARDING PIVOT: the ladder is interrupted

**The ladder is paused at rung 7 and an out-of-band workstream takes over.**
User decision Jul 29, recorded here because it re-cuts four rungs at once.

Why: the audience was reconsidered. SafeAppeals ships to lawyers, paralegals,
claimant advocates, and self-represented claimants who have **never used an
agentic AI tool**, and the inherited first-run wizard speaks developer
("keymaps", "GHE", "pull requests", a `⌘⌃I` chord as a subtitle), promises
that signing in "unlocks AI features" (false under the zero-credit model), and
lands users in a product that will edit their files without asking. That is a
product-credibility problem for a legal audience, and it outranks finishing
the migration ladder in order. Full plan:
`onboarding_redesign_newcomer.plan.md` (14 tasks, T0–T14).

**What the onboarding workstream takes from the ladder.** It is not a new
rung appended to the end; it reaches into four existing ones and lifts the
piece it needs:

| Ladder rung | What onboarding takes | What stays on the rung |
| ----------- | --------------------- | ---------------------- |
| **6.5** unified sign-in | T1: `extensions/safeappeals-authentication` shell + the `safeappeals-cloud` provider only (PKCE client, SecretStorage envelope, build wiring, `trustedExtensionAuthAccess`). T0 adds server-side PKCE work rung 6.5 never scoped. | `safeappeals-google`/`-microsoft` provider-token providers; email XOAUTH2 + calendar `getSession()` conversion; Gmail/Calendar Supabase scopes, Azure provider, provider-token refresh endpoint, Google restricted-scope verification |
| **7** safeappeals-case | T4 (the "Who You Are" step), T10 (walkthrough → post-wizard checklist), T12 (bundled sample case + spotlight tour) | Slice 2 timeline + deadlines (deferred, see below); slice 3 case skills |
| **11** copilot → SafeAppeals agent | T14: `product.json` swap — drop `GitHub.copilot-chat`, trim `defaultChatAgent` | Rebranding the vendored agent; BYOK provider wiring |
| **13** cloud | T13: cloud LLM provider over `POST /llm/chat` + zero-credit UX | Credits/balance/checkout UI, metrics, update, server SSE |

Rungs 8 (organizer), 9 (audio), 10 (RAG) are untouched and still queued in
order behind this.

**The 6.5 carve-out does not contradict the Jul 21 deferral.** That deferral
existed so the provider surface would be designed against real consumers
instead of retrofitted per extension — and that risk lives in the
google/microsoft **provider-token** providers, which stay deferred. The
`safeappeals-cloud` provider is account identity with a known shape (Accounts
menu, `getSession()`), and the onboarding plan already designs the
SecretStorage envelope to carry `googleProviderToken`, so rung 6.5 adds
providers to an existing extension rather than reshaping its storage. Cost
accepted: the auth extension is touched twice instead of once.

**Security defects found on the way in (blocking, T0).** The deployed cloud
auth that rung 6.5 planned to inherit is not sound: there is no PKCE anywhere
in the chain (`void-cloud/api/src/routes/auth.ts:39`, `:61`), and the flow
accepts bearer tokens from the **URI fragment** via the OS URI handler
(`void-reference/browser/voidCloudUrlHandler.ts:111–137`), interceptable by
any local app registering the scheme. `/auth/google` also does no
redirect-URI allow-listing of its own. Separately the reference client
persists the whole session in plain `IStorageService`
(`voidCloudService.ts:29–30`, `:353`) — a Local Data Security violation that
must not be ported. Rung 6.5's server workstream assumed these endpoints were
fine and only needed scopes bolted on; that assumption is void.

**Rung 7 status.** Slices 1 + 1b shipped in `567beff7`: the extension has four
commands, the "Set Up Safe Appeals" walkthrough, the `case-setup` chat skill,
and build wiring. Slice 1b's onboarding step is superseded by T4. Slice 2
(timeline + deadlines) is **deferred until the onboarding workstream ships**
(user decision Jul 29) — it has no dependency on onboarding, but T10/T12 edit
the same extension, so it waits rather than collide. Details, defect list, and
the void-reference timeline inventory: `safeappeals_case_extension_rung7.plan.md`.

**Uncommitted at the time of this pivot** (working tree on top of `fa3fddf3`):
the `safeappeals.profile.*` settings registration moved from the extension's
`package.json` into core `welcomeOnboarding.contribution.ts` at `APPLICATION`
scope — the correct fix for a real bug, since the wizard was writing keys the
extension host had not yet registered — plus profile-step UI polish, a
`workbench.action.restartWelcomeWalkthrough` command, and `webClientServer.ts`
forwarding SafeAppeals product fields to the browser when running from
sources. A `product.json` flip of `onboardingSkipSignInStep` to `false` (which
re-exposed the Copilot sign-in step) was dev scaffolding and has been reverted.

## Rust strategy (consolidated Jul 29 — replaces two standalone plans)

`rust_acceleration_plan_b2c6b37e` and `cleanup_and_rust_consolidation_bea47939`
were **deleted** on Jul 29 (recoverable at `aa51b7ec`). Both were written
against the pre-migration `main` branch and pointed at
`src/vs/workbench/contrib/void/…` paths that no longer exist here; the cleanup
plan also assumed a `main`-frozen / `dev`-integration branch model that does not
describe `update-vscode`. Rather than re-base two documents, the surviving
decisions live here as notes on the rungs that will execute them.

**Governing decision (user, Jul 29): write it in Rust the first time.** Those
plans existed only because features had already been built in TS/Python and
then needed replacing. Anything not yet rebuilt skips the round trip — most
importantly RAG. No TS-first-then-port.

**Crate home:** one top-level `rust/` Cargo workspace, deliberately separate
from upstream's `cli/` so upstream merges stay clean. Per-platform prebuilds
are a packaging concern (rung 14) — see `WINDOWS-PREBUILDS-TODO.md`.

### Rung 10 (RAG) — build in Rust from the start

napi-rs module (`rust/rag-core/` → `@safeappeals/rag-core`), N-API surface
roughly `embedBatch`, `indexChunks`, `search`, `removeDoc`, `stats`:

- Embeddings: `fastembed-rs` (all-MiniLM-L6-v2, 384-dim, ONNX via `ort`) — the
  same model the old fork used, so any surviving vectors stay compatible
- Vector search: `usearch` HNSW with mmap persistence per workspace (the old
  fork brute-forced dot products over an in-memory Map)
- BM25: `tantivy`; RRF fusion can stay in TS initially
- Optional later: cross-encoder reranker via `ort` in the same module
- Keep a SQLite chunk/document store — it is metadata, not the bottleneck
- Because this is a fresh build, the old plan's `embeddings.db` migration step
  is moot unless real user indexes need preserving; that is a rung 14 question

Still applies from gap-audit item 5 below: rung 10 means **Advanced RAG**
(hybrid BM25+RRF, query processor, reranker), not basic vector search.

### Rung 8 (organizer + converter) — Rust sidecar replaces `python/`

`rust/converter/` (bin `sa-converter`), a long-lived child process speaking
newline-delimited JSON `{command, args}` on stdin — the same protocol as the
old `electron_bridge.py`, so the TS side stays thin. Preserve the
`IFileConverterMainService` contract (`configure`, `convert`, `batchConvert`,
`mergePDFs`, `getAvailableConversions`).

- PDF: `pdfium-render` (render/rasterize) + `lopdf` (merge, metadata)
- OCR: `ocrs` (pure Rust) first; feature-flag `leptess`/Tesseract if quality demands
- DOCX `docx-rs`; XLSX/CSV `calamine` + `rust_xlsxwriter`; MD/HTML `comrak` +
  `ammonia`; EPUB `epub`
- Port by conversion pair and report unsupported pairs through
  `getAvailableConversions` so the UI degrades gracefully
- **Risk:** LibreOffice-dependent pairs (docx→pdf via LO) have no good Rust
  equivalent — keep them listed unsupported, or shell out to LibreOffice for
  those pairs only
- Retires `python/` and ~200 lines of venv-discovery once pair parity is reached

### safeappeals-documents follow-up (rung 5 already shipped)

Goal: Rust as the single implementation per format, then drop the `xlsx`
(SheetJS) and `pdfjs-dist` dependencies. Order matters — extraction and
creation are low risk, editing is not:

- **XLSX formula round-trip gap (BLOCKING for the Rust edit path).**
  `calamine` drops formula ASTs on load and the writer stores formulas as
  strings, so a load→save through Rust today would **destroy formulas in
  existing workbooks**. Fix: parse `<f>` elements in `parser.rs`, use
  `write_formula` in `writer.rs`. Gate the switch on load→save→reload
  round-trip tests asserting values, formats, AND formulas survive. SheetJS
  stays until then.
- Add `extract_text_csv()` and a real `create_empty_xlsx()` (the existing
  `create_simple_xlsx` is demo code) before swapping extraction/creation.
- PDF text extraction: replace `pdfjs-dist` `getTextContent` loops with
  `PdfRenderer.load` + per-page `get_page_text`; decide whether to add
  `get_document_info()` for Title/Author or accept losing rich metadata.
- **WASM loading outside the browser:** the existing `--target web` artifacts
  can be loaded from Node via `fs.readFileSync(wasmPath)` + `init(bytes)` — no
  second build target — and the pdfium.js Emscripten glue already supports
  Node. Note the tension with `safeappeals_agent_tools`, which instead calls
  for `wasm-pack build --target nodejs` for the headless XLSX path; pick one
  before building the documents agent tools.

### Rust-backed WASM diff — cheap, independent, do any time

1.129 already ships the slot: `diffAlgorithm: 'advanced-wasm'` →
`src/vs/editor/common/diff/externalLinesDiffComputer.ts` → `@vscode/diff`
(already in `package.json` at `0.0.2-7`). Phase A is only flipping the default
and benchmarking on large legal documents (10k+ lines), watching two known
TODOs in that file: `ignoreTrimWhitespace` is forced true and
`maxComputationTimeMs` is unsupported — verify both acceptable before rollout.
Writing our own `rust/diff-wasm/` crate is Phase B, and only if the benchmarks
demand it.

### Deliberately dropped from those plans

- The `main`-frozen / `dev`-integration branch model — does not describe this branch.
- Dead pdf.js asset cleanup and stale WASM output dirs — those files live in
  `void-reference/`, which is deleted wholesale at rung 15.
- Mega-file splits: `SidebarChat.tsx` (4,549 lines) is gone with the old chat
  sidebar (replaced by upstream `ChatViewPane`), and the XLSX `renderer.ts`
  (5,248 lines) already moved into `safeappeals-documents` — re-evaluate there
  on its own merits, not as migration work.

## Status (Jul 21, 2026) — EXTENSION-FIRST RE-SEQUENCE (user decision)

**The ladder no longer "cracks into" src/vs.** User call (Jul 21): stay in
extension-land for everything that can be an extension; core edits stay
frozen at what's already done (branding, default theme, `.safeAppeals`
rename, web-server fixes). Rationale: rungs 4–6 proved the webview-React
extension pattern; every contrib file is a permanent upstream-merge
conflict; the dual-ABI sqlite pattern (time-tracker) removes the "native
deps need main process" argument; the vendored `extensions/copilot` is a
mature agent that replaces the planned hand-written contrib agent loop.

New ladder: **7 safeappeals-case → 8 safeappeals-organizer → 9
safeappeals-audio → 10 safeappeals-rag → 11 copilot→SafeAppeals agent
update (BYOK) → 6.5 unified sign-in → 13 cloud/credits → tools pass → 14
packaging → 15 placement review.** (Interrupted Jul 29 — the onboarding
redesign now runs ahead of rung 7's remainder and carves pieces out of 6.5,
7, 11, and 13. See the Jul 29 status section above before acting on this
ordering.) Old rung 7 (contrib
foundation/settings service) is DELETED — VS Code settings + globalStorage
cover it. Old rung 12 (contrib AI integration) folds into rung 11.
Section J's original ladder below is superseded by this ordering; sections
C/D contrib dispositions for organizer/timeline/case/RAG/audio are
superseded by extension dispositions (D.2 pattern).

**Case info REDESIGNED (Jul 21, user decision): agent-native, not a port.**
No case-info dashboard/service. Instead:
- **Global profile** (who the user is, firm, practice area, jurisdiction):
  collected by a first-run walkthrough (`contributes.walkthroughs` in
  safeappeals-case — zero core surgery), stored in global settings
  (`safeappeals.profile.*`).
- **Per-case**: `AGENTS.md` at case root (the standard the agent already
  auto-loads — user picked root over `.safeAppeals/` for visibility +
  standard plumbing + easy user docs) with the case brief (client,
  opposing party, claim number, injury date, jurisdiction, status), plus
  `.safeAppeals/case.json` as the structured twin for timeline/organizer/
  email to read programmatically. Managed sections in AGENTS.md via marker
  comments so user prose survives regeneration.
- Old `caseProfileService`, case-info React pane, `.caseinfo`,
  `.fileorg.json`, and `.voidrules` categories all collapse into this
  scheme (case skills later via `.safeAppeals/skills/`).
Detailed plan: `safeappeals_case_extension` plan file.

## Status (Jul 20, 2026)

**MILESTONE (Jul 20, user-verified): rungs 1–6 complete. All four custom
extensions (time-tracker, safeappeals-calendar, safeappeals-documents [PDF/
DOCX/XLSX], safeappeals-email) build, load, and function in BOTH the Electron
dev build AND the web/code-server dev build.** All work as delegated
manager→worker: each rung briefed to a cheaper subagent, reviewed here, then
user-tested before advancing. Rung 6 (email) committed `75ae64f0` and verified
in this milestone. Rung 6 follow-ups: `60ddcb05` (sync errors were swallowed —
user's wrong Gmail password looked like an empty inbox; added red sync-failure
banner, verbose sync logging, `diagnoseConnection` command, and fixed body
`download()` to pass `{ uid: true }`) and `9fbd862e` (Account… menu in the
dashboard with Remove account / Update password, add-account now verifies IMAP
credentials before saving with Retry / Save anyway, new
`safeappeals-email.updatePassword` command) and `a08afbfe` (surface real
imapflow server errors [responseText/serverResponseCode] with Gmail
app-password hint; ROOT CAUSE of "missing_credentials": addAccount wrote
settings before SecretStorage so background sync raced the secret write —
now secret-first with cleanup on failure). Jul 20 user-verified: Gmail sync
works with an app password (1895 msgs in INBOX, 100 synced per cap, threads
render). Rung 6 polish in flight: resizable dashboard split + sidebar mini
inbox (user-picked scope).

**Jul 20 (late): web webview "regression" after `441bea36` — CLOSED, no code
fault.** Repro attempt in a real Chromium (fresh profile, no DevTools, via
playwright) against code-server 8080 at HEAD `441bea36`: sidebar webview AND
Email Dashboard both load and render (105 threads listed). The earlier
"load loop" evidence came from Cursor's embedded browser, which cannot fetch
`*.localhost` subdomains at all; the "works with DevTools open" symptom
matches a stale cached webview service worker in the user's browser
(hard refresh Ctrl+Shift+R clears it). `441bea36` stands, no revert. Note:
"Sync failed: Credentials missing" on web is EXPECTED — SecretStorage is
per-client, so passwords entered on Electron don't exist in the browser
profile; one-time Account… → Update password on web (rung 6.5 OAuth removes
this friction). Follow-on (user-requested): email UI redesign — sidebar
becomes THE inbox (folder input, 50/page + load more, compose button);
dashboard editor becomes reader/compose/drafts only (thread list + sash
removed); `ctrl+shift+e` keybinding dropped (shadowed Show Explorer).
Commits: `a9fe6b6c` (sidebar=inbox split) + `9e1652fe` (sidebar owns
account menu/add/sync/compose/drafts + search box over the local index +
host-side thread sort newest/oldest/sender/subject; reader gets top-aligned
Reply + new Forward with quoted prefill). Cursor embedded-browser webview
issue root-caused: its CDP request interception can't fetch
`*.localhost:8080` webview subdomain origins unless DevTools is open
(0ms "Failed to fetch" probe); affects ALL webviews incl. built-in markdown
preview since `67adb730` moved webview hosting off the CDN. Not a code
fault — test web in a real browser; workaround option (wildcard DNS like
lvh.me) documented in chat, deliberately not applied.

**NEW Rung 6.5 (Jul 20, planned + user-approved): unified sign-in.** One free
SafeAppeals Cloud account brokers Google/Microsoft OAuth server-side and powers
email (Gmail XOAUTH2), calendar, and later AI credits — copies VS Code's own
AuthenticationProvider pattern (github-authentication model, Accounts menu for
free). New built-in `extensions/safeappeals-authentication` with 3 providers;
calendar drops oauthLoopback/client-secret settings; email gets OAuth account
type (app-password fallback stays); **rung 13 slims to credits/LLM only**.
Marketing note: free account unlocks calendar/email/docs, pay only for AI.
Full plan: `unified_safeappeals_sign-in_225af75a.plan.md`.

**RESEQUENCED (user decision Jul 21): OAuth deferred to pre-rung-13.** Same
rationale as the tools pass — build unified sign-in ONCE, after every consumer
of it exists (email, calendar, cloud link, agent backend), so the provider
surface is designed against real usage across the whole app instead of being
retrofitted per extension. Until then app-passwords stay for email. Sequence
is now: 6.6/6.7/6.8 (done) → 7 (contrib foundation) → 8..12 → **6.5 unified
sign-in → 13 (cloud/credits) → tools pass → 14**. Next up: rung 7 — first
`src/vs/workbench` contrib code + hub activation, where the migration moves
from extensions into the workbench itself.

**Rung 6.8 (Jul 21, DONE): email settings + CC/BCC + `.safeAppeals` rename.**
Settings gear in sidebar → dashboard Settings pane: compose header/signature
(global), auto-CC/BCC (per-case, workspace-scoped), sync interval/folder/max
surfaced. Compose gained Gmail-style Cc/Bcc toggles wired through send +
drafts + reply prefill. Product-wide workspace config folder renamed `.vscode`
→ `.safeAppeals` (`FOLDER_CONFIG_FOLDER_NAME` + ~13 core literals + copilot
protected-files glob/launch.json + configuration-editing schema associations +
config-related tests) so case folders never expose `.vscode` and per-case
email settings land in `.safeAppeals/settings.json`. Plan:
`email_settings_+_cc_bcc_aec3a5ea.plan.md`.

Commit trail (rungs): `2260b0b8`+`a0611c9b` (1, +`f53bbb4d` dual-ABI web fix),
themes (2, pre-milestone), `c6a853d8`+`57f42b9c` (3), `6996c961` (4),
`5021ec1f`+`40424e4e` (5a), `ed5a4a14` (5b), `41cf7077` (5c), `75ae64f0` (6),
`67adb730`+`b5521c84` (web viewer/icon fixes + traversal hardening),
`60ddcb05`+`9fbd862e`+`a08afbfe` (6 follow-ups: error surfacing, account
management UX, credential-storage race fix).

### Gap audit vs docs/ADDED_FEATURES_TRACKER.md (Jul 20)

Cross-checked every tracker feature against the disposition inventory. Gaps
found (everything else is covered by rungs 5–13 or documented drops):

1. **Agent tools plan → DEFERRED TO END (user decision Jul 20):** the tools
   pass (`safeappeals_agent_tools_da04f06e.plan.md`) runs AFTER all
   extensions/features land — one extension at a time, agent-tested live,
   which requires SafeAppeals cloud + agent backend linked (rung 13). The
   plan will grow to absorb RAG ×5 and timeline ×6 tools (C.2 #4) plus
   PDF-email import if re-added. Sequence: ...12 → 13 → tools pass → 14.
   Meanwhile **rung 6.6 (email↔case linking, gap 4) runs BEFORE rung 6.5**.
2. **Case Organizer agent workflow UNCLASSIFIED** (`void.organizer.init`,
   auto-created `tosort/`, structured case folders, dry-run/undo plans,
   `.voidrules` categories). Disposition: custom chat mode + prompt +
   upstream file tools at rung 12; `tosort/` auto-creation folds into file
   organizer (rung 8). Source: void-reference + tracker "Case Organizer".
3. **PDF-printed-email import dropped silently** — old email dashboard
   imported .pdf email exports via pdfjs; new ext only parses .eml. Decide
   at rung 12 (classifier work): re-add or drop formally.
4. **Email case-linking / workspace scoping lost** — old email was
   per-workspace SQLite w/ case-folder filter; new index is global
   (`globalStorageUri`), `caseFolderPath` field dormant. **→ Being rebuilt
   NOW as rung 6.6** (design: keep global IMAP index — per-workspace re-sync
   of the same mailbox makes no sense — and add thread→caseFolder links +
   sidebar scope filter + reader Link/Unlink actions).
5. **Rung 10 scope must name Advanced RAG** — hybrid BM25+RRF retriever,
   query processor, cross-encoder reranker, sqlite-vec backend
   (`void-reference/common/ragHybridRetriever.ts` etc.), not just basic
   vector search. Also: policy-manuals auto-create/watch/poll behaviors.
6. Confirmed drops/notes: image viewer stays dropped (upstream preview: no
   rotate — accepted); old-fork keybindings are conflict-prone
   (Ctrl+Shift+O = Go to Symbol, Ctrl+Shift+R = refactor, Ctrl+Shift+E
   removed Jul 20) — rungs 8–11 must not blind-copy them.

### Earlier status (Jul 17, 2026)

- Branch `update-vscode`: fork `main` tip (`741fd1ab`) + import commit
  `65015a05` == tag `1.129.0` exactly (`git diff --stat` = 0).
- Phase 0 DONE (Jul 17): old contrib overlaid from `main` (commit
  `2c4faea8`) then moved out of src/ to **`void-reference/`** at repo root —
  the readable source of truth for the rewrite. Extensions/themes/docs/
  python remain overlaid in place. `contrib/safeAppeals/` scaffolded with
  the contribution hub. src/ compiles as vanilla 1.129 + one stub.
- Rung 1 DONE (Jul 17, user-verified): time-tracker compiles via
  `compile-extension:time-tracker` (listed in `build/gulpfile.extensions.ts` +
  `build/npm/dirs.ts`); self-contained `better-sqlite3@12.11.1` runtime dep
  with extension-local `.npmrc` targeting Electron 42.6.0 ABI (bump both
  `.npmrc`s together on Electron upgrades). Timer + DB verified in dev build.
  - Jul 18 fix (web ext host = plain Node ABI 137, not Electron 146):
    DUAL-ABI PATTERN — commit both binaries under `prebuilds/<runtime>-<abi>/`
    and pass `nativeBinding` at Database construction based on
    `process.versions.electron`/`.modules`; Node binary via official
    `prebuild-install`, Electron binary stays default in node_modules.
    Commit `f53bbb4d`. REUSE THIS for RAG sqlite (rung 10). win32-x64 only;
    per-platform prebuilds = packaging, rung 14.
- Rung 2 DONE (Jul 17, user-verified): theme packs load in dev build;
  `workbenchThemeService.ts` defaults = "Safe Appeals Dark Optimized" +
  `safeappeals-icons`. appealsIcons/ + marketing logos regenerated by user.
- Rung 3 DONE (Jul 17, user-verified): product.json identity (data-compat keys
  byte-identical to main), CSS icon swaps marked `/* SafeAppeals */`, dev
  Electron regenerated as `Safe Appeals.exe`. First-run onboarding: new typed
  product field `onboardingSkipSignInStep` filters the Copilot sign-in step;
  welcome/gettingStarted strings rebranded via `product.nameLong`. Chat/
  Copilot infra deliberately UNTOUCHED — decision (Jul 17): we tap upstream
  Copilot/chat agent infrastructure for our own agents; never port the old
  chat-disable patches. Commits `c6a853d8` + `57f42b9c`.
- Rung 4 DONE (Jul 17, user-verified): `safeappeals-calendar` extension —
  Google/Outlook OAuth (loopback 127.0.0.1:47294, PKCE for Outlook) + sync
  engine fully in ext host; tokens in SecretStorage (old workspace
  `.calendar-sync.json` token embedding dropped); zero runtime deps (raw
  REST, no googleapis/MSAL). API for rung 9: commands
  `safeappeals-calendar.{connect,disconnect,syncNow,getEvents,status}`.
  Deferred to later rungs: timeline→calendar push (9), cloud token inject
  (13). No sidebar UI by design. Commit `6996c961`.
- Rung 5a DONE (Jul 17, user-verified "2026 app speed"): `safeappeals-documents`
  scaffold + PDF custom editor (`safeappeals.pdfViewer`, readonly provider) —
  PDFium+Rust WASM rendering (NOT pdf.js; legacy lib kept unused), annotations
  sidecar in workspaceState under old `void.*` keys (no auto-migration from
  workbench storage — rung 14). Perf fix beyond old fork: lazy WASM thumbnails
  (IntersectionObserver + rAF queue + generation teardown) and
  `preloadStrategy: 'adjacent'` instead of eager all-pages rasterization.
  Webview bundled via extension-local esbuild.mjs; bundle committed.
  Commits `5021ec1f` + `40424e4e`.
- Rung 5b DONE (Jul 17, user-verified): DOCX editable custom editor
  (`safeappeals.docxViewer`) — TipTap webview (docx-preview in / `docx` Packer
  out, all in webview, zero ext-host runtime deps); full CustomEditorProvider
  with fresh-serialize-on-save handshake (no stale-byte race), real hot-exit
  backups (old fork's backup was a stub); TipTap-owned undo/redo. Deferred:
  AI bridge (12), PDF export, doc creator. Watch: TipTap v2/v3 pagination
  peer warning. Commit `ed5a4a14`.
- Rung 5c DONE (Jul 17, user-verified) → RUNG 5 COMPLETE: XLSX editable
  custom editor (`safeappeals.xlsxViewer`, *.xlsx + *.xls) — Rust WASM engine
  kept (binaries copied unrebuilt; Rust source stays in void-reference until
  a home is picked pre-deletion), full ribbon/dialog/chart/pivot surface,
  DOCX-pattern save handshake; old 500ms auto-write dropped in favor of
  standard dirty/save. Known limits (pre-existing): weak .xls path, chart/
  pivot writer round-trip, full model in JS memory. Image viewer NOT ported
  (upstream media preview). Commit `41cf7077`.
- Web/code-server fixes (Jul 18, user-verified live): two server↔browser
  product-config mismatches, NOT extension bugs. (1) Webviews loaded their
  host frame from upstream's pinned CDN (`webviewContentExternalBaseUrlTemplate`
  in product.json) whose service worker protocol (v4) mismatched this fork
  (v5) → all webview CSS/JS silently failed (viewers opened unstyled). Fix:
  server hosts the `pre/` webview frame itself on per-webview `{{uuid}}.`
  subdomains; removed the CDN pin. (2) Browser fell back to `oss-dev` while
  server served `/stable-dev/` → icon-theme/remote-resource 404s. Fix:
  `webClientServer.ts` sends `quality`+`commit` to the browser. Token
  exemption for `pre/` hardened against encoded path traversal
  (decode+normalize+reject `..`/`\`). Commits `67adb730` + `b5521c84`.
  Touched core server files (`webClientServer.ts`,
  `remoteExtensionHostAgentServer.ts`) — RE-VERIFY at packaging (rung 14):
  built server sets real quality/commit so the CDN-vs-self-host path differs
  from dev. Desktop Electron unaffected (own `vscode-webview://` scheme).
  Note: `safeappeals-documents` is `extensionKind: ["workspace"]` (main-only),
  so pure `code-web`/test-web can't run it; needs code-server mode.
- `feat-blog-writer-extension` only for Growth Writer (deferred).
- Residual untracked files on disk (`python/` extras,
  `void-cloud/`, `resources/ffmpeg|models`, `.env`, workspace file) — wipe
  `contrib/void` residue before overlay; the rest are non-build assets.

## Strategy

1.95-era Void built parallel AI stacks because core had none. 1.129 core ships
chat + agent mode + chat editing + inline chat + inline completions + tool
calling + MCP + integrated browser, all usable without Copilot. Therefore:
**adopt upstream infra via registration APIs; port only the legal product;
keep upstream files untouched except a tiny marked hookpoint set.**

Architecture rules (settled):

- **Naming settled (Jul 17): the contrib is `src/vs/workbench/contrib/safeAppeals/`**
  — "void" is removed from all NEW code (folder, service names, channel
  names, action IDs where practical). EXCEPTION: persisted storage keys and
  settings keys keep their old `void*` values so user data survives; alias
  table lives with `storageKeys.ts` when migrated.
- **Old code lives at root in `void-reference/`** (moved out of src/ so
  vanilla compiles stay clean; committed for readability during migration —
  read it directly, not via `git show`). Deleted at the end of Phase 6.
- **Migration = rewrite, not copy**: each feature is written fresh under
  `contrib/safeAppeals/` against 1.129 APIs using `void-reference/` as the
  source of logic; import paths, naming, and API usage are corrected on the
  way in. Entry hub: `safeAppeals/browser/safeAppeals.contribution.ts`
  (already scaffolded with commented imports per phase).
- No new logic in upstream files.
- New thin `contrib/void/browser/integration/` layer is the ONLY place
  coupled to upstream chat APIs (provider, agent, completions, tools).
- Rule of thumb: renders a document → extension candidate; orchestrates
  workbench/agent state → contrib.
- Do not convert viewers to extensions during the migration (two variables at
  once); that is Phase 7.

---

## A. Upstream 1.129 capabilities we adopt (hook points)

| Capability                  | Hook                                                                                                                                                                   |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LLM providers               | `ILanguageModelsService.registerLanguageModelProvider('safeAppeals', provider)` — in-process, no extension (`contrib/chat/common/languageModels.ts`)                   |
| Chat agent (panel + inline) | `IChatAgentService.registerDynamicAgent`, `isDefault: true`, locations `[Panel, EditorInline]` — EditorInline default agent un-gates inline chat (`InlineChatEnabler`) |
| Agentic edits / diff review | `IChatEditingSession` (agent emits `textEditGroup` progress; accept/reject per hunk) — replaces DiffZones                                                              |
| Autocomplete + NES          | `ILanguageFeaturesService.inlineCompletionsProvider.register('*', p)`; `isInlineEdit: true`                                                                            |
| Tool calling                | `ILanguageModelToolsService.registerTool` (+ confirmation service)                                                                                                     |
| MCP                         | `contrib/mcp` full client (stdio+HTTP/SSE, OAuth, trust, `.mcp.json`/Claude discovery); servers run in extension host                                                  |
| Integrated browser          | `contrib/browserView` (`WebContentsView`, `persist:vscode-browser`, Playwright/CDP agent tools)                                                                        |
| Chat persistence            | `ChatSessionStore` (workspace/global)                                                                                                                                  |
| Copilot residue             | `product.json` `defaultChatAgent` blanked; `IChatEntitlementService` chrome hidden via product config; skip Copilot MCP setup commands                                 |

---

## B. Disposition: REPLACE with upstream (delete from port set)

| Void system                                                                                  | Replaced by                                                      | Data/UX migration                                                        |
| -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| React chat sidebar (`sidebarPane`, `sidebarActions`, `react/sidebar-tsx`)                    | native `ChatViewPane`                                            | UX change: native widget, not Tailwind                                   |
| `chatThreadService` + `void-channel-chat-threads` storage                                    | `ChatSessionStore`                                               | Phase 6 thread import shim                                               |
| `editCodeService` (+ types, `react/diff`, `void-editor-widgets-tsx`)                         | `IChatEditingSession`                                            | none                                                                     |
| `cloudLLMRouterService`                                                                      | model picker + `isDefaultForLocation` (see C.1)                  | routing becomes explicit model choice                                    |
| `quickEditActions` (Cmd+K) + `react/quick-edit-tsx`                                          | `contrib/inlineChat` (Cmd+I)                                     | optional keybinding remap Cmd+K→`inlineChat.start`                       |
| `autocompleteService`                                                                        | inlineCompletions provider (Phase 2 registers ours)              | none                                                                     |
| `browser/tools` + `electron-main/tools` + `common/tools`                                     | `ILanguageModelToolsService` (re-register in Phase 2)            | tool confirmations now upstream UI                                       |
| `common/mcpService` + `mcpChannel` + `void-channel-mcp`                                      | `contrib/mcp`                                                    | Phase 6 config migration; servers move electron-main → ext host          |
| `browserPanel` + `browserPanelChannel` + `void-channel-browser-panel`                        | `contrib/browserView`                                            | drop `persist:void-browser-v2` app.ts exemptions; cookies/sessions reset |
| `webSearchActions`                                                                           | chat tool entry                                                  | Brave backend kept (see C)                                               |
| `voidCommandBarService`, `voidSelectionHelperWidget`, `tooltipService`, `react/void-tooltip` | retired Void-chat UX glue                                        | delete                                                                   |
| `voidOnboardingService` + `react/void-onboarding`                                            | upstream `welcomeOnboarding` / `welcomeAgentSessions`            | re-add safeAppeals onboarding content later if needed                    |
| `contextGatheringService` (as standalone)                                                    | folded into agent impl + upstream `IPromptsService` instructions | —                                                                        |

## C. Disposition: BOLT-ON layer (new code, small; wraps kept pipeline)

### C.1 Provider decision (settled Jul 17): two vendors, one pipeline, no router

How upstream works (1.129): vendor descriptor via
`deltaLanguageModelChatProviderDescriptors` THEN
`registerLanguageModelProvider(vendor, provider)` (order mandatory).
Provider = 3 methods: `provideLanguageModelChatInfo` (model list + metadata),
`sendChatRequest` (AsyncIterable of `text`/`tool_use`/`thinking`/`data`
parts), `provideTokenCount`. Picker groups by vendor; default via
`isDefaultForLocation` / `chat.defaultModel`. BYOK config: vendor
`configuration` schema → groups in `chatLanguageModels.json`, secrets in
`ISecretStorageService` (`chat.lm.secret.*`), injected back into
`provideLanguageModelChatInfo({ group, configuration })`. Auth/quota are NOT
coupled (Copilot chrome is separate); providers get `metadata.auth`,
`statusIcon`, `warningText`, pricing display fields only.

Decision:

- **Vendor `safeAppeals-cloud`** ("safeAppeals Cloud"): managed models,
  credits. Model list fetched from cloud API (new `/models` endpoint — makes
  server the single source of truth; deletes the 3-way drift between
  `defaults.ts`, `cloudModelMapping`, `litellm/config.yaml`). Metadata:
  pricing multiplier display, `statusIcon`+`warningText` on low credits,
  `metadata.auth` → existing `safeAppeals-cloud` IAuthenticationService
  provider (ports as-is), `isDefaultForLocation` set when signed in.
- **Vendor `safeAppeals-byok`** ("Your API Keys"): wraps the 17 provider SDK
  impls in `electron-main/llmMessage`. Local providers (ollama/vLLM/
  lmStudio) keep auto-detect listing.
- **`cloudLLMRouterService` is DELETED** — the model picker IS the router.
  Cloud-vs-BYOK becomes an explicit, visible model choice; no hidden
  fallback. (Old "smart fallback" ≈ cloud models default when signed in.)
- **Cloud becomes the 18th impl in `sendLLMMessage.impl.ts`** (electron-main)
  instead of a browser fetch: inherits streaming, abort, rate limiter; kills
  CORS problem (and the blog-branch `cloud-proxy` channel becomes moot).
- **Adapter**: one shared class maps IPC stream events
  (`onText`/`onFinalMessage`/`toolCall`) → upstream response parts, incl.
  native `tool_use` (no more ANTML-XML-in-text parsing for cloud).

**Server prerequisite (void-cloud API, before Phase 2 completes):**
`/llm/chat` upgraded to SSE streaming + native OpenAI `tool_calls`
passthrough (LiteLLM supports both already; the XML hack existed only for
Void's old XML agent loop), plus new `/models` endpoint (id, display name,
context window, credit multiplier). Non-streaming fallback kept for old
clients during transition.

Key-storage: Phase 2 reads keys from ported `voidSettingsService`
(encrypted, keys unchanged); Phase 6 migrates to upstream secret storage +
Manage Models UI and deletes most of the settings React UI.

### C.2 Tool-calling decision (settled Jul 17): native-only, core infra, loop stays ours

How upstream works (1.129): **core does NOT run the agentic loop.** Core
provides the tool registry (`IToolData`/`IToolImpl`,
`ILanguageModelToolsService.registerTool`/`invokeTool`), the entire
confirmation/approval system (per-tool/workspace/profile allowlists,
`chat.tools.global.autoApprove`, `chat.tools.edits.autoApprove`, request
`permissionLevel`), MCP tools auto-registered into the same registry, the
tool picker (→ `IChatAgentRequest.userSelectedTools`), and built-in tools
(`vscode_editFile_internal` → chat editing session, todos, fetch, subagent,
askQuestions, full terminal suite in `terminalContrib/chatAgentTools`). The
`IChatAgentImplementation.invoke` must: pass enabled tools to
`sendChatRequest`, react to `tool_use` parts by calling `invokeTool`, append
`tool_result` messages, repeat until done.

Void today (from `main`): 34 builtin tools; loop in
`chatThreadService._runChatAgent` (while-loop, 4 approval categories,
interrupt/re-entry on approval); HYBRID tool-call transport — native
adapters (anthropic/openai) for capable providers, ANTML-XML-in-prompt +
streaming XML parser (`extractGrammar` 460 + `xmlParserService` 558 +
`toolRouter` 95 + `parallelToolOptimizer` 425 LOC) for the rest.

Decisions:

1. **Drop the XML tool path entirely.** Native tool calling only. Providers
   whose models can't do native tools get `capabilities.toolCalling: false`
   (no agent mode for them) instead of an XML fallback. Deletes ~1,950 LOC
   of parser/router/optimizer plumbing.
2. **The native adapters survive but move**: their SDK-response → tool-call
   translation becomes part of each provider impl feeding `tool_use` parts
   (they are the provider's job now, not a router's).
3. **Generic tools are deleted, not ported**: read_file/ls_dir/dir_tree/
   search×3/lint, rewrite/edit/create/delete file, run_command + persistent
   terminal ×3 → upstream built-ins + terminal agent tools cover all of it.
4. **safeAppeals-specific tools re-register as `IToolData`/`IToolImpl`**
   (~1,500 LOC of impls kept): RAG ×5, timeline ×6, `edit_document`
   (docx/xlsx structured ops), `web_search`/`multi_link_search` (Brave via
   channel).
5. **Approval system replaced**: 4 Void categories → upstream confirmation
   service + auto-approve settings; `edit_document` + terminal set
   `confirmationMessages` in `prepareToolInvocation`.
6. **Mode-based tool filtering** (research vs case_manager) → custom chat
   modes + tool picker `userSelectedTools`, not hardcoded lists.
7. **The agent loop is rewritten small** inside `safeAppealsChatAgent.ts`:
   with parsing/approval/schema-injection gone it shrinks from ~1,000 LOC to
   a few hundred (send with tools → invokeTool on `tool_use` → append →
   repeat; emit `textEditGroup` progress for edits so chat editing renders).

Net payoff: ~5,500–6,500 LOC of custom tool plumbing deleted; kept surface =
domain tool impls + a small loop.

### C.3 Integration layer files

New `contrib/void/browser/integration/`:

| New file (indicative)                | Registers                                                                                             | Backed by (kept, ported as-is)                                                                                                                            |
| ------------------------------------ | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `safeAppealsLMProviders.ts`          | vendors `safeAppeals-cloud` + `safeAppeals-byok` (C.1)                                                | `sendLLMMessageService` + `llmMessage/` channel + 17 SDK impls + new cloud impl; `modelCapabilities`, `refreshModelService`, `convertToLLMMessageService` |
| `safeAppealsChatAgent.ts`            | default dynamic agent, Panel + EditorInline; OWNS the agentic loop (C.2 #7)                           | `common/prompt` system prompts (minus XML tool sections); context assembly (ex-`contextGatheringService`)                                                 |
| `safeAppealsCompletions.ts`          | `InlineCompletionsProvider` (ghost text; NES later)                                                   | same LM pipeline (FIM prompts from old `autocompleteService`)                                                                                             |
| `safeAppealsTools.ts`                | LM tools: RAG search, case-profile lookup, doc extract, Brave web search, email query, timeline query | RAG/email/etc. services in contrib; `braveSearchChannel`                                                                                                  |
| `safeAppealsChatModes.ts` (optional) | custom chat modes (legal research / drafting)                                                         | `IChatModeService`                                                                                                                                        |

Gotchas from the 1.129 contract: provider owns `identifier` strings
(`vendor:modelId`); fire `onDidChange` after model refresh; set
`capabilities.toolCalling: true` for agent mode; register vendor descriptor
before provider or registration throws.

`voidSCMService` (commit messages): keep service; re-point its action at
upstream git contrib UI; low priority.

## D. Disposition: PORT AS-IS into contrib/void (the product)

Browser/common/electron-main triads, with their channels (see G):

- Document pipeline: `documentViewers/`, `documentCreatorService`,
  `documentFileCreation.contribution`, `common/documentViewerService`,
  extractor/creator channels (pdf/docx/xlsx), `documentExportChannel`,
  `webpack.docx.config.cjs` (build input for DOCX viewer worker)
- RAG: `browser/rag`, `common/rag`, `electron-main/rag`, `RAGPathService`,
  `RAGMainService` (native deps: sqlite/embeddings — Phase 5 risk)
- Email: `emailDashboard/`, `emailViewers/`, `emailService/Thread/Draft`,
  `emailClassifier`, `electron-main/email` + `emailMainChannel`
- Case: `caseInfo/`, `common/caseProfileService`, `timeline/` (browser +
  common) + `timelineExportChannel` — name-collision note: upstream
  `contrib/timeline` = file history; keep Void IDs distinct
- Calendar: `calendar/` + calendar channel (Google sync)
- ~~DocuSign~~ — DROPPED (see D.2); `devAuthServer` is cloud dev-auth, moves
  with Cloud below
- Files: `fileOrganizer/` + `fileOrgContextService`, `fileConverter/` +
  `fileConverterChannel`, `browser/fileService`
- Audio: `audioRecorder/` (browser/common/electron-main) — evaluate vs
  upstream `speech`/`agentsVoice` AFTER migration; port first
- Cloud: `voidCloudService/AuthProvider/UrlHandler/Actions` (URL handler
  rewritten WITHOUT DocuSign OAuth branches), `common/voidCloudTypes`,
  `devAuthServer`, `rateLimiter`, metrics
  (`metricsService/PollService/MainService`), update
  (`voidUpdateService/MainService`, `voidUpdateActions`)
- Settings: `voidSettingsService` + `voidSettingsPane` + `react/void-settings-tsx`
  — SLIM: keep provider API keys + cloud account; model-picker duties move to
  upstream `languageModelsConfiguration`
- Support plumbing: `voidModelService`, `directoryStrService`,
  `helperServices/`, `helpers/`, `storageKeys`, `actionIDs`,
  `extensionTransferService/Types`, `convertToLLMMessageWorkbenchContrib`,
  `miscWokrbenchContrib`, `_markerCheckService` (audit), `voidExtensionApi`
  (audit — external API surface)

React entries kept (rebuild via tsup, unchanged pipeline):
`file-organizer-tsx`, `case-info-dashboard-tsx`, `file-converter-tsx`,
`timeline-tsx`, `email-dashboard-tsx`, `audio-recorder-tsx`, viewers' UIs,
`void-settings-tsx` (slimmed). Deleted entries: `sidebar-tsx`, `diff`,
`quick-edit-tsx`, `void-tooltip`, `void-onboarding`, `void-editor-widgets-tsx`.

## D.2 Extension split (settled Jul 17): write in final home, no two-step

Because migration = rewrite-from-scratch, features are written ONCE in their
final location (the old "contrib first, extension-ize in Phase 7" two-step
is dropped). Extensions are first-class with the agent: `lm.registerTool`
feeds the same tool registry, `vscode.lm` consumes our registered models,
custom editors get the 1.129 custom-editor diff API, extensions register
auth providers/URI handlers.

**Written as NEW extensions (Phase 3):**
- `safeappeals-documents` — PDF/DOCX/XLSX custom editors + `edit_document`
  + extract LM tools in the same extension (agent reads/edits docs through
  it); creator/export commands
- `safeappeals-calendar` — background sync + settings
- `safeappeals-email` — IMAP/SMTP in ext host, webview dashboard,
  classifier via `vscode.lm`; case links via commands

**DROPPED from migration (Jul 17): DocuSign** — no partnership agreement,
can't ship their integration until their requirements are met. Do NOT
migrate `docuSign/` (browser/common), `docuSignChannel`,
`docusign-esign.d.ts`, or the DocuSign OAuth handling inside the cloud URL
handler (strip it during the cloud rewrite). Code remains in
`void-reference/` if partnership lands later; would return as a
`safeappeals-docusign` extension.

**Stay in contrib (reasons):** integration layer (in-process registries),
cloud auth/credits/update/metrics (LM provider consumes session
synchronously), case profiles (shared-state hub), file organizer (explorer
tree core hook) + file converter, timeline (case coupling — revisit),
RAG (watchers + native deps + agent tools; OPTION: later re-shape as local
MCP server wrapping the python backend), settings pane, audio recorder
(mic/whisper/ffmpeg — defer).

Phase 7 is repurposed: no viewer conversion needed; becomes "revisit
timeline/RAG-as-MCP/audio placement after the dust settles."

## E. Disposition: EXTENSIONS (copy into extensions/, already extension-shaped)

- ~50 `theme-safeAppeals*` theme extensions + `theme-scripts` +
  `color-themes-product-json-entries.txt` (merge entries into new
  product.json)
- `time-tracker`
- `open-remote-ssh`, `open-remote-wsl` (verify against upstream 1.129 remote
  changes — may be obsolete or need updates)
- Extension build glue on main: `extensions/bun.lock`,
  `esbuild-webview-common.js`, `mangle-loader.js`,
  `shared.webpack.config.js` — reconcile with 1.129's extension build (do
  NOT blind-copy; upstream build moved on)

## F. Root-level / non-src assets

| Asset (main)                                                                         | Disposition                                                                                            |
| ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `void-cloud/` (Next.js dashboard)                                                    | untouched separate app; keep out of vscode build; stays untracked or its own repo eventually           |
| `python/`, `pyproject.toml`, `uv.lock`                                               | RAG/audio backend tooling — port with RAG (verify usage first)                                         |
| `resources/ffmpeg`, `resources/models` (whisper)                                     | ship-with assets for audio — port with audioRecorder; wire into build packaging                        |
| `void_icons/`, icon CSS swaps                                                        | rebrand assets — Phase 1 (re-do the 6 CSS `// Void` icon edits)                                        |
| `docs/`, `*.md` guides (VOID*CLOUD*\*, PROJECT_MODIFICATIONS, etc.)                  | copy docs/ wholesale; root md files prune to relevant                                                  |
| `gulpfile.js` (main) vs `gulpfile.mjs` (1.129)                                       | build system moved to ESM — REDO buildreact + packaging integration in new build files, don't copy old |
| `bun.lock`, package.json scripts                                                     | re-add `buildreact`/`watchreact` + fork deps to 1.129 package.json; regenerate lock                    |
| `.voidrules`, `.cursor/`, `.claude/`, `CLAUDE.md`, `tasks.md`                        | dev-tooling; copy as needed, untracked ok                                                              |
| `build/win32/tools/`, `.configurations`, `convert-key.cjs`, `test-sharp-electron.js` | audit individually during Phase 5 (packaging/native-module helpers)                                    |

## G. app.ts channels — reduced set (was 20)

KEEP: `llmMessage`, `rag`, `file-converter`, `brave-search`,
`timeline-export`, `audio-recorder`, `metrics`, `update`, `scm` (audit:
metrics/update/scm may slim later).

DROP: `mcp` (upstream), `browser-panel` (upstream), `chat-threads` (upstream
persistence; keep read-only access for Phase 6 import), `docusign` (feature
dropped, D.2).

MOVED TO EXT HOST via D.2 extensions (no app.ts channel needed): `calendar`,
`email`, `document-export`, `docx-creator`, and in principle the extractors
(`pdf-extractor`, `docx-extractor`, `xlsx-extractor`) — OPEN DESIGN POINT
(Phase 3): RAG's main-process indexer also consumes extraction. Either keep
extractor channels alive for RAG (extension does its own extraction in ext
host; some duplication) or move extraction fully to the documents extension
and let RAG request it via command/tool bridge. Decide when RAG is
rewritten.

DEFER: `cloud-proxy`, `growth-writer` (exist only on
`feat-blog-writer-extension`; decide after that branch lands).

## H. Core-file edits outside contrib (old ~25 marked files — new verdicts)

RE-APPLY (still wanted):

- `workbench.common.main.ts` — the one import line
- `app.ts` — reduced channel block (G)
- `keybindingsRegistry.ts` — `VoidExtension = 605` weight
- `telemetryService.ts` — telemetry removal
- `encryptionMainService.ts` — Linux default provider
- `workbenchThemeService.ts` — default theme = safeAppeals theme
- `auxiliaryBarPart.ts` + `layout.ts` — aux bar min width / default size
  (verify still sensible with native chat in panel)
- CSS icon swaps (6 files) + `product.ts` `release` field
- `editorGroupWatermark.ts` — watermark actions (update action IDs)
- `fileActions.contribution.ts` — settings entry hook (or retire if native
  settings suffice)
- `explorerViewer.ts` — file-organizer tree hook (verify against 1.129
  explorer changes)

OBSOLETE (do NOT re-apply):

- All chat-disable patches (`chatActions.ts`, `chatParticipant.contribution.ts`
  comment-outs, `workbench.common.main.ts` chat region edits) — we now USE
  upstream chat; suppression happens via product.json `defaultChatAgent`
- `smartSelect.ts`, `lineSelection.ts`, `editorOptions.ts` keybinding/setting
  tweaks — re-evaluate individually; default: drop, reintroduce on demand
- `workbench.contribution.ts` "Void Side Bar" localization strings — native
  chat lives in standard panels now

## I. Data / config migrations (Phase 6)

| Data               | From                                            | To                                                                                                                                                 |
| ------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chat threads       | `void-channel-chat-threads` store               | `ChatSessionStore` import shim (one-time)                                                                                                          |
| MCP servers        | voidSettings JSON                               | `.mcp.json` (workspace) / user MCP config                                                                                                          |
| Provider API keys  | `voidSettingsService` encrypted blob            | `ISecretStorageService` (`chat.lm.secret.*`) + `chatLanguageModels.json` groups via one-time importer; then delete key mgmt from settings React UI |
| Cloud model list   | `defaults.ts` + `cloudModelMapping` (hardcoded) | cloud API `/models` endpoint (server = source of truth)                                                                                            |
| Cloud session/auth | `void.cloud.session` in IStorageService         | unchanged (auth provider ports as-is); consider moving token to secret storage while at it                                                         |
| Browser sessions   | `persist:void-browser-v2`                       | `persist:vscode-browser` (accept cookie loss)                                                                                                      |
| Keybindings        | Cmd+K quick edit                                | map to `inlineChat.start` in defaults                                                                                                              |

## J. Execution ladder — one feature at a time (settled Jul 17)

Working rule: **a feature is not "done" until it runs properly in the dev
build; only then start the next one.** Each rung carries its own wiring
(its channel, its build step, its contribution/extension registration, its
core-hook edits) — there is no big-bang integration phase. Order is
easiest-first to rebuild familiarity (extensions before contrib, contrib
before cloud/agents). Native-dependency features are deliberately late.

Ladder (start at 1):

1. **`time-tracker` extension** — already extension-shaped; make it build +
   load on 1.129. Smallest possible win; teaches the 1.129 extension build.
   DONE: appears in extensions view, tracks time in dev build.
2. **Themes** — `theme-safeappeals*` + product.json theme entries
   (`color-themes-product-json-entries.txt`) + default-theme core edit
   (`workbenchThemeService.ts`). DONE: SafeAppeals theme is the default,
   all packs selectable.
3. **Branding pass (mini Phase 1)** — product.json identity, `appealsIcons/`
   swaps (6 CSS files + build icons), blank `defaultChatAgent` (hides
   Copilot chrome; native chat stays empty-but-present for now).
   DONE: dev build launches as Safe Appeals with no Copilot nags.
4. **`safeappeals-calendar` extension (NEW)** — first from-scratch
   extension; Google OAuth + background sync + settings. Small surface,
   establishes the new-extension template (esbuild, package.json contribs).
   DONE: connects, syncs, settings work.
5. **`safeappeals-documents` extension (NEW)** — the big product piece:
   PDF/DOCX/XLSX custom editors (webviews, React inside the webview — no
   scope-tailwind needed), creator/export commands. LM tools included but
   inert until rung 12. DONE: all three formats open/render/save; Open With
   works.
6. **`safeappeals-email` extension (NEW)** — IMAP/SMTP, dashboard webview,
   threads/drafts. Classifier SKIPPED until rung 12 (needs LM). DONE: send/
   receive/dashboard against a real account.
7. **Contrib foundation + settings** — `safeappealsSettings` service
   (slimmed voidSettings; keys keep `void*` values), storage keys, action
   IDs, helper services; first workbench.common.main.ts hub activation.
   DONE: settings pane opens, values persist across restart.
8. **File organizer + converter (contrib)** — includes `explorerViewer.ts`
   core hook (first core-file edit) + `file-converter` channel (first
   app.ts channel, establishes the channel-wiring pattern). DONE: organizer
   view + conversions work.
9. **Timeline + case info (contrib)** — first contrib React UIs: wire
   `buildreact` (tsup/scope-tailwind) into the ESM build here, not earlier.
   + `timeline-export` channel. DONE: case dashboard + timeline render,
   export produces PDF.
10. **RAG (contrib)** — native sqlite/embeddings + python backend +
    extractor decision (G open point) + `rag` channel. First native-ABI
    exposure on Electron ~42. DONE: index a case folder, search returns
    results.
11. **Audio recorder (contrib)** — ffmpeg/whisper natives, `audio-recorder`
    channel. DONE: record → transcript.
12. **AI integration layer (contrib) — BYOK first** — `llmMessage` channel +
    SDK impls; `safeappealsLMProviders` (BYOK vendor), `safeappealsChatAgent`
    (loop, C.2), `safeappealsCompletions`, `safeappealsTools` (RAG/timeline/
    doc/web tools now go live; email classifier unblocked). DONE: Phase-2
    gate minus cloud — chat answers via BYOK, inline chat, ghost text,
    native tool call end-to-end.
13. **Cloud (contrib + server)** — auth provider/URL handler (no DocuSign),
    credits, metrics/update; server work (SSE, native tool_calls, `/models`)
    can run in parallel any time after rung 4; cloud vendor + 18th impl land
    here. DONE: sign in, cloud models in picker, streamed cloud chat with
    credits decrementing.
14. **Data migrations (I)** + packaging/CI (`build-release.yml`), remaining
    H re-applies (watermark, keybinding weight, telemetry, encryption),
    `open-remote-*` verdict. DONE: packaged Windows build, old user data
    migrates.
15. **Placement review (old Phase 7)** — timeline → extension?, RAG → local
    MCP server?, audio → speech?; delete `void-reference/`.

Parallelism notes: the void-cloud server upgrade (rung 13's prerequisite)
is a separate deployable — start it whenever convenient. Rungs 4–6 are
independent of each other if a break from one is needed, but finish each
before starting the next per the working rule.

## K. Risks

| Risk                                                                                                                                 | Mitigation                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Electron 34→~42 native ABI (sqlite, whisper, sharp, WASM loaders)                                                                    | Phase 5 isolated; known-highest risk; budget accordingly                                                                                                       |
| Upstream chat API churn (not yet `vscode.d.ts`-stable in-process)                                                                    | all coupling confined to `integration/`; small surface                                                                                                         |
| ESM build (`gulpfile.mjs`) vs old gulpfile.js glue                                                                                   | rewrite glue, don't port                                                                                                                                       |
| Thread/MCP/config migration bugs                                                                                                     | one-time importers with dry-run logging; keep old stores read-only                                                                                             |
| `open-remote-*` vs 1.129 remote stack                                                                                                | verify early in Phase 1; drop if upstream superseded                                                                                                           |
| Cloud server upgrade (SSE + native tool_calls) breaks old 1.95 clients                                                               | keep non-streaming XML endpoint alive during transition; version via `X-Client-Version`                                                                        |
| No upstream quota UI for credits                                                                                                     | pricing display fields + `statusIcon`/`warningText` low-credit signal + dashboard for purchase; custom credit UI in contrib only if needed later               |
| Dropping XML tool fallback removes agent mode for non-native-tool models (fork marked ollama/vLLM/lmStudio/deepseek/xAI as XML-only) | acceptable: chat still works (`toolCalling: false`); re-audit capability flags first — deepseek/xAI/ollama gained native tools since 1.95-era code was written |
| UX regressions (native chat vs Tailwind sidebar; Cmd+I vs Cmd+K)                                                                     | accept + keybinding remap; revisit theming via chat CSS vars                                                                                                   |

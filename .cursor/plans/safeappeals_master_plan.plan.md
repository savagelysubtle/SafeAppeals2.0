---
name: SafeAppeals Master Plan — Single Entry Point
overview:
  "THE entry point for the SafeAppeals 2.0 migration (fork of VS Code 1.129,
  branch update-vscode, migrating off the 1.95-era Void fork via
  void-reference/ rewrite-not-copy). This plan owns the single ordered
  execution sequence from here to shipping and DELEGATES to the five
  surviving sub-plans by reference — it states what each step is, why it
  exists, its order and dependencies, then points at the sub-plan for
  detail. Steps with no sub-plan carry their detail here. Also records the
  Jul 29 2026 ground-truth audit of what is actually built (trust it over
  docs/ADDED_FEATURES_TRACKER.md, which is stale), resolves the
  contrib-vs-extension contradiction (the contrib hub is dead), and flags
  four undecided items for user confirmation."
todos:
  - id: done-foundation
    content: "DONE (Jul 17, user-verified): import 1.129.0 (65015a05), Phase 0
      overlay + void-reference/ move, rung 1 time-tracker, rung 2 themes,
      rung 3 branding. Detail: merge plan 'Earlier status (Jul 17)'."
    status: completed
  - id: done-product-extensions
    content: "DONE (Jul 20–21, user-verified): rung 4 safeappeals-calendar
      (backend only, no UI by design), rung 5a/5b/5c safeappeals-documents
      (PDF read-only / DOCX / XLSX editors), rung 6 safeappeals-email +
      6.6 case links + 6.7 tags + 6.8 settings/CC/BCC/.safeAppeals rename.
      All verified on Electron AND web/code-server. Detail: merge plan
      'Status (Jul 20)' + commit trail."
    status: completed
  - id: done-rung7-slice1
    content: "DONE (567beff7): rung 7 slices 1+1b — safeappeals-case commands
      (setupProfile/initCase/editCaseInfo/openCaseBrief), walkthrough,
      case-setup chat skill, AGENTS.md managed block + .safeAppeals/case.json.
      Slice 1b since superseded by onboarding T4/T10. Detail:
      safeappeals_case_extension_rung7.plan.md."
    status: completed
  - id: m0-tracker-and-hub
    content: "DONE (uncommitted, Jul 29): all four parts landed and reviewed —
      tracker rewritten as a status index, dead contrib hub stub deleted,
      dropped-feature DOCX ribbon buttons (Export PDF + Send for Signature)
      removed from provider/vendor/bundle, and safeappeals-email.updateThreadStatus
      contributed. Note: rebuilding the DOCX bundle also regenerated
      media/pdf/pdfRustViewer.js from an esbuild version difference — that
      unrelated churn was reverted, so only docxEditor.js is intentionally
      rebuilt. Original scope: rewrite
      docs/ADDED_FEATURES_TRACKER.md as a status INDEX pointing at this plan
      (Status/Location/Wired?/Plan-link columns, split Timeline from Calendar
      sync, current paths, demote void-reference-only features) + delete the
      dead contrib hub stub safeappeals.contribution.ts + two cheap
      user-visible fixes: remove the dead DOCX ribbon buttons advertising
      dropped/deferred features (e-Signature = dropped DocuSign) and add the
      implemented-but-uncontributed safeappeals-email.updateThreadStatus to
      package.json. Detail: §M0 below."
    status: completed
  - id: m1-onboarding-phase-a
    content: "M1 ACTIVE: onboarding redesign Phase 0 + Phase A (T0 void-cloud
      PKCE/security fixes → T1 safeappeals-authentication extension +
      safeappeals-cloud provider; T2–T12 wizard rebuild, approval-default
      flip, walkthrough→checklist, sample case + tour). Plan:
      onboarding_redesign_newcomer.plan.md.
      STATUS Jul 30 end-of-session (committed): DONE = T0, T1, T2, T3, T4,
      T5, T6, T7, T8, T10, T11, T12, all reviewed. REMAINING = T9 only,
      which now also carries five deferred T5 review items folded into its
      task entry (translator comment on the fabricated citation, inline-link
      CSS, approval-card radius, empty feature-card div, updateValue error
      logging).       Gates green at commit time: typecheck-client,
      compile-extensions (0 errors), valid-layers-check, and all 9
      onboarding unit tests.
      Two things the next session must know: (a) run the unit tests as
      `env -u ELECTRON_RUN_AS_NODE VSCODE_SKIP_PRELAUNCH=1 ./scripts/test.sh
      --grep onboarding` AND outside the agent sandbox. The runner needs the
      real Electron binary (an inherited ELECTRON_RUN_AS_NODE makes it start
      as plain Node and die on `app.setPath`) and needs the X socket, which
      the sandbox blocks — the resulting "Missing X server or $DISPLAY"
      segfault looks like a missing display but the machine does have one at
      :0. Running bare mocha instead silently skips the browser-layer suites
      and undercounts 9 as 6; if you do need it, `--ui tdd` is required.
      (b) T9 edits browser/onboardingVariationA.ts, so nothing else may edit
      that file concurrently — earlier concurrent edits caused
      noUnusedLocals churn.
      Phase A must not ship partially: sign-in has never been exercised
      end-to-end against a live API, which is the milestone's biggest gap."
    status: in_progress
  - id: m2-onboarding-phase-b
    content: "M2 (deps: M1): onboarding Phase B — T13 cloud LLM provider over
      POST /llm/chat (carved from rung 13) then T14 BREAKING product.json
      Copilot removal (carved from rung 11). After this the app runs on
      SafeAppeals Cloud inference. Plan: onboarding_redesign_newcomer.plan.md
      §9 Phase B."
    status: pending
  - id: r7-timeline
    content: "Rung 7 slice 2 (deps: M1 ships — same-extension collision with
      T10/T12, deferred Jul 29): timeline + deadlines in safeappeals-case —
      statute deadline calc from old jurisdictionConfig, notifications, PDF
      export decision; doubles as the missing calendar UI (reads the
      calendar extension's getEvents commands). Resolve jurisdiction-ID
      slug-vs-display-name mismatch first. SCOPE QUESTION (Q5): calendar sync
      is pull-only — if deadlines should push to the user's real calendar,
      write-back must be built. Plan:
      safeappeals_case_extension_rung7.plan.md."
    status: pending
  - id: r8-organizer
    content: "Rung 8 (deps: r7 for case.json consumers): NEW
      safeappeals-organizer extension — file organizer/docket (explorer
      context menus + FileDecorationProvider + webview wizard, NO core
      explorerViewer.ts hook) + file converter as Rust sidecar rust/converter
      (bin sa-converter), retiring python/. Detail: merge plan rung 8 +
      'Rust strategy' section."
    status: pending
  - id: r9-audio
    content: "Rung 9: NEW safeappeals-audio extension — recorder + whisper
      transcription + ffmpeg assets. Detail: merge plan rung 9; evaluate vs
      upstream speech AFTER it works."
    status: pending
  - id: r10-rag
    content: "Rung 10: NEW safeappeals-rag extension, WRITTEN IN RUST
      (decision Jul 29, no TS-first): rust/rag-core napi-rs module —
      fastembed embeddings, usearch HNSW, tantivy BM25, RRF fusion; dual-ABI
      pattern from time-tracker. Advanced RAG scope mandatory (hybrid
      retriever + query processor + reranker). Detail: merge plan 'Rust
      strategy' + gap-audit item 5."
    status: pending
  - id: r65-auth-remainder
    content: "Rung 6.5 remainder (deps: M1 T1 shipped the extension shell):
      safeappeals-google/-microsoft provider-token providers, calendar
      getSession() conversion (delete oauthLoopback/tokenStore), email
      XOAUTH2 (app-password fallback stays), server scopes/Azure/
      provider-token-refresh + Google restricted-scope verification. Plan:
      unified_safeappeals_sign-in_225af75a.plan.md."
    status: pending
  - id: r11-agent-remainder
    content: "Rung 11 remainder (T14 already did the product.json swap):
      rebrand vendored extensions/copilot as the SafeAppeals agent; BYOK
      provider wiring via upstream Manage Models UI. Detail: merge plan
      rung 11 + section C.1."
    status: pending
  - id: r12-email-classifier
    content: "Rung 12 (numbering CONFIRMED Jul 29; deps: M2 so a
      live LM exists): email AI classifier filling the noopClassifierHook
      seam in safeappeals-email via vscode.lm — auto-tag/auto-link/hide
      suggestions through the existing rung 6.6/6.7 command seam, suggestions
      never destructive. Owns ONLY the email seam — the DOCX/XLSX document
      seams belong to the tools pass. Also decide PDF-printed-email import
      here (gap-audit item 3: recommend DROP formally). Detail: §D4 below."
    status: pending
  - id: r13-cloud-remainder
    content: "Rung 13 remainder (T13 already did the LLM provider): credits/
      balance/checkout UI polish, /models endpoint as source of truth, server
      SSE if not landed with T13, metrics/update service decisions. Detail:
      merge plan rung 13 + C.1 server prerequisite."
    status: pending
  - id: tools-pass
    content: "Agent tools pass (user decision Jul 20: LAST, after cloud +
      agent backend — deps: M2, r13): LM tools for time-tracker, documents,
      email one extension at a time with live agent testing; will absorb RAG
      ×5 + timeline ×6 tools. The DOCX inlineEdit + XLSX applyEdits webview
      seams it builds on are code-verified (Jul 29). Resolve the XLSX WASM
      node-target tension first (§Q3). Plan:
      safeappeals_agent_tools_da04f06e.plan.md."
    status: pending
  - id: r14-packaging
    content: "Rung 14: data migrations (merge plan section I; decide if old
      Void user data still needs migrating at all; known live case: PDF
      annotation legacy workspaceState migration), packaging/CI, per-platform
      Rust/native prebuilds — NOTE win32-x64 prebuilds are MISSING today, so
      time-tracker is broken on Windows (the packaging target); rebuild them
      whenever a Windows env is available, do not wait for this rung
      (WINDOWS-PREBUILDS-TODO.md). Re-verify web-server quality/commit path
      from built server; remaining core-edit audit (merge plan section H)."
    status: pending
  - id: r15-cleanup
    content: "Rung 15: placement review, delete void-reference/ (first move
      the XLSX Rust crate source out — it still lives there), delete
      python/ if r8 retired it, final tracker refresh, close this plan."
    status: pending
isProject: true
---

# SafeAppeals Master Plan — Single Entry Point

## What this document is

SafeAppeals is a legal case-management IDE for workers'-compensation appeals
(users: lawyers, paralegals, claimant advocates, self-represented claimants —
most have never used an agentic AI tool), built as a fork of VS Code 1.129 on
branch `update-vscode`. It is migrating off the 1.95-era Void fork: the old
product moved wholesale to `void-reference/` (~182k lines) and every feature
is **rewritten fresh** against 1.129 APIs — rewrite, not copy.
`void-reference/` is deleted at the end (rung 15).

This file is the **only place with the full ordered sequence**. It does not
duplicate sub-plan internals: where a step has a sub-plan, this file records
intent + order + dependencies and points at the sub-plan. Where it doesn't,
the detail is here. When a step's scope changes, update the owning sub-plan
AND the one-paragraph summary here; record dated user decisions in whichever
file owns the step.

### Sub-plan trust table

A future agent can follow these blindly, with the caveats listed:

| Plan file | Status | Caveat |
| --------- | ------ | ------ |
| `onboarding_redesign_newcomer.plan.md` | **Trustworthy, current, ACTIVE** | none — this is the live workstream |
| `safeappeals_case_extension_rung7.plan.md` | Trustworthy, current (updated Jul 29) | slice 1b superseded by onboarding T4/T10; slice 2 deferred until M1 ships |
| `unified_safeappeals_sign-in_225af75a.plan.md` | Trustworthy, current (updated Jul 29) | its front third (extension shell + cloud provider) moved to onboarding T1; its workstream-1 "endpoints are sound" assumption is void — T0 fixes them first |
| `safeappeals_agent_tools_da04f06e.plan.md` | Trustworthy — its code assumptions are now **code-verified** (Jul 29 audit: the XLSX `applyEdits` webview handler exists and the host never posts to it, exactly as the plan assumed) | deferred to the END of the ladder (user, Jul 20); will grow to absorb RAG/timeline tools. Bonus it did not know: DOCX has an equivalent usable seam (`inlineEditRequest`/`applyInlineEdit` webview protocol, host side inert) — see "three inert AI seams" below |
| `upstream_vs_code_merge_spike_2245beba.plan.md` | Trustworthy for: rung ladder, dated status sections, Rust strategy, sections A/B/E/F/G/I/K | **Sections C.2/C.3, D, D.2's "stay in contrib" list, parts of H, and ladder J are pre-Jul-21 and superseded** — see "The contrib hub is dead" below. Read its Jul 29 → Jul 21 → Jul 20 status sections top-down before trusting any older inline text. |

Two plans were **deleted Jul 29** (`rust_acceleration_plan_b2c6b37e`,
`cleanup_and_rust_consolidation_bea47939`, recoverable at `aa51b7ec`) — they
targeted pre-migration `contrib/void` paths. Do not resurrect them; their
surviving decisions are the merge plan's **"Rust strategy"** section.
`docs/ADDED_FEATURES_TRACKER.md` is **stale (Feb 2026)** and not a source of
truth — see task M0.

## Ground truth (audited Jul 29 2026) — what is actually built

Verified against `build/gulpfile.extensions.ts` + `build/npm/dirs.ts` and the
source tree. Trust this section over any other document on this branch.

### Shipped and build-wired

- **`extensions/time-tracker`** (~3,627 src lines) — **complete on Linux;
  BROKEN on Windows pending prebuilds** (see Risks — this is a present-tense
  shipping blocker, not a future packaging chore). Sidebar webview, status
  bar, matters/rates, UTBMS codes, CSV/JSON/LEDES export. The DB **is**
  encrypted (code-verified Jul 29, superseding an older project note that
  said plaintext/blocked): SQLCipher via `better-sqlite3-multiple-ciphers`,
  DEK in SecretStorage (`time-tracker.dek.database`), plaintext-magic
  rejected, one-time rekey migration from the legacy plaintext DB in
  `~/.safe-appeals-navigator/`. Prebuild state: `prebuilds/linux-x64/
  {electron-146,node-137}/better_sqlite3.node` present; `win32-x64/**`
  deleted (`PREBUILDS.md:55-70`). Loading keys off
  `prebuilds/<platform>-<arch>/<electron|node>-<ABI>` (`storageService.ts:
  46-57`); no match → `node_modules` fallback (`:283-287`), which will not
  exist in a packaged app. Dual-ABI pattern itself is sound — reuse for RAG.
  Note: a *new* SafeAppeals feature, not a void-reference migration.
- **`extensions/safeappeals-email`** — COMPLETE except one gap. IMAP/SMTP
  (`imapflow`/`nodemailer`); the **sidebar IS the inbox**; dashboard panel is
  reader/compose/drafts/settings with Reply + Forward; thread→case linking;
  tagging + hide; `.eml` custom editor (`safeappeals.emlViewer`); encrypted
  local index. **GAP:** the AI classifier is a no-op seam
  (`src/classifierSeam.ts` → `noopClassifierHook`, marked `TODO(rung12)`);
  only manual classification works. Reference:
  `void-reference/browser/emailClassifier.ts` (432 lines). Owner: rung 12.
  Known limitations (recorded so nobody rediscovers them): drafts are
  **local-only** — encrypted `email-drafts.json`, no IMAP APPEND / server
  Drafts folder, and the send path neither links the draft ID nor marks it
  sent (`syncEngine.ts:242-253`, `dashboardPanel.ts:256-260`); search is
  local case-insensitive **substring** over the cached index
  (`emailIndex.ts:221-239`) — no FTS, no IMAP SEARCH; sync-error surfacing
  is uneven — dashboard has a real red banner, sidebar only a dot+tooltip,
  status bar never shows errors (`extension.ts:51-64`), and the initial
  background sync swallows failures via `.catch(() => undefined)`
  (`syncEngine.ts:54`); and `safeappeals-email.updateThreadStatus` is
  implemented (`extension.ts:411-415`) but **absent from `package.json`** —
  unreachable, a small real bug (fix: M0).
- **`extensions/safeappeals-documents`** — COMPLETE. `safeappeals.pdfViewer`
  (**read-only by design** — genuinely `CustomReadonlyEditorProvider`,
  code-verified; annotations/signatures in an encrypted sidecar),
  `safeappeals.docxViewer` and `safeappeals.xlsxViewer` (**editable** — real
  `CustomEditorProvider`s with serialize-then-save pipelines; DOCX = TipTap +
  `docx` Packer, XLSX = Rust WASM engine — crate source still lives in
  `void-reference/`, needs a home before rung 15). Image viewer deliberately
  NOT ported (upstream `media-preview`). Known limitations: PDF annotation
  **legacy migration is deferred** — with no DEK available, legacy
  `workspaceState` annotations seed to memory only
  (`annotationStore.ts:134-141`; the concrete live case behind Q2); the DOCX
  ribbon shows disabled "Export to PDF (deferred)" and "Send for e-Signature
  (deferred)" buttons (`docxEditorProvider.ts:397-468`) — e-signature is
  dropped DocuSign, dead UI to remove at M0; and the DOCX webview runs on a
  1,527-line vendored legacy script
  (`webview-src/docx/vendor/docxViewerTiptap.js`), not
  TypeScript-maintained — a maintenance risk for whoever touches DOCX next
  (tools pass).
- **`extensions/safeappeals-calendar`** (~2,314 src lines) — **PARTIAL:
  backend only, and PULL-ONLY.** Google/Outlook OAuth + sync engine +
  encrypted event cache + commands + status bar. **No calendar/timeline UI
  exists anywhere** (code-confirmed: no `webview-src/`, no
  `WebviewViewProvider`, no `createWebviewPanel`, no view contributions) —
  the old visual UX (`void-reference/browser/react/src/timeline-tsx/`,
  ~4,910 lines) is unbuilt; owner: rung 7 slice 2, which treats the timeline
  view as the calendar UI. **No event write-back to Google/Outlook**
  (`syncEngine.ts:1-3` header; no create/update calls) — display works, push
  does not exist; see Q5.
- **`extensions/safeappeals-case`** (~663 src lines) — **PARTIAL.** Commands
  `setupProfile`/`initCase`/`editCaseInfo`/`openCaseBrief`, "Set Up Safe
  Appeals" walkthrough, `case-setup` chat skill, AGENTS.md managed block +
  `.safeAppeals/case.json` + folder scaffold. Missing: timeline/deadlines
  (rung 7 slice 2) and the old Case Info dashboard UI (D1 CONFIRMED Jul 29 —
  recommend: don't rebuild).
- **`extensions/safeappeals-shared`** — source-only, NOT build-wired by
  design: canonical AES-256-GCM encrypted-store helpers distributed as
  committed per-extension copies in each consumer's `src/shared/`, synced by
  `build/npm/sync-safeappeals-shared.ts`, enforced by
  `checkSafeAppealsSharedInSync` in `build/hygiene.ts`. Copies verified in
  sync (`--check` passes, Jul 29).
- **43 × `extensions/theme-safeappeals-*`** JSON theme packs (not in the
  gulp/dirs lists; scanned at runtime). Corrected from 44 on Jul 29 — the
  on-disk directory count is 43.
- **`src/vs/workbench/contrib/welcomeOnboarding/`** — the first-run wizard,
  actively being rewritten by M1. Wired in `workbench.common.main.ts`. This
  is a deliberate, frozen-scope core surface (predates Jul 21).

### One pattern: three inert AI seams (code-verified Jul 29)

Three extensions carry the same deliberate shape — a fully-built webview/
service seam whose host side is intentionally not wired. Name them together
so nobody treats them as three unrelated gaps, and note the ownership split:
**rung 12 owns only the first; the tools pass owns the other two.**

1. **Email classifier** (rung 12): `noopClassifierHook` returns null,
   `isAvailable()` always false (`classifierSeam.ts:26-33`,
   `syncEngine.ts:140-141`); `emlEditorProvider.ts:59` carries
   `TODO(rung12): classify on import`. Consequence: `getUnclassified()`
   (`emailIndex.ts:537-541`) returns **all** synced mail.
2. **DOCX inline edit** (tools pass): the webview posts `inlineEditRequest`
   (`webview-src/docx/vendor/docxViewerTiptap.js:688`) and listens for
   `applyInlineEdit`/`inlineEditStarted`/`inlineEditProgress`/
   `inlineEditError` (`:1394-1432`); the host groups the request with other
   deferred messages and `break`s (`docxEditorProvider.ts:225-232`) — none
   of the four responses is ever sent.
3. **XLSX `applyEdits`** (tools pass): the webview implements the full
   inbound handler with the complete op dispatch (`webview-src/xlsx/
   main.ts:262`, ops at `:641-771`); the host ignores the outbound direction
   (`xlsxEditorProvider.ts:238-241`) and never posts `applyEdits`
   host→webview anywhere.

This audit **confirms the agent-tools plan's premises**: it assumed exactly
the XLSX situation and planned to build on it; the DOCX seam is the same
shape and equally usable (that plan did not know about it — extend its DOCX
phase to reuse the existing four-message protocol rather than inventing
`applyDocxEdits` from nothing, if they fit).

### Not built anywhere (the genuine remaining work)

With `void-reference/` line counts for scale: RAG ~7,890 (rung 10, Rust);
timeline + deadlines + notifications + calendar UI ~7,800+ (rung 7 slice 2 —
includes `jurisdictionConfig.ts` with real per-jurisdiction
`statuteOfLimitationsDays` + `deadlineRules[]`); file organizer/docket
~8,600+ (rung 8); file converter ~2,100+ (rung 8, Rust sidecar retiring
`python/`); audio recorder + transcription ~2,500+ (rung 9); email classifier
432 (rung 12); document LM tools (tools pass); cloud auth + credits ~1,500
(M1 T1 + M2 T13 + rung 13 remainder — `extensions/safeappeals-authentication`
does not exist yet, T1 creates it).

**Removed from scope entirely (D1–D3, confirmed Jul 29 — ~5,000 lines):**
unified settings pane ~3,900, case-info dashboard 780, extension transfer
service 329. These are NOT remaining work; they will never be rebuilt. Their
code stays readable in `void-reference/` until rung 15 deletes it.

### Explicitly dropped / superseded by upstream (do NOT plan work)

DocuSign (no partnership); the entire Void chat/agent stack — chat sidebar,
thread storage, edit-code/diff service, quick edit, autocomplete, generic
file tools, MCP client, browser panel, web search, context gathering, editor
widgets, selection helper — all replaced by upstream chat + the vendored
`extensions/copilot`; image viewer (upstream `media-preview`); Void LLM
provider plumbing (Copilot now, SafeAppeals cloud at M2); Void
SCM/update/metrics services (metrics/update get a final look at rung 13
remainder).

## Resolution: the contrib hub is dead

`src/vs/workbench/contrib/safeappeals/browser/safeappeals.contribution.ts`
exists with every import commented out and is **not imported from
`workbench.common.main.ts`**. Zero features were ever rewritten into it. The
merge plan still carries pre-Jul-21 text saying organizer/timeline/RAG/
settings/case "stay in contrib" (its sections C.2/C.3, D, D.2's "stay in
contrib" list, ladder J rungs 7–13). **That text is superseded, not this
plan:** per the extension-first decision (user, Jul 21 2026) everything on
that list is now an extension — organizer/converter (rung 8), audio (rung
9), RAG (rung 10), timeline (rung 7 slice 2 in `safeappeals-case`), cloud
auth (T1 extension), agent integration (vendored `extensions/copilot` +
`vscode.lm`, rung 11). The old contrib rungs 7 (settings service) and 12
(AI integration layer) are deleted/folded, as the merge plan's Jul 21 status
section already records.

**Verdict: delete the stub** (task M0). Nothing justifies a
`contrib/safeappeals` hub anymore. The frozen core-edit set is: branding +
default theme, `.vscode`→`.safeAppeals` rename, web-server fixes,
`welcomeOnboarding` (+ its T6/T11 edits), and the small marked upstream edits
in merge-plan section H — none of which route through the hub. If some future
feature genuinely cannot be an extension, it must state the specific reason
here as a dated decision before touching `src/vs`; it does not resurrect the
hub by default.

## The execution sequence

One ordered ladder; a step is DONE only when it runs in the dev build and the
user has verified it. Each rung carries its own wiring — no big-bang
integration phase. Verifier gates throughout: `bun run typecheck-client`
(src/), `bun run gulp compile-extensions` (extensions/),
`bun run valid-layers-check` (layering), `scripts/test.sh` (unit tests);
prefer `bun run`, `npm` only for `npm install`. Local Data Security rules
(AGENTS.md) are mandatory on every rung; deliberately plaintext by design:
case workspace files (`.safeAppeals/case.json`, AGENTS.md, documents) and
`~/.copilot/instructions` profile rule.

### Completed (history)

- **Foundation (Jul 17):** 1.129.0 import (`65015a05`), Phase 0 overlay +
  `void-reference/` move, rung 1 time-tracker, rung 2 themes, rung 3
  branding. → merge plan "Earlier status (Jul 17)".
- **Product extensions (Jul 20–21, all user-verified on Electron AND
  web/code-server):** rung 4 calendar backend, rung 5a/b/c documents, rung 6
  email + 6.6 case links + 6.7 tags + 6.8 settings/CC/BCC + the product-wide
  `.safeAppeals` config-folder rename. → merge plan "Status (Jul 20)" +
  commit trail.
- **Rung 7 slices 1 + 1b (`567beff7`):** case extension core. Slice 1b since
  superseded by onboarding T4/T10; the slice-1-verify item waits on those. →
  `safeappeals_case_extension_rung7.plan.md`.

### M0 — Feature tracker fix + contrib stub deletion + cheap correctness fixes (anytime; do soon)

No dependencies; cheap; prevents the next agent from trusting a stale
document and stops the product showing users things that are false. Four
parts:

1. **Rewrite `docs/ADDED_FEATURES_TRACKER.md` as a status INDEX, not a
   parallel narrative** — narrative duplicates drift (it already did:
   last real update Feb 2026, describes the old Void 1.99.7 contrib layout,
   marks ~16 void-reference-only features ✅ with zero active wiring,
   conflates the calendar extension with the unbuilt Timeline, and omits
   `safeappeals-case`, `safeappeals-shared`, `welcomeOnboarding`, and the 44
   theme packs). Concretely: one table, columns `Feature | Status | Location
   (extension / contrib / void-reference / dropped) | Wired? | Plan link`;
   split "Timeline" from "Calendar sync"; replace all `contrib/void` paths
   with current ones; add the missing entries; demote everything that exists
   only in `void-reference/` to "reference / not migrated"; fix the version
   footer (1.129 fork, not 1.99.7); a header line stating this plan is the
   source of truth and the tracker is derived. Keep it short enough that
   updating it is a one-line diff per rung (each rung's DONE includes the
   tracker row).
2. **Delete `src/vs/workbench/contrib/safeappeals/`** (the dead hub stub —
   one file, imported by nothing; see resolution above). Gate:
   `bun run typecheck-client` still clean.
3. **Remove the dead DOCX ribbon buttons** (`docxEditorProvider.ts:397-468`):
   "Send for e-Signature (deferred)" advertises DocuSign, which is formally
   dropped — the product is showing users a feature that will never ship;
   remove it. "Export to PDF (deferred)" is a genuinely deferred rung-5b
   item, but a permanently-disabled button is not a roadmap — remove it too
   and re-add when the feature exists. User-visible correctness fix, minutes
   of work.
4. **Contribute `safeappeals-email.updateThreadStatus` in `package.json`** —
   the handler is implemented (`extension.ts:411-415`) but the command is
   not contributed, so it is unreachable. One-line fix. Gate:
   `bun run gulp compile-extensions` clean.

### M1 — Onboarding redesign, Phase 0 + Phase A — ACTIVE

The current workstream; runs ahead of the ladder (user, Jul 29) because the
inherited wizard speaks developer to a legal audience and promises sign-in
"unlocks AI features" (false under the zero-credit model) — a
product-credibility problem that outranks ladder order. T0 (void-cloud repo:
PKCE end-to-end, redirect-URI allow-list, state, disable implicit flow,
close the unauthenticated callback that leaks Google provider tokens) is a
standalone security fix and a **hard blocker** for T1
(`extensions/safeappeals-authentication` + `safeappeals-cloud` provider,
SecretStorage, build wiring). T2–T12 rebuild the wizard as 4 steps, flip the
`chat.tools.edits.autoApprove` default, convert the case walkthrough to a
checklist, and add the bundled sample case + spotlight tour. Carves pieces
out of rungs 6.5/7/11/13 — exact split table: merge plan "Status (Jul 29)".
→ **Plan: `onboarding_redesign_newcomer.plan.md`** (T0–T12, §9 Phase 0/A).

### M2 — Onboarding Phase B (deps: M1)

T13: cloud LLM provider over `POST /llm/chat` with zero-credit error UX
(carved from rung 13; SSE strongly preferred). Then T14 (**BREAKING**):
`product.json` removes `GitHub.copilot-chat`, trims `defaultChatAgent`,
regression pass on the `chatEntitlementService` gate (carved from rung 11).
After M2 the app's inference runs on SafeAppeals Cloud — which is what
unblocks rung 12 (classifier) and, eventually, the tools pass.
→ **Plan: `onboarding_redesign_newcomer.plan.md` §9 Phase B.**

### Rung 7 slice 2 — Timeline + deadlines (deps: M1 shipped)

Deferred Jul 29 only because onboarding T10/T12 edit the same extension —
no logical dependency. Builds in `safeappeals-case`: statute-deadline
calculation from the old `jurisdictionConfig` data (real
`statuteOfLimitationsDays` + `deadlineRules[]`), deadline generation from
decisions, notifications, PDF-export decision, and the visual
timeline/calendar view — this **is** the missing calendar UI; it reads the
calendar extension's `getEvents`/`status` commands rather than adding UI to
that extension. **Scope question to settle when this rung starts (Q5):** the
calendar sync engine is pull-only — reading events for display works, but if
timeline deadlines are meant to *push* into the user's real Google/Outlook
calendar, that write-back does not exist and must be built in the calendar
extension (the merge plan carried "timeline→calendar push" as a deferred
rung-4 item; it is still nobody's). Known porting snags recorded in the
sub-plan (jurisdiction slug-vs-display-name mismatch; `.timeline.json` →
`.safeAppeals/`). Slice 3 (case-type skills) remains optional/later.
→ **Plan: `safeappeals_case_extension_rung7.plan.md`.**

### Rung 8 — Organizer + converter extension (deps: rung 7 slice 2 soft — case.json fields)

NEW `extensions/safeappeals-organizer`: file organizer/docket (explorer
context menus + `FileDecorationProvider` + webview wizard; **no**
`explorerViewer.ts` core hook — extension-first) + the file converter as a
Rust sidecar `rust/converter` (bin `sa-converter`, newline-delimited JSON
protocol matching the old `electron_bridge.py`), written in Rust the first
time, retiring `python/` when pair parity is reached. LibreOffice-dependent
pairs stay listed unsupported (or shell out for those pairs only). The old
"Case Organizer agent workflow" (`void.organizer.init`, dry-run/undo)
becomes a chat skill/prompt + upstream file tools, not custom plumbing.
→ **Detail: merge plan rung 8 + "Rust strategy" section (crate layout,
library choices, risks).**

### Rung 9 — Audio extension

NEW `extensions/safeappeals-audio`: recorder + whisper transcription + ffmpeg
assets (`resources/ffmpeg|models` packaging lands with rung 14). Evaluate
against upstream `speech` only after it works. → **Detail: merge plan rung 9.**

### Rung 10 — RAG extension, in Rust (deps: none hard; late for native-ABI risk)

NEW `extensions/safeappeals-rag` backed by `rust/rag-core` (napi-rs;
`fastembed` all-MiniLM-L6-v2 via ort, `usearch` HNSW with mmap persistence,
`tantivy` BM25; RRF fusion may start in TS), N-API surface ≈ `embedBatch` /
`indexChunks` / `search` / `removeDoc` / `stats`; SQLite chunk store reuses
the time-tracker dual-ABI pattern. **Scope is Advanced RAG** — hybrid
BM25+RRF retriever, query processor, cross-encoder reranker (reranker may
follow as a fast-follow inside the same module) — not basic vector search;
plus policy-manuals auto-create/watch behaviors. Written in Rust from the
start (user, Jul 29): no TS-first-then-port. RAG's ~5 agent tools land in
the tools pass, not here. → **Detail: merge plan "Rust strategy" (rung 10
subsection) + gap-audit item 5.**

### Rung 6.5 remainder — Provider-token auth (deps: M1 T1; before rung 13 remainder)

The `safeappeals-google`/`-microsoft` provider-token providers into the
existing auth extension, calendar conversion to `getSession()` (delete
`oauthLoopback`/`tokenStore`/client-secret settings), email XOAUTH2
("Sign in with Safe Appeals", app-password fallback stays), and the server
workstream (Gmail/Calendar Supabase scopes, Azure provider, provider-token
refresh endpoint, Google restricted-scope verification — weeks of business
lead time, start the verification checklist early). Kept late deliberately
(Jul 21 rationale): the provider-token surface gets designed against its
real consumers. → **Plan: `unified_safeappeals_sign-in_225af75a.plan.md`.**

### Rung 11 remainder — Agent rebrand + BYOK (deps: M2 did the product swap)

Rebrand the vendored `extensions/copilot` as the SafeAppeals agent; wire
BYOK providers through upstream's Manage Models UI /
`chatLanguageModels.json` + `chat.lm.secret.*` (this is also where any
surviving "settings pane" duty lands — see D2). The old contrib rung 12
(integration layer) stays folded in here. → **Detail: merge plan rung 11 +
section C.1 (provider/vendor contract).**

### Rung 12 — Email AI classifier (deps: M2; slot flexible — see D4)

Fills the `noopClassifierHook` seam in `safeappeals-email` using `vscode.lm`
against the cloud provider: auto-tag / auto-link-to-case / hide suggestions
flowing through the existing rung 6.6/6.7 command seam (built deliberately
as the agent surface), plus the `TODO(rung12)` classify-on-import hook in
`emlEditorProvider.ts:59`; until then `getUnclassified()` returns all synced
mail. **This rung owns only the email seam** — the DOCX/XLSX inert seams
(see "three inert AI seams") belong to the tools pass; do not assume rung 12
covers all three. Suggestions are never destructive — tags/links/hide
only, no deletion, user-visible provenance. Reference:
`void-reference/browser/emailClassifier.ts` (432 lines) — rewrite, not copy;
the old version predates `vscode.lm`. Also formally decide PDF-printed-email
import here (gap-audit item 3): **recommend DROP** — `.eml` covers the real
workflow; nobody has asked for PDF import since rung 6 shipped.

### Rung 13 remainder — Cloud credits + server (deps: M2, rung 6.5 remainder)

Credits/balance/checkout UI polish beyond T7's wizard step, `/models`
endpoint as the single source of truth for the model list, server SSE +
native tool_calls if not already landed with T13, and the final
keep/slim/drop verdict on metrics + update services. → **Detail: merge plan
rung 13 + C.1 "server prerequisite".**

### Tools pass — Agent LM tools (deps: M2 + rung 13 remainder; user decision Jul 20: LAST)

Deferred to the end because tools need live agent testing, which needs cloud
+ agent backend. One extension at a time: time-tracker
(start/stop/getState/updateEntry/listMatters), documents (docx/xlsx
create/edit/read with hybrid open-editor/headless routing), email
(read + draft-only — **no send tool ever** — + organize tools wrapping the
6.6/6.7 commands), then the plan grows to absorb RAG ×5 and timeline ×6
tools and the house-pattern doc. The webview seams this builds on are
code-verified (Jul 29): the XLSX `applyEdits` handler is exactly as the
plan assumed, and DOCX already has a four-message
`inlineEditRequest`/`applyInlineEdit` protocol the plan did not know about —
evaluate reusing it before building `applyDocxEdits` fresh. Prerequisite
decision: the XLSX WASM node-target tension (§Q3). → **Plan:
`safeappeals_agent_tools_da04f06e.plan.md`.**

### Rung 14 — Migrations + packaging/CI

Data migrations per merge plan section I — **first decide whether any old
Void user data still needs migrating at all** (extension-first rebuilds made
several rows moot; the known live case is the PDF annotation legacy path:
with no DEK, old `workspaceState` annotations seed to memory only,
`annotationStore.ts:134-141` — see Q2). Packaging/CI (`build-release.yml`
rewrite against the ESM build), per-platform native + Rust prebuilds
(`WINDOWS-PREBUILDS-TODO.md`) — **note the win32-x64 better-sqlite3
prebuilds are missing TODAY** (Risks); rebuilding them is not gated on this
rung and should happen as soon as a Windows build environment is available.
Re-verify the web-server quality/commit/webview-hosting path from a *built*
server (dev differs — merge plan Jul 18 note), remaining section-H core-edit
audit, `open-remote-*` verdict.

### Rung 15 — Placement review + deletion

Final placement review; move the XLSX Rust crate source out of
`void-reference/` into `rust/` (it still lives there); delete
`void-reference/` and `python/` (if rung 8 finished retiring it); last
tracker refresh; close this plan. Cleanup candidates flagged by the Jul 29
code audit (here, or fold into M0 if someone is already in the files):

- `webview-src/xlsx/worker.ts` + `webview-src/xlsx/wasm-loader.ts` are
  explicitly unused scaffolding (`xlsx/main.ts:6-7`). Do NOT delete
  `wasm-loader.ts` before Q3 is resolved — it is an abandoned prior attempt
  at exactly the loader question Q3 asks; whoever resolves Q3 reads it first.
- `@tiptap/react`, `y-prosemirror`, `@tiptap/extension-collaboration` in the
  documents extension's devDependencies are never imported — drop them.

### Unscheduled / opportunistic (no rung owns these; do when convenient)

- **Rust-backed WASM diff:** flip `diffAlgorithm: 'advanced-wasm'` and
  benchmark on large legal documents; own crate only if benchmarks demand.
  → merge plan "Rust strategy".
- **documents extension Rust consolidation** (drop SheetJS/pdfjs-dist):
  gated on the calamine formula round-trip fix — a load→save through Rust
  today **destroys formulas**. Blocking only for the Rust *edit* path; the
  tools pass does not require it. → merge plan "Rust strategy".

## Decisions — ALL FOUR CONFIRMED (user, Jul 29 2026)

**D1–D4 are settled.** The user confirmed D1 explicitly ("dont rebuild case
info") and accepted D2, D3, and D4 as recommended. Treat these as decided;
do not re-open them without a new dated decision recorded here.

Net effect: roughly **5,000 lines** of `void-reference/` code leave the
rebuild scope entirely (case-info dashboard 780 + settings pane ~3,900 +
extension transfer 329). The "not built anywhere" totals shrink accordingly.

- **D1 — Case-info dashboard UI (780 reference lines): do NOT rebuild.
  CONFIRMED Jul 29.**
  The commands + `case-setup` chat skill + AGENTS.md brief + `case.json`
  already cover create/read/edit, and the Jul 21 "agent-native, not a port"
  decision points this way. If a visual surface proves wanted, rung 7 slice
  2's timeline view is the natural place to grow a small case-header panel —
  not a separate dashboard.
- **D2 — Unified settings pane (~3,900 reference lines): DROP. CONFIRMED
  Jul 29.** VS Code
  Settings covers general config; the email settings pane covers per-case
  email; BYOK keys go to upstream's Manage Models UI at rung 11; cloud
  account lives in the Accounts menu via T1. Nothing identified remains. If
  something surfaces, it becomes a settings *page contribution* in the
  owning extension, not a unified pane.
- **D3 — Extension transfer service (329 reference lines): DROP. CONFIRMED
  Jul 29.** It
  imported extensions/settings from a sibling VS Code install — a
  developer-migration convenience that does not serve a legal audience on a
  fresh product. Upstream profiles/settings-sync import covers the rare
  power user. Code stays readable in `void-reference/` until rung 15 if
  reversed.
- **D4 — Email classifier ownership + slot: new "rung 12", after M2.
  CONFIRMED Jul 29.** The old rung 12 (contrib AI integration) was folded
  into rung 11, which left the seam's `TODO(rung12)` marker pointing at
  nothing. The number 12 is now reused for the classifier, so the marker in
  `classifierSeam.ts` and `emlEditorProvider.ts:59` resolves correctly again
  — do not renumber it. Depends on M2/T13 so a real LM exists; sequenced
  after rung 11 remainder but movable, being small and self-contained. The
  rejected alternative (fold into the tools pass) is closed. Includes the
  PDF-printed-email import drop, now also confirmed.

## Risks (carried forward + new)

- **Upstream-merge conflict surface (permanent):** every core edit is a
  recurring conflict — the frozen set (branding, theme, `.safeAppeals`
  rename, web-server, `welcomeOnboarding`, T6's
  `chat.shared.contribution.ts` default flip) is the accepted cost;
  extension-first exists to cap it. T6 specifically can be silently reverted
  by an upstream merge — the pinning unit test is the tripwire (onboarding
  plan §10).
- **`chatEntitlementService` coupling (highest near-term):** T14 can break
  the wizard trigger itself; isolated, last in M2, with the gate regression
  test (onboarding plan §10).
- **Windows prebuilds MISSING — time-tracker is broken TODAY on the
  packaging target (shipping blocker hiding in a "finished" feature).**
  Corrected Jul 29 — the earlier "win32-x64 only" note was stale and
  **backwards**: `extensions/time-tracker/prebuilds/` now has
  linux-x64/electron-146 + linux-x64/node-137 and `win32-x64/**` was
  deleted (`PREBUILDS.md:55-70`). With no matching prebuild the loader
  falls back to a `node_modules` build (`storageService.ts:283-287`) that
  will not exist in a packaged app. Rebuild the win32 binaries as soon as a
  Windows environment is available — do not wait for rung 14
  (`WINDOWS-PREBUILDS-TODO.md`). Every Rust/napi addition (rag-core,
  converter) widens the same per-platform matrix.
- **Google restricted-scope verification (business, weeks of lead time):**
  Gmail scope needs Google verification (possibly CASA); 100-user test cap
  until approved. Start alongside rung 6.5 remainder, not after.
- **calamine formula destruction:** any premature switch of XLSX save paths
  to Rust silently destroys formulas in client workbooks — gated on
  round-trip tests (merge plan "Rust strategy").
- **LibreOffice conversion pairs:** no good Rust equivalent for docx→pdf;
  rung 8 ships them as unsupported or shells out for those pairs only.
- **Web/code-server parity:** every rung verifies both targets (rungs 1–6
  precedent); webview hosting on web has known sharp edges (service-worker
  cache, Cursor embedded-browser limitation — test in a real browser).
  `safeappeals-documents` is `extensionKind: ["workspace"]` — needs
  code-server mode, not pure code-web.
- **Plan drift (meta):** this file is now the top of the tree; the failure
  mode that killed the tracker (parallel narratives) applies here too. Rule:
  rung DONE = sub-plan status updated + one-line tracker row + this file's
  todo flipped, in the same commit.

## Open questions (not blocking the sequence)

- **Q1 — Email/password sign-in** for lawyers without Google accounts
  (onboarding plan §10; assumption shipped: Google-only now).
- **Q2 — Old-user data migration scope (rung 14):** does anyone still run
  the 1.95-era Void build whose data needs importing, or does
  extension-first make section I mostly moot? Known live item either way:
  PDF annotations — legacy `workspaceState` entries are seeded to memory
  only when no DEK is available (`annotationStore.ts:134-141`), so the
  deferred migration silently drops them on save-less sessions.
- **Q3 — XLSX WASM target for headless tools:** the merge plan's Rust
  strategy says load the existing `--target web` artifacts from Node via
  `init(bytes)`; the agent-tools plan says `wasm-pack build --target
  nodejs`. Pick ONE before building the documents agent tools (tools pass
  prerequisite). Leaning: whichever avoids a second build target, i.e. the
  `init(bytes)` route — verify it actually works headless first. Prior art:
  `webview-src/xlsx/wasm-loader.ts` is an abandoned earlier attempt at this
  exact question (unused per `xlsx/main.ts:6-7`) — read it before deciding.
- **Q4 — Reranker timing (rung 10):** cross-encoder reranker in the first
  Rust cut, or fast-follow inside the same module? Scope says Advanced RAG
  is mandatory; the fusion retriever without the reranker may be an
  acceptable first user-verifiable milestone.
- **Q5 — Timeline→calendar push (rung 7 slice 2 scope):** the calendar
  extension is pull-only — no event write-back to Google/Outlook exists
  (`syncEngine.ts:1-3`). If statute deadlines should appear in the user's
  real calendar, write-back must be built (in the calendar extension, likely
  after the rung 6.5 `getSession()` conversion). Decide in-or-out when slice
  2 starts; the merge plan's deferred "timeline→calendar push" note is
  currently owned by nobody.

## Implementation deviations from this plan

Record dated deviations and decision confirmations here, per house convention.

**Jul 29 2026 — D1–D4 confirmed by the user.** D1 was confirmed explicitly
("dont rebuild case info"); D2, D3, and D4 were accepted as recommended. All
four move from "needs confirmation" to settled:

- D1 — case-info dashboard UI: **not rebuilt**. The commands, `case-setup`
  chat skill, `AGENTS.md` brief, and `case.json` are the case surface. If a
  visual surface is ever wanted, it grows as a small case-header panel inside
  rung 7 slice 2's timeline view — never as a separate dashboard.
- D2 — unified settings pane: **dropped**. Any future settings need becomes a
  page contribution in the owning extension.
- D3 — extension transfer service: **dropped**.
- D4 — email classifier: **is rung 12**, after M2. The `TODO(rung12)` markers
  already in the code now resolve correctly; do not renumber. PDF-printed-email
  import is formally dropped with it.

Consequence for scope accounting: ~5,000 lines of `void-reference/` leave the
rebuild set. Anyone re-estimating remaining work should use the corrected
figures in "Not built anywhere" above, not the older merge-plan inventory.

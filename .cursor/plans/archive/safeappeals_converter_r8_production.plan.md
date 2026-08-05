---
name: SafeAppeals R8 Converter (production)
overview: "Production-grade converter app+UI: Rust sa-converter NDJSON sidecar, NEW safeappeals-converter extension, all 38 pairs + merge/batch + PDF ops. BYO system LO/Chromium/OCR (v1); court paths HARD-DISABLED until deps detected; warm LO mandatory when present; pure-Rust utilities always on; bundling is rung-14/P6 only."
todos:
  - id: p0-workspace-protocol
    content: "P0: rust/ workspace + sa-converter skeleton; NDJSON; registry with fidelity + available:false for court keys until dep probe; path sandbox; configure/ping/shutdown/dep-detect"
    status: completed
  - id: p1-pure-rust-core
    content: "P1: Pure-Rust utility pairs always available=true + PDF merge/split/ops (lopdf/pdfium); golden fixtures CI (no LO/Chromium)"
    status: completed
  - id: p2-warm-lo
    content: "P2: Warm LO worker BYO detect; dedicated profile, macros off, concurrency=1, watchdog; court Office→PDF available only when healthy; LO CI"
    status: completed
  - id: p3-browser-ocr
    content: "P3: Browser-print via system Chrome/Chromium/Electron detect order; html/md→pdf court gates; OCR BYO hard-disable; remaining extract pairs"
    status: completed
  - id: p4-extension-host
    content: "P4: NEW extensions/safeappeals-converter — sidecar host, dashboard UI blocks unavailable court paths with install guidance, dynamic getAvailableConversions"
    status: completed
  - id: p5-batch-agent-parity
    content: "P5: batch/merge polish; agent tools return fidelity + confirm filing-target exports; parity checklist incl. false-completeness gate; python/ retire gate"
    status: completed
  - id: p6-packaging-note
    content: "P6: Rung-14 packaging design doc only — sa-converter prebuilds, size/CVE/platforms for optional bundled LO/Chromium/OCR (not pretend bundled in v1)"
    status: pending
isProject: true
---

# SafeAppeals R8 Converter — Production Implementation Plan

## Recommendation

Ship **`rust/converter`** (`bin = sa-converter`) as a **long-lived NDJSON sidecar** owned by **`extensions/safeappeals-converter`** (full app+UI: dashboard, commands, tests). Cover **all 38 pairs + merge/batch + PDF ops**. **v1 runtime model = BYO:** detect system LibreOffice, Chrome/Chromium/Electron, and Tesseract/OCR tools — do **not** pretend they are bundled. **Court-critical paths are HARD-DISABLED** (`available: false`; UI blocked with install guidance) until deps are detected and healthy — never soft-list as available with a weak hint. Pure-Rust utility pairs are always available when the sidecar runs. Warm LO is **mandatory for court Office→PDF when LO is present** (not cold shell-out, not “unsupported forever”). Bundling LO/Chromium/OCR stays a **rung-14/P6 design deliverable** (size/CVE/platforms). **Trade-off accepted:** v1 depends on lawyer machine tooling for filings; we refuse false completeness over silent lossy fallbacks.

## Prior session notes (how this builds on them)

Vault / librarian settled (honored):

- Rust-first, no TS/Python prototype; crate `rust/converter`, bin `sa-converter`, top-level `rust/` workspace (not under upstream `cli/`).
- Extension-first (no contrib hub). Organizer shipped as `organize-files` skill; converter is the remaining Rung 8 slice (`r8-converter`).
- Retire `python/` when pair parity reached; delete at rung 15 after that.

Vault also records ([[Decisions/Write it in Rust the first time]], 2026-07-29 session): write converter in Rust the first time; crates live under top-level `rust/`.

**CTO decision (Aug 3 2026, Steve go):** BYO deps + warm LO + hard-disable court paths until detect. This plan is the source of truth for `r8-converter`. Master plan frontmatter/body point here (see Docs). Merge-plan “LO unsupported / shell out” is superseded.

No vault notes found that contradict NEW `safeappeals-converter` vs folding into documents.

---

## Product placement (committed)

**NEW `extensions/safeappeals-converter`.**

Reasons:

1. **Documents is an editor surface** (`safeappeals-documents` already owns PDF/DOCX/XLSX custom editors, WASM viewers, annotation stores). Folding a batch conversion dashboard + sidecar lifecycle there couples unrelated failure domains and bloats activation.
2. **Converter needs its own UX** — void’s `file-converter-tsx` dashboard, progress, batch, merge, fidelity warnings — not contextual editor chrome.
3. **Matches product pattern** for heavy native/sidecar features (audio, RAG get their own extensions); organizer was deliberately a skill because it needs no UI — converter does.
4. **Extension-first** stays clean: no `src/vs/workbench/contrib` hub; packaging attaches the binary beside the extension (rung 14).

Thin optional later: documents context-menu “Convert…” can call the converter extension’s commands via `vscode.commands.executeCommand` — not ownership transfer.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  extensions/safeappeals-converter                           │
│  - SidecarHost (spawn/keepalive/restart)                    │
│  - ConverterService (TS façade ≈ IFileConverterMainService) │
│  - Webview dashboard + explorer/commands                    │
│  - Agent tools (convert / batch / merge / list)             │
└──────────────────────────┬──────────────────────────────────┘
                           │ stdin/stdout NDJSON (paths only)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  sa-converter (rust/converter)                              │
│  protocol │ registry │ sandbox │ job queue │ progress       │
│     ├─ engines/pure_rust   (pdfium, lopdf, docx-rs, …)      │
│     ├─ engines/libreoffice (warm UNO/unoserver-style)       │
│     ├─ engines/browser     (Chromium print-to-PDF)          │
│     ├─ engines/ocr         (tesseract / ocrs + pdfium)      │
│     └─ engines/optional    (pandoc semantic; typst preview) │
└─────────────────────────────────────────────────────────────┘
         │                         │                    │
         ▼                         ▼                    ▼
   workspace files          LO headless worker    Chromium headless
   (allowlisted roots)      (persistent)          (on demand / warm)
```

**On-machine only** — no SaaS conversion endpoints. Confidential legal data never leaves the host.

### Runtime dependency model (v1 BYO — CTO)

| Dep | v1 | Court impact if missing |
|-----|----|-------------------------|
| LibreOffice (`soffice`) | Detect system install; warm worker | `docx2pdf` / `xlsx2pdf` / `pptx2pdf` / `epub2pdf` → `available:false` |
| Browser print | Detect order below | `html2pdf`, court `md2pdf` → `available:false` |
| Tesseract / ocrmypdf | Detect system tools | OCR keys → `available:false` |
| Pure Rust + lopdf/pdfium | Shipped in `sa-converter` | Utilities + merge/split/pdf-ops stay available |

**Chromium detection order (first hit wins):**
1. `SAFEAPPEALS_CHROME_PATH` / configure override
2. Google Chrome (`google-chrome`, `chrome`, macOS/Windows standard paths)
3. Chromium (`chromium`, `chromium-browser`, …)
4. Electron binary shipping with the SafeAppeals / Code OSS app (`process.execPath` / bundled electron)

**Hard-disable rule:** If a conversion’s default court engine is missing or unhealthy → `available: false` + structured `install_guidance` (what to install, why). UI **blocks Start** (disabled control + guidance panel). Agent tools **refuse** the job with `ENGINE_UNAVAILABLE` — never run a `preview-fast` path and call it filing-ready.

**Optional lossy overrides:** `options.engine = "preview-fast"` (or explicit non-court profile) may unlock a utility path **only** after UI/agent confirmation that this is **not** for filing. Never the default when court engine is missing.

### Tiered success (hand-to-Steve testing bar)

| Tier | Keys / ops | Gate |
|------|------------|------|
| **Court-critical** | `docx2pdf`, `xlsx2pdf`, `pptx2pdf`, `html2pdf`, `md2pdf` (browser-print), `merge_pdfs`, `pdf2split` | Proven with fixtures when BYO deps present; HARD-DISABLED otherwise |
| **Utility (always on)** | Pure-Rust semantic/tabular/image/txt + non-OCR pdf-ops (compress/encrypt/watermark/pages as implemented) | Golden CI without LO/Chromium |
| **OCR / lossy** | `image2text`, `pdf2ocr_layer`, `pdf2editable`, scanned `pdf2md`, `pdf2xlsx` | Never default for filings; fidelity `ocr` / `preview-fast`; confirm before use |

### LibreOffice isolation (P2 exit criteria — mandatory)

Warm worker MUST meet all of:
1. **Dedicated user profile** dir (not the lawyer’s interactive LO profile) under extension storage / managed temp
2. **Macros disabled** (`macroexecutionmode=4` / equivalent harden flags)
3. **`concurrency = 1`** for LO jobs (global LO mutex)
4. **Watchdog:** per-job timeout + worker health ping; kill → restart budget → mark office-fidelity keys `available:false` until healthy
5. No cold `soffice` per request as the steady-state path

### Capability profiles (fidelity classes)

Every registered conversion advertises one primary profile (UI warning source):

| Profile | Meaning | Court default? |
|--------|---------|----------------|
| `office-fidelity` | Warm LibreOffice layout engine | Yes for Office→PDF |
| `browser-print` | Chromium CSS print pipeline | Yes for HTML→PDF |
| `semantic` | Structure/text faithful; layout may differ | OK for RAG/edit |
| `preview-fast` | Lossy / approximate | **Never** default for court filings |
| `pdf-ops` | Structural PDF ops (merge/split/encrypt/…) | N/A (lossless ops unless noted) |
| `ocr` | OCR-dependent; quality varies by scan | Warn; review required; **never default for court filings** |

Optional engines: **Pandoc** for exotic semantic round-trips; **Typst** only for controlled/preview (`preview-fast`) — never default court path. Utility/OCR profiles are **never auto-selected for filing-target exports**.

---

## Full conversion matrix (parity target)

Canonical key = `{source}2{target}` (aliases: `markdown`→`md`, `htm`→`html`). Void UI key `pdf2ocr` **aliases to** `pdf2ocr_layer`.

Duplicate Python plugins for the same key (e.g. LO + ReportLab `docx2pdf`) collapse to **one key** with a **default engine** and optional `options.engine` override. Default always prefers higher-fidelity profile.

### A. Office → PDF (`office-fidelity`, warm LO default)

| Key | Default engine | Fallback | Notes |
|-----|----------------|----------|-------|
| `docx2pdf` | LO warm | — (hard-disable if LO missing) | LO default; optional `preview-fast` only with explicit non-filing confirm |
| `xlsx2pdf` | LO warm | — (hard-disable if LO missing) | LO default |
| `pptx2pdf` | LO warm | — (hard-disable if LO missing) | LO default |
| `epub2pdf` | LO warm | — (hard-disable if LO missing) | LO default |

### B. HTML → PDF (`browser-print`)

| Key | Default engine | Fallback |
|-----|----------------|----------|
| `html2pdf` | Chromium print | — (hard-disable if browser missing) |

### C. Semantic / generate (pure Rust primary)

| Key | Engine | Fidelity |
|-----|--------|----------|
| `md2html` | comrak + ammonia | semantic |
| `md2docx` | comrak → docx-rs | semantic |
| `md2pdf` | md→html→browser-print | browser-print (hard-disable if browser missing; never default preview-fast for filings) |
| `md2epub` | comrak + epub-builder | semantic |
| `docx2md` | docx-rs extract | semantic |
| `docx2epub` | docx→html→epub | semantic |
| `html2epub` | ammonia sanitize + epub-builder | semantic |
| `epub2html` | rbook/epub | semantic |
| `epub2md` | epub→html→md | semantic |
| `epub2docx` | epub→html→docx | semantic |
| `txt2pdf` | print/layout crate or simple PDF write | semantic |
| `xlsx2csv` | calamine | semantic |
| `xlsx2md` | calamine → md tables | semantic |
| `xlsx2html` | calamine → HTML tables | semantic |
| `csv2xlsx` | csv + rust_xlsxwriter | semantic |
| `csv2pdf` | table → PDF | semantic |
| `pptx2html` | pptx extract → HTML | semantic |
| `pptx2md` | pptx extract → md | semantic |
| `pptx2images` | LO export or pdfium via pptx→pdf→images | office-fidelity if LO |
| `image2pdf` | image + PDF write | semantic |
| `image2image` | image crate | semantic |
| `pdf2md` | pdfium text; OCR path when needed | semantic / ocr |
| `pdf2html` | pdfium / structured extract | semantic |
| `pdf2images` | pdfium-render | semantic |
| `pdf2xlsx` | table extract (heuristic) | preview-fast (warn) |

### D. PDF ops (`pdf-ops`)

| Key | Engine |
|-----|--------|
| `pdf2compress` | lopdf / pdfium rewrite |
| `pdf2encrypt` | lopdf encryption |
| `pdf2split` | lopdf |
| `pdf2watermark` | lopdf + stamp page |
| `pdf2pages` | lopdf extract/rotate/remove |
| `pdf2ocr_layer` | OCR stack + write text layer |
| `pdf2editable` | OCR-my-PDF-equivalent pipeline (ocrmypdf CLI or Rust+tesseract) |

### E. OCR

| Key | Engine | Fidelity |
|-----|--------|----------|
| `image2text` | tesseract / ocrs | ocr |
| `pdf2ocr_layer` | see D | ocr |
| `pdf2editable` | see D | ocr |
| `pdf2md` (scanned) | auto-OCR option | ocr |

### F. Services (not `source2target` keys, first-class methods)

- `mergePDFs` / method `merge_pdfs`
- `batchConvert` / method `batch_convert`
- Progress notifications for single + batch

**Parity count:** 38 unique pairs above + merge + batch + the PDF ops already listed as pairs. UI must expose **all** keys returned by `getAvailableConversions`, not a hardcoded ~12.

---

## NDJSON protocol

Long-lived process. **Stdout = protocol only. Stderr = logs.** Paths, never file blobs.

### Request

```json
{"id":"uuid","method":"convert","params":{"input":"/abs/in","output":"/abs/out","type":"docx2pdf","options":{}}}
```

### Response

```json
{"id":"uuid","result":{"success":true,"output_path":"/abs/out","duration_ms":1234,"fidelity":"office-fidelity","engine":"libreoffice"}}
```

or

```json
{"id":"uuid","error":{"code":"ENGINE_UNAVAILABLE","message":"…","data":{}}}
```

### Progress (notifications, no `id` required — use `job_id`)

```json
{"method":"progress","params":{"job_id":"uuid","progress":40,"message":"Rendering","type":"single_progress"}}
```

### Methods (preserve `IFileConverterMainService` spirit)

| Method | Maps to |
|--------|---------|
| `configure` | allowlisted roots, LO/Chromium/OCR paths, timeouts, concurrency |
| `ping` / `shutdown` | health + graceful exit |
| `get_available_conversions` | dynamic map + fidelity + engine + `available` bool + missing dependency hints |
| `convert` | single file |
| `batch_convert` | many files, one type |
| `merge_pdfs` | PDF merge |
| `cancel` | cancel by job id |

Contract evolution vs void: void spawned CLI per job and hardcoded ~11 conversions in `fileConverterChannel.ts`. Rust is the **persistent** path; TS becomes a thin client. Protocol is JSON-RPC-ish `{id,method,params}` (clearer than merge plan’s `{command,args}` sketch) while remaining newline-delimited.

---

## Crate layout (create)

```
rust/
  Cargo.toml                 # workspace
  converter/
    Cargo.toml               # bin sa-converter; features: libreoffice, browser, ocr, pandoc
    src/
      main.rs
      protocol.rs            # NDJSON framing, id correlation
      sandbox.rs             # allowlist, no file://, symlink resolve, size caps
      registry.rs            # ConversionSpec { key, fidelity, engine, deps }
      job.rs                 # queue, cancel, progress
      engines/
        mod.rs
        pure_rust/
        libreoffice/         # warm worker client
        browser/
        ocr/
        optional_pandoc.rs
      pdf_ops/
      services/
        batch.rs
        merge.rs
    tests/
      golden/
      protocol_tests.rs
    fixtures/                # per pair-class golden inputs
```

**Features:** default = pure Rust + pdf ops; `libreoffice`, `browser`, `ocr` gated for CI/runtime detection. `get_available_conversions` reports disabled engines as `available: false` with structured `install_guidance` — UI hard-blocks Start; never soft-available with a weak hint.

---

## Extension layout (create)

```
extensions/safeappeals-converter/
  package.json               # commands, views, menus, extensionKind: workspace
  src/
    extension.ts
    sidecarHost.ts           # spawn sa-converter, restart policy
    converterService.ts      # configure/convert/batch/merge/getAvailable/progress
    converterDashboard.ts    # webview provider
    pathGuard.ts             # workspace-relative allowlist before RPC
    agentTools.ts            # convertFile, batchConvert, mergePdfs, listConversions
    test/
  media/ / webview-src/      # dashboard UI (fidelity badges, batch, merge)
  bin/                       # dev symlink / rung-14 prebuild drop point for sa-converter
```

Reference UI: `void-reference/browser/react/src/file-converter-tsx/*` and `void-reference/common/fileConverterTypes.ts` — port concepts, not contrib wiring.

---

## Security

- **Paths only; allowlisted roots** from `configure` (workspace folders + explicit user picks). Reject path escape, `..`, and symlink escapes after `canonicalize`.
- **No arbitrary `file://` or remote URL fetch** in HTML→PDF (block external network in Chromium profile; strip/reject remote resources).
- **Timeouts** per job + global LO/Chromium watchdog; kill hang → restart worker → surface error.
- **LO isolation (mandatory):** dedicated user profile (not lawyer’s interactive LO profile); macros disabled (`macroexecutionmode=4` / equivalent); `concurrency = 1` for LO jobs; watchdog with per-job timeout + health ping; kill → restart budget → mark office-fidelity keys `available:false` until healthy.
- **LO restart policy:** crash/loop detection; max restarts; backoff; mark `office-fidelity` pairs unavailable until healthy.
- **Secrets:** PDF encrypt passwords via params for the job only — never log plaintext on stderr; no persistence in settings without machine scope.
- **Temp files:** under extension `storageUri` / OS temp with 0600; purge on success/fail.
- **Stdout hygiene:** never print non-JSON to stdout (breaks protocol).
- Align with local data security rules: converter does not invent a new plaintext case store; outputs land where the user chose (workspace).

---

## Implementation phases (ordered)

### P0 — Workspace, protocol, registry (blocks everything)

**Files:** create `rust/Cargo.toml`, `rust/converter/**`; touch nothing under `cli/`.

1. Workspace + bin `sa-converter`.
2. NDJSON loop: `configure`, `ping`, `shutdown`, `get_available_conversions` (static registry, all 38 keys present, most `available: false` initially).
3. `sandbox.rs` + job id / progress scaffolding.
4. Unit tests for framing, id correlation, path rejection.

**Exit:** process speaks protocol; registry lists full matrix with fidelity labels; court keys `available: false` until dep probe; `install_guidance` schema present; pure-Rust pairs not yet required to be `available: true`.

### P1 — Pure Rust core + PDF ops (CI without LO)

**Engines:** pdfium-render, lopdf, docx-rs, calamine, rust_xlsxwriter, comrak, ammonia, image, csv, epub-builder/rbook.

**Ship pairs (available=true):**  
`md2html`, `md2docx`, `md2epub`, `docx2md`, `docx2epub`, `html2epub`, `epub2html`, `epub2md`, `epub2docx`, `txt2pdf`, `xlsx2csv`, `xlsx2md`, `xlsx2html`, `csv2xlsx`, `csv2pdf`, `pptx2html`, `pptx2md`, `image2pdf`, `image2image`, `pdf2md` (text layer), `pdf2html`, `pdf2images`, plus PDF ops `pdf2compress`, `pdf2encrypt`, `pdf2split`, `pdf2watermark`, `pdf2pages`, and `merge_pdfs` / `batch_convert` for available types.

**Still unavailable until later phases (but listed):** Office→PDF LO defaults, `html2pdf` Chromium, OCR-heavy keys, `pdf2xlsx`, `pptx2images` if LO-backed.

**Tests:** golden fixtures per pair class under `rust/converter/fixtures/`; `cargo test` in CI **without** LO/Chromium features.

**Exit:** utility tier `available: true` without LO/Chromium; `merge_pdfs` + `pdf2split` golden fixtures green; court keys still hard-disabled if deps absent.

### P2 — Warm LibreOffice worker (mandatory)

**Model:** unoserver-style persistent worker managed by `sa-converter` (not cold `soffice` per request).

1. Detect soffice; start worker on first Office job or on `configure`.
2. Default `docx2pdf` / `xlsx2pdf` / `pptx2pdf` / `epub2pdf` → LO; mark `office-fidelity`.
3. Timeouts, health ping, restart, concurrency=1.
4. Feature `libreoffice`; CI job `converter-lo` optional/nightly with LO installed.

**Exit:** BYO LO detect; isolation checklist green (dedicated profile, macros off, concurrency=1, watchdog); Office→PDF fixtures green only when LO healthy; unhealthy → hard-disable (not weak hint).

### P3 — Chromium HTML→PDF + OCR stack

1. **browser-print:** headless Chromium/Chrome for `html2pdf` and high-quality `md2pdf` (md→html→print). Sandbox: no net, allowlisted dirs only.
2. **OCR:** `image2text`, scanned `pdf2md`, `pdf2ocr_layer`, `pdf2editable` (prefer wrapping battle-tested ocrmypdf **on-machine** if Rust OCR quality insufficient — still no SaaS; document as OCR engine dep).
3. Remaining hard pairs: `pdf2xlsx` (preview-fast warn), `pptx2images`.

**Exit:** browser detect order implemented (Chrome → Chromium → Electron); `html2pdf`/`md2pdf` court gate; OCR keys hard-disabled without tools; no false `available: true`.

### P4 — Extension host + dashboard

**Files:** create `extensions/safeappeals-converter/**`; register in `product.json` / built-in extension list per existing SafeAppeals pattern; **do not** add contrib under `src/vs/workbench/contrib`.

1. `SidecarHost` resolves `sa-converter` (dev: `rust/target/…`; prod: extension `bin/`).
2. `ConverterService` implements configure / convert / batch / merge / getAvailable / progress events.
3. Webview dashboard: all conversions from sidecar; fidelity warning when not `office-fidelity` / `browser-print` for court-ish targets; batch + merge panels.
4. Commands + explorer context menus.
5. **No hardcoded conversion map** in TS except optional display niceties that never filter out sidecar keys.

**Exit:** dashboard lists all keys; **Start disabled** + install guidance for `available: false`; fidelity badges; court vs utility clear.

### P5 — Agent tools + python retirement gate

1. Agent tools on the converter extension (convert, batch, merge, listConversions) — align with tools plan when that pass lands; converter owns the implementation.
   - Every tool result includes `fidelity` (+ `engine`, `available` deps used).
   - Filing-target types (`docx2pdf`, `xlsx2pdf`, `pptx2pdf`, `html2pdf`, `md2pdf`, merge for filing packs): require `confirm_filing: true` (or interactive confirm) when fidelity is court-class; refuse if `available: false`.
   - Never silently downgrade to preview-fast for filing-target exports.
2. **Parity checklist** (must be green before retiring `python/`):
   - [ ] All 38 keys implemented and tested at their default fidelity
   - [ ] merge + batch parity with `python/transmutation_codex/services/{merger,batcher}.py`
   - [ ] PDF ops parity (compress, encrypt, split, watermark, pages, ocr_layer, editable)
   - [ ] Alias `pdf2ocr` → `pdf2ocr_layer`
   - [ ] Dynamic `get_available_conversions` drives UI
   - [ ] Warm LO path for Office→PDF (not cold spawn)
   - [ ] Chromium path for html2pdf
   - [ ] Security tests (path escape, timeout, LO restart)
   - [ ] Golden CI (no LO) + LO CI job green
   - [ ] **False-completeness gate:** no court key reports `available:true` without a successful dep probe + health check in the same session
   - [ ] UI cannot start hard-disabled court conversions (blocked control, not toast-only)
   - [ ] Agent cannot complete filing-target export without fidelity in the response and confirm when required
   - [ ] No soft-list / weak-hint path that runs lossy engines while labeling court fidelity
   - [ ] Tiered success: court-critical fixtures green with deps; utility always-on fixtures green without deps
   - [ ] LO isolation exit criteria met (dedicated profile, macros off, concurrency=1, watchdog)
   - [ ] Chromium detect order documented and implemented (Chrome → Chromium → Electron)
3. After green: stop shipping/invoking `python/` for converter; **delete `python/` at rung 15** (per settled ladder), not earlier.

**Exit:** agent tools return `fidelity` on every result; filing-target exports require explicit confirm; parity checklist incl. false-completeness gate green.

### P6 — Packaging note (rung 14 executes)

Document (do not fully implement packaging here — **design doc only**; v1 remains BYO):

- Per-platform `sa-converter` binaries (same matrix pain as time-tracker / rag-core — see `WINDOWS-PREBUILDS-TODO.md`).
- Runtime deps: LibreOffice, Chromium/Chrome or bundled headless, Tesseract/ocrmypdf as needed — **size/CVE/platforms analysis for optional bundle** (not pretend bundled now).
- Extension `bin/` layout + checksum; missing deps → hard-disable + install guidance (BYO v1).
- `product.json` / build scripts include the extension.

**Exit:** packaging design doc complete (binary prebuilds + size/CVE/platforms for optional bundle) — v1 remains BYO.

---

## Test strategy

| Layer | What | Where |
|-------|------|--------|
| Protocol | framing, errors, cancel | `rust/converter/tests/protocol_tests.rs` |
| Golden pure | one fixture per pair class (md, docx extract, xlsx/csv, pdf text, image, epub semantic, pdf-ops) | `fixtures/` + `cargo test` |
| LO | docx/xlsx/pptx/epub→pdf smoke + visual/hash tolerance | `--features libreoffice`, CI profile `converter-lo` |
| Browser | html2pdf CSS smoke | `--features browser` |
| OCR | scanned PDF fixture | `--features ocr` |
| Extension | sidecar mock + service unit tests; smoke launch | `extensions/safeappeals-converter/src/test/` |
| Security | path traversal, symlink, timeout kill | Rust + extension |

**CI default:** pure Rust + pdf ops only. **Optional/nightly:** LO + browser + OCR.

---

## Risks and blast radius

| Risk | Mitigation |
|------|------------|
| Warm LO flaky / zombie soffice | watchdog, restart budget, mark pairs unavailable (hard-disable) |
| False completeness (court key `available:true` without healthy dep) | hard-disable rule + parity gate; dep probe + health check in same session |
| BYO missing on lawyer machine | install guidance + blocked UI; not silent lossy fallback |
| pdfium native linking / platform matrix | feature flags; rung 14 prebuilds; linux-first in P1 |
| Chromium supply (license/size) | prefer system Chrome/Chromium; document bundle decision at rung 14 (P6 design only) |
| OCR quality vs Python/ocrmypdf | allow ocrmypdf CLI as OCR engine backend; same fidelity label |
| Master plan drift (“LO unsupported”) | this file overrides; update master pointers at implement |
| Accidental python deletion before parity | hard gate checklist; delete only rung 15 |
| documents/converter confusion | clear command namespaces `safeappeals-converter.*` |
| Calamine formula destruction | converter **export** paths only; do not replace documents save path |

---

## Docs to update (at implement — not a master rewrite now)

- `.cursor/plans/safeappeals_master_plan.plan.md` — `r8-converter` todo + Rung 8 converter blurb + risk bullet “LibreOffice conversion pairs”: point to **this plan**; replace “unsupported / shell out only” with “warm LO worker (see converter plan)”.
- `.cursor/plans/upstream_vs_code_merge_spike_2245beba.plan.md` — Rust strategy Rung 8 LO risk paragraph: mark superseded by this plan.
- `docs/ADDED_FEATURES_TRACKER.md` — row for converter when P4 ships.
- Optional: vault decision note that warm LO is mandatory (scribe).

---

## Concrete files to create / touch

**Create:**

- `rust/Cargo.toml`
- `rust/converter/Cargo.toml`
- `rust/converter/src/**` (as laid out above)
- `rust/converter/fixtures/**`, `rust/converter/tests/**`
- `extensions/safeappeals-converter/**` (package.json, src, webview, tests, bin placeholder)
- `.cursor/plans/safeappeals_converter_r8_production.plan.md` (this file)

**Touch (implement time):**

- `product.json` / extension packaging lists (built-in SafeAppeals extensions)
- `.cursor/plans/safeappeals_master_plan.plan.md` (pointers only)
- `docs/ADDED_FEATURES_TRACKER.md`
- CI workflow under `.github/workflows/` (converter jobs)
- `WINDOWS-PREBUILDS-TODO.md` or packaging docs (rung 14 note)

**Reference only (do not revive as contrib):**

- `void-reference/common/fileConverterTypes.ts`
- `void-reference/electron-main/fileConverterChannel.ts`
- `void-reference/browser/react/src/file-converter-tsx/*`
- `python/transmutation_codex/**` (parity oracle until retirement)

**Do not create under:** `cli/`, `src/vs/workbench/contrib/void/`, or a TS/Python converter prototype.

---

## Assumptions (non-blocking)

1. System LibreOffice and Chromium are **BYO external deps for v1** (committed, not “may be”); bundling decision deferred to rung 14/P6 design doc.
2. Agent tools for converter may land in the same extension during P5 even if the global tools plan is elsewhere — converter owns the binary protocol.
3. `image2image` stays a first-class key (Python has it) even if UI de-emphasizes it.
4. Typst/Pandoc are optional; absence does not block parity if defaults cover all 38 keys.

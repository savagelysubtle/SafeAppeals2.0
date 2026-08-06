---
name: SafeAppeals R10 RAG (production)
overview: "Production Advanced RAG: safeappeals-rag + rust/rag-core. Hybrid BM25+vector+RRF, QP, CE; BGE-small. PDF: born-digital native extract; scanned Unlimited-OCR via consent-install when HwCapabilityProbe (safeappeals-ml) says machine fits. First-run: Getting Started step Private Search on This Computer (probe + Search pack + optional OCR) after Cloud wizard — not a 5th welcomeOnboarding step. Decoupled probe/catalog/artifacts/MlResourceEngine. Encrypted globalStorage; dual-ABI; tool contracts now / tools pass later."
todos:
  - id: d0-steve-decisions
    content: "D0: forks 1–19 including Local AI walkthrough in Getting Started (not 5th wizard step), soft Credits Handoff bridge, Search pack vs OCR consent split, sidecar docparse, HW probe in safeappeals-ml, consent-only install. Update master plan when approved."
    status: completed
  - id: m0-crate-skeleton
    content: "M0: Add rust/rag-core to rust/ workspace; napi-rs package @safeappeals/rag-core; dual-ABI prebuild layout + loader (mirror time-tracker); ping/version/capabilities; pin ort; NO product indexing yet. Depends: d0. (node-137 built; electron-146 follow-up)"
    status: completed
  - id: m0b-hw-probe
    content: "M0b: Create extensions/safeappeals-ml (or extract stub) — HwCapabilityProbe (GPU VRAM/RAM/CPU/disk/OS), ModelCatalog with Unlimited-OCR ModelSpec thresholds, snapshot API + unit tests with fakes. No downloads yet. Decoupled from Whisper/RAG. Depends: d0; can parallel m0."
    status: completed
  - id: m0c-local-ai-walkthrough
    content: "M0c (UX/plan+impl with M6): Getting Started step 'Private Search on This Computer' in safeappealsTimelineSetup (after howUsesAI); media markdown; command opens setup panel; CreditsHandoff secondary CTA. Depends: d0; impl with m0b+m6."
    status: completed
  - id: m1-storage-encrypt
    content: "M1: Per-workspace roots under context.globalStorageUri/rag/<workspaceId>/{core_references,case_index}; SQLCipher chunk/doc DB owned ONLY by rag-core (rusqlite/SQLCipher — not better-sqlite3 in host); DEK via SecretStorage + encryptedStore patterns; atomic writes; fail-closed if crypto unavailable. Depends: m0."
    status: completed
  - id: m1b-ingest-router
    content: "M1b: Ingest router — non-PDF native extract; PDF born-digital pdfium default; scanned detect (Void-like chars/page); if scanned→docparse only when catalog+artifacts ready else hard-disable; sealed intermediate MD; citation anchors. Depends: m1. (pdfium extract stub until later)"
    status: completed
  - id: m2-chunk-embed-vector
    content: "M2: Citation-aware hierarchical chunker (multi-granularity; max tokens ≤ embed window − margin); fastembed embedBatch (BGE-small default / MiniLM light); usearch HNSW persistence; indexChunks/removeDoc; unit + golden fixtures. Depends: m1."
    status: completed
  - id: m2a-docparse-sidecar
    content: "M2a: DocParseHost + UnlimitedOCRBackend (IDocParseBackend); ConsentInstallUX using M0b probe (download only if eligible+user OK); artifact SHA under globalStorageUri/ml-models; smoke test; ~40p cap; NOT in EH. Depends: m0b, m1b; can lag m2–m5. (runner/url pin follow-up)"
    status: completed
  - id: m3-hybrid-rrf
    content: "M3: tantivy BM25 (k1=0.8,b=0.5); RRF k=20 inside Rust search(); retrieve ~3–4× finalK; scope filters; stats. Depends: m2."
    status: completed
  - id: m4-query-processor
    content: "M4: Port void rule-based QueryProcessor into Rust; WIRE into search path (decompose → parallel sub-searches → merge/RRF); tool-scoped APIs still honor explicit scope. Llama-3.2-1B decomp OUT of v1. Depends: m3."
    status: completed
  - id: m5-reranker
    content: "M5 (Q4 resolved): ms-marco MiniLM cross-encoder via ort in rag-core; rerank after hybrid retrieve; capability-gate if model missing; BGE-reranker = later quality mode / rung-14 bundling note. Depends: m4."
    status: completed
  - id: m6-extension-host
    content: "M6: NEW extensions/safeappeals-rag — thin host, path allowlist, core_references watch/auto-index policy, status UI/commands, BYO/capability hard-disable when native/models missing; asarUnpack for .node + models. Depends: m5 (can overlap UI shell with m2+)."
    status: completed
  - id: m6b-local-ai-setup-panel
    content: "M6b: safeappeals-rag panel/webview Local AI Setup — educate → HwCapabilityProbe summary → consent Search pack (embed+CE) → conditional Unlimited-OCR offer → done/skip; machine-scoped completion; nls title-case. Uses safeappeals-ml only. Depends: m0b, m2a (OCR CTA can stub until m2a)."
    status: completed
  - id: m7-ml-engine-bridge
    content: "M7: Move MlResourceEngine into safeappeals-ml beside probe/catalog; add docparse kind (XOR whisper/diarization/embedding); wire audio+RAG consumers; DocParseAdapter load/unload sidecar. Depends: m2, m2a, m0b."
    status: completed
  - id: m8-tool-contracts
    content: "M8: Document + freeze tool contracts (inputs/outputs/errors) for five tools including citation shape in contextPack; optional package.json comments or internal types only — registration + agentTools.ts land in tools pass. Depends: m6."
    status: completed
  - id: m9-packaging-note
    content: "M9: Rung-14 packaging design note — dual-ABI matrix, Unlimited-OCR weights (~6.7GB) offline bundle vs BYO, embed/CE models, size/CVE, Windows prebuild procedure. Not pretend fully bundled in v1. Depends: m0. (docs/rag/packaging-rung-14.md)"
    status: completed
isProject: true
---

# SafeAppeals R10 RAG — Production Implementation Plan

## Recommendation

Ship Advanced RAG as **`rust/rag-core` + `safeappeals-rag`**. PDF ingest defaults to **born-digital native extract**. A **decoupled `safeappeals-ml`** layer owns **HwCapabilityProbe + ModelCatalog + ModelArtifactStore + MlResourceEngine**: if hardware meets Unlimited-OCR’s declared bar, **offer consent install** and enable the optional scanned-PDF `docparse` sidecar lane; if not, **never install** and keep Void-like born-digital extract with **hard-disable for scanned** (deliberately stricter than Void’s auto-Tesseract). RAG/Whisper only consume interfaces — next year’s OCR model is a catalog+adapter swap. Trade-off: quality OCR on capable GPUs vs honest gates on typical lawyer PCs; no silent downloads, no VLM in EH.

**First-run Local AI:** After Cloud onboarding (Sign In → Profile → Agent → Credits), a Getting Started step **Private Search on This Computer** opens a calm setup panel (probe → consent Search pack → optional Unlimited-OCR if eligible). Not a fifth welcomeOnboarding step; never auto-download. Complements `howUsesAI` (cloud) with on-device search education for lawyers new to local AI.

## Prior session notes

Settled (do not reopen): Rust-first; top-level `rust/`; Advanced RAG mandatory; tools deferred; dual-ABI; MlResourceEngine stub until RAG; no contrib hub; keep uncommitted converter/audio/dictation.

Thinker ADJUST (honor): decrypt-to-work warm plaintext window; SQLCipher in rag-core only; cite contract; EH crash isolation → VLM out of process; bind chunks to embed window.

Unlimited-OCR research: HF `baidu/Unlimited-OCR`, MIT, ~6–7GB / ≥~8GB VRAM official. REJECT as default all-PDF; ADJUST as optional scanned lane. Not chat model loader.

Steve (Aug 4): HW scanner in app → install Unlimited-OCR only if machine fits → else Void-like default; model loader + HW reader sophisticated but **decoupled and upgradeable**. Architect: **yes, that works** via `safeappeals-ml`.

Steve (Aug 4): First-run walkthrough page for scanner + model install + plain-language local AI education. Architect: Getting Started step + setup panel (not 5th wizard step).

---

## First-run Local AI walkthrough (committed)

### Placement
- **Primary:** Getting Started walkthrough step on `safeappealsTimelineSetup` (after `howUsesAI`).
- **Bridge:** Credits Handoff secondary action “Set Up Private Search” → open Getting Started / run `safeappeals-rag.setupLocalSearch`.
- **Not:** fifth mandatory `welcomeOnboarding` step (downloads must not block identity/credits).
- **Reopen:** Help / Getting Started / RAG status “Set Up Private Search”.

### Sequence vs Cloud
```
welcomeOnboarding: Sign In → Profile → Agent Intro → Credits Handoff
  (+ secondary CTA: Set Up Private Search)
→ Getting Started checklist:
  … → How Safe Appeals Uses AI (cloud) → Private Search on This Computer (local)
  → Add Credits → Connect …
```

Probe may **pre-warm** when the walkthrough step opens (read-only). **No download** until explicit consent on the setup panel.

### Panel ownership
`safeappeals-rag` UI; `safeappeals-ml` probe/catalog/artifacts. No Whisper. No chat model loader.

### Content beats (lawyer voice)

| Beat | Headline | UI |
|------|----------|-----|
| Walkthrough md | Your Case Files Can Stay on This Computer | Short contrast vs cloud chat; CTA **Open Private Search Setup** |
| 1 Educate | Search Without Sending the File Out | Local index vs cloud chat; drafting aid, you review |
| 2 Scan | Checking This Computer | Friendly: Graphics memory / Memory / Free disk → **Ready for scanned PDFs** or **Text PDFs only** + one-line reason (no CUDA jargon) |
| 3 Search pack | Install Search Tools | BGE-small + ms-marco CE; size; **Install Search Tools** / **Not Now** |
| 4 OCR (conditional) | Read Scanned PDFs (Optional) | If eligible: ~7GB Unlimited-OCR; **Install** / **Skip**. If ineligible: calm text-PDF-only message, no fake Install |
| 5 Done | You’re Set | What’s on / skipped; reopen later; **Continue to Getting Started** |

Skip always available. Completion: command finished or skip → machine-scoped `localAiSetup.completed`.

### Models: first-run vs deferred

| Model | First-run | Notes |
|-------|-----------|--------|
| Embed BGE-small | **Offer** (Search pack) | Needed for RAG |
| CE ms-marco MiniLM | **Offer** with Search pack | Same consent batch |
| Unlimited-OCR | **Offer only if eligible** | Separate consent |
| Whisper / diarization | **Defer** | Audio’s own setup |
| BGE reranker quality | **Defer** | Later |
| Converter LO/ffmpeg | **Defer** | R8/R14 |

### Copy principles
Title-case CTAs; no CUDA/VRAM jargon in primary UI (details behind “Technical details”); Calm/Focused; one CTA per beat.

---

## Architecture (committed)

```
┌─────────────────────────────────────────────────────────────────┐
│  extensions/safeappeals-ml  (shared — probe + catalog + engine) │
│  - HwCapabilityProbe (GPU/VRAM/RAM/CPU/disk/OS)                 │
│  - ModelCatalog (declarative ModelSpec thresholds)              │
│  - ModelArtifactStore (globalStorageUri/ml-models/, SHA, consent)│
│  - MlResourceEngine (XOR whisper|diarization|embedding|docparse)│
└───────────────┬─────────────────────────────┬───────────────────┘
                │                             │
                ▼                             ▼
┌───────────────────────────┐   ┌─────────────────────────────────┐
│  safeappeals-audio        │   │  safeappeals-rag                │
│  Whisper / Diarization    │   │  IngestRouter + DocParseHost    │
│  adapters only            │   │  UnlimitedOCRBackend            │
└───────────────────────────┘   │  → rust/rag-core (napi)         │
                                └──────────────┬──────────────────┘
                                               │ localhost
                                               ▼
                                ┌─────────────────────────────────┐
                                │  Unlimited-OCR sidecar          │
                                │  (CUDA/vLLM spike; NOT in EH)   │
                                └─────────────────────────────────┘
```

**Decoupling:** RAG asks `catalog.evaluate('unlimited-ocr', probe.snapshot())` → `{ eligible | ineligible, reasons[] }`. Next OCR model = new catalog entry + `IDocParseBackend` adapter; ingest router untouched. Whisper never imports Unlimited-OCR.

**Not in this rung:** electron-main IPC, navigator paths, Transformers.js in EH, silent Tesseract RAG, auto-download without consent, chat auto-RAG.

### Component boundaries

| Layer | Owns | Must not own |
|-------|------|--------------|
| `safeappeals-ml` | Probe, catalog, artifacts, heavy leases | Whisper weights, OCR inference, rag indexing |
| `safeappeals-rag` | Ingest, DocParseHost client, UI, PathGuard | HW probe impl, model download policy |
| `rag-core` | Chunk/embed/index/search/rerank | VS Code APIs, Unlimited-OCR runtime |
| Unlimited-OCR sidecar | PDF→Markdown | Indexing, embeddings |
| `safeappeals-audio` | Whisper/diarization adapters | Probe, OCR catalog |

### N-API surface (≈)

- `capabilities()` / `openWorkspace` / `closeWorkspace`
- `embedBatch` / `indexChunks` / `removeDoc` / `search` / `stats`
- Fusion/rerank **inside** `search`

---

## Document ingest (committed)

```
Non-PDF → native extract → Markdown/text

PDF:
  1) Native text extract (pdfium) + page metadata  ← always try first
  2) Scanned? (chars/page < threshold ≈ Void’s 50)
     NO  → use digital text (fidelity: digital)
     YES → probe+catalog.evaluate(unlimited-ocr)
           ├─ eligible + installed + sidecar OK
           │    → withLease(docparse) → Unlimited-OCR → MD + anchors
           ├─ eligible + not installed
           │    → HARD-DISABLE + ConsentInstall offer (no auto-download)
           └─ ineligible OR install/smoke failed
                → HARD-DISABLE + reasons (no Tesseract for RAG)
                         ↓
              chunk (≤ embed window − margin) → withLease(embedding) → index
```

**Void reference ladder** (do not copy OCR step): Docling/pdfjs extract → scanned detect → auto Tesseract via converter → sparse text on OCR fail. SafeAppeals keeps extract + scanned-detect semantics; replaces Tesseract with **Unlimited-OCR-or-disable**.

- Persist sealed intermediate Markdown for re-chunk without re-OCR.
- Citation contract: `{ sourceUri, page?, heading?, charRange? }` on every chunk / `contextPack`.
- Soft cap **~40 pages** per OCR job; split larger; don’t market “unlimited/100-page”.
- Prefer Rust page render → sidecar images over shipping PyMuPDF+torch beside converter.

---

## Hardware probe & model lifecycle (safeappeals-ml)

**Owns:** HwCapabilityProbe, ModelCatalog, ModelArtifactStore, MlResourceEngine.
**Does not own:** Whisper weights, Unlimited-OCR inference impl, rag-core indexing.

**ModelSpec** (Unlimited-OCR v1 example):
`id`, `minVramMb≈8192`, `minRamMb`, `diskMb≈7000`, `backends=['cuda-vllm'|spike]`, `sha256`, `pageSoftCap=40`

**Flows:**
1. `probe.snapshot()` → `catalog.evaluate(id)` → `{ eligible, reasons }`
2. If eligible && userConsent → `artifactStore.download+verify` → smoke parse → mark ready
3. If !eligible → **never download**
4. Ingest uses `IDocParseBackend` only when ready

**Install UX:**
- Probe on RAG activate + Settings “Local AI hardware” (machine-scoped)
- Eligible → **prompt** with size (~7GB), “stays on this machine”, SHA, cancel — never auto-download
- Store: `context.globalStorageUri/ml-models/unlimited-ocr/<version>/`
- Post-install smoke; fail → mark broken, unload, don’t claim ready
- Ineligible → show why (VRAM/RAM/disk); no install affordance that implies it will work
- Pre-bundle weights = rung-14 design only

**Upgrade:** new `ModelSpec` + backend adapter; `docparse` kind + ingest steps unchanged.

---

## Void semantics to preserve vs drop

**Preserve:** per-workspace isolation; dual scope; hierarchical chunking (embed-window-bound); BM25 0.8/0.5; RRF k=20; ~3–4× then rerank; ms-marco CE; five tool intents; `core_references/`; scanned detect idea.

**Enhance:** BGE-small default; citation-aware chunks; HW-gated Unlimited-OCR for scanned.

**Do not port:** electron-main IPC, navigator paths, Transformers.js, brute-force vectors, sqlite-vec, Void silent Tesseract for RAG, stale MMR claims.

---

## Security / storage design

**Root:** `context.globalStorageUri/rag/<workspaceHash>/{core_references,case_index}/` — never `~/.safe-appeals-*`.
Models: `globalStorageUri/ml-models/<id>/`.

**Keying:** one extension DEK + workspace AAD in SecretStorage; machine-scoped settings.

**At rest:** SQLCipher in rag-core only; sealed usearch/tantivy with honest decrypt-to-work + idle re-seal; sealed intermediate OCR MD; fail closed; no silent downloads; localhost-only VLM I/O.

**Purge:** wipe workspace RAG + model artifacts + DEK paths as appropriate.

---

## MlResourceEngine relationship

1. Lives in `safeappeals-ml` with probe/catalog (M7; probe can land M0b earlier).
2. Heavy kinds: **Whisper XOR Diarization XOR Embedding XOR DocParse**.
3. PDF scanned job: `withLease('docparse')` → MD → release → `withLease('embedding')` → index.
4. VLM never loads in EH; sidecar crash → `reportCrash('docparse')`, IDE stays up.

---

## Relationship to safeappeals-converter OCR

| Surface | Engine | Role |
|---------|--------|------|
| Converter | BYO Tesseract / ocrmypdf | Export & file conversion |
| RAG ingest | Unlimited-OCR when HW+consent ready | Index-quality scanned PDF→MD |

Do not replace converter OCR. Do not use Tesseract as silent RAG fallback.

---

## Tools pass relationship

R10 = engine + host + contracts + citation shape. Tools pass registers `safeappeals_rag_*`.

---

## Ordered milestones (deps)

`d0` → (`m0` ∥ `m0b`) → `m1` → `m1b` → `m2` → `m3` → `m4` → `m5` → `m6`/`m6b`/`m7` → `m8`
`m0c` walkthrough wiring with `m6`/`m6b`.
`m2a` after `m0b` + `m1b` (may lag core retrieval).
`m9` parallel after `m0`.

---

## Decision points for Steve (with architect calls)

| # | Fork | I'd do |
|---|------|--------|
| 1 | Embedder | **BGE-small default; MiniLM light** |
| 2 | Q4 CE | **ms-marco MiniLM in first cut** (engine milestone) |
| 3 | Query processor | **Wire in Rust `search()`** |
| 4 | Tool names | **`safeappeals_rag_*`** |
| 5 | Llama decomp | **OUT of v1** |
| 6 | RRF | **In Rust** |
| 7 | Encryption | **SQLCipher in rag-core + sealed indexes + honest decrypt-to-work** |
| 8 | Packaging | **BYO/gates now; bundle rung 14** |
| 9 | Unlimited-OCR deploy | **Sidecar + `docparse`** |
| 10 | Scanned w/o model | **Hard-disable** (not Void Tesseract) |
| 11 | Born-digital | **Native extract default** |
| 12 | Page cap | **~40 pages** |
| 13 | Runtime v1 | **Spike CUDA/vLLM sidecar**; don’t lock Ollama/llama.cpp |
| 14 | HW probe home | **`safeappeals-ml`** (not inside RAG or Whisper) |
| 15 | Install trigger | **Consent offer when eligible**; never auto-download; never install when ineligible |
| 16 | Void Tesseract for RAG? | **No** — export-only in converter |
| 17 | Local AI surface | **Getting Started step + setup panel**; not 5th wizard step |
| 18 | After onboarding | **Soft CTA on Credits Handoff** + open Getting Started on Local AI |
| 19 | Search pack bundling | **One consent for embed+CE**; OCR separate |

---

## Risks / blast radius

| Risk | Mitigation |
|------|------------|
| Probe false positive | Post-install smoke; fail-closed; re-probe on driver change |
| Probe false negative | Show raw VRAM/RAM; optional later “I know my hardware” override |
| Auto-download privacy | Consent UX mandatory; machine-scoped |
| Coupling probe into RAG/Whisper | All HW/catalog/engine in `safeappeals-ml` |
| Wizard fatigue + 7GB | Walkthrough not modal; Skip always |
| howUsesAI contradicts local | Explicit “two kinds of AI” contrast in Local AI step |
| Timeline owns walkthrough, RAG owns panel | Step in timeline package.json; command/panel in rag |
| VLM kills EH | Sidecar only |
| Long OCR blocks Whisper | Exclusive `docparse` + queue |
| Warm index plaintext | Idle re-seal; crash wipe |
| Electron ABI / win32 | Dual-ABI matrix; hard-disable until present |

**Tests:** probe fakes; catalog evaluate; consent/no-download; smoke fail path; golden chunk→index→hybrid→rerank; scanned hard-disable; sidecar crash isolation.

---

## Master plan touch-ups (after Steve approves)

- Point `r10-rag` at this file; resolve Q4; BGE-small; HW-gated Unlimited-OCR via `safeappeals-ml`; tools-pass absorbs `safeappeals_rag_*`.

---

## Explicit non-goals (v1)

TS-first; contrib hub; Qdrant/Lance; hosted rerank; MiniLM-only default; Llama query decomp; chat auto-RAG; void embeddings migration; ripping converter/audio; in-process Unlimited-OCR; auto-download without consent; HW probe inside Whisper or rag-core; Void silent Tesseract as RAG fallback; claiming unbounded page counts; bundling 6.7GB OCR weights in v1 app; fifth onboarding wizard step; Whisper in Local AI first-run; replacing `howUsesAI` cloud copy with local-only messaging.

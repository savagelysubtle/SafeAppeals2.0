<!-- Copyright (c) Safe Appeals. All rights reserved. -->

# RAG packaging (Rung 14 / M9)

Design note for shipping **`@safeappeals/rag-core`** natives and Local AI model packs.
**v1 is not a full offline bundle.** BYO paths and consent install ship first; installer
bundling of heavy weights is a later packaging decision, not a claim about the current
product tree.

Authoritative native-ABI procedure: [`rust/rag-core/PREBUILDS.md`](../../rust/rag-core/PREBUILDS.md).

---

## Dual-ABI matrix

Desktop SafeAppeals is Electron (**NODE_MODULE_VERSION 146**). Tests / plain Node 24 use
**137**. The host loads:

```text
prebuilds/<platform>-<arch>/<runtime>-<abi>/rag_core.node
```

| Target | Runtime | Status (today) |
|--------|---------|----------------|
| `linux-x64` / `node-137` | Node 24.x | **Built** — present under `rust/rag-core/prebuilds/` |
| `linux-x64` / `electron-146` | Electron 42.x | **Built** (N-API copy / Electron smoke) |
| `win32-x64` / both ABIs | Node 24 + Electron 42 | **Built** on Windows — must be committed before Inno setup |
| Other platforms | same pattern | Follow PREBUILDS.md when a matching host is available |

Installer gate: `npm run verify-native-prebuilds:win32` (also runs before `vscode-win32-*-setup`).
See [`docs/development/WINDOWS_PACKAGING.md`](../development/WINDOWS_PACKAGING.md).

Missing matching `.node` → `loadRagCore()` fail-soft → host **hard-disables** Private Search
(no crash). Do not ship a wrong-ABI binary; wrong natives fail open or crash unpredictably.

Build / smoke details stay in PREBUILDS.md (`bun run build:prebuild`, `bun run test:native`).

---

## Model packs — what v1 actually ships

| Pack | Contents | Approx. disk | v1 delivery |
|------|----------|--------------|-------------|
| **Search pack** | BGE-small-en-v1.5 + ms-marco MiniLM-L-6-v2 CE | ~200 MB + ~150 MB (catalog) | Consent install / BYO — **not** in the app installer |
| **Unlimited-OCR** | HF `baidu/Unlimited-OCR` weights | ~6.7–7 GB (`diskMb≈7000`); ≥~8 GB VRAM | Consent install **only if** `HwCapabilityProbe` eligible — **never** auto-download; **not** bundled in v1 |

Fork 8 / non-goal: do **not** pretend 6.7 GB OCR weights are inside the v1 app. Offline
enterprise bundle is a rung-14 **option** for later ops (pinned URL + SHA, or media ship),
not the default download story.

ONNX Runtime shared libs may come from ort’s `download-binaries` at build/runtime; that is
**not** model-weight packaging. Embed/CE weights remain BYO via
`SA_RAG_EMBED_MODEL_DIR` / `SA_RAG_CE_MODEL_DIR` until Search-pack consent wiring lands.

---

## Search pack artifact layout (full HF dirs)

rag-core loads **directories**, not lone ONNX blobs.

**Embed (BGE-small)** — `FastEmbedEmbedder::from_model_dir`:

- Required: `model.onnx` (or `onnx/model.onnx` / `model_optimized.onnx`), `tokenizer.json`
- Expected alongside: `config.json`, `special_tokens_map.json`, `tokenizer_config.json`

**CE (ms-marco MiniLM)** — `OrtCrossEncoder::from_model_dir`:

- Required: `model.onnx` (or `onnx/model.onnx`), `tokenizer.json`

Consent / offline packs must deliver **full HuggingFace-style export trees** under
`globalStorageUri/ml-models/<id>/<version>/` (or equivalent BYO dirs). A single-file
`model.onnx` without tokenizer/config is insufficient for production load.

Catalog ids today: `bge-small-en-v1.5`, `ms-marco-minilm-l6-v2`, `unlimited-ocr`
(`extensions/safeappeals-ml` ModelCatalog). One consent batch for embed+CE; OCR is a
separate eligible-only offer.

---

## Size, CVE, and supply chain

- **Installer size:** keep v1 lean — natives + host only. Search pack (~hundreds of MB) and
  OCR (~7 GB) stay out of the default download.
- **Pins:** catalog `sha256` + `downloadUrl` before any consent download; refuse until set.
- **Unlimited-OCR:** HF `baidu/Unlimited-OCR` commit `d549bb9d6a055dbe291408916d66acc2cd5920f6` (12-file pack, ~6.7 GB weights).
- **ort pin:** `=2.0.0-rc.13` (see PREBUILDS.md) — bump deliberately with CVE review.
- **Native CVE surface:** treat committed `.node` like any native dependency — rebuild on
  toolchain/dep advisories; prefer missing binary over a stale/wrong one.
- **BGE-reranker:** deferred quality mode; not part of the Search pack or v1 bundle.

---

## Windows prebuild procedure (outline)

Mirror time-tracker dual-ABI discipline; details for rag-core live in PREBUILDS.md.

1. On a **Windows** box with MSVC (+ OpenSSL / pkg-config as required by SQLCipher features).
2. **Node 24.x** so `process.versions.modules === '137'` (wrong Node → wrong folder name).
3. From `rust/rag-core`: `bun install` → `bun run build:prebuild` → smoke (`bun run test:native`).
4. Produce **electron-146** against Electron **42.x** headers (same major as the desktop shell);
   install/copy into `prebuilds/win32-x64/electron-146/rag_core.node`.
5. Commit both ABIs only after smoke; never restore an old plaintext-era binary if features
   (SQLCipher / ort) changed — missing is safer than fail-open.

Cross-compiling Windows Electron ABI from Linux is **not** supported.

---

## Honest v1 checklist

- [x] Document dual-ABI + model layout (this note)
- [x] `linux-x64/electron-146` prebuild
- [x] `win32-x64` node-137 + electron-146 (commit + verify before Windows installer)
- [x] Pinned Search-pack download URLs / digests (HF Xenova commit pins via ModelCatalog `files[]`)
- [x] Pinned Unlimited-OCR download URLs / digests (HF baidu/Unlimited-OCR @ d549bb9)
- [ ] Optional offline media / enterprise OCR bundle (explicit product decision)

Private Search still needs Search-pack weights (consent/BYO). Missing **natives** hard-disable search; missing **models** is a separate gate.

---

## sa-docparse sidecar (Unlimited-OCR HTTP)

Local dev / packaging copy for the ML extension sidecar:

```bash
cargo build -p docparse --release
cp rust/target/release/sa-docparse extensions/safeappeals-ml/bin/
mkdir -p extensions/safeappeals-ml/bin/python
cp rust/docparse/python/infer_unlimited_ocr.py extensions/safeappeals-ml/bin/python/
```

`DocParseSidecarHost` resolves `extensionPath/bin/sa-docparse` (or `SAFEAPPEALS_DOCPARSE_PATH`) and sets `SA_DOCPARSE_INFER_SCRIPT` to the bundled Python helper when present.

# safeappeals-rag packaging notes (M6)

Copyright (c) Safe Appeals. All rights reserved.

## Native addon (`@safeappeals/rag-core`)

- Dependency: `"@safeappeals/rag-core": "file:../../rust/rag-core"`.
- Dual-ABI prebuilds live under `rust/rag-core/prebuilds/<platform>-<arch>/<runtime>-<abi>/rag_core.node`.
- Extension `.vscodeignore` **keeps** `node_modules/@safeappeals/rag-core/**` (including `prebuilds/**`) so the `.node` ships in the VSIX.
- Prefer `asarUnpack` for `**/*.node` when the product packaging pipeline supports it (Electron cannot `require` native addons from inside asar).

## ABI status

| Runtime | ABI | linux-x64 status |
|---------|-----|------------------|
| Node 24 (tests / code-web) | 137 | Built — unit/integration path works |
| Electron 42 (desktop shell) | 146 | **Missing** — Private Search hard-disables on desktop until `electron-146` is produced |

See `rust/rag-core/PREBUILDS.md` for build steps. **Do not block M6** on electron-146 if the node-137 path works for tests.

## Models (Search pack)

- Embed: `SA_RAG_EMBED_MODEL_DIR` (BGE-small)
- CE: `SA_RAG_CE_MODEL_DIR` (ms-marco MiniLM)
- Host syncs these from `safeappeals-ml` artifact dirs when ready; BYO dirs honored when already set.
- Search pack (BGE + ms-marco CE) is **commit-pinned** in `safeappeals-ml` `ModelCatalog` via per-file `files[]` entries (Hugging Face Xenova repos) with pack-level and per-file `sha256` digests. Consent install succeeds when the user confirms via **Settings → Install Missing Models** or command `safeappeals-rag.installMissingModels`.
- **Unlimited-OCR** is **HF commit-pinned** in `safeappeals-ml` `ModelCatalog` (`files[]` under `baidu/Unlimited-OCR` @ `d549bb9…`) with pack-level and per-file `sha256` digests. Consent install succeeds when HW eligible + user confirms via **Set Up Private Search** or `safeappeals-ml.installUnlimitedOcr`. Sidecar must be running separately (BYO vLLM/sglang).

## Honest gaps (not faked in M6)

- Born-digital PDF extract uses sa-converter sidecar; scanned PDF OCR uses Unlimited-OCR when HW+consent+sidecar ready.
- electron-146 prebuild missing for packaged Electron.
- MlResourceEngine / agent tools = M7 / M8.
- Intermediate usearch/tantivy work files are not sealed when cold (SQLCipher owns chunk DB encryption).

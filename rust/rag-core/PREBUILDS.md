# rag-core dual-ABI prebuilds

`@safeappeals/rag-core` ships a napi-rs native addon. The host loads it from
committed (or CI-produced) binaries under `prebuilds/`, because the SafeAppeals
desktop shell is Electron (ABI **146**) while unit/integration tests and
`code-web` use plain Node (ABI **137**).

Layout mirrors `extensions/time-tracker`:

```
prebuilds/<platform>-<arch>/<runtime>-<abi>/rag_core.node
```

## ABI matrix (v1 priority)

| Platform  | Runtime       | `process.versions.modules` | Path |
|-----------|---------------|----------------------------|------|
| linux-x64 | Electron 42.x | 146 | `prebuilds/linux-x64/electron-146/rag_core.node` |
| linux-x64 | Node 24.x     | 137 | `prebuilds/linux-x64/node-137/rag_core.node` |
| win32-x64 | Electron 42.x | 146 | `prebuilds/win32-x64/electron-146/rag_core.node` |
| win32-x64 | Node 24.x     | 137 | `prebuilds/win32-x64/node-137/rag_core.node` |

Additional platforms (darwin-arm64, …) follow the same pattern and
are produced on the matching host OS. Cross-compiling Windows from Linux is
not supported.

## Build (current host Node ABI)

From `rust/rag-core` (fnm + bun preferred):

```bash
# ensure Node via fnm, then:
bun install
bun run build:prebuild
# equivalent:
#   bunx napi build --platform --release --no-js
#   bun run install-prebuild
```

`--no-js` keeps the dual-ABI loader (`index.js` / `nativeLoader.js`) instead of napi-rs’s default platform loader.

That builds for the **current** runtime (usually Node) and copies into
`prebuilds/<platform>-<arch>/node-<modules>/rag_core.node`.

Smoke:

```bash
bun run test:native
# or
node ./scripts/smoke-native.js
```

## Status

- **linux-x64 / node-137** — present (`hybrid:true`, `queryProcessor:true`,
  `rerank` typically `false` without CE weights, `storageReady:true`, `dims:384`).
  Verify with `bun run test:native`.
- **linux-x64 / electron-146** — present for Electron **42.6.0** (ABI 146).
  Verify with `../../scripts/node-electron.sh ./scripts/smoke-native.js` from
  `rust/rag-core` (requires `.build/electron` from a desktop gulp fetch).
- **win32-x64 / node-137 + electron-146** — present. Built on Windows with MSVC,
  **Strawberry Perl** (for vendored OpenSSL), and
  `--no-default-features -F "sqlcipher-vendored fastembed cross-encoder"`.
  Smoke: `bun run test:native` (Node). Electron slot is a copy of the N-API
  Node artifact (see below).

`rag-core` is built with **N-API** (`napi` feature), so a Node-built `.node` can
load under Electron when ABIs differ — install into the electron-146 slot via
`node-electron.sh` / `node-electron.bat` (below) or by copying the node-137
prebuild. Do **not** use `napi build --target electron-42.6.0`:
napi-cli 3.x expects Rust target triples, not Electron version strings.

### Windows build notes

```bat
cd rust\rag-core
bun install
REM needs: VS Build Tools C++, Strawberry Perl on PATH, cargo
napi build --platform --release --no-js --no-default-features -F "sqlcipher-vendored fastembed cross-encoder"
node .\scripts\install-prebuild.js
mkdir prebuilds\win32-x64\electron-146 2>nul
copy /Y prebuilds\win32-x64\node-137\rag_core.node prebuilds\win32-x64\electron-146\rag_core.node
node .\scripts\smoke-native.js
```

Default `sqlcipher` (system OpenSSL) is awkward on Windows; prefer
`sqlcipher-vendored`. Perl is required to compile OpenSSL from source.

## Electron ABI (146)

Preferred install (uses the already-built Node artifact, places it under
`electron-146` because `process.versions.modules === '146'` inside Electron):

```bash
# From repo root — needs .build/electron (gulp electron once)
bun run build:prebuild   # from rust/rag-core, if you need a fresh .node
../../scripts/node-electron.sh ./scripts/install-prebuild.js
../../scripts/node-electron.sh ./scripts/smoke-native.js
```

Manual copy of an existing N-API `.node`:

```bash
mkdir -p prebuilds/linux-x64/electron-146
cp rag_core.linux-x64-gnu.node prebuilds/linux-x64/electron-146/rag_core.node
# or: cp prebuilds/linux-x64/node-137/rag_core.node prebuilds/linux-x64/electron-146/rag_core.node
```

## Fail soft

If the matching `.node` is missing, `loadRagCore()` returns
`{ ok: false, error, expectedPath }` — the future `safeappeals-rag` host must
hard-disable Private Search rather than crash the extension host.

## ort pin (M2 / M5)

ONNX Runtime is pinned to match fastembed 5.17.x and reused by the CE:

```toml
ort = { version = "=2.0.0-rc.13", optional = true, default-features = false, features = [
  "ndarray", "std", "api-24", "download-binaries", "tls-native",
] }
```

| Feature | Enables |
|---------|---------|
| `fastembed` | `dep:fastembed` + `dep:ort` — BGE embed BYO via `SA_RAG_EMBED_MODEL_DIR` |
| `cross-encoder` | `dep:ort` + `dep:tokenizers` — ms-marco CE BYO via `SA_RAG_CE_MODEL_DIR` |

Runtime binaries may download via ort’s `download-binaries` (ONNX Runtime shared
libs — **not** model weights). Embedding and CE weights are **BYO** (see README).

### MiniLM light — deferred

The optional MiniLM-L6 light embed path is a **stub** in M2 (`EmbedModelKind::MiniLmL6V2Light`).
It is not wired for production load or Search-pack install. Ship BGE-small only until a
later milestone implements the light model pack.

## SQLCipher (M1)

Chunk/document storage uses **rusqlite** with a **bundled SQLCipher** build.
Plain (unencrypted) SQLite is never used for the workspace DB — opening a file
with the plaintext `"SQLite format 3"` magic hard-fails.

### Cargo features

| Feature | Meaning |
|---------|---------|
| `sqlcipher` (**default**) | `rusqlite/bundled-sqlcipher` — compiles SQLCipher from source; links **system OpenSSL** (`libssl-dev` / `pkg-config libcrypto`) |
| `sqlcipher-vendored` | `rusqlite/bundled-sqlcipher-vendored-openssl` — same SQLCipher, but vendors OpenSSL (use when system OpenSSL headers are missing) |

```bash
# Default (system OpenSSL):
cargo test -p rag-core

# Vendored OpenSSL fallback:
cargo test -p rag-core --no-default-features --features sqlcipher-vendored
```

Mutating N-API calls return `{ ok, error }` (`OpResult`) instead of throwing via
`napi::Error`, so `cargo test` links without a Node runtime. The JS wrappers in
`index.js` / `index.ts` throw on `!ok`.

Linux build packages typically needed for the default feature:

```bash
sudo apt-get install -y build-essential pkg-config libssl-dev
```

N-API prebuilds (`bun run build:prebuild`) enable **`fastembed`** and **`cross-encoder`**
(see `package.json` `napi build … -F "fastembed cross-encoder"`). A SQLCipher-only
prebuild cannot load Search pack weights even when `SA_RAG_*` dirs are set.
Document any ABI-specific link flags here if CI diverges from the default.

### Host contract

- DEK: exactly **32 bytes** (AES-256), passed into `openWorkspace(rootDir, dekBytes)`.
- DB path: `{rootDir}/chunks.db` (host places `rootDir` under
  `context.globalStorageUri/rag/<workspaceId>/{core_references,case_index}/`).
- `capabilities().storageReady === true` when the addon was built with a SQLCipher feature.

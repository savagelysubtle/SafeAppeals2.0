<!-- Copyright (c) Safe Appeals. All rights reserved. -->

# Windows packaging & fresh installs

SafeAppeals end users on a **fresh PC** must install the app and use Time Tracker +
Private Search **without** installing MSVC, Rust, Perl, Node, or rebuilding natives.

That means **every Windows desktop build / Inno installer** must already contain the
native `.node` binaries produced on a Windows build agent (or this machine), then
committed or published as part of the release artifact.

## What the installer must ship

| Component | Where it lives in the tree | What the user gets |
|-----------|----------------------------|--------------------|
| Time Tracker SQLCipher | `extensions/safeappeals-time-tracker/prebuilds/win32-x64/{electron-146,node-137}/better_sqlite3.node` | Encrypted billing DB |
| RAG core (Private Search) | `rust/rag-core/prebuilds/win32-x64/{electron-146,node-137}/rag_core.node` | On-device search engine |
| Root Electron natives | Built during `npm install` / package on the **build agent** into `node_modules` (policy-watcher, spdlog, sqlite3, windows-*, …) | Core shell |

Optional later (not required for install):

- Search pack model weights (~hundreds of MB) — consent / BYO, not default installer
- Unlimited-OCR weights (~7 GB) — never in default installer

## Dual-ABI rule

| Runtime | ABI | Folder |
|---------|-----|--------|
| Electron 42.x (desktop) | 146 | `electron-146/` |
| Node 24.x (tests / tools) | 137 | `node-137/` |

Desktop Run Dev and the installed app load **electron-146**. Missing that folder →
fail-soft banners (Time Tracker memory-only, Private Search unavailable).

## Build-machine only (never end-user)

Produce prebuilds on Windows with:

1. **Node 24.x** (`abi=137`) via fnm — see `.nvmrc`
2. VS 2022 Build Tools (C++), **Spectre-mitigated libs** (MSB8040 otherwise)
3. Python 3.12 (node-gyp) — e.g. `uv python install 3.12`
4. For rag-core: Rust stable, **Strawberry Perl** (vendored OpenSSL), bun

### Time Tracker

```bat
cd extensions\safeappeals-time-tracker
npm install
npm run rebuild-prebuilds
```

See `extensions/safeappeals-time-tracker/PREBUILDS.md`.

### rag-core

```bat
cd rust\rag-core
bun install
napi build --platform --release --no-js --no-default-features -F "sqlcipher-vendored fastembed cross-encoder"
node .\scripts\install-prebuild.js
mkdir prebuilds\win32-x64\electron-146 2>nul
copy /Y prebuilds\win32-x64\node-137\rag_core.node prebuilds\win32-x64\electron-146\rag_core.node
node .\scripts\smoke-native.js
```

See `rust/rag-core/PREBUILDS.md`.

### Root app natives (packaging agent)

On the Windows packager, after checkout:

```bat
fnm use
npm install
npm rebuild
```

`.npmrc` pins Electron 42 headers so addons match the shell. Spectre MSVC libs must
be installed on the agent or `@vscode/deviceid` / friends fail MSB8040.

## Gate: do not ship without prebuilds

```bat
npm run verify-native-prebuilds:win32
npm run verify-native-prebuilds:all
```

Windows Inno setup tasks (`vscode-win32-*-setup`) run the win32 verifier first and
**fail the build** if required `.node` files are missing or suspiciously small.

## Packaging flow (high level)

1. Commit (or CI-artifact) dual-ABI prebuilds for win32-x64.
2. On Windows agent: `npm install` + `npm rebuild` (Electron ABI for root natives).
3. `npm run gulp vscode-win32-x64` (or product pipeline equivalent).
4. `npm run gulp vscode-win32-x64-user-setup` / system setup — verifier runs here.
5. Distribute the Inno installer only.

End users: install → launch. No compile step.

## Product version vs API version

- `product.json` `version` — marketing (e.g. `2.1.0`)
- `product.json` `vscodeVersion` — reported as `vscode.version` to extensions (e.g. `1.107.0`)

Language clients require `^1.91.0`. Marketing 2.x alone breaks them; keep `vscodeVersion`
on the 1.x API line.

## Checklist before a Windows release

- [ ] `npm run verify-native-prebuilds:win32` passes on a clean checkout (no local rebuild)
- [ ] Time Tracker: create entry → restart app → data still present (not memory-only toast)
- [ ] Private Search: no “rag-core native addon not found for electron-146 (win32-x64)”
- [ ] JSON / HTML / CSS language features activate (no `^1.91.0` vs `2.1.0` error)
- [ ] Installer size still excludes Search-pack / OCR weights

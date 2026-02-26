# PDF Viewer Build Guide

## Overview

The PDF viewer requires two separate build steps:

1. **Rust WASM crate** — compiles `wasm/src/` → `wasm/pkg/` → copies to `media/wasm/`
2. **TypeScript bundle** — bundles `media/main.ts` (+ modules) → `media/pdfRustViewer.js` via esbuild

Additionally, the **PDFium binary** must be downloaded separately (it is not built from source).

---

## Prerequisites

### Rust Toolchain

```powershell
# Install Rust (if not already installed)
# https://rustup.rs/

# Add the WASM target
rustup target add wasm32-unknown-unknown
```

### wasm-bindgen CLI

The `wasm-bindgen` CLI version must match the `wasm-bindgen` crate version in `Cargo.toml`.

```powershell
cargo install wasm-bindgen-cli
```

> Check `wasm/Cargo.toml` for the current `wasm-bindgen` version and install the matching CLI:
> ```powershell
> cargo install wasm-bindgen-cli --version 0.2.x  # match Cargo.toml
> ```

### Node.js

Required for esbuild (the TypeScript bundler).

```powershell
# Verify Node.js is available
node --version
```

### PDFium Binary (one-time setup)

The PDFium Emscripten binary is not built from source — it is pre-compiled and must be downloaded.

```powershell
# From the media/wasm directory
cd src\vs\workbench\contrib\void\browser\documentViewers\pdfViewer\media\wasm
node download-pdfium.mjs
```

This downloads `pdfium.js` and `pdfium.wasm` (~10 MB compressed, ~30–46 MB uncompressed) from `paulocoutinhox/pdfium-lib`.

> **Important**: Do NOT use `bblanchon/pdfium-binaries` for the WASM target — their WASM builds use a non-growable heap that crashes on multi-page PDFs. Use the `paulocoutinhox/pdfium-lib` distribution only.

The files are placed in:
```
media/wasm/pdfium.js
media/wasm/pdfium.wasm
```

---

## Build Steps

### Full Build (Rust WASM + TypeScript)

#### Windows (PowerShell)

```powershell
cd src\vs\workbench\contrib\void\browser\documentViewers\pdfViewer\wasm
.\build.ps1
```

The `build.ps1` script runs all four steps automatically:

```
[1/4] Building Rust WASM (release)...
      cargo build --target wasm32-unknown-unknown --release

[2/4] Running wasm-bindgen...
      wasm-bindgen --target web --out-dir pkg/ target/.../pdf_viewer.wasm

[3/4] Copying artifacts to media/wasm/...
      Copies pdf_viewer_bg.wasm, pdf_viewer.js, pdf_viewer.d.ts

[4/4] Building TypeScript bundle...
      node media/build.mjs  →  media/pdfRustViewer.js
```

#### Linux / macOS (Bash)

```bash
cd src/vs/workbench/contrib/void/browser/documentViewers/pdfViewer/wasm
./build.sh
```

---

### TypeScript Bundle Only

When only TypeScript files changed (no Rust changes):

```powershell
cd src\vs\workbench\contrib\void\browser\documentViewers\pdfViewer\media
node build.mjs
```

Or in watch mode for development:

```powershell
node build.mjs --watch
```

Changes to any of these source files trigger a re-bundle:
- `main.ts`
- `renderer.ts`
- `sidebar.ts`
- `annotations.ts`
- `signatures.ts`
- `wasm/pdf_viewer.js` (generated)

---

### Rust WASM Only (manual steps)

If you need to run build steps individually:

```powershell
# Step 1: Compile Rust to WASM
cargo build --target wasm32-unknown-unknown --release
# Output: wasm/target/wasm32-unknown-unknown/release/pdf_viewer.wasm

# Step 2: Generate JS bindings
New-Item -ItemType Directory -Path pkg -Force | Out-Null
wasm-bindgen --target web --out-dir pkg/ target/wasm32-unknown-unknown/release/pdf_viewer.wasm
# Output: pkg/pdf_viewer.js, pkg/pdf_viewer_bg.wasm, pkg/pdf_viewer.d.ts

# Step 3: Copy to media/wasm/
Copy-Item pkg/pdf_viewer_bg.wasm ../media/wasm/ -Force
Copy-Item pkg/pdf_viewer.js ../media/wasm/ -Force
Copy-Item pkg/pdf_viewer.d.ts ../media/wasm/ -Force
```

---

## Generated Files

After a successful build, these files exist in `media/wasm/`:

| File | Source | Description |
|---|---|---|
| `pdf_viewer_bg.wasm` | Rust build | Rust WASM binary (pdfium-render wrapper) |
| `pdf_viewer.js` | wasm-bindgen | JavaScript glue for the Rust WASM module |
| `pdf_viewer.d.ts` | wasm-bindgen | TypeScript type declarations |
| `pdfium.js` | PDFium download | Emscripten glue for native PDFium |
| `pdfium.wasm` | PDFium download | Native PDFium compiled to WebAssembly |

And in `media/`:

| File | Source | Description |
|---|---|---|
| `pdfRustViewer.js` | esbuild | Bundled TypeScript (IIFE format) |

---

## After Building

Reload the VSCode window to pick up the new build:

**Ctrl+Shift+P** → `Developer: Reload Window`

Then open any `.pdf` file to test the viewer.

---

## Dependency Details

### Rust Crate Dependencies (Cargo.toml)

| Crate | Version | Purpose |
|---|---|---|
| `wasm-bindgen` | 0.2 | JS ↔ Rust interop |
| `pdfium-render` | git/master | Rust bindings for PDFium |
| `serde` | 1.0 | Serialization (with derive) |
| `serde_json` | 1.0 | JSON encoding for WASM ↔ JS boundary |
| `console_error_panic_hook` | 0.1 | Route Rust panics to browser console |
| `js-sys` | 0.3 | JavaScript standard types |
| `web-sys` | 0.3 | Web APIs (`ImageData`, `console`) |
| `wasm-bindgen-futures` | 0.4 | Async WASM support |

The `pdfium-render` crate is pinned to the git `master` branch with `default-features = false` and `features = ["pdfium_latest", "image_latest"]`. This allows access to the latest PDFium API surface without pulling in optional image format features.

**Release profile** is optimized for size (`opt-level = "s"`) with link-time optimization enabled (`lto = true`).

---

## Troubleshooting

### `wasm-bindgen: version mismatch`

The `wasm-bindgen` CLI version must exactly match the crate version in `Cargo.toml`.

```powershell
# Check crate version
cargo tree -p wasm-bindgen | head -1

# Reinstall matching CLI version
cargo install wasm-bindgen-cli --version <matching-version> --force
```

### `cargo build` fails: can't find crate for pdfium-render

The `pdfium-render` dependency is fetched from git. Ensure you have internet access and `git` is on the PATH:

```powershell
git --version
cargo update
```

### PDFium shows blank pages / crashes on large PDFs

This usually means the wrong PDFium binary is installed. Verify `media/wasm/pdfium.js` contains `paulocoutinhox` references (not `bblanchon`). Re-run the download script:

```powershell
node media/wasm/download-pdfium.mjs
```

### `wasm-unsafe-eval` CSP error in DevTools

This is expected if the webview is not loading from the correct `vscode-resource:` scheme. Ensure you launch via `.\scripts\code.bat` (or the VSCode debug launch config), not by opening HTML directly in a browser.

### TypeScript bundle is stale after Rust changes

The `build.mjs` esbuild script does not watch Rust outputs. After a `cargo build` + `wasm-bindgen` run, always re-run:

```powershell
node media/build.mjs
```

Or use `build.ps1` which does both automatically.

### Signature or annotation types not in TypeScript

If you add new exports to `renderer.rs`, they appear in `pkg/pdf_viewer.d.ts` after `wasm-bindgen` runs. TypeScript will pick them up automatically after the next `build.mjs` run.

# XLSX Rust Viewer

A high-performance Excel file viewer for the SafeAppealNavigator VSCode fork. The viewer uses **Rust compiled to WebAssembly** for parsing and writing `.xlsx`/`.xls` files, with a **Canvas 2D** renderer for virtualized spreadsheet display inside a VSCode webview.

## Features

- **Rust/WASM parsing** via `calamine` -- fast, memory-efficient XLSX reading
- **Rust/WASM writing** via `rust_xlsxwriter` -- round-trip XLSX export from the internal data model
- **Canvas 2D rendering** -- virtualized viewport that only draws visible cells (handles large spreadsheets)
- **Cell selection and navigation** -- click, arrow keys, scroll wheel, auto-scroll-into-view
- **Context menu** -- right-click actions (cut, copy, paste, insert/delete row/col) driven by Rust logic
- **Formula engine** (placeholder) -- AST parser, dependency graph, and evaluation loop scaffolded in Rust
- **Table operations** via `polars` -- column sorting with the Polars DataFrame engine compiled to WASM
- **Parallel development** -- registered as an optional "Open With..." editor alongside the legacy XLSX viewer

## Quick Start

### Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| **Rust** | Compile the WASM crate | [rustup.rs](https://rustup.rs) |
| **wasm-pack** | Build Rust to WASM | `cargo install wasm-pack` |
| **wasm32-unknown-unknown** | Rust WASM target | `rustup target add wasm32-unknown-unknown` |
| **Node.js / Bun** | Bundle webview JS | Already in repo |
| **esbuild** | TS bundler for webview | Already available via npx |

### Build

```bash
# 1. Compile Rust crate to WASM (~60s first build, ~4s incremental)
bun run build-wasm

# 2. Bundle webview TypeScript into a single IIFE script (~30ms)
bun run build-xlsx-viewer
```

### Test

1. Reload the VSCode window (`Ctrl+Shift+P` -> "Developer: Reload Window")
2. Right-click any `.xlsx` file in the explorer
3. Select **Open With...** -> **XLSX Rust Viewer**

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](./architecture.md) | System design, data flow, component breakdown |
| [Developer Guide](./developer-guide.md) | Build steps, adding features, extending modules |
| [API Reference](./api-reference.md) | Rust WASM exports and TypeScript interfaces |
| [Troubleshooting](./troubleshooting.md) | Common build errors and runtime issues |

## Project Status

This viewer is under active development as a **proof of concept**. It runs alongside the legacy SheetJS-based viewer. The plan is to reach feature parity and then replace the legacy viewer entirely.

Current status of all plan items is tracked in [`.cursor/plans/xlsx-rust-refactor_6ce021a4.plan.md`](../../.cursor/plans/xlsx-rust-refactor_6ce021a4.plan.md).

## Directory Structure

```
src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/
├── xlsxRustViewerEditor.ts          # VSCode EditorPane (creates webview, loads file, message passing)
├── xlsxRustViewerInput.ts           # VSCode EditorInput (resource, dirty state, serialization data)
├── xlsxRustViewerInputSerializer.ts # Session restore serializer
├── xlsxRustWorkingCopy.ts           # IWorkingCopy impl for auto-save integration
├── media/                           # Webview assets (runs inside Electron iframe)
│   ├── build.mjs                    #   esbuild config: bundles TS + WASM glue → IIFE
│   ├── main.ts                      #   Webview entry point (WASM init, message handling)
│   ├── renderer.ts                  #   Canvas 2D virtualized renderer
│   ├── wasm-loader.ts              #   Worker bridge (reserved for future Worker-based loading)
│   ├── worker.ts                    #   Web Worker script (reserved for future off-thread WASM)
│   ├── xlsxRustViewer.js           #   [BUILD OUTPUT] Bundled IIFE script
│   └── wasm/                        #   [BUILD OUTPUT] wasm-pack output
│       ├── xlsx_rust_viewer_bg.wasm #     WASM binary (~10 MB)
│       └── xlsx_rust_viewer.js      #     wasm-bindgen JS glue (~20 KB)
└── wasm/                            # Rust crate source
    ├── Cargo.toml                   #   Dependencies and crate config
    ├── Cargo.lock                   #   Lockfile
    └── src/
        ├── lib.rs                   #   Crate root (module declarations, panic hook, greet)
        ├── parser.rs                #   XLSX parser (calamine → WorkbookModel JSON)
        ├── writer.rs                #   XLSX writer (WorkbookModel JSON → rust_xlsxwriter → bytes)
        ├── viewport.rs              #   Viewport extraction (row/col range from model)
        ├── formulas.rs              #   Formula engine placeholder (AST, dependency graph)
        ├── context_menu.rs          #   Context menu action definitions
        ├── table_ops.rs             #   Polars-based table operations (sort)
        └── spike.rs                 #   Minimal write spike (verification test)
```

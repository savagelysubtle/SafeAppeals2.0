# XLSX Rust Viewer

A high-performance Excel file viewer and editor for the SafeAppealNavigator VSCode fork. The viewer uses **Rust compiled to WebAssembly** for parsing, writing, and formula evaluation of `.xlsx` files, with a **Canvas 2D** renderer and **Chart.js** for spreadsheet display and chart visualization inside a VSCode webview.

This is the **primary and default** viewer for `.xlsx` files — the legacy SheetJS-based TypeScript viewer has been removed.

## Features

- **Rust/WASM parsing** via `calamine` and `quick-xml` — fast XLSX reading with full OOXML support for charts, tables, conditional formatting, and sparklines
- **Rust/WASM writing** with custom OOXML chart injection — round-trip XLSX export that produces Excel-compatible files with charts
- **Canvas 2D rendering** — virtualized viewport that only draws visible cells (handles large spreadsheets)
- **Full cell editing** — inline editor, formula bar, type-to-edit, Tab/Shift+Tab navigation
- **Rich formatting** — bold, italic, underline, strikethrough, font family/size, text/fill color, alignment, number formats, merge cells
- **Formula engine** — 20 built-in functions (SUM, AVERAGE, IF, VLOOKUP, etc.) with dependency tracking and circular reference detection
- **Tables** — create, style (60 built-in styles), filter, sort, totals row, resize, rename, and convert to range
- **Charts & visualization** — bar, line, pie, scatter, area charts via Chart.js with a chart wizard dialog, draggable/resizable overlays, and Excel round-trip support
- **Conditional formatting** — highlight rules, top/bottom rules, data bars, color scales, icon sets, formula-based rules
- **Sparklines** — in-cell mini charts (line, column, win/loss)
- **Find & Replace** — Ctrl+F/H with match highlighting and Replace All
- **Column/row resizing** — drag-to-resize with variable width/height persistence
- **Undo/Redo** — full model snapshot stack (50 levels)
- **Clipboard** — cut, copy, paste via Clipboard API with fallback
- **Context menus** — cell, column header, row header, and table-aware context menus
- **Dirty state & auto-save** — integrated with VSCode's working copy system
- **AI tool integration** — `edit_document` tool allows AI agents to modify cells, formatting, and structure

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
2. Open any `.xlsx` file — the Rust viewer is the default handler

## Documentation

| Document | Description |
|----------|-------------|
| [Features](./features.md) | Complete feature tracker — implemented and planned |
| [Architecture](./architecture.md) | System design, data flow, component breakdown |
| [Developer Guide](./developer-guide.md) | Build steps, adding features, extending modules |
| [API Reference](./api-reference.md) | Rust WASM exports and TypeScript interfaces |
| [Troubleshooting](./troubleshooting.md) | Common build errors and runtime issues |

## Directory Structure

```
src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/
├── xlsxRustViewerEditor.ts          # VSCode EditorPane (webview lifecycle, file I/O, message passing)
├── xlsxRustViewerInput.ts           # VSCode EditorInput (resource, dirty state, serialization)
├── xlsxRustViewerInputSerializer.ts # Session restore serializer (URI.revive)
├── xlsxRustWorkingCopy.ts           # IWorkingCopy impl for auto-save integration
├── xlsxContentExtractor.ts          # AI tool text extraction (IPC to electron-main)
├── media/                           # Webview assets (runs inside Electron iframe)
│   ├── build.mjs                    #   esbuild config: bundles TS + WASM glue → IIFE
│   ├── main.ts                      #   Webview entry point (WASM init, message handling, ribbon events)
│   ├── renderer.ts                  #   Canvas 2D virtualized renderer (cells, selection, formatting, conditional formatting)
│   ├── ribbon.ts                    #   Ribbon toolbar UI (Home, Insert, View, Data tabs)
│   ├── chartManager.ts              #   Chart.js overlay manager (create, resize, drag, render)
│   ├── chartWizardDialog.ts         #   Chart creation/editing modal dialog
│   ├── filterDropdown.ts            #   Table column filter dropdown UI
│   ├── conditionalFormatDialog.ts   #   Conditional formatting rule editor dialog
│   ├── contextMenu.ts              #   Custom context menu UI
│   ├── wasm-loader.ts              #   Worker bridge wrapper (reserved for future use)
│   ├── worker.ts                    #   Web Worker script (reserved for future off-thread WASM)
│   ├── xlsxRustViewer.js           #   [BUILD OUTPUT] Bundled IIFE script
│   └── wasm/                        #   [BUILD OUTPUT] wasm-pack output
│       ├── xlsx_rust_viewer_bg.wasm #     WASM binary
│       └── xlsx_rust_viewer.js      #     wasm-bindgen JS glue
└── wasm/                            # Rust crate source
    ├── Cargo.toml                   #   Dependencies and crate config
    ├── Cargo.lock                   #   Lockfile
    └── src/
        ├── lib.rs                   #   Crate root (module declarations, panic hook)
        ├── parser.rs                #   XLSX parser (calamine + quick-xml → WorkbookModel with charts, tables, cond. formats)
        ├── writer.rs                #   XLSX writer (WorkbookModel → rust_xlsxwriter + custom OOXML chart injection)
        ├── viewport.rs              #   Viewport extraction (row/col range from model)
        ├── formulas.rs              #   Formula engine (20 functions, dependency graph, evaluation)
        ├── context_menu.rs          #   Context menu action definitions
        ├── table_ops.rs             #   Table operations (create, style, filter, sort, totals)
        └── spike.rs                 #   Minimal write spike (verification test)
```

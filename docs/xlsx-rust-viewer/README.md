# XLSX Rust Viewer

A high-performance Excel file viewer and editor for Safe Appeals. The stack is **custom Canvas 2D + Rust WASM + Chart.js** inside a VS Code custom editor webview — not Luckysheet or Univer.

Shipping home: `extensions/safeappeals-documents` (`safeappeals.xlsxViewer`). Prebuilt WASM lives under `media/xlsx/wasm/`; webview sources under `webview-src/xlsx/`. (Older Void-tree copies under `void-reference/` are reference only.)

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
- **Dirty state & auto-save** — integrated with VS Code custom editor save flow
- **AI LM tools** — `safeappeals_xlsx_read` / `_create` / `_edit` (create via JSZip host writer; edit/read require the file open in the XLSX editor — headless Node WASM is not shipped)
- **Ctrl+L / Ctrl+K** — Add to Chat attaches paste/file pills with an empty query; Inline Edit runs in-place via a language model (preferred id includes `gpt-5.6-terra`) and does not open chat

## Quick Start

### Prerequisites

| Tool | Purpose | Install |
|------|---------|---------|
| **fnm + Bun** | Extension scripts / package management | Local tooling on this machine |
| **Node** (via fnm) | Run esbuild for webview bundle | Already managed by fnm |
| **Rust / wasm-pack** | Only needed if regenerating WASM | [rustup.rs](https://rustup.rs), `cargo install wasm-pack` |

### Build (extension)

```bash
cd extensions/safeappeals-documents
bun run build-webview   # esbuild.mjs → media/xlsx (and other webviews)
```

Regenerating the Rust WASM binary is a separate wasm-pack step against the crate sources (currently under `void-reference/browser/documentViewers/xlsxRustViewer/wasm/`); day-to-day work uses the checked-in `media/xlsx/wasm/` artifacts.

### Test

1. Reload the VS Code window (`Ctrl+Shift+P` → "Developer: Reload Window")
2. Open any `.xlsx` file — `safeappeals.xlsxViewer` is the custom editor

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
extensions/safeappeals-documents/
├── src/
│   ├── agentTools.ts                # LM tools: safeappeals_xlsx_{read,create,edit} (+ DOCX)
│   ├── documentChatOpenOptions.ts   # Ctrl+L attachPaste / empty query builder
│   ├── inlineEditRunner.ts          # Ctrl+K in-place model call + apply
│   ├── xlsx/
│   │   ├── xlsxEditorProvider.ts    # Custom editor host; applyEditsAndWait → webview
│   │   ├── xlsxEditOperations.ts    # Host normalizer (create_chart alias, format_range, camelCase charts)
│   │   └── xlsxWriter.ts            # JSZip create workbook (no open editor required)
│   └── …
├── webview-src/xlsx/                # Webview TS (main, renderer, charts, tables, …)
│   ├── main.ts                      # handleApplyEdits (tables/charts/cells)
│   ├── renderer.ts                  # Canvas 2D virtualized renderer
│   ├── chartManager.ts              # Chart.js overlays
│   └── wasm/                        # wasm-bindgen glue + sources for pack
├── media/xlsx/                      # Built IIFE + WASM binary served to webview
└── esbuild.mjs                      # Webview bundle
```

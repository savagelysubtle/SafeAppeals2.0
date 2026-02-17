# Architecture

## Overview

The XLSX Rust Viewer is a custom document editor integrated into the SafeAppealNavigator VSCode fork. It replaces the legacy SheetJS-based TypeScript viewer with a Rust/WASM backend for parsing and writing, and a Canvas 2D frontend for rendering.

The system runs inside the VSCode Electron application, not in a regular browser. This imposes constraints on how scripts are loaded, how WASM is initialized, and how the rendering context communicates with the extension host.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────┐
│                   VSCode Extension Host                   │
│  (Node.js / Electron Main)                               │
│                                                          │
│  ┌────────────────────────────────┐                      │
│  │  XLSXRustViewerEditor          │                      │
│  │  (EditorPane)                  │                      │
│  │                                │                      │
│  │  - Creates IOverlayWebview     │                      │
│  │  - Reads file via IFileService │                      │
│  │  - Base64-encodes file data    │                      │
│  │  - Posts messages to webview   │                      │
│  └──────────┬─────────────────────┘                      │
│             │ postMessage                                │
│             ▼                                            │
│  ┌──────────────────────────────────────────────────┐    │
│  │              VSCode Webview (Electron iframe)     │    │
│  │                                                    │    │
│  │  ┌─────────────────┐    ┌──────────────────────┐  │    │
│  │  │  xlsxRustViewer  │    │  Rust WASM Module    │  │    │
│  │  │  .js (IIFE)      │───▶│  (xlsx_rust_viewer   │  │    │
│  │  │                  │    │   _bg.wasm)          │  │    │
│  │  │  - main.ts       │    │                      │  │    │
│  │  │  - renderer.ts   │    │  - parser.rs         │  │    │
│  │  │  - wasm glue     │    │  - writer.rs         │  │    │
│  │  └────────┬─────────┘    │  - viewport.rs       │  │    │
│  │           │              │  - formulas.rs       │  │    │
│  │           ▼              │  - context_menu.rs   │  │    │
│  │  ┌─────────────────┐    │  - table_ops.rs      │  │    │
│  │  │  Canvas 2D       │    └──────────────────────┘  │    │
│  │  │  (CanvasRenderer)│                              │    │
│  │  │                  │                              │    │
│  │  │  - Virtual grid  │                              │    │
│  │  │  - Cell selection│                              │    │
│  │  │  - Scroll / DPI  │                              │    │
│  │  └─────────────────┘                              │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

## Data Flow

### File Loading

```
1. User opens .xlsx file → EditorResolverService matches *.xlsx glob
2. XLSXRustResolverContribution creates XLSXRustViewerInput(resource)
3. XLSXRustViewerEditor.setInput() is called
4. Editor creates webview (if first time) and sets HTML
5. Webview script loads → initializes WASM → posts 'ready' message
6. Editor reads file bytes via IFileService.readFile()
7. Editor base64-encodes bytes (chunked, 8KB at a time)
8. Editor posts { type: 'loadXLSX', data: base64 } to webview
9. Webview decodes base64 → Uint8Array → calls parser.load(bytes)
10. Rust parser (calamine) returns WorkbookModel as JSON string
11. JSON is parsed → passed to CanvasRenderer.setData()
12. Canvas renders visible cells
```

### File Saving (planned)

```
1. User triggers save
2. Webview serializes current model to JSON
3. JSON passed to XlsxWriter.save(modelJson)
4. Rust writer (rust_xlsxwriter) returns XLSX bytes
5. Bytes sent to extension host via postMessage
6. Extension host writes bytes via IFileService.writeFile()
```

## Component Breakdown

### Extension Host Side (TypeScript)

| File | Responsibility |
|------|----------------|
| `xlsxRustViewerEditor.ts` | VSCode `EditorPane` subclass. Creates and manages the webview overlay. Reads file data, encodes to base64, sends to webview. Handles webview lifecycle (claim/release, visibility, layout). |
| `xlsxRustViewerInput.ts` | VSCode `EditorInput` subclass. Represents the file resource. Holds current sheet index, selection state, dirty state (via working copy delegation). |
| `xlsxRustViewerInputSerializer.ts` | Serializes/deserializes `XLSXRustViewerInput` for session restore. |
| `xlsxRustWorkingCopy.ts` | `IWorkingCopy` implementation. Integrates with VSCode's auto-save and dirty-state tracking. Fires `onDidChangeDirty` and `onDidSave` events. |
| `documentViewer.contribution.ts` | Registers the editor pane, input serializer, and file resolver. The resolver registers at `RegisteredEditorPriority.option` so it appears in "Open With..." alongside the legacy viewer. |

### Webview Side (TypeScript, bundled to IIFE)

| File | Responsibility |
|------|----------------|
| `media/main.ts` | Entry point. Initializes WASM module via `init(wasmUrl)`. Creates Rust class instances (`XlsxParser`, `XlsxWriter`, `ContextMenuManager`). Handles messages from extension host. |
| `media/renderer.ts` | `CanvasRenderer` class. Creates an HTML Canvas, handles DPI scaling, draws cells/headers/gridlines. Implements virtualized rendering (only visible cells). Handles mouse clicks, keyboard navigation, scroll wheel, and context menu events. |
| `media/wasm-loader.ts` | Worker bridge wrapper (reserved for future use). Manages request/response protocol via `postMessage` with promise resolution. |
| `media/worker.ts` | Web Worker script (reserved for future use). Would run WASM off the main thread. |
| `media/build.mjs` | esbuild configuration. Bundles `main.ts` + `renderer.ts` + wasm-bindgen JS glue into a single `xlsxRustViewer.js` IIFE. |

### Rust/WASM Side

| Module | Responsibility |
|--------|----------------|
| `lib.rs` | Crate root. Declares modules. Exports `init_panic_hook()` and `greet()`. |
| `parser.rs` | `XlsxParser` struct. Uses `calamine` to parse XLSX bytes into `WorkbookModel` (sheets → sparse grid of cells). Returns JSON string. |
| `writer.rs` | `XlsxWriter` struct. Deserializes `WorkbookModel` from JSON, writes to XLSX bytes via `rust_xlsxwriter`. |
| `viewport.rs` | `ViewportManager` struct. Extracts a rectangular subset of cells from the model for efficient transfer to the renderer. |
| `formulas.rs` | `FormulaEngine` struct (placeholder). Tokenizer, AST builder, dependency graph, evaluation loop. Currently returns dummy values. |
| `context_menu.rs` | `ContextMenuManager` struct. Returns JSON list of available actions (cut, copy, paste, insert/delete row/col) for a given cell position. |
| `table_ops.rs` | `TableOps` struct. Uses Polars to sort column data. POC stub demonstrating Polars is functional in WASM. |
| `spike.rs` | `create_simple_xlsx()` function. Verification spike that `rust_xlsxwriter` can generate an XLSX file in a WASM memory buffer. |

## Data Model

The core data model is defined in `parser.rs` and shared across all Rust modules:

```rust
struct WorkbookModel {
    sheets: Vec<SheetData>,
}

struct SheetData {
    name: String,
    cells: HashMap<u32, HashMap<u32, CellData>>,  // Sparse: row → col → cell
    row_count: usize,
    col_count: usize,
}

struct CellData {
    value: String,
    data_type: String,  // "s" | "n" | "b" | "e" | "d" | "null"
}
```

The model is serialized to JSON for transfer across the WASM boundary. In the future, Arrow IPC or SharedArrayBuffer can be used for zero-copy transfer.

## Security (Content Security Policy)

The webview HTML sets a strict CSP:

```
default-src 'none';
script-src 'nonce-{uuid}' 'wasm-unsafe-eval' vscode-resource:;
style-src 'unsafe-inline' vscode-resource:;
connect-src {wasmUri};
```

- **`wasm-unsafe-eval`** -- required for `WebAssembly.instantiate()` in the wasm-bindgen glue
- **`vscode-resource:`** -- allows loading the bundled JS and WASM binary from `localResourceRoots`
- **`connect-src`** scoped to the specific WASM URI -- the WASM binary is fetched at runtime via the `init()` function
- No inline scripts -- only the nonce-tagged `<script>` tag is allowed

## VSCode Integration Patterns

This viewer follows established patterns from other document viewers in the codebase:

| Pattern | How It's Used |
|---------|---------------|
| `IOverlayWebview` | Created via `IWebviewService.createWebviewOverlay()` with `localResourceRoots` and `allowScripts: true` |
| `asWebviewUri()` | Converts `file://` URIs to `vscode-resource:` URIs for the webview |
| `EditorPane` lifecycle | `createEditor()` → `setInput()` → `layout()` → `setEditorVisible()` → `clearInput()` → `dispose()` |
| `postMessage` protocol | Extension host sends `{ type, data }` messages; webview replies with `{ type }` status messages |
| `acquireVsCodeApi()` | Global function available in webview context for bidirectional messaging |
| Regular `<script>` tag | Matches legacy viewer pattern (not `type="module"`) with nonce for CSP |

## Future Architecture (planned)

- **Web Worker** -- move WASM execution off the main webview thread to prevent UI freezes on large files
- **Arrow IPC / Transferables** -- zero-copy data transfer between Worker and main thread
- **Streaming viewport** -- request only visible cell data from Rust instead of the full model
- **Shared WorkbookModel** -- keep model in Rust memory, query it via viewport requests
- **Formula recalculation** -- implement real formula evaluation with dependency-driven updates
- **Cell editing** -- inline editing with dirty state propagation to `XLSXRustWorkingCopy`

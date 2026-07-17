---
name: xlsx-rust-refactor
overview: Full refactor of the XLSX viewer to move all viewer logic to Rust (WASM + Canvas + virtual viewport) with read and write support. **Strategy:** Parallel development (`xlsxRustViewer`) using `rust_xlsxwriter` and `polars` (minimal features) with Canvas 2D rendering.
todos:
  - id: scaffold-rust-viewer
    content: Create new directory `src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/` and scaffold basic structure (editor, input, media).
    status: completed
  - id: register-rust-viewer
    content: Register `xlsxRustViewer` in `documentViewer.contribution.ts` with viewType `void.xlsxRustViewer` as an option alongside the legacy viewer.
    status: completed
  - id: rust-project-setup
    content: Initialize Rust crate in `xlsxRustViewer/wasm/` with `calamine`, `rust_xlsxwriter` (wasm feature), `polars` (minimal features), `serde`, `wasm-bindgen`, `getrandom` (wasm_js), `serde_json`, `js-sys`.
    status: completed
  - id: rust-writer-spike
    content: Create a minimal "spike" to verify `rust_xlsxwriter` compiles to WASM and can write to a memory buffer.
    status: completed
  - id: rust-parser-model
    content: Implement core Excel parser and internal data model (WorkbookModel/SheetData/CellData) using `calamine`.
    status: completed
  - id: rust-formula-engine
    content: Implement formula engine placeholder (AST parser, dependency graph, eval loop) in Rust.
    status: completed
  - id: rust-context-menu
    content: Implement context menu logic exposing a `get_context_menu(row, col)` API returning JSON to TS.
    status: completed
  - id: rust-table-ops
    content: Integrate `polars` with minimal feature flags for sort operations (POC stub using sort_column_data).
    status: completed
  - id: rust-writer
    content: Implement XLSX serialization/export using `rust_xlsxwriter` from WorkbookModel JSON.
    status: completed
  - id: wasm-bridge-loader
    content: Restructured to direct WASM loading on main webview thread (no Worker for POC). Bundled via esbuild into single IIFE `xlsxRustViewer.js`.
    status: completed
  - id: canvas-renderer-setup
    content: Implement virtualized Canvas 2D renderer in `xlsxRustViewer/media/renderer.ts`.
    status: completed
  - id: virtual-viewport
    content: Implement virtual viewport logic in Rust (`viewport.rs`) and TS (renderer only draws visible cells).
    status: completed
  - id: ui-interaction
    content: Handle mouse/keyboard events in TS canvas (selection, arrow keys, scroll, right-click context menu).
    status: completed
  - id: build-integration
    content: Added `build-wasm` (wasm-pack) and `build-xlsx-viewer` (esbuild) scripts. CSP updated with `wasm-unsafe-eval` and `vscode-resource:`.
    status: completed
  - id: migration-cutover
    content: Once `xlsxRustViewer` is stable, replace `xlsxViewer` logic with the new implementation and archive the legacy code.
    status: in_progress
isProject: false
---

# XLSX Viewer Full Rust Refactor Plan

## Reference Research

> **Critical:** Refer to these documents for technical details and architectural decisions.

- `docs/technicalResearch/excel-rust/competitor-strategies-analysis.md` (Architecture options)
- `docs/technicalResearch/excel-rust/excel-viewer-rust-refactor-deepdive.md` (Deep dive into WASM/Canvas)
- `docs/technicalResearch/excel-rust/IMPLEMENTATION_ROADMAP.md` (Phased approach)
- `docs/technicalResearch/excel-rust/rust-wasm-excel-implementation.md` (Code snippets)

## Strategy: Parallel Development

To ensure stability during the refactor, we will build the new Rust-based viewer in a **new directory** (`xlsxRustViewer`) alongside the existing `xlsxViewer`.

- **Legacy Viewer:** `src/.../xlsxViewer` (Kept as backup/fallback)
- **New Viewer:** `src/.../xlsxRustViewer` (New Rust+WASM+Canvas implementation)

Once the new viewer reaches feature parity (Read/Write/Edit), we will switch the default `void.xlsxViewer` editor ID to point to the new implementation and remove the legacy code.

## Target Architecture (scope)

- **Backend:** Rust (WASM) running in a Web Worker.
- **Frontend:** **Canvas 2D** (Virtualized) + TypeScript glue.
- **Data Flow:** VSCode -> Buffer -> Rust WASM -> **Arrow IPC** -> Canvas.
- **Write Strategy:** Rust model -> `rust_xlsxwriter` -> Buffer -> VSCode Save.

## Implementation Steps

### 1. Scaffold & Registration

- Create `src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/`.
- Register the new editor in `package.json` or `void.contribution.ts` as `void.xlsxRustViewer`.
- Add a "Open with Rust Viewer" command or context menu item for testing.

### 2. Rust Core (`/wasm` crate)

- **Location:** `src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/wasm/`
- **Dependencies:**
  - `calamine`: Fast parsing.
  - `rust_xlsxwriter`: Read/Write support (Explicit WASM support).
  - `polars`: High-perf data ops (Use `default-features = false` + `lazy`, `dtype-categorical`, `strings` to minimize binary size).
  - `serde-wasm-bindgen`: efficient JS interop.
  - `arrow`: For zero-copy data transfer.
- **Modules:**
  - `parser.rs`: `load(bytes) -> internal_model`
  - `model.rs`: Sparse grid, style storage.
  - `formulas.rs`: DAG for recalc.
  - `writer.rs`: `save(internal_model) -> bytes`
  - `viewport.rs`: `get_view(rect) -> ArrowBatch`
  - `context_menu.rs`: Logic for right-click actions (Insert/Delete Row/Col, Format, Formulas).

### 3. Webview Bridge (`wasm-loader.ts` + `worker.ts`)

- **Location:** `src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/`
- **Loader:** Instantiates WASM, handles message passing.
- **Worker:** Runs the WASM instance off the main thread.
- **Data Transfer:** Use **Transferables** and **Arrow IPC** to send viewport data from Worker to Main thread without freezing UI.

### 4. Rendering Engine (Canvas 2D)

- **Choice:** **Raw Canvas 2D**.
  - Better text rendering (crisp, native fonts) than Pixi.js/WebGL.
  - Lighter bundle size.
  - Simpler implementation.
- **Virtualization:** Only draw visible cells + buffer (e.g., 50 rows).
- **Scrolling:** Smooth scrolling decoupled from WASM render loop if possible.
- **UI Interaction:** Forward `contextmenu` events to Rust to determine valid actions based on cell state, then render custom HTML dropdown overlay.

### 5. Integration & Build

- **Build System:**
  - Update `package.json` scripts to build the Rust crate in the new location.
  - Output target: `src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/wasm/`.
- **VSCode Webview:**
  - Ensure CSP allows loading WASM and scripts from the new media folder.

## Files to change / add

- **New Directory:** `src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/`
  - `xlsxRustViewerEditor.ts` (New Editor Class)
  - `xlsxRustViewerInput.ts` (New Input Class)
  - `wasm/` (Rust Crate)
  - `media/` (Frontend Assets)
- **Registration:** `src/vs/workbench/contrib/void/browser/void.contribution.ts` (Register new editor)
- **Build Config:** `package.json` (add `build-rust-viewer` script).

## Success Metrics

- **Performance:** Parse 10MB < 1s, Scroll 1M rows @ 60fps.
- **Features:** Read/Write, Formulas (SUM, AVG, VLOOKUP), Sorting/Filtering, **Context Menu Operations**.
- **UX:** Smooth inertial scrolling, instant cell editing.
- **Safety:** Original viewer remains 100% functional during development.

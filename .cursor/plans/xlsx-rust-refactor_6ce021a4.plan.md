---
name: xlsx-rust-refactor
overview: Full refactor of the XLSX viewer to move all viewer logic to Rust (WASM + Canvas + virtual viewport) with read and write support. **Strategy:** Implement as a parallel `xlsxRustViewer` to maintain the existing TypeScript viewer (`xlsxViewer`) as a fallback until feature parity is reached.
todos:
  - id: scaffold-rust-viewer
    content: Create new directory `src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/` and scaffold basic structure (editor, input, media).
    status: pending
  - id: register-rust-viewer
    content: Register `xlsxRustViewer` in `void.contribution.ts` (or equivalent) with a unique viewType (e.g., `void.xlsxRustViewer`) to allow testing alongside the legacy viewer.
    status: pending
  - id: rust-project-setup
    content: Initialize Rust crate in `src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/wasm/` with `calamine` (read), `umya-spreadsheet` (write), `polars` (data ops), `serde`, and `wasm-bindgen`.
    status: pending
  - id: rust-parser-model
    content: Implement core Excel parser and internal data model (sparse grid + metadata) using `calamine`.
    status: pending
  - id: rust-formula-engine
    content: Implement formula engine (AST parser, dependency graph, eval loop) in Rust.
    status: pending
  - id: rust-table-ops
    content: Integrate `polars` for high-performance table operations (filter, sort, group by).
    status: pending
  - id: rust-writer
    content: Implement XLSX serialization/export using `umya-spreadsheet` to support saving changes.
    status: pending
  - id: wasm-bridge-loader
    content: Create TS `wasm-loader.ts` and `worker.ts` in `xlsxRustViewer/media` to bridge VSCode extension with Rust WASM worker.
    status: pending
  - id: canvas-renderer-setup
    content: specific implementation of Canvas rendering using `pixi.js` (or raw WebGL/Canvas if lighter) driven by Rust state in `xlsxRustViewer/media`.
    status: pending
  - id: virtual-viewport
    content: Implement virtual viewport logic in Rust/TS to only render visible cells.
    status: pending
  - id: ui-interaction
    content: Handle mouse/keyboard events in TS and forward to Rust state machine (selection, editing).
    status: pending
  - id: build-integration
    content: Add `build-wasm` script to `package.json` targeting `xlsxRustViewer/media/wasm`, and update VSCode Webview CSP to allow WASM execution.
    status: pending
  - id: migration-cutover
    content: Once `xlsxRustViewer` is stable, replace `xlsxViewer` logic with the new implementation and archive the legacy code.
    status: pending
isProject: false
---

# XLSX Viewer Full Rust Refactor Plan

## Strategy: Parallel Development

To ensure stability during the refactor, we will build the new Rust-based viewer in a **new directory** (`xlsxRustViewer`) alongside the existing `xlsxViewer`.

- **Legacy Viewer:** `src/.../xlsxViewer` (Kept as backup/fallback)
- **New Viewer:** `src/.../xlsxRustViewer` (New Rust+WASM+Canvas implementation)

Once the new viewer reaches feature parity (Read/Write/Edit), we will switch the default `void.xlsxViewer` editor ID to point to the new implementation and remove the legacy code.

## Target Architecture (scope)

- **Backend:** Rust (WASM) running in a Web Worker.
- **Frontend:** Canvas (Pixi.js recommended) + TypeScript glue.
- **Data Flow:** VSCode -> Buffer -> Rust WASM -> Viewport Data -> Canvas.
- **Write Strategy:** Rust model -> `umya-spreadsheet` -> Buffer -> VSCode Save.

## Implementation Steps

### 1. Scaffold & Registration

- Create `src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/`.
- Register the new editor in `package.json` or `void.contribution.ts` as `void.xlsxRustViewer`.
- Add a "Open with Rust Viewer" command or context menu item for testing.

### 2. Rust Core (`/wasm` crate)

- **Location:** `src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/wasm/`
- **Dependencies:**
  - `calamine`: Fast parsing.
  - `umya-spreadsheet`: Read/Write support (critical for editing).
  - `polars`: High-perf filtering/sorting/aggregation.
  - `serde-wasm-bindgen`: efficient JS interop.
- **Modules:**
  - `parser.rs`: `load(bytes) -> internal_model`
  - `model.rs`: Sparse grid, style storage.
  - `formulas.rs`: DAG for recalc.
  - `writer.rs`: `save(internal_model) -> bytes`
  - `viewport.rs`: `get_view(rect) -> RenderOps`

### 3. Webview Bridge (`wasm-loader.ts` + `worker.ts`)

- **Location:** `src/vs/workbench/contrib/void/browser/documentViewers/xlsxRustViewer/media/`
- **Loader:** Instantiates WASM, handles message passing.
- **Worker:** Runs the WASM instance off the main thread to prevent UI freezing.
- **State Sync:** Sends inputs (scroll, click) to worker; receives render commands/deltas.

### 4. Rendering Engine (Canvas/Pixi.js)

- **Choice:** Pixi.js (Hardware accelerated, easy text handling) or raw Canvas 2D (simpler dependencies).
- **Virtualization:** Only draw visible cells + buffer.
- **Scrolling:** Smooth scrolling decoupled from WASM render loop if possible.

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
- **Features:** Read/Write, Formulas (SUM, AVG, VLOOKUP), Sorting/Filtering.
- **UX:** Smooth inertial scrolling, instant cell editing.
- **Safety:** Original viewer remains 100% functional during development.

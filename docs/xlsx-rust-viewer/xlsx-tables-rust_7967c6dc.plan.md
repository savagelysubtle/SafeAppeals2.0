---
name: xlsx-tables-rust
overview: Plan to add advanced Excel table support with a Rust-backed XLSX model/IO layer plus webview UI integration, aligned with the current XLSX viewer message flow and edit pipeline.
todos:
  - id: protocol-model
    content: Define table ops + Rust data model schema
    status: pending
  - id: rust-engine
    content: Design Rust XLSX table read/write engine
    status: pending
  - id: ipc-integration
    content: Plan electron-main IPC wiring to Rust
    status: pending
  - id: webview-ui
    content: Plan webview table model + ribbon UI
    status: pending
  - id: roundtrip
    content: Plan import/export + save path for tables
    status: pending
isProject: false
---

# Rust Plan: Advanced XLSX Tables

## Current Implementation Touchpoints

- Webview loads XLSX and renders x-spreadsheet; save is driven from the webview
  and serialized with
  SheetJS.```76:209:D:/Coding/SafeAppeals2.0/src/vs/workbench/contrib/void/browser/documentViewers/xlsxViewer/xlsxViewerEditor.ts
  // setInput posts loadXLSX to webview with base64 // ... existing code ...
  this.webview.postMessage({ type: 'loadXLSX', data: base64Data, encoding:
  'base64', xlsxUri: currentUri });

````
- The webview currently ignores external edit operations, which is a natural hook for table operations.```64:89:D:/Coding/SafeAppeals2.0/src/vs/workbench/contrib/void/browser/documentViewers/xlsxViewer/media/xlsxViewer.js
case "executeOperations":
	console.warn("Agent operations not yet implemented for x-spreadsheet");
	break;
````

- The host already routes XLSX edits to the webview when open and to backend IPC
  when
  closed.```180:259:D:/Coding/SafeAppeals2.0/src/vs/workbench/contrib/void/browser/documentViewers/documentEditorService.ts
  async editXLSX(params) { if (this.isDocumentOpen(params.uri)) { return
  this.editOpenXLSX(params); } return this.editClosedXLSX(params); }

```

## Rust Architecture (Full-Stack)
- **Goal**: Introduce a Rust XLSX table engine that owns table metadata and I/O, while keeping the webview grid as the interactive UI.
- **Rust crates** (plan assumption):
  - Read: `calamine` for table metadata and ranges
  - Write: `rust_xlsxwriter` for table creation/styles/filters/totals/structured refs
  - Optional validation: evaluate `umya-spreadsheet` for a single-crate read/write path if it can round-trip tables
- **Process model**: Rust runs as a sidecar or native module invoked from `electron-main` services under `src/vs/workbench/contrib/void/electron-main/` (no changes outside `void`).

## Rust Data Model (target types)
- `TableDefinition` (name, range, header_row, totals_row, style, banded_rows, banded_cols, filter_state)
- `TableColumn` (name, index, formula, totals_function, number_format)
- `TableStyle` (name, show_first_column, show_last_column)
- `SheetTables` (sheet_name, Vec<TableDefinition>)
- `WorkbookTables` (Vec<SheetTables>)

## Plan Steps
1. **Inventory and protocol design**
   - Extend the XLSX webview message protocol to include `tableOperations` and `tableMetadata` payloads.
   - Define `XLSXEditOperation` variants for table actions (create, resize, rename, add/remove column, set header/totals, set filter, set style, structured ref update).
   - Confirm how these map to UI actions in `xlsxRibbon.js` and to Rust functions.

2. **Rust XLSX table engine (read/write)**
   - Build a Rust crate in the repo to handle:
     - `load_tables(bytes) -> WorkbookTables`
     - `apply_table_ops(bytes, ops) -> bytes`
     - `build_workbook_with_tables(sheet_data, tables) -> bytes`
   - Use `calamine` to read table metadata and ranges; `rust_xlsxwriter` to write tables with styles, filters, totals.
   - Provide stable JSON schemas for `WorkbookTables` and operations for IPC.

3. **Electron-main service integration**
   - Add a new `XlsxTableService` in `src/vs/workbench/contrib/void/electron-main/` to:
     - Invoke the Rust engine on closed files
     - Return table metadata to the renderer
   - Wire it into the existing IPC flow used by `documentEditorService` for XLSX edits.

4. **Webview table model + UI**
   - Add a `tableModel` layer in `xlsxViewer.js` to store table metadata from Rust and sync to the grid.
   - Extend `xlsxRibbon.js` with table UI controls (create table, toggle header/totals, filters, style picker, rename).
   - On UI action, emit `applyEdits` with table operations so the host can persist changes.

5. **Import/export mapping**
   - Update `stox` / `xtos` conversion in `xlsxViewer.js` to:
     - Import table metadata into the `tableModel`
     - Export tables back into a form the Rust engine can write on save
   - For open documents: on save, use Rust engine to write the final XLSX (ensures table fidelity).

6. **Validation and compatibility**
   - Ensure non-table workbooks still round-trip unchanged.
   - Confirm table metadata survival for: style, filters, totals row, structured refs.

## Files Likely to Change
- `[src/vs/workbench/contrib/void/browser/documentViewers/xlsxViewer/xlsxViewerEditor.ts](src/vs/workbench/contrib/void/browser/documentViewers/xlsxViewer/xlsxViewerEditor.ts)`
- `[src/vs/workbench/contrib/void/browser/documentViewers/xlsxViewer/media/xlsxViewer.js](src/vs/workbench/contrib/void/browser/documentViewers/xlsxViewer/media/xlsxViewer.js)`
- `[src/vs/workbench/contrib/void/browser/documentViewers/xlsxViewer/media/xlsxRibbon.js](src/vs/workbench/contrib/void/browser/documentViewers/xlsxViewer/media/xlsxRibbon.js)`
- `[src/vs/workbench/contrib/void/browser/documentViewers/documentEditorService.ts](src/vs/workbench/contrib/void/browser/documentViewers/documentEditorService.ts)`
- New Rust crate under `[src/vs/workbench/contrib/void/](src/vs/workbench/contrib/void/)` (path to be chosen)
- New electron-main integration under `[src/vs/workbench/contrib/void/electron-main/](src/vs/workbench/contrib/void/electron-main/)`

## Assumptions (explicit)
- Rust will be integrated as a sidecar or native module invoked by the `electron-main` services.
- The webview grid remains x-spreadsheet for now, with a parallel `tableModel` that drives UI overlays.
- Table features in scope: all requested (create table, styles, filters/sort, totals, structured refs).
```

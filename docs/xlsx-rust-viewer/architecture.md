# Architecture

## Overview

The XLSX Rust Viewer is a full-featured document editor integrated into the SafeAppealNavigator VSCode fork. It uses a Rust/WASM backend for parsing, writing, formula evaluation, and table operations, with a Canvas 2D + Chart.js frontend for rendering inside a VSCode webview.

The system runs inside the VSCode Electron application. The rendering context communicates with the extension host via `postMessage`, and all file I/O is handled by the extension host via `IFileService`.

## High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    VSCode Extension Host                      │
│  (Node.js / Electron Renderer)                               │
│                                                              │
│  ┌────────────────────────────────────┐                      │
│  │  XLSXRustViewerEditor (EditorPane) │                      │
│  │  - Creates IOverlayWebview         │                      │
│  │  - Reads/writes via IFileService   │                      │
│  │  - Base64-encodes file data        │                      │
│  │  - Debounced save on dirty         │                      │
│  │  - Posts messages to webview       │                      │
│  └──────────┬─────────────────────────┘                      │
│             │ postMessage                                    │
│             ▼                                                │
│  ┌──────────────────────────────────────────────────────┐    │
│  │               VSCode Webview (Electron iframe)        │    │
│  │                                                        │    │
│  │  ┌───────────────────┐   ┌──────────────────────────┐ │    │
│  │  │  xlsxRustViewer.js│   │  Rust WASM Module        │ │    │
│  │  │  (IIFE bundle)    │──▶│  (xlsx_rust_viewer       │ │    │
│  │  │                   │   │   _bg.wasm)              │ │    │
│  │  │  - main.ts        │   │                          │ │    │
│  │  │  - renderer.ts    │   │  - parser.rs (calamine   │ │    │
│  │  │  - ribbon.ts      │   │    + quick-xml OOXML)    │ │    │
│  │  │  - chartManager   │   │  - writer.rs (rust_xlsx  │ │    │
│  │  │  - chartWizard    │   │    writer + OOXML inject)│ │    │
│  │  │  - filterDropdown │   │  - formulas.rs           │ │    │
│  │  │  - condFormat     │   │  - table_ops.rs          │ │    │
│  │  │  - contextMenu    │   │  - viewport.rs           │ │    │
│  │  └────────┬──────────┘   └──────────────────────────┘ │    │
│  │           │                                            │    │
│  │    ┌──────┴──────┐    ┌─────────────────┐             │    │
│  │    │ Canvas 2D   │    │ Chart.js (v4)   │             │    │
│  │    │ (Renderer)  │    │ (ChartManager)  │             │    │
│  │    │             │    │                 │             │    │
│  │    │ - Cells     │    │ - Bar / Line    │             │    │
│  │    │ - Selection │    │ - Pie / Scatter │             │    │
│  │    │ - Scroll    │    │ - Area charts   │             │    │
│  │    │ - Formatting│    │ - Draggable     │             │    │
│  │    │ - Cond. fmt │    │ - Resizable     │             │    │
│  │    └─────────────┘    └─────────────────┘             │    │
│  └──────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────┘
```

## Data Flow

### File Loading

```
1. User opens .xlsx file → EditorResolverService matches *.xlsx glob
2. XLSXRustResolverContribution creates XLSXRustViewerInput(resource)
   (registered at RegisteredEditorPriority.exclusive — this is the default handler)
3. XLSXRustViewerEditor.setInput() is called
4. Editor creates webview (if first time) and sets HTML
5. Webview script loads → initializes WASM → posts 'ready' message
6. Editor reads file bytes via IFileService.readFile()
7. Editor base64-encodes bytes (chunked, 8KB at a time)
8. Editor posts { type: 'loadXLSX', data: base64, xlsxUri: string } to webview
9. Webview decodes base64 → Uint8Array → calls parser.load(bytes)
10. Rust parser returns WorkbookModel as JSON string
    (includes cells, tables, merged cells, charts, conditional formats, sparklines, column widths, row heights)
11. JSON is parsed → passed to CanvasRenderer.setData()
12. Charts are passed to ChartManager for overlay rendering
13. Canvas renders visible cells with conditional formatting applied
```

### File Saving

```
1. User edits trigger markDirty() → webview posts { type: 'dirty' } to extension host
2. Extension host marks the working copy as dirty (shows dot on tab)
3. User triggers save (Ctrl+S or auto-save)
4. Extension host posts { type: 'saveXLSX' } to webview
5. Webview serializes current model to JSON (including charts, tables, styles)
6. JSON passed to XlsxWriter.save(modelJson)
7. Rust writer creates base XLSX via rust_xlsxwriter
8. If model has charts: inject_chart_files() post-processes the ZIP:
   - Generates xl/charts/chartN.xml (OOXML chart format)
   - Generates xl/drawings/drawingN.xml (two-cell anchors)
   - Generates xl/drawings/_rels/drawingN.xml.rels
   - Patches [Content_Types].xml
   - Patches xl/worksheets/sheetN.xml (adds <drawing> reference)
   - Patches/creates sheetN.xml.rels
   - Injects xl/voidCharts.json (viewer-specific metadata for round-trip)
9. XLSX bytes returned → base64-encoded
10. Webview posts { type: 'saveData', data: base64 } to extension host
11. Extension host writes bytes via IFileService.writeFile()
```

### Chart Round-Trip (Excel Compatibility)

```
Opening a file with charts:
1. parser.rs uses quick-xml to parse xl/charts/*.xml (OOXML charts)
2. Also checks xl/voidCharts.json for viewer-specific chart metadata
3. Both sources are merged (OOXML takes priority to avoid duplicates)
4. ChartDefinition objects rendered via Chart.js overlays

Saving a file with charts:
1. writer.rs generates native OOXML chart XML
2. Charts appear in both our viewer AND Microsoft Excel
3. xl/voidCharts.json preserves viewer-specific anchor/style data
```

## Component Breakdown

### Extension Host Side (TypeScript)

| File | Responsibility |
|------|----------------|
| `xlsxRustViewerEditor.ts` | VSCode `EditorPane` subclass. Creates and manages the webview overlay. Reads/writes file data via IFileService. Handles dirty state with debounced save. Processes webview messages (save, dirty, print, export). |
| `xlsxRustViewerInput.ts` | VSCode `EditorInput` subclass. Represents the file resource. Serializes to JSON with URI safety (`URI.revive()` on deserialize). |
| `xlsxRustViewerInputSerializer.ts` | Serializes/deserializes `XLSXRustViewerInput` for session restore. Includes `canSerialize()` guard. |
| `xlsxRustWorkingCopy.ts` | `IWorkingCopy` implementation. Integrates with VSCode's auto-save and dirty-state tracking. |
| `xlsxContentExtractor.ts` | AI tool integration. Extracts text content from XLSX for `edit_document` tool context. IPC to electron-main for file reading. |
| `documentViewer.contribution.ts` | Registers the editor pane, input serializer, and file resolver at `RegisteredEditorPriority.exclusive`. |

### Webview Side (TypeScript, bundled to IIFE)

| File | Responsibility |
|------|----------------|
| `media/main.ts` | Entry point. Initializes WASM module. Creates all Rust class instances. Handles extension host messages. Orchestrates ribbon events, context menu actions, formula operations, chart wizard interactions, AI edit operations. |
| `media/renderer.ts` | `CanvasRenderer` class. Canvas with DPI scaling, virtualized cell rendering, selection, formatting, conditional format rendering (data bars, color scales, icon sets), merged cells, scroll, freeze panes, column/row resizing. |
| `media/ribbon.ts` | Ribbon toolbar with 4 tabs (Home, Insert, View, Data), always-visible file buttons, 30+ SVG icons, table style picker, and font/color pickers. |
| `media/chartManager.ts` | `ChartManager` class. Creates Chart.js instances as interactive overlays on the spreadsheet. Supports create, resize, drag (pixel-based with clamping), select, edit, and delete operations. |
| `media/chartWizardDialog.ts` | Modal dialog for creating/editing charts. Type selection, data range configuration, title/legend/axis options, series management. |
| `media/filterDropdown.ts` | HTML dropdown UI positioned over table header cells. Sort, search, select all/deselect all, individual value checkboxes, clear filter. |
| `media/conditionalFormatDialog.ts` | Dialog for creating/editing conditional formatting rules. Rule type selection, operator config, value inputs, style preview. |
| `media/contextMenu.ts` | Custom HTML context menu. Cell, column header, row header, and table-aware items. Viewport clamping. |
| `media/build.mjs` | esbuild configuration. Bundles all webview TS + Chart.js + wasm-bindgen JS glue into a single `xlsxRustViewer.js` IIFE. |

### Rust/WASM Side

| Module | Responsibility |
|--------|----------------|
| `lib.rs` | Crate root. Declares modules. Exports `init_panic_hook()`. |
| `parser.rs` | `XlsxParser` struct. Uses `calamine` for cell data and `quick-xml` for OOXML parsing of charts (`xl/charts/*.xml`), conditional formats, sparklines, tables, merged cells, column widths, and row heights. Also reads `xl/voidCharts.json` for viewer-specific chart metadata. Returns JSON-serialized `WorkbookModel`. |
| `writer.rs` | `XlsxWriter` struct. Deserializes `WorkbookModel` from JSON, writes base XLSX via `rust_xlsxwriter`, then post-processes the ZIP with `inject_chart_files()` to generate OOXML-compliant chart XML, drawing XML, relationships, and content type entries for Excel compatibility. |
| `viewport.rs` | `ViewportManager` struct. Extracts a rectangular subset of cells from the model for efficient transfer to the renderer. |
| `formulas.rs` | `FormulaEngine` struct. 20 built-in functions with tokenizer, AST builder, dependency graph, and evaluation loop. Supports cell references, ranges, operators, and error values. |
| `context_menu.rs` | `ContextMenuManager` struct. Returns available context menu actions based on cell position and table membership. |
| `table_ops.rs` | `TableOps` struct. 9 table mutation methods: create, rename, resize, add/remove column, set style, set totals row function, toggle filter, convert to range. |
| `spike.rs` | `create_simple_xlsx()` function. Verification spike for `rust_xlsxwriter` in WASM. |

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
    tables: Vec<TableDefinition>,
    merged_cells: Vec<MergedCellRange>,
    col_widths: HashMap<u32, f64>,
    row_heights: HashMap<u32, f64>,
    conditional_formats: Vec<ConditionalFormatRule>,
    charts: Vec<ChartDefinition>,
    sparklines: Vec<SparklineDefinition>,
}

struct CellData {
    value: String,
    data_type: String,  // "s" | "n" | "b" | "e" | "d" | "null"
    style: Option<CellStyle>,
}

struct CellStyle {
    bold: Option<bool>,
    italic: Option<bool>,
    underline: Option<bool>,
    font_size: Option<f64>,
    font_family: Option<String>,
    text_color: Option<String>,
    fill_color: Option<String>,
    alignment: Option<String>,  // "left" | "center" | "right"
    number_format: Option<String>,
    wrap_text: Option<bool>,
}

struct TableDefinition {
    name: String,
    display_name: String,
    range: TableRange,
    columns: Vec<TableColumn>,
    has_header_row: bool,
    has_totals_row: bool,
    style_name: Option<String>,
    filter_enabled: bool,
}

struct ChartDefinition {
    chart_type: String,        // "bar" | "line" | "pie" | "scatter" | "area"
    series: Vec<ChartSeries>,
    title: Option<String>,
    legend: Option<ChartLegend>,
    anchor: Option<ChartAnchor>,
    axis: Option<ChartAxis>,
    style: Option<ChartStyle>,
}

struct ConditionalFormatRule {
    rule_type: String,
    operator: Option<String>,
    priority: u32,
    values: Vec<String>,
    ranges: Vec<String>,
    style: Option<CellStyle>,
    // data bar, color scale, icon set fields...
}
```

The model is serialized to JSON for transfer across the WASM boundary.

## Security (Content Security Policy)

The webview HTML sets a strict CSP:

```
default-src 'none';
script-src 'nonce-{uuid}' 'wasm-unsafe-eval' vscode-resource:;
style-src 'unsafe-inline' vscode-resource:;
connect-src {wasmUri};
```

- **`wasm-unsafe-eval`** — required for `WebAssembly.instantiate()` in the wasm-bindgen glue
- **`vscode-resource:`** — allows loading the bundled JS and WASM binary from `localResourceRoots`
- **`connect-src`** scoped to the specific WASM URI — the WASM binary is fetched at runtime via the `init()` function
- No inline scripts — only the nonce-tagged `<script>` tag is allowed

## VSCode Integration Patterns

| Pattern | How It's Used |
|---------|---------------|
| `IOverlayWebview` | Created via `IWebviewService.createWebviewOverlay()` with `localResourceRoots` and `allowScripts: true` |
| `asWebviewUri()` | Converts `file://` URIs to `vscode-resource:` URIs for the webview |
| `EditorPane` lifecycle | `createEditor()` → `setInput()` → `layout()` → `setEditorVisible()` → `clearInput()` → `dispose()` |
| `postMessage` protocol | Extension host sends `{ type, data }` messages; webview replies with `{ type }` status messages |
| `acquireVsCodeApi()` | Global function available in webview context for bidirectional messaging |
| `IWorkingCopy` | Dirty state tracking and auto-save integration via `XLSXRustWorkingCopy` |
| `vscode.setState/getState` | In-session persistence of chart state and editor state across tab switches |
| `URI.revive()` | Safe deserialization of URIs in the input serializer |

## Future Architecture (planned)

- **Web Worker** — move WASM execution off the main webview thread to prevent UI freezes on large files
- **Arrow IPC / Transferables** — zero-copy data transfer between Worker and main thread
- **Streaming viewport** — request only visible cell data from Rust instead of the full model
- **Shared WorkbookModel** — keep model in Rust memory, query it via viewport requests
- **AI table/chart creation** — allow AI agents to create tables and charts via the `edit_document` tool

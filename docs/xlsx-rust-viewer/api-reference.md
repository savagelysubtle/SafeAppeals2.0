# API Reference

## Rust WASM Exports

All Rust structs and functions decorated with `#[wasm_bindgen]` are exported to JavaScript via the generated `xlsx_rust_viewer.js` glue module. The WASM module is initialized by calling the default export `init(wasmUrl)`.

---

### Module Initialization

```typescript
import init, { init_panic_hook, greet } from './wasm/xlsx_rust_viewer.js';

// Initialize the WASM module (must be called before any other exports)
await init(wasmUrl: string): Promise<void>;

// Set up Rust panic hook for better error messages in the console
init_panic_hook(): void;

// Returns "Hello from Rust!" — smoke test
greet(): string;
```

---

### `XlsxParser`

Parses XLSX file bytes into the internal `WorkbookModel`. Uses `calamine` for cell data and `quick-xml` for OOXML structures (charts, conditional formats, sparklines, tables, merged cells, column widths, row heights).

**Source:** `wasm/src/parser.rs`

```typescript
class XlsxParser {
    constructor();

    /**
     * Parse XLSX bytes into a WorkbookModel.
     * @param data - Raw XLSX file bytes
     * @returns JSON string of WorkbookModel
     * @throws JsError on parse failure
     */
    load(data: Uint8Array): string;

    free(): void;
}
```

**Return format (JSON):**
```json
{
    "sheets": [
        {
            "name": "Sheet1",
            "row_count": 100,
            "col_count": 10,
            "cells": {
                "0": {
                    "0": { "value": "Name", "data_type": "s", "style": { "bold": true } },
                    "1": { "value": "Age", "data_type": "s" }
                },
                "1": {
                    "0": { "value": "Alice", "data_type": "s" },
                    "1": { "value": "30", "data_type": "n" }
                }
            },
            "tables": [ /* TableDefinition[] */ ],
            "merged_cells": [ /* MergedCellRange[] */ ],
            "col_widths": { "0": 120.0, "2": 200.0 },
            "row_heights": { "0": 30.0 },
            "conditional_formats": [ /* ConditionalFormatRule[] */ ],
            "charts": [ /* ChartDefinition[] */ ],
            "sparklines": [ /* SparklineDefinition[] */ ]
        }
    ]
}
```

**Cell data types:**
| `data_type` | Meaning |
|-------------|---------|
| `"s"` | String |
| `"n"` | Number (integer or float) |
| `"b"` | Boolean (`"true"` / `"false"`) |
| `"e"` | Error |
| `"d"` | Date/DateTime |
| `"null"` | Empty cell (omitted from sparse grid) |

**CellStyle fields** (all optional):
| Field | Type | Description |
|-------|------|-------------|
| `bold` | `bool` | Bold text |
| `italic` | `bool` | Italic text |
| `underline` | `bool` | Underlined text |
| `font_size` | `f64` | Font size in points |
| `font_family` | `string` | Font family name |
| `text_color` | `string` | Text color (hex) |
| `fill_color` | `string` | Background color (hex) |
| `alignment` | `string` | `"left"`, `"center"`, or `"right"` |
| `number_format` | `string` | Excel number format pattern |
| `wrap_text` | `bool` | Word wrap enabled |

---

### `XlsxWriter`

Serializes the internal `WorkbookModel` back to XLSX bytes. Uses `rust_xlsxwriter` for the base workbook, then post-processes the ZIP to inject OOXML chart XML, drawing files, relationships, and content types for Excel compatibility.

**Source:** `wasm/src/writer.rs`

```typescript
class XlsxWriter {
    constructor();

    /**
     * Convert a WorkbookModel JSON string to XLSX file bytes.
     * If the model contains charts, generates OOXML chart XML
     * (xl/charts/*.xml, xl/drawings/*.xml) and patches
     * [Content_Types].xml and worksheet relationships for
     * Excel round-trip compatibility.
     *
     * @param model_json - JSON string matching WorkbookModel schema
     * @returns XLSX file bytes as Uint8Array
     * @throws JsError on serialization failure
     */
    save(model_json: string): Uint8Array;

    free(): void;
}
```

---

### `FormulaEngine`

Formula evaluation engine with 20 built-in functions, tokenizer, AST parser, dependency graph, and evaluation loop.

**Source:** `wasm/src/formulas.rs`

**Supported functions:** `SUM`, `AVERAGE`/`AVG`, `MIN`, `MAX`, `COUNT`, `COUNTA`, `ABS`, `ROUND`, `IF`, `AND`, `OR`, `NOT`, `LEN`, `UPPER`, `LOWER`, `CONCATENATE`/`CONCAT`, `VLOOKUP`, plus operators (`+`, `-`, `*`, `/`, `^`, `&`, `=`, `<>`, `<`, `>`, `<=`, `>=`).

```typescript
class FormulaEngine {
    constructor();

    /**
     * Evaluate a single cell's formula.
     * @param row - Zero-based row index
     * @param col - Zero-based column index
     * @param cells_json - JSON string of the cells map (row → col → CellData)
     * @returns JSON: { "value": "...", "display": "..." }
     * @throws JsError if evaluation fails
     */
    evaluate_cell(row: number, col: number, cells_json: string): string;

    /**
     * Evaluate all formula cells in the sheet.
     * @param cells_json - JSON string of the cells map
     * @returns JSON: { "row:col": { "display": "...", "is_error": bool, "numeric": number|null } }
     */
    evaluate_all(cells_json: string): string;

    /**
     * Get the list of cells that depend on a given cell (transitively).
     * @param row - Zero-based row index
     * @param col - Zero-based column index
     * @returns JSON array of "row:col" strings
     */
    get_dependents(row: number, col: number): string;

    /**
     * Invalidate the cache for a cell and all its transitive dependents.
     * Call this when a cell's value changes.
     * @param row - Zero-based row index
     * @param col - Zero-based column index
     */
    invalidate(row: number, col: number): void;

    free(): void;
}
```

---

### `TableOps`

Table mutation operations. All methods take the full model JSON, apply mutations, and return the updated model JSON.

**Source:** `wasm/src/table_ops.rs`

```typescript
class TableOps {
    constructor();

    /**
     * Create a new table from the given range.
     * @param model_json - Full WorkbookModel JSON
     * @param sheet_idx - Zero-based sheet index
     * @param range_json - JSON: { start_row, start_col, end_row, end_col }
     * @param table_name - Name for the new table
     * @param style_name - Style name (e.g., "TableStyleMedium2")
     * @returns Updated model JSON
     */
    create_table(model_json: string, sheet_idx: number, range_json: string,
                 table_name: string, style_name: string): string;

    /**
     * Resize a table to a new range.
     * @param model_json - Full WorkbookModel JSON
     * @param table_name - Name of the table to resize
     * @param new_range_json - JSON: { start_row, start_col, end_row, end_col }
     * @returns Updated model JSON
     */
    resize_table(model_json: string, table_name: string, new_range_json: string): string;

    /**
     * Rename a table.
     * @returns Updated model JSON
     */
    rename_table(model_json: string, old_name: string, new_name: string): string;

    /**
     * Add a column to a table.
     * @returns Updated model JSON
     */
    add_table_column(model_json: string, table_name: string, col_name: string): string;

    /**
     * Remove a column from a table by index.
     * @returns Updated model JSON
     */
    remove_table_column(model_json: string, table_name: string, col_index: number): string;

    /**
     * Enable or disable the totals row and set aggregation functions.
     * @param functions_json - JSON array of { col_index: number, function: string }
     * @returns Updated model JSON
     */
    set_totals_row(model_json: string, table_name: string,
                   enabled: boolean, functions_json: string): string;

    /**
     * Set the table style.
     * @param style_name - e.g., "TableStyleLight1", "TableStyleMedium9", "TableStyleDark3"
     * @returns Updated model JSON
     */
    set_table_style(model_json: string, table_name: string, style_name: string): string;

    /**
     * Toggle the filter on a table.
     * @returns Updated model JSON
     */
    toggle_filter(model_json: string, table_name: string): string;

    /**
     * Convert a table back to a plain range (removes table structure, keeps data).
     * @returns Updated model JSON
     */
    convert_to_range(model_json: string, table_name: string): string;

    free(): void;
}
```

---

### `ViewportManager`

Extracts a rectangular subset of cells from a sheet for efficient rendering.

**Source:** `wasm/src/viewport.rs`

```typescript
class ViewportManager {
    constructor();

    /**
     * Get cells within a viewport rectangle.
     * @param model_json - Full WorkbookModel JSON
     * @param sheet_idx - Zero-based sheet index
     * @param start_row - First visible row (inclusive)
     * @param end_row - Last visible row (inclusive)
     * @param start_col - First visible column (inclusive)
     * @param end_col - Last visible column (inclusive)
     * @returns JSON string of SheetData with only the requested cells
     */
    get_viewport(
        model_json: string,
        sheet_idx: number,
        start_row: number, end_row: number,
        start_col: number, end_col: number
    ): string;

    free(): void;
}
```

---

### `ContextMenuManager`

Returns available context menu actions for a given cell position.

**Source:** `wasm/src/context_menu.rs`

```typescript
class ContextMenuManager {
    constructor();

    /**
     * Get context menu items for a cell.
     * @param row - Zero-based row index
     * @param col - Zero-based column index
     * @returns JSON string of { items: ContextMenuItem[] }
     */
    get_context_menu(row: number, col: number): string;

    free(): void;
}
```

---

### `create_simple_xlsx`

Verification spike function.

**Source:** `wasm/src/spike.rs`

```typescript
/**
 * Generate a minimal XLSX file in memory.
 * Used to verify rust_xlsxwriter works in WASM.
 * @returns XLSX file bytes as Uint8Array
 */
function create_simple_xlsx(): Uint8Array;
```

---

## TypeScript Interfaces

### Extension Host

#### `XLSXRustViewerEditor`

`EditorPane` subclass managing the webview lifecycle.

| Method | Description |
|--------|-------------|
| `setInput(input, options, context, token)` | Opens a file in the viewer. Creates webview if needed, queues file load. |
| `layout(dimension)` | Resizes the webview overlay to match the editor area. |
| `clearInput()` | Sends `clearXLSX` message to the webview. |
| `setEditorVisible(visible)` | Claims/releases webview, flushes pending saves on deactivation. |
| `triggerSave()` | Posts `saveXLSX` to the webview to initiate a save. |
| `handleSaveData(base64, targetUri?)` | Decodes base64 and writes XLSX bytes via `IFileService.writeFile()`. |

#### `XLSXRustViewerInput`

`EditorInput` subclass representing the file resource.

| Property/Method | Description |
|-----------------|-------------|
| `resource: URI` | The file URI. |
| `isDirty(): boolean` | Delegates to working copy. |
| `toJSON()` | Serializes resource URI safely (handles missing `.toJSON()`). |

#### `XLSXRustViewerInputSerializer`

Serializes/deserializes `XLSXRustViewerInput` for session restore.

| Method | Description |
|--------|-------------|
| `canSerialize(input)` | Returns `true` only if input has a valid resource URI. |
| `serialize(input)` | Calls `input.toJSON()`. |
| `deserialize(raw)` | Parses JSON and uses `URI.revive()` for safe URI reconstruction. |

#### `XLSXContentExtractor`

AI tool integration for extracting spreadsheet text content.

| Method | Description |
|--------|-------------|
| `extractContent(uri)` | Sends XLSX bytes to electron-main for text extraction via IPC. |

### Webview

#### `CanvasRenderer`

Canvas-based spreadsheet renderer with virtualization, selection, formatting, and conditional format rendering.

| Method/Property | Description |
|-----------------|-------------|
| `constructor(container)` | Creates canvas, sets up event listeners, initializes undo stack. |
| `setData(model)` | Sets the `WorkbookModel` data and triggers a render. |
| `resize()` | Recalculates canvas dimensions with DPI scaling. |
| `render()` | Draws visible cells, headers, gridlines, selection, data bars, color scales, icon sets, merged cells, freeze pane lines. |
| `setSelection(startRow, startCol, endRow, endCol)` | Programmatically set the cell selection range. |
| `toggleFormat(format)` | Toggle bold/italic/underline/strikethrough/wrapText on selection. |
| `applyFormat(key, value)` | Apply a formatting property to the selection. |
| `insertRow(at?)` | Insert a row at the given index or at current selection. |
| `insertCol(at?)` | Insert a column at the given index or at current selection. |
| `deleteRow(at?)` | Delete a row. |
| `deleteCol(at?)` | Delete a column. |
| `sortColumn(ascending, col?)` | Sort by column. |
| `mergeCellsSelection()` | Merge or unmerge the current selection. |
| `freezePanes()` | Freeze rows above and columns left of the selection. |
| `undo()` / `redo()` | Undo/redo model state. |
| `onContextMenu` | Callback: `(row, col, x, y) => void` |
| `onSelectionChanged` | Callback: `(row, col) => void` |
| `onCellEdited` | Callback: `(row, col, value) => void` |

#### `ChartManager`

Chart.js overlay manager for interactive chart rendering.

| Method | Description |
|--------|-------------|
| `addChart(chart)` | Add a ChartDefinition and create a Chart.js overlay. |
| `updateChart(index, chart)` | Update an existing chart's definition and re-render. |
| `removeChart(index)` | Remove a chart overlay. |
| `getCharts()` | Return all current ChartDefinition objects. |

#### `ChartWizardDialog`

Modal dialog for creating and editing charts.

| Method | Description |
|--------|-------------|
| `show(options?)` | Open the wizard. If options include a chart definition, edit mode. |
| `hide()` | Close the wizard. |

---

## Message Protocol

### Extension Host → Webview

| Message | Payload | Description |
|---------|---------|-------------|
| `loadXLSX` | `{ data: string, xlsxUri: string }` | Base64-encoded XLSX file bytes + file URI |
| `saveXLSX` | `{}` | Request the webview to serialize and send back XLSX bytes |
| `clearXLSX` | `{}` | Clear the current file display |
| `layout` | `{ width: number, height: number }` | Resize notification |
| `applyEdits` | `{ operations: XLSXEditOperation[] }` | AI tool edit operations (set cell, format, insert/delete row/col) |

### Webview → Extension Host

| Message | Payload | Description |
|---------|---------|-------------|
| `ready` | `{}` | WASM initialized, ready to receive files |
| `dirty` | `{}` | Document has been modified (triggers debounced save) |
| `saveData` | `{ data: string, chartDiag?: object }` | Base64-encoded XLSX bytes to write to disk |
| `print` | `{ imageData: string }` | Canvas snapshot as data URL for printing |
| `exportImage` | `{ imageData: string }` | Canvas snapshot as data URL for PNG export |
| `error` | `{ message: string }` | Initialization or load error |

### AI Edit Operations (`applyEdits`)

Posted by the open custom editor (`XlsxEditorProvider.applyEditsAndWait`) after host normalization in `extensions/safeappeals-documents/src/xlsx/xlsxEditOperations.ts`. Agent tool: `safeappeals_xlsx_edit`. Field names below match the webview handler (A1 refs preferred over raw row/col).

| Operation Type | Fields | Description |
|---------------|--------|-------------|
| `set_cell_value` | `cell`, `value`, `sheet?` | Set a cell's value (A1) |
| `set_cell_formula` | `cell`, `formula`, `sheet?` | Set a cell's formula |
| `format_cell` | `cell`, `format`, `sheet?` | Format a single cell |
| `format_range` | `range`, `format`, `sheet?` | Format A1:B10-style range (`format_cells` aliases here) |
| `insert_row` | `rowIndex`, `sheet?` | Insert a row |
| `insert_column` | `colIndex`, `sheet?` | Insert a column |
| `delete_row` | `rowIndex`, `sheet?` | Delete a row |
| `delete_column` | `colIndex`, `sheet?` | Delete a column |
| `create_table` | `range`, `tableName?`, `styleName?`, `sheet?` | Create table on selection; omitted/invalid sheet → **active sheet** |
| `resize_table` | `tableName`, `range`, `sheet?` | Resize table to A1:B10 range |
| `rename_table` | `oldName`, `newName` | Rename table |
| `set_table_style` | `tableName`, `styleName` | Apply Excel table style |
| `toggle_table_filter` | `tableName` | Toggle header filters |
| `set_totals_row` | `tableName`, `enabled` | Totals row on/off |
| `convert_table_to_range` | `tableName` | Convert table to plain range |
| `create_chart` / `insert_chart` | `chart_type` or `chartType`, `data_range` or `dataRange`, `title?`, `position?`, `sheet?` | Insert chart (`create_chart` is an alias) |
| `delete_chart` | `chart_index` or `chartIndex`, `sheet?` | Remove chart by 0-based index |

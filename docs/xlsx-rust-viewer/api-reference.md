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

// Returns "Hello from Rust!" -- smoke test
greet(): string;
```

---

### `XlsxParser`

Parses XLSX file bytes into the internal `WorkbookModel`.

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
                    "0": { "value": "Name", "data_type": "s" },
                    "1": { "value": "Age", "data_type": "s" }
                },
                "1": {
                    "0": { "value": "Alice", "data_type": "s" },
                    "1": { "value": "30", "data_type": "n" }
                }
            }
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

---

### `XlsxWriter`

Serializes the internal `WorkbookModel` back to XLSX bytes.

**Source:** `wasm/src/writer.rs`

```typescript
class XlsxWriter {
    constructor();

    /**
     * Convert a WorkbookModel JSON string to XLSX file bytes.
     * @param model_json - JSON string matching WorkbookModel schema
     * @returns XLSX file bytes as Uint8Array
     * @throws JsError on serialization failure
     */
    save(model_json: string): Uint8Array;

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

**Return format (JSON):**
```json
{
    "items": [
        { "id": "cut", "label": "Cut", "shortcut": "Ctrl+X" },
        { "id": "copy", "label": "Copy", "shortcut": "Ctrl+C" },
        { "id": "paste", "label": "Paste", "shortcut": "Ctrl+V" },
        { "id": "delete_row", "label": "Delete Row 5", "shortcut": null },
        { "id": "delete_col", "label": "Delete Column B", "shortcut": null },
        { "id": "insert_row_above", "label": "Insert Row Above", "shortcut": null },
        { "id": "insert_col_left", "label": "Insert Column Left", "shortcut": null }
    ]
}
```

---

### `FormulaEngine`

Placeholder formula evaluation engine.

**Source:** `wasm/src/formulas.rs`

```typescript
class FormulaEngine {
    constructor();

    /**
     * Register a formula for a cell. Parses the formula, extracts dependencies,
     * and updates the internal dependency graph.
     * @param cell_ref - Cell reference (e.g., "A1")
     * @param formula - Formula string (e.g., "=SUM(A1:A10)")
     */
    set_formula(cell_ref: string, formula: string): void;

    /**
     * Evaluate a cell's formula.
     * @param cell_ref - Cell reference to evaluate
     * @param get_value - JS callback (cellRef: string) => number
     * @returns Evaluated numeric result
     * @throws JsError if evaluation fails
     */
    evaluate(cell_ref: string, get_value: Function): number;

    free(): void;
}
```

> **Note:** The formula engine is a placeholder. `evaluate()` currently returns dummy values. The `get_value` callback mechanism is scaffolded but not fully functional.

---

### `TableOps`

Polars-based table operations.

**Source:** `wasm/src/table_ops.rs`

```typescript
class TableOps {
    constructor();

    /**
     * Sort an array of numbers.
     * @param values_json - JSON array of numbers (e.g., "[3.0, 1.0, 2.0]")
     * @param descending - Sort direction
     * @returns JSON array of sorted numbers
     */
    sort_column_data(values_json: string, descending: boolean): string;

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
| `getInput()` | Returns the current `XLSXRustViewerInput`. |
| `getWebview()` | Returns the `IOverlayWebview` instance. |

#### `XLSXRustViewerInput`

`EditorInput` subclass representing the file resource.

| Property/Method | Description |
|-----------------|-------------|
| `resource: URI` | The file URI. |
| `currentSheet: number` | Active sheet index. |
| `selection: XLSXSelection \| null` | Current cell selection. |
| `isDirty(): boolean` | Delegates to working copy. |
| `setContent(content)` | Store base64-encoded content. |
| `setWorkingCopy(wc)` | Link to `XLSXRustWorkingCopy` for dirty state. |

### Webview

#### `CanvasRenderer`

Canvas-based spreadsheet renderer.

| Method/Property | Description |
|-----------------|-------------|
| `constructor(container)` | Creates canvas, sets up event listeners. |
| `setData(model)` | Sets the `WorkbookModel` data and triggers a render. |
| `resize()` | Recalculates canvas dimensions with DPI scaling. |
| `render()` | Draws visible cells, headers, gridlines, and selection highlight. |
| `onContextMenu` | Callback: `(row, col, x, y) => void` |
| `onSelectionChanged` | Callback: `(row, col) => void` |

---

## Message Protocol

### Extension Host → Webview

| Message | Payload | Description |
|---------|---------|-------------|
| `loadXLSX` | `{ data: string, xlsxUri: string }` | Base64-encoded XLSX file bytes |
| `clearXLSX` | `{}` | Clear the current file display |

### Webview → Extension Host

| Message | Payload | Description |
|---------|---------|-------------|
| `ready` | `{}` | WASM initialized, ready to receive files |
| `error` | `{ message: string }` | Initialization or load error |
| `contextMenu` | `{ row, col, items }` | User right-clicked; items from Rust |

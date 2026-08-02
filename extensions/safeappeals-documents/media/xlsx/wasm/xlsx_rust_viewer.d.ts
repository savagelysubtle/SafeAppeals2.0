/* tslint:disable */
/* eslint-disable */

export class ContextMenuManager {
    free(): void;
    [Symbol.dispose](): void;
    get_context_menu(row: number, col: number): string;
    constructor();
}

export class FormulaEngine {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Evaluate all formula cells across all sheets.
     * `all_sheets_json` is: { "SheetName": { "row": { "col": { "value": "...", "data_type": "..." } } } }
     * `active_sheet` is the sheet to return results for.
     * Returns JSON: { "row:col": { "display": "...", "is_error": bool, "numeric": number|null } }
     */
    evaluate_all(all_sheets_json: string, active_sheet: string): string;
    /**
     * Evaluate a single cell's formula.
     * `all_sheets_json` is: { "SheetName": { "row": { "col": { "value": "...", "data_type": "..." } } } }
     * `active_sheet` is the name of the sheet containing the cell.
     */
    evaluate_cell(row: number, col: number, all_sheets_json: string, active_sheet: string): string;
    /**
     * When a cell is edited, return the list of cells (as "row:col") that need re-evaluation.
     */
    get_dependents(row: number, col: number): string;
    /**
     * Invalidate the cache for a cell and its dependents
     */
    invalidate(row: number, col: number): void;
    constructor();
    /**
     * Register named ranges from the workbook model.
     * `json` is an array of { name, formula, local_sheet_id?, hidden? } objects.
     */
    set_named_ranges(json: string): void;
}

export class TableOps {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Add a column to a table. Returns updated model JSON.
     */
    add_table_column(model_json: string, table_name: string, col_name: string): string;
    /**
     * Convert a table back to a plain range (removes table, keeps data). Returns updated model JSON.
     */
    convert_to_range(model_json: string, table_name: string): string;
    /**
     * Create a new table from the given range on the specified sheet.
     * Returns updated model JSON.
     */
    create_table(model_json: string, sheet_idx: number, range_json: string, table_name: string, style_name: string): string;
    constructor();
    /**
     * Remove a column from a table by index. Returns updated model JSON.
     */
    remove_table_column(model_json: string, table_name: string, col_index: number): string;
    /**
     * Rename a table. Returns updated model JSON.
     */
    rename_table(model_json: string, old_name: string, new_name: string): string;
    /**
     * Resize an existing table to a new range. Returns updated model JSON.
     */
    resize_table(model_json: string, table_name: string, new_range_json: string): string;
    /**
     * Set table style. Returns updated model JSON.
     */
    set_table_style(model_json: string, table_name: string, style_name: string): string;
    /**
     * Toggle or set the totals row. Returns updated model JSON.
     * functions_json is a JSON array of TotalsFunctionInput objects.
     */
    set_totals_row(model_json: string, table_name: string, enabled: boolean, functions_json: string): string;
    /**
     * Toggle filter on a table. Returns updated model JSON.
     */
    toggle_filter(model_json: string, table_name: string): string;
}

export class ViewportManager {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Returns a JSON string of a `SheetData` containing only the cells in the requested viewport.
     */
    get_viewport(model_json: string, sheet_idx: number, start_row: number, end_row: number, start_col: number, end_col: number): string;
    constructor();
}

export class XlsxParser {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Loads XLSX bytes and returns the full workbook model as JSON string.
     */
    load(data: Uint8Array): string;
    constructor();
}

export class XlsxWriter {
    free(): void;
    [Symbol.dispose](): void;
    constructor();
    save(model_json: string): Uint8Array;
}

export function create_simple_xlsx(): Uint8Array;

export function greet(): string;

export function init_panic_hook(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_xlsxparser_free: (a: number, b: number) => void;
    readonly xlsxparser_load: (a: number, b: number, c: number) => [number, number, number, number];
    readonly xlsxparser_new: () => number;
    readonly __wbg_formulaengine_free: (a: number, b: number) => void;
    readonly formulaengine_evaluate_all: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly formulaengine_evaluate_cell: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly formulaengine_get_dependents: (a: number, b: number, c: number) => [number, number];
    readonly formulaengine_invalidate: (a: number, b: number, c: number) => void;
    readonly formulaengine_new: () => number;
    readonly formulaengine_set_named_ranges: (a: number, b: number, c: number) => [number, number];
    readonly __wbg_xlsxwriter_free: (a: number, b: number) => void;
    readonly xlsxwriter_save: (a: number, b: number, c: number) => [number, number, number, number];
    readonly xlsxwriter_new: () => number;
    readonly __wbg_contextmenumanager_free: (a: number, b: number) => void;
    readonly __wbg_tableops_free: (a: number, b: number) => void;
    readonly __wbg_viewportmanager_free: (a: number, b: number) => void;
    readonly contextmenumanager_get_context_menu: (a: number, b: number, c: number) => [number, number, number, number];
    readonly create_simple_xlsx: () => [number, number, number, number];
    readonly tableops_add_table_column: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly tableops_convert_to_range: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly tableops_create_table: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number, j: number) => [number, number, number, number];
    readonly tableops_remove_table_column: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
    readonly tableops_rename_table: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly tableops_resize_table: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly tableops_set_table_style: (a: number, b: number, c: number, d: number, e: number, f: number, g: number) => [number, number, number, number];
    readonly tableops_set_totals_row: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
    readonly tableops_toggle_filter: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly viewportmanager_get_viewport: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => [number, number, number, number];
    readonly contextmenumanager_new: () => number;
    readonly tableops_new: () => number;
    readonly viewportmanager_new: () => number;
    readonly greet: () => [number, number];
    readonly init_panic_hook: () => void;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

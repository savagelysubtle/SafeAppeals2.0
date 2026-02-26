/* tslint:disable */
/* eslint-disable */

export class PdfRenderer {
    free(): void;
    [Symbol.dispose](): void;
    /**
     * Free the loaded document and release memory.
     */
    close(): void;
    /**
     * Get document outline as JSON tree.
     */
    get_outline(): string;
    /**
     * Get page dimensions in PDF points.
     */
    get_page_dimensions(index: number): string;
    /**
     * Extract text from a page with bounding boxes.
     * Returns JSON array: [{text, x, y, width, height, font_size}]
     */
    get_page_text(index: number): string;
    /**
     * Load PDF from bytes. Returns JSON metadata: { page_count, pages: [{width, height}] }
     */
    load(data: Uint8Array): string;
    constructor();
    /**
     * Get total page count.
     */
    page_count(): number;
    /**
     * Render a page to ImageData at target pixel dimensions.
     */
    render_page(index: number, width: number, height: number): ImageData;
    /**
     * Render a thumbnail for a page, scaling width to max_width and preserving aspect ratio.
     */
    render_thumbnail(index: number, max_width: number): ImageData;
}

export function init_panic_hook(): void;

/**
 * Establishes a binding between an external Pdfium WASM module and `pdfium-render`'s WASM module.
 * This function should be called from Javascript once the external Pdfium WASM module has been loaded
 * into the browser. It is essential that this function is called _before_ initializing
 * `pdfium-render` from within Rust code. For an example, see:
 * <https://github.com/ajrcarey/pdfium-render/blob/master/examples/index.html>
 */
export function initialize_pdfium_render(pdfium_wasm_module: any, local_wasm_module: any): boolean;

/**
 * A callback function that can be invoked by Pdfium's `FPDF_LoadCustomDocument()` function,
 * wrapping around `crate::utils::files::read_block_from_callback()` to shuffle data buffers
 * from our WASM memory heap to Pdfium's WASM memory heap as they are loaded.
 */
export function read_block_from_callback_wasm(param: number, position: number, pBuf: number, size: number): number;

/**
 * A callback function that can be invoked by Pdfium's `FPDF_SaveAsCopy()` and `FPDF_SaveWithVersion()`
 * functions, wrapping around `crate::utils::files::write_block_from_callback()` to shuffle data buffers
 * from Pdfium's WASM memory heap to our WASM memory heap as they are written.
 */
export function write_block_from_callback_wasm(param: number, buf: number, size: number): number;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_pdfrenderer_free: (a: number, b: number) => void;
    readonly pdfrenderer_close: (a: number) => void;
    readonly pdfrenderer_get_outline: (a: number) => [number, number, number, number];
    readonly pdfrenderer_get_page_dimensions: (a: number, b: number) => [number, number, number, number];
    readonly pdfrenderer_get_page_text: (a: number, b: number) => [number, number, number, number];
    readonly pdfrenderer_load: (a: number, b: number, c: number) => [number, number, number, number];
    readonly pdfrenderer_new: () => number;
    readonly pdfrenderer_page_count: (a: number) => number;
    readonly pdfrenderer_render_page: (a: number, b: number, c: number, d: number) => [number, number, number];
    readonly pdfrenderer_render_thumbnail: (a: number, b: number, c: number) => [number, number, number];
    readonly init_panic_hook: () => void;
    readonly initialize_pdfium_render: (a: any, b: any) => number;
    readonly read_block_from_callback_wasm: (a: number, b: number, c: number, d: number) => number;
    readonly write_block_from_callback_wasm: (a: number, b: number, c: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
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

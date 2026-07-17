/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const __wbg_pdfrenderer_free: (a: number, b: number) => void;
export const pdfrenderer_close: (a: number) => void;
export const pdfrenderer_get_form_fields: (a: number, b: number) => [number, number, number, number];
export const pdfrenderer_get_outline: (a: number) => [number, number, number, number];
export const pdfrenderer_get_page_dimensions: (a: number, b: number) => [number, number, number, number];
export const pdfrenderer_get_page_text: (a: number, b: number) => [number, number, number, number];
export const pdfrenderer_load: (a: number, b: number, c: number) => [number, number, number, number];
export const pdfrenderer_new: () => number;
export const pdfrenderer_page_count: (a: number) => number;
export const pdfrenderer_render_page: (a: number, b: number, c: number, d: number) => [number, number, number];
export const pdfrenderer_render_thumbnail: (a: number, b: number, c: number) => [number, number, number];
export const init_panic_hook: () => void;
export const initialize_pdfium_render: (a: any, b: any) => number;
export const read_block_from_callback_wasm: (a: number, b: number, c: number, d: number) => number;
export const write_block_from_callback_wasm: (a: number, b: number, c: number) => number;
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __wbindgen_exn_store: (a: number) => void;
export const __externref_table_alloc: () => number;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_start: () => void;

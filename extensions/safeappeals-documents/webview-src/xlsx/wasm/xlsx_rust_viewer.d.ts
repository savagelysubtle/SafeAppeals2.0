/* tslint:disable */
/* eslint-disable */

export class XlsxParser {
	free(): void;
	constructor();
	load(data: Uint8Array): string;
}

export class XlsxWriter {
	free(): void;
	constructor();
	save(model_json: string): Uint8Array;
}

export class TableOps {
	free(): void;
	constructor();
	create_table(model_json: string, sheet_idx: number, range_json: string, table_name: string, style_name: string): string;
	resize_table(model_json: string, table_name: string, range_json: string): string;
	rename_table(model_json: string, old_name: string, new_name: string): string;
	toggle_filter(model_json: string, table_name: string): string;
	set_table_style(model_json: string, table_name: string, style_name: string): string;
	set_totals_row(model_json: string, table_name: string, enabled: boolean, functions_json: string): string;
	convert_to_range(model_json: string, table_name: string): string;
	add_table_column(model_json: string, table_name: string, col_name: string): string;
	remove_table_column(model_json: string, table_name: string, col_index: number): string;
}

export class FormulaEngine {
	free(): void;
	constructor();
	evaluate_all(cells_json: string, active_sheet: string): string;
	set_named_ranges(named_ranges_json: string): void;
	invalidate(row: number, col: number): void;
}

export class ContextMenuManager {
	free(): void;
	constructor();
	get_context_menu(row: number, col: number): string;
}

export function init_panic_hook(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
	readonly memory: WebAssembly.Memory;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

export default function __wbg_init(module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;

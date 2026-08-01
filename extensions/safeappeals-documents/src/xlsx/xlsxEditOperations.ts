/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * Supported `safeappeals_xlsx_edit` operation `type` values (open-editor / webview path).
 */
export const SUPPORTED_XLSX_EDIT_OP_TYPES = [
	'set_cell_value',
	'set_cell_formula',
	'format_cell',
	'format_range',
	'insert_row',
	'insert_column',
	'delete_row',
	'delete_column',
	'create_table',
	'resize_table',
	'rename_table',
	'set_table_style',
	'toggle_table_filter',
	'set_totals_row',
	'convert_table_to_range',
	'create_chart',
	'insert_chart',
	'delete_chart',
] as const;

export type SupportedXlsxEditOpType = (typeof SUPPORTED_XLSX_EDIT_OP_TYPES)[number];

const SUPPORTED_TYPE_SET = new Set<string>(SUPPORTED_XLSX_EDIT_OP_TYPES);

/**
 * Human-readable list of supported edit operation types for tool error messages.
 */
export function describeXlsxEditOperations(): string {
	return SUPPORTED_XLSX_EDIT_OP_TYPES.join(', ');
}

/**
 * Returns true when `type` is a known XLSX edit operation after host normalization.
 */
export function isSupportedXlsxEditOpType(type: string): boolean {
	return SUPPORTED_TYPE_SET.has(type);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalize a single agent/edit operation for the XLSX webview applyEdits handler.
 * Aliases: `format_cells` → `format_range`; camelCase chart fields → snake_case.
 */
export function normalizeXlsxEditOperation(op: unknown): unknown {
	if (!isPlainObject(op)) {
		return op;
	}

	const next: Record<string, unknown> = { ...op };
	const rawType = typeof next.type === 'string' ? next.type : undefined;

	if (rawType === 'format_cells') {
		next.type = 'format_range';
	}

	if (next.chart_type === undefined && next.chartType !== undefined) {
		next.chart_type = next.chartType;
		delete next.chartType;
	}
	if (next.data_range === undefined && next.dataRange !== undefined) {
		next.data_range = next.dataRange;
		delete next.dataRange;
	}
	if (next.chart_index === undefined && next.chartIndex !== undefined) {
		next.chart_index = next.chartIndex;
		delete next.chartIndex;
	}

	return next;
}

/**
 * Normalize a batch of XLSX edit operations before posting to the open editor.
 */
export function normalizeXlsxEditOperations(ops: readonly unknown[]): unknown[] {
	return ops.map(normalizeXlsxEditOperation);
}

/**
 * Collect unsupported `type` values after normalization (for tool error messages).
 */
export function findUnsupportedXlsxEditOpTypes(ops: readonly unknown[]): string[] {
	const unsupported: string[] = [];
	const seen = new Set<string>();
	for (const op of ops) {
		if (!isPlainObject(op) || typeof op.type !== 'string') {
			continue;
		}
		if (!isSupportedXlsxEditOpType(op.type) && !seen.has(op.type)) {
			seen.add(op.type);
			unsupported.push(op.type);
		}
	}
	return unsupported;
}

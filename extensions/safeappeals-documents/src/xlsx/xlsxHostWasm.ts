/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as fs from 'fs';
import * as path from 'path';
import { pathToFileURL } from 'url';
import type * as vscode from 'vscode';

/**
 * Minimal local interfaces mirroring media/xlsx/wasm/xlsx_rust_viewer.d.ts
 * (media .d.ts is outside rootDir and cannot be imported by gulp compile).
 */
export interface XlsxParserLike {
	load(data: Uint8Array): string;
	free(): void;
}

export interface XlsxWriterLike {
	save(modelJson: string): Uint8Array;
	free(): void;
}

export interface TableOpsLike {
	create_table(
		modelJson: string,
		sheetIdx: number,
		rangeJson: string,
		tableName: string,
		styleName: string,
	): string;
	resize_table(modelJson: string, tableName: string, rangeJson: string): string;
	rename_table(modelJson: string, oldName: string, newName: string): string;
	toggle_filter(modelJson: string, tableName: string): string;
	set_table_style(modelJson: string, tableName: string, styleName: string): string;
	set_totals_row(
		modelJson: string,
		tableName: string,
		enabled: boolean,
		functionsJson: string,
	): string;
	convert_to_range(modelJson: string, tableName: string): string;
	free(): void;
}

export interface FormulaEngineLike {
	evaluate_all(allSheetsJson: string, activeSheet: string): string;
	evaluate_cell(row: number, col: number, allSheetsJson: string, activeSheet: string): string;
	free(): void;
}

interface XlsxWasmGlue {
	XlsxParser: new () => XlsxParserLike;
	XlsxWriter: new () => XlsxWriterLike;
	TableOps: new () => TableOpsLike;
	FormulaEngine: new () => FormulaEngineLike;
	init_panic_hook: () => void;
	initSync: (opts: { module: Uint8Array | ArrayBuffer }) => unknown;
}

export interface XlsxHostWasm {
	XlsxParser: new () => XlsxParserLike;
	XlsxWriter: new () => XlsxWriterLike;
	TableOps: new () => TableOpsLike;
	FormulaEngine: new () => FormulaEngineLike;
}

let configuredDir: string | undefined;
let loadPromise: Promise<XlsxHostWasm> | undefined;
let cached: XlsxHostWasm | undefined;
let cachedFailure: Error | undefined;

/**
 * Eval'd dynamic import so TypeScript's CJS emit cannot rewrite `import()` to `require()`.
 */
const dynamicImport = new Function('s', 'return import(s)') as (specifier: string) => Promise<XlsxWasmGlue>;

/**
 * Configure WASM directory from the extension URI (`media/xlsx/wasm`).
 * Call once from activation / registerAgentTools.
 */
export function configureXlsxHostWasm(extensionUri: vscode.Uri): void {
	configuredDir = path.join(extensionUri.fsPath, 'media', 'xlsx', 'wasm');
	loadPromise = undefined;
	cached = undefined;
	cachedFailure = undefined;
}

/**
 * Test/helper: set an absolute directory that contains the glue + .wasm.
 */
export function setXlsxHostWasmDir(absoluteDir: string): void {
	configuredDir = absoluteDir;
	loadPromise = undefined;
	cached = undefined;
	cachedFailure = undefined;
}

/**
 * Lazy-load web-target WASM via file:// dynamic import + initSync(bytes).
 * Failures are cached so tools can surface a clear error without retry storms.
 */
export async function ensureXlsxHostWasm(): Promise<XlsxHostWasm> {
	if (cached) {
		return cached;
	}
	if (cachedFailure) {
		throw cachedFailure;
	}
	if (!loadPromise) {
		loadPromise = loadXlsxHostWasm().catch(err => {
			cachedFailure = err instanceof Error ? err : new Error(String(err));
			loadPromise = undefined;
			throw cachedFailure;
		});
	}
	cached = await loadPromise;
	return cached;
}

async function loadXlsxHostWasm(): Promise<XlsxHostWasm> {
	if (!configuredDir) {
		throw new Error(
			'XLSX host WASM is not configured. Call configureXlsxHostWasm(extensionUri) during activation.',
		);
	}
	const jsPath = path.join(configuredDir, 'xlsx_rust_viewer.js');
	const wasmPath = path.join(configuredDir, 'xlsx_rust_viewer_bg.wasm');
	if (!fs.existsSync(jsPath) || !fs.existsSync(wasmPath)) {
		throw new Error(`XLSX WASM files missing under ${configuredDir}`);
	}

	const mod = await dynamicImport(pathToFileURL(jsPath).href);
	const wasmBytes = fs.readFileSync(wasmPath);
	mod.initSync({ module: wasmBytes });
	mod.init_panic_hook();
	return {
		XlsxParser: mod.XlsxParser,
		XlsxWriter: mod.XlsxWriter,
		TableOps: mod.TableOps,
		FormulaEngine: mod.FormulaEngine,
	};
}

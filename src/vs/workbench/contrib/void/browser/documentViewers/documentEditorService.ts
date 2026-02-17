/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IDocumentCreatorService } from '../documentCreatorService.js';
import { DOCXViewerEditor } from './docxViewer/docxViewerEditor.js';
import { XLSXRustViewerEditor } from './xlsxRustViewer/xlsxRustViewerEditor.js';

export const IDocumentEditorService = createDecorator<IDocumentEditorService>('documentEditorService');

export type DOCXEditOperation =
	| { type: 'format_text'; range: { start: number; end: number }; format: { bold?: boolean; italic?: boolean; underline?: boolean; fontSize?: number; fontFamily?: string; color?: string } }
	| { type: 'insert_text'; position: number; text: string }
	| { type: 'insert_table'; position: number; rows: number; cols: number }
	| { type: 'insert_page_break'; position: number }
	| { type: 'set_margins'; margins: { top: number; right: number; bottom: number; left: number } }
	| { type: 'replace_text'; search: string; replace: string; all?: boolean };

export type XLSXEditOperation =
	| { type: 'set_cell_value'; sheet: string | number; cell: string; value: string | number }
	| { type: 'set_cell_formula'; sheet: string | number; cell: string; formula: string }
	| { type: 'format_cell'; sheet: string | number; cell: string; format: { bold?: boolean; italic?: boolean; backgroundColor?: string; fontSize?: number } }
	| { type: 'insert_row'; sheet: string | number; rowIndex: number }
	| { type: 'insert_column'; sheet: string | number; colIndex: number }
	| { type: 'delete_row'; sheet: string | number; rowIndex: number }
	| { type: 'delete_column'; sheet: string | number; colIndex: number }
	| { type: 'create_table'; sheet: string | number; range: string; tableName: string; styleName?: string }
	| { type: 'resize_table'; tableName: string; range: string }
	| { type: 'rename_table'; oldName: string; newName: string }
	| { type: 'set_table_style'; tableName: string; styleName: string }
	| { type: 'toggle_table_filter'; tableName: string }
	| { type: 'set_totals_row'; tableName: string; enabled: boolean }
	| { type: 'convert_table_to_range'; tableName: string };

export interface IDocumentEditorService {
	readonly _serviceBrand: undefined;

	/**
	 * Check if document is currently open in a viewer
	 */
	isDocumentOpen(uri: URI): boolean;

	/**
	 * Edit operations for DOCX
	 */
	editDOCX(params: {
		uri: URI;
		operations: DOCXEditOperation[];
	}): Promise<{ success: boolean; error?: string; message?: string }>;

	/**
	 * Edit operations for XLSX
	 */
	editXLSX(params: {
		uri: URI;
		operations: XLSXEditOperation[];
	}): Promise<{ success: boolean; error?: string; message?: string }>;
}

export class DocumentEditorService implements IDocumentEditorService {
	readonly _serviceBrand: undefined;

	constructor(
		@IEditorService private readonly editorService: IEditorService,
		@IDocumentCreatorService private readonly documentCreatorService: IDocumentCreatorService,
		@ILogService private readonly logService: ILogService,
	) { }

	isDocumentOpen(uri: URI): boolean {
		// Check if any editor pane has this document open
		const editors = this.editorService.visibleEditorPanes;
		return editors.some(editor => {
			if (editor instanceof DOCXViewerEditor || editor instanceof XLSXRustViewerEditor) {
				const input = editor.getInput();
				return input?.resource.toString() === uri.toString();
			}
			return false;
		});
	}

	async editDOCX(params: { uri: URI; operations: DOCXEditOperation[] }): Promise<{ success: boolean; error?: string; message?: string }> {
		// If document is open, send edit commands to viewer via webview message (live editing)
		if (this.isDocumentOpen(params.uri)) {
			return this.editOpenDOCX(params);
		}

		// If document is closed, edit using backend docx library
		return this.editClosedDOCX(params);
	}

	/**
	 * Edit a closed DOCX file using the backend service via IPC
	 * This delegates to the main process where Node modules are available
	 */
	private async editClosedDOCX(params: { uri: URI; operations: DOCXEditOperation[] }): Promise<{ success: boolean; error?: string; message?: string }> {
		try {
			this.logService.info(`[DocumentEditorService] Editing closed DOCX via IPC: ${params.uri.fsPath}`);

			// Filter operations to only those supported by backend
			const supportedOps = params.operations.filter(op =>
				op.type === 'insert_text' || op.type === 'replace_text'
			);

			if (supportedOps.length === 0) {
				return {
					success: false,
					error: `No supported operations found. Available operations for closed documents: insert_text, replace_text`,
					message: `Operations like format_text, insert_table require the document to be open in the viewer.`
				};
			}

			// Check for unsupported operations
			const unsupportedOps = params.operations.filter(op =>
				op.type !== 'insert_text' && op.type !== 'replace_text'
			);

			if (unsupportedOps.length > 0) {
				this.logService.warn(`[DocumentEditorService] Skipping ${unsupportedOps.length} unsupported operation(s): ${unsupportedOps.map(o => o.type).join(', ')}`);
			}

			// Convert operations to backend format (strip type info for TypeScript compatibility)
			const backendOps = supportedOps.map(op => ({
				type: op.type,
				position: 'position' in op ? op.position : undefined,
				text: 'text' in op ? op.text : undefined,
				search: 'search' in op ? op.search : undefined,
				replace: 'replace' in op ? op.replace : undefined,
				all: 'all' in op ? op.all : undefined
			}));

			// Call backend via IPC
			const result = await this.documentCreatorService.editDOCX(params.uri, backendOps as any);

			this.logService.info(`[DocumentEditorService] Backend edit result:`, result);

			return result;

		} catch (error) {
			this.logService.error(`[DocumentEditorService] Failed to edit closed DOCX:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				message: `Failed to edit document: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	private async editOpenDOCX(params: { uri: URI; operations: DOCXEditOperation[] }): Promise<{ success: boolean; error?: string; message?: string }> {
		// Find the open viewer
		const viewer = this.findDOCXViewer(params.uri);
		const webview = viewer?.getWebview();
		if (!webview) {
			return { success: false, error: 'Viewer not found or webview not initialized' };
		}

		// Send edit commands to webview
		webview.postMessage({
			type: 'applyEdits',
			operations: params.operations
		});

		return {
			success: true,
			message: `Applied ${params.operations.length} edit operation(s) to ${params.uri.fsPath}`
		};
	}

	private findDOCXViewer(uri: URI): DOCXViewerEditor | undefined {
		const editors = this.editorService.visibleEditorPanes;
		for (const editor of editors) {
			if (editor instanceof DOCXViewerEditor) {
				const input = editor.getInput();
				if (input?.resource.toString() === uri.toString()) {
					return editor;
				}
			}
		}
		return undefined;
	}

	async editXLSX(params: { uri: URI; operations: XLSXEditOperation[] }): Promise<{ success: boolean; error?: string; message?: string }> {
		// If document is open, send edit commands to viewer via webview message (live editing)
		if (this.isDocumentOpen(params.uri)) {
			return this.editOpenXLSX(params);
		}

		// If document is closed, edit using backend xlsx library
		return this.editClosedXLSX(params);
	}

	/**
	 * Edit a closed XLSX file using the backend service via IPC
	 * This delegates to the main process where Node modules are available
	 */
	private async editClosedXLSX(params: { uri: URI; operations: XLSXEditOperation[] }): Promise<{ success: boolean; error?: string; message?: string }> {
		try {
			this.logService.info(`[DocumentEditorService] Editing closed XLSX via IPC: ${params.uri.fsPath}`);

			// Filter operations to only those supported by backend
			const supportedOps = params.operations.filter(op =>
				op.type === 'set_cell_value' || op.type === 'set_cell_formula'
			);

			if (supportedOps.length === 0) {
				return {
					success: false,
					error: `No supported operations found. Available operations for closed documents: set_cell_value, set_cell_formula`,
					message: `Operations like format_cell, insert_row require the document to be open in the viewer.`
				};
			}

			// Check for unsupported operations
			const unsupportedOps = params.operations.filter(op =>
				op.type !== 'set_cell_value' && op.type !== 'set_cell_formula'
			);

			if (unsupportedOps.length > 0) {
				this.logService.warn(`[DocumentEditorService] Skipping ${unsupportedOps.length} unsupported operation(s): ${unsupportedOps.map(o => o.type).join(', ')}`);
			}

			// Convert operations to backend format
			const backendOps = supportedOps.map(op => ({
				type: op.type,
				sheet: op.sheet,
				cell: op.cell,
				value: 'value' in op ? op.value : undefined,
				formula: 'formula' in op ? op.formula : undefined
			}));

			// Call backend via IPC
			const result = await this.documentCreatorService.editXLSX(params.uri, backendOps as any);

			this.logService.info(`[DocumentEditorService] Backend edit result:`, result);

			return result;

		} catch (error) {
			this.logService.error(`[DocumentEditorService] Failed to edit closed XLSX:`, error);
			return {
				success: false,
				error: error instanceof Error ? error.message : String(error),
				message: `Failed to edit document: ${error instanceof Error ? error.message : String(error)}`
			};
		}
	}

	private async editOpenXLSX(params: { uri: URI; operations: XLSXEditOperation[] }): Promise<{ success: boolean; error?: string; message?: string }> {
		// Find the open viewer
		const viewer = this.findXLSXViewer(params.uri);
		const webview = viewer?.getWebview();
		if (!webview) {
			return { success: false, error: 'Viewer not found or webview not initialized' };
		}

		// Send edit commands to webview
		webview.postMessage({
			type: 'applyEdits',
			operations: params.operations
		});

		return {
			success: true,
			message: `Applied ${params.operations.length} edit operation(s) to ${params.uri.fsPath}`
		};
	}

	private findXLSXViewer(uri: URI): XLSXRustViewerEditor | undefined {
		const editors = this.editorService.visibleEditorPanes;
		for (const editor of editors) {
			if (editor instanceof XLSXRustViewerEditor) {
				const input = editor.getInput();
				if (input?.resource.toString() === uri.toString()) {
					return editor;
				}
			}
		}
		return undefined;
	}
}

// Register as singleton
registerSingleton(IDocumentEditorService, DocumentEditorService, InstantiationType.Delayed);


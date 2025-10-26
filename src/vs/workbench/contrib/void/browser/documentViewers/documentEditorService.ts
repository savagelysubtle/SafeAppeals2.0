/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { DOCXViewerEditor } from './docxViewer/docxViewerEditor.js';
import { XLSXViewerEditor } from './xlsxViewer/xlsxViewerEditor.js';

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
	| { type: 'delete_column'; sheet: string | number; colIndex: number };

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
	) { }

	isDocumentOpen(uri: URI): boolean {
		// Check if any editor pane has this document open
		const editors = this.editorService.visibleEditorPanes;
		return editors.some(editor => {
			if (editor instanceof DOCXViewerEditor || editor instanceof XLSXViewerEditor) {
				const input = editor.getInput();
				return input?.resource.toString() === uri.toString();
			}
			return false;
		});
	}

	async editDOCX(params: { uri: URI; operations: DOCXEditOperation[] }): Promise<{ success: boolean; error?: string; message?: string }> {
		// If document is open, send edit commands to viewer via webview message
		if (this.isDocumentOpen(params.uri)) {
			return this.editOpenDOCX(params);
		}

		// If document is closed, return error for now
		return {
			success: false,
			error: 'Document must be open to edit. Please open the document first.',
			message: 'Editing closed DOCX files is not yet implemented. Open the file in the viewer first.'
		};
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
		// If document is open, send edit commands to viewer via webview message
		if (this.isDocumentOpen(params.uri)) {
			return this.editOpenXLSX(params);
		}

		// If document is closed, return error for now
		return {
			success: false,
			error: 'Document must be open to edit. Please open the document first.',
			message: 'Editing closed XLSX files is not yet implemented. Open the file in the viewer first.'
		};
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

	private findXLSXViewer(uri: URI): XLSXViewerEditor | undefined {
		const editors = this.editorService.visibleEditorPanes;
		for (const editor of editors) {
			if (editor instanceof XLSXViewerEditor) {
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


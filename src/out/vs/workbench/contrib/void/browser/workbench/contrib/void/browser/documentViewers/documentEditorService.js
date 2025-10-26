/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
import { registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { DOCXViewerEditor } from './docxViewer/docxViewerEditor.js';
import { XLSXViewerEditor } from './xlsxViewer/xlsxViewerEditor.js';
export const IDocumentEditorService = createDecorator('documentEditorService');
export class DocumentEditorService {
    editorService;
    _serviceBrand;
    constructor(editorService) {
        this.editorService = editorService;
    }
    isDocumentOpen(uri) {
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
    async editDOCX(params) {
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
    async editOpenDOCX(params) {
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
    findDOCXViewer(uri) {
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
    async editXLSX(params) {
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
    async editOpenXLSX(params) {
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
    findXLSXViewer(uri) {
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
registerSingleton(IDocumentEditorService, DocumentEditorService, 1 /* InstantiationType.Delayed */);

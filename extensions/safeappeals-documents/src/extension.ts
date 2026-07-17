/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { DocxEditorProvider } from './docx/docxEditorProvider';
import { PdfAnnotationStore } from './pdf/annotationStore';
import { PdfEditorProvider } from './pdf/pdfEditorProvider';

export function activate(context: vscode.ExtensionContext): void {
	const annotationStore = new PdfAnnotationStore(context);

	// Rung 5a: PDF. Rung 5b: DOCX. Rung 5c: XLSX.
	context.subscriptions.push(
		PdfEditorProvider.register(context, annotationStore),
		DocxEditorProvider.register(context),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('safeappeals-documents.pdf.exportAnnotations', async () => {
			const active = vscode.window.activeTextEditor;
			// Custom editors are not text editors; export is driven from the webview toolbar.
			void active;
			await vscode.window.showInformationMessage(
				'Open a PDF in the Safe Appeals PDF Viewer and use Export on the toolbar.',
			);
		}),
	);
}

export function deactivate(): void {
	// no-op
}


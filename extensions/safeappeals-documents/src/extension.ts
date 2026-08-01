/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Safe Appeals. All rights reserved.
 *  Licensed under the MIT License.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { registerAgentTools } from './agentTools';
import { DocxEditorProvider } from './docx/docxEditorProvider';
import { PdfAnnotationStore } from './pdf/annotationStore';
import { PdfEditorProvider } from './pdf/pdfEditorProvider';
import { XlsxEditorProvider } from './xlsx/xlsxEditorProvider';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
	const log = (msg: string) => {
		console.log(`[safeappeals-documents] ${msg}`);
	};
	const annotationStore = await PdfAnnotationStore.create(context, log);

	// Rung 5a: PDF. Rung 5b: DOCX. Rung 5c: XLSX. Phase D: agent tools.
	context.subscriptions.push(
		PdfEditorProvider.register(context, annotationStore),
		DocxEditorProvider.register(context),
		XlsxEditorProvider.register(context),
	);

	registerAgentTools(context);

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

/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Glass Devtools, Inc. All rights reserved.
 *  Void Editor additions licensed under the AGPL 3.0 License.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../../nls.js';
import { Action2, registerAction2 } from '../../../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../../../platform/instantiation/common/instantiation.js';
import { IEditorService } from '../../../../../services/editor/common/editorService.js';
import { PDFViewerEditor } from './pdfViewerEditor.js';
import { PDFContextGathering } from './pdfContextGathering.js';
import { IMainProcessService } from '../../../../../../platform/ipc/common/mainProcessService.js';
import { KeyCode, KeyMod } from '../../../../../../base/common/keyCodes.js';
import { KeybindingWeight } from '../../../../../../platform/keybinding/common/keybindingsRegistry.js';
import { INotificationService } from '../../../../../../platform/notification/common/notification.js';
import { IChatThreadService } from '../../chatThreadService.js';
import { IMetricsService } from '../../../common/metricsService.js';

class PDFQuickEditAction extends Action2 {
	constructor() {
		super({
			id: 'void.pdf.quickEdit',
			title: localize('void.pdf.quickEdit', 'PDF Quick Edit'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyCode.KeyK,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const mainProcessService = accessor.get(IMainProcessService);
		const notificationService = accessor.get(INotificationService);
		const chatThreadService = accessor.get(IChatThreadService);
		const metricsService = accessor.get(IMetricsService);

		const activeEditor = editorService.activeEditorPane;

		// Check if active editor is PDF viewer
		if (!(activeEditor instanceof PDFViewerEditor)) {
			// Not a PDF viewer, let the default Ctrl+K handler take over
			return;
		}

		const input = activeEditor.getInput();
		if (!input) {
			console.log('No PDF input found');
			return;
		}

		// Check if there's a selection
		if (!input.selection || !input.selection.text) {
			notificationService.info('Please select text in the PDF first');
			return;
		}

		try {
			metricsService.capture('PDF Ctrl+K', {
				selectedTextLength: input.selection.text.length,
				currentPage: input.currentPage
			});

			// Gather PDF context
			const contextGathering = new PDFContextGathering(mainProcessService);
			const pdfContext = await contextGathering.getPDFContext(
				input.resource,
				input.selection.text,
				input.currentPage,
				input.selection.endPage, // Use endPage as totalPages estimate
				1 // Include ±1 surrounding page
			);

			const formattedContext = contextGathering.formatContextForAI(pdfContext);

			console.log('[PDF Quick Edit] Context gathered:', {
				selectedText: pdfContext.selectedText.substring(0, 100) + '...',
				pageNumber: pdfContext.pageNumber,
				totalPages: pdfContext.totalPages,
				documentTitle: pdfContext.documentTitle,
				fullContext: formattedContext
			});

			// Get the current thread
			const currentThread = chatThreadService.getCurrentThread();
			if (!currentThread) {
				// Open a new thread if none exists
				chatThreadService.openNewThread();
			}

			// Add PDF context to staging selections as a File type
			// The context will be extracted when the AI processes the message
			chatThreadService.addNewStagingSelection({
				type: 'File',
				uri: input.resource,
				language: 'pdf',
				state: { wasAddedAsCurrentFile: false }
			});

			// Show notification
			const preview = pdfContext.selectedText.length > 100
				? pdfContext.selectedText.substring(0, 100) + '...'
				: pdfContext.selectedText;

			notificationService.info(`PDF context added to chat: "${preview}"\n\nPage ${pdfContext.pageNumber} of ${pdfContext.totalPages}`);

			console.log('[PDF Quick Edit] Context added to staging. Full context:', formattedContext);

		} catch (error) {
			console.error('[PDF Quick Edit] Error:', error);
			notificationService.error('Failed to process PDF selection');
		}
	}
}

class PDFAddToChatAction extends Action2 {
	constructor() {
		super({
			id: 'void.pdf.addToChat',
			title: localize('void.pdf.addToChat', 'Add PDF Selection to Chat'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyCode.KeyL,
				weight: KeybindingWeight.EditorContrib
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const mainProcessService = accessor.get(IMainProcessService);
		const notificationService = accessor.get(INotificationService);
		const chatThreadService = accessor.get(IChatThreadService);
		const metricsService = accessor.get(IMetricsService);

		const activeEditor = editorService.activeEditorPane;

		// Check if active editor is PDF viewer
		if (!(activeEditor instanceof PDFViewerEditor)) {
			// Not a PDF viewer, let the default Ctrl+L handler take over
			return;
		}

		const input = activeEditor.getInput();
		if (!input) {
			return;
		}

		try {
			const hasSelection = !!(input.selection && input.selection.text);
			metricsService.capture('PDF Ctrl+L', {
				hasSelection,
				currentPage: input.currentPage
			});

			// Get the current thread
			const currentThread = chatThreadService.getCurrentThread();
			if (!currentThread) {
				// Open a new thread if none exists
				chatThreadService.openNewThread();
			}

			// Extract PDF context based on selection
			const contextGathering = new PDFContextGathering(mainProcessService);
			let pdfContext;

			if (hasSelection) {
				// With selection - get selected text + current page
				pdfContext = await contextGathering.getPDFContext(
					input.resource,
					input.selection!.text,
					input.currentPage,
					input.selection!.endPage,
					0 // Don't include surrounding pages for Ctrl+L
				);
			} else {
				// No selection - get just current page
				pdfContext = await contextGathering.getPDFContext(
					input.resource,
					'', // No selection
					input.currentPage,
					input.currentPage,
					0 // No surrounding pages
				);
			}

			const formattedContext = contextGathering.formatContextForAI(pdfContext);

			// Add the formatted context directly to the thread's staging selections as content
			// This way we control exactly what gets sent, not the entire PDF
			const currentState = chatThreadService.getCurrentThreadState();
			const existingStaging = currentState.stagingSelections || [];

			// Clear any existing PDF staging to avoid duplication
			const nonPdfStaging = existingStaging.filter(s =>
				s.type !== 'File' || !s.uri.fsPath.toLowerCase().endsWith('.pdf')
			);

			// Add a marker file reference (won't extract content, just shows PDF is referenced)
			chatThreadService.setCurrentThreadState({
				stagingSelections: [
					...nonPdfStaging,
					{
						type: 'File',
						uri: input.resource,
						language: 'pdf',
						state: { wasAddedAsCurrentFile: false }
					}
				]
			});

			// Log the context that will be sent (the PDF extractor will use this)
			console.log('[PDF Ctrl+L] Context to send:', formattedContext);
			console.log('[PDF Ctrl+L] Context size:', formattedContext.length, 'characters');

			// Show notification
			if (hasSelection) {
				const preview = input.selection!.text.length > 50
					? input.selection!.text.substring(0, 50) + '...'
					: input.selection!.text;
				notificationService.info(`PDF context added (Page ${pdfContext.pageNumber}): "${preview}"`);
			} else {
				const fileName = input.resource.fsPath.split(/[\\/]/).pop() || 'PDF';
				notificationService.info(`PDF context added: ${fileName} (Page ${input.currentPage} only)`);
			}

		} catch (error) {
			console.error('[PDF Add to Chat] Error:', error);
			notificationService.error('Failed to add PDF to chat');
		}
	}
}

// Register both actions
registerAction2(PDFQuickEditAction);
registerAction2(PDFAddToChatAction);


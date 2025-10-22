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
import { IRAGService } from '../../../common/ragService.js';
import { RAGContextService } from '../../../common/ragContextService.js';

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
		const ragService = accessor.get(IRAGService);

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
				currentPage: input.currentPage,
				usingRAG: true
			});

			// Get the current thread
			const currentThread = chatThreadService.getCurrentThread();
			if (!currentThread) {
				// Open a new thread if none exists
				chatThreadService.openNewThread();
			}

			// Check if PDF is indexed in RAG
			const isIndexed = await ragService.isDocumentIndexed(input.resource);

			if (!isIndexed) {
				// Index the PDF first
				notificationService.info('Indexing PDF for the first time...');
				const indexResult = await ragService.indexDocument({
					uri: input.resource,
					isPolicyManual: true // PDFs are typically policy manuals
				});

				if (!indexResult.success) {
					notificationService.error('Failed to index PDF: ' + indexResult.message);
					return;
				}

				notificationService.info('PDF indexed successfully!');
			}

			// Use RAG to search for relevant chunks based on selection or current page
			let searchQuery: string;
			if (hasSelection && input.selection!.text) {
				// Use selected text as search query
				searchQuery = input.selection!.text;
			} else {
				// Use page number as search query (get text from current page)
				const contextGathering = new PDFContextGathering(mainProcessService);
				const pageContext = await contextGathering.getPDFContext(
					input.resource,
					'',
					input.currentPage,
					input.currentPage,
					0
				);
				searchQuery = pageContext.currentPageText.substring(0, 500); // First 500 chars as query
			}

			// Search RAG for relevant chunks
			const ragResults = await ragService.search({
				query: searchQuery,
				scope: 'policy_manual',
				limit: 5 // Get top 5 most relevant chunks
			});

			// Format the RAG context
			const ragContextService = new RAGContextService();
			const formattedContext = ragContextService.formatContextPack(ragResults);

			console.log('[PDF Ctrl+L with RAG] Query:', searchQuery.substring(0, 100));
			console.log('[PDF Ctrl+L with RAG] Found chunks:', ragResults.totalResults);
			console.log('[PDF Ctrl+L with RAG] Context:', formattedContext);
			console.log('[PDF Ctrl+L with RAG] Context size:', formattedContext.length, 'characters');

			// Add the PDF reference to staging (RAG context will be used automatically)
			const currentState = chatThreadService.getCurrentThreadState();
			const existingStaging = currentState.stagingSelections || [];

			// Clear any existing PDF staging to avoid duplication
			const nonPdfStaging = existingStaging.filter(s =>
				s.type !== 'File' || !s.uri.fsPath.toLowerCase().endsWith('.pdf')
			);

			// Add PDF reference
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

			// Show notification
			const fileName = input.resource.fsPath.split(/[\\/]/).pop() || 'PDF';
			if (hasSelection) {
				const preview = input.selection!.text.length > 50
					? input.selection!.text.substring(0, 50) + '...'
					: input.selection!.text;
				notificationService.info(`PDF context added via RAG (${ragResults.totalResults} chunks): "${preview}"`);
			} else {
				notificationService.info(`PDF context added via RAG: ${fileName} (Page ${input.currentPage}, ${ragResults.totalResults} relevant chunks)`);
			}

		} catch (error) {
			console.error('[PDF Add to Chat] Error:', error);
			notificationService.error('Failed to add PDF to chat: ' + (error as Error).message);
		}
	}
}

// Register both actions
registerAction2(PDFQuickEditAction);
registerAction2(PDFAddToChatAction);


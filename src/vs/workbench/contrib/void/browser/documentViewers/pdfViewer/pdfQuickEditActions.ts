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
import { IRAGService } from '../../../common/rag/ragService.js';
import { RAGContextService } from '../../../common/rag/ragContextService.js';
import { IClipboardService } from '../../../../../../platform/clipboard/common/clipboardService.js';
import { ContextKeyExpr } from '../../../../../../platform/contextkey/common/contextkey.js';
import { MenuId } from '../../../../../../platform/actions/common/actions.js';

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

			// Gather PDF context with sliding window for more focused context
			const contextGathering = new PDFContextGathering(mainProcessService);
			const pdfContext = await contextGathering.getPDFContextWithSlidingWindow(
				input.resource,
				input.selection.text,
				input.currentPage,
				input.selection.endPage, // Use endPage as totalPages estimate
				5 // ±5 sentences around selection for richer context
			);

			const formattedContext = contextGathering.formatContextForAI(pdfContext);

			console.log('[PDF Quick Edit] Context gathered with sliding window:', {
				selectedText: pdfContext.selectedText.substring(0, 100) + '...',
				pageNumber: pdfContext.pageNumber,
				totalPages: pdfContext.totalPages,
				documentTitle: pdfContext.documentTitle,
				contextLength: formattedContext.length,
				estimatedTokens: Math.ceil(formattedContext.length / 4)
			});

			// Get the current thread
			const currentThread = chatThreadService.getCurrentThread();
			if (!currentThread) {
				// Open a new thread if none exists
				chatThreadService.openNewThread();
			}

			// Add PDF context to staging selections with the context attached
			chatThreadService.addNewStagingSelection({
				type: 'File',
				uri: input.resource,
				language: 'pdf',
				state: {
					wasAddedAsCurrentFile: false,
					ragContext: formattedContext // Attach the sliding window context!
				}
			});

			// Show notification
			const preview = pdfContext.selectedText.length > 100
				? pdfContext.selectedText.substring(0, 100) + '...'
				: pdfContext.selectedText;

			const contextSize = Math.ceil(formattedContext.length / 4); // Rough token estimate
			notificationService.info(`PDF context added to chat: "${preview}"\n\nPage ${pdfContext.pageNumber} (~${contextSize} tokens)`);

			console.log('[PDF Quick Edit] Context added to staging. Full context:', formattedContext);

		} catch (error) {
			console.error('[PDF Quick Edit] Error:', error);
			notificationService.error('Failed to process PDF selection');
		}
	}
}

class PDFCopyWithPageNumberAction extends Action2 {
	constructor() {
		super({
			id: 'void.pdf.copyWithPageNumber',
			title: localize('void.pdf.copyWithPageNumber', 'Copy Selection with Page Number'),
			keybinding: {
				primary: KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyC,
				weight: KeybindingWeight.EditorContrib
			},
			menu: {
				id: MenuId.EditorContext,
				when: ContextKeyExpr.equals('resourceExtname', '.pdf'),
				group: 'void_pdf',
				order: 2
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const editorService = accessor.get(IEditorService);
		const clipboardService = accessor.get(IClipboardService);
		const notificationService = accessor.get(INotificationService);

		const activeEditor = editorService.activeEditorPane;

		// Check if active editor is PDF viewer
		if (!(activeEditor instanceof PDFViewerEditor)) {
			return;
		}

		const input = activeEditor.getInput();
		if (!input) {
			return;
		}

		try {
			// Get current selection from the PDF input
			const selection = input.selection;

			if (!selection || !selection.text) {
				notificationService.warn('No text selected in PDF');
				return;
			}

			const filename = input.resource.fsPath.split(/[\\/]/).pop() || 'document.pdf';
			const pageInfo = `Page ${selection.startPage}${selection.startPage !== selection.endPage ? `-${selection.endPage}` : ''}`;

			// Format like code selections with line-style format
			const formattedText = this.formatSelectionWithPageNumbers(
				selection.text,
				filename,
				selection.startPage,
				selection.endPage
			);

			await clipboardService.writeText(formattedText);

			const preview = selection.text.length > 50
				? selection.text.substring(0, 50) + '...'
				: selection.text;

			notificationService.info(`Copied with page number: "${preview}" (${pageInfo})`);

		} catch (error) {
			console.error('[PDF Copy] Error:', error);
			notificationService.error('Failed to copy PDF selection');
		}
	}

	/**
	 * Format PDF selection similar to code selections with line numbers
	 * @example
	 * ```
	 * rscm_volume_ii-pdf-en.pdf (Page 36)
	 *      1|#5.00 COVERAGE OF WORKERS
	 *      2|It is a well established principle of workers' compensation...
	 *      3|...
	 * ```
	 */
	private formatSelectionWithPageNumbers(
		text: string,
		filename: string,
		startPage: number,
		endPage: number
	): string {
		const lines = text.split('\n').filter(line => line.trim().length > 0);

		// Add line numbers (right-aligned to 6 chars, followed by |)
		const numberedLines = lines.map((line, index) => {
			const lineNum = (index + 1).toString().padStart(6, ' ');
			return `${lineNum}|${line}`;
		}).join('\n');

		const pageInfo = startPage === endPage
			? `Page ${startPage}`
			: `Pages ${startPage}-${endPage}`;

		return `${filename} (${pageInfo})\n${numberedLines}`;
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
					isPolicyManual: true, // PDFs are typically policy manuals
					workspaceId: ragService.getWorkspaceId()
				});

				if (!indexResult.success) {
					notificationService.error('Failed to index PDF: ' + indexResult.message);
					return;
				}

				notificationService.info('PDF indexed successfully!');
			}

			// Use RAG to search for relevant chunks OR use actual selection directly
			let contextToAdd: string;

			if (hasSelection && input.selection!.text) {
				// User has selected specific text - use it DIRECTLY with context window
				// Don't do RAG search because that finds similar content elsewhere
				const contextGathering = new PDFContextGathering(mainProcessService);
				const pdfContext = await contextGathering.getPDFContextWithSlidingWindow(
					input.resource,
					input.selection!.text,
					input.currentPage,
					input.selection!.endPage || input.currentPage,
					3 // Smaller window for Ctrl+L vs Ctrl+K
				);

				contextToAdd = contextGathering.formatContextForAI(pdfContext);

				console.log('[PDF Ctrl+L with Selection] Using actual selected text with context window');
				console.log('[PDF Ctrl+L with Selection] Page:', input.currentPage);
				console.log('[PDF Ctrl+L with Selection] Context size:', contextToAdd.length, 'characters');
			} else {
				// No selection - use RAG to find relevant content from current page area
				const contextGathering = new PDFContextGathering(mainProcessService);
				const pageContext = await contextGathering.getPDFContext(
					input.resource,
					'',
					input.currentPage,
					input.currentPage,
					0
				);
				const searchQuery = pageContext.currentPageText.substring(0, 500); // First 500 chars as query

				// Search RAG for relevant chunks
				const ragResults = await ragService.search({
					query: searchQuery,
					scope: 'policy_manual',
					limit: 5, // Get top 5 most relevant chunks
					workspaceId: ragService.getWorkspaceId()
				});

				// Format the RAG context
				const ragContextService = new RAGContextService();
				contextToAdd = ragContextService.formatContextPack(ragResults);

				console.log('[PDF Ctrl+L with RAG] Query:', searchQuery.substring(0, 100));
				console.log('[PDF Ctrl+L with RAG] Found chunks:', ragResults.totalResults);
				console.log('[PDF Ctrl+L with RAG] Context size:', contextToAdd.length, 'characters');
			}

			// Add the PDF reference to staging WITH the context attached
			const currentState = chatThreadService.getCurrentThreadState();
			const existingStaging = currentState.stagingSelections || [];

			// Clear any existing PDF staging to avoid duplication
			const nonPdfStaging = existingStaging.filter(s =>
				s.type !== 'File' || !s.uri.fsPath.toLowerCase().endsWith('.pdf')
			);

			// Add PDF reference with context
			chatThreadService.setCurrentThreadState({
				stagingSelections: [
					...nonPdfStaging,
					{
						type: 'File',
						uri: input.resource,
						language: 'pdf',
						state: {
							wasAddedAsCurrentFile: false,
							ragContext: contextToAdd // Attach the context (RAG or direct)
						}
					}
				]
			});

			// Show notification
			const fileName = input.resource.fsPath.split(/[\\/]/).pop() || 'PDF';
			if (hasSelection) {
				const preview = input.selection!.text.length > 50
					? input.selection!.text.substring(0, 50) + '...'
					: input.selection!.text;
				notificationService.info(`PDF selection added to chat: "${preview}" (Page ${input.currentPage})`);
			} else {
				notificationService.info(`PDF context added: ${fileName} (Page ${input.currentPage})`);
			}

		} catch (error) {
			console.error('[PDF Add to Chat] Error:', error);
			notificationService.error('Failed to add PDF to chat: ' + (error as Error).message);
		}
	}
}

// Register both actions
registerAction2(PDFQuickEditAction);
registerAction2(PDFCopyWithPageNumberAction);
registerAction2(PDFAddToChatAction);


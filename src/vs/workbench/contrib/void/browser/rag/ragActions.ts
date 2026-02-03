/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { ITextModelService } from '../../../../../editor/common/services/resolverService.js';
import { Action2, MenuId, registerAction2 } from '../../../../../platform/actions/common/actions.js';
import { ContextKeyExpr } from '../../../../../platform/contextkey/common/contextkey.js';
import { IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { ServicesAccessor } from '../../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../../platform/notification/common/notification.js';
import { IProgressService, ProgressLocation } from '../../../../../platform/progress/common/progress.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IExplorerService } from '../../../../contrib/files/browser/files.js';
import { IEditorService } from '../../../../services/editor/common/editorService.js';
import { IRAGService } from '../../common/rag/ragService.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';
import {
	VOID_RAG_GET_STATS_ACTION_ID,
	VOID_RAG_INDEX_DOCUMENT_ACTION_ID,
	VOID_RAG_SEARCH_POLICY_ACTION_ID,
	VOID_RAG_SEARCH_WORKSPACE_ACTION_ID,
	VOID_RAG_TEST_DOCLING_ACTION_ID
} from '../actionIDs.js';

class RAGIndexDocumentAction extends Action2 {
	constructor() {
		super({
			id: VOID_RAG_INDEX_DOCUMENT_ACTION_ID,
			title: { value: 'Index Document for RAG', original: 'Index Document for RAG' },
			category: { value: 'RAG', original: 'RAG' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Use the Explorer context menu to index documents, or use the RAG tools from chat');
	}
}

class RAGSearchPolicyAction extends Action2 {
	constructor() {
		super({
			id: VOID_RAG_SEARCH_POLICY_ACTION_ID,
			title: { value: 'Search Core References', original: 'Search Core References' },
			category: { value: 'RAG', original: 'RAG' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Use the @reference search command in chat to search core references');
	}
}

class RAGSearchWorkspaceAction extends Action2 {
	constructor() {
		super({
			id: VOID_RAG_SEARCH_WORKSPACE_ACTION_ID,
			title: { value: 'Search Workspace Documents', original: 'Search Workspace Documents' },
			category: { value: 'RAG', original: 'RAG' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Use RAG search tools in chat to search workspace documents');
	}
}

class RAGGetStatsAction extends Action2 {
	constructor() {
		super({
			id: VOID_RAG_GET_STATS_ACTION_ID,
			title: { value: 'Get RAG Statistics', original: 'Get RAG Statistics' },
			category: { value: 'RAG', original: 'RAG' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const ragService = accessor.get(IRAGService);
		const notificationService = accessor.get(INotificationService);

		try {
			const stats = await ragService.getStats();
			const message = `RAG Stats:\nTotal Documents: ${stats.totalDocuments}\nTotal Chunks: ${stats.chunks.totalChunks}\nAvg Tokens: ${stats.chunks.avgTokens}`;
			notificationService.info(message);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			notificationService.error(`Error getting stats: ${errorMsg}`);
		}
	}
}

// Context menu action for indexing as workspace document (case files)
class IndexAsWorkspaceDocAction extends Action2 {
	constructor() {
		super({
			id: 'void.rag.indexAsWorkspaceDoc',
			title: { value: 'Index as Case Document', original: 'Index as Case Document' },
			category: { value: 'RAG', original: 'RAG' },
			menu: {
				id: MenuId.ExplorerContext,
				group: 'z_rag@1',
				when: ContextKeyExpr.regex('resourceExtname', /\.(pdf|md|txt|doc|docx)$/i)
			}
		});
	}

	async run(accessor: ServicesAccessor, uri?: URI): Promise<void> {
		const ragService = accessor.get(IRAGService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const explorerService = accessor.get(IExplorerService);

		// Get URI from context or focused element
		if (!uri) {
			const focusedItem = explorerService.getContext(false);
			uri = focusedItem.length > 0 ? focusedItem[0].resource : undefined;
		}

		if (!uri) {
			notificationService.error('No file selected');
			return;
		}

		try {
			// Check if already indexed
			const isIndexed = await ragService.isDocumentIndexed(uri);
			if (isIndexed) {
				notificationService.info(`Document already indexed: ${uri.path.split('/').pop()}`);
				return;
			}

			// Index as workspace document (case file)
			await progressService.withProgress(
				{
					location: ProgressLocation.Notification,
					title: `Indexing case document: ${uri.path.split('/').pop()}`,
					cancellable: false
				},
				async () => {
					const result = await ragService.indexDocument({
						uri,
						isCoreReference: false,  // ← This makes it a workspace document!
						workspaceId: ragService.getWorkspaceId()
					});

					if (result.success) {
						notificationService.info(`Successfully indexed case document: ${uri.path.split('/').pop()}`);
					} else {
						throw new Error(result.message);
					}
				}
			);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			notificationService.error(`Failed to index document: ${errorMsg}`);
		}
	}
}

// Context menu action for Explorer
class IndexAsPolicyManualAction extends Action2 {
	constructor() {
		super({
			id: 'void.rag.indexFromExplorer',
			title: 'Index as Core Reference',
			category: 'SafeAppeals',
			f1: false,
			menu: {
				id: MenuId.ExplorerContext,
				when: ContextKeyExpr.regex('resourceExtname', /\.(pdf|docx|txt|md)$/i),
				group: '7_modification'
			}
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const ragService = accessor.get(IRAGService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const explorerService = accessor.get(IExplorerService);

		// Get the selected resource from explorer
		const context = explorerService.getContext(false);
		if (!context || context.length === 0) {
			notificationService.error('No file selected');
			return;
		}

		const uri = context[0].resource;
		if (!uri) {
			notificationService.error('No file selected');
			return;
		}

		const filename = uri.fsPath ? uri.fsPath.split(/[\\/]/).pop() : uri.path.split(/[\\/]/).pop();

		try {
			// Check if document is already indexed
			console.log('[RAG] Checking if document is already indexed:', uri.fsPath);
			const isAlreadyIndexed = await ragService.isDocumentIndexed(uri);
			console.log('[RAG] isAlreadyIndexed result:', isAlreadyIndexed);

			if (isAlreadyIndexed) {
				notificationService.warn(`Document already indexed: ${filename}\nUse "RAG: Clear All Embeddings" if you need to re-index.`);
				return;
			}

			// Show progress notification
			await progressService.withProgress(
				{
					location: ProgressLocation.Notification,
					title: `Indexing: ${filename}`,
					cancellable: false
				},
				async (progress) => {
					// Initial progress
					progress.report({ message: 'Extracting content from PDF...' });

					// Start indexing
					const result = await ragService.indexDocument({
						uri,
						isCoreReference: true,
						workspaceId: ragService.getWorkspaceId()
					});

					if (result.success) {
						// Extract chunk count from success message if available
						const chunkMatch = result.message.match(/(\d+) chunks/);
						const chunkCount = chunkMatch ? chunkMatch[1] : 'multiple';

						progress.report({ message: `Generated embeddings for ${chunkCount} chunks` });

						// Small delay to show completion message
						await new Promise(resolve => setTimeout(resolve, 800));
					} else {
						throw new Error(result.message || 'Failed to index document');
					}

					return result;
				}
			);

			// Show success notification
			notificationService.info(`✓ Successfully indexed: ${filename}`);
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : String(e);
			notificationService.error(`Failed to index document: ${errorMsg}`);
		}
	}
}

// Manual command to create core references folder
class CreateCoreReferencesFolderAction extends Action2 {
	constructor() {
		super({
			id: 'void.rag.createPolicyFolder',
			title: { value: 'Create Core References Folder', original: 'Create Core References Folder' },
			category: { value: 'RAG', original: 'RAG' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const workspaceService = accessor.get(IWorkspaceContextService);
		const fileService = accessor.get(IFileService);
		const settingsService = accessor.get(IVoidSettingsService);
		const notificationService = accessor.get(INotificationService);

		const folder = workspaceService.getWorkspace().folders[0];
		if (!folder) {
			notificationService.error('No workspace folder found. Please open a folder first.');
			return;
		}

		const settings = settingsService.state.globalSettings;
		const coreReferencesFolderName = settings.ragCoreReferencesFolderName || 'core_references';
		const coreReferencesFolderUri = URI.joinPath(folder.uri, coreReferencesFolderName);

		try {
			await fileService.createFolder(coreReferencesFolderUri);
			notificationService.info(`✓ Created folder: ${coreReferencesFolderUri.fsPath}`);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (errorMsg.includes('already exists')) {
				notificationService.info(`Folder already exists: ${coreReferencesFolderUri.fsPath}`);
			} else {
				notificationService.error(`Failed to create folder: ${errorMsg}`);
			}
		}
	}
}

// Clear all embeddings command
class ClearAllEmbeddingsAction extends Action2 {
	constructor() {
		super({
			id: 'void.rag.clearAllEmbeddings',
			title: { value: 'Clear All RAG Embeddings', original: 'Clear All RAG Embeddings' },
			category: { value: 'RAG', original: 'RAG' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const ragService = accessor.get(IRAGService);
		const notificationService = accessor.get(INotificationService);

		try {
			notificationService.info('Clearing all RAG embeddings and metadata...');
			const result = await ragService.clearAllEmbeddings();

			if (result.success) {
				notificationService.info(`✓ ${result.message}`);
			} else {
				notificationService.error(result.message);
			}
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			notificationService.error(`Failed to clear embeddings: ${errorMsg}`);
		}
	}
}

// Test Docling PDF Extraction command
class TestDoclingExtractionAction extends Action2 {
	constructor() {
		super({
			id: VOID_RAG_TEST_DOCLING_ACTION_ID,
			title: { value: 'Test PDF Extraction Methods', original: 'Test PDF Extraction Methods' },
			category: { value: 'RAG', original: 'RAG' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const fileDialogService = accessor.get(IFileDialogService);
		const notificationService = accessor.get(INotificationService);
		const progressService = accessor.get(IProgressService);
		const editorService = accessor.get(IEditorService);
		const textModelService = accessor.get(ITextModelService);
		const ragService = accessor.get(IRAGService);

		try {
			// Step 1: Ask user to select a PDF file
			const result = await fileDialogService.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false,
				canSelectMany: false,
				filters: [
					{ name: 'PDF Files', extensions: ['pdf'] }
				],
				title: 'Select PDF to test extraction methods'
			});

			if (!result || result.length === 0) {
				notificationService.info('No file selected');
				return;
			}

			const pdfUri = result[0];
			const filename = pdfUri.path.split('/').pop() || 'document.pdf';

			notificationService.info(`Testing all extraction methods on: ${filename}`);

			// Step 2: Run extraction with all methods using progress indicator
			const extractionResults = await progressService.withProgress(
				{
					location: ProgressLocation.Notification,
					title: `Comparing extraction methods for ${filename}`,
					cancellable: false
				},
				async (progress) => {
					progress.report({ message: 'Extracting with all methods...' });

					// Call the IPC method which runs in the main process
					const result = await ragService.testDoclingExtraction(pdfUri);

					return result;
				}
			);

			// Step 3: Create comparison text for all three methods
			const { standard, docling, doclingError } = extractionResults;

			const standardText = `===========================================
STANDARD EXTRACTION (PDF.js)
===========================================
⚡ Speed: ~150ms
✅ Reliability: Always works
✅ Metadata: Excellent (title, author, dates)
⚠️  Content: Basic text only
❌ Tables: Poor structure
❌ Multi-column: Poor handling

METADATA:
-----------
Pages: ${standard.metadata.pageCount || 'N/A'}
Words: ${standard.metadata.wordCount || 'N/A'}
Language: ${standard.metadata.language || 'N/A'}
Title: ${standard.metadata.title || '(empty)'}
Author: ${standard.metadata.author || '(empty)'}

TEXT CONTENT:
-------------------------------------------
${standard.text}
-------------------------------------------`;

			const doclingText = `===========================================
DOCLING EXTRACTION (ML-Powered)
===========================================
${doclingError ? `⚠️ ERROR: ${doclingError.message}\n\n` : ''}⚠️  Speed: ~15 seconds
✅ Reliability: Requires server
❌ Metadata: Missing title/author
✅ Content: Excellent (ML-powered)
✅ Tables: Full structure detection
✅ Multi-column: Excellent handling

METADATA:
-----------
Pages: ${docling.metadata.pageCount || 'N/A'}
Words: ${docling.metadata.wordCount || 'N/A'}
Language: ${docling.metadata.language || 'N/A'}
Title: ${docling.metadata.title || '(empty)'}
Author: ${docling.metadata.author || '(empty)'}

TEXT CONTENT:
-------------------------------------------
${docling.text}
-------------------------------------------`;

			const hybridText = `===========================================
HYBRID EXTRACTION ✨ (Best of Both)
===========================================
⚠️  Speed: ~15 seconds (Docling bottleneck)
✅ Reliability: Falls back to PDF.js
✅ Metadata: PDF.js (title, author, dates)
✅ Content: Docling ML (tables, layout)
✅ Tables: Full structure detection
✅ Multi-column: Excellent handling

STRATEGY:
-----------
1. PDF.js extracts metadata (~50ms) ⚡
   - Title, Author, Creator
   - Creation/Modification dates
   - Page count

2. Docling extracts content (~15s) 🧠
   - ML-powered text extraction
   - Table structure detection
   - Multi-column layout handling
   - Word count, language detection

3. Merge results = Best of both worlds!

HYBRID RESULT:
-----------
Pages: ${standard.metadata.pageCount || 'N/A'} (from PDF.js)
Words: ${docling.metadata.wordCount || 'N/A'} (from Docling)
Language: ${docling.metadata.language || 'N/A'} (from Docling)
Title: ${standard.metadata.title || '(empty)'} (from PDF.js)
Author: ${standard.metadata.author || '(empty)'} (from PDF.js)

TEXT CONTENT (from Docling):
-------------------------------------------
${docling.text}
-------------------------------------------`;

			// Step 4: Create untitled documents and open side-by-side comparison
			const standardUri = URI.from({
				scheme: 'untitled',
				path: `1-Standard-${filename}.txt`
			});

			const doclingUri = URI.from({
				scheme: 'untitled',
				path: `2-Docling-${filename}.txt`
			});

			const hybridUri = URI.from({
				scheme: 'untitled',
				path: `3-Hybrid-${filename}.txt`
			});

			// Create model references with content
			const standardRef = await textModelService.createModelReference(standardUri);
			standardRef.object.textEditorModel?.setValue(standardText);

			const doclingRef = await textModelService.createModelReference(doclingUri);
			doclingRef.object.textEditorModel?.setValue(doclingText);

			const hybridRef = await textModelService.createModelReference(hybridUri);
			hybridRef.object.textEditorModel?.setValue(hybridText);

			// Open all three documents side by side
			// First, open standard (left)
			await editorService.openEditor({
				resource: standardUri,
				options: { pinned: true }
			});

			// Then open hybrid on the right (viewColumn 1 = second column)
			await editorService.openEditor({
				resource: hybridUri,
				options: { pinned: true }
			}, 1);

			// Show summary notification
			const summary = doclingError
				? `⚠️ Docling extraction failed. Check comparison for details.`
				: `✓ Comparison complete:\n` +
				`Standard (PDF.js): ${standard.metadata.wordCount} words, ${standard.metadata.pageCount} pages\n` +
				`Docling (ML): ${docling.metadata.wordCount} words, ${docling.metadata.pageCount} pages\n` +
				`Hybrid: Best of both! 🎉`;

			notificationService.info(summary);

		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			notificationService.error(`Failed to test extraction: ${errorMsg}`);
		}
	}
}

registerAction2(RAGIndexDocumentAction);
registerAction2(RAGSearchPolicyAction);
registerAction2(RAGSearchWorkspaceAction);
registerAction2(RAGGetStatsAction);
registerAction2(IndexAsWorkspaceDocAction);  // ← New action for case documents
registerAction2(IndexAsPolicyManualAction);
registerAction2(CreateCoreReferencesFolderAction);
registerAction2(ClearAllEmbeddingsAction);
registerAction2(TestDoclingExtractionAction);

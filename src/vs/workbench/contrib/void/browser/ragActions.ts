/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { registerAction2, Action2, MenuId } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { URI } from '../../../../base/common/uri.js';
import { IRAGService } from '../common/ragService.js';
import { ContextKeyExpr } from '../../../../platform/contextkey/common/contextkey.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { IExplorerService } from '../../../contrib/files/browser/files.js';
import {
	VOID_RAG_INDEX_DOCUMENT_ACTION_ID,
	VOID_RAG_SEARCH_POLICY_ACTION_ID,
	VOID_RAG_SEARCH_WORKSPACE_ACTION_ID,
	VOID_RAG_GET_STATS_ACTION_ID
} from './actionIDs.js';

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
			title: { value: 'Search Policy Manual', original: 'Search Policy Manual' },
			category: { value: 'RAG', original: 'RAG' },
			f1: true
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notificationService = accessor.get(INotificationService);
		notificationService.info('Use the @policy search command in chat to search policy manuals');
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

// Context menu action for Explorer
class IndexAsPolicyManualAction extends Action2 {
	constructor() {
		super({
			id: 'void.rag.indexFromExplorer',
			title: 'Index as Policy Manual',
			category: 'Void',
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

		// Debug: Log URI properties
		console.log('URI Debug:', {
			scheme: uri.scheme,
			authority: uri.authority,
			path: uri.path,
			fsPath: uri.fsPath,
			toString: uri.toString()
		});

		try {
			const result = await ragService.indexDocument({ uri, isPolicyManual: true });
			if (result.success) {
				const filename = uri.fsPath ? uri.fsPath.split(/[\\/]/).pop() : uri.path.split(/[\\/]/).pop();
				notificationService.info(`✓ Indexed: ${filename}`);
			} else {
				notificationService.error(result.message || 'Failed to index document');
			}
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : String(e);
			notificationService.error(`Failed to index document: ${errorMsg}`);
		}
	}
}

// Manual command to create policy-manuals folder
class CreatePolicyFolderAction extends Action2 {
	constructor() {
		super({
			id: 'void.rag.createPolicyFolder',
			title: { value: 'Create Policy Manuals Folder', original: 'Create Policy Manuals Folder' },
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
		const policyFolderName = settings.ragPolicyFolderName || 'policy-manuals';
		const policyFolderUri = URI.joinPath(folder.uri, policyFolderName);

		try {
			await fileService.createFolder(policyFolderUri);
			notificationService.info(`✓ Created folder: ${policyFolderUri.fsPath}`);
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			if (errorMsg.includes('already exists')) {
				notificationService.info(`Folder already exists: ${policyFolderUri.fsPath}`);
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

registerAction2(RAGIndexDocumentAction);
registerAction2(RAGSearchPolicyAction);
registerAction2(RAGSearchWorkspaceAction);
registerAction2(RAGGetStatsAction);
registerAction2(IndexAsPolicyManualAction);
registerAction2(CreatePolicyFolderAction);
registerAction2(ClearAllEmbeddingsAction);

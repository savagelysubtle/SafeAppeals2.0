/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { StagingSelectionItem } from '../../common/chatThreadServiceTypes.js';
import { IRAGService } from '../../common/rag/ragService.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';

export const IRAGAutoIndexService = createDecorator<IRAGAutoIndexService>('ragAutoIndexService');

export interface IRAGAutoIndexService {
	readonly _serviceBrand: undefined;

	/**
	 * Index a staging selection item if it's a document file and not already indexed
	 * @param selection The staging selection item to potentially index
	 */
	indexSelectionIfNeeded(selection: StagingSelectionItem): Promise<void>;

	/**
	 * Check if a document at the given URI is already indexed
	 */
	isDocumentIndexed(uri: URI): Promise<boolean>;

	/**
	 * Determine if a file is in the policy folder
	 */
	isInPolicyFolder(uri: URI): boolean;

	/**
	 * Determine if a file is a supported document type
	 */
	isSupportedDocumentType(uri: URI): boolean;
}

export class RAGAutoIndexService extends Disposable implements IRAGAutoIndexService {
	readonly _serviceBrand: undefined;

	// Set of document extensions that should be auto-indexed
	private static readonly SUPPORTED_EXTENSIONS = new Set([
		'pdf', 'docx', 'doc', 'xlsx', 'xls', 'txt', 'md', 'rtf'
	]);

	// Track pending index operations to avoid duplicates
	private pendingIndexOperations: Set<string> = new Set();

	constructor(
		@IRAGService private readonly ragService: IRAGService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@ILogService private readonly logService: ILogService
	) {
		super();
	}

	/**
	 * Get the extension of a file URI
	 */
	private getExtension(uri: URI): string {
		const path = uri.fsPath || uri.path;
		const ext = path.split('.').pop()?.toLowerCase() || '';
		return ext;
	}

	/**
	 * Check if a file is a supported document type for indexing
	 */
	isSupportedDocumentType(uri: URI): boolean {
		const ext = this.getExtension(uri);
		return RAGAutoIndexService.SUPPORTED_EXTENSIONS.has(ext);
	}

	/**
	 * Check if a file is in the policy folder
	 */
	isInPolicyFolder(uri: URI): boolean {
		const settings = this.settingsService.state.globalSettings;
		const policyFolderName = settings.ragPolicyFolderName || 'policy-manuals';

		const folders = this.workspaceService.getWorkspace().folders;
		if (folders.length === 0) {
			return false;
		}

		const workspaceRoot = folders[0].uri.fsPath;
		const filePath = uri.fsPath || uri.path;

		// Check if the file is in the policy folder
		const policyFolderPath = `${workspaceRoot}/${policyFolderName}`.replace(/\\/g, '/');
		const normalizedFilePath = filePath.replace(/\\/g, '/');

		return normalizedFilePath.startsWith(policyFolderPath);
	}

	/**
	 * Check if a document is already indexed
	 */
	async isDocumentIndexed(uri: URI): Promise<boolean> {
		try {
			return await this.ragService.isDocumentIndexed(uri);
		} catch (error) {
			this.logService.error('RAGAutoIndexService: Failed to check if document is indexed:', error);
			return false;
		}
	}

	/**
	 * Index a staging selection item if needed
	 * This is called when files are dropped into the chat or added via staging
	 */
	async indexSelectionIfNeeded(selection: StagingSelectionItem): Promise<void> {
		// Only handle file selections
		if (selection.type !== 'File') {
			return;
		}

		const uri = selection.uri;
		const filePath = uri.fsPath || uri.path;

		// Skip if not a supported document type
		if (!this.isSupportedDocumentType(uri)) {
			this.logService.debug(`RAGAutoIndexService: Skipping non-document file: ${filePath}`);
			return;
		}

		// Check if RAG is enabled
		const settings = this.settingsService.state.globalSettings;
		if (!settings.ragEnabled) {
			this.logService.debug('RAGAutoIndexService: RAG is disabled, skipping auto-index');
			return;
		}

		// Avoid duplicate operations
		if (this.pendingIndexOperations.has(filePath)) {
			this.logService.debug(`RAGAutoIndexService: Already indexing: ${filePath}`);
			return;
		}

		try {
			this.pendingIndexOperations.add(filePath);

			// Check if already indexed
			const isIndexed = await this.isDocumentIndexed(uri);
			if (isIndexed) {
				this.logService.debug(`RAGAutoIndexService: Document already indexed: ${filePath}`);
				return;
			}

			// Determine if it's a policy manual or case file
			const isPolicyManual = this.isInPolicyFolder(uri);
			const workspaceId = this.ragService.getWorkspaceId();

			this.logService.info(`RAGAutoIndexService: Auto-indexing ${isPolicyManual ? 'policy manual' : 'case file'}: ${filePath}`);

			// Index the document in the background
			const result = await this.ragService.indexDocument({
				uri,
				isPolicyManual,
				workspaceId,
				indexScope: isPolicyManual ? 'policy_manual' : 'case_index'
			});

			if (result.success) {
				this.logService.info(`RAGAutoIndexService: Successfully indexed: ${filePath}`);
			} else {
				this.logService.warn(`RAGAutoIndexService: Failed to index ${filePath}: ${result.message}`);
			}
		} catch (error) {
			this.logService.error(`RAGAutoIndexService: Error indexing ${filePath}:`, error);
		} finally {
			this.pendingIndexOperations.delete(filePath);
		}
	}
}

registerSingleton(IRAGAutoIndexService, RAGAutoIndexService, InstantiationType.Delayed);


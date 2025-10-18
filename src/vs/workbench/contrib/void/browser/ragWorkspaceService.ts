/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService, FileChangeType } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IRAGService } from '../common/ragService.js';
import { IVoidSettingsService } from '../common/voidSettingsService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';
import { basename } from '../../../../base/common/path.js';

export const IRAGWorkspaceService = createDecorator<IRAGWorkspaceService>('ragWorkspaceService');

export interface IRAGWorkspaceService {
	readonly _serviceBrand: undefined;
}

export class RAGWorkspaceService extends Disposable implements IRAGWorkspaceService {
	readonly _serviceBrand: undefined;

	private fileWatcher: IDisposable | undefined;

	constructor(
		@IWorkspaceContextService private readonly workspaceService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IRAGService private readonly ragService: IRAGService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@ILogService private readonly logService: ILogService
	) {
		super();
		this.logService.info('RAGWorkspaceService: Constructor called');
		this._register(this.settingsService.onDidChangeState(() => this.onSettingsChanged()));

		// Listen for workspace folder changes
		this._register(this.workspaceService.onDidChangeWorkspaceFolders(e => {
			this.logService.info('RAGWorkspaceService: Workspace folders changed, reinitializing...');
			this.initialize().catch(err => {
				this.logService.error('RAGWorkspaceService: Failed to initialize after workspace change:', err);
			});
		}));

		// Initialize asynchronously
		this.initialize().catch(err => {
			this.logService.error('RAGWorkspaceService: Failed to initialize:', err);
		});
	}

	private async onSettingsChanged(): Promise<void> {
		// Re-initialize if relevant settings change
		this.disposeWatcher();
		await this.initialize();
	}

	private async initialize(): Promise<void> {
		this.logService.info('RAGWorkspaceService: Initialize called');

		// Wait a bit for settings to load
		await new Promise(resolve => setTimeout(resolve, 100));

		const settings = this.settingsService.state.globalSettings;
		this.logService.info(`RAGWorkspaceService: ragEnabled=${settings.ragEnabled}, ragAutoIndexPolicyFolder=${settings.ragAutoIndexPolicyFolder}`);

		// If settings are still undefined, use defaults
		const ragEnabled = settings.ragEnabled ?? true;  // Default to true
		const ragAutoIndex = settings.ragAutoIndexPolicyFolder ?? true;  // Default to true

		this.logService.info(`RAGWorkspaceService: Using ragEnabled=${ragEnabled}, ragAutoIndexPolicyFolder=${ragAutoIndex}`);

		if (!ragEnabled || !ragAutoIndex) {
			this.logService.info('RAGWorkspaceService: RAG not enabled or auto-index disabled, skipping initialization');
			this.disposeWatcher();
			return;
		}

		// Initialize RAG service with API key from settings BEFORE using it
		this.logService.info('RAGWorkspaceService: Initializing RAG service with API key from settings...');
		await this.ragService.initialize();

		const folder = this.workspaceService.getWorkspace().folders[0];
		if (!folder) {
			this.logService.warn('RAGWorkspaceService: No workspace folder found.');
			return;
		}

		this.logService.info(`RAGWorkspaceService: Workspace folder found: ${folder.uri.fsPath}`);

		const policyFolderName = settings.ragPolicyFolderName || 'policy-manuals';
		const policyFolderUri = URI.joinPath(folder.uri, policyFolderName);

		this.logService.info(`RAGWorkspaceService: Creating policy folder at: ${policyFolderUri.fsPath}`);

		// Ensure policy folder exists
		await this.ensurePolicyFolder(policyFolderUri);

		// Create tosort folder for Case Organizer if enabled
		const autoCreateTosort = settings.caseOrganizerAutoCreateTosort ?? true; // Default to true
		if (autoCreateTosort) {
			const tosortFolderName = settings.caseOrganizerTosortFolderName || 'tosort';
			const tosortFolderUri = URI.joinPath(folder.uri, tosortFolderName);
			this.logService.info(`RAGWorkspaceService: Creating tosort folder at: ${tosortFolderUri.fsPath}`);
			await this.ensureTosortFolder(tosortFolderUri);
		}

		// Set up watcher if enabled
		if (settings.ragWatchPolicyFolder) {
			this.logService.info('RAGWorkspaceService: Setting up file watcher');
			this.setupFileWatcher(policyFolderUri);
		} else {
			this.disposeWatcher();
		}

		// Initial scan and index
		await this.scanAndIndex(policyFolderUri);

		this.logService.info('RAGWorkspaceService: Initialization complete');
	}

	private async ensurePolicyFolder(folderUri: URI): Promise<void> {
		try {
			await this.fileService.createFolder(folderUri);
			this.logService.info(`RAG: Ensured policy folder exists at ${folderUri.fsPath}`);
		} catch (error) {
			if ((error as any).message?.includes('already exists')) {
				this.logService.debug(`RAG: Policy folder already exists at ${folderUri.fsPath}`);
			} else {
				this.logService.error(`RAG: Failed to create policy folder ${folderUri.fsPath}:`, error);
			}
		}
	}

	private async ensureTosortFolder(folderUri: URI): Promise<void> {
		try {
			await this.fileService.createFolder(folderUri);
			this.logService.info(`Case Organizer: Ensured tosort folder exists at ${folderUri.fsPath}`);
		} catch (error) {
			if ((error as any).message?.includes('already exists')) {
				this.logService.debug(`Case Organizer: Tosort folder already exists at ${folderUri.fsPath}`);
			} else {
				this.logService.error(`Case Organizer: Failed to create tosort folder ${folderUri.fsPath}:`, error);
			}
		}
	}

	private setupFileWatcher(folderUri: URI): void {
		this.disposeWatcher(); // Ensure only one watcher is active

		this.fileWatcher = this._register(this.fileService.watch(folderUri));
		this._register(this.fileService.onDidFilesChange(async (event) => {
			// Get all files in the policy folder
			try {
				const files = await this.fileService.resolve(folderUri);
				if (!files.children) return;

				for (const file of files.children) {
					if (file.isDirectory) continue;

					const ext = basename(file.resource.fsPath).split('.').pop()?.toLowerCase();
					if (!['pdf', 'docx', 'txt', 'md'].includes(ext || '')) continue;

					// Check if this file was affected by the change event
					if (event.affects(file.resource, FileChangeType.ADDED, FileChangeType.UPDATED)) {
						this.logService.info(`RAG: File change detected (ADDED/UPDATED): ${file.resource.fsPath}. Indexing...`);
						await this.ragService.indexDocument({
							uri: file.resource,
							isPolicyManual: true,
							workspaceId: this.workspaceService.getWorkspace().id
						});
					} else if (event.affects(file.resource, FileChangeType.DELETED)) {
						this.logService.info(`RAG: File change detected (DELETED): ${file.resource.fsPath}. Removing from index...`);
						await this.ragService.deleteDocument(file.resource);
					}
				}
			} catch (error) {
				this.logService.error(`RAG: Error handling file change:`, error);
			}
		}));
		this.logService.info(`RAG: File watcher set up for ${folderUri.fsPath}`);
	}

	private async scanAndIndex(folderUri: URI): Promise<void> {
		try {
			const files = await this.fileService.resolve(folderUri);
			if (files.children) {
				for (const file of files.children) {
					if (file.isDirectory) continue;

					const ext = basename(file.resource.fsPath).split('.').pop()?.toLowerCase();
					if (['pdf', 'docx', 'txt', 'md'].includes(ext || '')) {
						const isIndexed = await this.ragService.isDocumentIndexed(file.resource);
						if (!isIndexed) {
							this.logService.info(`RAG: Initial scan found unindexed file: ${file.resource.fsPath}. Indexing...`);
							await this.ragService.indexDocument({
								uri: file.resource,
								isPolicyManual: true,
								workspaceId: this.workspaceService.getWorkspace().id
							});
						}
					}
				}
			}
			this.logService.info(`RAG: Initial scan of ${folderUri.fsPath} complete.`);
		} catch (error) {
			this.logService.error(`RAG: Error during initial scan of ${folderUri.fsPath}:`, error);
		}
	}

	private disposeWatcher(): void {
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
			this.fileWatcher = undefined;
			this.logService.info('RAG: Disposed existing file watcher.');
		}
	}
}

registerSingleton(IRAGWorkspaceService, RAGWorkspaceService, InstantiationType.Eager);

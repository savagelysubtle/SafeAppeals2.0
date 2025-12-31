/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable, IDisposable } from '../../../../../base/common/lifecycle.js';
import { URI } from '../../../../../base/common/uri.js';
import { IFileService, FileChangeType } from '../../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { IRAGService } from '../../common/rag/ragService.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../../platform/instantiation/common/extensions.js';
import { basename } from '../../../../../base/common/path.js';

export const IRAGWorkspaceService = createDecorator<IRAGWorkspaceService>('ragWorkspaceService');

export interface IRAGWorkspaceService {
	readonly _serviceBrand: undefined;
}

export class RAGWorkspaceService extends Disposable implements IRAGWorkspaceService {
	readonly _serviceBrand: undefined;

	private fileWatcher: IDisposable | undefined;
	private pollIntervalHandle: ReturnType<typeof setInterval> | undefined;
	private lastRagSettings: string = '';
	private isInitializing: boolean = false;
	private isPolling: boolean = false;

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

		// Listen for workspace folder changes and switch RAG context
		this._register(this.workspaceService.onDidChangeWorkspaceFolders(async (e) => {
			this.logService.info('RAGWorkspaceService: Workspace folders changed, switching workspace context...');
			try {
				// Notify main process to switch workspace context
				const workspaceId = this.ragService.getWorkspaceId();
				await this.ragService.switchWorkspace(workspaceId);
				await this.initialize();
			} catch (err) {
				this.logService.error('RAGWorkspaceService: Failed to switch workspace:', err);
			}
		}));

		// Initialize asynchronously
		this.initialize().catch(err => {
			this.logService.error('RAGWorkspaceService: Failed to initialize:', err);
		});
	}

	private async onSettingsChanged(): Promise<void> {
		// Only reinitialize if RAG-specific settings actually changed
		const settings = this.settingsService.state.globalSettings;
		const currentRagSettings = JSON.stringify({
			ragEnabled: settings.ragEnabled,
			ragAutoIndexPolicyFolder: settings.ragAutoIndexPolicyFolder,
			ragAutoIndexCaseFiles: settings.ragAutoIndexCaseFiles,
			ragPolicyFolderName: settings.ragPolicyFolderName,
			ragWatchPolicyFolder: settings.ragWatchPolicyFolder,
			ragPollIntervalSeconds: settings.ragPollIntervalSeconds,
			caseOrganizerAutoCreateTosort: settings.caseOrganizerAutoCreateTosort,
			caseOrganizerTosortFolderName: settings.caseOrganizerTosortFolderName,
		});

		if (currentRagSettings === this.lastRagSettings) {
			// RAG settings haven't changed, skip reinitialization
			return;
		}

		this.lastRagSettings = currentRagSettings;
		this.disposeWatcher();
		this.disposePolling();
		await this.initialize();
	}

	private async initialize(): Promise<void> {
		// Prevent concurrent initialization
		if (this.isInitializing) {
			this.logService.info('RAGWorkspaceService: Already initializing, skipping');
			return;
		}

		this.isInitializing = true;
		this.logService.info('RAGWorkspaceService: Initialize called');

		try {
			// Wait a bit for settings to load
			await new Promise(resolve => setTimeout(resolve, 100));

			const settings = this.settingsService.state.globalSettings;

			// Update last known RAG settings to prevent unnecessary reinitializations
			this.lastRagSettings = JSON.stringify({
				ragEnabled: settings.ragEnabled,
				ragAutoIndexPolicyFolder: settings.ragAutoIndexPolicyFolder,
				ragAutoIndexCaseFiles: settings.ragAutoIndexCaseFiles,
				ragPolicyFolderName: settings.ragPolicyFolderName,
				ragWatchPolicyFolder: settings.ragWatchPolicyFolder,
				ragPollIntervalSeconds: settings.ragPollIntervalSeconds,
				caseOrganizerAutoCreateTosort: settings.caseOrganizerAutoCreateTosort,
				caseOrganizerTosortFolderName: settings.caseOrganizerTosortFolderName,
			});

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
			this.logService.info('RAGWorkspaceService: Initializing RAG service (local embeddings - no API key required)...');
			await this.ragService.initialize();

			// CRITICAL: Switch to workspace context BEFORE indexing any documents
			// This ensures the main process creates per-workspace databases
			const workspaceId = this.ragService.getWorkspaceId();
			this.logService.info(`RAGWorkspaceService: Switching to workspace context: ${workspaceId}`);
			await this.ragService.switchWorkspace(workspaceId);

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

			// Store current policy folder URI for polling

			// Set up watcher if enabled
			if (settings.ragWatchPolicyFolder) {
				this.logService.info('RAGWorkspaceService: Setting up file watcher');
				this.setupFileWatcher(policyFolderUri);
			} else {
				this.disposeWatcher();
			}

			// Set up polling as fallback for file copy detection (KAN-25)
			const pollInterval = settings.ragPollIntervalSeconds ?? 30;
			if (pollInterval > 0) {
				this.logService.info(`RAGWorkspaceService: Setting up polling with ${pollInterval}s interval (fallback for file copy detection)`);
				this.setupPolling(policyFolderUri, pollInterval);
			} else {
				this.disposePolling();
			}

			// Initial scan and index policy manuals
			await this.scanAndIndex(policyFolderUri);

			// Scan and index case files (everything except policy folder) if enabled
			const ragAutoIndexCaseFiles = settings.ragAutoIndexCaseFiles ?? true; // Default to true
			if (ragAutoIndexCaseFiles) {
				this.logService.info('RAGWorkspaceService: Starting case file scan (excluding policy folder)...');
				await this.scanAndIndexCaseFiles(folder.uri, policyFolderUri);
			}

			this.logService.info('RAGWorkspaceService: Initialization complete');
		} finally {
			this.isInitializing = false;
		}
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
							workspaceId: this.ragService.getWorkspaceId()
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
								workspaceId: this.ragService.getWorkspaceId()
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

	/**
	 * Recursively scan workspace for case files (documents NOT in the policy folder)
	 * and index them as case_index files for RAG
	 */
	private async scanAndIndexCaseFiles(workspaceUri: URI, policyFolderUri: URI): Promise<void> {
		const settings = this.settingsService.state.globalSettings;

		// Folders to skip (in addition to policy folder)
		const skipFolders = new Set([
			'node_modules',
			'.git',
			'.vscode',
			'.cursor',
			'out',
			'dist',
			'build',
			'__pycache__',
			'.venv',
			'venv',
			settings.caseOrganizerTosortFolderName || 'tosort' // Skip tosort folder too
		]);

		let totalIndexed = 0;
		let totalSkipped = 0;

		const scanFolder = async (folderUri: URI, depth: number = 0): Promise<void> => {
			// Limit recursion depth to prevent infinite loops
			if (depth > 10) {
				this.logService.warn(`RAG: Skipping deep folder (depth ${depth}): ${folderUri.fsPath}`);
				return;
			}

			try {
				const folder = await this.fileService.resolve(folderUri);
				if (!folder.children) return;

				for (const item of folder.children) {
					// Skip the policy folder entirely
					if (item.resource.fsPath.startsWith(policyFolderUri.fsPath)) {
						continue;
					}

					if (item.isDirectory) {
						const folderName = basename(item.resource.fsPath);

						// Skip excluded folders
						if (skipFolders.has(folderName) || folderName.startsWith('.')) {
							continue;
						}

						// Recursively scan subdirectories
						await scanFolder(item.resource, depth + 1);
					} else {
						// Check if it's a document we can index
						const ext = basename(item.resource.fsPath).split('.').pop()?.toLowerCase();
						if (!['pdf', 'docx', 'doc', 'txt', 'md', 'xlsx', 'xls'].includes(ext || '')) {
							continue;
						}

						// Check if already indexed
						const isIndexed = await this.ragService.isDocumentIndexed(item.resource);
						if (isIndexed) {
							totalSkipped++;
							continue;
						}

					// Index as case file (NOT policy manual)
					this.logService.info(`RAG: Indexing case file: ${item.resource.fsPath}`);
					try {
						await this.ragService.indexDocument({
							uri: item.resource,
							isPolicyManual: false, // Case file, not policy manual
							workspaceId: this.ragService.getWorkspaceId(),
							indexScope: 'case_index'
						});
						totalIndexed++;
					} catch (err) {
						this.logService.error(`RAG: Failed to index case file ${item.resource.fsPath}:`, err);
					}
					}
				}
			} catch (error) {
				this.logService.error(`RAG: Error scanning folder ${folderUri.fsPath}:`, error);
			}
		};

		await scanFolder(workspaceUri);
		this.logService.info(`RAG: Case file scan complete. Indexed: ${totalIndexed}, Already indexed: ${totalSkipped}`);
	}

	private disposeWatcher(): void {
		if (this.fileWatcher) {
			this.fileWatcher.dispose();
			this.fileWatcher = undefined;
			this.logService.info('RAG: Disposed existing file watcher.');
		}
	}

	/**
	 * Set up periodic polling to detect files that the file watcher may have missed
	 * This is a fallback mechanism for file copy operations (KAN-25)
	 */
	private setupPolling(folderUri: URI, intervalSeconds: number): void {
		this.disposePolling(); // Ensure only one poller is active

		const intervalMs = intervalSeconds * 1000;
		this.logService.info(`RAG: Setting up polling every ${intervalSeconds}s for ${folderUri.fsPath}`);

		this.pollIntervalHandle = setInterval(async () => {
			// Skip if already polling to prevent overlapping scans
			if (this.isPolling) {
				this.logService.debug('RAG: Polling skipped - previous poll still in progress');
				return;
			}

			this.isPolling = true;
			try {
				await this.pollForNewFiles(folderUri);
			} catch (error) {
				this.logService.error('RAG: Error during polling:', error);
			} finally {
				this.isPolling = false;
			}
		}, intervalMs);

		this.logService.info(`RAG: Polling started with ${intervalSeconds}s interval`);
	}

	/**
	 * Poll for new/unindexed files in the policy folder
	 * This catches files that the file watcher may have missed (e.g., copy operations)
	 */
	private async pollForNewFiles(folderUri: URI): Promise<void> {
		try {
			const files = await this.fileService.resolve(folderUri);
			if (!files.children) {
				return;
			}

			let newFilesFound = 0;
			for (const file of files.children) {
				if (file.isDirectory) continue;

				const ext = basename(file.resource.fsPath).split('.').pop()?.toLowerCase();
				if (!['pdf', 'docx', 'txt', 'md'].includes(ext || '')) continue;

				const isIndexed = await this.ragService.isDocumentIndexed(file.resource);
				if (!isIndexed) {
					newFilesFound++;
					this.logService.info(`RAG: Polling found unindexed file: ${file.resource.fsPath}. Indexing...`);
					await this.ragService.indexDocument({
						uri: file.resource,
						isPolicyManual: true,
						workspaceId: this.ragService.getWorkspaceId()
					});
				}
			}

			if (newFilesFound > 0) {
				this.logService.info(`RAG: Polling indexed ${newFilesFound} new file(s)`);
			}
		} catch (error) {
			this.logService.error(`RAG: Error during poll scan of ${folderUri.fsPath}:`, error);
		}
	}

	private disposePolling(): void {
		if (this.pollIntervalHandle) {
			clearInterval(this.pollIntervalHandle);
			this.pollIntervalHandle = undefined;
			this.logService.info('RAG: Disposed existing poller.');
		}
	}
}

registerSingleton(IRAGWorkspaceService, RAGWorkspaceService, InstantiationType.Eager);

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../../base/common/buffer.js';
import { basename, extname } from '../../../../../base/common/path.js';
import { URI } from '../../../../../base/common/uri.js';
import { IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';

import { IFileService } from '../../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { ILLMMessageService } from '../../common/sendLLMMessageService.js';
import { IVoidSettingsService } from '../../common/voidSettingsService.js';
import { AIFileClassifier } from './aiClassifier.js';
import { CaseInfo, FileOrgConfig } from './caseConfig.js';
import { DocketItem, FileChange, FileMetadata, ProcessResult, Rule } from './types.js';

export const IFileOrganizerService = createDecorator<IFileOrganizerService>('fileOrganizerService');

export interface IFileOrganizerService {
	readonly _serviceBrand: undefined;

	/**
	 * Select files from the file system
	 */
	selectFiles(): Promise<URI[]>;

	/**
	 * Analyze files and extract metadata
	 */
	analyzeFiles(files: URI[]): Promise<FileMetadata[]>;

	/**
	 * Apply rules to files and get proposed changes
	 */
	previewChanges(files: FileMetadata[], rules: Rule[]): Promise<FileChange[]>;

	/**
	 * Apply changes to files
	 */
	applyChanges(changes: FileChange[]): Promise<ProcessResult[]>;

	/**
	 * Save case configuration to .fileorg.json
	 */
	saveCaseConfig(workspaceFolder: URI, config: FileOrgConfig): Promise<void>;

	/**
	 * Load case configuration from .fileorg.json
	 */
	loadCaseConfig(workspaceFolder: URI): Promise<FileOrgConfig | null>;

	/**
	 * Check if .fileorg.json exists in workspace
	 */
	caseConfigExists(workspaceFolder: URI): Promise<boolean>;

	/**
	 * Load case info from .caseinfo
	 */
	loadCaseInfo(workspaceFolder: URI): Promise<any | null>;

	/**
	 * Set the inbox folder for the docket
	 */
	setInboxFolder(uri: URI): void;

	/**
	 * Get the current inbox folder
	 */
	getInboxFolder(): URI | undefined;

	/**
	 * Auto-detect and initialize the "To Sort" inbox folder
	 * Returns the folder path string, or null if not available
	 */
	autoDetectInbox(): string | null;

	/**
	 * Scan the inbox folder for new files
	 * @param force If true, bypasses the cooldown and forces a fresh scan
	 */
	scanInboxFolder(force?: boolean): Promise<DocketItem[]>;

	/**
	 * Classify a single file with case context using AI
	 */
	classifySingleFile(file: DocketItem, caseInfo: CaseInfo | null): Promise<DocketItem>;

	/**
	 * Move a file to its destination
	 */
	moveFileToDestination(file: DocketItem, destinationUri: URI): Promise<ProcessResult>;

	/**
	 * Update docket item with manual changes
	 */
	updateDocketItem(item: DocketItem): Promise<DocketItem>;

	/**
	 * Move a file to a destination folder path (relative to workspace)
	 */
	moveFileToFolder(file: DocketItem, folderPath: string): Promise<ProcessResult>;

	/**
	 * Open a folder in the OS file explorer
	 */
	revealInExplorer(folderPath: string): Promise<void>;
}

export class FileOrganizerService implements IFileOrganizerService {
	declare readonly _serviceBrand: undefined;

	private inboxFolderUri: URI | undefined;
	private aiClassifier: AIFileClassifier;
	private lastScanTime: number = 0;
	private readonly SCAN_COOLDOWN_MS = 5000; // 5 seconds between scans
	private cachedDocketItems: DocketItem[] = [];
	private cachedCaseInfo: any | null = null;
	private lastCaseInfoCheck: number = 0;
	private readonly CASE_INFO_COOLDOWN_MS = 30000; // 30 seconds between case info checks

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@ILLMMessageService llmMessageService: ILLMMessageService,
		@IVoidSettingsService voidSettingsService: IVoidSettingsService
	) {
		this.aiClassifier = new AIFileClassifier(llmMessageService, voidSettingsService);
	}

	async selectFiles(): Promise<URI[]> {
		try {
			console.log('[FileOrganizerService] Opening file dialog...');
			// Since we're selecting files per side (Your Side / Their Side),
			// we'll focus on file selection only to avoid Windows dialog issues
			const result = await this.fileDialogService.showOpenDialog({
				canSelectFiles: true,
				canSelectFolders: false, // Disable folder selection - files only
				canSelectMany: true,
				openLabel: 'Select Files to Organize',
				title: 'Select Files'
			});

			console.log('[FileOrganizerService] Dialog result:', result);

			// Return selected files (folders are disabled, so result only contains files)
			return result || [];
		} catch (error) {
			console.error('[FileOrganizerService] Error in selectFiles:', error);
			throw error;
		}
	}

	async analyzeFiles(files: URI[]): Promise<FileMetadata[]> {
		const metadata: FileMetadata[] = [];
		const errors: string[] = [];

		for (const uri of files) {
			try {
				const stat = await this.fileService.stat(uri);
				if (stat.isDirectory) {
					console.warn(`[FileOrganizer] Skipping directory: ${uri.toString()}`);
					continue;
				}

				const name = basename(uri.path);
				const extension = extname(uri.path).slice(1); // Remove leading dot

				metadata.push({
					uri,
					name,
					extension,
					size: stat.size,
					mimeType: this.getMimeType(extension),
					preview: undefined // TODO: Generate preview for images
				});
			} catch (error) {
				const errorMessage = `Failed to analyze file ${uri.toString()}: ${error instanceof Error ? error.message : String(error)}`;
				console.error(errorMessage);
				errors.push(errorMessage);
			}
		}

		if (errors.length > 0) {
			console.warn(`[FileOrganizer] Encountered ${errors.length} errors during file analysis.`);
		}

		return metadata;
	}

	async previewChanges(files: FileMetadata[], rules: Rule[]): Promise<FileChange[]> {
		const changes: FileChange[] = [];
		const usedNames = new Set<string>(); // Track used names to prevent duplicates

		for (const file of files) {
			const proposedChange = this.applyRulesToFile(file, rules);
			if (proposedChange) {
				// Ensure unique names by adding suffix if duplicate
				let uniqueName = proposedChange.proposed.name;
				let counter = 1;
				const nameParts = uniqueName.split('.');
				const extension = nameParts.pop();
				const baseName = nameParts.join('.');

				while (usedNames.has(uniqueName.toLowerCase())) {
					uniqueName = `${baseName}_${counter}.${extension}`;
					counter++;
				}

				usedNames.add(uniqueName.toLowerCase());
				proposedChange.proposed.name = uniqueName;

				changes.push(proposedChange);
			}
		}

		return changes;
	}

	async applyChanges(changes: FileChange[]): Promise<ProcessResult[]> {
		const results: ProcessResult[] = [];
		const createdFolders = new Set<string>(); // Track created folders to avoid redundant operations

		for (const change of changes) {
			try {
				// Determine target directory and filename
				const targetDir = change.proposed.location || URI.from({
					...change.original.uri,
					path: change.original.uri.path.substring(0, change.original.uri.path.lastIndexOf('/'))
				});

				// Create target folder if it doesn't exist
				const targetDirPath = targetDir.toString();
				if (!createdFolders.has(targetDirPath)) {
					const dirExists = await this.fileService.exists(targetDir);
					if (!dirExists) {
						console.log(`[FileOrganizer] Creating folder: ${targetDir.path}`);
						await this.fileService.createFolder(targetDir);
					}
					createdFolders.add(targetDirPath);
				}

				const newUri = URI.joinPath(targetDir, change.proposed.name);

				// Check if target already exists and is different from source
				const targetExists = await this.fileService.exists(newUri);
				const isSameFile = change.original.uri.toString() === newUri.toString();

				if (targetExists && !isSameFile) {
					results.push({
						success: false,
						file: change.original.uri,
						error: `Target file already exists: ${change.proposed.name}. File was NOT moved to prevent data loss.`
					});
					continue;
				}

				// Move/rename the file - NEVER overwrite
				await this.fileService.move(change.original.uri, newUri, false);

				// Store tags as file metadata (using extended attributes or separate metadata file)
				await this.storeMetadata(newUri, change.proposed.tags);

				results.push({
					success: true,
					file: change.original.uri
				});
			} catch (error) {
				results.push({
					success: false,
					file: change.original.uri,
					error: error instanceof Error ? error.message : String(error)
				});
			}
		}

		return results;
	}

	private applyRulesToFile(file: FileMetadata, rules: Rule[]): FileChange | null {
		let proposedName = file.name;
		const tags: string[] = [];
		let targetFolder: string | undefined;

		for (const rule of rules) {
			if (rule.conditions && !this.matchesConditions(file, rule.conditions)) {
				continue;
			}

			if (rule.type === 'rename' && rule.action.nameFormat) {
				proposedName = this.applyNamingPattern(file, rule.action.nameFormat);
			}

			if (rule.type === 'tag' && rule.action.tags) {
				tags.push(...rule.action.tags);
				// Use the last matching rule's target path
				if (rule.action.targetPath) {
					targetFolder = rule.action.targetPath;
				}
			}
		}

		// Use classification-based folder if no targetPath was set by rules
		if (!targetFolder && file.classification && file.classification !== 'Unknown') {
			targetFolder = file.classification;
		}

		// Only create a change if something actually changed
		if (proposedName === file.name && tags.length === 0 && !targetFolder) {
			return null;
		}

		// Determine the target location
		let targetLocation = file.uri;
		if (targetFolder) {
			// Try to get the workspace folder for the file
			const workspaceFolder = this.contextService.getWorkspaceFolder(file.uri);

			if (workspaceFolder) {
				// Use workspace root
				targetLocation = URI.joinPath(workspaceFolder.uri, targetFolder);
			} else {
				// Fallback to parent directory if not in a workspace
				const parentDir = URI.from({
					...file.uri,
					path: file.uri.path.substring(0, file.uri.path.lastIndexOf('/'))
				});
				targetLocation = URI.joinPath(parentDir, targetFolder);
			}
		}

		return {
			original: file,
			proposed: {
				name: proposedName,
				tags: [...new Set(tags)], // Remove duplicates
				location: targetLocation
			},
			confidence: 0.8, // Simple confidence score for now
			reasoning: `Applied ${rules.length} rules to file${targetFolder ? ` - moving to ${targetFolder}/` : ''}`
		};
	}

	private matchesConditions(file: FileMetadata, conditions: Array<{ field: string; operator: string; value: string | number }>): boolean {
		return conditions.every(condition => {
			const fieldValue = file[condition.field as keyof FileMetadata];
			const conditionValue = condition.value;

			switch (condition.operator) {
				case 'equals':
					return fieldValue === conditionValue;
				case 'contains':
					return typeof fieldValue === 'string' && fieldValue.includes(String(conditionValue));
				case 'startsWith':
					return typeof fieldValue === 'string' && fieldValue.startsWith(String(conditionValue));
				case 'endsWith':
					return typeof fieldValue === 'string' && fieldValue.endsWith(String(conditionValue));
				case 'greaterThan':
					return typeof fieldValue === 'number' && fieldValue > Number(conditionValue);
				case 'lessThan':
					return typeof fieldValue === 'number' && fieldValue < Number(conditionValue);
				default:
					return false;
			}
		});
	}

	private applyNamingPattern(file: FileMetadata, pattern: string): string {
		// Simple pattern replacement - preserves original filename to maintain uniqueness
		let result = pattern;

		// Extract project name from current name (simple heuristic)
		const projectName = file.name.split('_')[0] || 'Unnamed';

		// Determine file type based on name patterns
		let fileType = 'File';
		if (file.name.toLowerCase().includes('wireframe')) {
			fileType = 'Wireframe';
		} else if (file.name.toLowerCase().includes('mockup')) {
			fileType = 'Mockup';
		} else if (file.name.toLowerCase().includes('prototype')) {
			fileType = 'Prototype';
		} else if (file.name.toLowerCase().includes('medical')) {
			fileType = 'Medical';
		} else if (file.name.toLowerCase().includes('legal')) {
			fileType = 'Legal';
		} else if (file.name.toLowerCase().includes('correspondence')) {
			fileType = 'Correspondence';
		} else {
			fileType = file.extension.toUpperCase();
		}

		// Extract version (simple pattern matching)
		const versionMatch = file.name.match(/v?(\d+)/i);
		const version = versionMatch ? `v${versionMatch[1]}` : 'v1';

		// Use the manual classification if available, otherwise fall back to keyword detection
		let side = 'Unknown';
		if (file.classification && file.classification !== 'Unknown') {
			side = file.classification;
		} else {
			// Fallback to keyword detection for backwards compatibility
			const lowerName = file.name.toLowerCase();
			if (lowerName.includes('your') || lowerName.includes('my') || lowerName.includes('personal') ||
				lowerName.includes('claimant') || lowerName.includes('treating')) {
				side = 'YourSide';
			} else if (lowerName.includes('employer') || lowerName.includes('wcb') || lowerName.includes('ime') ||
				lowerName.includes('defense') || lowerName.includes('review officer')) {
				side = 'TheirSide';
			}
		}

		// Get the original name without extension for uniqueness
		const originalBaseName = file.name.replace(extname(file.name), '');

		result = result
			.replace('{Side}', side)
			.replace('{Category}', fileType)
			.replace('{ProjectName}', projectName)
			.replace('{FileType}', fileType)
			.replace('{Version}', version)
			.replace('{Date}', new Date().toISOString().split('T')[0])
			.replace('{YYYY-MM-DD}', new Date().toISOString().split('T')[0])
			.replace('{Description}', originalBaseName)
			.replace('{Name}', originalBaseName);

		// Ensure file keeps its extension
		if (!result.endsWith('.' + file.extension)) {
			result += '.' + file.extension;
		}

		return result;
	}

	async saveCaseConfig(workspaceFolder: URI, config: FileOrgConfig): Promise<void> {
		try {
			const configUri = URI.joinPath(workspaceFolder, '.fileorg.json');
			const content = JSON.stringify(config, null, 2);
			await this.fileService.writeFile(configUri, VSBuffer.fromString(content));
			console.log('[FileOrganizerService] Case config saved to:', configUri.toString());

			// Initialize folders based on config
			await this.initializeCaseFolders(workspaceFolder, config);
		} catch (error) {
			console.error('[FileOrganizerService] Error saving case config:', error);
			throw error;
		}
	}

	async initializeCaseFolders(workspaceFolder: URI, config: FileOrgConfig): Promise<void> {
		try {
			// 1. Create "tosort" inbox folder
			const toSortUri = URI.joinPath(workspaceFolder, 'tosort');
			if (!(await this.fileService.exists(toSortUri))) {
				await this.fileService.createFolder(toSortUri);
			}
			this.setInboxFolder(toSortUri);

			// 2. Create destination folders based on template
			// For now, we'll create standard legal folders. In future, read from template rules.
			const standardFolders = [
				'Medical/Reports',
				'Medical/Imaging',
				'Medical/Bills',
				'Legal/Correspondence',
				'Legal/Court Filings',
				'Legal/Decisions',
				'Evidence',
				'Your Side',
				'Their Side'
			];

			for (const folder of standardFolders) {
				const folderUri = URI.joinPath(workspaceFolder, folder);
				if (!(await this.fileService.exists(folderUri))) {
					await this.fileService.createFolder(folderUri);
				}
			}
			console.log('[FileOrganizerService] Case folders initialized');
		} catch (error) {
			console.error('[FileOrganizerService] Error initializing folders:', error);
		}
	}

	async loadCaseConfig(workspaceFolder: URI): Promise<FileOrgConfig | null> {
		try {
			const configUri = URI.joinPath(workspaceFolder, '.fileorg.json');
			const exists = await this.fileService.exists(configUri);

			if (!exists) {
				return null;
			}

			const content = await this.fileService.readFile(configUri);
			const config = JSON.parse(content.value.toString()) as FileOrgConfig;
			console.log('[FileOrganizerService] Case config loaded from:', configUri.toString());
			return config;
		} catch (error) {
			console.error('[FileOrganizerService] Error loading case config:', error);
			return null;
		}
	}

	async caseConfigExists(workspaceFolder: URI): Promise<boolean> {
		try {
			const configUri = URI.joinPath(workspaceFolder, '.fileorg.json');
			return await this.fileService.exists(configUri);
		} catch (error) {
			console.error('[FileOrganizerService] Error checking case config:', error);
			return false;
		}
	}

	private getMimeType(extension: string): string {
		const mimeTypes: Record<string, string> = {
			'fig': 'application/x-figma',
			'sketch': 'application/x-sketch',
			'xd': 'application/x-xd',
			'pdf': 'application/pdf',
			'png': 'image/png',
			'jpg': 'image/jpeg',
			'jpeg': 'image/jpeg',
			'svg': 'image/svg+xml',
			'gif': 'image/gif',
			'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
			'doc': 'application/msword',
			'txt': 'text/plain'
		};

		return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
	}

	async loadCaseInfo(workspaceFolder: URI): Promise<any | null> {
		// Return cached result if within cooldown
		const now = Date.now();
		if (now - this.lastCaseInfoCheck < this.CASE_INFO_COOLDOWN_MS && this.cachedCaseInfo !== undefined) {
			return this.cachedCaseInfo;
		}
		this.lastCaseInfoCheck = now;

		try {
			// Try to read .caseinfo from workspace root
			const caseInfoUri = URI.joinPath(workspaceFolder, '.caseinfo');
			const exists = await this.fileService.exists(caseInfoUri);

			if (!exists) {
				console.log('[FileOrganizerService] .caseinfo not found at:', caseInfoUri.toString());
				this.cachedCaseInfo = null;
				return null;
			}

			const content = await this.fileService.readFile(caseInfoUri);
			const parsed = JSON.parse(content.value.toString());
			console.log('[FileOrganizerService] Loaded .caseinfo:', parsed);

			// Return the caseInfo property if it exists (structure from CaseInfoPane), otherwise return the whole object
			this.cachedCaseInfo = parsed.caseInfo || parsed;
			return this.cachedCaseInfo;
		} catch (error) {
			console.error('[FileOrganizerService] Error loading .caseinfo:', error);
			this.cachedCaseInfo = null;
			return null;
		}
	}

	private async storeMetadata(uri: URI, tags: string[]): Promise<void> {
		// For now, we'll store metadata in a companion .meta file
		// In a production system, this could use extended file attributes or a database
		if (tags.length === 0) {
			return;
		}

		const metaUri = URI.from({
			...uri,
			path: uri.path + '.meta'
		});

		const metadata = JSON.stringify({ tags, timestamp: new Date().toISOString() }, null, 2);
		await this.fileService.writeFile(metaUri, VSBuffer.fromString(metadata));
	}

	// ============================================================================
	// DOCKET FUNCTIONALITY
	// ============================================================================

	setInboxFolder(uri: URI): void {
		this.inboxFolderUri = uri;
		console.log('[FileOrganizerService] Inbox folder set to:', uri.toString());
	}

	getInboxFolder(): URI | undefined {
		return this.inboxFolderUri;
	}

	autoDetectInbox(): string | null {
		const workspace = this.contextService.getWorkspace();
		const workspaceFolder = workspace.folders?.[0]?.uri;

		if (!workspaceFolder) {
			console.warn('[FileOrganizerService] No workspace folder available');
			return null;
		}

		// Check for existing inbox folders (try both naming conventions)
		const toSortUri = URI.joinPath(workspaceFolder, 'tosort');
		this.inboxFolderUri = toSortUri;

		return toSortUri.fsPath || toSortUri.path;
	}

	async scanInboxFolder(force: boolean = false): Promise<DocketItem[]> {
		if (!this.inboxFolderUri) {
			throw new Error('Inbox folder not set. Please set an inbox folder first.');
		}

		// Rate limiting - return cached results if within cooldown (unless forced)
		const now = Date.now();
		if (!force && now - this.lastScanTime < this.SCAN_COOLDOWN_MS && this.cachedDocketItems.length > 0) {
			console.log('[FileOrganizerService] Scan skipped (cooldown) - returning cached results');
			return this.cachedDocketItems;
		}
		this.lastScanTime = now;

		try {
			const stat = await this.fileService.resolve(this.inboxFolderUri);

			if (!stat.isDirectory) {
				throw new Error('Inbox path is not a directory');
			}

			const docketItems: DocketItem[] = [];

			if (stat.children) {
				for (const child of stat.children) {
					if (!child.isDirectory) {
						try {
							const metadata = await this.analyzeFiles([child.resource]);
							if (metadata.length > 0) {
								docketItems.push({
									...metadata[0],
									docketStatus: 'new',
									addedAt: new Date().toISOString(),
								});
							}
						} catch (error) {
							console.error(`Failed to analyze file ${child.resource.toString()}:`, error);
						}
					}
				}
			}

			// Cache results
			this.cachedDocketItems = docketItems;
			console.log(`[FileOrganizerService] Scanned inbox, found ${docketItems.length} files`);
			return docketItems;
		} catch (error) {
			console.error('[FileOrganizerService] Error scanning inbox folder:', error);
			throw error;
		}
	}

	async classifySingleFile(file: DocketItem, caseInfo: CaseInfo | null): Promise<DocketItem> {
		console.log('[FileOrganizerService] Classifying file with AI:', file.name);

		// Update status to analyzing
		const analyzingFile: DocketItem = {
			...file,
			docketStatus: 'analyzing'
		};

		try {
			// Use AI classifier with case context (or default empty context if null)
			const effectiveCaseInfo: CaseInfo = caseInfo || {
				caseType: 'Workers Compensation',
				keywords: {
					yourSide: [],
					theirSide: [],
					medical: [],
					legal: [],
					evidence: []
				}
			};
			const result = await this.aiClassifier.classifyFileWithContext(file, effectiveCaseInfo);

			if (!result) {
				console.warn('[FileOrganizerService] AI classification returned null');
				return {
					...analyzingFile,
					docketStatus: 'error'
				};
			}

			// Convert AI result to docket item
			const classifiedFile: DocketItem = {
				...analyzingFile,
				docketStatus: 'ready',
				aiConfidence: result.confidence,
				classification: result.side && result.side !== 'Neutral' ? result.side : 'Unknown',
				classificationMethod: 'ai',
				entityMatches: result.entityMatches,
				suggestedTags: result.tags.map(tag => ({
					id: tag,
					name: tag,
					type: 'category' as const
				})),
				suggestedFolder: result.suggestedFolder
			};

			console.log('[FileOrganizerService] Classification complete:', {
				name: file.name,
				side: result.side,
				category: result.category,
				confidence: result.confidence
			});

			return classifiedFile;
		} catch (error) {
			console.error('[FileOrganizerService] Error classifying file:', error);
			return {
				...analyzingFile,
				docketStatus: 'error'
			};
		}
	}

	async moveFileToDestination(file: DocketItem, destinationUri: URI): Promise<ProcessResult> {
		try {
			// Create destination folder if it doesn't exist
			const destinationDirExists = await this.fileService.exists(destinationUri);
			if (!destinationDirExists) {
				console.log(`[FileOrganizerService] Creating destination folder: ${destinationUri.path}`);
				await this.fileService.createFolder(destinationUri);
			}

			const targetUri = URI.joinPath(destinationUri, file.name);

			// Check if target already exists
			const targetExists = await this.fileService.exists(targetUri);
			const isSameFile = file.uri.toString() === targetUri.toString();

			if (targetExists && !isSameFile) {
				return {
					success: false,
					file: file.uri,
					error: `Target file already exists: ${file.name}. File was NOT moved to prevent data loss.`
				};
			}

			// Move the file
			await this.fileService.move(file.uri, targetUri, false);

			// Store tags if any
			if (file.suggestedTags && file.suggestedTags.length > 0) {
				await this.storeMetadata(targetUri, file.suggestedTags.map(t => t.name));
			}

			console.log(`[FileOrganizerService] File moved successfully: ${file.name} -> ${destinationUri.path}`);

			return {
				success: true,
				file: file.uri
			};
		} catch (error) {
			console.error('[FileOrganizerService] Error moving file:', error);
			return {
				success: false,
				file: file.uri,
				error: error instanceof Error ? error.message : String(error)
			};
		}
	}

	async updateDocketItem(item: DocketItem): Promise<DocketItem> {
		// This method allows manual updates to docket items
		// For now, it just returns the updated item
		// In the future, this could save state to a database or file
		console.log('[FileOrganizerService] Docket item updated:', item.name);
		return item;
	}

	async moveFileToFolder(file: DocketItem, folderPath: string): Promise<ProcessResult> {
		const workspace = this.contextService.getWorkspace();
		const workspaceFolder = workspace.folders?.[0]?.uri;

		if (!workspaceFolder) {
			return { success: false, error: 'No workspace folder available' };
		}

		const destUri = URI.joinPath(workspaceFolder, folderPath);
		return this.moveFileToDestination(file, destUri);
	}

	async revealInExplorer(folderPath: string): Promise<void> {
		try {
			const uri = URI.file(folderPath);
			// Use the native host service to reveal in OS explorer
			// For now, we'll just log - the opener service approach is trickier
			console.log('[FileOrganizerService] Would reveal:', uri.toString());
			// Alternative: use shell.openPath from electron if available
		} catch (error) {
			console.error('[FileOrganizerService] Failed to reveal folder:', error);
		}
	}
}


/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { VSBuffer } from '../../../../../base/common/buffer.js';
import { basename, extname } from '../../../../../base/common/path.js';
import { URI } from '../../../../../base/common/uri.js';
import { IFileDialogService } from '../../../../../platform/dialogs/common/dialogs.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { FileChange, FileMetadata, ProcessResult, Rule } from './types.js';
import { FileOrgConfig } from './caseConfig.js';

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
}

export class FileOrganizerService implements IFileOrganizerService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService
	) { }

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

		for (const uri of files) {
			try {
				const stat = await this.fileService.stat(uri);
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
				console.error(`Failed to analyze file ${uri.toString()}:`, error);
			}
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
			// Get the parent directory of the file
			const parentDir = URI.from({
				...file.uri,
				path: file.uri.path.substring(0, file.uri.path.lastIndexOf('/'))
			});

			// Create target path in parent directory
			targetLocation = URI.joinPath(parentDir, targetFolder);
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
		} catch (error) {
			console.error('[FileOrganizerService] Error saving case config:', error);
			throw error;
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
}


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
}

export class FileOrganizerService implements IFileOrganizerService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IFileDialogService private readonly fileDialogService: IFileDialogService
	) { }

	async selectFiles(): Promise<URI[]> {
		const result = await this.fileDialogService.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: true,
			openLabel: 'Select Files to Organize',
			title: 'Select Files'
		});

		return result || [];
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

		for (const file of files) {
			const proposedChange = this.applyRulesToFile(file, rules);
			if (proposedChange) {
				changes.push(proposedChange);
			}
		}

		return changes;
	}

	async applyChanges(changes: FileChange[]): Promise<ProcessResult[]> {
		const results: ProcessResult[] = [];

		for (const change of changes) {
			try {
				// Build new URI with the proposed name
				const directory = URI.from({
					...change.original.uri,
					path: change.original.uri.path.substring(0, change.original.uri.path.lastIndexOf('/'))
				});

				const newUri = URI.joinPath(directory, change.proposed.name);

				// Move/rename the file
				await this.fileService.move(change.original.uri, newUri, true);

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

		for (const rule of rules) {
			if (rule.conditions && !this.matchesConditions(file, rule.conditions)) {
				continue;
			}

			if (rule.type === 'rename' && rule.action.nameFormat) {
				proposedName = this.applyNamingPattern(file, rule.action.nameFormat);
			}

			if (rule.type === 'tag' && rule.action.tags) {
				tags.push(...rule.action.tags);
			}
		}

		// Only create a change if something actually changed
		if (proposedName === file.name && tags.length === 0) {
			return null;
		}

		return {
			original: file,
			proposed: {
				name: proposedName,
				tags: [...new Set(tags)], // Remove duplicates
				location: file.uri
			},
			confidence: 0.8, // Simple confidence score for now
			reasoning: `Applied ${rules.length} rules to file`
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
		// Simple pattern replacement - in a real implementation, this would be more sophisticated
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
		} else {
			fileType = file.extension.toUpperCase();
		}

		// Extract version (simple pattern matching)
		const versionMatch = file.name.match(/v?(\d+)/i);
		const version = versionMatch ? `v${versionMatch[1]}` : 'v1';

		result = result
			.replace('{ProjectName}', projectName)
			.replace('{FileType}', fileType)
			.replace('{Version}', version)
			.replace('{Date}', new Date().toISOString().split('T')[0])
			.replace('{Name}', file.name.replace(extname(file.name), ''));

		// Ensure file keeps its extension
		if (!result.endsWith('.' + file.extension)) {
			result += '.' + file.extension;
		}

		return result;
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


/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IDocumentCreatorService } from './documentCreatorService.js';

/**
 * Watches for DOCX/XLSX file creation (both internal and external) and automatically
 * populates empty files with valid document content
 */
export class DocumentFileCreationContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.void.documentFileCreation';

	private _processingFiles = new Set<string>();

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IDocumentCreatorService private readonly documentCreatorService: IDocumentCreatorService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		super();

		// Watch for DOCX and XLSX file creation in the workspace
		// This catches files created externally (Windows Explorer) AND internally (VSCode)
		this.setupFileWatchers();
	}

	private setupFileWatchers(): void {
		const workspaceFolder = this.workspaceContextService.getWorkspace().folders[0];
		if (!workspaceFolder) {
			console.warn('[DocumentFileCreation] No workspace folder found, file watching disabled');
			return;
		}

		console.log('[DocumentFileCreation] Setting up file watchers for DOCX/XLSX files');

		// Watch for DOCX files
		const docxPattern = URI.joinPath(workspaceFolder.uri, '**/*.docx').toString();
		this.watchFiles(docxPattern, 'docx');

		// Watch for XLSX files
		const xlsxPattern = URI.joinPath(workspaceFolder.uri, '**/*.{xlsx,xls}').toString();
		this.watchFiles(xlsxPattern, 'xlsx');
	}

	private watchFiles(pattern: string, fileType: 'docx' | 'xlsx'): void {
		// Use file service to watch for changes
		// This will catch external file creation events
		this._register(this.fileService.watch(URI.parse(pattern)));

		// Also listen to file service events for internal creation
		this._register(this.fileService.onDidFilesChange(async (event) => {
			// Check added files (newly created)
			for (const uri of event.rawAdded) {
				const fileExt = uri.path.toLowerCase().split('.').pop();
				if (fileExt === 'docx' || fileExt === 'xlsx' || fileExt === 'xls') {
					// Small delay to ensure file is fully created
					setTimeout(async () => {
						await this.handleFileCreation(uri);
					}, 100);
				}
			}

			// Also check updated files (might be 0-byte file being populated externally)
			for (const uri of event.rawUpdated) {
				const fileExt = uri.path.toLowerCase().split('.').pop();
				if (fileExt === 'docx' || fileExt === 'xlsx' || fileExt === 'xls') {
					// Small delay to ensure file is stable
					setTimeout(async () => {
						await this.handleFileCreation(uri);
					}, 100);
				}
			}
		}));
	}

	private async handleFileCreation(resource: URI): Promise<void> {
		const resourceStr = resource.toString();

		// Prevent duplicate processing
		if (this._processingFiles.has(resourceStr)) {
			console.log(`[DocumentFileCreation] Already processing: ${resourceStr}`);
			return;
		}

		try {
			const fileExt = resource.path.toLowerCase().split('.').pop();

			// Only handle DOCX and XLSX files
			if (fileExt !== 'docx' && fileExt !== 'xlsx' && fileExt !== 'xls') {
				return;
			}

			this._processingFiles.add(resourceStr);
			console.log(`[DocumentFileCreation] Handling creation of: ${resourceStr}`);

			// Check if file exists and get its size
			let stat;
			try {
				stat = await this.fileService.stat(resource);
			} catch (error) {
				console.log(`[DocumentFileCreation] File not found or not accessible yet: ${resourceStr}`);
				return;
			}

			console.log(`[DocumentFileCreation] File size: ${stat.size} bytes`);

			if (stat.size !== 0) {
				// File already has content, don't overwrite
				console.log(`[DocumentFileCreation] File already has content, skipping`);
				return;
			}

			// File is empty, populate it with valid content
			console.log(`[DocumentFileCreation] Populating empty ${fileExt.toUpperCase()} file...`);
			if (fileExt === 'docx') {
				await this.documentCreatorService.createEmptyDOCX(resource);
			} else {
				await this.documentCreatorService.createEmptyXLSX(resource);
			}
			console.log(`[DocumentFileCreation] ✅ Successfully populated ${fileExt.toUpperCase()} file`);
		} catch (error) {
			// Log error but don't block file creation
			console.error('[DocumentFileCreation] ❌ Failed to populate empty document file:', error);
		} finally {
			this._processingFiles.delete(resourceStr);
		}
	}
}

// Register the contribution to run after workspace is restored
registerWorkbenchContribution2(DocumentFileCreationContribution.ID, DocumentFileCreationContribution, WorkbenchPhase.AfterRestored);


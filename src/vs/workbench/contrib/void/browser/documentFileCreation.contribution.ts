/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { FileOperation, IFileService } from '../../../../platform/files/common/files.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IDocumentCreatorService } from './documentCreatorService.js';

/**
 * Listens to file creation events and automatically populates empty DOCX/XLSX files
 * with valid empty document content
 */
export class DocumentFileCreationContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.void.documentFileCreation';

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IDocumentCreatorService private readonly documentCreatorService: IDocumentCreatorService
	) {
		super();

		// Listen to file operations
		this._register(this.fileService.onDidRunOperation(async (event) => {
			if (event.operation === FileOperation.CREATE && event.target) {
				await this.handleFileCreation(event.resource);
			}
		}));
	}

	private async handleFileCreation(resource: any): Promise<void> {
		try {
			const fileExt = resource.path.toLowerCase().split('.').pop();

			// Only handle DOCX and XLSX files
			if (fileExt !== 'docx' && fileExt !== 'xlsx' && fileExt !== 'xls') {
				return;
			}

			// Check if the file is empty (0 bytes)
			const stat = await this.fileService.stat(resource);
			if (stat.size !== 0) {
				// File already has content, don't overwrite
				return;
			}

			// File is empty, populate it with valid content
			if (fileExt === 'docx') {
				await this.documentCreatorService.createEmptyDOCX(resource);
			} else {
				await this.documentCreatorService.createEmptyXLSX(resource);
			}
		} catch (error) {
			// Silently fail - don't block file creation
			console.error('Failed to populate empty document file:', error);
		}
	}
}

// Register the contribution to run after workspace is restored
registerWorkbenchContribution2(DocumentFileCreationContribution.ID, DocumentFileCreationContribution, WorkbenchPhase.AfterRestored);


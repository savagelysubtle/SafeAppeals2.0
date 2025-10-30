/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { FileOrgConfig, generateAIContextString } from './fileOrganizer/caseConfig.js';

export const IFileOrgContextService = createDecorator<IFileOrgContextService>('fileOrgContextService');

export interface IFileOrgContextService {
	readonly _serviceBrand: undefined;
	getCaseContext(): Promise<string | null>;
	reloadCaseConfig(): Promise<void>;
}

/**
 * Service to integrate .fileorg.json case configuration into AI context
 * Similar to how .voidrules works
 */
class FileOrgContextService extends Disposable implements IFileOrgContextService {
	declare readonly _serviceBrand: undefined;

	private _caseConfig: FileOrgConfig | null = null;
	private _caseContext: string | null = null;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService
	) {
		super();

		// Load case config on service initialization
		this.reloadCaseConfig();

		// Watch for changes to .fileorg.json
		this._register(this.fileService.onDidFilesChange((e: any) => {
			for (const change of e.changes) {
				if (change.resource.path.endsWith('.fileorg.json')) {
					console.log('[FileOrgContextService] Detected .fileorg.json change, reloading...');
					this.reloadCaseConfig();
				}
			}
		}));
	}

	async reloadCaseConfig(): Promise<void> {
		try {
			const workspaces = this.workspaceContextService.getWorkspace().folders;
			if (workspaces.length === 0) {
				this._caseConfig = null;
				this._caseContext = null;
				return;
			}

			// Check the first workspace folder for .fileorg.json
			const workspaceFolder = workspaces[0].uri;
			const configUri = URI.joinPath(workspaceFolder, '.fileorg.json');

			const exists = await this.fileService.exists(configUri);
			if (!exists) {
				this._caseConfig = null;
				this._caseContext = null;
				console.log('[FileOrgContextService] No .fileorg.json found');
				return;
			}

			const content = await this.fileService.readFile(configUri);
			this._caseConfig = JSON.parse(content.value.toString()) as FileOrgConfig;
			this._caseContext = generateAIContextString(this._caseConfig);

			console.log('[FileOrgContextService] Case config loaded from:', configUri.toString());
		} catch (error) {
			console.error('[FileOrgContextService] Error loading case config:', error);
			this._caseConfig = null;
			this._caseContext = null;
		}
	}

	async getCaseContext(): Promise<string | null> {
		if (!this._caseContext) {
			await this.reloadCaseConfig();
		}
		return this._caseContext;
	}

	getCaseConfig(): FileOrgConfig | null {
		return this._caseConfig;
	}
}

registerSingleton(IFileOrgContextService, FileOrgContextService, InstantiationType.Delayed);


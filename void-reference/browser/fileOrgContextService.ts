/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
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
	getCaseContextSync(): string | null;
	getCaseConfig(): FileOrgConfig | null;
	reloadCaseConfig(): Promise<void>;
	/**
	 * Event fired when the case config changes (file saved or external modification)
	 */
	readonly onDidConfigChange: Event<FileOrgConfig | null>;
}

/**
 * Service to integrate .fileorg.json case configuration into AI context
 * This provides case-specific context loaded from .fileorg.json files in workspace roots
 */
class FileOrgContextService extends Disposable implements IFileOrgContextService {
	declare readonly _serviceBrand: undefined;

	private _caseConfig: FileOrgConfig | null = null;
	private _caseContext: string | null = null;

	private readonly _onDidConfigChange = this._register(new Emitter<FileOrgConfig | null>());
	readonly onDidConfigChange: Event<FileOrgConfig | null> = this._onDidConfigChange.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService
	) {
		super();

		// Load case config on service initialization
		this.reloadCaseConfig();

		// Watch for changes to .fileorg.json
		this._register(this.fileService.onDidFilesChange((e) => {
			// e may be a FileChangesEvent with .changes array, or may have .rawChanges
			// Use the contains() method to safely check for file changes
			try {
				if (e.contains && typeof e.contains === 'function') {
					// This is the proper FileChangesEvent interface
					// Check if any workspace folder has .fileorg.json changed
					const folders = this.workspaceContextService.getWorkspace().folders;
					for (const folder of folders) {
						const configUri = folder.uri.with({ path: folder.uri.path + '/.fileorg.json' });
						if (e.contains(configUri)) {
							console.log('[FileOrgContextService] Detected .fileorg.json change, reloading...');
							this.reloadCaseConfig();
							break;
						}
					}
				}
			} catch (err) {
				// Silently ignore file change events we can't process
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
			const parsedConfig = JSON.parse(content.value.toString());

			// Validate the config has the expected structure
			if (!parsedConfig || typeof parsedConfig !== 'object') {
				console.warn('[FileOrgContextService] Invalid config format - not an object');
				this._caseConfig = null;
				this._caseContext = null;
				return;
			}

			// Check for required caseInfo property
			if (!parsedConfig.caseInfo || typeof parsedConfig.caseInfo !== 'object') {
				console.warn('[FileOrgContextService] Config missing caseInfo property');
				this._caseConfig = null;
				this._caseContext = null;
				return;
			}

			// Ensure keywords exist with defaults
			if (!parsedConfig.caseInfo.keywords) {
				parsedConfig.caseInfo.keywords = {
					yourSide: [],
					theirSide: [],
					medical: [],
					legal: [],
					evidence: []
				};
			}

			this._caseConfig = parsedConfig as FileOrgConfig;
			this._caseContext = generateAIContextString(this._caseConfig);

			console.log('[FileOrgContextService] Case config loaded from:', configUri.toString());

			// Fire event to notify listeners of config change
			this._onDidConfigChange.fire(this._caseConfig);
		} catch (error) {
			console.error('[FileOrgContextService] Error loading case config:', error);
			this._caseConfig = null;
			this._caseContext = null;
			this._onDidConfigChange.fire(null);
		}
	}

	async getCaseContext(): Promise<string | null> {
		if (!this._caseContext) {
			await this.reloadCaseConfig();
		}
		return this._caseContext;
	}

	getCaseContextSync(): string | null {
		return this._caseContext;
	}

	getCaseConfig(): FileOrgConfig | null {
		return this._caseConfig;
	}
}

registerSingleton(IFileOrgContextService, FileOrgContextService, InstantiationType.Delayed);


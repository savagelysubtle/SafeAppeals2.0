/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { join } from '../../../../../base/common/path.js';
import { URI } from '../../../../../base/common/uri.js';
import { IEnvironmentService } from '../../../../../platform/environment/common/environment.js';
import { IFileService } from '../../../../../platform/files/common/files.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';

export interface IRAGPathService {
	readonly _serviceBrand: undefined;

	// Per-workspace micro database paths - NO global database allowed
	getWorkspaceChromaDir(workspaceId: string): string;
	getWorkspaceSqlitePath(workspaceId: string): string;
	getEmailSqlitePath(workspaceId: string): string;
	getChatThreadsSqlitePath(workspaceId: string): string;

	// Shared paths (models, logs - not case-specific data)
	getLogsDir(): string;
	getModelCacheDir(): string;
	ensureDirectories(): Promise<void>;
}

export const IRAGPathService = createDecorator<IRAGPathService>('ragPathService');

export class RAGPathService implements IRAGPathService {
	readonly _serviceBrand: undefined;

	constructor(
		@IEnvironmentService private readonly environmentService: IEnvironmentService,
		@IFileService private readonly fileService: IFileService
	) { }

	private getBaseDir(): string {
		return join(this.environmentService.userRoamingDataHome.fsPath, '.safe-appeals-navigator');
	}

	// ========== PER-WORKSPACE MICRO DATABASE PATHS ==========
	// Each workspace gets its own isolated directory with its own databases
	// NO global database is allowed - all data is per-workspace

	getWorkspaceChromaDir(workspaceId: string): string {
		if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null') {
			throw new Error('workspaceId is REQUIRED for getWorkspaceChromaDir - no global database allowed');
		}
		return join(this.getBaseDir(), 'databases', 'workspaces', workspaceId, 'chroma');
	}

	getWorkspaceSqlitePath(workspaceId: string): string {
		if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null') {
			throw new Error('workspaceId is REQUIRED for getWorkspaceSqlitePath - no global database allowed');
		}
		return join(this.getBaseDir(), 'databases', 'workspaces', workspaceId, 'workspace.db');
	}

	getEmailSqlitePath(workspaceId: string): string {
		if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null') {
			throw new Error('workspaceId is REQUIRED for getEmailSqlitePath - no global database allowed');
		}
		return join(this.getBaseDir(), 'databases', 'workspaces', workspaceId, 'emails.db');
	}

	getChatThreadsSqlitePath(workspaceId: string): string {
		if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null') {
			throw new Error('workspaceId is REQUIRED for getChatThreadsSqlitePath - no global database allowed');
		}
		return join(this.getBaseDir(), 'databases', 'workspaces', workspaceId, 'threads.db');
	}

	getLogsDir(): string {
		return join(this.getBaseDir(), 'logs');
	}

	getModelCacheDir(): string {
		return join(this.getBaseDir(), 'models');
	}

	async ensureDirectories(): Promise<void> {
		// Only create base directories - workspace directories are created per-workspace
		// NO global database directories are created - all data is per-workspace micro databases
		const directories = [
			this.getBaseDir(),
			join(this.getBaseDir(), 'databases'),
			join(this.getBaseDir(), 'databases', 'workspaces'), // Parent for all micro databases
			this.getLogsDir(),
			this.getModelCacheDir()
		];

		for (const dir of directories) {
			const uri = URI.file(dir);
			try {
				await this.fileService.createFolder(uri);
			} catch (error) {
				// Directory might already exist, which is fine
				if (!error.message?.includes('already exists')) {
					throw error;
				}
			}
		}
	}
}

registerSingleton(IRAGPathService, RAGPathService, InstantiationType.Delayed);

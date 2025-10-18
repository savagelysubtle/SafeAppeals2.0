/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { IEnvironmentService } from '../../../../platform/environment/common/environment.js';
import { join } from '../../../../base/common/path.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { registerSingleton, InstantiationType } from '../../../../platform/instantiation/common/extensions.js';

export interface IRAGPathService {
	readonly _serviceBrand: undefined;

	getGlobalChromaDir(): string;
	getGlobalSqlitePath(): string;
	getWorkspaceChromaDir(workspaceId: string): string;
	getWorkspaceSqlitePath(workspaceId: string): string;
	getLogsDir(): string;
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
		return join(this.environmentService.userRoamingDataHome.fsPath, '.appealsnavigator');
	}

	getGlobalChromaDir(): string {
		return join(this.getBaseDir(), 'databases', 'chroma');
	}

	getGlobalSqlitePath(): string {
		return join(this.getBaseDir(), 'databases', 'workspace.db');
	}

	getWorkspaceChromaDir(workspaceId: string): string {
		return join(this.getBaseDir(), 'databases', 'workspaces', workspaceId, 'chroma');
	}

	getWorkspaceSqlitePath(workspaceId: string): string {
		return join(this.getBaseDir(), 'databases', 'workspaces', workspaceId, 'workspace.db');
	}

	getLogsDir(): string {
		return join(this.getBaseDir(), 'logs');
	}

	async ensureDirectories(): Promise<void> {
		const directories = [
			this.getBaseDir(),
			join(this.getBaseDir(), 'databases'),
			join(this.getBaseDir(), 'databases', 'chroma'),
			join(this.getBaseDir(), 'databases', 'workspaces'),
			this.getLogsDir()
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

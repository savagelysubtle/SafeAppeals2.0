/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../../base/common/uri.js';
import { IChannel } from '../../../../../base/parts/ipc/common/ipc.js';
import { InstantiationType, registerSingleton } from '../../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../../platform/instantiation/common/instantiation.js';
import { IMainProcessService } from '../../../../../platform/ipc/common/mainProcessService.js';
import { IWorkspaceContextService } from '../../../../../platform/workspace/common/workspace.js';
import { ContextPack, RAGIndexParams, RAGSearchParams, RAGStats } from './ragServiceTypes.js';
import { IVoidSettingsService } from '../voidSettingsService.js';

export interface IRAGService {
	readonly _serviceBrand: undefined;

	indexDocument(params: RAGIndexParams): Promise<{ success: boolean; message: string }>;
	search(params: RAGSearchParams): Promise<ContextPack>;
	getStats(): Promise<RAGStats>;
	deleteDocument(uriOrDocId: URI | string): Promise<void>;
	isDocumentIndexed(uri: URI): Promise<boolean>;
	getDocumentsByType(isPolicyManual: boolean): Promise<any[]>;
	initialize(): Promise<void>;
	switchWorkspace(workspaceId: string): Promise<void>;
	clearAllEmbeddings(): Promise<{ success: boolean; message: string }>;
	testDoclingExtraction(uri: URI): Promise<{ standard: any; docling: any; doclingError?: any }>;

	// Expose workspaceId for other services
	getWorkspaceId(): string;
}

export const IRAGService = createDecorator<IRAGService>('ragService');

export class RAGService implements IRAGService {
	readonly _serviceBrand: undefined;

	private readonly channel: IChannel;
	private readonly workspaceId: string;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService
	) {
		this.channel = this.mainProcessService.getChannel('void-channel-rag');
		this.workspaceId = this.computeWorkspaceId();
	}

	/**
	 * Compute a stable workspace ID from the workspace folder path
	 * Uses a hash to create a unique identifier
	 */
	private computeWorkspaceId(): string {
		const folders = this.workspaceContextService.getWorkspace().folders;
		if (folders.length === 0) {
			return 'default';
		}

		const folderPath = folders[0].uri.fsPath;
		// Create a simple hash from the folder path
		// We use a simple string hash since crypto module isn't available in browser
		let hash = 0;
		for (let i = 0; i < folderPath.length; i++) {
			const char = folderPath.charCodeAt(i);
			hash = ((hash << 5) - hash) + char;
			hash = hash & hash; // Convert to 32bit integer
		}
		// Convert to hex string and take first 16 chars
		const hexHash = Math.abs(hash).toString(16).padStart(8, '0');
		return hexHash.substring(0, 16);
	}

	/**
	 * Get the current workspace ID
	 */
	getWorkspaceId(): string {
		return this.workspaceId;
	}

	async indexDocument(params: RAGIndexParams): Promise<{ success: boolean; message: string }> {
		// Serialize URI to JSON for IPC and ensure workspaceId is included
		return this.channel.call('indexDocument', {
			...params,
			uri: params.uri.toJSON(),
			workspaceId: params.workspaceId || this.workspaceId
		});
	}

	async search(params: RAGSearchParams): Promise<ContextPack> {
		// Ensure workspaceId is included
		return this.channel.call('search', {
			...params,
			workspaceId: params.workspaceId || this.workspaceId
		});
	}

	async getStats(): Promise<RAGStats> {
		return this.channel.call('getStats', { workspaceId: this.workspaceId });
	}

	async deleteDocument(uriOrDocId: URI | string): Promise<void> {
		let docId: string;
		if (typeof uriOrDocId === 'string') {
			docId = uriOrDocId;
		} else {
			// Generate document ID from URI using simple hash
			const path = uriOrDocId.fsPath;
			let hash = 0;
			for (let i = 0; i < path.length; i++) {
				const char = path.charCodeAt(i);
				hash = ((hash << 5) - hash) + char;
				hash = hash & hash;
			}
			docId = Math.abs(hash).toString(16).padStart(16, '0').substring(0, 16);
		}
		return this.channel.call('deleteDocument', { docId, workspaceId: this.workspaceId });
	}

	async isDocumentIndexed(uri: URI): Promise<boolean> {
		return this.channel.call('isDocumentIndexed', {
			uri: uri.toJSON(),
			workspaceId: this.workspaceId
		});
	}

	async getDocumentsByType(isPolicyManual: boolean): Promise<any[]> {
		return this.channel.call('getDocumentsByType', {
			isPolicyManual,
			workspaceId: this.workspaceId
		});
	}

	async initialize(): Promise<void> {
		// Pass OpenAI API key from settings to main process (legacy, now using local embeddings)
		const apiKey = this.settingsService.state.settingsOfProvider.openAI.apiKey || '';
		return this.channel.call('initialize', { openAIApiKey: apiKey });
	}

	async switchWorkspace(workspaceId: string): Promise<void> {
		return this.channel.call('switchWorkspace', { workspaceId });
	}

	async clearAllEmbeddings(): Promise<{ success: boolean; message: string }> {
		return this.channel.call('clearAllEmbeddings', { workspaceId: this.workspaceId });
	}

	async testDoclingExtraction(uri: URI): Promise<{ standard: any; docling: any; doclingError?: any }> {
		return this.channel.call('testDoclingExtraction', { uri: uri.toJSON() });
	}
}

registerSingleton(IRAGService, RAGService, InstantiationType.Eager);

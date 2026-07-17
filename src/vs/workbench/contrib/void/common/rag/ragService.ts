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
	getDocumentsByType(isCoreReference: boolean): Promise<any[]>;
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
	// Cache workspaceId but allow recalculation when workspace changes
	private cachedWorkspaceId: string | null = null;

	constructor(
		@IMainProcessService private readonly mainProcessService: IMainProcessService,
		@IVoidSettingsService private readonly settingsService: IVoidSettingsService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService
	) {
		this.channel = this.mainProcessService.getChannel('void-channel-rag');
		// Listen for workspace folder changes and recalculate workspaceId
		this.workspaceContextService.onDidChangeWorkspaceFolders(() => {
			const oldId = this.cachedWorkspaceId;
			this.cachedWorkspaceId = null; // Force recalculation
			const newId = this.computeWorkspaceId();
			console.log(`[RAGService] Workspace changed: ${oldId} -> ${newId}`);
		});
	}

	/**
	 * Compute a stable workspace ID from the workspace folder path
	 * Uses a hash to create a unique identifier for the micro database
	 *
	 * IMPORTANT: Each workspace MUST have its own micro database.
	 * NO global database is allowed - this prevents cross-case data contamination.
	 */
	private computeWorkspaceId(): string {
		// Return cached value if available
		if (this.cachedWorkspaceId !== null) {
			return this.cachedWorkspaceId;
		}

		const folders = this.workspaceContextService.getWorkspace().folders;
		if (folders.length === 0) {
			// NO DEFAULT FALLBACK - require a workspace folder
			// This prevents data from being written to a shared "default" database
			console.error('[RAGService] ERROR: No workspace folder open. RAG requires a case folder to be open.');
			console.error('[RAGService] Each case must have its own isolated micro database.');
			throw new Error('RAG requires a workspace folder to be open. Please open a case folder first. Each case has its own isolated database to prevent data leakage.');
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
		this.cachedWorkspaceId = hexHash.substring(0, 16);
		console.log(`[RAGService] Computed workspaceId: ${this.cachedWorkspaceId} for case folder: ${folderPath}`);
		console.log(`[RAGService] This case will have its own isolated micro database`);
		return this.cachedWorkspaceId;
	}

	/**
	 * Get the current workspace ID (dynamically computed if workspace changed)
	 */
	getWorkspaceId(): string {
		return this.computeWorkspaceId();
	}

	async indexDocument(params: RAGIndexParams): Promise<{ success: boolean; message: string }> {
		const workspaceId = params.workspaceId || this.getWorkspaceId();
		console.log(`[RAGService] indexDocument with workspaceId: ${workspaceId}`);
		return this.channel.call('indexDocument', {
			...params,
			uri: params.uri.toJSON(),
			workspaceId
		});
	}

	async search(params: RAGSearchParams): Promise<ContextPack> {
		const workspaceId = params.workspaceId || this.getWorkspaceId();
		console.log(`[RAGService] search with workspaceId: ${workspaceId}`);
		return this.channel.call('search', {
			...params,
			workspaceId
		});
	}

	async getStats(): Promise<RAGStats> {
		const workspaceId = this.getWorkspaceId();
		return this.channel.call('getStats', { workspaceId });
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
		const workspaceId = this.getWorkspaceId();
		return this.channel.call('deleteDocument', { docId, workspaceId });
	}

	async isDocumentIndexed(uri: URI): Promise<boolean> {
		const workspaceId = this.getWorkspaceId();
		console.log(`[RAGService] isDocumentIndexed with workspaceId: ${workspaceId}`);
		return this.channel.call('isDocumentIndexed', {
			uri: uri.toJSON(),
			workspaceId
		});
	}

	async getDocumentsByType(isCoreReference: boolean): Promise<any[]> {
		const workspaceId = this.getWorkspaceId();
		return this.channel.call('getDocumentsByType', {
			isCoreReference,
			workspaceId
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
		const workspaceId = this.getWorkspaceId();
		return this.channel.call('clearAllEmbeddings', { workspaceId });
	}

	async testDoclingExtraction(uri: URI): Promise<{ standard: any; docling: any; doclingError?: any }> {
		return this.channel.call('testDoclingExtraction', { uri: uri.toJSON() });
	}
}

registerSingleton(IRAGService, RAGService, InstantiationType.Eager);

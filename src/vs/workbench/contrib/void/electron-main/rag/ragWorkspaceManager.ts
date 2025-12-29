/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILogService } from '../../../../../platform/log/common/log.js';
import { HybridRetriever } from '../../common/rag/ragHybridRetriever.js';
import { IRAGPathService } from '../../common/rag/ragPathService.js';
import { LocalCrossEncoderReranker } from '../../common/rag/ragReranker.js';
import { ChromaPersistentAdapter, PersistentVectorAdapterConfig, VectorAdapter } from '../../common/rag/ragVectorAdapter.js';
import { RAGIndexService } from './ragIndexService.js';

/**
 * Represents a single workspace's RAG instance with all its components
 */
export interface WorkspaceRAGInstance {
	workspaceId: string;
	vectorAdapter: VectorAdapter;
	indexService: RAGIndexService;
	hybridRetriever: HybridRetriever;
	reranker: LocalCrossEncoderReranker;
	initialized: boolean;
}

/**
 * Manages per-workspace RAG instances
 * Each workspace gets its own isolated database and vector store
 */
export class WorkspaceRAGManager {
	private instanceOfWorkspaceId: Map<string, WorkspaceRAGInstance> = new Map();
	private currentWorkspaceId: string | null = null;

	constructor(
		private readonly logService: ILogService,
		private readonly pathService: IRAGPathService
	) { }

	/**
	 * Get or create a workspace-specific RAG instance
	 * @param workspaceId The workspace identifier (hash of workspace path)
	 */
	async getOrCreateWorkspace(workspaceId: string): Promise<WorkspaceRAGInstance> {
		// Return existing instance if available
		const existingInstance = this.instanceOfWorkspaceId.get(workspaceId);
		if (existingInstance?.initialized) {
			return existingInstance;
		}

		this.logService.info(`RAG: Creating new workspace instance for: ${workspaceId}`);

		try {
			// Get workspace-specific paths
			const chromaPath = this.pathService.getWorkspaceChromaDir(workspaceId);
			const sqlitePath = this.pathService.getWorkspaceSqlitePath(workspaceId);

			this.logService.info(`RAG: Workspace paths - Chroma: ${chromaPath}, SQLite: ${sqlitePath}`);

			// Create vector adapter for this workspace
			const config: PersistentVectorAdapterConfig = {
				persistPath: chromaPath,
				useReranking: true
			};

			const vectorAdapter = new ChromaPersistentAdapter(config, this.logService);
			await vectorAdapter.initialize();
			this.logService.info(`RAG: Vector adapter initialized for workspace ${workspaceId}`);

			// Create index service for this workspace with custom SQLite path
			const indexService = new RAGIndexService(this.logService, this.pathService, workspaceId);
			await indexService.initialize();
			this.logService.info(`RAG: Index service initialized for workspace ${workspaceId}`);

			// Create hybrid retriever
			const hybridRetriever = new HybridRetriever(
				vectorAdapter,
				indexService,
				this.logService
			);

			// Create reranker
			const modelCachePath = chromaPath + '/models';
			const reranker = new LocalCrossEncoderReranker(this.logService);
			await reranker.initialize(modelCachePath);
			this.logService.info(`RAG: Reranker initialized for workspace ${workspaceId}`);

			// Ensure collections exist
			await vectorAdapter.ensureCollections('workspace_all');

			const instance: WorkspaceRAGInstance = {
				workspaceId,
				vectorAdapter,
				indexService,
				hybridRetriever,
				reranker,
				initialized: true
			};

			this.instanceOfWorkspaceId.set(workspaceId, instance);
			this.currentWorkspaceId = workspaceId;

			this.logService.info(`RAG: Workspace instance created successfully for ${workspaceId}`);
			return instance;
		} catch (error) {
			this.logService.error(`RAG: Failed to create workspace instance for ${workspaceId}:`, error);
			throw error;
		}
	}

	/**
	 * Get the current active workspace instance
	 * Falls back to global if no workspace is set
	 */
	getCurrentInstance(): WorkspaceRAGInstance | undefined {
		if (this.currentWorkspaceId) {
			return this.instanceOfWorkspaceId.get(this.currentWorkspaceId);
		}
		return undefined;
	}

	/**
	 * Switch to a different workspace
	 */
	async switchWorkspace(workspaceId: string): Promise<WorkspaceRAGInstance> {
		this.logService.info(`RAG: Switching to workspace ${workspaceId}`);
		this.currentWorkspaceId = workspaceId;
		return this.getOrCreateWorkspace(workspaceId);
	}

	/**
	 * Dispose of a specific workspace's resources
	 */
	async disposeWorkspace(workspaceId: string): Promise<void> {
		const instance = this.instanceOfWorkspaceId.get(workspaceId);
		if (!instance) {
			return;
		}

		try {
			// Dispose vector adapter if it has a dispose method
			if ('dispose' in instance.vectorAdapter && typeof instance.vectorAdapter.dispose === 'function') {
				await instance.vectorAdapter.dispose();
			}

			this.instanceOfWorkspaceId.delete(workspaceId);
			this.logService.info(`RAG: Disposed workspace instance for ${workspaceId}`);

			// Clear current workspace if it was the one being disposed
			if (this.currentWorkspaceId === workspaceId) {
				this.currentWorkspaceId = null;
			}
		} catch (error) {
			this.logService.error(`RAG: Error disposing workspace ${workspaceId}:`, error);
		}
	}

	/**
	 * Dispose all workspace instances
	 */
	async disposeAll(): Promise<void> {
		const workspaceIds = Array.from(this.instanceOfWorkspaceId.keys());
		for (const id of workspaceIds) {
			await this.disposeWorkspace(id);
		}
	}

	/**
	 * Check if a workspace has been initialized
	 */
	isWorkspaceInitialized(workspaceId: string): boolean {
		const instance = this.instanceOfWorkspaceId.get(workspaceId);
		return instance?.initialized ?? false;
	}

	/**
	 * Get all initialized workspace IDs
	 */
	getInitializedWorkspaceIds(): string[] {
		return Array.from(this.instanceOfWorkspaceId.keys());
	}
}


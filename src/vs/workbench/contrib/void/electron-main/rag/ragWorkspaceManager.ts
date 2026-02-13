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
 * Represents a single workspace's MICRO DATABASE instance with all its components
 *
 * Each workspace has its own isolated database structure:
 *   - workspace.db (SQLite) - Document metadata, chunks, FTS5 keyword index
 *   - chroma/embeddings.db (SQLite) - Vector embeddings for semantic search
 *   - emails.db (SQLite) - Email metadata and content
 *
 * This architecture ensures complete data isolation between cases.
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
 * ========== MICRO DATABASE MANAGER ==========
 *
 * Manages per-workspace RAG micro database instances.
 * Each workspace gets its own completely isolated database and vector store.
 *
 * NO GLOBAL DATABASE EXISTS - all data is per-workspace.
 * This prevents cross-case data contamination and ensures legal/HIPAA compliance.
 *
 * Database location: %APPDATA%/.safe-appeals-navigator/databases/workspaces/[hash]/
 */
export class WorkspaceRAGManager {
	private instanceOfWorkspaceId: Map<string, WorkspaceRAGInstance> = new Map();
	private currentWorkspaceId: string | null = null;

	constructor(
		private readonly logService: ILogService,
		private readonly pathService: IRAGPathService
	) { }

	/**
	 * Get or create a workspace-specific MICRO DATABASE instance
	 *
	 * Creates isolated databases for this workspace:
	 *   - workspace.db - Document metadata and chunks
	 *   - chroma/embeddings.db - Vector embeddings
	 *
	 * @param workspaceId The workspace identifier (hash of workspace folder path)
	 * @throws Error if workspaceId is missing or invalid
	 */
	async getOrCreateWorkspace(workspaceId: string): Promise<WorkspaceRAGInstance> {
		// Validate workspaceId - NO global database allowed
		if (!workspaceId || workspaceId === 'undefined' || workspaceId === 'null' || workspaceId.trim() === '') {
			throw new Error(`WorkspaceRAGManager: workspaceId is REQUIRED. No global database is allowed.`);
		}

		this.logService.info(`RAG: ========== MICRO DATABASE: ${workspaceId} ==========`);
		console.log(`[RAG MICRO-DB] getOrCreateWorkspace called for: ${workspaceId}`);

		// Return existing instance if available
		const existingInstance = this.instanceOfWorkspaceId.get(workspaceId);
		if (existingInstance?.initialized) {
			this.logService.info(`RAG: Returning existing micro database for: ${workspaceId}`);
			console.log(`[RAG MICRO-DB] Returning EXISTING micro database for: ${workspaceId}`);
			return existingInstance;
		}

		this.logService.info(`RAG: Creating NEW micro database for workspace: ${workspaceId}`);
		console.log(`[RAG MICRO-DB] Creating NEW micro database for: ${workspaceId}`);

		try {
			// Get workspace-specific paths
			const chromaPath = this.pathService.getWorkspaceChromaDir(workspaceId);
			const sqlitePath = this.pathService.getWorkspaceSqlitePath(workspaceId);

			this.logService.info(`RAG: Workspace paths - Chroma: ${chromaPath}, SQLite: ${sqlitePath}`);

			// STEP 1: Create index service FIRST (lightweight, needed for isDocumentIndexed)
			this.logService.info(`RAG: Creating SQLite index service for workspace ${workspaceId}...`);
			const indexService = new RAGIndexService(this.logService, this.pathService, workspaceId);
			await indexService.initialize();
			this.logService.info(`RAG: Index service initialized for workspace ${workspaceId}`);

			// STEP 2: Create vector adapter (loads embedding model - can be slow)
			// Use shared model cache to avoid duplicating ~113 MB of models per workspace
			const sharedModelCachePath = this.pathService.getModelCacheDir();
			this.logService.info(`RAG: Using shared model cache: ${sharedModelCachePath}`);

			this.logService.info(`RAG: Creating vector adapter for workspace ${workspaceId}...`);
			const config: PersistentVectorAdapterConfig = {
				persistPath: chromaPath,
				useReranking: true,
				modelCachePath: sharedModelCachePath,
			};

			const vectorAdapter = new ChromaPersistentAdapter(config, this.logService);
			await vectorAdapter.initialize();
			this.logService.info(`RAG: Vector adapter initialized for workspace ${workspaceId}`);

			// Create hybrid retriever
			const hybridRetriever = new HybridRetriever(
				vectorAdapter,
				indexService,
				this.logService
			);

			// STEP 3: Create reranker with LAZY initialization
			// The reranker is only needed for search, not for basic indexing
			// This makes workspace creation much faster
			const reranker = new LocalCrossEncoderReranker(this.logService);
			reranker.setCachePath(sharedModelCachePath); // Use shared model cache
			this.logService.info(`RAG: Reranker created (will initialize lazily on first search)`);

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


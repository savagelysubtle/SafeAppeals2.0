/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChunkRecord, RAGStorageScope } from './ragServiceTypes.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { LocalEmbeddingService } from './ragLocalEmbeddings.js';

export interface VectorAdapter {
	initialize(): Promise<void>;
	ensureCollections(scope: RAGStorageScope): Promise<void>;
	add(chunks: ChunkRecord[], metadatas: Array<Record<string, any>>): Promise<void>;
	query(text: string, n: number, scope: RAGStorageScope): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>>;
	deleteByDocId(docId: string): Promise<void>;
	clearAll(): Promise<void>;
}

export interface VectorAdapterConfig {
	chromaUrl: string;
}

export interface PersistentVectorAdapterConfig {
	persistPath: string;
}

// Simple in-memory vector store with local embeddings (no external dependencies)
// Uses Transformers.js for free, offline embeddings
export class ChromaPersistentAdapter implements VectorAdapter {
	private embeddingService: LocalEmbeddingService;
	private initialized = false;
	// Store embeddings in memory for search
	private embeddings: Map<string, { vector: number[]; metadata: Record<string, any> }> = new Map();

	constructor(
		private config: PersistentVectorAdapterConfig,
		private logService: ILogService
	) {
		this.embeddingService = new LocalEmbeddingService(logService);
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Initialize local embedding service
			const modelCachePath = this.config.persistPath + '/models';
			await this.embeddingService.initialize(modelCachePath);

			this.initialized = true;
			this.logService.info(`Vector adapter initialized with local embeddings (${this.embeddingService.getModelName()}, ${this.embeddingService.getEmbeddingDimension()}D)`);
		} catch (error) {
			this.logService.error('Failed to initialize vector adapter:', error);
			throw error;
		}
	}

	async ensureCollections(scope: RAGStorageScope): Promise<void> {
		await this.initialize();
		this.logService.info(`Collections ready for scope: ${scope}`);
	}

	async add(chunks: ChunkRecord[], metadatas: Array<Record<string, any>>): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (chunks.length === 0) return;

		try {
			// Extract texts from chunks
			const texts = chunks.map(c => c.text);

			// Generate embeddings using local model
			const embeddings = await this.embeddingService.generateEmbeddings(texts);

			// Store embeddings in memory
			for (let i = 0; i < chunks.length; i++) {
				const chunk = chunks[i];
				const metadata = metadatas[i];
				const embedding = embeddings[i];

				this.embeddings.set(chunk.chunkId, {
					vector: embedding,
					metadata
				});
			}

			this.logService.info(`Added ${chunks.length} chunks to vector store with local embeddings`);
		} catch (error) {
			this.logService.error('Failed to add chunks:', error);
			throw error;
		}
	}

	async query(text: string, n: number, scope: RAGStorageScope): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (this.embeddings.size === 0) {
			this.logService.warn('No embeddings available for search');
			return [];
		}

		try {
			// Generate query embedding using local model
			const queryVector = await this.embeddingService.generateEmbedding(text);

			// Calculate cosine similarity with all stored embeddings
			const results: Array<{ id: string; score: number; metadata: Record<string, any> }> = [];

			for (const [id, data] of this.embeddings.entries()) {
				// Check scope
				const isPolicyManual = data.metadata.isPolicyManual ?? false;
				if (scope === 'policy_manual' && !isPolicyManual) continue;
				if (scope === 'workspace_docs' && isPolicyManual) continue;

				const similarity = this.cosineSimilarity(queryVector, data.vector);
				results.push({
					id,
					score: similarity,
					metadata: data.metadata
				});
			}

			// Sort by score descending and return top n
			return results
				.sort((a, b) => b.score - a.score)
				.slice(0, n);

		} catch (error) {
			this.logService.error('Failed to query:', error);
			return [];
		}
	}

	async deleteByDocId(docId: string): Promise<void> {
		// Remove all embeddings with this docId
		const toDelete: string[] = [];
		for (const [id, data] of this.embeddings.entries()) {
			if (data.metadata.docId === docId) {
				toDelete.push(id);
			}
		}

		for (const id of toDelete) {
			this.embeddings.delete(id);
		}

		this.logService.info(`Deleted ${toDelete.length} embeddings for document ${docId}`);
	}

	async clearAll(): Promise<void> {
		this.embeddings.clear();
		this.logService.info('Cleared all vector embeddings from memory');
	}

	private cosineSimilarity(a: number[], b: number[]): number {
		if (a.length !== b.length) return 0;

		let dotProduct = 0;
		let normA = 0;
		let normB = 0;

		for (let i = 0; i < a.length; i++) {
			dotProduct += a[i] * b[i];
			normA += a[i] * a[i];
			normB += b[i] * b[i];
		}

		const denominator = Math.sqrt(normA) * Math.sqrt(normB);
		return denominator === 0 ? 0 : dotProduct / denominator;
	}
}

// HTTP Chroma adapter (requires external Chroma server)
// Note: This adapter still requires OpenAI for embeddings when using external Chroma server
export class ChromaHttpAdapter implements VectorAdapter {
	private client: any;
	private collections: Map<string, any> = new Map();
	private embeddingService: LocalEmbeddingService;

	constructor(
		private config: VectorAdapterConfig,
		private logService: ILogService
	) {
		this.embeddingService = new LocalEmbeddingService(logService);
	}

	async initialize(): Promise<void> {
		const { ChromaClient } = await import('chromadb');

		this.client = new ChromaClient({
			path: this.config.chromaUrl
		});

		// Initialize local embedding service
		const modelCachePath = '/tmp/transformers-cache'; // Use temp dir for HTTP adapter
		await this.embeddingService.initialize(modelCachePath);

		this.logService.info(`Chroma HTTP client initialized at ${this.config.chromaUrl} with local embeddings`);
	}

	async ensureCollections(scope: RAGStorageScope): Promise<void> {
		if (!this.client) {
			await this.initialize();
		}

		const collections = [];
		if (scope === 'policy_manual' || scope === 'both') {
			collections.push('policy_manual');
		}
		if (scope === 'workspace_docs' || scope === 'both') {
			collections.push('workspace_docs');
		}

		for (const collectionName of collections) {
			try {
				const collection = await this.client.getOrCreateCollection({
					name: collectionName
				});
				this.collections.set(collectionName, collection);
			} catch (error) {
				this.logService.error(`Failed to create collection ${collectionName}:`, error);
				throw error;
			}
		}
	}

	async add(chunks: ChunkRecord[], metadatas: Array<Record<string, any>>): Promise<void> {
		if (!this.client) {
			await this.initialize();
		}

		if (chunks.length === 0) return;

		const isPolicyManual = metadatas[0]?.isPolicyManual ?? false;
		const collectionName = isPolicyManual ? 'policy_manual' : 'workspace_docs';
		const collection = this.collections.get(collectionName);

		if (!collection) {
			throw new Error(`Collection ${collectionName} not initialized`);
		}

		// Generate embeddings using local model
		const texts = chunks.map(c => c.text);
		const embeddings = await this.embeddingService.generateEmbeddings(texts);

		await collection.add({
			ids: chunks.map(c => c.chunkId),
			documents: chunks.map(c => c.text),
			embeddings,
			metadatas
		});
	}

	async query(text: string, n: number, scope: RAGStorageScope): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
		if (!this.client) {
			await this.initialize();
		}

		const collectionNames: string[] = [];
		if (scope === 'policy_manual' || scope === 'both') {
			collectionNames.push('policy_manual');
		}
		if (scope === 'workspace_docs' || scope === 'both') {
			collectionNames.push('workspace_docs');
		}

		// Generate query embedding using local model
		const queryEmbedding = await this.embeddingService.generateEmbedding(text);

		const allResults: Array<{ id: string; score: number; metadata: Record<string, any> }> = [];

		for (const name of collectionNames) {
			const collection = this.collections.get(name);
			if (!collection) continue;

			try {
				const results = await collection.query({
					queryEmbeddings: [queryEmbedding],
					nResults: n
				});

				if (results.ids && results.ids[0]) {
					for (let i = 0; i < results.ids[0].length; i++) {
						allResults.push({
							id: results.ids[0][i],
							score: 1 - (results.distances?.[0]?.[i] ?? 1),
							metadata: results.metadatas?.[0]?.[i] ?? {}
						});
					}
				}
			} catch (error) {
				this.logService.warn(`Query failed for collection ${name}:`, error);
			}
		}

		// Sort by score descending and limit to n
		return allResults
			.sort((a, b) => b.score - a.score)
			.slice(0, n);
	}

	async deleteByDocId(docId: string): Promise<void> {
		if (!this.client) {
			await this.initialize();
		}

		const collections = ['policy_manual', 'workspace_docs'];

		for (const collectionName of collections) {
			try {
				const collection = await this.client.getCollection({
					name: collectionName
				});

				await collection.delete({
					where: { docId }
				});
			} catch (error) {
				console.warn(`Failed to delete from collection ${collectionName}:`, error);
			}
		}
	}

	async clearAll(): Promise<void> {
		if (!this.client) {
			await this.initialize();
		}

		const collections = ['policy_manual', 'workspace_docs'];

		for (const collectionName of collections) {
			try {
				// Delete the entire collection and recreate
				await this.client.deleteCollection({ name: collectionName });
				await this.client.createCollection({
					name: collectionName
				});
			} catch (error) {
				console.warn(`Failed to clear collection ${collectionName}:`, error);
			}
		}
	}
}

// Stub for future SQLite-vec implementation
export class SQLiteVecAdapter implements VectorAdapter {
	async initialize(): Promise<void> {
		throw new Error('SQLite-vec adapter not implemented yet');
	}

	async ensureCollections(scope: RAGStorageScope): Promise<void> {
		throw new Error('SQLite-vec adapter not implemented yet');
	}

	async add(chunks: ChunkRecord[], metadatas: Array<Record<string, any>>): Promise<void> {
		throw new Error('SQLite-vec adapter not implemented yet');
	}

	async query(text: string, n: number, scope: RAGStorageScope): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
		throw new Error('SQLite-vec adapter not implemented yet');
	}

	async deleteByDocId(docId: string): Promise<void> {
		throw new Error('SQLite-vec adapter not implemented yet');
	}

	async clearAll(): Promise<void> {
		throw new Error('SQLite-vec adapter not implemented yet');
	}
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChunkRecord, RAGStorageScope } from './ragServiceTypes.js';
import { ILogService } from '../../../../platform/log/common/log.js';

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
	openAIApiKey: string;
	openAIModel: string;
}

export interface PersistentVectorAdapterConfig {
	persistPath: string;
	openAIApiKey: string;
	openAIModel: string;
}

// Simple in-memory vector store (no external dependencies)
// Embeddings are generated but stored in SQLite via the index service
export class ChromaPersistentAdapter implements VectorAdapter {
	private openai: any;
	private initialized = false;
	// Store embeddings in memory for search
	private embeddings: Map<string, { vector: number[]; metadata: Record<string, any> }> = new Map();

	// Rate limiting
	private lastEmbeddingCallTime: number = 0;
	private readonly EMBEDDING_DELAY_MS: number = 100; // 10 requests/second max
	private readonly MAX_RETRIES: number = 3;
	private readonly RETRY_DELAY_MS: number = 1000; // 1 second base delay for retries

	constructor(
		private config: PersistentVectorAdapterConfig,
		private logService: ILogService
	) { }

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Check if OpenAI API key is available
			if (!this.config.openAIApiKey) {
				this.logService.warn('No OpenAI API key provided - RAG search will use keyword matching only');
				this.initialized = true;
				return;
			}

			// Dynamic import of OpenAI
			const openaiModule = await import('openai');
			this.openai = new openaiModule.default({
				apiKey: this.config.openAIApiKey
			});

			this.initialized = true;
			this.logService.info(`Vector adapter initialized (in-memory, no external server required)`);
		} catch (error) {
			this.logService.error('Failed to initialize vector adapter:', error);
			// Don't throw - fall back to keyword search
			this.initialized = true;
		}
	}

	async ensureCollections(scope: RAGStorageScope): Promise<void> {
		await this.initialize();
		this.logService.info(`Collections ready for scope: ${scope}`);
	}

	/**
	 * Rate-limited embedding generation with retry logic
	 */
	private async generateEmbeddingWithRateLimit(text: string, retryCount: number = 0): Promise<number[] | null> {
		// Enforce rate limit
		const now = Date.now();
		const timeSinceLastCall = now - this.lastEmbeddingCallTime;
		if (timeSinceLastCall < this.EMBEDDING_DELAY_MS) {
			const delay = this.EMBEDDING_DELAY_MS - timeSinceLastCall;
			await new Promise(resolve => setTimeout(resolve, delay));
		}

		this.lastEmbeddingCallTime = Date.now();

		try {
			const response = await this.openai.embeddings.create({
				model: this.config.openAIModel,
				input: text
			});
			return response.data[0].embedding;
		} catch (error: any) {
			// Handle rate limit errors with exponential backoff
			if (error?.status === 429 && retryCount < this.MAX_RETRIES) {
				const backoffDelay = this.RETRY_DELAY_MS * Math.pow(2, retryCount);
				this.logService.warn(`Rate limit hit, retrying in ${backoffDelay}ms (attempt ${retryCount + 1}/${this.MAX_RETRIES})...`);
				await new Promise(resolve => setTimeout(resolve, backoffDelay));
				return this.generateEmbeddingWithRateLimit(text, retryCount + 1);
			}

			// Log and re-throw other errors
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logService.error(`Failed to generate embedding: ${errorMsg}`);
			return null;
		}
	}

	async add(chunks: ChunkRecord[], metadatas: Array<Record<string, any>>): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (chunks.length === 0 || !this.openai) return;

		try {
			// Generate embeddings for all chunks with rate limiting
			let successCount = 0;
			let failCount = 0;

			for (let i = 0; i < chunks.length; i++) {
				const chunk = chunks[i];
				const metadata = metadatas[i];

				const embedding = await this.generateEmbeddingWithRateLimit(chunk.text);

				if (embedding) {
					this.embeddings.set(chunk.chunkId, {
						vector: embedding,
						metadata
					});
					successCount++;
				} else {
					failCount++;
				}
			}

			this.logService.info(`Added ${successCount} chunks to vector store${failCount > 0 ? ` (${failCount} failed)` : ''}`);
		} catch (error) {
			this.logService.error('Failed to add chunks:', error);
		}
	}

	async query(text: string, n: number, scope: RAGStorageScope): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (!this.openai || this.embeddings.size === 0) {
			this.logService.warn('No embeddings available for search');
			return [];
		}

		try {
			// Generate query embedding with rate limiting
			const queryVector = await this.generateEmbeddingWithRateLimit(text);

			if (!queryVector) {
				this.logService.error('Failed to generate query embedding');
				return [];
			}

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
export class ChromaHttpAdapter implements VectorAdapter {
	private client: any;
	private embeddingFunction: any;
	private collections: Map<string, any> = new Map();

	constructor(
		private config: VectorAdapterConfig,
		private logService: ILogService
	) { }

	async initialize(): Promise<void> {
		const { ChromaClient } = await import('chromadb');
		const { OpenAIEmbeddingFunction } = await import('chromadb');

		this.client = new ChromaClient({
			path: this.config.chromaUrl
		});

		this.embeddingFunction = new OpenAIEmbeddingFunction({
			openai_api_key: this.config.openAIApiKey,
			openai_model: this.config.openAIModel
		});

		this.logService.info(`Chroma HTTP client initialized at ${this.config.chromaUrl}`);
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
					name: collectionName,
					embeddingFunction: this.embeddingFunction
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

		await collection.add({
			ids: chunks.map(c => c.chunkId),
			documents: chunks.map(c => c.text),
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

		const allResults: Array<{ id: string; score: number; metadata: Record<string, any> }> = [];

		for (const name of collectionNames) {
			const collection = this.collections.get(name);
			if (!collection) continue;

			try {
				const results = await collection.query({
					queryTexts: [text],
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
					name: collectionName,
					embeddingFunction: this.embeddingFunction
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
					name: collectionName,
					embeddingFunction: this.embeddingFunction
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

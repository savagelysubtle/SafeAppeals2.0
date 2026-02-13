/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// eslint-disable @typescript-eslint/no-explicit-any

import { createRequire } from 'module';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { LocalEmbeddingService } from './ragLocalEmbeddings.js';
import { LocalCrossEncoderReranker } from './ragReranker.js';
import { ChunkRecord, RAGStorageScope } from './ragServiceTypes.js';

// Helper function for backwards compatibility with scope names
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isCoreReferenceScope(scope: RAGStorageScope): boolean {
	return scope === 'core_references' || (scope as any) === 'policy_manual';
}

export interface VectorAdapter {
	initialize(): Promise<void>;
	ensureCollections(scope: RAGStorageScope): Promise<void>;
	add(chunks: ChunkRecord[], metadatas: Array<Record<string, any>>): Promise<void>;
	query(text: string, n: number, scope: RAGStorageScope): Promise<Array<{ id: string; score: number; metadata: Record<string, any> }>>;
	deleteByDocId(docId: string): Promise<void>;
	clearAll(): Promise<void>;
	/**
	 * Check if embeddings exist for a document
	 * Used to verify indexing integrity (SQLite + embeddings both present)
	 * @param docId The document ID to check
	 * @returns Object with hasEmbeddings flag and count of embeddings found
	 */
	hasDocumentEmbeddings(docId: string): Promise<{ hasEmbeddings: boolean; count: number }>;
}

export interface VectorAdapterConfig {
	chromaUrl: string;
}

export interface PersistentVectorAdapterConfig {
	persistPath: string;
	useReranking?: boolean; // Default: true
	modelCachePath?: string; // Shared model cache directory (avoids per-workspace duplication)
}

// Persistent vector store with local embeddings stored on disk
// Uses Transformers.js for free, offline embeddings
// Stores embeddings in SQLite for persistence across restarts
export class ChromaPersistentAdapter implements VectorAdapter {
	private embeddingService: LocalEmbeddingService;
	private reranker: LocalCrossEncoderReranker;
	private useReranking: boolean;
	private initialized = false;
	// In-memory cache for fast search (loaded from disk on init)
	private embeddings: Map<string, { vector: number[]; metadata: Record<string, any> }> = new Map();
	private embeddingsDbPath: string;

	constructor(
		private config: PersistentVectorAdapterConfig,
		private logService: ILogService
	) {
		this.embeddingService = new LocalEmbeddingService(logService);
		this.reranker = new LocalCrossEncoderReranker(logService);
		this.useReranking = config.useReranking ?? true;
		this.embeddingsDbPath = config.persistPath + '/embeddings.db';
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			// Ensure persist path exists
			const fs = await import('fs');
			if (!fs.existsSync(this.config.persistPath)) {
				fs.mkdirSync(this.config.persistPath, { recursive: true });
			}

			// Initialize local embedding service using shared model cache
			// This avoids duplicating ~113 MB of models per workspace
			const modelCachePath = this.config.modelCachePath || this.config.persistPath + '/models';
			await this.embeddingService.initialize(modelCachePath);

			// Initialize reranker if enabled
			if (this.useReranking) {
				this.logService.info('Initializing cross-encoder reranker...');
				await this.reranker.initialize(modelCachePath);
				this.logService.info('Reranker initialized successfully');
			}

			// Load embeddings from disk into memory
			await this.loadEmbeddingsFromDisk();

			this.initialized = true;
			this.logService.info(`Vector adapter initialized with local embeddings (${this.embeddingService.getModelName()}, ${this.embeddingService.getEmbeddingDimension()}D)`);
			this.logService.info(`Loaded ${this.embeddings.size} embeddings from persistent storage`);
			this.logService.info(`Reranking: ${this.useReranking ? 'enabled' : 'disabled'}`);
		} catch (error) {
			this.logService.error('Failed to initialize vector adapter:', error);
			throw error;
		}
	}

	async ensureCollections(scope: RAGStorageScope): Promise<void> {
		await this.initialize();
		this.logService.info(`Collections ready for scope: ${scope}`);
	}

	// Load embeddings from SQLite into memory on startup
	private async loadEmbeddingsFromDisk(): Promise<void> {
		try {
			const fs = await import('fs');
			if (!fs.existsSync(this.embeddingsDbPath)) {
				this.logService.info('No existing embeddings database found - starting fresh');
				return;
			}

			const require = createRequire(import.meta.url);
			const sqlite3 = require('@vscode/sqlite3');
			const db = new sqlite3.Database(this.embeddingsDbPath);

			return new Promise((resolve, reject) => {
				// Create table if it doesn't exist
				db.run(`
					CREATE TABLE IF NOT EXISTS embeddings (
						id TEXT PRIMARY KEY,
						vector TEXT NOT NULL,
						metadata TEXT NOT NULL
					)
			`, (err: Error | null) => {
					if (err) {
						reject(err);
						return;
					}

					// Load all embeddings into memory
					db.all('SELECT id, vector, metadata FROM embeddings', (err: Error | null, rows: any[]) => {
						if (err) {
							reject(err);
							return;
						}

						for (const row of rows) {
							try {
								const vector = JSON.parse(row.vector);
								const metadata = JSON.parse(row.metadata);
								this.embeddings.set(row.id, { vector, metadata });
							} catch (parseErr) {
								this.logService.error(`Failed to parse embedding ${row.id}:`, parseErr);
							}
						}

						db.close();
						resolve();
					});
				});
			});
		} catch (error) {
			this.logService.error('Failed to load embeddings from disk:', error);
			// Continue anyway - we'll start fresh
		}
	}

	// Save a single embedding to disk
	private async saveEmbeddingToDisk(id: string, vector: number[], metadata: Record<string, any>): Promise<void> {
		try {
			const require = createRequire(import.meta.url);
			const sqlite3 = require('@vscode/sqlite3');
			const db = new sqlite3.Database(this.embeddingsDbPath);

			return new Promise((resolve, reject) => {
				// Ensure table exists before inserting
				db.run(`
				CREATE TABLE IF NOT EXISTS embeddings (
					id TEXT PRIMARY KEY,
					vector TEXT NOT NULL,
					metadata TEXT NOT NULL
				)
			`, (err: Error | null) => {
					if (err) {
						db.close();
						reject(err);
						return;
					}

					const vectorJson = JSON.stringify(vector);
					const metadataJson = JSON.stringify(metadata);

					db.run(
						'INSERT OR REPLACE INTO embeddings (id, vector, metadata) VALUES (?, ?, ?)',
						[id, vectorJson, metadataJson],
						(err: Error | null) => {
							db.close();
							if (err) {
								reject(err);
							} else {
								resolve();
							}
						}
					);
				});
			});
		} catch (error) {
			this.logService.error(`Failed to save embedding ${id} to disk:`, error);
			throw error;
		}
	}

	// Delete an embedding from disk
	private async deleteEmbeddingFromDisk(id: string): Promise<void> {
		try {
			const require = createRequire(import.meta.url);
			const sqlite3 = require('@vscode/sqlite3');
			const db = new sqlite3.Database(this.embeddingsDbPath);

			return new Promise((resolve, reject) => {
				db.run('DELETE FROM embeddings WHERE id = ?', [id], (err: Error | null) => {
					db.close();
					if (err) {
						reject(err);
					} else {
						resolve();
					}
				});
			});
		} catch (error) {
			this.logService.error(`Failed to delete embedding ${id} from disk:`, error);
			throw error;
		}
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

			// Store embeddings in memory AND on disk
			for (let i = 0; i < chunks.length; i++) {
				const chunk = chunks[i];
				const metadata = metadatas[i];
				const embedding = embeddings[i];

				// Store in memory
				this.embeddings.set(chunk.chunkId, {
					vector: embedding,
					metadata
				});

				// Persist to disk
				await this.saveEmbeddingToDisk(chunk.chunkId, embedding, metadata);
			}

			this.logService.info(`Added ${chunks.length} chunks to vector store (memory + disk) with local embeddings`);
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
			// IMPROVEMENT 1: Preprocess query to handle terminology variations
			const preprocessedQuery = this.preprocessQuery(text);
			this.logService.info(`Original query: "${text}"`);
			this.logService.info(`Preprocessed query: "${preprocessedQuery}"`);

			// Generate query embedding using local model
			const queryVector = await this.embeddingService.generateEmbedding(preprocessedQuery);

			// Calculate cosine similarity with all stored embeddings
			const results: Array<{ id: string; score: number; metadata: Record<string, any> }> = [];

			// IMPROVEMENT 2: Lower threshold for better recall (can filter later with reranking)
			// Research shows 0.05-0.10 works better for local embeddings
			const MIN_SIMILARITY_THRESHOLD = 0.07; // Lowered from 0.15 to catch more relevant results

			this.logService.info(`Searching ${this.embeddings.size} embeddings with threshold ${MIN_SIMILARITY_THRESHOLD}...`);

			// Debug: Count embeddings by scope
			let coreReferenceCount = 0;
			let workspaceDocsCount = 0;
			for (const [, data] of this.embeddings.entries()) {
				const isCoreReference = data.metadata.isCoreReference ?? false;
				if (isCoreReference) coreReferenceCount++;
				else workspaceDocsCount++;
			}
			this.logService.info(`Embeddings breakdown: ${coreReferenceCount} core_references, ${workspaceDocsCount} case_index`);
			this.logService.info(`Search scope: ${scope}`);

			let scopeMatchCount = 0;
			for (const [id, data] of this.embeddings.entries()) {
				// Check scope - handle both old and new scope names for backwards compatibility
				const isCoreReference = data.metadata.isCoreReference ?? false;
				const isSearchingCoreReferences = isCoreReferenceScope(scope);
				if (isSearchingCoreReferences && !isCoreReference) continue;
				if ((scope === 'case_index' || scope === 'workspace_docs') && isCoreReference) continue;
				// 'workspace_all' and 'both' include everything

				scopeMatchCount++;
				const similarity = this.cosineSimilarity(queryVector, data.vector);

				// Only include results above threshold
				if (similarity >= MIN_SIMILARITY_THRESHOLD) {
					results.push({
						id,
						score: similarity,
						metadata: data.metadata
					});
				}
			}

			this.logService.info(`Scope matched ${scopeMatchCount} embeddings, ${results.length} above threshold`);

			// IMPROVEMENT 3: Retrieve more results initially for better diversity
			// Best practice: retrieve 2-3x the desired results, then apply MMR
			const initialK = Math.min(n * 3, results.length);

			// Sort by score descending
			const topKResults = results
				.sort((a, b) => b.score - a.score)
				.slice(0, initialK);

			// IMPROVEMENT 4: Apply MMR (Maximal Marginal Relevance) for diversity
			const diverseResults = this.applyMMR(topKResults, queryVector, n);

			this.logService.info(`Applied MMR to ${topKResults.length} results, returning top ${diverseResults.length}`);

			return diverseResults;

		} catch (error) {
			this.logService.error('Failed to query:', error);
			return [];
		}
	}

	/**
	 * Preprocess query to improve retrieval quality
	 * Handles medical/legal terminology and expands query
	 */
	private preprocessQuery(query: string): string {
		let processed = query.toLowerCase().trim();

		// Common medical terminology expansions for workers' compensation
		const expansions: Record<string, string> = {
			'pre-existing': 'pre-existing preexisting prior existing previous',
			'preexisting': 'pre-existing preexisting prior existing previous',
			'prior condition': 'pre-existing preexisting prior condition previous condition',
			'aggravation': 'aggravation exacerbation worsening',
			'disability': 'disability impairment limitation restriction',
			'permanent': 'permanent lasting long-term chronic',
			'injury': 'injury harm damage trauma',
		};

		// Expand terminology
		for (const [term, expansion] of Object.entries(expansions)) {
			if (processed.includes(term)) {
				processed = processed + ' ' + expansion;
				break; // Only expand the first matching term to avoid query bloat
			}
		}

		return processed;
	}

	/**
	 * Apply Maximal Marginal Relevance (MMR) for diversity
	 * Balances relevance and diversity in results
	 * Formula: MMR = λ * sim(query, doc) - (1-λ) * max sim(doc, selected)
	 */
	private applyMMR(
		candidates: Array<{ id: string; score: number; metadata: Record<string, any> }>,
		queryVector: number[],
		n: number
	): Array<{ id: string; score: number; metadata: Record<string, any> }> {
		if (candidates.length <= n) {
			return candidates;
		}

		const selected: Array<{ id: string; score: number; metadata: Record<string, any> }> = [];
		const remaining = [...candidates];
		const lambda = 0.7; // Balance between relevance (high λ) and diversity (low λ)

		// Always select the highest scoring document first
		selected.push(remaining.shift()!);

		// Iteratively select documents that maximize MMR score
		while (selected.length < n && remaining.length > 0) {
			let bestIndex = -1;
			let bestScore = -Infinity;

			for (let i = 0; i < remaining.length; i++) {
				const candidate = remaining[i];
				const candidateVector = this.embeddings.get(candidate.id)?.vector;

				if (!candidateVector) continue;

				// Calculate relevance score (already have this)
				const relevanceScore = candidate.score;

				// Calculate max similarity to already selected documents
				let maxSimToSelected = 0;
				for (const selectedDoc of selected) {
					const selectedVector = this.embeddings.get(selectedDoc.id)?.vector;
					if (selectedVector) {
						const sim = this.cosineSimilarity(candidateVector, selectedVector);
						maxSimToSelected = Math.max(maxSimToSelected, sim);
					}
				}

				// Calculate MMR score
				const mmrScore = lambda * relevanceScore - (1 - lambda) * maxSimToSelected;

				if (mmrScore > bestScore) {
					bestScore = mmrScore;
					bestIndex = i;
				}
			}

			if (bestIndex >= 0) {
				selected.push(remaining.splice(bestIndex, 1)[0]);
			} else {
				break;
			}
		}

		return selected;
	}

	async deleteByDocId(docId: string): Promise<void> {
		// Remove all embeddings with this docId
		const toDelete: string[] = [];
		for (const [id, data] of this.embeddings.entries()) {
			if (data.metadata.docId === docId) {
				toDelete.push(id);
			}
		}

		// Delete from memory and disk
		for (const id of toDelete) {
			this.embeddings.delete(id);
			await this.deleteEmbeddingFromDisk(id);
		}

		this.logService.info(`Deleted ${toDelete.length} embeddings for document ${docId}`);
	}

	/**
	 * Check if embeddings exist for a document
	 * Verifies that vector embeddings are present for the given document ID
	 * This is used to detect indexing integrity issues (SQLite has doc but embeddings missing)
	 */
	async hasDocumentEmbeddings(docId: string): Promise<{ hasEmbeddings: boolean; count: number }> {
		if (!this.initialized) {
			await this.initialize();
		}

		let count = 0;
		for (const [, data] of this.embeddings.entries()) {
			if (data.metadata.docId === docId) {
				count++;
			}
		}

		const hasEmbeddings = count > 0;
		this.logService.debug(`hasDocumentEmbeddings(${docId}): ${hasEmbeddings} (${count} embeddings)`);

		return { hasEmbeddings, count };
	}

	async clearAll(): Promise<void> {
		this.embeddings.clear();

		// Clear disk storage
		try {
			const fs = await import('fs');
			if (fs.existsSync(this.embeddingsDbPath)) {
				fs.unlinkSync(this.embeddingsDbPath);
				this.logService.info('Deleted embeddings database file');
			}
		} catch (error) {
			this.logService.error('Failed to delete embeddings database:', error);
		}

		this.logService.info('Cleared all vector embeddings from memory and disk');
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

		// Initialize local embedding service using shared model cache
		const os = await import('os');
		const pathModule = await import('path');
		const modelCachePath = pathModule.join(os.homedir(), '.safe-appeals-navigator', 'models');
		await this.embeddingService.initialize(modelCachePath);

		this.logService.info(`Chroma HTTP client initialized at ${this.config.chromaUrl} with local embeddings`);
	}

	async ensureCollections(scope: RAGStorageScope): Promise<void> {
		if (!this.client) {
			await this.initialize();
		}

		const collections = [];
		// Handle both old and new scope names for backwards compatibility
		if (isCoreReferenceScope(scope) || scope === 'workspace_all' || scope === 'both') {
			collections.push('core_references');
		}
		if (scope === 'case_index' || scope === 'workspace_docs' || scope === 'workspace_all' || scope === 'both') {
			collections.push('case_index');
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

		const isCoreReference = metadatas[0]?.isCoreReference ?? false;
		const collectionName = isCoreReference ? 'core_references' : 'case_index';
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
		// Handle both old and new scope names for backwards compatibility
		if (isCoreReferenceScope(scope) || scope === 'workspace_all' || scope === 'both') {
			collectionNames.push('core_references');
		}
		if (scope === 'case_index' || scope === 'workspace_docs' || scope === 'workspace_all' || scope === 'both') {
			collectionNames.push('case_index');
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

		const collections = ['core_references', 'case_index'];

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

		const collections = ['core_references', 'case_index'];

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

	/**
	 * Check if embeddings exist for a document in HTTP Chroma server
	 */
	async hasDocumentEmbeddings(docId: string): Promise<{ hasEmbeddings: boolean; count: number }> {
		if (!this.client) {
			await this.initialize();
		}

		let totalCount = 0;
		const collections = ['core_references', 'case_index'];

		for (const collectionName of collections) {
			try {
				const collection = this.collections.get(collectionName);
				if (!collection) continue;

				const results = await collection.get({
					where: { docId }
				});

				if (results.ids) {
					totalCount += results.ids.length;
				}
			} catch (error) {
				console.warn(`Failed to check embeddings in ${collectionName}:`, error);
			}
		}

		return { hasEmbeddings: totalCount > 0, count: totalCount };
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

	async hasDocumentEmbeddings(docId: string): Promise<{ hasEmbeddings: boolean; count: number }> {
		throw new Error('SQLite-vec adapter not implemented yet');
	}
}

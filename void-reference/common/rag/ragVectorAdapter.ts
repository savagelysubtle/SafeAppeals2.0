/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// eslint-disable @typescript-eslint/no-explicit-any

import { createRequire } from 'module';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { LocalEmbeddingService } from './ragLocalEmbeddings.js';
import { ChunkRecord, RAGStorageScope } from './ragServiceTypes.js';

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
	modelCachePath?: string;
}

export class ChromaPersistentAdapter implements VectorAdapter {
	private embeddingService: LocalEmbeddingService;
	private initialized = false;
	private embeddings: Map<string, { vector: Float32Array; metadata: Record<string, any> }> = new Map();
	// O(1) document embedding count lookup (updated on add/delete)
	private countOfDocId: Map<string, number> = new Map();
	private embeddingsDbPath: string;
	// Persistent SQLite connection -- opened once in initialize(), reused for all operations
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private db: any = null;

	constructor(
		private config: PersistentVectorAdapterConfig,
		private logService: ILogService
	) {
		this.embeddingService = new LocalEmbeddingService(logService);
		this.embeddingsDbPath = config.persistPath + '/embeddings.db';
	}

	async initialize(): Promise<void> {
		if (this.initialized) return;

		try {
			const fs = await import('fs');
			if (!fs.existsSync(this.config.persistPath)) {
				fs.mkdirSync(this.config.persistPath, { recursive: true });
			}

			const modelCachePath = this.config.modelCachePath || this.config.persistPath + '/models';
			await this.embeddingService.initialize(modelCachePath);

			// Open persistent SQLite connection once
			const require = createRequire(import.meta.url);
			const sqlite3 = require('@vscode/sqlite3');
			this.db = new sqlite3.Database(this.embeddingsDbPath);

			// Create table once during init
			await this.runSql(`
				CREATE TABLE IF NOT EXISTS embeddings (
					id TEXT PRIMARY KEY,
					vector BLOB NOT NULL,
					metadata TEXT NOT NULL
				)
			`);

			await this.loadEmbeddingsFromDisk();

			this.initialized = true;
			this.logService.info(`Vector adapter initialized with local embeddings (${this.embeddingService.getModelName()}, ${this.embeddingService.getEmbeddingDimension()}D)`);
			this.logService.info(`Loaded ${this.embeddings.size} embeddings from persistent storage`);
		} catch (error) {
			this.logService.error('Failed to initialize vector adapter:', error);
			throw error;
		}
	}

	private runSql(sql: string): Promise<void> {
		return new Promise((resolve, reject) => {
			this.db.run(sql, (err: Error | null) => {
				if (err) reject(err);
				else resolve();
			});
		});
	}

	async ensureCollections(scope: RAGStorageScope): Promise<void> {
		await this.initialize();
		this.logService.info(`Collections ready for scope: ${scope}`);
	}

	// Load embeddings from persistent DB into memory with backwards-compatible migration (JSON -> binary BLOB)
	private async loadEmbeddingsFromDisk(): Promise<void> {
		try {
			if (!this.db) return;

			const rows = await new Promise<any[]>((resolve, reject) => {
				this.db.all('SELECT id, vector, metadata FROM embeddings', (err: Error | null, rows: any[]) => {
					if (err) reject(err);
					else resolve(rows || []);
				});
			});

			for (const row of rows) {
				try {
					// Backwards-compatible vector loading: JSON text (old) or binary BLOB (new)
					let vector: Float32Array;
					if (typeof row.vector === 'string') {
						vector = new Float32Array(JSON.parse(row.vector));
					} else if (Buffer.isBuffer(row.vector)) {
						vector = new Float32Array(
							row.vector.buffer,
							row.vector.byteOffset,
							row.vector.byteLength / 4
						);
					} else {
						this.logService.error(`Unknown vector format for embedding ${row.id}`);
						continue;
					}
					const metadata = JSON.parse(row.metadata);
					this.embeddings.set(row.id, { vector, metadata });

					// Build countOfDocId index
					const docId = metadata.docId;
					if (docId) {
						this.countOfDocId.set(docId, (this.countOfDocId.get(docId) ?? 0) + 1);
					}
				} catch (parseErr) {
					this.logService.error(`Failed to parse embedding ${row.id}:`, parseErr);
				}
			}
		} catch (error) {
			this.logService.error('Failed to load embeddings from disk:', error);
		}
	}

	// Batch save embeddings to persistent DB in a single transaction
	private async saveBatchToDisk(items: Array<{ id: string; vector: Float32Array; metadata: Record<string, any> }>): Promise<void> {
		if (!this.db || items.length === 0) return;

		await this.runSql('BEGIN TRANSACTION');
		try {
			const stmt = this.db.prepare('INSERT OR REPLACE INTO embeddings (id, vector, metadata) VALUES (?, ?, ?)');
			for (const item of items) {
				const vectorBlob = Buffer.from(item.vector.buffer, item.vector.byteOffset, item.vector.byteLength);
				const metadataJson = JSON.stringify(item.metadata);
				await new Promise<void>((resolve, reject) => {
					stmt.run([item.id, vectorBlob, metadataJson], (err: Error | null) => {
						if (err) reject(err);
						else resolve();
					});
				});
			}
			await new Promise<void>((resolve, reject) => {
				stmt.finalize((err: Error | null) => {
					if (err) reject(err);
					else resolve();
				});
			});
			await this.runSql('COMMIT');
		} catch (error) {
			await this.runSql('ROLLBACK').catch(() => {});
			throw error;
		}
	}

	// Delete embeddings from persistent DB using the persistent connection
	private async deleteFromDisk(ids: string[]): Promise<void> {
		if (!this.db || ids.length === 0) return;

		await this.runSql('BEGIN TRANSACTION');
		try {
			for (const id of ids) {
				await new Promise<void>((resolve, reject) => {
					this.db.run('DELETE FROM embeddings WHERE id = ?', [id], (err: Error | null) => {
						if (err) reject(err);
						else resolve();
					});
				});
			}
			await this.runSql('COMMIT');
		} catch (error) {
			await this.runSql('ROLLBACK').catch(() => {});
			throw error;
		}
	}

	async add(chunks: ChunkRecord[], metadatas: Array<Record<string, any>>): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		if (chunks.length === 0) return;

		try {
			const texts = chunks.map(c => c.text);
			const embeddings = await this.embeddingService.generateEmbeddings(texts);

			const batchItems: Array<{ id: string; vector: Float32Array; metadata: Record<string, any> }> = [];

			for (let i = 0; i < chunks.length; i++) {
				const chunk = chunks[i];
				const metadata = metadatas[i];
				const embedding = embeddings[i];

				this.embeddings.set(chunk.chunkId, {
					vector: embedding,
					metadata
				});

				// Update countOfDocId index
				const docId = metadata.docId;
				if (docId) {
					this.countOfDocId.set(docId, (this.countOfDocId.get(docId) ?? 0) + 1);
				}

				batchItems.push({ id: chunk.chunkId, vector: embedding, metadata });
			}

			// Persist entire batch in a single transaction
			await this.saveBatchToDisk(batchItems);

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
			const preprocessedQuery = this.preprocessQuery(text);
			this.logService.info(`Original query: "${text}"`);
			this.logService.info(`Preprocessed query: "${preprocessedQuery}"`);

			const queryVector = await this.embeddingService.generateEmbedding(preprocessedQuery);

			const results: Array<{ id: string; score: number; metadata: Record<string, any> }> = [];
			const MIN_SIMILARITY_THRESHOLD = 0.07;

			this.logService.info(`Searching ${this.embeddings.size} embeddings with threshold ${MIN_SIMILARITY_THRESHOLD}...`);

			let scopeMatchCount = 0;
			for (const [id, data] of this.embeddings.entries()) {
				const isCoreReference = data.metadata.isCoreReference ?? false;
				const isSearchingCoreReferences = isCoreReferenceScope(scope);
				if (isSearchingCoreReferences && !isCoreReference) continue;
				if ((scope === 'case_index' || scope === 'workspace_docs') && isCoreReference) continue;

				scopeMatchCount++;
				// Vectors are pre-normalized -- dot product = cosine similarity
				const similarity = this.dotSimilarity(queryVector, data.vector);

				if (similarity >= MIN_SIMILARITY_THRESHOLD) {
					results.push({
						id,
						score: similarity,
						metadata: data.metadata
					});
				}
			}

			this.logService.info(`Scope matched ${scopeMatchCount} embeddings, ${results.length} above threshold`);

			// Sort by score descending and return top-n (MMR diversity handled in ragContextService)
			const topResults = results
				.sort((a, b) => b.score - a.score)
				.slice(0, n);

			this.logService.info(`Returning top ${topResults.length} results`);
			return topResults;

		} catch (error) {
			this.logService.error('Failed to query:', error);
			return [];
		}
	}

	private preprocessQuery(query: string): string {
		let processed = query.toLowerCase().trim();

		const expansions: Record<string, string> = {
			'pre-existing': 'pre-existing preexisting prior existing previous',
			'preexisting': 'pre-existing preexisting prior existing previous',
			'prior condition': 'pre-existing preexisting prior condition previous condition',
			'aggravation': 'aggravation exacerbation worsening',
			'disability': 'disability impairment limitation restriction',
			'permanent': 'permanent lasting long-term chronic',
			'injury': 'injury harm damage trauma',
		};

		for (const [term, expansion] of Object.entries(expansions)) {
			if (processed.includes(term)) {
				processed = processed + ' ' + expansion;
				break;
			}
		}

		return processed;
	}

	// Dot product for pre-normalized vectors (~3x faster than full cosine: 1 accumulator vs 3 + sqrt + div)
	private dotSimilarity(a: Float32Array, b: Float32Array): number {
		if (a.length !== b.length) return 0;
		let dot = 0;
		for (let i = 0; i < a.length; i++) {
			dot += a[i] * b[i];
		}
		return dot;
	}

	async deleteByDocId(docId: string): Promise<void> {
		const toDelete: string[] = [];
		for (const [id, data] of this.embeddings.entries()) {
			if (data.metadata.docId === docId) {
				toDelete.push(id);
			}
		}

		for (const id of toDelete) {
			this.embeddings.delete(id);
		}

		// Update countOfDocId
		this.countOfDocId.delete(docId);

		// Delete from disk in a single transaction
		await this.deleteFromDisk(toDelete);

		this.logService.info(`Deleted ${toDelete.length} embeddings for document ${docId}`);
	}

	async hasDocumentEmbeddings(docId: string): Promise<{ hasEmbeddings: boolean; count: number }> {
		if (!this.initialized) {
			await this.initialize();
		}

		// O(1) lookup via secondary index
		const count = this.countOfDocId.get(docId) ?? 0;
		this.logService.debug(`hasDocumentEmbeddings(${docId}): ${count > 0} (${count} embeddings)`);
		return { hasEmbeddings: count > 0, count };
	}

	async clearAll(): Promise<void> {
		this.embeddings.clear();
		this.countOfDocId.clear();

		// Delete the database file and reopen a fresh connection
		try {
			if (this.db) {
				await new Promise<void>((resolve) => {
					this.db.close(() => resolve());
				});
				this.db = null;
			}
			const fs = await import('fs');
			if (fs.existsSync(this.embeddingsDbPath)) {
				fs.unlinkSync(this.embeddingsDbPath);
				this.logService.info('Deleted embeddings database file');
			}
			// Reopen a fresh connection
			const require = createRequire(import.meta.url);
			const sqlite3 = require('@vscode/sqlite3');
			this.db = new sqlite3.Database(this.embeddingsDbPath);
			await this.runSql(`
				CREATE TABLE IF NOT EXISTS embeddings (
					id TEXT PRIMARY KEY,
					vector BLOB NOT NULL,
					metadata TEXT NOT NULL
				)
			`);
		} catch (error) {
			this.logService.error('Failed to delete embeddings database:', error);
		}

		this.logService.info('Cleared all vector embeddings from memory and disk');
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

		// Generate embeddings using local model, convert to number[][] for Chroma API
		const texts = chunks.map(c => c.text);
		const float32Embeddings = await this.embeddingService.generateEmbeddings(texts);
		const embeddings = float32Embeddings.map(e => Array.from(e));

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

		// Generate query embedding using local model, convert to number[] for Chroma API
		const queryFloat32 = await this.embeddingService.generateEmbedding(text);
		const queryEmbedding = Array.from(queryFloat32);

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

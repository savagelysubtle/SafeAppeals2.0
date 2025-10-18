/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { RAGIndexParams, RAGSearchParams, RAGStats, ContextPack, IRAGMainService } from '../common/ragServiceTypes.js';
import { RAGIndexService } from './ragIndexService.js';
import { RAGFileService } from './ragFileService.js';
import { VectorAdapter, ChromaPersistentAdapter, PersistentVectorAdapterConfig } from '../common/ragVectorAdapter.js';
import { IRAGPathService } from '../common/ragPathService.js';

export class RAGMainService implements IRAGMainService {
	readonly _serviceBrand: undefined;

	private indexService: RAGIndexService;
	private fileService: RAGFileService;
	private vectorAdapter!: VectorAdapter;
	private initialized = false;
	private openAIApiKey: string = '';

	constructor(
		@ILogService private readonly logService: ILogService,
		@IRAGPathService private readonly pathService: IRAGPathService
	) {
		this.indexService = new RAGIndexService(logService, pathService);
		this.fileService = new RAGFileService(logService);
	}

	async initialize(openAIApiKey?: string): Promise<void> {
		if (this.initialized) return;

		try {
			// Store API key if provided
			if (openAIApiKey) {
				this.openAIApiKey = openAIApiKey;
				this.logService.info('RAG: Using OpenAI API key from settings');
			} else {
				this.logService.warn('RAG: No OpenAI API key provided - embeddings will be skipped');
			}

			// Ensure directories exist
			await this.pathService.ensureDirectories();

			// Use persistent local Chroma - no server needed!
			const chromaPath = this.pathService.getGlobalChromaDir();

			const config: PersistentVectorAdapterConfig = {
				persistPath: chromaPath,
				openAIApiKey: this.openAIApiKey,
				openAIModel: 'text-embedding-3-small'
			};

			this.vectorAdapter = new ChromaPersistentAdapter(config, this.logService);
			await this.vectorAdapter.initialize();

			// Initialize index service
			await this.indexService.initialize();

			// Ensure collections exist
			await this.vectorAdapter.ensureCollections('both');

			this.initialized = true;
			this.logService.info('RAG service initialized successfully');
		} catch (error) {
			this.logService.error('Failed to initialize RAG service:', error);
			throw error;
		}
	}

	async indexDocument(params: RAGIndexParams): Promise<{ success: boolean; message: string }> {
		if (!this.initialized) {
			await this.initialize();
		}

		// Log memory usage at start
		const memStart = process.memoryUsage();
		this.logService.info(`Memory at start: ${(memStart.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(memStart.heapTotal / 1024 / 1024).toFixed(2)} MB`);

		try {
			const filepath = params.uri.fsPath || params.uri.path || '';
			this.logService.info(`Indexing document: ${filepath}`);

			// Check file size before processing to prevent memory issues
			const fs = await import('fs');
			const stats = fs.statSync(filepath);
			const fileSizeMB = stats.size / (1024 * 1024);

			this.logService.info(`File size: ${fileSizeMB.toFixed(2)} MB`);

			if (fileSizeMB > 100) {
				return {
					success: false,
					message: `File too large (${fileSizeMB.toFixed(0)} MB). Maximum supported size is 100 MB. Please split the document into smaller files.`
				};
			}

			if (fileSizeMB > 50) {
				this.logService.warn(`Large file detected (${fileSizeMB.toFixed(2)} MB). Processing may take several minutes and use significant memory.`);
			}

			// Extract content from file
			const extractedContent = await this.fileService.extractContent(params.uri);

			// Log memory after extraction
			const memAfterExtraction = process.memoryUsage();
			this.logService.info(`Memory after extraction: ${(memAfterExtraction.heapUsed / 1024 / 1024).toFixed(2)} MB (delta: ${((memAfterExtraction.heapUsed - memStart.heapUsed) / 1024 / 1024).toFixed(2)} MB)`);

			// Index the document
			const result = await this.indexService.indexDocument({
				uri: params.uri,
				isPolicyManual: params.isPolicyManual,
				workspaceId: params.workspaceId,
				content: extractedContent.text,
				metadata: extractedContent.metadata
			});

			// Log memory after chunking
			const memAfterChunking = process.memoryUsage();
			this.logService.info(`Memory after chunking: ${(memAfterChunking.heapUsed / 1024 / 1024).toFixed(2)} MB (delta: ${((memAfterChunking.heapUsed - memAfterExtraction.heapUsed) / 1024 / 1024).toFixed(2)} MB)`);

			// Add chunks to vector store in batches to avoid memory issues
			if (result.chunks.length > 0) {
				const pathSegments = filepath.replace(/\\/g, '/').split('/');
				const filename = pathSegments[pathSegments.length - 1] || 'unknown';

				// Process chunks in batches for memory efficiency
				const EMBEDDING_BATCH_SIZE = 50; // Process 50 chunks at a time
				const totalChunks = result.chunks.length;

				this.logService.info(`Adding ${totalChunks} chunks to vector store in batches of ${EMBEDDING_BATCH_SIZE}...`);

				for (let i = 0; i < totalChunks; i += EMBEDDING_BATCH_SIZE) {
					const batchEnd = Math.min(i + EMBEDDING_BATCH_SIZE, totalChunks);
					const batchChunks = result.chunks.slice(i, batchEnd);
					const batchMetadatas = batchChunks.map(chunk => ({
						docId: result.docId,
						chunkId: chunk.chunkId,
						isPolicyManual: params.isPolicyManual,
						filename,
						chunkIndex: chunk.chunkIndex
					}));

					this.logService.info(`Processing embedding batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(totalChunks / EMBEDDING_BATCH_SIZE)} (chunks ${i + 1}-${batchEnd})...`);

					await this.vectorAdapter.add(batchChunks, batchMetadatas);

					// Log memory after each batch
					const memAfterBatch = process.memoryUsage();
					this.logService.info(`Memory after batch: ${(memAfterBatch.heapUsed / 1024 / 1024).toFixed(2)} MB`);

					// Force garbage collection hint after each batch
					if (global.gc) {
						global.gc();
					}
				}
			}

			// Final memory log
			const memEnd = process.memoryUsage();
			this.logService.info(`Memory at end: ${(memEnd.heapUsed / 1024 / 1024).toFixed(2)} MB (total delta: ${((memEnd.heapUsed - memStart.heapUsed) / 1024 / 1024).toFixed(2)} MB)`);

			this.logService.info(`Successfully indexed document: ${params.uri.fsPath}`);
			return { success: true, message: `Document indexed successfully. Created ${result.chunks.length} chunks.` };
		} catch (error) {
			const filepath = params.uri.fsPath || params.uri.path || 'unknown';
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logService.error(`Failed to index document ${filepath}:`, error);

			// Log memory on error too
			const memError = process.memoryUsage();
			this.logService.error(`Memory at error: ${(memError.heapUsed / 1024 / 1024).toFixed(2)} MB`);

			return { success: false, message: `Failed to index document: ${errorMsg}` };
		} finally {
			// Final cleanup
			if (global.gc) {
				global.gc();
			}
		}
	}

	async search(params: RAGSearchParams): Promise<ContextPack> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			this.logService.info(`Searching RAG with query: ${params.query}`);

			// Search vector store
			const vectorResults = await this.vectorAdapter.query(params.query, params.limit, params.scope);

			// Get additional metadata from SQLite
			const searchResults = await this.indexService.searchChunks(
				vectorResults.map(r => r.id),
				params.query
			);

			// Assemble context pack
			const answerContext = searchResults
				.map(result => result.snippet)
				.join('\n\n');

			const attributions = searchResults.map(result => ({
				docId: result.docId,
				chunkId: result.chunkId,
				filename: result.source.filename,
				rangeHint: `Chunk ${result.source.chunkIndex + 1}`,
				score: result.score
			}));

			return {
				answerContext,
				attributions,
				totalResults: searchResults.length,
				responseTime: Date.now() // Simple timing for now
			};
		} catch (error) {
			this.logService.error(`RAG search failed:`, error);
			return {
				answerContext: '',
				attributions: [],
				totalResults: 0,
				responseTime: 0
			};
		}
	}

	async getStats(): Promise<RAGStats> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			return await this.indexService.getStats();
		} catch (error) {
			this.logService.error('Failed to get RAG stats:', error);
			return {
				documents: [],
				chunks: { totalChunks: 0, avgTokens: 0 },
				totalDocuments: 0,
				totalSize: 0
			};
		}
	}

	async deleteDocument(docId: string): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			// Delete from SQLite
			await this.indexService.deleteDocument(docId);

			// Delete from vector store
			await this.vectorAdapter.deleteByDocId(docId);

			this.logService.info(`Deleted document ${docId}`);
		} catch (error) {
			this.logService.error(`Failed to delete document ${docId}:`, error);
			throw error;
		}
	}

	async isDocumentIndexed(uri: URI): Promise<boolean> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const docId = this.indexService.generateDocumentId(uri);
			const doc = await this.indexService.getDocumentById(docId);
			return doc !== null;
		} catch (error) {
			this.logService.error(`Failed to check if document is indexed:`, error);
			return false;
		}
	}

	async getDocumentsByType(isPolicyManual: boolean): Promise<any[]> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			return await this.indexService.getDocumentsByType(isPolicyManual);
		} catch (error) {
			this.logService.error(`Failed to get documents by type:`, error);
			return [];
		}
	}

	async clearAllEmbeddings(): Promise<{ success: boolean; message: string }> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			this.logService.info('RAG: Clearing all embeddings and metadata...');

			// Clear vector store
			await this.vectorAdapter.clearAll();
			this.logService.info('RAG: Cleared vector embeddings');

			// Clear SQLite index
			await this.indexService.clearAll();
			this.logService.info('RAG: Cleared SQLite index');

			return {
				success: true,
				message: 'All RAG embeddings and metadata cleared successfully. You can now re-index documents.'
			};
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logService.error('Failed to clear embeddings:', error);
			return {
				success: false,
				message: `Failed to clear embeddings: ${errorMsg}`
			};
		}
	}
}

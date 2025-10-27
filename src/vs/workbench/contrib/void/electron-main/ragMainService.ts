/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import { HybridRetriever } from '../common/ragHybridRetriever.js';
import { IRAGPathService } from '../common/ragPathService.js';
import { LocalCrossEncoderReranker } from '../common/ragReranker.js';
import { ContextPack, IRAGMainService, RAGIndexParams, RAGSearchParams, RAGStats } from '../common/ragServiceTypes.js';
import { ChromaPersistentAdapter, PersistentVectorAdapterConfig, VectorAdapter } from '../common/ragVectorAdapter.js';
import { RAGFileService } from './ragFileService.js';
import { RAGIndexService } from './ragIndexService.js';

export class RAGMainService implements IRAGMainService {
	readonly _serviceBrand: undefined;

	private indexService: RAGIndexService;
	private fileService: RAGFileService;
	private vectorAdapter!: VectorAdapter;
	private hybridRetriever!: HybridRetriever;
	private reranker!: LocalCrossEncoderReranker;
	private initialized = false;

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
			// Ignore openAIApiKey parameter - we use local embeddings now
			if (openAIApiKey) {
				this.logService.info('RAG: Using local embeddings (OpenAI API key no longer required)');
			}

			// Ensure directories exist
			await this.pathService.ensureDirectories();

		// Use persistent local Chroma - no server needed!
		const chromaPath = this.pathService.getGlobalChromaDir();

		const config: PersistentVectorAdapterConfig = {
			persistPath: chromaPath,
			useReranking: true // Enable reranking by default
		};

		this.vectorAdapter = new ChromaPersistentAdapter(config, this.logService);

		// Log first-time initialization message
		this.logService.info('Initializing local embedding model (first time may take 1-2 minutes to download ~23 MB model)...');
		await this.vectorAdapter.initialize();
		this.logService.info('Local embedding model ready');

		// Initialize index service
		await this.indexService.initialize();

		// Initialize hybrid retriever
		this.hybridRetriever = new HybridRetriever(
			this.vectorAdapter,
			this.indexService,
			this.logService
		);

		// Initialize reranker
		const modelCachePath = chromaPath + '/models';
		this.reranker = new LocalCrossEncoderReranker(this.logService);
		await this.reranker.initialize(modelCachePath);

		// Ensure collections exist
		await this.vectorAdapter.ensureCollections('both');

			// CRITICAL: Reload embeddings from database if they exist
			// The in-memory vector store loses all embeddings on restart
			await this.reloadEmbeddingsFromDatabase();

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
			this.logService.info('Extracting content from document...');
			const extractedContent = await this.fileService.extractContent(params.uri);

			// Log memory after extraction
			const memAfterExtraction = process.memoryUsage();
			this.logService.info(`Memory after extraction: ${(memAfterExtraction.heapUsed / 1024 / 1024).toFixed(2)} MB (delta: ${((memAfterExtraction.heapUsed - memStart.heapUsed) / 1024 / 1024).toFixed(2)} MB)`);

			// Index the document
			this.logService.info('Chunking document...');
			const result = await this.indexService.indexDocument({
				uri: params.uri,
				isPolicyManual: params.isPolicyManual,
				workspaceId: params.workspaceId,
				content: extractedContent.text,
				metadata: extractedContent.metadata
			});

			this.logService.info(`Created ${result.chunks.length} chunks`);

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
				const totalBatches = Math.ceil(totalChunks / EMBEDDING_BATCH_SIZE);

				this.logService.info(`Generating embeddings for ${totalChunks} chunks in ${totalBatches} batches...`);

				for (let i = 0; i < totalChunks; i += EMBEDDING_BATCH_SIZE) {
					const batchEnd = Math.min(i + EMBEDDING_BATCH_SIZE, totalChunks);
					const batchChunks = result.chunks.slice(i, batchEnd);
					const batchNum = Math.floor(i / EMBEDDING_BATCH_SIZE) + 1;
					const batchMetadatas = batchChunks.map(chunk => ({
						docId: result.docId,
						chunkId: chunk.chunkId,
						isPolicyManual: params.isPolicyManual,
						filename,
						chunkIndex: chunk.chunkIndex
					}));

					this.logService.info(`Processing embedding batch ${batchNum}/${totalBatches} (chunks ${i + 1}-${batchEnd})...`);

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
			return {
				success: true,
				message: `Document indexed successfully. Created ${result.chunks.length} chunks from ${extractedContent.metadata.pageCount || '?'} pages.`
			};
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

		const startTime = Date.now();

		try {
			this.logService.info(`RAG search: "${params.query}" (scope: ${params.scope}, limit: ${params.limit})`);

			// Stage 1: Hybrid retrieval (high recall)
			// Get 4x desired results for reranking
			const initialK = params.limit * 4;
			this.logService.info(`Stage 1: Hybrid retrieval (retrieving ${initialK} candidates)`);

			const hybridResults = await this.hybridRetriever.search(
				params.query,
				initialK,
				params.scope,
				20,  // RRF_K = 20 (optimized for medical/legal precision)
				0.8, // BM25 k1 = 0.8
				0.5  // BM25 b = 0.5
			);

			this.logService.info(`Hybrid search returned ${hybridResults.length} candidates`);

			// Early return if no results
			if (hybridResults.length === 0) {
				this.logService.warn(`No results from hybrid search for query: "${params.query}" with scope: ${params.scope}`);
				this.logService.warn(`This could mean: 1) No embeddings exist for this scope, 2) Query terms don't match, 3) Similarity threshold too high`);
				return {
					answerContext: '',
					attributions: [],
					totalResults: 0,
					responseTime: Date.now() - startTime
				};
			}

			// Get full chunk text from SQLite
			const chunkIds = hybridResults.map(r => r.chunkId);
			this.logService.info(`Fetching ${chunkIds.length} chunks from SQLite...`);

			const searchResults = await this.indexService.searchChunks(
				chunkIds,
				params.query
			);

			this.logService.info(`Retrieved ${searchResults.length} chunks from SQLite`);

			// Check for mismatch
			if (searchResults.length === 0 && chunkIds.length > 0) {
				this.logService.error(`CRITICAL: Hybrid search returned ${chunkIds.length} chunk IDs, but SQLite found 0 chunks!`);
				this.logService.error(`This means chunk IDs in embeddings don't match chunk IDs in SQLite database`);
				this.logService.error(`Sample chunk IDs from embeddings: ${chunkIds.slice(0, 3).join(', ')}`);
				return {
					answerContext: '',
					attributions: [],
					totalResults: 0,
					responseTime: Date.now() - startTime
				};
			}

			// Stage 2: Reranking (high precision)
			this.logService.info(`Stage 2: Cross-encoder reranking (top ${params.limit} from ${searchResults.length} candidates)`);

			const documentsForReranking = searchResults.map(result => ({
				id: result.chunkId,
				text: result.snippet,
				score: result.score
			}));

			// DEBUG: Log first document to see what we're passing to reranker
			if (documentsForReranking.length > 0) {
				const firstDoc = documentsForReranking[0];
				this.logService.info(`First document for reranking: id=${firstDoc.id}, textType=${typeof firstDoc.text}, textLength=${firstDoc.text?.length || 'undefined'}, score=${firstDoc.score}`);
				if (typeof firstDoc.text !== 'string') {
					this.logService.error(`ERROR: First document text is not a string! It's: ${JSON.stringify(firstDoc.text).substring(0, 100)}`);
				}
			}

			const reranked = await this.reranker.rerank(
				params.query,
				documentsForReranking,
				params.limit
			);

			this.logService.info(`Reranked to top ${reranked.length} results`);

			// Assemble context pack
			const answerContext = reranked
				.map(r => {
					const original = searchResults.find(s => s.chunkId === r.chunkId);
					return original?.snippet || r.text;
				})
				.join('\n\n');

			const attributions = reranked.map(r => {
				const original = searchResults.find(s => s.chunkId === r.chunkId);
				return {
					docId: original?.docId || '',
					chunkId: r.chunkId,
					filename: original?.source.filename || '',
					rangeHint: `Chunk ${(original?.source.chunkIndex || 0) + 1}`,
					score: r.relevanceScore
				};
			});

			const responseTime = Date.now() - startTime;
			this.logService.info(`Search completed in ${responseTime}ms with ${reranked.length} results`);

			return {
				answerContext,
				attributions,
				totalResults: reranked.length,
				responseTime
			};
		} catch (error) {
			this.logService.error('RAG search failed:', error);
			return {
				answerContext: '',
				attributions: [],
				totalResults: 0,
				responseTime: Date.now() - startTime
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
			this.logService.info(`Checking if document is indexed: ${uri.fsPath} (docId: ${docId})`);

			const doc = await this.indexService.getDocumentById(docId);
			const isIndexed = doc !== null;

			this.logService.info(`Document ${uri.fsPath} is ${isIndexed ? 'already indexed' : 'not indexed'}`);
			return isIndexed;
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
			this.logService.info('RAG: Step 1/3 - Clearing vector embeddings...');

			// Step 1: Clear vector store (embeddings)
			await this.vectorAdapter.clearAll();
			this.logService.info('RAG: ✓ Vector embeddings cleared');

			this.logService.info('RAG: Step 2/3 - Clearing document metadata...');

			// Step 2: Get stats before clearing for confirmation message
			const statsBeforeClearing = await this.indexService.getStats();
			const documentCount = statsBeforeClearing.totalDocuments;
			const chunkCount = statsBeforeClearing.chunks.totalChunks;

			this.logService.info('RAG: Step 3/3 - Clearing SQLite index (documents, chunks, FTS5 keyword index)...');

			// Step 3: Clear SQLite index (documents, chunks, FTS5)
			await this.indexService.clearAll();
			this.logService.info('RAG: ✓ SQLite index cleared (documents, chunks, FTS5)');

			this.logService.info('RAG: ✓ All RAG data cleared successfully');

			return {
				success: true,
				message: `Successfully cleared all RAG data:\n- ${documentCount} documents\n- ${chunkCount} chunks\n- Vector embeddings\n- Keyword search index (FTS5)\n\nYou can now re-index documents.`
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

	/**
	 * Reload embeddings from database into vector store
	 * This is necessary because the in-memory vector store loses data on restart
	 */
	private async reloadEmbeddingsFromDatabase(): Promise<void> {
		try {
			this.logService.info('Checking if embeddings need to be reloaded from database...');

			// Get all documents from database
			const stats = await this.indexService.getStats();
			const totalDocs = stats.totalDocuments;

			if (totalDocs === 0) {
				this.logService.info('No documents in database, skipping embedding reload');
				return;
			}

			this.logService.warn(`Found ${totalDocs} documents in database but vector store is empty.`);
			this.logService.warn('Embeddings will need to be regenerated. Use "RAG: Clear All Embeddings" and re-index documents.');
			this.logService.warn('Note: With local embeddings, this is free but takes time.');

			// TODO: In the future, we could store embeddings in SQLite and reload them
			// For now, user must clear and re-index with the new local embedding model

		} catch (error) {
			this.logService.error('Failed to check for embeddings reload:', error);
		}
	}

	/**
	 * Create an empty but valid DOCX file (delegates to fileService)
	 */
	async createEmptyDOCX(uri: URI): Promise<void> {
		return this.fileService.createEmptyDOCX(uri);
	}

	/**
	 * Create an empty but valid XLSX file (delegates to fileService)
	 */
	async createEmptyXLSX(uri: URI): Promise<void> {
		return this.fileService.createEmptyXLSX(uri);
	}

	/**
	 * Edit a DOCX file with the given operations (delegates to fileService)
	 */
	async editDOCX(uri: URI, operations: Array<{
		type: 'insert_text' | 'replace_text';
		position?: number;
		text?: string;
		search?: string;
		replace?: string;
		all?: boolean;
	}>): Promise<{ success: boolean; message: string }> {
		return this.fileService.editDOCX(uri, operations);
	}

	/**
	 * Edit an XLSX file with the given operations (delegates to fileService)
	 */
	async editXLSX(uri: URI, operations: Array<{
		type: 'set_cell_value' | 'set_cell_formula';
		sheet: string | number;
		cell: string;
		value?: any;
		formula?: string;
	}>): Promise<{ success: boolean; message: string }> {
		return this.fileService.editXLSX(uri, operations);
	}
}

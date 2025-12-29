/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ChildProcess, spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { URI } from '../../../../../base/common/uri.js';
import { ILogService } from '../../../../../platform/log/common/log.js';
import { HybridRetriever } from '../../common/rag/ragHybridRetriever.js';
import { IRAGPathService } from '../../common/rag/ragPathService.js';
import { LocalCrossEncoderReranker } from '../../common/rag/ragReranker.js';
import { ContextPack, IRAGMainService, RAGIndexParams, RAGSearchParams, RAGStats } from '../../common/rag/ragServiceTypes.js';
import { ChromaPersistentAdapter, PersistentVectorAdapterConfig, VectorAdapter } from '../../common/rag/ragVectorAdapter.js';
import { RAGFileService } from './ragFileService.js';
import { RAGIndexService } from './ragIndexService.js';
import { WorkspaceRAGManager } from './ragWorkspaceManager.js';

export class RAGMainService implements IRAGMainService {
	readonly _serviceBrand: undefined;

	// Legacy global services (for backwards compatibility)
	private globalIndexService: RAGIndexService;
	private fileService: RAGFileService;
	private globalVectorAdapter!: VectorAdapter;
	private globalHybridRetriever!: HybridRetriever;
	private globalReranker!: LocalCrossEncoderReranker;

	// Per-workspace management
	private workspaceManager: WorkspaceRAGManager;

	private initialized = false;
	private doclingProcess?: ChildProcess;
	private doclingServerReady = false;

	constructor(
		@ILogService private readonly logService: ILogService,
		@IRAGPathService private readonly pathService: IRAGPathService
	) {
		this.globalIndexService = new RAGIndexService(logService, pathService);
		this.fileService = new RAGFileService(logService);
		this.workspaceManager = new WorkspaceRAGManager(logService, pathService);
	}

	async initialize(openAIApiKey?: string): Promise<void> {
		if (this.initialized) return;

		try {
			// Start Docling Serve in the background
			await this.startDoclingServe();

			// Ignore openAIApiKey parameter - we use local embeddings now
			if (openAIApiKey) {
				this.logService.info('RAG: Using local embeddings (OpenAI API key no longer required)');
			}

			// Ensure directories exist
			await this.pathService.ensureDirectories();

			// Initialize global services (for backwards compatibility / fallback)
			const chromaPath = this.pathService.getGlobalChromaDir();

			const config: PersistentVectorAdapterConfig = {
				persistPath: chromaPath,
				useReranking: true // Enable reranking by default
			};

			this.globalVectorAdapter = new ChromaPersistentAdapter(config, this.logService);

			// Log first-time initialization message
			this.logService.info('Initializing local embedding model (first time may take 1-2 minutes to download ~23 MB model)...');
			await this.globalVectorAdapter.initialize();
			this.logService.info('Local embedding model ready');

			// Initialize index service
			await this.globalIndexService.initialize();

			// Initialize hybrid retriever
			this.globalHybridRetriever = new HybridRetriever(
				this.globalVectorAdapter,
				this.globalIndexService,
				this.logService
			);

			// Initialize reranker
			const modelCachePath = chromaPath + '/models';
			this.globalReranker = new LocalCrossEncoderReranker(this.logService);
			await this.globalReranker.initialize(modelCachePath);

			// Ensure collections exist
			await this.globalVectorAdapter.ensureCollections('workspace_all');

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

	/**
	 * Switch to a different workspace RAG context
	 */
	async switchWorkspace(workspaceId: string): Promise<void> {
		this.logService.info(`RAG: Switching to workspace ${workspaceId}`);
		await this.workspaceManager.switchWorkspace(workspaceId);
	}

	/**
	 * Get the appropriate RAG instance for the given workspaceId
	 * Falls back to global if no workspaceId or workspace not found
	 */
	private async getWorkspaceInstance(workspaceId?: string): Promise<{
		vectorAdapter: VectorAdapter;
		indexService: RAGIndexService;
		hybridRetriever: HybridRetriever;
		reranker: LocalCrossEncoderReranker;
	}> {
		if (workspaceId) {
			const instance = await this.workspaceManager.getOrCreateWorkspace(workspaceId);
			return {
				vectorAdapter: instance.vectorAdapter,
				indexService: instance.indexService,
				hybridRetriever: instance.hybridRetriever,
				reranker: instance.reranker
			};
		}

		// Fall back to global
		return {
			vectorAdapter: this.globalVectorAdapter,
			indexService: this.globalIndexService,
			hybridRetriever: this.globalHybridRetriever,
			reranker: this.globalReranker
		};
	}

	async indexDocument(params: RAGIndexParams): Promise<{ success: boolean; message: string }> {
		if (!this.initialized) {
			await this.initialize();
		}

		// Get workspace-specific instance
		const { vectorAdapter, indexService } = await this.getWorkspaceInstance(params.workspaceId);

		// Log memory usage at start
		const memStart = process.memoryUsage();
		this.logService.info(`Memory at start: ${(memStart.heapUsed / 1024 / 1024).toFixed(2)} MB / ${(memStart.heapTotal / 1024 / 1024).toFixed(2)} MB`);
		this.logService.info(`Using workspace: ${params.workspaceId || 'global'}`);

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

			// Index the document using workspace-specific index service
			this.logService.info('Chunking document...');
			const result = await indexService.indexDocument({
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

			// Add chunks to workspace-specific vector store in batches to avoid memory issues
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

					await vectorAdapter.add(batchChunks, batchMetadatas);

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

		// Get workspace-specific instance
		const { hybridRetriever, indexService, reranker } = await this.getWorkspaceInstance(params.workspaceId);

		const startTime = Date.now();

		try {
			this.logService.info(`RAG search: "${params.query}" (scope: ${params.scope}, limit: ${params.limit}, workspace: ${params.workspaceId || 'global'})`);

			// Stage 1: Hybrid retrieval (high recall)
			// Get 4x desired results for reranking
			const initialK = params.limit * 4;
			this.logService.info(`Stage 1: Hybrid retrieval (retrieving ${initialK} candidates)`);

			const hybridResults = await hybridRetriever.search(
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

			const searchResults = await indexService.searchChunks(
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

			const reranked = await reranker.rerank(
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

	async getStats(workspaceId?: string): Promise<RAGStats> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const { indexService } = await this.getWorkspaceInstance(workspaceId);
			return await indexService.getStats();
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

	async deleteDocument(docId: string, workspaceId?: string): Promise<void> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const { indexService, vectorAdapter } = await this.getWorkspaceInstance(workspaceId);

			// Delete from SQLite
			await indexService.deleteDocument(docId);

			// Delete from vector store
			await vectorAdapter.deleteByDocId(docId);

			this.logService.info(`Deleted document ${docId} from workspace ${workspaceId || 'global'}`);
		} catch (error) {
			this.logService.error(`Failed to delete document ${docId}:`, error);
			throw error;
		}
	}

	async isDocumentIndexed(uri: URI, workspaceId?: string): Promise<boolean> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const { indexService } = await this.getWorkspaceInstance(workspaceId);
			const docId = indexService.generateDocumentId(uri);
			this.logService.info(`Checking if document is indexed: ${uri.fsPath} (docId: ${docId}, workspace: ${workspaceId || 'global'})`);

			const doc = await indexService.getDocumentById(docId);
			const isIndexed = doc !== null;

			this.logService.info(`Document ${uri.fsPath} is ${isIndexed ? 'already indexed' : 'not indexed'}`);
			return isIndexed;
		} catch (error) {
			this.logService.error(`Failed to check if document is indexed:`, error);
			return false;
		}
	}

	async getDocumentsByType(isPolicyManual: boolean, workspaceId?: string): Promise<any[]> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const { indexService } = await this.getWorkspaceInstance(workspaceId);
			return await indexService.getDocumentsByType(isPolicyManual);
		} catch (error) {
			this.logService.error(`Failed to get documents by type:`, error);
			return [];
		}
	}

	async clearAllEmbeddings(workspaceId?: string): Promise<{ success: boolean; message: string }> {
		if (!this.initialized) {
			await this.initialize();
		}

		try {
			const { vectorAdapter, indexService } = await this.getWorkspaceInstance(workspaceId);

			this.logService.info(`RAG: Clearing all embeddings and metadata for workspace ${workspaceId || 'global'}...`);
			this.logService.info('RAG: Step 1/3 - Clearing vector embeddings...');

			// Step 1: Clear vector store (embeddings)
			await vectorAdapter.clearAll();
			this.logService.info('RAG: ✓ Vector embeddings cleared');

			this.logService.info('RAG: Step 2/3 - Clearing document metadata...');

			// Step 2: Get stats before clearing for confirmation message
			const statsBeforeClearing = await indexService.getStats();
			const documentCount = statsBeforeClearing.totalDocuments;
			const chunkCount = statsBeforeClearing.chunks.totalChunks;

			this.logService.info('RAG: Step 3/3 - Clearing SQLite index (documents, chunks, FTS5 keyword index)...');

			// Step 3: Clear SQLite index (documents, chunks, FTS5)
			await indexService.clearAll();
			this.logService.info('RAG: ✓ SQLite index cleared (documents, chunks, FTS5)');

			this.logService.info('RAG: ✓ All RAG data cleared successfully');

			return {
				success: true,
				message: `Successfully cleared all RAG data for workspace ${workspaceId || 'global'}:\n- ${documentCount} documents\n- ${chunkCount} chunks\n- Vector embeddings\n- Keyword search index (FTS5)\n\nYou can now re-index documents.`
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

	async testDoclingExtraction(uri: URI): Promise<{ standard: any; docling: any; doclingError?: any }> {
		this.logService.info(`[Test Docling] Testing extraction methods for: ${uri.fsPath}`);

		// Extract with standard method (using public extractPDFPages)
		this.logService.info('[Test Docling] Extracting with standard pdfjs-dist...');
		const standardResult = await this.fileService.extractPDFPages(uri);

		// Extract with Docling method
		this.logService.info('[Test Docling] Extracting with Docling SDK...');
		let doclingResult;
		let doclingError;
		try {
			// Temporarily enable Docling
			this.fileService.useDoclingForPdf = true;
			doclingResult = await this.fileService.extractPdfWithDocling(uri);
		} catch (error) {
			doclingError = error;
			doclingResult = {
				text: `[Error extracting with Docling: ${error instanceof Error ? error.message : String(error)}]`,
				metadata: { wordCount: 0 }
			};
		} finally {
			// Always reset the flag
			this.fileService.useDoclingForPdf = false;
		}

		return {
			standard: standardResult,
			docling: doclingResult,
			doclingError
		};
	}

	/**
	 * Reload embeddings from database into vector store
	 * This is necessary because the in-memory vector store loses data on restart
	 */
	private async reloadEmbeddingsFromDatabase(): Promise<void> {
		try {
			this.logService.info('Checking if embeddings need to be reloaded from database...');

			// Get all documents from database
			const stats = await this.globalIndexService.getStats();
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

	/**
	 * Start Docling Serve in the background
	 * This enables advanced PDF extraction with ML models
	 */
	private async startDoclingServe(): Promise<void> {
		// Check if already running
		if (this.doclingProcess) {
			this.logService.info('[Docling Serve] Already running');
			return;
		}

		try {
			// Get workspace root (go up 2 levels from .build/electron in dev mode)
			const workspaceRoot = path.resolve(process.cwd(), '..', '..');
			const venvPython = path.join(workspaceRoot, '.venv', 'Scripts', 'python.exe');

			// Check if .venv exists
			if (!fs.existsSync(venvPython)) {
				this.logService.warn('[Docling Serve] Python virtual environment not found at:', venvPython);
				this.logService.warn('[Docling Serve] Please run: uv venv && uv pip install docling-serve');
				this.logService.warn('[Docling Serve] Advanced PDF extraction will not be available');
				return;
			}

			this.logService.info('[Docling Serve] Starting Docling Serve...');
			this.logService.info('[Docling Serve] Python path:', venvPython);

			// Prepare environment for Docling Serve
			const env = { ...process.env };

			// Try to load HF_TOKEN from .env file if not in environment
			const envFilePath = path.join(workspaceRoot, '.env');
			if (fs.existsSync(envFilePath)) {
				this.logService.info('[Docling Serve] Loading .env file:', envFilePath);
				try {
					const envContent = fs.readFileSync(envFilePath, 'utf-8');
					const lines = envContent.split('\n');
					for (const line of lines) {
						const trimmed = line.trim();
						if (trimmed && !trimmed.startsWith('#')) {
							const match = trimmed.match(/^([^=]+)=(.*)$/);
							if (match) {
								const key = match[1].trim();
								const value = match[2].trim().replace(/^["']|["']$/g, ''); // Remove quotes
								if (key === 'HF_TOKEN' || key === 'HUGGING_FACE_HUB_TOKEN') {
									env[key] = value;
									this.logService.info(`[Docling Serve] ✓ Loaded ${key} from .env`);
								}
							}
						}
					}
				} catch (error) {
					this.logService.warn('[Docling Serve] Failed to read .env file:', error);
				}
			}

			// Set HuggingFace token if available (required for gated models even if cached)
			if (env.HF_TOKEN || env.HUGGING_FACE_HUB_TOKEN) {
				env.HF_TOKEN = env.HF_TOKEN || env.HUGGING_FACE_HUB_TOKEN;
				this.logService.info('[Docling Serve] ✓ HuggingFace token available');
			} else {
				this.logService.warn('[Docling Serve] ⚠️ No HF_TOKEN found in environment or .env file');
				this.logService.warn('[Docling Serve] docling-serve requires HF_TOKEN for gated models');
				this.logService.warn('[Docling Serve] Add HF_TOKEN=hf_... to .env file in project root');
			}

			// Start docling-serve as a subprocess with 'run' command
			this.doclingProcess = spawn(venvPython, ['-m', 'docling_serve', 'run'], {
				stdio: ['ignore', 'pipe', 'pipe'], // Capture stdout and stderr
				cwd: workspaceRoot,
				detached: false, // Keep attached so it dies with the parent
				windowsHide: true, // Hide console window on Windows
				env // Pass environment with HF_TOKEN
			});

			// Log output
			this.doclingProcess.stdout?.on('data', (data) => {
				const output = data.toString().trim();
				this.logService.info(`[Docling Serve] ${output}`);

				// Check if server is ready
				if (output.includes('Uvicorn running') || output.includes('Application startup complete')) {
					this.doclingServerReady = true;
					this.logService.info('[Docling Serve] ✓ Server ready on http://localhost:5001');
				}
			});

			this.doclingProcess.stderr?.on('data', (data) => {
				const output = data.toString().trim();
				// Filter out noise
				if (!output.includes('UserWarning') && !output.includes('FutureWarning')) {
					this.logService.warn(`[Docling Serve] ${output}`);
				}
			});

			this.doclingProcess.on('error', (error) => {
				this.logService.error('[Docling Serve] Failed to start:', error);
				this.doclingProcess = undefined;
			});

			this.doclingProcess.on('exit', (code, signal) => {
				this.logService.info(`[Docling Serve] Process exited with code ${code}, signal ${signal}`);
				this.doclingProcess = undefined;
				this.doclingServerReady = false;
			});

			// Wait for server to be ready (max 15 seconds)
			const startTime = Date.now();
			while (!this.doclingServerReady && Date.now() - startTime < 15000) {
				await new Promise(resolve => setTimeout(resolve, 500));
			}

			if (this.doclingServerReady) {
				this.logService.info('[Docling Serve] ✓ Started successfully in', Date.now() - startTime, 'ms');
			} else {
				this.logService.warn('[Docling Serve] Server did not respond within 15 seconds');
				this.logService.warn('[Docling Serve] It may still be starting up (first run downloads ML models)');
			}
		} catch (error) {
			this.logService.error('[Docling Serve] Failed to start:', error);
			this.doclingProcess = undefined;
		}
	}

	/**
	 * Stop Docling Serve process
	 * Called automatically when RAG service is disposed
	 */
	private stopDoclingServe(): void {
		if (this.doclingProcess) {
			this.logService.info('[Docling Serve] Stopping server...');

			try {
				// Try graceful shutdown first
				this.doclingProcess.kill('SIGTERM');

				// Force kill after 5 seconds if still running
				setTimeout(() => {
					if (this.doclingProcess && !this.doclingProcess.killed) {
						this.logService.warn('[Docling Serve] Forcing shutdown...');
						this.doclingProcess.kill('SIGKILL');
					}
				}, 5000);
			} catch (error) {
				this.logService.error('[Docling Serve] Error stopping server:', error);
			}

			this.doclingProcess = undefined;
			this.doclingServerReady = false;
		}
	}

	/**
	 * Dispose of the RAG service and clean up resources
	 */
	dispose(): void {
		this.stopDoclingServe();
		// Dispose all workspace instances
		this.workspaceManager.disposeAll().catch(err => {
			this.logService.error('Error disposing workspace instances:', err);
		});
		this.logService.info('RAG service disposed');
	}
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILogService } from '../../../../platform/log/common/log.js';

/**
 * Local embedding service using Transformers.js
 * Uses all-MiniLM-L6-v2 model (384-dimensional embeddings, ~23 MB)
 * Provides free, offline embeddings without API costs
 */
export class LocalEmbeddingService {
	private pipe: any = null;
	private initialized = false;
	private initializationPromise: Promise<void> | null = null;

	// Batching configuration for memory efficiency
	private readonly BATCH_SIZE = 25; // Process 25 texts at a time
	private readonly MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';
	private readonly EMBEDDING_DIMENSION = 384;

	constructor(
		private readonly logService: ILogService
	) { }

	/**
	 * Initialize the embedding model
	 * Downloads model (~23 MB) on first run
	 */
	async initialize(cachePath: string): Promise<void> {
		// Prevent concurrent initialization
		if (this.initializationPromise) {
			return this.initializationPromise;
		}

		if (this.initialized) {
			return;
		}

		this.initializationPromise = this._initializeInternal(cachePath);
		await this.initializationPromise;
		this.initializationPromise = null;
	}

	private async _initializeInternal(cachePath: string): Promise<void> {
		try {
			this.logService.info(`Initializing local embedding model (${this.MODEL_NAME})...`);
			this.logService.info('First-time initialization may take 1-2 minutes to download ~23 MB model');

			// Dynamic import to avoid bundling issues
			const transformers = await import('@xenova/transformers');

			// Configure cache directory to use app data folder
			transformers.env.cacheDir = cachePath;
			transformers.env.allowLocalModels = true;
			transformers.env.allowRemoteModels = true;

			// Create feature extraction pipeline
			// Note: dtype option not available in this version, using default quantization
			this.pipe = await transformers.pipeline('feature-extraction', this.MODEL_NAME);

			this.initialized = true;
			this.logService.info('Local embedding model initialized successfully');
		} catch (error) {
			this.initialized = false;
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logService.error(`Failed to initialize local embedding model: ${errorMsg}`);

			// Provide helpful error messages
			if (errorMsg.includes('fetch') || errorMsg.includes('network')) {
				throw new Error('Failed to download embedding model. Please check your internet connection and try again.');
			} else if (errorMsg.includes('disk') || errorMsg.includes('ENOSPC')) {
				throw new Error('Insufficient disk space to download embedding model (~23 MB required).');
			} else {
				throw new Error(`Embedding model initialization failed: ${errorMsg}`);
			}
		}
	}

	/**
	 * Generate embeddings for multiple texts
	 * Processes in batches for memory efficiency
	 */
	async generateEmbeddings(texts: string[]): Promise<number[][]> {
		if (!this.initialized) {
			throw new Error('Local embedding service not initialized. Call initialize() first.');
		}

		if (texts.length === 0) {
			return [];
		}

		try {
			const embeddings: number[][] = [];
			const totalBatches = Math.ceil(texts.length / this.BATCH_SIZE);

			// Log memory at start
			const memStart = process.memoryUsage();
			this.logService.info(`Generating embeddings for ${texts.length} texts in ${totalBatches} batches...`);
			this.logService.info(`Memory at start: ${(memStart.heapUsed / 1024 / 1024).toFixed(2)} MB`);

			for (let i = 0; i < texts.length; i += this.BATCH_SIZE) {
				const batchNum = Math.floor(i / this.BATCH_SIZE) + 1;
				const batchEnd = Math.min(i + this.BATCH_SIZE, texts.length);
				const batch = texts.slice(i, batchEnd);

				this.logService.info(`Processing embedding batch ${batchNum}/${totalBatches} (${batch.length} texts)...`);

				// Generate embeddings with mean pooling and normalization
				const output = await this.pipe(batch, {
					pooling: 'mean',
					normalize: true
				});

				// Convert tensor to array
				const batchEmbeddings = output.tolist();

				// Validate embedding dimensions
				for (const embedding of batchEmbeddings) {
					if (embedding.length !== this.EMBEDDING_DIMENSION) {
						throw new Error(`Invalid embedding dimension: expected ${this.EMBEDDING_DIMENSION}, got ${embedding.length}`);
					}
				}

				embeddings.push(...batchEmbeddings);

				// Log memory after each batch
				const memAfterBatch = process.memoryUsage();
				this.logService.info(`Memory after batch ${batchNum}: ${(memAfterBatch.heapUsed / 1024 / 1024).toFixed(2)} MB`);

				// Force garbage collection hint after each batch
				if (global.gc) {
					global.gc();
				}
			}

			// Log final memory
			const memEnd = process.memoryUsage();
			this.logService.info(`Generated ${embeddings.length} embeddings`);
			this.logService.info(`Memory at end: ${(memEnd.heapUsed / 1024 / 1024).toFixed(2)} MB (delta: ${((memEnd.heapUsed - memStart.heapUsed) / 1024 / 1024).toFixed(2)} MB)`);

			return embeddings;
		} catch (error) {
			const errorMsg = error instanceof Error ? error.message : String(error);
			this.logService.error(`Failed to generate embeddings: ${errorMsg}`);

			// Provide helpful error context
			if (errorMsg.includes('memory') || errorMsg.includes('heap')) {
				throw new Error(`Out of memory while generating embeddings. Try processing fewer documents at once.`);
			} else {
				throw error;
			}
		}
	}

	/**
	 * Generate embedding for a single text
	 */
	async generateEmbedding(text: string): Promise<number[]> {
		const embeddings = await this.generateEmbeddings([text]);
		return embeddings[0];
	}

	/**
	 * Check if the service is initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Get the embedding dimension
	 */
	getEmbeddingDimension(): number {
		return this.EMBEDDING_DIMENSION;
	}

	/**
	 * Get the model name
	 */
	getModelName(): string {
		return this.MODEL_NAME;
	}
}


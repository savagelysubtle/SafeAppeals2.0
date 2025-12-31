/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILogService } from '../../../../../platform/log/common/log.js';

export interface RerankedResult {
	chunkId: string;
	relevanceScore: number;
	originalScore: number;
	text: string;
}

/**
 * Local cross-encoder reranker using ms-marco-MiniLM-L-6-v2 via Transformers.js
 *
 * Research-backed model selection:
 * - Speed: ~1,800 docs/sec on V100 GPU, 50-150 docs/sec on CPU
 * - Accuracy: NDCG@10: 74.30, MRR@10: 39.01
 * - Size: ~90MB (6 layers), fast inference
 * - Best for production environments where latency matters
 * - Optimized for medical/legal English documents
 */
export class LocalCrossEncoderReranker {
	private model: any;
	private tokenizer: any;
	private initialized = false;
	private initializing = false;
	private initPromise: Promise<void> | null = null;
	private cachePath: string | null = null;
	private readonly MODEL_NAME = 'Xenova/ms-marco-MiniLM-L-6-v2';
	private readonly BATCH_SIZE = 10; // Process 10 pairs at a time for memory efficiency

	constructor(private logService: ILogService) { }

	/**
	 * Set the cache path for lazy initialization
	 * Call this instead of initialize() for faster workspace creation
	 */
	setCachePath(cachePath: string): void {
		this.cachePath = cachePath;
	}

	/**
	 * Initialize the cross-encoder model
	 * First-time initialization may take 1-2 minutes to download ~90MB model
	 * @param cachePath Path to cache downloaded models
	 */
	async initialize(cachePath?: string): Promise<void> {
		if (cachePath) {
			this.cachePath = cachePath;
		}
		if (this.initialized) return;
		if (this.initializing && this.initPromise) {
			// Already initializing, wait for it
			return this.initPromise;
		}

		this.initializing = true;
		this.initPromise = this.doInitialize();
		try {
			await this.initPromise;
		} finally {
			this.initializing = false;
		}
	}

	private async doInitialize(): Promise<void> {
		try {
			this.logService.info('Initializing cross-encoder reranker (ms-marco-MiniLM-L-6-v2)...');
			this.logService.info('First-time initialization may take 1-2 minutes to download ~90 MB model');

			const transformers = await import('@xenova/transformers');

			// Set cache directory
			if (this.cachePath) {
				transformers.env.cacheDir = this.cachePath;
			}

			// Use AutoModel and AutoTokenizer for cross-encoding
			this.tokenizer = await transformers.AutoTokenizer.from_pretrained(this.MODEL_NAME);
			this.model = await transformers.AutoModelForSequenceClassification.from_pretrained(this.MODEL_NAME);

			this.initialized = true;
			this.logService.info('Cross-encoder reranker initialized successfully');
		} catch (error) {
			this.logService.error('Failed to initialize reranker:', error);
			throw error;
		}
	}

	/**
	 * Rerank documents based on relevance to query
	 * @param query Search query
	 * @param documents Array of documents with ID, text, and original score
	 * @param topN Number of top results to return
	 * @returns Reranked results sorted by relevance score
	 */
	async rerank(
		query: string,
		documents: Array<{ id: string; text: string; score: number }>,
		topN: number
	): Promise<RerankedResult[]> {
		// Lazy initialization - initialize on first use if not already done
		if (!this.initialized) {
			if (!this.cachePath) {
				throw new Error('Reranker not initialized and no cache path set. Call setCachePath() or initialize() first.');
			}
			this.logService.info('Reranker: Lazy initialization triggered on first rerank call');
			await this.initialize();
		}

		if (documents.length === 0) {
			return [];
		}

		this.logService.info(`Reranking ${documents.length} documents to top ${topN}`);

		// DEFENSIVE: Ensure all documents have valid text strings
		const validDocuments = documents.map((doc, idx) => {
			if (!doc.text || typeof doc.text !== 'string') {
				this.logService.error(`Document ${idx} has invalid text: ${typeof doc.text}. ID: ${doc.id}`);
				this.logService.error(`Document object: ${JSON.stringify(doc).substring(0, 200)}`);
				return { ...doc, text: '' };
			}
			return doc;
		});

		// Create query-document pairs
		// Format: [query, document] pairs for cross-encoder
		const pairs = validDocuments.map(doc => [query, doc.text]);

		// Score each pair (process in batches for memory efficiency)
		const scores: number[] = [];

		for (let i = 0; i < pairs.length; i += this.BATCH_SIZE) {
			const batch = pairs.slice(i, Math.min(i + this.BATCH_SIZE, pairs.length));

			// Extract queries and documents separately for tokenizer
			const queries = batch.map(pair => pair[0]);
			const documents = batch.map(pair => pair[1]);

			// Tokenize the batch with proper cross-encoder format
			// For cross-encoders, we need to pass text_pair parameter
			const inputs = await this.tokenizer(queries, documents, {
				padding: true,
				truncation: true,
				return_tensors: 'pt',
				max_length: 512
			});

			// Run inference
			const outputs = await this.model(inputs);

			// Extract relevance scores from logits
			// For binary classification, we typically use the positive class logit
			const batchScores = outputs.logits.data;

			// Extract scores (assuming logits shape is [batch_size, num_classes])
			for (let j = 0; j < batch.length; j++) {
				// Take the score for the positive class (index 1 for binary classification)
				// If the model outputs a single logit, use it directly
				const scoreIndex = j * 2 + 1; // Assuming 2 classes, take positive class
				scores.push(batchScores[scoreIndex] || batchScores[j] || 0);
			}

			this.logService.info(`Processed batch ${Math.floor(i / this.BATCH_SIZE) + 1}/${Math.ceil(pairs.length / this.BATCH_SIZE)}`);
		}

		// Combine with original results and sort by relevance
		const reranked = validDocuments.map((doc, idx) => ({
			chunkId: doc.id,
			relevanceScore: scores[idx],
			originalScore: doc.score,
			text: doc.text
		}));

		const sortedResults = reranked
			.sort((a, b) => b.relevanceScore - a.relevanceScore)
			.slice(0, topN);

		this.logService.info(`Reranking complete. Top result relevance score: ${sortedResults[0]?.relevanceScore.toFixed(4)}`);

		return sortedResults;
	}

	/**
	 * Check if the reranker is initialized
	 */
	isInitialized(): boolean {
		return this.initialized;
	}

	/**
	 * Get the model name
	 */
	getModelName(): string {
		return this.MODEL_NAME;
	}
}


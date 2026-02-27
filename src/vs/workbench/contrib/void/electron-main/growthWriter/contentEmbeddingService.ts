/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILogService } from '../../../../../platform/log/common/log.js';
import { LocalEmbeddingService } from '../../common/rag/ragLocalEmbeddings.js';
import { SEMANTIC_SIMILARITY_THRESHOLD } from '../../common/growthWriter/growthWriterConfig.js';

export interface SemanticDuplicateResult {
	isDuplicate: boolean
	mostSimilar: { title: string; similarity: number } | null
}

/**
 * Content embedding service for semantic deduplication of blog ideas.
 * Runs in electron-main using LocalEmbeddingService (Xenova/all-MiniLM-L6-v2).
 * Vectors are pre-normalized so dot product equals cosine similarity.
 */
export class ContentEmbeddingService {
	private embeddingService: LocalEmbeddingService
	private initPromise: Promise<void> | null = null

	constructor(
		private readonly appDataPath: string,
		private readonly logService: ILogService,
	) {
		this.embeddingService = new LocalEmbeddingService(logService)
	}

	private async ensureInitialized(): Promise<void> {
		if (this.embeddingService.isInitialized()) return

		if (!this.initPromise) {
			const path = await import('path')
			const cachePath = path.join(this.appDataPath, 'growthWriter', 'model-cache')
			this.logService.info(`[ContentEmbeddingService] Initializing with cache at: ${cachePath}`)
			this.initPromise = this.embeddingService.initialize(cachePath)
		}

		await this.initPromise
	}

	async checkSemanticDuplicate(newTitle: string, existingTitles: string[]): Promise<SemanticDuplicateResult> {
		if (existingTitles.length === 0) {
			return { isDuplicate: false, mostSimilar: null }
		}

		await this.ensureInitialized()

		const newEmbedding = await this.embeddingService.generateEmbedding(newTitle)
		const existingEmbeddings = await this.embeddingService.generateEmbeddings(existingTitles)

		let maxSimilarity = 0
		let mostSimilarIdx = -1

		for (let i = 0; i < existingEmbeddings.length; i++) {
			const sim = this.dotSimilarity(newEmbedding, existingEmbeddings[i])
			if (sim > maxSimilarity) {
				maxSimilarity = sim
				mostSimilarIdx = i
			}
		}

		return {
			isDuplicate: maxSimilarity >= SEMANTIC_SIMILARITY_THRESHOLD,
			mostSimilar: mostSimilarIdx >= 0
				? { title: existingTitles[mostSimilarIdx], similarity: maxSimilarity }
				: null,
		}
	}

	// Dot product for pre-normalized vectors (equivalent to cosine similarity)
	private dotSimilarity(a: Float32Array, b: Float32Array): number {
		if (a.length !== b.length) return 0
		let dot = 0
		for (let i = 0; i < a.length; i++) {
			dot += a[i] * b[i]
		}
		return dot
	}
}

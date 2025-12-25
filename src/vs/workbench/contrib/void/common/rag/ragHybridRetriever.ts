/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILogService } from '../../../../../platform/log/common/log.js';
import type { RAGIndexService } from '../../electron-main/rag/ragIndexService.js';
import { RAGStorageScope } from './ragServiceTypes.js';
import type { VectorAdapter } from './ragVectorAdapter.js';

export interface HybridSearchResult {
	chunkId: string;
	bm25Score: number;
	semanticScore: number;
	fusedScore: number;
	metadata: Record<string, any>;
}

/**
 * Hybrid retriever combining BM25 keyword search with vector semantic search
 * using Reciprocal Rank Fusion (RRF)
 */
export class HybridRetriever {
	constructor(
		private vectorAdapter: VectorAdapter,
		private indexService: RAGIndexService,
		private logService: ILogService
	) { }

	/**
	 * Perform hybrid search combining BM25 and vector search
	 * @param query Search query
	 * @param k Number of final results to return
	 * @param scope Search scope
	 * @param rrfK RRF constant (default: 20 for medical/legal precision)
	 * @param bm25K1 BM25 k1 parameter (default: 0.8)
	 * @param bm25B BM25 b parameter (default: 0.5)
	 * @returns Fused results sorted by relevance
	 */
	async search(
		query: string,
		k: number,
		scope: RAGStorageScope,
		rrfK: number = 20,
		bm25K1: number = 0.8,
		bm25B: number = 0.5
	): Promise<HybridSearchResult[]> {
		// Retrieve 3x desired results from each method for better fusion
		const retrievalK = k * 3;

		this.logService.info(`Hybrid search: retrieving ${retrievalK} candidates from each method`);

		// Run searches in parallel for performance
		const [bm25Results, vectorResults] = await Promise.all([
			this.indexService.keywordSearch(query, retrievalK, scope, bm25K1, bm25B),
			this.vectorAdapter.query(query, retrievalK, scope)
		]);

		this.logService.info(`BM25 returned ${bm25Results.length} results, Vector returned ${vectorResults.length} results`);

		// Apply Reciprocal Rank Fusion (RRF)
		return this.fuseResults(bm25Results, vectorResults, k, rrfK);
	}

	/**
	 * Fuse results from BM25 and vector search using Reciprocal Rank Fusion
	 * @param bm25Results Results from keyword search
	 * @param vectorResults Results from vector search
	 * @param k Number of final results
	 * @param rrfK RRF constant (lower = more emphasis on top ranks)
	 * @returns Fused and sorted results
	 */
	private fuseResults(
		bm25Results: Array<{ id: string; score: number }>,
		vectorResults: Array<{ id: string; score: number; metadata: Record<string, any> }>,
		k: number,
		rrfK: number
	): HybridSearchResult[] {
		const fusedScores = new Map<string, HybridSearchResult>();

		// Score from BM25 (keyword-based retrieval)
		bm25Results.forEach((result, rank) => {
			const rrfScore = 1 / (rrfK + rank + 1);
			fusedScores.set(result.id, {
				chunkId: result.id,
				bm25Score: rrfScore,
				semanticScore: 0,
				fusedScore: rrfScore,
				metadata: {}
			});
		});

		// Add/combine with vector scores (semantic search)
		vectorResults.forEach((result, rank) => {
			const rrfScore = 1 / (rrfK + rank + 1);
			const existing = fusedScores.get(result.id);

			if (existing) {
				// Document appears in both rankings (high confidence)
				existing.semanticScore = rrfScore;
				existing.fusedScore = existing.bm25Score + rrfScore;
				existing.metadata = result.metadata;
			} else {
				// Document only in semantic search
				fusedScores.set(result.id, {
					chunkId: result.id,
					bm25Score: 0,
					semanticScore: rrfScore,
					fusedScore: rrfScore,
					metadata: result.metadata
				});
			}
		});

		// Sort by fused score (descending) and return top k
		const sortedResults = Array.from(fusedScores.values())
			.sort((a, b) => b.fusedScore - a.fusedScore)
			.slice(0, k);

		this.logService.info(`RRF fusion produced ${sortedResults.length} results from ${fusedScores.size} unique candidates`);
		this.logService.info(`Top result: BM25=${sortedResults[0]?.bm25Score.toFixed(4)}, Semantic=${sortedResults[0]?.semanticScore.toFixed(4)}, Fused=${sortedResults[0]?.fusedScore.toFixed(4)}`);

		return sortedResults;
	}
}


/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ContextPack, SearchResult } from './ragServiceTypes.js';

export interface IRAGContextService {
	readonly _serviceBrand: undefined;

	assembleContextPack(
		searchResults: SearchResult[],
		maxContextLength?: number
	): ContextPack;
}

export class RAGContextService implements IRAGContextService {
	readonly _serviceBrand: undefined;

	assembleContextPack(
		searchResults: SearchResult[],
		maxContextLength: number = 4000
	): ContextPack {
		if (searchResults.length === 0) {
			return {
				answerContext: '',
				attributions: [],
				totalResults: 0,
				responseTime: 0
			};
		}

		// Sort results by score (highest first)
		const sortedResults = [...searchResults].sort((a, b) => b.score - a.score);

		// Apply MMR-style re-ranking and deduplication
		const deduplicatedResults = this.deduplicateByDocument(sortedResults);

		// Assemble context with length limit
		let contextText = '';
		const attributions: ContextPack['attributions'] = [];

		for (const result of deduplicatedResults) {
			const chunkText = result.snippet;

			// Check if adding this chunk would exceed the limit
			if (contextText.length + chunkText.length > maxContextLength) {
				// Truncate the chunk to fit
				const remainingSpace = maxContextLength - contextText.length;
				if (remainingSpace > 100) { // Only add if there's meaningful space
					const truncatedChunk = chunkText.substring(0, remainingSpace - 3) + '...';
					contextText += truncatedChunk;
					attributions.push({
						docId: result.docId,
						chunkId: result.chunkId,
						filename: result.source.filename,
						rangeHint: `Chunk ${result.source.chunkIndex + 1} (truncated)`,
						score: result.score
					});
				}
				break;
			}

			contextText += (contextText ? '\n\n' : '') + chunkText;
			attributions.push({
				docId: result.docId,
				chunkId: result.chunkId,
				filename: result.source.filename,
				rangeHint: `Chunk ${result.source.chunkIndex + 1}`,
				score: result.score
			});
		}

		return {
			answerContext: contextText,
			attributions,
			totalResults: deduplicatedResults.length,
			responseTime: Date.now() // Simple timing for now
		};
	}

	private deduplicateByDocument(results: SearchResult[]): SearchResult[] {
		const seenDocs = new Set<string>();
		const deduplicated: SearchResult[] = [];

		for (const result of results) {
			if (!seenDocs.has(result.docId)) {
				seenDocs.add(result.docId);
				deduplicated.push(result);
			}
		}

		return deduplicated;
	}

	// Helper method to format context pack for display
	formatContextPack(contextPack: ContextPack): string {
		if (contextPack.totalResults === 0) {
			return 'No relevant documents found.';
		}

		let formatted = `Found ${contextPack.totalResults} relevant document(s):\n\n`;
		formatted += contextPack.answerContext;

		if (contextPack.attributions.length > 0) {
			formatted += '\n\n--- Sources ---\n';
			for (const attribution of contextPack.attributions) {
				formatted += `• ${attribution.filename} (${attribution.rangeHint}) - Score: ${attribution.score.toFixed(3)}\n`;
			}
		}

		return formatted;
	}
}

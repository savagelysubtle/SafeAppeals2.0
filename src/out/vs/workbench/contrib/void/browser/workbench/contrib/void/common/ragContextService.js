/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
export class RAGContextService {
    _serviceBrand;
    assembleContextPack(searchResults, maxContextLength = 4000) {
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
        // Apply minimum similarity threshold (drop irrelevant results)
        const MIN_SIMILARITY_THRESHOLD = 0.15;
        const filteredResults = sortedResults.filter(result => result.score >= MIN_SIMILARITY_THRESHOLD);
        // Apply MMR re-ranking for diversity
        const mmrResults = this.applyMMRReranking(filteredResults, 0.7, 8);
        // Apply deduplication after MMR
        const deduplicatedResults = this.deduplicateByDocument(mmrResults);
        // Assemble context with improved formatting
        let contextText = '';
        const attributions = [];
        for (const result of deduplicatedResults) {
            // Generate 1-line summary for each chunk
            const summary = this.generateChunkSummary(result.snippet);
            const chunkText = result.snippet;
            // Create section marker with summary
            const sectionHeader = `[Section from ${result.source.filename} - Part ${result.source.chunkIndex + 1}]\nSummary: ${summary}\n\n`;
            // Check if adding this chunk would exceed the limit
            const fullChunk = sectionHeader + chunkText;
            if (contextText.length + fullChunk.length > maxContextLength) {
                // Truncate the chunk to fit (cap at ~900 chars per chunk)
                const maxChunkLength = Math.min(900, maxContextLength - contextText.length - sectionHeader.length);
                if (maxChunkLength > 100) { // Only add if there's meaningful space
                    const truncatedChunk = chunkText.substring(0, maxChunkLength - 3) + '...';
                    contextText += (contextText ? '\n\n---\n\n' : '') + sectionHeader + truncatedChunk;
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
            contextText += (contextText ? '\n\n---\n\n' : '') + fullChunk;
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
    deduplicateByDocument(results) {
        const seenDocs = new Set();
        const deduplicated = [];
        for (const result of results) {
            if (!seenDocs.has(result.docId)) {
                seenDocs.add(result.docId);
                deduplicated.push(result);
            }
        }
        return deduplicated;
    }
    /**
     * Apply Maximal Marginal Relevance (MMR) re-ranking for diversity
     * @param results Search results sorted by relevance
     * @param lambda Balance between relevance (1.0) and diversity (0.0)
     * @param maxResults Maximum number of results to return
     */
    applyMMRReranking(results, lambda = 0.7, maxResults = 8) {
        if (results.length === 0)
            return [];
        const selected = [];
        const remaining = [...results];
        // Start with the most relevant result
        selected.push(remaining.shift());
        while (remaining.length > 0 && selected.length < maxResults) {
            let bestScore = -Infinity;
            let bestIndex = -1;
            for (let i = 0; i < remaining.length; i++) {
                const candidate = remaining[i];
                // Calculate relevance score (original similarity)
                const relevanceScore = candidate.score;
                // Calculate max similarity to already selected results
                let maxSimilarity = 0;
                for (const selectedResult of selected) {
                    const similarity = this.calculateChunkSimilarity(candidate.snippet, selectedResult.snippet);
                    maxSimilarity = Math.max(maxSimilarity, similarity);
                }
                // MMR score: λ * relevance - (1-λ) * max_similarity
                const mmrScore = lambda * relevanceScore - (1 - lambda) * maxSimilarity;
                if (mmrScore > bestScore) {
                    bestScore = mmrScore;
                    bestIndex = i;
                }
            }
            if (bestIndex >= 0) {
                selected.push(remaining.splice(bestIndex, 1)[0]);
            }
            else {
                break;
            }
        }
        return selected;
    }
    /**
     * Calculate similarity between two text chunks using simple word overlap
     */
    calculateChunkSimilarity(text1, text2) {
        const words1 = new Set(text1.toLowerCase().split(/\s+/).filter(w => w.length > 2));
        const words2 = new Set(text2.toLowerCase().split(/\s+/).filter(w => w.length > 2));
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        return intersection.size / union.size; // Jaccard similarity
    }
    /**
     * Generate a 1-line summary for a chunk
     */
    generateChunkSummary(text) {
        // Extract first meaningful sentence or phrase
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
        if (sentences.length > 0) {
            const firstSentence = sentences[0].trim();
            // Limit to ~80 characters for summary
            return firstSentence.length > 80 ? firstSentence.substring(0, 77) + '...' : firstSentence;
        }
        // Fallback: first 80 characters
        const trimmed = text.trim();
        return trimmed.length > 80 ? trimmed.substring(0, 77) + '...' : trimmed;
    }
    // Helper method to format context pack for display
    formatContextPack(contextPack) {
        if (contextPack.totalResults === 0) {
            return 'No relevant documents found.';
        }
        // Context is already formatted with section markers in assembleContextPack
        return contextPack.answerContext;
    }
}

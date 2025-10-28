/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ILogService } from '../../../../platform/log/common/log.js';
import { RAGStorageScope } from './ragServiceTypes.js';

export interface SubQuery {
	id: string;
	query: string;
	scope: RAGStorageScope;
	priority: number;
}

export interface ProcessedQuery {
	isComplex: boolean;
	subQueries: SubQuery[];
	suggestedScope: RAGStorageScope;
	processingTime: number;
}

/**
 * Query processor for RAG search
 * Implements rule-based query classification and routing
 *
 * Future enhancement: Add LLM-based decomposition for complex queries
 * using Llama-3.2-1B for advanced multi-hop reasoning
 */
export class QueryProcessor {
	constructor(private logService: ILogService) { }

	/**
	 * Analyze query complexity and decompose if needed
	 * @param query User search query
	 * @returns Processed query with sub-queries and routing information
	 */
	async processQuery(query: string): Promise<ProcessedQuery> {
		const startTime = Date.now();

		// Detect multi-part questions
		const isComplex = this.isComplexQuery(query);

		if (isComplex) {
			this.logService.info(`Complex query detected: "${query}"`);
			return {
				isComplex: true,
				subQueries: this.decompose(query),
				suggestedScope: this.routeQuery(query),
				processingTime: Date.now() - startTime
			};
		}

		// Simple query - direct routing
		return {
			isComplex: false,
			subQueries: [{
				id: 'main',
				query,
				scope: this.routeQuery(query),
				priority: 1
			}],
			suggestedScope: this.routeQuery(query),
			processingTime: Date.now() - startTime
		};
	}

	/**
	 * Check if query is complex (requires decomposition)
	 * Uses rule-based pattern matching for common complexity indicators
	 */
	private isComplexQuery(query: string): boolean {
		const complexityIndicators = [
			/\band\b.*\band\b/i,           // Multiple "and" conjunctions
			/\bor\b.*\bor\b/i,             // Multiple "or" conjunctions
			/\?.*\?/,                      // Multiple question marks
			/first.*then/i,                // Sequential queries
			/what.*and.*how/i,             // Multiple question types
			/\d+\.\s+.*\d+\./,            // Numbered lists (1. ... 2. ...)
			/if\s+.+\s+then/i,            // Conditional logic
			/misclassif/i,                 // Nested concepts (e.g., misclassification)
		];

		return complexityIndicators.some(pattern => pattern.test(query));
	}

	/**
	 * Decompose complex query into simpler sub-queries
	 * Uses rule-based splitting on conjunctions
	 *
	 * Future enhancement: Use Llama-3.2-1B for advanced decomposition
	 */
	private decompose(query: string): SubQuery[] {
		// Simple rule-based decomposition
		const parts = query
			.split(/\band\b|\bor\b/i)
			.map(part => part.trim())
			.filter(part => part.length > 10); // Minimum meaningful query length

		if (parts.length <= 1) {
			// Couldn't decompose - return as single query
			return [{
				id: 'main',
				query,
				scope: this.routeQuery(query),
				priority: 1
			}];
		}

		// Create sub-queries
		return parts.map((part, idx) => ({
			id: `sub_${idx}`,
			query: part.trim(),
			scope: this.routeQuery(part),
			priority: idx + 1
		}));
	}

	/**
	 * Route query to appropriate document scope
	 * Uses keyword matching to determine policy manual vs workspace docs
	 */
	private routeQuery(query: string): RAGStorageScope {
		const lowerQuery = query.toLowerCase();

		// Policy manual keywords
		const policyKeywords = [
			'policy', 'rule', 'regulation', 'guideline', 'procedure',
			'requirement', 'compliance', 'statute', 'code', 'law',
			'eligibility', 'coverage', 'benefit', 'deadline', 'timeframe'
		];

		// Case/workspace keywords
		const caseKeywords = [
			'client', 'claimant', 'case', 'appeal', 'injury',
			'medical', 'treatment', 'diagnosis', 'report', 'investigation',
			'claim', 'incident', 'accident', 'worker', 'employee'
		];

		const hasPolicyKeyword = policyKeywords.some(kw => lowerQuery.includes(kw));
		const hasCaseKeyword = caseKeywords.some(kw => lowerQuery.includes(kw));

		// Determine scope based on keyword presence
		if (hasPolicyKeyword && !hasCaseKeyword) {
			this.logService.info('Query routed to: policy_manual');
			return 'policy_manual';
		}

		if (hasCaseKeyword && !hasPolicyKeyword) {
			this.logService.info('Query routed to: workspace_docs');
			return 'workspace_docs';
		}

		// Ambiguous or no clear keywords - search both
		this.logService.info('Query routed to: both');
		return 'both';
	}

	/**
	 * Extract temporal information from query (dates, deadlines, timeframes)
	 * Useful for workers' compensation deadline queries
	 */
	extractTemporalInfo(query: string): {
		hasDates: boolean;
		dates: string[];
		hasDeadline: boolean;
	} {
		// Match common date formats
		const datePatterns = [
			/\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,  // MM/DD/YYYY or M/D/YY
			/\b\d{4}-\d{2}-\d{2}\b/g,          // YYYY-MM-DD
			/\b[A-Z][a-z]+\s+\d{1,2},?\s+\d{4}\b/g, // Month DD, YYYY
		];

		const dates: string[] = [];
		for (const pattern of datePatterns) {
			const matches = query.match(pattern);
			if (matches) {
				dates.push(...matches);
			}
		}

		const hasDeadline = /deadline|due|within|timeframe|time limit/i.test(query);

		return {
			hasDates: dates.length > 0,
			dates,
			hasDeadline
		};
	}
}


/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

// ============================================================================
// ANTHROPIC CLAUDE MODELS
// https://docs.anthropic.com/en/docs/about-claude/models
// ============================================================================

export const anthropicModelOptions = {
	// Claude 4.1 Series (November 2025) - Enhanced agentic capabilities
	'claude-opus-4.1': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 16_384,
		cost: { input: 15.00, cache_read: 1.50, cache_write: 18.75, output: 75.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 16384,
			maxReasoningBudget: 16384,
		},
	},
	'claude-sonnet-4.1': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 16_384,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 16384,
			maxReasoningBudget: 16384,
		},
	},
	// Claude 4.5 Series
	'claude-sonnet-4-5': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			maxReasoningBudget: 8192,
		},
	},
	'claude-haiku-4-5': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.80, cache_read: 0.08, cache_write: 1.00, output: 4.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
	'claude-opus-4-20250514': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 15.00, cache_read: 1.50, cache_write: 18.75, output: 30.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			maxReasoningBudget: 8192,
		},
	},
	'claude-sonnet-4-20250514': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 6.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			maxReasoningBudget: 8192,
		},
	},
	'claude-3-7-sonnet-20250219': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			maxReasoningBudget: 8192,
		},
	},
	'claude-3-5-sonnet-20241022': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
	'claude-3-5-haiku-20241022': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.80, cache_read: 0.08, cache_write: 1.00, output: 4.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
	'claude-3-opus-20240229': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 4_096,
		cost: { input: 15.00, cache_read: 1.50, cache_write: 18.75, output: 75.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
	'claude-3-sonnet-20240229': {
		contextWindow: 200_000, cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		reservedOutputTokenSpace: 4_096,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
	'claude-3-haiku-20240307': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 4_096,
		cost: { input: 0.25, cache_read: 0.03, cache_write: 0.30, output: 1.25 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

export const anthropicSettings: VoidStaticProviderInfo = {
	providerReasoningIOSettings: {
		input: {
			includeInPayload: (reasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) return null

				if (reasoningInfo.type === 'budget') {
					return { thinking: { type: 'enabled', budget_tokens: reasoningInfo.reasoningBudget } }
				}
				return null
			}
		},
	},
	modelOptions: anthropicModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof anthropicModelOptions | null = null
		// Claude 4.1 series (latest)
		if (lower.includes('claude-opus-4.1') || lower.includes('claude-4.1') && lower.includes('opus')) fallbackName = 'claude-opus-4.1'
		if (lower.includes('claude-sonnet-4.1') || lower.includes('claude-4.1') && lower.includes('sonnet')) fallbackName = 'claude-sonnet-4.1'
		// Claude 4.5 series
		if (lower.includes('claude-4-5') || lower.includes('claude-sonnet-4-5') || lower.includes('claude-4.5')) fallbackName = 'claude-sonnet-4-5'
		if (lower.includes('claude-haiku-4-5') || lower.includes('claude-haiku-4.5')) fallbackName = 'claude-haiku-4-5'
		// Claude 4 series
		if (lower.includes('claude-4') && lower.includes('opus') && !fallbackName) fallbackName = 'claude-opus-4-20250514'
		if (lower.includes('claude-4') && lower.includes('sonnet') && !fallbackName) fallbackName = 'claude-sonnet-4-20250514'
		// Claude 3.x series
		if (lower.includes('claude-3-7-sonnet')) fallbackName = 'claude-3-7-sonnet-20250219'
		if (lower.includes('claude-3-5-sonnet')) fallbackName = 'claude-3-5-sonnet-20241022'
		if (lower.includes('claude-3-5-haiku')) fallbackName = 'claude-3-5-haiku-20241022'
		if (lower.includes('claude-3-opus')) fallbackName = 'claude-3-opus-20240229'
		if (lower.includes('claude-3-sonnet')) fallbackName = 'claude-3-sonnet-20240229'
		if (lower.includes('claude-3-haiku')) fallbackName = 'claude-3-haiku-20240307'
		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...anthropicModelOptions[fallbackName] }
		return null
	},
}


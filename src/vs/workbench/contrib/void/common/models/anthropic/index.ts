/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

// ============================================================================
// ANTHROPIC CLAUDE MODELS
// https://www.anthropic.com/pricing
// Synced with LiteLLM config - December 2025
// ============================================================================

export const anthropicModelOptions = {
	// Claude Opus 4.5 - Premium flagship model
	'claude-opus-4-5': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 16_384,
		cost: { input: 5.00, cache_read: 0.50, cache_write: 6.25, output: 25.00 },
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
	// Claude Sonnet 4.5 - Best balance of intelligence and speed
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
} as const satisfies { [s: string]: VoidStaticModelInfo }

// Display name mapping for UI
export const anthropicDisplayNames: { [displayName: string]: keyof typeof anthropicModelOptions } = {
	'Claude Opus 4.5': 'claude-opus-4-5',
	'Claude Sonnet 4.5': 'claude-sonnet-4-5',
}

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

		// Opus 4.5 variants (handles claude-opus-4-5-20251022 etc)
		if (lower.includes('opus-4-5') || lower.includes('opus-4.5') || lower.includes('opus 4.5')) {
			fallbackName = 'claude-opus-4-5'
		}
		// Sonnet 4.5 variants (handles claude-sonnet-4-5-20250929 etc)
		else if (lower.includes('sonnet-4-5') || lower.includes('sonnet-4.5') || lower.includes('sonnet 4.5')) {
			fallbackName = 'claude-sonnet-4-5'
		}

		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...anthropicModelOptions[fallbackName] }
		return null
	},
}

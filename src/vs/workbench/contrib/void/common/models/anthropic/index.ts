/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

// ============================================================================
// ANTHROPIC CLAUDE MODELS
// https://docs.anthropic.com/en/docs/about-claude/models
// Synced with LiteLLM config - December 2024
// Model names are shorthand (matching LiteLLM model_name for routing)
// ============================================================================

export const anthropicModelOptions = {
	// Claude Opus 4.5 - Premium flagship model
	'claude-opus-4.5': {
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
	// Claude Sonnet 4.5 - Best balance of intelligence and speed
	'claude-sonnet-4.5': {
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
	// Claude Opus 4.1 - Enhanced agentic capabilities
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
	// Claude Sonnet 4 - Stable production model
	'claude-sonnet-4': {
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
	// Claude Haiku 4.5 - Fast and affordable
	'claude-haiku-4.5': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.80, cache_read: 0.08, cache_write: 1.00, output: 4.00 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

// Display name mapping for UI (readable name → model ID for API)
export const anthropicDisplayNames: { [displayName: string]: keyof typeof anthropicModelOptions } = {
	'Claude Opus 4.5': 'claude-opus-4.5',
	'Claude Sonnet 4.5': 'claude-sonnet-4.5',
	'Claude Opus 4.1': 'claude-opus-4.1',
	'Claude Sonnet 4': 'claude-sonnet-4',
	'Claude Haiku 4.5': 'claude-haiku-4.5',
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

		// Opus 4.5 variants
		if (lower.includes('opus-4-5') || lower.includes('opus-4.5') || lower.includes('opus 4.5')) {
			fallbackName = 'claude-opus-4.5'
		}
		// Sonnet 4.5 variants
		else if (lower.includes('sonnet-4-5') || lower.includes('sonnet-4.5') || lower.includes('sonnet 4.5')) {
			fallbackName = 'claude-sonnet-4.5'
		}
		// Opus 4.1 variants
		else if (lower.includes('opus-4-1') || lower.includes('opus-4.1') || lower.includes('opus 4.1')) {
			fallbackName = 'claude-opus-4.1'
		}
		// Haiku 4.5 variants
		else if (lower.includes('haiku-4-5') || lower.includes('haiku-4.5') || lower.includes('haiku 4.5')) {
			fallbackName = 'claude-haiku-4.5'
		}
		// Sonnet 4 variants (must come after 4.5 checks)
		else if (lower.includes('sonnet-4') || lower.includes('sonnet 4')) {
			fallbackName = 'claude-sonnet-4'
		}

		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...anthropicModelOptions[fallbackName] }
		return null
	},
}

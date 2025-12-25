/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { SendableReasoningInfo, VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

// ============================================================================
// ANTHROPIC CLAUDE MODELS
// https://www.anthropic.com/pricing
// https://docs.litellm.ai/docs/providers/anthropic
// Synced with LiteLLM config - December 2025
//
// NOTE: Opus 4.5 supports reasoning_effort -> output_config.effort ("high")
//       Sonnet 4.5 uses thinking.budget_tokens
//       max_tokens must be > thinking.budget_tokens per Anthropic API
// ============================================================================

// Helper for Anthropic reasoning payload
const anthropicIncludeInPayloadReasoning = (reasoningInfo: SendableReasoningInfo) => {
	if (!reasoningInfo?.isReasoningEnabled) return null

	// For effort-based (Opus 4.5): send reasoning_effort which LiteLLM maps to output_config.effort
	if (reasoningInfo.type === 'effort') {
		return { reasoning_effort: reasoningInfo.reasoningEffort }
	}
	// For budget-based (Sonnet 4.5): send thinking budget
	if (reasoningInfo.type === 'budget') {
		return { thinking: { type: 'enabled', budget_tokens: reasoningInfo.reasoningBudget } }
	}
	return null
}

export const anthropicModelOptions = {
	// Claude Opus 4.5 - Premium flagship model
	// Uses reasoning_effort -> output_config.effort (effort-based)
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
			maxReasoningEffort: 'high',  // Opus 4.5 supports effort-based
			reasoningReservedOutputTokenSpace: 32_768,
		},
	},
	// Claude Sonnet 4.5 - Best balance of intelligence and speed
	// Uses thinking.budget_tokens (budget-based)
	// NOTE: max_tokens must be > thinking.budget_tokens per Anthropic API
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
			maxReasoningBudget: 8_192,  // Sonnet 4.5 uses budget-based
			reasoningReservedOutputTokenSpace: 16_384,  // must be > maxReasoningBudget
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
		input: { includeInPayload: anthropicIncludeInPayloadReasoning },
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

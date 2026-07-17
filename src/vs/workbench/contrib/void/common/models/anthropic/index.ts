/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { SendableReasoningInfo, VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

// ============================================================================
// ANTHROPIC CLAUDE MODELS
// https://www.anthropic.com/pricing
// https://docs.anthropic.com/en/docs/build-with-claude/extended-thinking
//
// TWO IMPLEMENTATIONS:
// 1. Native Anthropic SDK: Uses `thinking.budget_tokens` (stable API)
// 2. LiteLLM Proxy: Uses `reasoning_effort` which LiteLLM maps to `output_config.effort`
//
// Opus 4.6/4.5 and Sonnet 4.6/4.5 support extended thinking:
// - Opus 4.6/4.5: effort-based (adaptive thinking)
// - Sonnet 4.6/4.5: budget-based (extended thinking)
// max_tokens must be > thinking.budget_tokens per Anthropic API
// ============================================================================

// Map effort levels to approximate token budgets for native SDK
// These values are based on Anthropic's documentation and common usage
const effortToBudgetTokens: Record<string, number> = {
	'low': 8_192,
	'medium': 16_384,
	'high': 32_768,
}

// ============================================================================
// NATIVE ANTHROPIC SDK IMPLEMENTATION
// Uses `thinking.budget_tokens` format (stable, no beta header required)
// ============================================================================
const anthropicNativeIncludeInPayloadReasoning = (reasoningInfo: SendableReasoningInfo) => {
	if (!reasoningInfo?.isReasoningEnabled) return null

	// For effort-based (Opus 4.5): convert effort to budget_tokens
	// The native Anthropic API uses `thinking.budget_tokens`, not `reasoning_effort`
	if (reasoningInfo.type === 'effort') {
		const budgetTokens = effortToBudgetTokens[reasoningInfo.reasoningEffort] ?? 16_384
		const payload = { thinking: { type: 'enabled', budget_tokens: budgetTokens } }
		console.log('[Anthropic Native] Effort-based reasoning payload:', JSON.stringify(payload))
		return payload
	}
	// For budget-based (Sonnet 4.5): send thinking budget directly
	if (reasoningInfo.type === 'budget') {
		const payload = { thinking: { type: 'enabled', budget_tokens: reasoningInfo.reasoningBudget } }
		console.log('[Anthropic Native] Budget-based reasoning payload:', JSON.stringify(payload))
		return payload
	}
	return null
}

// ============================================================================
// LITELLM PROXY IMPLEMENTATION
// Uses `reasoning_effort` which LiteLLM maps to Anthropic's `output_config.effort`
// See: https://docs.litellm.ai/docs/providers/anthropic#effort-parameter
// ============================================================================
export const anthropicLiteLLMIncludeInPayloadReasoning = (reasoningInfo: SendableReasoningInfo) => {
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
	// Claude Opus 4.6 - Most intelligent model for agents and coding (Feb 2026)
	// Effort-based reasoning: effort levels converted to thinking.budget_tokens
	// max_tokens must be > thinking.budget_tokens (high=32K, so we need >32K)
	'claude-opus-4-6': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 16_384,
		cost: { input: 5.00, cache_read: 0.50, cache_write: 6.25, output: 25.00 },
		downloadable: false,
		supportsFIM: false,
		supportsVision: true,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			maxReasoningEffort: 'high',
			reasoningReservedOutputTokenSpace: 40_960,
		},
	},
	// Claude Sonnet 4.6 - Best balance of speed and intelligence (Feb 2026)
	// Uses thinking.budget_tokens (budget-based)
	// NOTE: max_tokens must be > thinking.budget_tokens per Anthropic API
	'claude-sonnet-4-6': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsVision: true,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			maxReasoningBudget: 8_192,
			reasoningReservedOutputTokenSpace: 16_384,
		},
	},
	// Claude Opus 4.5 - Premium flagship model (legacy)
	// Effort-based reasoning: effort levels converted to thinking.budget_tokens
	// max_tokens must be > thinking.budget_tokens (high=32K, so we need >32K)
	'claude-opus-4-5': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 16_384,
		cost: { input: 5.00, cache_read: 0.50, cache_write: 6.25, output: 25.00 },
		downloadable: false,
		supportsFIM: false,
		supportsVision: true,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			maxReasoningEffort: 'high',
			reasoningReservedOutputTokenSpace: 40_960,
		},
	},
	// Claude Sonnet 4.5 - Best balance of intelligence and speed (legacy)
	// Uses thinking.budget_tokens (budget-based)
	// NOTE: max_tokens must be > thinking.budget_tokens per Anthropic API
	'claude-sonnet-4-5': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 3.00, cache_read: 0.30, cache_write: 3.75, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsVision: true,
		specialToolFormat: 'anthropic-style',
		supportsSystemMessage: 'separated',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			maxReasoningBudget: 8_192,
			reasoningReservedOutputTokenSpace: 16_384,
		},
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

// Display name mapping for UI
export const anthropicDisplayNames: { [displayName: string]: keyof typeof anthropicModelOptions } = {
	'Claude Opus 4.6': 'claude-opus-4-6',
	'Claude Sonnet 4.6': 'claude-sonnet-4-6',
	'Claude Opus 4.5': 'claude-opus-4-5',
	'Claude Sonnet 4.5': 'claude-sonnet-4-5',
}

export const anthropicSettings: VoidStaticProviderInfo = {
	providerReasoningIOSettings: {
		// Uses native SDK format: thinking.budget_tokens
		input: { includeInPayload: anthropicNativeIncludeInPayloadReasoning },
	},
	modelOptions: anthropicModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof anthropicModelOptions | null = null

		// Opus 4.6 variants
		if (lower.includes('opus-4-6') || lower.includes('opus-4.6') || lower.includes('opus 4.6')) {
			fallbackName = 'claude-opus-4-6'
		}
		// Sonnet 4.6 variants
		else if (lower.includes('sonnet-4-6') || lower.includes('sonnet-4.6') || lower.includes('sonnet 4.6')) {
			fallbackName = 'claude-sonnet-4-6'
		}
		// Opus 4.5 variants (handles claude-opus-4-5-20251022 etc)
		else if (lower.includes('opus-4-5') || lower.includes('opus-4.5') || lower.includes('opus 4.5')) {
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

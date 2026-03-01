/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { SendableReasoningInfo, VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

// ============================================================================
// GOOGLE GEMINI MODELS
// https://ai.google.dev/gemini-api/docs/models
// https://docs.litellm.ai/docs/providers/gemini
// Synced with LiteLLM config - December 2025
// Pricing uses ≤200K context tier (higher tiers cost more)
//
// NOTE: Gemini 3+ uses thinking_level ("low"/"high") via reasoning_effort
//       Gemini 2.5 uses thinking.budget_tokens
// ============================================================================

// Helper for Gemini reasoning payload
const geminiIncludeInPayloadReasoning = (reasoningInfo: SendableReasoningInfo) => {
	if (!reasoningInfo?.isReasoningEnabled) return null

	// For effort-based (Gemini 3+): send reasoning_effort which LiteLLM maps to thinking_level
	if (reasoningInfo.type === 'effort') {
		return { reasoning_effort: reasoningInfo.reasoningEffort }
	}
	// For budget-based (Gemini 2.5): send thinking budget
	if (reasoningInfo.type === 'budget') {
		return { thinking: { type: 'enabled', budget_tokens: reasoningInfo.reasoningBudget } }
	}
	return null
}

export const geminiModelOptions = {
	// Gemini 3.1 Pro Preview - Latest flagship (preview)
	// Uses thinking_level ("low"/"high") via reasoning_effort parameter
	'gemini-3.1-pro-preview': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 65_536,
		cost: { input: 2.00, output: 12.00 },
		downloadable: false,
		supportsFIM: false,
		supportsVision: true, // Gemini 3 Pro supports vision/images
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			maxReasoningEffort: 'high',  // Gemini 3+ uses effort-based ("low"/"high")
			reasoningReservedOutputTokenSpace: 32_768,
		},
	},
	// Gemini 2.5 Pro - Production ready
	// Uses thinking.budget_tokens
	'gemini-2.5-pro': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 65_536,
		cost: { input: 1.25, output: 10.00 },
		downloadable: false,
		supportsFIM: false,
		supportsVision: true, // Gemini 2.5 Pro supports vision/images
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			maxReasoningBudget: 24_576,  // Gemini 2.5 uses budget-based
			reasoningReservedOutputTokenSpace: 32_768,
		},
	},
	// Gemini 2.5 Flash - Fast and affordable
	// Uses thinking.budget_tokens
	'gemini-2.5-flash': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 65_536,
		cost: { input: 0.15, output: 0.60 },
		downloadable: false,
		supportsFIM: false,
		supportsVision: true, // Gemini 2.5 Flash supports vision/images
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			maxReasoningBudget: 24_576,  // Gemini 2.5 uses budget-based
			reasoningReservedOutputTokenSpace: 32_768,
		},
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

// Display name mapping for UI
export const geminiDisplayNames: { [displayName: string]: keyof typeof geminiModelOptions } = {
	'Gemini 3.1 Pro': 'gemini-3.1-pro-preview',
	'Gemini 2.5 Pro': 'gemini-2.5-pro',
	'Gemini 2.5 Flash': 'gemini-2.5-flash',
}

export const geminiSettings: VoidStaticProviderInfo = {
	providerReasoningIOSettings: {
		input: { includeInPayload: geminiIncludeInPayloadReasoning },
	},
	modelOptions: geminiModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof geminiModelOptions | null = null

		// Gemini 3.1 series (handles gemini-3.1-pro-preview etc)
		if (lower.includes('gemini-3') || lower.includes('gemini 3')) {
			fallbackName = 'gemini-3.1-pro-preview'
		}
		// Gemini 2.5 series
		else if (lower.includes('2.5') && lower.includes('flash')) {
			fallbackName = 'gemini-2.5-flash'
		} else if (lower.includes('2.5') && lower.includes('pro')) {
			fallbackName = 'gemini-2.5-pro'
		}

		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...geminiModelOptions[fallbackName] }
		return null
	},
}

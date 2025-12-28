/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { SendableReasoningInfo, VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

// ============================================================================
// OPENAI GPT MODELS
// https://platform.openai.com/docs/pricing
// Synced with LiteLLM config - December 2025
// ============================================================================

// Helper for reasoning payload
const openAICompatIncludeInPayloadReasoning = (reasoningInfo: SendableReasoningInfo) => {
	if (!reasoningInfo?.isReasoningEnabled) return null
	if (reasoningInfo.type === 'effort') {
		return { reasoning_effort: reasoningInfo.reasoningEffort }
	}
	return null
}

export const openAIModelOptions = {
	// GPT-5.2 - Flagship model for coding and agentic tasks (Dec 2025)
	// Uses reasoning_effort: "low" | "medium" | "high"
	'gpt-5.2': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 16_384,
		cost: { input: 1.75, output: 14.00, cache_read: 0.175 },
		downloadable: false,
		supportsFIM: false,
		supportsVision: true, // GPT-5.2 supports vision/images
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			maxReasoningEffort: 'high',
			reasoningReservedOutputTokenSpace: 32_768,
		},
	},
	// GPT-5 - Previous intelligent reasoning model (Aug 2025)
	// Uses reasoning_effort: "low" | "medium" | "high"
	'gpt-5': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 16_384,
		cost: { input: 1.25, output: 10.00, cache_read: 0.125 },
		downloadable: false,
		supportsFIM: false,
		supportsVision: true, // GPT-5 supports vision/images
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			maxReasoningEffort: 'high',
			reasoningReservedOutputTokenSpace: 32_768,
		},
	},
	// GPT-5.1 Codex Max - Most intelligent coding model for long-horizon agentic tasks
	// Uses reasoning_effort: "low" | "medium" | "high"
	'gpt-5.1-codex-max': {
		contextWindow: 192_000,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 1.25, output: 10.00, cache_read: 0.125 },
		downloadable: false,
		supportsFIM: true,
		supportsVision: true, // GPT-5.1 Codex Max supports vision/images
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			maxReasoningEffort: 'high',
			reasoningReservedOutputTokenSpace: 64_768,
		},
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

// Display name mapping for UI
export const openAIDisplayNames: { [displayName: string]: keyof typeof openAIModelOptions } = {
	'GPT-5.2': 'gpt-5.2',
	'GPT-5': 'gpt-5',
	'GPT-5.1 Codex Max': 'gpt-5.1-codex-max',
}

export const openAISettings: VoidStaticProviderInfo = {
	modelOptions: openAIModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof openAIModelOptions | null = null

		// GPT-5.2 variants
		if (lower.includes('gpt-5.2') || lower.includes('gpt5.2')) {
			fallbackName = 'gpt-5.2'
		}
		// GPT-5.1 Codex Max
		else if (lower.includes('gpt-5.1-codex-max') || lower.includes('codex-max')) {
			fallbackName = 'gpt-5.1-codex-max'
		}
		// GPT-5 variants
		else if (lower.includes('gpt-5') || lower.includes('gpt5')) {
			fallbackName = 'gpt-5'
		}
		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...openAIModelOptions[fallbackName] }
		return null
	},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}

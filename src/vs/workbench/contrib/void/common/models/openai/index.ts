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
	'gpt-5.2': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 16_384,
		cost: { input: 1.75, output: 14.00, cache_read: 0.175 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true },
	},
	// GPT-5.2 Pro - Premium tier for complex reasoning (400K context)
	'gpt-5.2-pro': {
		contextWindow: 400_000,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 21.00, output: 168.00, cache_read: 2.10 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true },
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

// Display name mapping for UI
export const openAIDisplayNames: { [displayName: string]: keyof typeof openAIModelOptions } = {
	'GPT-5.2': 'gpt-5.2',
	'GPT-5.2 Pro': 'gpt-5.2-pro',
}

export const openAISettings: VoidStaticProviderInfo = {
	modelOptions: openAIModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof openAIModelOptions | null = null

		// GPT-5.2 variants (check most specific first)
		if (lower.includes('gpt-5.2-pro') || lower.includes('gpt-5.2 pro')) {
			fallbackName = 'gpt-5.2-pro'
		} else if (lower.includes('gpt-5.2') || lower.includes('gpt5.2')) {
			fallbackName = 'gpt-5.2'
		}
		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...openAIModelOptions[fallbackName] }
		return null
	},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { SendableReasoningInfo, VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

// ============================================================================
// OPENAI GPT MODELS
// https://platform.openai.com/docs/pricing
// Synced with LiteLLM config - December 2024
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
	// GPT-5.2 Series - Latest flagship (December 2024)
	'gpt-5.2': {
		contextWindow: 400_000,
		reservedOutputTokenSpace: 128_000,
		cost: { input: 1.75, output: 14.00, cache_read: 0.44 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true },
	},
	'gpt-5.2-2025-12-11': {
		contextWindow: 400_000,
		reservedOutputTokenSpace: 128_000,
		cost: { input: 1.75, output: 14.00, cache_read: 0.44 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true },
	},
	// GPT-5 Series - Previous flagship
	'gpt-5': {
		contextWindow: 400_000,
		reservedOutputTokenSpace: 128_000,
		cost: { input: 1.25, output: 10.00, cache_read: 0.31 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true },
	},
	'gpt-5-2025-08-07': {
		contextWindow: 400_000,
		reservedOutputTokenSpace: 128_000,
		cost: { input: 1.25, output: 10.00, cache_read: 0.31 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true },
	},
	'gpt-5-mini': {
		contextWindow: 400_000,
		reservedOutputTokenSpace: 128_000,
		cost: { input: 0.25, output: 2.00, cache_read: 0.06 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
	'gpt-5-nano': {
		contextWindow: 400_000,
		reservedOutputTokenSpace: 128_000,
		cost: { input: 0.05, output: 0.40, cache_read: 0.01 },
		downloadable: false,
		supportsFIM: false,
		specialToolFormat: 'openai-style',
		supportsSystemMessage: 'developer-role',
		reasoningCapabilities: false,
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

// Display name mapping for UI (shorthand → API name)
export const openAIDisplayNames: { [displayName: string]: keyof typeof openAIModelOptions } = {
	'GPT-5.2': 'gpt-5.2',
	'GPT-5.2 (2025-12-11)': 'gpt-5.2-2025-12-11',
	'GPT-5': 'gpt-5',
	'GPT-5 (2025-08-07)': 'gpt-5-2025-08-07',
	'GPT-5 Mini': 'gpt-5-mini',
	'GPT-5 Nano': 'gpt-5-nano',
}

export const openAISettings: VoidStaticProviderInfo = {
	modelOptions: openAIModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof openAIModelOptions | null = null

		// GPT-5.2 variants (check specific first)
		if (lower.includes('gpt-5.2-2025-12-11')) {
			fallbackName = 'gpt-5.2-2025-12-11'
		} else if (lower.includes('gpt-5.2')) {
			fallbackName = 'gpt-5.2'
		}
		// GPT-5 variants
		else if (lower.includes('gpt-5-2025-08-07')) {
			fallbackName = 'gpt-5-2025-08-07'
		} else if (lower.includes('gpt-5-nano') || lower.includes('gpt-5 nano')) {
			fallbackName = 'gpt-5-nano'
		} else if (lower.includes('gpt-5-mini') || lower.includes('gpt-5 mini')) {
			fallbackName = 'gpt-5-mini'
		} else if (lower.includes('gpt-5')) {
			fallbackName = 'gpt-5'
		}

		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...openAIModelOptions[fallbackName] }
		return null
	},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}

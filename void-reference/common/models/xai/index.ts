/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo, SendableReasoningInfo } from '../types.js';

// ============================================================================
// XAI GROK MODELS
// https://docs.x.ai/docs/models
// ============================================================================

// Helper for reasoning payload (same as OpenAI)
const openAICompatIncludeInPayloadReasoning = (reasoningInfo: SendableReasoningInfo) => {
	if (!reasoningInfo?.isReasoningEnabled) return null
	if (reasoningInfo.type === 'effort') {
		return { reasoning_effort: reasoningInfo.reasoningEffort }
	}
	return null
}

export const xAIModelOptions = {
	'grok-2': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 2.00, output: 10.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
	'grok-3': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
	'grok-3-fast': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 5.00, output: 25.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: false,
	},
	'grok-3-mini': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 0.30, output: 0.50 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, maxReasoningEffort: 'high' },
	},
	'grok-3-mini-fast': {
		contextWindow: 131_072,
		reservedOutputTokenSpace: null,
		cost: { input: 0.60, output: 4.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		specialToolFormat: 'openai-style',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, maxReasoningEffort: 'high' },
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

export const xAISettings: VoidStaticProviderInfo = {
	modelOptions: xAIModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof xAIModelOptions | null = null
		if (lower.includes('grok-2')) fallbackName = 'grok-2'
		if (lower.includes('grok-3')) fallbackName = 'grok-3'
		if (lower.includes('grok')) fallbackName = 'grok-3'
		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...xAIModelOptions[fallbackName] }
		return null
	},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}


/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo, SendableReasoningInfo } from '../types.js';

// ============================================================================
// GROQ MODELS
// https://console.groq.com/docs/models
// https://groq.com/pricing/
// ============================================================================

export const groqModelOptions = {
	'llama-3.3-70b-versatile': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 32_768,
		cost: { input: 0.59, output: 0.79 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'llama-3.1-8b-instant': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0.05, output: 0.08 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwen-2.5-coder-32b': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.79, output: 0.79 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwen-qwq-32b': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.29, output: 0.39 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

export const groqSettings: VoidStaticProviderInfo = {
	modelOptions: groqModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		input: {
			includeInPayload: (reasoningInfo: SendableReasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) return null
				if (reasoningInfo.type === 'budget') {
					return { reasoning_format: 'parsed' }
				}
				return null
			}
		},
		output: { nameOfFieldInDelta: 'reasoning' },
	},
}


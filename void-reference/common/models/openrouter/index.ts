/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo, SendableReasoningInfo } from '../types.js';
import { openSourceModelOptions_assumingOAICompat, createExtensiveModelOptionsFallback } from '../utils.js';
import { anthropicModelOptions } from '../anthropic/index.js';
import { geminiModelOptions } from '../google/index.js';
import { openAIModelOptions } from '../openai/index.js';
import { xAIModelOptions } from '../xai/index.js';

// ============================================================================
// OPENROUTER MODELS
// https://openrouter.ai/models
// ============================================================================

export const openRouterModelOptions_assumingOpenAICompat = {
	'qwen/qwen3-235b-a22b': {
		contextWindow: 40_960,
		reservedOutputTokenSpace: null,
		cost: { input: .10, output: .10 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true },
	},
	'microsoft/phi-4-reasoning-plus:free': {
		contextWindow: 32_768,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true },
	},
	'mistralai/mistral-small-3.1-24b-instruct:free': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-flash-lite-preview-02-05:free': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-pro-exp-02-05:free': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'google/gemini-2.0-flash-exp:free': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'deepseek/deepseek-r1': {
		...openSourceModelOptions_assumingOAICompat.deepseekR1,
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.8, output: 2.4 },
		downloadable: false,
	},
	'deepseek/deepseek-r1-zero:free': {
		...openSourceModelOptions_assumingOAICompat.deepseekR1,
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
	},
	'anthropic/claude-opus-4': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 15.00, output: 75.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'anthropic/claude-sonnet-4': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 15.00, output: 75.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'anthropic/claude-3.7-sonnet:thinking': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			reasoningReservedOutputTokenSpace: 8192,
			maxReasoningBudget: 8192,
		},
	},
	'anthropic/claude-3.7-sonnet': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'anthropic/claude-3.5-sonnet': {
		contextWindow: 200_000,
		reservedOutputTokenSpace: null,
		cost: { input: 3.00, output: 15.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'mistralai/codestral-2501': {
		...openSourceModelOptions_assumingOAICompat.codestral,
		contextWindow: 256_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.3, output: 0.9 },
		downloadable: false,
		reasoningCapabilities: false,
	},
	'mistralai/devstral-small:free': {
		...openSourceModelOptions_assumingOAICompat.devstral,
		contextWindow: 130_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: false,
		reasoningCapabilities: false,
	},
	'qwen/qwen-2.5-coder-32b-instruct': {
		...openSourceModelOptions_assumingOAICompat['qwen2.5coder'],
		contextWindow: 33_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.07, output: 0.16 },
		downloadable: false,
	},
	'qwen/qwq-32b': {
		...openSourceModelOptions_assumingOAICompat['qwq'],
		contextWindow: 33_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0.07, output: 0.16 },
		downloadable: false,
	}
} as const satisfies { [s: string]: VoidStaticModelInfo }

const extensiveModelOptionsFallback = createExtensiveModelOptionsFallback({
	anthropic: anthropicModelOptions,
	gemini: geminiModelOptions,
	openai: openAIModelOptions,
	xai: xAIModelOptions,
});

export const openRouterSettings: VoidStaticProviderInfo = {
	modelOptions: openRouterModelOptions_assumingOpenAICompat,
	modelOptionsFallback: (modelName) => {
		const res = extensiveModelOptionsFallback(modelName)
		// openRouter does not support gemini-style, use openai-style instead
		if (res?.specialToolFormat === 'gemini-style') {
			res.specialToolFormat = 'openai-style'
		}
		return res
	},
	providerReasoningIOSettings: {
		input: {
			includeInPayload: (reasoningInfo: SendableReasoningInfo) => {
				if (!reasoningInfo?.isReasoningEnabled) return null

				if (reasoningInfo.type === 'budget') {
					return {
						reasoning: {
							max_tokens: reasoningInfo.reasoningBudget
						}
					}
				}
				if (reasoningInfo.type === 'effort')
					return {
						reasoning: {
							effort: reasoningInfo.reasoningEffort
						}
					}
				return null
			}
		},
		output: { nameOfFieldInDelta: 'reasoning' },
	},
}


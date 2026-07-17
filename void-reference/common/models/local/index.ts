/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';
import { createExtensiveModelOptionsFallback, openAICompatIncludeInPayloadReasoning } from '../utils.js';
import { anthropicModelOptions } from '../anthropic/index.js';
import { geminiModelOptions } from '../google/index.js';
import { openAIModelOptions } from '../openai/index.js';
import { xAIModelOptions } from '../xai/index.js';

// ============================================================================
// LOCAL/SELF-HOSTED PROVIDERS
// Ollama, vLLM, LM Studio, OpenAI Compatible, LiteLLM, Google Vertex, Azure, AWS Bedrock
// ============================================================================

// Ollama models
export const ollamaModelOptions = {
	'qwen2.5-coder:7b': {
		contextWindow: 32_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 1.9 },
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwen2.5-coder:3b': {
		contextWindow: 32_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 1.9 },
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwen2.5-coder:1.5b': {
		contextWindow: 32_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: .986 },
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'llama3.1': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 4.9 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwen2.5-coder': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 4.7 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
	'qwq': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: 32_000,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 20 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'deepseek-r1': {
		contextWindow: 128_000,
		reservedOutputTokenSpace: null,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 4.7 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: false, openSourceThinkTags: ['<think>', '</think>'] },
	},
	'devstral:latest': {
		contextWindow: 131_000,
		reservedOutputTokenSpace: 8_192,
		cost: { input: 0, output: 0 },
		downloadable: { sizeGb: 14 },
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
	},
} as const satisfies Record<string, VoidStaticModelInfo>

export const ollamaRecommendedModels = ['qwen2.5-coder:1.5b', 'llama3.1', 'qwq', 'deepseek-r1', 'devstral:latest'] as const satisfies (keyof typeof ollamaModelOptions)[]

const extensiveModelOptionsFallback = createExtensiveModelOptionsFallback({
	anthropic: anthropicModelOptions,
	gemini: geminiModelOptions,
	openai: openAIModelOptions,
	xai: xAIModelOptions,
});

// vLLM
export const vLLMSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } }),
	modelOptions: {},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}

// LM Studio
export const lmStudioSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' }, contextWindow: 4_096 }),
	modelOptions: {},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { needsManualParse: true },
	},
}

// Ollama
export const ollamaSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } }),
	modelOptions: ollamaModelOptions,
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { needsManualParse: true },
	},
}

// OpenAI Compatible
export const openaiCompatible: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName),
	modelOptions: {},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}

// LiteLLM
export const liteLLMSettings: VoidStaticProviderInfo = {
	modelOptionsFallback: (modelName) => extensiveModelOptionsFallback(modelName, { downloadable: { sizeGb: 'not-known' } }),
	modelOptions: {},
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
		output: { nameOfFieldInDelta: 'reasoning_content' },
	},
}

// Google Vertex
export const googleVertexModelOptions = {} as const satisfies Record<string, VoidStaticModelInfo>
export const googleVertexSettings: VoidStaticProviderInfo = {
	modelOptions: googleVertexModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}

// Microsoft Azure
export const microsoftAzureModelOptions = {} as const satisfies Record<string, VoidStaticModelInfo>
export const microsoftAzureSettings: VoidStaticProviderInfo = {
	modelOptions: microsoftAzureModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}

// AWS Bedrock
export const awsBedrockModelOptions = {} as const satisfies Record<string, VoidStaticModelInfo>
export const awsBedrockSettings: VoidStaticProviderInfo = {
	modelOptions: awsBedrockModelOptions,
	modelOptionsFallback: (modelName) => { return null },
	providerReasoningIOSettings: {
		input: { includeInPayload: openAICompatIncludeInPayloadReasoning },
	},
}


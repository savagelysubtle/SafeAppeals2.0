/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProviderName } from '../voidSettingsTypes.js';

// ============================================================================
// MAIN MODEL REGISTRY
// ============================================================================

// Re-export types
export * from './types.js';
export * from './defaults.js';

// Selectively re-export from utils (not the utility functions that conflict)
export {
	openSourceModelOptions_assumingOAICompat,
	openAICompatIncludeInPayloadReasoning,
	createExtensiveModelOptionsFallback,
} from './utils.js';
export type { ExtensiveModelOptionsFallback } from './utils.js';

// Import defaultModelOptions for use in functions
import { defaultModelOptions } from './types.js';

// Import all provider settings
import { anthropicSettings } from './anthropic/index.js';
import { geminiSettings } from './google/index.js';
import { openAISettings } from './openai/index.js';
import { xAISettings } from './xai/index.js';
import { deepseekSettings } from './deepseek/index.js';
import { mistralSettings } from './mistral/index.js';
import { groqSettings } from './groq/index.js';
import { openRouterSettings } from './openrouter/index.js';
import {
	vLLMSettings,
	lmStudioSettings,
	ollamaSettings,
	openaiCompatible,
	liteLLMSettings,
	googleVertexSettings,
	microsoftAzureSettings,
	awsBedrockSettings,
	ollamaRecommendedModels
} from './local/index.js';

// Re-export ollamaRecommendedModels for backwards compatibility
export { ollamaRecommendedModels };

// Import provider-specific exports
export { anthropicModelOptions, anthropicSettings } from './anthropic/index.js';
export { geminiModelOptions, geminiSettings } from './google/index.js';
export { openAIModelOptions, openAISettings } from './openai/index.js';
export { xAIModelOptions, xAISettings } from './xai/index.js';
export { deepseekModelOptions, deepseekSettings } from './deepseek/index.js';
export { mistralModelOptions, mistralSettings } from './mistral/index.js';
export { groqModelOptions, groqSettings } from './groq/index.js';
export { openRouterModelOptions_assumingOpenAICompat, openRouterSettings } from './openrouter/index.js';
export {
	ollamaModelOptions,
	vLLMSettings,
	lmStudioSettings,
	ollamaSettings,
	openaiCompatible,
	liteLLMSettings,
	googleVertexModelOptions,
	googleVertexSettings,
	microsoftAzureModelOptions,
	microsoftAzureSettings,
	awsBedrockModelOptions,
	awsBedrockSettings
} from './local/index.js';

import type { VoidStaticProviderInfo } from './types.js';
import type { FeatureName, ModelSelectionOptions, OverridesOfModel, ProviderName as ProviderNameType } from '../voidSettingsTypes.js';

// Build the model settings registry
export const modelSettingsOfProvider: { [providerName in ProviderName]: VoidStaticProviderInfo } = {
	openAI: openAISettings,
	anthropic: anthropicSettings,
	xAI: xAISettings,
	gemini: geminiSettings,

	// open source models
	deepseek: deepseekSettings,
	groq: groqSettings,

	// open source models + providers (mixture of everything)
	openRouter: openRouterSettings,
	vLLM: vLLMSettings,
	ollama: ollamaSettings,
	openAICompatible: openaiCompatible,
	mistral: mistralSettings,
	lmStudio: lmStudioSettings,
	liteLLM: liteLLMSettings,

	// cloud providers
	googleVertex: googleVertexSettings,
	microsoftAzure: microsoftAzureSettings,
	awsBedrock: awsBedrockSettings,
}

// Export utility functions that use the modelSettingsOfProvider
import type { VoidStaticModelInfo } from './types.js';

export const getModelCapabilities = (
	providerName: ProviderNameType,
	modelName: string,
	overridesOfModel: OverridesOfModel | undefined
): VoidStaticModelInfo & (
	| { modelName: string; recognizedModelName: string; isUnrecognizedModel: false }
	| { modelName: string; recognizedModelName?: undefined; isUnrecognizedModel: true }
) => {
	const lowercaseModelName = modelName.toLowerCase()
	const { modelOptions, modelOptionsFallback } = modelSettingsOfProvider[providerName]
	const overrides = overridesOfModel?.[providerName]?.[modelName];

	// search model options object directly first
	for (const modelName_ in modelOptions) {
		const lowercaseModelName_ = modelName_.toLowerCase()
		if (lowercaseModelName === lowercaseModelName_) {
			return { ...modelOptions[modelName], ...overrides, modelName, recognizedModelName: modelName, isUnrecognizedModel: false };
		}
	}

	const result = modelOptionsFallback(modelName)
	if (result) {
		return { ...result, ...overrides, modelName: result.modelName, isUnrecognizedModel: false };
	}

	return { modelName, ...defaultModelOptions, ...overrides, isUnrecognizedModel: true };
}

export const getProviderCapabilities = (providerName: ProviderNameType) => {
	const { providerReasoningIOSettings } = modelSettingsOfProvider[providerName]
	return { providerReasoningIOSettings }
}

export const getIsReasoningEnabledState = (
	_featureName: FeatureName,
	providerName: ProviderNameType,
	modelName: string,
	_modelSelectionOptions: ModelSelectionOptions | undefined,
	overridesOfModel: OverridesOfModel | undefined,
) => {
	const { supportsReasoning } = getModelCapabilities(providerName, modelName, overridesOfModel).reasoningCapabilities || {}
	return !!supportsReasoning
}

export const getReservedOutputTokenSpace = (
	providerName: ProviderNameType,
	modelName: string,
	opts: { isReasoningEnabled: boolean, overridesOfModel: OverridesOfModel | undefined }
) => {
	const {
		reasoningCapabilities,
		reservedOutputTokenSpace,
	} = getModelCapabilities(providerName, modelName, opts.overridesOfModel)
	return opts.isReasoningEnabled && reasoningCapabilities ? reasoningCapabilities.reasoningReservedOutputTokenSpace : reservedOutputTokenSpace
}

import type { SendableReasoningInfo } from './types.js';

export const getSendableReasoningInfo = (
	_featureName: FeatureName,
	providerName: ProviderNameType,
	modelName: string,
	_modelSelectionOptions: ModelSelectionOptions | undefined,
	overridesOfModel: OverridesOfModel | undefined,
): SendableReasoningInfo => {
	const reasoningCapabilities = getModelCapabilities(providerName, modelName, overridesOfModel).reasoningCapabilities
	if (!reasoningCapabilities) return null

	const { supportsReasoning, maxReasoningBudget, maxReasoningEffort } = reasoningCapabilities
	if (!supportsReasoning) return null

	// Use max budget for budget-based providers (Anthropic, Gemini, OpenRouter)
	if (maxReasoningBudget) {
		return { type: 'budget', isReasoningEnabled: true, reasoningBudget: maxReasoningBudget }
	}

	// Use max effort for effort-based providers (OpenAI, xAI)
	if (maxReasoningEffort) {
		return { type: 'effort', isReasoningEnabled: true, reasoningEffort: maxReasoningEffort }
	}

	return null
}


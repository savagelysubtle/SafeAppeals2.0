/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProviderName, OverridesOfModel } from '../../common/voidSettingsTypes.js'
import { shouldUseNativeTools, getProviderToolCapability } from '../../common/llm/providerCapabilities.js'
import { ModelOverrides } from '../../common/modelCapabilities.js'
import { AnthropicNativeAdapter } from './native/anthropicAdapter.js'
import { OpenAINativeAdapter } from './native/openaiAdapter.js'
import { NativeToolAdapter } from './native/toolAdapter.js'
import { InternalToolInfo } from '../../common/prompt/prompts.js'

/**
 * Router decision result
 */
export interface ToolCallingRoute {
	useNative: boolean
	adapter?: NativeToolAdapter
	reason: string
}

/**
 * Determine the appropriate tool calling strategy for a provider
 *
 * This function decides whether to use native tool calling or XML fallback
 * based on provider capabilities, feature flags, and model overrides.
 *
 * @param providerId Provider identifier
 * @param modelId Model identifier
 * @param overrides Model-specific overrides
 * @param tools Available tools (for logging purposes)
 * @returns Routing decision with adapter if native
 */
export function routeToolCalling(
	providerId: ProviderName,
	modelId: string,
	overridesOfModel?: OverridesOfModel,
	tools?: InternalToolInfo[]
): ToolCallingRoute {
	// Extract model-specific overrides from the nested structure
	const overrides: Partial<ModelOverrides> | undefined = overridesOfModel?.[providerId]?.[modelId]
	const useNative = shouldUseNativeTools(providerId, modelId, overrides)
	const capability = getProviderToolCapability(providerId)

	if (!useNative) {
		return {
			useNative: false,
			reason: capability.supportsNativeTools
				? 'Native tools disabled by feature flag or override'
				: `Provider ${providerId} does not support native tools`
		}
	}

	// Select appropriate adapter for native tool calling
	let adapter: NativeToolAdapter | undefined

	if (providerId === 'anthropic') {
		adapter = new AnthropicNativeAdapter()
	} else if (['openAI', 'gemini', 'mistral', 'groq', 'openRouter', 'liteLLM', 'googleVertex', 'microsoftAzure', 'awsBedrock'].includes(providerId)) {
		// All OpenAI-compatible providers use the same adapter
		adapter = new OpenAINativeAdapter()
	} else {
		// Fallback to XML for unknown providers
		console.warn(`[toolRouter] No native adapter for provider ${providerId}, falling back to XML`)
		return {
			useNative: false,
			reason: `No native adapter available for provider ${providerId}`
		}
	}

	console.log(`[toolRouter] ✅ Routing to native tool calling for ${modelId} on ${providerId}`, {
		toolCount: tools?.length || 0,
		schemaFormat: capability.toolSchemaFormat,
		supportsParallelCalls: capability.supportsParallelCalls
	})

	return {
		useNative: true,
		adapter,
		reason: `Using native ${capability.toolSchemaFormat} tool calling`
	}
}

/**
 * Get the appropriate tool schema format string for use in sendLLMMessage
 *
 * This helps determine what value to use for specialToolFormat:
 * - 'anthropic-style' for Anthropic native tools
 * - 'openai-style' for OpenAI-compatible native tools
 * - undefined for XML fallback
 */
export function getToolFormatFromRoute(route: ToolCallingRoute): 'anthropic-style' | 'openai-style' | undefined {
	if (!route.useNative || !route.adapter) {
		return undefined
	}

	// Determine format based on adapter type
	if (route.adapter instanceof AnthropicNativeAdapter) {
		return 'anthropic-style'
	} else if (route.adapter instanceof OpenAINativeAdapter) {
		return 'openai-style'
	}

	return undefined
}


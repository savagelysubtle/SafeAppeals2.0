/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ModelOverrides } from '../modelCapabilities.js'
import { ProviderName } from '../voidSettingsTypes.js'

/**
 * Native tool calling capabilities for each provider
 */
export interface ProviderToolCapability {
	providerId: ProviderName
	supportsNativeTools: boolean // Does this provider support native tool calling?
	toolSchemaFormat: 'anthropic' | 'openai' | 'xml-only' // Schema format for native tools
	supportsStreaming: boolean // Does the provider support streaming?
	supportsParallelCalls: boolean // Can the provider execute multiple tool calls in parallel?
	streamingProtocol: 'sse' | 'websocket' | 'http' | 'custom' // Protocol used for streaming
}

/**
 * Capability matrix for all providers
 * Based on provider documentation and empirical testing
 */
export const PROVIDER_CAPABILITIES: Record<ProviderName, ProviderToolCapability> = {
	anthropic: {
		providerId: 'anthropic',
		supportsNativeTools: true,
		toolSchemaFormat: 'anthropic',
		supportsStreaming: true,
		supportsParallelCalls: false, // Anthropic does sequential tool calls only
		streamingProtocol: 'sse'
	},
	openAI: {
		providerId: 'openAI',
		supportsNativeTools: true,
		toolSchemaFormat: 'openai',
		supportsStreaming: true,
		supportsParallelCalls: true,
		streamingProtocol: 'sse'
	},
	gemini: {
		providerId: 'gemini',
		supportsNativeTools: true,
		toolSchemaFormat: 'openai', // Gemini uses OpenAI-compatible format
		supportsStreaming: true,
		supportsParallelCalls: true,
		streamingProtocol: 'sse'
	},
	mistral: {
		providerId: 'mistral',
		supportsNativeTools: true,
		toolSchemaFormat: 'openai', // Mistral uses OpenAI-compatible format
		supportsStreaming: true,
		supportsParallelCalls: true,
		streamingProtocol: 'sse'
	},
	groq: {
		providerId: 'groq',
		supportsNativeTools: true,
		toolSchemaFormat: 'openai', // Groq uses OpenAI-compatible format
		supportsStreaming: true,
		supportsParallelCalls: true,
		streamingProtocol: 'sse'
	},
	// Providers that need XML fallback (no native tool support)
	ollama: {
		providerId: 'ollama',
		supportsNativeTools: false,
		toolSchemaFormat: 'xml-only',
		supportsStreaming: true,
		supportsParallelCalls: false,
		streamingProtocol: 'http'
	},
	vLLM: {
		providerId: 'vLLM',
		supportsNativeTools: false,
		toolSchemaFormat: 'xml-only',
		supportsStreaming: true,
		supportsParallelCalls: false,
		streamingProtocol: 'http'
	},
	lmStudio: {
		providerId: 'lmStudio',
		supportsNativeTools: false,
		toolSchemaFormat: 'xml-only',
		supportsStreaming: true,
		supportsParallelCalls: false,
		streamingProtocol: 'websocket'
	},
	deepseek: {
		providerId: 'deepseek',
		supportsNativeTools: false,
		toolSchemaFormat: 'xml-only',
		supportsStreaming: true,
		supportsParallelCalls: false,
		streamingProtocol: 'sse'
	},
	xAI: {
		providerId: 'xAI',
		supportsNativeTools: false,
		toolSchemaFormat: 'xml-only',
		supportsStreaming: true,
		supportsParallelCalls: false,
		streamingProtocol: 'sse'
	},
	// Proxy providers (capabilities depend on backend)
	openRouter: {
		providerId: 'openRouter',
		supportsNativeTools: true, // OpenRouter supports native tools via OpenAI-compatible API
		toolSchemaFormat: 'openai',
		supportsStreaming: true,
		supportsParallelCalls: true,
		streamingProtocol: 'sse'
	},
	openAICompatible: {
		providerId: 'openAICompatible',
		supportsNativeTools: false, // Default to XML for unknown backends
		toolSchemaFormat: 'xml-only',
		supportsStreaming: true,
		supportsParallelCalls: false,
		streamingProtocol: 'http'
	},
	liteLLM: {
		providerId: 'liteLLM',
		supportsNativeTools: true, // LiteLLM supports native tools via OpenAI-compatible API
		toolSchemaFormat: 'openai',
		supportsStreaming: true,
		supportsParallelCalls: true,
		streamingProtocol: 'sse'
	},
	// Cloud providers (via proxies)
	googleVertex: {
		providerId: 'googleVertex',
		supportsNativeTools: true,
		toolSchemaFormat: 'openai',
		supportsStreaming: true,
		supportsParallelCalls: true,
		streamingProtocol: 'sse'
	},
	microsoftAzure: {
		providerId: 'microsoftAzure',
		supportsNativeTools: true,
		toolSchemaFormat: 'openai',
		supportsStreaming: true,
		supportsParallelCalls: true,
		streamingProtocol: 'sse'
	},
	awsBedrock: {
		providerId: 'awsBedrock',
		supportsNativeTools: true, // Via LiteLLM proxy or Bedrock Access Gateway
		toolSchemaFormat: 'openai',
		supportsStreaming: true,
		supportsParallelCalls: true,
		streamingProtocol: 'sse'
	}
}

/**
 * Determine if native tool calling should be used for a given provider and model
 *
 * Decision factors:
 * 1. Feature flag (useNativeToolCalling) - must be explicitly enabled
 * 2. Provider capability (supportsNativeTools) - provider must support native tools
 * 3. Model-specific overrides (forceXML) - can force XML even if native is supported
 *
 * @param providerId Provider identifier
 * @param modelId Model identifier (for future model-specific logic)
 * @param overrides Model-specific overrides from settings
 * @returns true if native tool calling should be used
 */
export function shouldUseNativeTools(
	providerId: ProviderName,
	modelId: string,
	overrides?: Partial<ModelOverrides>
): boolean {
	// Feature flag check - native tools enabled by default, can be explicitly disabled
	const nativeToolsEnabled = (overrides as any)?.useNativeToolCalling ?? true  // Changed default to true
	if (!nativeToolsEnabled) {
		console.log(`[providerCapabilities] Native tools disabled by feature flag for ${providerId}`)
		return false
	}

	// Provider capability check
	const capability = PROVIDER_CAPABILITIES[providerId]
	if (!capability?.supportsNativeTools) {
		console.log(`[providerCapabilities] Provider ${providerId} does not support native tools`)
		return false
	}

	// Model-specific override - force XML
	if ((overrides as any)?.forceXML) {
		console.log(`[providerCapabilities] Forcing XML for ${modelId} on ${providerId} due to override`)
		return false
	}

	// Model-specific logic can be added here in the future
	// For example: Some older models may work better with XML
	// if (modelId === 'gpt-3.5-turbo') return false

	console.log(`[providerCapabilities] ✅ Using native tools for ${modelId} on ${providerId}`)
	return true
}

/**
 * Get provider capability information
 * @param providerId Provider identifier
 * @returns Provider capability object
 */
export function getProviderToolCapability(providerId: ProviderName): ProviderToolCapability {
	const capability = PROVIDER_CAPABILITIES[providerId]
	if (!capability) {
		console.warn(`[providerCapabilities] Unknown provider ${providerId}, defaulting to XML-only`)
		return {
			providerId,
			supportsNativeTools: false,
			toolSchemaFormat: 'xml-only',
			supportsStreaming: true,
			supportsParallelCalls: false,
			streamingProtocol: 'http'
		}
	}
	return capability
}


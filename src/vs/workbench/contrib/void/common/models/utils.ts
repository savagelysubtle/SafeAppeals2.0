/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, SendableReasoningInfo } from './types.js';

// ============================================================================
// OPEN SOURCE MODEL OPTIONS (for Ollama, vLLM, etc.)
// ============================================================================

export const openSourceModelOptions_assumingOAICompat = {
	'deepseekR1': {
		supportsFIM: false,
		supportsSystemMessage: false,
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'deepseekCoderV3': {
		supportsFIM: false,
		supportsSystemMessage: false, // unstable
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'deepseekCoderV2': {
		supportsFIM: false,
		supportsSystemMessage: false, // unstable
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'codestral': {
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'devstral': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 131_000, reservedOutputTokenSpace: 8_192,
	},
	'openhands-lm-32b': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false, // built on qwen 2.5 32B instruct
		contextWindow: 128_000, reservedOutputTokenSpace: 4_096
	},
	'phi4': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 16_000, reservedOutputTokenSpace: 4_096,
	},
	'gemma': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	// llama 4
	'llama4-scout': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 10_000_000, reservedOutputTokenSpace: 4_096,
	},
	'llama4-maverick': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 10_000_000, reservedOutputTokenSpace: 4_096,
	},
	// llama 3
	'llama3': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'llama3.1': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'llama3.2': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'llama3.3': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	// qwen
	'qwen2.5coder': {
		supportsFIM: true,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 32_000, reservedOutputTokenSpace: 4_096,
	},
	'qwq': {
		supportsFIM: false, // no FIM, yes reasoning
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 128_000, reservedOutputTokenSpace: 8_192,
	},
	'qwen3': {
		supportsFIM: false, // replaces QwQ
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: { supportsReasoning: true, canIOReasoning: true, openSourceThinkTags: ['<think>', '</think>'] },
		contextWindow: 32_768, reservedOutputTokenSpace: 8_192,
	},
	// FIM only
	'starcoder2': {
		supportsFIM: true,
		supportsSystemMessage: false,
		reasoningCapabilities: false,
		contextWindow: 128_000, reservedOutputTokenSpace: 8_192,
	},
	'codegemma:2b': {
		supportsFIM: true,
		supportsSystemMessage: false,
		reasoningCapabilities: false,
		contextWindow: 128_000, reservedOutputTokenSpace: 8_192,
	},
	'quasar': {
		supportsFIM: false,
		supportsSystemMessage: 'system-role',
		reasoningCapabilities: false,
		contextWindow: 1_000_000, reservedOutputTokenSpace: 32_000,
	}
} as const satisfies { [s: string]: Partial<VoidStaticModelInfo> }


// ============================================================================
// HELPER: OpenAI Compatible Include In Payload for Reasoning
// ============================================================================

export const openAICompatIncludeInPayloadReasoning = (reasoningState: SendableReasoningInfo) => {
	if (!reasoningState) return null
	if (reasoningState.type === 'budget') return null // budget-based providers don't have this field
	if (reasoningState.type === 'effort') return { reasoning_effort: reasoningState.reasoningEffort }
	return null
}


// ============================================================================
// EXTENSIVE MODEL OPTIONS FALLBACK (for unrecognized models)
// ============================================================================

export type ExtensiveModelOptionsFallback = (
	modelName: string,
	fallbackKnownValues?: Partial<VoidStaticModelInfo>,
	providerModelOptions?: Record<string, any>
) => (VoidStaticModelInfo & { modelName: string, recognizedModelName: string }) | null

export const createExtensiveModelOptionsFallback = (providerModelOptions: Record<string, Record<string, VoidStaticModelInfo>>): ExtensiveModelOptionsFallback => {
	return (modelName, fallbackKnownValues) => {
		const lower = modelName.toLowerCase()

		const toFallback = <T extends { [s: string]: Omit<VoidStaticModelInfo, 'cost' | 'downloadable'> },>(obj: T, recognizedModelName: string & keyof T)
			: VoidStaticModelInfo & { modelName: string, recognizedModelName: string } => {

			const opts = obj[recognizedModelName]
			const supportsSystemMessage = opts.supportsSystemMessage === 'separated'
				? 'system-role'
				: opts.supportsSystemMessage

			return {
				recognizedModelName,
				modelName,
				...opts,
				supportsSystemMessage: supportsSystemMessage,
				cost: { input: 0, output: 0 },
				downloadable: false,
				...fallbackKnownValues
			};
		}

		const { anthropic, gemini, xai, openai } = providerModelOptions

		if (lower.includes('gemini') && (lower.includes('2.5') || lower.includes('2-5'))) return toFallback(gemini, 'gemini-2.5-pro' as any)

		if (lower.includes('claude-4') && lower.includes('opus')) return toFallback(anthropic, 'claude-opus-4-20250514' as any)
		if (lower.includes('claude-4') && lower.includes('haiku')) return toFallback(anthropic, 'claude-haiku-4-5' as any)
		if (lower.includes('claude-4-5') || lower.includes('claude-sonnet-4-5') || (lower.includes('claude-4') && lower.includes('sonnet'))) return toFallback(anthropic, 'claude-sonnet-4-5' as any)
		if (lower.includes('claude-3-7') || lower.includes('claude-3.7')) return toFallback(anthropic, 'claude-3-7-sonnet-20250219' as any)
		if (lower.includes('claude-3-5') || lower.includes('claude-3.5')) return toFallback(anthropic, 'claude-3-5-sonnet-20241022' as any)
		if (lower.includes('claude')) return toFallback(anthropic, 'claude-3-7-sonnet-20250219' as any)

		if (lower.includes('grok2') || lower.includes('grok2')) return toFallback(xai, 'grok-2' as any)
		if (lower.includes('grok')) return toFallback(xai, 'grok-3' as any)

		if (lower.includes('deepseek-r1') || lower.includes('deepseek-reasoner')) return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekR1')
		if (lower.includes('deepseek') && lower.includes('v2')) return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekCoderV2')
		if (lower.includes('deepseek')) return toFallback(openSourceModelOptions_assumingOAICompat, 'deepseekCoderV3')

		if (lower.includes('llama3')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3')
		if (lower.includes('llama3.1')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.1')
		if (lower.includes('llama3.2')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.2')
		if (lower.includes('llama3.3')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama3.3')
		if (lower.includes('llama') || lower.includes('scout')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama4-scout')
		if (lower.includes('llama') || lower.includes('maverick')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama4-scout')
		if (lower.includes('llama')) return toFallback(openSourceModelOptions_assumingOAICompat, 'llama4-scout')

		if (lower.includes('qwen') && lower.includes('2.5') && lower.includes('coder')) return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen2.5coder')
		if (lower.includes('qwen') && lower.includes('3')) return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen3')
		if (lower.includes('qwen')) return toFallback(openSourceModelOptions_assumingOAICompat, 'qwen3')
		if (lower.includes('qwq')) { return toFallback(openSourceModelOptions_assumingOAICompat, 'qwq') }
		if (lower.includes('phi4')) return toFallback(openSourceModelOptions_assumingOAICompat, 'phi4')
		if (lower.includes('codestral')) return toFallback(openSourceModelOptions_assumingOAICompat, 'codestral')
		if (lower.includes('devstral')) return toFallback(openSourceModelOptions_assumingOAICompat, 'devstral')

		if (lower.includes('gemma')) return toFallback(openSourceModelOptions_assumingOAICompat, 'gemma')

		if (lower.includes('starcoder2')) return toFallback(openSourceModelOptions_assumingOAICompat, 'starcoder2')

		if (lower.includes('openhands')) return toFallback(openSourceModelOptions_assumingOAICompat, 'openhands-lm-32b')

		if (lower.includes('quasar') || lower.includes('quaser')) return toFallback(openSourceModelOptions_assumingOAICompat, 'quasar')

		if (lower.includes('gpt') && lower.includes('mini') && (lower.includes('4.1') || lower.includes('4-1'))) return toFallback(openai, 'gpt-4.1-mini' as any)
		if (lower.includes('gpt') && lower.includes('nano') && (lower.includes('4.1') || lower.includes('4-1'))) return toFallback(openai, 'gpt-4.1-nano' as any)
		if (lower.includes('gpt') && (lower.includes('4.1') || lower.includes('4-1'))) return toFallback(openai, 'gpt-4.1' as any)

		if (lower.includes('gpt') && lower.includes('5')) return toFallback(openai, 'gpt-5' as any)

		if (lower.includes('4o') && lower.includes('mini')) return toFallback(openai, 'gpt-4o-mini' as any)
		if (lower.includes('4o')) return toFallback(openai, 'gpt-4o' as any)

		if (lower.includes('o1') && lower.includes('mini')) return toFallback(openai, 'o1-mini' as any)
		if (lower.includes('o1')) return toFallback(openai, 'o1' as any)
		if (lower.includes('o3') && lower.includes('mini')) return toFallback(openai, 'o3-mini' as any)
		if (lower.includes('o3')) return toFallback(openai, 'o3' as any)
		if (lower.includes('o4') && lower.includes('mini')) return toFallback(openai, 'o4-mini' as any)

		if (Object.keys(openSourceModelOptions_assumingOAICompat).map(k => k.toLowerCase()).includes(lower))
			return toFallback(openSourceModelOptions_assumingOAICompat, lower as keyof typeof openSourceModelOptions_assumingOAICompat)

		return null
	}
}




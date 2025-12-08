/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

// ============================================================================
// GOOGLE GEMINI MODELS
// https://ai.google.dev/gemini-api/docs/models/gemini (Dec 2025)
// All models: Input 1,048,576 tokens, Output 65,536 tokens
// ============================================================================

export const geminiModelOptions = {
	// Gemini 3 Series (Preview)
	'gemini-3-pro-preview': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 65_536,
		cost: { input: 1.25, output: 5.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: true,
			maxReasoningBudget: 32768,
			reasoningReservedOutputTokenSpace: 16384,
		},
	},
	// Gemini 2.5 Series
	'gemini-2.5-pro': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 65_536,
		cost: { input: 1.25, output: 5.00 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: false,
			maxReasoningBudget: 24576,
			reasoningReservedOutputTokenSpace: 8192,
		},
	},
	'gemini-2.5-flash': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 65_536,
		cost: { input: 0.15, output: 0.60 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: false,
			maxReasoningBudget: 24576,
			reasoningReservedOutputTokenSpace: 8192,
		},
	},
	'gemini-2.5-flash-lite': {
		contextWindow: 1_048_576,
		reservedOutputTokenSpace: 65_536,
		cost: { input: 0.075, output: 0.30 },
		downloadable: false,
		supportsFIM: false,
		supportsSystemMessage: 'separated',
		specialToolFormat: 'gemini-style',
		reasoningCapabilities: {
			supportsReasoning: true,
			canIOReasoning: false,
			maxReasoningBudget: 24576,
			reasoningReservedOutputTokenSpace: 8192,
		},
	},
} as const satisfies { [s: string]: VoidStaticModelInfo }

export const geminiSettings: VoidStaticProviderInfo = {
	modelOptions: geminiModelOptions,
	modelOptionsFallback: (modelName) => {
		const lower = modelName.toLowerCase()
		let fallbackName: keyof typeof geminiModelOptions | null = null
		// Gemini 3 series
		if (lower.includes('gemini-3')) fallbackName = 'gemini-3-pro-preview'
		// Gemini 2.5 series
		else if (lower.includes('gemini-2.5') && lower.includes('flash') && lower.includes('lite')) fallbackName = 'gemini-2.5-flash-lite'
		else if (lower.includes('gemini-2.5') && lower.includes('flash')) fallbackName = 'gemini-2.5-flash'
		else if (lower.includes('gemini-2.5') && lower.includes('pro')) fallbackName = 'gemini-2.5-pro'
		if (fallbackName) return { modelName: fallbackName, recognizedModelName: fallbackName, ...geminiModelOptions[fallbackName] }
		return null
	},
}


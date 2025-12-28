/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

// ============================================================================
// SHARED TYPES FOR MODEL CAPABILITIES
// ============================================================================

export type VoidStaticModelInfo = { // not stateful
	// Void uses the information below to know how to handle each model.
	// for some examples, see openAIModelOptions and anthropicModelOptions (below).

	contextWindow: number; // input tokens
	reservedOutputTokenSpace: number | null; // reserve this much space in the context window for output, defaults to 4096 if null

	supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated'; // typically you should use 'system-role'. 'separated' means the system message is passed as a separate field (e.g. anthropic)
	specialToolFormat?: 'openai-style' | 'anthropic-style' | 'gemini-style', // typically you should use 'openai-style'. null means "can't call tools by default", and asks the LLM to output XML in agent mode
	supportsFIM: boolean; // whether the model was specifically designed for autocomplete or "FIM" ("fill-in-middle" format)
	supportsVision?: boolean; // whether the model can process images (vision capability)

	additionalOpenAIPayload?: { [key: string]: string } // additional payload in the message body for requests that are openai-compatible (ollama, vllm, openai, openrouter, etc)

	// reasoning options - thinking is always enabled at max for models that support it
	reasoningCapabilities: false | {
		readonly supportsReasoning: true; // for clarity, this must be true if anything below is specified
		readonly canIOReasoning: boolean; // whether or not the model actually outputs reasoning (eg o1 lets us control reasoning but not output it)
		readonly reasoningReservedOutputTokenSpace?: number; // overrides normal reservedOutputTokenSpace

		// Provider-specific reasoning settings (used internally, not user-configurable)
		readonly maxReasoningBudget?: number; // for budget-based providers like Anthropic, Gemini (omit for effort-based providers like OpenAI)
		readonly maxReasoningEffort?: string; // for effort-based providers like OpenAI (typically 'high')

		// if it's open source and specifically outputs think tags, put the think tags here and we'll parse them out (e.g. ollama)
		readonly openSourceThinkTags?: [string, string];

		// the only other field related to reasoning is "providerReasoningIOSettings", which varies by provider.
	};

	// native tool calling options (Phase 3 of Unified Tool Calling Plan)
	useNativeToolCalling?: boolean; // whether to use native tool calling instead of XML (default: false, must be explicitly enabled)
	forceXML?: boolean; // whether to force XML even if native tool calling is supported (default: false)


	// --- below is just informative, not used in sending / receiving, cannot be customized in settings ---
	cost: {
		input: number;
		output: number;
		cache_read?: number;
		cache_write?: number;
	}
	downloadable: false | {
		sizeGb: number | 'not-known'
	}
}
// if you change the above type, remember to update the Settings link



export const modelOverrideKeys = [
	'contextWindow',
	'reservedOutputTokenSpace',
	'supportsSystemMessage',
	'specialToolFormat',
	'supportsFIM',
	'supportsVision',
	'reasoningCapabilities',
	'additionalOpenAIPayload',
	'useNativeToolCalling',
	'forceXML'
] as const

export type ModelOverrides = Pick<
	VoidStaticModelInfo,
	(typeof modelOverrideKeys)[number]
>




// Reasoning is always enabled at max for models that support it (no user-configurable slider)
export type SendableReasoningInfo = {
	type: 'budget',
	isReasoningEnabled: true,
	reasoningBudget: number,
} | {
	type: 'effort',
	isReasoningEnabled: true,
	reasoningEffort: string,
} | null


export type ProviderReasoningIOSettings = {
	// include this in payload to get reasoning
	input?: { includeInPayload?: (reasoningState: SendableReasoningInfo) => null | { [key: string]: any }, };
	// nameOfFieldInDelta: reasoning output is in response.choices[0].delta[deltaReasoningField]
	// needsManualParse: whether we must manually parse out the <think> tags
	output?:
	| { nameOfFieldInDelta?: string, needsManualParse?: undefined, }
	| { nameOfFieldInDelta?: undefined, needsManualParse?: true, };
}

export type VoidStaticProviderInfo = { // doesn't change (not stateful)
	providerReasoningIOSettings?: ProviderReasoningIOSettings; // input/output settings around thinking (allowed to be empty) - only applied if the model supports reasoning output
	modelOptions: { [key: string]: VoidStaticModelInfo };
	modelOptionsFallback: (modelName: string, fallbackKnownValues?: Partial<VoidStaticModelInfo>) => (VoidStaticModelInfo & { modelName: string, recognizedModelName: string }) | null;
}


export const defaultModelOptions = {
	contextWindow: 4_096,
	reservedOutputTokenSpace: 4_096,
	cost: { input: 0, output: 0 },
	downloadable: false,
	supportsSystemMessage: false,
	supportsFIM: false,
	supportsVision: false,
	reasoningCapabilities: false,
} as const satisfies VoidStaticModelInfo


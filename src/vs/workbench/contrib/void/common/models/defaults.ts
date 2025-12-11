/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { ProviderName } from '../voidSettingsTypes.js';

// ============================================================================
// DEFAULT PROVIDER SETTINGS
// ============================================================================

export const defaultProviderSettings = {
	anthropic: {
		apiKey: '',
	},
	openAI: {
		apiKey: '',
	},
	deepseek: {
		apiKey: '',
	},
	ollama: {
		endpoint: 'http://127.0.0.1:11434',
	},
	vLLM: {
		endpoint: 'http://localhost:8000',
	},
	openRouter: {
		apiKey: '',
	},
	openAICompatible: {
		endpoint: '',
		apiKey: '',
		headersJSON: '{}', // default to {}
	},
	gemini: {
		apiKey: '',
	},
	groq: {
		apiKey: '',
	},
	xAI: {
		apiKey: '',
	},
	mistral: {
		apiKey: '',
	},
	lmStudio: {
		endpoint: 'http://localhost:1234',
	},
	liteLLM: { // https://docs.litellm.ai/docs/providers/openai_compatible
		endpoint: '',
	},
	googleVertex: { // google https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/call-vertex-using-openai-library
		region: 'us-west2',
		project: '',
	},
	microsoftAzure: { // microsoft Azure Foundry
		project: '', // really 'resource'
		apiKey: '',
		azureApiVersion: '2024-05-01-preview',
	},
	awsBedrock: {
		apiKey: '',
		region: 'us-east-1', // add region setting
		endpoint: '', // optionally allow overriding default
	},

} as const


// ============================================================================
// DEFAULT MODELS OF PROVIDER
// Synced with LiteLLM config - December 2024
// Using shorthand names (matching LiteLLM model_name for routing)
// ============================================================================

export const defaultModelsOfProvider = {
	// OpenAI - synced with LiteLLM config (December 2024)
	// Shorthand names only - LiteLLM handles routing to latest versions
	openAI: [
		'gpt-5.2',
		'gpt-5',
		'gpt-5-mini',
		'gpt-5-nano',
	],
	// Anthropic - synced with LiteLLM config (shorthand names)
	anthropic: [
		'claude-opus-4.5',     // Claude Opus 4.5 (Premium)
		'claude-sonnet-4.5',   // Claude Sonnet 4.5 (Best balance)
		'claude-opus-4.1',     // Claude Opus 4.1 (Agentic)
		'claude-sonnet-4',     // Claude Sonnet 4 (Stable)
		'claude-haiku-4.5',    // Claude Haiku 4.5 (Fast)
	],
	// xAI - not in LiteLLM config, keeping for direct xAI API usage
	xAI: [
		'grok-2',
		'grok-3',
		'grok-3-mini',
		'grok-3-fast',
		'grok-3-mini-fast'
	],
	// Google Gemini - synced with LiteLLM config
	gemini: [
		'gemini-3-pro',
		'gemini-2.5-pro',
		'gemini-2.5-flash',

	],
	// DeepSeek - not in LiteLLM config, keeping for direct DeepSeek API usage
	deepseek: [
		'deepseek-chat',
		'deepseek-reasoner',
	],
	ollama: [ // autodetected
	],
	vLLM: [ // autodetected
	],
	lmStudio: [], // autodetected

	openRouter: [ // https://openrouter.ai/models
		'anthropic/claude-opus-4',
		'anthropic/claude-sonnet-4',
		'qwen/qwen3-235b-a22b',
		'anthropic/claude-3.7-sonnet',
		'anthropic/claude-3.5-sonnet',
		'deepseek/deepseek-r1',
		'deepseek/deepseek-r1-zero:free',
		'mistralai/devstral-small:free'
	],
	groq: [ // https://console.groq.com/docs/models
		'qwen-qwq-32b',
		'llama-3.3-70b-versatile',
		'llama-3.1-8b-instant',
	],
	mistral: [ // https://docs.mistral.ai/getting-started/models/models_overview/
		'codestral-latest',
		'devstral-small-latest',
		'mistral-large-latest',
		'mistral-medium-latest',
		'ministral-3b-latest',
		'ministral-8b-latest',
	],
	openAICompatible: [], // fallback
	googleVertex: [],
	microsoftAzure: [],
	awsBedrock: [],
	liteLLM: [],


} as const satisfies Record<ProviderName, string[]>


/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/

import { defaultModelsOfProvider, defaultProviderSettings, ModelOverrides } from './modelCapabilities.js';
import { RAGOpenAIModel, RAGStorageScope, RAGVectorBackend } from './rag/ragServiceTypes.js';
import { ToolApprovalType } from './tools/toolsServiceTypes.js';
import { CloudModeOfProvider, defaultCloudModeOfProvider } from './voidCloudTypes.js';
import { VoidSettingsState } from './voidSettingsService.js';


type UnionOfKeys<T> = T extends T ? keyof T : never;



export type ProviderName = keyof typeof defaultProviderSettings
export const providerNames = Object.keys(defaultProviderSettings) as ProviderName[]

export const localProviderNames = ['ollama', 'vLLM', 'lmStudio'] satisfies ProviderName[] // all local names
export const nonlocalProviderNames = providerNames.filter((name) => !(localProviderNames as string[]).includes(name)) // all non-local names

type CustomSettingName = UnionOfKeys<typeof defaultProviderSettings[ProviderName]>
type CustomProviderSettings<providerName extends ProviderName> = {
	[k in CustomSettingName]: k extends keyof typeof defaultProviderSettings[providerName] ? string : undefined
}
export const customSettingNamesOfProvider = (providerName: ProviderName) => {
	return Object.keys(defaultProviderSettings[providerName]) as CustomSettingName[]
}



export type VoidStatefulModelInfo = { // <-- STATEFUL
	modelName: string,
	type: 'default' | 'autodetected' | 'custom';
	isHidden: boolean, // whether or not the user is hiding it (switched off)
}



type CommonProviderSettings = {
	_didFillInProviderSettings: boolean | undefined, // undefined initially, computed when user types in all fields
	models: VoidStatefulModelInfo[],
}

export type SettingsAtProvider<providerName extends ProviderName> = CustomProviderSettings<providerName> & CommonProviderSettings

// part of state
export type SettingsOfProvider = {
	[providerName in ProviderName]: SettingsAtProvider<providerName>
}


export type SettingName = keyof SettingsAtProvider<ProviderName>

type DisplayInfoForProviderName = {
	title: string,
	desc?: string,
}

export const displayInfoOfProviderName = (providerName: ProviderName): DisplayInfoForProviderName => {
	if (providerName === 'anthropic') {
		return { title: 'Anthropic', }
	}
	else if (providerName === 'openAI') {
		return { title: 'OpenAI', }
	}
	else if (providerName === 'gemini') {
		return { title: 'Gemini', }
	}
	else if (providerName === 'deepseek') {
		return { title: 'DeepSeek', }
	}
	else if (providerName === 'openRouter') {
		return { title: 'OpenRouter', }
	}
	else if (providerName === 'ollama') {
		return { title: 'Ollama', }
	}
	else if (providerName === 'vLLM') {
		return { title: 'vLLM', }
	}
	else if (providerName === 'liteLLM') {
		return { title: 'LiteLLM', }
	}
	else if (providerName === 'lmStudio') {
		return { title: 'LM Studio', }
	}
	else if (providerName === 'openAICompatible') {
		return { title: 'OpenAI-Compatible', }
	}
	else if (providerName === 'groq') {
		return { title: 'Groq', }
	}
	else if (providerName === 'xAI') {
		return { title: 'Grok (xAI)', }
	}
	else if (providerName === 'mistral') {
		return { title: 'Mistral', }
	}
	else if (providerName === 'googleVertex') {
		return { title: 'Google Vertex AI', }
	}
	else if (providerName === 'microsoftAzure') {
		return { title: 'Microsoft Azure OpenAI', }
	}
	else if (providerName === 'awsBedrock') {
		return { title: 'AWS Bedrock', }
	}

	throw new Error(`descOfProviderName: Unknown provider name: "${providerName}"`)
}

export const subTextMdOfProviderName = (providerName: ProviderName): string => {

	if (providerName === 'anthropic') return 'Get your [API Key here](https://console.anthropic.com/settings/keys).'
	if (providerName === 'openAI') return 'Get your [API Key here](https://platform.openai.com/api-keys).'
	if (providerName === 'gemini') return 'Get your [API Key here](https://aistudio.google.com/apikey). Read about [rate limits here](https://ai.google.dev/gemini-api/docs/rate-limits#current-rate-limits).'
	if (providerName === 'deepseek') return 'Get your [API Key here](https://platform.deepseek.com/api_keys).'
	if (providerName === 'openRouter') return 'Get your [API Key here](https://openrouter.ai/settings/keys). Read about [rate limits here](https://openrouter.ai/docs/api-reference/limits).'
	if (providerName === 'groq') return 'Get your [API Key here](https://console.groq.com/keys).'
	if (providerName === 'xAI') return 'Get your [API Key here](https://console.x.ai).'
	if (providerName === 'mistral') return 'Get your [API Key here](https://console.mistral.ai/api-keys).'
	if (providerName === 'openAICompatible') return `Use any provider that's OpenAI-compatible (use this for llama.cpp and more).`
	if (providerName === 'googleVertex') return 'You must authenticate before using Vertex with Void. Read more about endpoints [here](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/call-vertex-using-openai-library), and regions [here](https://cloud.google.com/vertex-ai/docs/general/locations#available-regions).'
	if (providerName === 'microsoftAzure') return 'Read more about endpoints [here](https://learn.microsoft.com/en-us/rest/api/aifoundry/model-inference/get-chat-completions/get-chat-completions?view=rest-aifoundry-model-inference-2024-05-01-preview&tabs=HTTP), and get your API key [here](https://learn.microsoft.com/en-us/azure/search/search-security-api-keys?tabs=rest-use%2Cportal-find%2Cportal-query#find-existing-keys).'
	if (providerName === 'awsBedrock') return 'Connect via a LiteLLM proxy or the AWS [Bedrock-Access-Gateway](https://github.com/aws-samples/bedrock-access-gateway). LiteLLM Bedrock setup docs are [here](https://docs.litellm.ai/docs/providers/bedrock).'
	if (providerName === 'ollama') return 'Read more about custom [Endpoints here](https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-expose-ollama-on-my-network).'
	if (providerName === 'vLLM') return 'Read more about custom [Endpoints here](https://docs.vllm.ai/en/latest/getting_started/quickstart.html#openai-compatible-server).'
	if (providerName === 'lmStudio') return 'Read more about custom [Endpoints here](https://lmstudio.ai/docs/app/api/endpoints/openai).'
	if (providerName === 'liteLLM') return 'Read more about endpoints [here](https://docs.litellm.ai/docs/providers/openai_compatible).'

	throw new Error(`subTextMdOfProviderName: Unknown provider name: "${providerName}"`)
}

type DisplayInfo = {
	title: string;
	placeholder: string;
	isPasswordField?: boolean;
}
export const displayInfoOfSettingName = (providerName: ProviderName, settingName: SettingName): DisplayInfo => {
	if (settingName === 'apiKey') {
		return {
			title: 'API Key',

			// **Please follow this convention**:
			// The word "key..." here is a placeholder for the hash. For example, sk-ant-key... means the key will look like sk-ant-abcdefg123...
			placeholder: providerName === 'anthropic' ? 'sk-ant-key...' : // sk-ant-api03-key
				providerName === 'openAI' ? 'sk-proj-key...' :
					providerName === 'deepseek' ? 'sk-key...' :
						providerName === 'openRouter' ? 'sk-or-key...' : // sk-or-v1-key
							providerName === 'gemini' ? 'AIzaSy...' :
								providerName === 'groq' ? 'gsk_key...' :
									providerName === 'openAICompatible' ? 'sk-key...' :
										providerName === 'xAI' ? 'xai-key...' :
											providerName === 'mistral' ? 'api-key...' :
												providerName === 'googleVertex' ? 'AIzaSy...' :
													providerName === 'microsoftAzure' ? 'key-...' :
														providerName === 'awsBedrock' ? 'key-...' :
															'',

			isPasswordField: true,
		}
	}
	else if (settingName === 'endpoint') {
		return {
			title: providerName === 'ollama' ? 'Endpoint' :
				providerName === 'vLLM' ? 'Endpoint' :
					providerName === 'lmStudio' ? 'Endpoint' :
						providerName === 'openAICompatible' ? 'baseURL' : // (do not include /chat/completions)
							providerName === 'googleVertex' ? 'baseURL' :
								providerName === 'microsoftAzure' ? 'baseURL' :
									providerName === 'liteLLM' ? 'baseURL' :
										providerName === 'awsBedrock' ? 'Endpoint' :
											'(never)',

			placeholder: providerName === 'ollama' ? defaultProviderSettings.ollama.endpoint
				: providerName === 'vLLM' ? defaultProviderSettings.vLLM.endpoint
					: providerName === 'openAICompatible' ? 'https://my-website.com/v1'
						: providerName === 'lmStudio' ? defaultProviderSettings.lmStudio.endpoint
							: providerName === 'liteLLM' ? 'http://localhost:4000'
								: providerName === 'awsBedrock' ? 'http://localhost:4000/v1'
									: '(never)',


		}
	}
	else if (settingName === 'headersJSON') {
		return { title: 'Custom Headers', placeholder: '{ "X-Request-Id": "..." }' }
	}
	else if (settingName === 'region') {
		// vertex only
		return {
			title: 'Region',
			placeholder: providerName === 'googleVertex' ? defaultProviderSettings.googleVertex.region
				: providerName === 'awsBedrock'
					? defaultProviderSettings.awsBedrock.region
					: ''
		}
	}
	else if (settingName === 'azureApiVersion') {
		// azure only
		return {
			title: 'API Version',
			placeholder: providerName === 'microsoftAzure' ? defaultProviderSettings.microsoftAzure.azureApiVersion
				: ''
		}
	}
	else if (settingName === 'project') {
		return {
			title: providerName === 'microsoftAzure' ? 'Resource'
				: providerName === 'googleVertex' ? 'Project'
					: '',
			placeholder: providerName === 'microsoftAzure' ? 'my-resource'
				: providerName === 'googleVertex' ? 'my-project'
					: ''

		}

	}
	else if (settingName === '_didFillInProviderSettings') {
		return {
			title: '(never)',
			placeholder: '(never)',
		}
	}
	else if (settingName === 'models') {
		return {
			title: '(never)',
			placeholder: '(never)',
		}
	}

	throw new Error(`displayInfo: Unknown setting name: "${settingName}"`)
}


const defaultCustomSettings: Record<CustomSettingName, undefined> = {
	apiKey: undefined,
	endpoint: undefined,
	region: undefined, // googleVertex
	project: undefined,
	azureApiVersion: undefined,
	headersJSON: undefined,
}


const modelInfoOfDefaultModelNames = (defaultModelNames: string[]): { models: VoidStatefulModelInfo[] } => {
	return {
		models: defaultModelNames.map((modelName, i) => ({
			modelName,
			type: 'default',
			isHidden: defaultModelNames.length >= 10, // hide all models if there are a ton of them, and make user enable them individually
		}))
	}
}

// used when waiting and for a type reference
export const defaultSettingsOfProvider: SettingsOfProvider = {
	anthropic: {
		...defaultCustomSettings,
		...defaultProviderSettings.anthropic,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.anthropic),
		_didFillInProviderSettings: undefined,
	},
	openAI: {
		...defaultCustomSettings,
		...defaultProviderSettings.openAI,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.openAI),
		_didFillInProviderSettings: undefined,
	},
	deepseek: {
		...defaultCustomSettings,
		...defaultProviderSettings.deepseek,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.deepseek),
		_didFillInProviderSettings: undefined,
	},
	gemini: {
		...defaultCustomSettings,
		...defaultProviderSettings.gemini,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.gemini),
		_didFillInProviderSettings: undefined,
	},
	xAI: {
		...defaultCustomSettings,
		...defaultProviderSettings.xAI,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.xAI),
		_didFillInProviderSettings: undefined,
	},
	mistral: {
		...defaultCustomSettings,
		...defaultProviderSettings.mistral,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.mistral),
		_didFillInProviderSettings: undefined,
	},
	liteLLM: {
		...defaultCustomSettings,
		...defaultProviderSettings.liteLLM,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.liteLLM),
		_didFillInProviderSettings: undefined,
	},
	lmStudio: {
		...defaultCustomSettings,
		...defaultProviderSettings.lmStudio,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.lmStudio),
		_didFillInProviderSettings: undefined,
	},
	groq: { // aggregator (serves models from multiple providers)
		...defaultCustomSettings,
		...defaultProviderSettings.groq,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.groq),
		_didFillInProviderSettings: undefined,
	},
	openRouter: { // aggregator (serves models from multiple providers)
		...defaultCustomSettings,
		...defaultProviderSettings.openRouter,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.openRouter),
		_didFillInProviderSettings: undefined,
	},
	openAICompatible: { // aggregator (serves models from multiple providers)
		...defaultCustomSettings,
		...defaultProviderSettings.openAICompatible,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.openAICompatible),
		_didFillInProviderSettings: undefined,
	},
	ollama: { // aggregator (serves models from multiple providers)
		...defaultCustomSettings,
		...defaultProviderSettings.ollama,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.ollama),
		_didFillInProviderSettings: undefined,
	},
	vLLM: { // aggregator (serves models from multiple providers)
		...defaultCustomSettings,
		...defaultProviderSettings.vLLM,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.vLLM),
		_didFillInProviderSettings: undefined,
	},
	googleVertex: { // aggregator (serves models from multiple providers)
		...defaultCustomSettings,
		...defaultProviderSettings.googleVertex,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.googleVertex),
		_didFillInProviderSettings: undefined,
	},
	microsoftAzure: { // aggregator (serves models from multiple providers)
		...defaultCustomSettings,
		...defaultProviderSettings.microsoftAzure,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.microsoftAzure),
		_didFillInProviderSettings: undefined,
	},
	awsBedrock: { // aggregator (serves models from multiple providers)
		...defaultCustomSettings,
		...defaultProviderSettings.awsBedrock,
		...modelInfoOfDefaultModelNames(defaultModelsOfProvider.awsBedrock),
		_didFillInProviderSettings: undefined,
	},
}


export type ModelSelection = { providerName: ProviderName, modelName: string }

export const modelSelectionsEqual = (m1: ModelSelection, m2: ModelSelection) => {
	return m1.modelName === m2.modelName && m1.providerName === m2.providerName
}

// this is a state
export const featureNames = ['Chat', 'Ctrl+K', 'Autocomplete', 'Apply', 'SCM'] as const
export type ModelSelectionOfFeature = Record<(typeof featureNames)[number], ModelSelection | null>
export type FeatureName = keyof ModelSelectionOfFeature

export const displayInfoOfFeatureName = (featureName: FeatureName) => {
	// editor:
	if (featureName === 'Autocomplete')
		return 'Autocomplete'
	else if (featureName === 'Ctrl+K')
		return 'Quick Edit'
	// sidebar:
	else if (featureName === 'Chat')
		return 'Chat'
	else if (featureName === 'Apply')
		return 'Apply'
	// source control:
	else if (featureName === 'SCM')
		return 'Commit Message Generator'
	else
		throw new Error(`Feature Name ${featureName} not allowed`)
}


// the models of these can be refreshed (in theory all can, but not all should)
export const refreshableProviderNames = localProviderNames
export type RefreshableProviderName = typeof refreshableProviderNames[number]

// models that come with download buttons
export const hasDownloadButtonsOnModelsProviderNames = ['ollama'] as const satisfies ProviderName[]





// use this in isFeatuerNameDissbled
export const isProviderNameDisabled = (providerName: ProviderName, settingsState: VoidSettingsState) => {

	const settingsAtProvider = settingsState.settingsOfProvider[providerName]
	const isAutodetected = (refreshableProviderNames as string[]).includes(providerName)

	const isDisabled = settingsAtProvider.models.length === 0
	if (isDisabled) {
		return isAutodetected ? 'providerNotAutoDetected' : (!settingsAtProvider._didFillInProviderSettings ? 'notFilledIn' : 'addModel')
	}
	return false
}

export const isFeatureNameDisabled = (featureName: FeatureName, settingsState: VoidSettingsState) => {
	// if has a selected provider, check if it's enabled
	const selectedProvider = settingsState.modelSelectionOfFeature[featureName]

	if (selectedProvider) {
		const { providerName } = selectedProvider
		return isProviderNameDisabled(providerName, settingsState)
	}

	// if there are any models they can turn on, tell them that
	const canTurnOnAModel = !!providerNames.find(providerName => settingsState.settingsOfProvider[providerName].models.filter(m => m.isHidden).length !== 0)
	if (canTurnOnAModel) return 'needToEnableModel'

	// if there are any providers filled in, then they just need to add a model
	const anyFilledIn = !!providerNames.find(providerName => settingsState.settingsOfProvider[providerName]._didFillInProviderSettings)
	if (anyFilledIn) return 'addModel'

	return 'addProvider'
}







export type ChatMode = 'case_manager' | 'research' | 'drafting'


export type GlobalSettings = {
	autoRefreshModels: boolean;
	aiInstructions: string;
	enableAutocomplete: boolean;
	syncApplyToChat: boolean;
	syncSCMToChat: boolean;
	enableFastApply: boolean;
	chatMode: ChatMode;
	autoApprove: { [approvalType in ToolApprovalType]?: boolean };
	showInlineSuggestions: boolean;
	includeToolLintErrors: boolean;
	isOnboardingComplete: boolean;
	disableSystemMessage: boolean;
	autoAcceptLLMChanges: boolean;
	// Web Search settings
	braveSearchApiKey: string;
	webSearchEnabled: boolean;
	// RAG settings
	ragEnabled: boolean;
	ragChunkSize: number;
	ragChunkOverlap: number;
	ragSearchLimit: number;
	ragStorageScope: RAGStorageScope;
	ragVectorBackend: RAGVectorBackend;
	ragOpenAIModel: RAGOpenAIModel;
	ragChromaUrl?: string;
	ragAutoIndexCoreReferences: boolean;
	ragAutoIndexCaseFiles: boolean; // Auto-index all workspace documents (except core references folder) as case files
	ragCoreReferencesFolderName: string;
	ragWatchCoreReferencesFolder: boolean;
	ragShowIndexedBadge: boolean;
	ragPollIntervalSeconds: number;  // Polling interval in seconds (0 = disabled, fallback for file copy detection)
	// RAG Enhancement Settings (Phase 1-6)
	ragUseHybridSearch: boolean;           // Enable BM25 + vector hybrid search
	ragRRFConstant: number;                // Reciprocal Rank Fusion k constant (default: 20 for medical/legal)
	ragBM25K1: number;                     // BM25 k1 parameter (term frequency saturation, default: 0.8)
	ragBM25B: number;                      // BM25 b parameter (document length normalization, default: 0.5)
	ragUseReranking: boolean;              // Enable cross-encoder reranking
	ragRerankModel: 'ms-marco-MiniLM' | 'bge-reranker-base'; // Reranker model selection
	ragRerankBatchSize: number;            // Batch size for reranking (default: 10)
	ragRerankTopK: number;                 // Number of final results after reranking (default: 5)
	ragEnableQueryDecomposition: boolean;  // Enable query decomposition and routing
	ragEnableQueryRouting: boolean;        // Enable automatic scope routing based on query keywords
	ragUseContextualChunking: boolean;     // Enable document metadata enrichment in chunks
	ragInitialRetrievalMultiplier: number; // Multiplier for initial retrieval before reranking (default: 4)
	// Hierarchical Chunking Settings (Phase 1)
	ragChildChunkSize: number;             // Token size for child chunks (default: 300, for precise retrieval)
	ragParentChunkSize: number;            // Token size for parent chunks (default: 800, for context)
	ragChunkOverlapPercent: number;        // Overlap percentage for hierarchical chunks (default: 15%)
	ragMinChunkSize: number;               // Minimum chunk size in tokens (default: 100)
	ragMaxChunkSize: number;               // Maximum chunk size in tokens (default: 1024)
	caseOrganizerAutoCreateTosort: boolean;
	caseOrganizerTosortFolderName: string;
	// PDF Viewer settings
	pdfPreloadStrategy: 'on-demand' | 'adjacent' | 'all';
	// SafeAppeals Cloud settings
	voidCloudEnabled: boolean;                    // Master toggle for SafeAppeals Cloud
	voidCloudApiUrl: string;                      // API URL (for self-hosting)
	voidCloudModeOfProvider: CloudModeOfProvider; // Per-provider cloud mode toggle
	// Context Window Tracking settings
	contextWindowShowIndicator: boolean;          // Show context usage indicator in chat
	contextWindowAutoSummarize: boolean;          // Enable auto-summarization when approaching limit
	contextWindowAutoSummarizeThreshold: number;  // Threshold percentage to trigger auto-summarize (0.0-1.0)
	contextWindowPreserveRecentMessages: number;  // Number of recent messages to preserve when summarizing
	// File Converter settings
	fileConverterEnabled: boolean;                // Enable file converter feature
	fileConverterPythonPath: string;              // Path to Python executable (empty = use system Python)
	// OCR settings for scanned PDF extraction
	ocrEnableAutoOCR: boolean;                    // Enable automatic OCR for scanned PDFs
	ocrLanguage: string;                          // Tesseract OCR language code (e.g., 'eng', 'fra', 'deu')
	ocrScannedThreshold: number;                  // Chars/page threshold for scanned PDF detection (default: 50)
	// DocuSign e-signature settings
	docuSign?: {
		integrationKey: string;                     // User's custom Integration Key (Client ID)
		environment: 'demo' | 'production';         // DocuSign environment
		accountId?: string;                         // Optional: saved account ID
		useCustomKey?: boolean;                     // If true, use user's custom key instead of bundled
		// JWT Grant authentication fields
		userId?: string;                            // User ID (GUID) for JWT impersonation
		privateKeyConfigured?: boolean;             // Whether private key is stored via safeStorage
		authMode?: 'jwt' | 'oauth';                 // Authentication mode (jwt is recommended)
		consentStatus?: 'unknown' | 'granted' | 'required' | 'error'; // JWT consent status
	};
}

export const defaultGlobalSettings: GlobalSettings = {
	autoRefreshModels: true,
	aiInstructions: '',
	enableAutocomplete: false,
	syncApplyToChat: true,
	syncSCMToChat: true,
	enableFastApply: true,
	chatMode: 'case_manager',
	autoApprove: {},
	showInlineSuggestions: true,
	includeToolLintErrors: true,
	isOnboardingComplete: false,
	disableSystemMessage: false,
	autoAcceptLLMChanges: false,
	// Web Search defaults
	braveSearchApiKey: '',
	webSearchEnabled: true,
	// RAG defaults - IMPROVED for better retrieval quality
	ragEnabled: true,
	ragChunkSize: 1200,  // Increased from 1000 for better context
	ragChunkOverlap: 200, // Increased from 100 for better continuity
	ragSearchLimit: 8,    // Increased from 5 for better diversity after MMR
	ragStorageScope: 'workspace_docs',
	ragVectorBackend: 'chroma-http',
	ragOpenAIModel: 'text-embedding-3-small',
	ragChromaUrl: 'http://localhost:8000',
	ragAutoIndexCoreReferences: true,
	ragAutoIndexCaseFiles: true, // Auto-index workspace documents as case files on startup
	ragCoreReferencesFolderName: 'core_references',
	ragWatchCoreReferencesFolder: true,
	ragShowIndexedBadge: true,
	ragPollIntervalSeconds: 30,  // Poll every 30 seconds as fallback for file copy detection
	// RAG Enhancement Defaults (Research-backed values from docs/RAG_ENHANCEMENT_RESEARCH.md)
	ragUseHybridSearch: true,              // Enable BM25 + vector hybrid search for better recall
	ragRRFConstant: 20,                    // k=20 optimized for medical/legal precision (NOT 60!)
	ragBM25K1: 0.8,                        // Domain-specific TF saturation for core references
	ragBM25B: 0.5,                         // Reduced length normalization for structured documents
	ragUseReranking: true,                 // Enable cross-encoder for 20%+ accuracy improvement
	ragRerankModel: 'ms-marco-MiniLM',     // Best speed/accuracy trade-off (~90MB, fast inference)
	ragRerankBatchSize: 10,                // Memory-efficient batch processing
	ragRerankTopK: 5,                      // Final result count after reranking
	ragEnableQueryDecomposition: true,     // Enable query decomposition for complex queries
	ragEnableQueryRouting: true,           // Enable automatic scope routing (60-70% fast path)
	ragUseContextualChunking: true,        // Enable document metadata enrichment
	ragInitialRetrievalMultiplier: 4,      // Retrieve 4x desired results before reranking
	// Hierarchical Chunking Defaults (Research-backed from Section 4)
	ragChildChunkSize: 300,                // Child chunks: 300 tokens for precise retrieval
	ragParentChunkSize: 800,               // Parent chunks: 800 tokens for contextual understanding
	ragChunkOverlapPercent: 15,            // 15% overlap balances context vs redundancy
	ragMinChunkSize: 100,                  // Minimum viable chunk size (merge smaller)
	ragMaxChunkSize: 1024,                 // Hard limit for embedding model compatibility
	caseOrganizerAutoCreateTosort: true,
	caseOrganizerTosortFolderName: 'tosort',
	// PDF Viewer defaults
	pdfPreloadStrategy: 'all',
	// SafeAppeals Cloud defaults
	voidCloudEnabled: false,                      // Disabled by default, user must opt-in
	voidCloudApiUrl: 'https://void-cloud-production.up.railway.app', // Default API URL
	voidCloudModeOfProvider: defaultCloudModeOfProvider,
	// Context Window Tracking defaults
	contextWindowShowIndicator: true,             // Show indicator by default
	contextWindowAutoSummarize: false,            // Disabled by default, user must opt-in
	contextWindowAutoSummarizeThreshold: 0.85,    // Trigger at 85% capacity
	contextWindowPreserveRecentMessages: 4,       // Preserve last 4 messages
	// File Converter defaults
	fileConverterEnabled: true,                   // Enabled by default
	fileConverterPythonPath: '',                  // Empty = use system Python
	// OCR defaults
	ocrEnableAutoOCR: true,                       // Enabled by default for scanned PDF support
	ocrLanguage: 'eng',                           // Default to English
	ocrScannedThreshold: 50,                      // 50 chars/page threshold for scanned detection
	// DocuSign defaults
	docuSign: {
		integrationKey: '',                         // User must configure their Integration Key
		environment: 'demo',                        // Start with demo for testing
		authMode: 'jwt',                            // Use JWT Grant flow (recommended for desktop)
		consentStatus: 'unknown',                   // Consent not yet determined
	},
}

export type GlobalSettingName = keyof GlobalSettings
export const globalSettingNames = Object.keys(defaultGlobalSettings) as GlobalSettingName[]












export type ModelSelectionOptions = {
	// Note: reasoningEnabled, reasoningBudget, reasoningEffort removed - reasoning is always on at max for supported models
}

export type OptionsOfModelSelection = {
	[featureName in FeatureName]: Partial<{
		[providerName in ProviderName]: {
			[modelName: string]: ModelSelectionOptions | undefined
		}
	}>
}





export type OverridesOfModel = {
	[providerName in ProviderName]: {
		[modelName: string]: Partial<ModelOverrides> | undefined
	}
}


const overridesOfModel = {} as OverridesOfModel
for (const providerName of providerNames) { overridesOfModel[providerName] = {} }
export const defaultOverridesOfModel = overridesOfModel



export interface MCPUserStateOfName {
	[serverName: string]: MCPUserState | undefined;
}

export interface MCPUserState {
	isOn: boolean;
}

/*--------------------------------------------------------------------------------------
 *  Copyright 2025 Glass Devtools, Inc. All rights reserved.
 *  Licensed under the Apache License, Version 2.0. See LICENSE.txt for more information.
 *--------------------------------------------------------------------------------------*/
import { defaultModelsOfProvider, defaultProviderSettings } from './modelCapabilities.js';
export const providerNames = Object.keys(defaultProviderSettings);
export const localProviderNames = ['ollama', 'vLLM', 'lmStudio']; // all local names
export const nonlocalProviderNames = providerNames.filter((name) => !localProviderNames.includes(name)); // all non-local names
export const customSettingNamesOfProvider = (providerName) => {
    return Object.keys(defaultProviderSettings[providerName]);
};
export const displayInfoOfProviderName = (providerName) => {
    if (providerName === 'anthropic') {
        return { title: 'Anthropic', };
    }
    else if (providerName === 'openAI') {
        return { title: 'OpenAI', };
    }
    else if (providerName === 'deepseek') {
        return { title: 'DeepSeek', };
    }
    else if (providerName === 'openRouter') {
        return { title: 'OpenRouter', };
    }
    else if (providerName === 'ollama') {
        return { title: 'Ollama', };
    }
    else if (providerName === 'vLLM') {
        return { title: 'vLLM', };
    }
    else if (providerName === 'liteLLM') {
        return { title: 'LiteLLM', };
    }
    else if (providerName === 'lmStudio') {
        return { title: 'LM Studio', };
    }
    else if (providerName === 'openAICompatible') {
        return { title: 'OpenAI-Compatible', };
    }
    else if (providerName === 'gemini') {
        return { title: 'Gemini', };
    }
    else if (providerName === 'groq') {
        return { title: 'Groq', };
    }
    else if (providerName === 'xAI') {
        return { title: 'Grok (xAI)', };
    }
    else if (providerName === 'mistral') {
        return { title: 'Mistral', };
    }
    else if (providerName === 'googleVertex') {
        return { title: 'Google Vertex AI', };
    }
    else if (providerName === 'microsoftAzure') {
        return { title: 'Microsoft Azure OpenAI', };
    }
    else if (providerName === 'awsBedrock') {
        return { title: 'AWS Bedrock', };
    }
    throw new Error(`descOfProviderName: Unknown provider name: "${providerName}"`);
};
export const subTextMdOfProviderName = (providerName) => {
    if (providerName === 'anthropic')
        return 'Get your [API Key here](https://console.anthropic.com/settings/keys).';
    if (providerName === 'openAI')
        return 'Get your [API Key here](https://platform.openai.com/api-keys).';
    if (providerName === 'deepseek')
        return 'Get your [API Key here](https://platform.deepseek.com/api_keys).';
    if (providerName === 'openRouter')
        return 'Get your [API Key here](https://openrouter.ai/settings/keys). Read about [rate limits here](https://openrouter.ai/docs/api-reference/limits).';
    if (providerName === 'gemini')
        return 'Get your [API Key here](https://aistudio.google.com/apikey). Read about [rate limits here](https://ai.google.dev/gemini-api/docs/rate-limits#current-rate-limits).';
    if (providerName === 'groq')
        return 'Get your [API Key here](https://console.groq.com/keys).';
    if (providerName === 'xAI')
        return 'Get your [API Key here](https://console.x.ai).';
    if (providerName === 'mistral')
        return 'Get your [API Key here](https://console.mistral.ai/api-keys).';
    if (providerName === 'openAICompatible')
        return `Use any provider that's OpenAI-compatible (use this for llama.cpp and more).`;
    if (providerName === 'googleVertex')
        return 'You must authenticate before using Vertex with Void. Read more about endpoints [here](https://cloud.google.com/vertex-ai/generative-ai/docs/multimodal/call-vertex-using-openai-library), and regions [here](https://cloud.google.com/vertex-ai/docs/general/locations#available-regions).';
    if (providerName === 'microsoftAzure')
        return 'Read more about endpoints [here](https://learn.microsoft.com/en-us/rest/api/aifoundry/model-inference/get-chat-completions/get-chat-completions?view=rest-aifoundry-model-inference-2024-05-01-preview&tabs=HTTP), and get your API key [here](https://learn.microsoft.com/en-us/azure/search/search-security-api-keys?tabs=rest-use%2Cportal-find%2Cportal-query#find-existing-keys).';
    if (providerName === 'awsBedrock')
        return 'Connect via a LiteLLM proxy or the AWS [Bedrock-Access-Gateway](https://github.com/aws-samples/bedrock-access-gateway). LiteLLM Bedrock setup docs are [here](https://docs.litellm.ai/docs/providers/bedrock).';
    if (providerName === 'ollama')
        return 'Read more about custom [Endpoints here](https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-expose-ollama-on-my-network).';
    if (providerName === 'vLLM')
        return 'Read more about custom [Endpoints here](https://docs.vllm.ai/en/latest/getting_started/quickstart.html#openai-compatible-server).';
    if (providerName === 'lmStudio')
        return 'Read more about custom [Endpoints here](https://lmstudio.ai/docs/app/api/endpoints/openai).';
    if (providerName === 'liteLLM')
        return 'Read more about endpoints [here](https://docs.litellm.ai/docs/providers/openai_compatible).';
    throw new Error(`subTextMdOfProviderName: Unknown provider name: "${providerName}"`);
};
export const displayInfoOfSettingName = (providerName, settingName) => {
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
        };
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
        };
    }
    else if (settingName === 'headersJSON') {
        return { title: 'Custom Headers', placeholder: '{ "X-Request-Id": "..." }' };
    }
    else if (settingName === 'region') {
        // vertex only
        return {
            title: 'Region',
            placeholder: providerName === 'googleVertex' ? defaultProviderSettings.googleVertex.region
                : providerName === 'awsBedrock'
                    ? defaultProviderSettings.awsBedrock.region
                    : ''
        };
    }
    else if (settingName === 'azureApiVersion') {
        // azure only
        return {
            title: 'API Version',
            placeholder: providerName === 'microsoftAzure' ? defaultProviderSettings.microsoftAzure.azureApiVersion
                : ''
        };
    }
    else if (settingName === 'project') {
        return {
            title: providerName === 'microsoftAzure' ? 'Resource'
                : providerName === 'googleVertex' ? 'Project'
                    : '',
            placeholder: providerName === 'microsoftAzure' ? 'my-resource'
                : providerName === 'googleVertex' ? 'my-project'
                    : ''
        };
    }
    else if (settingName === '_didFillInProviderSettings') {
        return {
            title: '(never)',
            placeholder: '(never)',
        };
    }
    else if (settingName === 'models') {
        return {
            title: '(never)',
            placeholder: '(never)',
        };
    }
    throw new Error(`displayInfo: Unknown setting name: "${settingName}"`);
};
const defaultCustomSettings = {
    apiKey: undefined,
    endpoint: undefined,
    region: undefined, // googleVertex
    project: undefined,
    azureApiVersion: undefined,
    headersJSON: undefined,
};
const modelInfoOfDefaultModelNames = (defaultModelNames) => {
    return {
        models: defaultModelNames.map((modelName, i) => ({
            modelName,
            type: 'default',
            isHidden: defaultModelNames.length >= 10, // hide all models if there are a ton of them, and make user enable them individually
        }))
    };
};
// used when waiting and for a type reference
export const defaultSettingsOfProvider = {
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
    groq: {
        ...defaultCustomSettings,
        ...defaultProviderSettings.groq,
        ...modelInfoOfDefaultModelNames(defaultModelsOfProvider.groq),
        _didFillInProviderSettings: undefined,
    },
    openRouter: {
        ...defaultCustomSettings,
        ...defaultProviderSettings.openRouter,
        ...modelInfoOfDefaultModelNames(defaultModelsOfProvider.openRouter),
        _didFillInProviderSettings: undefined,
    },
    openAICompatible: {
        ...defaultCustomSettings,
        ...defaultProviderSettings.openAICompatible,
        ...modelInfoOfDefaultModelNames(defaultModelsOfProvider.openAICompatible),
        _didFillInProviderSettings: undefined,
    },
    ollama: {
        ...defaultCustomSettings,
        ...defaultProviderSettings.ollama,
        ...modelInfoOfDefaultModelNames(defaultModelsOfProvider.ollama),
        _didFillInProviderSettings: undefined,
    },
    vLLM: {
        ...defaultCustomSettings,
        ...defaultProviderSettings.vLLM,
        ...modelInfoOfDefaultModelNames(defaultModelsOfProvider.vLLM),
        _didFillInProviderSettings: undefined,
    },
    googleVertex: {
        ...defaultCustomSettings,
        ...defaultProviderSettings.googleVertex,
        ...modelInfoOfDefaultModelNames(defaultModelsOfProvider.googleVertex),
        _didFillInProviderSettings: undefined,
    },
    microsoftAzure: {
        ...defaultCustomSettings,
        ...defaultProviderSettings.microsoftAzure,
        ...modelInfoOfDefaultModelNames(defaultModelsOfProvider.microsoftAzure),
        _didFillInProviderSettings: undefined,
    },
    awsBedrock: {
        ...defaultCustomSettings,
        ...defaultProviderSettings.awsBedrock,
        ...modelInfoOfDefaultModelNames(defaultModelsOfProvider.awsBedrock),
        _didFillInProviderSettings: undefined,
    },
};
export const modelSelectionsEqual = (m1, m2) => {
    return m1.modelName === m2.modelName && m1.providerName === m2.providerName;
};
// this is a state
export const featureNames = ['Chat', 'Ctrl+K', 'Autocomplete', 'Apply', 'SCM'];
export const displayInfoOfFeatureName = (featureName) => {
    // editor:
    if (featureName === 'Autocomplete')
        return 'Autocomplete';
    else if (featureName === 'Ctrl+K')
        return 'Quick Edit';
    // sidebar:
    else if (featureName === 'Chat')
        return 'Chat';
    else if (featureName === 'Apply')
        return 'Apply';
    // source control:
    else if (featureName === 'SCM')
        return 'Commit Message Generator';
    else
        throw new Error(`Feature Name ${featureName} not allowed`);
};
// the models of these can be refreshed (in theory all can, but not all should)
export const refreshableProviderNames = localProviderNames;
// models that come with download buttons
export const hasDownloadButtonsOnModelsProviderNames = ['ollama'];
// use this in isFeatuerNameDissbled
export const isProviderNameDisabled = (providerName, settingsState) => {
    const settingsAtProvider = settingsState.settingsOfProvider[providerName];
    const isAutodetected = refreshableProviderNames.includes(providerName);
    const isDisabled = settingsAtProvider.models.length === 0;
    if (isDisabled) {
        return isAutodetected ? 'providerNotAutoDetected' : (!settingsAtProvider._didFillInProviderSettings ? 'notFilledIn' : 'addModel');
    }
    return false;
};
export const isFeatureNameDisabled = (featureName, settingsState) => {
    // if has a selected provider, check if it's enabled
    const selectedProvider = settingsState.modelSelectionOfFeature[featureName];
    if (selectedProvider) {
        const { providerName } = selectedProvider;
        return isProviderNameDisabled(providerName, settingsState);
    }
    // if there are any models they can turn on, tell them that
    const canTurnOnAModel = !!providerNames.find(providerName => settingsState.settingsOfProvider[providerName].models.filter(m => m.isHidden).length !== 0);
    if (canTurnOnAModel)
        return 'needToEnableModel';
    // if there are any providers filled in, then they just need to add a model
    const anyFilledIn = !!providerNames.find(providerName => settingsState.settingsOfProvider[providerName]._didFillInProviderSettings);
    if (anyFilledIn)
        return 'addModel';
    return 'addProvider';
};
export const defaultGlobalSettings = {
    autoRefreshModels: true,
    aiInstructions: '',
    enableAutocomplete: false,
    syncApplyToChat: true,
    syncSCMToChat: true,
    enableFastApply: true,
    chatMode: 'agent',
    autoApprove: {},
    showInlineSuggestions: true,
    includeToolLintErrors: true,
    isOnboardingComplete: false,
    disableSystemMessage: false,
    autoAcceptLLMChanges: false,
    // RAG defaults
    ragEnabled: true,
    ragChunkSize: 1000,
    ragChunkOverlap: 100,
    ragSearchLimit: 5,
    ragStorageScope: 'workspace_docs',
    ragVectorBackend: 'chroma-http',
    ragOpenAIModel: 'text-embedding-3-small',
    ragChromaUrl: 'http://localhost:8000',
    ragAutoIndexPolicyFolder: true,
    ragPolicyFolderName: 'policy-manuals',
    ragWatchPolicyFolder: true,
    ragShowIndexedBadge: true,
    caseOrganizerAutoCreateTosort: true,
    caseOrganizerTosortFolderName: 'tosort',
    // PDF Viewer defaults
    pdfPreloadStrategy: 'all',
};
export const globalSettingNames = Object.keys(defaultGlobalSettings);
const overridesOfModel = {};
for (const providerName of providerNames) {
    overridesOfModel[providerName] = {};
}
export const defaultOverridesOfModel = overridesOfModel;

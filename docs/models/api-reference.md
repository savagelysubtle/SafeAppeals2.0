# API Reference

Complete TypeScript API documentation for the AI Models Configuration Module.

## Core Types

### VoidStaticModelInfo

The fundamental model capability definition used throughout the system.

```typescript
interface VoidStaticModelInfo {
  // Token limits and memory
  contextWindow: number;
  reservedOutputTokenSpace: number | null;

  // Message format support
  supportsSystemMessage: false | 'system-role' | 'developer-role' | 'separated';

  // Advanced features
  specialToolFormat?: 'openai-style' | 'anthropic-style' | 'gemini-style';
  supportsFIM: boolean;

  // Additional API payload
  additionalOpenAIPayload?: { [key: string]: string };

  // Reasoning capabilities
  reasoningCapabilities?: {
    readonly supportsReasoning: true;
    readonly canIOReasoning: boolean;
    readonly reasoningReservedOutputTokenSpace?: number;
    readonly maxReasoningBudget?: number;
    readonly maxReasoningEffort?: string;
    readonly openSourceThinkTags?: [string, string];
  };

  // Tool calling (Phase 3)
  useNativeToolCalling?: boolean;
  forceXML?: boolean;

  // Informational only
  cost: {
    input: number;
    output: number;
    cache_read?: number;
    cache_write?: number;
  };
  downloadable: false | { sizeGb: number | 'not-known' };
}
```

**Field Descriptions:**

- **`contextWindow`**: Maximum input tokens the model can process
- **`reservedOutputTokenSpace`**: Tokens reserved for model output (null = default 4096)
- **`supportsSystemMessage`**: System message format support
  - `false`: No system message support
  - `'system-role'`: Standard system role
  - `'developer-role'`: Developer role (OpenAI)
  - `'separated'`: Separate system message field (Anthropic)
- **`specialToolFormat`**: Tool calling format (default: OpenAI-style)
- **`supportsFIM`**: Fill-in-the-middle autocomplete support
- **`additionalOpenAIPayload`**: Extra fields for OpenAI-compatible APIs
- **`reasoningCapabilities`**: Advanced reasoning configuration
- **`useNativeToolCalling`**: Prefer native tool calling over XML
- **`forceXML`**: Force XML tool calling even if native available

### VoidStaticProviderInfo

Provider configuration with model registry and capabilities.

```typescript
interface VoidStaticProviderInfo {
  // Model registry
  modelOptions: { [modelName: string]: VoidStaticModelInfo };

  // Fallback matching for unrecognized models
  modelOptionsFallback: (modelName: string, fallbackKnownValues?: Partial<VoidStaticModelInfo>) =>
    (VoidStaticModelInfo & { modelName: string; recognizedModelName: string }) | null;

  // Provider-specific reasoning I/O
  providerReasoningIOSettings?: ProviderReasoningIOSettings;
}
```

### SendableReasoningInfo

Runtime reasoning configuration for API calls.

```typescript
type SendableReasoningInfo = {
  type: 'budget';
  isReasoningEnabled: true;
  reasoningBudget: number;
} | {
  type: 'effort';
  isReasoningEnabled: true;
  reasoningEffort: string;
} | null;
```

### ProviderReasoningIOSettings

Provider-specific reasoning input/output handling.

```typescript
interface ProviderReasoningIOSettings {
  input?: {
    includeInPayload?: (reasoningState: SendableReasoningInfo) => null | { [key: string]: any };
  };
  output?: {
    nameOfFieldInDelta?: string;
    needsManualParse?: boolean;
  } | {
    nameOfFieldInDelta?: undefined;
    needsManualParse?: true;
  };
}
```

## Main Functions

### getModelCapabilities

Retrieves complete model capabilities with fallback support.

```typescript
function getModelCapabilities(
  providerName: ProviderName,
  modelName: string,
  overridesOfModel?: OverridesOfModel
): VoidStaticModelInfo & (
  | { modelName: string; recognizedModelName: string; isUnrecognizedModel: false }
  | { modelName: string; recognizedModelName?: undefined; isUnrecognizedModel: true }
)
```

**Parameters:**
- `providerName`: Provider identifier ('openAI', 'anthropic', etc.)
- `modelName`: Model name to look up
- `overridesOfModel`: Optional capability overrides

**Returns:**
- Model capabilities with recognition status
- Falls back to provider defaults for unrecognized models

**Example:**
```typescript
const caps = getModelCapabilities('openAI', 'gpt-5-turbo', overrides);
// Falls back to 'gpt-5' if 'gpt-5-turbo' not found
```

### getProviderCapabilities

Gets provider-level capabilities.

```typescript
function getProviderCapabilities(providerName: ProviderName): {
  providerReasoningIOSettings?: ProviderReasoningIOSettings;
}
```

### getIsReasoningEnabledState

Checks if reasoning is enabled for a model.

```typescript
function getIsReasoningEnabledState(
  featureName: FeatureName,
  providerName: ProviderName,
  modelName: string,
  modelSelectionOptions?: ModelSelectionOptions,
  overridesOfModel?: OverridesOfModel
): boolean
```

### getReservedOutputTokenSpace

Calculates reserved output token space considering reasoning.

```typescript
function getReservedOutputTokenSpace(
  providerName: ProviderName,
  modelName: string,
  opts: {
    isReasoningEnabled: boolean;
    overridesOfModel?: OverridesOfModel;
  }
): number
```

### getSendableReasoningInfo

Gets reasoning configuration for API calls.

```typescript
function getSendableReasoningInfo(
  featureName: FeatureName,
  providerName: ProviderName,
  modelName: string,
  modelSelectionOptions?: ModelSelectionOptions,
  overridesOfModel?: OverridesOfModel
): SendableReasoningInfo
```

## Model Override System

### ModelOverrides Type

Allowed model capability overrides.

```typescript
type ModelOverrides = Pick<VoidStaticModelInfo,
  | 'contextWindow'
  | 'reservedOutputTokenSpace'
  | 'supportsSystemMessage'
  | 'specialToolFormat'
  | 'supportsFIM'
  | 'reasoningCapabilities'
  | 'additionalOpenAIPayload'
  | 'useNativeToolCalling'
  | 'forceXML'
>;
```

### OverridesOfModel Type

Nested override structure by provider and model.

```typescript
type OverridesOfModel = {
  [providerName: string]: {
    [modelName: string]: ModelOverrides;
  };
};
```

## Provider Registry

### modelSettingsOfProvider

Central registry of all provider configurations.

```typescript
const modelSettingsOfProvider: {
  [providerName in ProviderName]: VoidStaticProviderInfo
} = {
  openAI: openAISettings,
  anthropic: anthropicSettings,
  xAI: xAISettings,
  // ... all providers
};
```

**Available Providers:**
- `openAI`, `anthropic`, `xAI`, `gemini`
- `deepseek`, `groq`, `mistral`, `openRouter`
- `ollama`, `vLLM`, `lmStudio`, `liteLLM`
- `googleVertex`, `microsoftAzure`, `awsBedrock`

## Default Values

### defaultModelOptions

Fallback model capabilities for unrecognized models.

```typescript
const defaultModelOptions = {
  contextWindow: 4_096,
  reservedOutputTokenSpace: 4_096,
  cost: { input: 0, output: 0 },
  downloadable: false,
  supportsSystemMessage: false,
  supportsFIM: false,
  reasoningCapabilities: false,
} as const satisfies VoidStaticModelInfo;
```

### defaultProviderSettings

Default API configuration for each provider.

```typescript
const defaultProviderSettings = {
  openAI: { apiKey: '' },
  anthropic: { apiKey: '' },
  // ... provider defaults
} as const;
```

### defaultModelsOfProvider

Default recommended model lists per provider.

```typescript
const defaultModelsOfProvider = {
  openAI: ['gpt-5.2', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano'],
  anthropic: ['claude-opus-4.5', 'claude-sonnet-4.5', /* ... */],
  // ... all providers
} as const satisfies Record<ProviderName, string[]>;
```

## Utility Functions

### openAICompatIncludeInPayloadReasoning

Helper for OpenAI-compatible reasoning payload inclusion.

```typescript
function openAICompatIncludeInPayloadReasoning(
  reasoningInfo: SendableReasoningInfo
): null | { reasoning_effort: string }
```

### createExtensiveModelOptionsFallback

Creates comprehensive fallback matching logic.

```typescript
function createExtensiveModelOptionsFallback(
  knownModels: { [modelName: string]: VoidStaticModelInfo },
  patterns: Array<{
    pattern: RegExp;
    fallbackModel: string;
  }>
): (modelName: string) => VoidStaticModelInfo | null
```

## Error Handling

The API uses TypeScript's type system for compile-time safety. Runtime errors occur when:

- Invalid provider name provided
- Model not found and no fallback available
- Malformed override objects

All functions return well-defined types with no `any` usage, ensuring type safety throughout the application.

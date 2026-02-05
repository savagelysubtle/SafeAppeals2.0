---
name: Refactor Model Capabilities
overview: Refactor the monolithic modelCapabilities.ts (~1682 lines) into a modular structure with provider-specific files organized under a models/ directory.
todos:
  - id: create-types
    content: Create models/types.ts with shared type definitions
    status: completed
  - id: create-defaults
    content: Create models/defaults.ts with provider settings and model lists
    status: completed
  - id: create-utils
    content: Create models/utils.ts with shared utility functions
    status: completed
  - id: create-anthropic
    content: Create models/anthropic/index.ts with Claude model definitions
    status: completed
  - id: create-google
    content: Create models/google/index.ts with Gemini model definitions
    status: completed
  - id: create-openai
    content: Create models/openai/index.ts with GPT/o-series model definitions
    status: completed
  - id: create-xai
    content: Create models/xai/index.ts with Grok model definitions
    status: completed
  - id: create-deepseek
    content: Create models/deepseek/index.ts with DeepSeek model definitions
    status: completed
  - id: create-mistral
    content: Create models/mistral/index.ts with Mistral model definitions
    status: completed
  - id: create-groq
    content: Create models/groq/index.ts with Groq model definitions
    status: completed
  - id: create-openrouter
    content: Create models/openrouter/index.ts with OpenRouter model definitions
    status: completed
  - id: create-local
    content: Create models/local/index.ts with self-hosted provider definitions
    status: completed
  - id: create-index
    content: Create models/index.ts main registry and re-exports
    status: completed
  - id: update-original
    content: Update modelCapabilities.ts to re-export from models/
    status: completed
---

# Refactor Model Capabilities by Provider

## New Directory Structure

````javascript
src/vs/workbench/contrib/void/common/
├── models/
│   ├── index.ts              # Main registry + re-exports
│   ├── types.ts              # Shared types (VoidStaticModelInfo, etc.)
│   ├── defaults.ts           # defaultProviderSettings, defaultModelsOfProvider
│   ├── utils.ts              # Shared utilities (toFallback, getModelCapabilities, etc.)
│   ├── anthropic/
│   │   └── index.ts          # Anthropic model options + settings
│   ├── google/
│   │   └── index.ts          # Gemini model options + settings  
│   ├── openai/
│   │   └── index.ts          # OpenAI model options + settings
│   ├── xai/
│   │   └── index.ts          # xAI/Grok model options + settings
│   ├── deepseek/
│   │   └── index.ts          # DeepSeek model options + settings
│   ├── mistral/
│   │   └── index.ts          # Mistral model options + settings
│   ├── groq/
│   │   └── index.ts          # Groq model options + settings
│   ├── openrouter/
│   │   └── index.ts          # OpenRouter model options + settings
│   └── local/
│       └── index.ts          # Ollama, vLLM, LM Studio, OpenAI Compatible, LiteLLM
└── modelCapabilities.ts      # Keep as re-export for backwards compatibility
```

## Implementation Steps

### 1. Create shared types file

Extract from [modelCapabilities.ts](src/vs/workbench/contrib/void/common/modelCapabilities.ts):

- `VoidStaticModelInfo` type
- `VoidStaticProviderInfo` type
- `ReasoningCapabilities` type
- `SendableReasoningInfo` type
- Helper type utilities

### 2. Create defaults file

Move `defaultProviderSettings` and `defaultModelsOfProvider` objects.

### 3. Create utils file

Move shared functions:

- `toFallback()`
- `getModelCapabilities()`
- `getProviderCapabilities()`
- `getIsReasoningEnabledState()`
- `getReservedOutputTokenSpace()`
- `getSendableReasoningInfo()`
- `defaultModelOptions` constant
- `openAICompatIncludeInPayloadReasoning` helper

### 4. Create provider-specific files

Each provider file exports:

- `{provider}ModelOptions` - the model definitions
- `{provider}Settings: VoidStaticProviderInfo` - provider config with fallback logic

Providers to extract:

- **anthropic/** - Claude models (~180 lines)
- **google/** - Gemini models (~120 lines)
- **openai/** - GPT/o-series models (~150 lines)
- **xai/** - Grok models (~75 lines)
- **deepseek/** - DeepSeek models (~60 lines)
- **mistral/** - Mistral/Codestral models (~85 lines)
- **groq/** - Groq-hosted models (~60 lines)
- **openrouter/** - OpenRouter models (~300 lines)
- **local/** - Self-hosted (Ollama, vLLM, LM Studio, OpenAI Compatible, LiteLLM, Google Vertex, Azure, AWS Bedrock) (~130 lines)

### 5. Create main index.ts

- Import all provider settings
- Build `modelSettingsOfProvider` registry
- Re-export all public functions and types

### 6. Update original modelCapabilities.ts

Convert to a simple re-export file for backwards compatibility:

```typescript
export * from './models/index.js';
```

### 7. Verify no breaking changes


````
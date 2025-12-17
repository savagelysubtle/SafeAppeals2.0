# AI Models Configuration Module

A comprehensive TypeScript module that centralizes AI model configurations, capabilities, and provider settings for the Void VSCode extension.

## Overview

This module provides a unified interface for managing AI model configurations across multiple providers including OpenAI, Anthropic, Google Gemini, xAI, and various open-source solutions. It handles model capabilities, cost tracking, reasoning features, and provider-specific settings.

## Features

- **Multi-Provider Support**: Unified configuration for 15+ AI providers
- **Type-Safe Model Definitions**: Strongly typed model capabilities and settings
- **Reasoning Capabilities**: Support for advanced reasoning models (Claude, GPT-o1, etc.)
- **Cost Tracking**: Input/output pricing for all supported models
- **Fallback Mechanisms**: Intelligent model matching for unrecognized variants
- **Tool Calling Support**: Native and XML-based tool calling configurations
- **Fill-in-the-Middle (FIM)**: Autocomplete model support

## Quick Start

```typescript
import { getModelCapabilities, modelSettingsOfProvider } from './models/index.js';

// Get capabilities for a specific model
const capabilities = getModelCapabilities('openAI', 'gpt-5', undefined);

// Access provider settings
const openAISettings = modelSettingsOfProvider.openAI;

// Check if reasoning is enabled
const supportsReasoning = capabilities.reasoningCapabilities?.supportsReasoning;
```

## Supported Providers

| Provider | Models | Key Features |
|----------|--------|--------------|
| **OpenAI** | GPT-5 series | Reasoning, tool calling, developer role |
| **Anthropic** | Claude 4.x series | Advanced reasoning, separated system messages |
| **Google** | Gemini 3.x/2.x | Multimodal, budget-based reasoning |
| **xAI** | Grok series | Fast inference, reasoning support |
| **DeepSeek** | Chat/Reasoner | Cost-effective reasoning |
| **Mistral** | Codestral, Devstral | Code-focused models |
| **Groq** | Llama/Qwen optimized | High-speed inference |
| **OpenRouter** | 100+ models | Model routing service |

### Local/Open-Source Providers
- **Ollama**: Local model serving
- **vLLM**: High-performance inference
- **LM Studio**: GUI model management
- **LiteLLM**: OpenAI-compatible proxy

### Cloud Providers
- **Google Vertex AI**: Enterprise-grade hosting
- **Microsoft Azure**: Azure OpenAI service
- **AWS Bedrock**: Multi-model platform

## Architecture

### Core Components

```
models/
├── index.ts          # Main registry and utility functions
├── types.ts          # TypeScript type definitions
├── defaults.ts       # Default provider settings and model lists
├── utils.ts          # Shared utilities and open-source model configs
├── [provider]/       # Provider-specific configurations
│   └── index.ts
└── docs/             # Documentation
```

### Key Types

- **`VoidStaticModelInfo`**: Complete model capability definition
- **`VoidStaticProviderInfo`**: Provider configuration with model registry
- **`SendableReasoningInfo`**: Reasoning configuration for API calls

## Model Capabilities

Each model is defined with comprehensive capabilities:

```typescript
interface VoidStaticModelInfo {
  contextWindow: number;           // Input token limit
  reservedOutputTokenSpace: number; // Output token reservation
  supportsSystemMessage: boolean | 'system-role' | 'developer-role' | 'separated';
  specialToolFormat?: 'openai-style' | 'anthropic-style' | 'gemini-style';
  supportsFIM: boolean;            // Fill-in-the-middle autocomplete
  reasoningCapabilities?: {
    supportsReasoning: true;
    canIOReasoning: boolean;       // Whether reasoning is output to user
    maxReasoningBudget?: number;   // Budget-based providers
    maxReasoningEffort?: string;   // Effort-based providers
  };
  cost: {
    input: number;                 // Cost per 1K input tokens
    output: number;                // Cost per 1K output tokens
    cache_read?: number;           // Cached input cost
    cache_write?: number;          // Cache write cost
  };
}
```

## Usage Examples

### Basic Model Lookup

```typescript
import { getModelCapabilities } from './models/index.js';

// Get GPT-5 capabilities
const gpt5 = getModelCapabilities('openAI', 'gpt-5', undefined);
console.log(`Context window: ${gpt5.contextWindow}`);        // 400,000
console.log(`Supports reasoning: ${!!gpt5.reasoningCapabilities}`); // true
```

### Provider Settings Access

```typescript
import { modelSettingsOfProvider } from './models/index.js';

// Get all OpenAI models
const openAIModels = Object.keys(modelSettingsOfProvider.openAI.modelOptions);
// ['gpt-5.2', 'gpt-5', 'gpt-5-mini', ...]

// Check if model exists
const exists = 'gpt-5' in modelSettingsOfProvider.openAI.modelOptions;
```

### Reasoning Configuration

```typescript
import { getSendableReasoningInfo } from './models/index.js';

// Get reasoning config for Claude
const reasoning = getSendableReasoningInfo('anthropic', 'claude-sonnet-4.5');
if (reasoning?.type === 'budget') {
  console.log(`Budget: ${reasoning.reasoningBudget}`); // 8192
}
```

### Fallback Model Matching

```typescript
// Automatic fallback for unrecognized model names
const capabilities = getModelCapabilities('openAI', 'gpt-5-turbo', undefined);
// Falls back to 'gpt-5' if exact match not found
```

## Documentation

- [API Reference](./api-reference.md) - Complete type definitions and functions
- [Provider Guide](./provider-guide.md) - Detailed provider configurations
- [Reasoning Features](./reasoning-guide.md) - Advanced reasoning capabilities
- [Cost Tracking](./cost-tracking.md) - Pricing and usage monitoring
- [Usage Examples](./examples.md) - Practical integration examples
- [Developer Guide](./developer-guide.md) - Extending the system

## Contributing

When adding new models or providers:

1. Add model definitions to the appropriate provider directory
2. Update `defaults.ts` with default model lists
3. Register provider in `index.ts` model registry
4. Add comprehensive type information
5. Update documentation

## License

Copyright 2025 Glass Devtools, Inc. Licensed under the Apache License, Version 2.0.

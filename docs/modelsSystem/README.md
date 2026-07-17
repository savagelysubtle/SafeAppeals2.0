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

| Provider | Models | Reasoning Method | Key Features |
|----------|--------|------------------|--------------|
| **OpenAI** | GPT-5.2, GPT-5, GPT-5.1-codex-max | `reasoning_effort: 'high'` | Effort-based, developer role |
| **Anthropic** | Claude Opus 4.5 | `reasoning_effort: 'high'` | Effort-based, separated system |
| **Anthropic** | Claude Sonnet 4.5 | `thinking.budget_tokens` | Budget-based (8K tokens) |
| **Google** | Gemini 3 Pro Preview | `thinking_level: 'high'` | Effort-based via LiteLLM |
| **Google** | Gemini 2.5 Pro/Flash | `thinking.budget_tokens` | Budget-based (24K tokens) |
| **xAI** | Grok series | `reasoning_effort` | Effort-based |
| **DeepSeek** | Chat/Reasoner | Think tags | Open-source style |
| **Mistral** | Codestral, Devstral | N/A | Code-focused models |
| **Groq** | Llama/Qwen optimized | N/A | High-speed inference |
| **OpenRouter** | 100+ models | Varies | Model routing service |

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
    reasoningReservedOutputTokenSpace?: number; // Extra space for reasoning output
    // Use ONE of the following (not both):
    maxReasoningBudget?: number;   // Budget-based (Anthropic Sonnet, Gemini 2.5)
    maxReasoningEffort?: string;   // Effort-based (OpenAI, Anthropic Opus, Gemini 3+)
  };
  cost: {
    input: number;                 // Cost per 1M input tokens
    output: number;                // Cost per 1M output tokens
    cache_read?: number;           // Cached input cost
    cache_write?: number;          // Cache write cost
  };
}
```

**Note:** For budget-based providers like Anthropic, `max_tokens` (from `reasoningReservedOutputTokenSpace`) must be greater than `thinking.budget_tokens` (from `maxReasoningBudget`).

## Usage Examples

### Basic Model Lookup

```typescript
import { getModelCapabilities } from './models/index.js';

// Get GPT-5.2 capabilities
const gpt52 = getModelCapabilities('openAI', 'gpt-5.2', undefined);
console.log(`Context window: ${gpt52.contextWindow}`);        // 128,000
console.log(`Supports reasoning: ${!!gpt52.reasoningCapabilities}`); // true
console.log(`Reasoning effort: ${gpt52.reasoningCapabilities?.maxReasoningEffort}`); // 'high'
```

### Provider Settings Access

```typescript
import { modelSettingsOfProvider } from './models/index.js';

// Get all OpenAI models
const openAIModels = Object.keys(modelSettingsOfProvider.openAI.modelOptions);
// ['gpt-5.2', 'gpt-5', 'gpt-5.1-codex-max']

// Check if model exists
const exists = 'gpt-5.2' in modelSettingsOfProvider.openAI.modelOptions;
```

### Reasoning Configuration

```typescript
import { getSendableReasoningInfo } from './models/index.js';

// Get reasoning config for Claude Opus 4.5 (effort-based)
const opusReasoning = getSendableReasoningInfo('chat', 'anthropic', 'claude-opus-4-5', undefined, undefined);
if (opusReasoning?.type === 'effort') {
  console.log(`Effort: ${opusReasoning.reasoningEffort}`); // 'high'
}

// Get reasoning config for Claude Sonnet 4.5 (budget-based)
const sonnetReasoning = getSendableReasoningInfo('chat', 'anthropic', 'claude-sonnet-4-5', undefined, undefined);
if (sonnetReasoning?.type === 'budget') {
  console.log(`Budget: ${sonnetReasoning.reasoningBudget}`); // 8192
}
```

### Fallback Model Matching

```typescript
// Automatic fallback for unrecognized model names
const capabilities = getModelCapabilities('openAI', 'gpt-5.2-2025-12-11', undefined);
// Falls back to 'gpt-5.2' if exact match not found
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

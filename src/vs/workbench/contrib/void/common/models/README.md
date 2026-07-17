# AI Models Configuration Module

A TypeScript module providing centralized configuration, capabilities, and utilities for AI model providers used in the Void VSCode extension.

## Overview

This module manages configurations for 15+ AI providers including OpenAI, Anthropic, Google Gemini, xAI, DeepSeek, and local models (Ollama, vLLM, etc.). It provides:

- **Type-safe model definitions** with capabilities and pricing
- **Provider-agnostic interface** for consistent model access
- **Intelligent fallback matching** for model variants
- **Advanced reasoning support** (budget-based, effort-based, open-source)
- **Cost tracking and optimization** utilities

## Current Models (December 2025)

| Provider      | Model                                   | Reasoning                                             | Method       |
| ------------- | --------------------------------------- | ----------------------------------------------------- | ------------ |
| **OpenAI**    | `gpt-5.2`, `gpt-5`, `gpt-5.1-codex-max` | `reasoning_effort: 'high'`                            | Effort-based |
| **Anthropic** | `claude-opus-4-5`                       | `reasoning_effort: 'high'`                            | Effort-based |
| **Anthropic** | `claude-sonnet-4-5`                     | `thinking.budget_tokens: 8192`                        | Budget-based |
| **Gemini**    | `gemini-3-pro-preview`                  | `reasoning_effort: 'high'` → `thinking_level: 'high'` | Effort-based |
| **Gemini**    | `gemini-2.5-pro`, `gemini-2.5-flash`    | `thinking.budget_tokens: 24576`                       | Budget-based |

## Quick Usage

```typescript
import { getModelCapabilities, modelSettingsOfProvider } from "./index.js";

// Get model capabilities
const capabilities = getModelCapabilities("openAI", "gpt-5.2", undefined);
console.log(`Context window: ${capabilities.contextWindow}`);

// Access provider settings
const openAIModels = Object.keys(modelSettingsOfProvider.openAI.modelOptions);
```

## Structure

```
models/
├── index.ts          # Main exports and utility functions
├── types.ts          # Core TypeScript interfaces
├── defaults.ts       # Default provider settings and model lists
├── utils.ts          # Shared utilities and open-source model configs
├── openai/           # OpenAI GPT-5.x models
├── anthropic/        # Claude Opus/Sonnet 4.5 models
├── google/           # Gemini 3.x/2.5 models
├── [provider]/       # Other provider configurations
│   └── index.ts
└── README.md         # This file
```

## Key Components

- **`VoidStaticModelInfo`** - Complete model capability definition
- **`VoidStaticProviderInfo`** - Provider configuration with model registry
- **`getModelCapabilities()`** - Main function for retrieving model info
- **`modelSettingsOfProvider`** - Central registry of all provider configurations

## Reasoning Configuration

All reasoning-capable models are set to **maximum reasoning** by default:

- **Effort-based** (`maxReasoningEffort: 'high'`): OpenAI, Anthropic Opus 4.5, Gemini 3+
- **Budget-based** (`maxReasoningBudget`): Anthropic Sonnet 4.5, Gemini 2.5

See the [Reasoning Guide](../../../../../docs/modelsSystem/reasoning-guide.md) for details.

## Documentation

For comprehensive documentation including:

- Complete API reference
- Provider-specific configurations
- Advanced reasoning capabilities
- Cost optimization strategies
- Usage examples and integration patterns
- Developer guides for extending the system

See: [`docs/modelsSystem/`](../../../../../docs/modelsSystem/)

## Contributing

When adding new providers or models:

1. Create provider directory with `index.ts`
2. Add model configurations following existing patterns
3. Register provider in main `index.ts`
4. Update `defaults.ts` with settings
5. Add comprehensive documentation

See the [Developer Guide](../../../../../docs/modelsSystem/developer-guide.md) for detailed instructions.

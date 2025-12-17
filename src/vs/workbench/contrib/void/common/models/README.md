# AI Models Configuration Module

A TypeScript module providing centralized configuration, capabilities, and utilities for AI model providers used in the Void VSCode extension.

## Overview

This module manages configurations for 15+ AI providers including OpenAI, Anthropic, Google Gemini, xAI, DeepSeek, and local models (Ollama, vLLM, etc.). It provides:

- **Type-safe model definitions** with capabilities and pricing
- **Provider-agnostic interface** for consistent model access
- **Intelligent fallback matching** for model variants
- **Advanced reasoning support** (budget-based, effort-based, open-source)
- **Cost tracking and optimization** utilities

## Quick Usage

```typescript
import { getModelCapabilities, modelSettingsOfProvider } from './index.js';

// Get model capabilities
const capabilities = getModelCapabilities('openAI', 'gpt-5', undefined);
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
├── [provider]/       # Provider-specific configurations
│   └── index.ts
└── README.md         # This file
```

## Key Components

- **`VoidStaticModelInfo`** - Complete model capability definition
- **`VoidStaticProviderInfo`** - Provider configuration with model registry
- **`getModelCapabilities()`** - Main function for retrieving model info
- **`modelSettingsOfProvider`** - Central registry of all provider configurations

## Documentation

For comprehensive documentation including:

- Complete API reference
- Provider-specific configurations
- Advanced reasoning capabilities
- Cost optimization strategies
- Usage examples and integration patterns
- Developer guides for extending the system

See: [`docs/models/`](../../../../../docs/models/)

## Contributing

When adding new providers or models:

1. Create provider directory with `index.ts`
2. Add model configurations following existing patterns
3. Register provider in main `index.ts`
4. Update `defaults.ts` with settings
5. Add comprehensive documentation

See the [Developer Guide](../../../../../docs/models/developer-guide.md) for detailed instructions.

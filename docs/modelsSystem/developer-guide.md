# Developer Guide: Extending the AI Models System

Comprehensive guide for developers extending the AI models configuration system with new providers, models, and capabilities.

## Architecture Overview

### Core Design Principles

1. **Type Safety First**: All model configurations are strongly typed with compile-time validation
2. **Provider Agnostic**: Unified interface across all AI providers
3. **Fallback Mechanisms**: Intelligent model matching when exact matches aren't found
4. **Extensible Design**: Easy addition of new providers and capabilities
5. **Cost Transparency**: Built-in cost tracking and optimization

### System Components

```
models/
├── types.ts           # Core type definitions
├── defaults.ts        # Default configurations
├── index.ts           # Main registry and utilities
├── utils.ts           # Shared utilities and helpers
└── [provider]/        # Provider-specific implementations
    └── index.ts
```

## Adding a New Provider

### Step 1: Create Provider Directory

```bash
mkdir src/vs/workbench/contrib/void/common/models/newprovider
touch src/vs/workbench/contrib/void/common/models/newprovider/index.ts
```

### Step 2: Define Provider Settings

Create the provider configuration following the established pattern:

```typescript
// src/vs/workbench/contrib/void/common/models/newprovider/index.ts

import type { VoidStaticModelInfo, VoidStaticProviderInfo } from '../types.js';

// Define your provider's models
export const newProviderModelOptions = {
  'model-name': {
    contextWindow: 8192,
    reservedOutputTokenSpace: 4096,
    cost: { input: 0.001, output: 0.002 },
    downloadable: false,
    supportsSystemMessage: 'system-role',
    supportsFIM: false,
    specialToolFormat: 'openai-style',
    reasoningCapabilities: false,
  } as const satisfies { [key: string]: VoidStaticModelInfo }
};

// Optional: Display name mapping for UI
export const newProviderDisplayNames: { [displayName: string]: keyof typeof newProviderModelOptions } = {
  'Model Display Name': 'model-name',
};

// Provider settings with fallback logic
export const newProviderSettings: VoidStaticProviderInfo = {
  modelOptions: newProviderModelOptions,
  modelOptionsFallback: (modelName) => {
    // Implement intelligent fallback matching
    const lower = modelName.toLowerCase();

    // Example fallback patterns
    if (lower.includes('model-name')) {
      return {
        modelName: 'model-name',
        recognizedModelName: 'model-name',
        ...newProviderModelOptions['model-name']
      };
    }

    return null; // No fallback available
  },

  // Optional: Provider-specific reasoning settings
  providerReasoningIOSettings: {
    // Implementation depends on provider's reasoning API
  },
};
```

### Step 3: Register Provider in Main Registry

Add the new provider to the main index.ts file:

```typescript
// src/vs/workbench/contrib/void/common/models/index.ts

// Import your new provider
import { newProviderSettings } from './newprovider/index.js';

// Add to exports
export { newProviderModelOptions, newProviderSettings } from './newprovider/index.js';

// Add to model settings registry
export const modelSettingsOfProvider: { [providerName in ProviderName]: VoidStaticProviderInfo } = {
  // ... existing providers
  newProvider: newProviderSettings,
};
```

### Step 4: Add Default Configuration

Update defaults.ts with provider settings and recommended models:

```typescript
// src/vs/workbench/contrib/void/common/models/defaults.ts

export const defaultProviderSettings = {
  // ... existing providers
  newProvider: {
    apiKey: '',
    // Add provider-specific settings
  },
} as const;

export const defaultModelsOfProvider = {
  // ... existing providers
  newProvider: [
    'model-name',
    // Add other recommended models
  ],
} as const satisfies Record<ProviderName, string[]>;
```

### Step 5: Update Void Settings Types

Add the new provider to the provider name union type:

```typescript
// src/vs/workbench/contrib/void/common/voidSettingsTypes.ts

export type ProviderName =
  | 'openAI'
  | 'anthropic'
  // ... existing providers
  | 'newProvider';
```

## Adding Models to Existing Providers

### For Major Providers (OpenAI, Anthropic, etc.)

1. **Update the provider's index.ts**:
```typescript
export const openAIModelOptions = {
  // ... existing models
  'new-model': {
    contextWindow: 128000,
    reservedOutputTokenSpace: 4096,
    cost: { input: 0.003, output: 0.006 },
    downloadable: false,
    supportsSystemMessage: 'developer-role',
    supportsFIM: false,
    specialToolFormat: 'openai-style',
    reasoningCapabilities: {
      supportsReasoning: true,
      canIOReasoning: true,
      maxReasoningEffort: 'high',
    },
  },
} as const satisfies { [key: string]: VoidStaticModelInfo };
```

2. **Update display names**:
```typescript
export const openAIDisplayNames: { [displayName: string]: keyof typeof openAIModelOptions } = {
  // ... existing mappings
  'New Model Display Name': 'new-model',
};
```

3. **Update fallback logic** if needed.

### For Open-Source/Local Models

Add to utils.ts in the `openSourceModelOptions_assumingOAICompat` object:

```typescript
export const openSourceModelOptions_assumingOAICompat = {
  // ... existing models
  'new-open-source-model': {
    supportsFIM: false,
    supportsSystemMessage: false,
    reasoningCapabilities: false,
    contextWindow: 4096,
    reservedOutputTokenSpace: 1024,
  },
} as const;
```

## Implementing Advanced Features

### Adding Reasoning Support

#### Budget-Based Reasoning (Anthropic, Gemini style)

```typescript
reasoningCapabilities: {
  supportsReasoning: true,
  canIOReasoning: true,
  reasoningReservedOutputTokenSpace: 16384,
  maxReasoningBudget: 16384,  // Max tokens for thinking
}
```

#### Effort-Based Reasoning (OpenAI, xAI style)

```typescript
reasoningCapabilities: {
  supportsReasoning: true,
  canIOReasoning: true,
  maxReasoningEffort: 'high',  // 'low', 'medium', 'high'
}
```

#### Open-Source Reasoning (Manual parsing)

```typescript
reasoningCapabilities: {
  supportsReasoning: true,
  canIOReasoning: true,
  openSourceThinkTags: ['<think>', '</think>'],
}
```

### Custom Provider Reasoning I/O

```typescript
providerReasoningIOSettings: {
  input: {
    includeInPayload: (reasoningInfo: SendableReasoningInfo) => {
      if (!reasoningInfo?.isReasoningEnabled) return null;

      // Provider-specific payload inclusion
      if (reasoningInfo.type === 'budget') {
        return { custom_reasoning_param: reasoningInfo.reasoningBudget };
      }

      return null;
    }
  },
  output: {
    // Specify how reasoning appears in responses
    nameOfFieldInDelta: 'reasoning_content',
    needsManualParse: false,
  }
}
```

### Adding Tool Calling Support

#### Native Tool Calling

```typescript
useNativeToolCalling: true,  // Enable native tool calling
forceXML: false,             // Don't force XML fallback
```

#### XML-Based Tool Calling

```typescript
useNativeToolCalling: false,  // Use XML instead
forceXML: true,               // Explicitly force XML
```

### Fill-in-the-Middle (FIM) Support

```typescript
supportsFIM: true,  // Enable FIM for autocomplete
```

### Custom System Message Formats

```typescript
// Standard system role
supportsSystemMessage: 'system-role',

// Developer role (OpenAI)
supportsSystemMessage: 'developer-role',

// Separated system field (Anthropic)
supportsSystemMessage: 'separated',

// No system message support
supportsSystemMessage: false,
```

## Testing Your Changes

### Unit Tests

Create tests for your new provider:

```typescript
// tests/models/newProvider.test.ts
import { getModelCapabilities, newProviderSettings } from '../../src/models/index.js';

describe('NewProvider Models', () => {
  test('should return correct capabilities', () => {
    const capabilities = getModelCapabilities('newProvider', 'model-name', undefined);

    expect(capabilities.contextWindow).toBe(8192);
    expect(capabilities.supportsSystemMessage).toBe('system-role');
  });

  test('should handle fallback matching', () => {
    const result = newProviderSettings.modelOptionsFallback('unknown-model');
    expect(result).toBeNull();
  });
});
```

### Integration Tests

Test with actual API calls (use mock responses for CI):

```typescript
describe('NewProvider Integration', () => {
  test('should make successful API call', async () => {
    const response = await callNewProviderAPI({
      model: 'model-name',
      messages: [{ role: 'user', content: 'Hello' }],
    });

    expect(response).toHaveProperty('choices');
    expect(response.choices[0]).toHaveProperty('message');
  });
});
```

### Manual Testing Checklist

- [ ] Model appears in provider selection UI
- [ ] API calls succeed with valid credentials
- [ ] Fallback matching works for model variants
- [ ] Reasoning features work (if implemented)
- [ ] Cost tracking reports correct values
- [ ] Error handling provides helpful messages

## Best Practices

### Code Quality

1. **Type Safety**: Use `as const satisfies` for model definitions
2. **Consistent Naming**: Follow existing naming patterns
3. **Documentation**: Add JSDoc comments for complex logic
4. **Error Handling**: Provide graceful fallbacks

### Performance

1. **Lazy Loading**: Don't import all providers at startup
2. **Caching**: Cache model capabilities lookups
3. **Efficient Fallbacks**: Optimize fallback matching logic

### Maintenance

1. **Version Syncing**: Keep pricing and specs updated
2. **Deprecation Handling**: Support old model names during transitions
3. **Feature Flags**: Use feature flags for experimental capabilities

## Common Patterns and Utilities

### Model Definition Helpers

```typescript
// Helper for creating model definitions
function createModelDefinition(overrides: Partial<VoidStaticModelInfo>): VoidStaticModelInfo {
  return {
    contextWindow: 4096,
    reservedOutputTokenSpace: 4096,
    cost: { input: 0, output: 0 },
    downloadable: false,
    supportsSystemMessage: false,
    supportsFIM: false,
    reasoningCapabilities: false,
    ...overrides,
  } as VoidStaticModelInfo;
}

// Usage
const myModel = createModelDefinition({
  contextWindow: 8192,
  cost: { input: 0.001, output: 0.002 },
  supportsSystemMessage: 'system-role',
});
```

### Fallback Pattern Helpers

```typescript
// Helper for common fallback patterns
function createFallbackMatcher(
  knownModels: Record<string, VoidStaticModelInfo>,
  patterns: Array<{ regex: RegExp; model: string }>
) {
  return (modelName: string) => {
    const lower = modelName.toLowerCase();

    // Check exact matches first
    if (knownModels[lower]) {
      return {
        modelName: lower,
        recognizedModelName: lower,
        ...knownModels[lower]
      };
    }

    // Check patterns
    for (const { regex, model } of patterns) {
      if (regex.test(lower)) {
        return {
          modelName: model,
          recognizedModelName: model,
          ...knownModels[model]
        };
      }
    }

    return null;
  };
}
```

### Cost Calculation Utilities

```typescript
// Helper for cost calculations
function calculateModelCost(
  model: VoidStaticModelInfo,
  tokens: { input: number; output: number; cached?: number }
): number {
  const inputCost = (tokens.input / 1000) * model.cost.input;
  const outputCost = (tokens.output / 1000) * model.cost.output;
  const cacheCost = tokens.cached
    ? (tokens.cached / 1000) * (model.cost.cache_read || 0)
    : 0;

  return inputCost + outputCost + cacheCost;
}
```

## Troubleshooting

### Common Issues

**Type Errors:**
- Check that model definitions match `VoidStaticModelInfo` interface
- Ensure provider names are added to `ProviderName` union type
- Verify import/export statements are correct

**Runtime Errors:**
- Check API endpoints and authentication
- Verify model availability in provider
- Test fallback logic with various model names

**Performance Issues:**
- Avoid expensive operations in fallback matching
- Cache model capability lookups
- Use lazy loading for provider imports

### Debugging Tips

1. **Enable logging** in model capability functions
2. **Test fallbacks** with various model name variations
3. **Verify costs** match provider documentation
4. **Check reasoning** configuration with actual API calls

## Contributing Guidelines

### Pull Request Checklist

- [ ] All TypeScript types compile without errors
- [ ] Unit tests pass for new functionality
- [ ] Integration tests added for API interactions
- [ ] Documentation updated with new providers/models
- [ ] Cost information verified and current
- [ ] Fallback logic tested with various model names

### Code Review Focus

1. **Type Safety**: All code properly typed
2. **Performance**: No expensive operations in hot paths
3. **Maintainability**: Clear code structure and documentation
4. **Testing**: Adequate test coverage for new features
5. **Consistency**: Follows existing patterns and conventions

This guide provides the foundation for extending the AI models system while maintaining code quality, type safety, and performance standards.

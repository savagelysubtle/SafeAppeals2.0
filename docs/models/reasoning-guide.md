# Advanced Reasoning Capabilities Guide

Comprehensive documentation for AI model reasoning features, including budget-based and effort-based reasoning, provider-specific implementations, and integration patterns.

## Overview

Reasoning capabilities allow AI models to show their step-by-step thinking process, leading to more accurate and explainable outputs. This module supports multiple reasoning paradigms across different providers.

## Reasoning Types

### Budget-Based Reasoning

Used by Anthropic Claude, Google Gemini, and OpenRouter models. Controls reasoning by allocating a specific token budget for thinking.

**Characteristics:**
- Fixed token allocation for reasoning
- Provider manages reasoning internally
- Output includes reasoning trace
- Predictable token usage

**Supported Providers:**
- Anthropic Claude (Opus, Sonnet variants)
- Google Gemini (Pro, Flash variants)
- OpenRouter (when routing to supported models)

### Effort-Based Reasoning

Used by OpenAI GPT and xAI Grok models. Controls reasoning quality through effort levels rather than token budgets.

**Characteristics:**
- Variable token usage based on complexity
- Effort levels: 'low', 'medium', 'high'
- Provider optimizes internally
- Less predictable costs

**Supported Providers:**
- OpenAI (GPT-5 series)
- xAI (Grok series)

### Open-Source Reasoning

Used by local models served through Ollama, vLLM, etc. Often outputs reasoning in structured formats with think tags.

**Characteristics:**
- Manual parsing required
- Think tags: `<think>...</think>`
- Variable output formats
- Model-dependent reliability

**Supported Models:**
- DeepSeek Reasoner
- Some Llama variants
- Custom fine-tuned models

## Core Configuration

### ReasoningCapabilities Interface

```typescript
interface ReasoningCapabilities {
  readonly supportsReasoning: true;        // Required for reasoning support
  readonly canIOReasoning: boolean;         // Whether reasoning is output to user
  readonly reasoningReservedOutputTokenSpace?: number; // Extra space for reasoning

  // Provider-specific settings (one of):
  readonly maxReasoningBudget?: number;    // Budget-based providers
  readonly maxReasoningEffort?: string;    // Effort-based providers
  readonly openSourceThinkTags?: [string, string]; // Open-source parsing
}
```

### SendableReasoningInfo

Runtime configuration sent to providers:

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

## Provider-Specific Implementation

### Anthropic Claude

**Configuration:**
```typescript
reasoningCapabilities: {
  supportsReasoning: true,
  canIOReasoning: true,
  reasoningReservedOutputTokenSpace: 16384,
  maxReasoningBudget: 16384,  // Up to 16K tokens for thinking
}
```

**API Integration:**
```typescript
// Payload includes reasoning budget
{
  "messages": [...],
  "max_tokens": 4096,
  "thinking": {
    "type": "enabled",
    "budget_tokens": 16384
  }
}
```

**Response Handling:**
```typescript
// Response includes thinking block
{
  "content": [
    {
      "type": "thinking",
      "thinking": "Let me analyze this step by step..."
    },
    {
      "type": "text",
      "text": "Based on my analysis..."
    }
  ]
}
```

### OpenAI GPT

**Configuration:**
```typescript
reasoningCapabilities: {
  supportsReasoning: true,
  canIOReasoning: true,
  maxReasoningEffort: 'high',  // 'low', 'medium', 'high'
}
```

**API Integration:**
```typescript
// Include reasoning_effort in payload
{
  "messages": [...],
  "model": "gpt-5",
  "reasoning_effort": "high"
}
```

**Response Handling:**
- Reasoning is included in standard completions
- No special parsing required
- Reasoning tokens counted in usage

### Google Gemini

**Configuration:**
```typescript
reasoningCapabilities: {
  supportsReasoning: true,
  canIOReasoning: true,
  maxReasoningBudget: 32768,  // Up to 32K budget
}
```

**API Integration:**
```typescript
{
  "contents": [...],
  "generationConfig": {
    "thinkingBudget": 32768
  }
}
```

### Open-Source Models (Ollama/vLLM)

**Configuration:**
```typescript
reasoningCapabilities: {
  supportsReasoning: true,
  canIOReasoning: true,
  openSourceThinkTags: ['<think>', '</think>'],
}
```

**Response Handling:**
```typescript
// Manual parsing required
const response = "<think>Analyzing the problem...</think>Here's my solution...";
const thinking = response.match(/<think>(.*?)<\/think>/s)?.[1];
const answer = response.replace(/<think>.*?<\/think>/s, '').trim();
```

## Integration Patterns

### Getting Reasoning Info

```typescript
import { getSendableReasoningInfo } from './models/index.js';

function prepareAPIRequest(provider: string, model: string, reasoningEnabled: boolean) {
  const reasoningInfo = getSendableReasoningInfo(
    'chat', provider, model, undefined, overrides
  );

  if (reasoningInfo) {
    // Add reasoning to payload based on type
    if (reasoningInfo.type === 'budget') {
      payload.thinking = { budget_tokens: reasoningInfo.reasoningBudget };
    } else if (reasoningInfo.type === 'effort') {
      payload.reasoning_effort = reasoningInfo.reasoningEffort;
    }
  }

  return payload;
}
```

### Calculating Token Space

```typescript
import { getReservedOutputTokenSpace } from './models/index.js';

function calculateMaxTokens(provider: string, model: string, reasoningEnabled: boolean) {
  const reserved = getReservedOutputTokenSpace(provider, model, {
    isReasoningEnabled: reasoningEnabled,
    overridesOfModel: undefined
  });

  // Total context window minus reserved space
  const contextWindow = getModelCapabilities(provider, model).contextWindow;
  return contextWindow - reserved;
}
```

### Response Processing

```typescript
function processReasoningResponse(response: any, provider: string, model: string) {
  const capabilities = getModelCapabilities(provider, model);

  if (capabilities.reasoningCapabilities?.openSourceThinkTags) {
    // Manual parsing for open-source models
    const [startTag, endTag] = capabilities.reasoningCapabilities.openSourceThinkTags;
    const regex = new RegExp(`${startTag}(.*?)${endTag}`, 's');

    const thinking = response.match(regex)?.[1];
    const answer = response.replace(regex, '').trim();

    return { thinking, answer };
  }

  // Provider handles parsing (Claude, OpenAI, etc.)
  return { thinking: response.thinking, answer: response.content };
}
```

## Best Practices

### Token Management

1. **Reserve adequate space:** Reasoning can use significant tokens
2. **Monitor usage:** Track reasoning token consumption
3. **Adjust budgets:** Start with maximum budgets, optimize down
4. **Context awareness:** Leave room for reasoning in context windows

### Performance Considerations

1. **Budget allocation:** Higher budgets improve reasoning quality
2. **Effort levels:** 'high' provides best reasoning but slower responses
3. **Caching:** Use provider caching to reduce costs
4. **Batch processing:** Group related reasoning tasks

### User Experience

1. **Progressive disclosure:** Show reasoning incrementally
2. **Toggle controls:** Allow users to enable/disable reasoning
3. **Cost transparency:** Display reasoning token usage
4. **Quality indicators:** Show reasoning effort/budget levels

## Troubleshooting

### Common Issues

**Reasoning not appearing:**
- Check `canIOReasoning` capability
- Verify reasoning is enabled in request
- Confirm model supports reasoning

**Token limit exceeded:**
- Reduce reasoning budget/effort
- Increase context window
- Check `reasoningReservedOutputTokenSpace`

**Parsing errors:**
- Verify think tag formats for open-source models
- Check provider-specific response structures
- Handle malformed responses gracefully

**Cost issues:**
- Monitor reasoning token usage
- Use appropriate budget/effort levels
- Implement user controls for reasoning intensity

### Provider-Specific Issues

**Anthropic:**
- Ensure `thinking` object in payload
- Check `max_tokens` doesn't conflict with budget
- Verify model supports thinking

**OpenAI:**
- Use supported models (GPT-5 series)
- Check `reasoning_effort` parameter
- Monitor rate limits (reasoning models have stricter limits)

**Gemini:**
- Use `thinkingBudget` in generation config
- Check model compatibility
- Verify API version supports reasoning

**Open-source:**
- Test think tag parsing with your models
- Handle models without reasoning gracefully
- Consider fine-tuning for better reasoning

## Advanced Features

### Custom Reasoning Overrides

```typescript
const overrides: OverridesOfModel = {
  anthropic: {
    'claude-sonnet-4.5': {
      reasoningCapabilities: {
        supportsReasoning: true,
        canIOReasoning: true,
        maxReasoningBudget: 8192,  // Custom budget
      }
    }
  }
};
```

### Reasoning State Management

```typescript
interface ReasoningState {
  enabled: boolean;
  budget?: number;
  effort?: string;
  provider: string;
  model: string;
}

// Persist user preferences
const userReasoningPrefs: Record<string, ReasoningState> = {
  'anthropic/claude-sonnet-4.5': {
    enabled: true,
    budget: 16384,
    provider: 'anthropic',
    model: 'claude-sonnet-4.5'
  }
};
```

### Analytics and Monitoring

```typescript
interface ReasoningMetrics {
  totalTokens: number;
  reasoningTokens: number;
  responseTime: number;
  successRate: number;
  cost: number;
}

// Track reasoning performance
function trackReasoningUsage(metrics: ReasoningMetrics) {
  // Store for analytics
  // Monitor costs
  // Optimize budgets
}
```

## Future Considerations

### Phase 3: Unified Tool Calling + Reasoning

The system is designed to integrate reasoning with advanced tool calling:

- **Reasoning-aware tool use:** Models can reason about when to use tools
- **Multi-step reasoning:** Complex chains with tool interactions
- **Reasoning validation:** Verify reasoning quality through tool results

### Provider Expansion

As new providers add reasoning:

1. Add reasoning capabilities to model definitions
2. Implement provider-specific I/O handling
3. Update fallback and override logic
4. Add comprehensive testing

### Performance Optimization

Future optimizations may include:

- Reasoning result caching
- Progressive reasoning (stream reasoning steps)
- Reasoning quality scoring
- Adaptive budget allocation

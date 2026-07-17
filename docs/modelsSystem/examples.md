# Usage Examples and Integration Guide

Practical examples demonstrating how to use the AI Models Configuration Module in real applications.

## Basic Usage

### Getting Model Capabilities

```typescript
import { getModelCapabilities } from './models/index.js';

// Get capabilities for a specific model
const gpt5Capabilities = getModelCapabilities('openAI', 'gpt-5', undefined);

console.log('Context Window:', gpt5Capabilities.contextWindow);        // 400000
console.log('Supports Reasoning:', !!gpt5Capabilities.reasoningCapabilities); // true
console.log('Cost per 1K input tokens:', gpt5Capabilities.cost.input);     // 1.25
```

### Checking Model Availability

```typescript
import { modelSettingsOfProvider } from './models/index.js';

// Check if a model exists for a provider
const hasGPT5 = 'gpt-5' in modelSettingsOfProvider.openAI.modelOptions;
const hasClaude = 'claude-sonnet-4.5' in modelSettingsOfProvider.anthropic.modelOptions;

console.log('GPT-5 available:', hasGPT5);      // true
console.log('Claude available:', hasClaude);   // true
```

### Working with Fallbacks

```typescript
// Automatic fallback for model variants
const capabilities1 = getModelCapabilities('openAI', 'gpt-5-turbo', undefined);
// Falls back to 'gpt-5' if exact match not found

const capabilities2 = getModelCapabilities('anthropic', 'claude-3.5-sonnet', undefined);
// Falls back to 'claude-sonnet-4' based on pattern matching
```

## Provider-Specific Examples

### OpenAI Integration

```typescript
import { getModelCapabilities, getSendableReasoningInfo } from './models/index.js';

async function callOpenAI(modelName: string, messages: any[], reasoningEnabled: boolean) {
  const capabilities = getModelCapabilities('openAI', modelName, undefined);
  const reasoningInfo = getSendableReasoningInfo('chat', 'openAI', modelName, undefined, undefined);

  // Prepare payload
  const payload = {
    model: modelName,
    messages: messages,
    max_tokens: capabilities.contextWindow - capabilities.reservedOutputTokenSpace,
  };

  // Add reasoning if supported
  if (reasoningInfo && reasoningEnabled) {
    payload.reasoning_effort = reasoningInfo.reasoningEffort;
  }

  // Make API call
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}

// Usage
const response = await callOpenAI('gpt-5', [
  { role: 'user', content: 'Explain quantum computing' }
], true);
```

### Anthropic Integration

```typescript
import { getModelCapabilities, getSendableReasoningInfo } from './models/index.js';

async function callAnthropic(modelName: string, messages: any[], reasoningEnabled: boolean) {
  const capabilities = getModelCapabilities('anthropic', modelName, undefined);
  const reasoningInfo = getSendableReasoningInfo('chat', 'anthropic', modelName, undefined, undefined);

  // Convert messages to Anthropic format
  const anthropicMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'assistant' : 'user',
    content: msg.content,
  }));

  // Prepare payload
  const payload = {
    model: modelName,
    messages: anthropicMessages,
    max_tokens: capabilities.reservedOutputTokenSpace,
  };

  // Handle system messages (separated format)
  const systemMessage = messages.find(msg => msg.role === 'system');
  if (systemMessage) {
    payload.system = systemMessage.content;
  }

  // Add reasoning budget if supported
  if (reasoningInfo && reasoningEnabled && reasoningInfo.type === 'budget') {
    payload.thinking = {
      type: 'enabled',
      budget_tokens: reasoningInfo.reasoningBudget,
    };
  }

  // Make API call
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response.json();
}

// Usage
const response = await callAnthropic('claude-sonnet-4.5', [
  { role: 'system', content: 'You are a helpful assistant.' },
  { role: 'user', content: 'Explain machine learning' }
], true);
```

### Google Gemini Integration

```typescript
import { getModelCapabilities, getSendableReasoningInfo } from './models/index.js';

async function callGemini(modelName: string, messages: any[], reasoningEnabled: boolean) {
  const capabilities = getModelCapabilities('gemini', modelName, undefined);
  const reasoningInfo = getSendableReasoningInfo('chat', 'gemini', modelName, undefined, undefined);

  // Convert to Gemini format
  const geminiMessages = messages.map(msg => ({
    role: msg.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: msg.content }],
  }));

  const payload = {
    contents: geminiMessages,
    generationConfig: {
      maxOutputTokens: capabilities.reservedOutputTokenSpace,
    },
  };

  // Add reasoning budget
  if (reasoningInfo && reasoningEnabled && reasoningInfo.type === 'budget') {
    payload.generationConfig.thinkingBudget = reasoningInfo.reasoningBudget;
  }

  // Make API call
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );

  return response.json();
}
```

## Cost Tracking Examples

### Basic Cost Calculation

```typescript
import { getModelCapabilities } from './models/index.js';

function calculateCost(provider: string, model: string, tokens: { input: number; output: number }) {
  const capabilities = getModelCapabilities(provider, model, undefined);

  const inputCost = (tokens.input / 1000) * capabilities.cost.input;
  const outputCost = (tokens.output / 1000) * capabilities.cost.output;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    costPerToken: (inputCost + outputCost) / (tokens.input + tokens.output),
  };
}

// Usage
const cost = calculateCost('openAI', 'gpt-5', { input: 150, output: 300 });
console.log(`Total cost: $${cost.totalCost.toFixed(4)}`);
```

### Cost-Aware Model Selection

```typescript
import { getModelCapabilities, modelSettingsOfProvider } from './models/index.js';

function selectCostEffectiveModel(taskComplexity: 'simple' | 'medium' | 'complex', maxCost: number) {
  const providers = ['openAI', 'anthropic', 'deepseek'] as const;
  const models = {
    simple: { openAI: 'gpt-5-nano', anthropic: 'claude-haiku-4.5', deepseek: 'deepseek-chat' },
    medium: { openAI: 'gpt-5-mini', anthropic: 'claude-sonnet-4', deepseek: 'deepseek-chat' },
    complex: { openAI: 'gpt-5', anthropic: 'claude-sonnet-4.5', deepseek: 'deepseek-reasoner' },
  };

  const candidates = providers.map(provider => {
    const modelName = models[taskComplexity][provider];
    const capabilities = getModelCapabilities(provider, modelName, undefined);

    // Estimate cost for typical task
    const estimatedTokens = { input: 1000, output: 500 };
    const cost = (estimatedTokens.input / 1000) * capabilities.cost.input +
                 (estimatedTokens.output / 1000) * capabilities.cost.output;

    return { provider, model: modelName, cost, capabilities };
  });

  // Filter by cost and sort by quality
  return candidates
    .filter(candidate => candidate.cost <= maxCost)
    .sort((a, b) => {
      // Prefer higher context window as quality proxy
      if (Math.abs(a.capabilities.contextWindow - b.capabilities.contextWindow) > 10000) {
        return b.capabilities.contextWindow - a.capabilities.contextWindow;
      }
      // Then by cost (lower is better)
      return a.cost - b.cost;
    })[0];
}

// Usage
const bestModel = selectCostEffectiveModel('medium', 0.05);
console.log(`Selected: ${bestModel.provider}/${bestModel.model} at $${bestModel.cost.toFixed(4)}`);
```

### Usage Monitoring

```typescript
class UsageTracker {
  private usage: Map<string, { tokens: number; cost: number; calls: number }> = new Map();

  trackUsage(provider: string, model: string, tokens: { input: number; output: number }) {
    const key = `${provider}/${model}`;
    const capabilities = getModelCapabilities(provider, model, undefined);

    const cost = (tokens.input / 1000) * capabilities.cost.input +
                 (tokens.output / 1000) * capabilities.cost.output;

    const current = this.usage.get(key) || { tokens: 0, cost: 0, calls: 0 };
    this.usage.set(key, {
      tokens: current.tokens + tokens.input + tokens.output,
      cost: current.cost + cost,
      calls: current.calls + 1,
    });
  }

  getUsageReport() {
    return Array.from(this.usage.entries()).map(([model, stats]) => ({
      model,
      ...stats,
      averageCostPerCall: stats.cost / stats.calls,
      costPerToken: stats.cost / stats.tokens,
    }));
  }

  getTotalCost() {
    return Array.from(this.usage.values()).reduce((total, stats) => total + stats.cost, 0);
  }
}

// Usage
const tracker = new UsageTracker();

// After each API call
tracker.trackUsage('openAI', 'gpt-5', { input: 150, output: 300 });

console.log('Total cost:', tracker.getTotalCost());
console.log('Usage report:', tracker.getUsageReport());
```

## Reasoning Examples

### Basic Reasoning Setup

```typescript
import { getSendableReasoningInfo, getIsReasoningEnabledState } from './models/index.js';

function prepareReasoningRequest(provider: string, model: string, userWantsReasoning: boolean) {
  const reasoningEnabled = getIsReasoningEnabledState(
    'chat', provider, model, undefined, undefined
  ) && userWantsReasoning;

  const reasoningInfo = getSendableReasoningInfo(
    'chat', provider, model, undefined, undefined
  );

  return { reasoningEnabled, reasoningInfo };
}

// Usage
const { reasoningEnabled, reasoningInfo } = prepareReasoningRequest('anthropic', 'claude-sonnet-4.5', true);

if (reasoningInfo?.type === 'budget') {
  console.log(`Using reasoning budget: ${reasoningInfo.reasoningBudget} tokens`);
}
```

### Reasoning Response Processing

```typescript
function processReasoningResponse(response: any, provider: string, model: string) {
  const capabilities = getModelCapabilities(provider, model, undefined);

  // Handle different response formats
  if (capabilities.reasoningCapabilities?.openSourceThinkTags) {
    // Manual parsing for open-source models
    const [startTag, endTag] = capabilities.reasoningCapabilities.openSourceThinkTags;
    const fullText = response.choices[0].message.content;

    const thinkMatch = fullText.match(new RegExp(`${startTag}(.*?)${endTag}`, 's'));
    const thinking = thinkMatch ? thinkMatch[1].trim() : null;
    const answer = fullText.replace(new RegExp(`${startTag}.*?${endTag}`, 's'), '').trim();

    return { thinking, answer };
  }

  // Provider handles parsing (Anthropic, OpenAI, etc.)
  if (provider === 'anthropic') {
    const content = response.content;
    const thinkingBlock = content.find((block: any) => block.type === 'thinking');
    const textBlock = content.find((block: any) => block.type === 'text');

    return {
      thinking: thinkingBlock?.thinking || null,
      answer: textBlock?.text || '',
    };
  }

  // Standard format
  return {
    thinking: response.choices[0].message.reasoning || null,
    answer: response.choices[0].message.content,
  };
}
```

## Advanced Integration Patterns

### Model Router with Fallbacks

```typescript
class ModelRouter {
  constructor(
    private primaryProvider: string,
    private primaryModel: string,
    private fallbackProviders: Array<{ provider: string; model: string }>
  ) {}

  async callWithFallback(messages: any[], options: any = {}) {
    // Try primary model first
    try {
      return await this.callModel(this.primaryProvider, this.primaryModel, messages, options);
    } catch (error) {
      console.warn(`Primary model failed: ${error.message}`);

      // Try fallbacks
      for (const fallback of this.fallbackProviders) {
        try {
          console.log(`Trying fallback: ${fallback.provider}/${fallback.model}`);
          return await this.callModel(fallback.provider, fallback.model, messages, options);
        } catch (fallbackError) {
          console.warn(`Fallback failed: ${fallbackError.message}`);
          continue;
        }
      }

      throw new Error('All models failed');
    }
  }

  private async callModel(provider: string, model: string, messages: any[], options: any) {
    // Implementation depends on provider
    switch (provider) {
      case 'openAI':
        return this.callOpenAI(model, messages, options);
      case 'anthropic':
        return this.callAnthropic(model, messages, options);
      default:
        throw new Error(`Unsupported provider: ${provider}`);
    }
  }
}

// Usage
const router = new ModelRouter(
  'openAI', 'gpt-5',
  [
    { provider: 'anthropic', model: 'claude-sonnet-4.5' },
    { provider: 'deepseek', model: 'deepseek-chat' }
  ]
);

const response = await router.callWithFallback([
  { role: 'user', content: 'Explain recursion' }
]);
```

### Context-Aware Model Selection

```typescript
class ContextAwareSelector {
  selectModel(context: {
    taskType: 'code' | 'writing' | 'analysis' | 'chat';
    complexity: 'simple' | 'medium' | 'complex';
    maxCost: number;
    needsReasoning: boolean;
    contextLength: number;
  }) {
    const candidates = this.getCandidatesForTask(context.taskType);

    return candidates
      .filter(model => {
        const capabilities = getModelCapabilities(model.provider, model.name, undefined);

        // Check cost
        if (this.estimateCost(capabilities, context) > context.maxCost) return false;

        // Check context length
        if (context.contextLength > capabilities.contextWindow * 0.8) return false;

        // Check reasoning
        if (context.needsReasoning && !capabilities.reasoningCapabilities) return false;

        return true;
      })
      .sort((a, b) => {
        // Score by multiple factors
        const scoreA = this.scoreModel(a, context);
        const scoreB = this.scoreModel(b, context);
        return scoreB - scoreA;
      })[0];
  }

  private getCandidatesForTask(taskType: string) {
    const taskModels = {
      code: [
        { provider: 'openAI', name: 'gpt-5' },
        { provider: 'anthropic', name: 'claude-sonnet-4.5' },
        { provider: 'mistral', name: 'codestral-latest' },
      ],
      writing: [
        { provider: 'anthropic', name: 'claude-sonnet-4.5' },
        { provider: 'openAI', name: 'gpt-5' },
        { provider: 'gemini', name: 'gemini-2.5-pro' },
      ],
      analysis: [
        { provider: 'openAI', name: 'gpt-5' },
        { provider: 'deepseek', name: 'deepseek-reasoner' },
        { provider: 'anthropic', name: 'claude-opus-4.5' },
      ],
      chat: [
        { provider: 'openAI', name: 'gpt-5-mini' },
        { provider: 'anthropic', name: 'claude-haiku-4.5' },
        { provider: 'deepseek', name: 'deepseek-chat' },
      ],
    };

    return taskModels[taskType] || taskModels.chat;
  }
}
```

### Batch Processing Example

```typescript
async function processBatch(requests: Array<{ messages: any[]; options: any }>, provider: string, model: string) {
  const capabilities = getModelCapabilities(provider, model, undefined);

  // Check if provider supports batching
  if (!this.supportsBatching(provider)) {
    // Fallback to individual calls
    return Promise.all(requests.map(req => this.callModel(provider, model, req.messages, req.options)));
  }

  // Prepare batch payload
  const batchPayload = requests.map((req, index) => ({
    custom_id: `request-${index}`,
    method: 'POST',
    url: '/v1/chat/completions',
    body: {
      model,
      messages: req.messages,
      max_tokens: capabilities.reservedOutputTokenSpace,
      ...req.options,
    },
  }));

  // Submit batch
  const batchResponse = await fetch('https://api.openai.com/v1/batches', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input_file_id: await this.uploadBatchFile(batchPayload),
      endpoint: '/v1/chat/completions',
      completion_window: '24h',
    }),
  });

  // Poll for completion and retrieve results
  return this.pollBatchResults(batchResponse.id);
}
```

These examples demonstrate the flexibility and power of the AI Models Configuration Module for building robust, cost-effective AI applications.

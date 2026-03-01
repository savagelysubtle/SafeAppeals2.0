# Provider Configuration Guide

Detailed documentation for each AI provider's configuration, model options, and special considerations.

## Provider Categories

### Major Cloud Providers

#### OpenAI (`openAI`)

**Configuration:**
```typescript
openAI: {
  apiKey: string;  // Required: sk-... API key
}
```

**Key Models (December 2025):**
- `gpt-5.2`: Flagship model (128K context, $1.75/$14.00) - `reasoning_effort: 'high'`
- `gpt-5`: Previous flagship (128K context, $1.25/$10.00) - `reasoning_effort: 'high'`
- `gpt-5.1-codex-max`: Best coding model (192K context, $1.25/$10.00) - `reasoning_effort: 'high'`, FIM support

**Features:**
- Developer role system messages
- OpenAI-style tool calling
- **Effort-based reasoning** (`reasoning_effort: 'high'` for maximum depth)
- Advanced caching support

**LiteLLM API Model Names:**
- `gpt-5.2` → `openai/gpt-5.2-2025-12-11`
- `gpt-5` → `openai/gpt-5-2025-08-07`
- `gpt-5.1-codex-max` → `openai/gpt-5.1-codex-max`

**Fallback Matching:**
- `gpt-5.2-*` variants → `gpt-5.2`
- `gpt-5.1-codex-max`, `codex-max` → `gpt-5.1-codex-max`
- `gpt-5-*` variants → `gpt-5`

#### Anthropic (`anthropic`)

**Configuration:**
```typescript
anthropic: {
  apiKey: string;  // Required: sk-ant-... API key
}
```

**Key Models (December 2025):**
- `claude-opus-4-5`: Premium flagship (200K context, $5.00/$25.00)
  - **Effort-based reasoning**: `reasoning_effort: 'high'` → `output_config.effort`
- `claude-sonnet-4-5`: Best balance (200K context, $3.00/$15.00)
  - **Budget-based reasoning**: `thinking.budget_tokens: 8192`
  - **Important:** `max_tokens` (16384) must be > `budget_tokens` (8192)

**Features:**
- Separated system messages
- Anthropic-style tool calling
- Advanced caching with read/write pricing

**LiteLLM API Model Names:**
- `claude-opus-4-5` → `anthropic/claude-opus-4-5-20251101`
- `claude-sonnet-4-5` → `anthropic/claude-sonnet-4-5-20250929`

**Special Considerations:**
- Uses `x-api-key` header instead of `Authorization`
- System messages passed in separate `system` field
- Opus 4.5 uses effort-based reasoning (like OpenAI)
- Sonnet 4.5 uses budget-based reasoning (must ensure `max_tokens > budget_tokens`)

#### Google Gemini (`gemini`)

**Configuration:**
```typescript
gemini: {
  apiKey: string;  // Required: Gemini API key (GOOGLE_API_KEY)
}
```

**Key Models (December 2025):**
- `gemini-3.1-pro-preview`: Latest flagship (1M context, $2.00/$12.00)
  - **Effort-based reasoning**: `reasoning_effort: 'high'` → `thinking_level: 'high'`
- `gemini-2.5-pro`: Production ready (1M context, $1.25/$10.00)
  - **Budget-based reasoning**: `thinking.budget_tokens: 24576`
- `gemini-2.5-flash`: Fast inference (1M context, $0.15/$0.60)
  - **Budget-based reasoning**: `thinking.budget_tokens: 24576`

**Features:**
- Multimodal capabilities
- Gemini-style tool calling
- Massive 1M token context windows

**LiteLLM API Model Names:**
- `gemini-3.1-pro` → `gemini/gemini-3.1-pro-preview`
- `gemini-3.1-pro-preview` → `gemini/gemini-3.1-pro-preview`
- `gemini-2.5-pro` → `gemini/gemini-2.5-pro`
- `gemini-2.5-flash` → `gemini/gemini-2.5-flash`

**Special Considerations:**
- Gemini 3+ uses `thinking_level` ("low"/"high") via `reasoning_effort` mapping
- Gemini 2.5 uses `thinking.budget_tokens` for budget-based reasoning
- Image models do NOT support thinking parameters

#### xAI (`xAI`)

**Configuration:**
```typescript
xAI: {
  apiKey: string;  // Required: xAI API key
}
```

**Key Models:**
- `grok-2`: Latest Grok model with reasoning
- `grok-3`: Enhanced capabilities
- `grok-3-mini`: Smaller, faster variant
- `grok-3-fast`: Optimized for speed

**Features:**
- Reasoning with effort-based control
- Developer role system messages
- OpenAI-compatible API structure

### Specialized Providers

#### DeepSeek (`deepseek`)

**Configuration:**
```typescript
deepseek: {
  apiKey: string;  // Required: DeepSeek API key
}
```

**Key Models:**
- `deepseek-chat`: Standard chat model (32K context)
- `deepseek-reasoner`: Advanced reasoning (32K context)

**Features:**
- Cost-effective reasoning capabilities
- OpenAI-compatible API
- Think tag parsing for open-source reasoning

#### Groq (`groq`)

**Configuration:**
```typescript
groq: {
  apiKey: string;  // Required: Groq API key
}
```

**Key Models:**
- `qwen-qwq-32b`: Qwen optimized for Groq
- `llama-3.3-70b-versatile`: High-performance Llama
- `llama-3.1-8b-instant`: Fast inference

**Features:**
- Optimized for speed on Groq hardware
- No reasoning capabilities (focus on raw performance)

#### Mistral (`mistral`)

**Configuration:**
```typescript
mistral: {
  apiKey: string;  // Required: Mistral API key
}
```

**Key Models:**
- `codestral-latest`: Code-focused model
- `devstral-small-latest`: Development assistant
- `mistral-large-latest`: General purpose
- `ministral-3b-latest`: Lightweight model

**Features:**
- Code generation specialization
- System role support
- No reasoning capabilities

#### OpenRouter (`openRouter`)

**Configuration:**
```typescript
openRouter: {
  apiKey: string;  // Required: OpenRouter API key
}
```

**Key Models:**
- `anthropic/claude-opus-4`: Routed Claude models
- `deepseek/deepseek-r1`: Routed DeepSeek models
- `qwen/qwen3-235b-a22b`: Massive Qwen model
- Free models with rate limits

**Features:**
- Routes to multiple providers
- Single API key for many models
- Budget-based reasoning for supported models
- Extensive model catalog

### Local/Open-Source Providers

#### Ollama (`ollama`)

**Configuration:**
```typescript
ollama: {
  endpoint: string;  // Default: http://127.0.0.1:11434
}
```

**Features:**
- Local model serving
- Auto-detected model list
- OpenAI-compatible API
- Think tag parsing for reasoning models
- No API key required

**Supported Models:**
- Llama series (2/3/3.1/3.2/3.3)
- Qwen series
- DeepSeek variants
- Gemma, Phi, Codestral
- Custom models

#### vLLM (`vLLM`)

**Configuration:**
```typescript
vLLM: {
  endpoint: string;  // Default: http://localhost:8000
}
```

**Features:**
- High-performance inference server
- OpenAI-compatible API
- Auto-detected models
- Optimized for large models

#### LM Studio (`lmStudio`)

**Configuration:**
```typescript
lmStudio: {
  endpoint: string;  // Default: http://localhost:1234
}
```

**Features:**
- GUI model management
- Local inference
- OpenAI-compatible API
- Auto-detected models

#### LiteLLM (`liteLLM`)

**Configuration:**
```typescript
liteLLM: {
  endpoint: string;  // Custom endpoint
}
```

**Features:**
- OpenAI-compatible proxy
- Routes to multiple providers
- Unified interface
- Cost tracking and usage monitoring

### Enterprise Cloud Providers

#### Google Vertex AI (`googleVertex`)

**Configuration:**
```typescript
googleVertex: {
  region: string;    // Default: us-west2
  project: string;   // Required: GCP project ID
}
```

**Features:**
- Enterprise-grade hosting
- Google Cloud integration
- Vertex AI model garden access
- Advanced security and compliance

#### Microsoft Azure (`microsoftAzure`)

**Configuration:**
```typescript
microsoftAzure: {
  project: string;        // Resource name
  apiKey: string;         // Azure API key
  azureApiVersion: string; // Default: 2024-05-01-preview
}
```

**Features:**
- Azure OpenAI service
- Enterprise integration
- Advanced security
- Custom model deployment

#### AWS Bedrock (`awsBedrock`)

**Configuration:**
```typescript
awsBedrock: {
  apiKey: string;    // AWS API key
  region: string;    // Default: us-east-1
  endpoint?: string; // Optional custom endpoint
}
```

**Features:**
- Multi-model platform
- AWS ecosystem integration
- Foundation models from partners
- Enterprise security

## Provider-Specific Settings

### Reasoning Configuration (December 2025)

Different providers handle reasoning differently. All reasoning is set to **maximum** by default.

**Effort-based (OpenAI, Anthropic Opus 4.5, Gemini 3+, xAI):**
```typescript
reasoningCapabilities: {
  supportsReasoning: true,
  canIOReasoning: true,
  maxReasoningEffort: 'high',  // 'low', 'medium', 'high'
  reasoningReservedOutputTokenSpace: 32_768,
}
```

**Budget-based (Anthropic Sonnet 4.5, Gemini 2.5, OpenRouter):**
```typescript
reasoningCapabilities: {
  supportsReasoning: true,
  canIOReasoning: true,
  maxReasoningBudget: 8192,  // or 24576 for Gemini 2.5
  reasoningReservedOutputTokenSpace: 16_384,  // MUST be > maxReasoningBudget
}
```

**Open-source with think tags (DeepSeek, Ollama models):**
```typescript
reasoningCapabilities: {
  supportsReasoning: true,
  canIOReasoning: true,
  openSourceThinkTags: ['<think>', '</think>'],  // Manual parsing
}
```

### Current Model Reasoning Summary

| Provider | Model | Type | Setting |
|----------|-------|------|---------|
| OpenAI | GPT-5.2, GPT-5, GPT-5.1-codex-max | Effort | `reasoning_effort: 'high'` |
| Anthropic | Claude Opus 4.5 | Effort | `reasoning_effort: 'high'` |
| Anthropic | Claude Sonnet 4.5 | Budget | `budget_tokens: 8192` |
| Gemini | Gemini 3 Pro Preview | Effort | `thinking_level: 'high'` |
| Gemini | Gemini 2.5 Pro/Flash | Budget | `budget_tokens: 24576` |

### System Message Formats

**Standard system role:**
```typescript
supportsSystemMessage: 'system-role'  // Most providers
```

**Developer role (OpenAI):**
```typescript
supportsSystemMessage: 'developer-role'  // OpenAI only
```

**Separated system field (Anthropic):**
```typescript
supportsSystemMessage: 'separated'  // Separate API field
```

### Tool Calling Formats

**OpenAI-style:**
```typescript
specialToolFormat: 'openai-style'  // Default
```

**Anthropic-style:**
```typescript
specialToolFormat: 'anthropic-style'  // Uses tools array
```

**Gemini-style:**
```typescript
specialToolFormat: 'gemini-style'  // Google-specific format
```

## Model Fallback Logic

Each provider implements intelligent fallback matching:

### OpenAI Example:
```typescript
modelOptionsFallback: (modelName) => {
  const lower = modelName.toLowerCase();
  if (lower.includes('gpt-5.2-pro')) return 'gpt-5.2-pro';
  if (lower.includes('gpt-5.2')) return 'gpt-5.2';
  if (lower.includes('gpt-5')) return 'gpt-5';
  // ... more patterns
}
```

### Anthropic Example:
```typescript
modelOptionsFallback: (modelName) => {
  const lower = modelName.toLowerCase();
  if (lower.includes('claude-3.7')) return 'claude-sonnet-4.5';
  if (lower.includes('claude-3.5')) return 'claude-sonnet-4';
  // ... version mapping
}
```

## Cost Structures

### Standard Pricing:
- **Input tokens**: Cost per 1,000 tokens processed
- **Output tokens**: Cost per 1,000 tokens generated
- **Cache read**: Discounted cached input tokens
- **Cache write**: Cost to write to cache

### Special Pricing:
- **DeepSeek**: Very low costs (~$0.001-$0.002/1K tokens)
- **Local models**: $0 (no API costs)
- **OpenRouter**: Varies by underlying provider
- **Free models**: Rate-limited, often with daily quotas

## Configuration Best Practices

1. **API Keys**: Store securely, never in code
2. **Endpoints**: Use defaults for local providers
3. **Regions**: Choose closest to users for cloud providers
4. **Models**: Start with recommended defaults
5. **Overrides**: Use sparingly, test thoroughly
6. **Fallbacks**: Ensure graceful degradation

## Troubleshooting

### Common Issues:

**Model not found:**
- Check exact model name spelling
- Verify model availability in provider
- Check fallback logic

**API errors:**
- Validate API keys
- Check endpoint URLs
- Verify network connectivity
- Check rate limits

**Reasoning not working:**
- Confirm model supports reasoning
- Check provider-specific settings
- Verify reasoning is enabled in UI

**Tool calling issues:**
- Check `specialToolFormat` setting
- Verify model supports tool calling
- Check for `forceXML` overrides

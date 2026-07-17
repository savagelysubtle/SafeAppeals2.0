# Reasoning System

This document explains how SafeAppeals handles LLM reasoning/thinking, including extended thinking from Anthropic and `<think>` tags from open-source models.

## Overview

Modern LLMs can provide "reasoning" or "thinking" alongside their responses:
- **Anthropic Claude**: Native `thinking` blocks via extended thinking API
- **DeepSeek**: `<think>...</think>` tags in output
- **Qwen**: `<think>...</think>` tags
- **Other models**: Various reasoning formats

SafeAppeals separates reasoning from the response so users can:
1. See the actual response prominently
2. Optionally expand/collapse the reasoning
3. Benefit from improved model outputs

## Data Structure

### ChatMessage (Assistant)

```typescript
type AssistantMessage = {
  role: 'assistant';
  displayContent: string;           // The actual response (shown to user)
  reasoning: string;                // The reasoning/thinking (collapsible)
  anthropicReasoning: AnthropicReasoning[] | null;  // Raw Anthropic blocks
}
```

### Stream State

```typescript
type StreamState = {
  llmInfo: {
    displayContentSoFar: string;    // Accumulated response text
    reasoningSoFar: string;         // Accumulated reasoning text
    toolCallSoFar: RawToolCallObj | null;
  };
  // ...
}
```

## Provider-Specific Handling

### Anthropic (Native Thinking Blocks)

Anthropic's SDK provides native support for extended thinking:

```typescript
// Configuration in models/anthropic/index.ts
{
  'claude-opus-4-5': {
    reasoningCapabilities: {
      supportsReasoning: true,
      canIOReasoning: true,
      maxReasoningEffort: 'high',  // low, medium, high
      reasoningReservedOutputTokenSpace: 40_960,
    },
  },
  'claude-sonnet-4-5': {
    reasoningCapabilities: {
      supportsReasoning: true,
      canIOReasoning: true,
      maxReasoningBudget: 8_192,  // Budget-based
      reasoningReservedOutputTokenSpace: 16_384,
    },
  },
}
```

**Request Format:**
```typescript
// For effort-based (Opus 4.5)
{ thinking: { type: 'enabled', budget_tokens: 32768 } }

// For budget-based (Sonnet 4.5)
{ thinking: { type: 'enabled', budget_tokens: 8192 } }
```

**Streaming Events:**
```typescript
// sendLLMMessage.impl.ts - Anthropic streaming handler
stream.on('streamEvent', e => {
  if (e.type === 'content_block_start') {
    if (e.content_block.type === 'thinking') {
      // Goes to fullReasoning
      fullReasoning += e.content_block.thinking
    }
    else if (e.content_block.type === 'text') {
      // Goes to fullText
      fullText += e.content_block.text
    }
  }
  else if (e.type === 'content_block_delta') {
    if (e.delta.type === 'thinking_delta') {
      fullReasoning += e.delta.thinking
    }
    else if (e.delta.type === 'text_delta') {
      fullText += e.delta.text
    }
  }
})
```

### Open-Source Models (Think Tags)

For models that output `<think>...</think>` tags:

```typescript
// extractGrammar.ts - extractReasoningWrapper
const thinkTags = ['<think>', '</think>']

// Before: fullText = "<think>Let me analyze...</think>Here's my answer"
// After:
//   fullText = "Here's my answer"
//   fullReasoning = "Let me analyze..."
```

**Supported Tag Formats:**
```typescript
// modelCapabilities.ts
{
  reasoningCapabilities: {
    openSourceThinkTags: ['<think>', '</think>'],  // DeepSeek, Qwen
  }
}
```

## The Separation Fix (Bug #2024-12)

### The Problem

Previously, `extractXMLToolsWrapper` incorrectly combined `fullText` and `fullReasoning`:

```typescript
// OLD CODE (buggy)
const combinedText = (params.fullText || '') + (params.fullReasoning || '')
const newText = combinedText.substring(prevFullTextLen + prevFullReasoningLen)
trueFullText = combinedText  // ❌ Mixed reasoning with text!
```

This caused:
1. Reasoning content appearing in `displayContent`
2. Tool XML parsing from wrong offset
3. "Agent breaking down at the end"

### The Fix

Keep reasoning and text completely separate:

```typescript
// NEW CODE (fixed)
const currentFullText = params.fullText || ''
const newText = currentFullText.substring(prevFullTextLen)
originalFullText = currentFullText  // ✅ Only actual response

// Pass through reasoning unchanged
onText({
  ...params,
  fullText: displayText,  // Cleaned text (minus tool XML)
  // params.fullReasoning passed through unchanged
  toolCall: latestToolCall,
})
```

## UI Rendering

### SidebarChat.tsx

```tsx
const AssistantMessage = ({ chatMessage }) => {
  const reasoningStr = chatMessage.reasoning?.trim() || null;
  const hasReasoning = !!reasoningStr;
  const isDoneReasoning = !!chatMessage.displayContent;

  return (
    <>
      {/* Collapsible reasoning section */}
      {hasReasoning && (
        <ReasoningDropdown isOpen={!isDoneReasoning}>
          <ChatMarkdownRender string={reasoningStr} />
        </ReasoningDropdown>
      )}

      {/* Main response */}
      {chatMessage.displayContent && (
        <ChatMarkdownRender string={chatMessage.displayContent} />
      )}
    </>
  );
};
```

### Streaming Display

While streaming:
- Reasoning appears in collapsible section (auto-opens while generating)
- Display content appears below
- When reasoning finishes and text starts, reasoning section auto-closes

## Configuration

### Enabling Reasoning

In SafeAppeals Settings:
1. Select a model that supports reasoning (Claude Opus 4.5, Sonnet 4.5)
2. Reasoning is automatically enabled based on model capabilities
3. Effort/budget can be configured per-model

### Model Capabilities Check

```typescript
// modelCapabilities.ts
const capabilities = getModelCapabilities(providerName, modelName, overrides)
const { reasoningCapabilities } = capabilities

if (reasoningCapabilities?.supportsReasoning) {
  // Model supports reasoning
}
if (reasoningCapabilities?.canIOReasoning) {
  // Reasoning can be controlled via API
}
```

## Best Practices

1. **Don't mix reasoning with text** - Always keep them separate
2. **Check model capabilities** - Not all models support reasoning
3. **Handle streaming carefully** - Reasoning may arrive before text
4. **Preserve Anthropic blocks** - Store `anthropicReasoning` for future reference
5. **Auto-close reasoning** - Collapse when text starts arriving


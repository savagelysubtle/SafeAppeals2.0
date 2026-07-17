# Chat System Bug Fixes

This document records significant bugs found and fixed in the chat system.

---

## BUG-2024-12: Reasoning Mixed with Response Content

**Date Fixed**: 2024-12-27

**Severity**: High

**Symptoms**:
- Agent's reasoning appeared as the main response
- Actual response content was missing or truncated
- Tool calls failed to parse ("breaking down at the end")
- Extended thinking responses were corrupted

### Root Cause

In `extractGrammar.ts`, the `extractXMLToolsWrapper` function incorrectly combined `fullText` and `fullReasoning`:

```typescript
// BUG: Lines 343-351 (old code)
const combinedText = (params.fullText || '') + (params.fullReasoning || '')
const newText = combinedText.substring(prevFullTextLen + prevFullReasoningLen)
trueFullText = combinedText  // ❌ Mixed reasoning with text!
```

**Why This Was Wrong**:

1. **Incorrect concatenation order**: The code concatenated `fullText + fullReasoning` but the offset calculation assumed a different order.

2. **Reasoning polluted text**: When streaming, reasoning arrived first (from Anthropic's thinking blocks). The code added this to the local `fullText` variable.

3. **XML parsing from wrong position**: Tool XML was parsed from `trueFullText` (combined), causing wrong offsets.

**Scenario Example**:

```
Call 1: params.fullText = "", params.fullReasoning = "Let me think..."
  → combinedText = "" + "Let me think..." = "Let me think..."
  → newText = "Let me think..."
  → fullText (local) = "Let me think..."  ← WRONG!

Call 2: params.fullText = "Here's my answer with <edit_file>...", params.fullReasoning = "Let me think...more"
  → combinedText = "Here's my answer..." + "Let me think...more"
  → Tool tag at wrong index because fullText had reasoning prefix
```

### The Fix

Keep reasoning and text completely separate:

```typescript
// FIX: Lines 344-352 (new code)
const currentFullText = params.fullText || ''
const newText = currentFullText.substring(prevFullTextLen)
originalFullText = currentFullText  // ✅ Only actual response text

// Pass through reasoning unchanged
onText({
  ...params,
  fullText: displayText,  // Text without tool XML
  // params.fullReasoning unchanged from provider
  toolCall: latestToolCall,
})
```

### Files Changed

- `src/vs/workbench/contrib/void/electron-main/llmMessage/extractGrammar.ts`

### Variable Renames (for clarity)

| Old Name | New Name | Purpose |
|----------|----------|---------|
| `fullText` | `displayText` | Text shown to user (excludes tool XML) |
| `trueFullText` | `originalFullText` | Stores `params.fullText` for XML parsing |
| `prevFullReasoningLen` | (removed) | Not needed - reasoning is passed through |

### Testing

To verify the fix:

1. Use Claude Opus 4.5 or Sonnet 4.5 with extended thinking enabled
2. Send a message that triggers tool usage (e.g., "Edit file X")
3. Verify:
   - Reasoning appears in collapsible section (not in main response)
   - Response text appears correctly
   - Tool calls execute successfully

---

## BUG-2024-11: Tool Calls in Reasoning Not Detected

**Date**: 2024-12 (identified but determined to be expected behavior)

**Symptoms**:
- Tool call XML in reasoning blocks wasn't being parsed

**Resolution**: This is **expected behavior**. The fix above ensures:
- Tool calls should only appear in `fullText` (the actual response)
- Reasoning is the model's internal thought process
- Models should not put executable tool calls in reasoning

If a model incorrectly puts tool calls in reasoning, the current behavior is to ignore them, which prevents unintended tool execution.

---

## BUG-2024-10: Incomplete Tool Calls Causing Validation Errors

**Date Fixed**: 2024-12

**Severity**: Medium

**Symptoms**:
- Validation errors in toolsService
- Tool calls with missing parameters

**Root Cause**: LLM output truncated before tool XML was complete, but partial tool was passed to execution.

**Fix**: Added check in `newOnFinalMessage`:

```typescript
// extractGrammar.ts
if (toolCall && 'name' in toolCall && !toolCall.isDone) {
  logParsingError(toolCall.name, 'INCOMPLETE tool call detected')
  toolCall = undefined  // Don't execute incomplete tools
}
```

---

## Known Issues

### Issue: Native Tool Calling Disabled

**Status**: By Design

**Description**: Native tool calling (Anthropic's `tool_use`, OpenAI's function calling) is available but intentionally disabled.

**Reason**: The system prompt includes XML tool definitions (`includeXMLToolDefinitions=true`). If native tools were enabled, the model would receive conflicting formats:
- System prompt with XML definitions
- Native tool schema in API call

**Future Work**: To enable native tools:
1. Remove XML definitions from system prompt when native tools are used
2. Update `extractXMLToolsWrapper` to handle native tool responses
3. Test with each provider

---

## Debugging Tips

### Enable Debug Logging

The chat system has extensive logging. Key log prefixes:
- `[extractXMLToolsWrapper]` - Tool XML parsing
- `[ChatThreadService]` - Agent loop, tool execution
- `[Anthropic]` - Anthropic-specific streaming
- `[XML Parser]` - Tool parameter extraction

### Common Debug Scenarios

**1. Tool not being detected**:
```
Look for: "[extractXMLToolsWrapper] ✅ FOUND" or "❌" messages
Check: toolOpenTags includes your tool name
```

**2. Reasoning in wrong place**:
```
Look for: "[extractXMLToolsWrapper] 📋 Extended thinking:"
Check: Separate lengths for reasoning and text
```

**3. Streaming state stuck**:
```
Check: streamState.isRunning value
Check: interrupt function is callable
```


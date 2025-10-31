# Tool Call Parsing Failure Analysis & Fix Plan

## Issue Summary

The agent is successfully outputting tool calls in ANTML format, but the XML parser is failing to extract them, resulting in:
```
[ChatThreadService] No tool call to execute - toolCall is: undefined
```

## Root Cause

Looking at your chat log:

1. **Turn 1**: `rag_get_stats` - ✅ WORKED
2. **Turn 2**: `rag_search_policy` - ✅ WORKED
3. **Turn 3**: Multiple parallel `rag_search_policy` calls - ❌ FAILED

The third response contained valid XML:
```xml
<function_calls> <invoke name="rag_search_policy"> <parameter name="query">appeal process review division requirements deadline</parameter> <parameter name="limit">8</parameter> </invoke> <invoke name="rag_search_policy"> <parameter name="query">request review decision denied claim appeal form</parameter> <parameter name="limit">8</parameter> </invoke> <invoke name="rag_search_policy"> <parameter name="query">reconsideration review board decision appeal rights</parameter> <parameter name="limit">8</parameter> </invoke> </function_calls>
```

But the parser failed to extract it. Possible reasons:
1. **Whitespace/formatting issue** - All on one line without newlines
2. **Streaming issue** - Parser might be missing the final closing tag
3. **Regex issue** - The ANTML parser regex might not handle certain edge cases
4. **Timing issue** - Parser might run before full text is received

## Solution Strategy

### Phase 1: Enhanced Logging (Immediate)
Add comprehensive logging to understand exactly where parsing fails:
- Log raw XML input to ANTML parser
- Log regex match results
- Log each tool call as it's extracted
- Log final tool call count

### Phase 2: Robust Retry Logic (Primary Fix)
Implement multi-level retry strategy:

1. **Client-side retry**: If no tool call extracted, prompt LLM to reformat
2. **Parser fallback**: Try multiple parsing strategies in sequence
3. **Whitespace normalization**: Clean up XML before parsing
4. **Partial tool extraction**: Extract what we can, report what we can't

### Phase 3: Success Rate Optimization (Target: 95%+)
- Add telemetry tracking for parse success/failure
- Monitor which patterns cause failures
- Auto-correct common XML formatting issues
- Provide better XML format guidance to LLM

## Implementation Plan

### 1. Add Enhanced Logging to ANTML Parser

**File**: `src/vs/workbench/contrib/void/electron-main/llmMessage/xmlParserService.ts`

Add detailed logging at each parsing step:
- Before regex execution
- After function_calls match
- After each invoke extraction
- Final tool call count

### 2. Add Retry Logic to ChatThreadService

**File**: `src/vs/workbench/contrib/void/browser/chatThreadService.ts`

When `toolCall === null` but response contains `<function_calls>`:
1. Log the failure with full text
2. Send follow-up message to LLM: "Your tool calls failed to parse. Please reformat them with proper line breaks."
3. Retry parsing with normalized whitespace
4. If still fails after 2 attempts, show error to user

### 3. Add XML Normalization Helper

**File**: `src/vs/workbench/contrib/void/electron-main/llmMessage/xmlParserService.ts`

Add function to normalize XML before parsing:
```typescript
function normalizeANTML(xml: string): string {
  // Add line breaks after closing tags
  // Ensure proper spacing
  // Fix common formatting issues
  return xml
    .replace(/<\/invoke>/g, '</invoke>\n')
    .replace(/<\/parameter>/g, '</parameter>\n')
    .replace(/<invoke/g, '\n<invoke')
    .trim()
}
```

### 4. Add Parse Failure Recovery

**File**: `src/vs/workbench/contrib/void/electron-main/llmMessage/extractGrammar.ts`

When ANTML parse fails:
1. Try normalizing XML
2. Try extracting with more lenient regex
3. Attempt to extract partial tool calls
4. Report specific error to UI

## Expected Outcome

- **95%+ success rate** on tool call extraction
- **Automatic recovery** from common XML formatting issues
- **Better error messages** when parsing truly fails
- **Telemetry tracking** to identify patterns

## Testing Plan

1. Test with various XML formats (compact, formatted, mixed)
2. Test with parallel tool calls (3-5 tools)
3. Test with long parameter values
4. Test with special characters in parameters
5. Monitor success rate over 100 queries


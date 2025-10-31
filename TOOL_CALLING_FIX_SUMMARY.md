# Tool Calling Fix Summary

## Problem
The Void AI agent in research mode was not calling tools. Instead, it would:
1. Show reasoning about what tools to use
2. Stop without actually outputting the `<function_calls>` XML

## 🚨 CRITICAL DISCOVERY

**The main issue was testing in the WRONG MODE!**

The console logs showed:
```
[systemToolsXMLPrompt] chatMode: case_manager  ← You were in CASE_MANAGER, not RESEARCH!
```

All the initial fixes were applied to `research` mode only, but the user was testing in `case_manager` mode!

## Root Causes Identified

### 1. **System Prompt Format Mismatch** ✅ FIXED
- **Issue**: Research mode system prompt showed OLD XML format examples
- **Was**: `<rag_search_policy><query>...</query></rag_search_policy>`
- **Should be**: `<function_calls><invoke name="rag_search_policy"><parameter name="query">...</parameter></invoke></function_calls>`
- **Fix**: Updated all examples in `systemPrompt.ts` to use ANTML format

### 2. **Reasoning vs Tool Calling Conflict** ✅ FIXED
- **Issue**: Initial instructions said "NO REASONING, JUST TOOL CALLS"
- **Problem**: This prevented the agent from thinking about which tools to use
- **Solution**: Changed to allow reasoning BEFORE tool calls, but require both in same response

### 3. **Reasoning Extraction Parsing** ✅ FIXED
- **Issue**: Tool calls were being searched in `trueFullText` (fullText + fullReasoning combined)
- **Problem**: This could cause tool calls to be detected in reasoning blocks
- **Fix**: Changed `extractGrammar.ts` to only search for `<function_calls>` in `params.fullText`, not in combined text

## Files Modified

### 1. `src/vs/workbench/contrib/void/common/prompt/systemPrompt.ts`
**Changes:**
- **RESEARCH MODE:**
  - Added prominent warning at top: "ALWAYS OUTPUT TOOL CALLS IN YOUR FIRST RESPONSE"
  - Completely rewrote workflow instructions to emphasize "reasoning + tool calls in SAME response"
  - Added multiple WRONG examples showing what NOT to do
  - Added CORRECT examples with ANTML format

- **CASE_MANAGER MODE:**
  - Added 🚨 warning: "OUTPUT TOOL CALLS IMMEDIATELY!"
  - Updated Phase 1 and Phase 2 examples to show actual `<function_calls>` XML format
  - Made it clear: "Do NOT say 'I'll search...' and then stop"

### 2. `src/vs/workbench/contrib/void/electron-main/llmMessage/extractGrammar.ts`
**Changes:**
- Line 371: Changed from `trueFullText.indexOf('<function_calls>')` to `params.fullText.indexOf('<function_calls>')`
- Line 379: Changed from `trueFullText.substring()` to `params.fullText.substring()`
- **Why**: Ensures tool calls are only detected in actual response text, not in reasoning blocks

### 3. `src/vs/workbench/contrib/void/common/prompt/prompts.ts`
**Changes:**
- Added comprehensive debug logging to `systemToolsXMLPrompt` function (lines 601-610)
- Logs: chatMode, mcpTools count, tools returned, tool names, RAG tools specifically
- **Why**: Helps diagnose if tools are being passed to the LLM correctly

## Expected Behavior Now

### User Query Example:
"What are the requirements for appealing a denied permanent disability rating?"

### Expected Agent Response (Turn 1):
```
[Reasoning Block - in reasoning panel]
The user is asking about appeal requirements for permanent disability ratings.
I need to search policy manuals for:
1. Appeal procedures and requirements
2. Deadlines and documentation
3. Relevant policy sections

[Tool Calls - in same response]
<function_calls>
<invoke name="rag_search_policy">
<parameter name="query">permanent disability rating appeal requirements</parameter>
<parameter name="limit">8</parameter>
</invoke>
<invoke name="rag_search_policy">
<parameter name="query">appeal denied permanent disability deadline documentation</parameter>
<parameter name="limit">5</parameter>
</invoke>
</function_calls>
```

### Agent Response (Turn 2 - after results):
```
According to [Policy Manual], Section [X], page [Y]:
[Detailed analysis with citations from search results]
```

## Key Improvements

1. ✅ **Agent can reason** about which tools to use
2. ✅ **Agent must act immediately** after reasoning in same response
3. ✅ **Clear examples** of correct and incorrect behavior
4. ✅ **Prominent warnings** at multiple levels
5. ✅ **Better parsing** that separates reasoning from tool calls
6. ✅ **Debug logging** to diagnose tool availability issues

## Testing Checklist

When testing, verify:
- [ ] Reasoning appears in reasoning panel
- [ ] Tool calls appear immediately after reasoning (same response)
- [ ] Multiple tools can be called in parallel
- [ ] Console logs show: `[systemToolsXMLPrompt] RAG tools: [rag_search_policy, rag_search_workspace, rag_get_stats]`
- [ ] Console logs show: `[extractXMLToolsWrapper] ✅ FOUND <function_calls> tag`
- [ ] Tool execution happens automatically (no user confirmation needed for RAG tools)

## Console Logs to Watch For

### Good Signs:
```
[systemToolsXMLPrompt] chatMode: research
[systemToolsXMLPrompt] tools returned: 15
[systemToolsXMLPrompt] RAG tools: [rag_search_policy, rag_search_workspace, rag_get_stats]
[extractXMLToolsWrapper] ✅ FOUND <function_calls> tag at index: 245
[XML Parser] ✅ Parsed ANTML format successfully
[ChatThreadService] 🔄 Parallel execution: 2 tools
```

### Bad Signs:
```
[systemToolsXMLPrompt] ❌ NO TOOLS AVAILABLE! Returning null.
[systemToolsXMLPrompt] tools returned: 0
[XML Parser] Failed to parse ANTML format
```

## If Still Not Working

If the agent still doesn't call tools after these fixes:

1. **Check console for debug logs** - Are tools being passed to LLM?
2. **Check chat mode** - Should be "research", "case_manager", or "drafting"
3. **Check model** - Is it Claude Sonnet 4.5 or equivalent?
4. **Check raw LLM response** - Is the model outputting `<function_calls>` but parser failing?
5. **Check system message** - Is `includeXMLToolDefinitions` true?

## Related Files

- `ANTML_MIGRATION_COMPLETE.md` - Documentation of ANTML format migration
- `CURSOR_TOOL_CALL_EXAMPLES.md` - Examples of Cursor's tool calling format (for reference)
- `XML_TOOLS_REVIEW.md` - Analysis of XML parsing implementation


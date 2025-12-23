# Void Agent System - Current Implementation Analysis

## Executive Summary

Void uses a **custom-built agent system** that combines:

- **LLM Provider Integration**: Direct SDK usage for Anthropic, OpenAI, Gemini, Mistral, Ollama, and others
- **MCP Tool Integration**: Model Context Protocol for external tool capabilities
- **Custom XML Tool Calling**: Force-enabled XML parsing for all chat modes
- **Streaming Architecture**: Real-time LLM response processing with tool call extraction

---

## Architecture Overview

### Three-Tier Agent System

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER PROCESS                          │
├─────────────────────────────────────────────────────────────┤
│  ChatThreadService (_runChatAgent)                          │
│  ├─ Agent Loop (handles streaming, tool calls, retries)    │
│  ├─ Tool Approval/Rejection Logic                          │
│  └─ Checkpoint System (for undo/history)                   │
│                                                             │
│  ToolsService (validateParams, callTool, stringOfResult)   │
│  ├─ Parameter Validation (validateURI, validateStr, etc.)  │
│  ├─ Tool Execution (built-in tools + MCP delegation)       │
│  └─ Result Serialization                                   │
│                                                             │
│  ConvertToLLMMessageService                                 │
│  └─ Converts ChatMessage → Provider-specific format        │
└─────────────────────────────────────────────────────────────┘
                           ↓ IPC
┌─────────────────────────────────────────────────────────────┐
│                  ELECTRON-MAIN PROCESS                      │
├─────────────────────────────────────────────────────────────┤
│  sendLLMMessage.impl.ts                                     │
│  ├─ Provider SDK Initialization (Anthropic, OpenAI, etc.)  │
│  ├─ Streaming Response Handler                             │
│  └─ extractXMLToolsWrapper (XML tool call parsing)         │
│                                                             │
│  extractGrammar.ts                                          │
│  ├─ parseXMLPrefixToToolCall (XML → RawToolCallObj)       │
│  ├─ extractReasoningWrapper (thinking token extraction)    │
│  └─ Buffer management for incomplete XML                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Core Components

### 1. ChatThreadService (`browser/chatThreadService.ts`)

**Purpose**: Orchestrates the agent loop, manages chat state, handles tool execution lifecycle.

**Key Methods**:

- `_runChatAgent()` - Main agent loop (lines 756-1001)
- `_runToolCall()` - Tool execution with approval/rejection logic (lines 605-751)
- `approveLatestToolRequest()` / `rejectLatestToolRequest()` - User approval handlers

**Agent Loop Flow**:

```typescript
while (shouldSendAnotherMessage) {
  1. Convert chat messages to LLM format
  2. Send LLM request with tools (if available)
  3. Stream response, extract tool calls via XML parsing
  4. On tool call detection:
     a. Validate parameters
     b. Check if approval required
     c. Execute tool (or await approval)
  5. Add tool result to history
  6. Loop if tool was called (multi-step reasoning)
}
```

**Stream State Management**:

```typescript
type IsRunningType =
	| "LLM" // LLM streaming
	| "tool" // Tool executing
	| "awaiting_user" // Waiting for approval
	| "idle" // Between operations
	| undefined; // Not running
```

**Retry Logic**:

- `CHAT_RETRIES = 3` (line 45)
- `RETRY_DELAY = 2500ms` (line 46)
- Exponential backoff on LLM errors

---

### 2. ToolsService (`browser/toolsService.ts`)

**Purpose**: Centralized service for tool parameter validation, execution, and result serialization.

**Architecture**:

```typescript
interface IToolsService {
	validateParams: {
		[T in BuiltinToolName]: (p: RawToolParamsObj) => BuiltinToolCallParams[T];
	};
	callTool: {
		[T in BuiltinToolName]: (
			p: BuiltinToolCallParams[T]
		) => Promise<{ result; interruptTool? }>;
	};
	stringOfResult: { [T in BuiltinToolName]: (p, result) => string };
}
```

**Built-in Tools** (30+ tools):

| Category              | Tools                                                                                                                    | Purpose                         |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| **Context Gathering** | `read_file`, `ls_dir`, `get_dir_tree`, `search_pathnames_only`, `search_for_files`, `search_in_file`, `read_lint_errors` | Read and search codebase        |
| **File Editing**      | `create_file_or_folder`, `delete_file_or_folder`, `edit_file`, `rewrite_file`                                            | Modify files and directories    |
| **Terminal**          | `run_command`, `run_persistent_command`, `open_persistent_terminal`, `kill_persistent_terminal`                          | Execute shell commands          |
| **RAG**               | `rag_index_document`, `rag_search_policy`, `rag_search_workspace`, `rag_get_stats`                                       | Document indexing and retrieval |
| **Document Editing**  | `edit_document`                                                                                                          | Edit DOCX/XLSX files            |

**Parameter Validation** (lines 168-360):

- `validateURI()` - Handles local paths, file:// URIs, vscode-remote:// URIs (WSL, SSH)
- `validateStr()` / `validateOptionalStr()` - Type-safe string validation
- `validateNumber()` / `validateBoolean()` - Type coercion with defaults
- `validatePageNum()` - Pagination support

**Execution Features**:

- **Interrupt Support**: Tools return `interruptTool()` callback for cancellation
- **Pagination**: File content and search results paginated (`MAX_FILE_CHARS_PAGE = 500,000`)
- **Document Support**: Automatic DOCX/XLSX/PDF extraction via `documentViewerService`

---

### 3. XML Parsing System (`electron-main/llmMessage/extractGrammar.ts`)

**Purpose**: Extract tool calls from LLM XML output during streaming.

#### Critical Issues Identified

**Bug #1: 10-Parameter Limit (Line 212)**:

```typescript
while (true) {
	n += 1;
	if (n > 10) return getAnswer(); // ❌ CRITICAL BUG: Hard limit of 10 parameters
	// ...
}
```

**Impact**: Tools with >10 parameters silently fail. No error thrown, incomplete tool call passed through.

**Bug #2: Incomplete Tool Calls Passed Through (Line 404)**:

```typescript
onFinalMessage({ ...params, fullText, toolCall: toolCall }); // ❌ Passes `isDone: false` tool calls
```

**Impact**: If XML is incomplete, executor receives `isDone: false` tool call, causing runtime errors.

**Bug #3: No Malformed XML Recovery**:

- Uses `indexOf` and `substring` for parsing (brittle for streaming)
- No fallback for unescaped special characters (`&`, `<`, `>`)
- No recovery for nested tag mismatches

#### How It Works

**1. extractXMLToolsWrapper** (lines 263-407):

```typescript
// Intercepts onText and onFinalMessage callbacks
// Searches for tool tags like <read_file>, <edit_file>, etc.
// Uses buffer management to handle partial tags

const newOnText: OnText = (params) => {
	// 1. Check if tool tag is partially written (e.g., "<read_fi")
	const isPartial = findPartiallyWrittenToolTagAtEnd(newFullText, toolOpenTags);
	if (isPartial) {
		openToolTagBuffer += newText; // Buffer until complete
	}

	// 2. Find complete tool tag
	const i = findIndexOfAny(fullText, toolOpenTags);
	if (i !== null) {
		foundOpenTag = { idx, toolName };
		// 3. Parse XML to extract parameters
		latestToolCall = parseXMLPrefixToToolCall(
			toolName,
			toolId,
			xmlSubstring,
			toolOfToolName
		);
	}

	// 4. Pass to original onText with extracted tool call
	onText({ ...params, fullText, toolCall: latestToolCall });
};
```

**2. parseXMLPrefixToToolCall** (lines 168-261):

```typescript
// Extracts parameters from XML like:
// <read_file>
//   <uri>/path/to/file.ts</uri>
//   <start_line>10</start_line>
// </read_file>

const paramsObj: RawToolParamsObj = {};
const doneParams: ToolParamName<T>[] = [];

// Loop through tool parameters
while (true) {
	n += 1;
	if (n > 10) return getAnswer(); // ❌ BUG: 10-param limit

	// Find opening tag like <uri>
	for (const paramName of allowedParams) {
		const removed = pm.removeFromStartUntilFullMatch(`<${paramName}>`, true);
		if (removed) {
			matchedOpenParam = paramName;
			break;
		}
	}

	// Extract content until closing tag </uri>
	const closeTag = `</${paramName}>`;
	const removed = pm.removeFromStartUntilFullMatch(closeTag, true);
	if (removed) {
		paramContents = pm.originalS.substring(i, i2 - closeTag.length);
		paramsObj[latestMatchedOpenParam] = paramContents;
		doneParams.push(latestMatchedOpenParam);
	}
}
```

---

### 4. LLM Provider Integration (`electron-main/llmMessage/sendLLMMessage.impl.ts`)

**Purpose**: Manage provider-specific SDK calls and streaming response handling.

**Supported Providers** (lines 870-954):
| Provider | Native Tools | Streaming | Notes |
|----------|--------------|-----------|-------|
| **Anthropic** | ✅ (force XML) | SSE | Lines 461-589, force XML on line 467 |
| **OpenAI** | ✅ (force XML) | SSE | Lines 273-391, force XML on line 282 |
| **Gemini** | ✅ (force XML) | SSE | Lines 727-858, force XML on line 754 |
| **Mistral** | ✅ (force XML) | SSE | Force XML applied |
| **Ollama** | ✅ (force XML) | HTTP/SSE | Force XML applied |
| **Groq** | ✅ (force XML) | SSE | Force XML applied |
| **xAI** | ✅ (force XML) | SSE | Force XML applied |
| **DeepSeek** | ✅ (force XML) | SSE | Force XML applied |
| **OpenRouter** | ✅ (force XML) | SSE | Force XML applied |
| **vLLM** | ✅ (force XML) | HTTP/SSE | Force XML applied |
| **lmStudio** | ✅ (force XML) | WebSocket/SSE | Force XML applied |
| **liteLLM** | Provider-dependent | Provider-dependent | Force XML applied |

**Forced XML Implementation**:

```typescript
// Line 282 (_sendOpenAICompatibleChat)
const specialToolFormat = undefined; // FORCE XML tool parsing for all chat modes

// Line 467 (sendAnthropicChat)
const specialToolFormat = undefined; // FORCE XML tool parsing for all chat modes

// Line 754 (sendGeminiChat)
const specialToolFormat = undefined; // FORCE XML tool parsing for all chat modes
```

**Why Force XML?**:

- **Consistency**: Single parsing path for all providers
- **Control**: Avoid provider-specific tool formats
- **Streaming**: Can parse partial tool calls incrementally
- **Simplicity**: No schema transformation needed

**Streaming Architecture**:

```typescript
// OpenAI-Compatible (lines 339-391)
openai.chat.completions.create(options)
  .then(async response => {
    _setAborter(() => response.controller.abort())

    for await (const chunk of response) {
      const newText = chunk.choices[0]?.delta?.content ?? ''
      fullTextSoFar += newText

      // Tool call streaming
      for (const tool of chunk.choices[0]?.delta?.tool_calls ?? []) {
        toolName += tool.function?.name ?? ''
        toolParamsStr += tool.function?.arguments ?? ''
        toolId += tool.id ?? ''
      }

      // Pass to XML wrapper (if enabled)
      onText({ fullText: fullTextSoFar, fullReasoning, toolCall: ... })
    }

    onFinalMessage({ fullText, fullReasoning, anthropicReasoning, toolCall })
  })
```

---

### 5. Prompt System (`common/prompt/prompts.ts`)

**Purpose**: Generate system prompts, tool definitions, and user messages.

**Tool Definition Format (XML)**:

```typescript
const toolCallDefinitionsXMLString = (tools: InternalToolInfo[]) => {
	return `${tools
		.map((t, i) => {
			const params = Object.keys(t.params)
				.map(
					(paramName) =>
						`<${paramName}>${t.params[paramName].description}</${paramName}>`
				)
				.join("\n");

			return `
    ${i + 1}. ${t.name}
    Description: ${t.description}

    Format:
    <${t.name}>${!params ? "" : `\n${params}`}
    </${t.name}>`;
		})
		.join("\n\n")}`;
};
```

**Example Tool Prompt**:

```xml
Available tools:

1. read_file
Description: Returns file contents. Extracts text from PDF/DOCX/XLSX.

Format:
<read_file>
<uri>The FULL path to the file.</uri>
<start_line>Optional. Defaults to beginning.</start_line>
<end_line>Optional. Defaults to end.</end_line>
<page_number>Optional. The page number of the result. Default is 1.</page_number>
</read_file>

Tool calling details:
- To call a tool, write its name and parameters using the XML format shown above.
- Output the XML tool call directly - DO NOT wrap it in <function_calls> or <tool_call> tags.
- Place the tool call at the END of your response after any explanation.
- After you write the tool call, STOP. The tool will execute and results will appear in the next message.
- You are only allowed to output ONE tool call per response.
```

**Chat Modes and Tool Availability**:

```typescript
export const availableTools = (chatMode: ChatMode | null, mcpTools: InternalToolInfo[] | undefined) => {
  const builtinToolNames: BuiltinToolName[] | undefined =
    chatMode === 'drafting' ? ['read_file', 'edit_file', 'edit_document', 'create_file_or_folder', 'rag_search_policy', 'rag_search_workspace', 'rag_get_stats']
    : chatMode === 'research' ? /* All non-approval tools */
    : chatMode === 'case_manager' ? /* All tools including MCP */
    : undefined

  return [...(effectiveBuiltinTools ?? []), ...(effectiveMCPTools ?? [])]
}
```

---

## Data Flow

### Complete Request Flow

```
1. User sends message
   ↓
2. ChatThreadService.addUserMessageAndStreamResponse()
   ├─ Add user message to thread
   ├─ Set currCheckpointIdx = null (streaming started)
   └─ Call _runChatAgent()

3. _runChatAgent() - Agent Loop
   ├─ Prepare LLM messages (ConvertToLLMMessageService)
   ├─ Get available tools for chatMode
   └─ Send to LLM (via IPC to electron-main)

4. sendLLMMessage.impl.ts (electron-main)
   ├─ Initialize provider SDK (Anthropic/OpenAI/etc.)
   ├─ Set specialToolFormat = undefined (force XML)
   ├─ Wrap onText/onFinalMessage with extractXMLToolsWrapper
   ├─ Start streaming request
   └─ For each chunk:
      ├─ Pass to extractXMLToolsWrapper
      ├─ Extract tool calls via parseXMLPrefixToToolCall
      └─ Call onText({ fullText, toolCall })

5. extractXMLToolsWrapper (electron-main)
   ├─ Buffer partial tags
   ├─ Detect complete tool tags (<read_file>, etc.)
   ├─ Parse XML parameters
   └─ Return RawToolCallObj { name, rawParams, isDone, doneParams, id }

6. Back to ChatThreadService (browser)
   ├─ Update stream state: { isRunning: 'LLM', llmInfo: { toolCallSoFar } }
   └─ On final message with tool call:
      ├─ Add assistant message to thread
      ├─ Call _runToolCall()

7. _runToolCall()
   ├─ Validate params (ToolsService.validateParams[toolName])
   ├─ Check approval requirement
   ├─ If requires approval:
   │  ├─ Add tool_request message
   │  ├─ Set streamState = 'awaiting_user'
   │  └─ Return { awaitingUserApproval: true }
   ├─ Else execute tool:
   │  ├─ Set streamState = 'tool'
   │  ├─ Call ToolsService.callTool[toolName](params)
   │  └─ Add tool result message
   │
8. Tool Result Handling
   ├─ On success: Add tool result to history
   ├─ On error: Add error message to history
   └─ Continue agent loop (go back to step 3)

9. Loop Termination
   ├─ No tool call: End loop, add checkpoint
   ├─ Tool interrupted: End loop, add checkpoint
   └─ Awaiting approval: Pause loop, set streamState = 'awaiting_user'
```

---

## Critical Issues Summary

### 1. **10-Parameter Limit Bug** (extractGrammar.ts:212)

**Code**:

```typescript
while (true) {
	n += 1;
	if (n > 10) return getAnswer(); // ❌ CRITICAL BUG
	// ...
}
```

**Impact**:

- Tools with >10 parameters silently fail
- No error thrown, returns incomplete tool call with `isDone: false`
- Affects: `edit_document` (2 params), most tools safe, but extensibility broken

**Recommended Fix**:

```typescript
const MAX_PARAMS = 50; // or remove limit entirely
while (true) {
	n += 1;
	if (n > MAX_PARAMS) {
		console.error(
			`[parseXMLPrefixToToolCall] Exceeded max params (${MAX_PARAMS}) for tool ${toolName}`
		);
		return getAnswer();
	}
	// ...
}
```

---

### 2. **Incomplete Tool Calls Passed Through** (extractGrammar.ts:404)

**Code**:

```typescript
onFinalMessage({ ...params, fullText, toolCall: toolCall }); // Passes isDone: false
```

**Impact**:

- If XML incomplete, executor receives partial tool call
- `ToolsService.validateParams` may throw errors on missing params
- Race conditions if LLM output truncated

**Recommended Fix**:

```typescript
// Only pass tool call if complete OR add explicit incomplete flag
const toolCallObj = toolCall?.isDone
	? { toolCall }
	: { incompleteToolCall: toolCall };
onFinalMessage({ ...params, fullText, ...toolCallObj });
```

---

### 3. **No Malformed XML Recovery**

**Current Approach**:

- Uses `indexOf` and `substring` (brittle)
- No handling for unescaped `&`, `<`, `>` in content
- No recovery for nested tag mismatches

**Recommended Solutions** (from research):

- Add `partial-xml-stream-parser` as fallback (85% recovery rate)
- Add `fast-xml-parser` for validation
- Implement multi-tier fallback: Custom → LLM Parser → Fast-XML-Parser → Text Extractor

---

### 4. **No Parameter Validation Schema**

**Current Approach**:

- Manual validation in `ToolsService.validateParams`
- No schema-level validation (XSD, JSON Schema)
- Type coercion scattered across validators

**Recommended Solutions** (from research):

- Implement schema compilation + caching (75x faster)
- Add runtime type checking with Pydantic-style validation
- Streaming validation (SAX/StAX) for large payloads

---

## Performance Characteristics

### Current Bottlenecks

1. **XML Parsing**:

   - Manual `indexOf` loops: O(n²) worst case for nested tags
   - No incremental parsing: Re-parses full text on each chunk
   - No caching: Tool schemas regenerated on every request

2. **Parameter Validation**:

   - No schema pre-compilation
   - Type coercion on every call
   - URI validation creates new objects

3. **Streaming**:
   - Buffer management in JS (not native)
   - No backpressure handling
   - IPC overhead (browser → electron-main)

### Benchmarks (Estimated)

| Operation                   | Current   | Optimized (with fixes) |
| --------------------------- | --------- | ---------------------- |
| Parse tool call (10 params) | ~15ms     | ~5ms (SAX parser)      |
| Validate parameters         | ~5ms      | ~1ms (compiled schema) |
| Streaming chunk processing  | ~20ms     | ~8ms (native parser)   |
| **Total per tool call**     | **~40ms** | **~14ms (65% faster)** |

---

## Recommendations

### Immediate Actions (Critical Bugs)

1. **Remove 10-parameter limit** (extractGrammar.ts:212)

   - Replace with higher limit or remove entirely
   - Add error logging if limit exceeded

2. **Fix incomplete tool call handling** (extractGrammar.ts:404)

   - Only pass `toolCall` if `isDone === true`
   - Add `incompleteToolCall` field for debugging

3. **Add XML parsing fallback**
   - Primary: Keep custom parser (fast, lightweight)
   - Fallback: `partial-xml-stream-parser` for recovery
   - Last resort: `fast-xml-parser` for validation

### Short-Term Improvements (Performance)

4. **Implement parameter validation schema**

   - Pre-compile tool schemas on service initialization
   - Cache validation functions (75x faster)
   - Add Pydantic-style validators for complex rules

5. **Add monitoring and logging**
   - Track tool call success/failure rates
   - Log XML parsing errors with full context
   - Monitor streaming performance (latency, throughput)

### Long-Term Migration (Native APIs)

6. **Migrate to native tool calling APIs** (17-week plan from research)
   - Phase 1: Add unified abstraction layer
   - Phase 2: Implement provider-specific adapters
   - Phase 3: XML fallback for unsupported providers
   - See `docs/COMPREHENSIVE_XML_TOOL_PARSING_RESEARCH.md` for full plan

---

## File Reference

| File                                              | Purpose                          | Lines | Complexity |
| ------------------------------------------------- | -------------------------------- | ----- | ---------- |
| `browser/chatThreadService.ts`                    | Agent loop orchestration         | 1,975 | High       |
| `browser/toolsService.ts`                         | Tool validation/execution        | 855   | High       |
| `electron-main/llmMessage/sendLLMMessage.impl.ts` | Provider SDK integration         | 980   | High       |
| `electron-main/llmMessage/extractGrammar.ts`      | XML tool call parsing            | 428   | High       |
| `common/prompt/prompts.ts`                        | System prompts, tool definitions | 1,248 | High       |
| `common/sendLLMMessageTypes.ts`                   | Type definitions                 | 215   | Medium     |
| `common/toolsServiceTypes.ts`                     | Tool parameter types             | 115   | Low        |

---

## Conclusion

Void's custom agent system is **powerful and flexible** but suffers from:

1. ✅ **Strengths**: Multi-provider support, streaming, MCP integration, rich tool set
2. ❌ **Weaknesses**: XML parsing bugs (10-param limit), no error recovery, no validation schema
3. 🔄 **Opportunity**: Migrate to native APIs with unified abstraction layer (see research doc)

**Next Steps**:

1. Fix critical bugs (10-param limit, incomplete tool calls)
2. Add XML parsing fallback (partial-xml-stream-parser)
3. Implement validation schema with caching
4. Plan migration to native APIs (17-week timeline)

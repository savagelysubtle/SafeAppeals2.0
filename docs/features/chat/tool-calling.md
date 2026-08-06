<!-- Copyright (c) Safe Appeals. All rights reserved. -->

# Tool Calling System

> **Historical Void XML notes (not the shipping path).** Agent tools today are VS Code
> `vscode.lm` language-model tools contributed by extensions (`safeappeals_*` satellites,
> CORE host tools such as `timeline_*`). See
> [Agent LM Tools Pattern](../../agent-tools-pattern.md). The sections below document the
> retired Void ANTML / `extractXMLToolsWrapper` stack for reference only.

## Overview (Void-era)

The Void agent used XML-based tool calling where:
1. LLM outputs tool calls as XML in its response
2. `extractXMLToolsWrapper` parses the XML
3. Parameters are validated by `toolsService`
4. User approves (or auto-approval if enabled)
5. Tool executes and result is added to conversation

## Tool Call Formats

### Legacy Format (Single Tool)

```xml
Here's my analysis. I'll edit the file now.

<edit_file>
<path>src/app.ts</path>
<content>
const app = express();
app.get('/', (req, res) => res.send('Hello'));
</content>
</edit_file>
```

### ANTML Format (Multiple Tools)

```xml
I'll make these changes in parallel.

<function_calls>
<invoke name="read_file">
<parameter name="path">src/config.ts</parameter>
</invoke>
<invoke name="read_file">
<parameter name="path">src/utils.ts</parameter>
</invoke>
</function_calls>
```

## Parsing Pipeline

### extractXMLToolsWrapper

Located in `extractGrammar.ts`, this wrapper intercepts LLM responses:

```typescript
const { newOnText, newOnFinalMessage } = extractXMLToolsWrapper(
  onText,
  onFinalMessage,
  chatMode,
  mcpTools
)
```

**Key Steps**:

1. **Detect Tool Tags**: Search for `<tool_name>` or `<function_calls>` in response
2. **Extract Display Text**: Everything before the tool XML becomes `displayText`
3. **Parse XML**: Extract tool name and parameters
4. **Return Structured Data**: `{ fullText, fullReasoning, toolCall }`

### XMLParserService

The `XMLParserService` handles complex XML parsing with fallbacks:

```typescript
const parseResult = parserService.parseToolCall(
  toolName,           // Tool name (or undefined for ANTML)
  toolId,             // UUID for this call
  xmlSubstring,       // The XML to parse
  toolOfToolName      // Tool definitions map
)
```

**Parsing Strategies**:
1. **Custom Parser**: Fast, handles streaming partial XML
2. **Regex Fallback**: For malformed XML
3. **Recovery Actions**: Attempts to fix common issues

## Tool Call Types

### RawToolCallObj

```typescript
// Single tool call
type SingleToolCall = {
  name: ToolName;
  rawParams: RawToolParamsObj;      // Raw string parameters
  doneParams: ToolParamName[];       // Parameters fully received
  id: string;                        // Unique ID
  isDone: boolean;                   // Is XML complete?
}

// Multiple tool calls (ANTML)
type MultipleToolCalls = {
  toolCalls: SingleToolCall[];
  format: 'antml';
}

type RawToolCallObj = SingleToolCall | MultipleToolCalls;
```

### Type Guards

```typescript
function isSingleToolCall(toolCall: RawToolCallObj): toolCall is SingleToolCall {
  return 'name' in toolCall;
}

function isMultipleToolCalls(toolCall: RawToolCallObj): toolCall is MultipleToolCalls {
  return 'toolCalls' in toolCall && 'format' in toolCall;
}
```

## Tool Execution Flow

### 1. Validation

```typescript
// toolsService.ts
const params = toolsService.validateParams[toolName](rawParams);
// Throws if validation fails
```

### 2. User Approval

```typescript
// chatThreadService.ts
if (!autoApproved) {
  this._setStreamState(threadId, { isRunning: 'awaiting_user' });
  // UI shows approve/reject buttons
  await userApprovalPromise;
}
```

### 3. Execution

```typescript
// toolsService.ts
const result = await toolsService.runTool[toolName](params);
```

### 4. Result Handling

```typescript
// Add result to thread
this._addMessageToThread(threadId, {
  role: 'tool',
  type: 'success',
  name: toolName,
  content: JSON.stringify(result),
  result: result,
  // ...
});
```

## Tool Message Types

```typescript
type ToolMessage<T extends ToolName> = {
  role: 'tool';
  content: string;           // Result as string (for LLM)
  id: string;                // Tool call ID
  rawParams: RawToolParamsObj;
  mcpServerName: string | undefined;
} & (
  | { type: 'invalid_params', result: null, name: T }
  | { type: 'tool_request', result: null, name: T, params: ToolCallParams<T> }
  | { type: 'running_now', result: null, name: T, params: ToolCallParams<T> }
  | { type: 'tool_error', result: string, name: T, params: ToolCallParams<T> }
  | { type: 'success', result: Awaited<ToolResult<T>>, name: T, params: ToolCallParams<T> }
  | { type: 'rejected', result: null, name: T, params: ToolCallParams<T> }
)
```

## Native vs XML Tool Calling (Void-era)

### Shipping today

SafeAppeals Agent uses the workbench / Copilot LM tools pipeline (`vscode.lm.registerTool`
+ `contributes.languageModelTools`). Satellite catalogs and allowlisting:
[Agent LM Tools Pattern](../../agent-tools-pattern.md).

### Historical: Void forced XML

In the Void stack, providers were forced through XML tool calling because:
1. System prompt included XML tool definitions
2. Parsing was consistent across providers via `extractXMLToolsWrapper`
3. Native provider tool formats existed in code but were disabled

```typescript
// sendLLMMessage.impl.ts (Void-era)
// FORCE XML parsing: System prompt uses XML tool definitions
let specialToolFormat: 'anthropic-style' | 'openai-style' | undefined = undefined
// Was: getToolFormatFromRoute(route)
```

### Provider Native Formats (Void-era status)

| Provider | Native Format | Void-era status |
|----------|---------------|-----------------|
| Anthropic | `tool_use` blocks | Implemented, disabled in Void |
| OpenAI | `function_calling` | Implemented, disabled in Void |
| Gemini | `functionCall` | Implemented, disabled in Void |
| Others | N/A | Used XML in Void |

## Parallel Tool Execution

ANTML format supports parallel tool calls:

```typescript
// chatThreadService.ts
if ('toolCalls' in toolCall && toolCall.format === 'antml') {
  // Execute all tools in parallel
  const toolPromises = toolCall.toolCalls.map(async (singleCall) => {
    return await this._runToolCall(threadId, singleCall.name, singleCall.id, ...);
  });

  const results = await Promise.all(toolPromises);
}
```

## Error Handling

### Validation Errors

```typescript
try {
  const params = toolsService.validateParams[toolName](rawParams);
} catch (error) {
  this._addMessageToThread(threadId, {
    role: 'tool',
    type: 'invalid_params',
    name: toolName,
    content: `Invalid parameters: ${error.message}`,
    // ...
  });
}
```

### Execution Errors

```typescript
try {
  const result = await toolsService.runTool[toolName](params);
} catch (error) {
  this._addMessageToThread(threadId, {
    role: 'tool',
    type: 'tool_error',
    result: error.message,
    // ...
  });
}
```

### Incomplete Tool Calls

```typescript
// extractGrammar.ts - newOnFinalMessage
if (toolCall && 'name' in toolCall && !toolCall.isDone) {
  // LLM output was truncated
  logParsingError(toolCall.name, 'INCOMPLETE tool call detected');
  toolCall = undefined;  // Don't execute
}
```

## MCP Tools

Model Context Protocol (MCP) tools are dynamically added:

```typescript
const mcpTools = mcpService.getMCPTools();
const allTools = [...builtinTools, ...mcpTools];
```

MCP tools follow the same execution flow but may have:
- External server execution
- Different parameter schemas
- Provider-specific handling

## Debugging Tool Calls

### Log Prefixes

- `[extractXMLToolsWrapper]` - XML detection and parsing
- `[XML Parser]` - Parameter extraction
- `[ChatThreadService]` - Execution flow
- `[toolsService]` - Validation and execution

### Common Issues

1. **Tool not detected**: Check if tool is in `availableTools` for current mode
2. **Parsing failed**: Look for XML syntax errors in LLM output
3. **Validation failed**: Check parameter types match schema
4. **Execution failed**: Check tool implementation and permissions


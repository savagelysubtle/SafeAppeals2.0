# XML Tool Parsing Research & Improvements

## Executive Summary

Void uses a **custom XML-based tool calling format** instead of native provider tool APIs. Current issues identified:

1. **Parsing can fail when XML tags are incomplete** (streaming edge cases)
2. **No error recovery** for malformed XML
3. **Hard limit of 10 parameter iterations** (line 212 in extractGrammar.ts)
4. **Partial tool calls** are passed through even when incomplete
5. **No validation** of required vs optional parameters

---

## Current Implementation Analysis

### Architecture (`extractGrammar.ts`)

**Key Functions:**

- `extractXMLToolsWrapper()` - Main wrapper that intercepts LLM streaming
- `parseXMLPrefixToToolCall()` - Parses XML into tool call objects
- `SurroundingsRemover` - Helper for sequential string processing

**Parsing Flow:**

```
LLM Stream → extractXMLToolsWrapper
    → Detect <tool_name> tags
    → parseXMLPrefixToToolCall
    → Extract parameters
    → Return RawToolCallObj
```

### Identified Issues

#### 1. **Hard Iteration Limit (Line 212)**

```typescript
while (true) {
    n += 1
    if (n > 10) return getAnswer() // ❌ Stops after 10 params
```

**Problem:** Tools with >10 parameters will silently fail.

#### 2. **No Error Handling for Malformed XML**

```typescript
const removed = pm.removeFromStartUntilFullMatch(`<${paramName}>`, true);
if (removed) {
	matchedOpenParam = paramName;
	break;
}
```

**Problem:** Doesn't handle:

- Mismatched tags (`<uri>value</url>`)
- Nested XML (e.g., JSON/XML in parameters)
- Special characters in parameter values

#### 3. **Incomplete Tool Call Execution**

```typescript
console.log('[extractXMLToolsWrapper] onFinalMessage - latestToolCall:', toolCall ? {
    name: toolCall.name,
    isDone: toolCall.isDone, // ⚠️ Can be false
```

**Problem:** Tool calls with `isDone: false` are still passed to executor.

#### 4. **No Parameter Validation**

```typescript
const allowedParams = Object.keys(toolOfToolName[toolName]?.params ?? {});
```

**Problem:** Doesn't check if required parameters are present.

---

## Best Practices from Anthropic (Context7 Research)

### ✅ Use Native Tool Calling API Instead of XML

**From Anthropic Docs:**

```json
{
	"tools": [
		{
			"name": "get_weather",
			"description": "Gets current weather",
			"input_schema": {
				"type": "object",
				"properties": {
					"location": { "type": "string" }
				},
				"required": ["location"]
			}
		}
	]
}
```

**Benefits:**

- Built-in validation
- Automatic parameter type checking
- Better error messages from provider
- No custom parsing logic needed

### ✅ Error Handling Patterns

**Proper Tool Result Format:**

```json
{
	"role": "user",
	"content": [
		{
			"type": "tool_result",
			"tool_use_id": "toolu_01A09q90qw90lq917835lq9",
			"content": "Error: Required 'location' parameter missing",
			"is_error": true
		}
	]
}
```

### ✅ Streaming Tool Use Handling

**From Anthropic Cookbook:**

```python
accumulated_json = ""
for delta_event in deltas:
    if delta_event['type'] == 'content_block_delta':
        accumulated_json += delta_event['delta'].get('partial_json', '')
    elif delta_event['type'] == 'content_block_stop':
        try:
            tool_use_data = json.loads(accumulated_json)
        except json.JSONDecodeError:
            print(f"Failed to decode JSON: {accumulated_json}")
```

**Key Insight:** Use JSON accumulation with try/catch, not XML string matching.

### ✅ Parallel Tool Calls

**Anthropic Best Practice:**

```typescript
// ✅ CORRECT - Single message with multiple tool results
{
  "role": "user",
  "content": [
    { "type": "tool_result", "tool_use_id": "toolu_01", "content": "Result 1" },
    { "type": "tool_result", "tool_use_id": "toolu_02", "content": "Result 2" }
  ]
}

// ❌ WRONG - Separate messages reduce parallelism
[
  { "role": "user", "content": [{ "type": "tool_result", "tool_use_id": "toolu_01", ... }] },
  { "role": "user", "content": [{ "type": "tool_result", "tool_use_id": "toolu_02", ... }] }
]
```

---

## Recommended Improvements

### 1. **Use Lenient XML Parser Library**

Instead of custom string matching, use a robust parser:

**Option A: `partial-xml-stream-parser`** (Context7 Result)

```bash
npm install partial-xml-stream-parser
```

- Handles incomplete/malformed XML
- Designed for LLM streaming
- TypeScript support

**Option B: `fast-xml-parser`**

```bash
npm install fast-xml-parser
```

- Very fast, battle-tested
- Better error messages
- Configurable validation

### 2. **Add Parameter Validation Layer**

```typescript
interface ToolSchema {
	name: string;
	params: {
		[key: string]: {
			description: string;
			required?: boolean;
			type?: "string" | "number" | "boolean" | "object";
		};
	};
}

function validateToolCall(
	toolCall: RawToolCallObj,
	schema: ToolSchema
): { valid: boolean; errors: string[] } {
	const errors: string[] = [];

	// Check required params
	for (const [paramName, paramDef] of Object.entries(schema.params)) {
		if (paramDef.required && !(paramName in toolCall.rawParams)) {
			errors.push(`Missing required parameter: ${paramName}`);
		}
	}

	// Check unknown params
	for (const paramName of Object.keys(toolCall.rawParams)) {
		if (!(paramName in schema.params)) {
			errors.push(`Unknown parameter: ${paramName}`);
		}
	}

	return { valid: errors.length === 0, errors };
}
```

### 3. **Add Error Recovery**

```typescript
function parseXMLWithRecovery(
	xml: string,
	toolName: string
): { toolCall: RawToolCallObj; warnings: string[] } {
	const warnings: string[] = [];

	try {
		// Primary: Try fast-xml-parser
		return parseFastXML(xml, toolName);
	} catch (e1) {
		warnings.push(`Fast parse failed: ${e1.message}`);

		try {
			// Fallback 1: Try partial-xml-stream-parser
			return parsePartialXML(xml, toolName);
		} catch (e2) {
			warnings.push(`Partial parse failed: ${e2.message}`);

			// Fallback 2: Regex extraction
			return parseRegexFallback(xml, toolName);
		}
	}
}
```

### 4. **Remove Hard Limits**

```typescript
// ❌ REMOVE THIS
while (true) {
	n += 1;
	if (n > 10) return getAnswer();
	// ...
}

// ✅ REPLACE WITH
const MAX_PARAMS = 100; // Much higher limit
while (n < MAX_PARAMS) {
	n += 1;
	// ... same logic
	if (allParamsParsed) break;
}
if (n >= MAX_PARAMS) {
	console.warn(
		`[XML Parser] Tool ${toolName} exceeded ${MAX_PARAMS} parameters`
	);
}
```

### 5. **Improve Logging & Debugging**

```typescript
function logToolParseAttempt(
	toolName: string,
	xmlInput: string,
	result: RawToolCallObj | null
) {
	console.log(`[XMLParser] Tool: ${toolName}`);
	console.log(`[XMLParser] Input length: ${xmlInput.length}`);
	console.log(
		`[XMLParser] Found params: ${Object.keys(result?.rawParams ?? {}).join(
			", "
		)}`
	);
	console.log(`[XMLParser] Is complete: ${result?.isDone}`);

	if (!result?.isDone) {
		console.warn(`[XMLParser] ⚠️ Incomplete tool call for ${toolName}`);
		console.warn(`[XMLParser] Raw XML:`, xmlInput.substring(0, 500));
	}
}
```

### 6. **Add Retry Logic**

```typescript
async function executeToolWithRetry(
	toolCall: RawToolCallObj,
	maxRetries: number = 3
): Promise<ToolResult> {
	let lastError: Error | null = null;

	for (let attempt = 1; attempt <= maxRetries; attempt++) {
		try {
			// Validate before execution
			const validation = validateToolCall(
				toolCall,
				getToolSchema(toolCall.name)
			);
			if (!validation.valid) {
				throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
			}

			return await executeTool(toolCall);
		} catch (error) {
			lastError = error;
			console.warn(
				`[Tool Execution] Attempt ${attempt}/${maxRetries} failed:`,
				error.message
			);

			if (attempt < maxRetries) {
				await new Promise((resolve) => setTimeout(resolve, 1000 * attempt)); // Exponential backoff
			}
		}
	}

	throw new Error(
		`Tool execution failed after ${maxRetries} attempts: ${lastError?.message}`
	);
}
```

---

## Migration Path: XML → Native Tool Calling

### Why Migrate?

**Current XML approach:**

- ❌ Custom parsing = bugs
- ❌ No provider-side validation
- ❌ Harder to debug
- ❌ Doesn't work with all providers

**Native tool calling:**

- ✅ Provider handles parsing
- ✅ Built-in validation
- ✅ Better error messages
- ✅ Streaming works reliably
- ✅ Parallel tool calls

### Implementation Strategy

**Phase 1: Add Native Support (Parallel to XML)**

```typescript
// In sendLLMMessage.impl.ts
const useNativeTools = overridesOfModel?.useNativeToolCalling ?? false

if (useNativeTools && providerSupportsNativeTools(providerName)) {
  // Use provider's native tool API
  return sendWithNativeTools(...)
} else {
  // Fall back to XML
  return sendWithXMLTools(...)
}
```

**Phase 2: Test & Validate**

- Run both systems in parallel
- Compare results
- Monitor error rates

**Phase 3: Deprecate XML**

- Default to native for supported providers
- Keep XML for legacy/custom providers

---

## Testing Strategy

### Unit Tests Needed

```typescript
describe("XML Tool Parser", () => {
	test("should parse complete tool call", () => {
		const xml = "<read_file><uri>test.ts</uri></read_file>";
		const result = parseXMLPrefixToToolCall(
			"read_file",
			"id1",
			xml,
			toolSchemas
		);
		expect(result.isDone).toBe(true);
		expect(result.rawParams.uri).toBe("test.ts");
	});

	test("should handle incomplete tool call", () => {
		const xml = "<read_file><uri>test.ts";
		const result = parseXMLPrefixToToolCall(
			"read_file",
			"id1",
			xml,
			toolSchemas
		);
		expect(result.isDone).toBe(false);
	});

	test("should handle malformed XML", () => {
		const xml = "<read_file><uri>test.ts</url></read_file>"; // Mismatched tag
		const result = parseXMLPrefixToToolCall(
			"read_file",
			"id1",
			xml,
			toolSchemas
		);
		// Should not throw, should attempt recovery
		expect(result).toBeDefined();
	});

	test("should handle tools with >10 parameters", () => {
		const params = Array.from(
			{ length: 15 },
			(_, i) => `<param${i}>value${i}</param${i}>`
		).join("");
		const xml = `<multi_param_tool>${params}</multi_param_tool>`;
		const result = parseXMLPrefixToToolCall(
			"multi_param_tool",
			"id1",
			xml,
			toolSchemas
		);
		expect(Object.keys(result.rawParams).length).toBe(15); // Should get all 15
	});
});
```

### Integration Tests

```typescript
describe("Tool Execution E2E", () => {
	test("should execute tool from streaming response", async () => {
		const mockStream = createMockLLMStream([
			"Let me read that file for you.\n",
			"<read_file>",
			"<uri>",
			"test.ts",
			"</uri>",
			"</read_file>",
		]);

		const result = await processStreamWithToolExtraction(mockStream);
		expect(result.toolCalls).toHaveLength(1);
		expect(result.toolCalls[0].name).toBe("read_file");
		expect(result.toolCalls[0].isDone).toBe(true);
	});
});
```

---

## Quick Wins (Immediate Fixes)

### 1. **Remove 10-param limit** (5 minutes)

```typescript
// Line 212 in extractGrammar.ts
- if (n > 10) return getAnswer()
+ if (n > 100) { // Much higher safety limit
+   console.warn(`[XML Parser] Tool ${toolName} exceeded 100 params - possible infinite loop`)
+   return getAnswer()
+ }
```

### 2. **Validate tool completeness** (10 minutes)

```typescript
// Line 404 in extractGrammar.ts
- onFinalMessage({ ...params, fullText, toolCall: toolCall })
+ // Only pass complete tool calls
+ const validToolCall = toolCall?.isDone ? toolCall : undefined
+ if (toolCall && !toolCall.isDone) {
+   console.warn(`[XML Parser] Dropping incomplete tool call: ${toolCall.name}`)
+ }
+ onFinalMessage({ ...params, fullText, toolCall: validToolCall })
```

### 3. **Add parameter count logging** (5 minutes)

```typescript
// After line 375
+ const paramCount = Object.keys(latestToolCall.rawParams).length
+ if (paramCount === 0) {
+   console.warn(`[XML Parser] Tool ${latestToolCall.name} has 0 parameters - possible parsing failure`)
+ }
```

---

## Performance Optimization

### Current Bottlenecks

1. **String operations in hot path** (line 304-363)

   - Every character triggers `findPartiallyWrittenToolTagAtEnd()`
   - Multiple `indexOf()` calls per chunk

2. **No caching** of tool schemas
   - `toolOfToolName` rebuilt every call

### Optimizations

```typescript
// 1. Cache compiled regex patterns
const toolTagPatterns = new Map<string, RegExp>();
function getToolTagPattern(toolName: string): RegExp {
	if (!toolTagPatterns.has(toolName)) {
		toolTagPatterns.set(toolName, new RegExp(`<${toolName}>`, "g"));
	}
	return toolTagPatterns.get(toolName)!;
}

// 2. Use Set for O(1) lookups
const toolTagSet = new Set(toolOpenTags);

// 3. Batch string operations
const BUFFER_SIZE = 1024;
let charBuffer: string[] = [];

function flushBuffer() {
	if (charBuffer.length >= BUFFER_SIZE) {
		fullText += charBuffer.join("");
		charBuffer = [];
	}
}
```

---

## References & Resources

### Anthropic Documentation

- [Tool Use Guide](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use)
- [Error Handling Best Practices](https://docs.anthropic.com/en/api/errors)
- [Streaming with Tools](https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/fine-grained-tool-streaming)

### Alternative Approaches

- [LangChain XML Agent](https://python.langchain.com/docs/modules/agents/agent_types/xml_agent)
- [Anthropic Cookbook - Tool Evaluation](https://github.com/anthropics/anthropic-cookbook/blob/main/tool_evaluation/tool_evaluation.ipynb)
- [Partial XML Stream Parser](https://www.npmjs.com/package/partial-xml-stream-parser)

### Related Issues

- Anthropic SDK: [Handling malformed tool responses](https://github.com/anthropics/anthropic-sdk-typescript/issues)
- VSCode: [XML parsing in extensions](https://code.visualstudio.com/api/references/vscode-api)

---

## Next Steps

1. ✅ **Immediate**: Apply Quick Wins (remove limits, add validation)
2. 🔄 **Short-term**: Add robust XML parser library
3. 🎯 **Medium-term**: Implement native tool calling for Anthropic/OpenAI
4. 🚀 **Long-term**: Deprecate XML for providers that support native tools

---

**Last Updated:** October 30, 2025
**Author:** Research by Claude Sonnet 4.5

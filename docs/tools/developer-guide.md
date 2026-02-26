# Developer Guide: Extending the Tools System

Guide for developers extending the Void tools system with new built-in tools.

## Architecture Overview

### Actual Directory Structure

```
common/tools/
├── index.ts              # Re-exports from toolsServiceTypes.ts
├── toolsServiceTypes.ts  # Type definitions (BuiltinToolCallParams, BuiltinToolResultType, approval mapping)
└── README.md

common/prompt/
├── prompts.ts            # builtinTools definitions with descriptions + EDIT_DOCUMENT_DESCRIPTION
└── systemPrompt.ts       # System prompt assembly

browser/tools/
└── toolsService.ts      # Runtime tool execution + inline parameter validation

electron-main/llmMessage/
└── xmlParserService.ts  # XML/ANTML parsing for tool calls
```

### Extension Points

1. **Tool Definition**: Add params and result types in `toolsServiceTypes.ts`
2. **Approval Classification**: Update `approvalTypeOfBuiltinToolName` if the tool requires approval
3. **Tool Description**: Add to `builtinTools` in `prompts.ts`
4. **Parameter Validation**: Add validator in `validateBuiltinParams` in `toolsService.ts`
5. **Execution Handler**: Add handler in `callBuiltinTool` in `toolsService.ts`
6. **Result Formatting**: Add formatter in `builtinToolResultToString` in `toolsService.ts`
7. **System Prompt**: Update `systemPrompt.ts` if the tool needs special guidance

## Adding a New Built-in Tool

### Step 1: Define Tool Parameters and Results

Add your tool to the type definitions in `toolsServiceTypes.ts`:

```typescript
// Add to BuiltinToolCallParams
'my_custom_tool': {
  uri: URI;
  options?: { timeout?: number };
};

// Add to BuiltinToolResultType
'my_custom_tool': {
  success: boolean;
  result: string;
};
```

### Step 2: Add Approval Classification (if needed)

If the tool modifies files or runs commands, add it to the approval mapping in `toolsServiceTypes.ts`:

```typescript
export const approvalTypeOfBuiltinToolName: Partial<{ ... }> = {
  // ... existing mappings
  'my_custom_tool': 'edits',  // Requires edit approval
};
```

Read-only tools (e.g., RAG search) do not need an entry; they proceed without approval.

### Step 3: Add Tool Definition to builtinTools

Add the tool definition in `prompts.ts`:

```typescript
// In builtinTools object
my_custom_tool: {
  name: 'my_custom_tool',
  description: 'Process files for custom operations',
  params: {
    uri: {
      type: 'uri',
      description: 'Path to the file to process',
      required: true,
    },
    options: {
      type: 'object',
      description: 'Optional configuration',
      required: false,
    },
  },
},
```

### Step 4: Add Parameter Validation in toolsService.ts

Add a validator to the `validateBuiltinParams` map. Use the existing helpers: `validateStr`, `validateURI`, `validateNumber`, `validateBoolean`, etc.

```typescript
my_custom_tool: (params: RawToolParamsObj) => {
  const { uri: uriStr, options: optionsUnknown } = params;
  const uri = validateURI(uriStr);
  const options = optionsUnknown ? { timeout: validateNumber((optionsUnknown as any).timeout, { default: 5000 }) } : undefined;
  return { uri, options };
},
```

### Step 5: Implement Execution Handler in toolsService.ts

Add a handler to the `callBuiltinTool` map:

```typescript
my_custom_tool: async ({ uri, options }) => {
  // Implementation using injected services (IFileService, etc.)
  const result = await doCustomProcessing(uri, options);
  return { result: { success: true, result } };
},
```

### Step 6: Add Result Formatter (optional)

If the tool returns structured data that should be formatted for the LLM, add to `builtinToolResultToString`:

```typescript
my_custom_tool: (_params, result) => {
  return result.success ? result.result : `Error: ${result.error}`;
},
```

### Step 7: Update System Prompt (if needed)

If the tool needs special guidance (e.g., when to use it, examples), update `systemPrompt.ts` in the appropriate section.

## Parameter Validation Helpers

`toolsService.ts` provides these validation helpers for use in `validateBuiltinParams`:

- `validateStr(argName, value)` - Required string
- `validateOptionalStr(argName, value)` - Optional string
- `validateURI(uriStr)` - Required URI (file path or full URI)
- `validateOptionalURI(uriStr)` - Optional URI
- `validateNumber(value, { default })` - Number with default
- `validateBoolean(value, { default })` - Boolean with default
- `validatePageNum(value)` - Page number (>= 1)
- `validateEventCategory(value)` - EventCategory enum (for timeline tools)

Validation functions throw descriptive errors for invalid LLM output.

## XML Parsing

Tool calls are extracted from LLM responses by `xmlParserService.ts` in `electron-main/llmMessage/`. It parses XML/ANTML format (e.g., `<invoke name="tool_name">` with `<parameter>` children). The parser is not in the tools directory; it lives in the LLM message pipeline.

## Testing

Add unit tests for new tools in `src/vs/workbench/contrib/void/test/`. Test the validation logic by passing raw params and asserting the validated output or thrown errors. Test execution by mocking the required services (IFileService, IRAGService, etc.).

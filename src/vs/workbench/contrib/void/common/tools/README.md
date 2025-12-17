# Tools System Module

A comprehensive TypeScript module for AI tool calling, XML parsing, schema validation, and tool execution in the Void VSCode extension.

## Overview

This module enables AI agents to interact with the development environment through structured tool calls. It provides:

- **Tool Call Parsing**: Extracting tool calls from LLM responses using XML and native APIs
- **Schema Validation**: Runtime validation of tool parameters with comprehensive error reporting
- **Tool Execution**: Safe execution of tools with approval workflows and error handling
- **Approval System**: Categorizing tools by risk level (edits, terminal, MCP, RAG)

## Quick Usage

```typescript
import {
	BuiltinToolCallParams,
	BuiltinToolResultType,
	ToolSchemaValidator,
} from "./tools/index.js";

// Create a schema validator
const validator = new ToolSchemaValidator();

// Validate tool parameters
const result = validator.validateToolCall("read_file", {
	uri: "file:///path/to/file.txt",
	startLine: 1,
	endLine: 10,
});

if (result.success) {
	// Execute the tool
	const toolResult = await executeTool(result.data);
}
```

## Structure

```
tools/
├── index.ts              # Main exports and type re-exports
├── toolsServiceTypes.ts  # Tool definitions, parameters, and results
├── toolSchemaValidator.ts # Schema validation and error handling
└── README.md             # This file
```

## Key Components

- **`ToolSchemaValidator`**: Validates tool parameters against schemas
- **`BuiltinToolCallParams`**: Type-safe parameters for all built-in tools
- **`BuiltinToolResultType`**: Result types for tool execution
- **`ToolApprovalType`**: Approval categories for tool security

## Tool Categories

### File System Tools
- **Read operations**: `read_file`, `ls_dir`, `get_dir_tree`, `search_*`
- **Write operations**: `edit_file`, `rewrite_file`, `create_file_or_folder`, `delete_file_or_folder`
- **Document editing**: `edit_document` for rich text document manipulation

### Terminal Tools
- **Command execution**: `run_command` for one-off commands
- **Persistent terminals**: `open_persistent_terminal`, `run_persistent_command`, `kill_persistent_terminal`

### Information Retrieval Tools
- **RAG system**: `rag_index_document`, `rag_search_policy`, `rag_search_workspace`, `rag_get_stats`
- **Web search**: `web_search`, `multi_link_search` for internet research

### External Integrations
- **MCP tools**: Model Context Protocol for third-party tool integrations

## Documentation

For comprehensive documentation including:

- Complete API reference and tool definitions
- Schema validation system and custom validators
- XML parsing system and error recovery
- Tool execution workflows and approval systems
- Usage examples and integration patterns
- Developer guides for extending the system

See: [`docs/tools/`](../../../../../docs/tools/)

## Contributing

When adding new tools or modifying the system:

1. Add tool definitions to `toolsServiceTypes.ts`
2. Create validation schemas in `toolSchemaValidator.ts`
3. Update approval categories as needed
4. Add comprehensive tests and documentation

See the [Developer Guide](../../../../../docs/tools/developer-guide.md) for detailed instructions.

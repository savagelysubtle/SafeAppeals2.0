# Tools System Documentation

Comprehensive documentation for the Void VSCode extension's tool calling system, including XML parsing, schema validation, and tool execution frameworks.

## Overview

The Tools System enables AI agents to interact with the development environment through structured tool calls. It provides a robust framework for:

- **Tool Call Parsing**: Extracting tool calls from LLM streaming responses using XML and native APIs
- **Schema Validation**: Runtime validation of tool parameters with comprehensive error reporting
- **Tool Execution**: Safe execution of tools with approval workflows and error handling
- **Approval System**: Categorizing tools by risk level (edits, terminal, MCP, RAG)

## Architecture

### Core Components

```
tools/
├── index.ts              # Main exports and type re-exports
├── toolsServiceTypes.ts  # Tool definitions, parameters, and results
├── toolSchemaValidator.ts # Schema validation and error handling
└── xml-parsing/          # XML parsing system documentation
```

### Tool Categories

#### File System Tools

- **Read operations**: `read_file`, `ls_dir`, `get_dir_tree`, `search_*`
- **Write operations**: `edit_file`, `rewrite_file`, `create_file_or_folder`, `delete_file_or_folder`
- **Document editing**: `edit_document` for rich text document manipulation

#### Terminal Tools

- **Command execution**: `run_command` for one-off commands
- **Persistent terminals**: `open_persistent_terminal`, `run_persistent_command`, `kill_persistent_terminal`

#### Information Retrieval Tools

- **RAG system**: `rag_index_document`, `rag_search_policy`, `rag_search_workspace`, `rag_get_stats`
- **Web search**: `web_search`, `multi_link_search` for internet research

#### External Integrations

- **MCP tools**: Model Context Protocol for third-party tool integrations

## Quick Start

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

## Tool Approval System

Tools are categorized by approval requirements:

```typescript
const approvalTypeOfBuiltinToolName = {
	create_file_or_folder: "edits", // Requires edit approval
	run_command: "terminal", // Requires terminal approval
	rag_search_policy: undefined, // No approval needed (read-only)
} as const;
```

**Approval Categories:**

- **`edits`**: File system modifications
- **`terminal`**: Command execution and terminal management
- **`MCP tools`**: Third-party integrations
- **`RAG tools`**: Information retrieval (typically no approval needed)

## XML Parsing System

The system uses a multi-level XML parsing approach for robust tool call extraction:

### Parser Hierarchy

1. **Custom Parser**: Fast parsing for well-formed XML
2. **Streaming Parser**: Handles incomplete/malformed XML from streaming responses
3. **Regex Fallback**: Last resort extraction for severely malformed content
4. **Failure Reporting**: Detailed error analysis and reporting

### Key Features

- **Streaming support**: Processes partial XML as it arrives
- **Error recovery**: Continues parsing despite malformed sections
- **Performance metrics**: Tracks parsing success rates and performance
- **Structured logging**: Comprehensive error reporting and debugging

## Schema Validation

### Validation Features

- **Type checking**: Validates parameter types (string, number, boolean, URI)
- **Constraint validation**: Min/max values, regex patterns, custom validators
- **Required field checking**: Ensures mandatory parameters are present
- **Error aggregation**: Collects all validation errors (non-failing fast)

### Performance Optimizations

- **Compiled validators**: Pre-compiled validation functions (75x faster)
- **Caching**: Validator instances cached per tool type
- **Metrics collection**: Performance monitoring and error tracking

## Documentation

- [Tool Types Reference](./tool-types-reference.md) - Complete tool definitions and parameters
- [Schema Validation Guide](./schema-validation-guide.md) - Validation system usage and extension
- [XML Parsing System](./xml-parsing-system.md) - Comprehensive XML parsing documentation
- [Usage Examples](./examples.md) - Practical integration examples
- [Developer Guide](./developer-guide.md) - Extending the tools system
- [Migration Guide](./migration-guide.md) - Tool system evolution and migration

### XML Parsing Research

- [Parser Improvements Summary](./xml-parsing-research/parser-improvements-summary.md)
- [Comprehensive Research](./xml-parsing-research/comprehensive-research.md)
- [Deep Research Findings](./xml-parsing-research/deep-research-findings.md)
- [Current Implementation Analysis](./xml-parsing-research/current-analysis.md)

## Tool Lifecycle

### 1. Tool Call Generation

LLM generates tool calls in XML format:

```xml
<tool_call name="read_file">
  <parameter name="uri">file:///path/to/file.txt
```

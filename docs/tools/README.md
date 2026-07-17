# Tools System Documentation

Documentation for the Void VSCode extension's tool calling system, including tool definitions, execution, and approval workflows.

## Overview

The Tools System enables AI agents to interact with the development environment through structured tool calls. It provides:

- **Tool Call Parsing**: Extracting tool calls from LLM streaming responses using ANTML format
- **Tool Execution**: Safe execution of tools with approval workflows and error handling
- **Approval System**: Categorizing tools by risk level (edits, terminal, MCP)

## Architecture

```text
common/tools/
├── index.ts              # Main exports and type re-exports
├── toolsServiceTypes.ts  # Tool definitions, parameters, and results
└── README.md

common/prompt/
├── prompts.ts            # Tool definitions (builtinTools) and descriptions
└── systemPrompt.ts       # System prompt construction

browser/tools/
└── toolsService.ts       # Tool execution and parameter validation
```

Parameter validation is handled inline in `toolsService.ts` via per-operation switch cases. There is no separate schema validation class.

## Tool Categories

### File System (Read)

`read_file`, `ls_dir`, `get_dir_tree`, `search_pathnames_only`, `search_for_files`, `search_in_file`, `read_lint_errors`

### File System (Write)

`edit_file`, `rewrite_file`, `create_file_or_folder`, `delete_file_or_folder`

### Document Editing

`edit_document` supports:

- **DOCX**: `insert_text`, `replace_text`, `format_text`, `insert_table`, `insert_page_break`, `set_margins`
- **XLSX cell**: `set_cell_value`, `set_cell_formula`, `format_cell`, `insert_row`, `insert_column`, `delete_row`, `delete_column`
- **XLSX table**: `create_table`, `rename_table`, `set_table_style`, `toggle_table_filter`, `set_totals_row`, `convert_table_to_range`
- **XLSX chart**: `insert_chart`, `delete_chart`

### Terminal

`run_command`, `open_persistent_terminal`, `run_persistent_command`, `kill_persistent_terminal`

### RAG

`rag_index_document`, `rag_search_reference`, `rag_search_workspace`, `rag_search_all`, `rag_get_stats`

### Web Search

`web_search`, `multi_link_search`

### Timeline

`timeline_add_event`, `timeline_update_event`, `timeline_delete_event`, `timeline_get_events`, `timeline_link_document`, `timeline_get_deadlines`

### External

MCP tools (Model Context Protocol)

## Tool Approval System

Tools are categorized by approval requirements:

- **`edits`**: `create_file_or_folder`, `delete_file_or_folder`, `rewrite_file`, `edit_file`, `edit_document`
- **`terminal`**: `run_command`, `run_persistent_command`, `open_persistent_terminal`, `kill_persistent_terminal`
- **`MCP tools`**: All MCP tools

No approval needed: read operations, RAG tools, web search, timeline tools.

## ANTML Format

Tool calls use the ANTML XML format:

```xml
<function_calls>
<invoke name="read_file">
<parameter name="uri">file:///path/to/file.txt</parameter>
</invoke>
</function_calls>
```

## Quick Start

```typescript
import {
  BuiltinToolCallParams,
  BuiltinToolResultType,
  approvalTypeOfBuiltinToolName,
} from './tools/index.js';
```

## Documentation

- [Tool Types Reference](./tool-types-reference.md)
- [Tool Execution Guide](./tool-execution-guide.md)
- [API Reference](./api-reference.md)
- [Developer Guide](./developer-guide.md)
- [XML Parsing System](./xml-parsing-system.md)

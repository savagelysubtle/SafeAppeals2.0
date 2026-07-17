# Tools System Module

TypeScript module for AI tool types, parameter definitions, and result types in the Void VSCode extension.

## Overview

This module provides type definitions and exports for the tool calling system. It enables:

- **Type-safe parameters**: `BuiltinToolCallParams` for each built-in tool
- **Type-safe results**: `BuiltinToolResultType` for tool return values
- **Approval categories**: `approvalTypeOfBuiltinToolName` maps tools to approval types (edits, terminal, MCP, RAG)

## Structure

```
tools/
├── index.ts              # Main exports and type re-exports
├── toolsServiceTypes.ts  # Tool definitions, parameters, and results
└── README.md             # This file
```

## Exports (from index.ts)

From `toolsServiceTypes.ts`:

- `TerminalResolveReason`, `LintErrorItem`, `ShallowDirectoryItem`
- `approvalTypeOfBuiltinToolName`, `ToolApprovalType`, `toolApprovalTypes`
- `BuiltinToolCallParams`, `BuiltinToolResultType`, `ToolCallParams`, `ToolResult`
- `BuiltinToolName`, `BuiltinToolParamName`, `ToolName`, `ToolParamName`

## Quick Usage

```typescript
import {
  BuiltinToolCallParams,
  BuiltinToolResultType,
  approvalTypeOfBuiltinToolName,
} from './tools/index.js';

// Check if a tool requires approval
const approvalType = approvalTypeOfBuiltinToolName['edit_file']; // 'edits'

// Type-safe parameter access
type ReadFileParams = BuiltinToolCallParams['read_file'];
type ReadFileResult = BuiltinToolResultType['read_file'];
```

## Tool Categories

### File System (Read)
`read_file`, `ls_dir`, `get_dir_tree`, `search_pathnames_only`, `search_for_files`, `search_in_file`, `read_lint_errors`

### File System (Write)
`edit_file`, `rewrite_file`, `create_file_or_folder`, `delete_file_or_folder`

### Document Editing
`edit_document` (DOCX + XLSX with cell, table, and chart operations)

### Terminal
`run_command`, `open_persistent_terminal`, `run_persistent_command`, `kill_persistent_terminal`

### RAG
`rag_index_document`, `rag_search_reference`, `rag_search_workspace`, `rag_search_all`, `rag_get_stats`

### Web Search
`web_search`, `multi_link_search`

### Timeline
`timeline_add_event`, `timeline_update_event`, `timeline_delete_event`, `timeline_get_events`, `timeline_link_document`, `timeline_get_deadlines`

### External
MCP tools

## Documentation

See [`docs/tools/`](../../../../../../../docs/tools/) for API reference, validation guide, and developer documentation.

## Contributing

When adding new tools or modifying the system:

1. Add tool definitions to `toolsServiceTypes.ts` (params + result types)
2. Add tool description to `builtinTools` in `common/prompt/prompts.ts`
3. Add parameter validation in `browser/tools/toolsService.ts`
4. Update approval categories in `approvalTypeOfBuiltinToolName` as needed

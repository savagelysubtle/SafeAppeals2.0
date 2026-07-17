# Tools API Reference

Complete TypeScript API documentation for the Void tools system, including type definitions, interfaces, and function signatures.

## Core Types

### Tool Call Parameters

#### BuiltinToolCallParams

Type-safe parameter definitions for all built-in tools.

```typescript
export type BuiltinToolCallParams = {
  'read_file': { uri: URI, startLine: number | null, endLine: number | null, pageNumber: number },
  'ls_dir': { uri: URI, pageNumber: number },
  'get_dir_tree': { uri: URI },
  'search_pathnames_only': { query: string, includePattern: string | null, pageNumber: number },
  'search_for_files': { query: string, isRegex: boolean, searchInFolder: URI | null, pageNumber: number },
  'search_in_file': { uri: URI, query: string, isRegex: boolean },
  'read_lint_errors': { uri: URI },
  'rewrite_file': { uri: URI, newContent: string },
  'edit_file': { uri: URI, searchReplaceBlocks: string },
  'create_file_or_folder': { uri: URI, isFolder: boolean },
  'delete_file_or_folder': { uri: URI, isRecursive: boolean, isFolder: boolean },
  'edit_document': { uri: URI, operations: Array<{ type: string; [key: string]: any }> },
  'run_command': { command: string; cwd: string | null, terminalId: string },
  'open_persistent_terminal': { cwd: string | null },
  'run_persistent_command': { command: string; persistentTerminalId: string },
  'kill_persistent_terminal': { persistentTerminalId: string },
  'rag_index_document': { uri: URI, isCoreReference: boolean },
  'rag_search_reference': { query: string, limit: number },
  'rag_search_workspace': { query: string, limit: number },
  'rag_search_all': { query: string, limit: number },
  'rag_get_stats': {},
  'web_search': { query: string, count: number | null, offset: number | null },
  'multi_link_search': { queries: string[], count: number | null },
  'timeline_add_event': { date: string, title: string, description: string | null, category: EventCategory, isDeadline: boolean, linkedDocuments: string[] },
  'timeline_update_event': { eventId: string, date: string | null, title: string | null, description: string | null, category: EventCategory | null, isDeadline: boolean | null, isComplete: boolean | null },
  'timeline_delete_event': { eventId: string },
  'timeline_get_events': { category: EventCategory | null, startDate: string | null, endDate: string | null, isDeadline: boolean | null, limit: number },
  'timeline_link_document': { eventId: string, documentUri: URI },
  'timeline_get_deadlines': { daysAhead: number },
}
```

#### BuiltinToolResultType

Result type definitions for all built-in tools.

```typescript
export type BuiltinToolResultType = {
  'read_file': { fileContents: string, totalFileLen: number, totalNumLines: number, hasNextPage: boolean },
  'ls_dir': { children: ShallowDirectoryItem[] | null, hasNextPage: boolean, hasPrevPage: boolean, itemsRemaining: number },
  'get_dir_tree': { str: string },
  'search_pathnames_only': { uris: URI[], hasNextPage: boolean },
  'search_for_files': { uris: URI[], hasNextPage: boolean },
  'search_in_file': { lines: number[] },
  'read_lint_errors': { lintErrors: LintErrorItem[] | null },
  'rewrite_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
  'edit_file': Promise<{ lintErrors: LintErrorItem[] | null }>,
  'create_file_or_folder': {},
  'delete_file_or_folder': {},
  'edit_document': { success: boolean, error?: string, message?: string },
  'run_command': { result: string; resolveReason: TerminalResolveReason },
  'run_persistent_command': { result: string; resolveReason: TerminalResolveReason },
  'open_persistent_terminal': { persistentTerminalId: string },
  'kill_persistent_terminal': {},
  'rag_index_document': { success: boolean, message: string },
  'rag_search_reference': { contextPack: string },
  'rag_search_workspace': { contextPack: string },
  'rag_search_all': { contextPack: string },
  'rag_get_stats': { stats: string },
  'web_search': { results: WebSearchResult[], totalResults: number },
  'multi_link_search': { searchResults: MultiSearchResult[] },
  'timeline_add_event': { event: TimelineEvent },
  'timeline_update_event': { success: boolean },
  'timeline_delete_event': { success: boolean },
  'timeline_get_events': { events: TimelineEvent[], totalCount: number },
  'timeline_link_document': { success: boolean },
  'timeline_get_deadlines': { upcoming: TimelineEvent[], overdue: TimelineEvent[] },
}
```

### Tool Approval System

#### ToolApprovalType

Approval categories for tool security classification.

```typescript
export type ToolApprovalType = 'edits' | 'terminal' | 'MCP tools' | 'RAG tools';
```

#### approvalTypeOfBuiltinToolName

Mapping of tools to their approval requirements. Tools not listed require no approval (read-only).

```typescript
export const approvalTypeOfBuiltinToolName: Partial<{ [T in BuiltinToolName]?: 'edits' | 'terminal' | 'MCP tools' | 'RAG tools' }> = {
  'create_file_or_folder': 'edits',
  'delete_file_or_folder': 'edits',
  'rewrite_file': 'edits',
  'edit_file': 'edits',
  'edit_document': 'edits',
  'run_command': 'terminal',
  'run_persistent_command': 'terminal',
  'open_persistent_terminal': 'terminal',
  'kill_persistent_terminal': 'terminal',
  // RAG tools - commented out, no approval needed (read-only)
}
```

### Generic Tool Types

#### ToolCallParams

Generic tool parameter type that works with both built-in and MCP tools.

```typescript
export type ToolCallParams<T extends BuiltinToolName | (string & {})> =
  T extends BuiltinToolName
    ? BuiltinToolCallParams[T]
    : RawToolParamsObj; // For MCP tools
```

#### ToolResult

Generic tool result type that works with both built-in and MCP tools.

```typescript
export type ToolResult<T extends BuiltinToolName | (string & {})> =
  T extends BuiltinToolName
    ? BuiltinToolResultType[T]
    : RawMCPToolCall; // For MCP tools
```

## Supporting Types

### TerminalResolveReason

How a terminal command execution ended.

```typescript
export type TerminalResolveReason =
  | { type: 'timeout' }
  | { type: 'done', exitCode: number };
```

### LintErrorItem

Lint error information for file validation.

```typescript
export type LintErrorItem = {
  code: string;
  message: string;
  startLineNumber: number;
  endLineNumber: number;
};
```

### ShallowDirectoryItem

File system item information (partial IFileStat).

```typescript
export type ShallowDirectoryItem = {
  uri: URI;
  name: string;
  isDirectory: boolean;
  isSymbolicLink: boolean;
};
```

### Web Search Types

```typescript
export type WebSearchResult = {
  title: string;
  url: string;
  description: string;
  age?: string;
  published?: string;
};

export type MultiSearchResult = {
  query: string;
  results: WebSearchResult[];
  error?: string;
};
```

### Timeline Types

`EventCategory` and `TimelineEvent` are defined in `common/timeline/timelineTypes.ts`. See that file for full definitions.

## Tool Name Types

### BuiltinToolName

Union type of all built-in tool names.

```typescript
export type BuiltinToolName = keyof BuiltinToolResultType;
```

### ToolName

Generic tool name type (built-in or MCP).

```typescript
export type ToolName = BuiltinToolName | (string & {});
```

### ToolParamName

Generic parameter name type with tool-specific typing.

```typescript
export type ToolParamName<T extends ToolName> =
  T extends BuiltinToolName
    ? BuiltinToolParamNameOfTool<T>
    : string;
```

## Constants

### toolApprovalTypes

Set of all available tool approval types for runtime checks.

```typescript
export const toolApprovalTypes = new Set<ToolApprovalType>([
  'edits',
  'terminal',
  'MCP tools',
  'RAG tools',
]);
```

## edit_document Operations

The `edit_document` tool accepts an array of operations. Operation type and parameters depend on the document format (DOCX or XLSX).

### DOCX Operations

| Operation | Parameters |
|-----------|------------|
| `insert_text` | `position` (number), `text` (string) |
| `replace_text` | `search` (string), `replace` (string), `all?` (boolean) |
| `format_text` | `range` (`{ start, end }`), `format` (bold, italic, underline, fontSize, fontFamily, color) |
| `insert_table` | table definition |
| `insert_page_break` | — |
| `set_margins` | margin values |

### XLSX Cell Operations

| Operation | Parameters |
|-----------|------------|
| `set_cell_value` | `sheet`, `cell`, `value` |
| `set_cell_formula` | `sheet`, `cell`, `formula` |
| `format_cell` | `sheet`, `cell`, format options |
| `insert_row` | `sheet`, row index |
| `insert_column` | `sheet`, column index |
| `delete_row` | `sheet`, row index |
| `delete_column` | `sheet`, column index |

### XLSX Table Operations

| Operation | Parameters |
|-----------|------------|
| `create_table` | `sheet`, `range`, `tableName` |
| `rename_table` | `sheet`, table identifier, `name` |
| `set_table_style` | `sheet`, table identifier, style |
| `toggle_table_filter` | `sheet`, table identifier |
| `set_totals_row` | `sheet`, table identifier, totals config |
| `convert_table_to_range` | `sheet`, table identifier |

### XLSX Chart Operations

| Operation | Parameters |
|-----------|------------|
| `insert_chart` | `sheet`, `chart_type`, `data_range`, `title?`, `position?` |
| `delete_chart` | `sheet`, `chart_index` |

**Chart types:** `column`, `bar`, `line`, `pie`, `scatter`, `area`, `doughnut`, `radar`

**Example:**
```json
[
  {"type": "set_cell_value", "sheet": 0, "cell": "A1", "value": "Month"},
  {"type": "set_cell_value", "sheet": 0, "cell": "B1", "value": "Sales"},
  {"type": "insert_chart", "sheet": 0, "chart_type": "column", "data_range": "A1:B3", "title": "Monthly Sales", "position": "D2"}
]
```

---

This API reference provides the complete type system for the Void tools framework, enabling type-safe tool calling and execution across the AI agent system.

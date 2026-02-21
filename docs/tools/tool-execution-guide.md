# Tool Execution and Approval System Guide

Guide to tool execution workflows, approval mechanisms, and security considerations in the Void tools system.

## Overview

The tool execution system provides controlled access to development environment operations through a structured approval workflow:

- **Approval Classification**: Tools categorized by risk level (edits, terminal, MCP, RAG)
- **Execution Pipeline**: Extraction → Validation → Approval → Execution → Result processing
- **Security Controls**: Parameter validation, working directory checks, timeout handling

## Approval System Architecture

### Tool Approval Types

Tools are classified by their potential impact and required approval level:

```typescript
export type ToolApprovalType = 'edits' | 'terminal' | 'MCP tools' | 'RAG tools';
```

#### Edit Operations (`edits`)

**Risk Level**: High - Modifies project files and structure

**Included Tools:**
- `create_file_or_folder` - File system creation
- `delete_file_or_folder` - File system deletion
- `rewrite_file` - Complete file replacement
- `edit_file` - Search/replace operations
- `edit_document` - Rich document editing

**Approval Requirements:**
- Explicit user consent required
- Preview changes before execution
- Confirmation of destructive operations

#### Terminal Operations (`terminal`)

**Risk Level**: Critical - Executes system commands

**Included Tools:**
- `run_command` - One-off command execution
- `run_persistent_command` - Commands in persistent terminals
- `open_persistent_terminal` - Terminal session management
- `kill_persistent_terminal` - Terminal termination

**Approval Requirements:**
- Command preview and validation
- Working directory verification
- Timeout and resource limits

#### MCP Tools (`MCP tools`)

**Risk Level**: Variable - Third-party integrations

**Included Tools:**
- All Model Context Protocol tools
- External service integrations
- Plugin-provided tools

**Approval Requirements:**
- Per-tool approval based on MCP server trust level
- Scope limitation and permission validation

#### RAG Tools (`RAG tools`)

**Risk Level**: Low - Read-only information retrieval

**Included Tools:**
- `rag_index_document` - Document indexing
- `rag_search_reference` - Reference document search (policy manuals, regulations)
- `rag_search_workspace` - Case document search (case files)
- `rag_search_all` - Combined search (both reference + case documents)
- `rag_get_stats` - Statistics retrieval

**Approval Requirements:**
- Currently no approval needed (read-only)
- Per-workspace isolation ensures data security

### Approval Mapping

Defined in `toolsServiceTypes.ts`:

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
  // RAG tools removed from approval requirement - they are read-only
  // 'rag_index_document': 'RAG tools',
  // 'rag_search_reference': 'RAG tools',
  // 'rag_search_workspace': 'RAG tools',
  // 'rag_search_all': 'RAG tools',
  // 'rag_get_stats': 'RAG tools',
}
```

## Execution Pipeline

### Phase 1: Tool Call Extraction

**Process:**
1. Parse LLM response for tool calls using XML/ANTML parsing (`electron-main/llmMessage/xmlParserService.ts`)
2. Extract tool name and parameters
3. Validate basic syntax and structure

**Error Handling:**
- Malformed XML recovery
- Incomplete tool call detection
- Parameter extraction validation

### Phase 2: Parameter Validation

**Process:**
Validation is handled inline in `toolsService.ts` using per-operation switch cases. Each built-in tool has a dedicated validator in the `validateBuiltinParams` map that:

1. Extracts and coerces parameters from raw LLM output
2. Validates types (string, number, URI, boolean, etc.)
3. Applies tool-specific constraints (e.g., EventCategory enum, operation types for edit_document)
4. Throws descriptive errors for invalid output

**Example pattern:**
```typescript
rag_search_reference: (params: RawToolParamsObj) => {
  const { query: queryUnknown, limit: limitUnknown } = params;
  const query = validateStr('query', queryUnknown);
  const limit = validateNumber(limitUnknown, { default: 8 }) || 8;
  return { query, limit };
},
```

There is no separate `ToolSchemaValidator` class; validation logic lives directly in `toolsService.ts`.

### Phase 3: Approval Check

**Process:**
1. Determine tool approval type from `approvalTypeOfBuiltinToolName`
2. Check user permissions and settings
3. Present approval dialog if required (edits, terminal, MCP)
4. Wait for user confirmation

Tools not in the mapping or with RAG tools commented out proceed without approval (read-only).

### Phase 4: Tool Execution

**Process:**
1. Execute tool with validated parameters via `callBuiltinTool` map in `toolsService.ts`
2. Each tool has a dedicated async handler
3. Terminal commands use `timeout()` and `MAX_TERMINAL_*` limits from prompts

**Security Controls:**
- Working directory restrictions (validated per tool)
- Parameter sanitization in validators (e.g., `validateURI`, `validateStr`)
- Timeout limits for long-running operations

### Phase 5: Result Processing

**Process:**
1. Tool returns typed result per `BuiltinToolResultType`
2. `builtinToolResultToString` map formats results for LLM consumption
3. Errors propagate to the chat UI

## Security Notes

- **URIs**: Validated via `validateURI` / `validateOptionalURI`; supports file paths and remote URIs (vscode-remote, file://)
- **Terminal commands**: Validated for required fields; execution runs in user's workspace context
- **Edit operations**: File existence and writability checked before modifications
- **RAG tools**: Read-only; no approval required

## Tool-Specific Execution Details

### File Operations

Edit tools (`edit_file`, `rewrite_file`, `edit_document`, etc.) validate URIs, apply changes through VSCode's file service, and return lint errors when applicable.

### Terminal Operations

`run_command` and `run_persistent_command` use `ITerminalToolService` with configurable timeouts. Commands execute in the specified working directory (or workspace root).

### RAG Operations

`rag_search_reference` searches core references (policy manuals, regulations). `rag_search_workspace` searches case documents. `rag_search_all` searches both. All return a `contextPack` string for LLM consumption.

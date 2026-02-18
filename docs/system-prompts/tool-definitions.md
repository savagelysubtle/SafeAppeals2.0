# Built-in Tool Definitions

**Source**: `src/vs/workbench/contrib/void/common/prompt/prompts.ts` — `builtinTools` object  
**Type**: `satisfies { [T in keyof BuiltinToolResultType]: InternalToolInfo }`

All built-in tools are defined in the `builtinTools` constant. This file documents each tool's description, parameters, availability by chat mode, and usage guidance as injected into the LLM system prompt.

## Table of Contents

1. [Tool Availability by Mode](#tool-availability-by-mode)
2. [Tool Format in Prompts](#tool-format-in-prompts)
3. [Context & Search Tools](#context--search-tools)
4. [File Operation Tools](#file-operation-tools)
5. [Terminal Tools](#terminal-tools)
6. [RAG (Retrieval Augmented Generation) Tools](#rag-retrieval-augmented-generation-tools)
7. [Web Search Tools](#web-search-tools)
8. [Timeline Tools](#timeline-tools)
9. [MCP Tool Integration](#mcp-tool-integration)
10. [Utility Functions](#utility-functions)

---

## Tool Availability by Mode

The `availableTools(chatMode, mcpTools)` function determines which tools are exposed to the LLM per mode:

| Tool Category | `case_manager` | `research` | `drafting` |
|---|:---:|:---:|:---:|
| `read_file` | ✅ | ✅ | ✅ |
| `ls_dir` | ✅ | ✅ | — |
| `get_dir_tree` | ✅ | ✅ | — |
| `search_pathnames_only` | ✅ | ✅ | — |
| `search_for_files` | ✅ | ✅ | — |
| `search_in_file` | ✅ | ✅ | — |
| `read_lint_errors` | ✅ | ✅ | — |
| `create_file_or_folder` | ✅ | — | ✅ |
| `delete_file_or_folder` | ✅ | — | — |
| `edit_file` | ✅ | — | ✅ |
| `rewrite_file` | ✅ | — | — |
| `edit_document` | ✅ | — | ✅ |
| `run_command` | ✅ | — | — |
| `run_persistent_command` | ✅ | — | — |
| `open_persistent_terminal` | ✅ | — | — |
| `kill_persistent_terminal` | ✅ | — | — |
| `rag_index_document` | ✅ | ✅ | — |
| `rag_search_reference` | ✅ | ✅ | ✅ |
| `rag_search_workspace` | ✅ | ✅ | ✅ |
| `rag_search_all` | ✅ | ✅ | — |
| `rag_get_stats` | ✅ | ✅ | ✅ |
| `web_search` | ✅ | ✅ | ✅ |
| `multi_link_search` | ✅ | ✅ | ✅ |
| `timeline_add_event` | ✅ | — | ✅ |
| `timeline_update_event` | ✅ | — | ✅ |
| `timeline_delete_event` | ✅ | — | ✅ |
| `timeline_get_events` | ✅ | — | ✅ |
| `timeline_link_document` | ✅ | — | ✅ |
| `timeline_get_deadlines` | ✅ | — | ✅ |
| MCP tools | ✅ | ✅ | ✅ |

**Research mode** excludes all tools that have a required-approval type (write/destructive operations).

**Drafting mode** excludes search tools (except `read_file`) and all terminal tools, focusing on document creation and RAG-backed research.

---

## Tool Format in Prompts

Tools are injected into the system prompt via `toolCallDefinitionsXMLString(tools)`:

```
1. tool_name
   [Example ANTML call]

   Description: [full description text]

   Parameters:
   <parameter name="param1">Description of param1</parameter>
   <parameter name="param2">Description of param2</parameter>
```

Several tools include inline ANTML example calls in their prompt definition:
- `read_file`
- `edit_file`
- `edit_document`
- `rag_search_reference`
- `rag_search_workspace`
- `rag_search_all`
- `create_file_or_folder`
- `timeline_add_event`
- `timeline_get_events`
- `timeline_get_deadlines`

The tool guidelines section also provides four few-shot examples showing the exact ANTML format for parallel and sequential usage.

---

## Context & Search Tools

### `read_file`

Reads and extracts text content from files.

**Supported types**: `.txt`, `.md`, `.json`, `.csv`, `.log`, `.pdf`, `.docx`, `.xlsx`, and most text formats.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `uri` | ✅ | Full path to the file |
| `start_line` | — | Start reading from this line (1-indexed) |
| `end_line` | — | Stop reading at this line (inclusive) |
| `page_number` | — | For paginated reading of very large files |

**Smart reading strategies** (documented in the tool description):
- Unknown file size → call without line parameters first to see length
- Large file → use `search_in_file` to locate relevant sections, then targeted read
- PDF → page markers at "===== Page X =====" headers

**Token cost estimates** (shown in the prompt):
| File Size | Tokens |
|---|---|
| < 100 lines | ~500 |
| 100–1,000 lines | ~5,000 |
| 1,000+ lines | 10,000+ |
| Core reference doc (full) | 20,000–100,000 |

**Parallel usage**: When reading multiple files for comparison, batch them in one `<function_calls>` block.

---

### `ls_dir`

Lists all files and folders at a given URI.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `uri` | — | Full path to folder. Empty/`""` searches all folders |
| `page_number` | — | Pagination |

---

### `get_dir_tree`

Returns a tree diagram of all files and folders.

Described as "a very effective way to learn about the user's codebase." Returns a recursive tree view of the directory structure.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `uri` | ✅ | Full path to the folder |

---

### `search_pathnames_only`

Searches file names only (not content). Returns all pathnames matching the query.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `query` | ✅ | Search query |
| `include_pattern` | — | Glob pattern to limit results if too many |
| `page_number` | — | Pagination |

---

### `search_for_files`

Returns a list of file names whose **content** matches the query (substring or regex).

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `query` | ✅ | Substring or regex to search |
| `search_in_folder` | — | Limit search to descendants of this folder |
| `is_regex` | — | Default `false`. Whether query is a regex |
| `page_number` | — | Pagination |

---

### `search_in_file`

Returns all line numbers where content appears in a specific file.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `uri` | ✅ | Full path to the file |
| `query` | ✅ | String or regex to search for |
| `is_regex` | — | Default `false` |

**Primary use case**: Locate relevant line ranges before calling `read_file` with `start_line`/`end_line` — a key token-saving strategy.

---

### `read_lint_errors`

Returns all lint errors for a file.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `uri` | ✅ | Full path to the file |

---

## File Operation Tools

### `create_file_or_folder`

Creates a file or folder. For DOCX/XLSX, creates a valid empty document. A path ending with `/` creates a folder.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `uri` | ✅ | Full path to file or folder to create |

---

### `delete_file_or_folder`

Deletes a file or folder.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `uri` | ✅ | Full path to delete |
| `is_recursive` | — | `true` to delete folders recursively |

---

### `edit_file`

Edits text files (`.ts`, `.py`, `.js`, `.md`, `.txt`, `.json`, etc.) using search/replace blocks.

> For DOCX/XLSX, use `edit_document` instead.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `uri` | ✅ | Full path to the text file |
| `search_replace_blocks` | ✅ | String of SEARCH/REPLACE blocks (see format below) |

**Search/Replace Block Format**:
```
<<<<<<< ORIGINAL
// exact original code (must match exactly, including whitespace)
=======
// new code
>>>>>>> UPDATED
```

**Rules**:
1. ORIGINAL text must EXACTLY match the file (whitespace included)
2. ORIGINAL text must be large enough to uniquely identify the location
3. Each ORIGINAL must be disjoint from all others
4. Multiple blocks can be chained

---

### `rewrite_file`

Completely replaces text file contents.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `uri` | ✅ | Full path to the file |
| `new_content` | ✅ | Complete new file contents as a string |

---

### `edit_document`

Edits DOCX or XLSX files using a JSON operations array.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `uri` | ✅ | Full path to the document |
| `operations` | ✅ | JSON array of operations |

**DOCX Operations**:

| Operation | Required Fields | Optional Fields |
|---|---|---|
| `insert_text` | `position`, `text` | — |
| `replace_text` | `search`, `replace` | `all` (boolean) |
| `format_text` | `search`, `format` | — |
| `insert_table` | `position`, `rows`, `cols` | `data` |
| `insert_page_break` | `position` | — |
| `set_margins` | `margins` | — |

**XLSX Operations**:

| Operation | Required Fields | Optional Fields |
|---|---|---|
| `set_cell_value` | `sheet`, `cell`, `value` | — |
| `set_cell_formula` | `sheet`, `cell`, `formula` | — |
| `format_cell` | `sheet`, `cell`, `format` | — |
| `insert_row` | `sheet`, `row` | — |
| `insert_column` | `sheet`, `col` | — |
| `delete_row` | `sheet`, `row` | — |
| `delete_column` | `sheet`, `col` | — |

**Example** (create welcome DOCX):
```json
[{"type": "insert_text", "position": 0, "text": "Welcome\n\nThis document was created by your AI assistant."}]
```

**Example** (set XLSX headers):
```json
[
  {"type": "set_cell_value", "sheet": 0, "cell": "A1", "value": "Date"},
  {"type": "set_cell_value", "sheet": 0, "cell": "B1", "value": "Provider"},
  {"type": "format_cell", "sheet": 0, "cell": "A1", "format": {"bold": true}}
]
```

---

## Terminal Tools

### `run_command`

Runs a terminal command and waits for the result. Times out after `MAX_TERMINAL_INACTIVE_TIME` (8 seconds) of inactivity.

**Primary use cases** (emphasized in the description):
- Installing packages (`npm install`, `pip install`)
- Running tests (`pytest`, `npm test`)
- **Moving files**: `mv` (Unix) or `move` (Windows)
- **Renaming files**: `mv old new` or `ren old new`
- **Organizing folders**: `mkdir` + move files
- **Batch operations**: Shell wildcards and loops

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `command` | ✅ | The terminal command to run |
| `cwd` | — | Working directory for the command |

---

### `run_persistent_command`

Runs a command in an existing persistent terminal. Returns results after `MAX_TERMINAL_BG_COMMAND_TIME` (5 seconds); the command continues running in background.

**Use case**: Long-running processes like dev servers.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `command` | ✅ | The terminal command |
| `persistent_terminal_id` | ✅ | ID of the terminal (from `open_persistent_terminal`) |

---

### `open_persistent_terminal`

Opens a new terminal that persists indefinitely (not awaited or killed automatically).

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `cwd` | — | Working directory for the terminal |

**Returns**: A `persistent_terminal_id` for use with `run_persistent_command` and `kill_persistent_terminal`.

---

### `kill_persistent_terminal`

Interrupts and closes a persistent terminal.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `persistent_terminal_id` | ✅ | ID of the terminal to kill |

---

## RAG (Retrieval Augmented Generation) Tools

### `rag_index_document`

Manually indexes a document for RAG search.

> Auto-indexing is preferred: documents in `core_references/` are auto-indexed for reference search; workspace documents are auto-indexed if `ragAutoIndexCaseFiles` is enabled.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `uri` | ✅ | Full path to the document |
| `is_core_reference` | — | `true` for policy manuals/textbooks; `false` (default) for case documents |

---

### `rag_search_reference`

Searches indexed **core reference documents** (policy manuals, regulations, textbooks).

**Primary use**: Before answering ANY question about WC rules, procedures, benefits, or requirements.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `query` | ✅ | Natural language query. Be specific ("permanent disability rating calculation methodology") not vague ("disability") |
| `limit` | — | Max results. Default 8. Use 12–15 for complex topics, 5–6 for quick fact-checking. Each result ~250 tokens |

**Best practice**: Execute 2–3 searches with varied queries:
- Query 1 (Broad): "appeal procedures"
- Query 2 (Specific): "appeal deadline requirements medical evidence"
- Query 3 (Edge case): "appeal late filing exceptions good cause"

**Token cost**: ~2,000 tokens per search (including results).

**Output**: Chunks with document name, page numbers, text excerpts, and similarity scores.

**Citation format**: `"According to [Document Name], Section [X], page [Y]: '[Verbatim Quote]'"`

---

### `rag_search_workspace`

Searches indexed **case-specific documents** (medical reports, IME evaluations, decisions, correspondence).

**Primary use**: Finding case-specific facts — diagnoses, treatment history, claim events, medical opinions.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `query` | ✅ | Natural language query using medical/legal terminology |
| `limit` | — | Default 8. Use 8–10 for detailed analysis, 5–6 for quick extraction |

**Searchable document types**:
- Medical Reports: Treatment notes, diagnostic studies, FCE results
- IME/QME Evaluations
- Legal Documents: Appeals board decisions, settlement agreements
- Correspondence: Adjuster letters, denials, status updates
- Administrative: Claim forms, DWC forms, notices

**Citation format**: `"Dr. [Name] ([Specialty]) report dated [Date], Page [X]: '[Quote]'"`

**Token cost**: ~2,000 tokens per search.

---

### `rag_search_all`

Searches BOTH core reference documents AND case-specific documents simultaneously.

**When to use**: Unsure if answer is in policy or case files; need comprehensive cross-source view; comparing policy requirements against case-specific facts.

**Parameters**: Same as `rag_search_reference` and `rag_search_workspace`.

**Token cost**: ~2,500 tokens (slightly higher due to dual-source retrieval).

---

### `rag_get_stats`

Returns statistics about indexed documents: which documents are indexed, number of chunks per document, total indexed content.

**Always use this FIRST** before searching to understand what's available and avoid redundant indexing.

**Parameters**: None.

---

## Web Search Tools

### `web_search`

Performs a web search using Brave Search API.

**Use cases**: General queries, news, recent events, diverse web sources.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `query` | ✅ | Search query (max 400 chars, 50 words) |
| `count` | — | Number of results (1–20, default 10) |
| `offset` | — | Pagination offset (max 9, default 0) |

---

### `multi_link_search`

Performs multiple sequential web searches. Respects the 1 req/sec rate limit of Brave's free tier.

**Use case**: Batch information gathering across multiple topics.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `queries` | ✅ | Array of 1–10 search queries (each max 400 chars) |
| `count` | — | Results per query (1–20, default 10) |

---

## Timeline Tools

### `timeline_add_event`

Adds a new event to the case timeline.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `date` | ✅ | ISO 8601 date (YYYY-MM-DD or full datetime) |
| `title` | ✅ | Short descriptive title |
| `category` | ✅ | `injury \| medical \| hearing \| decision \| deadline \| filing \| correspondence \| custom` |
| `description` | — | Detailed notes about the event |
| `is_deadline` | — | `true` if this is a tracked deadline |
| `linked_documents` | — | Array of document URIs to associate with this event |

**Example workflow** (date extraction from document):
1. User: "Add my medical appointment from dr_smith_report.pdf to the timeline"
2. `read_file` → extract date ("January 15, 2025")
3. `timeline_add_event` with date "2025-01-15", category "medical", linked_documents pointing to the report

---

### `timeline_update_event`

Updates an existing timeline event.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `event_id` | ✅ | Event ID (from `timeline_get_events`) |
| `date` | — | New ISO 8601 date |
| `title` | — | New title |
| `description` | — | New description |
| `category` | — | New category |
| `is_deadline` | — | Change deadline status |
| `is_complete` | — | `true` to mark deadline as completed |

---

### `timeline_delete_event`

Deletes an event from the timeline.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `event_id` | ✅ | Event ID (from `timeline_get_events`) |

---

### `timeline_get_events`

Queries timeline events with optional filters.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `category` | — | Filter by category |
| `start_date` | — | ISO 8601. Only events on or after this date |
| `end_date` | — | ISO 8601. Only events on or before this date |
| `is_deadline` | — | `true` = only deadlines; `false` = exclude deadlines |
| `limit` | — | Max events to return (default 50) |

---

### `timeline_link_document`

Links a document to an existing timeline event.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `event_id` | ✅ | Event ID (from `timeline_get_events`) |
| `document_uri` | ✅ | Full path to the document |

---

### `timeline_get_deadlines`

Gets upcoming and overdue deadlines.

**Parameters**:
| Parameter | Required | Description |
|---|:---:|---|
| `days_ahead` | — | Days ahead to look for deadlines (default 30) |

---

## MCP Tool Integration

MCP (Model Context Protocol) tools are enabled in **all three modes** (`case_manager`, `research`, `drafting`). They are appended after the built-in tools in the `availableTools()` result.

```typescript
const effectiveMCPTools = (
    chatMode === 'case_manager' || 
    chatMode === 'research' || 
    chatMode === 'drafting'
) ? mcpTools : undefined
```

MCP tools appear in the prompt with the same ANTML XML format as built-in tools. Each MCP tool carries an `mcpServerName` field that identifies its server origin.

---

## Utility Functions

### `availableTools(chatMode, mcpTools)`

Returns the array of `InternalToolInfo` objects available for the given chat mode, combining built-in tools and MCP tools.

```typescript
export const availableTools = (
    chatMode: ChatMode | null,
    mcpTools: InternalToolInfo[] | undefined
): InternalToolInfo[] | undefined
```

Returns `undefined` when both built-in tool list and MCP tools are undefined.

---

### `toolCallDefinitionsXMLString(tools)`

Formats an array of `InternalToolInfo` objects into numbered tool definition strings with inline ANTML examples.

---

### `systemToolsXMLPrompt(chatMode, mcpTools)`

Higher-level wrapper that:
1. Calls `availableTools(chatMode, mcpTools)` to get the tool list
2. Calls `toolCallDefinitionsXMLString(tools)` to format them
3. Adds the tool calling format guidelines with four few-shot examples
4. Returns `null` if no tools are available (logs an error)

The result is appended to the system prompt as the tool definitions block.

---

### `reParsedToolXMLString(toolName, toolParams)`

Re-serializes a parsed tool call back into ANTML XML format. Used when re-rendering tool calls for display or logging.

```typescript
export const reParsedToolXMLString = (toolName: ToolName, toolParams: RawToolParamsObj): string
```

---

### `InternalToolInfo` Type

```typescript
export type InternalToolInfo = {
    name: string,
    description: string,
    params: {
        [paramName: string]: { description: string }
    },
    mcpServerName?: string,   // Only for MCP tools
}
```

# Tools System Documentation

Documentation for Safe Appeals agent tools. The **current** agent loop uses VS Code `vscode.lm` language-model tools registered from extensions (`safeappeals_*`). Sections below that describe Void ANTML `edit_document` / `web_search` are historical reference for the old Void tools framework.

## Current SafeAppeals LM tools (shipping)

Registered from extensions (see each extension’s `package.json` `languageModelTools` and allowlist in `extensions/safeappeals-authentication/src/chat/toolAllowlist.ts`):

### Documents (`extensions/safeappeals-documents`)

| Tool | Notes |
|------|--------|
| `safeappeals_docx_read` / `_create` / `_edit` | Create/overwrite via host writer; structured ops prefer open editor, else JSZip `document.xml` surgery (`replaceSelection` editor-only) |
| `safeappeals_xlsx_read` | Open editor preferred; else headless WASM parse → structure JSON (tables/styles/formulas/charts) + TSV |
| `safeappeals_xlsx_create` | JSZip host writer — no open editor required |
| `safeappeals_xlsx_edit` | Open editor preferred; else headless WASM parse → model ops → save |

XLSX edit operation types (host-normalized): `set_cell_value`, `set_cell_formula`, `format_cell`, `format_range`, `insert_row`, `insert_column`, `delete_row`, `delete_column`, `create_table`, `resize_table`, `rename_table`, `set_table_style`, `toggle_table_filter`, `set_totals_row`, `convert_table_to_range`, `create_chart` (alias of `insert_chart`), `insert_chart`, `delete_chart`. Details: [xlsx-rust-viewer API](../xlsx-rust-viewer/api-reference.md#ai-edit-operations-applyedits).

### Web search (`extensions/safeappeals-authentication`)

| Tool | Cloud API |
|------|-----------|
| `safeappeals_webSearch` | `POST /web-search` |
| `safeappeals_multiWebSearch` | `POST /web-search/multi` |

Brave API key stays on the server. Credit-charging POSTs use `skipTransientRetry` (no 5xx auto-retry double-charge). `CloudAuthError` maps 401. See [Web Search](../SafeAppealsCloud/web-search.md). Void-style picker names `web_search` / `multi_link_search` substitute to these tools.

## Historical Void tools framework

The Tools System (Void) enabled agents via ANTML tool calls with approval workflows. Source for that path lived under Void `common/tools` / `browser/tools` (now largely reference under `void-reference/`).

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

Parameter validation was handled inline in `toolsService.ts` via per-operation switch cases.

## Tool Categories (Void / historical)

### File System (Read)

`read_file`, `ls_dir`, `get_dir_tree`, `search_pathnames_only`, `search_for_files`, `search_in_file`, `read_lint_errors`

### File System (Write)

`edit_file`, `rewrite_file`, `create_file_or_folder`, `delete_file_or_folder`

### Document Editing (Void `edit_document` — superseded by `safeappeals_*_edit`)

`edit_document` supported:

- **DOCX**: `insert_text`, `replace_text`, `format_text`, `insert_table`, `insert_page_break`, `set_margins`
- **XLSX cell**: `set_cell_value`, `set_cell_formula`, `format_cell`, `format_range`, `insert_row`, `insert_column`, `delete_row`, `delete_column`
- **XLSX table**: `create_table`, `resize_table`, `rename_table`, `set_table_style`, `toggle_table_filter`, `set_totals_row`, `convert_table_to_range`
- **XLSX chart**: `create_chart` / `insert_chart`, `delete_chart`

### Terminal

`run_command`, `open_persistent_terminal`, `run_persistent_command`, `kill_persistent_terminal`

### RAG

`rag_index_document`, `rag_search_reference`, `rag_search_workspace`, `rag_search_all`, `rag_get_stats`

### Web Search (Void names → map to SafeAppeals LM tools above)

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

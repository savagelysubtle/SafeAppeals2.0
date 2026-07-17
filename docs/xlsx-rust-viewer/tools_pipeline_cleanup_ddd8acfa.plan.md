---
name: Tools Pipeline Cleanup
overview: Delete dead code (toolSchemas.ts + toolSchemaValidator.ts), fix rag_search_policy -> rag_search_reference naming across code/docs/tests, rewrite docs to match current codebase, and fix stale references in prompts.
todos:
  - id: delete-dead-code
    content: Delete toolSchemas.ts and toolSchemaValidator.ts, clean up index.ts re-exports, fix prompts.ts comment
    status: completed
  - id: fix-rag-naming-code
    content: Fix rag_search_policy -> rag_search_reference in prompts.ts and antmlParser.test.ts
    status: completed
  - id: rewrite-docs-readme
    content: Rewrite docs/tools/README.md to match current codebase (fix structure, XML format, tool categories)
    status: completed
  - id: rewrite-docs-api
    content: Rewrite docs/tools/api-reference.md (add timeline tools, document edit_document ops, fix rag naming)
    status: completed
  - id: rewrite-docs-execution
    content: Rewrite docs/tools/tool-execution-guide.md (fix approval mapping, rag naming)
    status: completed
  - id: rewrite-docs-developer
    content: Rewrite docs/tools/developer-guide.md (remove fake references, update structure)
    status: completed
  - id: fix-docs-schema
    content: Replace or delete docs/tools/schema-validation-guide.md (ToolSchemaValidator being removed)
    status: completed
  - id: rewrite-common-readme
    content: Rewrite src/vs/workbench/contrib/void/common/tools/README.md to match actual module
    status: completed
isProject: false
---

# Tools Pipeline Cleanup

## Phase 1: Delete Dead Code

### Delete `toolSchemas.ts`

- Delete
[src/vs/workbench/contrib/void/common/prompt/toolSchemas.ts](src/vs/workbench/contrib/void/common/prompt/toolSchemas.ts)
- All exports are unused -- nothing imports from this file

### Delete `toolSchemaValidator.ts`

- Delete
[src/vs/workbench/contrib/void/common/tools/toolSchemaValidator.ts](src/vs/workbench/contrib/void/common/tools/toolSchemaValidator.ts)
- Never instantiated in runtime code; only referenced by dead code and its own
re-export

### Clean up `common/tools/index.ts`

- Remove all `toolSchemaValidator.ts` re-exports from
[src/vs/workbench/contrib/void/common/tools/index.ts](src/vs/workbench/contrib/void/common/tools/index.ts):
  - `ValidationError`, `ValidationResult`, `ParamType`, `ParamConstraint`,
  `ToolSchema`, `CompiledValidator`, `ToolSchemaValidator`,
  `createSchemaFromToolInfo`

### Fix stale comment in `prompts.ts`

- Remove line 19 comment `// EDIT_DOCUMENT_DESCRIPTION from toolSchemas.ts` in
[src/vs/workbench/contrib/void/common/prompt/prompts.ts](src/vs/workbench/contrib/void/common/prompt/prompts.ts)

---

## Phase 2: Fix `rag_search_policy` -> `rag_search_reference`

The code already uses `rag_search_reference`. These references to the old name
need updating:

### Code files

- [src/vs/workbench/contrib/void/common/prompt/prompts.ts](src/vs/workbench/contrib/void/common/prompt/prompts.ts)
line 527: change "use rag_search_policy for that" -> "use rag_search_reference
for that"

### Test files

- [src/vs/workbench/contrib/void/test/electron-main/antmlParser.test.ts](src/vs/workbench/contrib/void/test/electron-main/antmlParser.test.ts):
rename all `rag_search_policy` -> `rag_search_reference` (lines 33-34, 105,
118, 216)

### Documentation files (all `rag_search_policy` -> `rag_search_reference`)

- [docs/tools/README.md](docs/tools/README.md)
- [docs/tools/api-reference.md](docs/tools/api-reference.md)
- [docs/tools/tool-execution-guide.md](docs/tools/tool-execution-guide.md)
- [docs/tools/tool-types-reference.md](docs/tools/tool-types-reference.md) (if
present)
- [src/vs/workbench/contrib/void/common/tools/README.md](src/vs/workbench/contrib/void/common/tools/README.md)

---

## Phase 3: Rewrite Docs to Match Codebase

### [docs/tools/README.md](docs/tools/README.md)

- Fix architecture section: remove references to `xml-parsing/` directory
(doesn't exist)
- Fix XML format: change `<tool_call name="...">` to
`<function_calls><invoke name="...">`
- Update tool categories to include timeline tools and web search tools
- Remove reference to `ToolSchemaValidator` (being deleted)
- Update RAG tool listing to include `rag_search_all`

### [docs/tools/api-reference.md](docs/tools/api-reference.md)

- Add timeline tools to `BuiltinToolCallParams` (timeline_add_event,
timeline_update_event, timeline_delete_event, timeline_get_events,
timeline_link_document, timeline_get_deadlines)
- Add timeline tools to `BuiltinToolResultType`
- Document `edit_document` operation types (cell ops, table ops, chart ops)
- Remove `ToolSchemaValidator` API section (being deleted)
- Fix `rag_index_document` param: `isPolicyManual` -> `isCoreReference`

### [docs/tools/tool-execution-guide.md](docs/tools/tool-execution-guide.md)

- Fix approval mapping code block to match actual `toolsServiceTypes.ts`
- Fix RAG tool comments in approval mapping

### [docs/tools/developer-guide.md](docs/tools/developer-guide.md)

- Remove references to `xmlParserService.ts` and `execution/` directory (don't
exist)
- Update architecture overview to match actual file structure
- Remove `ToolSchemaValidator` references

### [docs/tools/schema-validation-guide.md](docs/tools/schema-validation-guide.md)

- This entire doc is about `ToolSchemaValidator` which is being deleted
- Replace with a brief note that validation is handled inline in
`toolsService.ts` with per-operation switch cases, or delete entirely

### [src/vs/workbench/contrib/void/common/tools/README.md](src/vs/workbench/contrib/void/common/tools/README.md)

- Remove `toolSchemaValidator.ts` from structure listing
- Update tool categories to match actual code
- Remove `ToolSchemaValidator` from Quick Usage example
- Update Contributing section (no longer need to create validation schemas)

---

## Summary of files changed

**Deleted (2):**

- `src/vs/workbench/contrib/void/common/prompt/toolSchemas.ts`
- `src/vs/workbench/contrib/void/common/tools/toolSchemaValidator.ts`

**Code edits (3):**

- `src/vs/workbench/contrib/void/common/tools/index.ts` -- remove dead
re-exports
- `src/vs/workbench/contrib/void/common/prompt/prompts.ts` -- fix comment +
rag_search_policy reference
- `src/vs/workbench/contrib/void/test/electron-main/antmlParser.test.ts` --
rename rag_search_policy

**Docs rewritten (6):**

- `docs/tools/README.md`
- `docs/tools/api-reference.md`
- `docs/tools/tool-execution-guide.md`
- `docs/tools/developer-guide.md`
- `docs/tools/schema-validation-guide.md`
- `src/vs/workbench/contrib/void/common/tools/README.md`


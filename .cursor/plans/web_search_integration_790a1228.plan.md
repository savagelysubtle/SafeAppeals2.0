---
name: Web Search Integration
overview: Integrate Brave Search-powered `web_search` and `multi_link_search` as native XML builtin tools in SafeAppeals, with settings for API key configuration and Command Palette access.
todos:
  - id: websearch-types
    content: "KAN-44: Add web_search and multi_link_search types"
    status: completed
  - id: websearch-settings
    content: "KAN-44: Add braveSearchApiKey to GlobalSettings"
    status: completed
  - id: websearch-electron
    content: "KAN-44: Create braveSearchService.ts in electron-main/tools"
    status: completed
  - id: websearch-handlers
    content: "KAN-44: Implement tool handlers in toolsService.ts"
    status: completed
  - id: websearch-prompts
    content: "KAN-44: Add tool definitions to prompts.ts"
    status: completed
  - id: websearch-command
    content: "KAN-44: Create Command Palette action for API key"
    status: completed
  - id: websearch-ui
    content: "KAN-44: Add Web Search section to Settings.tsx"
    status: completed
---

# Web Search Tools Integration Plan

## Overview

Integrate Brave Search web search tools (`brave_web_search`, `multi_link_search`) into the Void application while refactoring the tools folder structure for better organization.

## Status Summary

- **Phase 1 (KAN-45)**: COMPLETED - Tools folder refactoring done
- **Phase 2 (KAN-44)**: PENDING - Web search tools integration

## Completed Work (KAN-45)

### New Folder Structure

```
void/
├── common/tools/
│   ├── index.ts              # Re-exports
│   ├── toolsServiceTypes.ts  # Type definitions
│   └── toolSchemaValidator.ts # Validation utilities
└── browser/tools/
    ├── index.ts              # Re-exports
    ├── toolsService.ts       # Main tool service
    └── terminalToolService.ts # Terminal commands
```

### Updated Import Paths (17 files)

All imports updated from flat structure to new `tools/` folder locations.

---

## Remaining Work (KAN-44)

### Phase 2.1: Add Type Definitions

**File**: [`common/tools/toolsServiceTypes.ts`](SafeAppeals2.0/src/vs/workbench/contrib/void/common/tools/toolsServiceTypes.ts)

Add to `BuiltinToolCallParams`:

```typescript
'web_search': { query: string, count: number | null, offset: number | null },
'multi_link_search': { queries: string[], count: number | null },
```

Add to `BuiltinToolResultType`:

```typescript
'web_search': { results: WebSearchResult[], totalResults: number },
'multi_link_search': { searchResults: MultiSearchResult[] },
```

### Phase 2.2: Add Settings

**File**: [`common/voidSettingsTypes.ts`](SafeAppeals2.0/src/vs/workbench/contrib/void/common/voidSettingsTypes.ts)

Add `braveSearchApiKey` to `GlobalSettings`.

### Phase 2.3: Create Brave Search Service

**File**: `electron-main/tools/braveSearchService.ts` (new)

Implement HTTP calls to Brave Search API with rate limiting.

### Phase 2.4: Implement Tool Handlers

**File**: [`browser/tools/toolsService.ts`](SafeAppeals2.0/src/vs/workbench/contrib/void/browser/tools/toolsService.ts)

Add `validateParams`, `callTool`, and `stringOfResult` for both web search tools.

### Phase 2.5: Add Tool Definitions

**File**: [`common/prompt/prompts.ts`](SafeAppeals2.0/src/vs/workbench/contrib/void/common/prompt/prompts.ts)

Add `builtinTools` entries for `web_search` and `multi_link_search` with descriptions.

### Phase 2.6: Settings UI

**File**: [`browser/react/src/void-settings-tsx/Settings.tsx`](SafeAppeals2.0/src/vs/workbench/contrib/void/browser/react/src/void-settings-tsx/Settings.tsx)

Add Web Search section with API key input field.

### Phase 2.7: Command Palette

**File**: [`browser/void.contribution.ts`](SafeAppeals2.0/src/vs/workbench/contrib/void/browser/void.contribution.ts)

Register action for "SafeAppeals: Configure Brave Search API Key".

## Validation Steps

After implementation:

1. Run `bun run buildreact`
2. Run `bun run compile` 
3. Reload window and test via Ctrl+Shift+P
4. Verify API key saves and web search tools work
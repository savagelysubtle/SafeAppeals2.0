---
name: Internal MCP Server with Pilot Tools Migration
overview: ""
todos:
  - id: 13c0fdd5-1c7d-442e-83d8-22aa900e6d89
    content: Write MCP README and update ADDED_FEATURES_TRACKER
    status: pending
---

# Internal MCP Server with Pilot Tools Migration

## Phase 1: Setup Infrastructure

### 1.1 Install Dependencies

Add MCP SDK and Zod to the project:

- Install `@modelcontextprotocol/sdk` (latest version)
- Install `zod` for schema validation
- Update package.json in workspace root

### 1.2 Create Nested Folder Structure

Create new nested structure under `src/vs/workbench/contrib/void/`:

```
void/
├── browser/
│   └── mcp/
│       ├── internalMCPServer.ts          # Main internal MCP server
│       ├── internalMCPClient.ts          # Client wrapper
│       ├── toolWrappers.ts               # Helpers to wrap existing tools
│       └── types.ts                      # MCP-specific types
```

### 1.3 Create InternalMCPServer Base

File: `src/vs/workbench/contrib/void/browser/mcp/internalMCPServer.ts`

Implement:

- McpServer instance with name 'void-builtin-tools'
- InMemoryTransport setup (server + client transports linked)
- Service injection for IToolsService, IDocumentEditorService, IDocumentViewerService
- Empty `_registerAllTools()` method (to be populated)
- `connect()` method to start server
- `getClientTransport()` method to get client-side transport

Key imports:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { IToolsService } from '../toolsService.js';
import { IDocumentEditorService } from '../documentViewers/documentEditorService.js';
```

### 1.4 Create InternalMCPClient Wrapper

File: `src/vs/workbench/contrib/void/browser/mcp/internalMCPClient.ts`

Implement:

- Client instance using InMemoryTransport from server
- `connect()` method
- `listTools()` method
- `callTool(name, params)` method
- Type-safe wrapper around MCP client

### 1.5 Create Tool Wrapper Utilities

File: `src/vs/workbench/contrib/void/browser/mcp/toolWrappers.ts`

Helper functions to wrap existing toolsService methods into MCP format:

- `wrapToolExecution()` - wraps existing call/validate/stringify pattern
- `convertParamsToZodSchema()` - converts Void param descriptions to Zod
- `formatMCPResult()` - formats tool results for MCP response

## Phase 2: Convert Pilot Tools

### 2.1 Convert read_file Tool

In `internalMCPServer.ts`, implement `_registerReadFileTool()`:

Register tool with:

- Name: `read_file`
- Input schema using Zod:
  ```typescript
  {
    uri: z.string().describe('Full path to the file'),
    start_line: z.number().optional(),
    end_line: z.number().optional(),
    page_number: z.number().optional().default(1)
  }
  ```

- Output schema:
  ```typescript
  {
    fileContents: z.string(),
    totalFileLen: z.number(),
    totalNumLines: z.number(),
    hasNextPage: z.boolean()
  }
  ```

- Implementation: Wrap existing `toolsService.validateParams.read_file()` and `toolsService.callTool.read_file()`

### 2.2 Convert edit_document Tool

In `internalMCPServer.ts`, implement `_registerEditDocumentTool()`:

Register tool with:

- Name: `edit_document`
- Input schema using Zod:
  ```typescript
  {
    uri: z.string().describe('Full path to document'),
    operations: z.array(z.object({
      type: z.string(),
      // Additional operation fields as z.record(z.any()) for flexibility
    })).describe('Array of edit operations')
  }
  ```

- Output schema:
  ```typescript
  {
    success: z.boolean(),
    message: z.string().optional(),
    error: z.string().optional()
  }
  ```

- Implementation: Wrap existing `toolsService.validateParams.edit_document()` and `toolsService.callTool.edit_document()`

### 2.3 Add Void-Specific Annotations

For both tools, add custom annotations for Void features:

```typescript
annotations: {
  requiresApproval: true,
  approvalType: 'edits', // or undefined for read_file
  canBeInterrupted: false,
  returnsLintErrors: false
}
```

## Phase 3: Integration & Testing Setup

### 3.1 Register Service

File: `src/vs/workbench/contrib/void/browser/mcp/internalMCPServer.ts`

Add at bottom:

```typescript
export const IInternalMCPServer = createDecorator<IInternalMCPServer>('internalMCPServer');
export interface IInternalMCPServer {
  readonly _serviceBrand: undefined;
  getClientTransport(): InMemoryTransport;
  listTools(): Promise<string[]>;
}

registerSingleton(IInternalMCPServer, InternalMCPServer, InstantiationType.Delayed);
```

### 3.2 Add Feature Flag

File: `src/vs/workbench/contrib/void/common/voidSettingsTypes.ts`

Add to `GlobalSettings`:

```typescript
useInternalMCPServer?: boolean; // default: false for testing
```

### 3.3 Create Test Harness

File: `src/vs/workbench/contrib/void/browser/mcp/mcpTestActions.ts`

Register test actions:

- `void.mcp.testReadFile` - Test read_file through MCP vs direct
- `void.mcp.testEditDocument` - Test edit_document through MCP vs direct
- `void.mcp.listInternalTools` - Show available tools from internal server

Each test action should:

1. Call tool through InternalMCPClient
2. Call tool through existing toolsService
3. Compare results and log differences

### 3.4 Update Contribution Point

File: `src/vs/workbench/contrib/void/browser/void.contribution.ts`

Import and initialize InternalMCPServer on startup (Eager instantiation)

## Phase 4: Documentation

### 4.1 Create MCP README

File: `src/vs/workbench/contrib/void/browser/mcp/README.md`

Document:

- Purpose of internal MCP server
- How InMemoryTransport works
- How to add new tools
- How to test MCP tools vs direct tools
- Next steps for migration

### 4.2 Update ADDED_FEATURES_TRACKER

File: `src/vs/workbench/contrib/void/ADDED_FEATURES_TRACKER.md`

Add section:

```markdown
## Internal MCP Server (Pilot)
- Setup InMemoryTransport-based MCP server for built-in tools
- Converted read_file and edit_document as pilot implementations
- Added test actions for validation
- Future: Migrate remaining 18 tools
```

## Testing Checklist

After implementation, test:

- [ ] Internal MCP server initializes without errors
- [ ] InMemoryTransport connects client and server
- [ ] `read_file` tool works through MCP (test with small file)
- [ ] `read_file` tool works with pagination (test with large file)
- [ ] `read_file` tool works with DOCX/PDF extraction
- [ ] `edit_document` tool works through MCP (test DOCX edit)
- [ ] `edit_document` tool works through MCP (test XLSX edit)
- [ ] Results match direct toolsService calls exactly
- [ ] Test actions successfully compare both implementations

## Files to Create

1. `src/vs/workbench/contrib/void/browser/mcp/internalMCPServer.ts` (~200 lines)
2. `src/vs/workbench/contrib/void/browser/mcp/internalMCPClient.ts` (~100 lines)
3. `src/vs/workbench/contrib/void/browser/mcp/toolWrappers.ts` (~80 lines)
4. `src/vs/workbench/contrib/void/browser/mcp/types.ts` (~40 lines)
5. `src/vs/workbench/contrib/void/browser/mcp/mcpTestActions.ts` (~150 lines)
6. `src/vs/workbench/contrib/void/browser/mcp/README.md` (documentation)

## Files to Modify

1. `package.json` - Add dependencies
2. `src/vs/workbench/contrib/void/common/voidSettingsTypes.ts` - Add feature flag
3. `src/vs/workbench/contrib/void/browser/void.contribution.ts` - Initialize server
4. `src/vs/workbench/contrib/void/ADDED_FEATURES_TRACKER.md` - Document changes

## Success Criteria

- Internal MCP server successfully wraps and executes read_file and edit_document
- Zero performance regression compared to direct calls
- Results are identical between MCP and direct execution
- Clean nested folder structure established for future tools
- Test actions provide easy validation for developers
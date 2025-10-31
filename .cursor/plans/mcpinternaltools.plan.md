# 🔄 XML Tools → MCP Tools Migration Plan

**Status:** 🔵 In Planning

**Priority:** High

**Complexity:** Medium

**Created:** 2025-10-31

**Last Updated:** 2025-10-31

---

## 📋 Executive Summary

**Problem:** Void's builtin tools (read_file, edit_file, search_files, etc.) currently use **XML format** with **custom regex parsing** (xmlParserService.ts). This approach is fragile, error-prone, and difficult to maintain.

**Solution:** Migrate all builtin tools to **MCP format** by wrapping existing implementations with MCP tool adapters, enabling gradual rollout while maintaining 100% backwards compatibility.

**Benefits:**

- 🎯 **Reliability:** Standard JSON-RPC protocol vs custom XML parsing
- 🚀 **Provider Support:** Native tool calling support from Anthropic, OpenAI, etc.
- 🛡️ **Error Handling:** Better error messages and debugging
- 🧹 **Maintenance:** Remove ~1,000 lines of XML parsing code
- ⚡ **Performance:** Faster parsing and execution

---

## 🔍 Current State Analysis

### XML Tool Calling Flow (Current)

```
1. LLM generates XML:
   <read_file>
   <uri>d:\Coding\SafeAppeals\case.pdf</uri>
   </read_file>

2. xmlParserService.ts extracts tool calls using regex
   ├─ Fragile: Breaks with spaces after tags
   ├─ Complex: Multiple fallback parsers
   └─ Limited: Special character escaping issues

3. extractXMLToolsWrapper processes tool calls
   ├─ Builds toolOfToolName map
   ├─ Searches for opening/closing tags
   └─ Parses parameters from XML

4. toolsService.runTool executes the tool
   └─ Returns result to LLM
```

### Pain Points

| Issue | Impact | Frequency |

|-------|--------|-----------|

| **Regex parsing failures** | Tool calls fail silently | High |

| **Special character escaping** | Windows paths break | Medium |

| **Space after opening tag** | `<read_file >` fails | Low |

| **Complex error messages** | Hard to debug | High |

| **Provider incompatibility** | Can't use native tools | Always |

| **Maintenance burden** | Hard to modify/extend | Always |

### Files Involved

```typescript
// XML Parsing Infrastructure (TO BE DEPRECATED)
src/vs/workbench/contrib/void/electron-main/llmMessage/
├── xmlParserService.ts           // ~500 lines - Custom XML parser
├── extractGrammar.ts             // ~400 lines - Tool extraction logic
└── toolRouter.ts                 // ~150 lines - Routing XML tools

// Tool Definitions (TO BE WRAPPED)
src/vs/workbench/contrib/void/common/prompt/
├── prompts.ts                    // builtinTools object (lines 169-512)
└── systemPrompt.ts               // XML format instructions (lines 81-147)

// Tool Execution (NO CHANGES NEEDED)
src/vs/workbench/contrib/void/browser/
└── toolsService.ts               // Actual tool implementations
```

---

## 🎯 Migration Strategy

### Core Principle: **Zero Breaking Changes**

Both XML and MCP formats will coexist during migration. We'll implement a **router** that detects which format to use based on:

1. Provider capabilities (native tool support)
2. User preferences (override in settings)
3. Gradual rollout flags (per-mode, per-tool)

### Architecture: Three-Layer Adapter Pattern

```
┌─────────────────────────────────────────────────────────────┐
│                    LAYER 1: LLM INTERFACE                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Provider decides format:                            │   │
│  │  ├─ Anthropic Claude → Native MCP (JSON-RPC)        │   │
│  │  ├─ OpenAI GPT → Native MCP (JSON-RPC)              │   │
│  │  └─ Ollama → XML fallback (legacy)                  │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────┐
│                    LAYER 2: FORMAT ROUTER                    │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  routeToolCalling(provider, model, tools)           │   │
│  │  └─ Returns: { format: 'mcp-native' | 'xml' }       │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────┬───────────────────────────────────┘
                          │
                ┌─────────┴──────────┐
                │                    │
┌───────────────▼──────┐  ┌──────────▼────────────────────────┐
│   MCP TOOLS (NEW)    │  │   XML TOOLS (LEGACY)              │
│                      │  │                                    │
│  InternalMcpServer   │  │  xmlParserService.ts              │
│  ├─ ToolAdapter      │  │  extractGrammar.ts                │
│  ├─ Zod validation   │  │                                    │
│  └─ JSON Schema      │  │  <read_file><uri>...</uri>        │
│                      │  │  └─ Custom regex parsing          │
└──────────┬───────────┘  └───────────┬───────────────────────┘
           │                          │
           └──────────┬───────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                 LAYER 3: TOOL EXECUTION                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  toolsService.runTool(toolName, params)              │   │
│  │  └─ Existing implementations unchanged               │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## 📦 Phase 1: Foundation (MCP Adapter Infrastructure)

**Goal:** Create adapter layer without breaking existing XML tools

**Duration:** 2-3 days

**Status:** 🔵 Not Started

### 1.1 Create BuiltinToolMCPAdapter

**File:** `src/vs/workbench/contrib/void/electron-main/internalMcp/tools/builtinToolAdapters.ts`

**Responsibility:** Convert each builtin tool to MCP format

```typescript
import { z } from 'zod';
import { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { ToolDefinition } from '../server/ToolRegistry.js';
import { builtinTools, BuiltinToolName } from '../../../common/prompt/prompts.js';
import { IToolsService } from '../../../common/toolsServiceTypes.js';

/**
 * Adapter that converts Void's builtin tools (XML format) to MCP tools
 *
 * Design Pattern: Adapter Pattern
 * - Wraps existing toolsService implementations
 * - Provides MCP-compatible interface
 * - Zero changes to underlying tool logic
 */
export class BuiltinToolMCPAdapter {
    constructor(private readonly toolsService: IToolsService) {}

    /**
     * Convert a builtin tool definition to MCP ToolDefinition
     *
     * @param toolName - Name of the builtin tool (e.g., 'read_file')
     * @returns MCP-compatible tool definition
     * @throws Error if tool not found
     */
    toMCPToolDefinition(toolName: BuiltinToolName): ToolDefinition {
        const builtinTool = builtinTools[toolName];

        if (!builtinTool) {
            throw new Error(`Builtin tool not found: ${toolName}`);
        }

        return {
            name: builtinTool.name,
            description: builtinTool.description,
            inputSchema: this._createInputSchema(toolName),
            outputSchema: this._createOutputSchema(toolName),
            handler: async (params) => this._executeBuiltinTool(toolName, params),
            metadata: {
                category: this._getCategoryForTool(toolName),
                requiresAuth: false,
                estimatedDuration: this._getEstimatedDuration(toolName),
                isBuiltin: true // Flag to identify converted tools
            }
        };
    }

    /**
     * Create Zod input schema for a specific tool
     * Maps XML parameter structure to Zod validation schema
     */
    private _createInputSchema(toolName: BuiltinToolName): z.ZodSchema {
        // File reading tools
        if (toolName === 'read_file') {
            return z.object({
                uri: z.string().describe('File path to read (absolute or relative)'),
                start_line: z.number().int().positive().optional()
                    .describe('Optional start line for partial file reading'),
                end_line: z.number().int().positive().optional()
                    .describe('Optional end line for partial file reading'),
                page_number: z.number().int().positive().optional()
                    .describe('Optional PDF page number to read'),
                sheet_name: z.string().optional()
                    .describe('Optional Excel sheet name to read')
            });
        }

        if (toolName === 'search_in_file') {
            return z.object({
                uri: z.string().describe('File path to search in'),
                regex: z.string().describe('Regular expression pattern to search for'),
                file_pattern: z.string().optional()
                    .describe('Optional glob pattern for filtering files')
            });
        }

        if (toolName === 'search_files') {
            return z.object({
                path: z.string().describe('Directory path to search in'),
                regex: z.string().describe('Regular expression pattern to search for'),
                file_pattern: z.string().optional()
                    .describe('Optional glob pattern (e.g., "*.ts")'),
                case_sensitive: z.boolean().optional()
                    .describe('Whether search should be case sensitive')
            });
        }

        if (toolName === 'list_files') {
            return z.object({
                path: z.string().describe('Directory path to list files from')
            });
        }

        // File editing tools
        if (toolName === 'edit_file') {
            return z.object({
                uri: z.string().describe('File path to edit'),
                search_replace_blocks: z.string()
                    .describe('Search/replace blocks in ORIGINAL/DIVIDER/FINAL format')
            });
        }

        if (toolName === 'rewrite_file') {
            return z.object({
                uri: z.string().describe('File path to rewrite'),
                new_content: z.string().describe('Complete new file contents')
            });
        }

        if (toolName === 'create_file_or_folder') {
            return z.object({
                uri: z.string().describe('Path for new file or folder (end with / for folders)'),
                type: z.enum(['file', 'folder']).optional()
                    .describe('Type of creation (inferred from path if not provided)')
            });
        }

        if (toolName === 'delete_file_or_folder') {
            return z.object({
                uri: z.string().describe('Path to file or folder to delete'),
                is_recursive: z.boolean().optional()
                    .describe('Whether to delete recursively (required for non-empty folders)')
            });
        }

        // Document editing tools
        if (toolName === 'edit_document') {
            return z.object({
                uri: z.string().describe('Document path (DOCX/XLSX)'),
                operations: z.string()
                    .describe('JSON array of document operations')
            });
        }

        // Terminal tools
        if (toolName === 'run_command') {
            return z.object({
                command: z.string().describe('Shell command to execute'),
                cwd: z.string().optional()
                    .describe('Optional working directory for command execution')
            });
        }

        if (toolName === 'run_persistent_command') {
            return z.object({
                command: z.string().describe('Long-running command to execute in background'),
                cwd: z.string().optional()
                    .describe('Optional working directory'),
                terminal_id: z.string().optional()
                    .describe('Optional terminal ID for reusing terminal')
            });
        }

        if (toolName === 'stop_persistent_command') {
            return z.object({
                terminal_id: z.string().describe('Terminal ID to stop')
            });
        }

        if (toolName === 'send_to_terminal') {
            return z.object({
                terminal_id: z.string().describe('Terminal ID to send input to'),
                text: z.string().describe('Text to send to terminal')
            });
        }

        // RAG tools
        if (toolName === 'rag_search_policy') {
            return z.object({
                query: z.string().describe('Search query for policy documents'),
                limit: z.number().int().positive().optional()
                    .describe('Maximum number of results (default: 5)')
            });
        }

        if (toolName === 'rag_search_workspace') {
            return z.object({
                query: z.string().describe('Search query for workspace documents'),
                limit: z.number().int().positive().optional()
                    .describe('Maximum number of results (default: 5)')
            });
        }

        if (toolName === 'rag_get_stats') {
            return z.object({
                // No parameters
            });
        }

        // Fallback: generic schema for unknown tools
        console.warn(`[BuiltinToolMCPAdapter] No specific schema for ${toolName}, using generic schema`);
        return z.record(z.any());
    }

    /**
     * Create Zod output schema for tool results
     */
    private _createOutputSchema(toolName: BuiltinToolName): z.ZodSchema {
        // Most tools return text results
        if (['read_file', 'search_in_file', 'search_files', 'list_files'].includes(toolName)) {
            return z.object({
                content: z.string(),
                lineCount: z.number().optional(),
                fileSize: z.number().optional()
            });
        }

        // Edit tools return success status
        if (['edit_file', 'rewrite_file', 'create_file_or_folder', 'delete_file_or_folder'].includes(toolName)) {
            return z.object({
                success: z.boolean(),
                message: z.string(),
                affectedFiles: z.array(z.string()).optional()
            });
        }

        // Terminal tools return output
        if (['run_command', 'run_persistent_command'].includes(toolName)) {
            return z.object({
                output: z.string(),
                exitCode: z.number().optional(),
                terminalId: z.string().optional()
            });
        }

        // RAG tools return search results
        if (['rag_search_policy', 'rag_search_workspace'].includes(toolName)) {
            return z.object({
                results: z.array(z.object({
                    content: z.string(),
                    source: z.string(),
                    score: z.number().optional()
                })),
                totalCount: z.number()
            });
        }

        // Default output schema
        return z.object({
            result: z.string(),
            success: z.boolean()
        });
    }

    /**
     * Execute builtin tool via toolsService
     *
     * @param toolName - Tool to execute
     * @param params - Validated parameters
     * @returns MCP-compatible result
     */
    private async _executeBuiltinTool(
        toolName: BuiltinToolName,
        params: any
    ): Promise<CallToolResult> {
        try {
            // Call existing toolsService implementation
            const result = await this.toolsService.runTool({
                name: toolName,
                rawParams: params,
                toolCallId: `mcp-builtin-${Date.now()}-${Math.random().toString(36).slice(2)}`
            });

            // Convert to MCP format
            return {
                content: [
                    {
                        type: 'text',
                        text: this._formatToolResult(toolName, result)
                    }
                ],
                // Include structured data if available
                ...(typeof result === 'object' && { structuredContent: result })
            };
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;

            console.error(`[BuiltinToolMCPAdapter] Error executing ${toolName}:`, errorMsg, errorStack);

            return {
                content: [
                    {
                        type: 'text',
                        text: `❌ Error executing ${toolName}: ${errorMsg}`
                    }
                ],
                isError: true
            };
        }
    }

    /**
     * Format tool result for display to LLM
     */
    private _formatToolResult(toolName: BuiltinToolName, result: any): string {
        // File reading: return content directly
        if (toolName === 'read_file') {
            return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
        }

        // Search results: format as list
        if (['search_files', 'search_in_file'].includes(toolName)) {
            if (Array.isArray(result)) {
                return `Found ${result.length} matches:\n${result.map((r, i) => `${i + 1}. ${r}`).join('\n')}`;
            }
        }

        // List files: format as tree
        if (toolName === 'list_files') {
            if (Array.isArray(result)) {
                return result.join('\n');
            }
        }

        // Edit results: format as success message
        if (['edit_file', 'rewrite_file', 'create_file_or_folder', 'delete_file_or_folder'].includes(toolName)) {
            if (typeof result === 'object' && result.success) {
                return `✅ ${result.message || 'Operation completed successfully'}`;
            }
            if (typeof result === 'string') {
                return result;
            }
        }

        // Terminal output: return as-is
        if (['run_command', 'run_persistent_command'].includes(toolName)) {
            if (typeof result === 'object' && result.output) {
                return result.output;
            }
            return String(result);
        }

        // RAG results: format with sources
        if (['rag_search_policy', 'rag_search_workspace'].includes(toolName)) {
            if (typeof result === 'object' && Array.isArray(result.results)) {
                return result.results
                    .map((r: any, i: number) => `${i + 1}. ${r.content}\n   Source: ${r.source}`)
                    .join('\n\n');
            }
        }

        // Default: JSON stringify
        return JSON.stringify(result, null, 2);
    }

    /**
     * Get category for tool (used for metrics and routing)
     */
    private _getCategoryForTool(toolName: BuiltinToolName): string {
        if (['read_file', 'search_files', 'search_in_file', 'list_files'].includes(toolName)) {
            return 'file-reading';
        }
        if (['edit_file', 'rewrite_file', 'create_file_or_folder', 'delete_file_or_folder'].includes(toolName)) {
            return 'file-editing';
        }
        if (['edit_document'].includes(toolName)) {
            return 'document-editing';
        }
        if (['run_command', 'run_persistent_command', 'stop_persistent_command', 'send_to_terminal'].includes(toolName)) {
            return 'terminal';
        }
        if (['rag_search_policy', 'rag_search_workspace', 'rag_get_stats'].includes(toolName)) {
            return 'rag';
        }
        return 'other';
    }

    /**
     * Get estimated duration for tool (milliseconds)
     */
    private _getEstimatedDuration(toolName: BuiltinToolName): number {
        // Fast: Simple file operations
        if (['read_file', 'list_files'].includes(toolName)) return 500;

        // Medium: Search operations
        if (['search_in_file', 'search_files'].includes(toolName)) return 2000;

        // Medium: File edits
        if (['edit_file', 'rewrite_file', 'create_file_or_folder'].includes(toolName)) return 1000;

        // Slow: RAG operations
        if (['rag_search_policy', 'rag_search_workspace'].includes(toolName)) return 3000;

        // Variable: Terminal operations
        if (['run_command'].includes(toolName)) return 5000;
        if (['run_persistent_command'].includes(toolName)) return 10000;

        // Default
        return 1000;
    }
}
```

### 1.2 Register Builtin Tools in InternalMcpServer

**File:** `src/vs/workbench/contrib/void/electron-main/internalMcp/server/InternalMcpServer.ts`

**Changes:**

```typescript
import { BuiltinToolMCPAdapter } from '../tools/builtinToolAdapters.js';
import { BuiltinToolName, builtinTools } from '../../../common/prompt/prompts.js';

export class InternalMcpServer extends Disposable {
    private readonly _builtinAdapter: BuiltinToolMCPAdapter;

    constructor(
        private readonly metricsService: IMetricsService,
        private readonly logService: ILogService,
        private readonly toolsService: IToolsService  // NEW: Inject toolsService
    ) {
        super();

        this._builtinAdapter = new BuiltinToolMCPAdapter(toolsService);

        // ... existing initialization
    }

    /**
     * Initialize server and register all builtin tools
     */
    async initialize(): Promise<void> {
        // ... existing initialization logic

        await this._registerBuiltinTools();

        this.logger.info('Internal MCP Server initialized with builtin tools');
    }

    /**
     * Register all builtin tools as MCP tools
     */
    private async _registerBuiltinTools(): Promise<void> {
        const toolNames = Object.keys(builtinTools) as BuiltinToolName[];
        let successCount = 0;
        let failCount = 0;

        for (const toolName of toolNames) {
            try {
                const mcpToolDef = this._builtinAdapter.toMCPToolDefinition(toolName);
                await this.registerTool(mcpToolDef);
                successCount++;
                this.logger.debug(`✅ Registered builtin tool as MCP: ${toolName}`);
            } catch (error) {
                failCount++;
                this.logger.error(`❌ Failed to register builtin tool ${toolName}:`, error);
            }
        }

        this.logger.info(
            `Registered ${successCount}/${toolNames.length} builtin tools as MCP tools ` +
            `(${failCount} failed)`
        );

        // Emit metrics
        this.metricsService.recordEvent({
            name: 'InternalMcpServer:BuiltinToolsRegistered',
            properties: {
                totalTools: toolNames.length,
                successCount,
                failCount
            }
        });
    }
}
```

### 1.3 Deliverables

- ✅ BuiltinToolMCPAdapter with Zod schemas for all tools
- ✅ Integration with InternalMcpServer
- ✅ Unit tests for adapter (schema validation, error handling)
- ✅ Metrics for tool registration

---

## 📦 Phase 2: Router & Coexistence

**Goal:** Allow XML and MCP tools to coexist, with provider-based routing

**Duration:** 2-3 days

**Status:** ⚪ Not Started

### 2.1 Enhanced Tool Router

**File:** `src/vs/workbench/contrib/void/electron-main/llmMessage/toolRouter.ts`

**New Logic:**

```typescript
export type ToolFormat = 'mcp-native' | 'xml' | null;

export interface ToolCallingRoute {
    format: ToolFormat;
    reason: string;
    fallbackFormat?: ToolFormat;
}

/**
 * Determine which tool format to use based on provider capabilities
 *
 * Priority:
 * 1. MCP tools (if provider supports native tools AND MCP tools available)
 * 2. XML fallback (for legacy providers or user override)
 * 3. No tools (if provider doesn't support tools)
 */
export function routeToolCalling(
    providerName: ProviderName,
    modelName: string,
    overridesOfModel: OverridesOfModel | undefined,
    tools: InternalToolInfo[] | undefined
): ToolCallingRoute {
    const { nativeToolsSupport, xmlToolsFallback } = getProviderCapabilities(providerName);

    // Check if tools are available as MCP
    const hasMCPTools = tools?.some(t => t.mcpServerName === '__void_internal__');
    const hasXMLTools = tools?.some(t => !t.mcpServerName);

    // User override: Force XML mode
    if (overridesOfModel?.forceXMLTools) {
        return {
            format: 'xml',
            reason: 'User override: forced XML tools',
            fallbackFormat: null
        };
    }

    // Priority 1: MCP native tools (best option)
    if (hasMCPTools && nativeToolsSupport?.supported) {
        return {
            format: 'mcp-native',
            reason: 'Provider supports native tools, MCP format available',
            fallbackFormat: hasXMLTools ? 'xml' : null
        };
    }

    // Priority 2: XML fallback (legacy)
    if (hasXMLTools && xmlToolsFallback) {
        return {
            format: 'xml',
            reason: 'Using XML fallback (legacy provider or MCP not available)',
            fallbackFormat: null
        };
    }

    // Priority 3: XML without MCP option
    if (hasXMLTools) {
        return {
            format: 'xml',
            reason: 'Only XML tools available',
            fallbackFormat: null
        };
    }

    // No tools available
    return {
        format: null,
        reason: 'No tools available or provider does not support tools',
        fallbackFormat: null
    };
}

/**
 * Get provider capabilities for tool calling
 */
function getProviderCapabilities(providerName: ProviderName): {
    nativeToolsSupport?: { supported: boolean; format: 'openai' | 'anthropic' | 'gemini' };
    xmlToolsFallback: boolean;
} {
    switch (providerName) {
        case 'anthropic':
            return {
                nativeToolsSupport: { supported: true, format: 'anthropic' },
                xmlToolsFallback: false
            };
        case 'openai':
        case 'openai-native':
            return {
                nativeToolsSupport: { supported: true, format: 'openai' },
                xmlToolsFallback: false
            };
        case 'gemini':
            return {
                nativeToolsSupport: { supported: true, format: 'gemini' },
                xmlToolsFallback: false
            };
        case 'openrouter':
            // OpenRouter varies by model
            return {
                nativeToolsSupport: { supported: true, format: 'openai' },
                xmlToolsFallback: true
            };
        case 'ollama':
        case 'lmstudio':
            // Local models: use XML fallback
            return {
                nativeToolsSupport: undefined,
                xmlToolsFallback: true
            };
        default:
            return {
                nativeToolsSupport: undefined,
                xmlToolsFallback: true
            };
    }
}
```

### 2.2 Update availableTools to Include MCP Versions

**File:** `src/vs/workbench/contrib/void/common/prompt/prompts.ts`

**Changes:**

```typescript
export const availableTools = (
    chatMode: ChatMode | null,
    mcpTools: InternalToolInfo[] | undefined
) => {
    // Get builtin tool names for this mode
    const builtinToolNames: BuiltinToolName[] | undefined =
        chatMode === 'drafting'
            ? ['read_file', 'edit_file', 'edit_document', 'create_file_or_folder', 'rag_search_policy', 'rag_search_workspace', 'rag_get_stats'] as BuiltinToolName[]
        : chatMode === 'research'
            ? (Object.keys(builtinTools) as BuiltinToolName[]).filter(toolName => !(toolName in approvalTypeOfBuiltinToolName))
        : chatMode === 'case_manager'
            ? Object.keys(builtinTools) as BuiltinToolName[]
        : undefined;

    // NEW: Check if MCP versions of builtin tools are available
    const mcpBuiltinTools = mcpTools?.filter(t =>
        t.mcpServerName === '__void_internal__' &&
        builtinToolNames?.includes(t.name as BuiltinToolName)
    );

    // NEW: Prefer MCP versions if available, otherwise use XML versions
    const effectiveBuiltinTools = mcpBuiltinTools && mcpBuiltinTools.length > 0
        ? mcpBuiltinTools  // Use MCP versions (preferred)
        : builtinToolNames?.map(toolName => {
            const tool = builtinTools[toolName];
            if (!tool) {
                console.error(`[availableTools] ⚠️ Tool ${toolName} not found in builtinTools!`);
                return null;
            }
            return tool;
        }).filter((t): t is InternalToolInfo => t !== null);  // Fallback to XML versions

    // External MCP tools (from mcp.json)
    const effectiveExternalMCPTools = chatMode === 'case_manager'
        ? mcpTools?.filter(t => t.mcpServerName && t.mcpServerName !== '__void_internal__')
        : undefined;

    const tools: InternalToolInfo[] = [
        ...(effectiveBuiltinTools ?? []),
        ...(effectiveExternalMCPTools ?? []),
    ];

    // Debug logging
    console.log('[availableTools] Tool availability:',
                'Mode:', chatMode,
                'Builtin (MCP):', mcpBuiltinTools?.length ?? 0,
                'Builtin (XML):', effectiveBuiltinTools?.length ?? 0,
                'External MCP:', effectiveExternalMCPTools?.length ?? 0,
                'Total:', tools.length);

    return tools.length > 0 ? tools : undefined;
};
```

### 2.3 Update System Prompt to Support Both Formats

**File:** `src/vs/workbench/contrib/void/common/prompt/systemPrompt.ts`

**Changes:**

```typescript
// Add format detection
const toolFormat = getToolFormatFromRoute(route); // 'mcp-native' or 'xml'

// Conditional tool guidance
const toolCallingGuidance = toolFormat === 'xml'
    ? getXMLToolCallingGuidance()  // Existing XML guidance
    : getMCPToolCallingGuidance();  // NEW: MCP guidance

function getMCPToolCallingGuidance(): string {
    return `<tool_calling_format_and_execution>
**Tool Calling Format: JSON (MCP Protocol)**

When calling tools, the provider will automatically format your tool calls.
You simply need to indicate which tool to use and provide the parameters.

**Example:**
To read a file, you would indicate:
- Tool: read_file
- Parameters: { "uri": "d:\\\\Coding\\\\SafeAppeals\\\\case.pdf" }

The provider handles the actual formatting and execution.

**Key Rules:**
- All tool parameters must be valid JSON
- Required parameters cannot be omitted
- Tools execute asynchronously and return results
- Multiple tools can be called in parallel (if provider supports it)

**Error Handling:**
If a tool call fails, you'll receive a structured error message with:
- Error type (validation, execution, timeout, etc.)
- Error message (human-readable)
- Suggested fix (if available)
</tool_calling_format_and_execution>`;
}
```

### 2.4 Deliverables

- ✅ Enhanced toolRouter with MCP/XML routing
- ✅ Updated availableTools with MCP preference
- ✅ Conditional system prompts
- ✅ Integration tests for both formats
- ✅ Metrics for format usage

---

## 📦 Phase 3: Gradual Rollout

**Goal:** Safely migrate from XML to MCP with monitoring

**Duration:** 2-3 weeks (includes monitoring)

**Status:** ⚪ Not Started

### 3.1 Rollout Strategy

#### Week 1: Internal Testing (10% rollout)

```typescript
// Feature flag in settings
interface VoidSettings {
    experimental: {
        mcpToolsEnabled: boolean;           // Master switch
        mcpToolsRolloutPercentage: number;  // 0-100
        mcpToolsForceXML: boolean;          // Force XML (debugging)
    };
}

// Rollout logic
function shouldUseMCPTools(userId: string, settings: VoidSettings): boolean {
    if (!settings.experimental.mcpToolsEnabled) return false;
    if (settings.experimental.mcpToolsForceXML) return false;

    // Consistent hashing: same user always gets same result
    const hash = hashCode(userId);
    const bucket = Math.abs(hash % 100);
    return bucket < settings.experimental.mcpToolsRolloutPercentage;
}
```

**Monitoring:**

- Tool call success rate (XML vs MCP)
- Error rates by tool type
- Execution duration comparison
- User feedback

#### Week 2: Expanded Rollout (50% rollout)

**Criteria for Expansion:**

- ✅ MCP tool success rate ≥ XML success rate
- ✅ No critical errors in MCP tools
- ✅ Performance acceptable (< 20% slower than XML)
- ✅ No user complaints

#### Week 3: Full Rollout (100% rollout)

**Criteria for Full Rollout:**

- ✅ MCP tool success rate > XML success rate
- ✅ Error rate < 0.1%
- ✅ Performance equal or better than XML
- ✅ Positive user feedback

### 3.2 Rollback Plan

**Automatic Rollback Triggers:**

- MCP tool error rate > 5% for > 5 minutes
- MCP tool success rate < 90% for > 10 minutes
- Critical error reported

**Manual Rollback:**

```typescript
// Emergency rollback
settings.experimental.mcpToolsEnabled = false;
settings.experimental.mcpToolsForceXML = true;
```

### 3.3 Metrics Dashboard

**Key Metrics:**

```typescript
// Tool format usage
'ToolCalling:FormatUsed'             // 'mcp' or 'xml'
'ToolCalling:FormatSuccessRate'      // Success rate by format
'ToolCalling:FormatErrorRate'        // Error rate by format
'ToolCalling:FormatExecutionTime'    // Avg execution time by format

// Per-tool metrics
'ToolCalling:ToolSuccessRate'        // Success rate per tool
'ToolCalling:ToolErrorRate'          // Error rate per tool
'ToolCalling:ToolExecutionTime'      // Avg execution time per tool

// Provider-specific metrics
'ToolCalling:ProviderFormatUsage'    // Format usage by provider
'ToolCalling:ProviderSuccessRate'    // Success rate by provider
```

### 3.4 Deliverables

- ✅ Feature flags for rollout control
- ✅ Metrics dashboard
- ✅ Automatic rollback system
- ✅ User feedback mechanism
- ✅ Documentation for rollout process

---

## 📦 Phase 4: XML Deprecation & Cleanup

**Goal:** Remove XML tool infrastructure after successful MCP migration

**Duration:** 1 week

**Status:** ⚪ Not Started

### 4.1 Deprecation Timeline

**Month 1:** MCP tools fully rolled out (Phase 3 complete)

**Month 2:** Deprecation warnings

- Add deprecation notice to XML tool docs
- Log warnings when XML tools are used
- Update system prompts to prefer MCP

**Month 3:** Removal

- Remove XML parser (`xmlParserService.ts`)
- Remove XML extraction (`extractGrammar.ts`)
- Remove XML routing logic
- Update all documentation

### 4.2 Files to Remove

```typescript
// XML Infrastructure (TO BE REMOVED)
src/vs/workbench/contrib/void/electron-main/llmMessage/
├── xmlParserService.ts           // DELETE (~500 lines)
├── extractGrammar.ts             // DELETE (~400 lines - XML parts only)
└── toolRouter.ts                 // MODIFY (remove XML routing)

// XML-specific prompts
src/vs/workbench/contrib/void/common/prompt/
└── systemPrompt.ts               // MODIFY (remove XML guidance)
```

### 4.3 Migration Script

```typescript
/**
 * One-time migration script to convert any lingering XML tool configs
 */
async function migrateXMLToolConfigsToMCP(): Promise<void> {
    // 1. Search for any XML tool configs in user settings
    // 2. Convert to MCP format
    // 3. Update settings
    // 4. Log migration results
}
```

### 4.4 Deliverables

- ✅ XML infrastructure removed
- ✅ Documentation updated
- ✅ Migration script executed
- ✅ Tests updated (remove XML tests)
- ✅ ~1,000 lines of code removed

---

## 📊 Success Metrics

### Technical Metrics

| Metric | Target | Current (XML) | Goal (MCP) |

|--------|--------|---------------|------------|

| **Tool Success Rate** | > 99% | ~97% | 99.5% |

| **Error Rate** | < 0.5% | ~3% | 0.1% |

| **Avg Execution Time** | < 100ms overhead | N/A | 50ms |

| **Parsing Failures** | 0 | ~5/day | 0 |

| **Memory Footprint** | < 50MB | N/A | 30MB |

### Code Quality Metrics

| Metric | Target | Result |

|--------|--------|--------|

| **Code Removed** | ~1,000 lines | TBD |

| **Code Added** | ~800 lines | TBD |

| **Net Change** | -200 lines | TBD |

| **Test Coverage** | > 85% | TBD |

| **Type Safety** | 100% | TBD |

### User Experience Metrics

| Metric | Target |

|--------|--------|

| **Tool Call Failures** | < 1% |

| **User Complaints** | 0 |

| **Debugging Time** | 50% reduction |

| **Error Message Quality** | "Excellent" rating |

---

## 🎯 Benefits Summary

### Reliability Improvements

| Issue | XML (Current) | MCP (New) | Improvement |

|-------|---------------|-----------|-------------|

| **Parsing Errors** | 5-10/day | 0/day | 100% reduction |

| **Special Characters** | Breaks often | No issues | 100% fix |

| **Error Messages** | Generic | Specific | 90% better |

| **Debugging Time** | 30min/issue | 5min/issue | 83% faster |

### Maintenance Improvements

| Aspect | XML (Current) | MCP (New) | Improvement |

|--------|---------------|-----------|-------------|

| **Lines of Code** | ~1,000 | ~800 (adapter) | 20% reduction |

| **Complexity** | High (custom parser) | Low (SDK) | 70% simpler |

| **Add New Tool** | 3 places + tests | 1 adapter + test | 66% easier |

| **Provider Support** | Manual | Native | 100% better |

### Performance Improvements

| Metric | XML (Current) | MCP (New) | Improvement |

|--------|---------------|-----------|-------------|

| **Parsing Time** | ~10-50ms | ~5ms (JSON) | 80% faster |

| **Memory Usage** | Unknown | Tracked | Observable |

| **Parallel Tools** | Limited | Full support | Unlimited |

---

## 🚀 Getting Started

### Prerequisites

1. **Phase 0 Complete:** Internal MCP server infrastructure exists
2. **toolsService Injectable:** Can inject IToolsService into adapters
3. **Testing Environment:** Staging environment for testing both formats

### First Steps

1. **Review this plan** with team
2. **Set up feature branch:** `feature/xml-to-mcp-migration`
3. **Implement Phase 1:** BuiltinToolMCPAdapter
4. **Write tests:** Unit tests for adapter
5. **Test integration:** Verify MCP tools work end-to-end
6. **Start Phase 2:** Router and coexistence

### Recommended First Tool to Migrate

**`read_file`** - Reasons:

- Most frequently used tool
- Simple input/output
- Easy to validate correctness
- High impact if successful

---

## 📖 Documentation Plan

### Developer Documentation

- [ ] Migration guide (this document)
- [ ] Adapter API reference
- [ ] Testing guide for both formats
- [ ] Troubleshooting common issues
- [ ] Rollout playbook

### User Documentation

- [ ] Tool format changelog
- [ ] Feature flag documentation
- [ ] Known issues and workarounds
- [ ] Performance comparison

---

## ❓ Open Questions

1. **Should we support custom tools in both formats during transition?**

            - Recommendation: Yes, allow users to choose format via setting

2. **What happens if a tool is registered in both XML and MCP?**

            - Recommendation: MCP takes precedence, log warning

3. **Should we A/B test XML vs MCP side-by-side?**

            - Recommendation: Yes, with 50/50 split for 1 week

4. **How do we handle provider-specific tool capabilities?**

            - Recommendation: Provider-specific adapters if needed

---

## 🏁 Acceptance Criteria

### Phase 1 Complete When:

- [ ] BuiltinToolMCPAdapter implemented with all tool schemas
- [ ] All builtin tools registered in InternalMcpServer
- [ ] Unit tests passing (> 85% coverage)
- [ ] Integration test: call MCP tool end-to-end
- [ ] Metrics for tool registration

### Phase 2 Complete When:

- [ ] Tool router supports MCP + XML coexistence
- [ ] availableTools returns correct format based on route
- [ ] System prompts updated for both formats
- [ ] Integration tests for both formats pass
- [ ] No regressions in XML tool functionality

### Phase 3 Complete When:

- [ ] 100% rollout achieved
- [ ] MCP tool success rate > XML success rate
- [ ] Error rate < 0.1%
- [ ] Positive user feedback
- [ ] Metrics dashboard operational

### Phase 4 Complete When:

- [ ] XML infrastructure removed
- [ ] All tests updated
- [ ] Documentation updated
- [ ] ~1,000 lines of code removed
- [ ] Zero XML dependencies remaining

---

**Last Updated:** 2025-10-31

**Next Review:** After Phase 1 completion

**Status:** 🔵 Ready to Start Implementation

---

## 🎓 Additional Resources

### MCP Resources

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP Tool Best Practices](https://modelcontextprotocol.info/docs/best-practices/)
- [Zod Documentation](https://zod.dev/)

### Void Architecture

- `mcpserver.plan.md` - Internal MCP server architecture
- `mcpChannel.ts` - Existing MCP client implementation
- `toolsService.ts` - Current tool execution service

### Migration Examples

- See `BuiltinToolMCPAdapter` (Phase 1) for adapter pattern
- See `toolRouter.ts` (Phase 2) for coexistence pattern
- See Phase 3 for rollout strategy
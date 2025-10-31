# 🏗️ Internal MCP Server Architecture - Implementation Plan

**Status:** 🔵 In Planning

**Priority:** High

**Complexity:** High

**Created:** 2025-10-31

**Last Updated:** 2025-10-31

---

## 📋 Overview

This plan outlines the complete architecture and implementation strategy for adding a **robust, production-ready internal MCP (Model Context Protocol) server** to the Void application. The server will run in the electron-main process with full Node.js access, use IPC channels for browser-to-main communication, and provide extensible tool registration capabilities.

### Goals

- ✅ Create a production-grade internal MCP server in TypeScript
- ✅ Follow Void's architectural patterns (IPC channels, services, disposables)
- ✅ Implement comprehensive error handling and recovery
- ✅ Support dynamic tool registration and lifecycle management
- ✅ Integrate with Void's metrics and logging systems
- ✅ Maintain full type safety throughout

### Non-Goals

- ❌ Replace external MCP servers (this is complementary)
- ❌ Implement specific tools in this phase (foundation only)
- ❌ Create UI components (backend focus)

---

## 🏗️ Architecture Overview

### System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    BROWSER PROCESS                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         InternalMcpService (common/)                 │  │
│  │  - getTools()                                        │  │
│  │  - callTool(name, params)                           │  │
│  │  - onStateChange event                              │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │ IPC: 'void-channel-internal-mcp'     │
└─────────────────────┼───────────────────────────────────────┘
                      │
                      │ Electron IPC
                      │
┌─────────────────────▼───────────────────────────────────────┐
│                    MAIN PROCESS                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         InternalMcpChannel (IServerChannel)          │  │
│  │  - listen() for events                              │  │
│  │  - call() for commands                              │  │
│  └──────────────────┬───────────────────────────────────┘  │
│                     │                                       │
│  ┌──────────────────▼───────────────────────────────────┐  │
│  │         InternalMcpServer (Core Orchestrator)        │  │
│  │  ┌────────────┐  ┌─────────────┐  ┌──────────────┐  │  │
│  │  │ Lifecycle  │  │   Error     │  │     Tool     │  │  │
│  │  │  Manager   │  │   Handler   │  │   Registry   │  │  │
│  │  └────────────┘  └─────────────┘  └──────────────┘  │  │
│  │  ┌────────────┐  ┌─────────────┐                    │  │
│  │  │ Transport  │  │   Logger    │                    │  │
│  │  │  Adapter   │  │             │                    │  │
│  │  └────────────┘  └─────────────┘                    │  │
│  │                                                        │  │
│  │  Uses: @modelcontextprotocol/sdk                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Breakdown

1. **InternalMcpServer** - Core orchestrator

   - Manages MCP SDK server instance
   - Coordinates subsystems
   - Handles lifecycle transitions
   - Exposes public API

2. **ServerLifecycle** - State machine

   - Manages server states (initializing, ready, connected, error, shutting_down, stopped)
   - Validates state transitions
   - Tracks active operations
   - Handles graceful shutdown

3. **ServerErrorHandler** - Error management

   - Classifies errors by severity
   - Determines recovery strategies
   - Tracks error metrics
   - Escalates critical errors

4. **ToolRegistry** - Tool management

   - Registers tools dynamically
   - Validates input/output with Zod
   - Executes tools safely
   - Tracks tool metrics

5. **InternalTransport** - Custom transport

   - In-memory transport adapter
   - Bypasses stdio/HTTP overhead
   - Direct method invocation

6. **ServerLogger** - Structured logging

   - Wraps ILogService
   - Adds context and formatting
   - Integrates with Void logging

---

## 📁 File Structure

```
src/vs/workbench/contrib/void/
├── common/
│   └── internalMcp/
│       ├── internalMcpService.ts          [Interface & service decorator]
│       ├── internalMcpTypes.ts            [Shared types & interfaces]
│       └── internalMcpErrors.ts           [Error class definitions]
│
├── electron-main/
│   └── internalMcp/
│       ├── server/
│       │   ├── InternalMcpServer.ts       [Core server class - 400 lines]
│       │   ├── ServerLifecycle.ts         [Lifecycle management - 250 lines]
│       │   ├── ServerErrorHandler.ts      [Error handling - 350 lines]
│       │   └── ServerLogger.ts            [Logging wrapper - 100 lines]
│       │
│       ├── tools/
│       │   ├── ToolRegistry.ts            [Tool registration - 300 lines]
│       │   ├── ToolValidator.ts           [Zod validation - 200 lines]
│       │   └── ToolExecutor.ts            [Execution wrapper - 150 lines]
│       │
│       ├── transport/
│       │   ├── InternalTransport.ts       [Custom transport - 200 lines]
│       │   └── TransportAdapter.ts        [MCP SDK adapter - 150 lines]
│       │
│       ├── InternalMcpChannel.ts          [IPC channel - 150 lines]
│       └── InternalMcpMainService.ts      [Main process service - 100 lines]
│
└── browser/
    └── internalMcp/
        └── internalMcpServiceImpl.ts      [Browser implementation - 200 lines]
```

**Total Estimated LOC:** ~2,550 lines

---

## 🔧 Technical Specifications

### Core Technologies

- **MCP SDK:** `@modelcontextprotocol/sdk` (official TypeScript SDK)
- **Validation:** `zod` (runtime type validation)
- **Architecture:** VSCode service pattern with dependency injection

### Key Interfaces

```typescript
// Server states
type ServerState =
    | 'initializing'   // Constructor, not ready
    | 'ready'          // Initialized, can accept connections
    | 'connected'      // MCP client connected
    | 'error'          // Recoverable error state
    | 'shutting_down'  // Graceful shutdown in progress
    | 'stopped'        // Fully stopped

// Tool definition
interface ToolDefinition {
    name: string;
    description: string;
    inputSchema: z.ZodSchema;
    outputSchema: z.ZodSchema;
    handler: (params: any) => Promise<CallToolResult>;
    metadata?: {
        category?: string;
        requiresAuth?: boolean;
        estimatedDuration?: number;
    };
}

// Error severity levels
enum ErrorSeverity {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
    CRITICAL = 'critical'
}

// Recovery strategies
interface RecoveryStrategy {
    canRecover: boolean;
    strategy: 'retry_with_backoff' | 'restart_required' | 'manual_intervention';
    maxRetries?: number;
}
```

### Error Handling Layers

```typescript
// 1. Transport Layer Errors
class TransportError extends Error {
    constructor(message: string, public code: TransportErrorCode) {}
}

// 2. Protocol Layer Errors (MCP-spec)
class McpProtocolError extends Error {
    constructor(message: string, public jsonRpcCode: number) {}
}

// 3. Application Layer Errors (tool execution)
class ToolExecutionError extends Error {
    constructor(
        message: string,
        public toolName: string,
        public isRecoverable: boolean
    ) {}
}

// 4. System Layer Errors (critical)
class ServerFatalError extends Error {
    constructor(message: string, public shouldRestart: boolean) {}
}
```

---

## 📝 Implementation Phases

### Phase 1: Foundation (Server Architecture) 🔵 Current Focus

**Estimated Time:** 3-4 days

**Files:** 12 files, ~2,000 lines

#### Tasks

- [ ] Create folder structure (`common/internalMcp/`, `electron-main/internalMcp/`)
- [ ] Define types (`internalMcpTypes.ts`, `internalMcpErrors.ts`)
- [ ] Implement `ServerLogger.ts` (logging wrapper)
- [ ] Implement `ServerLifecycle.ts` (state machine)
- [ ] Implement `ServerErrorHandler.ts` (error management)
- [ ] Implement `InternalTransport.ts` (custom transport)
- [ ] Implement `TransportAdapter.ts` (MCP SDK adapter)
- [ ] Implement `InternalMcpServer.ts` (core orchestrator)
- [ ] Implement `InternalMcpChannel.ts` (IPC bridge)
- [ ] Register channel in `app.ts`
- [ ] Implement `InternalMcpService` (browser service)
- [ ] Write unit tests for lifecycle and error handling

#### Deliverables

✅ Fully functional server infrastructure

✅ Complete error handling system

✅ Lifecycle management with graceful shutdown

✅ IPC communication working

✅ Browser service can connect to main process

✅ Comprehensive logging and metrics

#### Acceptance Criteria

- Server initializes without errors
- State transitions work correctly
- Error handling recovers from common failures
- IPC channel responds to commands
- No memory leaks (Disposable pattern verified)
- All subsystems integrate correctly

---

### Phase 2: Tool System (Dynamic Registration) ⚪ Not Started

**Estimated Time:** 2-3 days

**Files:** 3 files, ~650 lines

#### Tasks

- [ ] Implement `ToolRegistry.ts` (registration system)
- [ ] Implement `ToolValidator.ts` (Zod validation)
- [ ] Implement `ToolExecutor.ts` (execution wrapper)
- [ ] Add Zod to JSON Schema converter
- [ ] Implement tool metrics tracking
- [ ] Create sample test tool
- [ ] Write tool execution tests
- [ ] Document tool creation API

#### Deliverables

✅ Tool registration API

✅ Input/output validation with Zod

✅ Safe tool execution with error handling

✅ Tool metrics (call count, error rate, duration)

✅ Sample tool implementation

✅ Tool developer documentation

#### Acceptance Criteria

- Tools can be registered dynamically
- Input validation prevents bad data
- Tool errors are handled gracefully
- Tool metrics are captured
- Sample tool executes successfully
- Tool can be unregistered (disposable)

---

### Phase 3: Void Integration ⚪ Not Started

**Estimated Time:** 2 days

**Files:** Modified existing files

#### Tasks

- [ ] Update `mcpService.ts` to query internal tools
- [ ] Combine external + internal tools in `getMCPTools()`
- [ ] Update `llmMessageService.ts` to include internal tools
- [ ] Update `chatThreadService.ts` for internal tool execution
- [ ] Add internal tools to chat agent tool list
- [ ] Update MCP settings UI (if needed)
- [ ] Integration testing with chat agent
- [ ] End-to-end testing

#### Deliverables

✅ Internal tools appear in chat agent

✅ LLM can call internal tools

✅ Tool results flow back to chat

✅ External and internal tools coexist

✅ Settings UI supports both types

#### Acceptance Criteria

- Internal tools visible to LLM
- Chat agent can execute internal tools
- Tool responses render correctly
- No conflicts between external/internal tools
- Performance is acceptable (< 100ms overhead)

---

## 🎯 Success Metrics

### Technical Metrics

- **Reliability:** 99.9% uptime, no crashes
- **Performance:** Tool execution < 100ms overhead
- **Error Rate:** < 0.1% of tool calls fail
- **Memory:** No leaks, < 50MB baseline footprint
- **Response Time:** IPC calls < 10ms average

### Code Quality Metrics

- **Test Coverage:** > 80% for core modules
- **Type Safety:** 100% TypeScript, no `any` types
- **Documentation:** All public APIs documented
- **Linting:** Zero ESLint errors
- **Complexity:** Cyclomatic complexity < 15

---

## 🔍 Key Design Decisions

### 1. Why IPC Channel Pattern?

**Decision:** Use IPC channels rather than in-memory transport

**Rationale:**

- Consistent with Void's architecture (MCPChannel, RAGMainChannel)
- Main process has full Node.js access for tools
- Clean separation of concerns
- Easy to test independently
- Matches existing patterns (less learning curve)

**Alternatives Considered:**

- ❌ Direct integration in browser process (no Node.js access)
- ❌ Separate process with stdio (unnecessary overhead)
- ❌ In-memory transport (VSCode API not ready)

### 2. Why Custom Transport vs. Stdio?

**Decision:** Implement custom in-memory transport

**Rationale:**

- Avoid process spawning overhead
- Direct method invocation faster
- Simpler debugging (same process)
- No stdio parsing complexity

**Trade-offs:**

- Custom code vs. battle-tested stdio
- But: simpler, faster, fits our use case

### 3. Why Separate Error Handler?

**Decision:** Dedicated ServerErrorHandler class

**Rationale:**

- Centralized error handling logic
- Consistent error classification
- Recovery strategies in one place
- Easier to test error scenarios
- Metrics tracking centralized

### 4. Why State Machine for Lifecycle?

**Decision:** Explicit state machine with transitions

**Rationale:**

- Clear valid states and transitions
- Prevents invalid state combinations
- Easier to reason about lifecycle
- Guards prevent illegal transitions
- Actions ensure proper sequencing

---

## 🛡️ Robustness Checklist

### Error Handling ✅

- [x] All async operations wrapped in try-catch
- [x] Error classification system (4 severity levels)
- [x] Recovery strategies for each error type
- [x] Error rate limiting to prevent spam
- [x] Critical error escalation
- [x] User-friendly error messages
- [x] Structured error logging

### Lifecycle Management ✅

- [x] State machine with valid transitions
- [x] Graceful shutdown with timeout
- [x] Active operation tracking
- [x] Resource cleanup on shutdown (Disposable)
- [x] Restart capability for recovery
- [x] Connection lifecycle handling

### Logging & Monitoring ✅

- [x] Structured logging (info, warn, error)
- [x] Performance metrics (execution time)
- [x] Error rate tracking
- [x] State change events
- [x] Tool execution metrics
- [x] Integration with IMetricsService

### Type Safety ✅

- [x] Full TypeScript coverage
- [x] Zod schemas for runtime validation
- [x] JSON Schema generation for LLM
- [x] Type guards for error handling
- [x] Branded types for domain objects
- [x] No `any` types allowed

### Performance ✅

- [x] Tool execution timeouts
- [x] Async/await for non-blocking
- [x] Memory leak prevention (Disposable)
- [x] Operation tracking for monitoring
- [x] Efficient IPC communication

### Security ✅

- [x] Input validation (Zod schemas)
- [x] Output sanitization
- [x] No eval() or unsafe code
- [x] Error messages don't leak internals
- [x] Rate limiting (future enhancement)

---

## 📚 Research References

### Official Documentation

- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) - Official SDK
- [MCP Specification](https://modelcontextprotocol.io/specification) - Protocol spec
- [VSCode MCP Guide](https://code.visualstudio.com/api/extension-guides/ai/mcp) - VSCode integration

### Code Examples

- [Production MCP Template](https://github.com/cyanheads/mcp-ts-template) - Production patterns
- [BifrostMCP](https://github.com/biegehydra/BifrostMCP) - VSCode semantic tools
- [VSCode MCP Server](https://github.com/juehang/vscode-mcp-server) - Real implementation

### Best Practices

- [MCP Error Handling Guide](https://dev.to/yigit-konur/error-handling-in-mcp-typescript-sdk-2ol7)
- [MCP Server Development Guide](https://github.com/cyanheads/model-context-protocol-resources/blob/main/guides/mcp-server-development-guide.md)
- [MCP Best Practices](https://modelcontextprotocol.info/docs/best-practices/)

### Void Architecture

- Void's `MCPChannel` (external servers reference)
- Void's `RAGMainChannel` (IPC pattern reference)
- Void's `MetricsMainService` (service pattern reference)

---

## 🧪 Testing Strategy

### Unit Tests

**Scope:** Individual components in isolation

**Files to Test:**

- `ServerLifecycle` - State transitions
- `ServerErrorHandler` - Error classification
- `ToolRegistry` - Registration/unregistration
- `ToolValidator` - Input/output validation
- `ToolExecutor` - Execution wrapping

**Coverage Target:** > 80%

### Integration Tests

**Scope:** Subsystems working together

**Test Scenarios:**

- Server initialization flow
- Tool registration → execution → cleanup
- Error handling → recovery
- Lifecycle transitions with operations
- IPC channel communication

### End-to-End Tests

**Scope:** Full system integration

**Test Scenarios:**

- Register internal tool → LLM calls it → result returns
- Tool error → proper error response to LLM
- Server shutdown → all resources cleaned
- Multiple tools executing concurrently
- External + internal tools coexisting

---

## 🚀 Deployment Plan

### Step 1: Deploy Foundation (Phase 1)

1. Merge foundation PR after review
2. Monitor for errors in dev/staging
3. Verify no memory leaks (run overnight)
4. Check metrics for anomalies
5. Get user feedback (internal team)

### Step 2: Deploy Tool System (Phase 2)

1. Add sample tool for testing
2. Test tool registration/execution
3. Monitor tool metrics
4. Verify error handling works
5. Deploy to production

### Step 3: Deploy Integr ation (Phase 3)

1. Enable internal tools in chat agent
2. Monitor LLM tool call success rate
3. Check performance impact
4. Gather user feedback
5. Iterate based on feedback

### Rollback Plan

- If critical error: disable internal tools via feature flag
- If memory leak: revert to previous version
- If performance issue: disable specific problematic tool
- All changes gated behind feature flags

---

## 📊 Monitoring & Observability

### Key Metrics to Track

```typescript
// Server Health
- 'InternalMcpServer:StateChange' (state transitions)
- 'InternalMcpServer:Initialized' (startup success)
- 'InternalMcpServer:Error' (error occurrences)
- 'InternalMcpServer:Shutdown' (shutdown events)

// Tool Execution
- 'InternalMcpServer:ToolCall' (tool invocations)
- 'InternalMcpServer:ToolSuccess' (successful executions)
- 'InternalMcpServer:ToolError' (failed executions)
- 'InternalMcpServer:ToolDuration' (execution time)

// Performance
- 'InternalMcpServer:IPCLatency' (IPC round-trip time)
- 'InternalMcpServer:MemoryUsage' (memory footprint)
- 'InternalMcpServer:ActiveOperations' (concurrent operations)
```

### Health Checks

- Server state is 'ready' or 'connected' (not 'error')
- Error rate < 0.1% of operations
- Memory usage stable over time
- IPC latency < 10ms average

### Alerting Rules

- **Critical:** Server state is 'error' for > 5 minutes
- **Critical:** Error rate > 1% for > 5 minutes
- **Warning:** Memory usage increases > 100MB/hour
- **Warning:** IPC latency > 50ms average

---

## 🤝 Dependencies

### External Packages

```json
{
  "@modelcontextprotocol/sdk": "^1.0.0",
  "zod": "^3.22.0"
}
```

### Internal Dependencies

- `IMetricsService` (common/) - Metrics tracking
- `ILogService` (platform/) - Logging
- `IMainProcessService` (platform/) - IPC
- VSCode's `Disposable` pattern

### Optional Future Dependencies

- Authentication service (for tool permissions)
- Rate limiting service (for tool throttling)
- Caching service (for expensive tool results)

---

## 🔮 Future Enhancements

### Short Term (Next 3 months)

- [ ] Add 5-10 useful internal tools
- [ ] Tool permission system
- [ ] Tool rate limiting
- [ ] Tool result caching
- [ ] Tool execution history UI

### Medium Term (3-6 months)

- [ ] Hot reload tool changes
- [ ] Tool marketplace/registry
- [ ] Tool versioning
- [ ] A/B testing for tools
- [ ] Tool analytics dashboard

### Long Term (6-12 months)

- [ ] Tool chaining/composition
- [ ] Async tool execution
- [ ] Tool webhooks/callbacks
- [ ] Multi-language tool support
- [ ] Tool sandboxing

---

## 📖 Documentation Plan

### Developer Documentation

- [ ] Architecture overview (this document)
- [ ] API reference (JSDoc comments)
- [ ] Tool creation guide
- [ ] Error handling guide
- [ ] Testing guide

### User Documentation

- [ ] Internal tools user guide
- [ ] Troubleshooting guide
- [ ] FAQ
- [ ] Example use cases

### Code Documentation

- [ ] JSDoc comments on all public APIs
- [ ] Inline comments for complex logic
- [ ] README in `internalMcp/` folder
- [ ] Architecture diagrams

---

## 🎓 Learning Resources

### For Developers Working on This

1. Read MCP specification (1 hour)
2. Study VSCode service patterns (2 hours)
3. Review Void's MCPChannel implementation (1 hour)
4. Understand IPC communication in Void (1 hour)
5. Learn Zod validation library (1 hour)

### Required Knowledge

- TypeScript (advanced)
- Async/await patterns
- Error handling strategies
- VSCode extension architecture
- MCP protocol basics

---

## ✅ Acceptance Criteria (Complete Plan)

### Phase 1 Complete When:

- [x] All foundation files implemented
- [x] Server initializes without errors
- [x] State machine works correctly
- [x] Error handling tested
- [x] IPC communication verified
- [x] No memory leaks detected
- [x] Unit tests passing (> 80% coverage)

### Phase 2 Complete When:

- [ ] Tool registration API works
- [ ] Zod validation prevents bad input
- [ ] Sample tool executes successfully
- [ ] Tool metrics captured
- [ ] Tool developer documentation written
- [ ] Integration tests passing

### Phase 3 Complete When:

- [ ] Internal tools visible in chat
- [ ] LLM can call internal tools
- [ ] Results render correctly
- [ ] External + internal tools coexist
- [ ] End-to-end tests passing
- [ ] Production deployment successful

---

## 🏁 Getting Started

### Immediate Next Steps

1. **Review this plan** - Get team alignment
2. **Set up development branch** - `feature/internal-mcp-server`
3. **Install dependencies** - Add MCP SDK and Zod to package.json
4. **Create folder structure** - Set up directories
5. **Implement ServerLogger first** - Foundation for all logging
6. **Build incrementally** - One component at a time

### First PR Scope (Recommended)

- Folder structure
- Type definitions (`internalMcpTypes.ts`, `internalMcpErrors.ts`)
- `ServerLogger.ts`
- `ServerLifecycle.ts`
- Unit tests for lifecycle

This gets the foundation reviewed early and sets the pattern for future PRs.

---

## 📞 Questions & Support

### Open Questions

1. Should we version the internal tool API?
2. What tools should we implement first?
3. Do we need a UI for managing internal tools?
4. Should internal tools be hot-reloadable?

### Team Contacts

- **Architecture Questions:** [Your Name]
- **MCP Protocol Questions:** MCP SDK documentation
- **Void Integration:** Void team leads

---

**Last Updated:** 2025-10-31

**Next Review:** After Phase 1 completion

**Status:** 🔵 Ready to Start Implementation

---

## 🔌 CLIENT INTEGRATION STRATEGY (No mcp.json Required)

### Problem Statement

**Requirement:** Internal MCP server tools must be:

- ✅ Visible to the LLM agent (tool calling)
- ❌ **Not visible** in `mcp.json` (user config file)
- ❌ **Not visible** in MCP settings UI
- ✅ Automatically available without user configuration

### Solution: Virtual Internal Client

**Architecture Decision:** Instead of creating a separate MCP server process, we'll create a **"virtual internal client"** directly in `MCPChannel` that provides tools without requiring external process spawning.

```
┌─────────────────────────────────────────────────────┐
│                  Browser Process                    │
│                                                     │
│  MCPService.getMCPTools()                          │
│    ├─ External tools (from mcp.json)               │
│    └─ Internal tools (injected automatically) ←─┐  │
│                                                  │  │
└──────────────────────┬──────────────────────────│──┘
                       │ IPC                      │
┌──────────────────────▼──────────────────────────│───┐
│                Main Process                      │   │
│                                                  │   │
│  MCPChannel                                      │   │
│    ├─ infoOfClientId (external servers)         │   │
│    └─ _internalServerClient (NEW) ──────────────┘   │
│                                                      │
│  InternalMcpServer                                   │
│    └─ Direct tool execution (no transport needed)   │
│                                                      │
└──────────────────────────────────────────────────────┘
```

### Implementation Approach

#### 1. Add Internal Server to MCPChannel

**File:** `src/vs/workbench/contrib/void/electron-main/mcpChannel.ts`

```typescript
import { InternalMcpServer } from './internalMcp/server/InternalMcpServer.js';

export class MCPChannel implements IServerChannel {
    // Existing external servers
    private readonly infoOfClientId: InfoOfClientId = {};

    // NEW: Internal server (no transport, direct execution)
    private readonly _internalServer: InternalMcpServer;

    // Special internal server name (won't conflict with user config)
    private readonly INTERNAL_SERVER_NAME = '__void_internal__';

    constructor() {
        // Initialize internal server
        this._internalServer = new InternalMcpServer();
        this._internalServer.initialize().catch(err => {
            console.error('Failed to initialize internal MCP server:', err);
        });
    }

    async call(_: unknown, command: string, params: any): Promise<any> {
        if (command === 'refreshMCPServers') {
            // Existing logic for external servers...
            await this._refreshMCPServers(params);

            // NEW: Inject internal tools (always available)
            await this._injectInternalTools();
        }
        else if (command === 'callTool') {
            const { serverName, toolName, params: toolParams } = params;

            // NEW: Route internal tools directly
            if (serverName === this.INTERNAL_SERVER_NAME) {
                return await this._callInternalTool(toolName, toolParams);
            }

            // Existing external server logic...
            return await this._safeCallTool(serverName, toolName, toolParams);
        }
        // ... rest of existing logic
    }

    // NEW: Inject internal tools as a "virtual server"
    private async _injectInternalTools(): Promise<void> {
        const internalTools = await this._internalServer.getTools();

        // Create a virtual server entry (not from mcp.json)
        const virtualServerInfo: MCPServerNonError = {
            status: 'success',
            tools: internalTools.map(tool => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchemaJson // Already in JSON Schema format
            })),
            command: 'internal' // Marker for debugging
        };

        // Fire event to notify browser (just like external servers)
        this.mcpEmitters.serverEvent.onAdd.fire({
            response: {
                name: this.INTERNAL_SERVER_NAME,
                newServer: virtualServerInfo
            }
        });
    }

    // NEW: Direct internal tool execution (no MCP Client needed)
    private async _callInternalTool(toolName: string, params: any): Promise<RawMCPToolCall> {
        try {
            const result = await this._internalServer.callTool(toolName, params);

            // Convert MCP result to Void format
            const content = result.content[0];
            if (content.type === 'text') {
                return {
                    event: 'text',
                    text: content.text,
                    toolName,
                    serverName: this.INTERNAL_SERVER_NAME
                };
            }

            throw new Error(`Unsupported content type: ${content.type}`);
        } catch (error) {
            // Return error response (same format as external tools)
            return {
                event: 'error',
                text: `Internal tool error: ${error}`,
                toolName,
                serverName: this.INTERNAL_SERVER_NAME
            };
        }
    }
}
```

#### 2. MCPService Automatically Gets Internal Tools

**No changes needed!** The existing `getMCPTools()` method will automatically include internal tools:

```typescript
// Existing code in mcpService.ts (line 186-201)
public getMCPTools(): InternalToolInfo[] | undefined {
    const allTools: InternalToolInfo[] = [];

    // Loop through ALL servers (external + internal)
    for (const serverName in this.state.mcpServerOfName) {
        const server = this.state.mcpServerOfName[serverName];

        server.tools?.forEach(tool => {
            allTools.push({
                description: tool.description || '',
                params: this._transformInputSchemaToParams(tool.inputSchema),
                name: tool.name,
                mcpServerName: serverName, // Will be '__void_internal__' for internal tools
            });
        });
    }

    if (allTools.length === 0) return undefined;
    return allTools;
}
```

**Result:** Internal tools automatically appear alongside external tools, indistinguishable to the LLM!

#### 3. Hide Internal Server from UI

**File:** `src/vs/workbench/contrib/void/browser/mcp/mcpView.tsx` (or wherever MCP UI is)

```typescript
// When rendering server list, filter out internal server
const visibleServers = Object.keys(mcpService.state.mcpServerOfName)
    .filter(name => name !== '__void_internal__'); // Hide internal server

// Rest of UI logic uses visibleServers
```

#### 4. Prevent Internal Server in mcp.json

**File:** `src/vs/workbench/contrib/void/common/mcpService.ts`

```typescript
private async _parseMCPConfigFile(): Promise<MCPConfigFileJSON | null> {
    const mcpConfigUri = await this._getMCPConfigFilePath();
    try {
        const fileContent = await this.fileService.readFile(mcpConfigUri);
        const contentString = fileContent.value.toString();
        const configFileJson = JSON.parse(contentString);

        // NEW: Validate no internal server name conflicts
        if (configFileJson.mcpServers) {
            const reservedNames = ['__void_internal__', 'void-internal', 'internal'];
            for (const name of reservedNames) {
                if (name in configFileJson.mcpServers) {
                    throw new Error(
                        `Server name "${name}" is reserved for internal use. ` +
                        `Please choose a different name.`
                    );
                }
            }
        }

        if (!configFileJson.mcpServers) {
            throw new Error('Missing mcpServers property');
        }
        return configFileJson as MCPConfigFileJSON;
    } catch (error) {
        // ... existing error handling
    }
}
```

### Advantages of This Approach

✅ **Zero Configuration**

- Internal tools work immediately on first launch
- No user action required
- No mcp.json editing

✅ **No Process Overhead**

- Internal server runs in main process
- Direct method calls (no stdio, HTTP, or SSE)
- Minimal memory footprint

✅ **Transparent to Existing Code**

- `getMCPTools()` works unchanged
- Tool calling flow identical
- LLM treats internal tools same as external

✅ **User Experience**

- Users don't see internal server in settings
- No confusing "system" servers in UI
- Can't accidentally disable internal tools

✅ **Maintainability**

- Single codebase (TypeScript)
- Easy debugging (same process)
- No transport complexity

### Comparison with Alternatives

| Approach | Config File? | User Visible? | Transport Needed? | Complexity |

|----------|-------------|---------------|-------------------|------------|

| **Virtual Client (Chosen)** | ❌ No | ❌ No | ❌ No | ⭐ Low |

| Stdio Server | ✅ Yes (mcp.json) | ✅ Yes | ✅ Yes | ⭐⭐ Medium |

| HTTP Server | ✅ Yes (mcp.json) | ✅ Yes | ✅ Yes | ⭐⭐⭐ High |

| VSCode Extension API | ❌ No | ⚠️ Maybe | ⚠️ Maybe | ⭐⭐⭐ High |

### Migration Path (If Needed Later)

If you ever want to externalize internal tools:

1. **Keep same tool names** - Tool names are the contract
2. **Export as package** - Publish internal server as npm package
3. **Add to mcp.json** - Users can opt-in to external version
4. **Deprecate internal** - Gradually phase out built-in version

**Zero Breaking Changes** - Tool calling code doesn't change!
# Tool Execution and Approval System Guide

Comprehensive guide to tool execution workflows, approval mechanisms, security considerations, and error handling in the Void tools system.

## Overview

The tool execution system provides secure, controlled access to development environment operations through a structured approval workflow:

- **Approval Classification**: Tools categorized by risk level (edits, terminal, MCP, RAG)
- **Execution Pipeline**: Validation → Approval → Execution → Result processing
- **Security Controls**: Sandboxing, timeout management, resource limits
- **Error Recovery**: Comprehensive error handling and rollback mechanisms

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
- Sandbox environment consideration

#### MCP Tools (`MCP tools`)

**Risk Level**: Variable - Third-party integrations

**Included Tools:**
- All Model Context Protocol tools
- External service integrations
- Plugin-provided tools

**Approval Requirements:**
- Per-tool approval based on MCP server trust level
- Scope limitation and permission validation
- Network access controls

#### RAG Tools (`RAG tools`)

**Risk Level**: Low - Read-only information retrieval

**Included Tools:**
- `rag_index_document` - Document indexing
- `rag_search_policy` - Policy document search
- `rag_search_workspace` - Workspace document search
- `rag_get_stats` - Statistics retrieval

**Approval Requirements:**
- Currently no approval needed (read-only)
- Future: Granular permission controls

### Approval Mapping

```typescript
export const approvalTypeOfBuiltinToolName: Partial<{
  [T in BuiltinToolName]?: ToolApprovalType;
}> = {
  // File editing tools
  'create_file_or_folder': 'edits',
  'delete_file_or_folder': 'edits',
  'rewrite_file': 'edits',
  'edit_file': 'edits',
  'edit_document': 'edits',

  // Terminal tools
  'run_command': 'terminal',
  'run_persistent_command': 'terminal',
  'open_persistent_terminal': 'terminal',
  'kill_persistent_terminal': 'terminal',

  // RAG tools (read-only, no approval needed)
  // 'rag_index_document': 'RAG tools',
  // 'rag_search_policy': 'RAG tools',
  // 'rag_search_workspace': 'RAG tools',
  // 'rag_get_stats': 'RAG tools',
};
```

## Execution Pipeline

### Phase 1: Tool Call Extraction

**Process:**
1. Parse LLM response for tool calls using XML parsing system
2. Extract tool name and parameters
3. Validate basic syntax and structure

**Error Handling:**
- Malformed XML recovery
- Incomplete tool call detection
- Parameter extraction validation

### Phase 2: Schema Validation

**Process:**
1. Load tool schema definition
2. Validate parameter types and constraints
3. Check required fields and custom validators
4. Collect all validation errors

**Error Handling:**
- Type mismatch reporting
- Constraint violation details
- Missing parameter identification

### Phase 3: Approval Check

**Process:**
1. Determine tool approval type
2. Check user permissions and settings
3. Present approval dialog if required
4. Wait for user confirmation

**Approval Dialog:**
```typescript
interface ApprovalRequest {
  toolName: string;
  approvalType: ToolApprovalType;
  parameters: Record<string, any>;
  riskAssessment: {
    level: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    impact: string[];
  };
}
```

### Phase 4: Tool Execution

**Process:**
1. Prepare execution environment
2. Apply security controls and limits
3. Execute tool with validated parameters
4. Monitor execution progress and timeouts

**Security Controls:**
- Working directory restrictions
- Command sanitization
- Resource usage limits
- Network access controls

### Phase 5: Result Processing

**Process:**
1. Validate execution results
2. Apply result transformations
3. Handle execution errors
4. Prepare results for LLM consumption

## Security Controls

### Command Sanitization

```typescript
class CommandSanitizer {
  sanitize(command: string): string {
    return command
      // Remove dangerous characters
      .replace(/[;&|`$]/g, '')
      // Prevent directory traversal
      .replace(/\.\./g, '')
      // Limit command length
      .substring(0, 1000);
  }

  validateWorkingDirectory(cwd: string | null): boolean {
    if (!cwd) return true; // Allow null (use current)

    const allowedPaths = [
      process.cwd(),
      path.join(process.cwd(), 'src'),
      path.join(process.cwd(), 'test'),
    ];

    return allowedPaths.some(allowed =>
      cwd.startsWith(allowed) || path.resolve(cwd).startsWith(allowed)
    );
  }
}
```

### Resource Limits

```typescript
interface ExecutionLimits {
  timeout: number;          // Maximum execution time (ms)
  maxOutputSize: number;    // Maximum output size (bytes)
  maxFileSize: number;      // Maximum file operation size
  rateLimit: {
    requests: number;       // Requests per time window
    window: number;         // Time window (ms)
  };
}

const defaultLimits: Record<ToolApprovalType, ExecutionLimits> = {
  edits: {
    timeout: 30000,         // 30 seconds for file ops
    maxOutputSize: 1024 * 1024, // 1MB
    maxFileSize: 10 * 1024 * 1024, // 10MB
    rateLimit: { requests: 10, window: 60000 },
  },
  terminal: {
    timeout: 60000,         // 1 minute for commands
    maxOutputSize: 1024 * 1024, // 1MB
    maxFileSize: 0,         // N/A for terminal
    rateLimit: { requests: 5, window: 60000 },
  },
  'MCP tools': {
    timeout: 30000,
    maxOutputSize: 512 * 1024, // 512KB
    maxFileSize: 0,
    rateLimit: { requests: 20, window: 60000 },
  },
  'RAG tools': {
    timeout: 15000,         // 15 seconds for search
    maxOutputSize: 256 * 1024, // 256KB
    maxFileSize: 0,
    rateLimit: { requests: 50, window: 60000 },
  },
};
```

### Timeout Management

```typescript
class TimeoutManager {
  async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    toolName: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      operation()
        .then(result => {
          clearTimeout(timeoutId);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeoutId);
          reject(error);
        });
    });
  }
}
```

## Error Handling and Recovery

### Execution Errors

```typescript
type ExecutionError =
  | { type: 'timeout'; toolName: string; timeoutMs: number }
  | { type: 'permission_denied'; toolName: string; reason: string }
  | { type: 'resource_exhausted'; toolName: string; resource: string }
  | { type: 'validation_failed'; toolName: string; errors: ValidationError[] }
  | { type: 'execution_failed'; toolName: string; error: Error; output?: string };
```

### Error Recovery Strategies

```typescript
class ErrorRecoveryManager {
  async attemptRecovery(
    error: ExecutionError,
    originalParams: any,
    retryCount: number
  ): Promise<{ recovered: boolean; newParams?: any }> {

    switch (error.type) {
      case 'timeout':
        // Retry with extended timeout
        if (retryCount < 2) {
          return {
            recovered: true,
            newParams: { ...originalParams, extendedTimeout: true }
          };
        }
        break;

      case 'permission_denied':
        // Try alternative approach
        if (error.reason.includes('directory')) {
          return {
            recovered: true,
            newParams: { ...originalParams, useTempDir: true }
          };
        }
        break;

      case 'validation_failed':
        // Attempt parameter correction
        const corrected = this.correctValidationErrors(error.errors, originalParams);
        if (corrected) {
          return { recovered: true, newParams: corrected };
        }
        break;
    }

    return { recovered: false };
  }
}
```

### Rollback Mechanisms

```typescript
class RollbackManager {
  private operations: RollbackOperation[] = [];

  recordOperation(operation: RollbackOperation): void {
    this.operations.push(operation);
  }

  async rollback(): Promise<void> {
    for (const operation of this.operations.reverse()) {
      try {
        await operation.rollback();
      } catch (rollbackError) {
        console.error('Rollback failed:', rollbackError);
        // Continue with other rollbacks
      }
    }
    this.operations = [];
  }
}

interface RollbackOperation {
  description: string;
  rollback: () => Promise<void>;
}
```

## Tool-Specific Execution Details

### File Operations

#### Edit Operations

```typescript
async function executeFileEdit(params: BuiltinToolCallParams['edit_file']): Promise<BuiltinToolResultType['edit_file']> {
  // Validate file exists and is writable
  const fileStats = await fs.stat(params.uri.fsPath);
  if (!fileStats.isFile()) {
    throw new Error('Target is not a file');
  }

  // Apply search/replace operations
  const content = await fs.readFile(params.uri.fsPath, 'utf8');
  const newContent = applySearchReplace(content, params.searchReplaceBlocks);

  // Create backup for rollback
  const backupPath = `${params.uri.fsPath}.backup.${Date.now()}`;
  await fs.copyFile(params.uri.fsPath, backupPath);

  rollbackManager.recordOperation({
    description: `Edit file ${params.uri.fsPath}`,
    rollback: async () => {
      await fs.rename(backupPath, params.uri.fsPath);
    }
  });

  // Write new content
  await fs.writeFile(params.uri.fsPath, newContent);

  // Run linting and return results
  const lintErrors = await runLinting(params.uri);
  return Promise.resolve({ lintErrors: lintErrors || null });
}
```

#### Terminal Operations

```typescript
async function executeTerminalCommand(params: BuiltinToolCallParams['run_command']): Promise<BuiltinToolResultType['run_command']> {
  // Sanitize command
  const sanitizedCommand = commandSanitizer.sanitize(params.command);

  // Validate working directory
  if (!commandSanitizer.validateWorkingDirectory(params.cwd)) {
    throw new Error('Invalid working directory');
  }

  // Execute with timeout
  const executionPromise = new Promise<BuiltinToolResultType['run_command']>((resolve, reject) => {
    const child = spawn(sanitizedCommand, [], {
      cwd: params.cwd || process.cwd(),
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', data => {
      stdout += data.toString();
      if (stdout.length > limits.maxOutputSize) {
        child.kill();
        reject(new Error('Output size limit exceeded'));
      }
    });

    child.stderr.on('data', data => stderr += data.toString());

    child.on('close', (code, signal) => {
      const resolveReason: TerminalResolveReason =
        code !== null
          ? { type: 'done', exitCode: code }
          : { type: 'timeout' };

      resolve({
        result: stdout + stderr,
        resolveReason
      });
    });

    child.on('error', reject);
  });

  return timeoutManager.executeWithTimeout(
    () => executionPromise,
    limits.terminal.timeout,
    'run_command'
  );
}
```

## Performance Monitoring

### Execution Metrics

```typescript
interface ExecutionMetrics {
  toolName: string;
  approvalType: ToolApprovalType;
  startTime: number;
  endTime: number;
  success: boolean;
  errorType?: string;
  parametersCount: number;
  outputSize: number;
  timeout: number;
}

class PerformanceMonitor {
  private metrics: ExecutionMetrics[] = [];

  recordExecution(metric: ExecutionMetrics): void {
    this.metrics.push(metric);
    this.updateAggregates(metric);
  }

  getToolPerformance(toolName: string): {
    averageExecutionTime: number;
    successRate: number;
    errorBreakdown: Record<string, number>;
    throughput: number; // executions per minute
  } {
    const toolMetrics = this.metrics.filter(m => m.toolName === toolName);

    // Calculate metrics...
  }
}
```

### Resource Usage Tracking

```typescript
interface ResourceUsage {
  memoryPeak: number;
  cpuTime: number;
  ioOperations: number;
  networkRequests: number;
}

class ResourceTracker {
  trackExecution(
    toolName: string,
    execution: () => Promise<any>
  ): Promise<{ result: any; resources: ResourceUsage }> {
    const startResources = this.getCurrentResources();

    return execution().then(result => {
      const endResources = this.getCurrentResources();
      const resources: ResourceUsage = {
        memoryPeak: endResources.memory - startResources.memory,
        cpuTime: endResources.cpuTime - startResources.cpuTime,
        ioOperations: endResources.ioOps - startResources.ioOps,
        networkRequests: endResources.network - startResources.network,
      };

      return { result, resources };
    });
  }
}
```

## Integration Examples

### Complete Tool Execution Workflow

```typescript
class ToolExecutor {
  constructor(
    private validator: ToolSchemaValidator,
    private approvalManager: ApprovalManager,
    private securityManager: SecurityManager,
    private performanceMonitor: PerformanceMonitor
  ) {}

  async executeTool(
    toolCall: RawToolCall,
    context: ExecutionContext
  ): Promise<ToolResult> {
    const startTime = Date.now();

    try {
      // 1. Validate parameters
      const validation = this.validator.validateToolCall(
        toolCall.name as BuiltinToolName,
        toolCall.parameters
      );

      if (!validation.success) {
        throw new Error(`Validation failed: ${validation.errors.map(e => e.message).join(', ')}`);
      }

      // 2. Check approval requirements
      const approvalType = approvalTypeOfBuiltinToolName[toolCall.name as BuiltinToolName];
      if (approvalType && approvalType !== 'RAG tools') {
        const approved = await this.approvalManager.requestApproval({
          toolName: toolCall.name,
          approvalType,
          parameters: validation.data,
          riskAssessment: this.assessRisk(toolCall.name, validation.data)
        });

        if (!approved) {
          throw new Error('Tool execution denied by user');
        }
      }

      // 3. Apply security controls
      const sanitizedParams = await this.securityManager.sanitizeParameters(
        toolCall.name,
        validation.data
      );

      // 4. Execute tool
      const result = await this.executeToolImplementation(toolCall.name, sanitizedParams);

      // 5. Record metrics
      this.performanceMonitor.recordExecution({
        toolName: toolCall.name,
        approvalType: approvalType || 'RAG tools',
        startTime,
        endTime: Date.now(),
        success: true,
        parametersCount: Object.keys(validation.data).length,
        outputSize: this.calculateOutputSize(result),
        timeout: context.timeout || 30000,
      });

      return result;

    } catch (error) {
      // Record failed execution
      this.performanceMonitor.recordExecution({
        toolName: toolCall.name,
        approvalType: approvalTypeOfBuiltinToolName[toolCall.name as BuiltinToolName] || 'RAG tools',
        startTime,
        endTime: Date.now(),
        success: false,
        errorType: error.constructor.name,
        parametersCount: Object.keys(toolCall.parameters).length,
        outputSize: 0,
        timeout: context.timeout || 30000,
      });

      throw error;
    }
  }

  private assessRisk(toolName: string, params: any): RiskAssessment {
    // Implementation of risk assessment logic
  }

  private async executeToolImplementation(name: string, params: any): Promise<any> {
    // Route to specific tool implementation
  }

  private calculateOutputSize(result: any): number {
    // Calculate result size for metrics
  }
}
```

This comprehensive execution and approval system ensures secure, monitored, and reliable tool operations while providing detailed error recovery and performance tracking.

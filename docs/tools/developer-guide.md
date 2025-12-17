# Developer Guide: Extending the Tools System

Comprehensive guide for developers extending the Void tools system with new tools, custom validators, approval workflows, and integration patterns.

## Architecture Overview

### Core Components

The tools system consists of four main layers:

```
tools/
├── toolsServiceTypes.ts    # Type definitions and tool specifications
├── toolSchemaValidator.ts  # Validation engine and schemas
├── xmlParserService.ts     # XML parsing and extraction
└── execution/              # Tool execution and approval
```

### Extension Points

1. **Tool Definition**: Add new tools to `toolsServiceTypes.ts`
2. **Schema Validation**: Create custom validators in `toolSchemaValidator.ts`
3. **Approval Logic**: Extend approval workflows
4. **Execution Handlers**: Implement tool execution logic
5. **XML Parsing**: Add custom parsing strategies

## Adding a New Built-in Tool

### Step 1: Define Tool Parameters and Results

Add your tool to the type definitions in `toolsServiceTypes.ts`:

```typescript
// Add to BuiltinToolCallParams
'my_custom_tool': {
  inputPath: URI;                    // Input file URI
  outputFormat: 'json' | 'xml' | 'text'; // Output format
  options?: {                        // Optional configuration
    timeout?: number;
    retries?: number;
  };
};

// Add to BuiltinToolResultType
'my_custom_tool': {
  success: boolean;                  // Operation success status
  result: any;                       // Tool-specific result data
  processingTime: number;            // Execution time in ms
  metadata?: {                       // Optional metadata
    inputSize: number;
    outputSize: number;
  };
};
```

### Step 2: Add Approval Classification

Update the approval mapping:

```typescript
export const approvalTypeOfBuiltinToolName: Partial<{
  [T in BuiltinToolName]?: ToolApprovalType;
}> = {
  // ... existing mappings
  'my_custom_tool': 'edits', // Requires edit approval
};
```

### Step 3: Create Schema Validation

Define parameter constraints in `toolSchemaValidator.ts`:

```typescript
// Create schema for your tool
const myCustomToolSchema: ToolSchema = {
  toolName: 'my_custom_tool',
  params: {
    inputPath: {
      type: 'uri',
      required: true,
      customValidator: (value) => {
        if (!value || typeof value !== 'object') return 'URI is required';
        const uri = value as URI;
        if (!uri.fsPath.endsWith('.txt')) {
          return 'Only .txt files are supported';
        }
        return null;
      },
    },
    outputFormat: {
      type: 'string',
      required: true,
      customValidator: (value) => {
        const allowed = ['json', 'xml', 'text'];
        if (!allowed.includes(value as string)) {
          return `Format must be one of: ${allowed.join(', ')}`;
        }
        return null;
      },
    },
    options: {
      type: 'optional_string', // Allow undefined/null
      required: false,
    },
  },
};
```

### Step 4: Implement Execution Logic

Create the tool execution handler:

```typescript
class MyCustomToolExecutor {
  async execute(params: BuiltinToolCallParams['my_custom_tool']): Promise<BuiltinToolResultType['my_custom_tool']> {
    const startTime = Date.now();

    try {
      // Validate input file exists
      const inputPath = params.inputPath.fsPath;
      if (!await fs.pathExists(inputPath)) {
        throw new Error(`Input file does not exist: ${inputPath}`);
      }

      // Process the file based on format
      let result: any;
      switch (params.outputFormat) {
        case 'json':
          result = await this.processAsJson(inputPath);
          break;
        case 'xml':
          result = await this.processAsXml(inputPath);
          break;
        case 'text':
          result = await this.processAsText(inputPath);
          break;
      }

      return {
        success: true,
        result,
        processingTime: Date.now() - startTime,
        metadata: {
          inputSize: await this.getFileSize(inputPath),
          outputSize: JSON.stringify(result).length,
        },
      };

    } catch (error) {
      return {
        success: false,
        result: null,
        processingTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  private async processAsJson(inputPath: string): Promise<any> {
    const content = await fs.readFile(inputPath, 'utf8');
    // Custom JSON processing logic
    return JSON.parse(content);
  }

  private async processAsXml(inputPath: string): Promise<any> {
    const content = await fs.readFile(inputPath, 'utf8');
    // Custom XML processing logic
    return this.parseXmlContent(content);
  }

  private async processAsText(inputPath: string): Promise<string> {
    // Simple text processing
    return await fs.readFile(inputPath, 'utf8');
  }

  private async getFileSize(filePath: string): Promise<number> {
    const stats = await fs.stat(filePath);
    return stats.size;
  }
}
```

### Step 5: Register Tool Execution

Integrate with the execution pipeline:

```typescript
class ToolExecutionManager {
  private executors = new Map<BuiltinToolName, ToolExecutor>();

  constructor() {
    // Register your tool executor
    this.executors.set('my_custom_tool', new MyCustomToolExecutor());
  }

  async executeTool(
    toolName: BuiltinToolName,
    params: any
  ): Promise<any> {
    const executor = this.executors.get(toolName);
    if (!executor) {
      throw new Error(`No executor found for tool: ${toolName}`);
    }

    return executor.execute(params);
  }
}
```

### Step 6: Update Tool Discovery

Add your tool to the tool discovery system:

```typescript
// In prompts.ts or tool discovery module
export const builtinTools: { [K in BuiltinToolName]: InternalToolInfo } = {
  // ... existing tools
  my_custom_tool: {
    name: 'my_custom_tool',
    description: 'Process files in various formats for custom operations',
    params: {
      inputPath: {
        type: 'uri',
        description: 'Path to the input file to process',
        required: true,
      },
      outputFormat: {
        type: 'string',
        description: 'Desired output format (json, xml, text)',
        required: true,
      },
      options: {
        type: 'object',
        description: 'Optional processing configuration',
        required: false,
      },
    },
  },
};
```

## Creating Custom Validators

### Basic Custom Validation

```typescript
function createFileTypeValidator(allowedExtensions: string[]) {
  return (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return 'URI is required';

    const uri = value as URI;
    const extension = path.extname(uri.fsPath).toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      return `File type not allowed. Supported: ${allowedExtensions.join(', ')}`;
    }

    return null;
  };
}

// Usage in schema
const imageFileSchema: ToolSchema = {
  toolName: 'process_image',
  params: {
    imagePath: {
      type: 'uri',
      required: true,
      customValidator: createFileTypeValidator(['.jpg', '.png', '.gif']),
    },
  },
};
```

### Complex Validation with Dependencies

```typescript
function createDependentValidator() {
  return (value: unknown, allParams: RawToolParamsObj): string | null => {
    const format = allParams.format as string;
    const quality = allParams.quality as number;

    if (format === 'jpg' && quality && quality > 100) {
      return 'JPEG quality cannot exceed 100';
    }

    if (format === 'png' && quality !== undefined) {
      return 'PNG format does not support quality parameter';
    }

    return null;
  };
}
```

### Async Validation

```typescript
async function createExistenceValidator() {
  const fileExistsCache = new Map<string, boolean>();

  return async (value: unknown): Promise<string | null> => {
    if (!value || typeof value !== 'object') return 'URI is required';

    const uri = value as URI;
    const cacheKey = uri.toString();

    if (fileExistsCache.has(cacheKey)) {
      return fileExistsCache.get(cacheKey) ? null : 'File does not exist';
    }

    try {
      await fs.access(uri.fsPath);
      fileExistsCache.set(cacheKey, true);
      return null;
    } catch {
      fileExistsCache.set(cacheKey, false);
      return 'File does not exist';
    }
  };
}
```

## Extending Approval Workflows

### Custom Approval Logic

```typescript
class CustomApprovalManager extends BaseApprovalManager {
  async checkApproval(
    toolName: string,
    params: any,
    context: ApprovalContext
  ): Promise<ApprovalResult> {

    // Custom logic for your tools
    if (toolName === 'my_custom_tool') {
      const riskLevel = this.assessRisk(params);

      if (riskLevel === 'high') {
        return await this.requestUserApproval({
          toolName,
          params,
          riskLevel,
          reason: 'High-risk operation detected',
        });
      }
    }

    // Fall back to default approval logic
    return super.checkApproval(toolName, params, context);
  }

  private assessRisk(params: any): 'low' | 'medium' | 'high' {
    // Custom risk assessment logic
    const inputSize = params.metadata?.inputSize || 0;
    const outputFormat = params.outputFormat;

    if (inputSize > 10 * 1024 * 1024) return 'high'; // > 10MB
    if (outputFormat === 'xml') return 'medium';   // XML processing
    return 'low';
  }
}
```

### Dynamic Approval Rules

```typescript
interface ApprovalRule {
  condition: (toolName: string, params: any, context: ApprovalContext) => boolean;
  action: 'approve' | 'deny' | 'request_approval';
  reason?: string;
}

class DynamicApprovalEngine {
  private rules: ApprovalRule[] = [];

  addRule(rule: ApprovalRule): void {
    this.rules.push(rule);
  }

  evaluateRules(
    toolName: string,
    params: any,
    context: ApprovalContext
  ): ApprovalResult {
    for (const rule of this.rules) {
      if (rule.condition(toolName, params, context)) {
        switch (rule.action) {
          case 'approve':
            return { approved: true, automatic: true };
          case 'deny':
            return { approved: false, reason: rule.reason };
          case 'request_approval':
            return this.requestManualApproval(toolName, params, rule.reason);
        }
      }
    }

    return { approved: true, automatic: false }; // Default allow
  }
}

// Usage
const engine = new DynamicApprovalEngine();

// Add rules
engine.addRule({
  condition: (toolName, params) => toolName === 'delete_file' && params.recursive,
  action: 'request_approval',
  reason: 'Recursive deletion requires approval',
});

engine.addRule({
  condition: (toolName, params, context) => context.userRole === 'readonly',
  action: 'deny',
  reason: 'Read-only users cannot execute tools',
});
```

## Adding XML Parsing Strategies

### Custom Parser Implementation

```typescript
class CustomXMLParser implements XMLParserStrategy {
  async parse(xmlContent: string): Promise<ParseResult> {
    try {
      // Custom parsing logic
      const toolCalls = this.extractToolCalls(xmlContent);

      return {
        success: true,
        toolCalls,
        strategy: 'custom',
        metadata: {
          parsingTime: Date.now(),
          contentLength: xmlContent.length,
        },
      };
    } catch (error) {
      return {
        success: false,
        errors: [error.message],
        strategy: 'custom',
        fallback: true, // Allow fallback to next strategy
      };
    }
  }

  private extractToolCalls(xmlContent: string): ToolCall[] {
    // Custom extraction logic
    const toolCalls: ToolCall[] = [];
    const toolRegex = /<tool_call[^>]*>(.*?)<\/tool_call>/gs;

    let match;
    while ((match = toolRegex.exec(xmlContent)) !== null) {
      const toolContent = match[1];
      const toolCall = this.parseToolCall(toolContent);
      if (toolCall) toolCalls.push(toolCall);
    }

    return toolCalls;
  }

  private parseToolCall(content: string): ToolCall | null {
    // Extract tool name and parameters
    const nameMatch = content.match(/name="([^"]+)"/);
    if (!nameMatch) return null;

    // Parse parameters...
    return {
      name: nameMatch[1],
      parameters: this.parseParameters(content),
    };
  }
}
```

### Parser Strategy Registration

```typescript
class XMLParserService {
  private strategies: XMLParserStrategy[] = [];

  addStrategy(strategy: XMLParserStrategy, priority: number = 0): void {
    // Insert at appropriate priority position
    const insertIndex = this.strategies.findIndex(s => s.priority < priority);
    if (insertIndex === -1) {
      this.strategies.push(strategy);
    } else {
      this.strategies.splice(insertIndex, 0, strategy);
    }
  }

  // Use custom parser
  addStrategy(new CustomXMLParser(), 5); // Higher priority than defaults
}
```

## Performance Optimization

### Validator Caching Strategies

```typescript
class CachedToolSchemaValidator extends ToolSchemaValidator {
  private schemaCache = new Map<string, ToolSchema>();
  private validatorCache = new Map<string, CompiledValidator<any>>();

  compileValidator<T>(schema: ToolSchema): CompiledValidator<T> {
    const cacheKey = `${schema.toolName}:${this.getSchemaHash(schema)}`;

    if (this.validatorCache.has(cacheKey)) {
      return this.validatorCache.get(cacheKey)!;
    }

    const validator = super.compileValidator(schema);
    this.validatorCache.set(cacheKey, validator);

    return validator;
  }

  private getSchemaHash(schema: ToolSchema): string {
    // Generate hash of schema for cache invalidation
    return JSON.stringify(schema);
  }
}
```

### Batch Validation

```typescript
class BatchValidator {
  constructor(private validator: ToolSchemaValidator) {}

  async validateBatch(
    toolCalls: Array<{ name: string; params: RawToolParamsObj }>
  ): Promise<BatchValidationResult> {

    const results = await Promise.allSettled(
      toolCalls.map(call =>
        this.validator.validateToolCall(call.name as BuiltinToolName, call.params)
      )
    );

    const successful: Array<{ index: number; data: any }> = [];
    const failed: Array<{ index: number; errors: ValidationError[] }> = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        if (result.value.success) {
          successful.push({ index, data: result.value.data });
        } else {
          failed.push({ index, errors: result.value.errors });
        }
      } else {
        failed.push({
          index,
          errors: [{ field: 'unknown', message: result.reason.message }]
        });
      }
    });

    return { successful, failed };
  }
}
```

## Testing Extensions

### Unit Tests for Custom Tools

```typescript
describe('MyCustomTool', () => {
  let executor: MyCustomToolExecutor;
  let tempDir: string;

  beforeEach(async () => {
    executor = new MyCustomToolExecutor();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tool-test-'));
  });

  afterEach(async () => {
    await fs.remove(tempDir);
  });

  test('processes JSON files correctly', async () => {
    const inputFile = path.join(tempDir, 'test.txt');
    await fs.writeFile(inputFile, '{"key": "value"}');

    const result = await executor.execute({
      inputPath: URI.file(inputFile),
      outputFormat: 'json',
    });

    expect(result.success).toBe(true);
    expect(result.result).toEqual({ key: 'value' });
    expect(result.processingTime).toBeGreaterThan(0);
  });

  test('handles missing files', async () => {
    const result = await executor.execute({
      inputPath: URI.file('/nonexistent/file.txt'),
      outputFormat: 'text',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('does not exist');
  });
});
```

### Integration Tests

```typescript
describe('Tool System Integration', () => {
  let toolExecutor: ToolExecutionManager;
  let validator: ToolSchemaValidator;

  beforeEach(() => {
    toolExecutor = new ToolExecutionManager();
    validator = new ToolSchemaValidator();
  });

  test('end-to-end tool execution', async () => {
    // Simulate LLM response
    const xmlResponse = `
      <tool_call name="my_custom_tool">
        <parameter name="inputPath">file:///test/input.json

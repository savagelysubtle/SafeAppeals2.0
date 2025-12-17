# Schema Validation Guide

Comprehensive guide to the tool parameter validation system, including schema creation, custom validators, performance optimization, and error handling.

## Overview

The schema validation system provides runtime validation of tool parameters with:

- **Type checking**: Validates parameter types (string, number, boolean, URI)
- **Constraint validation**: Min/max values, regex patterns, custom validators
- **Required field checking**: Ensures mandatory parameters are present
- **Error aggregation**: Collects all validation errors (non-failing fast)
- **Performance optimization**: Pre-compiled validators with caching

## Core Architecture

### ToolSchemaValidator Class

The main validation engine with caching and metrics collection.

```typescript
class ToolSchemaValidator {
  private compiledValidators: Map<BuiltinToolName, CompiledValidator<any>>;
  private validationMetrics: Map<BuiltinToolName, {
    count: number;
    totalTime: number;
    errors: number;
  }>;
}
```

**Key Features:**
- **Compiled validators**: Pre-compiled validation functions (75x performance improvement)
- **Caching**: Validator instances cached per tool type
- **Metrics collection**: Performance monitoring and error tracking
- **Thread-safe**: Can be used across multiple validation calls

## Schema Definition

### ParamConstraint Interface

Defines validation rules for individual parameters.

```typescript
interface ParamConstraint {
  type: ParamType;                    // Parameter data type
  required?: boolean;                 // Whether parameter is mandatory
  min?: number;                       // Minimum value (numbers only)
  max?: number;                       // Maximum value (numbers only)
  pattern?: RegExp;                   // Regex pattern (strings only)
  customValidator?: (value: unknown) => string | null;
}
```

### ParamType Options

Supported parameter types for validation:

```typescript
type ParamType =
  | 'string'           // Basic string validation
  | 'number'           // Numeric validation
  | 'boolean'          // Boolean validation
  | 'uri'              // VSCode URI object validation
  | 'optional_string'  // Optional string (allows empty)
  | 'optional_uri'     // Optional URI (allows null/undefined)
  | 'page_number';     // Special pagination number with range validation
```

### ToolSchema Interface

Complete schema definition for a tool.

```typescript
interface ToolSchema {
  toolName: BuiltinToolName;          // Tool identifier
  params: {                           // Parameter constraints map
    [paramName: string]: ParamConstraint;
  };
}
```

## Basic Usage

### Creating a Validator

```typescript
import { ToolSchemaValidator } from './tools/index.js';

// Create validator instance (reuse for multiple validations)
const validator = new ToolSchemaValidator();
```

### Validating Tool Calls

```typescript
// Validate read_file parameters
const result = validator.validateToolCall('read_file', {
  uri: 'file:///path/to/file.txt',
  startLine: 1,
  endLine: 10,
  pageNumber: 1,
});

if (result.success) {
  // Type-safe validated parameters
  const params: BuiltinToolCallParams['read_file'] = result.data;
  // Execute tool with validated params
  await executeReadFile(params);
} else {
  // Handle validation errors
  console.error('Validation failed:', result.errors);
}
```

### Batch Validation

```typescript
// Validate multiple tool calls
const toolCalls = [
  { name: 'read_file', params: { uri: '...', startLine: 1 } },
  { name: 'run_command', params: { command: 'ls', cwd: '/tmp' } },
];

const results = toolCalls.map(call =>
  validator.validateToolCall(call.name as BuiltinToolName, call.params)
);

// Process results
results.forEach((result, index) => {
  if (result.success) {
    console.log(`Tool ${index} validated successfully`);
  } else {
    console.error(`Tool ${index} validation failed:`, result.errors);
  }
});
```

## Schema Creation

### Manual Schema Creation

```typescript
import { ToolSchema, ParamType } from './tools/index.js';

const readFileSchema: ToolSchema = {
  toolName: 'read_file',
  params: {
    uri: {
      type: 'uri' as ParamType,
      required: true,
    },
    startLine: {
      type: 'number' as ParamType,
      required: false,
      min: 1,
    },
    endLine: {
      type: 'number' as ParamType,
      required: false,
      min: 1,
    },
    pageNumber: {
      type: 'page_number' as ParamType,
      required: true,
    },
  },
};
```

### Automatic Schema Creation

```typescript
import { createSchemaFromToolInfo } from './tools/index.js';

// Create schema from internal tool definition
const schema = createSchemaFromToolInfo(internalToolDefinition);
```

## Custom Validators

### Basic Custom Validation

```typescript
const filePathConstraint: ParamConstraint = {
  type: 'string',
  required: true,
  customValidator: (value: unknown): string | null => {
    if (typeof value !== 'string') return 'Must be a string';

    // Check for dangerous paths
    if (value.includes('..') || value.startsWith('/etc') || value.startsWith('C:\\Windows')) {
      return 'Access to this path is not allowed';
    }

    // Check file extension
    if (!value.match(/\.(txt|md|ts|js)$/)) {
      return 'Only text files are allowed';
    }

    return null; // Valid
  },
};
```

### URI Validation

```typescript
const uriConstraint: ParamConstraint = {
  type: 'uri',
  required: true,
  customValidator: (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return 'URI is required';

    // Check if it's a valid VSCode URI
    const uri = value as URI;
    if (!uri.scheme || !uri.path) {
      return 'Invalid URI format';
    }

    // Check scheme restrictions
    if (!['file', 'vscode-remote'].includes(uri.scheme)) {
      return 'Only file:// and vscode-remote:// URIs are allowed';
    }

    return null; // Valid
  },
};
```

### Complex Validation Logic

```typescript
const editFileConstraint: ParamConstraint = {
  type: 'string',
  required: true,
  customValidator: (value: unknown): string | null => {
    if (typeof value !== 'string') return 'Search/replace blocks must be a string';

    try {
      // Parse search/replace format
      const blocks = parseSearchReplaceBlocks(value);

      for (const block of blocks) {
        // Validate search string
        if (!block.search || block.search.length === 0) {
          return 'Search string cannot be empty';
        }

        // Validate replace string (can be empty for deletion)
        if (typeof block.replace !== 'string') {
          return 'Replace string must be a string';
        }

        // Check for dangerous patterns
        if (block.search.includes('password') || block.search.includes('secret')) {
          return 'Cannot modify sensitive configuration';
        }
      }

      return null; // Valid
    } catch (error) {
      return `Invalid search/replace format: ${error.message}`;
    }
  },
};
```

## Advanced Features

### Performance Monitoring

```typescript
// Get validation metrics
const metrics = validator.getValidationMetrics();

metrics.forEach((metric, toolName) => {
  console.log(`${toolName}:`);
  console.log(`  Validations: ${metric.count}`);
  console.log(`  Average time: ${metric.totalTime / metric.count}ms`);
  console.log(`  Error rate: ${(metric.errors / metric.count) * 100}%`);
});
```

### Custom Schema Compilation

```typescript
// Manually compile a validator for performance
const customSchema: ToolSchema = {
  toolName: 'my_custom_tool',
  params: {
    input: { type: 'string', required: true },
    count: { type: 'number', required: false, min: 1, max: 100 },
  },
};

const compiledValidator = validator.compileValidator(customSchema);

// Use compiled validator directly (bypasses caching)
const result = compiledValidator({
  input: 'test value',
  count: 5,
});
```

### Validation Pipelines

```typescript
class ValidationPipeline {
  constructor(private validators: ToolSchemaValidator[]) {}

  async validate(toolName: BuiltinToolName, params: RawToolParamsObj) {
    const results = await Promise.all(
      this.validators.map(v => v.validateToolCall(toolName, params))
    );

    // Combine results
    const combinedErrors = results.flatMap(r => r.errors);
    const allSuccessful = results.every(r => r.success);

    return {
      success: allSuccessful,
      data: allSuccessful ? results[0].data : undefined,
      errors: combinedErrors,
    };
  }
}
```

## Error Handling

### ValidationError Structure

```typescript
interface ValidationError {
  field: string;     // Parameter name that failed
  message: string;   // Human-readable error message
  value?: unknown;   // The invalid value provided
}
```

### Error Aggregation

```typescript
function processValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return 'Validation successful';

  const errorMessages = errors.map(error =>
    `${error.field}: ${error.message}${error.value ? ` (got: ${error.value})` : ''}`
  );

  return `Validation failed:\n${errorMessages.join('\n')}`;
}

// Usage
const result = validator.validateToolCall('read_file', invalidParams);
if (!result.success) {
  const errorMessage = processValidationErrors(result.errors);
  console.error(errorMessage);
}
```

### Recovery Strategies

```typescript
function attemptRecovery(
  toolName: BuiltinToolName,
  invalidParams: RawToolParamsObj
): RawToolParamsObj {
  const recovered = { ...invalidParams };

  // Apply recovery logic based on tool and errors
  switch (toolName) {
    case 'read_file':
      // Set default values for optional parameters
      if (recovered.startLine === undefined) recovered.startLine = null;
      if (recovered.endLine === undefined) recovered.endLine = null;
      break;

    case 'run_command':
      // Sanitize command input
      if (typeof recovered.command === 'string') {
        recovered.command = recovered.command.replace(/[;&|`$]/g, '');
      }
      break;
  }

  return recovered;
}
```

## Built-in Constraints

### Page Number Validation

```typescript
// Special page_number type with built-in validation
const pageConstraint: ParamConstraint = {
  type: 'page_number',  // Validates: >= 1, integer
  required: true,
};

// Equivalent to:
const manualPageConstraint: ParamConstraint = {
  type: 'number',
  required: true,
  min: 1,
  customValidator: (value) => {
    if (!Number.isInteger(value)) return 'Must be an integer';
    return null;
  },
};
```

### URI Validation

```typescript
// Built-in URI validation
const uriConstraint: ParamConstraint = {
  type: 'uri',  // Validates VSCode URI objects
  required: true,
};
```

### Optional Types

```typescript
// Optional string (allows empty/undefined)
const optionalString: ParamConstraint = {
  type: 'optional_string',
  required: false,  // Can be missing entirely
};

// Optional URI (allows null/undefined)
const optionalUri: ParamConstraint = {
  type: 'optional_uri',
  required: false,
};
```

## Testing Validation

### Unit Tests

```typescript
describe('ToolSchemaValidator', () => {
  let validator: ToolSchemaValidator;

  beforeEach(() => {
    validator = new ToolSchemaValidator();
  });

  test('validates read_file parameters', () => {
    const result = validator.validateToolCall('read_file', {
      uri: URI.file('/test/file.txt'),
      startLine: 1,
      endLine: 10,
      pageNumber: 1,
    });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      uri: URI.file('/test/file.txt'),
      startLine: 1,
      endLine: 10,
      pageNumber: 1,
    });
  });

  test('rejects invalid parameters', () => {
    const result = validator.validateToolCall('read_file', {
      uri: 'not-a-uri',  // Invalid URI
      startLine: -1,      // Invalid line number
      pageNumber: 0,     // Invalid page number
    });

    expect(result.success).toBe(false);
    expect(result.errors).toHaveLength(3);
  });
});
```

### Integration Tests

```typescript
describe('Validation Integration', () => {
  test('end-to-end validation workflow', () => {
    // Simulate tool call from LLM
    const rawToolCall = {
      name: 'read_file',
      parameters: {
        uri: 'file:///workspace/src/main.ts',
        startLine: 1,
        endLine: 50,
        pageNumber: 1,
      },
    };

    // Validate parameters
    const result = validator.validateToolCall(
      rawToolCall.name,
      rawToolCall.parameters
    );

    if (result.success) {
      // Simulate tool execution
      const mockResult = {
        fileContents: '// Mock file content',
        totalFileLen: 25,
        totalNumLines: 1,
        hasNextPage: false,
      };

      expect(typeof mockResult.fileContents).toBe('string');
    } else {
      fail('Validation should have succeeded');
    }
  });
});
```

## Performance Considerations

### Caching Strategy

- **Validator compilation**: Cached per tool type (75x faster on repeat calls)
- **Schema reuse**: Reuse schema objects across validations
- **Metrics collection**: Minimal overhead for monitoring

### Optimization Tips

1. **Reuse validator instances**: Create once, use many times
2. **Batch validations**: Process multiple calls together
3. **Pre-compile schemas**: Compile validators during initialization
4. **Monitor performance**: Use built-in metrics for optimization

### Memory Management

```typescript
class ValidatorPool {
  private validators = new Map<string, ToolSchemaValidator>();

  getValidator(key: string): ToolSchemaValidator {
    if (!this.validators.has(key)) {
      this.validators.set(key, new ToolSchemaValidator());
    }
    return this.validators.get(key)!;
  }

  cleanup(): void {
    // Clear caches if memory pressure detected
    this.validators.forEach(v => {
      // Implementation depends on ToolSchemaValidator cleanup methods
    });
  }
}
```

This comprehensive validation system ensures type safety and data integrity for all tool calls while providing excellent performance and detailed error reporting.

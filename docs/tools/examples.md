# Tools System Usage Examples

Comprehensive examples demonstrating how to use the Void tools system for various development tasks, including validation, execution, error handling, and integration patterns.

## Basic Setup

### Importing and Initialization

```typescript
import {
	ToolSchemaValidator,
	BuiltinToolCallParams,
	BuiltinToolResultType,
	createSchemaFromToolInfo,
} from "./tools/index.js";

// Create validator instance (reuse for multiple validations)
const validator = new ToolSchemaValidator();
```

### Tool Call Structure

All tool calls follow a consistent XML format in LLM responses:

```xml
<tool_call name="tool_name">
  <parameter name="param1">value1
```
